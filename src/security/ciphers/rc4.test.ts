import { describe, expect, it } from "vitest";

import { RC4Cipher, rc4 } from "./rc4";

describe("RC4Cipher", () => {
  describe("constructor", () => {
    it("should accept keys from 1 to 256 bytes", () => {
      expect(() => new RC4Cipher(new Uint8Array([1]))).not.toThrow();
      expect(() => new RC4Cipher(new Uint8Array(256).fill(1))).not.toThrow();
    });

    it("should reject empty key", () => {
      expect(() => new RC4Cipher(new Uint8Array(0))).toThrow("RC4 key cannot be empty");
    });

    it("should reject key longer than 256 bytes", () => {
      expect(() => new RC4Cipher(new Uint8Array(257))).toThrow("RC4 key cannot exceed 256 bytes");
    });
  });

  describe("process", () => {
    it("should handle empty data", () => {
      const cipher = new RC4Cipher(new Uint8Array([1, 2, 3]));
      const result = cipher.process(new Uint8Array(0));
      expect(result.length).toBe(0);
    });

    it("should encrypt and decrypt symmetrically", () => {
      const key = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]);
      const plaintext = new TextEncoder().encode("Hello, World!");

      const cipher1 = new RC4Cipher(key);
      const ciphertext = cipher1.process(plaintext);

      // Ciphertext should differ from plaintext
      expect(ciphertext).not.toEqual(plaintext);

      const cipher2 = new RC4Cipher(key);
      const decrypted = cipher2.process(ciphertext);

      expect(decrypted).toEqual(plaintext);
    });

    it("should be stateful across multiple calls", () => {
      const key = new Uint8Array([0x01, 0x02, 0x03]);
      const data1 = new Uint8Array([0x11, 0x22, 0x33]);
      const data2 = new Uint8Array([0x44, 0x55, 0x66]);

      // Process in two calls
      const cipher1 = new RC4Cipher(key);
      const result1a = cipher1.process(data1);
      const result1b = cipher1.process(data2);

      // Process in one call
      const cipher2 = new RC4Cipher(key);
      const combined = new Uint8Array([...data1, ...data2]);
      const result2 = cipher2.process(combined);

      // Results should match
      expect(new Uint8Array([...result1a, ...result1b])).toEqual(result2);
    });
  });

  /**
   * Official RC4 test vectors from RFC 6229
   * These are well-known test cases to verify correct implementation.
   */
  describe("RFC 6229 test vectors", () => {
    // Test vector 1: 40-bit key
    it("should match RFC 6229 test vector (40-bit key)", () => {
      // Key: 0102030405
      const key = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]);
      const cipher = new RC4Cipher(key);

      // Generate first 16 bytes of keystream by encrypting zeros
      const zeros = new Uint8Array(16);
      const keystream = cipher.process(zeros);

      // Expected first 16 bytes of keystream from RFC 6229
      const expected = new Uint8Array([
        0xb2, 0x39, 0x63, 0x05, 0xf0, 0x3d, 0xc0, 0x27, 0xcc, 0xc3, 0x52, 0x4a, 0x0a, 0x11, 0x18,
        0xa8,
      ]);

      expect(keystream).toEqual(expected);
    });

    // Test vector 2: 56-bit key
    it("should match RFC 6229 test vector (56-bit key)", () => {
      // Key: 01020304050607
      const key = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);
      const cipher = new RC4Cipher(key);

      const zeros = new Uint8Array(16);
      const keystream = cipher.process(zeros);

      // Expected first 16 bytes from RFC 6229
      const expected = new Uint8Array([
        0x29, 0x3f, 0x02, 0xd4, 0x7f, 0x37, 0xc9, 0xb6, 0x33, 0xf2, 0xaf, 0x52, 0x85, 0xfe, 0xb4,
        0x6b,
      ]);

      expect(keystream).toEqual(expected);
    });

    // Test vector 3: 64-bit key
    it("should match RFC 6229 test vector (64-bit key)", () => {
      // Key: 0102030405060708
      const key = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
      const cipher = new RC4Cipher(key);

      const zeros = new Uint8Array(16);
      const keystream = cipher.process(zeros);

      // Expected first 16 bytes from RFC 6229
      const expected = new Uint8Array([
        0x97, 0xab, 0x8a, 0x1b, 0xf0, 0xaf, 0xb9, 0x61, 0x32, 0xf2, 0xf6, 0x72, 0x58, 0xda, 0x15,
        0xa8,
      ]);

      expect(keystream).toEqual(expected);
    });

    // Test vector 4: 128-bit key
    it("should match RFC 6229 test vector (128-bit key)", () => {
      // Key: 0102030405060708090a0b0c0d0e0f10
      const key = new Uint8Array([
        0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
        0x10,
      ]);
      const cipher = new RC4Cipher(key);

      const zeros = new Uint8Array(16);
      const keystream = cipher.process(zeros);

      // Expected first 16 bytes from RFC 6229
      const expected = new Uint8Array([
        0x9a, 0xc7, 0xcc, 0x9a, 0x60, 0x9d, 0x1e, 0xf7, 0xb2, 0x93, 0x28, 0x99, 0xcd, 0xe4, 0x1b,
        0x97,
      ]);

      expect(keystream).toEqual(expected);
    });
  });

  /**
   * Wikipedia test vectors - commonly used for verification
   */
  describe("Wikipedia test vectors", () => {
    it("should encrypt 'Plaintext' with key 'Key'", () => {
      const key = new TextEncoder().encode("Key");
      const plaintext = new TextEncoder().encode("Plaintext");
      const cipher = new RC4Cipher(key);
      const ciphertext = cipher.process(plaintext);

      // Expected ciphertext from Wikipedia
      const expected = new Uint8Array([0xbb, 0xf3, 0x16, 0xe8, 0xd9, 0x40, 0xaf, 0x0a, 0xd3]);

      expect(ciphertext).toEqual(expected);
    });

    it("should encrypt 'pedia' with key 'Wiki'", () => {
      const key = new TextEncoder().encode("Wiki");
      const plaintext = new TextEncoder().encode("pedia");
      const cipher = new RC4Cipher(key);
      const ciphertext = cipher.process(plaintext);

      // Expected ciphertext from Wikipedia
      const expected = new Uint8Array([0x10, 0x21, 0xbf, 0x04, 0x20]);

      expect(ciphertext).toEqual(expected);
    });

    it("should encrypt 'Attack at dawn' with key 'Secret'", () => {
      const key = new TextEncoder().encode("Secret");
      const plaintext = new TextEncoder().encode("Attack at dawn");
      const cipher = new RC4Cipher(key);
      const ciphertext = cipher.process(plaintext);

      // Expected ciphertext from Wikipedia
      const expected = new Uint8Array([
        0x45, 0xa0, 0x1f, 0x64, 0x5f, 0xc3, 0x5b, 0x38, 0x35, 0x52, 0x54, 0x4b, 0x9b, 0xf5,
      ]);

      expect(ciphertext).toEqual(expected);
    });
  });

  describe("reset", () => {
    it("should reset cipher to initial state", () => {
      const key = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]);
      const data = new Uint8Array([0x11, 0x22, 0x33, 0x44, 0x55]);

      const cipher = new RC4Cipher(key);
      const result1 = cipher.process(data);

      // Process some more data to change state
      cipher.process(new Uint8Array([0xaa, 0xbb, 0xcc]));

      // Reset and process again
      cipher.reset(key);
      const result2 = cipher.process(data);

      expect(result1).toEqual(result2);
    });
  });

  describe("rc4 convenience function", () => {
    it("should encrypt and decrypt correctly", () => {
      const key = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]);
      const plaintext = new TextEncoder().encode("Test message");

      const ciphertext = rc4(key, plaintext);
      const decrypted = rc4(key, ciphertext);

      expect(decrypted).toEqual(plaintext);
    });

    it("should produce same result as RC4Cipher class", () => {
      const key = new Uint8Array([0x01, 0x02, 0x03]);
      const data = new Uint8Array([0x11, 0x22, 0x33, 0x44]);

      const result1 = rc4(key, data);
      const result2 = new RC4Cipher(key).process(data);

      expect(result1).toEqual(result2);
    });
  });

  /**
   * PDF-specific tests
   * PDF uses RC4 with 40-bit to 128-bit keys
   */
  describe("PDF encryption scenarios", () => {
    it("should work with 40-bit (5 byte) key", () => {
      const key = new Uint8Array(5).fill(0x42);
      const data = new TextEncoder().encode("PDF content");

      const encrypted = rc4(key, data);
      const decrypted = rc4(key, encrypted);

      expect(decrypted).toEqual(data);
    });

    it("should work with 128-bit (16 byte) key", () => {
      const key = new Uint8Array(16);
      for (let i = 0; i < 16; i++) {
        key[i] = i;
      }

      const data = new TextEncoder().encode("PDF content with 128-bit encryption");

      const encrypted = rc4(key, data);
      const decrypted = rc4(key, encrypted);

      expect(decrypted).toEqual(data);
    });

    it("should handle binary data correctly", () => {
      const key = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x42]);
      const binaryData = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        binaryData[i] = i;
      }

      const encrypted = rc4(key, binaryData);
      const decrypted = rc4(key, encrypted);

      expect(decrypted).toEqual(binaryData);
    });
  });
});
