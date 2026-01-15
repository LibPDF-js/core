/**
 * SHA-based key derivation for PDF encryption revisions R5-R6.
 *
 * PDF 2.0 uses SHA-256/384/512 for key derivation, which is significantly
 * more secure than the MD5-based approach in R2-R4.
 *
 * R5 was an interim specification (Adobe Extension Level 3).
 * R6 is the final PDF 2.0 specification (ISO 32000-2).
 *
 * @see PDF 2.0 Specification (ISO 32000-2), Section 7.6.4.3.3 (Algorithm 2.A)
 * @see PDF 2.0 Specification (ISO 32000-2), Section 7.6.4.3.4 (Algorithm 2.B)
 */

import { SINGLE_BYTE_MASK } from "#src/helpers/chars";
import { randomBytes } from "@noble/ciphers/utils.js";
import { sha256, sha384, sha512 } from "@noble/hashes/sha2.js";

import { aesDecryptWithIv, aesEcbDecrypt, aesEcbEncrypt, aesEncryptWithIv } from "../ciphers/aes";

/** Maximum password length for R5-R6 (UTF-8 bytes) */
export const MAX_PASSWORD_LENGTH = 127;

/**
 * Truncate password to maximum allowed length for R5-R6.
 *
 * Per the PDF 2.0 spec, passwords are UTF-8 encoded and truncated to 127 bytes.
 *
 * @param password - UTF-8 encoded password bytes
 * @returns Password truncated to max 127 bytes
 */
export function truncatePassword(password: Uint8Array): Uint8Array {
  if (password.length <= MAX_PASSWORD_LENGTH) {
    return password;
  }

  return password.subarray(0, MAX_PASSWORD_LENGTH);
}

/**
 * Algorithm 2.A - Compute hash for password validation (R5).
 *
 * This is the simpler algorithm used in revision 5.
 *
 * @param password - UTF-8 encoded password (will be truncated to 127 bytes)
 * @param salt - 8-byte validation salt from U or O entry
 * @param userKey - 48-byte user key (U[0:48]) for owner password, or undefined for user
 * @returns 32-byte hash
 */
export function computeHash2A(
  password: Uint8Array,
  salt: Uint8Array,
  userKey?: Uint8Array,
): Uint8Array {
  const truncatedPassword = truncatePassword(password);

  // Build hash input: password + salt + userKey (if owner password)
  const inputLength = truncatedPassword.length + salt.length + (userKey?.length ?? 0);
  const input = new Uint8Array(inputLength);

  let offset = 0;
  input.set(truncatedPassword, offset);
  offset += truncatedPassword.length;
  input.set(salt, offset);
  offset += salt.length;

  if (userKey) {
    input.set(userKey, offset);
  }

  return sha256(input);
}

/**
 * Algorithm 2.B - Compute hash for password validation (R6).
 *
 * This is the more complex iterative algorithm from PDF 2.0 (ISO 32000-2).
 * It uses a loop with dynamic hash selection based on AES-CBC output.
 *
 * @param password - UTF-8 encoded password (will be truncated to 127 bytes)
 * @param salt - 8-byte validation salt from U or O entry
 * @param userKey - 48-byte user key (U[0:48]) for owner password, or undefined for user
 * @returns 32-byte hash
 */
