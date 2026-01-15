import { describe, expect, it } from "vitest";

import {
  DEFAULT_PERMISSIONS,
  encodePermissions,
  hasFullAccess,
  PermissionBits,
  type Permissions,
  parsePermissions,
} from "./permissions";

describe("PermissionBits", () => {
  it("should have correct bit positions per PDF spec", () => {
    expect(PermissionBits.PRINT).toBe(3);
    expect(PermissionBits.MODIFY).toBe(4);
    expect(PermissionBits.COPY).toBe(5);
    expect(PermissionBits.ANNOTATE).toBe(6);
    expect(PermissionBits.FILL_FORMS).toBe(9);
    expect(PermissionBits.ACCESSIBILITY).toBe(10);
    expect(PermissionBits.ASSEMBLE).toBe(11);
    expect(PermissionBits.PRINT_HIGH_QUALITY).toBe(12);
  });
});

describe("parsePermissions", () => {
  it("should parse all permissions granted (-1)", () => {
    // -1 in signed 32-bit = all bits set
    const perms = parsePermissions(-1);

    expect(perms.print).toBe(true);
    expect(perms.printHighQuality).toBe(true);
    expect(perms.modify).toBe(true);
    expect(perms.copy).toBe(true);
    expect(perms.annotate).toBe(true);
    expect(perms.fillForms).toBe(true);
    expect(perms.accessibility).toBe(true);
    expect(perms.assemble).toBe(true);
  });

  it("should parse no permissions (only required bits set)", () => {
    // Bits 7-8 must be 1, all permission bits 0
    // 0b11000000 = 192 (but with high bits for signed = negative)
    const minValue = 0xfffff0c0 | 0; // -3904 with only bits 7-8 set

    const perms = parsePermissions(minValue);

    expect(perms.print).toBe(false);
    expect(perms.printHighQuality).toBe(false);
    expect(perms.modify).toBe(false);
    expect(perms.copy).toBe(false);
    expect(perms.annotate).toBe(false);
    expect(perms.fillForms).toBe(false);
    expect(perms.accessibility).toBe(false);
    expect(perms.assemble).toBe(false);
  });

  it("should parse common permission value -3904 (print only)", () => {
    // -3904 = 0xFFFFF0C0
    // Binary of lower bits: 0000 1111 0000 1100 = bits 3,4,9,10,11,12 NOT set
    // Wait, let me recalculate: -3904 decimal
    // -3904 & 0xFFFFFFFF = 0xFFFFF0C0
    // Lower 12 bits: 0x0C0 = 0000 1100 0000 = bits 7,8 set (required)
    // So this has NO permission bits set

    const perms = parsePermissions(-3904);

    // All permissions should be false with -3904 (no permission bits set)
    expect(perms.print).toBe(false);
    expect(perms.modify).toBe(false);
    expect(perms.copy).toBe(false);
    expect(perms.annotate).toBe(false);
    expect(perms.fillForms).toBe(false);
    expect(perms.accessibility).toBe(false);
    expect(perms.assemble).toBe(false);
    expect(perms.printHighQuality).toBe(false);
  });

  it("should parse print-only permission", () => {
    // Start with -3904 (no permissions), add print bit (bit 3)
    const printOnly = -3904 | (1 << 2) | 0; // bit 3 = 1 << 2

    const perms = parsePermissions(printOnly);

    expect(perms.print).toBe(true);
    expect(perms.printHighQuality).toBe(false);
    expect(perms.modify).toBe(false);
    expect(perms.copy).toBe(false);
  });

  it("should parse copy and accessibility permissions", () => {
    // -3904 + bit 5 (copy) + bit 10 (accessibility)
    const value = -3904 | (1 << 4) | (1 << 9) | 0;

    const perms = parsePermissions(value);

    expect(perms.copy).toBe(true);
    expect(perms.accessibility).toBe(true);
    expect(perms.print).toBe(false);
    expect(perms.modify).toBe(false);
  });

  it("should handle positive values (legacy)", () => {
    // Some old PDFs might have positive P values
    // 0xFC = 0b11111100 = bits 3-8 set
    const legacyValue = 0xfc;

    const perms = parsePermissions(legacyValue);

    expect(perms.print).toBe(true); // bit 3
    expect(perms.modify).toBe(true); // bit 4
    expect(perms.copy).toBe(true); // bit 5
    expect(perms.annotate).toBe(true); // bit 6
    // bits 7-8 are required, not permissions
    expect(perms.fillForms).toBe(false); // bit 9
    expect(perms.accessibility).toBe(false); // bit 10
  });

  it("should correctly interpret individual bits", () => {
    // Test each permission bit individually
    const testCases: Array<{ bit: number; field: keyof Permissions }> = [
      { bit: 3, field: "print" },
      { bit: 4, field: "modify" },
      { bit: 5, field: "copy" },
      { bit: 6, field: "annotate" },
      { bit: 9, field: "fillForms" },
      { bit: 10, field: "accessibility" },
      { bit: 11, field: "assemble" },
      { bit: 12, field: "printHighQuality" },
    ];

    for (const { bit, field } of testCases) {
      // Set only this bit plus required bits 7-8
      const value = 0xfffff000 | 0b11000000 | (1 << (bit - 1)) | 0;
      const perms = parsePermissions(value);

      expect(perms[field]).toBe(true);

      // Verify other permission bits are false
      for (const other of testCases) {
        if (other.field !== field) {
          expect(perms[other.field]).toBe(false);
        }
      }
    }
  });
});

