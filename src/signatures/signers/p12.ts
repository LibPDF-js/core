/**
 * PKCS#12 file signer.
 *
 * Signs using a .p12/.pfx file containing private key and certificate.
 */

import { fromBER } from "asn1js";
import * as pkijs from "pkijs";
import { createCMSECDSASignature } from "pkijs";

import { toArrayBuffer } from "../../helpers/buffer";
import { buildCertificateChain } from "../aia";
import { decryptLegacyPbe, getCrypto, isLegacyPbeOid, PKCS12KDF } from "../crypto";
import {
  OID_CERT_BAG,
  OID_EC_PUBLIC_KEY,
  OID_KEY_BAG,
  OID_PKCS8_SHROUDED_KEY_BAG,
  OID_RSA_ENCRYPTION,
  OID_SECP256R1,
  OID_SECP384R1,
  OID_SECP521R1,
} from "../oids";
import type { DigestAlgorithm, KeyType, SignatureAlgorithm, Signer } from "../types";
import { CertificateChainError, SignerError } from "../types";

/**
 * Options for creating a P12Signer.
 */
export interface P12SignerOptions {
  /**
   * Build complete certificate chain using AIA (Authority Information Access).
   *
   * When enabled, the signer will fetch missing intermediate certificates
   * from URLs embedded in the certificates. This ensures the CMS signature
   * contains the full chain, which is important for validation.
   *
   * @default false
   */
  buildChain?: boolean;

  /**
   * Timeout for AIA certificate fetching in milliseconds.
   * Only used when `buildChain` is true.
   *
   * @default 15000
   */
  chainTimeout?: number;
}

/**
 * Signer that uses a PKCS#12 (.p12/.pfx) file.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const signer = await P12Signer.create(p12Bytes, "password");
 *
 * // With automatic chain building via AIA
 * const signer = await P12Signer.create(p12Bytes, "password", { buildChain: true });
 *
 * const signature = await signer.sign(digest, "SHA-256");
 * ```
 */
export class P12Signer implements Signer {
  readonly certificate: Uint8Array;
  readonly certificateChain: Uint8Array[];
  readonly keyType: KeyType;
  readonly signatureAlgorithm: SignatureAlgorithm;

  private readonly privateKey: CryptoKey;

  private constructor(
    privateKey: CryptoKey,
    certificate: Uint8Array,
    certificateChain: Uint8Array[],
    keyType: KeyType,
    signatureAlgorithm: SignatureAlgorithm,
  ) {
    this.privateKey = privateKey;
    this.certificate = certificate;
    this.certificateChain = certificateChain;
    this.keyType = keyType;
    this.signatureAlgorithm = signatureAlgorithm;
  }

