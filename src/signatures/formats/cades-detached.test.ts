import { describe, expect, it } from "vitest";

import { OID_CONTENT_TYPE, OID_MESSAGE_DIGEST, OID_SIGNING_CERTIFICATE_V2 } from "../oids";
import { hashData } from "../utils";
import { CAdESDetachedBuilder } from "./cades-detached";
import { getSignedAttributeOids, loadTestSigner } from "./test-helpers";

describe("CAdESDetachedBuilder", () => {
  it("emits only the PAdES baseline signed attributes, ignoring signingTime", async () => {
    const signedData = await new CAdESDetachedBuilder().create({
      signer: await loadTestSigner(),
      documentHash: await hashData(new TextEncoder().encode("hello"), "SHA-256"),
      digestAlgorithm: "SHA-256",
      signingTime: new Date("2025-01-05T12:00:00Z"),
    });

    expect(getSignedAttributeOids(signedData.toDER()).sort()).toEqual(
      [OID_CONTENT_TYPE, OID_MESSAGE_DIGEST, OID_SIGNING_CERTIFICATE_V2].sort(),
    );
  });
});
