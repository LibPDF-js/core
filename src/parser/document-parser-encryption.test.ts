/**
 * Integration tests for encrypted PDF parsing.
 *
 * Tests the full flow from parsing encrypted PDFs to accessing decrypted content.
 * Uses fixtures from PDFBox with known passwords:
 * - PasswordSample-*.pdf: owner="owner", user="user"
 */

import { Scanner } from "#src/io/scanner";
import { loadFixture } from "#src/test-utils";
import { describe, expect, it } from "vitest";

import { DocumentParser } from "./document-parser";

describe("DocumentParser encryption", () => {
  describe("encryption detection", () => {
    it("detects 40-bit RC4 encryption", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-40bit.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      expect(doc.isEncrypted).toBe(true);
      expect(doc.encryption).not.toBeNull();
      expect(doc.encryption?.version).toBe(1);
      expect(doc.encryption?.revision).toBe(2);
      expect(doc.encryption?.algorithm).toBe("RC4");
      expect(doc.encryption?.keyLengthBits).toBe(40);
    });

    it("detects 128-bit RC4 encryption", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-128bit.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      expect(doc.isEncrypted).toBe(true);
      expect(doc.encryption).not.toBeNull();
      expect(doc.encryption?.version).toBe(2);
      expect(doc.encryption?.revision).toBe(3);
      expect(doc.encryption?.algorithm).toBe("RC4");
      expect(doc.encryption?.keyLengthBits).toBe(128);
    });

    it("detects 256-bit AES encryption", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-256bit.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      // Debug: check warnings if encryption fails
      if (doc.encryption === null && doc.isEncrypted) {
        console.log("Warnings:", doc.warnings);
      }

      expect(doc.isEncrypted).toBe(true);
      expect(doc.encryption).not.toBeNull();
      expect(doc.encryption?.revision).toBeGreaterThanOrEqual(5);
      expect(doc.encryption?.algorithm).toBe("AES-256");
      expect(doc.encryption?.keyLengthBits).toBe(256);
    });
  });

  describe("authentication", () => {
    it("authenticates with user password (40-bit)", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-40bit.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner, { credentials: "user" });

      const doc = await parser.parse();

      expect(doc.isEncrypted).toBe(true);
      expect(doc.isAuthenticated).toBe(true);
      expect(doc.permissions).not.toBeNull();
    });

    it("authenticates with owner password (40-bit)", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-40bit.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner, { credentials: "owner" });

      const doc = await parser.parse();

      expect(doc.isEncrypted).toBe(true);
      expect(doc.isAuthenticated).toBe(true);
    });

    it("authenticates with user password (128-bit)", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-128bit.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner, { credentials: "user" });

      const doc = await parser.parse();

      expect(doc.isEncrypted).toBe(true);
      expect(doc.isAuthenticated).toBe(true);
    });

    it("authenticates with user password (256-bit)", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-256bit.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner, { credentials: "user" });

      const doc = await parser.parse();

      expect(doc.isEncrypted).toBe(true);
      expect(doc.isAuthenticated).toBe(true);
    });

    it("fails with wrong password", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-40bit.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner, { credentials: "wrongpassword" });

      const doc = await parser.parse();

      expect(doc.isEncrypted).toBe(true);
      expect(doc.isAuthenticated).toBe(false);
    });

    it("supports re-authentication after initial failure", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-40bit.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner, { credentials: "wrong" });

      const doc = await parser.parse();
      expect(doc.isAuthenticated).toBe(false);

      // Re-authenticate with correct password
      const success = doc.authenticate("user");
      expect(success).toBe(true);
    });
  });

  describe("permissions", () => {
    it("parses permission flags (40-bit)", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-40bit.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner, { credentials: "user" });

      const doc = await parser.parse();

      expect(doc.permissions).not.toBeNull();
      // PasswordSample files have restricted permissions for user password
      expect(doc.permissions?.print).toBe(false);
      expect(doc.permissions?.modify).toBe(false);
      expect(doc.permissions?.copy).toBe(false);
    });
  });

  describe("decrypted content access", () => {
    it("can access catalog after authentication (40-bit)", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-40bit.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner, { credentials: "user" });

      const doc = await parser.parse();
      const catalog = await doc.getCatalog();

      expect(catalog).not.toBeNull();
      expect(catalog?.getName("Type")?.value).toBe("Catalog");
    });

    it("can access catalog after authentication (128-bit)", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-128bit.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner, { credentials: "user" });

      const doc = await parser.parse();
      const catalog = await doc.getCatalog();

      expect(catalog).not.toBeNull();
      expect(catalog?.getName("Type")?.value).toBe("Catalog");
    });

    it("can access catalog after authentication (256-bit)", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-256bit.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner, { credentials: "user" });

      const doc = await parser.parse();
      const catalog = await doc.getCatalog();

      expect(catalog).not.toBeNull();
      expect(catalog?.getName("Type")?.value).toBe("Catalog");
    });

    it("can count pages in encrypted document", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-40bit.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner, { credentials: "user" });

      const doc = await parser.parse();
      const pageCount = await doc.getPageCount();

      expect(pageCount).toBeGreaterThan(0);
    });
  });

  describe("unencrypted documents", () => {
    it("reports not encrypted for plain PDFs", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner);

      const doc = await parser.parse();

      expect(doc.isEncrypted).toBe(false);
      expect(doc.encryption).toBeNull();
      expect(doc.isAuthenticated).toBe(true); // Non-encrypted docs are "authenticated"
    });
  });

  describe("unsupported credential types", () => {
    it("throws UnsupportedEncryptionError for certificate credentials", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-40bit.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner, {
        credentials: {
          type: "certificate",
          certificate: new Uint8Array([1, 2, 3]),
          privateKey: new Uint8Array([4, 5, 6]),
        },
      });

      await expect(parser.parse()).rejects.toThrow(
        "The Standard security handler only supports password credentials",
      );
    });

    it("includes UNSUPPORTED_CREDENTIALS error code", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-40bit.pdf");
      const scanner = new Scanner(bytes);
      const parser = new DocumentParser(scanner, {
        credentials: {
          type: "certificate",
          certificate: new Uint8Array([1, 2, 3]),
          privateKey: new Uint8Array([4, 5, 6]),
        },
      });

      try {
        await parser.parse();
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as { code: string }).code).toBe("UNSUPPORTED_CREDENTIALS");
      }
    });
  });
});
