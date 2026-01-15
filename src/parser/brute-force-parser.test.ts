import { Scanner } from "#src/io/scanner";
import { describe, expect, it } from "vitest";

import { BruteForceParser } from "./brute-force-parser";

/**
 * Helper to create a BruteForceParser from a string.
 */
function parser(input: string): BruteForceParser {
  const bytes = new TextEncoder().encode(input);
  const scanner = new Scanner(bytes);

  return new BruteForceParser(scanner);
}

describe("BruteForceParser", () => {
  describe("scanForObjects", () => {
    it("finds single object", () => {
      const p = parser(`
1 0 obj
<< /Type /Catalog >>
endobj
`);
      const entries = p.scanForObjects();

      expect(entries.length).toBe(1);
      expect(entries[0].objNum).toBe(1);
      expect(entries[0].genNum).toBe(0);
    });

    it("finds multiple objects", () => {
      const p = parser(`
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [] /Count 0 >>
endobj
3 0 obj
<< /Type /Page >>
endobj
`);
      const entries = p.scanForObjects();

      expect(entries.length).toBe(3);
      expect(entries[0].objNum).toBe(1);
      expect(entries[1].objNum).toBe(2);
      expect(entries[2].objNum).toBe(3);
    });

    it("finds objects with non-zero generation", () => {
      const p = parser(`
5 2 obj
<< /Updated true >>
endobj
`);
      const entries = p.scanForObjects();

      expect(entries.length).toBe(1);
      expect(entries[0].objNum).toBe(5);
      expect(entries[0].genNum).toBe(2);
    });

    it("records byte offset of object start", () => {
      const input = `1 0 obj
<< /Type /Catalog >>
endobj`;
      const p = parser(input);
      const entries = p.scanForObjects();

      expect(entries[0].offset).toBe(0);
    });

    it("ignores 'obj' inside string literal", () => {
      const p = parser(`
1 0 obj
<< /Description (the obj keyword appears here) >>
endobj
`);
      const entries = p.scanForObjects();

      // Should only find one object, not be confused by "obj" in string
      expect(entries.length).toBe(1);
    });

    it("handles object at start of file", () => {
      const p = parser(`1 0 obj
<< /Type /Catalog >>
endobj`);
      const entries = p.scanForObjects();

      expect(entries.length).toBe(1);
      expect(entries[0].offset).toBe(0);
    });

    it("returns empty array for file with no objects", () => {
      const p = parser(`%PDF-1.4
Just some random content
%%EOF`);
      const entries = p.scanForObjects();

      expect(entries.length).toBe(0);
    });

    it("returns empty array for empty file", () => {
      const p = parser("");
      const entries = p.scanForObjects();

      expect(entries.length).toBe(0);
    });

    it("handles PDF header before objects", () => {
      const p = parser(`%PDF-1.4
1 0 obj
<< /Type /Catalog >>
endobj`);
      const entries = p.scanForObjects();

      expect(entries.length).toBe(1);
      expect(entries[0].objNum).toBe(1);
    });

    it("skips objects with invalid object numbers", () => {
      // Object number too large (> 10,000,000)
      const p = parser(`
99999999 0 obj
<< /Type /Catalog >>
endobj
1 0 obj
<< /Valid true >>
endobj
`);
      const entries = p.scanForObjects();

      expect(entries.length).toBe(1);
      expect(entries[0].objNum).toBe(1);
    });

    it("skips objects with invalid generation numbers", () => {
      // Generation number > 65535
      const p = parser(`
1 99999 obj
<< /Type /Catalog >>
endobj
2 0 obj
<< /Valid true >>
endobj
`);
      const entries = p.scanForObjects();

      expect(entries.length).toBe(1);
      expect(entries[0].objNum).toBe(2);
    });

    it("keeps last occurrence for duplicate object numbers", () => {
      const input = `1 0 obj
<< /First true >>
endobj
1 0 obj
<< /Second true >>
endobj`;
      const p = parser(input);
      const entries = p.scanForObjects();

      // Should have one entry for object 1, pointing to the second occurrence
      expect(entries.length).toBe(1);
      expect(entries[0].objNum).toBe(1);
      // The offset should be to the SECOND "1 0 obj"
      expect(entries[0].offset).toBeGreaterThan(0);
    });
  });

  describe("recover", () => {
    it("returns null for empty file", async () => {
      const p = parser("");
      const result = await p.recover();

      expect(result).toBeNull();
    });

    it("returns null for file with no objects", async () => {
      const p = parser(`%PDF-1.4
Just garbage
%%EOF`);
      const result = await p.recover();

      expect(result).toBeNull();
    });

    it("recovers document with Catalog", async () => {
      const p = parser(`
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [] /Count 0 >>
endobj
`);
      const result = await p.recover();

      expect(result).not.toBeNull();
      expect(result!.trailer.Root.objectNumber).toBe(1);
      expect(result!.trailer.Size).toBe(3); // highest obj + 1
    });

    it("finds Catalog when not first object", async () => {
      const p = parser(`
1 0 obj
<< /Type /Pages /Kids [] /Count 0 >>
endobj
2 0 obj
<< /Type /Catalog /Pages 1 0 R >>
endobj
`);
      const result = await p.recover();

      expect(result).not.toBeNull();
      expect(result!.trailer.Root.objectNumber).toBe(2);
    });

    it("falls back to Pages when no Catalog found", async () => {
      const p = parser(`
1 0 obj
<< /Type /Pages /Kids [] /Count 0 >>
endobj
2 0 obj
<< /Type /Page /Parent 1 0 R >>
endobj
`);
      const result = await p.recover();

      expect(result).not.toBeNull();
      expect(result!.trailer.Root.objectNumber).toBe(1);
      expect(result!.warnings.some(w => w.includes("Catalog"))).toBe(true);
    });

    it("builds xref with correct offsets", async () => {
      const input = `1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [] /Count 0 >>
endobj`;
      const p = parser(input);
      const result = await p.recover();

      expect(result).not.toBeNull();
      expect(result!.xref.getOffset(1, 0)).toBe(0);
      expect(result!.xref.getOffset(2, 0)).toBeGreaterThan(0);
    });

    it("collects warnings for issues", async () => {
      // No Catalog, only Pages
      const p = parser(`
1 0 obj
<< /Type /Pages /Kids [] /Count 0 >>
endobj
`);
      const result = await p.recover();

      expect(result).not.toBeNull();
      expect(result!.warnings.length).toBeGreaterThan(0);
    });

    it("handles truncated object gracefully", async () => {
      // Truncated Catalog - forces parser to check this object and encounter the error
      const p = parser(`
1 0 obj
<< /Type /Cata`);
      const result = await p.recover();

      // Should still return a result (with fallback to null root or partial)
      // The key is that we collect warnings about the truncation
      expect(result).toBeNull(); // No valid root found
    });

    it("collects warnings when parsing truncated objects", async () => {
      // Pages object first (will be found), then truncated Catalog
      const p = parser(`
1 0 obj
<< /Type /Pages /Kids [] /Count 0 >>
endobj
2 0 obj
<< /Type /Cata`);
      const result = await p.recover();

      // Should recover with Pages as root since Catalog is truncated
      expect(result).not.toBeNull();
      expect(result!.trailer.Root.objectNumber).toBe(1); // Falls back to Pages
      // Should have warning about truncated object 2
      expect(result!.warnings.some(w => w.includes("Unterminated") || w.includes("EOF"))).toBe(
        true,
      );
    });
  });

  describe("RecoveredXRef", () => {
    it("getOffset returns undefined for unknown object", async () => {
      const p = parser(`
1 0 obj
<< /Type /Catalog >>
endobj
`);
      const result = await p.recover();

      expect(result!.xref.getOffset(999, 0)).toBeUndefined();
    });

    it("getOffset returns correct offset for known object", async () => {
      const input = `1 0 obj
<< /Type /Catalog >>
endobj`;
      const p = parser(input);
      const result = await p.recover();

      expect(result!.xref.getOffset(1, 0)).toBe(0);
    });
  });
});
