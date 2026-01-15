/**
 * Tests for RC2 implementation.
 */

import { describe, expect, it } from "vitest";

import { RC2 } from "./rc2";

describe("RC2", () => {
  describe("constants", () => {
    it("has correct block size", () => {
      expect(RC2.BLOCK_SIZE).toBe(8);
    });

    it("has correct effective bits constants", () => {
      expect(RC2.EFFECTIVE_BITS_40).toBe(40);
      expect(RC2.EFFECTIVE_BITS_64).toBe(64);
      expect(RC2.EFFECTIVE_BITS_128).toBe(128);
    });
  });

  describe("decrypt", () => {
    it("throws on invalid IV length", () => {
      const data = new Uint8Array(8);
      const key = new Uint8Array(16);
      const iv = new Uint8Array(16); // Should be 8

      expect(() => RC2.decrypt(data, key, iv, 128)).toThrow(/Invalid IV length/);
    });

    it("throws on invalid data length", () => {
      const data = new Uint8Array(10); // Not multiple of 8
      const key = new Uint8Array(16);
      const iv = new Uint8Array(8);

      expect(() => RC2.decrypt(data, key, iv, 128)).toThrow(/Invalid data length/);
    });

    it("handles empty data", () => {
      const data = new Uint8Array(0);
      const key = new Uint8Array(16);
      const iv = new Uint8Array(8);

      const result = RC2.decrypt(data, key, iv, 128);
      expect(result.length).toBe(0);
    });

    it("decrypts with 40-bit effective key", () => {
      const key = new Uint8Array(5); // 40 bits
      const iv = new Uint8Array(8);
      const data = new Uint8Array(8);

      const result = RC2.decrypt(data, key, iv, RC2.EFFECTIVE_BITS_40, false);
      expect(result.length).toBe(8);
    });

    it("decrypts with 128-bit effective key", () => {
      const key = new Uint8Array(16); // 128 bits
      const iv = new Uint8Array(8);
      const data = new Uint8Array(8);

      const result = RC2.decrypt(data, key, iv, RC2.EFFECTIVE_BITS_128, false);
      expect(result.length).toBe(8);
    });

    it("decrypts multiple blocks with CBC chaining", () => {
      const key = new Uint8Array(16);
      const iv = new Uint8Array(8);
      const data = new Uint8Array(24); // 3 blocks

      const result = RC2.decrypt(data, key, iv, 128, false);
      expect(result.length).toBe(24);
    });

    it("removes PKCS#7 padding by default", () => {
      const key = new Uint8Array(16);
      const iv = new Uint8Array(8);
      const encrypted = new Uint8Array(8);

      const withPadding = RC2.decrypt(encrypted, key, iv, 128, false);
      const withoutPadding = RC2.decrypt(encrypted, key, iv, 128, true);

      expect(withPadding.length).toBe(8);
      expect(withoutPadding.length).toBeLessThanOrEqual(8);
    });
  });

  /**
   * RFC 2268 Section 5 Test Vectors
   *
   * These test vectors are from the official RFC 2268 specification.
   * They test the raw RC2 block cipher (ECB mode). We simulate ECB by
   * using CBC mode with a zero IV and a single block.
   *
   * @see https://www.rfc-editor.org/rfc/rfc2268#section-5
   */
  describe("RFC 2268 test vectors", () => {
    // Helper to run ECB test (CBC with zero IV, single block)
    function testRfc2268Vector(
      key: number[],
      effectiveBits: number,
      plaintext: number[],
      ciphertext: number[],
    ) {
      const keyBytes = new Uint8Array(key);
      const ciphertextBytes = new Uint8Array(ciphertext);
      const plaintextBytes = new Uint8Array(plaintext);
      const iv = new Uint8Array(8); // Zero IV for ECB-like behavior

      const result = RC2.decrypt(ciphertextBytes, keyBytes, iv, effectiveBits, false);
      expect(result).toEqual(plaintextBytes);
    }

    it("test vector 1: 8-byte zero key, 63 effective bits", () => {
      // Key = 00 00 00 00 00 00 00 00
      // Effective key bits = 63
      // Plaintext = 00 00 00 00 00 00 00 00
      // Ciphertext = EB B7 73 F9 93 27 8E FF
      testRfc2268Vector(
        [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        63,
        [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        [0xeb, 0xb7, 0x73, 0xf9, 0x93, 0x27, 0x8e, 0xff],
      );
    });

    it("test vector 2: 8-byte 0xFF key, 64 effective bits", () => {
      // Key = FF FF FF FF FF FF FF FF
      // Effective key bits = 64
      // Plaintext = FF FF FF FF FF FF FF FF
      // Ciphertext = 27 8B 27 E4 2E 2F 0D 49
      testRfc2268Vector(
        [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff],
        64,
        [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff],
        [0x27, 0x8b, 0x27, 0xe4, 0x2e, 0x2f, 0x0d, 0x49],
      );
    });

    it("test vector 3: non-zero plaintext, 64 effective bits", () => {
      // Key = 30 00 00 00 00 00 00 00
      // Effective key bits = 64
      // Plaintext = 10 00 00 00 00 00 00 01
      // Ciphertext = 30 64 9E DF 9B E7 D2 C2
      testRfc2268Vector(
        [0x30, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        64,
        [0x10, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01],
        [0x30, 0x64, 0x9e, 0xdf, 0x9b, 0xe7, 0xd2, 0xc2],
      );
    });

    it("test vector 4: 1-byte key, 64 effective bits", () => {
      // Key = 88 (1 byte)
      // Effective key bits = 64
      // Plaintext = 00 00 00 00 00 00 00 00
      // Ciphertext = 61 A8 A2 44 AD AC CC F0
      testRfc2268Vector(
        [0x88],
        64,
        [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        [0x61, 0xa8, 0xa2, 0x44, 0xad, 0xac, 0xcc, 0xf0],
      );
    });

    it("test vector 5: 7-byte key, 64 effective bits", () => {
      // Key = 88 BC A9 0E 90 87 5A (7 bytes)
      // Effective key bits = 64
      // Plaintext = 00 00 00 00 00 00 00 00
      // Ciphertext = 6C CF 43 08 97 4C 26 7F (from RFC 2268)
      testRfc2268Vector(
        [0x88, 0xbc, 0xa9, 0x0e, 0x90, 0x87, 0x5a],
        64,
        [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        [0x6c, 0xcf, 0x43, 0x08, 0x97, 0x4c, 0x26, 0x7f],
      );
    });

    it("test vector 6: 16-byte key, 64 effective bits", () => {
      // Key = 88 BC A9 0E 90 87 5A 7F 0F 79 C3 84 62 7B AF B2 (16 bytes)
      // Effective key bits = 64
      // Plaintext = 00 00 00 00 00 00 00 00
      // Ciphertext = 1A 80 7D 27 2B BE 5D B1
      testRfc2268Vector(
        [
          0x88, 0xbc, 0xa9, 0x0e, 0x90, 0x87, 0x5a, 0x7f, 0x0f, 0x79, 0xc3, 0x84, 0x62, 0x7b, 0xaf,
          0xb2,
        ],
        64,
        [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        [0x1a, 0x80, 0x7d, 0x27, 0x2b, 0xbe, 0x5d, 0xb1],
      );
    });

    it("test vector 7: 16-byte key, 128 effective bits", () => {
      // Key = 88 BC A9 0E 90 87 5A 7F 0F 79 C3 84 62 7B AF B2 (16 bytes)
      // Effective key bits = 128
      // Plaintext = 00 00 00 00 00 00 00 00
      // Ciphertext = 22 69 55 2A B0 F8 5C A6 (from RFC 2268)
      testRfc2268Vector(
        [
          0x88, 0xbc, 0xa9, 0x0e, 0x90, 0x87, 0x5a, 0x7f, 0x0f, 0x79, 0xc3, 0x84, 0x62, 0x7b, 0xaf,
          0xb2,
        ],
        128,
        [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        [0x22, 0x69, 0x55, 0x2a, 0xb0, 0xf8, 0x5c, 0xa6],
      );
    });

    it("test vector 8: 33-byte key, 129 effective bits", () => {
      // Key = 88 BC A9 0E 90 87 5A 7F 0F 79 C3 84 62 7B AF B2
      //       16 F8 0A 6F 85 92 05 84 C4 2F CE B0 BE 25 5D AF 1E (33 bytes)
      // Effective key bits = 129
      // Plaintext = 00 00 00 00 00 00 00 00
      // Ciphertext = 5B 78 D3 A4 3D FF F1 F1 (from RFC 2268)
      testRfc2268Vector(
        [
          0x88, 0xbc, 0xa9, 0x0e, 0x90, 0x87, 0x5a, 0x7f, 0x0f, 0x79, 0xc3, 0x84, 0x62, 0x7b, 0xaf,
          0xb2, 0x16, 0xf8, 0x0a, 0x6f, 0x85, 0x92, 0x05, 0x84, 0xc4, 0x2f, 0xce, 0xb0, 0xbe, 0x25,
          0x5d, 0xaf, 0x1e,
        ],
        129,
        [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        [0x5b, 0x78, 0xd3, 0xa4, 0x3d, 0xff, 0xf1, 0xf1],
      );
    });
  });
});
