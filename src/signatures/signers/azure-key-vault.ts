/**
 * Azure Key Vault signer.
 *
 * Signs using keys stored in Azure Key Vault (including Managed HSM).
 * The private key never leaves the vault — only the digest is sent for signing.
 *
 * Uses the `@azure/keyvault-keys` SDK (optional peer dependency) via the
 * `CryptographyClient.sign()` method, which accepts a pre-computed digest
 * and returns raw signature bytes. No PKCS#11 required.
 */

import { toArrayBuffer } from "#src/helpers/buffer.ts";
import { derToPem, isPem, normalizePem, parsePem } from "#src/helpers/pem.ts";
import { sha256, sha384, sha512 } from "@noble/hashes/sha2.js";
import { fromBER } from "asn1js";
import * as pkijs from "pkijs";

import { buildCertificateChain } from "../aia";
import { AzureKeyVaultSignerError, CertificateChainError } from "../types";
import type { DigestAlgorithm, KeyType, SignatureAlgorithm, Signer } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Azure SDK Types (dynamically imported)
// ─────────────────────────────────────────────────────────────────────────────

/** TokenCredential from @azure/identity — user must provide this */
type TokenCredential = import("@azure/core-auth").TokenCredential;

/** Azure Key Vault KeyClient */
type KeyClient = import("@azure/keyvault-keys").KeyClient;

/** Azure Key Vault CryptographyClient */
type CryptographyClient = import("@azure/keyvault-keys").CryptographyClient;

/** Azure Key Vault CertificateClient */
type CertificateClient = import("@azure/keyvault-certificates").CertificateClient;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** RSA signature scheme preference */
type RsaScheme = "PKCS1" | "PSS";

/** Base options shared by both key reference styles */
interface AzureKeyVaultSignerBaseOptions {
  /** DER-encoded X.509 certificate issued for this key */
  certificate: Uint8Array;

  /** Certificate chain [intermediate, ..., root] (optional) */
  certificateChain?: Uint8Array[];

  /** Build certificate chain via AIA extensions (default: false) */
  buildChain?: boolean;

  /** Timeout for AIA chain building in ms (default: 15000) */
  chainTimeout?: number;

  /**
   * Azure credential (e.g., DefaultAzureCredential from @azure/identity).
   *
   * If not provided, `DefaultAzureCredential` from `@azure/identity` is used
   * automatically, which tries multiple authentication methods in order
   * (environment variables, managed identity, Azure CLI, etc.).
   */
  credential?: TokenCredential;

  /**
   * RSA signature scheme preference (default: "PKCS1").
   *
   * Only applies to RSA keys. ECDSA keys always use ECDSA.
   *
   * - "PKCS1" — RSASSA-PKCS1-v1.5 (maximum compatibility with PDF readers)
   * - "PSS" — RSASSA-PSS (more secure, but may not verify in older PDF readers like Adobe Acrobat < 2020)
   */
  rsaScheme?: RsaScheme;

  /** Pre-configured KeyClient (optional, created automatically if not provided) */
  keyClient?: KeyClient;

  /** Pre-configured CryptographyClient (optional, created automatically if not provided) */
  cryptographyClient?: CryptographyClient;
}

/** Full key ID URL style */
interface AzureKeyVaultSignerKeyIdOptions extends AzureKeyVaultSignerBaseOptions {
  /**
   * Full key identifier URL.
   *
   * @example "https://my-vault.vault.azure.net/keys/my-key/abc123"
   * @example "https://my-hsm.managedhsm.azure.net/keys/my-key/abc123"
   */
  keyId: string;
}

/** Shorthand style with vault name + key name */
interface AzureKeyVaultSignerShorthandOptions extends AzureKeyVaultSignerBaseOptions {
  /** Vault name (the part before .vault.azure.net) */
  vaultName: string;

  /** Key name in the vault */
  keyName: string;

  /** Key version (optional, defaults to latest) */
  keyVersion?: string;

  /**
   * Vault suffix (default: "vault.azure.net").
   *
   * Use "managedhsm.azure.net" for Managed HSM.
   */
  vaultSuffix?: string;
}

/** Options for AzureKeyVaultSigner.create() */
export type AzureKeyVaultSignerOptions =
  | AzureKeyVaultSignerKeyIdOptions
  | AzureKeyVaultSignerShorthandOptions;

