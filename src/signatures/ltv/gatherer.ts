/**
 * LTV Data Gatherer - unified LTV data extraction from CMS structures.
 *
 * This class handles gathering all validation data needed for long-term
 * validation (LTV) from any CMS SignedData structure, whether it's a
 * signature or a timestamp token.
 *
 * ETSI EN 319 142-1: PAdES digital signatures
 * RFC 5652: Cryptographic Message Syntax (CMS)
 */

import { toArrayBuffer } from "#src/helpers/buffer.ts";
import { buildCertificateChain } from "#src/signatures/aia.ts";
import { OID_SIGNED_DATA, OID_TIMESTAMP_TOKEN } from "#src/signatures/oids.ts";
import {
  DefaultRevocationProvider,
  extractOcspResponderCerts,
} from "#src/signatures/revocation.ts";
import { CertificateChainError, type RevocationProvider } from "#src/signatures/types.ts";
import { fromBER } from "asn1js";
import * as pkijs from "pkijs";

import { computeSha1Hex } from "./vri";

/**
 * Warning encountered during LTV data gathering.
 */
export interface LtvWarning {
  /** Warning code for programmatic handling */
  code: string;

  /** Human-readable message */
  message: string;
}

/**
 * LTV data gathered from a CMS structure.
 */
export interface LtvData {
  /** The original CMS bytes (padded, for VRI key computation) */
  cmsBytes: Uint8Array;

  /** All certificates needed for validation (deduplicated) */
  certificates: Uint8Array[];

  /** OCSP responses for certificate validation */
  ocspResponses: Uint8Array[];

  /** CRLs for certificate validation */
  crls: Uint8Array[];

  /** Embedded timestamp tokens that need their own VRI entries */
  embeddedTimestamps: Uint8Array[];

  /** When the LTV data was gathered */
  timestamp: Date;

  /** Warnings encountered during gathering */
  warnings: LtvWarning[];
}

/**
 * Options for LtvDataGatherer.
 */
export interface LtvGathererOptions {
  /** Custom revocation provider (defaults to DefaultRevocationProvider) */
  revocationProvider?: RevocationProvider;

  /** Timeout for network requests in ms (default: 10000) */
  timeout?: number;

  /** Whether to recursively gather LTV for embedded timestamps (default: true) */
  gatherTimestampLtv?: boolean;

  /** Custom fetch implementation for testing */
  fetch?: typeof globalThis.fetch;
}

/**
 * Unified LTV data gatherer for CMS structures.
 *
 * Extracts all validation data needed for long-term validation from
 * signatures and timestamp tokens, including:
 * - Signer/TSA certificates and chains
 * - OCSP responses
 * - CRLs
 * - Embedded timestamp tokens
 *
 * @example
 * ```typescript
 * const gatherer = new LtvDataGatherer();
 * const ltvData = await gatherer.gather(signatureBytes);
 *
 * // Use ltvData with DSSBuilder to embed in PDF
 * ```
 */
export class LtvDataGatherer {
  private readonly revocationProvider: RevocationProvider;
  private readonly timeout: number;
  private readonly gatherTimestampLtv: boolean;
  private readonly fetchFn: typeof globalThis.fetch;

  /** Cache for revocation data (keyed by cert hash) */
  private readonly ocspCache = new Map<string, Uint8Array | null>();
  private readonly crlCache = new Map<string, Uint8Array | null>();

  constructor(options: LtvGathererOptions = {}) {
    this.revocationProvider = options.revocationProvider ?? new DefaultRevocationProvider();
    this.timeout = options.timeout ?? 10000;
    this.gatherTimestampLtv = options.gatherTimestampLtv ?? true;
    this.fetchFn = options.fetch ?? globalThis.fetch;
  }

