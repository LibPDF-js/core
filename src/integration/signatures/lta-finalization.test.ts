/**
 * Integration tests for `pdf.addValidationData()` and `pdf.addArchivalData()`
 * — the end-of-flow PAdES B-LTA finalization operations used after a
 * multi-signer advanced electronic signature (AdES) workflow.
 */

import { PDF } from "#src/api/pdf";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfStream } from "#src/objects/pdf-stream";
import { computeSha1Hex } from "#src/signatures/ltv/vri";
import { HttpTimestampAuthority } from "#src/signatures/timestamp";
import { loadFixture, saveTestOutput } from "#src/test-utils";
import { describe, expect, it } from "vitest";

import { loadTestSigner, TEST_TSA_URL } from "./test-helpers";

describe("LTA finalization integration", () => {
  const tsa = new HttpTimestampAuthority(TEST_TSA_URL);

  describe("addValidationData()", () => {
    it("is a no-op on an unsigned PDF", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);

      const { bytes, warnings, signatureCount } = await pdf.addValidationData();

      expect(signatureCount).toBe(0);
      expect(warnings).toHaveLength(0);

      // No signatures → no DSS in the resulting bytes.
      const pdfStr = new TextDecoder().decode(bytes);
      expect(pdfStr).not.toContain("/Type /DSS");
    });

    it("upgrades a B-T signature to B-LT", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);
      const signer = await loadTestSigner();

      // Sign at B-T (no LTV embedded yet).
      await pdf.sign({
        signer,
        level: "B-T",
        timestampAuthority: tsa,
      });

      // Pre-condition: no DSS yet.
      const beforeStr = new TextDecoder().decode(await pdf.save());
      expect(beforeStr).not.toContain("/Type /DSS");

      const { bytes, warnings, signatureCount } = await pdf.addValidationData();

      expect(signatureCount).toBe(1);

      const pdfStr = new TextDecoder().decode(bytes);
      expect(pdfStr).toContain("/Type /DSS");
      expect(pdfStr).toContain("/Certs");
      expect(pdfStr).toContain("/VRI");

      // Should be safe even if revocation lookups produce CHAIN_INCOMPLETE
      // warnings — we only assert that no LTV_GATHER_FAILED occurred.
      const fatal = warnings.filter(w => w.code === "LTV_GATHER_FAILED");
      expect(fatal).toHaveLength(0);

      await saveTestOutput("signatures/validation-data-upgraded.pdf", bytes);
    });

    it("gathers LTV for multiple signatures with one DSS write", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);
      const signer = await loadTestSigner();

      // Two B-T signatures.
      await pdf.sign({
        signer,
        level: "B-T",
        timestampAuthority: tsa,
        fieldName: "Signer1",
      });
      await pdf.sign({
        signer,
        level: "B-T",
        timestampAuthority: tsa,
        fieldName: "Signer2",
      });

      const { bytes, signatureCount } = await pdf.addValidationData();

      expect(signatureCount).toBe(2);

      const pdfStr = new TextDecoder().decode(bytes);

      // One DSS, two VRI entries (one per signature).
      expect(pdfStr).toContain("/Type /DSS");

      // The DSS update should be a single incremental revision — count
      // xref sections: original + 2 signatures + 1 DSS = 4.
      const xrefCount = (pdfStr.match(/^xref$/gm) ?? []).length;
      expect(xrefCount).toBe(4);

      await saveTestOutput("signatures/validation-data-multi-signer.pdf", bytes);
    });

    it("merges with pre-existing DSS data without duplicating certs", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);
      const signer = await loadTestSigner();

      // First sign at B-LT (writes DSS for signer 1).
      await pdf.sign({
        signer,
        level: "B-LT",
        timestampAuthority: tsa,
        fieldName: "Signer1",
      });

      // Then add another B-T sig (no DSS).
      await pdf.sign({
        signer,
        level: "B-T",
        timestampAuthority: tsa,
        fieldName: "Signer2",
      });

      const { bytes, signatureCount } = await pdf.addValidationData();

      expect(signatureCount).toBe(2);

      const pdfStr = new TextDecoder().decode(bytes);

      // Both signature fields are still present.
      expect(pdfStr).toContain("/T (Signer1)");
      expect(pdfStr).toContain("/T (Signer2)");

      // Walk catalog → DSS → VRI in the merged result: the pre-existing
      // VRI entry (from the B-LT sign) must survive the merge and the new
      // signature must have its own entry. Both signatures use the same
      // TSA, whose token gets its own VRI entry, so expect at least 3.
      const reloaded = await PDF.load(bytes);
      const resolve = reloaded.context.registry.resolve.bind(reloaded.context.registry);
      const dss = reloaded.getCatalog().getDict("DSS", resolve);

      expect(dss).toBeDefined();

      const vri = dss?.getDict("VRI", resolve);

      expect(vri).toBeDefined();
      expect([...(vri?.keys() ?? [])].length).toBeGreaterThanOrEqual(3);

      // Certs must be deduplicated: both signatures share the same signer
      // chain, so no two /Certs streams may contain identical bytes.
      const certs = dss?.getArray("Certs", resolve);

      expect(certs).toBeDefined();
      expect(certs && certs.length).toBeGreaterThan(0);

      const certHashes = new Set<string>();

      for (const item of certs ?? []) {
        const stream = item instanceof PdfRef ? resolve(item) : item;

        expect(stream).toBeInstanceOf(PdfStream);

        if (stream instanceof PdfStream) {
          const hash = await computeSha1Hex(stream.getDecodedData());

          expect(certHashes.has(hash)).toBe(false);
          certHashes.add(hash);
        }
      }
    });
  });

  describe("addArchivalData()", () => {
    it("performs full B-LTA on a single B-T signature", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);
      const signer = await loadTestSigner();

      await pdf.sign({
        signer,
        level: "B-T",
        timestampAuthority: tsa,
      });

      const { bytes, warnings, signatureCount } = await pdf.addArchivalData({
        timestampAuthority: tsa,
      });

      expect(signatureCount).toBe(1);

      const pdfStr = new TextDecoder().decode(bytes);

      // Original signature + DSS + DocTimeStamp + DSS for timestamp.
      expect(pdfStr).toContain("/Type /Sig");
      expect(pdfStr).toContain("/Type /DocTimeStamp");
      expect(pdfStr).toContain("/SubFilter /ETSI.RFC3161");
      expect(pdfStr).toContain("/Type /DSS");

      // No fatal warnings.
      const fatal = warnings.filter(w => w.code === "LTV_GATHER_FAILED");
      expect(fatal).toHaveLength(0);

      await saveTestOutput("signatures/archival-single-signer.pdf", bytes);
    });

    it("performs full B-LTA on a multi-signer document", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);
      const signer = await loadTestSigner();

      // Three B-T signatures — typical multi-recipient AdES flow.
      await pdf.sign({
        signer,
        level: "B-T",
        timestampAuthority: tsa,
        fieldName: "Signer1",
      });
      await pdf.sign({
        signer,
        level: "B-T",
        timestampAuthority: tsa,
        fieldName: "Signer2",
      });
      await pdf.sign({
        signer,
        level: "B-T",
        timestampAuthority: tsa,
        fieldName: "Signer3",
      });

      const { bytes, warnings, signatureCount } = await pdf.addArchivalData({
        timestampAuthority: tsa,
      });

      // The three pre-existing signatures get LTV gathered.
      expect(signatureCount).toBe(3);

      const pdfStr = new TextDecoder().decode(bytes);

      // All three signatures present.
      expect(pdfStr).toContain("/T (Signer1)");
      expect(pdfStr).toContain("/T (Signer2)");
      expect(pdfStr).toContain("/T (Signer3)");

      // Archival timestamp + DSS present.
      expect(pdfStr).toContain("/Type /DocTimeStamp");
      expect(pdfStr).toContain("/Type /DSS");

      // No fatal warnings.
      const fatal = warnings.filter(w => w.code === "LTV_GATHER_FAILED");
      expect(fatal).toHaveLength(0);

      await saveTestOutput("signatures/archival-multi-signer.pdf", bytes);
    });

    it("uses a pre-allocated field for the archival timestamp", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);
      const signer = await loadTestSigner();

      // Reserve archival timestamp field up front, then sign normally.
      pdf.getOrCreateForm().createSignatureField("ArchivalTS");
      await pdf.reload(await pdf.save());

      await pdf.sign({
        signer,
        level: "B-T",
        timestampAuthority: tsa,
        fieldName: "Signer1",
      });

      const { bytes } = await pdf.addArchivalData({
        timestampAuthority: tsa,
        fieldName: "ArchivalTS",
      });

      const pdfStr = new TextDecoder().decode(bytes);

      // The reserved field is filled.
      expect(pdfStr).toContain("/T (ArchivalTS)");
      // Auto-generated timestamp name should not have been used.
      expect(pdfStr).not.toContain("/T (Timestamp_1)");
    });

    it("throws when timestampAuthority is omitted", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);

      await expect(
        // oxlint-disable-next-line typescript/no-explicit-any
        pdf.addArchivalData({} as any),
      ).rejects.toThrow(/timestampAuthority/);
    });

    it("works on an unsigned PDF (just adds a timestamp + its DSS)", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);

      const { bytes, signatureCount } = await pdf.addArchivalData({
        timestampAuthority: tsa,
      });

      // No pre-existing sigs, but the timestamp itself is still embedded.
      expect(signatureCount).toBe(0);

      const pdfStr = new TextDecoder().decode(bytes);
      expect(pdfStr).toContain("/Type /DocTimeStamp");
      expect(pdfStr).toContain("/Type /DSS");
    });
  });
});
