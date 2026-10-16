/**
 * Signature format types.
 */

import type { DigestAlgorithm, Signer } from "../types";

/**
 * Signature format (SubFilter in PDF).
 */
export type SubFilter = "adbe.pkcs7.detached" | "ETSI.CAdES.detached";

/**
 * Options for creating a CMS signature.
 */
export interface CMSCreateOptions {
  /** The signer */
  signer: Signer;

  /** Document hash (the data that was signed) */
  documentHash: Uint8Array;

  /** Digest algorithm used */
  digestAlgorithm: DigestAlgorithm;

  /** Signing time for the signing-time signed attribute. Ignored by CAdES (PAdES forbids it). */
  signingTime?: Date;
}

/**
 * A mutable CMS SignedData structure.
 *
 * This allows building the signature, then optionally adding a timestamp
 * token before serializing to DER.
 */
export interface CMSSignedData {
  /**
   * Get the raw signature value.
   * This is needed to create a timestamp token.
   */
  getSignatureValue(): Uint8Array;

  /**
   * Add a timestamp token as an unsigned attribute.
   * Must be called before toDER() if timestamping is needed.
   *
   * @param token - DER-encoded RFC 3161 TimeStampToken
   */
  addTimestampToken(token: Uint8Array): void;

  /**
   * Serialize the CMS structure to DER-encoded bytes.
   */
  toDER(): Uint8Array;
}

/**
 * A CMS format builder interface.
 */
export interface CMSFormatBuilder {
  /**
   * Create a CMS SignedData structure.
   *
   * Returns a mutable object that can be modified (e.g., to add a timestamp)
   * before being serialized to DER.
   *
   * @param options - Create options
   * @returns Mutable CMS SignedData
   */
  create(options: CMSCreateOptions): Promise<CMSSignedData>;
}
