import { describe, expect, it } from "vitest";
import {
  closePath,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  setLineWidth,
  setNonStrokingRGB,
  stroke,
} from "#src/helpers/operators.ts";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { ContentStreamBuilder } from "./content-stream";

describe("ContentStreamBuilder", () => {
  describe("construction", () => {
    it("creates empty builder", () => {
      const builder = new ContentStreamBuilder();
      expect(builder.isEmpty()).toBe(true);
      expect(builder.length).toBe(0);
    });

    it("creates builder from operators via from()", () => {
      const builder = ContentStreamBuilder.from([
        pushGraphicsState(),
        setLineWidth(2),
        popGraphicsState(),
      ]);
      expect(builder.length).toBe(3);
      expect(builder.isEmpty()).toBe(false);
    });

    it("from([]) creates empty builder", () => {
      const builder = ContentStreamBuilder.from([]);
      expect(builder.isEmpty()).toBe(true);
    });
  });

  describe("add()", () => {
    it("adds single operator", () => {
      const builder = new ContentStreamBuilder();
      builder.add(pushGraphicsState());
      expect(builder.length).toBe(1);
    });

    it("adds multiple operators at once", () => {
      const builder = new ContentStreamBuilder();
      builder.add(pushGraphicsState(), setLineWidth(2), popGraphicsState());
      expect(builder.length).toBe(3);
    });

    it("returns this for chaining", () => {
      const builder = new ContentStreamBuilder();
      const result = builder.add(pushGraphicsState());
      expect(result).toBe(builder);
    });

    it("supports method chaining", () => {
      const builder = new ContentStreamBuilder()
        .add(pushGraphicsState())
        .add(setLineWidth(2))
        .add(popGraphicsState());
      expect(builder.length).toBe(3);
    });
  });

  describe("addIf()", () => {
    it("adds operators when condition is true", () => {
      const builder = new ContentStreamBuilder();
      builder.addIf(true, pushGraphicsState(), popGraphicsState());
      expect(builder.length).toBe(2);
    });

    it("does not add operators when condition is false", () => {
      const builder = new ContentStreamBuilder();
      builder.addIf(false, pushGraphicsState(), popGraphicsState());
      expect(builder.length).toBe(0);
    });

    it("returns this for chaining", () => {
      const builder = new ContentStreamBuilder();
      const result = builder.addIf(true, pushGraphicsState());
      expect(result).toBe(builder);
    });
  });

  describe("getOperators()", () => {
    it("returns copy of operators", () => {
      const builder = ContentStreamBuilder.from([pushGraphicsState(), popGraphicsState()]);
      const ops = builder.getOperators();
      expect(ops.length).toBe(2);

      // Verify it's a copy
      ops.push(stroke());
      expect(builder.length).toBe(2);
    });
  });

  describe("toString()", () => {
    it("returns empty string for empty builder", () => {
      const builder = new ContentStreamBuilder();
      expect(builder.toString()).toBe("");
    });

    it("serializes single operator", () => {
      const builder = ContentStreamBuilder.from([pushGraphicsState()]);
      expect(builder.toString()).toBe("q\n");
    });

    it("joins multiple operators with newlines", () => {
      const builder = ContentStreamBuilder.from([
        pushGraphicsState(),
        setLineWidth(2),
        popGraphicsState(),
      ]);
      expect(builder.toString()).toBe("q\n2 w\nQ\n");
    });

    it("serializes complex content stream", () => {
      const builder = new ContentStreamBuilder()
        .add(pushGraphicsState())
        .add(setLineWidth(2))
        .add(setNonStrokingRGB(1, 0, 0))
        .add(moveTo(100, 100))
        .add(lineTo(200, 100))
        .add(lineTo(200, 200))
        .add(lineTo(100, 200))
        .add(closePath())
        .add(stroke())
        .add(popGraphicsState());

      const expected = [
        "q",
        "2 w",
        "1 0 0 rg",
        "100 100 m",
        "200 100 l",
        "200 200 l",
        "100 200 l",
        "h",
        "S",
        "Q",
        "", // trailing newline
      ].join("\n");

      expect(builder.toString()).toBe(expected);
    });
  });

  describe("toBytes()", () => {
    it("returns UTF-8 encoded bytes", () => {
      const builder = ContentStreamBuilder.from([pushGraphicsState(), popGraphicsState()]);
      const bytes = builder.toBytes();
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(new TextDecoder().decode(bytes)).toBe("q\nQ\n");
    });
  });

  describe("toStream()", () => {
    it("creates PdfStream with content", () => {
      const builder = ContentStreamBuilder.from([pushGraphicsState(), popGraphicsState()]);
      const stream = builder.toStream();

      expect(stream.type).toBe("stream");
      expect(stream.get("Length")).toEqual(PdfNumber.of(4)); // "q\nQ\n"
      expect(new TextDecoder().decode(stream.data)).toBe("q\nQ\n");
    });

    it("merges with base dict", () => {
      const baseDict = new PdfDict();
      baseDict.set("CustomKey", PdfName.of("CustomValue"));

      const builder = ContentStreamBuilder.from([pushGraphicsState()]);
      const stream = builder.toStream(baseDict);

      expect(stream.get("CustomKey")).toEqual(PdfName.of("CustomValue"));
      expect(stream.get("Length")).toEqual(PdfNumber.of(2)); // "q\n"
    });

    it("does not modify base dict", () => {
      const baseDict = new PdfDict();
      baseDict.set("CustomKey", PdfName.of("CustomValue"));

      const builder = ContentStreamBuilder.from([pushGraphicsState()]);
      builder.toStream(baseDict);

      expect(baseDict.has("Length")).toBe(false);
    });
  });

  describe("toFormXObject()", () => {
    it("creates Form XObject with required entries", () => {
      const builder = ContentStreamBuilder.from([pushGraphicsState(), popGraphicsState()]);
      const stream = builder.toFormXObject([0, 0, 100, 50]);

      expect(stream.get("Type")).toEqual(PdfName.of("XObject"));
      expect(stream.get("Subtype")).toEqual(PdfName.of("Form"));

      const bbox = stream.getArray("BBox");
      expect(bbox).toBeDefined();
      expect(bbox?.at(0)).toEqual(PdfNumber.of(0));
      expect(bbox?.at(1)).toEqual(PdfNumber.of(0));
      expect(bbox?.at(2)).toEqual(PdfNumber.of(100));
      expect(bbox?.at(3)).toEqual(PdfNumber.of(50));

      expect(stream.get("Length")).toEqual(PdfNumber.of(4)); // "q\nQ\n"
    });

    it("includes resources when provided", () => {
      const resources = new PdfDict();
      resources.set("Font", PdfDict.of({ F1: PdfName.of("Helvetica") }));

      const builder = ContentStreamBuilder.from([pushGraphicsState()]);
      const stream = builder.toFormXObject([0, 0, 200, 100], resources);

      expect(stream.get("Resources")).toBe(resources);
    });

    it("does not include resources when not provided", () => {
      const builder = ContentStreamBuilder.from([pushGraphicsState()]);
      const stream = builder.toFormXObject([0, 0, 200, 100]);

      expect(stream.has("Resources")).toBe(false);
    });
  });

  describe("usage examples", () => {
    it("builds path drawing content", () => {
      const content = new ContentStreamBuilder()
        .add(pushGraphicsState())
        .add(setLineWidth(2))
        .add(setNonStrokingRGB(1, 0, 0))
        .add(moveTo(100, 100))
        .add(lineTo(200, 100))
        .add(lineTo(200, 200))
        .add(lineTo(100, 200))
        .add(closePath())
        .add(stroke())
        .add(popGraphicsState());

      expect(content.toString()).toContain("q");
      expect(content.toString()).toContain("2 w");
      expect(content.toString()).toContain("1 0 0 rg");
      expect(content.toString()).toContain("S");
      expect(content.toString()).toContain("Q");
    });

    it("builds content with conditional operators", () => {
      const hasFill = true;
      const hasStroke = false;

      const ops = [pushGraphicsState()];

      if (hasFill) {
        ops.push(setNonStrokingRGB(1, 0, 0));
      }

      ops.push(moveTo(10, 10), lineTo(100, 10), lineTo(100, 50), closePath());

      if (hasStroke) {
        ops.push(stroke());
      }

      ops.push(popGraphicsState());

      const content = ContentStreamBuilder.from(ops);
      expect(content.toString()).toContain("1 0 0 rg");
      expect(content.toString()).not.toContain("S");
    });
  });
});
