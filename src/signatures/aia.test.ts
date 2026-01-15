/**
 * Tests for AIA (Authority Information Access) certificate chain building.
 *
 * Uses real certificates fetched from public HTTPS endpoints to test
 * extension parsing. Run `./scripts/fetch-test-certs.sh` to update fixtures.
 */

import { describe, expect, it } from "vitest";

import { loadFixture } from "../test-utils";
import { buildCertificateChain } from "./aia";

/**
 * Load a real certificate fixture from fixtures/certificates/real/.
 */
async function loadRealCert(name: string): Promise<Uint8Array> {
  return loadFixture("certificates", `real/${name}`);
}

/**
 * Create a mock fetch that tracks URLs and returns certificates.
 */
function createMockFetch(responses: Map<number, Uint8Array>) {
  let callCount = 0;
  const fetchedUrls: string[] = [];

  const mockFetch = async (url: string | URL | Request): Promise<Response> => {
    const urlStr = typeof url === "string" ? url : url.toString();
    fetchedUrls.push(urlStr);
    const cert = responses.get(callCount++);
    if (cert) {
      return new Response(cert, {
        status: 200,
        headers: { "Content-Type": "application/pkix-cert" },
      });
    }
    return new Response(null, { status: 404 });
  };

  // Cast to match fetch signature
  return {
    fetch: mockFetch as typeof globalThis.fetch,
    fetchedUrls,
    getCallCount: () => callCount,
  };
}

