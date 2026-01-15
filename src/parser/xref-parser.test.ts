import { Scanner } from "#src/io/scanner";
import { describe, expect, it } from "vitest";

import { XRefParser } from "./xref-parser";

/**
 * Helper to create an XRefParser from a string.
 */
function parser(input: string): XRefParser {
  const bytes = new TextEncoder().encode(input);
  const scanner = new Scanner(bytes);

  return new XRefParser(scanner);
}

describe("XRefParser", () => {
  describe("parseTable", () => {
    it("parses minimal xref with single free entry", () => {
      const p = parser(`xref
0 1
0000000000 65535 f
trailer
<< /Size 1 /Root 1 0 R >>
`);
      const result = p.parseTable();

      expect(result.entries.size).toBe(1);

      const entry0 = result.entries.get(0);
      expect(entry0).toBeDefined();
      expect(entry0!.type).toBe("free");
      if (entry0!.type === "free") {
        expect(entry0!.nextFree).toBe(0);
        expect(entry0!.generation).toBe(65535);
      }
    });

    it("parses xref with multiple in-use entries", () => {
      const p = parser(`xref
0 4
0000000000 65535 f
0000000015 00000 n
0000000074 00000 n
0000000120 00000 n
trailer
<< /Size 4 /Root 1 0 R >>
`);
      const result = p.parseTable();

      expect(result.entries.size).toBe(4);

      // Object 0 is free
      const entry0 = result.entries.get(0);
      expect(entry0!.type).toBe("free");

      // Objects 1-3 are in-use
      const entry1 = result.entries.get(1);
      expect(entry1!.type).toBe("uncompressed");
      if (entry1!.type === "uncompressed") {
        expect(entry1!.offset).toBe(15);
        expect(entry1!.generation).toBe(0);
      }

      const entry2 = result.entries.get(2);
      expect(entry2!.type).toBe("uncompressed");
      if (entry2!.type === "uncompressed") {
        expect(entry2!.offset).toBe(74);
      }

      const entry3 = result.entries.get(3);
      expect(entry3!.type).toBe("uncompressed");
      if (entry3!.type === "uncompressed") {
        expect(entry3!.offset).toBe(120);
      }
    });

    it("parses xref with multiple subsections", () => {
      const p = parser(`xref
0 2
0000000000 65535 f
0000000015 00000 n
5 2
0000000200 00000 n
0000000300 00000 n
trailer
<< /Size 7 /Root 1 0 R >>
`);
      const result = p.parseTable();

      expect(result.entries.size).toBe(4);

      // First subsection: objects 0-1
      expect(result.entries.get(0)!.type).toBe("free");
      expect(result.entries.get(1)!.type).toBe("uncompressed");

      // Second subsection: objects 5-6 (gap at 2-4)
      expect(result.entries.has(2)).toBe(false);
      expect(result.entries.has(3)).toBe(false);
      expect(result.entries.has(4)).toBe(false);

      const entry5 = result.entries.get(5);
      expect(entry5!.type).toBe("uncompressed");
      if (entry5!.type === "uncompressed") {
        expect(entry5!.offset).toBe(200);
      }

      const entry6 = result.entries.get(6);
      expect(entry6!.type).toBe("uncompressed");
      if (entry6!.type === "uncompressed") {
        expect(entry6!.offset).toBe(300);
      }
    });

    it("parses large offsets correctly", () => {
      const p = parser(`xref
0 2
0000000000 65535 f
9999999999 00000 n
trailer
<< /Size 2 /Root 1 0 R >>
`);
      const result = p.parseTable();

      const entry1 = result.entries.get(1);
      expect(entry1!.type).toBe("uncompressed");
      if (entry1!.type === "uncompressed") {
        expect(entry1!.offset).toBe(9999999999);
      }
    });

    it("parses free entry chain", () => {
      const p = parser(`xref
0 4
0000000003 65535 f
0000000000 00001 f
0000000100 00000 n
0000000001 00002 f
trailer
<< /Size 4 /Root 2 0 R >>
`);
      const result = p.parseTable();

      // Free list: 0 -> 3 -> 1 -> 0 (circular)
      const entry0 = result.entries.get(0);
      expect(entry0!.type).toBe("free");
      if (entry0!.type === "free") {
        expect(entry0!.nextFree).toBe(3);
        expect(entry0!.generation).toBe(65535);
      }

      const entry1 = result.entries.get(1);
      expect(entry1!.type).toBe("free");
      if (entry1!.type === "free") {
        expect(entry1!.nextFree).toBe(0);
        expect(entry1!.generation).toBe(1);
      }

      const entry3 = result.entries.get(3);
      expect(entry3!.type).toBe("free");
      if (entry3!.type === "free") {
        expect(entry3!.nextFree).toBe(1);
        expect(entry3!.generation).toBe(2);
      }
    });

    it("handles CRLF line endings", () => {
      const p = parser(
        "xref\r\n0 2\r\n0000000000 65535 f\r\n0000000015 00000 n\r\ntrailer\r\n<< /Size 2 /Root 1 0 R >>\r\n",
      );
      const result = p.parseTable();

      expect(result.entries.size).toBe(2);
    });

    it("handles CR-only line endings", () => {
      const p = parser(
        "xref\r0 2\r0000000000 65535 f\r0000000015 00000 n\rtrailer\r<< /Size 2 /Root 1 0 R >>\r",
      );
      const result = p.parseTable();

      expect(result.entries.size).toBe(2);
    });
  });

  describe("trailer parsing", () => {
    it("extracts /Size from trailer", () => {
      const p = parser(`xref
0 1
0000000000 65535 f
trailer
<< /Size 10 /Root 1 0 R >>
`);
      const result = p.parseTable();

      expect(result.trailer.getNumber("Size")?.value).toBe(10);
    });

    it("extracts /Root from trailer", () => {
      const p = parser(`xref
0 1
0000000000 65535 f
trailer
<< /Size 1 /Root 5 0 R >>
`);
      const result = p.parseTable();

      const root = result.trailer.getRef("Root");
      expect(root?.objectNumber).toBe(5);
      expect(root?.generation).toBe(0);
    });

    it("extracts /Prev from trailer for incremental updates", () => {
      const p = parser(`xref
0 1
0000000000 65535 f
trailer
<< /Size 10 /Root 1 0 R /Prev 500 >>
`);
      const result = p.parseTable();

      expect(result.prev).toBe(500);
    });

    it("returns undefined prev when no /Prev", () => {
      const p = parser(`xref
0 1
0000000000 65535 f
trailer
<< /Size 1 /Root 1 0 R >>
`);
      const result = p.parseTable();

      expect(result.prev).toBeUndefined();
    });

    it("extracts /Info reference from trailer", () => {
      const p = parser(`xref
0 1
0000000000 65535 f
trailer
<< /Size 1 /Root 1 0 R /Info 2 0 R >>
`);
      const result = p.parseTable();

      const info = result.trailer.getRef("Info");
      expect(info?.objectNumber).toBe(2);
    });

    it("extracts /ID array from trailer", () => {
      const p = parser(`xref
0 1
0000000000 65535 f
trailer
<< /Size 1 /Root 1 0 R /ID [<abc123> <def456>] >>
`);
      const result = p.parseTable();

      const id = result.trailer.getArray("ID");
      expect(id?.length).toBe(2);
    });
  });

  describe("parseAt", () => {
    it("auto-detects table format at offset", async () => {
      const input = `padding here
xref
0 1
0000000000 65535 f
trailer
<< /Size 1 /Root 1 0 R >>
`;
      const p = parser(input);
      const result = await p.parseAt(13); // offset to "xref"

      expect(result.entries.size).toBe(1);
    });

    it("throws for invalid format at offset", async () => {
      const p = parser("random garbage here");

      await expect(p.parseAt(0)).rejects.toThrow();
    });
  });

  describe("findStartXRef", () => {
    it("finds startxref offset from end of file", () => {
      const input = `%PDF-1.4
some content
xref
0 1
0000000000 65535 f
trailer
<< /Size 1 /Root 1 0 R >>
startxref
23
%%EOF`;
      const p = parser(input);
      const offset = p.findStartXRef();

      expect(offset).toBe(23);
    });

    it("handles startxref with CRLF", () => {
      const input = `%PDF-1.4\r\nstartxref\r\n100\r\n%%EOF`;
      const p = parser(input);
      const offset = p.findStartXRef();

      expect(offset).toBe(100);
    });

    it("throws if no startxref found", () => {
      const p = parser(`%PDF-1.4
some content without startxref
%%EOF`);

      expect(() => p.findStartXRef()).toThrow(/startxref/i);
    });
  });

  describe("lenient parsing", () => {
    it("accepts entries with extra whitespace", () => {
      // Some PDFs have irregular spacing
      const p = parser(`xref
0 2
0000000000 65535 f
0000000015  00000 n
trailer
<< /Size 2 /Root 1 0 R >>
`);
      const result = p.parseTable();

      expect(result.entries.size).toBe(2);
    });

    it("accepts entries without trailing space before EOL", () => {
      const p = parser(`xref
0 2
0000000000 65535 f
0000000015 00000 n
trailer
<< /Size 2 /Root 1 0 R >>
`);
      const result = p.parseTable();

      expect(result.entries.size).toBe(2);
    });
  });

  describe("parseStream", () => {
    /**
     * Helper to create an XRef stream with given entries.
     * Uses uncompressed stream for testing (no Filter).
     */
    function createXRefStream(
      entries: Array<{ objNum: number; type: 0 | 1 | 2; field2: number; field3: number }>,
      options: { w?: [number, number, number]; index?: number[] } = {},
    ): Uint8Array {
      const w = options.w ?? [1, 3, 2]; // Default: 1 byte type, 3 byte offset, 2 byte gen
      const [w1, w2, w3] = w;

      // Build index array from entries if not provided
      let indexArray = options.index;
      if (!indexArray) {
        // Simple case: contiguous from min to max
        const objNums = entries.map(e => e.objNum).sort((a, b) => a - b);
        const first = objNums[0];
        const count = objNums[objNums.length - 1] - first + 1;
        indexArray = [first, count];
      }

      // Build binary data
      const data: number[] = [];
      for (const entry of entries) {
        // Type field
        const type = entry.type;
        for (let i = w1 - 1; i >= 0; i--) {
          data.push((type >> (i * 8)) & 0xff);
        }
        // Field 2
        const f2 = entry.field2;
        for (let i = w2 - 1; i >= 0; i--) {
          data.push((f2 >> (i * 8)) & 0xff);
        }
        // Field 3
        const f3 = entry.field3;
        for (let i = w3 - 1; i >= 0; i--) {
          data.push((f3 >> (i * 8)) & 0xff);
        }
      }

      const streamData = new Uint8Array(data);

      // Build the object
      const size = Math.max(...entries.map(e => e.objNum)) + 1;
      const dictStr = `<< /Type /XRef /Size ${size} /W [${w.join(" ")}] /Index [${indexArray.join(" ")}] /Length ${streamData.length} /Root 1 0 R >>`;

      // Create full indirect object
      const header = new TextEncoder().encode(`99 0 obj\n${dictStr}\nstream\n`);
      const footer = new TextEncoder().encode(`\nendstream\nendobj\n`);

      const result = new Uint8Array(header.length + streamData.length + footer.length);
      result.set(header, 0);
      result.set(streamData, header.length);
      result.set(footer, header.length + streamData.length);

      return result;
    }

    it("parses xref stream with uncompressed entries", async () => {
      const bytes = createXRefStream([
        { objNum: 0, type: 0, field2: 0, field3: 65535 }, // free
        { objNum: 1, type: 1, field2: 100, field3: 0 }, // uncompressed at offset 100
        { objNum: 2, type: 1, field2: 200, field3: 0 }, // uncompressed at offset 200
      ]);

      const scanner = new Scanner(bytes);
      const p = new XRefParser(scanner);
      const result = await p.parseStream();

      expect(result.entries.size).toBe(3);

      const entry0 = result.entries.get(0);
      expect(entry0?.type).toBe("free");
      if (entry0?.type === "free") {
        expect(entry0.nextFree).toBe(0);
        expect(entry0.generation).toBe(65535);
      }

      const entry1 = result.entries.get(1);
      expect(entry1?.type).toBe("uncompressed");
      if (entry1?.type === "uncompressed") {
        expect(entry1.offset).toBe(100);
        expect(entry1.generation).toBe(0);
      }

      const entry2 = result.entries.get(2);
      expect(entry2?.type).toBe("uncompressed");
      if (entry2?.type === "uncompressed") {
        expect(entry2.offset).toBe(200);
      }
    });

    it("parses xref stream with compressed entries", async () => {
      const bytes = createXRefStream([
        { objNum: 0, type: 0, field2: 0, field3: 65535 }, // free
        { objNum: 1, type: 2, field2: 10, field3: 0 }, // compressed in obj stream 10, index 0
        { objNum: 2, type: 2, field2: 10, field3: 1 }, // compressed in obj stream 10, index 1
      ]);

      const scanner = new Scanner(bytes);
      const p = new XRefParser(scanner);
      const result = await p.parseStream();

      expect(result.entries.size).toBe(3);

      const entry1 = result.entries.get(1);
      expect(entry1?.type).toBe("compressed");
      if (entry1?.type === "compressed") {
        expect(entry1.streamObjNum).toBe(10);
        expect(entry1.indexInStream).toBe(0);
      }

      const entry2 = result.entries.get(2);
      expect(entry2?.type).toBe("compressed");
      if (entry2?.type === "compressed") {
        expect(entry2.streamObjNum).toBe(10);
        expect(entry2.indexInStream).toBe(1);
      }
    });

    it("parses xref stream with multiple index ranges", async () => {
      const bytes = createXRefStream(
        [
          { objNum: 0, type: 0, field2: 0, field3: 65535 },
          { objNum: 1, type: 1, field2: 100, field3: 0 },
          { objNum: 5, type: 1, field2: 500, field3: 0 },
          { objNum: 6, type: 1, field2: 600, field3: 0 },
        ],
        { index: [0, 2, 5, 2] }, // Two ranges: [0,1] and [5,6]
      );

      const scanner = new Scanner(bytes);
      const p = new XRefParser(scanner);
      const result = await p.parseStream();

      expect(result.entries.size).toBe(4);
      expect(result.entries.has(0)).toBe(true);
      expect(result.entries.has(1)).toBe(true);
      expect(result.entries.has(2)).toBe(false); // gap
      expect(result.entries.has(5)).toBe(true);
      expect(result.entries.has(6)).toBe(true);
    });

    it("uses larger field widths correctly", async () => {
      // Use 2-byte type, 4-byte offset, 2-byte generation
      const bytes = createXRefStream(
        [
          { objNum: 0, type: 0, field2: 0, field3: 65535 },
          { objNum: 1, type: 1, field2: 0x12345678, field3: 256 }, // Large offset
        ],
        { w: [2, 4, 2] },
      );

      const scanner = new Scanner(bytes);
      const p = new XRefParser(scanner);
      const result = await p.parseStream();

      const entry1 = result.entries.get(1);
      expect(entry1?.type).toBe("uncompressed");
      if (entry1?.type === "uncompressed") {
        expect(entry1.offset).toBe(0x12345678);
        expect(entry1.generation).toBe(256);
      }
    });

    it("defaults type to 1 when w1 is 0", async () => {
      // w1=0 means type field is absent, defaults to 1 (uncompressed)
      const _w: [number, number, number] = [0, 3, 1];

      // Build data manually since our helper expects type field
      const data = new Uint8Array([
        // Entry for obj 0: just offset (3 bytes) + gen (1 byte)
        0x00,
        0x00,
        0x64, // offset = 100
        0x00, // gen = 0
        // Entry for obj 1
        0x00,
        0x00,
        0xc8, // offset = 200
        0x00, // gen = 0
      ]);

      const dictStr = `<< /Type /XRef /Size 2 /W [0 3 1] /Length ${data.length} /Root 1 0 R >>`;
      const header = new TextEncoder().encode(`99 0 obj\n${dictStr}\nstream\n`);
      const footer = new TextEncoder().encode(`\nendstream\nendobj\n`);

      const bytes = new Uint8Array(header.length + data.length + footer.length);
      bytes.set(header, 0);
      bytes.set(data, header.length);
      bytes.set(footer, header.length + data.length);

      const scanner = new Scanner(bytes);
      const p = new XRefParser(scanner);
      const result = await p.parseStream();

      // Both entries should be type 1 (uncompressed)
      const entry0 = result.entries.get(0);
      expect(entry0?.type).toBe("uncompressed");
      if (entry0?.type === "uncompressed") {
        expect(entry0.offset).toBe(100);
      }

      const entry1 = result.entries.get(1);
      expect(entry1?.type).toBe("uncompressed");
      if (entry1?.type === "uncompressed") {
        expect(entry1.offset).toBe(200);
      }
    });

    it("extracts /Prev from xref stream", async () => {
      // Manually create stream with /Prev
      const data = new Uint8Array([
        0x00,
        0x00,
        0x00,
        0x00,
        0xff, // free, next=0, gen=255
      ]);

      const dictStr = `<< /Type /XRef /Size 1 /W [1 3 1] /Prev 12345 /Length ${data.length} /Root 1 0 R >>`;
      const header = new TextEncoder().encode(`99 0 obj\n${dictStr}\nstream\n`);
      const footer = new TextEncoder().encode(`\nendstream\nendobj\n`);

      const bytes = new Uint8Array(header.length + data.length + footer.length);
      bytes.set(header, 0);
      bytes.set(data, header.length);
      bytes.set(footer, header.length + data.length);

      const scanner = new Scanner(bytes);
      const p = new XRefParser(scanner);
      const result = await p.parseStream();

      expect(result.prev).toBe(12345);
    });

    it("parseAt auto-detects stream format", async () => {
      const bytes = createXRefStream([
        { objNum: 0, type: 0, field2: 0, field3: 65535 },
        { objNum: 1, type: 1, field2: 100, field3: 0 },
      ]);

      const scanner = new Scanner(bytes);
      const p = new XRefParser(scanner);
      const result = await p.parseAt(0);

      expect(result.entries.size).toBe(2);
    });
  });
});
