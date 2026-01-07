import { describe, expect, it } from "vitest";

import { ContentStreamParser } from "./content-stream-parser";
import { isInlineImageOperation, isParsedOperation } from "./types";

const encode = (s: string) => new TextEncoder().encode(s);

describe("ContentStreamParser", () => {
  describe("basic parsing", () => {
    it("parses empty stream", () => {
      const parser = new ContentStreamParser(encode(""));
      const { operations, warnings } = parser.parse();

      expect(operations).toHaveLength(0);
      expect(warnings).toHaveLength(0);
    });

    it("parses single operator without operands", () => {
      const parser = new ContentStreamParser(encode("q"));
      const { operations } = parser.parse();

      expect(operations).toHaveLength(1);
      expect(operations[0]).toEqual({ operator: "q", operands: [] });
    });

    it("parses operator with operands", () => {
      const parser = new ContentStreamParser(encode("1 0 0 1 50 700 cm"));
      const { operations } = parser.parse();

      expect(operations).toHaveLength(1);

      const op = operations[0];
      expect(op.operator).toBe("cm");

      if (isParsedOperation(op)) {
        expect(op.operands).toHaveLength(6);
        expect(op.operands[0]).toEqual({ type: "number", value: 1 });
        expect(op.operands[4]).toEqual({ type: "number", value: 50 });
      }
    });

    it("parses multiple operations", () => {
      const parser = new ContentStreamParser(encode("q 1 0 0 1 0 0 cm Q"));
      const { operations } = parser.parse();

      expect(operations).toHaveLength(3);
      expect(operations[0]).toEqual({ operator: "q", operands: [] });

      const cmOp = operations[1];
      expect(cmOp.operator).toBe("cm");

      if (isParsedOperation(cmOp)) {
        expect(cmOp.operands).toHaveLength(6);
      }

      expect(operations[2]).toEqual({ operator: "Q", operands: [] });
    });
  });

  describe("text operations", () => {
    it("parses text block", () => {
      const parser = new ContentStreamParser(encode("BT /F1 12 Tf (Hello) Tj ET"));
      const { operations } = parser.parse();

      expect(operations).toHaveLength(4);
      expect(operations[0]).toEqual({ operator: "BT", operands: [] });

      const tfOp = operations[1];
      expect(tfOp.operator).toBe("Tf");

      if (isParsedOperation(tfOp)) {
        expect(tfOp.operands).toHaveLength(2);
        expect(tfOp.operands[0]).toEqual({ type: "name", value: "F1" });
        expect(tfOp.operands[1]).toEqual({ type: "number", value: 12 });
      }

      const tjOp = operations[2];
      expect(tjOp.operator).toBe("Tj");

      if (isParsedOperation(tjOp)) {
        expect(tjOp.operands).toHaveLength(1);
        expect(tjOp.operands[0].type).toBe("string");
      }

      expect(operations[3]).toEqual({ operator: "ET", operands: [] });
    });

    it("parses TJ with array operand", () => {
      const parser = new ContentStreamParser(encode("[(Hello) -50 (World)] TJ"));
      const { operations } = parser.parse();

      expect(operations).toHaveLength(1);

      const op = operations[0];
      expect(op.operator).toBe("TJ");

      if (isParsedOperation(op)) {
        expect(op.operands).toHaveLength(1);
        expect(op.operands[0].type).toBe("array");
      }
    });
  });

  describe("marked content", () => {
    it("parses BMC/EMC", () => {
      const parser = new ContentStreamParser(encode("/OC BMC q Q EMC"));
      const { operations } = parser.parse();

      expect(operations).toHaveLength(4);

      const bmcOp = operations[0];
      expect(bmcOp.operator).toBe("BMC");

      if (isParsedOperation(bmcOp)) {
        expect(bmcOp.operands[0]).toEqual({ type: "name", value: "OC" });
      }

      expect(operations[3]).toEqual({ operator: "EMC", operands: [] });
    });

    it("parses BDC with properties", () => {
      const parser = new ContentStreamParser(encode("/OC /MC0 BDC q Q EMC"));
      const { operations } = parser.parse();

      expect(operations).toHaveLength(4);

      const bdcOp = operations[0];
      expect(bdcOp.operator).toBe("BDC");

      if (isParsedOperation(bdcOp)) {
        expect(bdcOp.operands).toHaveLength(2);
        expect(bdcOp.operands[0]).toEqual({ type: "name", value: "OC" });
        expect(bdcOp.operands[1]).toEqual({ type: "name", value: "MC0" });
      }
    });

    it("parses BDC with inline dict", () => {
      const parser = new ContentStreamParser(encode("/OC <</Type /OCG /Name (Layer1)>> BDC EMC"));
      const { operations } = parser.parse();

      expect(operations).toHaveLength(2);

      const bdcOp = operations[0];
      expect(bdcOp.operator).toBe("BDC");

      if (isParsedOperation(bdcOp)) {
        expect(bdcOp.operands[1].type).toBe("dict");
      }
    });
  });

  describe("path operations", () => {
    it("parses path construction and painting", () => {
      const parser = new ContentStreamParser(encode("100 200 m 300 400 l 500 200 l h S"));
      const { operations } = parser.parse();

      expect(operations).toHaveLength(5);

      const mOp = operations[0];
      expect(mOp.operator).toBe("m");

      if (isParsedOperation(mOp)) {
        expect(mOp.operands).toHaveLength(2);
      }

      expect(operations[1].operator).toBe("l");
      expect(operations[2].operator).toBe("l");
      expect(operations[3]).toEqual({ operator: "h", operands: [] });
      expect(operations[4]).toEqual({ operator: "S", operands: [] });
    });

    it("parses rectangle", () => {
      const parser = new ContentStreamParser(encode("10 20 100 50 re f"));
      const { operations } = parser.parse();

      expect(operations).toHaveLength(2);

      const reOp = operations[0];
      expect(reOp.operator).toBe("re");

      if (isParsedOperation(reOp)) {
        expect(reOp.operands).toEqual([
          { type: "number", value: 10 },
          { type: "number", value: 20 },
          { type: "number", value: 100 },
          { type: "number", value: 50 },
        ]);
      }
    });
  });

  describe("color operations", () => {
    it("parses gray color", () => {
      const parser = new ContentStreamParser(encode("0.5 g 0.8 G"));
      const { operations } = parser.parse();

      expect(operations).toHaveLength(2);
      expect(operations[0]).toEqual({
        operator: "g",
        operands: [{ type: "number", value: 0.5 }],
      });
      expect(operations[1]).toEqual({
        operator: "G",
        operands: [{ type: "number", value: 0.8 }],
      });
    });

    it("parses RGB color", () => {
      const parser = new ContentStreamParser(encode("1 0 0 rg"));
      const { operations } = parser.parse();

      expect(operations).toHaveLength(1);

      const op = operations[0];
      expect(op.operator).toBe("rg");

      if (isParsedOperation(op)) {
        expect(op.operands).toHaveLength(3);
      }
    });
  });

  describe("inline images", () => {
    it("parses simple inline image", () => {
      // Simple 1x1 grayscale image
      const stream = "BI /W 1 /H 1 /CS /G /BPC 8 ID \x80 EI Q";
      const parser = new ContentStreamParser(encode(stream));
      const { operations } = parser.parse();

      expect(operations.length).toBeGreaterThanOrEqual(1);

      const biOp = operations[0];
      expect(isInlineImageOperation(biOp)).toBe(true);

      if (isInlineImageOperation(biOp)) {
        expect(biOp.operator).toBe("BI");
        expect(biOp.params.get("W")).toEqual({ type: "number", value: 1 });
        expect(biOp.params.get("H")).toEqual({ type: "number", value: 1 });
        expect(biOp.params.get("CS")).toEqual({ type: "name", value: "G" });
        expect(biOp.data.length).toBeGreaterThan(0);
      }
    });

    it("parses inline image with ASCII85 filter", () => {
      const stream = "BI /W 2 /H 2 /CS /G /BPC 8 /F /A85 ID z~> EI";
      const parser = new ContentStreamParser(encode(stream));
      const { operations } = parser.parse();

      expect(operations).toHaveLength(1);

      const biOp = operations[0];
      expect(isInlineImageOperation(biOp)).toBe(true);

      if (isInlineImageOperation(biOp)) {
        expect(biOp.params.get("F")).toEqual({ type: "name", value: "A85" });
        // ASCII85 "z" decodes to 4 zero bytes, ~> is EOD
        expect(new TextDecoder().decode(biOp.data)).toContain("z~>");
      }
    });

    it("parses inline image with ASCIIHex filter", () => {
      const stream = "BI /W 1 /H 1 /CS /G /BPC 8 /F /AHx ID FF> EI";
      const parser = new ContentStreamParser(encode(stream));
      const { operations } = parser.parse();

      expect(operations).toHaveLength(1);

      const biOp = operations[0];
      expect(isInlineImageOperation(biOp)).toBe(true);

      if (isInlineImageOperation(biOp)) {
        expect(biOp.params.get("F")).toEqual({ type: "name", value: "AHx" });
      }
    });
  });

  describe("warnings", () => {
    it("warns on trailing operands", () => {
      const parser = new ContentStreamParser(encode("q 1 2 3"));
      const { operations, warnings } = parser.parse();

      expect(operations).toHaveLength(1);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("trailing operand");
    });
  });

  describe("iterator", () => {
    it("iterates operations lazily", () => {
      const parser = new ContentStreamParser(encode("q 1 0 0 1 0 0 cm Q"));
      const ops = [...parser];

      expect(ops).toHaveLength(3);
      expect(ops[0]).toEqual({ operator: "q", operands: [] });
      expect(ops[1].operator).toBe("cm");
      expect(ops[2]).toEqual({ operator: "Q", operands: [] });
    });
  });

  describe("real-world patterns", () => {
    it("parses typical page content", () => {
      const content = `
        q
        1 0 0 1 0 0 cm
        BT
        /F1 12 Tf
        100 700 Td
        (Hello World) Tj
        ET
        Q
      `;
      const parser = new ContentStreamParser(encode(content));
      const { operations, warnings } = parser.parse();

      expect(warnings).toHaveLength(0);
      expect(operations.length).toBeGreaterThan(5);

      const operators = operations.map(op => op.operator);
      expect(operators).toContain("q");
      expect(operators).toContain("cm");
      expect(operators).toContain("BT");
      expect(operators).toContain("Tf");
      expect(operators).toContain("Td");
      expect(operators).toContain("Tj");
      expect(operators).toContain("ET");
      expect(operators).toContain("Q");
    });

    it("parses graphics with clipping", () => {
      const content = "100 100 200 200 re W n 0.5 g 100 100 200 200 re f";
      const parser = new ContentStreamParser(encode(content));
      const { operations } = parser.parse();

      const operators = operations.map(op => op.operator);
      expect(operators).toEqual(["re", "W", "n", "g", "re", "f"]);
    });
  });
});
