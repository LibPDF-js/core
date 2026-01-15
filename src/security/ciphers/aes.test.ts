import { describe, expect, it } from "vitest";

import {
  AES_BLOCK_SIZE,
  aesDecrypt,
  aesDecryptWithIv,
  aesEcbDecrypt,
  aesEcbEncrypt,
  aesEncrypt,
  aesEncryptWithIv,
  generateIv,
  ZERO_IV,
} from "./aes";

describe("AES-CBC encryption", () => {
  const key128 = new Uint8Array(16).fill(0x42); // AES-128
  const key256 = new Uint8Array(32).fill(0x42); // AES-256

  describe("aesEncrypt/aesDecrypt", () => {
    it("should round-trip with AES-128", () => {
      const plaintext = new TextEncoder().encode("Hello, PDF encryption!");
      const ciphertext = aesEncrypt(key128, plaintext);

      // Ciphertext should be longer than plaintext (IV + padding)
      expect(ciphertext.length).toBeGreaterThan(plaintext.length);
      // Should start with 16-byte IV
      expect(ciphertext.length).toBeGreaterThanOrEqual(AES_BLOCK_SIZE);

      const decrypted = aesDecrypt(key128, ciphertext);
      expect(decrypted).toEqual(plaintext);
    });

    it("should round-trip with AES-256", () => {
      const plaintext = new TextEncoder().encode("AES-256 is stronger!");
      const ciphertext = aesEncrypt(key256, plaintext);

      const decrypted = aesDecrypt(key256, ciphertext);
      expect(decrypted).toEqual(plaintext);
    });

    it("should handle empty plaintext", () => {
      const plaintext = new Uint8Array(0);
      const ciphertext = aesEncrypt(key128, plaintext);

      // Should have IV + one block of padding
      expect(ciphertext.length).toBe(AES_BLOCK_SIZE * 2);

      const decrypted = aesDecrypt(key128, ciphertext);
      expect(decrypted).toEqual(plaintext);
    });

    it("should handle block-aligned plaintext", () => {
      // Exactly 16 bytes
      const plaintext = new Uint8Array(16).fill(0xab);
      const ciphertext = aesEncrypt(key128, plaintext);

      // Should have IV + 2 blocks (plaintext + padding block)
      expect(ciphertext.length).toBe(AES_BLOCK_SIZE * 3);

      const decrypted = aesDecrypt(key128, ciphertext);
      expect(decrypted).toEqual(plaintext);
    });

    it("should handle large data", () => {
      // 1KB of random-ish data
      const plaintext = new Uint8Array(1024);
      for (let i = 0; i < plaintext.length; i++) {
        plaintext[i] = i % 256;
      }

      const ciphertext = aesEncrypt(key256, plaintext);
      const decrypted = aesDecrypt(key256, ciphertext);

      expect(decrypted).toEqual(plaintext);
    });

    it("should produce different ciphertext each time (random IV)", () => {
      const plaintext = new TextEncoder().encode("Same message");

      const ciphertext1 = aesEncrypt(key128, plaintext);
      const ciphertext2 = aesEncrypt(key128, plaintext);

      // Should be different due to random IV
      expect(ciphertext1).not.toEqual(ciphertext2);

      // But both should decrypt to same plaintext
      expect(aesDecrypt(key128, ciphertext1)).toEqual(plaintext);
      expect(aesDecrypt(key128, ciphertext2)).toEqual(plaintext);
    });
  });

  describe("aesEncryptWithIv/aesDecryptWithIv", () => {
    const fixedIv = new Uint8Array([
      0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e,
      0x0f,
    ]);

    it("should round-trip with fixed IV", () => {
      const plaintext = new TextEncoder().encode("Fixed IV test");

      const ciphertext = aesEncryptWithIv(key128, fixedIv, plaintext);
      const decrypted = aesDecryptWithIv(key128, fixedIv, ciphertext);

      expect(decrypted).toEqual(plaintext);
    });

    it("should produce same ciphertext with same IV", () => {
      const plaintext = new TextEncoder().encode("Deterministic!");

      const ciphertext1 = aesEncryptWithIv(key128, fixedIv, plaintext);
      const ciphertext2 = aesEncryptWithIv(key128, fixedIv, plaintext);

      expect(ciphertext1).toEqual(ciphertext2);
    });

    it("should work with zero IV", () => {
      const plaintext = new TextEncoder().encode("Zero IV");

      const ciphertext = aesEncryptWithIv(key128, ZERO_IV, plaintext);
      const decrypted = aesDecryptWithIv(key128, ZERO_IV, ciphertext);

      expect(decrypted).toEqual(plaintext);
    });

    it("should work with padding disabled for block-aligned data", () => {
      // Exactly 32 bytes (2 blocks)
      const plaintext = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        plaintext[i] = i;
      }

      const ciphertext = aesEncryptWithIv(key128, fixedIv, plaintext, true);
      expect(ciphertext.length).toBe(32); // No padding added

      const decrypted = aesDecryptWithIv(key128, fixedIv, ciphertext, true);
      expect(decrypted).toEqual(plaintext);
    });

    it("should throw for non-block-aligned data with padding disabled", () => {
      const plaintext = new Uint8Array(17); // Not a multiple of 16

      expect(() => aesEncryptWithIv(key128, fixedIv, plaintext, true)).toThrow(
        /must be multiple of 16/,
      );
    });
  });

  describe("error handling", () => {
    it("should reject invalid key sizes", () => {
      const plaintext = new TextEncoder().encode("test");

      expect(() => aesEncrypt(new Uint8Array(10), plaintext)).toThrow(/must be 16.*or 32/);
      expect(() => aesEncrypt(new Uint8Array(24), plaintext)).toThrow(/must be 16.*or 32/);
    });

    it("should reject ciphertext shorter than IV", () => {
      expect(() => aesDecrypt(key128, new Uint8Array(10))).toThrow(/too short/);
    });

    it("should handle ciphertext that is exactly IV length", () => {
      // Just IV, no actual ciphertext
      const result = aesDecrypt(key128, new Uint8Array(16));
      expect(result).toEqual(new Uint8Array(0));
    });

    it("should reject invalid IV size", () => {
      const iv = new Uint8Array(10);
      expect(() => aesEncryptWithIv(key128, iv, new Uint8Array(16))).toThrow(/IV must be 16/);
    });

    it("should reject non-block-aligned ciphertext", () => {
      // IV (16) + non-aligned ciphertext (10)
      const invalidData = new Uint8Array(26);

      expect(() => aesDecrypt(key128, invalidData)).toThrow(/must be multiple of 16/);
    });
  });

  describe("generateIv", () => {
    it("should generate 16-byte IV", () => {
      const iv = generateIv();
      expect(iv.length).toBe(16);
    });

    it("should generate different IVs each time", () => {
      const iv1 = generateIv();
      const iv2 = generateIv();
      expect(iv1).not.toEqual(iv2);
    });
  });
});

