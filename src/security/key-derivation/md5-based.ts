/**
 * MD5-based key derivation for PDF encryption revisions R2-R4.
 *
 * These older encryption revisions use MD5 for all key derivation operations.
 * While cryptographically weak by modern standards, this is required for
 * compatibility with encrypted PDFs created before PDF 2.0.
 *
 * @see PDF 1.7 Specification, Section 7.6.3.3 (Algorithm 2)
 * @see PDF 1.7 Specification, Section 7.6.3.4 (Algorithm 3 - Owner password)
 */

import { SINGLE_BYTE_MASK } from "#src/helpers/chars";
import { md5 } from "@noble/hashes/legacy.js";

import { RC4Cipher } from "../ciphers/rc4";

/**
 * Standard 32-byte padding used for password operations.
 * This is defined in PDF spec 7.6.3.3 as the default password padding.
 */
export const PASSWORD_PADDING = new Uint8Array([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
  0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
]);

/**
 * Pad or truncate a password to exactly 32 bytes using standard PDF padding.
 *
 * - If password is shorter than 32 bytes, append padding bytes
 * - If password is 32 or more bytes, truncate to 32 bytes
 * - Empty password is valid (results in just the padding)
 *
 * @param password - User-provided password (UTF-8 encoded for R2-R4)
 * @returns Exactly 32 bytes
 */
export function padPassword(password: Uint8Array): Uint8Array {
  const padded = new Uint8Array(32);

  if (password.length >= 32) {
    // Truncate to 32 bytes
    padded.set(password.subarray(0, 32));
  } else {
    // Copy password and pad with standard padding
    padded.set(password);
    padded.set(PASSWORD_PADDING.subarray(0, 32 - password.length), password.length);
  }

  return padded;
}

/**
 * Compute the encryption key from a password (Algorithm 2).
 *
 * This is the core key derivation for R2-R4 encryption.
 *
 * @param password - User password (will be padded to 32 bytes)
 * @param ownerHash - 32-byte /O value from encryption dictionary
 * @param permissions - Permission flags (signed 32-bit integer)
 * @param fileId - First element of /ID array (document identifier)
 * @param keyLengthBytes - Desired key length in bytes (5 for 40-bit, 16 for 128-bit)
 * @param revision - Encryption revision (2, 3, or 4)
 * @param encryptMetadata - Whether metadata is encrypted (only affects R4)
 * @returns Encryption key of specified length
 */
export function computeEncryptionKeyR2R4(
  password: Uint8Array,
  ownerHash: Uint8Array,
  permissions: number,
  fileId: Uint8Array,
  keyLengthBytes: number,
  revision: number,
  encryptMetadata = true,
): Uint8Array {
  // Step a: Pad password to 32 bytes
  const paddedPassword = padPassword(password);

  // Calculate total length for the hash input
  // 32 (password) + 32 (O) + 4 (P) + fileId.length + optional 4 (encryptMetadata flag)
  const extraBytes = revision >= 4 && !encryptMetadata ? 4 : 0;
  const hashInput = new Uint8Array(32 + 32 + 4 + fileId.length + extraBytes);

  let offset = 0;

  // Step b: Append O value
  hashInput.set(paddedPassword, offset);
  offset += 32;
  hashInput.set(ownerHash, offset);
  offset += 32;

  // Step c: Append P value (4 bytes, little-endian)
  hashInput[offset++] = permissions & SINGLE_BYTE_MASK;
  hashInput[offset++] = (permissions >> 8) & SINGLE_BYTE_MASK;
  hashInput[offset++] = (permissions >> 16) & SINGLE_BYTE_MASK;
  hashInput[offset++] = (permissions >> 24) & SINGLE_BYTE_MASK;

  // Step d: Append first element of file ID
  hashInput.set(fileId, offset);
  offset += fileId.length;

  // Step e: If R >= 4 and metadata is not encrypted, append 4 bytes of 0xFF
  if (revision >= 4 && !encryptMetadata) {
    hashInput[offset++] = 0xff;
    hashInput[offset++] = 0xff;
    hashInput[offset++] = 0xff;
    hashInput[offset++] = 0xff;
  }

  // Step f: Hash with MD5
  let hash = md5(hashInput);

  // Step g: For R >= 3, do 50 iterations of MD5 on the first n bytes
  if (revision >= 3) {
    for (let i = 0; i < 50; i++) {
      hash = md5(hash.subarray(0, keyLengthBytes));
    }
  }

  // Step h: Return first n bytes as the encryption key
  return hash.subarray(0, keyLengthBytes);
}

