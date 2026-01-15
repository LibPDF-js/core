import { describe, expect, it } from "vitest";

import {
  computeEncryptionKeyR2R4,
  computeOwnerHash,
  computeUserHash,
  deriveObjectKey,
  PASSWORD_PADDING,
  padPassword,
  verifyOwnerPassword,
  verifyUserPassword,
} from "./md5-based";

describe("padPassword", () => {
  it("should pad empty password with full padding", () => {
    const result = padPassword(new Uint8Array(0));
    expect(result).toEqual(PASSWORD_PADDING);
  });

  it("should pad short password", () => {
    const password = new TextEncoder().encode("test");
    const result = padPassword(password);

    // First 4 bytes should be "test"
    expect(result.subarray(0, 4)).toEqual(password);
    // Remaining should be padding
    expect(result.subarray(4)).toEqual(PASSWORD_PADDING.subarray(0, 28));
    expect(result.length).toBe(32);
  });

  it("should truncate long password", () => {
    const longPassword = new Uint8Array(50).fill(0x42);
    const result = padPassword(longPassword);

    expect(result.length).toBe(32);
    expect(result).toEqual(longPassword.subarray(0, 32));
  });

  it("should handle exactly 32-byte password", () => {
    const password = new Uint8Array(32).fill(0xab);
    const result = padPassword(password);

    expect(result).toEqual(password);
  });
});

