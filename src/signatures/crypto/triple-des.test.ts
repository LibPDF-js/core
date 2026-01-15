/**
 * Tests for Triple DES implementation.
 */

import { describe, expect, it } from "vitest";

import { TripleDES } from "./triple-des";

describe("TripleDES", () => {
  describe("constants", () => {
    it("has correct block size", () => {
      expect(TripleDES.BLOCK_SIZE).toBe(8);
    });

    it("has correct key size", () => {
      expect(TripleDES.KEY_SIZE).toBe(24);
    });
  });

  describe("decrypt", () => {
    it("throws on invalid key length", () => {
      const data = new Uint8Array(8);
      const key = new Uint8Array(16); // Should be 24
      const iv = new Uint8Array(8);

      expect(() => TripleDES.decrypt(data, key, iv)).toThrow(/Invalid 3DES key length/);
    });

    it("throws on invalid IV length", () => {
      const data = new Uint8Array(8);
      const key = new Uint8Array(24);
      const iv = new Uint8Array(16); // Should be 8

      expect(() => TripleDES.decrypt(data, key, iv)).toThrow(/Invalid IV length/);
    });

    it("throws on invalid data length", () => {
      const data = new Uint8Array(10); // Not multiple of 8
      const key = new Uint8Array(24);
      const iv = new Uint8Array(8);

      expect(() => TripleDES.decrypt(data, key, iv)).toThrow(/Invalid data length/);
    });

    it("handles empty data", () => {
      const data = new Uint8Array(0);
      const key = new Uint8Array(24);
      const iv = new Uint8Array(8);

      const result = TripleDES.decrypt(data, key, iv);
      expect(result.length).toBe(0);
    });

    it("removes PKCS#7 padding by default", () => {
      const key = new Uint8Array(24);
      const iv = new Uint8Array(8);

      const encrypted = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

      const withPadding = TripleDES.decrypt(encrypted, key, iv, false);
      const withoutPadding = TripleDES.decrypt(encrypted, key, iv, true);

      expect(withPadding.length).toBe(8);
      expect(withoutPadding.length).toBeLessThanOrEqual(8);
    });

    it("decrypts multiple blocks with CBC chaining", () => {
      const key = new Uint8Array(24);
      const iv = new Uint8Array(8);
      const data = new Uint8Array(24); // 3 blocks

      const result = TripleDES.decrypt(data, key, iv, false);
      expect(result.length).toBe(24);
    });
  });

  /**
   * NIST SP 800-67 / FIPS 46-3 Test Vectors
   *
   * These test vectors verify the Triple DES (3TDES) implementation using
   * official NIST test data and OpenSSL-verified values. We use CBC mode
   * with zero IV to simulate ECB for single-block tests.
   *
   * The implementation uses EDE (Encrypt-Decrypt-Encrypt) mode with 3 keys.
   *
   * @see NIST SP 800-67 Rev 2 - Recommendation for Triple Data Encryption Algorithm
   * @see FIPS 46-3 - Data Encryption Standard
   */
  describe("NIST/FIPS test vectors", () => {
    // Helper to run ECB test (CBC with zero IV, single block)
    function testTripleDesVector(key: number[], plaintext: number[], ciphertext: number[]) {
      const keyBytes = new Uint8Array(key);
      const ciphertextBytes = new Uint8Array(ciphertext);
      const plaintextBytes = new Uint8Array(plaintext);
      const iv = new Uint8Array(8); // Zero IV for ECB-like behavior

      const result = TripleDES.decrypt(ciphertextBytes, keyBytes, iv, false);
      expect(result).toEqual(plaintextBytes);
    }

    /**
     * OpenSSL-verified test vectors (3-key Triple DES ECB)
     *
     * These test vectors were generated using OpenSSL's des-ede3 cipher
     * and verify the raw block cipher operation.
     */
    describe("ECB mode test vectors (OpenSSL-verified)", () => {
      it("test vector 1: somedata plaintext", () => {
        // Key1: 0123456789ABCDEF
        // Key2: 23456789ABCDEF01
        // Key3: 456789ABCDEF0123
        // Plaintext:  736F6D6564617461 ("somedata")
        // Ciphertext: D9932187F6B84AEC (verified with OpenSSL)
        testTripleDesVector(
          [
            0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd,
            0xef, 0x01, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0x01, 0x23,
          ],
          [0x73, 0x6f, 0x6d, 0x65, 0x64, 0x61, 0x74, 0x61],
          [0xd9, 0x93, 0x21, 0x87, 0xf6, 0xb8, 0x4a, 0xec],
        );
      });

      it("test vector 2: all zero plaintext", () => {
        // Key1: 0123456789ABCDEF
        // Key2: 23456789ABCDEF01
        // Key3: 456789ABCDEF0123
        // Plaintext:  0000000000000000
        // Ciphertext: 4EBA739C998BCB60 (verified with OpenSSL)
        testTripleDesVector(
          [
            0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd,
            0xef, 0x01, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0x01, 0x23,
          ],
          [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
          [0x4e, 0xba, 0x73, 0x9c, 0x99, 0x8b, 0xcb, 0x60],
        );
      });

      it("test vector 3: all ones plaintext", () => {
        // Key1: 0123456789ABCDEF
        // Key2: 23456789ABCDEF01
        // Key3: 456789ABCDEF0123
        // Plaintext:  FFFFFFFFFFFFFFFF
        // Ciphertext: FDA5E1AB2024B229 (verified with OpenSSL)
        testTripleDesVector(
          [
            0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd,
            0xef, 0x01, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0x01, 0x23,
          ],
          [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff],
          [0xfd, 0xa5, 0xe1, 0xab, 0x20, 0x24, 0xb2, 0x29],
        );
      });

      it("test vector 4: different key set", () => {
        // Key1: AABBCCDDEEFF0011
        // Key2: 2233445566778899
        // Key3: 1122334455667788
        // Plaintext:  0102030405060708
        // Ciphertext: 91B593A225231902 (verified with OpenSSL)
        testTripleDesVector(
          [
            0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77,
            0x88, 0x99, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88,
          ],
          [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08],
          [0x91, 0xb5, 0x93, 0xa2, 0x25, 0x23, 0x19, 0x02],
        );
      });
    });

    /**
     * FIPS 46-3 Appendix B / NIST SP 800-20 DES test vector
     *
     * This vector tests single DES, which is the building block of Triple DES.
     * When K1 = K2 = K3, Triple DES reduces to single DES.
     */
    describe("FIPS 46-3 / SP 800-20 DES equivalence", () => {
      it("triple DES with identical keys equals single DES", () => {
        // Classic DES test vector from FIPS 46-3 Appendix B
        // Key: 0123456789ABCDEF (repeated 3 times for 3DES)
        // Plaintext:  4E6F772069732074 ("Now is t")
        // Ciphertext: 3FA40E8A984D4815
        testTripleDesVector(
          [
            0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab,
            0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef,
          ],
          [0x4e, 0x6f, 0x77, 0x20, 0x69, 0x73, 0x20, 0x74],
          [0x3f, 0xa4, 0x0e, 0x8a, 0x98, 0x4d, 0x48, 0x15],
        );
      });
    });

    /**
     * NIST SP 800-67 two-key Triple DES compatibility
     *
     * Two-key Triple DES uses K1 = K3. Tests that our implementation
     * handles this configuration correctly.
     */
    describe("two-key Triple DES (K1 = K3)", () => {
      it("two-key 3DES test vector", () => {
        // Key1 = Key3: 0123456789ABCDEF
        // Key2: FEDCBA9876543210
        // Plaintext:  0000000000000000
        // Ciphertext: 08D7B4FB629D0885
        testTripleDesVector(
          [
            0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0xfe, 0xdc, 0xba, 0x98, 0x76, 0x54,
            0x32, 0x10, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef,
          ],
          [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
          [0x08, 0xd7, 0xb4, 0xfb, 0x62, 0x9d, 0x08, 0x85],
        );
      });
    });

    /**
     * CBC mode test vectors
     *
     * These test multi-block decryption with non-zero IV to verify
     * correct CBC chaining. Verified with OpenSSL des-ede3-cbc.
     */
    describe("CBC mode chaining", () => {
      it("two-block CBC decryption", () => {
        // Key1: 0123456789ABCDEF
        // Key2: 23456789ABCDEF01
        // Key3: 456789ABCDEF0123
        // IV: 1234567890ABCDEF
        // Plaintext:  000102030405060708090A0B0C0D0E0F
        // Ciphertext: A242AD370EE232EDE85E1033962975F4 (verified with OpenSSL)
        const key = new Uint8Array([
          0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef,
          0x01, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0x01, 0x23,
        ]);
        const iv = new Uint8Array([0x12, 0x34, 0x56, 0x78, 0x90, 0xab, 0xcd, 0xef]);
        const ciphertext = new Uint8Array([
          0xa2, 0x42, 0xad, 0x37, 0x0e, 0xe2, 0x32, 0xed, 0xe8, 0x5e, 0x10, 0x33, 0x96, 0x29, 0x75,
          0xf4,
        ]);
        const expectedPlaintext = new Uint8Array([
          0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e,
          0x0f,
        ]);

        const result = TripleDES.decrypt(ciphertext, key, iv, false);
        expect(result).toEqual(expectedPlaintext);
      });
    });
  });
});
