/**
 * PKCS#12 Key Derivation Function (RFC 7292).
 *
 * Implements the key derivation algorithm from PKCS#12 section B.2.
 * Used to derive encryption keys and IVs from passwords for legacy
 * PKCS#12 files encrypted with 3DES or RC2.
 *
 * @see RFC 7292 - PKCS #12: Personal Information Exchange Syntax
 */

import { sha1 } from "@noble/hashes/legacy.js";
import { concatBytes } from "#src/helpers/buffer";

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PKCS#12 Key Derivation Function.
 *
 * Derives cryptographic keys and IVs from passwords using the PKCS#12
 * algorithm with SHA-1 hashing.
 */

// biome-ignore lint/complexity/noStaticOnlyClass: utility class
export class PKCS12KDF {
  /** Purpose ID for deriving encryption keys */
  static readonly PURPOSE_KEY = 1;

  /** Purpose ID for deriving initialization vectors */
  static readonly PURPOSE_IV = 2;

  /** Purpose ID for deriving MAC keys */
  static readonly PURPOSE_MAC = 3;

  /** SHA-1 hash output size in bytes */
  private static readonly HASH_SIZE = 20;

  /** SHA-1 block size in bytes */
  private static readonly BLOCK_SIZE = 64;

  /**
   * Derive key material from a password.
   *
   * @param password - Password as UTF-16BE with trailing null
   * @param salt - Salt bytes
   * @param iterations - Number of hash iterations
   * @param purpose - Derivation purpose (1=key, 2=IV, 3=MAC)
   * @param length - Desired output length in bytes
   * @returns Derived key material
   */
  static derive(
    password: Uint8Array,
    salt: Uint8Array,
    iterations: number,
    purpose: number,
    length: number,
  ): Uint8Array {
    // Step 1: Construct D (diversifier) - block filled with purpose ID
    const D = new Uint8Array(PKCS12KDF.BLOCK_SIZE).fill(purpose);

    // Step 2: Concatenate salt to be multiple of block size
    const S = new Uint8Array(PKCS12KDF.BLOCK_SIZE * Math.ceil(salt.length / PKCS12KDF.BLOCK_SIZE));
    for (let i = 0; i < S.length; i++) {
      S[i] = salt[i % salt.length];
    }

    // Step 3: Concatenate password to be multiple of block size
    const P = new Uint8Array(
      PKCS12KDF.BLOCK_SIZE * Math.ceil(password.length / PKCS12KDF.BLOCK_SIZE),
    );
    for (let i = 0; i < P.length; i++) {
      P[i] = password[i % password.length];
    }

    // Step 4: I = S || P
    const I = concatBytes([S, P]);

    // Step 5-7: Generate key material
    const result = new Uint8Array(length);
    let offset = 0;

    while (offset < length) {
      // Step 6a: Hash D || I
      let A = sha1(concatBytes([D, I]));

      // Step 6b: Iterate hash
      for (let i = 1; i < iterations; i++) {
        A = sha1(A);
      }

      // Copy to result
      const toCopy = Math.min(PKCS12KDF.HASH_SIZE, length - offset);
      result.set(A.subarray(0, toCopy), offset);
      offset += toCopy;

      if (offset >= length) {
        break;
      }

      // Step 6c: Create B from A (repeat A to fill block)
      const B = new Uint8Array(PKCS12KDF.BLOCK_SIZE);
      for (let i = 0; i < PKCS12KDF.BLOCK_SIZE; i++) {
        B[i] = A[i % PKCS12KDF.HASH_SIZE];
      }

      // Step 6d: I = I + B + 1 (treating each block as big-endian integer)
      for (let i = 0; i < I.length; i += PKCS12KDF.BLOCK_SIZE) {
        let carry = 1;
        for (let j = PKCS12KDF.BLOCK_SIZE - 1; j >= 0; j--) {
          const sum = I[i + j] + B[j] + carry;
          I[i + j] = sum & 0xff;
          carry = sum >> 8;
        }
      }
    }

    return result;
  }

  /**
   * Derive an encryption key from a password.
   *
   * @param password - Password as UTF-16BE with trailing null
   * @param salt - Salt bytes
   * @param iterations - Number of hash iterations
   * @param keyLength - Desired key length in bytes
   * @returns Derived encryption key
   */
  static deriveKey(
    password: Uint8Array,
    salt: Uint8Array,
    iterations: number,
    keyLength: number,
  ): Uint8Array {
    return PKCS12KDF.derive(password, salt, iterations, PKCS12KDF.PURPOSE_KEY, keyLength);
  }

  /**
   * Derive an initialization vector from a password.
   *
   * @param password - Password as UTF-16BE with trailing null
   * @param salt - Salt bytes
   * @param iterations - Number of hash iterations
   * @param ivLength - Desired IV length in bytes
   * @returns Derived initialization vector
   */
  static deriveIV(
    password: Uint8Array,
    salt: Uint8Array,
    iterations: number,
    ivLength: number,
  ): Uint8Array {
    return PKCS12KDF.derive(password, salt, iterations, PKCS12KDF.PURPOSE_IV, ivLength);
  }

  /**
   * Convert a password string to PKCS#12 format.
   *
   * PKCS#12 requires passwords to be encoded as UTF-16BE (big-endian)
   * with a trailing null character (two zero bytes).
   *
   * @param password - Password string
   * @returns Password as UTF-16BE with trailing null
   */
  static passwordToBytes(password: string): Uint8Array {
    const result = new Uint8Array((password.length + 1) * 2);
    // Encode each character of the password as UTF-16BE in result using a while loop, incrementing by 2 bytes each iteration
    let i = 0,
      j = 0;

    while (i < password.length) {
      const code = password.charCodeAt(i);

      result[j] = (code >> 8) & 0xff; // high byte
      result[j + 1] = code & 0xff; // low byte

      i += 1;
      j += 2;
    }

    // Trailing null is already zeros
    return result;
  }
}
