/**
 * AES-CBC encryption for PDF.
 *
 * PDF uses AES in CBC mode with PKCS#7 padding:
 * - AES-128 (16-byte key) for encryption revision R4 (AESV2)
 * - AES-256 (32-byte key) for revisions R5-R6 (AESV3)
 *
 * The IV (initialization vector) is 16 bytes and is prepended to the ciphertext.
 * This matches the PDF spec where encrypted strings/streams include the IV.
 *
 * @see PDF 2.0 Specification, Section 7.6.3.3
 */

import { cbc, ecb } from "@noble/ciphers/aes.js";
import { randomBytes } from "@noble/ciphers/utils.js";

/** AES block size in bytes (always 16) */
export const AES_BLOCK_SIZE = 16;

/**
 * Encrypts data using AES-CBC with PKCS#7 padding.
 *
 * Generates a random 16-byte IV and prepends it to the ciphertext.
 * This is the format expected by PDF for encrypted strings and streams.
 *
 * @param key - 16 bytes (AES-128) or 32 bytes (AES-256)
 * @param plaintext - Data to encrypt
 * @returns IV (16 bytes) + ciphertext
 */
export function aesEncrypt(key: Uint8Array, plaintext: Uint8Array): Uint8Array {
  validateAesKey(key);

  // Generate random IV
  const iv = randomBytes(AES_BLOCK_SIZE);

  // Encrypt with CBC mode (PKCS#7 padding enabled by default)
  const cipher = cbc(key, iv);
  const ciphertext = cipher.encrypt(plaintext);

  // Prepend IV to ciphertext (PDF format)
  const result = new Uint8Array([...iv, ...ciphertext]);

  return result;
}

/**
 * Decrypts AES-CBC encrypted data.
 *
 * Expects the 16-byte IV to be prepended to the ciphertext.
 * Automatically removes PKCS#7 padding.
 *
 * @param key - 16 bytes (AES-128) or 32 bytes (AES-256)
 * @param data - IV (16 bytes) + ciphertext
 * @returns Decrypted plaintext
 * @throws {Error} if data is too short to contain an IV
 */
export function aesDecrypt(key: Uint8Array, data: Uint8Array): Uint8Array {
  validateAesKey(key);

  if (data.length < AES_BLOCK_SIZE) {
    throw new Error(`AES ciphertext too short: expected at least ${AES_BLOCK_SIZE} bytes for IV`);
  }

  if (data.length === AES_BLOCK_SIZE) {
    // Only IV, no ciphertext - return empty
    return new Uint8Array(0);
  }

  // Extract IV and ciphertext
  const iv = data.subarray(0, AES_BLOCK_SIZE);
  let ciphertext = data.subarray(AES_BLOCK_SIZE);

  // Truncate to nearest block boundary for misaligned ciphertext.
  // This recovers as much data as possible from corrupted encrypted PDFs
  // (e.g., buggy generators that didn't properly pad before encryption).
  if (ciphertext.length % AES_BLOCK_SIZE !== 0) {
    const aligned = ciphertext.length - (ciphertext.length % AES_BLOCK_SIZE);

    if (aligned === 0) {
      return new Uint8Array(0);
    }

    ciphertext = ciphertext.subarray(0, aligned);
  }

  // Decrypt with CBC mode (PKCS#7 padding removed automatically)
  const cipher = cbc(key, iv);
  return cipher.decrypt(ciphertext);
}

/**
 * Encrypts data using AES-CBC with a specific IV.
 *
 * Used when the IV is predetermined (e.g., for PDF 2.0 /Perms encryption
 * which uses a zero IV, or for key derivation).
 *
 * @param key - 16 bytes (AES-128) or 32 bytes (AES-256)
 * @param iv - 16-byte initialization vector
 * @param plaintext - Data to encrypt
 * @param disablePadding - If true, no padding is added (plaintext must be block-aligned)
 * @returns Ciphertext (IV not included)
 */
