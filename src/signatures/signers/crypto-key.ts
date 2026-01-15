/**
 * Web Crypto CryptoKey signer.
 *
 * Signs using a CryptoKey directly.
 */

import * as pkijs from "pkijs";

import type { DigestAlgorithm, KeyType, SignatureAlgorithm, Signer } from "../types";

const cryptoEngine = pkijs.getCrypto(true);

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
   * Sign a digest.
   *
   * @param digest - The hash to sign
   * @param algorithm - The digest algorithm used
   * @returns Raw signature bytes
   */
  async sign(digest: Uint8Array, algorithm: DigestAlgorithm): Promise<Uint8Array> {
    const hashName = algorithm.replace("-", "");

    let signAlgorithm: { name: string; saltLength?: number; hash?: { name: string } };

    switch (this.signatureAlgorithm) {
      case "RSASSA-PKCS1-v1_5":
        signAlgorithm = { name: "RSASSA-PKCS1-v1_5" };
        break;
      case "RSA-PSS":
        signAlgorithm = { name: "RSA-PSS", saltLength: digest.length };
        break;
      case "ECDSA":
        signAlgorithm = { name: "ECDSA", hash: { name: hashName } };
        break;
    }

    const signature = await cryptoEngine.sign(
      signAlgorithm,
      this.privateKey,
      new Uint8Array(digest),
    );

    return new Uint8Array(signature);
  }
}