describe("AES-ECB encryption", () => {
  const key128 = new Uint8Array(16).fill(0x42);
  const key256 = new Uint8Array(32).fill(0x42);

  describe("aesEcbEncrypt/aesEcbDecrypt", () => {
    it("should round-trip single block with AES-128", () => {
      const block = new Uint8Array([
        0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee,
        0xff,
      ]);

      const encrypted = aesEcbEncrypt(key128, block);
      expect(encrypted.length).toBe(16);
      expect(encrypted).not.toEqual(block);

      const decrypted = aesEcbDecrypt(key128, encrypted);
      expect(decrypted).toEqual(block);
    });

    it("should round-trip with AES-256", () => {
      const block = new Uint8Array(16);
      for (let i = 0; i < 16; i++) {
        block[i] = i * 17;
      }

      const encrypted = aesEcbEncrypt(key256, block);
      const decrypted = aesEcbDecrypt(key256, encrypted);

      expect(decrypted).toEqual(block);
    });

    it("should produce deterministic output", () => {
      const block = new Uint8Array(16).fill(0xab);

      const encrypted1 = aesEcbEncrypt(key128, block);
      const encrypted2 = aesEcbEncrypt(key128, block);

      expect(encrypted1).toEqual(encrypted2);
    });

    it("should reject non-16-byte blocks", () => {
      expect(() => aesEcbEncrypt(key128, new Uint8Array(10))).toThrow(/must be exactly 16/);
      expect(() => aesEcbDecrypt(key128, new Uint8Array(20))).toThrow(/must be exactly 16/);
    });
  });

  /**
   * NIST test vectors for AES-ECB
   * From FIPS 197 Appendix C.1 (AES-128)
   */
  describe("NIST test vectors", () => {
    it("should match NIST AES-128 ECB test vector", () => {
      // NIST FIPS 197 Appendix C.1
      const key = new Uint8Array([
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e,
        0x0f,
      ]);
      const plaintext = new Uint8Array([
        0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee,
        0xff,
      ]);
      const expectedCiphertext = new Uint8Array([
        0x69, 0xc4, 0xe0, 0xd8, 0x6a, 0x7b, 0x04, 0x30, 0xd8, 0xcd, 0xb7, 0x80, 0x70, 0xb4, 0xc5,
        0x5a,
      ]);

      const ciphertext = aesEcbEncrypt(key, plaintext);
      expect(ciphertext).toEqual(expectedCiphertext);

      const decrypted = aesEcbDecrypt(key, ciphertext);
      expect(decrypted).toEqual(plaintext);
    });

    it("should match NIST AES-256 ECB test vector", () => {
      // NIST FIPS 197 Appendix C.3
      const key = new Uint8Array([
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e,
        0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d,
        0x1e, 0x1f,
      ]);
      const plaintext = new Uint8Array([
        0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee,
        0xff,
      ]);
      const expectedCiphertext = new Uint8Array([
        0x8e, 0xa2, 0xb7, 0xca, 0x51, 0x67, 0x45, 0xbf, 0xea, 0xfc, 0x49, 0x90, 0x4b, 0x49, 0x60,
        0x89,
      ]);

      const ciphertext = aesEcbEncrypt(key, plaintext);
      expect(ciphertext).toEqual(expectedCiphertext);

      const decrypted = aesEcbDecrypt(key, ciphertext);
      expect(decrypted).toEqual(plaintext);
    });
  });
});

