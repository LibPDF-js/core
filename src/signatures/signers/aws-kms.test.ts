/**
 * Tests for AwsKmsSigner.
 *
 * Unit tests: Pure logic (algorithm mapping, predicates).
 * Integration tests: Real AWS KMS (skipped without AWS credentials).
 */

import { describe, expect, it } from "vitest";

import { KmsSignerError } from "../types";
import { isRsaPss, mapKmsAlgorithm } from "./aws-kms";

// ─────────────────────────────────────────────────────────────────────────────
// Unit Tests: Algorithm Mapping
// ─────────────────────────────────────────────────────────────────────────────

describe("mapKmsAlgorithm", () => {
  describe("RSA PKCS#1 v1.5 algorithms", () => {
    it("maps RSASSA_PKCS1_V1_5_SHA_256", () => {
      expect(mapKmsAlgorithm("RSASSA_PKCS1_V1_5_SHA_256")).toEqual({
        keyType: "RSA",
        signatureAlgorithm: "RSASSA-PKCS1-v1_5",
        digestAlgorithm: "SHA-256",
      });
    });

    it("maps RSASSA_PKCS1_V1_5_SHA_384", () => {
      expect(mapKmsAlgorithm("RSASSA_PKCS1_V1_5_SHA_384")).toEqual({
        keyType: "RSA",
        signatureAlgorithm: "RSASSA-PKCS1-v1_5",
        digestAlgorithm: "SHA-384",
      });
    });

    it("maps RSASSA_PKCS1_V1_5_SHA_512", () => {
      expect(mapKmsAlgorithm("RSASSA_PKCS1_V1_5_SHA_512")).toEqual({
        keyType: "RSA",
        signatureAlgorithm: "RSASSA-PKCS1-v1_5",
        digestAlgorithm: "SHA-512",
      });
    });
  });

  describe("RSA-PSS algorithms", () => {
    it("maps RSASSA_PSS_SHA_256", () => {
      expect(mapKmsAlgorithm("RSASSA_PSS_SHA_256")).toEqual({
        keyType: "RSA",
        signatureAlgorithm: "RSA-PSS",
        digestAlgorithm: "SHA-256",
      });
    });

    it("maps RSASSA_PSS_SHA_384", () => {
      expect(mapKmsAlgorithm("RSASSA_PSS_SHA_384")).toEqual({
        keyType: "RSA",
        signatureAlgorithm: "RSA-PSS",
        digestAlgorithm: "SHA-384",
      });
    });

    it("maps RSASSA_PSS_SHA_512", () => {
      expect(mapKmsAlgorithm("RSASSA_PSS_SHA_512")).toEqual({
        keyType: "RSA",
        signatureAlgorithm: "RSA-PSS",
        digestAlgorithm: "SHA-512",
      });
    });
  });

  describe("ECDSA algorithms", () => {
    it("maps ECDSA_SHA_256", () => {
      expect(mapKmsAlgorithm("ECDSA_SHA_256")).toEqual({
        keyType: "EC",
        signatureAlgorithm: "ECDSA",
        digestAlgorithm: "SHA-256",
      });
    });

    it("maps ECDSA_SHA_384", () => {
      expect(mapKmsAlgorithm("ECDSA_SHA_384")).toEqual({
        keyType: "EC",
        signatureAlgorithm: "ECDSA",
        digestAlgorithm: "SHA-384",
      });
    });

    it("maps ECDSA_SHA_512", () => {
      expect(mapKmsAlgorithm("ECDSA_SHA_512")).toEqual({
        keyType: "EC",
        signatureAlgorithm: "ECDSA",
        digestAlgorithm: "SHA-512",
      });
    });
  });

  describe("error cases", () => {
    it("throws on unknown algorithm", () => {
      expect(() => mapKmsAlgorithm("UNKNOWN_ALGO")).toThrow(KmsSignerError);
      expect(() => mapKmsAlgorithm("UNKNOWN_ALGO")).toThrow(
        /Unsupported AWS KMS signing algorithm/,
      );
    });

    it("throws on empty string", () => {
      expect(() => mapKmsAlgorithm("")).toThrow(KmsSignerError);
    });

    it("throws on KMS encryption algorithm (not a signing algorithm)", () => {
      expect(() => mapKmsAlgorithm("RSAES_OAEP_SHA_256")).toThrow(KmsSignerError);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit Tests: RSA-PSS Detection
// ─────────────────────────────────────────────────────────────────────────────

describe("isRsaPss", () => {
  it("returns true for RSA-PSS algorithms", () => {
    expect(isRsaPss("RSASSA_PSS_SHA_256")).toBe(true);
    expect(isRsaPss("RSASSA_PSS_SHA_384")).toBe(true);
    expect(isRsaPss("RSASSA_PSS_SHA_512")).toBe(true);
  });

  it("returns false for PKCS#1 v1.5", () => {
    expect(isRsaPss("RSASSA_PKCS1_V1_5_SHA_256")).toBe(false);
    expect(isRsaPss("RSASSA_PKCS1_V1_5_SHA_384")).toBe(false);
    expect(isRsaPss("RSASSA_PKCS1_V1_5_SHA_512")).toBe(false);
  });

  it("returns false for ECDSA", () => {
    expect(isRsaPss("ECDSA_SHA_256")).toBe(false);
    expect(isRsaPss("ECDSA_SHA_384")).toBe(false);
    expect(isRsaPss("ECDSA_SHA_512")).toBe(false);
  });

  it("returns false for unknown algorithm", () => {
    expect(isRsaPss("UNKNOWN")).toBe(false);
    expect(isRsaPss("")).toBe(false);
  });
});
