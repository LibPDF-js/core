/**
 * Certificate revocation data providers.
 *
 * Provides OCSP responses and CRLs for long-term validation (LTV).
 * Used for PAdES B-LT level to embed validation data in the PDF.
 *
 * RFC 6960: X.509 Internet Public Key Infrastructure OCSP
 * RFC 5280: X.509 Certificate and CRL Profile
 */

import { fromBER, ObjectIdentifier, OctetString, Sequence } from "asn1js";
import * as pkijs from "pkijs";

import { toArrayBuffer } from "../helpers/buffer";
import { getCrypto } from "./crypto";
import {
  OID_AD_OCSP,
  OID_AUTHORITY_INFO_ACCESS,
  OID_CRL_DISTRIBUTION_POINTS,
  OID_SHA1,
} from "./oids";
import type { RevocationProvider } from "./types";
import { RevocationError } from "./types";

/**
 * Options for DefaultRevocationProvider.
 */
export interface DefaultRevocationProviderOptions {
  /**
   * Request timeout in milliseconds.
   * @default 15000
   */
  timeout?: number;

  /**
   * Custom fetch implementation.
   */
  fetch?: typeof globalThis.fetch;

  /**
   * Whether to fetch CRLs if OCSP fails or is unavailable.
   * @default true
   */
  fallbackToCrl?: boolean;
}

/**
 * Default revocation provider that fetches OCSP responses and CRLs
 * from URLs embedded in certificates.
 *
 * @example
 * ```typescript
 * const provider = new DefaultRevocationProvider();
 * const ocsp = await provider.getOCSP(cert, issuer);
 * const crl = await provider.getCRL(cert);
 * ```
 */
export class DefaultRevocationProvider implements RevocationProvider {
  private readonly timeout: number;
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(options: DefaultRevocationProviderOptions = {}) {
    this.timeout = options.timeout ?? 15000;
    this.fetchFn = options.fetch ?? globalThis.fetch;
  }

  /**
   * Get OCSP response for a certificate.
   *
   * @param cert - DER-encoded certificate to check
   * @param issuer - DER-encoded issuer certificate
   * @returns DER-encoded OCSPResponse, or null if unavailable
   */
  async getOCSP(cert: Uint8Array, issuer: Uint8Array): Promise<Uint8Array | null> {
    try {
      // Parse certificates
      const certObj = this.parseCertificate(cert);
      const issuerObj = this.parseCertificate(issuer);

      // Get OCSP responder URL from certificate
      const ocspUrl = this.getOcspUrl(certObj);
      if (!ocspUrl) {
        return null;
      }

      // Build OCSP request
      const request = await this.buildOcspRequest(certObj, issuerObj);

      // Send request
      const response = await this.sendOcspRequest(ocspUrl, request);

      return response;
    } catch (error) {
      console.warn(`Could not get OCSP for certificate`);
      console.warn(error);

      // OCSP is optional - return null on failure
      return null;
    }
  }

  /**
   * Get CRL for a certificate.
   *
   * @param cert - DER-encoded certificate
   * @returns DER-encoded CRL, or null if unavailable
   */
  async getCRL(cert: Uint8Array): Promise<Uint8Array | null> {
    try {
      // Parse certificate
      const certObj = this.parseCertificate(cert);

      // Get CRL distribution point URLs
      const crlUrls = this.getCrlUrls(certObj);

      if (crlUrls.length === 0) {
        return null;
      }

      // Try each URL until one works
      for (const url of crlUrls) {
        try {
          const crl = await this.fetchCrl(url);

          if (crl) {
            return crl;
          }
        } catch (error) {
          console.warn(`Could not fetch CRL from ${url}`);
          console.warn(error);
        }
      }

      return null;
    } catch (error) {
      console.warn(`Could not fetch CRL from certificate`);
      console.warn(error);

      return null;
    }
  }

  /**
   * Parse a DER-encoded certificate.
   */
  private parseCertificate(der: Uint8Array): pkijs.Certificate {
    const asn1 = fromBER(toArrayBuffer(der));

    if (asn1.offset === -1) {
      throw new Error("Failed to parse certificate");
    }

    return new pkijs.Certificate({ schema: asn1.result });
  }