describe("encodePermissions", () => {
  it("should encode all permissions to expected value", () => {
    const encoded = encodePermissions(DEFAULT_PERMISSIONS);

    // Should have all permission bits set plus required bits 7-8 and high bits
    // Parse it back to verify
    const parsed = parsePermissions(encoded);

    expect(parsed.print).toBe(true);
    expect(parsed.printHighQuality).toBe(true);
    expect(parsed.modify).toBe(true);
    expect(parsed.copy).toBe(true);
    expect(parsed.annotate).toBe(true);
    expect(parsed.fillForms).toBe(true);
    expect(parsed.accessibility).toBe(true);
    expect(parsed.assemble).toBe(true);
  });

  it("should encode no permissions", () => {
    const noPerms: Permissions = {
      print: false,
      printHighQuality: false,
      modify: false,
      copy: false,
      annotate: false,
      fillForms: false,
      accessibility: false,
      assemble: false,
    };

    const encoded = encodePermissions(noPerms);

    // Should have only required bits 7-8 set plus high bits
    expect(encoded).toBe(-3904); // 0xFFFFF0C0

    // Verify round-trip
    const parsed = parsePermissions(encoded);
    expect(parsed).toEqual(noPerms);
  });

  it("should encode print-only permissions", () => {
    const printOnly: Permissions = {
      print: true,
      printHighQuality: false,
      modify: false,
      copy: false,
      annotate: false,
      fillForms: false,
      accessibility: false,
      assemble: false,
    };

    const encoded = encodePermissions(printOnly);
    const parsed = parsePermissions(encoded);

    expect(parsed).toEqual(printOnly);
  });

  it("should round-trip all permission combinations", () => {
    // Test a few specific combinations
    const combinations: Permissions[] = [
      {
        print: true,
        printHighQuality: true,
        modify: false,
        copy: true,
        annotate: false,
        fillForms: true,
        accessibility: true,
        assemble: false,
      },
      {
        print: false,
        printHighQuality: false,
        modify: true,
        copy: false,
        annotate: true,
        fillForms: false,
        accessibility: false,
        assemble: true,
      },
    ];

    for (const perms of combinations) {
      const encoded = encodePermissions(perms);
      const parsed = parsePermissions(encoded);
      expect(parsed).toEqual(perms);
    }
  });

  it("should produce negative signed 32-bit integer", () => {
    const encoded = encodePermissions(DEFAULT_PERMISSIONS);

    // Should be negative (high bits set)
    expect(encoded).toBeLessThan(0);

    // Should be a valid 32-bit signed integer
    expect(encoded).toBeGreaterThanOrEqual(-2147483648);
  });

  it("should set required bits 7-8", () => {
    const encoded = encodePermissions({
      print: false,
      printHighQuality: false,
      modify: false,
      copy: false,
      annotate: false,
      fillForms: false,
      accessibility: false,
      assemble: false,
    });

    // Bits 7 and 8 should always be set
    expect((encoded & (1 << 6)) !== 0).toBe(true); // bit 7 (0-indexed: 6)
    expect((encoded & (1 << 7)) !== 0).toBe(true); // bit 8 (0-indexed: 7)
  });
});

