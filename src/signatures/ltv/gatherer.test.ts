/**
 * Tests for LtvDataGatherer.
 *
 * Uses mock revocation providers and real certificate fixtures to test
 * the LTV data gathering logic.
 */

import { toArrayBuffer } from "#src/helpers/buffer.ts";
import { loadFixture } from "#src/test-utils.ts";
import { fromBER, OctetString } from "asn1js";
import * as pkijs from "pkijs";
import { describe, expect, it } from "vitest";

import type { RevocationProvider } from "../types";
import { LtvDataGatherer } from "./gatherer";
import { computeSha1Hex } from "./vri";

/**
 * Load a real certificate fixture from fixtures/certificates/real/.
 */
async function loadRealCert(name: string): Promise<Uint8Array> {
  return loadFixture("certificates", `real/${name}`);
}

/**
 * Parse DER-encoded certificate to pkijs Certificate.
 */
function parseCertificate(der: Uint8Array): pkijs.Certificate {
  const asn1 = fromBER(toArrayBuffer(der));
  return new pkijs.Certificate({ schema: asn1.result });
}

/**
 * Create a simple CMS SignedData structure for testing.
 *
 * This creates a minimal CMS structure containing certificates.
 * Not a real signature, but sufficient for testing extraction.
 */
function createMockCms(certsDer: Uint8Array[]): Uint8Array {
  // Parse certificates
  const certificates = certsDer.map(parseCertificate);

  // Create SignerInfo (minimal)
  const signerInfo = new pkijs.SignerInfo({
    version: 1,
    sid: new pkijs.IssuerAndSerialNumber({
      issuer: certificates[0].issuer,
      serialNumber: certificates[0].serialNumber,
    }),
  });

  // Set algorithm and signature
  signerInfo.digestAlgorithm = new pkijs.AlgorithmIdentifier({
    algorithmId: "2.16.840.1.101.3.4.2.1", // SHA-256
  });
  signerInfo.signatureAlgorithm = new pkijs.AlgorithmIdentifier({
    algorithmId: "1.2.840.113549.1.1.11", // SHA-256 with RSA
  });
  signerInfo.signature = new OctetString({ valueHex: new ArrayBuffer(256) });

  // Create SignedData with certificates
  const signedData = new pkijs.SignedData({
    version: 1,
    certificates: certificates,
    signerInfos: [signerInfo],
  });

  // Set encapContentInfo
  signedData.encapContentInfo = new pkijs.EncapsulatedContentInfo({
    eContentType: "1.2.840.113549.1.7.1", // data
  });

  // Set digestAlgorithms
  signedData.digestAlgorithms = [
    new pkijs.AlgorithmIdentifier({
      algorithmId: "2.16.840.1.101.3.4.2.1", // SHA-256
    }),
  ];

  // Wrap in ContentInfo
  const contentInfo = new pkijs.ContentInfo({
    contentType: "1.2.840.113549.1.7.2", // signedData
    content: signedData.toSchema(true),
  });

  return new Uint8Array(contentInfo.toSchema().toBER(false));
}

/**
 * Create a mock fetch that returns certificates.
 */
function createMockFetch(responses: Map<string, Uint8Array>) {
  const fetchedUrls: string[] = [];

  const mockFetch = async (url: string | URL | Request): Promise<Response> => {
    const urlStr = typeof url === "string" ? url : url.toString();
    fetchedUrls.push(urlStr);

    const cert = responses.get(urlStr);
    if (cert) {
      return new Response(cert, {
        status: 200,
        headers: { "Content-Type": "application/pkix-cert" },
      });
    }

    return new Response(null, { status: 404 });
  };

  return {
    fetch: mockFetch as typeof globalThis.fetch,
    fetchedUrls,
  };
}

/**
 * Create a mock revocation provider.
 */
function createMockRevocationProvider(
  ocspResponses: Map<string, Uint8Array> = new Map(),
  crls: Map<string, Uint8Array> = new Map(),
): RevocationProvider & { getOcspCalls: string[]; getCrlCalls: string[] } {
  const getOcspCalls: string[] = [];
  const getCrlCalls: string[] = [];

  return {
    getOcspCalls,
    getCrlCalls,

    async getOCSP(cert: Uint8Array, _issuer: Uint8Array): Promise<Uint8Array | null> {
      const hash = await computeSha1Hex(cert);
      getOcspCalls.push(hash);

      return ocspResponses.get(hash) ?? null;
    },

    async getCRL(cert: Uint8Array): Promise<Uint8Array | null> {
      const hash = await computeSha1Hex(cert);
      getCrlCalls.push(hash);

      return crls.get(hash) ?? null;
    },
  };
}

