import { describe, expect, it } from "vitest";

import { aesEncrypt } from "./ciphers/aes";
import { RC4Cipher } from "./ciphers/rc4";
import type { EncryptionDict } from "./encryption-dict";
import {
  computeEncryptionKeyR2R4,
  computeOwnerHash,
  computeUserHash,
  deriveObjectKey,
} from "./key-derivation/md5-based";
import {
  generateOwnerEntries,
  generatePermsEntry,
  generateUserEntries,
} from "./key-derivation/sha-based";
import { DEFAULT_PERMISSIONS, encodePermissions, type Permissions } from "./permissions";
import { StandardSecurityHandler, tryEmptyPassword } from "./standard-handler";

/**
 * Create a complete R3 encryption setup for testing.
 */
function createR3Setup(
  userPassword: string,
  ownerPassword: string,
  permissions: Permissions = DEFAULT_PERMISSIONS,
) {
  const userPwd = new TextEncoder().encode(userPassword);
  const ownerPwd = new TextEncoder().encode(ownerPassword);
  const fileId = new Uint8Array(32);

  for (let i = 0; i < 32; i++) {
    fileId[i] = i;
  }

  const keyLength = 16; // 128-bit
  const revision = 3;
  const permissionsRaw = encodePermissions(permissions);

  // Generate encryption dictionary values
  const ownerHash = computeOwnerHash(ownerPwd, userPwd, keyLength, revision);
  const encryptionKey = computeEncryptionKeyR2R4(
    userPwd,
    ownerHash,
    permissionsRaw,
    fileId,
    keyLength,
    revision,
  );
  const userHash = computeUserHash(encryptionKey, fileId, revision);

  const encryptDict: EncryptionDict = {
    filter: "Standard",
    version: 2,
    revision: 3,
    keyLengthBits: 128,
    ownerHash,
    userHash,
    permissions,
    permissionsRaw,
    encryptMetadata: true,
    algorithm: "RC4",
  };

  return { encryptDict, fileId, encryptionKey, userPwd, ownerPwd };
}

/**
 * Create a complete R4 (AES-128) encryption setup for testing.
 */
function createR4Setup(
  userPassword: string,
  ownerPassword: string,
  permissions: Permissions = DEFAULT_PERMISSIONS,
) {
  const userPwd = new TextEncoder().encode(userPassword);
  const ownerPwd = new TextEncoder().encode(ownerPassword);
  const fileId = new Uint8Array(32);

  for (let i = 0; i < 32; i++) {
    fileId[i] = i;
  }

  const keyLength = 16; // 128-bit
  const revision = 4;
  const permissionsRaw = encodePermissions(permissions);

  // Generate encryption dictionary values
  const ownerHash = computeOwnerHash(ownerPwd, userPwd, keyLength, revision);
  const encryptionKey = computeEncryptionKeyR2R4(
    userPwd,
    ownerHash,
    permissionsRaw,
    fileId,
    keyLength,
    revision,
  );
  const userHash = computeUserHash(encryptionKey, fileId, revision);

  const encryptDict: EncryptionDict = {
    filter: "Standard",
    version: 4,
    revision: 4,
    keyLengthBits: 128,
    ownerHash,
    userHash,
    permissions,
    permissionsRaw,
    encryptMetadata: true,
    algorithm: "AES-128",
  };

  return { encryptDict, fileId, encryptionKey, userPwd, ownerPwd };
}

/**
 * Create a complete R6 (AES-256) encryption setup for testing.
 */
function createR6Setup(
  userPassword: string,
  ownerPassword: string,
  permissions: Permissions = DEFAULT_PERMISSIONS,
) {
  const userPwd = new TextEncoder().encode(userPassword);
  const ownerPwd = new TextEncoder().encode(ownerPassword);
  const fileId = new Uint8Array(32);

  for (let i = 0; i < 32; i++) {
    fileId[i] = i;
  }

  const permissionsRaw = encodePermissions(permissions);

  // Generate a random 256-bit file key
  const fileKey = new Uint8Array(32);

  for (let i = 0; i < 32; i++) {
    fileKey[i] = (i * 17) % 256;
  }

  const revision = 6;

  // Generate encryption dictionary entries
  const { u: userHash, ue: userEncryptionKey } = generateUserEntries(userPwd, fileKey, revision);
  const { o: ownerHash, oe: ownerEncryptionKey } = generateOwnerEntries(
    ownerPwd,
    fileKey,
    userHash,
    revision,
  );
  const permsValue = generatePermsEntry(fileKey, permissionsRaw, true);

  const encryptDict: EncryptionDict = {
    filter: "Standard",
    version: 5,
    revision: 6,
    keyLengthBits: 256,
    ownerHash,
    userHash,
    permissions,
    permissionsRaw,
    encryptMetadata: true,
    ownerEncryptionKey,
    userEncryptionKey,
    permsValue,
    algorithm: "AES-256",
  };

  return { encryptDict, fileId, fileKey, userPwd, ownerPwd };
}

