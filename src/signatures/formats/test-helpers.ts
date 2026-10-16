import { fromBER } from "asn1js";
import * as pkijs from "pkijs";

import { toArrayBuffer } from "../../helpers/buffer";
import { loadFixture } from "../../test-utils";
import { OID_SIGNED_DATA } from "../oids";
import { P12Signer } from "../signers";

export async function loadTestSigner(): Promise<P12Signer> {
  const p12Bytes = await loadFixture("certificates", "test-signer-aes256.p12");

  return P12Signer.create(p12Bytes, "test123");
}

/**
 * Attribute type OIDs of the first SignerInfo's signed attributes.
 */
export function getSignedAttributeOids(der: Uint8Array): string[] {
  const asn1 = fromBER(toArrayBuffer(der));

  if (asn1.offset === -1) {
    throw new Error("Failed to parse CMS ContentInfo");
  }

  const contentInfo = new pkijs.ContentInfo({ schema: asn1.result });

  if (contentInfo.contentType !== OID_SIGNED_DATA) {
    throw new Error(`Expected SignedData, got ${contentInfo.contentType}`);
  }

  const signedData = new pkijs.SignedData({ schema: contentInfo.content });
  const signerInfo = signedData.signerInfos[0];

  if (!signerInfo) {
    throw new Error("CMS has no SignerInfo");
  }

  return (signerInfo.signedAttrs?.attributes ?? []).map(attr => attr.type);
}