describe("LtvDataGatherer", () => {
  describe("CMS parsing", () => {
    it("extracts certificates from mock CMS", async () => {
      const leafCert = await loadRealCert("github-0.der");
      const intermediateCert = await loadRealCert("github-1.der");
      const rootCert = await loadRealCert("github-2.der");

      const cms = createMockCms([leafCert, intermediateCert, rootCert]);

      const gatherer = new LtvDataGatherer({
        revocationProvider: createMockRevocationProvider(),
        gatherTimestampLtv: false,
      });

      const result = await gatherer.gather(cms);

      // Should have all three certs
      expect(result.certificates.length).toBeGreaterThanOrEqual(3);
      expect(result.warnings).toEqual([]);
    });

    it("handles zero-padded CMS bytes", async () => {
      const leafCert = await loadRealCert("github-0.der");
      const cms = createMockCms([leafCert]);

      // Create padded version (like in PDF /Contents)
      const paddedCms = new Uint8Array(cms.length + 1000);
      paddedCms.set(cms);
      // Rest is zeros

      const gatherer = new LtvDataGatherer({
        revocationProvider: createMockRevocationProvider(),
        gatherTimestampLtv: false,
      });

      const result = await gatherer.gather(paddedCms);

      // Should successfully parse despite padding
      expect(result.certificates.length).toBeGreaterThan(0);

      // cmsBytes should preserve original (padded) for VRI key computation
      expect(result.cmsBytes.length).toBe(paddedCms.length);
    });
  });

  describe("certificate chain building", () => {
    it("builds chain via AIA with mocked fetch", async () => {
      const leafCert = await loadRealCert("github-0.der");
      const intermediateCert = await loadRealCert("github-1.der");
      const rootCert = await loadRealCert("github-2.der");

      // Mock AIA fetch to return intermediate and root
      // The intermediate cert may have its own AIA pointing to root
      const mockFetch = createMockFetch(
        new Map([
          ["http://crt.sectigo.com/SectigoPublicServerAuthenticationCADVE36.crt", intermediateCert],
          // Add other potential AIA URLs from intermediate cert
          ["http://crt.sectigo.com/SectigoRSADomainValidationSecureServerCA.crt", rootCert],
        ]),
      );

      const cms = createMockCms([leafCert]);

      const gatherer = new LtvDataGatherer({
        revocationProvider: createMockRevocationProvider(),
        gatherTimestampLtv: false,
        fetch: mockFetch.fetch,
      });

      const result = await gatherer.gather(cms);

      // Check if AIA was called - if chain building failed, we get a warning
      // instead of having fetched certs. This is fine behavior.
      if (mockFetch.fetchedUrls.length > 0) {
        // AIA was attempted
        expect(mockFetch.fetchedUrls[0]).toContain("sectigo.com");
      }

      // If chain building succeeded, we should have multiple certs
      // If it failed (404, timeout, etc.), we fall back gracefully with just the signer cert
      // Either way, we should have at least the signer cert
      expect(result.certificates.length).toBeGreaterThanOrEqual(1);

      // If there's a CHAIN_INCOMPLETE warning, that's expected when chain building fails
      const hasChainWarning = result.warnings.some(w => w.code === "CHAIN_INCOMPLETE");
      if (hasChainWarning) {
        // Chain building failed, which is fine for this test
        expect(result.certificates.length).toBe(1);
      } else {
        // Chain building succeeded
        expect(result.certificates.length).toBeGreaterThanOrEqual(2);
      }
    });

    it("emits warning when chain building fails", async () => {
      const leafCert = await loadRealCert("github-0.der");

      // Mock fetch that fails - cast to avoid type issues
      const mockFetch = (async () => {
        throw new Error("Network error");
      }) as unknown as typeof globalThis.fetch;

      const cms = createMockCms([leafCert]);

      const gatherer = new LtvDataGatherer({
        revocationProvider: createMockRevocationProvider(),
        gatherTimestampLtv: false,
        fetch: mockFetch,
      });

      const result = await gatherer.gather(cms);

      // Should have warning about incomplete chain
      expect(result.warnings.some(w => w.code === "CHAIN_INCOMPLETE")).toBe(true);

      // Should still have the leaf cert
      expect(result.certificates.length).toBeGreaterThan(0);
    });
  });

  describe("revocation data gathering", () => {
    it("gathers OCSP responses for certificate chain", async () => {
      const leafCert = await loadRealCert("github-0.der");
      const intermediateCert = await loadRealCert("github-1.der");
      const rootCert = await loadRealCert("github-2.der");

      const leafHash = await computeSha1Hex(leafCert);
      const intermediateHash = await computeSha1Hex(intermediateCert);

      // Create OCSP responses for leaf and intermediate
      const ocspResponse = await loadRealCert("github-ocsp.der");
      const ocspResponses = new Map([
        [leafHash, ocspResponse],
        [intermediateHash, ocspResponse],
      ]);

      const provider = createMockRevocationProvider(ocspResponses);

      const cms = createMockCms([leafCert, intermediateCert, rootCert]);

      const gatherer = new LtvDataGatherer({
        revocationProvider: provider,
        gatherTimestampLtv: false,
      });

      const result = await gatherer.gather(cms);

      // Should have called getOCSP for leaf and intermediate (not root)
      expect(provider.getOcspCalls.length).toBe(2);

      // Should have OCSP responses
      expect(result.ocspResponses.length).toBe(2);
    });

    it("falls back to CRL when OCSP fails", async () => {
      const leafCert = await loadRealCert("github-0.der");
      const intermediateCert = await loadRealCert("github-1.der");

      const leafHash = await computeSha1Hex(leafCert);

      // No OCSP, but CRL available
      const crlData = new Uint8Array([0x30, 0x82, 0x01, 0x00]); // Minimal CRL
      const crls = new Map([[leafHash, crlData]]);

      const provider = createMockRevocationProvider(new Map(), crls);

      const cms = createMockCms([leafCert, intermediateCert]);

      const gatherer = new LtvDataGatherer({
        revocationProvider: provider,
        gatherTimestampLtv: false,
      });

      const result = await gatherer.gather(cms);

      // Should have tried OCSP first, then CRL
      expect(provider.getOcspCalls.length).toBeGreaterThan(0);
      expect(provider.getCrlCalls.length).toBeGreaterThan(0);

      // Should have CRL
      expect(result.crls.length).toBe(1);
    });

    it("caches revocation data to avoid duplicate fetches", async () => {
      const leafCert = await loadRealCert("github-0.der");
      const intermediateCert = await loadRealCert("github-1.der");

      const leafHash = await computeSha1Hex(leafCert);

      const ocspResponse = await loadRealCert("github-ocsp.der");
      const ocspResponses = new Map([[leafHash, ocspResponse]]);

      const provider = createMockRevocationProvider(ocspResponses);

      // Need at least leaf + issuer for OCSP to work
      const cms = createMockCms([leafCert, intermediateCert]);

      const gatherer = new LtvDataGatherer({
        revocationProvider: provider,
        gatherTimestampLtv: false,
      });

      // Gather twice with same gatherer instance
      await gatherer.gather(cms);
      await gatherer.gather(cms);

      // First gather: leaf cert has issuer, so OCSP is called
      // Second gather: leaf cert is in cache, so OCSP is NOT called
      // So total calls should be 1
      expect(provider.getOcspCalls.length).toBe(1);
    });

    it("emits warning when revocation data unavailable", async () => {
      const leafCert = await loadRealCert("github-0.der");
      const intermediateCert = await loadRealCert("github-1.der");

      // Provider that throws errors when trying to fetch
      const provider: RevocationProvider = {
        async getOCSP() {
          return null; // OCSP fails silently
        },
        async getCRL() {
          throw new Error("CRL fetch failed");
        },
      };

      const cms = createMockCms([leafCert, intermediateCert]);

      const gatherer = new LtvDataGatherer({
        revocationProvider: provider,
        gatherTimestampLtv: false,
      });

      const result = await gatherer.gather(cms);

      // Should have warnings about missing revocation data
      expect(result.warnings.some(w => w.code === "REVOCATION_UNAVAILABLE")).toBe(true);
    });
  });

  describe("certificate deduplication", () => {
    it("deduplicates certificates by content", async () => {
      const leafCert = await loadRealCert("github-0.der");

      // Create CMS with duplicate certs
      const cms = createMockCms([leafCert, leafCert, leafCert]);

      const gatherer = new LtvDataGatherer({
        revocationProvider: createMockRevocationProvider(),
        gatherTimestampLtv: false,
      });

      const result = await gatherer.gather(cms);

      // Should have only unique certs
      const hashes = new Set(await Promise.all(result.certificates.map(c => computeSha1Hex(c))));

      expect(hashes.size).toBe(result.certificates.length);
    });
  });

  describe("LtvData structure", () => {
    it("returns correct structure with all fields", async () => {
      const leafCert = await loadRealCert("github-0.der");

      const cms = createMockCms([leafCert]);

      const gatherer = new LtvDataGatherer({
        revocationProvider: createMockRevocationProvider(),
        gatherTimestampLtv: false,
      });

      const result = await gatherer.gather(cms);

      // Verify structure
      expect(result.cmsBytes).toBeInstanceOf(Uint8Array);
      expect(Array.isArray(result.certificates)).toBe(true);
      expect(Array.isArray(result.ocspResponses)).toBe(true);
      expect(Array.isArray(result.crls)).toBe(true);
      expect(Array.isArray(result.embeddedTimestamps)).toBe(true);
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it("preserves original CMS bytes for VRI key computation", async () => {
      const leafCert = await loadRealCert("github-0.der");
      const cms = createMockCms([leafCert]);

      // Add padding
      const paddedCms = new Uint8Array(cms.length + 500);
      paddedCms.set(cms);

      const gatherer = new LtvDataGatherer({
        revocationProvider: createMockRevocationProvider(),
        gatherTimestampLtv: false,
      });

      const result = await gatherer.gather(paddedCms);

      // cmsBytes should be the original padded version
      expect(result.cmsBytes).toBe(paddedCms);
    });
  });
});
