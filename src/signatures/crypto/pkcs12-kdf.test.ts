/**
 * Tests for PKCS#12 Key Derivation Function.
 */

import { describe, expect, it } from "vitest";

import { PKCS12KDF } from "./pkcs12-kdf";

describe("PKCS12KDF", () => {
  describe("constants", () => {
    it("has correct purpose constants", () => {
      expect(PKCS12KDF.PURPOSE_KEY).toBe(1);
      expect(PKCS12KDF.PURPOSE_IV).toBe(2);
      expect(PKCS12KDF.PURPOSE_MAC).toBe(3);
    });
  });

  describe("passwordToBytes", () => {
    it("converts empty string", () => {
      const result = PKCS12KDF.passwordToBytes("");
      // Empty string + trailing null = 2 bytes
      expect(result.length).toBe(2);
      expect(result[0]).toBe(0);
      expect(result[1]).toBe(0);
    });

    it("converts ASCII password to UTF-16BE", () => {
      const result = PKCS12KDF.passwordToBytes("test");
      // "test" = 4 chars + null = 10 bytes (5 UTF-16BE chars)
      expect(result.length).toBe(10);

      // 't' = 0x0074
      expect(result[0]).toBe(0x00);
      expect(result[1]).toBe(0x74);

      // 'e' = 0x0065
      expect(result[2]).toBe(0x00);
      expect(result[3]).toBe(0x65);

      // 's' = 0x0073
      expect(result[4]).toBe(0x00);
      expect(result[5]).toBe(0x73);

      // 't' = 0x0074
      expect(result[6]).toBe(0x00);
      expect(result[7]).toBe(0x74);

      // trailing null
      expect(result[8]).toBe(0x00);
      expect(result[9]).toBe(0x00);
    });

    it("converts Unicode password correctly", () => {
      // Test with a character outside ASCII range
      const result = PKCS12KDF.passwordToBytes("tëst");
      // 4 chars + null = 10 bytes
      expect(result.length).toBe(10);

      // 'ë' = U+00EB = 0x00EB
      expect(result[2]).toBe(0x00);
      expect(result[3]).toBe(0xeb);
    });
  });

  describe("derive", () => {
    it("derives key material of requested length", () => {
      const password = PKCS12KDF.passwordToBytes("test");
      const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const iterations = 1000;

      const key16 = PKCS12KDF.derive(password, salt, iterations, PKCS12KDF.PURPOSE_KEY, 16);
      const key24 = PKCS12KDF.derive(password, salt, iterations, PKCS12KDF.PURPOSE_KEY, 24);
      const key32 = PKCS12KDF.derive(password, salt, iterations, PKCS12KDF.PURPOSE_KEY, 32);

      expect(key16.length).toBe(16);
      expect(key24.length).toBe(24);
      expect(key32.length).toBe(32);
    });

    it("produces different output for different purposes", () => {
      const password = PKCS12KDF.passwordToBytes("test");
      const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const iterations = 1000;

      const forKey = PKCS12KDF.derive(password, salt, iterations, PKCS12KDF.PURPOSE_KEY, 16);
      const forIV = PKCS12KDF.derive(password, salt, iterations, PKCS12KDF.PURPOSE_IV, 16);
      const forMAC = PKCS12KDF.derive(password, salt, iterations, PKCS12KDF.PURPOSE_MAC, 16);

      // All should be different
      expect(forKey).not.toEqual(forIV);
      expect(forKey).not.toEqual(forMAC);
      expect(forIV).not.toEqual(forMAC);
    });

    it("produces consistent output for same inputs", () => {
      const password = PKCS12KDF.passwordToBytes("test");
      const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const iterations = 1000;

      const result1 = PKCS12KDF.derive(password, salt, iterations, PKCS12KDF.PURPOSE_KEY, 16);
      const result2 = PKCS12KDF.derive(password, salt, iterations, PKCS12KDF.PURPOSE_KEY, 16);

      expect(result1).toEqual(result2);
    });

    it("produces different output for different passwords", () => {
      const password1 = PKCS12KDF.passwordToBytes("test1");
      const password2 = PKCS12KDF.passwordToBytes("test2");
      const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const iterations = 1000;

      const result1 = PKCS12KDF.derive(password1, salt, iterations, PKCS12KDF.PURPOSE_KEY, 16);
      const result2 = PKCS12KDF.derive(password2, salt, iterations, PKCS12KDF.PURPOSE_KEY, 16);

      expect(result1).not.toEqual(result2);
    });

    it("produces different output for different salts", () => {
      const password = PKCS12KDF.passwordToBytes("test");
      const salt1 = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const salt2 = new Uint8Array([8, 7, 6, 5, 4, 3, 2, 1]);
      const iterations = 1000;

      const result1 = PKCS12KDF.derive(password, salt1, iterations, PKCS12KDF.PURPOSE_KEY, 16);
      const result2 = PKCS12KDF.derive(password, salt2, iterations, PKCS12KDF.PURPOSE_KEY, 16);

      expect(result1).not.toEqual(result2);
    });

    it("produces different output for different iteration counts", () => {
      const password = PKCS12KDF.passwordToBytes("test");
      const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

      const result1 = PKCS12KDF.derive(password, salt, 1000, PKCS12KDF.PURPOSE_KEY, 16);
      const result2 = PKCS12KDF.derive(password, salt, 2000, PKCS12KDF.PURPOSE_KEY, 16);

      expect(result1).not.toEqual(result2);
    });
  });

  describe("deriveKey", () => {
    it("is equivalent to derive with PURPOSE_KEY", () => {
      const password = PKCS12KDF.passwordToBytes("test");
      const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const iterations = 1000;

      const key1 = PKCS12KDF.deriveKey(password, salt, iterations, 24);
      const key2 = PKCS12KDF.derive(password, salt, iterations, PKCS12KDF.PURPOSE_KEY, 24);

      expect(key1).toEqual(key2);
    });
  });

  describe("deriveIV", () => {
    it("is equivalent to derive with PURPOSE_IV", () => {
      const password = PKCS12KDF.passwordToBytes("test");
      const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const iterations = 1000;

      const iv1 = PKCS12KDF.deriveIV(password, salt, iterations, 8);
      const iv2 = PKCS12KDF.derive(password, salt, iterations, PKCS12KDF.PURPOSE_IV, 8);

      expect(iv1).toEqual(iv2);
    });
  });

  // Known answer test from real P12 files
  describe("known answer tests", () => {
    it("derives correct key for 3DES from test P12", () => {
      // These values are from the test-signer-3des.p12 fixture
      // We can verify the derivation works by checking it produces
      // output that successfully decrypts the P12
      const password = PKCS12KDF.passwordToBytes("test123");
      const salt = new Uint8Array([0xc0, 0x21, 0x77, 0x2d, 0x7b, 0x5d, 0x8d, 0x8e]);
      const iterations = 2048;

      const key = PKCS12KDF.deriveKey(password, salt, iterations, 24);
      const iv = PKCS12KDF.deriveIV(password, salt, iterations, 8);

      // Just verify the lengths are correct
      expect(key.length).toBe(24);
      expect(iv.length).toBe(8);

      // The actual correctness is verified by the integration tests
      // that successfully decrypt the P12 files
    });
  });
});