  /**
   * Gather LTV data from CMS SignedData bytes.
   *
   * Works for both signatures and timestamp tokens since both are CMS.
   * Extracts signer certificate, builds chain via AIA, gathers revocation
   * data, and handles embedded timestamps.
   *
   * @param cmsBytes - DER-encoded CMS SignedData (may be zero-padded)
   * @returns LTV data ready for DSS embedding
   */
  async gather(cmsBytes: Uint8Array): Promise<LtvData> {
    const warnings: LtvWarning[] = [];
    const timestamp = new Date();

    // Strip zero-padding for parsing (but keep original for VRI key)
    const strippedCms = this.stripZeroPadding(cmsBytes);

    // Parse CMS structure
    const { signedData, certificates: embeddedCerts } = this.parseCms(strippedCms);

    // Get signer certificate
    const signerCert = this.extractSignerCertificate(signedData, embeddedCerts);

    if (!signerCert) {
      warnings.push({
        code: "NO_SIGNER_CERT",
        message: "Could not find signer certificate in CMS structure",
      });

      return {
        cmsBytes,
        certificates: embeddedCerts,
        ocspResponses: [],
        crls: [],
        embeddedTimestamps: [],
        timestamp,
        warnings,
      };
    }

    // Build certificate chain
    let chain: Uint8Array[];

    try {
      chain = await buildCertificateChain(signerCert, {
        existingChain: embeddedCerts.filter(c => !this.bytesEqual(c, signerCert)),
        fetch: this.fetchFn,
        timeout: this.timeout,
      });
    } catch (error) {
      chain = embeddedCerts.filter(c => !this.bytesEqual(c, signerCert));

      if (error instanceof CertificateChainError) {
        warnings.push({
          code: "CHAIN_INCOMPLETE",
          message: error.message,
        });
      }
    }

    // Full chain: signer + intermediates + root
    const fullChain = [signerCert, ...chain];

    // Extract embedded timestamps
    const embeddedTimestamps: Uint8Array[] = [];
    const timestampCerts: Uint8Array[] = [];

    if (this.gatherTimestampLtv) {
      const tsToken = this.extractTimestampToken(signedData);

      if (tsToken) {
        embeddedTimestamps.push(tsToken);

        // Extract TSA certificates
        try {
          const tsaCerts = await this.extractAndBuildTsaChain(tsToken, warnings);

          timestampCerts.push(...tsaCerts);
        } catch (error) {
          warnings.push({
            code: "TSA_CERT_EXTRACTION_FAILED",
            message: `Could not extract TSA certificates: ${error instanceof Error ? error.message : String(error)}`,
          });
        }
      }
    }

    // Gather revocation data for all certificates
    const ocspResponses: Uint8Array[] = [];
    const crls: Uint8Array[] = [];
    const ocspResponderCerts: Uint8Array[] = [];

    // Process signer's chain
    await this.gatherRevocationData(
      fullChain,
      ocspResponses,
      crls,
      ocspResponderCerts,
      warnings,
      "signer",
    );

    // Process TSA's chain (if present)
    if (timestampCerts.length > 0) {
      await this.gatherRevocationData(
        timestampCerts,
        ocspResponses,
        crls,
        ocspResponderCerts,
        warnings,
        "TSA",
      );
    }

    // Deduplicate all certificates
    const allCerts = await this.deduplicateCertificates([
      ...fullChain,
      ...timestampCerts,
      ...ocspResponderCerts,
    ]);

    return {
      cmsBytes,
      certificates: allCerts,
      ocspResponses,
      crls,
      embeddedTimestamps,
      timestamp,
      warnings,
    };
  }