describe("StandardSecurityHandler", () => {
  describe("R3 (RC4-128)", () => {
    it("should authenticate with correct user password", () => {
      const { encryptDict, fileId, userPwd } = createR3Setup("user123", "owner456");
      const handler = new StandardSecurityHandler(encryptDict, fileId);

      const result = handler.authenticate(userPwd);

      expect(result.authenticated).toBe(true);
      expect(result.passwordType).toBe("user");
      expect(result.isOwner).toBe(false);
      expect(handler.isAuthenticated).toBe(true);
    });

    it("should authenticate with correct owner password", () => {
      const { encryptDict, fileId, ownerPwd } = createR3Setup("user123", "owner456");
      const handler = new StandardSecurityHandler(encryptDict, fileId);

      const result = handler.authenticate(ownerPwd);

      expect(result.authenticated).toBe(true);
      expect(result.passwordType).toBe("owner");
      expect(result.isOwner).toBe(true);
      expect(handler.hasOwnerAccess).toBe(true);
    });

    it("should reject incorrect password", () => {
      const { encryptDict, fileId } = createR3Setup("user123", "owner456");
      const handler = new StandardSecurityHandler(encryptDict, fileId);

      const result = handler.authenticate(new TextEncoder().encode("wrong"));

      expect(result.authenticated).toBe(false);
      expect(handler.isAuthenticated).toBe(false);
    });

    it("should authenticate with empty password when set", () => {
      const { encryptDict, fileId } = createR3Setup("", "owner456");
      const handler = new StandardSecurityHandler(encryptDict, fileId);

      const result = tryEmptyPassword(handler);

      expect(result.authenticated).toBe(true);
      expect(result.passwordType).toBe("user");
    });

    it("should decrypt string correctly", () => {
      const { encryptDict, fileId, encryptionKey } = createR3Setup("user123", "owner456");
      const handler = new StandardSecurityHandler(encryptDict, fileId);
      handler.authenticate(new TextEncoder().encode("user123"));

      // Encrypt some test data
      const plaintext = new TextEncoder().encode("Hello, PDF!");
      const objectKey = deriveObjectKey(encryptionKey, 1, 0, false);
      const cipher = new RC4Cipher(objectKey);
      const encrypted = cipher.process(plaintext);

      // Decrypt it
      const decrypted = handler.decryptString(encrypted, 1, 0);

      expect(new TextDecoder().decode(decrypted)).toBe("Hello, PDF!");
    });
  });

  describe("R4 (AES-128)", () => {
    it("should authenticate with correct user password", () => {
      const { encryptDict, fileId, userPwd } = createR4Setup("user123", "owner456");
      const handler = new StandardSecurityHandler(encryptDict, fileId);

      const result = handler.authenticate(userPwd);

      expect(result.authenticated).toBe(true);
      expect(result.passwordType).toBe("user");
    });

    it("should decrypt stream correctly with AES", () => {
      const { encryptDict, fileId, encryptionKey } = createR4Setup("user123", "owner456");
      const handler = new StandardSecurityHandler(encryptDict, fileId);
      handler.authenticate(new TextEncoder().encode("user123"));

      // Encrypt some test data using AES
      const plaintext = new TextEncoder().encode("AES encrypted data");
      const objectKey = deriveObjectKey(encryptionKey, 5, 0, true);
      const encrypted = aesEncrypt(objectKey, plaintext);

      // Decrypt it
      const decrypted = handler.decryptStream(encrypted, 5, 0);

      expect(new TextDecoder().decode(decrypted)).toBe("AES encrypted data");
    });
  });

  describe("R6 (AES-256)", () => {
    it("should authenticate with correct user password", () => {
      const { encryptDict, fileId, userPwd } = createR6Setup("SecureUser!", "SecureOwner!");
      const handler = new StandardSecurityHandler(encryptDict, fileId);

      const result = handler.authenticate(userPwd);

      expect(result.authenticated).toBe(true);
      expect(result.passwordType).toBe("user");
      expect(result.isOwner).toBe(false);
    });

    it("should authenticate with correct owner password", () => {
      const { encryptDict, fileId, ownerPwd } = createR6Setup("SecureUser!", "SecureOwner!");
      const handler = new StandardSecurityHandler(encryptDict, fileId);

      const result = handler.authenticate(ownerPwd);

      expect(result.authenticated).toBe(true);
      expect(result.passwordType).toBe("owner");
      expect(result.isOwner).toBe(true);
    });

    it("should reject incorrect password", () => {
      const { encryptDict, fileId } = createR6Setup("SecureUser!", "SecureOwner!");
      const handler = new StandardSecurityHandler(encryptDict, fileId);

      const result = handler.authenticate(new TextEncoder().encode("WrongPassword"));

      expect(result.authenticated).toBe(false);
    });

    it("should decrypt data correctly with AES-256", () => {
      const { encryptDict, fileId, fileKey } = createR6Setup("SecureUser!", "SecureOwner!");
      const handler = new StandardSecurityHandler(encryptDict, fileId);
      handler.authenticate(new TextEncoder().encode("SecureUser!"));

      // Encrypt some test data using AES-256
      const plaintext = new TextEncoder().encode("AES-256 encrypted content");
      const encrypted = aesEncrypt(fileKey, plaintext);

      // Decrypt it (R6 uses file key directly, not object-specific keys)
      const decrypted = handler.decryptString(encrypted, 10, 0);

      expect(new TextDecoder().decode(decrypted)).toBe("AES-256 encrypted content");
    });
  });

  describe("convenience methods", () => {
    it("should authenticate with string password", () => {
      const { encryptDict, fileId } = createR3Setup("user123", "owner456");
      const handler = new StandardSecurityHandler(encryptDict, fileId);

      const result = handler.authenticateWithString("user123");

      expect(result.authenticated).toBe(true);
    });

    it("should expose encryption properties", () => {
      const permissions: Permissions = {
        print: true,
        printHighQuality: false,
        modify: false,
        copy: true,
        annotate: false,
        fillForms: true,
        accessibility: true,
        assemble: false,
      };
      const { encryptDict, fileId } = createR3Setup("user", "owner", permissions);
      const handler = new StandardSecurityHandler(encryptDict, fileId);

      expect(handler.version).toBe(2);
      expect(handler.revision).toBe(3);
      expect(handler.permissions).toEqual(permissions);
      expect(handler.encryption).toBe(encryptDict);
    });
  });

  describe("shouldEncryptStream", () => {
    it("should return false for XRef streams", () => {
      const { encryptDict, fileId } = createR3Setup("user", "owner");
      const handler = new StandardSecurityHandler(encryptDict, fileId);

      expect(handler.shouldEncryptStream("XRef")).toBe(false);
    });

    it("should return false for Metadata when EncryptMetadata is false", () => {
      const { encryptDict, fileId } = createR3Setup("user", "owner");
      encryptDict.encryptMetadata = false;
      const handler = new StandardSecurityHandler(encryptDict, fileId);

      expect(handler.shouldEncryptStream("Metadata")).toBe(false);
    });

    it("should return true for Metadata when EncryptMetadata is true", () => {
      const { encryptDict, fileId } = createR3Setup("user", "owner");
      encryptDict.encryptMetadata = true;
      const handler = new StandardSecurityHandler(encryptDict, fileId);

      expect(handler.shouldEncryptStream("Metadata")).toBe(true);
    });

    it("should return true for normal streams", () => {
      const { encryptDict, fileId } = createR3Setup("user", "owner");
      const handler = new StandardSecurityHandler(encryptDict, fileId);

      expect(handler.shouldEncryptStream("Page")).toBe(true);
      expect(handler.shouldEncryptStream(undefined)).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should throw when decrypting without authentication", () => {
      const { encryptDict, fileId } = createR3Setup("user", "owner");
      const handler = new StandardSecurityHandler(encryptDict, fileId);

      expect(() => handler.decryptString(new Uint8Array(10), 1, 0)).toThrow("Not authenticated");
      expect(() => handler.decryptStream(new Uint8Array(10), 1, 0)).toThrow("Not authenticated");
    });
  });

  describe("Identity filter handling", () => {
    it("should pass through strings when stringFilter is Identity", () => {
      const { encryptDict, fileId, userPwd } = createR4Setup("user", "owner");
      encryptDict.stringFilter = "Identity";
      const handler = new StandardSecurityHandler(encryptDict, fileId);
      handler.authenticate(userPwd);

      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const result = handler.decryptString(data, 1, 0);

      // Should return same reference (no decryption)
      expect(result).toBe(data);
    });

    it("should pass through streams when streamFilter is Identity", () => {
      const { encryptDict, fileId, userPwd } = createR4Setup("user", "owner");
      encryptDict.streamFilter = "Identity";
      const handler = new StandardSecurityHandler(encryptDict, fileId);
      handler.authenticate(userPwd);

      const data = new Uint8Array([10, 20, 30, 40, 50]);
      const result = handler.decryptStream(data, 1, 0);

      // Should return same reference (no decryption)
      expect(result).toBe(data);
    });
  });
});

describe("tryEmptyPassword", () => {
  it("should succeed for documents with empty user password", () => {
    const { encryptDict, fileId } = createR3Setup("", "owner123");
    const handler = new StandardSecurityHandler(encryptDict, fileId);

    const result = tryEmptyPassword(handler);

    expect(result.authenticated).toBe(true);
    expect(result.passwordType).toBe("user");
  });

  it("should fail for documents requiring password", () => {
    const { encryptDict, fileId } = createR3Setup("required", "owner123");
    const handler = new StandardSecurityHandler(encryptDict, fileId);

    const result = tryEmptyPassword(handler);

    expect(result.authenticated).toBe(false);
  });
});
