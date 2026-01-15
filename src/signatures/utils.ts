/**
 * Shared utilities for signature operations.
 */

import { sha256, sha384, sha512 } from "@noble/hashes/sha2.js";
import { fromBER } from "asn1js";
import * as pkijs from "pkijs";

import { toArrayBuffer } from "../helpers/buffer";
import { OID_SIGNED_DATA, OID_TIMESTAMP_TOKEN } from "./oids";
import type { DigestAlgorithm } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// String Escaping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Escape special characters in PDF literal string.
 *
 * PDF strings use backslash escapes for special characters.
 *
 * @param str - String to escape
 * @returns Escaped string safe for PDF literal strings
 */
export function escapePdfString(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Hashing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hash data using the specified algorithm.
 *
 * @param data - Data to hash
 * @param algorithm - Digest algorithm
 * @returns Hash bytes
 */
export function hashData(data: Uint8Array, algorithm: DigestAlgorithm): Uint8Array {
  switch (algorithm) {
    case "SHA-256":
      return sha256(data);
    case "SHA-384":
      return sha384(data);
    case "SHA-512":
      return sha512(data);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Timestamp Token Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract certificates from a timestamp token.
 *
 * A timestamp token is a CMS ContentInfo containing SignedData.
 * The SignedData structure includes the TSA's certificates.
 *
 * @param timestampToken - DER-encoded timestamp token
 * @returns Array of DER-encoded certificates from the timestamp
 */
export function extractTimestampCertificates(timestampToken: Uint8Array): Uint8Array[] {
  const asn1 = fromBER(toArrayBuffer(timestampToken));

  if (asn1.offset === -1) {
    throw new Error("Failed to parse timestamp token");
  }

  // Parse as ContentInfo
  const contentInfo = new pkijs.ContentInfo({ schema: asn1.result });

  // The content should be SignedData
  if (contentInfo.contentType !== OID_SIGNED_DATA) {
    throw new Error("Timestamp token is not SignedData");
  }

  // Parse the SignedData
  const signedData = new pkijs.SignedData({ schema: contentInfo.content });

  // Extract certificates
  const certificates: Uint8Array[] = [];

  if (signedData.certificates) {
    for (const cert of signedData.certificates) {
      if (cert instanceof pkijs.Certificate) {
        const certDer = cert.toSchema().toBER(false);

        certificates.push(new Uint8Array(certDer));
      }
    }
  }

  return certificates;
}

/**
 * Extract certificates from a CMS signature (SignedData).
 *
 * This extracts the signer's certificate and any chain certificates
 * embedded in the CMS SignedData structure.
 *
 * @param cmsSignature - DER-encoded CMS SignedData (as used in PDF /Contents)
 * @returns Array of DER-encoded certificates
 */
export function extractCmsCertificates(cmsSignature: Uint8Array): Uint8Array[] {
  const asn1 = fromBER(toArrayBuffer(cmsSignature));

  if (asn1.offset === -1) {
    throw new Error("Failed to parse CMS signature");
  }

  // Parse as ContentInfo
  const contentInfo = new pkijs.ContentInfo({ schema: asn1.result });

  // The content should be SignedData
  if (contentInfo.contentType !== OID_SIGNED_DATA) {
    throw new Error("CMS signature is not SignedData");
  }

  // Parse the SignedData
  const signedData = new pkijs.SignedData({ schema: contentInfo.content });

  // Extract certificates
  const certificates: Uint8Array[] = [];

  if (signedData.certificates) {
    for (const cert of signedData.certificates) {
      if (cert instanceof pkijs.Certificate) {
        const certDer = cert.toSchema().toBER(false);
        certificates.push(new Uint8Array(certDer));
      }
    }
  }

  return certificates;
}

/**
 * Extract the timestamp token from a CMS signature's unsigned attributes.
 *
 * Looks for the id-aa-signatureTimeStampToken attribute (OID 1.2.840.113549.1.9.16.2.14)
 * in the SignerInfo's unsigned attributes.
 *
 * @param cmsSignature - DER-encoded CMS SignedData
 * @returns DER-encoded timestamp token, or null if not present
 */
export function extractTimestampFromCms(cmsSignature: Uint8Array): Uint8Array | null {
  const asn1 = fromBER(toArrayBuffer(cmsSignature));

  if (asn1.offset === -1) {
    return null;
  }

  try {
    const contentInfo = new pkijs.ContentInfo({ schema: asn1.result });

    if (contentInfo.contentType !== OID_SIGNED_DATA) {
      return null;
    }

    const signedData = new pkijs.SignedData({ schema: contentInfo.content });

    // Check first signer's unsigned attributes
    if (signedData.signerInfos.length > 0) {
      const signerInfo = signedData.signerInfos[0];

      if (signerInfo.unsignedAttrs) {
        for (const attr of signerInfo.unsignedAttrs.attributes) {
          if (attr.type === OID_TIMESTAMP_TOKEN && attr.values.length > 0) {
            // The value is the timestamp token (ContentInfo)
            const tokenDer = attr.values[0].toBER(false);

            return new Uint8Array(tokenDer);
          }
        }
      }
    }
  } catch (error) {
    console.warn(`Could not extract timestamp from CMS signature`);
    console.warn(error);

    // Parse error, no timestamp
  }

  return null;
}
