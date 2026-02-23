/**
 * Integration tests for PDF digital signatures.
 *
 * These tests use real certificates and verify the complete signing flow,
 * from loading a PDF to producing a signed document.
 */

import { PDF } from "#src/api/pdf";
import { P12Signer } from "#src/signatures/signers";
import { HttpTimestampAuthority } from "#src/signatures/timestamp";
import { loadFixture, saveTestOutput } from "#src/test-utils";
import { describe, expect, it } from "vitest";

/** Test P12 files with different encryption formats */
const P12_FILES = {
  /** AES-256-CBC (modern default) */
  aes256: "test-signer-aes256.p12",
  /** AES-128-CBC */
  aes128: "test-signer-aes128.p12",
  /** Triple DES (legacy but common) */
  tripleDes: "test-signer-3des.p12",
  /** RC2-40 (very old legacy format) */
  legacy: "test-signer-rc2-40.p12",
  /** ECDSA P-256 */
  ecdsaP256: "test-signer-ec-p256-aes256.p12",
  /** ECDSA P-384 */
  ecdsaP384: "test-signer-ec-p384-aes256.p12",
};

describe("signing integration", () => {
  /**
   * Load the test P12 certificate (default AES-256).
   */
  async function loadTestSigner(filename = P12_FILES.aes256) {
    const p12Bytes = await loadFixture("certificates", filename);

    return P12Signer.create(p12Bytes, "test123");
  }

  describe("B-B signing (basic)", () => {
    it("signs a simple PDF document", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);
      const signer = await loadTestSigner();

      const { bytes, warnings } = await pdf.sign({
        signer,
        reason: "Integration test",
        location: "Test Suite",
      });

      // Should produce valid PDF
      expect(bytes.length).toBeGreaterThan(pdfBytes.length);
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

      // Should have no warnings
      expect(warnings).toHaveLength(0);

      // Should contain signature dictionary
      const pdfStr = new TextDecoder().decode(bytes);
      expect(pdfStr).toContain("/Type /Sig");
      expect(pdfStr).toContain("/Filter /Adobe.PPKLite");
      expect(pdfStr).toContain("/SubFilter /ETSI.CAdES.detached");

      // Save for manual inspection
      await saveTestOutput("signatures/signed-basic.pdf", bytes);
    });

    it("signs with PKCS7 format", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);
      const signer = await loadTestSigner();

      const { bytes, warnings } = await pdf.sign({
        signer,
        subFilter: "adbe.pkcs7.detached",
        reason: "PKCS7 test",
      });

      expect(warnings).toHaveLength(0);

      const pdfStr = new TextDecoder().decode(bytes);
      expect(pdfStr).toContain("/SubFilter /adbe.pkcs7.detached");

      await saveTestOutput("signatures/signed-pkcs7.pdf", bytes);
    });

    it("signs with custom field name", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);
      const signer = await loadTestSigner();

      const { bytes } = await pdf.sign({
        signer,
        fieldName: "MyCustomSignature",
      });

      const pdfStr = new TextDecoder().decode(bytes);
      expect(pdfStr).toContain("/T (MyCustomSignature)");
    });

    it("includes metadata in signature", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);
      const signer = await loadTestSigner();

      const signingTime = new Date("2025-01-05T12:00:00Z");

      const { bytes } = await pdf.sign({
        signer,
        reason: "Approval",
        location: "New York",
        contactInfo: "test@example.com",
        signingTime,
      });

      const pdfStr = new TextDecoder().decode(bytes);
      expect(pdfStr).toContain("/Reason (Approval)");
      expect(pdfStr).toContain("/Location (New York)");
      expect(pdfStr).toContain("/ContactInfo (test@example.com)");
      expect(pdfStr).toContain("/M (D:20250105120000Z)");
    });
  });

  describe("B-T signing (with timestamp)", () => {
    // FreeTSA is a free public timestamp authority
    const tsa = new HttpTimestampAuthority("https://freetsa.org/tsr");

    it("signs with timestamp (B-T level)", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);
      const signer = await loadTestSigner();

      const { bytes, warnings } = await pdf.sign({
        signer,
        level: "B-T",
        timestampAuthority: tsa,
        reason: "B-T test with timestamp",
      });

      expect(warnings).toHaveLength(0);
      expect(bytes.length).toBeGreaterThan(pdfBytes.length);

      const pdfStr = new TextDecoder().decode(bytes);
      expect(pdfStr).toContain("/Type /Sig");
      expect(pdfStr).toContain("/SubFilter /ETSI.CAdES.detached");

      await saveTestOutput("signatures/signed-b-t.pdf", bytes);
    });

    it("signs with ECDSA and timestamp", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);
      const signer = await loadTestSigner(P12_FILES.ecdsaP256);

      const { bytes, warnings } = await pdf.sign({
        signer,
        level: "B-T",
        timestampAuthority: tsa,
        reason: "ECDSA B-T test",
      });

      expect(warnings).toHaveLength(0);

      await saveTestOutput("signatures/signed-ecdsa-b-t.pdf", bytes);
    });
  });

  describe("B-LT signing (long-term validation)", () => {
    // FreeTSA is a free public timestamp authority
    const tsa = new HttpTimestampAuthority("https://freetsa.org/tsr");

    it("signs with timestamp and LTV data (B-LT level)", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);
      const signer = await loadTestSigner();

      const { bytes, warnings } = await pdf.sign({
        signer,
        level: "B-LT",
        timestampAuthority: tsa,
        reason: "B-LT test with LTV",
      });

      // May have warnings about chain/revocation if network issues
      // We just check the structure is correct
      expect(bytes.length).toBeGreaterThan(pdfBytes.length);

      const pdfStr = new TextDecoder().decode(bytes);
      expect(pdfStr).toContain("/Type /Sig");
      expect(pdfStr).toContain("/SubFilter /ETSI.CAdES.detached");

      // Should have DSS dictionary for LTV
      expect(pdfStr).toContain("/Type /DSS");
      expect(pdfStr).toContain("/VRI");

      await saveTestOutput("signatures/signed-b-lt.pdf", bytes);

      // Log warnings for debugging
      if (warnings.length > 0) {
        console.log("B-LT signing warnings:", warnings);
      }
    });

    it("includes TSA certificates in DSS", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);
      const signer = await loadTestSigner();

      const { bytes, warnings } = await pdf.sign({
        signer,
        level: "B-LT",
        timestampAuthority: tsa,
        reason: "B-LT TSA certs test",
      });

      const pdfStr = new TextDecoder().decode(bytes);

      // Should have DSS with Certs array
      expect(pdfStr).toContain("/DSS");
      expect(pdfStr).toContain("/Certs");

      await saveTestOutput("signatures/signed-b-lt-tsa-certs.pdf", bytes);
    });
  });

  describe("signed PDF structure", () => {
    it("creates valid incremental update", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);
      const signer = await loadTestSigner();

      const { bytes } = await pdf.sign({ signer });

      const pdfStr = new TextDecoder().decode(bytes);

      // Should have xref and trailer for incremental update
      expect(pdfStr).toContain("xref");
      expect(pdfStr).toContain("trailer");
      expect(pdfStr).toContain("/Prev");

      // Should end with %%EOF
      expect(pdfStr.trim()).toMatch(/%%EOF\s*$/);
    });

    it("preserves original content", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);
      const signer = await loadTestSigner();

      const { bytes } = await pdf.sign({ signer });

      // Original bytes should be preserved at the start
      const originalPrefix = bytes.slice(0, 100);
      const expectedPrefix = pdfBytes.slice(0, 100);

      expect(originalPrefix).toEqual(expectedPrefix);
    });

    it("has valid ByteRange", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);
      const signer = await loadTestSigner();

      const { bytes } = await pdf.sign({ signer });

      const pdfStr = new TextDecoder().decode(bytes);

      // Find ByteRange value
      const byteRangeMatch = pdfStr.match(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/);
      expect(byteRangeMatch).not.toBeNull();

      const [, offset1, length1, offset2, length2] = byteRangeMatch!.map(Number);

      // offset1 should be 0
      expect(offset1).toBe(0);

      // length1 + length2 should be less than total file size
      expect(length1 + length2).toBeLessThan(bytes.length);

      // offset2 should be after offset1 + length1
      expect(offset2).toBeGreaterThan(length1);

      // offset2 + length2 should equal file size
      expect(offset2 + length2).toBe(bytes.length);
    });

    it("has non-empty Contents", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);
      const signer = await loadTestSigner();

      const { bytes } = await pdf.sign({ signer });

      const pdfStr = new TextDecoder().decode(bytes);

      // Find Contents value - should have actual hex data, not just zeros
      const contentsMatch = pdfStr.match(/\/Contents\s*<([0-9A-Fa-f]+)>/);
      expect(contentsMatch).not.toBeNull();

      const contentsHex = contentsMatch![1];

      // Should not be all zeros
      expect(contentsHex).not.toMatch(/^0+$/);

      // Should have substantial length (CMS signature)
      expect(contentsHex.length).toBeGreaterThan(1000);
    });
  });

  describe("multiple signatures", () => {
    it("can add second signature to already-signed PDF", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");

      // First signature
      const pdf1 = await PDF.load(pdfBytes);
      const signer1 = await loadTestSigner();
      const { bytes: firstSigned } = await pdf1.sign({
        signer: signer1,
        fieldName: "Signature_1",
        reason: "First approval",
      });

      // Second signature
      const pdf2 = await PDF.load(firstSigned);
      const signer2 = await loadTestSigner();
      const { bytes: secondSigned } = await pdf2.sign({
        signer: signer2,
        fieldName: "Signature_2",
        reason: "Second approval",
      });

      // Should be larger than first signed version
      expect(secondSigned.length).toBeGreaterThan(firstSigned.length);

      const pdfStr = new TextDecoder().decode(secondSigned);

      // Should have both signatures
      expect(pdfStr).toContain("/T (Signature_1)");
      expect(pdfStr).toContain("/T (Signature_2)");

      // Should have multiple xref sections
      const xrefCount = (pdfStr.match(/^xref$/gm) || []).length;
      expect(xrefCount).toBeGreaterThanOrEqual(2);

      await saveTestOutput("signatures/signed-twice.pdf", secondSigned);
    });

    it("can add multiple signatures on same PDF instance (reload pattern)", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);
      const signer = await loadTestSigner();

      // First signature - PDF is automatically reloaded after signing
      await pdf.sign({
        signer,
        fieldName: "Signature_1",
        reason: "First approval",
      });

      // Second signature on same instance - works because PDF was reloaded
      await pdf.sign({
        signer,
        fieldName: "Signature_2",
        reason: "Second approval",
      });

      // Get final bytes
      const finalBytes = await pdf.save();

      const pdfStr = new TextDecoder().decode(finalBytes);

      // Should have both signatures
      expect(pdfStr).toContain("/T (Signature_1)");
      expect(pdfStr).toContain("/T (Signature_2)");

      // Should have multiple xref sections (incremental updates)
      const xrefCount = (pdfStr.match(/^xref$/gm) || []).length;
      expect(xrefCount).toBeGreaterThanOrEqual(2);

      await saveTestOutput("signatures/signed-twice-same-instance.pdf", finalBytes);
    });
  });

  describe("signed PDF can be loaded", () => {
    it("signed PDF can be parsed again", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);
      const signer = await loadTestSigner();

      const { bytes } = await pdf.sign({ signer });

      // Should be able to load the signed PDF
      const signedPdf = await PDF.load(bytes);

      // Should have the same page count
      expect(signedPdf.getPageCount()).toBe(pdf.getPageCount());
    });

    it("signed PDF preserves page content", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);
      const signer = await loadTestSigner();

      const { bytes } = await pdf.sign({ signer });

      const signedPdf = await PDF.load(bytes);
      const page = signedPdf.getPage(0);
      const originalPage = pdf.getPage(0);

      // Page should have same dimensions
      expect(page?.width).toBe(originalPage?.width);
      expect(page?.height).toBe(originalPage?.height);
    });
  });

  describe("P12 format compatibility", () => {
    it("loads AES-256-CBC encrypted P12", async () => {
      const signer = await loadTestSigner(P12_FILES.aes256);

      expect(signer.certificate).toBeInstanceOf(Uint8Array);
      expect(signer.certificate.length).toBeGreaterThan(0);
      expect(signer.keyType).toBe("RSA");
    });

    it("loads AES-128-CBC encrypted P12", async () => {
      const signer = await loadTestSigner(P12_FILES.aes128);

      expect(signer.certificate).toBeInstanceOf(Uint8Array);
      expect(signer.certificate.length).toBeGreaterThan(0);
      expect(signer.keyType).toBe("RSA");
    });

    it("loads Triple DES (3DES) encrypted P12", async () => {
      const signer = await loadTestSigner(P12_FILES.tripleDes);

      expect(signer.certificate).toBeInstanceOf(Uint8Array);
      expect(signer.certificate.length).toBeGreaterThan(0);
      expect(signer.keyType).toBe("RSA");
    });

    it("loads legacy RC2-40 encrypted P12", async () => {
      const signer = await loadTestSigner(P12_FILES.legacy);

      expect(signer.certificate).toBeInstanceOf(Uint8Array);
      expect(signer.certificate.length).toBeGreaterThan(0);
      expect(signer.keyType).toBe("RSA");
    });

    it("signs with AES-128 P12", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);
      const signer = await loadTestSigner(P12_FILES.aes128);

      const { bytes, warnings } = await pdf.sign({ signer });

      expect(warnings).toHaveLength(0);
      expect(bytes.length).toBeGreaterThan(pdfBytes.length);

      const pdfStr = new TextDecoder().decode(bytes);
      expect(pdfStr).toContain("/Type /Sig");

      await saveTestOutput("signatures/signed-aes128.pdf", bytes);
    });

    it("signs with Triple DES P12", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);
      const signer = await loadTestSigner(P12_FILES.tripleDes);

      const { bytes, warnings } = await pdf.sign({ signer });

      expect(warnings).toHaveLength(0);
      expect(bytes.length).toBeGreaterThan(pdfBytes.length);

      const pdfStr = new TextDecoder().decode(bytes);
      expect(pdfStr).toContain("/Type /Sig");

      await saveTestOutput("signatures/signed-3des.pdf", bytes);
    });

    it("signs with legacy RC2 P12", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);
      const signer = await loadTestSigner(P12_FILES.legacy);

      const { bytes, warnings } = await pdf.sign({ signer });

      expect(warnings).toHaveLength(0);
      expect(bytes.length).toBeGreaterThan(pdfBytes.length);

      const pdfStr = new TextDecoder().decode(bytes);
      expect(pdfStr).toContain("/Type /Sig");

      await saveTestOutput("signatures/signed-rc2.pdf", bytes);
    });
  });

  describe("ECDSA signatures", () => {
    it("loads ECDSA P-256 certificate", async () => {
      const signer = await loadTestSigner(P12_FILES.ecdsaP256);

      expect(signer.certificate).toBeInstanceOf(Uint8Array);
      expect(signer.certificate.length).toBeGreaterThan(0);
      expect(signer.keyType).toBe("EC");
      expect(signer.signatureAlgorithm).toBe("ECDSA");
    });

    it("loads ECDSA P-384 certificate", async () => {
      const signer = await loadTestSigner(P12_FILES.ecdsaP384);

      expect(signer.certificate).toBeInstanceOf(Uint8Array);
      expect(signer.certificate.length).toBeGreaterThan(0);
      expect(signer.keyType).toBe("EC");
      expect(signer.signatureAlgorithm).toBe("ECDSA");
    });

    it("signs with ECDSA P-256 key", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);
      const signer = await loadTestSigner(P12_FILES.ecdsaP256);

      const { bytes, warnings } = await pdf.sign({
        signer,
        reason: "ECDSA P-256 test",
      });

      expect(warnings).toHaveLength(0);
      expect(bytes.length).toBeGreaterThan(pdfBytes.length);

      const pdfStr = new TextDecoder().decode(bytes);
      expect(pdfStr).toContain("/Type /Sig");
      expect(pdfStr).toContain("/SubFilter /ETSI.CAdES.detached");

      await saveTestOutput("signatures/signed-ecdsa-p256.pdf", bytes);
    });

    it("signs with ECDSA P-384 key", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);
      const signer = await loadTestSigner(P12_FILES.ecdsaP384);

      const { bytes, warnings } = await pdf.sign({
        signer,
        reason: "ECDSA P-384 test",
      });

      expect(warnings).toHaveLength(0);
      expect(bytes.length).toBeGreaterThan(pdfBytes.length);

      const pdfStr = new TextDecoder().decode(bytes);
      expect(pdfStr).toContain("/Type /Sig");

      await saveTestOutput("signatures/signed-ecdsa-p384.pdf", bytes);
    });

    it("signs with ECDSA using PKCS7 format", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);
      const signer = await loadTestSigner(P12_FILES.ecdsaP256);

      const { bytes, warnings } = await pdf.sign({
        signer,
        subFilter: "adbe.pkcs7.detached",
      });

      expect(warnings).toHaveLength(0);

      const pdfStr = new TextDecoder().decode(bytes);
      expect(pdfStr).toContain("/SubFilter /adbe.pkcs7.detached");
    });

    it("handles buildChain with self-signed ECDSA cert", async () => {
      const p12Bytes = await loadFixture("certificates", P12_FILES.ecdsaP256);

      // Self-signed cert has no AIA URLs, so buildChain should gracefully handle this
      const signer = await P12Signer.create(p12Bytes, "test123", { buildChain: true });

      expect(signer.certificate).toBeInstanceOf(Uint8Array);
      expect(signer.certificateChain).toHaveLength(0); // Self-signed has no chain

      // Should still sign successfully
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);

      const { bytes, warnings } = await pdf.sign({
        signer,
        reason: "Self-signed ECDSA with buildChain",
      });

      expect(warnings).toHaveLength(0);
      expect(bytes.length).toBeGreaterThan(pdfBytes.length);

      await saveTestOutput("signatures/signed-ecdsa-p256-buildchain.pdf", bytes);
    });
  });

  describe("scenarios", () => {
    it("signs example-filled-in.pdf", async () => {
      const pdfBytes = await loadFixture("scenarios", "example-filled-in.pdf");
      const pdf = await PDF.load(pdfBytes);
      const signer = await loadTestSigner();

      // Flatten all interactive content to prevent hidden content attacks
      pdf.flattenAll();

      await pdf.reload(await pdf.save());

      const { bytes } = await pdf.sign({ signer });

      await saveTestOutput("signatures/scenarios/example-filled-in.pdf", bytes);
    });
  });

  describe("error handling", () => {
    it("throws on invalid P12 password", async () => {
      const p12Bytes = await loadFixture("certificates", "test-signer-aes256.p12");

      await expect(P12Signer.create(p12Bytes, "wrongpassword")).rejects.toThrow();
    });

    it("throws on PAdES level with PKCS7 format", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);
      const signer = await loadTestSigner();

      await expect(
        pdf.sign({
          signer,
          level: "B-B",
          subFilter: "adbe.pkcs7.detached",
        }),
      ).rejects.toThrow(/PAdES levels require/);
    });

    it("throws on B-T level without timestamp authority", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);
      const signer = await loadTestSigner();

      await expect(
        pdf.sign({
          signer,
          level: "B-T",
        }),
      ).rejects.toThrow(/timestampAuthority/);
    });
  });
});
