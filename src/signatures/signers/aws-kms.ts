/**
 * AWS KMS signer.
 *
 * Signs using asymmetric keys stored in AWS Key Management Service (KMS),
 * including FIPS 140-2-validated HSM-backed keys. The private key never
 * leaves KMS - only the digest is sent for signing.
 */

import { toArrayBuffer } from "#src/helpers/buffer.ts";
import { derToPem, isPem, normalizePem, parsePem } from "#src/helpers/pem.ts";
import { fromBER } from "asn1js";
import * as pkijs from "pkijs";

import { buildCertificateChain } from "../aia";
import { CertificateChainError, KmsSignerError } from "../types";
import type { DigestAlgorithm, KeyType, SignatureAlgorithm, Signer } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Full KMSClient type - dynamically imported */
type KMSClient = import("@aws-sdk/client-kms").KMSClient;
/** Subset of the KMS client methods used for signing */
type KmsClient = Pick<KMSClient, "send">;

/** Secrets Manager client type - dynamically imported */
type SecretsManagerClient = import("@aws-sdk/client-secrets-manager").SecretsManagerClient;

/** Supported AWS KMS signing algorithm specs */
type AwsSigningAlgorithm =
  | "RSASSA_PKCS1_V1_5_SHA_256"
  | "RSASSA_PKCS1_V1_5_SHA_384"
  | "RSASSA_PKCS1_V1_5_SHA_512"
  | "RSASSA_PSS_SHA_256"
  | "RSASSA_PSS_SHA_384"
  | "RSASSA_PSS_SHA_512"
  | "ECDSA_SHA_256"
  | "ECDSA_SHA_384"
  | "ECDSA_SHA_512";

/** Options for AwsKmsSigner.create() */
interface AwsKmsSignerOptions {
  /** KMS key ARN or key ID (e.g. "arn:aws:kms:us-east-1:123456789012:key/abcd-..." or "abcd-...") */
  keyId: string;

  /**
   * AWS region of the key. Required if no `client` is supplied and the region is
   * not available via the AWS SDK default chain (e.g. `AWS_REGION` env var).
   */
  region?: string;

  /**
   * Which signing algorithm to use. AWS KMS keys may support multiple algorithms
   * (e.g. an RSA_2048 key supports PKCS1_V1_5 and PSS at SHA-256/384/512). If
   * omitted, the first algorithm advertised by `GetPublicKey` is used.
   */
  signingAlgorithm?: AwsSigningAlgorithm;

  /** DER-encoded X.509 signing certificate */
  certificate: Uint8Array;

  /** Certificate chain [intermediate, ..., root] (optional) */
  certificateChain?: Uint8Array[];

  /** Build certificate chain via AIA extensions (default: false) */
  buildChain?: boolean;

  /** Timeout for AIA chain building in ms (default: 15000) */
  chainTimeout?: number;

  /** Pre-configured KMS client (optional, uses default credential chain if not provided) */
  client?: KmsClient;
}

// ─────────────────────────────────────────────────────────────────────────────
// Algorithm Mapping
// ─────────────────────────────────────────────────────────────────────────────

/** Mapped algorithm info from AWS KMS algorithm */
interface AlgorithmInfo {
  keyType: KeyType;
  signatureAlgorithm: SignatureAlgorithm;
  digestAlgorithm: DigestAlgorithm;
}

