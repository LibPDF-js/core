/**
 * Tests for signing utilities.
 *
 * Note: Full signing integration tests are in signing.integration.test.ts.
 * This file tests utility functions and error types.
 */

import { describe, expect, it } from "vitest";

import { generateUniqueName } from "../helpers/strings";
import { SignatureError } from "./types";

describe("sign", () => {
  describe("generateUniqueName", () => {
    it("generates Signature_1 for empty set", () => {
      const existing = new Set<string>();
      expect(generateUniqueName(existing, "Signature_")).toBe("Signature_1");
    });

    it("generates next available number", () => {
      const existing = new Set(["Signature_1", "Signature_2"]);
      expect(generateUniqueName(existing, "Signature_")).toBe("Signature_3");
    });

    it("finds gaps in numbering", () => {
      const existing = new Set(["Signature_1", "Signature_3"]);
      expect(generateUniqueName(existing, "Signature_")).toBe("Signature_2");
    });

    it("ignores non-signature field names", () => {
      const existing = new Set(["Name", "Email", "Phone"]);
      expect(generateUniqueName(existing, "Signature_")).toBe("Signature_1");
    });

    it("works with different prefixes", () => {
      const existing = new Set(["DocTimeStamp_1", "DocTimeStamp_2"]);
      expect(generateUniqueName(existing, "DocTimeStamp_")).toBe("DocTimeStamp_3");
    });
  });

  describe("SignatureError", () => {
    it("has correct structure", () => {
      const error = new SignatureError("TEST_CODE", "Test message");
      expect(error.name).toBe("SignatureError");
      expect(error.code).toBe("TEST_CODE");
      expect(error.message).toBe("Test message");
      expect(error).toBeInstanceOf(Error);
    });
  });
});
