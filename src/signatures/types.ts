/**
 * Digital signature types and interfaces.
 *
 * PDF Reference: Section 12.8 "Digital Signatures"
 * ETSI EN 319 142-1 (PAdES)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Core Types
// ─────────────────────────────────────────────────────────────────────────────

/** Supported digest algorithms */
export type DigestAlgorithm = "SHA-256" | "SHA-384" | "SHA-512";

/** Key types */
export type KeyType = "RSA" | "EC";

/** Signature algorithms */
export type SignatureAlgorithm = "RSASSA-PKCS1-v1_5" | "RSA-PSS" | "ECDSA";

/** Signature format (SubFilter in PDF) */
export type SubFilter = "adbe.pkcs7.detached" | "ETSI.CAdES.detached";

/** PAdES conformance levels */
export type PAdESLevel = "B-B" | "B-T" | "B-LT" | "B-LTA";

// ─────────────────────────────────────────────────────────────────────────────
// Signer Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A signer provides cryptographic signing capabilities.
 *
 * Implementations can wrap local keys, HSM, cloud KMS, smart cards, etc.
 * The interface is async to support remote signing services.
 *
 * @example
 * ```typescript
 * // Using built-in P12Signer
 * const signer = await P12Signer.create(p12Bytes, "password");
 *
 * // Custom cloud signer (note: data is hashed internally by sign())
 * class CloudSigner implements Signer {
 *   readonly certificate: Uint8Array;
 *   readonly keyType = "RSA";
 *   readonly signatureAlgorithm = "RSASSA-PKCS1-v1_5";
 *
 *   async sign(data: Uint8Array, algorithm: DigestAlgorithm): Promise<Uint8Array> {
 *     // Cloud service handles hashing internally
 *     return await cloudService.sign(data, algorithm);
 *   }
 * }
 * ```
 */
export interface Signer {
  /** DER-encoded X.509 signing certificate */
  readonly certificate: Uint8Array;

  /** Certificate chain [intermediate, ..., root] (optional) */
  readonly certificateChain?: Uint8Array[];

  /** Key type (RSA or EC) - required for CMS construction */
  readonly keyType: KeyType;

  /** Signature algorithm - required for CMS construction */
  readonly signatureAlgorithm: SignatureAlgorithm;

  /**
   * Sign data and return signature bytes.
   *
   * The signer is responsible for hashing the data using the specified algorithm
   * before creating the signature. For WebCrypto-based implementations, this is
   * handled automatically by the sign() function.
   *
   * Signature format requirements:
   * - RSA: PKCS#1 v1.5 or PSS signature bytes
   * - ECDSA: DER-encoded SEQUENCE { INTEGER r, INTEGER s }
   *
   * Note: WebCrypto returns ECDSA signatures in P1363 format (r || s concatenated).
   * Use pkijs.createCMSECDSASignature() to convert to DER format.
   *
   * @param data - The data to sign (will be hashed internally)
   * @param algorithm - The digest algorithm to use for hashing
   * @returns Signature bytes in the format required by CMS/PKCS#7
   */
  sign(data: Uint8Array, algorithm: DigestAlgorithm): Promise<Uint8Array>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Timestamp Authority Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * RFC 3161 timestamp authority.
 *
 * Provides cryptographic timestamps that prove a document existed at a
 * specific point in time. Required for PAdES B-T level and above.
 *
 * @example
 * ```typescript
 * const tsa = new HttpTimestampAuthority("http://timestamp.digicert.com");
 * const token = await tsa.timestamp(digest, "SHA-256");
 * ```
 */
export interface TimestampAuthority {
  /**
   * Get a timestamp token for the given digest.
   *
   * @param digest - The hash to timestamp
   * @param algorithm - The digest algorithm used
   * @returns DER-encoded TimeStampToken
   */
  timestamp(digest: Uint8Array, algorithm: DigestAlgorithm): Promise<Uint8Array>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Revocation Provider Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Provides certificate revocation information for long-term validation.
 *
 * Used for PAdES B-LT level to embed OCSP responses and CRLs in the PDF.
 *
 * @example
 * ```typescript
 * const provider = new DefaultRevocationProvider();
 * const ocsp = await provider.getOCSP(cert, issuer);
 * ```
 */
export interface RevocationProvider {
  /**
   * Get OCSP response for a certificate.
   *
   * @param cert - DER-encoded certificate to check
   * @param issuer - DER-encoded issuer certificate
   * @returns DER-encoded OCSPResponse, or null if unavailable
   */
  getOCSP?(cert: Uint8Array, issuer: Uint8Array): Promise<Uint8Array | null>;

  /**
   * Get CRL for a certificate.
   *
   * @param cert - DER-encoded certificate
   * @returns DER-encoded CRL, or null if unavailable
   */
  getCRL?(cert: Uint8Array): Promise<Uint8Array | null>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sign Options
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for signing a PDF document.
 */
export interface SignOptions {
  /** The signer providing certificate and signing capability */
  signer: Signer;

  // ─── Metadata ────────────────────────────────────────────────────────────

  /** Reason for signing */
  reason?: string;

  /** Location where signing occurred */
  location?: string;

  /** Contact information */
  contactInfo?: string;

  /**
   * Signing time to embed in the signature.
   * Defaults to current system time.
   *
   * NOTE: This is NOT cryptographically verified - it's just a claim.
   * The signer's local clock provides this value. For proven time,
   * use a TimestampAuthority (B-T level or higher).
   */
  signingTime?: Date;

  // ─── Field Configuration ─────────────────────────────────────────────────

  /**
   * Signature field name.
   *
   * - If provided and field exists (unsigned): use it
   * - If provided and field doesn't exist: create it
   * - If not provided: find first empty field, or create "Signature_N"
   */
  fieldName?: string;