/** KMS algorithm to our types mapping */
const KMS_ALGORITHM_MAP: Record<string, AlgorithmInfo> = {
  // RSA PKCS#1 v1.5
  RSASSA_PKCS1_V1_5_SHA_256: {
    keyType: "RSA",
    signatureAlgorithm: "RSASSA-PKCS1-v1_5",
    digestAlgorithm: "SHA-256",
  },
  RSASSA_PKCS1_V1_5_SHA_384: {
    keyType: "RSA",
    signatureAlgorithm: "RSASSA-PKCS1-v1_5",
    digestAlgorithm: "SHA-384",
  },
  RSASSA_PKCS1_V1_5_SHA_512: {
    keyType: "RSA",
    signatureAlgorithm: "RSASSA-PKCS1-v1_5",
    digestAlgorithm: "SHA-512",
  },
  // RSA-PSS
  RSASSA_PSS_SHA_256: {
    keyType: "RSA",
    signatureAlgorithm: "RSA-PSS",
    digestAlgorithm: "SHA-256",
  },
  RSASSA_PSS_SHA_384: {
    keyType: "RSA",
    signatureAlgorithm: "RSA-PSS",
    digestAlgorithm: "SHA-384",
  },
  RSASSA_PSS_SHA_512: {
    keyType: "RSA",
    signatureAlgorithm: "RSA-PSS",
    digestAlgorithm: "SHA-512",
  },
  // ECDSA
  ECDSA_SHA_256: {
    keyType: "EC",
    signatureAlgorithm: "ECDSA",
    digestAlgorithm: "SHA-256",
  },
  ECDSA_SHA_384: {
    keyType: "EC",
    signatureAlgorithm: "ECDSA",
    digestAlgorithm: "SHA-384",
  },
  ECDSA_SHA_512: {
    keyType: "EC",
    signatureAlgorithm: "ECDSA",
    digestAlgorithm: "SHA-512",
  },
};

/**
 * Map AWS KMS algorithm name to our types.
 *
 * @param algorithm - The KMS `SigningAlgorithmSpec`
 * @returns Algorithm info (keyType, signatureAlgorithm, digestAlgorithm)
 * @throws {KmsSignerError} if algorithm is unsupported
 *
 * @internal Exported for testing
 */
export function mapKmsAlgorithm(algorithm: string): AlgorithmInfo {
  const info = KMS_ALGORITHM_MAP[algorithm];

  if (!info) {
    throw new KmsSignerError(`Unsupported AWS KMS signing algorithm: ${algorithm}`);
  }

  return info;
}

/**
 * Check if an algorithm uses RSA-PSS.
 *
 * @internal Exported for testing
 */
export function isRsaPss(algorithm: string): boolean {
  return algorithm.startsWith("RSASSA_PSS_");
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
function publicKeysMatch(kmsSpkiPem: string, certPem: string): boolean {
  return normalizePem(kmsSpkiPem) === normalizePem(certPem);
}

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic Imports
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dynamically import @aws-sdk/client-kms.
 */
async function importKms(): Promise<typeof import("@aws-sdk/client-kms")> {
  try {
    return await import("@aws-sdk/client-kms");
  } catch (error) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const code = (error as NodeJS.ErrnoException).code;

    if (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND") {
      throw new KmsSignerError(
        "@aws-sdk/client-kms is required. Install with: npm install @aws-sdk/client-kms",
      );
    }

    throw error;
  }
}

/**
 * Dynamically import @aws-sdk/client-secrets-manager.
 */
