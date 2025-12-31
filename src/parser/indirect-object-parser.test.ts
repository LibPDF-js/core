import { describe, expect, it } from "vitest";
import { Scanner } from "#src/io/scanner";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import type { PdfRef } from "#src/objects/pdf-ref";
import { PdfStream } from "#src/objects/pdf-stream";
import { PdfString } from "#src/objects/pdf-string";
import { IndirectObjectParser } from "./indirect-object-parser";

/**
 * Helper to create an IndirectObjectParser from a string.
 */
function parser(
  input: string,
  lengthResolver?: (ref: PdfRef) => number | null,
): IndirectObjectParser {
  const bytes = new TextEncoder().encode(input);
  const scanner = new Scanner(bytes);

  return new IndirectObjectParser(scanner, lengthResolver);
}

describe("IndirectObjectParser", () => {
  describe("standard objects", () => {
    it("parses simple dict object", () => {
      const p = parser(`1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj`);
      const result = p.parseObject();

      expect(result.objNum).toBe(1);
      expect(result.genNum).toBe(0);
      expect(result.value).toBeInstanceOf(PdfDict);

      const dict = result.value as PdfDict;
      expect(dict.getName("Type")?.value).toBe("Catalog");
      expect(dict.getRef("Pages")?.objectNumber).toBe(2);
    });

    it("parses array object", () => {
      const p = parser(`2 0 obj
[1 2 3 /Name]
endobj`);
      const result = p.parseObject();

      expect(result.objNum).toBe(2);
      expect(result.genNum).toBe(0);
      expect(result.value).toBeInstanceOf(PdfArray);

      const arr = result.value as PdfArray;
      expect(arr.length).toBe(4);
    });

    it("parses number object", () => {
      const p = parser(`3 0 obj
42
endobj`);
      const result = p.parseObject();

      expect(result.objNum).toBe(3);
      expect(result.value).toBeInstanceOf(PdfNumber);
      expect((result.value as PdfNumber).value).toBe(42);
    });

    it("parses string object", () => {
      const p = parser(`4 0 obj
(Hello World)
endobj`);
      const result = p.parseObject();

      expect(result.objNum).toBe(4);
      expect(result.value).toBeInstanceOf(PdfString);
      expect((result.value as PdfString).asString()).toBe("Hello World");
    });

    it("parses name object", () => {
      const p = parser(`5 0 obj
/SomeName
endobj`);
      const result = p.parseObject();

      expect(result.objNum).toBe(5);
      expect(result.value).toBe(PdfName.of("SomeName"));
    });

    it("parses object with non-zero generation", () => {
      const p = parser(`1 5 obj
<< /Updated true >>
endobj`);
      const result = p.parseObject();

      expect(result.objNum).toBe(1);
      expect(result.genNum).toBe(5);
    });

    it("parses nested dict object", () => {
      const p = parser(`1 0 obj
<< /Outer << /Inner 42 >> >>
endobj`);
      const result = p.parseObject();

      const dict = result.value as PdfDict;
      const inner = dict.getDict("Outer");
      expect(inner?.getNumber("Inner")?.value).toBe(42);
    });
  });

  describe("parseObjectAt", () => {
    it("parses object at specific offset", () => {
      const input = `some padding here
1 0 obj
<< /Type /Page >>
endobj`;
      const p = parser(input);
      const result = p.parseObjectAt(18); // offset to "1 0 obj"

      expect(result.objNum).toBe(1);
      expect(result.value).toBeInstanceOf(PdfDict);
    });
  });

  describe("stream objects", () => {
    it("parses stream with direct /Length", () => {
      const p = parser(`1 0 obj
<< /Length 5 >>
stream
Hello
endstream
endobj`);
      const result = p.parseObject();

      expect(result.value).toBeInstanceOf(PdfStream);

      const stream = result.value as PdfStream;
      // PdfStream extends PdfDict, so dict methods are on stream directly
      expect(stream.getNumber("Length")?.value).toBe(5);
      expect(stream.data.length).toBe(5);
      expect(new TextDecoder().decode(stream.data)).toBe("Hello");
    });

    it("parses stream with LF after stream keyword", () => {
      const input = "1 0 obj\n<< /Length 5 >>\nstream\nHello\nendstream\nendobj";
      const p = parser(input);
      const result = p.parseObject();

      const stream = result.value as PdfStream;
      expect(new TextDecoder().decode(stream.data)).toBe("Hello");
    });

    it("parses stream with CRLF after stream keyword", () => {
      const input = "1 0 obj\r\n<< /Length 5 >>\r\nstream\r\nHello\r\nendstream\r\nendobj";
      const p = parser(input);
      const result = p.parseObject();

      const stream = result.value as PdfStream;
      expect(new TextDecoder().decode(stream.data)).toBe("Hello");
    });

    it("parses empty stream", () => {
      const p = parser(`1 0 obj
<< /Length 0 >>
stream

endstream
endobj`);
      const result = p.parseObject();

      const stream = result.value as PdfStream;
      expect(stream.data.length).toBe(0);
    });

    it("parses stream with binary data", () => {
      // Create binary content
      const binaryContent = new Uint8Array([0x00, 0x01, 0x02, 0xff, 0xfe]);
      const prefix = new TextEncoder().encode("1 0 obj\n<< /Length 5 >>\nstream\n");
      const suffix = new TextEncoder().encode("\nendstream\nendobj");

      const fullBytes = new Uint8Array(prefix.length + binaryContent.length + suffix.length);
      fullBytes.set(prefix, 0);
      fullBytes.set(binaryContent, prefix.length);
      fullBytes.set(suffix, prefix.length + binaryContent.length);

      const scanner = new Scanner(fullBytes);
      const p = new IndirectObjectParser(scanner);
      const result = p.parseObject();

      const stream = result.value as PdfStream;
      expect(stream.data.length).toBe(5);
      expect(stream.data[0]).toBe(0x00);
      expect(stream.data[3]).toBe(0xff);
    });

    it("parses stream with indirect /Length reference", () => {
      // Simulate: /Length points to object 2 which contains 5
      const lengthResolver = (ref: PdfRef): number | null => {
        if (ref.objectNumber === 2 && ref.generation === 0) {
          return 5;
        }
        return null;
      };

      const p = parser(
        `1 0 obj
<< /Length 2 0 R >>
stream
Hello
endstream
endobj`,
        lengthResolver,
      );
      const result = p.parseObject();

      const stream = result.value as PdfStream;
      expect(new TextDecoder().decode(stream.data)).toBe("Hello");
    });

    it("throws if indirect /Length cannot be resolved", () => {
      const p = parser(`1 0 obj
<< /Length 99 0 R >>
stream
Hello
endstream
endobj`);

      expect(() => p.parseObject()).toThrow(/resolve.*length/i);
    });

    it("preserves stream dict entries", () => {
      const p = parser(`1 0 obj
<< /Length 5 /Filter /FlateDecode /DecodeParms << /Columns 4 >> >>
stream
Hello
endstream
endobj`);
      const result = p.parseObject();

      const stream = result.value as PdfStream;
      // PdfStream extends PdfDict, so dict methods are on stream directly
      expect(stream.getName("Filter")?.value).toBe("FlateDecode");
      expect(stream.getDict("DecodeParms")).toBeDefined();
    });
  });

  describe("lenient parsing", () => {
    it("handles extra whitespace before obj keyword", () => {
      const p = parser(`1  0  obj
<< /Type /Page >>
endobj`);
      const result = p.parseObject();

      expect(result.objNum).toBe(1);
    });

    it("handles missing final newline", () => {
      const p = parser(`1 0 obj
<< /Type /Page >>
endobj`);
      const result = p.parseObject();

      expect(result.value).toBeInstanceOf(PdfDict);
    });
  });

  describe("error cases", () => {
    it("throws on invalid object header", () => {
      const p = parser(`abc 0 obj
<< /Type /Page >>
endobj`);

      expect(() => p.parseObject()).toThrow();
    });

    it("throws on missing obj keyword", () => {
      const p = parser(`1 0
<< /Type /Page >>
endobj`);

      expect(() => p.parseObject()).toThrow(/obj/i);
    });

    it("throws on missing /Length in stream", () => {
      const p = parser(`1 0 obj
<< /Type /XObject >>
stream
data
endstream
endobj`);

      expect(() => p.parseObject()).toThrow(/length/i);
    });
  });
});