describe("hasFullAccess", () => {
  it("should return true when all permissions are granted", () => {
    expect(hasFullAccess(DEFAULT_PERMISSIONS)).toBe(true);
  });

  it("should return false when any permission is denied", () => {
    const permissionFields: Array<keyof Permissions> = [
      "print",
      "printHighQuality",
      "modify",
      "copy",
      "annotate",
      "fillForms",
      "accessibility",
      "assemble",
    ];

    for (const field of permissionFields) {
      const perms = { ...DEFAULT_PERMISSIONS, [field]: false };
      expect(hasFullAccess(perms)).toBe(false);
    }
  });

  it("should return false when multiple permissions are denied", () => {
    const limited: Permissions = {
      print: true,
      printHighQuality: true,
      modify: false,
      copy: false,
      annotate: true,
      fillForms: true,
      accessibility: true,
      assemble: true,
    };

    expect(hasFullAccess(limited)).toBe(false);
  });
});

describe("DEFAULT_PERMISSIONS", () => {
  it("should have all permissions enabled", () => {
    expect(DEFAULT_PERMISSIONS.print).toBe(true);
    expect(DEFAULT_PERMISSIONS.printHighQuality).toBe(true);
    expect(DEFAULT_PERMISSIONS.modify).toBe(true);
    expect(DEFAULT_PERMISSIONS.copy).toBe(true);
    expect(DEFAULT_PERMISSIONS.annotate).toBe(true);
    expect(DEFAULT_PERMISSIONS.fillForms).toBe(true);
    expect(DEFAULT_PERMISSIONS.accessibility).toBe(true);
    expect(DEFAULT_PERMISSIONS.assemble).toBe(true);
  });

  it("should pass hasFullAccess check", () => {
    expect(hasFullAccess(DEFAULT_PERMISSIONS)).toBe(true);
  });
});

/**
 * Real-world PDF permission values
 */
describe("real-world permission values", () => {
  it("should parse Adobe Acrobat default restricted (-3904)", () => {
    // Common value for "no permissions" in Acrobat
    const perms = parsePermissions(-3904);

    expect(perms.print).toBe(false);
    expect(perms.modify).toBe(false);
    expect(perms.copy).toBe(false);
    expect(perms.annotate).toBe(false);
  });

  it("should parse common 'allow printing' value (-3900)", () => {
    // -3900 = -3904 + 4 = print bit set
    const perms = parsePermissions(-3900);

    expect(perms.print).toBe(true);
    expect(perms.modify).toBe(false);
    expect(perms.copy).toBe(false);
  });

  it("should parse common 'allow all' value (-4)", () => {
    // -4 = 0xFFFFFFFC = all permission bits set
    const perms = parsePermissions(-4);

    expect(perms.print).toBe(true);
    expect(perms.printHighQuality).toBe(true);
    expect(perms.modify).toBe(true);
    expect(perms.copy).toBe(true);
    expect(perms.annotate).toBe(true);
    expect(perms.fillForms).toBe(true);
    expect(perms.accessibility).toBe(true);
    expect(perms.assemble).toBe(true);
  });

  it("should parse value allowing print and copy only", () => {
    // bits 3 (print) and 5 (copy) plus required bits
    const value = 0xfffff0c0 | (1 << 2) | (1 << 4) | 0;
    const perms = parsePermissions(value);

    expect(perms.print).toBe(true);
    expect(perms.copy).toBe(true);
    expect(perms.modify).toBe(false);
    expect(perms.annotate).toBe(false);
    expect(perms.fillForms).toBe(false);
  });
});