async function importSecretsManager(): Promise<typeof import("@aws-sdk/client-secrets-manager")> {
  try {
    return await import("@aws-sdk/client-secrets-manager");
  } catch (error) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const code = (error as NodeJS.ErrnoException).code;

    if (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND") {
      throw new KmsSignerError(
        "@aws-sdk/client-secrets-manager is required. Install with: npm install @aws-sdk/client-secrets-manager",
      );
    }

    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AWS SDK Error Handling
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shape of service exceptions thrown by the AWS SDK v3.
 */
interface AwsServiceError extends Error {
  name: string;
  $metadata?: { httpStatusCode?: number };
}

/**
 * Type guard for AWS SDK service exceptions.
 */
function isAwsServiceError(error: unknown): error is AwsServiceError {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const e = error as AwsServiceError;

  return e instanceof Error && typeof e.name === "string";
}

// ─────────────────────────────────────────────────────────────────────────────
// AwsKmsSigner
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Signer that uses AWS KMS for signing operations.
 *
 * Supports RSA and ECDSA keys stored in AWS KMS, including HSM-backed keys.
 * The private key never leaves KMS - only the digest is sent for signing.
 *
 * Credentials are resolved by the AWS SDK's default credential chain
 * (env vars, IAM task role, EC2/Lambda instance profile, shared credentials file).
 *
 * **Performance note:** Each `sign()` call makes a network request to KMS
 * (~50-200ms latency). For bulk signing, consider the performance implications.
 *
 * @example
 * ```typescript
 * const signer = await AwsKmsSigner.create({
 *   keyId: "arn:aws:kms:us-east-1:123456789012:key/abcd-...",
 *   region: "us-east-1",
 *   certificate: certificateDer,
 * });
 *
 * const pdf = await PDF.load(pdfBytes);
 * const { bytes } = await pdf.sign({ signer });
 * ```
 */
export class AwsKmsSigner implements Signer {
  readonly certificate: Uint8Array;
  readonly certificateChain: Uint8Array[];
  readonly keyType: KeyType;
  readonly signatureAlgorithm: SignatureAlgorithm;

  /** The digest algorithm derived from the chosen KMS signing algorithm */
  readonly digestAlgorithm: DigestAlgorithm;

  /** KMS key ARN or key ID (for logging/debugging) */
  readonly keyId: string;

  /** The AWS KMS signing algorithm used on each `sign()` call */
  readonly kmsSigningAlgorithm: AwsSigningAlgorithm;

  private readonly client: KmsClient;

  private constructor(
    client: KmsClient,
    keyId: string,
    kmsSigningAlgorithm: AwsSigningAlgorithm,
    certificate: Uint8Array,
    certificateChain: Uint8Array[],
    keyType: KeyType,
    signatureAlgorithm: SignatureAlgorithm,
    digestAlgorithm: DigestAlgorithm,
  ) {
    this.client = client;
    this.keyId = keyId;
    this.kmsSigningAlgorithm = kmsSigningAlgorithm;
    this.certificate = certificate;
    this.certificateChain = certificateChain;
    this.keyType = keyType;
    this.signatureAlgorithm = signatureAlgorithm;
    this.digestAlgorithm = digestAlgorithm;
  }

  /**
   * Create an AwsKmsSigner from a KMS key reference.
   *
   * Calls `GetPublicKey` on the KMS key to determine which signing algorithms
   * are supported, selects one (the requested `signingAlgorithm` if provided,
   * otherwise the first supported), and validates that the certificate's public
   * key matches the KMS public key.
   *
   * @param options - Configuration options (key reference, certificate, etc.)
   * @returns A new AwsKmsSigner instance
   * @throws {KmsSignerError} if the key is invalid, the requested algorithm is
   *   unsupported on the key, or the certificate public key does not match.
   *
   * @example
   * ```typescript
   * // ARN
   * const signer = await AwsKmsSigner.create({
   *   keyId: "arn:aws:kms:us-east-1:123456789012:key/abcd-...",
   *   certificate: certificateDer,
   * });
   *
   * // Alias
   * const signer = await AwsKmsSigner.create({
   *   keyId: "alias/my-signing-key",
   *   region: "us-east-1",
   *   certificate: certificateDer,
   *   buildChain: true,
   * });
   * ```
   */
  static async create(options: AwsKmsSignerOptions): Promise<AwsKmsSigner> {
    // Create or use provided client.
    // Dynamically import KMS only if client was not provided.
    let client: KmsClient;

    if (options.client) {
      client = options.client;
    } else {
      const kms = await importKms();

      client = new kms.KMSClient(options.region ? { region: options.region } : {});
    }

    try {
      // Fetch the public key + list of supported signing algorithms.
      const kms = await importKms();
      const publicKeyResponse = await client.send(
        new kms.GetPublicKeyCommand({ KeyId: options.keyId }),
      );

      if (publicKeyResponse.KeyUsage && publicKeyResponse.KeyUsage !== "SIGN_VERIFY") {
        throw new KmsSignerError(
          `KMS key ${options.keyId} has usage ${publicKeyResponse.KeyUsage}; only SIGN_VERIFY keys can sign.`,
        );
      }

      const supportedAlgorithms = publicKeyResponse.SigningAlgorithms ?? [];

      if (supportedAlgorithms.length === 0) {
        throw new KmsSignerError(
          `KMS key ${options.keyId} has no signing algorithms. Ensure the key usage is SIGN_VERIFY and the key spec is RSA or ECC.`,
        );
      }

      if (options.signingAlgorithm && !supportedAlgorithms.includes(options.signingAlgorithm)) {
        throw new KmsSignerError(
          `Requested signing algorithm ${options.signingAlgorithm} is not supported by KMS key ${options.keyId}. Supported: ${supportedAlgorithms.join(", ")}`,
        );
      }

      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const chosenAlgorithm = (options.signingAlgorithm ??
        supportedAlgorithms[0]) as AwsSigningAlgorithm;

      const algorithmInfo = mapKmsAlgorithm(chosenAlgorithm);

      // Log warning for RSA-PSS
      if (isRsaPss(chosenAlgorithm)) {
        console.warn(
          "Warning: RSA-PSS signatures may not verify correctly in older PDF readers " +
            "(Adobe Acrobat < 2020). Consider using PKCS#1 v1.5 for maximum compatibility.",
        );
      }

      // Validate that the certificate's public key matches the KMS public key.
      if (!publicKeyResponse.PublicKey) {
        throw new KmsSignerError(`Failed to get public key for key: ${options.keyId}`);
      }

      const kmsSpkiPem = derToPem(publicKeyResponse.PublicKey, "PUBLIC KEY");
      const certSpkiPem = extractPublicKeyFromCertificate(options.certificate);

      if (!publicKeysMatch(kmsSpkiPem, certSpkiPem)) {
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

      return new AwsKmsSigner(
        client,
        options.keyId,
        chosenAlgorithm,
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

      if (isAwsServiceError(error)) {
        switch (error.name) {
          case "NotFoundException":
            throw new KmsSignerError(
              `Key not found: ${options.keyId}. Verify the key ID/ARN and your permissions.`,
              error,
            );

          case "AccessDeniedException":
            throw new KmsSignerError(
              `Permission denied for key: ${options.keyId}. ` +
                `Ensure the principal has 'kms:Sign' and 'kms:GetPublicKey' permissions on this key.`,
              error,
            );

          case "DisabledException":
            throw new KmsSignerError(
              `Key is disabled: ${options.keyId}. Only enabled keys can sign.`,
              error,
            );

          case "KMSInvalidStateException":
            throw new KmsSignerError(
              `Key is in an invalid state: ${options.keyId}. ${error.message}`,
              error,
            );
        }
      }

      const message = error instanceof Error ? error.message : String(error);

      throw new KmsSignerError(`Failed to initialize KMS signer: ${message}`);
    }
  }

  /**
   * Loads a signing certificate from AWS Secrets Manager for use with KMS-based signing.
   *
   * The secret should contain the certificate material in PEM (recommended) or raw
   * DER form:
   *   - If the secret contains PEM-encoded data, all certificates will be parsed.
   *     The first is used as the signing cert (`cert`), and the remainder returned as
   *     the optional `chain` (intermediates).
   *   - If the secret contains raw DER data, it is returned as the signing cert (`cert`).
   *
   * Private keys must never be stored in Secrets Manager.
   *
   * @param secretId ARN or name of the Secrets Manager secret.
   * @param options Optional client configuration, including a SecretsManagerClient instance.
   * @returns An object with `cert` (main certificate bytes) and optional `chain` (intermediates).
   * @throws {KmsSignerError} if @aws-sdk/client-secrets-manager is not installed or retrieval fails.
   *
   * @example
   * const { cert, chain } = await AwsKmsSigner.getCertificateFromSecretsManager(
   *   "arn:aws:secretsmanager:us-east-1:123456789012:secret:signing-cert-AbCdEf"
   * );
   *
   * const signer = await AwsKmsSigner.create({
   *   keyId: "...",
   *   certificate: cert,
   *   certificateChain: chain,
   * });
   */
  static async getCertificateFromSecretsManager(
    secretId: string,
    options?: { region?: string; client?: SecretsManagerClient },
  ): Promise<{
    cert: Uint8Array;
    chain?: Uint8Array[];
  }> {
    // Dynamically import Secrets Manager
    const secretsManager = await importSecretsManager();

    const client =
      options?.client ??
      new secretsManager.SecretsManagerClient(options?.region ? { region: options.region } : {});

    try {
      const response = await client.send(
        new secretsManager.GetSecretValueCommand({ SecretId: secretId }),
      );

      const payload =
        response.SecretString ??
        (response.SecretBinary ? new TextDecoder().decode(response.SecretBinary) : undefined);

      if (!payload) {
        throw new KmsSignerError(`Secret is empty: ${secretId}`);
      }

      if (isPem(payload)) {
        const certs = parsePem(payload).map(block => block.der);

        const [first, ...rest] = certs;

        return {
          cert: first,
          chain: rest.length > 0 ? rest : undefined,
        };
      }

      return {
        cert: new TextEncoder().encode(payload),
      };
    } catch (error) {
      if (error instanceof KmsSignerError) {
        throw error;
      }

      if (isAwsServiceError(error)) {
        switch (error.name) {
          case "ResourceNotFoundException":
            throw new KmsSignerError(
              `Secret not found: ${secretId}. Verify the ARN/name and your permissions.`,
              error,
            );

          case "AccessDeniedException":
            throw new KmsSignerError(
              `Permission denied for secret: ${secretId}. ` +
                `Ensure the principal has 'secretsmanager:GetSecretValue' on this secret.`,
              error,
            );
        }
      }

      const message = error instanceof Error ? error.message : String(error);

      throw new KmsSignerError(`Failed to fetch certificate from Secrets Manager: ${message}`);
    }
  }

  /**
   * Sign data using the KMS key.
   *
   * The data is hashed locally using the selected digest algorithm before being
   * sent to KMS for signing.
   *
   * Signature format:
   * - RSA: PKCS#1 v1.5 or PSS signature bytes (AWS KMS returns the raw signature).
   * - ECDSA: DER-encoded SEQUENCE {INTEGER r, INTEGER s} (AWS KMS returns DER).
   *
   * @param data - The data to sign
   * @param algorithm - The digest algorithm to use (must match the KMS key)
   * @returns The signature bytes
   * @throws {KmsSignerError} if the digest algorithm doesn't match the key's algorithm
   */
  async sign(data: Uint8Array, algorithm: DigestAlgorithm): Promise<Uint8Array> {
    if (algorithm !== this.digestAlgorithm) {
      throw new KmsSignerError(
        `Digest algorithm mismatch: this KMS key requires ${this.digestAlgorithm}, ` +
          `but ${algorithm} was requested`,
      );
    }

    const digestBuffer = await crypto.subtle.digest(algorithm, toArrayBuffer(data));
    const digest = new Uint8Array(digestBuffer);

    try {
      const kms = await importKms();
      const response = await this.client.send(
        new kms.SignCommand({
          KeyId: this.keyId,
          Message: digest,
          MessageType: "DIGEST",
          SigningAlgorithm: this.kmsSigningAlgorithm,
        }),
      );

      if (!response.Signature) {
        throw new KmsSignerError("KMS did not return a signature");
      }

      return response.Signature;
    } catch (error) {
      if (error instanceof KmsSignerError) {
        throw error;
      }

      if (isAwsServiceError(error)) {
        switch (error.name) {
          case "DisabledException":
            throw new KmsSignerError(
              `Key is disabled: ${this.keyId}. Only enabled keys can sign.`,
              error,
            );

          case "KMSInvalidStateException":
            throw new KmsSignerError(
              `Key is in an invalid state: ${this.keyId}. ${error.message}`,
              error,
            );
        }
      }

      const message = error instanceof Error ? error.message : String(error);

      throw new KmsSignerError(`Failed to sign with KMS: ${message}`);
    }
  }
}