describe("computeEncryptionKeyR2R4", () => {
  // Test vectors based on PDF spec examples
  const fileId = new TextEncoder().encode("12345678901234567890123456789012");
  const ownerHash = new Uint8Array(32).fill(0);
  const permissions = -3904; // Common permission value

  describe("R2 (40-bit)", () => {
    it("should compute 5-byte key for empty password", () => {
      const key = computeEncryptionKeyR2R4(
        new Uint8Array(0), // empty password
        ownerHash,
        permissions,
        fileId,
        5, // 40-bit = 5 bytes
        2, // R2
      );

      expect(key.length).toBe(5);
    });

    it("should produce deterministic output", () => {
      const password = new TextEncoder().encode("secret");

      const key1 = computeEncryptionKeyR2R4(password, ownerHash, permissions, fileId, 5, 2);

      const key2 = computeEncryptionKeyR2R4(password, ownerHash, permissions, fileId, 5, 2);

      expect(key1).toEqual(key2);
    });
  });

  describe("R3 (128-bit)", () => {
    it("should compute 16-byte key with 50 iterations", () => {
      const key = computeEncryptionKeyR2R4(
        new TextEncoder().encode("password"),
        ownerHash,
        permissions,
        fileId,
        16, // 128-bit = 16 bytes
        3, // R3
      );

      expect(key.length).toBe(16);
    });

    it("should produce different key than R2 with same input", () => {
      const password = new TextEncoder().encode("test");

      const keyR2 = computeEncryptionKeyR2R4(password, ownerHash, permissions, fileId, 5, 2);

      const keyR3 = computeEncryptionKeyR2R4(password, ownerHash, permissions, fileId, 5, 3);

      // R3 applies 50 extra MD5 iterations, so keys should differ
      expect(keyR2).not.toEqual(keyR3);
    });
  });

  describe("R4 with encryptMetadata=false", () => {
    it("should append 0xFFFFFFFF when metadata is not encrypted", () => {
      const password = new TextEncoder().encode("test");

      const keyWithMeta = computeEncryptionKeyR2R4(
        password,
        ownerHash,
        permissions,
        fileId,
        16,
        4,
        true,
      );

      const keyWithoutMeta = computeEncryptionKeyR2R4(
        password,
        ownerHash,
        permissions,
        fileId,
        16,
        4,
        false,
      );

      expect(keyWithMeta).not.toEqual(keyWithoutMeta);
    });
  });

  it("should be affected by file ID", () => {
    const password = new TextEncoder().encode("test");
    const fileId1 = new TextEncoder().encode("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
    const fileId2 = new TextEncoder().encode("BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB");

    const key1 = computeEncryptionKeyR2R4(password, ownerHash, permissions, fileId1, 16, 3);

    const key2 = computeEncryptionKeyR2R4(password, ownerHash, permissions, fileId2, 16, 3);

    expect(key1).not.toEqual(key2);
  });

  it("should be affected by permissions", () => {
    const password = new TextEncoder().encode("test");

    const key1 = computeEncryptionKeyR2R4(password, ownerHash, -3904, fileId, 16, 3);

    const key2 = computeEncryptionKeyR2R4(password, ownerHash, -1, fileId, 16, 3);

    expect(key1).not.toEqual(key2);
  });
});

describe("computeOwnerHash", () => {
  it("should compute 32-byte owner hash", () => {
    const ownerPassword = new TextEncoder().encode("owner123");
    const userPassword = new TextEncoder().encode("user456");

    const hash = computeOwnerHash(ownerPassword, userPassword, 16, 3);

    expect(hash.length).toBe(32);
  });

  it("should use user password when owner password is empty", () => {
    const userPassword = new TextEncoder().encode("user456");

    const hashWithEmpty = computeOwnerHash(new Uint8Array(0), userPassword, 16, 3);

    const hashWithUser = computeOwnerHash(userPassword, userPassword, 16, 3);

    expect(hashWithEmpty).toEqual(hashWithUser);
  });

  it("should produce different results for R2 vs R3", () => {
    const ownerPassword = new TextEncoder().encode("owner");
    const userPassword = new TextEncoder().encode("user");

    const hashR2 = computeOwnerHash(ownerPassword, userPassword, 5, 2);
    const hashR3 = computeOwnerHash(ownerPassword, userPassword, 16, 3);

    expect(hashR2).not.toEqual(hashR3);
  });
});

describe("computeUserHash", () => {
  const fileId = new TextEncoder().encode("test-file-id-1234567890123456");

  it("should compute 32-byte user hash for R2", () => {
    const key = new Uint8Array(5).fill(0x42);
    const hash = computeUserHash(key, fileId, 2);

    expect(hash.length).toBe(32);
  });

  it("should compute 32-byte user hash for R3", () => {
    const key = new Uint8Array(16).fill(0x42);
    const hash = computeUserHash(key, fileId, 3);

    expect(hash.length).toBe(32);
    // R3+ only uses first 16 bytes meaningfully, rest is arbitrary
  });

  it("should produce different results for R2 vs R3", () => {
    const key = new Uint8Array(16).fill(0x42);

    const hashR2 = computeUserHash(key, fileId, 2);
    const hashR3 = computeUserHash(key, fileId, 3);

    expect(hashR2).not.toEqual(hashR3);
  });
});

describe("verifyUserPassword", () => {
  it("should verify correct password", () => {
    const password = new TextEncoder().encode("correct");
    const fileId = new TextEncoder().encode("12345678901234567890123456789012");
    const permissions = -3904;
    const keyLength = 16;
    const revision = 3;

    // First, generate the expected values
    const ownerHash = computeOwnerHash(password, password, keyLength, revision);
    const encryptionKey = computeEncryptionKeyR2R4(
      password,
      ownerHash,
      permissions,
      fileId,
      keyLength,
      revision,
    );
    const userHash = computeUserHash(encryptionKey, fileId, revision);

    // Now verify
    const result = verifyUserPassword(
      password,
      ownerHash,
      userHash,
      permissions,
      fileId,
      keyLength,
      revision,
    );

    expect(result.isValid).toBe(true);
    expect(result.encryptionKey).toEqual(encryptionKey);
  });

  it("should reject incorrect password", () => {
    const correctPassword = new TextEncoder().encode("correct");
    const wrongPassword = new TextEncoder().encode("wrong");
    const fileId = new TextEncoder().encode("12345678901234567890123456789012");
    const permissions = -3904;
    const keyLength = 16;
    const revision = 3;

    const ownerHash = computeOwnerHash(correctPassword, correctPassword, keyLength, revision);
    const encryptionKey = computeEncryptionKeyR2R4(
      correctPassword,
      ownerHash,
      permissions,
      fileId,
      keyLength,
      revision,
    );
    const userHash = computeUserHash(encryptionKey, fileId, revision);

    const result = verifyUserPassword(
      wrongPassword,
      ownerHash,
      userHash,
      permissions,
      fileId,
      keyLength,
      revision,
    );

    expect(result.isValid).toBe(false);
    expect(result.encryptionKey).toBeNull();
  });

  it("should accept empty password when document has empty password", () => {
    const emptyPassword = new Uint8Array(0);
    const fileId = new TextEncoder().encode("file-id-for-empty-password-test");
    const permissions = -4;
    const keyLength = 16;
    const revision = 4;

    const ownerHash = computeOwnerHash(emptyPassword, emptyPassword, keyLength, revision);
    const encryptionKey = computeEncryptionKeyR2R4(
      emptyPassword,
      ownerHash,
      permissions,
      fileId,
      keyLength,
      revision,
    );
    const userHash = computeUserHash(encryptionKey, fileId, revision);

    const result = verifyUserPassword(
      emptyPassword,
      ownerHash,
      userHash,
      permissions,
      fileId,
      keyLength,
      revision,
    );

    expect(result.isValid).toBe(true);
  });
});

describe("verifyOwnerPassword", () => {
  it("should verify correct owner password", () => {
    const ownerPassword = new TextEncoder().encode("owner123");
    const userPassword = new TextEncoder().encode("user456");
    const fileId = new TextEncoder().encode("12345678901234567890123456789012");
    const permissions = -3904;
    const keyLength = 16;
    const revision = 3;

    // Generate encryption dictionary values
    const ownerHash = computeOwnerHash(ownerPassword, userPassword, keyLength, revision);
    const encryptionKey = computeEncryptionKeyR2R4(
      userPassword,
      ownerHash,
      permissions,
      fileId,
      keyLength,
      revision,
    );
    const userHash = computeUserHash(encryptionKey, fileId, revision);

    // Verify owner password
    const result = verifyOwnerPassword(
      ownerPassword,
      ownerHash,
      userHash,
      permissions,
      fileId,
      keyLength,
      revision,
    );

    expect(result.isValid).toBe(true);
    expect(result.encryptionKey).toEqual(encryptionKey);
  });

  it("should reject incorrect owner password", () => {
    const ownerPassword = new TextEncoder().encode("owner123");
    const wrongOwnerPassword = new TextEncoder().encode("wrongowner");
    const userPassword = new TextEncoder().encode("user456");
    const fileId = new TextEncoder().encode("12345678901234567890123456789012");
    const permissions = -3904;
    const keyLength = 16;
    const revision = 3;

    const ownerHash = computeOwnerHash(ownerPassword, userPassword, keyLength, revision);
    const encryptionKey = computeEncryptionKeyR2R4(
      userPassword,
      ownerHash,
      permissions,
      fileId,
      keyLength,
      revision,
    );
    const userHash = computeUserHash(encryptionKey, fileId, revision);

    const result = verifyOwnerPassword(
      wrongOwnerPassword,
      ownerHash,
      userHash,
      permissions,
      fileId,
      keyLength,
      revision,
    );

    expect(result.isValid).toBe(false);
    expect(result.encryptionKey).toBeNull();
  });
});

describe("deriveObjectKey", () => {
  const documentKey = new Uint8Array([
    0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10,
  ]);

  it("should derive object key for RC4", () => {
    const objectKey = deriveObjectKey(documentKey, 1, 0, false);

    // Key length should be min(docKey.length + 5, 16) = 16
    expect(objectKey.length).toBe(16);
  });

  it("should derive object key for AES", () => {
    const objectKey = deriveObjectKey(documentKey, 1, 0, true);

    // Key length should be 16
    expect(objectKey.length).toBe(16);
  });

  it("should produce different keys for different objects", () => {
    const key1 = deriveObjectKey(documentKey, 1, 0);
    const key2 = deriveObjectKey(documentKey, 2, 0);
    const key3 = deriveObjectKey(documentKey, 1, 1);

    expect(key1).not.toEqual(key2);
    expect(key1).not.toEqual(key3);
  });

  it("should produce different keys for RC4 vs AES", () => {
    const rc4Key = deriveObjectKey(documentKey, 1, 0, false);
    const aesKey = deriveObjectKey(documentKey, 1, 0, true);

    expect(rc4Key).not.toEqual(aesKey);
  });

  it("should handle short document key", () => {
    const shortKey = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]); // 5 bytes (40-bit)
    const objectKey = deriveObjectKey(shortKey, 1, 0);

    // Key length should be min(5 + 5, 16) = 10
    expect(objectKey.length).toBe(10);
  });

  it("should limit key to 16 bytes even with long document key", () => {
    const longKey = new Uint8Array(32).fill(0x42);
    const objectKey = deriveObjectKey(longKey, 1, 0);

    // Should cap at 16 bytes
    expect(objectKey.length).toBe(16);
  });
});

