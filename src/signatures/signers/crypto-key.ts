/**
 * Web Crypto CryptoKey signer.
 *
 * Signs using a CryptoKey directly.
 */

import { createCMSECDSASignature } from "pkijs";

import { getCrypto } from "../crypto";
import type { DigestAlgorithm, KeyType, SignatureAlgorithm, Signer } from "../types";

/**
 * Signer that uses a Web Crypto CryptoKey directly.
 *
 * Useful when you already have a CryptoKey from Web Crypto API,
 * for example from `crypto.subtle.generateKey()` or `crypto.subtle.importKey()`.
 *
 * @example
 * ```typescript
 * // Generate a key pair
 * const keyPair = await crypto.subtle.generateKey(
 *   { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
 *   true,
 *   ["sign", "verify"]
 * );
 *
 * // Use with signer (certificate is required)
 * const signer = new CryptoKeySigner(keyPair.privateKey, certificateDer, "RSA", "RSASSA-PKCS1-v1_5");
 * ```
 */
export class CryptoKeySigner implements Signer {
  readonly certificate: Uint8Array;
  readonly certificateChain: Uint8Array[];
  readonly keyType: KeyType;
  readonly signatureAlgorithm: SignatureAlgorithm;

  private readonly privateKey: CryptoKey;

  /**
   * Create a new CryptoKeySigner.
   *
   * @param privateKey - The CryptoKey for signing
   * @param certificate - DER-encoded X.509 certificate
   * @param keyType - Key type ("RSA" or "EC")
   * @param signatureAlgorithm - Signature algorithm
   * @param certificateChain - Optional certificate chain [intermediate, ..., root]
   */
  constructor(
    privateKey: CryptoKey,
    certificate: Uint8Array,
    keyType: KeyType,
    signatureAlgorithm: SignatureAlgorithm,
    certificateChain?: Uint8Array[],
  ) {
    this.privateKey = privateKey;
    this.certificate = certificate;
    this.keyType = keyType;
    this.signatureAlgorithm = signatureAlgorithm;
    this.certificateChain = certificateChain ?? [];
  }

  /**
   * Sign data using the private key.
   *
   * The data is hashed internally using the specified algorithm.
   *
   * @param data - The data to sign
   * @param algorithm - The digest algorithm to use
   * @returns Raw signature bytes
   */
  async sign(data: Uint8Array, algorithm: DigestAlgorithm): Promise<Uint8Array> {
    const crypto = getCrypto();

    let signAlgorithm: { name: string; saltLength?: number; hash?: { name: string } };

    switch (this.signatureAlgorithm) {
      case "RSASSA-PKCS1-v1_5":
        signAlgorithm = { name: "RSASSA-PKCS1-v1_5" };
        break;
      case "RSA-PSS":
        // For PSS, saltLength should be the hash output length
        signAlgorithm = { name: "RSA-PSS", saltLength: this.getHashLength(algorithm) };
        break;
      case "ECDSA":
        // WebCrypto expects the hash algorithm name with hyphen (e.g., "SHA-256")
        signAlgorithm = { name: "ECDSA", hash: { name: algorithm } };
        break;
    }

    const signature = await crypto.sign(signAlgorithm, this.privateKey, new Uint8Array(data));

    // WebCrypto ECDSA returns P1363 format (r || s), but CMS requires DER format
    if (this.signatureAlgorithm === "ECDSA") {
      return new Uint8Array(createCMSECDSASignature(signature));
    }

    return new Uint8Array(signature);
  }

  /**
   * Get the hash output length in bytes for a given algorithm.
   */
  private getHashLength(algorithm: DigestAlgorithm): number {
    switch (algorithm) {
      case "SHA-256":
        return 32;
      case "SHA-384":
        return 48;
      case "SHA-512":
        return 64;
    }
  }
}
