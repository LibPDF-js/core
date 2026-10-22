/**
 * Integration tests for PDF attachment functionality.
 *
 * Tests reading, writing, and round-tripping attachments using
 * real PDF fixtures from PDFBox test suite.
 */

import { loadFixture } from "#src/test-utils";
import { describe, expect, it } from "vitest";

import { PDF } from "./pdf";

describe("PDF attachments", () => {
  describe("reading attachments", () => {
    it("reads attachments from null_PDComplexFileSpecification.pdf", async () => {
      const bytes = await loadFixture("attachments", "null_PDComplexFileSpecification.pdf");
      const pdf = await PDF.load(bytes);

      const attachments = pdf.getAttachments();

      // The PDF has 2 entries in EmbeddedFiles but one is null:
      // - "My first attachment" → 8 0 R (actual FileSpec)
      // - "non-existent-file.docx" → null (no embedded file)
      // We only return attachments with actual embedded content
      expect(attachments.size).toBe(1);

      // "My first attachment" should exist and have content
      expect(attachments.has("My first attachment")).toBe(true);
      const firstAttachment = attachments.get("My first attachment")!;
      expect(firstAttachment.size).toBe(17660);
    });

    it("reads attachments with platform-specific embedded files", async () => {
      const bytes = await loadFixture("attachments", "testPDF_multiFormatEmbFiles.pdf");
      const pdf = await PDF.load(bytes);

      const attachments = pdf.getAttachments();

      // Should have at least one attachment
      expect(attachments.size).toBeGreaterThan(0);

      // Get the first attachment
      const data = pdf.getAttachment("My first attachment");
      expect(data).not.toBeNull();

      // PDFBox test verifies content contains "non os specific"
      const text = new TextDecoder().decode(data!);
      expect(text.toLowerCase()).toContain("non os specific");
    });

    it("returns empty map for PDF without attachments", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      const attachments = pdf.getAttachments();
      expect(attachments.size).toBe(0);
    });

    it("hasAttachment() returns correct values", async () => {
      const bytes = await loadFixture("attachments", "null_PDComplexFileSpecification.pdf");
      const pdf = await PDF.load(bytes);

      expect(pdf.hasAttachment("My first attachment")).toBe(true);
      expect(pdf.hasAttachment("nonexistent")).toBe(false);
    });

    it("getAttachment() returns null for missing attachment", async () => {
      const bytes = await loadFixture("attachments", "null_PDComplexFileSpecification.pdf");
      const pdf = await PDF.load(bytes);

      const data = pdf.getAttachment("nonexistent");
      expect(data).toBeNull();
    });
  });

  describe("writing attachments", () => {
    it("adds an attachment to a PDF without attachments", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      const testData = new TextEncoder().encode("Hello, World!");

      pdf.addAttachment("test.txt", testData, {
        description: "A test file",
        mimeType: "text/plain",
      });

      // Verify attachment was added
      expect(pdf.hasAttachment("test.txt")).toBe(true);

      const attachments = pdf.getAttachments();
      expect(attachments.size).toBe(1);
      expect(attachments.get("test.txt")?.filename).toBe("test.txt");
      expect(attachments.get("test.txt")?.description).toBe("A test file");
      expect(attachments.get("test.txt")?.mimeType).toBe("text/plain");
      expect(attachments.get("test.txt")?.size).toBe(13);
    });

    it("throws error when adding duplicate attachment without overwrite", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      pdf.addAttachment("test.txt", new Uint8Array([1, 2, 3]));

      expect(() => pdf.addAttachment("test.txt", new Uint8Array([4, 5, 6]))).toThrow(
        'Attachment "test.txt" already exists',
      );
    });

    it("overwrites attachment when overwrite: true", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      pdf.addAttachment("test.txt", new Uint8Array([1, 2, 3]));
      pdf.addAttachment("test.txt", new Uint8Array([4, 5, 6, 7, 8]), {
        overwrite: true,
      });

      const data = pdf.getAttachment("test.txt");
      expect(data).toEqual(new Uint8Array([4, 5, 6, 7, 8]));
    });

    it("removes an attachment", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      pdf.addAttachment("test1.txt", new Uint8Array([1]));
      pdf.addAttachment("test2.txt", new Uint8Array([2]));

      expect(pdf.hasAttachment("test1.txt")).toBe(true);
      expect(pdf.hasAttachment("test2.txt")).toBe(true);

      const removed = pdf.removeAttachment("test1.txt");
      expect(removed).toBe(true);

      expect(pdf.hasAttachment("test1.txt")).toBe(false);
      expect(pdf.hasAttachment("test2.txt")).toBe(true);
    });

    it("removeAttachment() returns false for nonexistent attachment", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      const removed = pdf.removeAttachment("nonexistent");
      expect(removed).toBe(false);
    });

    it("auto-detects MIME type from filename", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      pdf.addAttachment("image.png", new Uint8Array([1, 2, 3]));
      pdf.addAttachment("doc.pdf", new Uint8Array([4, 5, 6]));
      pdf.addAttachment("unknown.xyz", new Uint8Array([7, 8, 9]));

      const attachments = pdf.getAttachments();

      expect(attachments.get("image.png")?.mimeType).toBe("image/png");
      expect(attachments.get("doc.pdf")?.mimeType).toBe("application/pdf");
      expect(attachments.get("unknown.xyz")?.mimeType).toBeUndefined();
    });
  });

  describe("round-trip", () => {
    it("preserves attachments after save and reload", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      const testData = new TextEncoder().encode("Test content for round-trip");

      pdf.addAttachment("roundtrip.txt", testData, {
        description: "Round-trip test",
      });

      // Save the PDF
      const savedBytes = await pdf.save();

      // Reload and verify
      const pdf2 = await PDF.load(savedBytes);

      expect(pdf2.hasAttachment("roundtrip.txt")).toBe(true);

      const attachments = pdf2.getAttachments();
      expect(attachments.get("roundtrip.txt")?.description).toBe("Round-trip test");
      expect(attachments.get("roundtrip.txt")?.size).toBe(testData.length);

      const retrievedData = pdf2.getAttachment("roundtrip.txt");
      expect(retrievedData).toEqual(testData);
    });

    it("writes the MIME subtype escaped once", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      pdf.addAttachment("invoice.xml", new TextEncoder().encode("<Invoice/>"), {
        mimeType: "application/xml",
      });

      const savedBytes = await pdf.save();
      const raw = new TextDecoder("latin1").decode(savedBytes);

      // "/" is escaped once as #2F; a double escape (#232F) is an invalid
      // MIME type and fails PDF/A-3 validation
      expect(raw).toContain("/Subtype /application#2Fxml");
      expect(raw).not.toContain("#232F");

      const pdf2 = await PDF.load(savedBytes);
      expect(pdf2.getAttachments().get("invoice.xml")?.mimeType).toBe("application/xml");
    });

    it("preserves existing attachments when adding new ones", async () => {
      const bytes = await loadFixture("attachments", "null_PDComplexFileSpecification.pdf");
      const pdf = await PDF.load(bytes);

      // Get original attachment count
      const originalAttachments = pdf.getAttachments();
      const originalCount = originalAttachments.size;

      // Add a new attachment
      pdf.addAttachment("new.txt", new TextEncoder().encode("New content"));

      // Save and reload
      const savedBytes = await pdf.save();
      const pdf2 = await PDF.load(savedBytes);

      const attachments = pdf2.getAttachments();

      // Should have original + 1 new
      expect(attachments.size).toBe(originalCount + 1);
      expect(attachments.has("new.txt")).toBe(true);
      expect(attachments.has("My first attachment")).toBe(true);
    });

    it("handles multiple attachments round-trip", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      // Add several attachments
      pdf.addAttachment("file1.txt", new TextEncoder().encode("Content 1"));
      pdf.addAttachment("file2.json", new TextEncoder().encode('{"key": "value"}'));
      pdf.addAttachment("file3.bin", new Uint8Array([0x00, 0xff, 0x42, 0x13]));

      // Save and reload
      const savedBytes = await pdf.save();
      const pdf2 = await PDF.load(savedBytes);

      const attachments = pdf2.getAttachments();
      expect(attachments.size).toBe(3);

      // Verify content
      const data1 = pdf2.getAttachment("file1.txt");
      expect(new TextDecoder().decode(data1!)).toBe("Content 1");

      const data2 = pdf2.getAttachment("file2.json");
      expect(new TextDecoder().decode(data2!)).toBe('{"key": "value"}');

      const data3 = pdf2.getAttachment("file3.bin");
      expect(data3).toEqual(new Uint8Array([0x00, 0xff, 0x42, 0x13]));
    });
  });
});