export function computeHash2B(
  password: Uint8Array,
  salt: Uint8Array,
  userKey?: Uint8Array,
): Uint8Array {
  const truncatedPassword = truncatePassword(password);
  const userKeyData = userKey ?? new Uint8Array(0);

  // Step a: Compute initial hash K
  const initialInput = new Uint8Array(truncatedPassword.length + salt.length + userKeyData.length);
  let offset = 0;
  initialInput.set(truncatedPassword, offset);
  offset += truncatedPassword.length;
  initialInput.set(salt, offset);
  offset += salt.length;
  if (userKey) {
    initialInput.set(userKeyData, offset);
  }

  let k = sha256(initialInput);

  // Step b: Iterative hashing loop
  let round = 0;

  while (true) {
    // Build K1 = sequence of 64 copies of (password + K + userKey)
    const sequenceUnit = new Uint8Array(truncatedPassword.length + k.length + userKeyData.length);
    offset = 0;
    sequenceUnit.set(truncatedPassword, offset);
    offset += truncatedPassword.length;
    sequenceUnit.set(k, offset);
    offset += k.length;
    sequenceUnit.set(userKeyData, offset);

    // Repeat 64 times
    const k1 = new Uint8Array(sequenceUnit.length * 64);

    for (let i = 0; i < 64; i++) {
      k1.set(sequenceUnit, i * sequenceUnit.length);
    }

    // Encrypt K1 with AES-128-CBC using first 16 bytes of K as key,
    // second 16 bytes as IV
    const aesKey = k.subarray(0, 16);
    const aesIv = k.subarray(16, 32);
    const e = aesEncryptWithIv(aesKey, aesIv, k1, true); // No padding

    // Sum first 16 bytes of E mod 3 to determine hash algorithm
    // Using BigInt for safe large number handling
    let sum = 0n;

    for (let i = 0; i < 16; i++) {
      sum += BigInt(e[i]);
    }

    const hashSelector = Number(sum % 3n);

    // Apply selected hash
    switch (hashSelector) {
      case 0:
        k = sha256(e);
        break;
      case 1:
        k = sha384(e);
        break;
      case 2:
        k = sha512(e);
        break;
    }

    // Loop termination: at least 64 rounds, then check last byte of E
    round++;
    const lastByte = e[e.length - 1];

    if (round >= 64 && lastByte <= round - 32) {
      break;
    }
  }

  // Return first 32 bytes of final K
  return k.subarray(0, 32);
}

/**
 * Compute the hash for password validation based on revision.
 *
 * @param password - UTF-8 encoded password
 * @param salt - 8-byte validation salt
 * @param userKey - User key for owner password validation
 * @param revision - Encryption revision (5 or 6)
 * @returns 32-byte hash
 */
export function computeHashForRevision(
  password: Uint8Array,
  salt: Uint8Array,
  userKey: Uint8Array | undefined,
  revision: number,
): Uint8Array {
  if (revision === 5) {
    return computeHash2A(password, salt, userKey);
  } else {
    // R6 uses Algorithm 2.B
    return computeHash2B(password, salt, userKey);
  }
}

/**
 * Verify user password for R5-R6 encryption.
 *
 * @param password - Password to verify (UTF-8 encoded)
 * @param userEntry - 48-byte /U entry from encryption dictionary
 * @param userEncryptionKey - 32-byte /UE entry
 * @param revision - Encryption revision (5 or 6)
 * @returns Object with isValid flag and encryptionKey if valid
 */
export function verifyUserPasswordR56(
  password: Uint8Array,
  userEntry: Uint8Array,
  userEncryptionKey: Uint8Array,
  revision: number,
): { isValid: boolean; encryptionKey: Uint8Array | null } {
  // Extract components from U entry
  // U[0:32] = hash, U[32:40] = validation salt, U[40:48] = key salt
  const storedHash = userEntry.subarray(0, 32);
  const validationSalt = userEntry.subarray(32, 40);
  const keySalt = userEntry.subarray(40, 48);

  // Compute hash with validation salt (no user key for user password)
  const computedHash = computeHashForRevision(password, validationSalt, undefined, revision);

  // Compare hashes
  if (!constantTimeCompare(computedHash, storedHash)) {
    return { isValid: false, encryptionKey: null };
  }

  // Password is valid - derive the encryption key
  // Hash with key salt to get the key encryption key
  const keyEncryptionKey = computeHashForRevision(password, keySalt, undefined, revision);

  // Decrypt UE to get the file encryption key
  const encryptionKey = decryptEncryptionKey(keyEncryptionKey, userEncryptionKey);

  return { isValid: true, encryptionKey };
}