/**
 * Compute the owner password hash /O value (Algorithm 3).
 *
 * The /O value is used to verify the owner password and to allow
 * recovery of the user password encryption key.
 *
 * @param ownerPassword - Owner password (or user password if owner is empty)
 * @param userPassword - User password
 * @param keyLengthBytes - Key length in bytes
 * @param revision - Encryption revision (2, 3, or 4)
 * @returns 32-byte owner hash for /O entry
 */
export function computeOwnerHash(
  ownerPassword: Uint8Array,
  userPassword: Uint8Array,
  keyLengthBytes: number,
  revision: number,
): Uint8Array {
  // Step a: Pad owner password (use user password if owner is empty)
  const password = ownerPassword.length > 0 ? ownerPassword : userPassword;
  const paddedOwner = padPassword(password);

  // Step b: Hash with MD5
  let hash = md5(paddedOwner);

  // Step c: For R >= 3, do 50 iterations
  if (revision >= 3) {
    for (let i = 0; i < 50; i++) {
      hash = md5(hash);
    }
  }

  // Step d: Use first n bytes as RC4 key
  const rc4Key = hash.subarray(0, keyLengthBytes);

  // Step e: Pad user password
  const paddedUser = padPassword(userPassword);

  // Step f: Encrypt padded user password with RC4
  // For R2: single RC4 encryption
  // For R3+: 20 iterations with modified keys
  let encrypted: Uint8Array = new Uint8Array(paddedUser);

  if (revision === 2) {
    const cipher = new RC4Cipher(rc4Key);
    encrypted = cipher.process(encrypted);
  } else {
    // R3+: 20 iterations with XOR'd keys
    for (let i = 0; i < 20; i++) {
      const iterKey = new Uint8Array(keyLengthBytes);

      for (let j = 0; j < keyLengthBytes; j++) {
        iterKey[j] = rc4Key[j] ^ i;
      }

      const cipher = new RC4Cipher(iterKey);
      encrypted = cipher.process(encrypted);
    }
  }

  return encrypted;
}

/**
 * Compute the user password hash /U value (Algorithm 4/5).
 *
 * @param encryptionKey - The encryption key from computeEncryptionKeyR2R4
 * @param fileId - First element of /ID array
 * @param revision - Encryption revision (2, 3, or 4)
 * @returns 32-byte user hash for /U entry
 */
export function computeUserHash(
  encryptionKey: Uint8Array,
  fileId: Uint8Array,
  revision: number,
): Uint8Array {
  if (revision === 2) {
    // Algorithm 4: Encrypt the padding constant with RC4
    const cipher = new RC4Cipher(encryptionKey);

    return cipher.process(new Uint8Array(PASSWORD_PADDING));
  } else {
    // Algorithm 5 (R3+):
    // Step a: Create hash of padding + file ID
    const hashInput = new Uint8Array(32 + fileId.length);

    hashInput.set(PASSWORD_PADDING);
    hashInput.set(fileId, 32);

    let hash = md5(hashInput);

    // Step b: Encrypt with RC4, 20 iterations with XOR'd keys
    for (let i = 0; i < 20; i++) {
      const iterKey = new Uint8Array(encryptionKey.length);

      for (let j = 0; j < encryptionKey.length; j++) {
        iterKey[j] = encryptionKey[j] ^ i;
      }

      const cipher = new RC4Cipher(iterKey);
      hash = cipher.process(hash);
    }

    // Step c: Append 16 arbitrary bytes (we use zeros for consistency)
    const result = new Uint8Array(32);
    result.set(hash.subarray(0, 16));
    // Remaining 16 bytes are zeros (arbitrary padding)

    return result;
  }
}

/**
 * Verify a password against the /U value.
 *
 * @param password - Password to verify
 * @param ownerHash - /O value from encryption dictionary
 * @param userHash - /U value from encryption dictionary
 * @param permissions - Permission flags
 * @param fileId - First element of /ID array
 * @param keyLengthBytes - Key length in bytes
 * @param revision - Encryption revision
 * @param encryptMetadata - Whether metadata is encrypted
 * @returns Object with isValid flag and encryptionKey if valid
 */
export function verifyUserPassword(
  password: Uint8Array,
  ownerHash: Uint8Array,
  userHash: Uint8Array,
  permissions: number,
  fileId: Uint8Array,
  keyLengthBytes: number,
  revision: number,
  encryptMetadata = true,
): { isValid: boolean; encryptionKey: Uint8Array | null } {
  // Compute the encryption key from the password
  const key = computeEncryptionKeyR2R4(
    password,
    ownerHash,
    permissions,
    fileId,
    keyLengthBytes,
    revision,
    encryptMetadata,
  );

  // Compute what the /U value should be
  const computedU = computeUserHash(key, fileId, revision);

  // Compare (R3+: only first 16 bytes matter)
  const compareLength = revision === 2 ? 32 : 16;
  const isValid = constantTimeCompare(
    computedU.subarray(0, compareLength),
    userHash.subarray(0, compareLength),
  );

  return {
    isValid,
    encryptionKey: isValid ? key : null,
  };
}

