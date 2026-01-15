import { describe, expect, it } from "vitest";

import { parseToUnicode, ToUnicodeMap } from "./to-unicode";

/**
 * Helper to create a ToUnicode CMap string.
 */
function makeCMap(content: string): Uint8Array {
  const cmap = `/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo <<
  /Registry (Adobe)
  /Ordering (UCS)
  /Supplement 0
>> def
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
${content}
endcmap
CMapName currentdict /CMap defineresource pop
end
end`;

  return new TextEncoder().encode(cmap);
}

describe("ToUnicodeMap", () => {
  it("should get and set mappings", () => {
    const map = new ToUnicodeMap();

    map.set(0x41, "A");
    map.set(0x42, "B");

    expect(map.get(0x41)).toBe("A");
    expect(map.get(0x42)).toBe("B");
    expect(map.get(0x43)).toBeUndefined();
  });

  it("should check if mapping exists", () => {
    const map = new ToUnicodeMap();

    map.set(0x41, "A");

    expect(map.has(0x41)).toBe(true);
    expect(map.has(0x42)).toBe(false);
  });

  it("should report size", () => {
    const map = new ToUnicodeMap();

    expect(map.size).toBe(0);

    map.set(0x41, "A");

    expect(map.size).toBe(1);
  });

  it("should iterate with forEach", () => {
    const map = new ToUnicodeMap();
    map.set(0x41, "A");
    map.set(0x42, "B");

    const entries: [string, number][] = [];
    map.forEach((unicode, code) => {
      entries.push([unicode, code]);
    });

    expect(entries).toEqual([
      ["A", 0x41],
      ["B", 0x42],
    ]);
  });
});

describe("parseToUnicode", () => {
  describe("bfchar sections", () => {
    it("should parse simple bfchar mappings", () => {
      const cmap = makeCMap(`
1 beginbfchar
<0041> <0041>
endbfchar
`);

      const map = parseToUnicode(cmap);

      expect(map.get(0x41)).toBe("A");
    });

    it("should parse multiple bfchar entries", () => {
      const cmap = makeCMap(`
3 beginbfchar
<0001> <0041>
<0002> <0042>
<0003> <0043>
endbfchar
`);

      const map = parseToUnicode(cmap);

      expect(map.get(0x01)).toBe("A");
      expect(map.get(0x02)).toBe("B");
      expect(map.get(0x03)).toBe("C");
    });

    it("should parse multiple bfchar sections", () => {
      const cmap = makeCMap(`
1 beginbfchar
<0001> <0041>
endbfchar
1 beginbfchar
<0002> <0042>
endbfchar
`);

      const map = parseToUnicode(cmap);

      expect(map.get(0x01)).toBe("A");
      expect(map.get(0x02)).toBe("B");
    });

    it("should parse 2-byte source codes", () => {
      const cmap = makeCMap(`
1 beginbfchar
<0100> <0041>
endbfchar
`);

      const map = parseToUnicode(cmap);

      expect(map.get(0x0100)).toBe("A");
    });

    it("should parse multi-character destinations (ligatures)", () => {
      const cmap = makeCMap(`
1 beginbfchar
<FB00> <00660066>
endbfchar
`);

      const map = parseToUnicode(cmap);

      // FB00 is the "ff" ligature, maps to two "f" characters
      expect(map.get(0xfb00)).toBe("ff");
    });

    it("should parse surrogate pairs", () => {
      const cmap = makeCMap(`
1 beginbfchar
<0001> <D835DC00>
endbfchar
`);

      const map = parseToUnicode(cmap);

      // D835 DC00 is surrogate pair for U+1D400 (Mathematical Bold Capital A)
      expect(map.get(0x01)).toBe("\uD835\uDC00");
    });
  });

  describe("bfrange sections", () => {
    it("should parse simple bfrange with incrementing values", () => {
      const cmap = makeCMap(`
1 beginbfrange
<0001> <0003> <0041>
endbfrange
`);

      const map = parseToUnicode(cmap);

      expect(map.get(0x01)).toBe("A");
      expect(map.get(0x02)).toBe("B");
      expect(map.get(0x03)).toBe("C");
    });

    it("should parse multiple bfrange entries", () => {
      const cmap = makeCMap(`
2 beginbfrange
<0001> <0003> <0041>
<0010> <0012> <0061>
endbfrange
`);

      const map = parseToUnicode(cmap);

      expect(map.get(0x01)).toBe("A");
      expect(map.get(0x02)).toBe("B");
      expect(map.get(0x03)).toBe("C");
      expect(map.get(0x10)).toBe("a");
      expect(map.get(0x11)).toBe("b");
      expect(map.get(0x12)).toBe("c");
    });

    it("should parse bfrange with array of destinations", () => {
      const cmap = makeCMap(`
1 beginbfrange
<0001> <0003> [<0058> <0059> <005A>]
endbfrange
`);

      const map = parseToUnicode(cmap);

      expect(map.get(0x01)).toBe("X");
      expect(map.get(0x02)).toBe("Y");
      expect(map.get(0x03)).toBe("Z");
    });

    it("should handle overflow in incrementing range", () => {
      const cmap = makeCMap(`
1 beginbfrange
<0001> <0003> <00FE>
endbfrange
`);

      const map = parseToUnicode(cmap);

      // FE, FF, 100 (overflow continues to next code unit)
      expect(map.get(0x01)).toBe("\u00FE");
      expect(map.get(0x02)).toBe("\u00FF");
      expect(map.get(0x03)).toBe("\u0100");
    });

    it("should handle 2-byte incrementing range", () => {
      const cmap = makeCMap(`
1 beginbfrange
<0001> <0003> <4E00>
endbfrange
`);

      const map = parseToUnicode(cmap);

      // CJK characters
      expect(map.get(0x01)).toBe("\u4E00");
      expect(map.get(0x02)).toBe("\u4E01");
      expect(map.get(0x03)).toBe("\u4E02");
    });
  });

  describe("combined sections", () => {
    it("should parse both bfchar and bfrange", () => {
      const cmap = makeCMap(`
2 beginbfchar
<0020> <0020>
<002E> <002E>
endbfchar
1 beginbfrange
<0041> <0043> <0041>
endbfrange
`);

      const map = parseToUnicode(cmap);

      expect(map.get(0x20)).toBe(" ");
      expect(map.get(0x2e)).toBe(".");
      expect(map.get(0x41)).toBe("A");
      expect(map.get(0x42)).toBe("B");
      expect(map.get(0x43)).toBe("C");
    });
  });

  describe("edge cases", () => {
    it("should handle empty CMap", () => {
      const cmap = makeCMap("");
      const map = parseToUnicode(cmap);

      expect(map.size).toBe(0);
    });

    it("should handle single character range", () => {
      const cmap = makeCMap(`
1 beginbfrange
<0001> <0001> <0041>
endbfrange
`);

      const map = parseToUnicode(cmap);

      expect(map.get(0x01)).toBe("A");
      expect(map.size).toBe(1);
    });

    it("should handle lowercase hex", () => {
      const cmap = makeCMap(`
1 beginbfchar
<00ff> <00ff>
endbfchar
`);

      const map = parseToUnicode(cmap);

      expect(map.get(0xff)).toBe("\u00FF");
    });

    it("should handle mixed case hex", () => {
      const cmap = makeCMap(`
1 beginbfchar
<00Ff> <00fF>
endbfchar
`);

      const map = parseToUnicode(cmap);

      expect(map.get(0xff)).toBe("\u00FF");
    });
  });
});
