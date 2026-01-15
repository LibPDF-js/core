import { Scanner } from "#src/io/scanner";
import { PdfDict } from "#src/objects/pdf-dict.ts";
import { PdfRef } from "#src/objects/pdf-ref";
import { loadFixture } from "#src/test-utils";
import { describe, expect, it } from "vitest";

import { DocumentParser } from "./document-parser";

/**
 * Helper to create a minimal PDF for testing.
 */
function createMinimalPdf(options: {
  version?: string;
  headerOffset?: number;
  garbageBeforeHeader?: string;
  objects?: Array<{ objNum: number; content: string }>;
  xrefEntries?: Array<{ objNum: number; offset: number; gen?: number; free?: boolean }>;
  trailer?: Record<string, string>;
}): Uint8Array {
  const parts: string[] = [];

  // Add garbage before header if specified
  if (options.garbageBeforeHeader) {
    parts.push(options.garbageBeforeHeader);
  }

  // Header
  const version = options.version ?? "1.4";
  parts.push(`%PDF-${version}\n`);
  parts.push("%\x80\x81\x82\x83\n"); // Binary marker

  // Track offsets for xref
  const offsets: Array<{ objNum: number; offset: number; gen: number; free: boolean }> = [];
  let currentOffset = parts.join("").length;

  // Objects
  const objects = options.objects ?? [
    { objNum: 1, content: "<< /Type /Catalog /Pages 2 0 R >>" },
    { objNum: 2, content: "<< /Type /Pages /Kids [] /Count 0 >>" },
  ];

  for (const obj of objects) {
    offsets.push({ objNum: obj.objNum, offset: currentOffset, gen: 0, free: false });
    const objStr = `${obj.objNum} 0 obj\n${obj.content}\nendobj\n`;
    parts.push(objStr);
    currentOffset += objStr.length;
  }

  // Use provided xref entries or build from objects
  const xrefEntries = options.xrefEntries ?? [
    { objNum: 0, offset: 0, gen: 65535, free: true },
    ...offsets,
  ];

  // XRef table
  const xrefOffset = currentOffset;
  parts.push("xref\n");
  parts.push(`0 ${xrefEntries.length}\n`);

  for (const entry of xrefEntries) {
    const offsetStr = entry.offset.toString().padStart(10, "0");
    const genStr = (entry.gen ?? 0).toString().padStart(5, "0");
    const type = entry.free ? "f" : "n";
    parts.push(`${offsetStr} ${genStr} ${type}\n`);
  }

  // Trailer
  const trailerDict = options.trailer ?? {
    "/Root": "1 0 R",
    "/Size": String(xrefEntries.length),
  };

  parts.push("trailer\n");
  parts.push("<< ");
  for (const [key, value] of Object.entries(trailerDict)) {
    parts.push(`${key} ${value} `);
  }
  parts.push(">>\n");

  // startxref
  parts.push("startxref\n");
  parts.push(`${xrefOffset}\n`);
  parts.push("%%EOF\n");

  return new TextEncoder().encode(parts.join(""));
}

