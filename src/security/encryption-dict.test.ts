import { describe, expect, it } from "vitest";

import { PdfBool } from "../objects/pdf-bool";
import { PdfDict } from "../objects/pdf-dict";
import { PdfName } from "../objects/pdf-name";
import { PdfNumber } from "../objects/pdf-number";
import { PdfString } from "../objects/pdf-string";
import {
  EncryptionDictError,
  getKeyLengthBytes,
  isEncryptedTrailer,
  parseEncryptionDict,
} from "./encryption-dict";

/**
 * Create a minimal valid encryption dictionary for R2 (40-bit RC4).
 */
function createR2Dict(overrides: Record<string, unknown> = {}): PdfDict {
  const defaults: Record<string, unknown> = {
    Filter: PdfName.of("Standard"),
    V: PdfNumber.of(1),
    R: PdfNumber.of(2),
    O: PdfString.fromHex("00".repeat(32)),
    U: PdfString.fromHex("00".repeat(32)),
    P: PdfNumber.of(-3904),
  };

  return PdfDict.of({ ...defaults, ...overrides } as Record<string, never>);
}

/**
 * Create a minimal valid encryption dictionary for R4 (AES-128).
 */
function createR4Dict(overrides: Record<string, unknown> = {}): PdfDict {
  const defaults: Record<string, unknown> = {
    Filter: PdfName.of("Standard"),
    V: PdfNumber.of(4),
    R: PdfNumber.of(4),
    Length: PdfNumber.of(128),
    O: PdfString.fromHex("00".repeat(32)),
    U: PdfString.fromHex("00".repeat(32)),
    P: PdfNumber.of(-3904),
  };

  return PdfDict.of({ ...defaults, ...overrides } as Record<string, never>);
}

/**
 * Create a minimal valid encryption dictionary for R6 (AES-256).
 */
function createR6Dict(overrides: Record<string, unknown> = {}): PdfDict {
  const defaults: Record<string, unknown> = {
    Filter: PdfName.of("Standard"),
    V: PdfNumber.of(5),
    R: PdfNumber.of(6),
    O: PdfString.fromHex("00".repeat(48)), // 48 bytes for R5+
    U: PdfString.fromHex("00".repeat(48)),
    OE: PdfString.fromHex("00".repeat(32)),
    UE: PdfString.fromHex("00".repeat(32)),
    Perms: PdfString.fromHex("00".repeat(16)),
    P: PdfNumber.of(-3904),
  };

  return PdfDict.of({ ...defaults, ...overrides } as Record<string, never>);
}

describe("isEncryptedTrailer", () => {
  it("should return true when Encrypt key exists", () => {
    const trailer = PdfDict.of({
      Encrypt: PdfDict.of({}),
    });

    expect(isEncryptedTrailer(trailer)).toBe(true);
  });

  it("should return false when Encrypt key is missing", () => {
    const trailer = PdfDict.of({
      Root: PdfNumber.of(1),
    });

    expect(isEncryptedTrailer(trailer)).toBe(false);
  });
});