  /**
   * Strip zero-padding from CMS bytes.
   *
   * PDF signature /Contents values are padded with zeros to the placeholder size.
   * We need to strip these for parsing while keeping the original for VRI keys.
   *
   * Instead of blindly removing trailing zeros (which could be valid DER data),
   * we parse the DER length prefix to determine the actual content length.
   */
  private stripZeroPadding(bytes: Uint8Array): Uint8Array {
    if (bytes.length < 2) {
      return bytes;
    }

    // ASN.1 DER: first byte is tag, second+ bytes are length
    // If length < 128, it's a single byte
    // If length >= 128, high bit is set and low bits indicate how many length bytes follow

    const lengthByte = bytes[1];

    if (lengthByte < 128) {
      // Short form: length is in the byte itself
      const totalLength = 2 + lengthByte;

      return bytes.subarray(0, Math.min(totalLength, bytes.length));
    }

    // Long form: low 7 bits tell how many bytes follow for the length
    const numLengthBytes = lengthByte & 0x7f;

    if (numLengthBytes === 0 || numLengthBytes > 4 || 2 + numLengthBytes > bytes.length) {
      // Invalid or indefinite length - return as-is
      return bytes;
    }

    // Read the length value from the following bytes
    let contentLength = 0;
    for (let i = 0; i < numLengthBytes; i++) {
      contentLength = (contentLength << 8) | bytes[2 + i];
    }

    const totalLength = 2 + numLengthBytes + contentLength;

    return bytes.subarray(0, Math.min(totalLength, bytes.length));
  }

  /**
   * Parse CMS SignedData and extract embedded certificates.
   */
  private parseCms(cmsBytes: Uint8Array): {
    signedData: pkijs.SignedData;
    certificates: Uint8Array[];
  } {
    const asn1 = fromBER(toArrayBuffer(cmsBytes));

    if (asn1.offset === -1) {
      throw new Error("Failed to parse CMS structure");
    }

    const contentInfo = new pkijs.ContentInfo({ schema: asn1.result });

    if (contentInfo.contentType !== OID_SIGNED_DATA) {
      throw new Error("CMS is not SignedData");
    }

    const signedData = new pkijs.SignedData({ schema: contentInfo.content });

    // Extract certificates
    const certificates: Uint8Array[] = [];

    if (signedData.certificates) {
      for (const cert of signedData.certificates) {
        if (cert instanceof pkijs.Certificate) {
          certificates.push(new Uint8Array(cert.toSchema().toBER(false)));
        }
      }
    }

    return { signedData, certificates };
  }

  /**
   * Extract signer certificate from SignedData.
   */
  private extractSignerCertificate(
    signedData: pkijs.SignedData,
    embeddedCerts: Uint8Array[],
  ): Uint8Array | null {
    if (signedData.signerInfos.length === 0) {
      return null;
    }

    const signerInfo = signedData.signerInfos[0];

    // Try to match by issuer/serial
    if (signerInfo.sid instanceof pkijs.IssuerAndSerialNumber) {
      const issuerDer = new Uint8Array(signerInfo.sid.issuer.toSchema().toBER(false));
      const serialDer = new Uint8Array(signerInfo.sid.serialNumber.valueBlock.valueHexView);

      for (const certDer of embeddedCerts) {
        try {
          const asn1 = fromBER(toArrayBuffer(certDer));

          if (asn1.offset === -1) {
            continue;
          }

          const cert = new pkijs.Certificate({ schema: asn1.result });
          const certIssuerDer = new Uint8Array(cert.issuer.toSchema().toBER(false));
          const certSerialDer = new Uint8Array(cert.serialNumber.valueBlock.valueHexView);

          if (
            this.bytesEqual(issuerDer, certIssuerDer) &&
            this.bytesEqual(serialDer, certSerialDer)
          ) {
            return certDer;
          }
        } catch {
          // Skip unparseable certs
        }
      }
    }

    // Fallback: return first certificate
    return embeddedCerts[0] ?? null;
  }

  /**
   * Extract timestamp token from SignerInfo unsigned attributes.
   */
  private extractTimestampToken(signedData: pkijs.SignedData): Uint8Array | null {
    if (signedData.signerInfos.length === 0) {
      return null;
    }

    const signerInfo = signedData.signerInfos[0];

    if (!signerInfo.unsignedAttrs) {
      return null;
    }

    for (const attr of signerInfo.unsignedAttrs.attributes) {
      if (attr.type === OID_TIMESTAMP_TOKEN && attr.values.length > 0) {
        return new Uint8Array(attr.values[0].toBER(false));
      }
    }

    return null;
  }

