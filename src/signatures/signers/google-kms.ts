/**
 * Google Cloud KMS signer.
 *
 * Signs using keys stored in Google Cloud Key Management Service (KMS),
 * including HSM-backed keys. The private key never leaves KMS - only the
 * digest is sent for signing.
 */

import { toArrayBuffer } from "#src/helpers/buffer.ts";
import { derToPem, isPem, normalizePem, parsePem } from "#src/helpers/pem.ts";
import { sha256, sha384, sha512 } from "@noble/hashes/sha2.js";
import { fromBER } from "asn1js";
import * as pkijs from "pkijs";

import { buildCertificateChain } from "../aia";
import { CertificateChainError, KmsSignerError } from "../types";
import type { DigestAlgorithm, KeyType, SignatureAlgorithm, Signer } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** KMS client type - dynamically imported */
type KeyManagementServiceClient = import("@google-cloud/kms").KeyManagementServiceClient;
/** Subset of methods actually used for signing */
type KmsClient = Pick<
  KeyManagementServiceClient,
  "asymmetricSign" | "getCryptoKeyVersion" | "getPublicKey"
>;

/** Secret Manager client type - dynamically imported */
type SecretManagerServiceClient = import("@google-cloud/secret-manager").SecretManagerServiceClient;

/** Base options shared by both key reference styles */
interface GoogleKmsSignerBaseOptions {
  /** DER-encoded X.509 certificate issued for this KMS key */
  certificate: Uint8Array;

  /** Certificate chain [intermediate, ..., root] (optional) */
  certificateChain?: Uint8Array[];

  /** Build certificate chain via AIA extensions (default: false) */
  buildChain?: boolean;

  /** Timeout for AIA chain building in ms (default: 15000) */
  chainTimeout?: number;

  /** Pre-configured KMS client (optional, uses ADC if not provided) */
  client?: KmsClient;
}

/** Full resource name style */
interface GoogleKmsSignerFullNameOptions extends GoogleKmsSignerBaseOptions {
  /** Full KMS key version resource name */
  keyVersionName: string;
}

/** Shorthand style */
interface GoogleKmsSignerShorthandOptions extends GoogleKmsSignerBaseOptions {
  projectId: string;
  locationId: string;
  keyRingId: string;
  keyId: string;
  /** Key version number (default: "1") */
  keyVersion?: string;
}

/** Options for GoogleKmsSigner.create() */
type GoogleKmsSignerOptions = GoogleKmsSignerFullNameOptions | GoogleKmsSignerShorthandOptions;

// ─────────────────────────────────────────────────────────────────────────────
// Algorithm Mapping
// ─────────────────────────────────────────────────────────────────────────────

/** Mapped algorithm info from KMS algorithm */
interface AlgorithmInfo {
  keyType: KeyType;
  signatureAlgorithm: SignatureAlgorithm;
  digestAlgorithm: DigestAlgorithm;
}

/** KMS algorithm to our types mapping */
const KMS_ALGORITHM_MAP: Record<string, AlgorithmInfo> = {
  // RSA PKCS#1 v1.5
  RSA_SIGN_PKCS1_2048_SHA256: {
    keyType: "RSA",
    signatureAlgorithm: "RSASSA-PKCS1-v1_5",
    digestAlgorithm: "SHA-256",
  },
  RSA_SIGN_PKCS1_3072_SHA256: {
    keyType: "RSA",
    signatureAlgorithm: "RSASSA-PKCS1-v1_5",
    digestAlgorithm: "SHA-256",
  },
  RSA_SIGN_PKCS1_4096_SHA256: {
    keyType: "RSA",
    signatureAlgorithm: "RSASSA-PKCS1-v1_5",
    digestAlgorithm: "SHA-256",
  },
  RSA_SIGN_PKCS1_4096_SHA512: {
    keyType: "RSA",
    signatureAlgorithm: "RSASSA-PKCS1-v1_5",
    digestAlgorithm: "SHA-512",
  },
  // RSA-PSS (with compatibility warning)
  RSA_SIGN_PSS_2048_SHA256: {
    keyType: "RSA",
    signatureAlgorithm: "RSA-PSS",
    digestAlgorithm: "SHA-256",
  },
  RSA_SIGN_PSS_3072_SHA256: {
    keyType: "RSA",
    signatureAlgorithm: "RSA-PSS",
    digestAlgorithm: "SHA-256",
  },
  RSA_SIGN_PSS_4096_SHA256: {
    keyType: "RSA",
    signatureAlgorithm: "RSA-PSS",
    digestAlgorithm: "SHA-256",
  },
  RSA_SIGN_PSS_4096_SHA512: {
    keyType: "RSA",
    signatureAlgorithm: "RSA-PSS",
    digestAlgorithm: "SHA-512",
  },
  // ECDSA
  EC_SIGN_P256_SHA256: {
    keyType: "EC",
    signatureAlgorithm: "ECDSA",
    digestAlgorithm: "SHA-256",
  },
  EC_SIGN_P384_SHA384: {
    keyType: "EC",
    signatureAlgorithm: "ECDSA",
    digestAlgorithm: "SHA-384",
  },
  EC_SIGN_P521_SHA512: {
    keyType: "EC",
    signatureAlgorithm: "ECDSA",
    digestAlgorithm: "SHA-512",
  },
};

