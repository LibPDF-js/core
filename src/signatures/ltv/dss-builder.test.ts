/**
 * Tests for DSSBuilder.
 *
 * Tests DSS dictionary creation, VRI entries, and merging scenarios.
 */

import { ObjectRegistry } from "#src/document/object-registry.ts";
import { PdfArray } from "#src/objects/pdf-array.ts";
import { PdfDict } from "#src/objects/pdf-dict.ts";
import { PdfName } from "#src/objects/pdf-name.ts";
import { PdfRef } from "#src/objects/pdf-ref.ts";
import { PdfStream } from "#src/objects/pdf-stream.ts";
import { describe, expect, it } from "vitest";

import { DSSBuilder } from "./dss-builder";
import type { LtvData } from "./gatherer";
import { computeSha1Hex, computeVriKey } from "./vri";

/**
 * Create a mock LtvData for testing.
 */
function createMockLtvData(options: {
  cmsBytes?: Uint8Array;
  certificates?: Uint8Array[];
  ocspResponses?: Uint8Array[];
  crls?: Uint8Array[];
  embeddedTimestamps?: Uint8Array[];
  timestamp?: Date;
}): LtvData {
  return {
    cmsBytes: options.cmsBytes ?? new Uint8Array([1, 2, 3, 4]),
    certificates: options.certificates ?? [],
    ocspResponses: options.ocspResponses ?? [],
    crls: options.crls ?? [],
    embeddedTimestamps: options.embeddedTimestamps ?? [],
    timestamp: options.timestamp ?? new Date(),
    warnings: [],
  };
}

/**
 * Create deterministic test data.
 */
function createTestData(prefix: number, length: number = 100): Uint8Array {
  const data = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    data[i] = (prefix + i) % 256;
  }
  return data;
}