/**
 * Verify owner password for R5-R6 encryption.
 *
 * @param password - Password to verify (UTF-8 encoded)
 * @param ownerEntry - 48-byte /O entry from encryption dictionary
 * @param ownerEncryptionKey - 32-byte /OE entry
 * @param userEntry - 48-byte /U entry (first 48 bytes used in hash)
 * @param revision - Encryption revision (5 or 6)
 * @returns Object with isValid flag and encryptionKey if valid
 */
export function verifyOwnerPasswordR56(
  password: Uint8Array,
  ownerEntry: Uint8Array,
  ownerEncryptionKey: Uint8Array,
  userEntry: Uint8Array,
  revision: number,
): { isValid: boolean; encryptionKey: Uint8Array | null } {
  // Extract components from O entry
  const storedHash = ownerEntry.subarray(0, 32);
  const validationSalt = ownerEntry.subarray(32, 40);
  const keySalt = ownerEntry.subarray(40, 48);

  // For owner password, include U[0:48] in the hash
  const userKey = userEntry.subarray(0, 48);

  // Compute hash with validation salt and user key
  const computedHash = computeHashForRevision(password, validationSalt, userKey, revision);

  // Compare hashes
  if (!constantTimeCompare(computedHash, storedHash)) {
    return { isValid: false, encryptionKey: null };
  }

  // Password is valid - derive the encryption key
  const keyEncryptionKey = computeHashForRevision(password, keySalt, userKey, revision);

  // Decrypt OE to get the file encryption key
  const encryptionKey = decryptEncryptionKey(keyEncryptionKey, ownerEncryptionKey);

  return { isValid: true, encryptionKey };
}

/**
 * Decrypt the file encryption key from UE or OE.
 *
 * Uses AES-256-CBC with zero IV.
 *
 * @param keyEncryptionKey - 32-byte key derived from password
 * @param encryptedKey - 32-byte encrypted file key (UE or OE)
 * @returns 32-byte file encryption key
 */
function decryptEncryptionKey(keyEncryptionKey: Uint8Array, encryptedKey: Uint8Array): Uint8Array {
  const zeroIv = new Uint8Array(16);

  return aesDecryptWithIv(keyEncryptionKey, zeroIv, encryptedKey, true);
}

/**
 * Generate user password entries (/U and /UE) for encryption.
 *
 * @param password - User password (UTF-8 encoded)
 * @param fileEncryptionKey - 32-byte file encryption key
 * @param revision - Encryption revision (5 or 6)
 * @returns Object with U (48 bytes) and UE (32 bytes)
 */
export function generateUserEntries(
  password: Uint8Array,
  fileEncryptionKey: Uint8Array,
  revision: number,
): { u: Uint8Array; ue: Uint8Array } {
  // Generate random salts
  const validationSalt = randomBytes(8);
  const keySalt = randomBytes(8);

  // Compute hash for U[0:32]
  const hash = computeHashForRevision(password, validationSalt, undefined, revision);

  // Build U entry: hash (32) + validation salt (8) + key salt (8)
  const u = new Uint8Array(48);
  u.set(hash, 0);
  u.set(validationSalt, 32);
  u.set(keySalt, 40);

  // Compute key encryption key and encrypt file key for UE
  const keyEncryptionKey = computeHashForRevision(password, keySalt, undefined, revision);
  const zeroIv = new Uint8Array(16);
  const ue = aesEncryptWithIv(keyEncryptionKey, zeroIv, fileEncryptionKey, true);

  return { u, ue };
}

/**
 * Generate owner password entries (/O and /OE) for encryption.
 *
 * @param password - Owner password (UTF-8 encoded)
 * @param fileEncryptionKey - 32-byte file encryption key
 * @param userEntry - 48-byte U entry (needed for hash computation)
 * @param revision - Encryption revision (5 or 6)
 * @returns Object with O (48 bytes) and OE (32 bytes)
 */