/** Algorithms that are explicitly rejected */
const REJECTED_ALGORITHMS = new Set(["EC_SIGN_SECP256K1_SHA256"]);

/**
 * Map KMS algorithm name to our types.
 *
 * @param algorithm - The KMS algorithm identifier
 * @returns Algorithm info (keyType, signatureAlgorithm, digestAlgorithm)
 * @throws {KmsSignerError} if algorithm is unsupported or rejected
 *
 * @internal Exported for testing
 */
export function mapKmsAlgorithm(algorithm: string): AlgorithmInfo {
  if (REJECTED_ALGORITHMS.has(algorithm)) {
    throw new KmsSignerError(
      `Unsupported curve for PDF signing: secp256k1. Use P-256, P-384, or P-521 instead.`,
    );
  }

  const info = KMS_ALGORITHM_MAP[algorithm];

  if (!info) {
    throw new KmsSignerError(`Unsupported KMS algorithm for PDF signing: ${algorithm}`);
  }

  return info;
}

/**
 * Check if an algorithm uses RSA-PSS.
 *
 * @internal Exported for testing
 */
export function isRsaPss(algorithm: string): boolean {
  return algorithm.startsWith("RSA_SIGN_PSS_");
}

// ─────────────────────────────────────────────────────────────────────────────
// Resource Name Building
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build full KMS key version resource name from shorthand options.
 *
 * @internal Exported for testing
 */
export function buildKeyVersionName(options: GoogleKmsSignerShorthandOptions): string {
  const keyVersion = options.keyVersion ?? "1";

  return `projects/${options.projectId}/locations/${options.locationId}/keyRings/${options.keyRingId}/cryptoKeys/${options.keyId}/cryptoKeyVersions/${keyVersion}`;
}

/**
 * Check if options use full name style.
 */
function isFullNameOptions(
  options: GoogleKmsSignerOptions,
): options is GoogleKmsSignerFullNameOptions {
  return "keyVersionName" in options;
}

// ─────────────────────────────────────────────────────────────────────────────
// Certificate Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract public key PEM from a DER-encoded certificate.
 */
function extractPublicKeyFromCertificate(certDer: Uint8Array): string {
  const asn1 = fromBER(toArrayBuffer(certDer));

  if (asn1.offset === -1) {
    throw new KmsSignerError("Failed to parse certificate");
  }

  const cert = new pkijs.Certificate({ schema: asn1.result });
  const spki = cert.subjectPublicKeyInfo.toSchema().toBER(false);

  return derToPem(new Uint8Array(spki), "PUBLIC KEY");
}

/**
 * Check if two public keys match.
 */
function publicKeysMatch(kmsPem: string, certPem: string): boolean {
  return normalizePem(kmsPem) === normalizePem(certPem);
}

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic Imports
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dynamically import @google-cloud/kms.
 */
async function importKms(): Promise<typeof import("@google-cloud/kms")> {
  try {
    return await import("@google-cloud/kms");
  } catch (error) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const code = (error as NodeJS.ErrnoException).code;

    if (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND") {
      throw new KmsSignerError(
        "@google-cloud/kms is required. Install with: npm install @google-cloud/kms",
      );
    }

    throw error;
  }
}

/**
 * Dynamically import @google-cloud/secret-manager.
 */
