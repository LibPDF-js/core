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

const TWO_BYTE_CODESPACE = `
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
`;

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
      const cmap = parseCMap(makeCMapStream(TWO_BYTE_CODESPACE));

      expect(cmap.lookup(0x100)).toBe(0);
    });

    it("should find direct char mappings", () => {
      const cmap = parseCMap(
        makeCMapStream(`${TWO_BYTE_CODESPACE}
2 begincidchar
<0001> 100
<0002> 200
endcidchar
`),
      );

      expect(cmap.lookup(0x0001)).toBe(100);
      expect(cmap.lookup(0x0002)).toBe(200);
      expect(cmap.lookup(0x0003)).toBe(0);
    });

    it("should find range mappings", () => {
      const cmap = parseCMap(
        makeCMapStream(`${TWO_BYTE_CODESPACE}
1 begincidrange
<0100> <01FF> 1000
endcidrange
`),
      );

      expect(cmap.lookup(0x0100)).toBe(1000);
      expect(cmap.lookup(0x0101)).toBe(1001);
      expect(cmap.lookup(0x01ff)).toBe(1255);
      expect(cmap.lookup(0x0200)).toBe(0);
    });

    it("should prefer direct mappings over ranges", () => {
      const cmap = parseCMap(
        makeCMapStream(`${TWO_BYTE_CODESPACE}
1 begincidchar
<0105> 999
endcidchar
1 begincidrange
<0100> <01FF> 1000
endcidrange
`),
      );

      expect(cmap.lookup(0x0105)).toBe(999);
      expect(cmap.lookup(0x0106)).toBe(1006);
    });

    it("should distinguish codes by byte length when given", () => {
      const cmap = parseCMap(
        makeCMapStream(`
2 begincodespacerange
<00> <7F>
<8000> <FFFF>
endcodespacerange
2 begincidchar
<41> 1
<0041> 2
endcidchar
`),
      );

      expect(cmap.lookup(0x41, 1)).toBe(1);
      expect(cmap.lookup(0x41, 2)).toBe(2);
    });
  });

  describe("canEncode (non-identity)", () => {
    it("should return true for codes with direct mappings", () => {
      const cmap = parseCMap(
        makeCMapStream(`${TWO_BYTE_CODESPACE}
2 begincidchar
<0041> 100
<0042> 101
endcidchar
`),
      );

      expect(cmap.canEncode("A")).toBe(true);
      expect(cmap.canEncode("AB")).toBe(true);
    });

    it("should return true for codes within range mappings", () => {
      const cmap = parseCMap(
        makeCMapStream(`${TWO_BYTE_CODESPACE}
1 begincidrange
<0041> <005A> 100
endcidrange
`),
      );

      expect(cmap.canEncode("A")).toBe(true);
      expect(cmap.canEncode("Z")).toBe(true);
      expect(cmap.canEncode("ABC")).toBe(true);
    });

    it("should return false for unmapped codes", () => {
      const cmap = parseCMap(
        makeCMapStream(`${TWO_BYTE_CODESPACE}
1 begincidchar
<0041> 100
endcidchar
`),
      );

      expect(cmap.canEncode("B")).toBe(false);
      expect(cmap.canEncode("AB")).toBe(false);
    });
  });

  describe("readCharCode (non-identity)", () => {
    const shiftJis = parseCMap(
      makeCMapStream(`
2 begincodespacerange
<20> <7E>
<8140> <9FFC>
endcodespacerange
`),
    );

    it("reads mixed-width codes by codespace range", () => {
      const bytes = new Uint8Array([0x41, 0x81, 0x40, 0x20]);

      expect(shiftJis.readCharCode(bytes, 0)).toEqual({ code: 0x41, length: 1 });
      expect(shiftJis.readCharCode(bytes, 1)).toEqual({ code: 0x8140, length: 2 });
      expect(shiftJis.readCharCode(bytes, 3)).toEqual({ code: 0x20, length: 1 });
    });

    it("matches codespace ranges byte-wise, not by integer value", () => {
      const cmap = parseCMap(
        makeCMapStream(`
2 begincodespacerange
<8140> <9FFC>
<810000> <9FFFFF>
endcodespacerange
`),
      );

      // 0x8200 is inside 0x8140..0x9ffc numerically but 0x00 < 0x40
      expect(cmap.readCharCode(new Uint8Array([0x82, 0x00, 0x00]), 0)).toEqual({
        code: 0x820000,
        length: 3,
      });
      expect(cmap.readCharCode(new Uint8Array([0x81, 0x5f, 0x00]), 0)).toEqual({
        code: 0x815f,
        length: 2,
      });
    });

    it("consumes the shortest code length on invalid codes", () => {
      // 0x81 0x20: no 1-byte match, 0x20 < 0x40 so no 2-byte match
      const bytes = new Uint8Array([0x81, 0x20, 0x41]);

      expect(shiftJis.readCharCode(bytes, 0)).toEqual({ code: 0x81, length: 1 });
      expect(shiftJis.readCharCode(bytes, 1)).toEqual({ code: 0x20, length: 1 });
      expect(shiftJis.readCharCode(bytes, 2)).toEqual({ code: 0x41, length: 1 });
    });
  });
});

