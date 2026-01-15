/**
 * Tests for signature placeholder mechanism.
 */

import { describe, expect, it } from "vitest";

import {
  calculateByteRange,
  createByteRangePlaceholder,
  createContentsPlaceholder,
  DEFAULT_PLACEHOLDER_SIZE,
  extractSignedBytes,
  findPlaceholders,
  patchByteRange,
  patchContents,
} from "./placeholder";
import { PlaceholderError } from "./types";

describe("placeholder", () => {
  describe("createByteRangePlaceholder", () => {
    it("creates a fixed-width placeholder", () => {
      const placeholder = createByteRangePlaceholder();
      // Format: /ByteRange [0 <10chars> <10chars> <10chars>]
      expect(placeholder).toBe("/ByteRange [0 ********** ********** **********]");
      expect(placeholder.length).toBe(47); // 11 + 36
    });
  });

  describe("createContentsPlaceholder", () => {
    it("creates placeholder with default size", () => {
      const placeholder = createContentsPlaceholder();
      // Each byte = 2 hex chars, plus < and >
      expect(placeholder).toMatch(/^<0+>$/);
      expect(placeholder.length).toBe(DEFAULT_PLACEHOLDER_SIZE * 2 + 2);
    });

    it("creates placeholder with custom size", () => {
      const placeholder = createContentsPlaceholder(100);
      expect(placeholder).toBe(`<${"0".repeat(200)}>`);
      expect(placeholder.length).toBe(202);
    });

    it("creates placeholder with small size", () => {
      const placeholder = createContentsPlaceholder(1);
      expect(placeholder).toBe("<00>");
    });
  });

  describe("findPlaceholders", () => {
    it("finds ByteRange placeholder in buffer", () => {
      const pdf = createTestPdfBuffer();
      const placeholders = findPlaceholders(pdf);

      expect(placeholders.byteRangeStart).toBeGreaterThan(0);
      expect(placeholders.byteRangeLength).toBeGreaterThan(0);
    });

    it("finds Contents placeholder in buffer", () => {
      const pdf = createTestPdfBuffer();
      const placeholders = findPlaceholders(pdf);

      expect(placeholders.contentsStart).toBeGreaterThan(0);
      expect(placeholders.contentsLength).toBe(200); // 100 bytes = 200 hex chars
    });

    it("throws if ByteRange not found", () => {
      const buffer = new TextEncoder().encode("/Contents <0000>");

      expect(() => findPlaceholders(buffer)).toThrow("ByteRange placeholder not found");
    });

    it("throws if Contents not found", () => {
      const buffer = new TextEncoder().encode("/ByteRange [0 1 2 3]");

      expect(() => findPlaceholders(buffer)).toThrow("Contents placeholder not found");
    });
  });

  describe("calculateByteRange", () => {
    it("calculates correct byte ranges", () => {
      const pdf = createTestPdfBuffer();
      const placeholders = findPlaceholders(pdf);
      const byteRange = calculateByteRange(pdf, placeholders);

      // Verify byteRangeStart points to '[' (0x5b)
      expect(pdf[placeholders.byteRangeStart]).toBe(0x5b);
      // Verify byteRangeLength includes the full range from '[' to ']'
      // byteRangeStart + byteRangeLength - 1 should be ']' (0x5d)
      expect(pdf[placeholders.byteRangeStart + placeholders.byteRangeLength - 1]).toBe(0x5d);

      // First section: start of file to just before Contents '<'
      expect(byteRange.offset1).toBe(0);
      // contentsStart points to first char AFTER '<', so contentsStart-1 is the '<'
      // '<' = 0x3c
      expect(pdf[placeholders.contentsStart - 1]).toBe(0x3c);
      // length1 includes everything up to but not including the '<'
      expect(byteRange.length1).toBe(placeholders.contentsStart - 1);

      // Second section: just after Contents '>' to end
      // contentsStart + contentsLength points to the '>' (since contentsLength excludes delimiters)
      // '>' = 0x3e
      expect(pdf[placeholders.contentsStart + placeholders.contentsLength]).toBe(0x3e);
      expect(byteRange.offset2).toBe(placeholders.contentsStart + placeholders.contentsLength + 1);

      expect(byteRange.length2).toBe(pdf.length - byteRange.offset2);

      // Total signed bytes should be file length minus Contents value and its delimiters
      const signedLength = byteRange.length1 + byteRange.length2;
      const contentsWithDelimiters = placeholders.contentsLength + 2; // +2 for < and >

      expect(signedLength).toBe(pdf.length - contentsWithDelimiters);
    });
  });

  describe("patchByteRange", () => {
    it("patches ByteRange with calculated values", () => {
      const pdf = createTestPdfBuffer();
      const placeholders = findPlaceholders(pdf);
      const byteRange = calculateByteRange(pdf, placeholders);

      patchByteRange(pdf, placeholders, byteRange);

      // Verify the patched values are in the buffer
      const decoder = new TextDecoder();
      const patched = decoder.decode(
        pdf.subarray(
          placeholders.byteRangeStart,
          placeholders.byteRangeStart + placeholders.byteRangeLength,
        ),
      );

      expect(patched).toMatch(/^\[0 \d+\s+\d+\s+\d+\s+\]$/);
      expect(patched.length).toBe(placeholders.byteRangeLength);
    });

    it("preserves buffer length after patching", () => {
      const pdf = createTestPdfBuffer();
      const originalLength = pdf.length;
      const placeholders = findPlaceholders(pdf);
      const byteRange = calculateByteRange(pdf, placeholders);

      patchByteRange(pdf, placeholders, byteRange);

      expect(pdf.length).toBe(originalLength);
    });
  });

  describe("patchContents", () => {
    it("patches Contents with signature bytes", () => {
      const pdf = createTestPdfBuffer();
      const placeholders = findPlaceholders(pdf);
      const signature = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);

      patchContents(pdf, placeholders, signature);

      // Verify hex encoding
      const decoder = new TextDecoder();
      const patched = decoder.decode(
        pdf.subarray(
          placeholders.contentsStart,
          placeholders.contentsStart + placeholders.contentsLength,
        ),
      );

      expect(patched.startsWith("DEADBEEF")).toBe(true);
      // Rest should be zero padding
      expect(patched.slice(8)).toMatch(/^0+$/);
    });

    it("uses uppercase hex encoding", () => {
      const pdf = createTestPdfBuffer();
      const placeholders = findPlaceholders(pdf);
      const signature = new Uint8Array([0xab, 0xcd]);

      patchContents(pdf, placeholders, signature);

      const decoder = new TextDecoder();
      const patched = decoder.decode(
        pdf.subarray(placeholders.contentsStart, placeholders.contentsStart + 4),
      );

      expect(patched).toBe("ABCD");
    });

    it("throws PlaceholderError if signature too large", () => {
      const pdf = createTestPdfBuffer();
      const placeholders = findPlaceholders(pdf);
      // Signature larger than 100 bytes (our test placeholder size)
      const signature = new Uint8Array(150);

      expect(() => patchContents(pdf, placeholders, signature)).toThrow(PlaceholderError);
    });

    it("provides size info in PlaceholderError", () => {
      const pdf = createTestPdfBuffer();
      const placeholders = findPlaceholders(pdf);
      const signature = new Uint8Array(150);

      try {
        patchContents(pdf, placeholders, signature);
        expect.fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(PlaceholderError);
        const error = e as PlaceholderError;
        expect(error.requiredSize).toBe(150);
        expect(error.availableSize).toBe(100); // placeholders.contentsLength / 2
      }
    });

    it("fills entire placeholder with signature + padding", () => {
      const pdf = createTestPdfBuffer();
      const placeholders = findPlaceholders(pdf);
      const signature = new Uint8Array([0x01, 0x02, 0x03]);

      patchContents(pdf, placeholders, signature);

      const decoder = new TextDecoder();
      const patched = decoder.decode(
        pdf.subarray(
          placeholders.contentsStart,
          placeholders.contentsStart + placeholders.contentsLength,
        ),
      );

      // Should be exactly the placeholder length
      expect(patched.length).toBe(placeholders.contentsLength);
      // Should start with signature
      expect(patched.startsWith("010203")).toBe(true);
      // Should be padded with zeros
      expect(patched.endsWith("0")).toBe(true);
    });
  });

  describe("extractSignedBytes", () => {
    it("extracts correct byte ranges", () => {
      const pdf = createTestPdfBuffer();
      const placeholders = findPlaceholders(pdf);
      const byteRange = calculateByteRange(pdf, placeholders);

      const signedBytes = extractSignedBytes(pdf, byteRange);

      // Should have length1 + length2 bytes
      expect(signedBytes.length).toBe(byteRange.length1 + byteRange.length2);

      // First part should match buffer start
      expect(signedBytes.subarray(0, byteRange.length1)).toEqual(
        pdf.subarray(0, byteRange.length1),
      );

      // Second part should match buffer after Contents
      expect(signedBytes.subarray(byteRange.length1)).toEqual(
        pdf.subarray(byteRange.offset2, byteRange.offset2 + byteRange.length2),
      );
    });

    it("excludes Contents value from signed bytes", () => {
      const pdf = createTestPdfBuffer();
      const placeholders = findPlaceholders(pdf);
      const byteRange = calculateByteRange(pdf, placeholders);

      const signedBytes = extractSignedBytes(pdf, byteRange);

      // The signed bytes should not contain the Contents value
      // Contents placeholder is all zeros
      const decoder = new TextDecoder();
      const signedStr = decoder.decode(signedBytes);

      // Should not have a long run of zeros (the placeholder)
      // Our placeholder is 200 chars of zeros
      expect(signedStr).not.toContain("0".repeat(100));
    });
  });

  describe("round-trip test", () => {
    it("complete signing flow works correctly", () => {
      // Create a test PDF buffer
      const pdf = createTestPdfBuffer();
      const originalLength = pdf.length;

      // Find placeholders
      const placeholders = findPlaceholders(pdf);

      // Calculate ByteRange
      const byteRange = calculateByteRange(pdf, placeholders);

      // Patch ByteRange
      patchByteRange(pdf, placeholders, byteRange);

      // Extract bytes to sign
      const signedBytes = extractSignedBytes(pdf, byteRange);

      // Create a fake signature
      const signature = new Uint8Array([0x30, 0x82, 0x01, 0x00]);

      // Patch Contents
      patchContents(pdf, placeholders, signature);

      // Verify buffer length unchanged
      expect(pdf.length).toBe(originalLength);

      // Verify ByteRange is correct
      const decoder = new TextDecoder();
      const pdfStr = decoder.decode(pdf);
      expect(pdfStr).toContain("/ByteRange [0");

      // Verify Contents has signature
      expect(pdfStr).toContain("30820100");
    });
  });
});

/**
 * Create a minimal test PDF buffer with signature placeholders.
 */
function createTestPdfBuffer(): Uint8Array {
  const encoder = new TextEncoder();

  const parts = [
    "%PDF-1.7\n",
    "1 0 obj\n",
    "<<\n",
    "  /Type /Sig\n",
    "  /Filter /Adobe.PPKLite\n",
    "  /SubFilter /ETSI.CAdES.detached\n",
    `  ${createByteRangePlaceholder()}\n`,
    `  /Contents ${createContentsPlaceholder(100)}\n`,
    "  /M (D:20250105120000Z)\n",
    ">>\n",
    "endobj\n",
    "%%EOF\n",
  ];

  const pdfStr = parts.join("");
  return encoder.encode(pdfStr);
}