/**
 * PDF-specific encryption scenarios
 */
describe("PDF encryption scenarios", () => {
  describe("stream decryption (AES-128)", () => {
    it("should handle typical PDF stream encryption", () => {
      // Simulate PDF R4 stream encryption
      const key = new Uint8Array(16); // Object-specific key
      for (let i = 0; i < 16; i++) {
        key[i] = i;
      }

      // Simulate a stream content
      const streamContent = new TextEncoder().encode("BT /F1 12 Tf 100 700 Td (Hello World) Tj ET");

      // Encrypt (this is what writer would do)
      const encrypted = aesEncrypt(key, streamContent);

      // Decrypt (this is what parser does)
      const decrypted = aesDecrypt(key, encrypted);

      expect(new TextDecoder().decode(decrypted)).toBe(
        "BT /F1 12 Tf 100 700 Td (Hello World) Tj ET",
      );
    });
  });

  describe("/Perms entry (AES-256-ECB)", () => {
    it("should encrypt/decrypt 16-byte Perms block", () => {
      // AES-256 key for R6
      const key = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        key[i] = i;
      }

      // Perms entry format: permissions (4) + "adb" + encrypted metadata flag + random (4)
      const perms = new Uint8Array([
        0xff,
        0xff,
        0xff,
        0x00, // Permissions (little-endian)
        0x61,
        0x64,
        0x62, // "adb" constant
        0x00, // EncryptMetadata
        0x54, // 'T' (from "Tadb" in some implementations)
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
      ]);

      const encrypted = aesEcbEncrypt(key, perms);
      const decrypted = aesEcbDecrypt(key, encrypted);

      expect(decrypted).toEqual(perms);

      // Verify "adb" constant at bytes 4-6
      expect(String.fromCharCode(decrypted[4], decrypted[5], decrypted[6])).toBe("adb");
    });
  });
});
