import { describe, expect, it } from "vitest";

import {
  computeHash2A,
  computeHash2B,
  computeHashForRevision,
  generateOwnerEntries,
  generatePermsEntry,
  generateUserEntries,
  MAX_PASSWORD_LENGTH,
  truncatePassword,
  verifyOwnerPasswordR56,
  verifyPermsEntry,
  verifyUserPasswordR56,
} from "./sha-based";

describe("truncatePassword", () => {
  it("should return password unchanged if <= 127 bytes", () => {
    const short = new TextEncoder().encode("short");
    expect(truncatePassword(short)).toEqual(short);

    const exact = new Uint8Array(127).fill(0x42);
    expect(truncatePassword(exact)).toEqual(exact);
  });

  it("should truncate password longer than 127 bytes", () => {
    const long = new Uint8Array(200).fill(0x42);
    const result = truncatePassword(long);

    expect(result.length).toBe(MAX_PASSWORD_LENGTH);
    expect(result).toEqual(long.subarray(0, 127));
  });

  it("should handle empty password", () => {
    const result = truncatePassword(new Uint8Array(0));
    expect(result.length).toBe(0);
  });
});

describe("computeHash2A (R5)", () => {
  it("should compute 32-byte hash", () => {
    const password = new TextEncoder().encode("test");
    const salt = new Uint8Array(8).fill(0x12);

    const hash = computeHash2A(password, salt);

    expect(hash.length).toBe(32);
  });

  it("should produce deterministic output", () => {
    const password = new TextEncoder().encode("password123");
    const salt = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);

    const hash1 = computeHash2A(password, salt);
    const hash2 = computeHash2A(password, salt);

    expect(hash1).toEqual(hash2);
  });

  it("should include userKey in hash for owner password", () => {
    const password = new TextEncoder().encode("owner");
    const salt = new Uint8Array(8).fill(0x11);
    const userKey = new Uint8Array(48).fill(0x22);

    const hashWithoutUserKey = computeHash2A(password, salt);
    const hashWithUserKey = computeHash2A(password, salt, userKey);

    expect(hashWithoutUserKey).not.toEqual(hashWithUserKey);
  });

  it("should be affected by password", () => {
    const salt = new Uint8Array(8).fill(0x33);

    const hash1 = computeHash2A(new TextEncoder().encode("password1"), salt);
    const hash2 = computeHash2A(new TextEncoder().encode("password2"), salt);

    expect(hash1).not.toEqual(hash2);
  });

  it("should be affected by salt", () => {
    const password = new TextEncoder().encode("test");

    const hash1 = computeHash2A(password, new Uint8Array(8).fill(0x11));
    const hash2 = computeHash2A(password, new Uint8Array(8).fill(0x22));

    expect(hash1).not.toEqual(hash2);
  });
});

describe("computeHash2B (R6)", () => {
  it("should compute 32-byte hash", () => {
    const password = new TextEncoder().encode("test");
    const salt = new Uint8Array(8).fill(0x12);

    const hash = computeHash2B(password, salt);

    expect(hash.length).toBe(32);
  });

  it("should produce deterministic output", () => {
    const password = new TextEncoder().encode("mypassword");
    const salt = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);

    const hash1 = computeHash2B(password, salt);
    const hash2 = computeHash2B(password, salt);

    expect(hash1).toEqual(hash2);
  });

  it("should produce different result than computeHash2A", () => {
    const password = new TextEncoder().encode("same");
    const salt = new Uint8Array(8).fill(0x44);

    const hash2A = computeHash2A(password, salt);
    const hash2B = computeHash2B(password, salt);

    // R6 (2.B) uses iterative hashing, should differ from R5 (2.A)
    expect(hash2A).not.toEqual(hash2B);
  });

  it("should include userKey in hash for owner password", () => {
    const password = new TextEncoder().encode("owner");
    const salt = new Uint8Array(8).fill(0x11);
    const userKey = new Uint8Array(48).fill(0x22);

    const hashWithoutUserKey = computeHash2B(password, salt);
    const hashWithUserKey = computeHash2B(password, salt, userKey);

    expect(hashWithoutUserKey).not.toEqual(hashWithUserKey);
  });
});

describe("computeHashForRevision", () => {
  it("should use computeHash2A for revision 5", () => {
    const password = new TextEncoder().encode("test");
    const salt = new Uint8Array(8).fill(0x55);

    const hashR5 = computeHashForRevision(password, salt, undefined, 5);
    const hash2A = computeHash2A(password, salt);

    expect(hashR5).toEqual(hash2A);
  });

  it("should use computeHash2B for revision 6", () => {
    const password = new TextEncoder().encode("test");
    const salt = new Uint8Array(8).fill(0x66);

    const hashR6 = computeHashForRevision(password, salt, undefined, 6);
    const hash2B = computeHash2B(password, salt);

    expect(hashR6).toEqual(hash2B);
  });
});

