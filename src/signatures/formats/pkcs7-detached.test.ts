import { describe, expect, it } from "vitest";

import {
  OID_CMS_ALGORITHM_PROTECTION,
  OID_CONTENT_TYPE,
  OID_MESSAGE_DIGEST,
  OID_SIGNING_TIME,
} from "../oids";
import { hashData } from "../utils";
import { PKCS7DetachedBuilder } from "./pkcs7-detached";
import { getSignedAttributeOids, loadTestSigner } from "./test-helpers";

describe("PKCS7DetachedBuilder", () => {
  it("emits signing-time and cms-algorithm-protection signed attributes", async () => {
    const signedData = await new PKCS7DetachedBuilder().create({
      signer: await loadTestSigner(),
      documentHash: await hashData(new TextEncoder().encode("hello"), "SHA-256"),
      digestAlgorithm: "SHA-256",
      signingTime: new Date("2025-01-05T12:00:00Z"),
    });

    expect(getSignedAttributeOids(signedData.toDER()).sort()).toEqual(
      [OID_CONTENT_TYPE, OID_SIGNING_TIME, OID_CMS_ALGORITHM_PROTECTION, OID_MESSAGE_DIGEST].sort(),
    );
  });
});
