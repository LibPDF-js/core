import { Matrix, ops, PdfString } from "#src/index";
import { describe, expect, it } from "vitest";

describe("Operator Improvements", () => {
  describe("concatMatrix", () => {
    it("should accept 6 individual numbers", () => {
      const operator = ops.concatMatrix(1, 0, 0, 1, 100, 200);
      expect(operator.toString()).toBe("1 0 0 1 100 200 cm");
    });

    it("should accept a Matrix instance", () => {
      const matrix = Matrix.identity().translate(100, 200).scale(2, 2);
      const operator = ops.concatMatrix(matrix);
      expect(operator.toString()).toBe("2 0 0 2 100 200 cm");
    });

    it("should create rotation matrix correctly", () => {
      const matrix = Matrix.identity().rotate(45);
      const operator = ops.concatMatrix(matrix);
      const str = operator.toString();
      expect(str).toContain("cm");
      // For 45° rotation: cos(45°) ≈ 0.707, sin(45°) ≈ 0.707
      // Matrix values should be rounded appropriately
      expect(str).toMatch(/\d+\.?\d* -?\d+\.?\d* -?\d+\.?\d* \d+\.?\d* \d+\.?\d* \d+\.?\d* cm/);
    });
  });

  describe("showText", () => {
    it("should accept a PdfString", () => {
      const pdfStr = PdfString.fromString("Hello");
      const operator = ops.showText(pdfStr);
      expect(operator.toString()).toContain("Tj");
    });

    it("should accept a plain string and auto-encode", () => {
      const operator = ops.showText("Hello");
      expect(operator.toString()).toContain("Hello");
      expect(operator.toString()).toContain("Tj");
    });
  });

  describe("Name normalization", () => {
    it("should add leading slash to font names without it", () => {
      const operator = ops.setFont("F0", 12);
      expect(operator.toString()).toBe("/F0 12 Tf");
    });

    it("should preserve leading slash in font names that have it", () => {
      const operator = ops.setFont("/F0", 12);
      expect(operator.toString()).toBe("/F0 12 Tf");
    });

    it("should normalize graphics state names", () => {
      const operator = ops.setGraphicsState("GS0");
      expect(operator.toString()).toBe("/GS0 gs");
    });

    it("should normalize XObject names", () => {
      const operator = ops.paintXObject("Im0");
      expect(operator.toString()).toBe("/Im0 Do");
    });

    it("should normalize shading names", () => {
      const operator = ops.paintShading("Sh0");
      expect(operator.toString()).toBe("/Sh0 sh");
    });
  });
});