  /**
   * Create a P12Signer from PKCS#12 file bytes.
   *
   * @param p12Bytes - The .p12/.pfx file contents
   * @param password - Password to decrypt the file
   * @param options - Optional configuration
   * @returns A new P12Signer instance
   * @throws {SignerError} if the file is invalid or password is wrong
   *
   * @example
   * ```typescript
   * // Basic usage
   * const signer = await P12Signer.create(p12Bytes, "password");
   *
   * // With automatic chain building (recommended for B-LT/B-LTA)
   * const signer = await P12Signer.create(p12Bytes, "password", {
   *   buildChain: true,
   * });
   * ```
   */
  static async create(
    p12Bytes: Uint8Array,
    password: string,
    options: P12SignerOptions = {},
  ): Promise<P12Signer> {
    try {
      // Ensure we have a proper ArrayBuffer (not SharedArrayBuffer)
      const buffer = toArrayBuffer(p12Bytes);

      // Parse the PKCS#12 structure
      const asn1 = fromBER(buffer);

      if (asn1.offset === -1) {
        throw new SignerError("Invalid PKCS#12 file: failed to parse ASN.1 structure");
      }

      const pfx = new pkijs.PFX({ schema: asn1.result });

      const passwordBuffer = toArrayBuffer(new TextEncoder().encode(password));

      // Parse internal values (decrypt MAC)
      await pfx.parseInternalValues({ password: passwordBuffer });

      // Get authenticated safe
      const authenticatedSafe = pfx.parsedValue?.authenticatedSafe;

      if (!authenticatedSafe) {
        throw new SignerError("Failed to parse PKCS#12 authenticated safe");
      }

      // Parse safe contents (our LegacyCryptoEngine handles legacy encryption)
      const safeContentsCount = authenticatedSafe.safeContents.length;
      const safeContentsParams = Array.from({ length: safeContentsCount }, () => ({
        password: passwordBuffer,
      }));

      await authenticatedSafe.parseInternalValues({
        safeContents: safeContentsParams,
      });

      // Extract private key and certificates
      const certificates: pkijs.Certificate[] = [];
      let privateKey: CryptoKey | null = null;

      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const parsedValue = authenticatedSafe.parsedValue as
        | { safeContents: Array<{ value: pkijs.SafeContents }> }
        | undefined;

      if (parsedValue?.safeContents) {
        for (const entry of parsedValue.safeContents) {
          const safeContents = entry.value;

          if (!safeContents.safeBags) {
            continue;
          }

          for (const safeBag of safeContents.safeBags) {
            // PKCS#8 shrouded key bag (encrypted private key)
            if (safeBag.bagId === OID_PKCS8_SHROUDED_KEY_BAG) {
              privateKey = await P12Signer.extractPrivateKey(safeBag, password, passwordBuffer);
            }

            // Unencrypted key bag
            if (safeBag.bagId === OID_KEY_BAG) {
              // oxlint-disable-next-line typescript/no-unsafe-type-assertion
              const privateKeyInfo = safeBag.bagValue as pkijs.PrivateKeyInfo;

              privateKey = await P12Signer.importPrivateKey(privateKeyInfo);
            }

            // Certificate bag
            if (safeBag.bagId === OID_CERT_BAG) {
              // oxlint-disable-next-line typescript/no-unsafe-type-assertion
              const certBag = safeBag.bagValue as pkijs.CertBag;

              if (certBag.parsedValue instanceof pkijs.Certificate) {
                certificates.push(certBag.parsedValue);
              }
            }
          }
        }
      }

      if (!privateKey) {
        throw new SignerError("No private key found in PKCS#12 file");
      }

      if (certificates.length === 0) {
        throw new SignerError("No certificates found in PKCS#12 file");
      }

      // Determine key type and encode certificates
      const { keyType, signatureAlgorithm } = P12Signer.determineKeyInfo(privateKey);

      const signingCertDer = new Uint8Array(certificates[0].toSchema().toBER(false));

      let chainCertsDer: Uint8Array[] = certificates
        .slice(1)
        .map(cert => new Uint8Array(cert.toSchema().toBER(false)));

      // Optionally build complete chain using AIA
      if (options.buildChain) {
        try {
          chainCertsDer = await buildCertificateChain(signingCertDer, {
            existingChain: chainCertsDer,
            timeout: options.chainTimeout,
          });
        } catch (error) {
          // If chain building fails, we still have what was in the P12
          if (error instanceof CertificateChainError) {
            console.warn(`Could not complete certificate chain via AIA: ${error.message}`);
          } else {
            throw error;
          }
        }
      }

      return new P12Signer(privateKey, signingCertDer, chainCertsDer, keyType, signatureAlgorithm);
    } catch (error) {
      if (error instanceof SignerError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);

      if (message.includes("integrity") || message.includes("MAC") || message.includes("HMAC")) {
        throw new SignerError("Invalid password for PKCS#12 file");
      }

      throw new SignerError(`Failed to parse PKCS#12 file: ${message}`);
    }
  }