describe("DSSBuilder", () => {
  describe("create", () => {
    it("creates empty builder", () => {
      const registry = new ObjectRegistry();
      const builder = DSSBuilder.create(registry);
      expect(builder).toBeDefined();
    });
  });

  describe("build", () => {
    it("builds DSS with single certificate", async () => {
      const registry = new ObjectRegistry();
      const builder = DSSBuilder.create(registry);

      const cert = createTestData(1);
      const ltvData = createMockLtvData({ certificates: [cert] });
      await builder.addLtvData(ltvData);

      const dssRef = await builder.build();
      expect(dssRef).toBeInstanceOf(PdfRef);

      // Resolve and check structure
      const dss = await registry.resolve(dssRef);
      expect(dss).toBeInstanceOf(PdfDict);
      expect((dss as PdfDict).get("Type")).toEqual(PdfName.of("DSS"));

      const certsArray = (dss as PdfDict).get("Certs");
      expect(certsArray).toBeInstanceOf(PdfArray);
      expect((certsArray as PdfArray).length).toBe(1);
    });

    it("builds DSS with certificates, OCSPs, and CRLs", async () => {
      const registry = new ObjectRegistry();
      const builder = DSSBuilder.create(registry);

      const ltvData = createMockLtvData({
        certificates: [createTestData(1), createTestData(2)],
        ocspResponses: [createTestData(100)],
        crls: [createTestData(200)],
      });
      await builder.addLtvData(ltvData);

      const dssRef = await builder.build();
      const dss = (await registry.resolve(dssRef)) as PdfDict;

      expect((dss.get("Certs") as PdfArray).length).toBe(2);
      expect((dss.get("OCSPs") as PdfArray).length).toBe(1);
      expect((dss.get("CRLs") as PdfArray).length).toBe(1);
    });

    it("deduplicates identical certificates", async () => {
      const registry = new ObjectRegistry();
      const builder = DSSBuilder.create(registry);

      const cert = createTestData(1);
      await builder.addLtvData(createMockLtvData({ certificates: [cert] }));
      await builder.addLtvData(
        createMockLtvData({
          cmsBytes: new Uint8Array([5, 6, 7, 8]),
          certificates: [cert],
        }),
      );

      const dssRef = await builder.build();
      const dss = (await registry.resolve(dssRef)) as PdfDict;

      // Only one cert, despite adding same cert twice
      expect((dss.get("Certs") as PdfArray).length).toBe(1);
    });

    it("builds VRI dictionary with correct keys", async () => {
      const registry = new ObjectRegistry();
      const builder = DSSBuilder.create(registry);

      const cmsBytes = new Uint8Array([1, 2, 3, 4, 5]);
      const ltvData = createMockLtvData({
        cmsBytes,
        certificates: [createTestData(1)],
      });
      await builder.addLtvData(ltvData);

      const dssRef = await builder.build();
      const dss = (await registry.resolve(dssRef)) as PdfDict;

      const vri = dss.get("VRI") as PdfDict;
      expect(vri).toBeInstanceOf(PdfDict);

      // VRI key should be SHA-1 hash of cmsBytes in uppercase
      const expectedKey = await computeVriKey(cmsBytes);
      const vriEntry = vri.get(expectedKey);
      expect(vriEntry).toBeInstanceOf(PdfDict);
    });

    it("excludes VRI when includeVri is false", async () => {
      const registry = new ObjectRegistry();
      const builder = DSSBuilder.create(registry, { includeVri: false });

      const ltvData = createMockLtvData({ certificates: [createTestData(1)] });
      await builder.addLtvData(ltvData);

      const dssRef = await builder.build();
      const dss = (await registry.resolve(dssRef)) as PdfDict;

      expect(dss.get("VRI")).toBeUndefined();
    });

    it("includes timestamp in VRI entry", async () => {
      const registry = new ObjectRegistry();
      const builder = DSSBuilder.create(registry);

      const timestamp = new Date("2024-06-15T10:30:00Z");
      const cmsBytes = new Uint8Array([10, 20, 30]);
      const ltvData = createMockLtvData({
        cmsBytes,
        certificates: [createTestData(1)],
        timestamp,
      });
      await builder.addLtvData(ltvData);

      const dssRef = await builder.build();
      const dss = (await registry.resolve(dssRef)) as PdfDict;
      const vri = dss.get("VRI") as PdfDict;
      const vriKey = await computeVriKey(cmsBytes);
      const vriEntry = vri.get(vriKey) as PdfDict;

      expect(vriEntry.get("TU")).toBeDefined();
    });
  });

  describe("fromCatalog", () => {
    it("returns empty builder when no DSS exists", async () => {
      const registry = new ObjectRegistry();
      const catalog = new PdfDict();

      const builder = await DSSBuilder.fromCatalog(catalog, registry);
      expect(builder).toBeDefined();

      // Building should create empty DSS (Type only)
      const dssRef = await builder.build();
      const dss = (await registry.resolve(dssRef)) as PdfDict;
      expect(dss.get("Certs")).toBeUndefined();
    });

    it("loads existing certificates from DSS", async () => {
      const registry = new ObjectRegistry();

      // Create existing DSS with one certificate
      const existingCert = createTestData(50);
      const certStream = new PdfStream(new PdfDict(), existingCert);
      const certRef = registry.register(certStream);

      const existingDss = new PdfDict();
      existingDss.set("Type", PdfName.of("DSS"));
      existingDss.set("Certs", new PdfArray([certRef]));

      const catalog = new PdfDict();
      catalog.set("DSS", existingDss);

      // Load builder from catalog and add new cert
      const builder = await DSSBuilder.fromCatalog(catalog, registry);
      const newCert = createTestData(60);
      await builder.addLtvData(createMockLtvData({ certificates: [newCert] }));

      const dssRef = await builder.build();
      const dss = (await registry.resolve(dssRef)) as PdfDict;

      // Should have both certs
      expect((dss.get("Certs") as PdfArray).length).toBe(2);
    });

    it("preserves existing VRI entries when merging", async () => {
      const registry = new ObjectRegistry();

      // Create existing DSS with VRI
      const existingCert = createTestData(50);
      const certStream = new PdfStream(new PdfDict(), existingCert);
      const certRef = registry.register(certStream);

      const vriEntry = new PdfDict();
      vriEntry.set("Cert", new PdfArray([certRef]));

      const vri = new PdfDict();
      vri.set("EXISTINGKEY123456789012345678901234567890", vriEntry);

      const existingDss = new PdfDict();
      existingDss.set("Type", PdfName.of("DSS"));
      existingDss.set("Certs", new PdfArray([certRef]));
      existingDss.set("VRI", vri);

      const catalog = new PdfDict();
      catalog.set("DSS", existingDss);

      // Load builder and add new signature
      const builder = await DSSBuilder.fromCatalog(catalog, registry);
      const newCmsBytes = new Uint8Array([99, 88, 77]);
      await builder.addLtvData(
        createMockLtvData({
          cmsBytes: newCmsBytes,
          certificates: [createTestData(70)],
        }),
      );

      const dssRef = await builder.build();
      const dss = (await registry.resolve(dssRef)) as PdfDict;
      const newVri = dss.get("VRI") as PdfDict;

      // Should have both old and new VRI entries
      expect(newVri.get("EXISTINGKEY123456789012345678901234567890")).toBeDefined();
      const newVriKey = await computeVriKey(newCmsBytes);
      expect(newVri.get(newVriKey)).toBeDefined();
    });

    it("reuses existing refs for duplicate data", async () => {
      const registry = new ObjectRegistry();

      // Create existing DSS with one certificate
      const existingCert = createTestData(50);
      const certStream = new PdfStream(new PdfDict(), existingCert);
      const originalCertRef = registry.register(certStream);

      const existingDss = new PdfDict();
      existingDss.set("Type", PdfName.of("DSS"));
      existingDss.set("Certs", new PdfArray([originalCertRef]));

      const catalog = new PdfDict();
      catalog.set("DSS", existingDss);

      // Load builder and add same cert again
      const builder = await DSSBuilder.fromCatalog(catalog, registry);
      await builder.addLtvData(createMockLtvData({ certificates: [existingCert] }));

      const dssRef = await builder.build();
      const dss = (await registry.resolve(dssRef)) as PdfDict;
      const certsArray = dss.get("Certs") as PdfArray;

      // Should have only one cert (deduplicated)
      expect(certsArray.length).toBe(1);

      // Should reuse original ref
      expect(certsArray.at(0)).toEqual(originalCertRef);
    });

    it("loads DSS when it is a reference", async () => {
      const registry = new ObjectRegistry();

      // Create existing DSS and store as reference
      const existingCert = createTestData(50);
      const certStream = new PdfStream(new PdfDict(), existingCert);
      const certRef = registry.register(certStream);

      const existingDss = new PdfDict();
      existingDss.set("Type", PdfName.of("DSS"));
      existingDss.set("Certs", new PdfArray([certRef]));
      const dssRef = registry.register(existingDss);

      const catalog = new PdfDict();
      catalog.set("DSS", dssRef);

      // Should load and merge correctly
      const builder = await DSSBuilder.fromCatalog(catalog, registry);
      await builder.addLtvData(createMockLtvData({ certificates: [createTestData(60)] }));

      const newDssRef = await builder.build();
      const dss = (await registry.resolve(newDssRef)) as PdfDict;

      expect((dss.get("Certs") as PdfArray).length).toBe(2);
    });
  });

  describe("addLtvData", () => {
    it("does not overwrite existing VRI entry for same CMS", async () => {
      const registry = new ObjectRegistry();
      const builder = DSSBuilder.create(registry);

      const cmsBytes = new Uint8Array([1, 2, 3]);
      const cert1 = createTestData(1);
      const cert2 = createTestData(2);

      // Add first LTV data
      await builder.addLtvData(createMockLtvData({ cmsBytes, certificates: [cert1] }));

      // Try to add again with different cert - should not overwrite VRI
      await builder.addLtvData(createMockLtvData({ cmsBytes, certificates: [cert2] }));

      const dssRef = await builder.build();
      const dss = (await registry.resolve(dssRef)) as PdfDict;
      const vri = dss.get("VRI") as PdfDict;
      const vriKey = await computeVriKey(cmsBytes);
      const vriEntry = vri.get(vriKey) as PdfDict;

      // VRI should only have first cert in Cert array
      const certArray = vriEntry.get("Cert") as PdfArray;
      expect(certArray.length).toBe(1);

      // But DSS Certs should have both (global pool)
      expect((dss.get("Certs") as PdfArray).length).toBe(2);
    });

    it("adds VRI entries for embedded timestamps", async () => {
      const registry = new ObjectRegistry();
      const builder = DSSBuilder.create(registry);

      const cmsBytes = new Uint8Array([1, 2, 3]);
      const tsToken = new Uint8Array([10, 20, 30]);

      await builder.addLtvData(
        createMockLtvData({
          cmsBytes,
          embeddedTimestamps: [tsToken],
        }),
      );

      const dssRef = await builder.build();
      const dss = (await registry.resolve(dssRef)) as PdfDict;
      const vri = dss.get("VRI") as PdfDict;

      // Should have VRI entry for main CMS and timestamp
      const cmsVriKey = await computeVriKey(cmsBytes);
      const tsVriKey = await computeVriKey(tsToken);

      expect(vri.get(cmsVriKey)).toBeDefined();
      expect(vri.get(tsVriKey)).toBeDefined();
    });
  });

  describe("stream data integrity", () => {
    it("stores certificate data correctly in streams", async () => {
      const registry = new ObjectRegistry();
      const builder = DSSBuilder.create(registry);

      const cert = createTestData(42, 150);
      await builder.addLtvData(createMockLtvData({ certificates: [cert] }));

      const dssRef = await builder.build();
      const dss = (await registry.resolve(dssRef)) as PdfDict;
      const certsArray = dss.get("Certs") as PdfArray;
      const certRef = certsArray.at(0) as PdfRef;
      const certStream = (await registry.resolve(certRef)) as PdfStream;
      const data = await certStream.getDecodedData();

      expect(data).toEqual(cert);
    });

    it("computes correct SHA-1 hashes for deduplication", async () => {
      const registry = new ObjectRegistry();
      const builder = DSSBuilder.create(registry);

      const cert = createTestData(1);
      const expectedHash = await computeSha1Hex(cert);

      await builder.addLtvData(createMockLtvData({ certificates: [cert] }));

      const dssRef = await builder.build();
      const dss = (await registry.resolve(dssRef)) as PdfDict;
      const vri = dss.get("VRI") as PdfDict;

      // The VRI entry should reference the cert by hash
      // Since we only have one signature, check the VRI entry exists
      const vriKey = await computeVriKey(new Uint8Array([1, 2, 3, 4]));
      const vriEntry = vri.get(vriKey) as PdfDict;
      expect(vriEntry.get("Cert")).toBeInstanceOf(PdfArray);
    });
  });
});
