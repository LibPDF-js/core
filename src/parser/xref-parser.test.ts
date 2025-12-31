import { describe, expect, it } from "vitest";
import { Scanner } from "#src/io/scanner";
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
    it("auto-detects table format at offset", () => {
      const input = `padding here
xref
0 1
0000000000 65535 f
trailer
<< /Size 1 /Root 1 0 R >>
`;
      const p = parser(input);
      const result = p.parseAt(13); // offset to "xref"

      expect(result.entries.size).toBe(1);
    });

    it("throws for invalid format at offset", () => {
      const p = parser("random garbage here");

      expect(() => p.parseAt(0)).toThrow();
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
});