describe("AIA Chain Building", () => {
  describe("getCaIssuersUrl parsing", () => {
    it("extracts CA Issuers URL from GitHub cert (Sectigo)", async () => {
      const cert = await loadRealCert("github-0.der");
      const issuerCert = await loadRealCert("github-1.der");

      const mock = createMockFetch(new Map([[0, issuerCert]]));
      await buildCertificateChain(cert, { fetch: mock.fetch, maxChainLength: 1 });

      expect(mock.fetchedUrls[0]).toBe(
        "http://crt.sectigo.com/SectigoPublicServerAuthenticationCADVE36.crt",
      );
    });

    it("extracts CA Issuers URL from Amazon cert (DigiCert)", async () => {
      const cert = await loadRealCert("amazon-0.der");
      const issuerCert = await loadRealCert("amazon-1.der");

      const mock = createMockFetch(new Map([[0, issuerCert]]));
      await buildCertificateChain(cert, { fetch: mock.fetch, maxChainLength: 1 });

      expect(mock.fetchedUrls[0]).toBe("http://cacerts.digicert.com/DigiCertGlobalCAG2.crt");
    });

    it("extracts CA Issuers URL from Cloudflare cert (Google Trust Services)", async () => {
      const cert = await loadRealCert("cloudflare-0.der");
      const issuerCert = await loadRealCert("cloudflare-1.der");

      const mock = createMockFetch(new Map([[0, issuerCert]]));
      await buildCertificateChain(cert, { fetch: mock.fetch, maxChainLength: 1 });

      expect(mock.fetchedUrls[0]).toBe("http://i.pki.goog/we1.crt");
    });

    it("extracts CA Issuers URL from Let's Encrypt cert (ISRG)", async () => {
      const cert = await loadRealCert("letsencrypt-0.der");
      const issuerCert = await loadRealCert("letsencrypt-1.der");

      const mock = createMockFetch(new Map([[0, issuerCert]]));
      await buildCertificateChain(cert, { fetch: mock.fetch, maxChainLength: 1 });

      expect(mock.fetchedUrls[0]).toBe("http://e7.i.lencr.org/");
    });
  });

  describe("self-signed detection", () => {
    it("detects Sectigo root CA as self-signed and stops", async () => {
      const rootCert = await loadRealCert("github-2.der");
      const mock = createMockFetch(new Map());

      const chain = await buildCertificateChain(rootCert, { fetch: mock.fetch });

      expect(mock.getCallCount()).toBe(0);
      expect(chain).toHaveLength(0);
    });

    it("detects DigiCert root as self-signed", async () => {
      const rootCert = await loadRealCert("amazon-2.der");
      const mock = createMockFetch(new Map());

      const chain = await buildCertificateChain(rootCert, { fetch: mock.fetch });

      expect(mock.getCallCount()).toBe(0);
      expect(chain).toHaveLength(0);
    });

    it("Google Trust Services R4 is cross-signed (not self-signed)", async () => {
      // GTS Root R4 is cross-signed by GlobalSign, so it has an AIA extension
      // This is different from a true self-signed root
      const crossSignedCert = await loadRealCert("cloudflare-2.der");

      // It will try to fetch the GlobalSign root
      const mock = createMockFetch(new Map());
      await buildCertificateChain(crossSignedCert, { fetch: mock.fetch }).catch(() => {
        // Expected to fail (404) since we don't provide the GlobalSign root
      });

      // The key point: it DOES attempt to fetch (unlike a true self-signed root)
      expect(mock.getCallCount()).toBe(1);
      expect(mock.fetchedUrls[0]).toContain("pki.goog");
    });
  });

  describe("chain building", () => {
    it("builds chain from leaf to root with mocked fetch", async () => {
      const leafCert = await loadRealCert("github-0.der");
      const intermediateCert = await loadRealCert("github-1.der");
      const rootCert = await loadRealCert("github-2.der");

      const mock = createMockFetch(
        new Map([
          [0, intermediateCert],
          [1, rootCert],
        ]),
      );

      const chain = await buildCertificateChain(leafCert, { fetch: mock.fetch });

      expect(mock.getCallCount()).toBe(2);
      expect(chain).toHaveLength(2);
    });

    it("uses existing chain and continues from last cert", async () => {
      const leafCert = await loadRealCert("github-0.der");
      const intermediateCert = await loadRealCert("github-1.der");
      const rootCert = await loadRealCert("github-2.der");

      const mock = createMockFetch(new Map([[0, rootCert]]));

      const chain = await buildCertificateChain(leafCert, {
        fetch: mock.fetch,
        existingChain: [intermediateCert],
      });

      // Should only fetch root (continuing from intermediate)
      expect(mock.getCallCount()).toBe(1);
      expect(chain).toHaveLength(2);
    });

    it("respects maxChainLength limit", async () => {
      const leafCert = await loadRealCert("github-0.der");
      const intermediateCert = await loadRealCert("github-1.der");

      const mock = createMockFetch(new Map([[0, intermediateCert]]));

      const chain = await buildCertificateChain(leafCert, {
        fetch: mock.fetch,
        maxChainLength: 1,
      });

      expect(chain).toHaveLength(1);
    });

    it("handles circular references gracefully", async () => {
      const leafCert = await loadRealCert("github-0.der");

      // Return the same cert every time (simulating circular reference)
      const mock = createMockFetch(new Map([[0, leafCert]]));

      const chain = await buildCertificateChain(leafCert, { fetch: mock.fetch });

      // Should stop when it sees the same cert again
      expect(mock.getCallCount()).toBe(1);
      expect(chain).toHaveLength(0);
    });
  });

  describe("error handling", () => {
    it("throws CertificateChainError on fetch failure", async () => {
      const leafCert = await loadRealCert("github-0.der");

      const mockFetch = async () => {
        throw new Error("Network error");
      };

      await expect(
        buildCertificateChain(leafCert, { fetch: mockFetch as unknown as typeof globalThis.fetch }),
      ).rejects.toThrow(/Failed to fetch issuer certificate/);
    });

    it("throws CertificateChainError on HTTP error", async () => {
      const leafCert = await loadRealCert("github-0.der");

      const mockFetch = async () => {
        return new Response(null, { status: 404, statusText: "Not Found" });
      };

      await expect(
        buildCertificateChain(leafCert, { fetch: mockFetch as unknown as typeof globalThis.fetch }),
      ).rejects.toThrow(/HTTP 404/);
    });

    it("throws CertificateChainError on invalid certificate response", async () => {
      const leafCert = await loadRealCert("github-0.der");

      const mockFetch = async () => {
        return new Response(new Uint8Array([0, 1, 2, 3]), {
          status: 200,
          headers: { "Content-Type": "application/pkix-cert" },
        });
      };

      await expect(
        buildCertificateChain(leafCert, { fetch: mockFetch as unknown as typeof globalThis.fetch }),
      ).rejects.toThrow(/Failed to parse issuer certificate/);
    });
  });
});