/** Options for AzureKeyVaultSigner.getCertificateFromKeyVault() */
export interface GetCertificateFromKeyVaultOptions {
  /** Full vault URL (e.g., "https://my-vault.vault.azure.net") */
  vaultUrl: string;

  /** Certificate name in the vault */
  certificateName: string;

  /** Certificate version (optional, defaults to latest) */
  certificateVersion?: string;

  /**
   * Azure credential.
   *
   * If not provided, `DefaultAzureCredential` from `@azure/identity` is used automatically.
   */
  credential?: TokenCredential;

  /** Pre-configured CertificateClient (optional) */
  certificateClient?: CertificateClient;
}

// ─────────────────────────────────────────────────────────────────────────────
// Algorithm Mapping
// ─────────────────────────────────────────────────────────────────────────────

/** Mapped algorithm info */
interface AlgorithmInfo {
  keyType: KeyType;
  signatureAlgorithm: SignatureAlgorithm;
  digestAlgorithm: DigestAlgorithm;
  /** Azure algorithm identifier for CryptographyClient.sign() */
  azureAlgorithm: string;
}

/**
 * Azure algorithm name → our types.
 *
 * Azure uses JWA (JSON Web Algorithms) names for signing:
 * - RS256/384/512 — RSASSA-PKCS1-v1_5
 * - PS256/384/512 — RSASSA-PSS
 * - ES256/384/512 — ECDSA
 */
const AZURE_ALGORITHM_MAP: Record<string, AlgorithmInfo> = {
  // RSA PKCS#1 v1.5
  RS256: {
    keyType: "RSA",
    signatureAlgorithm: "RSASSA-PKCS1-v1_5",
    digestAlgorithm: "SHA-256",
    azureAlgorithm: "RS256",
  },
  RS384: {
    keyType: "RSA",
    signatureAlgorithm: "RSASSA-PKCS1-v1_5",
    digestAlgorithm: "SHA-384",
    azureAlgorithm: "RS384",
  },
  RS512: {
    keyType: "RSA",
    signatureAlgorithm: "RSASSA-PKCS1-v1_5",
    digestAlgorithm: "SHA-512",
    azureAlgorithm: "RS512",
  },
  // RSA-PSS
  PS256: {
    keyType: "RSA",
    signatureAlgorithm: "RSA-PSS",
    digestAlgorithm: "SHA-256",
    azureAlgorithm: "PS256",
  },
  PS384: {
    keyType: "RSA",
    signatureAlgorithm: "RSA-PSS",
    digestAlgorithm: "SHA-384",
    azureAlgorithm: "PS384",
  },
  PS512: {
    keyType: "RSA",
    signatureAlgorithm: "RSA-PSS",
    digestAlgorithm: "SHA-512",
    azureAlgorithm: "PS512",
  },
  // ECDSA
  ES256: {
    keyType: "EC",
    signatureAlgorithm: "ECDSA",
    digestAlgorithm: "SHA-256",
    azureAlgorithm: "ES256",
  },
  ES384: {
    keyType: "EC",
    signatureAlgorithm: "ECDSA",
    digestAlgorithm: "SHA-384",
    azureAlgorithm: "ES384",
  },
  ES512: {
    keyType: "EC",
    signatureAlgorithm: "ECDSA",
    digestAlgorithm: "SHA-512",
    azureAlgorithm: "ES512",
  },
};

/**
 * Map an Azure algorithm name to our internal types.
 *
 * @param algorithm - Azure JWA algorithm name (e.g., "RS256", "ES384")
 * @returns Algorithm info
 * @throws {AzureKeyVaultSignerError} if algorithm is unsupported
 *
 * @internal Exported for testing
 */
export function mapAzureAlgorithm(algorithm: string): AlgorithmInfo {
  const info = AZURE_ALGORITHM_MAP[algorithm];

  if (!info) {
    throw new AzureKeyVaultSignerError(
      `Unsupported Azure Key Vault algorithm for PDF signing: ${algorithm}`,
    );
  }

  return info;
}

