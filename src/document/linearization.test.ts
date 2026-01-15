import { checkIncrementalSaveBlocker } from "#src/helpers/save-utils";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { describe, expect, it } from "vitest";

import { isLinearizationDict, parseLinearizationDict } from "./linearization";

describe("isLinearizationDict", () => {
  it("returns true for dict with /Linearized 1", () => {
    const dict = PdfDict.of({
      Linearized: PdfNumber.of(1),
    });

    expect(isLinearizationDict(dict)).toBe(true);
  });

  it("returns false for dict without /Linearized", () => {
    const dict = PdfDict.of({
      Type: PdfName.Catalog,
    });

    expect(isLinearizationDict(dict)).toBe(false);
  });

  it("returns false for dict with /Linearized != 1", () => {
    const dict = PdfDict.of({
      Linearized: PdfNumber.of(2),
    });

    expect(isLinearizationDict(dict)).toBe(false);
  });

  it("returns false for empty dict", () => {
    const dict = new PdfDict();

    expect(isLinearizationDict(dict)).toBe(false);
  });
});

describe("parseLinearizationDict", () => {
  it("parses valid linearization dict", () => {
    const dict = PdfDict.of({
      Linearized: PdfNumber.of(1),
      L: PdfNumber.of(10000), // file length
      O: PdfNumber.of(5), // first page object
      E: PdfNumber.of(5000), // end of first page
      N: PdfNumber.of(10), // page count
      T: PdfNumber.of(9000), // main xref offset
      H: PdfArray.of(PdfNumber.of(1000), PdfNumber.of(200)), // hint stream
    });

    const params = parseLinearizationDict(dict);

    expect(params).not.toBeNull();
    expect(params?.version).toBe(1);
    expect(params?.fileLength).toBe(10000);
    expect(params?.firstPage).toBe(5);
    expect(params?.endOfFirstPage).toBe(5000);
    expect(params?.pageCount).toBe(10);
    expect(params?.mainXRefOffset).toBe(9000);
    expect(params?.hintOffset).toBe(1000);
    expect(params?.hintLength).toBe(200);
  });

  it("returns null for missing required fields", () => {
    const dict = PdfDict.of({
      Linearized: PdfNumber.of(1),
      // Missing other required fields
    });

    expect(parseLinearizationDict(dict)).toBeNull();
  });

  it("handles missing hint stream", () => {
    const dict = PdfDict.of({
      Linearized: PdfNumber.of(1),
      L: PdfNumber.of(10000),
      O: PdfNumber.of(5),
      E: PdfNumber.of(5000),
      N: PdfNumber.of(10),
      T: PdfNumber.of(9000),
      // No H array
    });

    const params = parseLinearizationDict(dict);

    expect(params).not.toBeNull();
    expect(params?.hintOffset).toBe(0);
    expect(params?.hintLength).toBe(0);
  });
});

describe("checkIncrementalSaveBlocker", () => {
  it("returns null when incremental save is possible", () => {
    const blocker = checkIncrementalSaveBlocker({
      isNewlyCreated: false,
      isLinearized: false,
      recoveredViaBruteForce: false,
      encryptionChanged: false,
      encryptionAdded: false,
      encryptionRemoved: false,
    });

    expect(blocker).toBeNull();
  });

  it("returns 'newly-created' for newly created PDFs", () => {
    const blocker = checkIncrementalSaveBlocker({
      isNewlyCreated: true,
      isLinearized: false,
      recoveredViaBruteForce: false,
      encryptionChanged: false,
      encryptionAdded: false,
      encryptionRemoved: false,
    });

    expect(blocker).toBe("newly-created");
  });

  it("returns 'linearized' for linearized PDFs", () => {
    const blocker = checkIncrementalSaveBlocker({
      isNewlyCreated: false,
      isLinearized: true,
      recoveredViaBruteForce: false,
      encryptionChanged: false,
      encryptionAdded: false,
      encryptionRemoved: false,
    });

    expect(blocker).toBe("linearized");
  });

  it("returns 'brute-force-recovery' for recovered PDFs", () => {
    const blocker = checkIncrementalSaveBlocker({
      isNewlyCreated: false,
      isLinearized: false,
      recoveredViaBruteForce: true,
      encryptionChanged: false,
      encryptionAdded: false,
      encryptionRemoved: false,
    });

    expect(blocker).toBe("brute-force-recovery");
  });

  it("returns 'encryption-added' when encryption was added", () => {
    const blocker = checkIncrementalSaveBlocker({
      isNewlyCreated: false,
      isLinearized: false,
      recoveredViaBruteForce: false,
      encryptionChanged: false,
      encryptionAdded: true,
      encryptionRemoved: false,
    });

    expect(blocker).toBe("encryption-added");
  });

  it("returns 'encryption-removed' when encryption was removed", () => {
    const blocker = checkIncrementalSaveBlocker({
      isNewlyCreated: false,
      isLinearized: false,
      recoveredViaBruteForce: false,
      encryptionChanged: false,
      encryptionAdded: false,
      encryptionRemoved: true,
    });

    expect(blocker).toBe("encryption-removed");
  });

  it("returns 'encryption-changed' when encryption params changed", () => {
    const blocker = checkIncrementalSaveBlocker({
      isNewlyCreated: false,
      isLinearized: false,
      recoveredViaBruteForce: false,
      encryptionChanged: true,
      encryptionAdded: false,
      encryptionRemoved: false,
    });

    expect(blocker).toBe("encryption-changed");
  });

  it("prioritizes newly-created over other blockers", () => {
    const blocker = checkIncrementalSaveBlocker({
      isNewlyCreated: true,
      isLinearized: true,
      recoveredViaBruteForce: true,
      encryptionChanged: true,
      encryptionAdded: false,
      encryptionRemoved: false,
    });

    // Newly created is checked first
    expect(blocker).toBe("newly-created");
  });
});
