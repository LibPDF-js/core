/**
 * Shared helpers for signature integration tests.
 */

import { P12Signer } from "#src/signatures/signers";
import { loadFixture } from "#src/test-utils";

/** Public RFC 3161 timestamp authority used by integration tests. */
export const TEST_TSA_URL = "https://freetsa.org/tsr";

/** Test P12 files with different encryption formats */
export const P12_FILES = {
  /** AES-256-CBC (modern default) */
  aes256: "test-signer-aes256.p12",
  /** AES-128-CBC */
  aes128: "test-signer-aes128.p12",
  /** Triple DES (legacy but common) */
  tripleDes: "test-signer-3des.p12",
  /** RC2-40 (very old legacy format) */
  legacy: "test-signer-rc2-40.p12",
  /** ECDSA P-256 */
  ecdsaP256: "test-signer-ec-p256-aes256.p12",
  /** ECDSA P-384 */
  ecdsaP384: "test-signer-ec-p384-aes256.p12",
};

/**
 * Load a test P12 signer (default AES-256).
 */
export async function loadTestSigner(filename: string = P12_FILES.aes256): Promise<P12Signer> {
  const p12Bytes = await loadFixture("certificates", filename);

  return P12Signer.create(p12Bytes, "test123");
}
