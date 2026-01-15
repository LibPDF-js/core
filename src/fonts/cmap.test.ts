import { describe, expect, it } from "vitest";

import { CMap, parseCMap } from "./cmap";

/**
 * Helper to create a CMap stream.
 */
function makeCMapStream(content: string): Uint8Array {
  const cmap = `%!PS-Adobe-3.0 Resource-CMap
%%DocumentNeededResources: ProcSet (CIDInit)
%%IncludeResource: ProcSet (CIDInit)
%%BeginResource: CMap (TestCMap)
%%Title: (TestCMap)
%%Version: 1
%%EndComments

/CIDInit /ProcSet findresource begin

12 dict begin

begincmap

/CIDSystemInfo 3 dict dup begin
  /Registry (Test) def
  /Ordering (Test) def
  /Supplement 0 def
end def

/CMapName /TestCMap def
/CMapType 1 def

${content}

endcmap
CMapName currentdict /CMap defineresource pop
end
end

%%EndResource
%%EOF`;

  return new TextEncoder().encode(cmap);
}

describe("CMap", () => {
  describe("Identity-H", () => {
    it("should be identity mapping", () => {
      const cmap = CMap.identityH();

      expect(cmap.isIdentity).toBe(true);
      expect(cmap.vertical).toBe(false);
      expect(cmap.name).toBe("Identity-H");
    });

    it("should lookup codes as-is", () => {
      const cmap = CMap.identityH();

      expect(cmap.lookup(0)).toBe(0);
      expect(cmap.lookup(1)).toBe(1);
      expect(cmap.lookup(0x4e00)).toBe(0x4e00);
      expect(cmap.lookup(0xffff)).toBe(0xffff);
    });

    it("should encode text to code points", () => {
      const cmap = CMap.identityH();
      const codes = cmap.encode("ABC");

      expect(codes).toEqual([0x41, 0x42, 0x43]);
    });

    it("should encode any Unicode text including emoji and rare CJK", () => {
      const cmap = CMap.identityH();

      expect(cmap.canEncode("Hello")).toBe(true);
      expect(cmap.canEncode("日本語")).toBe(true);
      // Emoji (U+1F389) is encoded as surrogate pair: 0xD83C 0xDF89
      expect(cmap.canEncode("🎉")).toBe(true);
      // CJK Extension B character (U+20000) is surrogate pair: 0xD840 0xDC00
      expect(cmap.canEncode("𠀀")).toBe(true);
      // Mixed content
      expect(cmap.canEncode("Hello 世界 🎉 𠀀")).toBe(true);
    });

    it("should read 2-byte character codes", () => {
      const cmap = CMap.identityH();
      const bytes = new Uint8Array([0x00, 0x41, 0x00, 0x42]);

      const first = cmap.readCharCode(bytes, 0);

      expect(first.code).toBe(0x41);
      expect(first.length).toBe(2);

      const second = cmap.readCharCode(bytes, 2);

      expect(second.code).toBe(0x42);
      expect(second.length).toBe(2);
    });
  });

  describe("Identity-V", () => {
    it("should be vertical identity mapping", () => {
      const cmap = CMap.identityV();

      expect(cmap.isIdentity).toBe(true);
      expect(cmap.vertical).toBe(true);
      expect(cmap.name).toBe("Identity-V");
    });
  });

  describe("getPredefined", () => {
    it("should return Identity-H", () => {
      const cmap = CMap.getPredefined("Identity-H");

      expect(cmap).not.toBeNull();
      expect(cmap?.isIdentity).toBe(true);
      expect(cmap?.name).toBe("Identity-H");
    });

    it("should return Identity-V", () => {
      const cmap = CMap.getPredefined("Identity-V");

      expect(cmap).not.toBeNull();
      expect(cmap?.vertical).toBe(true);
    });

    it("should return null for unknown CMap", () => {
      const cmap = CMap.getPredefined("Unknown-H");

      expect(cmap).toBeNull();
    });
  });

  describe("lookup", () => {
    it("should return 0 for unmapped codes", () => {
      const cmap = new CMap({ name: "Test" });

      expect(cmap.lookup(0x100)).toBe(0);
    });

    it("should find direct char mappings", () => {
      const cmap = new CMap({
        name: "Test",
        charMappings: new Map([
          [0x0001, 100],
          [0x0002, 200],
        ]),
      });

      expect(cmap.lookup(0x0001)).toBe(100);
      expect(cmap.lookup(0x0002)).toBe(200);
      expect(cmap.lookup(0x0003)).toBe(0);
    });

    it("should find range mappings", () => {
      const cmap = new CMap({
        name: "Test",
        rangeMappings: [{ start: 0x0100, end: 0x01ff, baseCID: 1000 }],
      });

      expect(cmap.lookup(0x0100)).toBe(1000);
      expect(cmap.lookup(0x0101)).toBe(1001);
      expect(cmap.lookup(0x01ff)).toBe(1255);
      expect(cmap.lookup(0x0200)).toBe(0);
    });

    it("should prefer direct mappings over ranges", () => {
      const cmap = new CMap({
        name: "Test",
        charMappings: new Map([[0x0105, 999]]),
        rangeMappings: [{ start: 0x0100, end: 0x01ff, baseCID: 1000 }],
      });

      expect(cmap.lookup(0x0105)).toBe(999);
      expect(cmap.lookup(0x0106)).toBe(1006);
    });
  });

  describe("canEncode (non-identity)", () => {
    it("should return true for codes with direct mappings", () => {
      const cmap = new CMap({
        name: "Test",
        codespaceRanges: [{ low: 0x0000, high: 0xffff, numBytes: 2 }],
        charMappings: new Map([
          [0x0041, 100], // 'A'
          [0x0042, 101], // 'B'
        ]),
      });

      expect(cmap.canEncode("A")).toBe(true);
      expect(cmap.canEncode("AB")).toBe(true);
    });

    it("should return true for codes within range mappings", () => {
      const cmap = new CMap({
        name: "Test",
        codespaceRanges: [{ low: 0x0000, high: 0xffff, numBytes: 2 }],
        rangeMappings: [{ start: 0x0041, end: 0x005a, baseCID: 100 }], // A-Z
      });

      expect(cmap.canEncode("A")).toBe(true);
      expect(cmap.canEncode("Z")).toBe(true);
      expect(cmap.canEncode("ABC")).toBe(true);
    });

    it("should return false for unmapped codes", () => {
      const cmap = new CMap({
        name: "Test",
        codespaceRanges: [{ low: 0x0000, high: 0xffff, numBytes: 2 }],
        charMappings: new Map([[0x0041, 100]]), // Only 'A'
      });

      expect(cmap.canEncode("B")).toBe(false);
      expect(cmap.canEncode("AB")).toBe(false);
    });

    it("should return false for codes outside codespace", () => {
      const cmap = new CMap({
        name: "Test",
        codespaceRanges: [{ low: 0x0000, high: 0x00ff, numBytes: 1 }],
        charMappings: new Map([[0x0041, 100]]),
      });

      // Code point 0x4E00 (Chinese character) is outside 0x00-0xFF codespace
      expect(cmap.canEncode("\u4E00")).toBe(false);
    });
  });
});

