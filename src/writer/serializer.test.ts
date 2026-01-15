import { PdfArray } from "#src/objects/pdf-array";
import { PdfBool } from "#src/objects/pdf-bool";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNull } from "#src/objects/pdf-null";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfStream } from "#src/objects/pdf-stream";
import { PdfString } from "#src/objects/pdf-string";
import { describe, expect, it } from "vitest";

import { serializeIndirectObject, serializeObject } from "./serializer";

/**
 * Helper to convert serialized bytes to string for easier assertions.
 */
function serialize(obj: Parameters<typeof serializeObject>[0]): string {
  return new TextDecoder().decode(serializeObject(obj));
}

describe("serializeObject", () => {
  describe("PdfNull", () => {
    it("serializes to 'null'", () => {
      expect(serialize(PdfNull.instance)).toBe("null");
    });
  });

  describe("PdfBool", () => {
    it("serializes true to 'true'", () => {
      expect(serialize(PdfBool.TRUE)).toBe("true");
    });

    it("serializes false to 'false'", () => {
      expect(serialize(PdfBool.FALSE)).toBe("false");
    });
  });

  describe("PdfNumber", () => {
    it("serializes integer without decimal", () => {
      expect(serialize(PdfNumber.of(42))).toBe("42");
    });

    it("serializes negative integer", () => {
      expect(serialize(PdfNumber.of(-17))).toBe("-17");
    });

    it("serializes zero", () => {
      expect(serialize(PdfNumber.of(0))).toBe("0");
    });

    it("serializes real with minimal precision", () => {
      expect(serialize(PdfNumber.of(3.14))).toBe("3.14");
    });

    it("serializes real without trailing zeros", () => {
      expect(serialize(PdfNumber.of(2.5))).toBe("2.5");
    });

    it("serializes very small real", () => {
      expect(serialize(PdfNumber.of(0.001))).toBe("0.001");
    });

    it("serializes negative real", () => {
      expect(serialize(PdfNumber.of(-0.5))).toBe("-0.5");
    });
  });

  describe("PdfName", () => {
    it("serializes with / prefix", () => {
      expect(serialize(PdfName.of("Type"))).toBe("/Type");
    });

    it("serializes common names", () => {
      expect(serialize(PdfName.Page)).toBe("/Page");
      expect(serialize(PdfName.Catalog)).toBe("/Catalog");
      expect(serialize(PdfName.FlateDecode)).toBe("/FlateDecode");
    });

    it("escapes space with #20", () => {
      expect(serialize(PdfName.of("My Name"))).toBe("/My#20Name");
    });

    it("escapes # character", () => {
      expect(serialize(PdfName.of("Sharp#"))).toBe("/Sharp#23");
    });

    it("escapes parentheses", () => {
      expect(serialize(PdfName.of("(test)"))).toBe("/#28test#29");
    });

    it("escapes angle brackets", () => {
      expect(serialize(PdfName.of("<>"))).toBe("/#3C#3E");
    });

    it("escapes slash", () => {
      expect(serialize(PdfName.of("a/b"))).toBe("/a#2Fb");
    });

    it("escapes percent", () => {
      expect(serialize(PdfName.of("100%"))).toBe("/100#25");
    });

    it("escapes null byte", () => {
      expect(serialize(PdfName.of("\x00"))).toBe("/#00");
    });
  });

  describe("PdfString", () => {
    describe("literal format", () => {
      it("serializes simple string", () => {
        expect(serialize(PdfString.fromString("Hello"))).toBe("(Hello)");
      });

      it("escapes backslash", () => {
        expect(serialize(PdfString.fromString("a\\b"))).toBe("(a\\\\b)");
      });

      it("escapes parentheses", () => {
        expect(serialize(PdfString.fromString("(test)"))).toBe("(\\(test\\))");
      });

      it("preserves binary data", () => {
        const bytes = new Uint8Array([0x00, 0x01, 0xff]);
        const str = new PdfString(bytes, "literal");
        const result = serializeObject(str);

        // Should be: ( + 0x00 + 0x01 + 0xff + )
        expect(result).toEqual(new Uint8Array([0x28, 0x00, 0x01, 0xff, 0x29]));
      });
    });

    describe("hex format", () => {
      it("serializes as hex string", () => {
        expect(serialize(PdfString.fromHex("48656C6C6F"))).toBe("<48656C6C6F>");
      });

      it("uses uppercase hex", () => {
        const str = new PdfString(new Uint8Array([0xab, 0xcd]), "hex");

        expect(serialize(str)).toBe("<ABCD>");
      });

      it("serializes empty hex string", () => {
        const str = new PdfString(new Uint8Array([]), "hex");

        expect(serialize(str)).toBe("<>");
      });
    });
  });

  describe("PdfRef", () => {
    it("serializes as N G R format", () => {
      expect(serialize(PdfRef.of(1, 0))).toBe("1 0 R");
    });

    it("serializes with non-zero generation", () => {
      expect(serialize(PdfRef.of(42, 5))).toBe("42 5 R");
    });
  });

  describe("PdfArray", () => {
    it("serializes empty array", () => {
      expect(serialize(new PdfArray())).toBe("[]");
    });

    it("serializes array with items", () => {
      const arr = PdfArray.of(PdfNumber.of(1), PdfNumber.of(2), PdfNumber.of(3));

      expect(serialize(arr)).toBe("[1 2 3]");
    });

    it("serializes mixed types", () => {
      const arr = PdfArray.of(PdfNumber.of(42), PdfName.of("Type"), PdfBool.TRUE, PdfNull.instance);

      expect(serialize(arr)).toBe("[42 /Type true null]");
    });

    it("serializes nested arrays", () => {
      const inner = PdfArray.of(PdfNumber.of(1), PdfNumber.of(2));
      const outer = PdfArray.of(inner, PdfNumber.of(3));

      expect(serialize(outer)).toBe("[[1 2] 3]");
    });

    it("serializes array with refs", () => {
      const arr = PdfArray.of(PdfRef.of(1, 0), PdfRef.of(2, 0));

      expect(serialize(arr)).toBe("[1 0 R 2 0 R]");
    });
  });

  describe("PdfDict", () => {
    it("serializes empty dict", () => {
      expect(serialize(new PdfDict())).toBe("<<\n>>");
    });

    it("serializes dict with entries", () => {
      const dict = PdfDict.of({
        Type: PdfName.Page,
        Count: PdfNumber.of(5),
      });

      const result = serialize(dict);

      // Order might vary, so check for containment
      expect(result).toContain("/Type /Page");
      expect(result).toContain("/Count 5");
      expect(result.startsWith("<<")).toBe(true);
      expect(result.endsWith(">>")).toBe(true);
    });

    it("serializes nested dicts", () => {
      const inner = PdfDict.of({ Value: PdfNumber.of(42) });
      const outer = PdfDict.of({ Nested: inner });

      const result = serialize(outer);

      expect(result).toContain("/Nested <<\n/Value 42\n>>");
    });

    it("serializes dict with array value", () => {
      const arr = PdfArray.of(
        PdfNumber.of(0),
        PdfNumber.of(0),
        PdfNumber.of(612),
        PdfNumber.of(792),
      );
      const dict = PdfDict.of({ MediaBox: arr });

      expect(serialize(dict)).toBe("<<\n/MediaBox [0 0 612 792]\n>>");
    });

    it("serializes dict with ref value", () => {
      const dict = PdfDict.of({ Parent: PdfRef.of(1, 0) });

      expect(serialize(dict)).toBe("<<\n/Parent 1 0 R\n>>");
    });
  });

  describe("PdfStream", () => {
    it("serializes stream with data", () => {
      const stream = new PdfStream([], new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]));
      const result = serialize(stream);

      expect(result).toContain("<<");
      expect(result).toContain("/Length 5");
      expect(result).toContain(">>");
      expect(result).toContain("stream\n");
      expect(result).toContain("Hello");
      expect(result).toContain("\nendstream");
    });

    it("serializes stream with dict entries", () => {
      const stream = new PdfStream([["Filter", PdfName.FlateDecode]], new Uint8Array([1, 2, 3]));
      const result = serialize(stream);

      expect(result).toContain("/Length 3");
      expect(result).toContain("/Filter /FlateDecode");
    });

    it("updates Length to actual data length", () => {
      // Create stream with wrong Length in dict
      const stream = PdfStream.fromDict(
        { Length: PdfNumber.of(999) },
        new Uint8Array([1, 2, 3, 4, 5]),
      );
      const result = serialize(stream);

      // Serializer should use actual length (5), not the dict value (999)
      expect(result).toContain("/Length 5");
      expect(result).not.toContain("/Length 999");
    });

    it("preserves binary data", () => {
      const data = new Uint8Array([0x00, 0x01, 0xff, 0x80]);
      const stream = new PdfStream([], data);
      const result = serializeObject(stream);

      // Find the stream content between "stream\n" and "\nendstream"
      const decoder = new TextDecoder();
      const text = decoder.decode(result);
      const streamStart = text.indexOf("stream\n") + 7;
      const streamEnd = text.indexOf("\nendstream");

      // Extract the raw bytes from the result
      const streamBytes = result.slice(streamStart, streamEnd);

      expect(streamBytes).toEqual(data);
    });
  });

  describe("nested structures", () => {
    it("serializes dict containing array containing dict", () => {
      const innerDict = PdfDict.of({ Value: PdfNumber.of(1) });
      const arr = PdfArray.of(innerDict, PdfNumber.of(2));
      const outerDict = PdfDict.of({ Items: arr });

      const result = serialize(outerDict);

      expect(result).toBe("<<\n/Items [<<\n/Value 1\n>> 2]\n>>");
    });
  });
});

