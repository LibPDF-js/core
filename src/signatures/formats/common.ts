/**
 * Common utilities for CMS signature format builders.
 */

import { Constructed, fromBER, Null, ObjectIdentifier, Sequence } from "asn1js";
import * as pkijs from "pkijs";

import { toArrayBuffer } from "../../helpers/buffer";
import {
  OID_CMS_ALGORITHM_PROTECTION,
  OID_ECDSA_WITH_SHA256,
  OID_ECDSA_WITH_SHA384,
  OID_ECDSA_WITH_SHA512,
  OID_SHA256,
  OID_SHA256_WITH_RSA,
  OID_SHA384,
  OID_SHA384_WITH_RSA,
  OID_SHA512,
  OID_SHA512_WITH_RSA,
} from "../oids";
import type { DigestAlgorithm, Signer } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Algorithm OID Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the OID for a digest algorithm.
 */
export function getDigestAlgorithmOid(algorithm: DigestAlgorithm): string {
  switch (algorithm) {
    case "SHA-256":
      return OID_SHA256;
    case "SHA-384":
      return OID_SHA384;
    case "SHA-512":
      return OID_SHA512;
  }
}

/**
 * Get the OID for a signature algorithm.
 */
export function getSignatureAlgorithmOid(signer: Signer, digestAlgorithm: DigestAlgorithm): string {
  if (signer.keyType === "RSA") {
    switch (digestAlgorithm) {
      case "SHA-256":
        return OID_SHA256_WITH_RSA;
      case "SHA-384":
        return OID_SHA384_WITH_RSA;
      case "SHA-512":
        return OID_SHA512_WITH_RSA;
    }
  } else {
    // EC
    switch (digestAlgorithm) {
      case "SHA-256":
        return OID_ECDSA_WITH_SHA256;
      case "SHA-384":
        return OID_ECDSA_WITH_SHA384;
      case "SHA-512":
        return OID_ECDSA_WITH_SHA512;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Certificate Parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a DER-encoded certificate into pkijs Certificate.
 */
export function parseCertificate(der: Uint8Array): pkijs.Certificate {
  const asn1 = fromBER(toArrayBuffer(der));

  if (asn1.offset === -1) {
    throw new Error("Failed to parse certificate");
  }

  return new pkijs.Certificate({ schema: asn1.result });
}

// ─────────────────────────────────────────────────────────────────────────────
// CMS Attribute Builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the CMSAlgorithmProtection attribute (RFC 6211).
 *
 * This attribute binds the digest and signature algorithms to the signature,
 * preventing algorithm substitution attacks.
 *
 * CMSAlgorithmProtection ::= SEQUENCE {
 *   digestAlgorithm         DigestAlgorithmIdentifier,
 *   signatureAlgorithm  [1] SignatureAlgorithmIdentifier OPTIONAL,
 *   macAlgorithm        [2] MessageAuthenticationCodeAlgorithm OPTIONAL
 * }
 */
export function buildCMSAlgorithmProtection(
  digestAlgorithm: DigestAlgorithm,
  signer: Signer,
): pkijs.Attribute {
  const digestAlgIdentifier = new Sequence({
    value: [new ObjectIdentifier({ value: getDigestAlgorithmOid(digestAlgorithm) })],
  });

  // Build signature algorithm with NULL parameters for RSA
  // RFC 6211: signatureAlgorithm [1] IMPLICIT AlgorithmIdentifier OPTIONAL
  const sigAlgOid = getSignatureAlgorithmOid(signer, digestAlgorithm);
  const sigAlgValue =
    signer.keyType === "RSA"
      ? [new ObjectIdentifier({ value: sigAlgOid }), new Null()]
      : [new ObjectIdentifier({ value: sigAlgOid })];

  // Wrap in context tag [1] for signatureAlgorithm (IMPLICIT)
  const sigAlgIdentifier = new Constructed({
    idBlock: { tagClass: 3, tagNumber: 1 },
    value: sigAlgValue,
  });

  const cmsAlgProtection = new Sequence({
    value: [digestAlgIdentifier, sigAlgIdentifier],
  });

  return new pkijs.Attribute({
    type: OID_CMS_ALGORITHM_PROTECTION,
    values: [cmsAlgProtection],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Signed Attributes Encoding
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Encode signed attributes for signing.
 *
 * When signing, the signed attributes must be encoded as a SET OF
 * (tag 0x31) rather than the implicit [0] tag used in SignerInfo.
 */
export function encodeSignedAttributesForSigning(attrs: pkijs.Attribute[]): ArrayBuffer {
  const tempAttrs = new pkijs.SignedAndUnsignedAttributes({
    type: 0,
    attributes: attrs,
  });

  const schema = tempAttrs.toSchema();
  const encoded = schema.toBER(false);

  const view = new Uint8Array(encoded);
  view[0] = 0x31; // SET OF tag

  return encoded;
}