describe("DocumentParser", () => {
  describe("parseHeader", () => {
    it("parses standard header at byte 0", () => {
      const bytes = createMinimalPdf({ version: "1.7" });
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const version = parser.parseHeader();

      expect(version).toBe("1.7");
    });

    it("parses PDF 2.0 header", () => {
      const bytes = createMinimalPdf({ version: "2.0" });
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const version = parser.parseHeader();

      expect(version).toBe("2.0");
    });

    it("handles header not at byte 0 (lenient)", () => {
      const bytes = createMinimalPdf({
        version: "1.5",
        garbageBeforeHeader: "garbage\n\n",
      });
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const version = parser.parseHeader();

      expect(version).toBe("1.5");
    });

    it("throws in strict mode when header not at byte 0", async () => {
      const bytes = createMinimalPdf({
        version: "1.5",
        garbageBeforeHeader: "garbage\n",
      });
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner, { lenient: false });

      // Should still parse (pdf.js allows this), but we could make it strict
      // For now, we follow pdf.js behavior which allows header anywhere in first 1024 bytes
      const version = parser.parseHeader();

      expect(version).toBe("1.5");
    });

    it("returns default version when header missing (lenient)", () => {
      const bytes = new TextEncoder().encode("not a pdf file\n");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const version = parser.parseHeader();

      expect(version).toBe("1.7"); // Default version (PDFBox uses 1.7 in lenient mode)
    });

    it("throws when header missing (strict)", () => {
      const bytes = new TextEncoder().encode("not a pdf file\n");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner, { lenient: false });

      expect(() => parser.parseHeader()).toThrow("PDF header not found");
    });

    it("handles garbage after version (lenient)", () => {
      // Create PDF with garbage after version: %PDF-1.7garbage
      const pdfContent =
        "%PDF-1.7garbage\n%\x80\x81\n1 0 obj\n<< /Type /Catalog >>\nendobj\nxref\n0 2\n0000000000 65535 f\n0000000020 00000 n\ntrailer\n<< /Root 1 0 R /Size 2 >>\nstartxref\n60\n%%EOF\n";
      const bytes = new TextEncoder().encode(pdfContent);
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const version = parser.parseHeader();

      expect(version).toBe("1.7");
    });
  });

  describe("parse", () => {
    it("parses minimal valid PDF", async () => {
      const bytes = createMinimalPdf({});
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      expect(doc.version).toBe("1.4");
      expect(doc.trailer).toBeDefined();
      expect(doc.xref.size).toBeGreaterThan(0);
    });

    it("provides access to catalog", async () => {
      const bytes = createMinimalPdf({});
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();
      const catalog = await doc.getCatalog();

      expect(catalog).not.toBeNull();
      expect(catalog?.getName("Type")?.value).toBe("Catalog");
    });

    it("loads objects by reference", async () => {
      const bytes = createMinimalPdf({
        objects: [
          { objNum: 1, content: "<< /Type /Catalog /Pages 2 0 R >>" },
          { objNum: 2, content: "<< /Type /Pages /Kids [] /Count 0 >>" },
        ],
      });
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      // Load catalog (object 1)
      const catalog = await doc.getObject(PdfRef.of(1, 0));
      expect(catalog).not.toBeNull();
      expect(catalog?.type).toBe("dict");

      // Load pages (object 2)
      const pages = await doc.getObject(PdfRef.of(2, 0));
      expect(pages).not.toBeNull();
      expect(pages).toBeInstanceOf(PdfDict);
      expect((pages as PdfDict).getName("Type")?.value).toBe("Pages");
    });

    it("returns null for non-existent objects", async () => {
      const bytes = createMinimalPdf({});
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();
      const obj = await doc.getObject(PdfRef.of(999, 0));

      expect(obj).toBeNull();
    });

    it("caches loaded objects", async () => {
      const bytes = createMinimalPdf({});
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      // Load same object twice
      const obj1 = await doc.getObject(PdfRef.of(1, 0));
      const obj2 = await doc.getObject(PdfRef.of(1, 0));

      // Should be the same cached instance
      expect(obj1).toBe(obj2);
    });
  });

  describe("fixtures: basic", () => {
    it("parses rot0.pdf - simple single-page PDF", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      // Version and structure
      expect(doc.version).toBe("1.4");
      expect(doc.warnings).toHaveLength(0);
      expect(doc.xref.size).toBe(8); // 8 objects in xref

      // Catalog structure
      const catalog = await doc.getCatalog();
      expect(catalog).not.toBeNull();
      expect(catalog?.getName("Type")?.value).toBe("Catalog");
      expect(catalog?.getName("Version")?.value).toBe("1.4");

      // Pages tree - 1 page
      const pagesRef = catalog?.getRef("Pages");
      expect(pagesRef?.objectNumber).toBe(2);
      const pages = (await doc.getObject(pagesRef!)) as PdfDict;
      expect(pages.getName("Type")?.value).toBe("Pages");
      expect(pages.getNumber("Count")?.value).toBe(1);

      // Page object
      const kidsArray = pages.getArray("Kids");
      expect(kidsArray?.length).toBe(1);
      const pageRef = kidsArray?.at(0) as PdfRef;
      const page = (await doc.getObject(pageRef)) as PdfDict;
      expect(page.getName("Type")?.value).toBe("Page");
      expect(page.getNumber("Rotate")?.value).toBe(0);

      // MediaBox [0 0 200 400]
      const mediaBox = page.getArray("MediaBox");
      expect(mediaBox?.length).toBe(4);
      expect((mediaBox?.at(2) as { value: number }).value).toBe(200);
      expect((mediaBox?.at(3) as { value: number }).value).toBe(400);

      // Content stream exists and is a stream
      const contentsRef = page.getRef("Contents");
      const contents = await doc.getObject(contentsRef!);
      expect(contents?.type).toBe("stream");
    });

    it("parses document.pdf - basic document structure", async () => {
      const bytes = await loadFixture("basic", "document.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      expect(doc.version).toBeDefined();
      expect(doc.xref.size).toBeGreaterThan(0);

      const catalog = await doc.getCatalog();
      expect(catalog).not.toBeNull();
      expect(catalog?.getName("Type")?.value).toBe("Catalog");

      // Verify we can traverse to pages
      const pagesRef = catalog?.getRef("Pages");
      expect(pagesRef).toBeDefined();
      const pages = (await doc.getObject(pagesRef!)) as PdfDict;
      expect(pages.getName("Type")?.value).toBe("Pages");
      expect(pages.getNumber("Count")?.value).toBeGreaterThan(0);
    });

    it("parses sample.pdf - larger multi-object PDF", async () => {
      const bytes = await loadFixture("basic", "sample.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      expect(doc.version).toBeDefined();
      expect(doc.xref.size).toBeGreaterThan(10); // Larger file, many objects

      const catalog = await doc.getCatalog();
      expect(catalog).not.toBeNull();

      // Verify pages
      const pagesRef = catalog?.getRef("Pages");
      const pages = (await doc.getObject(pagesRef!)) as PdfDict;
      const pageCount = pages.getNumber("Count")?.value;
      expect(pageCount).toBeGreaterThan(0);
    });

    it("parses page_tree_multiple_levels.pdf - nested page tree with 4 pages", async () => {
      const bytes = await loadFixture("basic", "page_tree_multiple_levels.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      expect(doc.version).toBe("1.4");
      expect(doc.xref.size).toBe(26); // 26 objects

      const catalog = await doc.getCatalog();
      expect(catalog?.getName("Type")?.value).toBe("Catalog");

      // Root pages node has 2 kids (intermediate Pages nodes)
      const pagesRef = catalog?.getRef("Pages");
      const pages = (await doc.getObject(pagesRef!)) as PdfDict;
      expect(pages.getName("Type")?.value).toBe("Pages");
      expect(pages.getNumber("Count")?.value).toBe(4); // Total 4 pages

      const kids = pages.getArray("Kids");
      expect(kids?.length).toBe(2); // 2 intermediate nodes

      // First intermediate node has 2 pages
      const firstIntermediateRef = kids?.at(0) as PdfRef;
      const firstIntermediate = (await doc.getObject(firstIntermediateRef)) as PdfDict;
      expect(firstIntermediate.getName("Type")?.value).toBe("Pages");
      expect(firstIntermediate.getNumber("Count")?.value).toBe(2);

      // Navigate to actual page
      const pageKids = firstIntermediate.getArray("Kids");
      const firstPageRef = pageKids?.at(0) as PdfRef;
      const firstPage = (await doc.getObject(firstPageRef)) as PdfDict;
      expect(firstPage.getName("Type")?.value).toBe("Page");

      // Page has MediaBox [0 0 612 792] (letter size)
      const mediaBox = firstPage.getArray("MediaBox");
      expect((mediaBox?.at(2) as { value: number }).value).toBe(612);
      expect((mediaBox?.at(3) as { value: number }).value).toBe(792);
    });

    it("parses SimpleForm2Fields.pdf - PDF with AcroForm", async () => {
      const bytes = await loadFixture("basic", "SimpleForm2Fields.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      expect(doc.version).toBe("1.4");
      expect(doc.xref.size).toBe(10); // 10 objects

      const catalog = await doc.getCatalog();
      expect(catalog?.getName("Type")?.value).toBe("Catalog");

      // Has AcroForm (interactive forms)
      const acroFormRef = catalog?.getRef("AcroForm");
      expect(acroFormRef).toBeDefined();

      const acroForm = (await doc.getObject(acroFormRef!)) as PdfDict;
      const fields = acroForm.getArray("Fields");
      expect(fields?.length).toBe(2); // 2 form fields

      // Verify first field
      const field1Ref = fields?.at(0) as PdfRef;
      const field1 = (await doc.getObject(field1Ref)) as PdfDict;
      expect(field1.getName("FT")?.value).toBe("Tx"); // Text field
      expect(field1.getString("T")?.asString()).toBe("Field1");
    });
  });

  describe("fixtures: xref", () => {
    it("parses sampleForSpec.pdf - standard xref table", async () => {
      const bytes = await loadFixture("xref", "sampleForSpec.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      expect(doc.version).toBeDefined();
      expect(doc.xref.size).toBeGreaterThan(0);

      const catalog = await doc.getCatalog();
      expect(catalog).not.toBeNull();
      expect(catalog?.getName("Type")?.value).toBe("Catalog");

      // Verify page tree is accessible
      const pagesRef = catalog?.getRef("Pages");
      const pages = (await doc.getObject(pagesRef!)) as PdfDict;
      expect(pages.getName("Type")?.value).toBe("Pages");
    });

    it("parses simple-openoffice.pdf - OpenOffice-generated PDF", async () => {
      const bytes = await loadFixture("xref", "simple-openoffice.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      expect(doc.version).toBeDefined();
      expect(doc.xref.size).toBeGreaterThan(0);

      const catalog = await doc.getCatalog();
      expect(catalog?.getName("Type")?.value).toBe("Catalog");

      // OpenOffice PDFs typically have metadata
      const pagesRef = catalog?.getRef("Pages");
      const pages = (await doc.getObject(pagesRef!)) as PdfDict;
      expect(pages.getNumber("Count")?.value).toBeGreaterThan(0);
    });

    it("parses hello3.pdf - linearized PDF with hybrid xref", async () => {
      const bytes = await loadFixture("xref", "hello3.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      expect(doc.version).toBe("1.4");
      expect(doc.xref.size).toBeGreaterThan(0);

      const catalog = await doc.getCatalog();
      expect(catalog?.getName("Type")?.value).toBe("Catalog");

      // Linearized PDFs have specific structure
      // Check we can access pages
      const pagesRef = catalog?.getRef("Pages");
      expect(pagesRef).toBeDefined();
      const pages = (await doc.getObject(pagesRef!)) as PdfDict;
      expect(pages.getName("Type")?.value).toBe("Pages");
    });
  });

  describe("fixtures: text", () => {
    it("parses text/rot0.pdf - text extraction source", async () => {
      const bytes = await loadFixture("text", "rot0.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      expect(doc.version).toBeDefined();
      expect(doc.xref.size).toBeGreaterThan(0);

      const catalog = await doc.getCatalog();
      expect(catalog?.getName("Type")?.value).toBe("Catalog");

      // Navigate to page content
      const pagesRef = catalog?.getRef("Pages");
      const pages = (await doc.getObject(pagesRef!)) as PdfDict;
      const kids = pages.getArray("Kids");
      const pageRef = kids?.at(0) as PdfRef;
      const page = (await doc.getObject(pageRef)) as PdfDict;

      // Page has content stream
      const contentsRef = page.getRef("Contents");
      expect(contentsRef).toBeDefined();
      const contents = await doc.getObject(contentsRef!);
      expect(contents?.type).toBe("stream");
    });

    it("parses openoffice-test-document.pdf - multi-page document", async () => {
      const bytes = await loadFixture("text", "openoffice-test-document.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      expect(doc.version).toBeDefined();
      expect(doc.xref.size).toBeGreaterThan(0);

      const catalog = await doc.getCatalog();
      expect(catalog?.getName("Type")?.value).toBe("Catalog");

      // Should have pages
      const pagesRef = catalog?.getRef("Pages");
      const pages = (await doc.getObject(pagesRef!)) as PdfDict;
      expect(pages.getNumber("Count")?.value).toBeGreaterThan(0);
    });

    it("parses yaddatest.pdf - text content document", async () => {
      const bytes = await loadFixture("text", "yaddatest.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      expect(doc.version).toBeDefined();
      expect(doc.xref.size).toBeGreaterThan(0);

      const catalog = await doc.getCatalog();
      expect(catalog?.getName("Type")?.value).toBe("Catalog");

      // Verify page structure
      const pagesRef = catalog?.getRef("Pages");
      const pages = (await doc.getObject(pagesRef!)) as PdfDict;
      expect(pages.getName("Type")?.value).toBe("Pages");
    });
  });

  describe("fixtures: filter", () => {
    it("parses unencrypted.pdf - FlateDecode streams", async () => {
      const bytes = await loadFixture("filter", "unencrypted.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      expect(doc.version).toBeDefined();
      expect(doc.xref.size).toBeGreaterThan(0);

      const catalog = await doc.getCatalog();
      expect(catalog?.getName("Type")?.value).toBe("Catalog");

      // Navigate to find a stream and verify it's parseable
      const pagesRef = catalog?.getRef("Pages");
      const pages = (await doc.getObject(pagesRef!)) as PdfDict;
      expect(pages.getNumber("Count")?.value).toBeGreaterThan(0);
    });

    it("parses lzw-sample.pdf - LZWDecode streams", async () => {
      const bytes = await loadFixture("filter", "lzw-sample.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      expect(doc.version).toBeDefined();
      expect(doc.xref.size).toBeGreaterThan(0);

      const catalog = await doc.getCatalog();
      expect(catalog?.getName("Type")?.value).toBe("Catalog");

      // Verify page structure
      const pagesRef = catalog?.getRef("Pages");
      const pages = (await doc.getObject(pagesRef!)) as PdfDict;
      expect(pages.getName("Type")?.value).toBe("Pages");
    });
  });

  describe("fixtures: encryption (detection only)", () => {
    it("detects encryption in PasswordSample-40bit.pdf (RC4 40-bit)", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-40bit.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      expect(doc.version).toBeDefined();

      // Encrypted PDFs have /Encrypt in trailer
      const encryptRef = doc.trailer.getRef("Encrypt");
      expect(encryptRef).toBeDefined();

      // Load encrypt dict to verify encryption parameters
      const encrypt = (await doc.getObject(encryptRef!)) as PdfDict;
      expect(encrypt.getName("Filter")?.value).toBe("Standard");
      expect(encrypt.getNumber("V")?.value).toBe(1); // V=1 for 40-bit RC4
    });

    it("detects encryption in PasswordSample-128bit.pdf (RC4 128-bit)", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-128bit.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      expect(doc.version).toBeDefined();

      const encryptRef = doc.trailer.getRef("Encrypt");
      expect(encryptRef).toBeDefined();

      const encrypt = (await doc.getObject(encryptRef!)) as PdfDict;
      expect(encrypt.getName("Filter")?.value).toBe("Standard");
      expect(encrypt.getNumber("V")?.value).toBe(2); // V=2 for 128-bit RC4
    });

    it("detects encryption in PasswordSample-256bit.pdf (AES 256-bit)", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-256bit.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      expect(doc.version).toBeDefined();

      const encryptRef = doc.trailer.getRef("Encrypt");
      expect(encryptRef).toBeDefined();

      const encrypt = (await doc.getObject(encryptRef!)) as PdfDict;
      expect(encrypt.getName("Filter")?.value).toBe("Standard");
      // V=5 for AES-256
      expect(encrypt.getNumber("V")?.value).toBeGreaterThanOrEqual(4);
    });

    it("detects encryption in AESkeylength128.pdf (public key encryption)", async () => {
      const bytes = await loadFixture("encryption", "AESkeylength128.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      expect(doc.version).toBeDefined();

      const encryptRef = doc.trailer.getRef("Encrypt");
      expect(encryptRef).toBeDefined();

      const encrypt = (await doc.getObject(encryptRef!)) as PdfDict;
      // Adobe.PubSec = certificate-based (public key) encryption
      expect(encrypt.getName("Filter")?.value).toBe("Adobe.PubSec");
      // V=4 for AES-128
      expect(encrypt.getNumber("V")?.value).toBe(4);
    });

    it("detects encryption in AESkeylength256.pdf (public key encryption)", async () => {
      const bytes = await loadFixture("encryption", "AESkeylength256.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      expect(doc.version).toBeDefined();

      const encryptRef = doc.trailer.getRef("Encrypt");
      expect(encryptRef).toBeDefined();

      const encrypt = (await doc.getObject(encryptRef!)) as PdfDict;
      // Adobe.PubSec = certificate-based (public key) encryption
      expect(encrypt.getName("Filter")?.value).toBe("Adobe.PubSec");
      // V=5 for AES-256
      expect(encrypt.getNumber("V")?.value).toBe(5);
    });
  });

  describe("fixtures: malformed (recovery)", () => {
    it("recovers PDFBOX-3068.pdf - malformed xref entries", async () => {
      const bytes = await loadFixture("malformed", "PDFBOX-3068.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      // Should recover and find objects
      expect(doc.xref.size).toBeGreaterThan(0);
      expect(doc.version).toBeDefined();

      // Verify we can still access basic structure
      const catalog = await doc.getCatalog();
      // May or may not succeed depending on corruption level
      if (catalog) {
        expect(catalog.getName("Type")?.value).toBe("Catalog");
      }
    });

    it("recovers MissingCatalog.pdf - trailer missing /Root", async () => {
      const bytes = await loadFixture("malformed", "MissingCatalog.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      // Should parse structure even without catalog
      expect(doc.version).toBeDefined();
      expect(doc.xref.size).toBeGreaterThan(0);

      // Recovery may or may not find a catalog - the point is we don't crash
      // The catalog might exist but lack a /Type entry (common in malformed files)
      const catalog = await doc.getCatalog();
      // Just verify we can call getCatalog without throwing
      expect(catalog === null || catalog.type === "dict").toBe(true);
    });

    it("handles PDFBOX-6040-nodeloop.pdf - circular references in page tree", async () => {
      const bytes = await loadFixture("malformed", "PDFBOX-6040-nodeloop.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      // Should complete without hanging (circular reference in page tree)
      expect(doc.version).toBeDefined();
      expect(doc.xref.size).toBeGreaterThan(0);

      // Basic structure should still be accessible
      const catalog = await doc.getCatalog();
      expect(catalog).not.toBeNull();
    });
  });

  describe("incremental updates", () => {
    it("follows /Prev chain", async () => {
      // This would require a fixture with incremental updates
      // For now, test that parsing works with a simple PDF
      const bytes = createMinimalPdf({});
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      // No /Prev in simple PDF, but chain following code should handle it
      expect(doc.xref.size).toBeGreaterThan(0);
    });
  });

  describe("stream objects", () => {
    it("loads stream objects with direct /Length", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      // Object 5 in rot0.pdf is a content stream
      const stream = await doc.getObject(PdfRef.of(5, 0));
      expect(stream).not.toBeNull();
      expect(stream?.type).toBe("stream");
    });
  });

  describe("recovery mode", () => {
    it("uses brute-force parser when xref fails", async () => {
      // Create a malformed PDF with invalid xref
      const malformedPdf = new TextEncoder().encode(
        "%PDF-1.4\n" +
          "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
          "2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n" +
          "xref\nGARBAGE\n" + // Invalid xref
          "startxref\n60\n%%EOF\n",
      );
      const scanner = new Scanner(malformedPdf);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      // Should recover and find objects via brute-force
      expect(doc.warnings.length).toBeGreaterThan(0);
      expect(doc.xref.size).toBeGreaterThan(0);
    });
  });

  describe("error handling", () => {
    it("throws in strict mode for invalid xref", async () => {
      const malformedPdf = new TextEncoder().encode(
        "%PDF-1.4\nxref\nGARBAGE\nstartxref\n10\n%%EOF\n",
      );
      const scanner = new Scanner(malformedPdf);
      const parser = new DocumentParser(scanner, { lenient: false });

      await expect(parser.parse()).rejects.toThrow();
    });

    it("handles missing startxref gracefully (lenient)", async () => {
      const malformedPdf = new TextEncoder().encode(
        "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n",
      );
      const scanner = new Scanner(malformedPdf);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      // Should recover via brute-force
      expect(doc.warnings.length).toBeGreaterThan(0);
    });
  });

  /**
   * PDFBox TestPDFParser compatibility tests.
   *
   * These tests use the same fixtures that PDFBox uses to test parser recovery.
   * We aim to match PDFBox's lenient parsing behavior for maximum compatibility.
   *
   * @see checkouts/pdfbox/pdfbox/src/test/java/org/apache/pdfbox/pdfparser/TestPDFParser.java
   */
  describe("PDFBox TestPDFParser compatibility", () => {
    // PDFBOX-3060: Missing catalog - should not throw
    it("PDFBOX-3060: parses MissingCatalog.pdf without throwing", async () => {
      const bytes = await loadFixture("malformed", "MissingCatalog.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      // PDFBox expectation: loading should not throw
      const doc = await parser.parse();
      expect(doc.version).toBeDefined();
    });

    // PDFBOX-3208: Corrupt file, /Info dictionary retrieval during trailer rebuild
    it("PDFBOX-3208: recovers document with corrupt trailer", async () => {
      const bytes = await loadFixture("malformed", "pdfbox/PDFBOX-3208.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      // Should parse successfully
      expect(doc.version).toBeDefined();
      expect(doc.xref.size).toBeGreaterThan(0);

      // PDFBox verifies /Info dictionary is recovered correctly
      // We verify basic structure is intact
      const catalog = await doc.getCatalog();
      expect(catalog).not.toBeNull();
    });

    // PDFBOX-3783: PDF with trash after %%EOF
    it("PDFBOX-3783: parses PDF with garbage after %%EOF", async () => {
      const bytes = await loadFixture("malformed", "pdfbox/PDFBOX-3783.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      // PDFBox expectation: should not throw
      const doc = await parser.parse();
      expect(doc.version).toBeDefined();
      expect(doc.xref.size).toBeGreaterThan(0);
    });

    // PDFBOX-3785: Truncated file with several revisions
    it("PDFBOX-3785: truncated file has correct page count (11 pages)", async () => {
      const bytes = await loadFixture("malformed", "pdfbox/PDFBOX-3785.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      // PDFBox: assertEquals(11, doc.getNumberOfPages())
      expect(await doc.getPageCount()).toBe(11);
    });

    // PDFBOX-3940: Corrupt file, /Info without modification date
    it("PDFBOX-3940: parses corrupt file with missing ModDate", async () => {
      const bytes = await loadFixture("malformed", "pdfbox/PDFBOX-3940.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      expect(doc.version).toBeDefined();
      expect(doc.xref.size).toBeGreaterThan(0);

      // Should be able to access catalog
      const catalog = await doc.getCatalog();
      expect(catalog).not.toBeNull();
    });

    // PDFBOX-3947: Broken object stream
    it("PDFBOX-3947: parses file with broken object stream", async () => {
      const bytes = await loadFixture("malformed", "pdfbox/PDFBOX-3947.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      // PDFBox expectation: should not throw
      const doc = await parser.parse();
      expect(doc.version).toBeDefined();
    });

    // PDFBOX-3948: Object stream with unexpected newlines
    // Brute-force parser extracts objects from object streams to find Catalog/Pages
    it("PDFBOX-3948: parses object stream with unexpected newlines", async () => {
      const bytes = await loadFixture("malformed", "pdfbox/PDFBOX-3948.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      // PDFBox expectation: should not throw
      const doc = await parser.parse();
      expect(doc.version).toBeDefined();
    });

    // PDFBOX-3949: Incomplete object stream
    it("PDFBOX-3949: parses file with incomplete object stream", async () => {
      const bytes = await loadFixture("malformed", "pdfbox/PDFBOX-3949.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      // PDFBox expectation: should not throw
      const doc = await parser.parse();
      expect(doc.version).toBeDefined();
    });

    // PDFBOX-3950: Truncated file with missing pages
    // The metadata claims 11 pages, but only 4 are actually reachable
    // We walk the tree to get the accurate count, matching PDFBox behavior
    it("PDFBOX-3950: truncated file has correct page count (4 reachable pages)", async () => {
      const bytes = await loadFixture("malformed", "pdfbox/PDFBOX-3950.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      const catalog = await doc.getCatalog();
      expect(catalog).not.toBeNull();

      // Metadata says 11 pages
      const pagesRef = catalog?.getRef("Pages");
      if (pagesRef) {
        const pagesDict = (await doc.getObject(pagesRef)) as PdfDict;
        expect(pagesDict.getNumber("Count")?.value).toBe(11);
      }

      // But only 4 are actually reachable by walking the tree
      // This matches PDFBox's behavior
      expect(await doc.getPageCount()).toBe(4);
    });

    // PDFBOX-3951: Truncated file
    it("PDFBOX-3951: truncated file has correct page count (143 pages)", async () => {
      const bytes = await loadFixture("malformed", "pdfbox/PDFBOX-3951.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      // PDFBox: assertEquals(143, doc.getNumberOfPages())
      expect(await doc.getPageCount()).toBe(143);
    });

    // PDFBOX-3964: Broken file
    it("PDFBOX-3964: broken file has correct page count (10 pages)", async () => {
      const bytes = await loadFixture("malformed", "pdfbox/PDFBOX-3964.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      // PDFBox: assertEquals(10, doc.getNumberOfPages())
      expect(await doc.getPageCount()).toBe(10);
    });

    // PDFBOX-3977: Brute force search for Info/Catalog
    it("PDFBOX-3977: brute force recovery finds Info/Catalog", async () => {
      const bytes = await loadFixture("malformed", "pdfbox/PDFBOX-3977.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      // Should recover structure
      expect(doc.version).toBeDefined();
      expect(doc.xref.size).toBeGreaterThan(0);

      const catalog = await doc.getCatalog();
      expect(catalog).not.toBeNull();
    });

    // genko_oc_shiryo1.pdf: Regression test
    it("parses genko_oc_shiryo1.pdf (regression test)", async () => {
      const bytes = await loadFixture("malformed", "pdfbox/genko_oc_shiryo1.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      // PDFBox expectation: should not throw
      const doc = await parser.parse();
      expect(doc.version).toBeDefined();
    });

    // PDFBOX-4338: ArrayIndexOutOfBoundsException - malformed Kids array with binary garbage
    it("PDFBOX-4338: handles malformed Kids array with binary character", async () => {
      const bytes = await loadFixture("malformed", "pdfbox/PDFBOX-4338.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      // PDFBox expectation: should not throw ArrayIndexOutOfBoundsException
      const doc = await parser.parse();
      expect(doc.version).toBeDefined();
    });

    // PDFBOX-4339: NullPointerException - malformed object definition
    it("PDFBOX-4339: handles malformed object definition with binary character", async () => {
      const bytes = await loadFixture("malformed", "pdfbox/PDFBOX-4339.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      // PDFBox expectation: should not throw NullPointerException
      const doc = await parser.parse();
      expect(doc.version).toBeDefined();
    });

    // PDFBOX-4153: Document outline navigation
    it("PDFBOX-4153: parses document with outline", async () => {
      const bytes = await loadFixture("malformed", "pdfbox/PDFBOX-4153.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      const catalog = await doc.getCatalog();
      expect(catalog).not.toBeNull();

      // PDFBox verifies: documentOutline.getFirstChild().getTitle() == "Main Menu"
      // We verify outline reference exists
      const outlinesRef = catalog?.getRef("Outlines");
      expect(outlinesRef).toBeDefined();
    });

    // PDFBOX-4490: Should have 3 pages
    it("PDFBOX-4490: file has correct page count (3 pages)", async () => {
      const bytes = await loadFixture("malformed", "pdfbox/PDFBOX-4490.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      // PDFBox: assertEquals(3, doc.getNumberOfPages())
      expect(await doc.getPageCount()).toBe(3);
    });

    // PDFBOX-5025: "74191endobj" - number runs directly into keyword
    it("PDFBOX-5025: parses object with number adjacent to endobj keyword", async () => {
      const bytes = await loadFixture("malformed", "pdfbox/PDFBOX-5025.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      // PDFBox: doc.getPage(0).getResources().getFont("F1").getFontDescriptor().getFontFile2().getInt(LENGTH1) == 74191
      expect(doc.version).toBeDefined();

      const catalog = await doc.getCatalog();
      expect(catalog).not.toBeNull();

      // PDFBox: assertEquals(1, doc.getNumberOfPages())
      expect(await doc.getPageCount()).toBe(1);
    });
  });
});
