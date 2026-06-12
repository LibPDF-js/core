/**
 * Integration tests for `pdf.addTimestamp()` — archival document timestamps.
 *
 * These tests use FreeTSA (a public RFC 3161 timestamp authority) to exercise
 * the PAdES B-LTA flow where document timestamps are appended after one or
 * more signatures.
 */

import { PDF } from "#src/api/pdf";
import { HttpTimestampAuthority } from "#src/signatures/timestamp";
import { loadFixture, saveTestOutput } from "#src/test-utils";
import { describe, expect, it } from "vitest";

import { loadTestSigner, TEST_TSA_URL } from "./test-helpers";

describe("timestamping integration", () => {
  const tsa = new HttpTimestampAuthority(TEST_TSA_URL);

  describe("standalone document timestamp", () => {
    it("adds a document timestamp to an unsigned PDF", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);

      const { bytes, warnings } = await pdf.addTimestamp({
        timestampAuthority: tsa,
      });

      // Should produce a valid, larger PDF.
      expect(bytes.length).toBeGreaterThan(pdfBytes.length);
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
      expect(warnings).toHaveLength(0);

      const pdfStr = new TextDecoder().decode(bytes);

      // Should contain a document timestamp dictionary with the right shape.
      expect(pdfStr).toContain("/Type /DocTimeStamp");
      expect(pdfStr).toContain("/Filter /Adobe.PPKLite");
      expect(pdfStr).toContain("/SubFilter /ETSI.RFC3161");

      // Default field name uses the Timestamp_ prefix.
      expect(pdfStr).toContain("/T (Timestamp_1)");

      // AcroForm /SigFlags must be set so viewers recognize the timestamp.
      expect(pdfStr).toMatch(/\/SigFlags\s+3/);

      // Incremental update markers must be present.
      expect(pdfStr).toContain("/Prev");
      expect(pdfStr.trim()).toMatch(/%%EOF\s*$/);

      await saveTestOutput("signatures/timestamped-unsigned.pdf", bytes);
    });

    it("appends an archival timestamp after a B-T signature", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);
      const signer = await loadTestSigner();

      // First sign with B-T (timestamped signature).
      await pdf.sign({
        signer,
        level: "B-T",
        timestampAuthority: tsa,
        reason: "Approval",
      });

      // Then seal with an archival document timestamp.
      const { bytes, warnings } = await pdf.addTimestamp({
        timestampAuthority: tsa,
      });

      expect(warnings).toHaveLength(0);

      const pdfStr = new TextDecoder().decode(bytes);

      // Both the signature and the document timestamp must be present.
      expect(pdfStr).toContain("/Type /Sig");
      expect(pdfStr).toContain("/Type /DocTimeStamp");
      expect(pdfStr).toContain("/SubFilter /ETSI.CAdES.detached");
      expect(pdfStr).toContain("/SubFilter /ETSI.RFC3161");

      // Two incremental updates means at least three xref sections
      // (original + signature + timestamp).
      const xrefCount = (pdfStr.match(/^xref$/gm) ?? []).length;
      expect(xrefCount).toBeGreaterThanOrEqual(3);

      await saveTestOutput("signatures/signed-then-timestamped.pdf", bytes);
    });

    it("uses a custom field name when provided", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);

      const { bytes } = await pdf.addTimestamp({
        timestampAuthority: tsa,
        fieldName: "ArchivalTS",
      });

      const pdfStr = new TextDecoder().decode(bytes);

      expect(pdfStr).toContain("/T (ArchivalTS)");
      expect(pdfStr).not.toContain("/T (Timestamp_1)");
    });

    it("produces a non-empty /Contents value covering the document", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);

      const { bytes } = await pdf.addTimestamp({ timestampAuthority: tsa });

      const pdfStr = new TextDecoder().decode(bytes);

      // The /Contents must contain a real timestamp token, not just zeros.
      const contentsMatches = [...pdfStr.matchAll(/\/Contents\s*<([0-9A-Fa-f]+)>/g)];
      expect(contentsMatches.length).toBeGreaterThan(0);

      const lastContentsHex = contentsMatches.at(-1)?.[1] ?? "";
      expect(lastContentsHex).not.toMatch(/^0+$/);
      expect(lastContentsHex.length).toBeGreaterThan(1000);

      // ByteRange should cover the whole file outside the /Contents window.
      const byteRangeMatch = pdfStr.match(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/);
      expect(byteRangeMatch).not.toBeNull();

      const [, offset1, length1, offset2, length2] = byteRangeMatch?.map(Number) ?? [];

      expect(offset1).toBe(0);
      expect(offset2).toBeGreaterThan(length1);
      expect(offset2 + length2).toBe(bytes.length);
    });
  });

  describe("pre-allocated timestamp field (DocMDP / AES flows)", () => {
    it("fills a pre-allocated empty signature field by name", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);

      // Reserve the timestamp field up-front, before any signing happens.
      // In a real DocMDP flow this would be done during document
      // preparation so the /AcroForm /Fields array is locked in before
      // the certification signature is applied.
      const form = pdf.getOrCreateForm();
      form.createSignatureField("ArchivalTimestamp");
      const prepared = await pdf.save();
      const preparedPdf = await PDF.load(prepared);

      const { bytes, warnings } = await preparedPdf.addTimestamp({
        timestampAuthority: tsa,
        fieldName: "ArchivalTimestamp",
      });

      expect(warnings).toHaveLength(0);

      const pdfStr = new TextDecoder().decode(bytes);

      // The reserved field is used; no new Timestamp_N field is created.
      expect(pdfStr).toContain("/T (ArchivalTimestamp)");
      expect(pdfStr).not.toContain("/T (Timestamp_1)");

      // And it is a real document timestamp, not a regular signature.
      expect(pdfStr).toContain("/Type /DocTimeStamp");
      expect(pdfStr).toContain("/SubFilter /ETSI.RFC3161");

      await saveTestOutput("signatures/timestamped-prealloc.pdf", bytes);
    });

    it("rejects reusing a field that is not a signature field", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);

      const form = pdf.getOrCreateForm();
      form.createTextField("NotASig");
      const prepared = await pdf.save();
      const preparedPdf = await PDF.load(prepared);

      await expect(
        preparedPdf.addTimestamp({
          timestampAuthority: tsa,
          fieldName: "NotASig",
        }),
      ).rejects.toThrow(/not a signature field/);
    });
  });

  describe("multiple appended timestamps", () => {
    it("can stack multiple archival timestamps on the same instance", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);

      await pdf.addTimestamp({ timestampAuthority: tsa });
      const { bytes } = await pdf.addTimestamp({ timestampAuthority: tsa });

      const pdfStr = new TextDecoder().decode(bytes);

      // Each timestamp gets its own field; default names are generated.
      expect(pdfStr).toContain("/T (Timestamp_1)");
      expect(pdfStr).toContain("/T (Timestamp_2)");

      // Two timestamps → at least three xref sections.
      const xrefCount = (pdfStr.match(/^xref$/gm) ?? []).length;
      expect(xrefCount).toBeGreaterThanOrEqual(3);

      await saveTestOutput("signatures/timestamped-twice.pdf", bytes);
    });
  });

  describe("long-term validation", () => {
    it("embeds DSS data for the timestamp's certificate chain", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);

      const { bytes, warnings } = await pdf.addTimestamp({
        timestampAuthority: tsa,
        longTermValidation: true,
      });

      // Network-flakiness may produce warnings; structure must still be right.
      const pdfStr = new TextDecoder().decode(bytes);

      expect(pdfStr).toContain("/Type /DocTimeStamp");
      expect(pdfStr).toContain("/Type /DSS");
      expect(pdfStr).toContain("/Certs");

      // VRI entry must be present for the timestamp's /Contents value.
      expect(pdfStr).toContain("/VRI");

      if (warnings.length > 0) {
        console.log("timestamp LTV warnings:", warnings);
      }

      await saveTestOutput("signatures/timestamped-ltv.pdf", bytes);
    });
  });

  describe("loaded after timestamping", () => {
    it("the timestamped PDF can be re-parsed", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);

      const { bytes } = await pdf.addTimestamp({ timestampAuthority: tsa });

      const reloaded = await PDF.load(bytes);
      expect(reloaded.getPageCount()).toBe(pdf.getPageCount());
    });

    it("preserves the original bytes at the head of the file", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);

      const { bytes } = await pdf.addTimestamp({ timestampAuthority: tsa });

      const originalPrefix = bytes.slice(0, 100);
      const expectedPrefix = pdfBytes.slice(0, 100);
      expect(originalPrefix).toEqual(expectedPrefix);
    });
  });

  describe("error handling", () => {
    it("throws when timestampAuthority is omitted", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);

      await expect(
        // oxlint-disable-next-line typescript/no-explicit-any
        pdf.addTimestamp({} as any),
      ).rejects.toThrow(/timestampAuthority/);
    });

    it("throws when the requested field name is already signed", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);

      await pdf.addTimestamp({
        timestampAuthority: tsa,
        fieldName: "MyTimestamp",
      });

      // The first call already filled MyTimestamp; a second call against
      // the same name must refuse to overwrite an already-signed field.
      await expect(
        pdf.addTimestamp({
          timestampAuthority: tsa,
          fieldName: "MyTimestamp",
        }),
      ).rejects.toThrow(/already signed/);
    });

    it("propagates errors from the timestamp authority", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);

      const failingTsa = {
        async timestamp(): Promise<Uint8Array> {
          throw new Error("TSA unavailable");
        },
      };

      await expect(pdf.addTimestamp({ timestampAuthority: failingTsa })).rejects.toThrow(
        /TSA unavailable/,
      );
    });
  });
});