  /**
   * Get OCSP responder URL from certificate's Authority Information Access extension.
   *
   * Uses pkijs.InfoAccess for parsing.
   */
  private getOcspUrl(cert: pkijs.Certificate): string | null {
    const aiaExtension = cert.extensions?.find(ext => ext.extnID === OID_AUTHORITY_INFO_ACCESS);

    if (!aiaExtension) {
      return null;
    }

    try {
      const aiaAsn1 = fromBER(
        toArrayBuffer(new Uint8Array(aiaExtension.extnValue.valueBlock.valueHexView)),
      );

      if (aiaAsn1.offset === -1) {
        return null;
      }

      const infoAccess = new pkijs.InfoAccess({ schema: aiaAsn1.result });

      for (const desc of infoAccess.accessDescriptions) {
        // OCSP OID: 1.3.6.1.5.5.7.48.1
        if (desc.accessMethod === OID_AD_OCSP) {
          const location = desc.accessLocation as { type?: number; value?: string };
          // type 6 = uniformResourceIdentifier
          if (location.type === 6 && location.value) {
            return location.value;
          }
        }
      }
    } catch (error) {
      console.warn(`Could not parse AIA extension:`, error);
      return null;
    }

    return null;
  }

  /**
   * Get CRL distribution point URLs from certificate.
   *
   * Uses pkijs.CRLDistributionPoints for parsing.
   */
  private getCrlUrls(cert: pkijs.Certificate): string[] {
    const urls: string[] = [];

    const crlExtension = cert.extensions?.find(ext => ext.extnID === OID_CRL_DISTRIBUTION_POINTS);

    if (!crlExtension) {
      return urls;
    }

    try {
      const crlAsn1 = fromBER(
        toArrayBuffer(new Uint8Array(crlExtension.extnValue.valueBlock.valueHexView)),
      );

      if (crlAsn1.offset === -1) {
        return urls;
      }

      const crlDPs = new pkijs.CRLDistributionPoints({ schema: crlAsn1.result });

      for (const dp of crlDPs.distributionPoints) {
        // distributionPoint is an array of GeneralName objects
        const names = dp.distributionPoint;
        if (Array.isArray(names)) {
          for (const name of names) {
            const gn = name as { type?: number; value?: string };
            // type 6 = uniformResourceIdentifier
            if (gn.type === 6 && gn.value) {
              urls.push(gn.value);
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Could not parse CRL distribution points:`, error);
    }

    return urls;
  }

  /**
   * Build an OCSP request.
   */
  private async buildOcspRequest(
    cert: pkijs.Certificate,
    issuer: pkijs.Certificate,
  ): Promise<Uint8Array> {
    const crypto = getCrypto();

    // Use SHA-1 for OCSP certID hashes.
    // While SHA-1 is deprecated for signatures, it's widely required for OCSP
    // because many responders (including DigiCert) only support SHA-1 for certID.
    // This is acceptable since the hash is for identification, not security.
    const issuerNameHash = await crypto.digest(
      { name: "SHA-1" },
      issuer.subject.toSchema().toBER(false),
    );

    // Hash the issuer's public key
    const issuerKeyHash = await crypto.digest(
      { name: "SHA-1" },
      toArrayBuffer(
        new Uint8Array(issuer.subjectPublicKeyInfo.subjectPublicKey.valueBlock.valueHexView),
      ),
    );

    // Build CertID
    const certId = new Sequence({
      value: [
        // hashAlgorithm
        new Sequence({
          value: [new ObjectIdentifier({ value: OID_SHA1 })],
        }),
        // issuerNameHash
        new OctetString({ valueHex: issuerNameHash }),
        // issuerKeyHash
        new OctetString({ valueHex: issuerKeyHash }),
        // serialNumber
        cert.serialNumber,
      ],
    });

    // Build Request (single certificate)
    const request = new Sequence({
      value: [certId],
    });

    // Build TBSRequest
    const tbsRequest = new Sequence({
      value: [
        // requestList
        new Sequence({ value: [request] }),
      ],
    });

    // Build OCSPRequest
    const ocspRequest = new Sequence({
      value: [tbsRequest],
    });

    return new Uint8Array(ocspRequest.toBER(false));
  }

  /**
   * Send OCSP request and get response.
   */
  private async sendOcspRequest(url: string, request: Uint8Array): Promise<Uint8Array> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      // Try POST first (preferred)
      const response = await this.fetchFn(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/ocsp-request",
          Accept: "application/ocsp-response",
        },
        body: request,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new RevocationError(`OCSP request failed: HTTP ${response.status}`);
      }

      const data = await response.arrayBuffer();
      const ocspResponse = new Uint8Array(data);

      // Validate OCSP response status
      // OCSPResponse ::= SEQUENCE { responseStatus OCSPResponseStatus, ... }
      // OCSPResponseStatus: 0=successful, 1=malformed, 2=internalError, 3=tryLater, 5=sigRequired, 6=unauthorized
      if (!this.isOcspResponseSuccessful(ocspResponse)) {
        throw new RevocationError(`OCSP response status is not successful`);
      }

      return ocspResponse;
    } catch (error) {
      clearTimeout(timeoutId);

      throw error;
    }
  }

  /**
   * Check if OCSP response has successful status.
   *
   * Per RFC 6960, OCSPResponse starts with responseStatus ENUMERATED.
   * Only status 0 (successful) means the response contains actual revocation data.
   */
  private isOcspResponseSuccessful(response: Uint8Array): boolean {
    try {
      // Parse OCSP response to check status
      // OCSPResponse ::= SEQUENCE { responseStatus ENUMERATED, responseBytes [0] OPTIONAL }
      const asn1 = fromBER(toArrayBuffer(response));
      if (asn1.offset === -1) {
        return false;
      }

      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const seq = asn1.result as Sequence;

      if (!(seq instanceof Sequence) || seq.valueBlock.value.length < 1) {
        return false;
      }

      // First element is responseStatus (ENUMERATED)
      const statusElement = seq.valueBlock.value[0];
      if (statusElement.idBlock.tagNumber !== 10) {
        // Not ENUMERATED
        return false;
      }

      // Get the status value
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const statusValue = (statusElement as any).valueBlock?.valueDec ?? -1;

      // Only status 0 (successful) is valid
      return statusValue === 0;
    } catch {
      return false;
    }
  }

  /**
   * Fetch a CRL from URL.
   */
  private async fetchCrl(url: string): Promise<Uint8Array | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await this.fetchFn(url, {
        method: "GET",
        headers: {
          Accept: "application/pkix-crl, application/x-pkcs7-crl",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      const data = await response.arrayBuffer();

      return new Uint8Array(data);
    } catch {
      clearTimeout(timeoutId);

      return null;
    }
  }
}

/**
 * Extract certificates from an OCSP response.
 *
 * OCSP responses can contain the responder's certificate (and its chain)
 * in the BasicOCSPResponse.certs field. These certificates are needed
 * for LTV to verify the OCSP response signature.
 *
 * @param ocspResponse - DER-encoded OCSP response
 * @returns Array of DER-encoded certificates found in the response
 */
export function extractOcspResponderCerts(ocspResponse: Uint8Array): Uint8Array[] {
  const certs: Uint8Array[] = [];

  try {
    const asn1 = fromBER(toArrayBuffer(ocspResponse));
    if (asn1.offset === -1) {
      return certs;
    }

    const ocspResp = new pkijs.OCSPResponse({ schema: asn1.result });

    // Check if response has responseBytes
    if (!ocspResp.responseBytes) {
      return certs;
    }

    // Parse the BasicOCSPResponse from responseBytes.response
    const basicAsn1 = fromBER(
      toArrayBuffer(new Uint8Array(ocspResp.responseBytes.response.valueBlock.valueHexView)),
    );
    if (basicAsn1.offset === -1) {
      return certs;
    }

    const basicResp = new pkijs.BasicOCSPResponse({ schema: basicAsn1.result });

    // Extract certificates from the certs field
    if (basicResp.certs && basicResp.certs.length > 0) {
      for (const cert of basicResp.certs) {
        const certDer = new Uint8Array(cert.toSchema().toBER(false));
        certs.push(certDer);
      }
    }
  } catch {
    // Ignore parsing errors
  }

  return certs;
}
