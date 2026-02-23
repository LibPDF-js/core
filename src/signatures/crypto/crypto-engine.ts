/**
 * Custom crypto engine for pkijs that supports legacy PKCS#12 algorithms.
 *
 * Web Crypto API doesn't support Triple DES (3DES) or RC2, which are
 * commonly used in older PKCS#12 files. This engine extends pkijs's
 * CryptoEngine to handle these legacy algorithms using our pure JavaScript
 * implementations while delegating modern algorithms to Web Crypto.
 *
 * Supported legacy algorithms:
 * - pbeWithSHAAnd3-KeyTripleDES-CBC (OID 1.2.840.113549.1.12.1.3)
 * - pbeWithSHAAnd2-KeyTripleDES-CBC (OID 1.2.840.113549.1.12.1.4)
 * - pbeWithSHAAnd128BitRC2-CBC (OID 1.2.840.113549.1.12.1.5)
 * - pbeWithSHAAnd40BitRC2-CBC (OID 1.2.840.113549.1.12.1.6)
 */

import * as pkijs from "pkijs";

import { toArrayBuffer } from "../../helpers/buffer";
import { PKCS12KDF } from "./pkcs12-kdf";
import { RC2 } from "./rc2";
import { TripleDES } from "./triple-des";

// ─────────────────────────────────────────────────────────────────────────────
// OID Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Legacy PKCS#12 PBE algorithm OIDs */
export const LEGACY_PBE_OIDS = {
  /** pbeWithSHAAnd3-KeyTripleDES-CBC */
  SHA1_3DES: "1.2.840.113549.1.12.1.3",
  /** pbeWithSHAAnd2-KeyTripleDES-CBC */
  SHA1_2DES: "1.2.840.113549.1.12.1.4",
  /** pbeWithSHAAnd128BitRC2-CBC */
  SHA1_RC2_128: "1.2.840.113549.1.12.1.5",
  /** pbeWithSHAAnd40BitRC2-CBC */
  SHA1_RC2_40: "1.2.840.113549.1.12.1.6",
} as const;