/**
 * Verify the owner password and recover the encryption key.
 *
 * @param ownerPassword - Owner password to verify
 * @param ownerHash - /O value from encryption dictionary
 * @param userHash - /U value from encryption dictionary
 * @param permissions - Permission flags
 * @param fileId - First element of /ID array
 * @param keyLengthBytes - Key length in bytes
 * @param revision - Encryption revision
 * @param encryptMetadata - Whether metadata is encrypted
 * @returns Object with isValid flag and encryptionKey if valid
 */
export function verifyOwnerPassword(
  ownerPassword: Uint8Array,
  ownerHash: Uint8Array,
  userHash: Uint8Array,
  permissions: number,
  fileId: Uint8Array,
  keyLengthBytes: number,
  revision: number,
  encryptMetadata = true,
): { isValid: boolean; encryptionKey: Uint8Array | null } {
  // Step a: Pad owner password and hash
  const paddedOwner = padPassword(ownerPassword);
  let hash = md5(paddedOwner);

  // Step b: For R >= 3, iterate 50 times
  if (revision >= 3) {
    for (let i = 0; i < 50; i++) {
      hash = md5(hash);
    }
  }

  // Step c: Use first n bytes as RC4 key
  const rc4Key = hash.subarray(0, keyLengthBytes);

  // Step d: Decrypt /O to get user password
  let decrypted: Uint8Array = new Uint8Array(ownerHash);

  if (revision === 2) {
    const cipher = new RC4Cipher(rc4Key);
    decrypted = cipher.process(decrypted);
  } else {
    // R3+: 20 iterations in reverse (19 down to 0)
    for (let i = 19; i >= 0; i--) {
      const iterKey = new Uint8Array(keyLengthBytes);

      for (let j = 0; j < keyLengthBytes; j++) {
        iterKey[j] = rc4Key[j] ^ i;
      }

      const cipher = new RC4Cipher(iterKey);
      decrypted = cipher.process(decrypted);
    }
  }

  // Step e: The decrypted value is the padded user password
  // Use it to verify and get the encryption key
  return verifyUserPassword(
    decrypted,
    ownerHash,
    userHash,
    permissions,
    fileId,
    keyLengthBytes,
    revision,
    encryptMetadata,
  );
}

/**
 * Derive the object-specific encryption key (Algorithm 1).
 *
 * Each object in a PDF gets its own key derived from the document key
 * and the object/generation numbers.
 *
 * @param documentKey - The document encryption key
 * @param objectNumber - Object number
 * @param generationNumber - Generation number
 * @param forAes - If true, append "sAlT" for AES encryption
 * @returns Object-specific key (max 16 bytes)
 */
export function deriveObjectKey(
  documentKey: Uint8Array,
  objectNumber: number,
  generationNumber: number,
  forAes = false,
): Uint8Array {
  // Build hash input: key + objNum (3 bytes LE) + genNum (2 bytes LE) + optional "sAlT"
  const saltLength = forAes ? 4 : 0;
  const hashInput = new Uint8Array(documentKey.length + 5 + saltLength);

  let offset = 0;

  // Copy document key
  hashInput.set(documentKey, offset);
  offset += documentKey.length;

  // Append object number (3 bytes, little-endian)
  hashInput[offset++] = objectNumber & SINGLE_BYTE_MASK;
  hashInput[offset++] = (objectNumber >> 8) & SINGLE_BYTE_MASK;
  hashInput[offset++] = (objectNumber >> 16) & SINGLE_BYTE_MASK;

  // Append generation number (2 bytes, little-endian)
  hashInput[offset++] = generationNumber & SINGLE_BYTE_MASK;
  hashInput[offset++] = (generationNumber >> 8) & SINGLE_BYTE_MASK;

  // For AES, append "sAlT"
  if (forAes) {
    hashInput[offset++] = 0x73; // 's'
    hashInput[offset++] = 0x41; // 'A'
    hashInput[offset++] = 0x6c; // 'l'
    hashInput[offset++] = 0x54; // 'T'
  }

  // Hash with MD5
  const hash = md5(hashInput);

  // Return min(documentKey.length + 5, 16) bytes
  const keyLength = Math.min(documentKey.length + 5, 16);
  return hash.subarray(0, keyLength);
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