  /**
   * Extract private key from a shrouded key bag.
   */
  private static async extractPrivateKey(
    safeBag: pkijs.SafeBag,
    password: string,
    passwordBuffer: ArrayBuffer,
  ): Promise<CryptoKey> {
    const crypto = getCrypto();

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const keyBag = safeBag.bagValue as pkijs.PKCS8ShroudedKeyBag;
    const algorithmId = keyBag.encryptionAlgorithm.algorithmId;

    let decryptedKey: ArrayBuffer;

    if (isLegacyPbeOid(algorithmId)) {
      // Use our legacy decryption
      const algorithmParams = keyBag.encryptionAlgorithm.algorithmParams?.toBER(false);

      if (!algorithmParams) {
        throw new SignerError("Missing algorithm parameters for key decryption");
      }

      // Parse PBE parameters
      const paramsAsn1 = fromBER(algorithmParams);

      if (paramsAsn1.offset === -1) {
        throw new SignerError("Failed to parse PBE parameters");
      }

      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const paramsSeq = paramsAsn1.result as { valueBlock: { value: unknown[] } };

      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const saltValue = paramsSeq.valueBlock.value[0] as {
        valueBlock: { valueHexView: Uint8Array };
      };

      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const iterValue = paramsSeq.valueBlock.value[1] as { valueBlock: { valueDec: number } };

      const salt = new Uint8Array(saltValue.valueBlock.valueHexView);
      const iterations = iterValue.valueBlock.valueDec;
      const encryptedData = new Uint8Array(keyBag.encryptedData.valueBlock.valueHexView);
      const passwordBytes = PKCS12KDF.passwordToBytes(password);

      const decrypted = decryptLegacyPbe(
        algorithmId,
        salt,
        iterations,
        encryptedData,
        passwordBytes,
      );

      decryptedKey = toArrayBuffer(decrypted);
    } else {
      // Use pkijs/Web Crypto
      decryptedKey = await crypto.decryptEncryptedContentInfo({
        encryptedContentInfo: new pkijs.EncryptedContentInfo({
          contentEncryptionAlgorithm: keyBag.encryptionAlgorithm,
          encryptedContent: keyBag.encryptedData,
        }),
        password: passwordBuffer,
      });
    }

    // Parse and import the private key
    const pkcs8Asn1 = fromBER(decryptedKey);

    if (pkcs8Asn1.offset === -1) {
      throw new SignerError("Failed to parse decrypted private key");
    }

    const privateKeyInfo = new pkijs.PrivateKeyInfo({ schema: pkcs8Asn1.result });

    return P12Signer.importPrivateKey(privateKeyInfo);
  }

  /**
   * Import a PrivateKeyInfo into WebCrypto.
   */
  private static async importPrivateKey(privateKeyInfo: pkijs.PrivateKeyInfo): Promise<CryptoKey> {
    const crypto = getCrypto();

    const algorithmOid = privateKeyInfo.privateKeyAlgorithm.algorithmId;

    // RSA
    if (algorithmOid === OID_RSA_ENCRYPTION) {
      return crypto.importKey(
        "pkcs8",
        privateKeyInfo.toSchema().toBER(false),
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        true,
        ["sign"],
      );
    }

    // EC
    if (algorithmOid === OID_EC_PUBLIC_KEY) {
      const params = privateKeyInfo.privateKeyAlgorithm.algorithmParams;
      let namedCurve = "P-256";

      if (params) {
        const curveOid = params.valueBlock?.toString() ?? "";

        if (curveOid.includes(OID_SECP256R1)) {
          namedCurve = "P-256";
        } else if (curveOid.includes(OID_SECP384R1)) {
          namedCurve = "P-384";
        } else if (curveOid.includes(OID_SECP521R1)) {
          namedCurve = "P-521";
        }
      }

      return crypto.importKey(
        "pkcs8",
        privateKeyInfo.toSchema().toBER(false),
        { name: "ECDSA", namedCurve },
        true,
        ["sign"],
      );
    }

    throw new SignerError(`Unsupported key algorithm: ${algorithmOid}`);
  }

  /**
   * Determine key type and signature algorithm from CryptoKey.
   */
  private static determineKeyInfo(key: CryptoKey): {
    keyType: KeyType;
    signatureAlgorithm: SignatureAlgorithm;
  } {
    const { name } = key.algorithm;

    if (name === "RSASSA-PKCS1-v1_5") {
      return {
        keyType: "RSA",
        signatureAlgorithm: "RSASSA-PKCS1-v1_5",
      };
    }

    if (name === "RSA-PSS") {
      return {
        keyType: "RSA",
        signatureAlgorithm: "RSA-PSS",
      };
    }

    if (name === "ECDSA") {
      return {
        keyType: "EC",
        signatureAlgorithm: "ECDSA",
      };
    }

    return {
      keyType: "RSA",
      signatureAlgorithm: "RSASSA-PKCS1-v1_5",
    };
  }

  /**
   * Sign data using the private key.
   *
   * The data is hashed internally by WebCrypto using the specified algorithm.
   *
   * @param data - The data to sign
   * @param algorithm - The digest algorithm to use
   * @returns The signature bytes
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
