import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfStream } from "#src/objects/pdf-stream";
import { PdfString } from "#src/objects/pdf-string";
import { describe, expect, it } from "vitest";

import { ObjectStreamParser } from "./object-stream-parser";

/**
 * Create a mock object stream with the given objects.
 * Index format: objNum1 offset1 objNum2 offset2 ...
 * Objects are stored as text representations.
 */
function createObjectStream(objects: Array<{ objNum: number; text: string }>): PdfStream {
  // Build index and object sections
  const indexParts: string[] = [];
  const objectParts: string[] = [];
  let currentOffset = 0;

  for (const { objNum, text } of objects) {
    indexParts.push(`${objNum} ${currentOffset}`);
    objectParts.push(text);
    // Add 1 for the newline separator
    currentOffset += new TextEncoder().encode(text).length + 1;
  }

  const indexSection = `${indexParts.join(" ")}\n`;
  const objectSection = objectParts.join("\n");
  const fullContent = indexSection + objectSection;

  const data = new TextEncoder().encode(fullContent);
  const first = new TextEncoder().encode(indexSection).length;

  // Create stream dictionary
  const stream = new PdfStream(
    [
      ["Type", PdfName.of("ObjStm")],
      ["N", PdfNumber.of(objects.length)],
      ["First", PdfNumber.of(first)],
    ],
    data,
  );

  return stream;
}