describe("parseEncryptionDict", () => {
  describe("R2 (40-bit RC4)", () => {
    it("should parse minimal R2 dictionary", () => {
      const dict = createR2Dict();
      const result = parseEncryptionDict(dict);

      expect(result.filter).toBe("Standard");
      expect(result.version).toBe(1);
      expect(result.revision).toBe(2);
      expect(result.keyLengthBits).toBe(40);
      expect(result.algorithm).toBe("RC4");
      expect(result.ownerHash.length).toBe(32);
      expect(result.userHash.length).toBe(32);
    });

    it("should parse permissions correctly", () => {
      const dict = createR2Dict({ P: PdfNumber.of(-4) });
      const result = parseEncryptionDict(dict);

      expect(result.permissionsRaw).toBe(-4);
      expect(result.permissions.print).toBe(true);
      expect(result.permissions.modify).toBe(true);
      expect(result.permissions.copy).toBe(true);
    });
  });

  describe("R3 (128-bit RC4)", () => {
    it("should parse R3 dictionary with 128-bit key", () => {
      const dict = createR2Dict({
        V: PdfNumber.of(2),
        R: PdfNumber.of(3),
        Length: PdfNumber.of(128),
      });

      const result = parseEncryptionDict(dict);

      expect(result.version).toBe(2);
      expect(result.revision).toBe(3);
      expect(result.keyLengthBits).toBe(128);
      expect(result.algorithm).toBe("RC4");
    });

    it("should default to 40-bit key if Length is missing", () => {
      const dict = createR2Dict({
        V: PdfNumber.of(2),
        R: PdfNumber.of(3),
      });

      const result = parseEncryptionDict(dict);

      expect(result.keyLengthBits).toBe(40);
    });
  });

  describe("R4 (AES-128)", () => {
    it("should parse R4 dictionary", () => {
      const dict = createR4Dict();
      const result = parseEncryptionDict(dict);

      expect(result.version).toBe(4);
      expect(result.revision).toBe(4);
      expect(result.keyLengthBits).toBe(128);
      expect(result.algorithm).toBe("AES-128");
    });

    it("should parse EncryptMetadata as true by default", () => {
      const dict = createR4Dict();
      const result = parseEncryptionDict(dict);

      expect(result.encryptMetadata).toBe(true);
    });

    it("should parse EncryptMetadata=false", () => {
      const dict = createR4Dict({ EncryptMetadata: PdfBool.FALSE });
      const result = parseEncryptionDict(dict);

      expect(result.encryptMetadata).toBe(false);
    });

    it("should parse crypt filters", () => {
      const stdCF = PdfDict.of({
        CFM: PdfName.of("AESV2"),
        Length: PdfNumber.of(16),
      });

      const cfDict = PdfDict.of({
        StdCF: stdCF,
      });

      const dict = createR4Dict({
        CF: cfDict,
        StmF: PdfName.of("StdCF"),
        StrF: PdfName.of("StdCF"),
      });

      const result = parseEncryptionDict(dict);

      expect(result.streamFilter).toBe("StdCF");
      expect(result.stringFilter).toBe("StdCF");
      expect(result.cryptFilters?.get("StdCF")).toBeDefined();
      expect(result.cryptFilters?.get("StdCF")?.cfm).toBe("AESV2");
    });

    it("should use Identity as default filter names", () => {
      const dict = createR4Dict();
      const result = parseEncryptionDict(dict);

      expect(result.streamFilter).toBe("Identity");
      expect(result.stringFilter).toBe("Identity");
    });
  });

  describe("R5 (AES-256 draft)", () => {
    it("should parse R5 dictionary", () => {
      const dict = createR6Dict({
        R: PdfNumber.of(5),
      });

      const result = parseEncryptionDict(dict);

      expect(result.version).toBe(5);
      expect(result.revision).toBe(5);
      expect(result.keyLengthBits).toBe(256);
      expect(result.algorithm).toBe("AES-256");
    });

    it("should have R5-specific fields", () => {
      const dict = createR6Dict({
        R: PdfNumber.of(5),
      });

      const result = parseEncryptionDict(dict);

      expect(result.ownerEncryptionKey).toBeDefined();
      expect(result.ownerEncryptionKey?.length).toBe(32);
      expect(result.userEncryptionKey).toBeDefined();
      expect(result.userEncryptionKey?.length).toBe(32);
      expect(result.permsValue).toBeDefined();
      expect(result.permsValue?.length).toBe(16);
    });
  });

  describe("R6 (AES-256)", () => {
    it("should parse R6 dictionary", () => {
      const dict = createR6Dict();
      const result = parseEncryptionDict(dict);

      expect(result.version).toBe(5);
      expect(result.revision).toBe(6);
      expect(result.keyLengthBits).toBe(256);
      expect(result.algorithm).toBe("AES-256");
    });

    it("should require 48-byte O and U", () => {
      const dict = createR6Dict();
      const result = parseEncryptionDict(dict);

      expect(result.ownerHash.length).toBe(48);
      expect(result.userHash.length).toBe(48);
    });
  });

  describe("error handling", () => {
    it("should throw for missing Filter", () => {
      const dict = PdfDict.of({
        V: PdfNumber.of(1),
        R: PdfNumber.of(2),
      });

      expect(() => parseEncryptionDict(dict)).toThrow(EncryptionDictError);
      expect(() => parseEncryptionDict(dict)).toThrow("Missing /Filter");
    });

    it("should throw for non-Standard filter", () => {
      const dict = PdfDict.of({
        Filter: PdfName.of("Adobe.PubSec"),
        V: PdfNumber.of(1),
      });

      expect(() => parseEncryptionDict(dict)).toThrow(EncryptionDictError);
      expect(() => parseEncryptionDict(dict)).toThrow("Unsupported security handler");
    });

    it("should throw for missing V", () => {
      const dict = PdfDict.of({
        Filter: PdfName.of("Standard"),
        R: PdfNumber.of(2),
      });

      expect(() => parseEncryptionDict(dict)).toThrow(EncryptionDictError);
      expect(() => parseEncryptionDict(dict)).toThrow("Missing /V");
    });

    it("should throw for unsupported V", () => {
      const dict = PdfDict.of({
        Filter: PdfName.of("Standard"),
        V: PdfNumber.of(0),
        R: PdfNumber.of(2),
      });

      expect(() => parseEncryptionDict(dict)).toThrow(EncryptionDictError);
      expect(() => parseEncryptionDict(dict)).toThrow("Unsupported encryption version");
    });

    it("should throw for missing R", () => {
      const dict = PdfDict.of({
        Filter: PdfName.of("Standard"),
        V: PdfNumber.of(1),
      });

      expect(() => parseEncryptionDict(dict)).toThrow(EncryptionDictError);
      expect(() => parseEncryptionDict(dict)).toThrow("Missing /R");
    });

    it("should throw for missing O", () => {
      const dict = PdfDict.of({
        Filter: PdfName.of("Standard"),
        V: PdfNumber.of(1),
        R: PdfNumber.of(2),
        U: PdfString.fromHex("00".repeat(32)),
        P: PdfNumber.of(-3904),
      });

      expect(() => parseEncryptionDict(dict)).toThrow(EncryptionDictError);
      expect(() => parseEncryptionDict(dict)).toThrow("Missing /O");
    });

    it("should throw for missing U", () => {
      const dict = PdfDict.of({
        Filter: PdfName.of("Standard"),
        V: PdfNumber.of(1),
        R: PdfNumber.of(2),
        O: PdfString.fromHex("00".repeat(32)),
        P: PdfNumber.of(-3904),
      });

      expect(() => parseEncryptionDict(dict)).toThrow(EncryptionDictError);
      expect(() => parseEncryptionDict(dict)).toThrow("Missing /U");
    });

    it("should throw for missing P", () => {
      const dict = PdfDict.of({
        Filter: PdfName.of("Standard"),
        V: PdfNumber.of(1),
        R: PdfNumber.of(2),
        O: PdfString.fromHex("00".repeat(32)),
        U: PdfString.fromHex("00".repeat(32)),
      });

      expect(() => parseEncryptionDict(dict)).toThrow(EncryptionDictError);
      expect(() => parseEncryptionDict(dict)).toThrow("Missing /P");
    });

    it("should throw for wrong O length in R2-R4", () => {
      const dict = PdfDict.of({
        Filter: PdfName.of("Standard"),
        V: PdfNumber.of(1),
        R: PdfNumber.of(2),
        O: PdfString.fromHex("00".repeat(48)), // Wrong: 48 bytes
        U: PdfString.fromHex("00".repeat(32)),
        P: PdfNumber.of(-3904),
      });

      expect(() => parseEncryptionDict(dict)).toThrow(EncryptionDictError);
      expect(() => parseEncryptionDict(dict)).toThrow("Invalid /O length");
    });

    it("should throw for wrong O length in R5-R6", () => {
      const dict = createR6Dict({
        O: PdfString.fromHex("00".repeat(32)), // Wrong: 32 bytes
      });

      expect(() => parseEncryptionDict(dict)).toThrow(EncryptionDictError);
      expect(() => parseEncryptionDict(dict)).toThrow("Invalid /O length");
    });

    it("should throw for missing OE in R5+", () => {
      const dict = PdfDict.of({
        Filter: PdfName.of("Standard"),
        V: PdfNumber.of(5),
        R: PdfNumber.of(6),
        O: PdfString.fromHex("00".repeat(48)),
        U: PdfString.fromHex("00".repeat(48)),
        UE: PdfString.fromHex("00".repeat(32)),
        Perms: PdfString.fromHex("00".repeat(16)),
        P: PdfNumber.of(-3904),
      });

      expect(() => parseEncryptionDict(dict)).toThrow(EncryptionDictError);
      expect(() => parseEncryptionDict(dict)).toThrow("Missing or invalid /OE");
    });

    it("should throw for missing UE in R5+", () => {
      const dict = PdfDict.of({
        Filter: PdfName.of("Standard"),
        V: PdfNumber.of(5),
        R: PdfNumber.of(6),
        O: PdfString.fromHex("00".repeat(48)),
        U: PdfString.fromHex("00".repeat(48)),
        OE: PdfString.fromHex("00".repeat(32)),
        Perms: PdfString.fromHex("00".repeat(16)),
        P: PdfNumber.of(-3904),
      });

      expect(() => parseEncryptionDict(dict)).toThrow(EncryptionDictError);
      expect(() => parseEncryptionDict(dict)).toThrow("Missing or invalid /UE");
    });

    it("should throw for missing Perms in R5+", () => {
      const dict = PdfDict.of({
        Filter: PdfName.of("Standard"),
        V: PdfNumber.of(5),
        R: PdfNumber.of(6),
        O: PdfString.fromHex("00".repeat(48)),
        U: PdfString.fromHex("00".repeat(48)),
        OE: PdfString.fromHex("00".repeat(32)),
        UE: PdfString.fromHex("00".repeat(32)),
        P: PdfNumber.of(-3904),
      });

      expect(() => parseEncryptionDict(dict)).toThrow(EncryptionDictError);
      expect(() => parseEncryptionDict(dict)).toThrow("Missing or invalid /Perms");
    });

    it("should throw for invalid key length", () => {
      const dict = createR2Dict({
        V: PdfNumber.of(2),
        R: PdfNumber.of(3),
        Length: PdfNumber.of(47), // Not a multiple of 8
      });

      expect(() => parseEncryptionDict(dict)).toThrow(EncryptionDictError);
      expect(() => parseEncryptionDict(dict)).toThrow("Invalid key length");
    });
  });
});

