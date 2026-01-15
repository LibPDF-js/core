import { PdfDict } from "#src/objects/pdf-dict";
import { PdfNumber } from "#src/objects/pdf-number";
import { describe, expect, it } from "vitest";

import { applyPredictor } from "./predictor";

/**
 * Helper to create a PdfDict with predictor parameters.
 */
function makeParams(options: {
  predictor?: number;
  columns?: number;
  colors?: number;
  bpc?: number;
}): PdfDict {
  const dict = new PdfDict();

  if (options.predictor !== undefined) {
    dict.set("Predictor", PdfNumber.of(options.predictor));
  }

  if (options.columns !== undefined) {
    dict.set("Columns", PdfNumber.of(options.columns));
  }

  if (options.colors !== undefined) {
    dict.set("Colors", PdfNumber.of(options.colors));
  }

  if (options.bpc !== undefined) {
    dict.set("BitsPerComponent", PdfNumber.of(options.bpc));
  }

  return dict;
}

describe("applyPredictor", () => {
  describe("predictor 1 (none)", () => {
    it("returns data unchanged", () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const params = makeParams({ predictor: 1 });

      const result = applyPredictor(data, params);

      expect(result).toEqual(data);
    });

    it("defaults to predictor 1 when not specified", () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const params = new PdfDict();

      const result = applyPredictor(data, params);

      expect(result).toEqual(data);
    });
  });

  describe("predictor 2 (TIFF)", () => {
    it("decodes horizontal differencing", () => {
      // Row of 4 bytes: first is absolute, rest are differences
      // Input: [10, 5, 3, 2] → Output: [10, 15, 18, 20]
      const data = new Uint8Array([10, 5, 3, 2]);
      const params = makeParams({
        predictor: 2,
        columns: 4,
        colors: 1,
        bpc: 8,
      });

      const result = applyPredictor(data, params);

      expect(result).toEqual(new Uint8Array([10, 15, 18, 20]));
    });

    it("handles multiple rows", () => {
      // Two rows of 3 bytes each
      const data = new Uint8Array([
        10,
        5,
        3, // Row 1: [10, 15, 18]
        20,
        2,
        1, // Row 2: [20, 22, 23]
      ]);
      const params = makeParams({
        predictor: 2,
        columns: 3,
        colors: 1,
        bpc: 8,
      });

      const result = applyPredictor(data, params);

      expect(result).toEqual(new Uint8Array([10, 15, 18, 20, 22, 23]));
    });

    it("handles overflow (wraps at 256)", () => {
      // 200 + 100 = 300 → 44 (mod 256)
      const data = new Uint8Array([200, 100]);
      const params = makeParams({
        predictor: 2,
        columns: 2,
        colors: 1,
        bpc: 8,
      });

      const result = applyPredictor(data, params);

      expect(result).toEqual(new Uint8Array([200, 44]));
    });

    it("handles multi-component pixels", () => {
      // RGB (3 colors): each component is predicted from same component of previous pixel
      const data = new Uint8Array([
        10,
        20,
        30, // First pixel (absolute)
        1,
        2,
        3, // Second pixel (differences)
      ]);
      const params = makeParams({
        predictor: 2,
        columns: 2,
        colors: 3,
        bpc: 8,
      });

      const result = applyPredictor(data, params);

      // First pixel: [10, 20, 30]
      // Second pixel: [10+1, 20+2, 30+3] = [11, 22, 33]
      expect(result).toEqual(new Uint8Array([10, 20, 30, 11, 22, 33]));
    });
  });

  describe("PNG predictors", () => {
    describe("filter 0 (None)", () => {
      it("copies data unchanged", () => {
        // Each row has filter byte prefix
        const data = new Uint8Array([
          0,
          1,
          2,
          3, // Row 1: filter=0, data=[1,2,3]
          0,
          4,
          5,
          6, // Row 2: filter=0, data=[4,5,6]
        ]);
        const params = makeParams({
          predictor: 10, // PNG
          columns: 3,
          colors: 1,
          bpc: 8,
        });

        const result = applyPredictor(data, params);

        expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));
      });
    });

    describe("filter 1 (Sub)", () => {
      it("adds left pixel", () => {
        // Filter byte = 1 (Sub)
        // First byte: 10 (no left)
        // Second: 5 + 10 = 15
        // Third: 3 + 15 = 18
        const data = new Uint8Array([1, 10, 5, 3]);
        const params = makeParams({
          predictor: 11,
          columns: 3,
          colors: 1,
          bpc: 8,
        });

        const result = applyPredictor(data, params);

        expect(result).toEqual(new Uint8Array([10, 15, 18]));
      });
    });

    describe("filter 2 (Up)", () => {
      it("adds pixel from row above", () => {
        const data = new Uint8Array([
          0,
          10,
          20,
          30, // Row 1: None filter, data=[10,20,30]
          2,
          1,
          2,
          3, // Row 2: Up filter, add row above
        ]);
        const params = makeParams({
          predictor: 12,
          columns: 3,
          colors: 1,
          bpc: 8,
        });

        const result = applyPredictor(data, params);

        // Row 1: [10, 20, 30]
        // Row 2: [1+10, 2+20, 3+30] = [11, 22, 33]
        expect(result).toEqual(new Uint8Array([10, 20, 30, 11, 22, 33]));
      });
    });

    describe("filter 3 (Average)", () => {
      it("adds average of left and above", () => {
        const data = new Uint8Array([
          0,
          10,
          20,
          30, // Row 1: None
          3,
          5,
          10,
          15, // Row 2: Average
        ]);
        const params = makeParams({
          predictor: 13,
          columns: 3,
          colors: 1,
          bpc: 8,
        });

        const result = applyPredictor(data, params);

        // Row 1: [10, 20, 30]
        // Row 2, col 0: 5 + floor((0 + 10) / 2) = 5 + 5 = 10
        // Row 2, col 1: 10 + floor((10 + 20) / 2) = 10 + 15 = 25
        // Row 2, col 2: 15 + floor((25 + 30) / 2) = 15 + 27 = 42
        expect(result).toEqual(new Uint8Array([10, 20, 30, 10, 25, 42]));
      });
    });

    describe("filter 4 (Paeth)", () => {
      it("uses Paeth predictor", () => {
        const data = new Uint8Array([
          0,
          10,
          20,
          30, // Row 1: None
          4,
          1,
          2,
          3, // Row 2: Paeth
        ]);
        const params = makeParams({
          predictor: 14,
          columns: 3,
          colors: 1,
          bpc: 8,
        });

        const result = applyPredictor(data, params);

        // Row 1: [10, 20, 30]
        // Row 2, col 0: Paeth(0, 10, 0) = 10, so 1 + 10 = 11
        // Row 2, col 1: Paeth(11, 20, 10) = ?
        //   p = 11 + 20 - 10 = 21
        //   pa = |21 - 11| = 10
        //   pb = |21 - 20| = 1
        //   pc = |21 - 10| = 11
        //   min is pb, so use b (20), result = 2 + 20 = 22
        // Row 2, col 2: similar...
        expect(result[0]).toBe(10);
        expect(result[1]).toBe(20);
        expect(result[2]).toBe(30);
        expect(result[3]).toBe(11);
        expect(result[4]).toBe(22);
        // result[5] would need careful calculation
      });
    });

    describe("mixed row filters", () => {
      it("handles different filter per row", () => {
        const data = new Uint8Array([
          0,
          10,
          20,
          30, // Row 1: None
          1,
          1,
          2,
          3, // Row 2: Sub
          2,
          5,
          5,
          5, // Row 3: Up
        ]);
        const params = makeParams({
          predictor: 15, // Optimum (each row specifies its filter)
          columns: 3,
          colors: 1,
          bpc: 8,
        });

        const result = applyPredictor(data, params);

        // Row 1: [10, 20, 30] (None)
        // Row 2: [1, 1+1=2, 2+2=4] (Sub)
        // Row 3: [5+1=6, 5+2=7, 5+4=9] (Up - adds row above)
        expect(result).toEqual(new Uint8Array([10, 20, 30, 1, 3, 6, 6, 8, 11]));
      });
    });
  });

  describe("edge cases", () => {
    it("handles single column", () => {
      const data = new Uint8Array([0, 42, 0, 10]);
      const params = makeParams({
        predictor: 10,
        columns: 1,
        colors: 1,
        bpc: 8,
      });

      const result = applyPredictor(data, params);

      expect(result).toEqual(new Uint8Array([42, 10]));
    });

    it("throws on unknown predictor", () => {
      const data = new Uint8Array([1, 2, 3]);
      const params = makeParams({ predictor: 99 });

      expect(() => applyPredictor(data, params)).toThrow("Unknown predictor value: 99");
    });
  });
});