describe("verifyUserPasswordR56", () => {
  it("should verify correct user password (R5)", () => {
    const password = new TextEncoder().encode("userpass");
    const fileKey = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      fileKey[i] = i;
    }

    // Generate entries
    const { u, ue } = generateUserEntries(password, fileKey, 5);

    // Verify
    const result = verifyUserPasswordR56(password, u, ue, 5);

    expect(result.isValid).toBe(true);
    expect(result.encryptionKey).toEqual(fileKey);
  });

  it("should verify correct user password (R6)", () => {
    const password = new TextEncoder().encode("r6password");
    const fileKey = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      fileKey[i] = 0xff - i;
    }

    const { u, ue } = generateUserEntries(password, fileKey, 6);
    const result = verifyUserPasswordR56(password, u, ue, 6);

    expect(result.isValid).toBe(true);
    expect(result.encryptionKey).toEqual(fileKey);
  });

  it("should reject incorrect user password", () => {
    const correctPassword = new TextEncoder().encode("correct");
    const wrongPassword = new TextEncoder().encode("wrong");
    const fileKey = new Uint8Array(32).fill(0xab);

    const { u, ue } = generateUserEntries(correctPassword, fileKey, 6);
    const result = verifyUserPasswordR56(wrongPassword, u, ue, 6);

    expect(result.isValid).toBe(false);
    expect(result.encryptionKey).toBeNull();
  });

  it("should accept empty password when document uses empty password", () => {
    const emptyPassword = new Uint8Array(0);
    const fileKey = new Uint8Array(32).fill(0x42);

    const { u, ue } = generateUserEntries(emptyPassword, fileKey, 6);
    const result = verifyUserPasswordR56(emptyPassword, u, ue, 6);

    expect(result.isValid).toBe(true);
    expect(result.encryptionKey).toEqual(fileKey);
  });
});

describe("verifyOwnerPasswordR56", () => {
  it("should verify correct owner password (R5)", () => {
    const userPassword = new TextEncoder().encode("user");
    const ownerPassword = new TextEncoder().encode("owner");
    const fileKey = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      fileKey[i] = i;
    }

    // Generate user entries first (needed for owner)
    const { u } = generateUserEntries(userPassword, fileKey, 5);

    // Generate owner entries
    const { o, oe } = generateOwnerEntries(ownerPassword, fileKey, u, 5);

    // Verify owner password
    const result = verifyOwnerPasswordR56(ownerPassword, o, oe, u, 5);

    expect(result.isValid).toBe(true);
    expect(result.encryptionKey).toEqual(fileKey);
  });

  it("should verify correct owner password (R6)", () => {
    const userPassword = new TextEncoder().encode("user123");
    const ownerPassword = new TextEncoder().encode("owner456");
    const fileKey = new Uint8Array(32).fill(0x99);

    const { u } = generateUserEntries(userPassword, fileKey, 6);
    const { o, oe } = generateOwnerEntries(ownerPassword, fileKey, u, 6);
    const result = verifyOwnerPasswordR56(ownerPassword, o, oe, u, 6);

    expect(result.isValid).toBe(true);
    expect(result.encryptionKey).toEqual(fileKey);
  });

  it("should reject incorrect owner password", () => {
    const userPassword = new TextEncoder().encode("user");
    const correctOwner = new TextEncoder().encode("owner");
    const wrongOwner = new TextEncoder().encode("wrongowner");
    const fileKey = new Uint8Array(32).fill(0x77);

    const { u } = generateUserEntries(userPassword, fileKey, 6);
    const { o, oe } = generateOwnerEntries(correctOwner, fileKey, u, 6);
    const result = verifyOwnerPasswordR56(wrongOwner, o, oe, u, 6);

    expect(result.isValid).toBe(false);
    expect(result.encryptionKey).toBeNull();
  });
});

describe("generateUserEntries", () => {
  it("should generate 48-byte U and 32-byte UE", () => {
    const password = new TextEncoder().encode("test");
    const fileKey = new Uint8Array(32).fill(0x42);

    const { u, ue } = generateUserEntries(password, fileKey, 6);

    expect(u.length).toBe(48);
    expect(ue.length).toBe(32);
  });

  it("should generate different values each time (random salts)", () => {
    const password = new TextEncoder().encode("test");
    const fileKey = new Uint8Array(32).fill(0x42);

    const entries1 = generateUserEntries(password, fileKey, 6);
    const entries2 = generateUserEntries(password, fileKey, 6);

    // U entries should differ (different random salts)
    expect(entries1.u).not.toEqual(entries2.u);
  });
});