describe("parseCMap", () => {
  describe("codespace ranges", () => {
    it("should parse single codespace range", () => {
      const cmap = parseCMap(makeCMapStream(TWO_BYTE_CODESPACE));

      expect(cmap.readCharCode(new Uint8Array([0x12, 0x34]), 0)).toEqual({
        code: 0x1234,
        length: 2,
      });
    });

    it("should parse multiple codespace ranges", () => {
      const cmap = parseCMap(
        makeCMapStream(`
2 begincodespacerange
<00> <7F>
<8000> <FFFF>
endcodespacerange
`),
      );

      expect(cmap.readCharCode(new Uint8Array([0x41]), 0)).toEqual({ code: 0x41, length: 1 });
      expect(cmap.readCharCode(new Uint8Array([0x80, 0x01]), 0)).toEqual({
        code: 0x8001,
        length: 2,
      });
    });
  });

  describe("cidchar mappings", () => {
    it("should parse cidchar entries", () => {
      const cmap = parseCMap(
        makeCMapStream(`${TWO_BYTE_CODESPACE}
3 begincidchar
<0001> 100
<0002> 200
<0003> 300
endcidchar
`),
      );

      expect(cmap.lookup(0x0001)).toBe(100);
      expect(cmap.lookup(0x0002)).toBe(200);
      expect(cmap.lookup(0x0003)).toBe(300);
    });
  });

  describe("cidrange mappings", () => {
    it("should parse cidrange entries", () => {
      const cmap = parseCMap(
        makeCMapStream(`${TWO_BYTE_CODESPACE}
1 begincidrange
<0100> <01FF> 1000
endcidrange
`),
      );

      expect(cmap.lookup(0x0100)).toBe(1000);
      expect(cmap.lookup(0x0101)).toBe(1001);
      expect(cmap.lookup(0x01ff)).toBe(1255);
    });

    it("should parse multiple cidrange entries", () => {
      const cmap = parseCMap(
        makeCMapStream(`${TWO_BYTE_CODESPACE}
2 begincidrange
<0100> <01FF> 1000
<0200> <02FF> 2000
endcidrange
`),
      );

      expect(cmap.lookup(0x0100)).toBe(1000);
      expect(cmap.lookup(0x0200)).toBe(2000);
    });
  });

  describe("CMap metadata", () => {
    it("should parse CMap name", () => {
      const cmap = parseCMap(makeCMapStream(""));

      expect(cmap.name).toBe("TestCMap");
    });

    it("should use provided name as fallback", () => {
      const cmap = parseCMap(new TextEncoder().encode("begincmap endcmap"), "FallbackName");

      expect(cmap.name).toBe("FallbackName");
    });

    it("should parse WMode for vertical", () => {
      const cmap = parseCMap(makeCMapStream("/WMode 1 def"));

      expect(cmap.vertical).toBe(true);
    });

    it("should recognize an embedded Identity-H by name", () => {
      const cmap = parseCMap(
        new TextEncoder().encode(`/CMapName /Identity-H def ${TWO_BYTE_CODESPACE}`),
      );

      expect(cmap.isIdentity).toBe(true);
    });
  });
});
