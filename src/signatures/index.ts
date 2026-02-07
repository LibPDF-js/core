/**
 * Digital signatures module.
 *
 * Provides PDF signing and verification capabilities with support for:
 * - PAdES B-B through B-LTA signature levels
 * - PKCS#7 and CAdES signature formats
 * - Local (P12) and external (HSM, cloud) signers
 *
 * @example
 * ```typescript
 * import { P12Signer } from "@libpdf/core";
 *
 * const signer = await P12Signer.create(p12Bytes, "password");
 * const signedBytes = await pdf.sign({
 *   signer,
 *   reason: "I approve this document",
 * });
 * ```
 */

// Field name generation
export { generateUniqueName } from "../helpers/strings";
// AIA Chain Building
export { type AiaChainBuilderOptions, buildCertificateChain } from "./aia";
// LTV (Long-Term Validation) - DSS building and data gathering
export {
  DSSBuilder,
  type LtvData,
  LtvDataGatherer,
  type LtvGathererOptions,
  type LtvWarning,
} from "./ltv";
// Revocation
export {
  DefaultRevocationProvider,
  type DefaultRevocationProviderOptions,
  extractOcspResponderCerts,
} from "./revocation";
// Signers
export {
  AzureKeyVaultSigner,
  CryptoKeySigner,
  GoogleKmsSigner,
  P12Signer,
  type P12SignerOptions,
} from "./signers";
// Timestamp
export { HttpTimestampAuthority, type HttpTimestampAuthorityOptions } from "./timestamp";
// Types
export type {
  DigestAlgorithm,
  KeyType,
  LtvValidationData,
  PAdESLevel,
  RevocationProvider,
  SignatureAlgorithm,
  Signer,
  SignOptions,
  SignResult,
  SignWarning,
  SubFilter,
  TimestampAuthority,
} from "./types";
// Errors
export {
  AzureKeyVaultSignerError,
  CertificateChainError,
  KmsSignerError,
  PlaceholderError,
  RevocationError,
  SignatureError,
  SignerError,
  TimestampError,
} from "./types";
// Utilities (for advanced use cases)
export {
  extractCmsCertificates,
  extractTimestampCertificates,
  extractTimestampFromCms,
} from "./utils";