export function generateOwnerEntries(
  password: Uint8Array,
  fileEncryptionKey: Uint8Array,
  userEntry: Uint8Array,
  revision: number,
): { o: Uint8Array; oe: Uint8Array } {
  // Generate random salts
  const validationSalt = randomBytes(8);
  const keySalt = randomBytes(8);

  // For owner, include U[0:48] in hash
  const userKey = userEntry.subarray(0, 48);

  // Compute hash for O[0:32]
  const hash = computeHashForRevision(password, validationSalt, userKey, revision);

  // Build O entry: hash (32) + validation salt (8) + key salt (8)
  const o = new Uint8Array(48);
  o.set(hash, 0);
  o.set(validationSalt, 32);
  o.set(keySalt, 40);

  // Compute key encryption key and encrypt file key for OE
  const keyEncryptionKey = computeHashForRevision(password, keySalt, userKey, revision);
  const zeroIv = new Uint8Array(16);
  const oe = aesEncryptWithIv(keyEncryptionKey, zeroIv, fileEncryptionKey, true);

  return { o, oe };
}

/**
 * Generate the /Perms entry for R6 encryption.
 *
 * The Perms entry validates that permissions haven't been tampered with.
 *
 * @param fileEncryptionKey - 32-byte file encryption key
 * @param permissions - Permission flags
 * @param encryptMetadata - Whether metadata is encrypted
 * @returns 16-byte encrypted Perms entry
 */
export function generatePermsEntry(
  fileEncryptionKey: Uint8Array,
  permissions: number,
  encryptMetadata: boolean,
): Uint8Array {
  // Build 16-byte plaintext:
  // Bytes 0-3: permissions (little-endian)
  // Bytes 4-7: 0xFFFFFFFF
  // Byte 8: 'T' if encryptMetadata, 'F' otherwise
  // Bytes 9-11: 'adb'
  // Bytes 12-15: random
  const perms = new Uint8Array(16);

  // Permissions (little-endian)
  perms[0] = permissions & SINGLE_BYTE_MASK;
  perms[1] = (permissions >> 8) & SINGLE_BYTE_MASK;
  perms[2] = (permissions >> 16) & SINGLE_BYTE_MASK;
  perms[3] = (permissions >> 24) & SINGLE_BYTE_MASK;

  // 0xFFFFFFFF
  perms[4] = 0xff;
  perms[5] = 0xff;
  perms[6] = 0xff;
  perms[7] = 0xff;

  // EncryptMetadata flag
  perms[8] = encryptMetadata ? 0x54 : 0x46; // 'T' or 'F'

  // 'adb' constant
  perms[9] = 0x61; // 'a'
  perms[10] = 0x64; // 'd'
  perms[11] = 0x62; // 'b'

  // Random bytes 12-15
  const random = randomBytes(4);
  perms.set(random, 12);

  // Encrypt with AES-256-ECB
  return aesEcbEncrypt(fileEncryptionKey, perms);
}

/**
 * Verify the /Perms entry for R6 encryption.
 *
 * @param fileEncryptionKey - 32-byte file encryption key
 * @param permsEntry - 16-byte encrypted Perms entry
 * @param expectedPermissions - Expected permission flags
 * @param expectedEncryptMetadata - Expected encryptMetadata value
 * @returns true if Perms is valid
 */
export function verifyPermsEntry(
  fileEncryptionKey: Uint8Array,
  permsEntry: Uint8Array,
  expectedPermissions: number,
  expectedEncryptMetadata: boolean,
): boolean {
  // Decrypt with AES-256-ECB
  const decrypted = aesEcbDecrypt(fileEncryptionKey, permsEntry);

  // Check 'adb' constant at bytes 9-11
  if (decrypted[9] !== 0x61 || decrypted[10] !== 0x64 || decrypted[11] !== 0x62) {
    return false;
  }

  // Check permissions (bytes 0-3, little-endian)
  const perms = decrypted[0] | (decrypted[1] << 8) | (decrypted[2] << 16) | (decrypted[3] << 24);

  if (perms !== expectedPermissions) {
    return false;
  }

  // Check encryptMetadata (byte 8)
  const encryptMeta = decrypted[8] === 0x54; // 'T'

  if (encryptMeta !== expectedEncryptMetadata) {
    return false;
  }

  return true;
}

/**
 * Constant-time comparison to prevent timing attacks.
 */
function constantTimeCompare(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }

  return result === 0;
}