  // ─── Signature Format ────────────────────────────────────────────────────

  /**
   * Signature format (SubFilter).
   *
   * - `adbe.pkcs7.detached`: Legacy format, broad compatibility
   * - `ETSI.CAdES.detached`: Modern PAdES format (default)
   *
   * @default "ETSI.CAdES.detached"
   */
  subFilter?: SubFilter;

  /**
   * PAdES conformance level (convenience shorthand).
   *
   * - `B-B`: Basic signature
   * - `B-T`: With timestamp
   * - `B-LT`: With long-term validation data
   * - `B-LTA`: With archival timestamp
   *
   * Requires `subFilter: "ETSI.CAdES.detached"` (default).
   */
  level?: PAdESLevel;

  // ─── Timestamp & Validation ──────────────────────────────────────────────

  /** Timestamp authority for B-T and above */
  timestampAuthority?: TimestampAuthority;

  /** Enable long-term validation data embedding (B-LT) */
  longTermValidation?: boolean;

  /** Provider for OCSP/CRL data */
  revocationProvider?: RevocationProvider;

  /** Add document timestamp for archival (B-LTA) */
  archivalTimestamp?: boolean;

  // ─── Advanced ────────────────────────────────────────────────────────────

  /**
   * Digest algorithm.
   * @default "SHA-256"
   */
  digestAlgorithm?: DigestAlgorithm;

  /**
   * Size to reserve for signature placeholder in bytes.
   * Must be large enough for CMS structure + certificates + timestamp.
   *
   * @default 12288 (12KB)
   */
  estimatedSize?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sign Result
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Warning emitted during signing.
 */
export interface SignWarning {
  /** Warning code (e.g., "MDP_VIOLATION", "CHAIN_INCOMPLETE") */
  code: "MDP_VIOLATION" | "CHAIN_INCOMPLETE" | (string & {});

  /** Human-readable message */
  message: string;
}

/**
 * Validation data gathered for long-term validation (B-LT/B-LTA).
 */
export interface LtvValidationData {
  /** The CMS signature bytes (for computing VRI key) */
  signatureContents: Uint8Array;

  /** All certificates in the chain (signer + intermediates + root) */
  certificates: Uint8Array[];

  /** OCSP responses for certificates */
  ocspResponses: Uint8Array[];

  /** CRLs for certificates */
  crls: Uint8Array[];

  /** Timestamp when validation data was gathered */
  timestamp: Date;

  /**
   * Embedded timestamp tokens (for VRI entries).
   * Each timestamp token embedded in the signature's unsigned attributes
   * needs its own VRI entry per ETSI EN 319 142-2.
   */
  embeddedTimestamps?: Uint8Array[];
}

/**
 * Result of signing operation.
 */
export interface SignResult {
  /** The signed PDF bytes */
  bytes: Uint8Array;

  /** Warnings encountered during signing */
  warnings: SignWarning[];

  /**
   * Validation data for long-term validation (B-LT/B-LTA).
   * Present when `longTermValidation` or `level: "B-LT"/"B-LTA"` is requested.
   * The caller must write a DSS incremental update with this data.
   */
  ltvData?: LtvValidationData;

  /**
   * Whether to add an archival document timestamp (B-LTA).
   * If true, the caller should write a document timestamp after DSS.
   */
  archivalTimestamp?: boolean;

  /**
   * Timestamp authority to use for document timestamp (B-LTA).
   */
  timestampAuthority?: TimestampAuthority;

  /**
   * Digest algorithm to use for document timestamp.
   */
  digestAlgorithm?: DigestAlgorithm;
}

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base error class for signature operations.
 */
export class SignatureError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "SignatureError";
    this.code = code;
  }
}

/**
 * Error during timestamp operations.
 */
export class TimestampError extends SignatureError {
  constructor(message: string) {
    super("TIMESTAMP_ERROR", message);
    this.name = "TimestampError";
  }
}

/**
 * Error during revocation data fetching.
 */
export class RevocationError extends SignatureError {
  constructor(message: string) {
    super("REVOCATION_ERROR", message);
    this.name = "RevocationError";
  }
}

/**
 * Error with certificate chain.
 */
export class CertificateChainError extends SignatureError {
  constructor(message: string) {
    super("CERTIFICATE_CHAIN_ERROR", message);
    this.name = "CertificateChainError";
  }
}

/**
 * Error with signer (e.g., invalid password, key issues).
 */
export class SignerError extends SignatureError {
  constructor(message: string) {
    super("SIGNER_ERROR", message);
    this.name = "SignerError";
  }
}

/**
 * Error when signature placeholder is too small.
 */
export class PlaceholderError extends SignatureError {
  /** Required size in bytes */
  readonly requiredSize: number;

  /** Available size in bytes */
  readonly availableSize: number;

  constructor(requiredSize: number, availableSize: number) {
    super(
      "PLACEHOLDER_TOO_SMALL",
      `Signature placeholder too small: need ${requiredSize} bytes, have ${availableSize} bytes`,
    );
    this.name = "PlaceholderError";
    this.requiredSize = requiredSize;
    this.availableSize = availableSize;
  }
}

/**
 * Error with KMS signer (e.g., key issues, permission denied, unsupported algorithm).
 */
export class KmsSignerError extends SignerError {
  /** The original error that caused this error (if any) */
  override readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(`KMS: ${message}`);
    this.name = "KmsSignerError";
    this.cause = cause;
  }
}

/**
 * Error with Azure Key Vault signer (e.g., key issues, permission denied, unsupported algorithm).
 */
export class AzureKeyVaultSignerError extends KmsSignerError {
  constructor(message: string, cause?: Error) {
    super(`Azure Key Vault: ${message}`, cause);
    this.name = "AzureKeyVaultSignerError";
  }
}