describe("getKeyLengthBytes", () => {
  it("should convert bits to bytes for R2", () => {
    const dict = createR2Dict();
    const result = parseEncryptionDict(dict);

    expect(getKeyLengthBytes(result)).toBe(5); // 40 bits = 5 bytes
  });

  it("should convert bits to bytes for R4", () => {
    const dict = createR4Dict();
    const result = parseEncryptionDict(dict);

    expect(getKeyLengthBytes(result)).toBe(16); // 128 bits = 16 bytes
  });

  it("should convert bits to bytes for R6", () => {
    const dict = createR6Dict();
    const result = parseEncryptionDict(dict);

    expect(getKeyLengthBytes(result)).toBe(32); // 256 bits = 32 bytes
  });
});

describe("algorithm detection", () => {
  it("should detect RC4 for V1", () => {
    const dict = createR2Dict();
    const result = parseEncryptionDict(dict);

    expect(result.algorithm).toBe("RC4");
  });

  it("should detect RC4 for V2/R3", () => {
    const dict = createR2Dict({
      V: PdfNumber.of(2),
      R: PdfNumber.of(3),
    });

    const result = parseEncryptionDict(dict);
    expect(result.algorithm).toBe("RC4");
  });

  it("should detect AES-128 for V4 without crypt filters", () => {
    const dict = createR4Dict();
    const result = parseEncryptionDict(dict);

    expect(result.algorithm).toBe("AES-128");
  });

  it("should detect RC4 for V4 with V2 crypt filter", () => {
    const stdCF = PdfDict.of({
      CFM: PdfName.of("V2"),
    });

    const cfDict = PdfDict.of({
      StdCF: stdCF,
    });

    const dict = createR4Dict({
      CF: cfDict,
      StmF: PdfName.of("StdCF"),
      StrF: PdfName.of("StdCF"),
    });

    const result = parseEncryptionDict(dict);
    expect(result.algorithm).toBe("RC4");
  });

  it("should detect AES-128 for V4 with AESV2 crypt filter", () => {
    const stdCF = PdfDict.of({
      CFM: PdfName.of("AESV2"),
    });

    const cfDict = PdfDict.of({
      StdCF: stdCF,
    });

    const dict = createR4Dict({
      CF: cfDict,
      StmF: PdfName.of("StdCF"),
    });

    const result = parseEncryptionDict(dict);
    expect(result.algorithm).toBe("AES-128");
  });

  it("should detect AES-256 for V5/R6", () => {
    const dict = createR6Dict();
    const result = parseEncryptionDict(dict);

    expect(result.algorithm).toBe("AES-256");
  });
});