describe("ObjectStreamParser", () => {
  describe("constructor", () => {
    it("validates stream type", () => {
      const badStream = new PdfStream(
        [
          ["Type", PdfName.of("Page")], // Wrong type
          ["N", PdfNumber.of(1)],
          ["First", PdfNumber.of(10)],
        ],
        new Uint8Array(0),
      );

      expect(() => new ObjectStreamParser(badStream)).toThrow(/Expected \/Type \/ObjStm/);
    });

    it("requires /N entry", () => {
      const badStream = new PdfStream(
        [
          ["Type", PdfName.of("ObjStm")],
          ["First", PdfNumber.of(10)],
        ],
        new Uint8Array(0),
      );

      expect(() => new ObjectStreamParser(badStream)).toThrow(/missing required \/N/);
    });

    it("requires /First entry", () => {
      const badStream = new PdfStream(
        [
          ["Type", PdfName.of("ObjStm")],
          ["N", PdfNumber.of(1)],
        ],
        new Uint8Array(0),
      );

      expect(() => new ObjectStreamParser(badStream)).toThrow(/missing required \/First/);
    });
  });

  describe("parse", () => {
    it("parses single object", async () => {
      const stream = createObjectStream([{ objNum: 1, text: "<< /Type /Page >>" }]);

      const parser = new ObjectStreamParser(stream);

      await parser.parse();

      expect(parser.objectCount).toBe(1);
      expect(parser.isParsed).toBe(true);
    });

    it("parses multiple objects", async () => {
      const stream = createObjectStream([
        { objNum: 1, text: "<< /Type /Page >>" },
        { objNum: 5, text: "[1 2 3]" },
        { objNum: 8, text: "(Hello)" },
      ]);

      const parser = new ObjectStreamParser(stream);

      await parser.parse();

      expect(parser.objectCount).toBe(3);
    });

    it("only parses once (caches result)", async () => {
      const stream = createObjectStream([{ objNum: 1, text: "42" }]);

      const parser = new ObjectStreamParser(stream);

      expect(parser.isParsed).toBe(false);
      await parser.parse();
      expect(parser.isParsed).toBe(true);

      // Second call should be no-op
      await parser.parse();
      expect(parser.isParsed).toBe(true);
    });
  });

  describe("getObject", () => {
    it("returns object by index", async () => {
      const stream = createObjectStream([
        { objNum: 1, text: "42" },
        { objNum: 2, text: "(Hello)" },
      ]);

      const parser = new ObjectStreamParser(stream);
      const obj0 = await parser.getObject(0);
      const obj1 = await parser.getObject(1);

      expect(obj0).toBeInstanceOf(PdfNumber);
      expect((obj0 as PdfNumber).value).toBe(42);

      expect(obj1).toBeInstanceOf(PdfString);
      expect((obj1 as PdfString).asString()).toBe("Hello");
    });

    it("returns null for out-of-bounds index", async () => {
      const stream = createObjectStream([{ objNum: 1, text: "42" }]);

      const parser = new ObjectStreamParser(stream);

      expect(await parser.getObject(-1)).toBeNull();
      expect(await parser.getObject(1)).toBeNull();
      expect(await parser.getObject(100)).toBeNull();
    });

    it("parses dict objects", async () => {
      const stream = createObjectStream([
        { objNum: 10, text: "<< /Type /Page /MediaBox [0 0 612 792] >>" },
      ]);

      const parser = new ObjectStreamParser(stream);
      const obj = await parser.getObject(0);

      expect(obj).toBeInstanceOf(PdfDict);
      expect((obj as PdfDict).getName("Type")?.value).toBe("Page");
    });

    it("parses array objects", async () => {
      const stream = createObjectStream([{ objNum: 5, text: "[1 2 3 /Name (string)]" }]);

      const parser = new ObjectStreamParser(stream);
      const obj = await parser.getObject(0);

      expect(obj).toBeInstanceOf(PdfArray);
      expect((obj as PdfArray).length).toBe(5);
    });

    it("parses name objects", async () => {
      const stream = createObjectStream([{ objNum: 3, text: "/FlateDecode" }]);

      const parser = new ObjectStreamParser(stream);
      const obj = await parser.getObject(0);

      expect(obj).toBeInstanceOf(PdfName);
      expect((obj as PdfName).value).toBe("FlateDecode");
    });
  });

  describe("getAllObjects", () => {
    it("returns map of all objects", async () => {
      const stream = createObjectStream([
        { objNum: 1, text: "42" },
        { objNum: 5, text: "(Hello)" },
        { objNum: 10, text: "/Name" },
      ]);

      const parser = new ObjectStreamParser(stream);
      const objects = await parser.getAllObjects();

      expect(objects.size).toBe(3);
      expect(objects.has(1)).toBe(true);
      expect(objects.has(5)).toBe(true);
      expect(objects.has(10)).toBe(true);

      expect((objects.get(1) as PdfNumber).value).toBe(42);
      expect((objects.get(5) as PdfString).asString()).toBe("Hello");
      expect((objects.get(10) as PdfName).value).toBe("Name");
    });
  });

  describe("getObjectNumber", () => {
    it("returns object number at index", async () => {
      const stream = createObjectStream([
        { objNum: 100, text: "42" },
        { objNum: 200, text: "43" },
      ]);

      const parser = new ObjectStreamParser(stream);

      await parser.parse();

      expect(parser.getObjectNumber(0)).toBe(100);
      expect(parser.getObjectNumber(1)).toBe(200);
    });

    it("returns null for invalid index", async () => {
      const stream = createObjectStream([{ objNum: 1, text: "42" }]);

      const parser = new ObjectStreamParser(stream);

      await parser.parse();

      expect(parser.getObjectNumber(-1)).toBeNull();
      expect(parser.getObjectNumber(5)).toBeNull();
    });

    it("returns null before parse()", () => {
      const stream = createObjectStream([{ objNum: 1, text: "42" }]);
      const parser = new ObjectStreamParser(stream);

      // Not parsed yet
      expect(parser.getObjectNumber(0)).toBeNull();
    });
  });

  describe("complex objects", () => {
    it("handles nested dictionaries", async () => {
      const stream = createObjectStream([
        { objNum: 1, text: "<< /Resources << /Font << /F1 1 0 R >> >> >>" },
      ]);

      const parser = new ObjectStreamParser(stream);
      const obj = (await parser.getObject(0)) as PdfDict;

      expect(obj).toBeInstanceOf(PdfDict);
      const resources = obj.getDict("Resources");

      expect(resources).toBeInstanceOf(PdfDict);
    });

    it("handles arrays of dicts", async () => {
      const stream = createObjectStream([{ objNum: 5, text: "[<< /Type /A >> << /Type /B >>]" }]);

      const parser = new ObjectStreamParser(stream);
      const obj = (await parser.getObject(0)) as PdfArray;

      expect(obj.length).toBe(2);
      expect((obj.at(0) as PdfDict).getName("Type")?.value).toBe("A");
      expect((obj.at(1) as PdfDict).getName("Type")?.value).toBe("B");
    });
  });

  describe("edge cases", () => {
    it("handles empty stream (n=0)", async () => {
      const stream = new PdfStream(
        [
          ["Type", PdfName.of("ObjStm")],
          ["N", PdfNumber.of(0)],
          ["First", PdfNumber.of(0)],
        ],
        new Uint8Array(0),
      );

      const parser = new ObjectStreamParser(stream);
      const objects = await parser.getAllObjects();

      expect(objects.size).toBe(0);
    });

    it("handles whitespace in index", async () => {
      // Extra whitespace between index entries
      const indexSection = "1    0   5   10  \n";
      const objectSection = "42\n(Hello)";
      const fullContent = indexSection + objectSection;
      const data = new TextEncoder().encode(fullContent);

      const stream = new PdfStream(
        [
          ["Type", PdfName.of("ObjStm")],
          ["N", PdfNumber.of(2)],
          ["First", PdfNumber.of(indexSection.length)],
        ],
        data,
      );

      const parser = new ObjectStreamParser(stream);

      await parser.parse();

      expect(parser.objectCount).toBe(2);
      expect(parser.getObjectNumber(0)).toBe(1);
      expect(parser.getObjectNumber(1)).toBe(5);
    });
  });
});
