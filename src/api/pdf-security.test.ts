/**
 * Tests for PDF security API.
 *
 * Tests the high-level security methods on the PDF class:
 * - getSecurity()
 * - getPermissions()
 * - hasOwnerAccess()
 * - authenticate()
 * - removeProtection()
 * - setProtection()
 *
 * Uses fixtures from fixtures/encryption/ with known passwords:
 * - PasswordSample-*.pdf: owner="owner", user="user"
 */

import { PermissionDeniedError } from "#src/security/errors";
import { loadFixture } from "#src/test-utils";
import { describe, expect, it } from "vitest";

import { PDF } from "./pdf";

describe("PDF security API", () => {
  describe("unencrypted documents", () => {
    it("getSecurity() returns isEncrypted: false", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      const security = pdf.getSecurity();

      expect(security.isEncrypted).toBe(false);
      expect(security.algorithm).toBeUndefined();
      expect(security.keyLength).toBeUndefined();
      expect(security.revision).toBeUndefined();
    });

    it("getPermissions() returns all permissions as true", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      const perms = pdf.getPermissions();

      expect(perms.print).toBe(true);
      expect(perms.modify).toBe(true);
      expect(perms.copy).toBe(true);
      expect(perms.annotate).toBe(true);
      expect(perms.fillForms).toBe(true);
      expect(perms.accessibility).toBe(true);
      expect(perms.assemble).toBe(true);
      expect(perms.printHighQuality).toBe(true);
    });

    it("hasOwnerAccess() returns true for unencrypted docs", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      expect(pdf.hasOwnerAccess()).toBe(true);
    });

    it("authenticate() returns success for unencrypted docs", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      const result = pdf.authenticate("anypassword");

      expect(result.authenticated).toBe(true);
      expect(result.isOwner).toBe(true);
    });

    it("removeProtection() is a no-op for unencrypted docs", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      // Should not throw
      pdf.removeProtection();
    });
  });

  describe("encrypted documents - user password", () => {
    it("getSecurity() returns encryption details", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-40bit.pdf");
      const pdf = await PDF.load(bytes, { credentials: "user" });

      const security = pdf.getSecurity();

      expect(security.isEncrypted).toBe(true);
      expect(security.algorithm).toBe("RC4-40");
      expect(security.keyLength).toBe(40);
      expect(security.revision).toBe(2);
      expect(security.authenticatedAs).toBe("user");
    });

    it("getPermissions() returns restricted permissions", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-40bit.pdf");
      const pdf = await PDF.load(bytes, { credentials: "user" });

      const perms = pdf.getPermissions();

      // PasswordSample files have restricted permissions for user
      expect(perms.print).toBe(false);
      expect(perms.modify).toBe(false);
      expect(perms.copy).toBe(false);
    });

    it("hasOwnerAccess() returns false for user password", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-40bit.pdf");
      const pdf = await PDF.load(bytes, { credentials: "user" });

      expect(pdf.hasOwnerAccess()).toBe(false);
    });

    it("removeProtection() throws PermissionDeniedError without modify permission", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-40bit.pdf");
      const pdf = await PDF.load(bytes, { credentials: "user" });

      // User doesn't have modify permission
      expect(() => pdf.removeProtection()).toThrow(PermissionDeniedError);
    });
  });

  describe("encrypted documents - owner password", () => {
    it("getSecurity() reports owner authentication", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-40bit.pdf");
      const pdf = await PDF.load(bytes, { credentials: "owner" });

      const security = pdf.getSecurity();

      expect(security.isEncrypted).toBe(true);
      expect(security.authenticatedAs).toBe("owner");
    });

    it("getPermissions() returns all permissions for owner", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-40bit.pdf");
      const pdf = await PDF.load(bytes, { credentials: "owner" });

      const perms = pdf.getPermissions();

      // Owner has full access
      expect(perms.print).toBe(true);
      expect(perms.modify).toBe(true);
      expect(perms.copy).toBe(true);
      expect(perms.annotate).toBe(true);
      expect(perms.fillForms).toBe(true);
      expect(perms.accessibility).toBe(true);
      expect(perms.assemble).toBe(true);
      expect(perms.printHighQuality).toBe(true);
    });

    it("hasOwnerAccess() returns true for owner password", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-40bit.pdf");
      const pdf = await PDF.load(bytes, { credentials: "owner" });

      expect(pdf.hasOwnerAccess()).toBe(true);
    });

    it("removeProtection() succeeds with owner access", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-40bit.pdf");
      const pdf = await PDF.load(bytes, { credentials: "owner" });

      // Should not throw
      pdf.removeProtection();
    });
  });

  describe("authenticate() re-authentication", () => {
    it("upgrades from user to owner access", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-40bit.pdf");
      const pdf = await PDF.load(bytes, { credentials: "user" });

      expect(pdf.hasOwnerAccess()).toBe(false);

      const result = pdf.authenticate("owner");

      expect(result.authenticated).toBe(true);
      expect(result.isOwner).toBe(true);
      expect(result.passwordType).toBe("owner");
    });

    it("fails with wrong password", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-40bit.pdf");
      const pdf = await PDF.load(bytes, { credentials: "user" });

      const result = pdf.authenticate("wrongpassword");

      expect(result.authenticated).toBe(false);
      expect(result.isOwner).toBe(false);
    });
  });

  describe("algorithm detection", () => {
    it("detects RC4-40", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-40bit.pdf");
      const pdf = await PDF.load(bytes, { credentials: "user" });

      const security = pdf.getSecurity();

      expect(security.algorithm).toBe("RC4-40");
      expect(security.keyLength).toBe(40);
    });

    it("detects RC4-128", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-128bit.pdf");
      const pdf = await PDF.load(bytes, { credentials: "user" });

      const security = pdf.getSecurity();

      expect(security.algorithm).toBe("RC4-128");
      expect(security.keyLength).toBe(128);
    });

    it("detects AES-256", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-256bit.pdf");
      const pdf = await PDF.load(bytes, { credentials: "user" });

      const security = pdf.getSecurity();

      expect(security.algorithm).toBe("AES-256");
      expect(security.keyLength).toBe(256);
    });

    it("detects AES-128", async () => {
      // issue17069.pdf uses AES-128 with password-based encryption (empty user password)
      const bytes = await loadFixture("encryption", "issue17069.pdf");
      const pdf = await PDF.load(bytes);

      const security = pdf.getSecurity();

      expect(security.algorithm).toBe("AES-128");
      expect(security.keyLength).toBe(128);
    });
  });

  describe("canSaveIncrementally() with security changes", () => {
    it("blocks incremental save after removeProtection()", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-40bit.pdf");
      const pdf = await PDF.load(bytes, { credentials: "owner" });

      pdf.removeProtection();

      const blocker = pdf.canSaveIncrementally();

      expect(blocker).toBe("encryption-removed");
    });

    it("blocks incremental save after setProtection() on unencrypted doc", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      pdf.setProtection({ userPassword: "test" });

      const blocker = pdf.canSaveIncrementally();

      expect(blocker).toBe("encryption-added");
    });

    it("blocks incremental save after setProtection() on encrypted doc", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-40bit.pdf");
      const pdf = await PDF.load(bytes, { credentials: "owner" });

      pdf.setProtection({ userPassword: "newpassword" });

      const blocker = pdf.canSaveIncrementally();

      expect(blocker).toBe("encryption-changed");
    });
  });

  describe("setProtection()", () => {
    it("throws PermissionDeniedError when encrypted without owner access", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-40bit.pdf");
      const pdf = await PDF.load(bytes, { credentials: "user" });

      expect(() => pdf.setProtection({ userPassword: "test" })).toThrow(PermissionDeniedError);
    });

    it("succeeds on unencrypted document", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      // Should not throw
      pdf.setProtection({
        userPassword: "test",
        ownerPassword: "admin",
        permissions: { copy: false },
      });
    });

    it("succeeds on encrypted document with owner access", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-40bit.pdf");
      const pdf = await PDF.load(bytes, { credentials: "owner" });

      // Should not throw
      pdf.setProtection({
        userPassword: "newuser",
        ownerPassword: "newowner",
      });
    });
  });

  describe("removeProtection() round-trip", () => {
    it("saves an encrypted PDF without encryption after removeProtection()", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-40bit.pdf");
      const pdf = await PDF.load(bytes, { credentials: "owner" });

      // Remove protection
      pdf.removeProtection();

      // Save and reload
      const savedBytes = await pdf.save();
      const reloaded = await PDF.load(savedBytes);

      // Should be unencrypted now
      expect(reloaded.isEncrypted).toBe(false);
      expect(reloaded.getSecurity().isEncrypted).toBe(false);

      // Content should still be accessible
      const pageCount = reloaded.getPageCount();
      expect(pageCount).toBeGreaterThan(0);
    });

    it("preserves document content when removing encryption", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-128bit.pdf");
      const pdf = await PDF.load(bytes, { credentials: "owner" });

      // Get page count before
      const pageCountBefore = pdf.getPageCount();

      // Remove protection and save
      pdf.removeProtection();
      const savedBytes = await pdf.save();
      const reloaded = await PDF.load(savedBytes);

      // Page count should be preserved
      expect(reloaded.getPageCount()).toBe(pageCountBefore);
    });

    it("removes encryption from AES-256 encrypted document", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-256bit.pdf");
      const pdf = await PDF.load(bytes, { credentials: "owner" });

      pdf.removeProtection();
      const savedBytes = await pdf.save();
      const reloaded = await PDF.load(savedBytes);

      expect(reloaded.isEncrypted).toBe(false);
    });
  });

  describe("setProtection() round-trip", () => {
    it("encrypts an unencrypted PDF with AES-256", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      pdf.setProtection({
        userPassword: "secret",
        ownerPassword: "admin",
      });

      const savedBytes = await pdf.save();

      // Without password, document loads but is not authenticated
      const unauthenticated = await PDF.load(savedBytes);
      expect(unauthenticated.isEncrypted).toBe(true);
      expect(unauthenticated.isAuthenticated).toBe(false);

      // Should open with correct password
      const reloaded = await PDF.load(savedBytes, { credentials: "secret" });
      expect(reloaded.isEncrypted).toBe(true);
      expect(reloaded.getSecurity().algorithm).toBe("AES-256");
    });

    it("applies permission restrictions", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      pdf.setProtection({
        userPassword: "user",
        ownerPassword: "owner",
        permissions: {
          print: true,
          copy: false,
          modify: false,
        },
      });

      const savedBytes = await pdf.save();
      const reloaded = await PDF.load(savedBytes, { credentials: "user" });

      const perms = reloaded.getPermissions();
      expect(perms.print).toBe(true);
      expect(perms.copy).toBe(false);
      expect(perms.modify).toBe(false);
    });

    it("allows empty user password (opens without password)", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      pdf.setProtection({
        ownerPassword: "owner",
        permissions: { copy: false },
      });

      const savedBytes = await pdf.save();

      // Should open without password
      const reloaded = await PDF.load(savedBytes);
      expect(reloaded.isEncrypted).toBe(true);
      expect(reloaded.getPermissions().copy).toBe(false);
    });

    it("owner password grants full permissions", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      pdf.setProtection({
        userPassword: "user",
        ownerPassword: "owner",
        permissions: { copy: false, modify: false },
      });

      const savedBytes = await pdf.save();
      const reloaded = await PDF.load(savedBytes, { credentials: "owner" });

      // Owner should have full access
      const perms = reloaded.getPermissions();
      expect(perms.copy).toBe(true);
      expect(perms.modify).toBe(true);
      expect(reloaded.hasOwnerAccess()).toBe(true);
    });
  });

  describe("re-saving encrypted PDFs", () => {
    it("preserves encryption when saving without security changes", async () => {
      // Load an encrypted PDF
      const bytes = await loadFixture("encryption", "PasswordSample-256bit.pdf");
      const pdf = await PDF.load(bytes, { credentials: "owner" });

      expect(pdf.isEncrypted).toBe(true);
      expect(pdf.isAuthenticated).toBe(true);

      // Make a modification (add metadata)
      pdf.setTitle("Modified Document");

      // Save without calling removeProtection() or setProtection()
      const savedBytes = await pdf.save();

      // The saved document should still be encrypted
      const reloaded = await PDF.load(savedBytes, { credentials: "owner" });
      expect(reloaded.isEncrypted).toBe(true);
      expect(reloaded.getSecurity().algorithm).toBe("AES-256");

      // And the modification should be there
      expect(reloaded.getTitle()).toBe("Modified Document");
    });

    it("requires password to open re-saved encrypted PDF", async () => {
      const bytes = await loadFixture("encryption", "PasswordSample-256bit.pdf");
      const pdf = await PDF.load(bytes, { credentials: "owner" });

      // Modify and save
      pdf.setTitle("Modified");
      const savedBytes = await pdf.save();

      // Without password, should load but not authenticate
      const unauthenticated = await PDF.load(savedBytes);
      expect(unauthenticated.isEncrypted).toBe(true);
      expect(unauthenticated.isAuthenticated).toBe(false);
    });
  });
});