describe("parseCMap", () => {
  describe("codespace ranges", () => {
    it("should parse single codespace range", () => {
      const data = makeCMapStream(`
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
`);

      const cmap = parseCMap(data);
      const ranges = cmap.getCodespaceRanges();

      expect(ranges.length).toBe(1);
      expect(ranges[0].low).toBe(0x0000);
      expect(ranges[0].high).toBe(0xffff);
      expect(ranges[0].numBytes).toBe(2);
    });

    it("should parse multiple codespace ranges", () => {
      const data = makeCMapStream(`
2 begincodespacerange
<00> <7F>
<8000> <FFFF>
endcodespacerange
`);

      const cmap = parseCMap(data);
      const ranges = cmap.getCodespaceRanges();

      expect(ranges.length).toBe(2);
      expect(ranges[0].numBytes).toBe(1);
      expect(ranges[1].numBytes).toBe(2);
    });
  });

  describe("cidchar mappings", () => {
    it("should parse cidchar entries", () => {
      const data = makeCMapStream(`
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
3 begincidchar
<0001> 100
<0002> 200
<0003> 300
endcidchar
`);

      const cmap = parseCMap(data);

      expect(cmap.lookup(0x0001)).toBe(100);
      expect(cmap.lookup(0x0002)).toBe(200);
      expect(cmap.lookup(0x0003)).toBe(300);
    });
  });

  describe("cidrange mappings", () => {
    it("should parse cidrange entries", () => {
      const data = makeCMapStream(`
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
1 begincidrange
<0100> <01FF> 1000
endcidrange
`);

      const cmap = parseCMap(data);

      expect(cmap.lookup(0x0100)).toBe(1000);
      expect(cmap.lookup(0x0101)).toBe(1001);
      expect(cmap.lookup(0x01ff)).toBe(1255);
    });

    it("should parse multiple cidrange entries", () => {
      const data = makeCMapStream(`
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
2 begincidrange
<0100> <01FF> 1000
<0200> <02FF> 2000
endcidrange
`);

      const cmap = parseCMap(data);

      expect(cmap.lookup(0x0100)).toBe(1000);
      expect(cmap.lookup(0x0200)).toBe(2000);
    });
  });

  describe("CMap metadata", () => {
    it("should parse CMap name", () => {
      const data = makeCMapStream("");
      const cmap = parseCMap(data);

      expect(cmap.name).toBe("TestCMap");
    });

    it("should use provided name as fallback", () => {
      const data = new TextEncoder().encode("begincmap endcmap");
      const cmap = parseCMap(data, "FallbackName");

      expect(cmap.name).toBe("FallbackName");
    });

    it("should parse WMode for vertical", () => {
      const data = makeCMapStream("/WMode 1 def");
      const cmap = parseCMap(data);

      expect(cmap.vertical).toBe(true);
    });
  });
});
