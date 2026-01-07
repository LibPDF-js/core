import { describe, expect, it } from "vitest";
import { Op, Operator } from "#src/content/operators";
import { PdfString } from "#src/objects/pdf-string";
import { ContentStreamParser } from "./content-stream-parser";
import { ContentStreamSerializer } from "./content-stream-serializer";
import type { ContentToken, InlineImageOperation, ParsedOperation } from "./types";

const encode = (s: string) => new TextEncoder().encode(s);
const decode = (b: Uint8Array) => new TextDecoder().decode(b);

describe("ContentStreamSerializer", () => {
  describe("basic operations", () => {
    it("serializes operator without operands", () => {
      const op: ParsedOperation = { operator: "q", operands: [] };
      const bytes = ContentStreamSerializer.serializeOperation(op);

      expect(decode(bytes)).toBe("q");
    });

    it("serializes operator with number operands", () => {
      const op: ParsedOperation = {
        operator: "cm",
        operands: [
          { type: "number", value: 1 },
          { type: "number", value: 0 },
          { type: "number", value: 0 },
          { type: "number", value: 1 },
          { type: "number", value: 50 },
          { type: "number", value: 700 },
        ],
      };
      const bytes = ContentStreamSerializer.serializeOperation(op);

      expect(decode(bytes)).toBe("1 0 0 1 50 700 cm");
    });

    it("serializes operator with name operand", () => {
      const op: ParsedOperation = {
        operator: "Tf",
        operands: [
          { type: "name", value: "F1" },
          { type: "number", value: 12 },
        ],
      };
      const bytes = ContentStreamSerializer.serializeOperation(op);

      expect(decode(bytes)).toBe("/F1 12 Tf");
    });

    it("serializes operator with literal string operand", () => {
      const op: ParsedOperation = {
        operator: "Tj",
        operands: [{ type: "string", value: encode("Hello"), hex: false }],
      };
      const bytes = ContentStreamSerializer.serializeOperation(op);

      expect(decode(bytes)).toBe("(Hello) Tj");
    });

    it("serializes operator with hex string operand", () => {
      const op: ParsedOperation = {
        operator: "Tj",
        operands: [
          { type: "string", value: new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]), hex: true },
        ],
      };
      const bytes = ContentStreamSerializer.serializeOperation(op);

      expect(decode(bytes)).toBe("<48656C6C6F> Tj");
    });

    it("serializes boolean operands", () => {
      const op: ParsedOperation = {
        operator: "test",
        operands: [
          { type: "bool", value: true },
          { type: "bool", value: false },
        ],
      };
      const bytes = ContentStreamSerializer.serializeOperation(op);

      expect(decode(bytes)).toBe("true false test");
    });

    it("serializes null operand", () => {
      const op: ParsedOperation = {
        operator: "test",
        operands: [{ type: "null" }],
      };
      const bytes = ContentStreamSerializer.serializeOperation(op);

      expect(decode(bytes)).toBe("null test");
    });
  });

  describe("arrays", () => {
    it("serializes simple array", () => {
      const op: ParsedOperation = {
        operator: "d",
        operands: [
          {
            type: "array",
            items: [
              { type: "number", value: 3 },
              { type: "number", value: 2 },
            ],
          },
          { type: "number", value: 0 },
        ],
      };
      const bytes = ContentStreamSerializer.serializeOperation(op);

      expect(decode(bytes)).toBe("[3 2] 0 d");
    });

    it("serializes TJ array", () => {
      const op: ParsedOperation = {
        operator: "TJ",
        operands: [
          {
            type: "array",
            items: [
              { type: "string", value: encode("Hello"), hex: false },
              { type: "number", value: -50 },
              { type: "string", value: encode("World"), hex: false },
            ],
          },
        ],
      };
      const bytes = ContentStreamSerializer.serializeOperation(op);

      expect(decode(bytes)).toBe("[(Hello) -50 (World)] TJ");
    });
  });

  describe("dictionaries", () => {
    it("serializes inline dict", () => {
      const entries = new Map<string, ContentToken>();
      entries.set("Type", { type: "name", value: "XObject" });
      entries.set("Width", { type: "number", value: 100 });

      const op: ParsedOperation = {
        operator: "BDC",
        operands: [
          { type: "name", value: "OC" },
          { type: "dict", entries },
        ],
      };
      const bytes = ContentStreamSerializer.serializeOperation(op);
      const str = decode(bytes);

      expect(str).toContain("/OC");
      expect(str).toContain("<<");
      expect(str).toContain("/Type /XObject");
      expect(str).toContain("/Width 100");
      expect(str).toContain(">>");
      expect(str).toContain("BDC");
    });
  });

  describe("inline images", () => {
    it("serializes inline image", () => {
      const params = new Map<string, ContentToken>();
      params.set("W", { type: "number", value: 10 });
      params.set("H", { type: "number", value: 10 });
      params.set("CS", { type: "name", value: "G" });
      params.set("BPC", { type: "number", value: 8 });

      const op: InlineImageOperation = {
        operator: "BI",
        params,
        data: new Uint8Array([0x00, 0x80, 0xff]),
      };

      const bytes = ContentStreamSerializer.serializeOperation(op);
      const str = decode(bytes);

      expect(str).toContain("BI");
      expect(str).toContain("/W 10");
      expect(str).toContain("/H 10");
      expect(str).toContain("/CS /G");
      expect(str).toContain("/BPC 8");
      expect(str).toContain("ID ");
      expect(str).toContain("EI");
    });
  });

  describe("Operator class support", () => {
    it("serializes Operator instance", () => {
      const op = Operator.of(Op.PushGraphicsState);
      const bytes = ContentStreamSerializer.serializeOperation(op);

      expect(decode(bytes)).toBe("q");
    });

    it("serializes Operator with operands", () => {
      const op = Operator.of(Op.ConcatMatrix, 1, 0, 0, 1, 50, 700);
      const bytes = ContentStreamSerializer.serializeOperation(op);

      expect(decode(bytes)).toBe("1 0 0 1 50 700 cm");
    });

    it("serializes Operator with string operand", () => {
      const op = Operator.of(Op.ShowText, PdfString.fromString("Hello"));
      const bytes = ContentStreamSerializer.serializeOperation(op);

      expect(decode(bytes)).toBe("(Hello) Tj");
    });
  });

  describe("serialize array of operations", () => {
    it("serializes multiple operations", () => {
      const ops: ParsedOperation[] = [
        { operator: "q", operands: [] },
        {
          operator: "cm",
          operands: [
            { type: "number", value: 1 },
            { type: "number", value: 0 },
            { type: "number", value: 0 },
            { type: "number", value: 1 },
            { type: "number", value: 0 },
            { type: "number", value: 0 },
          ],
        },
        { operator: "Q", operands: [] },
      ];

      const bytes = ContentStreamSerializer.serialize(ops);
      const str = decode(bytes);

      expect(str).toContain("q\n");
      expect(str).toContain("1 0 0 1 0 0 cm\n");
      expect(str).toContain("Q\n");
    });

    it("serializes mixed ParsedOperation and Operator", () => {
      const ops = [
        { operator: "q", operands: [] } as ParsedOperation,
        Operator.of(Op.ConcatMatrix, 1, 0, 0, 1, 50, 700),
        { operator: "Q", operands: [] } as ParsedOperation,
      ];

      const bytes = ContentStreamSerializer.serialize(ops);
      const str = decode(bytes);

      expect(str).toContain("q\n");
      expect(str).toContain("1 0 0 1 50 700 cm\n");
      expect(str).toContain("Q\n");
    });
  });

  describe("special characters", () => {
    it("escapes parentheses in literal strings", () => {
      const op: ParsedOperation = {
        operator: "Tj",
        operands: [{ type: "string", value: encode("(test)"), hex: false }],
      };
      const bytes = ContentStreamSerializer.serializeOperation(op);

      expect(decode(bytes)).toBe("(\\(test\\)) Tj");
    });

    it("escapes backslash in literal strings", () => {
      const op: ParsedOperation = {
        operator: "Tj",
        operands: [{ type: "string", value: encode("a\\b"), hex: false }],
      };
      const bytes = ContentStreamSerializer.serializeOperation(op);

      expect(decode(bytes)).toBe("(a\\\\b) Tj");
    });
  });

  describe("round-trip", () => {
    it("parse -> serialize produces semantically equivalent result", () => {
      const original = "q 1 0 0 1 50 700 cm BT /F1 12 Tf (Hello) Tj ET Q";
      const parser = new ContentStreamParser(encode(original));
      const { operations } = parser.parse();

      const serialized = ContentStreamSerializer.serialize(operations);
      const str = decode(serialized);

      // Should contain all the same operations
      expect(str).toContain("q");
      expect(str).toContain("1 0 0 1 50 700 cm");
      expect(str).toContain("BT");
      expect(str).toContain("/F1 12 Tf");
      expect(str).toContain("(Hello) Tj");
      expect(str).toContain("ET");
      expect(str).toContain("Q");
    });

    it("round-trip preserves operation count", () => {
      const original = "q 1 0 0 1 0 0 cm 0.5 g 100 100 200 200 re f Q";
      const parser1 = new ContentStreamParser(encode(original));
      const { operations: ops1 } = parser1.parse();

      const serialized = ContentStreamSerializer.serialize(ops1);
      const parser2 = new ContentStreamParser(serialized);
      const { operations: ops2 } = parser2.parse();

      expect(ops2.length).toBe(ops1.length);

      for (let i = 0; i < ops1.length; i++) {
        expect(ops2[i].operator).toBe(ops1[i].operator);
      }
    });
  });

  describe("number formatting", () => {
    it("formats integers without decimal", () => {
      const op: ParsedOperation = {
        operator: "m",
        operands: [
          { type: "number", value: 100 },
          { type: "number", value: 200 },
        ],
      };
      const bytes = ContentStreamSerializer.serializeOperation(op);

      expect(decode(bytes)).toBe("100 200 m");
    });

    it("formats decimals with minimal precision", () => {
      const op: ParsedOperation = {
        operator: "m",
        operands: [
          { type: "number", value: 100.5 },
          { type: "number", value: 200.125 },
        ],
      };
      const bytes = ContentStreamSerializer.serializeOperation(op);

      expect(decode(bytes)).toBe("100.5 200.125 m");
    });
  });
});