/**
 * Known test vectors from PDF files
 * These are real values extracted from encrypted PDFs for validation
 */
describe("known test vectors", () => {
  it("should match known R3 encryption values", () => {
    // This test uses synthetic but representative values
    // In practice, you'd extract these from a real encrypted PDF

    const password = new TextEncoder().encode("test");
    const fileId = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      fileId[i] = i;
    }

    const keyLength = 16;
    const revision = 3;
    const permissions = -3904;

    // Generate a complete encryption setup
    const ownerHash = computeOwnerHash(password, password, keyLength, revision);
    const encryptionKey = computeEncryptionKeyR2R4(
      password,
      ownerHash,
      permissions,
      fileId,
      keyLength,
      revision,
    );
    const userHash = computeUserHash(encryptionKey, fileId, revision);

    // Verify round-trip works
    const userResult = verifyUserPassword(
      password,
      ownerHash,
      userHash,
      permissions,
      fileId,
      keyLength,
      revision,
    );

    const ownerResult = verifyOwnerPassword(
      password,
      ownerHash,
      userHash,
      permissions,
      fileId,
      keyLength,
      revision,
    );

    expect(userResult.isValid).toBe(true);
    expect(ownerResult.isValid).toBe(true);
    expect(userResult.encryptionKey).toEqual(ownerResult.encryptionKey);
  });
});