describe("serializeIndirectObject", () => {
  it("wraps object in obj...endobj", () => {
    const ref = PdfRef.of(1, 0);
    const obj = PdfNumber.of(42);
    const result = new TextDecoder().decode(serializeIndirectObject(ref, obj));

    expect(result).toBe("1 0 obj\n42\nendobj\n");
  });

  it("serializes indirect dict", () => {
    const ref = PdfRef.of(5, 0);
    const dict = PdfDict.of({ Type: PdfName.Page });
    const result = new TextDecoder().decode(serializeIndirectObject(ref, dict));

    expect(result).toBe("5 0 obj\n<<\n/Type /Page\n>>\nendobj\n");
  });

  it("serializes indirect stream", () => {
    const ref = PdfRef.of(3, 0);
    const stream = new PdfStream([], new Uint8Array([1, 2, 3]));
    const result = new TextDecoder().decode(serializeIndirectObject(ref, stream));

    expect(result).toContain("3 0 obj\n");
    expect(result).toContain("/Length 3");
    expect(result).toContain("stream\n");
    expect(result).toContain("\nendstream");
    expect(result).toContain("\nendobj\n");
  });

  it("handles non-zero generation", () => {
    const ref = PdfRef.of(10, 2);
    const obj = PdfNull.instance;
    const result = new TextDecoder().decode(serializeIndirectObject(ref, obj));

    expect(result).toBe("10 2 obj\nnull\nendobj\n");
  });
});
