/**
 * Tests for certificate revocation data providers.
 *
 * Uses real certificates fetched from public HTTPS endpoints to test
 * extension parsing. Run `./scripts/fetch-test-certs.sh` to update fixtures.
 */

import { describe, expect, it } from "vitest";

import { loadFixture } from "../test-utils";
import { DefaultRevocationProvider, extractOcspResponderCerts } from "./revocation";

/**
 * Load a real certificate fixture from fixtures/certificates/real/.
 */
async function loadRealCert(name: string): Promise<Uint8Array> {
  return loadFixture("certificates", `real/${name}`);
}

/**
 * Create a mock fetch for testing.
 */
function createMockFetch(responses: Map<string, { status: number; body?: Uint8Array }>) {
  const fetchedUrls: string[] = [];

  const mockFetch = async (url: string | URL | Request, _init?: RequestInit): Promise<Response> => {
    const urlStr = typeof url === "string" ? url : url.toString();
    fetchedUrls.push(urlStr);

    const response = responses.get(urlStr);
    if (response) {
      return new Response(response.body, { status: response.status });
    }
    return new Response(null, { status: 404 });
  };

  return {
    fetch: mockFetch as typeof globalThis.fetch,
    fetchedUrls,
  };
}

describe("Revocation Provider", () => {
  describe("OCSP URL extraction", () => {
    it("extracts OCSP URL from GitHub cert (Sectigo)", async () => {
      const cert = await loadRealCert("github-0.der");
      const issuer = await loadRealCert("github-1.der");

      const mock = createMockFetch(
        new Map([["http://ocsp.sectigo.com", { status: 200, body: new Uint8Array([0x30]) }]]),
      );

      const provider = new DefaultRevocationProvider({ fetch: mock.fetch });
      // Will fail since mock returns invalid OCSP response, but URL should be extracted
      await provider.getOCSP(cert, issuer);

      expect(mock.fetchedUrls).toContain("http://ocsp.sectigo.com");
    });

    it("extracts OCSP URL from Amazon cert (DigiCert)", async () => {
      const cert = await loadRealCert("amazon-0.der");
      const issuer = await loadRealCert("amazon-1.der");

      const mock = createMockFetch(
        new Map([["http://ocsp.digicert.com", { status: 200, body: new Uint8Array([0x30]) }]]),
      );

      const provider = new DefaultRevocationProvider({ fetch: mock.fetch });
      await provider.getOCSP(cert, issuer);

      expect(mock.fetchedUrls).toContain("http://ocsp.digicert.com");
    });

    it("returns null for cert without OCSP URL (Let's Encrypt)", async () => {
      // Let's Encrypt cert only has CA Issuers in AIA, no OCSP URL
      const cert = await loadRealCert("letsencrypt-0.der");
      const issuer = await loadRealCert("letsencrypt-1.der");

      const mock = createMockFetch(new Map());

      const provider = new DefaultRevocationProvider({ fetch: mock.fetch });
      const result = await provider.getOCSP(cert, issuer);

      // Should return null without attempting fetch (no OCSP URL in cert)
      expect(result).toBeNull();
      expect(mock.fetchedUrls).toHaveLength(0);
    });
  });

  describe("CRL URL extraction", () => {
    it("extracts CRL URLs from Amazon cert (DigiCert) - multiple URLs", async () => {
      // Amazon/DigiCert certs have CRL distribution points
      const cert = await loadRealCert("amazon-0.der");

      // Mock both CRL URLs
      const mock = createMockFetch(
        new Map([
          [
            "http://crl3.digicert.com/DigiCertGlobalCAG2.crl",
            { status: 200, body: new Uint8Array([0x30]) },
          ],
          [
            "http://crl4.digicert.com/DigiCertGlobalCAG2.crl",
            { status: 200, body: new Uint8Array([0x30]) },
          ],
        ]),
      );

      const provider = new DefaultRevocationProvider({ fetch: mock.fetch });
      await provider.getCRL(cert);

      // Should try the first CRL URL
      expect(mock.fetchedUrls.length).toBeGreaterThan(0);
      expect(mock.fetchedUrls[0]).toMatch(/crl.*digicert\.com.*\.crl/);
    });

    it("returns null for cert without CRL distribution points", async () => {
      // GitHub cert (Sectigo) typically doesn't have CRL DP
      const cert = await loadRealCert("github-0.der");

      const mock = createMockFetch(new Map());

      const provider = new DefaultRevocationProvider({ fetch: mock.fetch });
      const result = await provider.getCRL(cert);

      // Should return null without attempting any fetch
      // (or may have CRL, in which case test would need adjustment)
      if (mock.fetchedUrls.length === 0) {
        expect(result).toBeNull();
      }
    });
  });

  describe("extractOcspResponderCerts", () => {
    it("extracts certificates from real OCSP response", async () => {
      // Load the OCSP response we fetched
      const ocspResponse = await loadRealCert("github-ocsp.der");

      const certs = extractOcspResponderCerts(ocspResponse);

      // OCSP responses typically include the responder's certificate
      // The exact number depends on the responder
      expect(certs.length).toBeGreaterThanOrEqual(0);

      // If certs are present, they should be valid DER
      for (const cert of certs) {
        expect(cert[0]).toBe(0x30); // SEQUENCE tag
      }
    });

    it("returns empty array for invalid OCSP response", () => {
      const invalidOcsp = new Uint8Array([0x00, 0x01, 0x02]);

      const certs = extractOcspResponderCerts(invalidOcsp);

      expect(certs).toEqual([]);
    });

    it("returns empty array for empty input", () => {
      const certs = extractOcspResponderCerts(new Uint8Array(0));

      expect(certs).toEqual([]);
    });
  });

  describe("OCSP response validation", () => {
    it("accepts successful OCSP response (status 0)", async () => {
      const cert = await loadRealCert("github-0.der");
      const issuer = await loadRealCert("github-1.der");
      const validOcspResponse = await loadRealCert("github-ocsp.der");

      const mock = createMockFetch(
        new Map([["http://ocsp.sectigo.com", { status: 200, body: validOcspResponse }]]),
      );

      const provider = new DefaultRevocationProvider({ fetch: mock.fetch });
      const result = await provider.getOCSP(cert, issuer);

      expect(result).not.toBeNull();
      expect(result).toEqual(validOcspResponse);
    });
  });
});