async function importSecretManager(): Promise<typeof import("@google-cloud/secret-manager")> {
  try {
    return await import("@google-cloud/secret-manager");
  } catch (error) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const code = (error as NodeJS.ErrnoException).code;

    if (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND") {
      throw new KmsSignerError(
        "@google-cloud/secret-manager is required. Install with: npm install @google-cloud/secret-manager",
      );
    }

    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// gRPC Error Handling
// ─────────────────────────────────────────────────────────────────────────────

/**
 * gRPC status codes.
 *
 * @see https://grpc.github.io/grpc/core/md_doc_statuscodes.html
 */
const GrpcStatus = {
  OK: 0,
  CANCELLED: 1,
  UNKNOWN: 2,
  INVALID_ARGUMENT: 3,
  DEADLINE_EXCEEDED: 4,
  NOT_FOUND: 5,
  ALREADY_EXISTS: 6,
  PERMISSION_DENIED: 7,
  RESOURCE_EXHAUSTED: 8,
  FAILED_PRECONDITION: 9,
  ABORTED: 10,
  OUT_OF_RANGE: 11,
  UNIMPLEMENTED: 12,
  INTERNAL: 13,
  UNAVAILABLE: 14,
  DATA_LOSS: 15,
  UNAUTHENTICATED: 16,
} as const;

/**
 * Shape of errors thrown by Google Cloud client libraries (google-gax).
 */
interface GrpcError extends Error {
  code: number;
  details?: string;
}

/**
 * Type guard for gRPC errors from Google Cloud libraries.
 */
function isGrpcError(error: unknown): error is GrpcError {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const grpcError = error as GrpcError;

  return (
    grpcError instanceof Error &&
    typeof grpcError.code === "number" &&
    grpcError.code >= 0 &&
    grpcError.code <= 16
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GoogleKmsSigner
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Signer that uses Google Cloud KMS for signing operations.
 *
 * Supports RSA and ECDSA keys stored in Cloud KMS, including HSM-backed keys.
 * The private key never leaves KMS - only the digest is sent for signing.
 *
 * **Performance note:** Each `sign()` call makes a network request to KMS
 * (~50-200ms latency). For bulk signing, consider the performance implications.
 *
 * @example
 * ```typescript
 * const signer = await GoogleKmsSigner.create({
 *   keyVersionName: "projects/my-project/locations/us/keyRings/ring/cryptoKeys/key/cryptoKeyVersions/1",
 *   certificate: certificateDer,
 * });
 *
 * const pdf = await PDF.load(pdfBytes);
 * const { bytes } = await pdf.sign({ signer });
 * ```
 */
export class GoogleKmsSigner implements Signer {
  readonly certificate: Uint8Array;
  readonly certificateChain: Uint8Array[];
  readonly keyType: KeyType;
  readonly signatureAlgorithm: SignatureAlgorithm;

  /** The digest algorithm this KMS key uses (locked at key creation) */
  readonly digestAlgorithm: DigestAlgorithm;

  /** Full resource name of the KMS key version (for logging/debugging) */
  readonly keyVersionName: string;

  private readonly client: KmsClient;

  private constructor(
    client: KmsClient,
    keyVersionName: string,
    certificate: Uint8Array,
    certificateChain: Uint8Array[],
    keyType: KeyType,
    signatureAlgorithm: SignatureAlgorithm,
    digestAlgorithm: DigestAlgorithm,
  ) {
    this.client = client;
    this.keyVersionName = keyVersionName;
    this.certificate = certificate;
    this.certificateChain = certificateChain;
    this.keyType = keyType;
    this.signatureAlgorithm = signatureAlgorithm;
    this.digestAlgorithm = digestAlgorithm;
  }

  /**
   * Create a GoogleKmsSigner from KMS key reference.
   *
   * @param options - Configuration options (key reference, certificate, etc.)
   * @returns A new GoogleKmsSigner instance
   * @throws {KmsSignerError} if key is invalid, disabled, or certificate doesn't match
   *
   * @example
   * ```typescript
   * // Full resource name
   * const signer = await GoogleKmsSigner.create({
   *   keyVersionName: "projects/my-project/locations/us-east1/keyRings/my-ring/cryptoKeys/my-key/cryptoKeyVersions/1",
   *   certificate: certificateDer,
   * });
   *
   * // Shorthand
   * const signer = await GoogleKmsSigner.create({
   *   projectId: "my-project",
   *   locationId: "us-east1",
   *   keyRingId: "my-ring",
   *   keyId: "my-key",
   *   certificate: certificateDer,
   *   buildChain: true,
   * });
   * ```
   */
  static async create(options: GoogleKmsSignerOptions): Promise<GoogleKmsSigner> {
    // Build full resource name if shorthand
    const keyVersionName = isFullNameOptions(options)
      ? options.keyVersionName
      : buildKeyVersionName(options);

    // Create or use provided client
    // Dynamically import KMS only if client was not provided
    const client = options.client ?? new (await importKms()).KeyManagementServiceClient();

    try {
      // Fetch key version metadata
      const [keyVersion] = await client.getCryptoKeyVersion({
        name: keyVersionName,
      });

      // Validate key state
      if (keyVersion.state !== "ENABLED") {
        throw new KmsSignerError(
          `Key is not enabled: ${keyVersionName}. State: ${keyVersion.state}. Only ENABLED keys can sign.`,
        );
      }

      // Get the algorithm and validate it's for signing
      const algorithmRaw = keyVersion.algorithm;

      if (!algorithmRaw) {
        throw new KmsSignerError(`Failed to get algorithm for key: ${keyVersionName}`);
      }

      // Convert to string (algorithm can be string or enum value)
      const algorithm = String(algorithmRaw);

      // Map to our types (throws if unsupported)
      const algorithmInfo = mapKmsAlgorithm(algorithm);

      // Log warning for RSA-PSS
      if (isRsaPss(algorithm)) {
        console.warn(
          "Warning: RSA-PSS signatures may not verify correctly in older PDF readers " +
            "(Adobe Acrobat < 2020). Consider using PKCS#1 v1.5 for maximum compatibility.",
        );
      }

      // Fetch public key and validate it matches certificate
      const [publicKeyResponse] = await client.getPublicKey({
        name: keyVersionName,
      });

      if (!publicKeyResponse.pem) {
        throw new KmsSignerError(`Failed to get public key for key: ${keyVersionName}`);
      }

      const certPublicKeyPem = extractPublicKeyFromCertificate(options.certificate);

      if (!publicKeysMatch(publicKeyResponse.pem, certPublicKeyPem)) {
        throw new KmsSignerError(
          "Certificate public key does not match KMS key. " +
            "Ensure the certificate was issued for this KMS key.",
        );
      }

      // Build certificate chain if requested
      let chainCertsDer: Uint8Array[] = options.certificateChain ?? [];

      if (options.buildChain) {
        try {
          chainCertsDer = await buildCertificateChain(options.certificate, {
            existingChain: chainCertsDer,
            timeout: options.chainTimeout,
          });
        } catch (error) {
          if (error instanceof CertificateChainError) {
            console.warn(`Could not complete certificate chain via AIA: ${error.message}`);
          } else {
            throw error;
          }
        }
      }

      return new GoogleKmsSigner(
        client,
        keyVersionName,
        options.certificate,
        chainCertsDer,
        algorithmInfo.keyType,
        algorithmInfo.signatureAlgorithm,
        algorithmInfo.digestAlgorithm,
      );
    } catch (error) {
      if (error instanceof KmsSignerError) {
        throw error;
      }

      if (isGrpcError(error)) {
        switch (error.code) {
          case GrpcStatus.NOT_FOUND:
            throw new KmsSignerError(
              `Key not found: ${keyVersionName}. Verify the resource name and your permissions.`,
              error,
            );

          case GrpcStatus.PERMISSION_DENIED:
            throw new KmsSignerError(
              `Permission denied for key: ${keyVersionName}. ` +
                `Ensure the service account has 'cloudkms.cryptoKeyVersions.useToSign' permission.`,
              error,
            );

          case GrpcStatus.UNAVAILABLE:
            throw new KmsSignerError(
              `Failed to connect to KMS: ${error.message ?? "service unavailable"}`,
              error,
            );
        }
      }

      const message = error instanceof Error ? error.message : String(error);

      throw new KmsSignerError(`Failed to initialize KMS signer: ${message}`);
    }
  }

  /**
   * Loads a signing certificate from Google Secret Manager for use with KMS-based signing.
   *
   * This helper retrieves certificate material securely stored in Secret Manager, supporting
   * both PEM and DER formats:
   *   - If the secret contains PEM-encoded data, all certificates will be parsed.
   *     The first is used as the signing cert (`cert`), and the remainder returned as
   *     the optional `chain` (intermediates).
   *   - If the secret contains raw DER data, it is returned as the signing cert (`cert`).
   *
   * Supports cross-project use: the secret may be in a different GCP project than the KMS key.
   *
   * - The secret should contain the certificate in binary DER (recommended) or PEM format.
   * - Private keys must never be stored in Secret Manager.
   *
   * @param secretVersionName Full resource name for the secret version,
   *   e.g. "projects/my-project/secrets/my-cert/versions/latest"
   * @param options Optional client configuration, including a SecretManagerServiceClient instance.
   * @returns An object with `cert` (main certificate bytes) and optional `chain` (intermediates).
   * @throws {KmsSignerError} if @google-cloud/secret-manager is not installed or retrieval fails.
   *
   * @example
   * // Load a certificate from the same project
   * const { cert } = await GoogleKmsSigner.getCertificateFromSecretManager(
   *   "projects/my-project/secrets/signing-cert/versions/latest"
   * );
   *
   * // Load from a different project (cross-project access)
   * const { cert, chain } = await GoogleKmsSigner.getCertificateFromSecretManager(
   *   "projects/shared-certs-project/secrets/org-ca-cert/versions/1"
   * );
   *
   * // Use the result with KMS-based signing
   * const signer = await GoogleKmsSigner.create({
   *   keyVersionName: "...",
   *   certificate: cert,
   *   chain,
   * });
   */
  static async getCertificateFromSecretManager(
    secretVersionName: string,
    options?: { client?: SecretManagerServiceClient },
  ): Promise<{
    cert: Uint8Array;
    chain?: Uint8Array[];
  }> {
    // Dynamically import Secret Manager
    const secretManager = await importSecretManager();

    // Create or use provided client
    const client = options?.client ?? new secretManager.SecretManagerServiceClient();

    try {
      const [version] = await client.accessSecretVersion({
        name: secretVersionName,
      });

      if (!version.payload?.data) {
        throw new KmsSignerError(`Secret is empty: ${secretVersionName}`);
      }

      let data =
        typeof version.payload.data === "string"
          ? version.payload.data
          : new TextDecoder().decode(version.payload.data);

      if (isPem(data)) {
        const certs = parsePem(data).map(block => block.der);

        const [first, ...rest] = certs;

        return {
          cert: first,
          chain: rest,
        };
      }

      return {
        cert: new TextEncoder().encode(data),
      };
    } catch (error) {
      if (error instanceof KmsSignerError) {
        throw error;
      }

      if (isGrpcError(error)) {
        switch (error.code) {
          case GrpcStatus.NOT_FOUND:
            throw new KmsSignerError(
              `Secret not found: ${secretVersionName}. Verify the resource name and your permissions.`,
              error,
            );

          case GrpcStatus.PERMISSION_DENIED:
            throw new KmsSignerError(
              `Permission denied for secret: ${secretVersionName}. ` +
                `Ensure the service account has 'secretmanager.versions.access' permission.`,
              error,
            );
        }
      }

      const message = error instanceof Error ? error.message : String(error);

      throw new KmsSignerError(`Failed to fetch certificate from Secret Manager: ${message}`);
    }
  }

  /**
   * Sign data using the KMS key.
   *
   * The data is hashed locally using the key's digest algorithm before being
   * sent to KMS for signing. This is more efficient than sending the full data.
   *
   * @param data - The data to sign
   * @param algorithm - The digest algorithm to use (must match the key's algorithm)
   * @returns The signature bytes
   * @throws {KmsSignerError} if digest algorithm doesn't match the key's algorithm
   */
  async sign(data: Uint8Array, algorithm: DigestAlgorithm): Promise<Uint8Array> {
    // Validate digest algorithm matches KMS key
    if (algorithm !== this.digestAlgorithm) {
      throw new KmsSignerError(
        `Digest algorithm mismatch: this KMS key requires ${this.digestAlgorithm}, ` +
          `but ${algorithm} was requested`,
      );
    }

    // Hash data locally and build digest object for KMS
    const { digest, digestKey } = this.hashData(data, algorithm);

    try {
      const [response] = await this.client.asymmetricSign({
        name: this.keyVersionName,
        digest: {
          [digestKey]: digest,
        },
      });

      if (!response.signature) {
        throw new KmsSignerError("KMS did not return a signature");
      }

      if (typeof response.signature === "string") {
        return new TextEncoder().encode(response.signature);
      }

      // Return signature bytes directly
      // KMS returns DER-encoded ECDSA signatures, which matches our interface
      return new Uint8Array(response.signature);
    } catch (error) {
      if (error instanceof KmsSignerError) {
        throw error;
      }

      if (isGrpcError(error) && error.code === GrpcStatus.UNAVAILABLE) {
        throw new KmsSignerError(
          `Failed to connect to KMS: ${error.message ?? "service unavailable"}`,
          error,
        );
      }

      const message = error instanceof Error ? error.message : String(error);

      throw new KmsSignerError(`Failed to sign with KMS: ${message}`);
    }
  }

  /**
   * Hash data using the specified algorithm.
   *
   * @returns The digest bytes and the KMS digest key name
   */
  private hashData(
    data: Uint8Array,
    algorithm: DigestAlgorithm,
  ): { digest: Uint8Array; digestKey: "sha256" | "sha384" | "sha512" } {
    switch (algorithm) {
      case "SHA-256":
        return { digest: sha256(data), digestKey: "sha256" };
      case "SHA-384":
        return { digest: sha384(data), digestKey: "sha384" };
      case "SHA-512":
        return { digest: sha512(data), digestKey: "sha512" };
    }
  }
}