  /**
   * Extract TSA certificates and build chain.
   */
  private async extractAndBuildTsaChain(
    tsToken: Uint8Array,
    warnings: LtvWarning[],
  ): Promise<Uint8Array[]> {
    const { certificates: tsaCerts } = this.parseCms(tsToken);

    if (tsaCerts.length === 0) {
      return [];
    }

    // First cert is usually the TSA signing cert
    const tsaSignerCert = tsaCerts[0];

    try {
      const chain = await buildCertificateChain(tsaSignerCert, {
        existingChain: tsaCerts.slice(1),
        fetch: this.fetchFn,
        timeout: this.timeout,
      });

      return [tsaSignerCert, ...chain];
    } catch (error) {
      if (error instanceof CertificateChainError) {
        warnings.push({
          code: "TSA_CHAIN_INCOMPLETE",
          message: `TSA certificate chain incomplete: ${error.message}`,
        });
      }

      return tsaCerts;
    }
  }

  /**
   * Gather revocation data for a certificate chain.
   */
  private async gatherRevocationData(
    chain: Uint8Array[],
    ocspResponses: Uint8Array[],
    crls: Uint8Array[],
    ocspResponderCerts: Uint8Array[],
    warnings: LtvWarning[],
    chainName: string,
  ): Promise<void> {
    const provider = this.revocationProvider;

    for (let i = 0; i < chain.length; i++) {
      const cert = chain[i];
      const issuer = chain[i + 1]; // Next cert is issuer, undefined for root
      const certHash = await computeSha1Hex(cert);

      // Try OCSP first (with caching)
      if (issuer && provider.getOCSP) {
        // Check cache
        if (this.ocspCache.has(certHash)) {
          const cached = this.ocspCache.get(certHash);

          if (cached) {
            ocspResponses.push(cached);

            // Extract responder certs from cached response
            const responderCerts = extractOcspResponderCerts(cached);

            for (const responderCert of responderCerts) {
              ocspResponderCerts.push(responderCert);
            }

            continue;
          }
        }

        try {
          const ocsp = await provider.getOCSP(cert, issuer);

          this.ocspCache.set(certHash, ocsp);

          if (ocsp) {
            ocspResponses.push(ocsp);

            // Extract OCSP responder certificates for LTV validation
            const responderCerts = extractOcspResponderCerts(ocsp);

            for (const responderCert of responderCerts) {
              ocspResponderCerts.push(responderCert);
            }

            continue; // Got OCSP, no need for CRL
          }
        } catch {
          // OCSP failed, try CRL
          this.ocspCache.set(certHash, null);
        }
      }

      // Fall back to CRL (with caching)
      if (provider.getCRL) {
        // Check cache
        if (this.crlCache.has(certHash)) {
          const cached = this.crlCache.get(certHash);

          if (cached) {
            crls.push(cached);
          }

          continue;
        }

        try {
          const crl = await provider.getCRL(cert);

          this.crlCache.set(certHash, crl);

          if (crl) {
            crls.push(crl);
          }
        } catch {
          this.crlCache.set(certHash, null);

          warnings.push({
            code: "REVOCATION_UNAVAILABLE",
            message: `Could not fetch revocation data for ${chainName} certificate ${i + 1} in chain`,
          });
        }
      }
    }
  }

  /**
   * Deduplicate certificates by their DER content.
   */
  private async deduplicateCertificates(certs: Uint8Array[]): Promise<Uint8Array[]> {
    const seen = new Set<string>();
    const result: Uint8Array[] = [];

    for (const cert of certs) {
      const hash = await computeSha1Hex(cert);

      if (!seen.has(hash)) {
        seen.add(hash);
        result.push(cert);
      }
    }

    return result;
  }

  /**
   * Compare two byte arrays for equality.
   */
  private bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
      return false;
    }

    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }

    return true;
  }
}