describe("generateOwnerEntries", () => {
  it("should generate 48-byte O and 32-byte OE", () => {
    const password = new TextEncoder().encode("owner");
    const fileKey = new Uint8Array(32).fill(0x42);
    const userEntry = new Uint8Array(48).fill(0x11);

    const { o, oe } = generateOwnerEntries(password, fileKey, userEntry, 6);

    expect(o.length).toBe(48);
    expect(oe.length).toBe(32);
  });
});

describe("generatePermsEntry", () => {
  it("should generate 16-byte Perms entry", () => {
    const fileKey = new Uint8Array(32).fill(0x42);
    const perms = generatePermsEntry(fileKey, -3904, true);

    expect(perms.length).toBe(16);
  });

  it("should be verifiable after generation", () => {
    const fileKey = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      fileKey[i] = i;
    }

    const permissions = -3904;
    const encryptMetadata = true;

    const perms = generatePermsEntry(fileKey, permissions, encryptMetadata);
    const isValid = verifyPermsEntry(fileKey, perms, permissions, encryptMetadata);

    expect(isValid).toBe(true);
  });

  it("should fail verification with wrong permissions", () => {
    const fileKey = new Uint8Array(32).fill(0x42);
    const perms = generatePermsEntry(fileKey, -3904, true);

    const isValid = verifyPermsEntry(fileKey, perms, -1, true);

    expect(isValid).toBe(false);
  });

  it("should fail verification with wrong encryptMetadata", () => {
    const fileKey = new Uint8Array(32).fill(0x42);
    const perms = generatePermsEntry(fileKey, -3904, true);

    const isValid = verifyPermsEntry(fileKey, perms, -3904, false);

    expect(isValid).toBe(false);
  });
});

describe("verifyPermsEntry", () => {
  it("should detect tampered 'adb' constant", () => {
    const fileKey = new Uint8Array(32).fill(0x42);

    // Create a valid-looking but actually invalid Perms
    // (this won't decrypt to have 'adb' at bytes 9-11)
    const fakePerms = new Uint8Array(16).fill(0x99);

    const isValid = verifyPermsEntry(fileKey, fakePerms, -3904, true);

    expect(isValid).toBe(false);
  });
});

/**
 * Full encryption/decryption round-trip tests
 */
describe("full round-trip tests", () => {
  it("should complete full R5 encryption setup and verification", () => {
    const userPassword = new TextEncoder().encode("user123");
    const ownerPassword = new TextEncoder().encode("owner456");
    const fileKey = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      fileKey[i] = i * 8;
    }

    const revision = 5;

    // Generate all encryption dictionary entries
    const { u, ue } = generateUserEntries(userPassword, fileKey, revision);
    const { o, oe } = generateOwnerEntries(ownerPassword, fileKey, u, revision);

    // Verify user password
    const userResult = verifyUserPasswordR56(userPassword, u, ue, revision);
    expect(userResult.isValid).toBe(true);
    expect(userResult.encryptionKey).toEqual(fileKey);

    // Verify owner password
    const ownerResult = verifyOwnerPasswordR56(ownerPassword, o, oe, u, revision);
    expect(ownerResult.isValid).toBe(true);
    expect(ownerResult.encryptionKey).toEqual(fileKey);

    // Both should recover the same file key
    expect(userResult.encryptionKey).toEqual(ownerResult.encryptionKey);
  });

  it("should complete full R6 encryption setup and verification", () => {
    const userPassword = new TextEncoder().encode("SecureUser!");
    const ownerPassword = new TextEncoder().encode("EvenMoreSecureOwner!");
    const fileKey = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      fileKey[i] = 0xff - i;
    }

    const revision = 6;
    const permissions = -3904;
    const encryptMetadata = true;

    // Generate all encryption dictionary entries
    const { u, ue } = generateUserEntries(userPassword, fileKey, revision);
    const { o, oe } = generateOwnerEntries(ownerPassword, fileKey, u, revision);
    const perms = generatePermsEntry(fileKey, permissions, encryptMetadata);

    // Verify user password
    const userResult = verifyUserPasswordR56(userPassword, u, ue, revision);
    expect(userResult.isValid).toBe(true);

    // Verify owner password
    const ownerResult = verifyOwnerPasswordR56(ownerPassword, o, oe, u, revision);
    expect(ownerResult.isValid).toBe(true);

    // Verify Perms entry
    const permsValid = verifyPermsEntry(fileKey, perms, permissions, encryptMetadata);
    expect(permsValid).toBe(true);

    // All should recover the same file key
    expect(userResult.encryptionKey).toEqual(fileKey);
    expect(ownerResult.encryptionKey).toEqual(fileKey);
  });
});