export function aesEncryptWithIv(
  key: Uint8Array,
  iv: Uint8Array,
  plaintext: Uint8Array,
  disablePadding = false,
): Uint8Array {
  validateAesKey(key);

  if (iv.length !== AES_BLOCK_SIZE) {
    throw new Error(`AES IV must be ${AES_BLOCK_SIZE} bytes, got ${iv.length}`);
  }

  if (disablePadding && plaintext.length % AES_BLOCK_SIZE !== 0) {
    throw new Error(
      `Plaintext must be multiple of ${AES_BLOCK_SIZE} bytes when padding is disabled`,
    );
  }

  const cipher = cbc(key, iv, { disablePadding });
  return cipher.encrypt(plaintext);
}

/**
 * Decrypts AES-CBC data with a specific IV.
 *
 * Used when the IV is provided separately or is known (e.g., zero IV
 * for /Perms decryption).
 *
 * @param key - 16 bytes (AES-128) or 32 bytes (AES-256)
 * @param iv - 16-byte initialization vector
 * @param ciphertext - Data to decrypt (without IV prefix)
 * @param disablePadding - If true, no padding is removed
 * @returns Decrypted plaintext
 */
export function aesDecryptWithIv(
  key: Uint8Array,
  iv: Uint8Array,
  ciphertext: Uint8Array,
  disablePadding = false,
): Uint8Array {
  validateAesKey(key);

  if (iv.length !== AES_BLOCK_SIZE) {
    throw new Error(`AES IV must be ${AES_BLOCK_SIZE} bytes, got ${iv.length}`);
  }

  if (ciphertext.length === 0) {
    return new Uint8Array(0);
  }

  if (ciphertext.length % AES_BLOCK_SIZE !== 0) {
    throw new Error(
      `AES ciphertext length must be multiple of ${AES_BLOCK_SIZE}, got ${ciphertext.length}`,
    );
  }

  const cipher = cbc(key, iv, { disablePadding });
  return cipher.decrypt(ciphertext);
}

/**
 * AES-ECB encryption (single block, no padding).
 *
 * Used for encrypting the /Perms entry in PDF 2.0 (R6) encryption,
 * which is always exactly 16 bytes.
 *
 * ⚠️ ECB mode is insecure for general use. Only use for specific
 * PDF encryption requirements where it's mandated by the spec.
 *
 * @param key - 16 bytes (AES-128) or 32 bytes (AES-256)
 * @param block - Exactly 16 bytes to encrypt
 * @returns Encrypted 16-byte block
 */
export function aesEcbEncrypt(key: Uint8Array, block: Uint8Array): Uint8Array {
  validateAesKey(key);

  if (block.length !== AES_BLOCK_SIZE) {
    throw new Error(`AES-ECB block must be exactly ${AES_BLOCK_SIZE} bytes, got ${block.length}`);
  }

  const cipher = ecb(key, { disablePadding: true });
  return cipher.encrypt(block);
}

/**
 * AES-ECB decryption (single block, no padding).
 *
 * Used for decrypting the /Perms entry in PDF 2.0 (R6) encryption.
 *
 * @param key - 16 bytes (AES-128) or 32 bytes (AES-256)
 * @param block - Exactly 16 bytes to decrypt
 * @returns Decrypted 16-byte block
 */
export function aesEcbDecrypt(key: Uint8Array, block: Uint8Array): Uint8Array {
  validateAesKey(key);

  if (block.length !== AES_BLOCK_SIZE) {
    throw new Error(`AES-ECB block must be exactly ${AES_BLOCK_SIZE} bytes, got ${block.length}`);
  }

  const cipher = ecb(key, { disablePadding: true });
  return cipher.decrypt(block);
}

/**
 * Validates that the key is a valid AES key length.
 */
function validateAesKey(key: Uint8Array): void {
  if (key.length !== 16 && key.length !== 32) {
    throw new Error(`AES key must be 16 (AES-128) or 32 (AES-256) bytes, got ${key.length}`);
  }
}

/**
 * Generate a random 16-byte IV for AES-CBC.
 */
export function generateIv(): Uint8Array {
  return randomBytes(AES_BLOCK_SIZE);
}

/** Zero IV - used for /Perms decryption in R6 */
export const ZERO_IV = new Uint8Array(AES_BLOCK_SIZE);