/**
 * Resolve the Azure algorithm name from a key type, digest algorithm, and RSA scheme.
 *
 * Azure keys don't lock to a single algorithm like GCP — an RSA key can be
 * used with RS256, RS384, RS512, PS256, PS384, PS512. This function picks
 * the right algorithm at sign-time based on the key type and the digest the
 * CMS builder requests.
 *
 * @param keyType - "RSA" or "EC"
 * @param digestAlgorithm - The digest algorithm requested by the signing flow
 * @param rsaScheme - "PKCS1" or "PSS" (only for RSA keys)
 * @returns The Azure JWA algorithm name
 *
 * @internal Exported for testing
 */
export function resolveAzureAlgorithm(
  keyType: KeyType,
  digestAlgorithm: DigestAlgorithm,
  rsaScheme: RsaScheme,
): string {
  if (keyType === "EC") {
    switch (digestAlgorithm) {
      case "SHA-256":
        return "ES256";
      case "SHA-384":
        return "ES384";
      case "SHA-512":
        return "ES512";
    }
  }

  // RSA
  if (rsaScheme === "PSS") {
    switch (digestAlgorithm) {
      case "SHA-256":
        return "PS256";
      case "SHA-384":
        return "PS384";
      case "SHA-512":
        return "PS512";
    }
  }

  // PKCS1 (default)
  switch (digestAlgorithm) {
    case "SHA-256":
      return "RS256";
    case "SHA-384":
      return "RS384";
    case "SHA-512":
      return "RS512";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Key URL Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a full key ID URL from shorthand options.
 *
 * @internal Exported for testing
 */
export function buildKeyId(options: AzureKeyVaultSignerShorthandOptions): string {
  const suffix = options.vaultSuffix ?? "vault.azure.net";
  const base = `https://${options.vaultName}.${suffix}/keys/${options.keyName}`;

  if (options.keyVersion) {
    return `${base}/${options.keyVersion}`;
  }

  return base;
}

/**
 * Build the vault URL from shorthand options.
 *
 * @internal Exported for testing
 */
export function buildVaultUrl(options: AzureKeyVaultSignerShorthandOptions): string {
  const suffix = options.vaultSuffix ?? "vault.azure.net";

  return `https://${options.vaultName}.${suffix}`;
}

/**
 * Extract the vault URL from a full key ID URL.
 *
 * @example
 * ```
 * parseVaultUrl("https://my-vault.vault.azure.net/keys/my-key/abc123")
 * // "https://my-vault.vault.azure.net"
 * ```
 *
 * @internal Exported for testing
 */
export function parseVaultUrl(keyId: string): string {
  const url = new URL(keyId);

  return `${url.protocol}//${url.host}`;
}

/**
 * Check if options use full key ID style.
 */
function isKeyIdOptions(
  options: AzureKeyVaultSignerOptions,
): options is AzureKeyVaultSignerKeyIdOptions {
  return "keyId" in options;
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
    throw new AzureKeyVaultSignerError("Failed to parse certificate");
  }

  const cert = new pkijs.Certificate({ schema: asn1.result });
  const spki = cert.subjectPublicKeyInfo.toSchema().toBER(false);

  return derToPem(new Uint8Array(spki), "PUBLIC KEY");
}

/**
 * Convert an Azure JWK key to PEM for comparison with the certificate.
 *
 * Azure's `KeyVaultKey.key` is a JsonWebKey. We need to convert it to
 * SPKI PEM format to compare with the certificate's public key.
 */
function jwkToSpkiPem(jwk: {
  kty?: string;
  n?: Uint8Array;
  e?: Uint8Array;
  x?: Uint8Array;
  y?: Uint8Array;
  crv?: string;
}): string | null {
  if (!jwk.kty) {
    return null;
  }

  // Use a WebCrypto-compatible JWK for conversion
  // We'll build the SPKI manually using ASN.1
  if (jwk.kty === "RSA" || jwk.kty === "RSA-HSM") {
    if (!jwk.n || !jwk.e) {
      return null;
    }

    return buildRsaSpkiPem(jwk.n, jwk.e);
  }

  if (jwk.kty === "EC" || jwk.kty === "EC-HSM") {
    if (!jwk.x || !jwk.y || !jwk.crv) {
      return null;
    }

    return buildEcSpkiPem(jwk.x, jwk.y, jwk.crv);
  }

  return null;
}

/**
 * Build an RSA SPKI PEM from modulus (n) and exponent (e).
 */
function buildRsaSpkiPem(n: Uint8Array, e: Uint8Array): string {
  // Build RSAPublicKey: SEQUENCE { INTEGER n, INTEGER e }
  const nInteger = buildAsn1Integer(n);
  const eInteger = buildAsn1Integer(e);
  const rsaPublicKey = buildAsn1Sequence([nInteger, eInteger]);

  // OID for rsaEncryption: 1.2.840.113549.1.1.1
  const rsaOid = new Uint8Array([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01]);
  const nullParam = new Uint8Array([0x05, 0x00]);
  const algorithmId = buildAsn1Sequence([rsaOid, nullParam]);

  // BIT STRING wrapping the RSAPublicKey
  const bitString = buildAsn1BitString(rsaPublicKey);

  // SubjectPublicKeyInfo: SEQUENCE { AlgorithmIdentifier, BIT STRING }
  const spki = buildAsn1Sequence([algorithmId, bitString]);

  return derToPem(spki, "PUBLIC KEY");
}

/**
 * Build an EC SPKI PEM from x, y coordinates and curve name.
 */
function buildEcSpkiPem(x: Uint8Array, y: Uint8Array, crv: string): string {
  // OID for ecPublicKey: 1.2.840.10045.2.1
  const ecOid = new Uint8Array([0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01]);

  // Curve OID
  const curveOid = getCurveOid(crv);

  if (!curveOid) {
    return "";
  }

  const algorithmId = buildAsn1Sequence([ecOid, curveOid]);

  // Uncompressed point: 0x04 || x || y
  const pointData = new Uint8Array(1 + x.length + y.length);
  pointData[0] = 0x04;
  pointData.set(x, 1);
  pointData.set(y, 1 + x.length);

  const bitString = buildAsn1BitString(pointData);

  const spki = buildAsn1Sequence([algorithmId, bitString]);

  return derToPem(spki, "PUBLIC KEY");
}

/**
 * Get the OID for a named EC curve.
 */
function getCurveOid(crv: string): Uint8Array | null {
  switch (crv) {
    case "P-256":
      // 1.2.840.10045.3.1.7
      return new Uint8Array([0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07]);
    case "P-384":
      // 1.3.132.0.34
      return new Uint8Array([0x06, 0x05, 0x2b, 0x81, 0x04, 0x00, 0x22]);
    case "P-521":
      // 1.3.132.0.35
      return new Uint8Array([0x06, 0x05, 0x2b, 0x81, 0x04, 0x00, 0x23]);
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ASN.1 DER Encoding Helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildAsn1Length(length: number): Uint8Array {
  if (length < 0x80) {
    return new Uint8Array([length]);
  }

  if (length < 0x100) {
    return new Uint8Array([0x81, length]);
  }

  if (length < 0x10000) {
    return new Uint8Array([0x82, (length >> 8) & 0xff, length & 0xff]);
  }

  return new Uint8Array([0x83, (length >> 16) & 0xff, (length >> 8) & 0xff, length & 0xff]);
}

function buildAsn1Sequence(elements: Uint8Array[]): Uint8Array {
  let totalLength = 0;

  for (const el of elements) {
    totalLength += el.length;
  }

  const lengthBytes = buildAsn1Length(totalLength);
  const result = new Uint8Array(1 + lengthBytes.length + totalLength);
  result[0] = 0x30; // SEQUENCE tag
  result.set(lengthBytes, 1);

  let offset = 1 + lengthBytes.length;

  for (const el of elements) {
    result.set(el, offset);
    offset += el.length;
  }

  return result;
}

function buildAsn1Integer(value: Uint8Array): Uint8Array {
  // Ensure positive: if high bit is set, prepend 0x00
  const needsPadding = value.length > 0 && (value[0] & 0x80) !== 0;
  const intLength = needsPadding ? value.length + 1 : value.length;
  const lengthBytes = buildAsn1Length(intLength);
  const result = new Uint8Array(1 + lengthBytes.length + intLength);
  result[0] = 0x02; // INTEGER tag
  result.set(lengthBytes, 1);

  if (needsPadding) {
    result[1 + lengthBytes.length] = 0x00;
    result.set(value, 2 + lengthBytes.length);
  } else {
    result.set(value, 1 + lengthBytes.length);
  }

  return result;
}

function buildAsn1BitString(data: Uint8Array): Uint8Array {
  // BIT STRING: tag(0x03) + length + unused-bits(0x00) + data
  const contentLength = 1 + data.length; // 1 byte for unused bits
  const lengthBytes = buildAsn1Length(contentLength);
  const result = new Uint8Array(1 + lengthBytes.length + contentLength);
  result[0] = 0x03; // BIT STRING tag
  result.set(lengthBytes, 1);
  result[1 + lengthBytes.length] = 0x00; // no unused bits
  result.set(data, 2 + lengthBytes.length);

  return result;
}

/**
 * Check if two public keys match (PEM comparison).
 */
function publicKeysMatch(vaultPem: string, certPem: string): boolean {
  return normalizePem(vaultPem) === normalizePem(certPem);
}

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic Imports
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dynamically import @azure/keyvault-keys.
 */
async function importKeyVaultKeys(): Promise<typeof import("@azure/keyvault-keys")> {
  try {
    return await import("@azure/keyvault-keys");
  } catch (error) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const code = (error as NodeJS.ErrnoException).code;

    if (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND") {
      throw new AzureKeyVaultSignerError(
        "@azure/keyvault-keys is required. Install with: npm install @azure/keyvault-keys @azure/identity",
      );
    }

    throw error;
  }
}

/**
 * Dynamically import @azure/keyvault-certificates.
 */
async function importKeyVaultCertificates(): Promise<
  typeof import("@azure/keyvault-certificates")
> {
  try {
    return await import("@azure/keyvault-certificates");
  } catch (error) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const code = (error as NodeJS.ErrnoException).code;

    if (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND") {
      throw new AzureKeyVaultSignerError(
        "@azure/keyvault-certificates is required. Install with: npm install @azure/keyvault-certificates @azure/identity",
      );
    }

    throw error;
  }
}

/**
 * Resolve the credential — use the provided one or create a DefaultAzureCredential.
 *
 * @azure/identity is dynamically imported only when no credential is provided.
 */
async function resolveCredential(credential?: TokenCredential): Promise<TokenCredential> {
  if (credential) {
    return credential;
  }

  try {
    const { DefaultAzureCredential } = await import("@azure/identity");

    return new DefaultAzureCredential();
  } catch (error) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const code = (error as NodeJS.ErrnoException).code;

    if (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND") {
      throw new AzureKeyVaultSignerError(
        "@azure/identity is required when no credential is provided. " +
          "Install with: npm install @azure/identity",
      );
    }

    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REST Error Handling
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shape of errors thrown by Azure SDK (RestError).
 */
interface AzureRestError extends Error {
  statusCode?: number;
  code?: string;
}

/**
 * Type guard for Azure REST errors.
 */
function isAzureRestError(error: unknown): error is AzureRestError {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const restError = error as AzureRestError;

  return restError instanceof Error && typeof restError.statusCode === "number";
}

/**
 * Detect key type from Azure's key type string.
 *
 * Azure key types: "RSA", "RSA-HSM", "EC", "EC-HSM", "oct", "oct-HSM"
 *
 * @internal Exported for testing
 */
export function detectKeyType(azureKeyType: string): KeyType {
  if (azureKeyType === "RSA" || azureKeyType === "RSA-HSM") {
    return "RSA";
  }

  if (azureKeyType === "EC" || azureKeyType === "EC-HSM") {
    return "EC";
  }

  throw new AzureKeyVaultSignerError(
    `Unsupported key type for PDF signing: ${azureKeyType}. Only RSA and EC keys are supported.`,
  );
}

/**
 * Detect the EC curve's associated digest algorithm from the Azure curve name.
 *
 * EC keys in Azure are locked to a specific curve, and each curve implies
 * a specific digest algorithm for signing.
 *
 * @internal Exported for testing
 */
export function ecCurveToDigestAlgorithm(crv: string): DigestAlgorithm {
  switch (crv) {
    case "P-256":
      return "SHA-256";
    case "P-384":
      return "SHA-384";
    case "P-521":
      return "SHA-512";
    default:
      throw new AzureKeyVaultSignerError(
        `Unsupported EC curve for PDF signing: ${crv}. Use P-256, P-384, or P-521.`,
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AzureKeyVaultSigner
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Signer that uses Azure Key Vault for signing operations.
 *
 * Supports RSA and ECDSA keys stored in Azure Key Vault, including
 * HSM-backed keys (both standard Key Vault and Managed HSM).
 * The private key never leaves the vault — only the digest is sent for signing.
 *
 * **Performance note:** Each `sign()` call makes a network request to Azure
 * Key Vault (~50-200ms latency). For bulk signing, consider the performance
 * implications.
 *
 * @example
 * ```typescript
 * // Uses DefaultAzureCredential automatically
 * const signer = await AzureKeyVaultSigner.create({
 *   keyId: "https://my-vault.vault.azure.net/keys/my-key/abc123",
 *   certificate: certificateDer,
 * });
 *
 * const pdf = await PDF.load(pdfBytes);
 * const { bytes } = await pdf.sign({ signer });
 * ```
 */
export class AzureKeyVaultSigner implements Signer {
  readonly certificate: Uint8Array;
  readonly certificateChain: Uint8Array[];
  readonly keyType: KeyType;
  readonly signatureAlgorithm: SignatureAlgorithm;

  /** The full key ID URL (for logging/debugging) */
  readonly keyId: string;

  /** RSA signature scheme preference */
  readonly rsaScheme: RsaScheme;

  private readonly cryptoClient: CryptographyClient;

  private constructor(
    cryptoClient: CryptographyClient,
    keyId: string,
    certificate: Uint8Array,
    certificateChain: Uint8Array[],
    keyType: KeyType,
    signatureAlgorithm: SignatureAlgorithm,
    rsaScheme: RsaScheme,
  ) {
    this.cryptoClient = cryptoClient;
    this.keyId = keyId;
    this.certificate = certificate;
    this.certificateChain = certificateChain;
    this.keyType = keyType;
    this.signatureAlgorithm = signatureAlgorithm;
    this.rsaScheme = rsaScheme;
  }

  /**
   * Create an AzureKeyVaultSigner from a key reference.
   *
   * @param options - Configuration options (key reference, certificate, credential, etc.)
   * @returns A new AzureKeyVaultSigner instance
   * @throws {AzureKeyVaultSignerError} if key is invalid, disabled, or certificate doesn't match
   *
   * @example
   * ```typescript
   * // Full key ID URL (uses DefaultAzureCredential automatically)
   * const signer = await AzureKeyVaultSigner.create({
   *   keyId: "https://my-vault.vault.azure.net/keys/my-key/abc123",
   *   certificate: certificateDer,
   * });
   *
   * // Shorthand with explicit credential
   * const signer = await AzureKeyVaultSigner.create({
   *   vaultName: "my-vault",
   *   keyName: "my-key",
   *   keyVersion: "abc123",
   *   certificate: certificateDer,
   *   credential: new DefaultAzureCredential(),
   * });
   * ```
   */
  static async create(options: AzureKeyVaultSignerOptions): Promise<AzureKeyVaultSigner> {
    // Dynamically import Azure SDK
    const keyvaultKeys = await importKeyVaultKeys();

    // Resolve key ID and vault URL
    const keyId = isKeyIdOptions(options) ? options.keyId : buildKeyId(options);
    const vaultUrl = isKeyIdOptions(options)
      ? parseVaultUrl(options.keyId)
      : buildVaultUrl(options);
    const rsaScheme = options.rsaScheme ?? "PKCS1";

    // Resolve credential (use DefaultAzureCredential if not provided)
    const credential = await resolveCredential(options.credential);

    // Create or use provided clients
    const keyClient = options.keyClient ?? new keyvaultKeys.KeyClient(vaultUrl, credential);

    try {
      // Extract key name (and optionally version) from keyId
      const url = new URL(keyId);
      const pathParts = url.pathname.split("/").filter(Boolean);
      // pathParts: ["keys", "<name>"] or ["keys", "<name>", "<version>"]
      const keyName = pathParts[1];
      const keyVersion = pathParts.length > 2 ? pathParts[2] : undefined;

      if (!keyName) {
        throw new AzureKeyVaultSignerError(
          `Invalid key ID URL: ${keyId}. Expected format: https://{vault}.vault.azure.net/keys/{name}/{version}`,
        );
      }

      // Fetch key metadata
      const keyVaultKey = keyVersion
        ? await keyClient.getKey(keyName, { version: keyVersion })
        : await keyClient.getKey(keyName);

      // Validate key is enabled
      if (keyVaultKey.properties.enabled === false) {
        throw new AzureKeyVaultSignerError(
          `Key is not enabled: ${keyId}. Enable the key in Azure Key Vault before signing.`,
        );
      }

      // Validate key supports signing
      const keyOps = keyVaultKey.keyOperations ?? [];

      if (!keyOps.includes("sign")) {
        throw new AzureKeyVaultSignerError(
          `Key does not support signing: ${keyId}. ` +
            `Permitted operations: [${keyOps.join(", ")}]. The key must have the "sign" operation.`,
        );
      }

      // Detect key type
      const azureKeyType = keyVaultKey.key?.kty;

      if (!azureKeyType) {
        throw new AzureKeyVaultSignerError(`Failed to get key type for: ${keyId}`);
      }

      const keyType = detectKeyType(azureKeyType);

      // Determine the signature algorithm
      let signatureAlgorithm: SignatureAlgorithm;

      if (keyType === "EC") {
        signatureAlgorithm = "ECDSA";
      } else if (rsaScheme === "PSS") {
        signatureAlgorithm = "RSA-PSS";

        console.warn(
          "Warning: RSA-PSS signatures may not verify correctly in older PDF readers " +
            "(Adobe Acrobat < 2020). Consider using PKCS1 (default) for maximum compatibility.",
        );
      } else {
        signatureAlgorithm = "RSASSA-PKCS1-v1_5";
      }

      // Validate certificate matches vault key
      if (keyVaultKey.key) {
        const vaultKeyPem = jwkToSpkiPem(keyVaultKey.key);
        const certPem = extractPublicKeyFromCertificate(options.certificate);

        if (vaultKeyPem && !publicKeysMatch(vaultKeyPem, certPem)) {
          throw new AzureKeyVaultSignerError(
            "Certificate public key does not match Azure Key Vault key. " +
              "Ensure the certificate was issued for this key.",
          );
        }
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

      // Create CryptographyClient
      const cryptoClient =
        options.cryptographyClient ?? new keyvaultKeys.CryptographyClient(keyVaultKey, credential);

      // Use the actual key ID returned by Azure (includes version)
      const resolvedKeyId = keyVaultKey.id ?? keyId;

      return new AzureKeyVaultSigner(
        cryptoClient,
        resolvedKeyId,
        options.certificate,
        chainCertsDer,
        keyType,
        signatureAlgorithm,
        rsaScheme,
      );
    } catch (error) {
      if (error instanceof AzureKeyVaultSignerError) {
        throw error;
      }

      if (isAzureRestError(error)) {
        switch (error.statusCode) {
          case 401:
          case 403:
            throw new AzureKeyVaultSignerError(
              `Permission denied for key: ${keyId}. ` +
                `Ensure the identity has 'Key Sign' and 'Key Get' permissions on the vault.`,
              error,
            );

          case 404:
            throw new AzureKeyVaultSignerError(
              `Key not found: ${keyId}. Verify the key name, version, and vault URL.`,
              error,
            );
        }
      }

      const message = error instanceof Error ? error.message : String(error);

      throw new AzureKeyVaultSignerError(`Failed to initialize Azure Key Vault signer: ${message}`);
    }
  }

  /**
   * Load a signing certificate from Azure Key Vault.
   *
   * Azure Key Vault certificates contain the X.509 certificate (and optionally
   * the chain). The certificate is stored alongside the key with the same name.
   *
   * @param options - Options specifying which certificate to load
   * @returns The certificate DER bytes and optional chain
   * @throws {AzureKeyVaultSignerError} if certificate retrieval fails
   *
   * @example
   * ```typescript
   * // Uses DefaultAzureCredential automatically
   * const { cert, chain } = await AzureKeyVaultSigner.getCertificateFromKeyVault({
   *   vaultUrl: "https://my-vault.vault.azure.net",
   *   certificateName: "my-signing-cert",
   * });
   *
   * const signer = await AzureKeyVaultSigner.create({
   *   vaultName: "my-vault",
   *   keyName: "my-signing-cert",
   *   certificate: cert,
   *   certificateChain: chain,
   * });
   * ```
   */
  static async getCertificateFromKeyVault(options: GetCertificateFromKeyVaultOptions): Promise<{
    cert: Uint8Array;
    chain?: Uint8Array[];
  }> {
    const keyvaultCerts = await importKeyVaultCertificates();

    // Resolve credential (use DefaultAzureCredential if not provided)
    const credential = await resolveCredential(options.credential);

    const client =
      options.certificateClient ??
      new keyvaultCerts.CertificateClient(options.vaultUrl, credential);

    try {
      const certificate = options.certificateVersion
        ? await client.getCertificateVersion(options.certificateName, options.certificateVersion)
        : await client.getCertificate(options.certificateName);

      if (!certificate.cer) {
        throw new AzureKeyVaultSignerError(
          `Certificate has no certificate data: ${options.certificateName}`,
        );
      }

      // certificate.cer is the DER-encoded X.509 certificate
      const cert = new Uint8Array(certificate.cer);

      // Azure Key Vault doesn't directly expose the chain via getCertificate().
      // The chain is available as part of the certificate's secret (PEM/PFX),
      // but for our use case, we return just the leaf certificate.
      // Users can provide the chain separately or use buildChain: true.
      return { cert };
    } catch (error) {
      if (error instanceof AzureKeyVaultSignerError) {
        throw error;
      }

      if (isAzureRestError(error)) {
        switch (error.statusCode) {
          case 401:
          case 403:
            throw new AzureKeyVaultSignerError(
              `Permission denied for certificate: ${options.certificateName}. ` +
                `Ensure the identity has 'Certificate Get' permission on the vault.`,
              error,
            );

          case 404:
            throw new AzureKeyVaultSignerError(
              `Certificate not found: ${options.certificateName}. ` +
                `Verify the certificate name and vault URL.`,
              error,
            );
        }
      }

      const message = error instanceof Error ? error.message : String(error);

      throw new AzureKeyVaultSignerError(
        `Failed to fetch certificate from Azure Key Vault: ${message}`,
      );
    }
  }

  /**
   * Sign data using the Azure Key Vault key.
   *
   * The data is hashed locally using the requested digest algorithm, then the
   * digest is sent to Azure Key Vault for signing. The Azure algorithm is
   * resolved at sign-time based on the key type and RSA scheme preference.
   *
   * @param data - The data to sign
   * @param algorithm - The digest algorithm to use
   * @returns The signature bytes
   * @throws {AzureKeyVaultSignerError} if signing fails
   */
  async sign(data: Uint8Array, algorithm: DigestAlgorithm): Promise<Uint8Array> {
    // Hash data locally
    const digest = this.hashData(data, algorithm);

    // Resolve the Azure algorithm
    const azureAlgorithm = resolveAzureAlgorithm(this.keyType, algorithm, this.rsaScheme);

    try {
      const result = await this.cryptoClient.sign(azureAlgorithm, digest);

      if (!result.result) {
        throw new AzureKeyVaultSignerError("Azure Key Vault did not return a signature");
      }

      return new Uint8Array(result.result);
    } catch (error) {
      if (error instanceof AzureKeyVaultSignerError) {
        throw error;
      }

      if (isAzureRestError(error) && (error.statusCode === 401 || error.statusCode === 403)) {
        throw new AzureKeyVaultSignerError(
          `Permission denied for signing with key: ${this.keyId}. ` +
            `Ensure the identity has 'Key Sign' permission.`,
          error,
        );
      }

      const message = error instanceof Error ? error.message : String(error);

      throw new AzureKeyVaultSignerError(`Failed to sign with Azure Key Vault: ${message}`);
    }
  }

  /**
   * Hash data using the specified algorithm.
   *
   * @returns The digest bytes
   */
  private hashData(data: Uint8Array, algorithm: DigestAlgorithm): Uint8Array {
    switch (algorithm) {
      case "SHA-256":
        return sha256(data);
      case "SHA-384":
        return sha384(data);
      case "SHA-512":
        return sha512(data);
    }
  }
}