/** Check if an algorithm OID is a legacy PBE that we handle */
export function isLegacyPbeOid(oid: string): boolean {
  return Object.values(LEGACY_PBE_OIDS).includes(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    oid as (typeof LEGACY_PBE_OIDS)[keyof typeof LEGACY_PBE_OIDS],
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy Decryption
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Decrypt data using legacy PKCS#12 PBE algorithms.
 *
 * @param algorithmId - Algorithm OID
 * @param salt - Salt bytes
 * @param iterations - Iteration count
 * @param encryptedData - Encrypted data
 * @param password - Password as PKCS#12 format (UTF-16BE with trailing null)
 * @returns Decrypted data
 */
export function decryptLegacyPbe(
  algorithmId: string,
  salt: Uint8Array,
  iterations: number,
  encryptedData: Uint8Array,
  password: Uint8Array,
): Uint8Array {
  switch (algorithmId) {
    case LEGACY_PBE_OIDS.SHA1_3DES: {
      const key = PKCS12KDF.deriveKey(password, salt, iterations, TripleDES.KEY_SIZE);
      const iv = PKCS12KDF.deriveIV(password, salt, iterations, TripleDES.BLOCK_SIZE);

      return TripleDES.decrypt(encryptedData, key, iv);
    }

    case LEGACY_PBE_OIDS.SHA1_2DES: {
      // 2-key Triple DES: derive 16 bytes and repeat first 8
      const kdf = PKCS12KDF.deriveKey(password, salt, iterations, 16);
      const key = new Uint8Array(TripleDES.KEY_SIZE);

      key.set(kdf, 0);
      key.set(kdf.subarray(0, 8), 16);

      const iv = PKCS12KDF.deriveIV(password, salt, iterations, TripleDES.BLOCK_SIZE);

      return TripleDES.decrypt(encryptedData, key, iv);
    }

    case LEGACY_PBE_OIDS.SHA1_RC2_128: {
      const key = PKCS12KDF.deriveKey(password, salt, iterations, 16);
      const iv = PKCS12KDF.deriveIV(password, salt, iterations, RC2.BLOCK_SIZE);

      return RC2.decrypt(encryptedData, key, iv, RC2.EFFECTIVE_BITS_128);
    }

    case LEGACY_PBE_OIDS.SHA1_RC2_40: {
      const key = PKCS12KDF.deriveKey(password, salt, iterations, 5);
      const iv = PKCS12KDF.deriveIV(password, salt, iterations, RC2.BLOCK_SIZE);

      return RC2.decrypt(encryptedData, key, iv, RC2.EFFECTIVE_BITS_40);
    }

    default:
      throw new Error(`Unsupported legacy PBE algorithm: ${algorithmId}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Crypto Engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Custom crypto engine that extends pkijs CryptoEngine to support legacy
 * PKCS#12 encryption algorithms (3DES, RC2) while remaining web-safe.
 */
export class CryptoEngine extends pkijs.CryptoEngine {
  constructor() {
    const cryptoObj = typeof crypto !== "undefined" ? crypto : globalThis.crypto;

    super({
      crypto: cryptoObj,
      subtle: cryptoObj.subtle,
      name: "LibPDFCryptoEngine",
    });
  }

  /**
   * Override digest to normalize algorithm names.
   * Web Crypto expects "SHA-256" but some code passes "SHA256".
   */
  override async digest(
    algorithm: { name: string },
    data: ArrayBuffer | ArrayBufferView,
  ): Promise<ArrayBuffer> {
    const normalizedAlgorithm = { ...algorithm };

    // Normalize hash algorithm names (SHA256 -> SHA-256)
    if (normalizedAlgorithm.name && !normalizedAlgorithm.name.includes("-")) {
      const match = normalizedAlgorithm.name.match(/^(SHA|MD)(\d+)$/i);

      if (match) {
        normalizedAlgorithm.name = `${match[1].toUpperCase()}-${match[2]}`;
      }
    }

    return super.digest(normalizedAlgorithm, data);
  }

  /**
   * Override getAlgorithmByOID to recognize legacy algorithms.
   */
  // biome-ignore lint/suspicious/noExplicitAny: override method
  override getAlgorithmByOID(oid: string, safety?: boolean, target?: string): any {
    switch (oid) {
      case LEGACY_PBE_OIDS.SHA1_3DES:
        return { name: "DES-EDE3-CBC", length: 24 };
      case LEGACY_PBE_OIDS.SHA1_2DES:
        return { name: "DES-EDE2-CBC", length: 16 };
      case LEGACY_PBE_OIDS.SHA1_RC2_128:
        return { name: "RC2-128-CBC", length: 16 };
      case LEGACY_PBE_OIDS.SHA1_RC2_40:
        return { name: "RC2-40-CBC", length: 5 };
      default:
        return super.getAlgorithmByOID(oid, safety, target);
    }
  }

  /**
   * Override decryptEncryptedContentInfo to handle legacy algorithms.
   */
  override async decryptEncryptedContentInfo(
    parameters: pkijs.CryptoEngineDecryptParams,
  ): Promise<ArrayBuffer> {
    const algorithmId = parameters.encryptedContentInfo.contentEncryptionAlgorithm.algorithmId;

    if (isLegacyPbeOid(algorithmId)) {
      return this.decryptLegacyContent(parameters);
    }

    return super.decryptEncryptedContentInfo(parameters);
  }

  /**
   * Decrypt content encrypted with legacy PKCS#12 PBE algorithms.
   */
  private decryptLegacyContent(parameters: pkijs.CryptoEngineDecryptParams): ArrayBuffer {
    const encInfo = parameters.encryptedContentInfo;
    const algorithmId = encInfo.contentEncryptionAlgorithm.algorithmId;

    // Extract PBE parameters
    const pbeParams = encInfo.contentEncryptionAlgorithm.algorithmParams;

    if (!pbeParams) {
      throw new Error("Missing algorithm parameters for legacy PBE");
    }

    const salt = new Uint8Array(pbeParams.valueBlock.value[0].valueBlock.valueHex);
    const iterations: number = pbeParams.valueBlock.value[1].valueBlock.valueDec;

    // Get encrypted content
    if (!encInfo.encryptedContent) {
      throw new Error("Missing encrypted content");
    }

    const encryptedData = encInfo.getEncryptedContent();

    // Convert password to PKCS#12 format
    const passwordUtf8 = new Uint8Array(parameters.password);
    const passwordString = new TextDecoder().decode(passwordUtf8);
    const passwordBytes = PKCS12KDF.passwordToBytes(passwordString);

    // Decrypt
    const decrypted = decryptLegacyPbe(
      algorithmId,
      salt,
      iterations,
      new Uint8Array(encryptedData),
      passwordBytes,
    );

    // Return as ArrayBuffer
    const result = new Uint8Array(decrypted.byteLength);

    result.set(decrypted);

    return toArrayBuffer(result);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine Management
// ─────────────────────────────────────────────────────────────────────────────

let instance: CryptoEngine | null = null;

/**
 * Get the singleton legacy crypto engine instance.
 */
export function getCryptoEngine(): CryptoEngine {
  if (!instance) {
    instance = new CryptoEngine();
  }

  return instance;
}

/**
 * Get the pkijs Crypto object, ensuring our custom engine is installed.
 *
 * Handles cases where pkijs engine might not be set yet, or where another
 * engine is already installed.
 */
export const getCrypto = () => {
  const engine = getCryptoEngine();

  if (!pkijs.engine || pkijs.engine.name !== engine.name) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    pkijs.setEngine(engine.name, engine as unknown as pkijs.ICryptoEngine);
  }

  return pkijs.getCrypto(true);
};
