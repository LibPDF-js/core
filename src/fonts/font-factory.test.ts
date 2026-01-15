import { Scanner } from "#src/io/scanner";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfRef } from "#src/objects/pdf-ref";
import { DocumentParser } from "#src/parser/document-parser";
import { loadFixture } from "#src/test-utils";
import { describe, expect, it } from "vitest";

import { CompositeFont } from "./composite-font";
import { FontFactory, isCompositeFont, isSimpleFont, parseFont } from "./font-factory";
import { SimpleFont } from "./simple-font";

describe("parseFont", () => {
  describe("Type1 fonts", () => {
    it("should parse Type1 font with /WinAnsiEncoding", () => {
      const dict = new PdfDict([
        [PdfName.of("Type"), PdfName.of("Font")],
        [PdfName.of("Subtype"), PdfName.of("Type1")],
        [PdfName.of("BaseFont"), PdfName.of("Helvetica")],
        [PdfName.of("Encoding"), PdfName.of("WinAnsiEncoding")],
      ]);

      const font = parseFont(dict);

      expect(font).toBeInstanceOf(SimpleFont);
      expect(font.subtype).toBe("Type1");
      expect(font.baseFontName).toBe("Helvetica");
    });

    it("should parse Type1 font with /MacRomanEncoding", () => {
      const dict = new PdfDict([
        [PdfName.of("Type"), PdfName.of("Font")],
        [PdfName.of("Subtype"), PdfName.of("Type1")],
        [PdfName.of("BaseFont"), PdfName.of("Helvetica")],
        [PdfName.of("Encoding"), PdfName.of("MacRomanEncoding")],
      ]);

      const font = parseFont(dict) as SimpleFont;

      expect(font).toBeInstanceOf(SimpleFont);
      expect(font.getEncoding().name).toBe("MacRomanEncoding");
      expect(font.toUnicode(0x41)).toBe("A");
    });

    it("should recognize Standard 14 fonts", () => {
      const dict = new PdfDict([
        [PdfName.of("Subtype"), PdfName.of("Type1")],
        [PdfName.of("BaseFont"), PdfName.of("Times-Roman")],
      ]);

      const font = parseFont(dict) as SimpleFont;

      expect(font.isStandard14).toBe(true);
      // Standard 14 fonts should have widths from metrics
      expect(font.getWidth(0x41)).toBeGreaterThan(0); // 'A'
    });

    it("should return 0 width for non-Standard 14 without widths array", () => {
      const dict = new PdfDict([
        [PdfName.of("Subtype"), PdfName.of("Type1")],
        [PdfName.of("BaseFont"), PdfName.of("CustomFont")],
      ]);

      const font = parseFont(dict) as SimpleFont;

      expect(font.isStandard14).toBe(false);
      expect(font.getWidth(0x41)).toBe(0);
    });
  });

  describe("TrueType fonts", () => {
    it("should parse TrueType font with widths", () => {
      const widths = new PdfArray([
        PdfNumber.of(250), // FirstChar
        PdfNumber.of(500),
        PdfNumber.of(600),
        PdfNumber.of(700),
      ]);

      const dict = new PdfDict([
        [PdfName.of("Subtype"), PdfName.of("TrueType")],
        [PdfName.of("BaseFont"), PdfName.of("ArialMT")],
        [PdfName.of("FirstChar"), PdfNumber.of(32)],
        [PdfName.of("LastChar"), PdfNumber.of(35)],
        [PdfName.of("Widths"), widths],
      ]);

      const font = parseFont(dict) as SimpleFont;

      expect(font.subtype).toBe("TrueType");
      expect(font.baseFontName).toBe("ArialMT");
      expect(font.getWidth(32)).toBe(250);
      expect(font.getWidth(33)).toBe(500);
      expect(font.getWidth(34)).toBe(600);
      expect(font.getWidth(35)).toBe(700);
    });

    it("should parse TrueType font with FontDescriptor reference", () => {
      const descriptorDict = new PdfDict([
        [PdfName.of("Type"), PdfName.of("FontDescriptor")],
        [PdfName.of("FontName"), PdfName.of("ArialMT")],
        [PdfName.of("Flags"), PdfNumber.of(32)],
        [PdfName.of("Ascent"), PdfNumber.of(905)],
        [PdfName.of("Descent"), PdfNumber.of(-212)],
        [PdfName.of("CapHeight"), PdfNumber.of(716)],
        [PdfName.of("StemV"), PdfNumber.of(80)],
        [
          PdfName.of("FontBBox"),
          new PdfArray([
            PdfNumber.of(-665),
            PdfNumber.of(-325),
            PdfNumber.of(2000),
            PdfNumber.of(1006),
          ]),
        ],
      ]);

      const dict = new PdfDict([
        [PdfName.of("Subtype"), PdfName.of("TrueType")],
        [PdfName.of("BaseFont"), PdfName.of("ArialMT")],
        [PdfName.of("FontDescriptor"), PdfRef.of(10, 0)],
      ]);

      const font = parseFont(dict, {
        resolveRef: ref => {
          if (ref instanceof PdfRef && ref.objectNumber === 10) {
            return descriptorDict;
          }
          return null;
        },
      }) as SimpleFont;

      expect(font.descriptor).not.toBeNull();
      expect(font.descriptor?.fontName).toBe("ArialMT");
      expect(font.descriptor?.ascent).toBe(905);
      expect(font.descriptor?.descent).toBe(-212);
    });
  });

  describe("unknown subtypes", () => {
    it("should default to SimpleFont for unknown subtype", () => {
      const dict = new PdfDict([
        [PdfName.of("Subtype"), PdfName.of("UnknownType")],
        [PdfName.of("BaseFont"), PdfName.of("Mystery")],
      ]);

      const font = parseFont(dict);

      expect(font).toBeInstanceOf(SimpleFont);
    });

    it("should default to SimpleFont when Subtype is missing", () => {
      const dict = new PdfDict([[PdfName.of("BaseFont"), PdfName.of("NoSubtype")]]);

      const font = parseFont(dict);

      expect(font).toBeInstanceOf(SimpleFont);
    });
  });
});

describe("isSimpleFont / isCompositeFont", () => {
  it("should identify SimpleFont correctly", () => {
    const dict = new PdfDict([
      [PdfName.of("Subtype"), PdfName.of("Type1")],
      [PdfName.of("BaseFont"), PdfName.of("Helvetica")],
    ]);

    const font = parseFont(dict);

    expect(isSimpleFont(font)).toBe(true);
    expect(isCompositeFont(font)).toBe(false);
  });
});

describe("FontFactory class", () => {
  it("should parse fonts using factory instance", () => {
    const factory = new FontFactory();
    const dict = new PdfDict([
      [PdfName.of("Subtype"), PdfName.of("Type1")],
      [PdfName.of("BaseFont"), PdfName.of("Courier")],
    ]);

    const font = factory.parse(dict);

    expect(font).toBeInstanceOf(SimpleFont);
    expect(font.baseFontName).toBe("Courier");
  });

  it("should use resolveRef from options", () => {
    const descriptorDict = new PdfDict([
      [PdfName.of("Type"), PdfName.of("FontDescriptor")],
      [PdfName.of("FontName"), PdfName.of("TestFont")],
      [PdfName.of("Flags"), PdfNumber.of(0)],
    ]);

    const factory = FontFactory.withResolver(ref => {
      if (ref instanceof PdfRef && ref.objectNumber === 5) {
        return descriptorDict;
      }
      return null;
    });

    const dict = new PdfDict([
      [PdfName.of("Subtype"), PdfName.of("TrueType")],
      [PdfName.of("BaseFont"), PdfName.of("TestFont")],
      [PdfName.of("FontDescriptor"), PdfRef.of(5, 0)],
    ]);

    const font = factory.parse(dict) as SimpleFont;

    expect(font.descriptor).not.toBeNull();
    expect(font.descriptor?.fontName).toBe("TestFont");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Real PDF integration tests
// ─────────────────────────────────────────────────────────────────────────────

describe("real PDF font parsing", () => {
  it("should parse Type1 font from rot0.pdf", async () => {
    const bytes = await loadFixture("text", "rot0.pdf");
    const scanner = new Scanner(bytes);
    const parser = new DocumentParser(scanner);
    const doc = await parser.parse();

    // Get the page
    const pages = await doc.getPages();
    expect(pages.length).toBe(1);

    const pageDict = (await doc.getObject(pages[0]!)) as PdfDict;
    expect(pageDict).toBeInstanceOf(PdfDict);

    // Get Resources -> Font -> F1
    const resourcesRef = pageDict.get("Resources");
    const resourcesDict = resourcesRef
      ? ((await doc.getObject(resourcesRef as PdfRef)) as PdfDict)
      : null;

    expect(resourcesDict).toBeInstanceOf(PdfDict);

    const fontDictRef = resourcesDict?.get("Font");
    const fontDict = fontDictRef ? ((await doc.getObject(fontDictRef as PdfRef)) as PdfDict) : null;

    expect(fontDict).toBeInstanceOf(PdfDict);

    // Get F1 font
    const f1Ref = fontDict?.get("F1");
    const f1Dict = f1Ref ? ((await doc.getObject(f1Ref as PdfRef)) as PdfDict) : null;

    expect(f1Dict).toBeInstanceOf(PdfDict);

    // Parse the font (no resolveRef needed - this font has no indirect refs)
    const font = parseFont(f1Dict!) as SimpleFont;

    expect(font).toBeInstanceOf(SimpleFont);
    expect(font.subtype).toBe("Type1");
    expect(font.baseFontName).toBe("Helvetica-Bold");
    expect(font.isStandard14).toBe(true);

    // Standard 14 font should have widths
    const widthA = font.getWidth(0x41); // 'A'
    expect(widthA).toBeGreaterThan(0);

    // Test text width calculation
    const textWidth = font.getTextWidth("Page", 14);
    expect(textWidth).toBeGreaterThan(0);
  });

  it("should parse TrueType font with widths from openoffice-test-document.pdf", async () => {
    const bytes = await loadFixture("text", "openoffice-test-document.pdf");
    const scanner = new Scanner(bytes);
    const parser = new DocumentParser(scanner);
    const doc = await parser.parse();

    // Get the first page
    const pages = await doc.getPages();
    expect(pages.length).toBeGreaterThan(0);

    const pageDict = (await doc.getObject(pages[0]!)) as PdfDict;

    // Navigate to font resources
    const resourcesRef = pageDict.get("Resources");
    const resourcesDict = resourcesRef
      ? ((await doc.getObject(resourcesRef as PdfRef)) as PdfDict)
      : null;

    if (!resourcesDict) {
      // Some PDFs have inline resources
      return;
    }

    const fontDictRef = resourcesDict.get("Font");
    if (!fontDictRef) {
      return;
    }

    const fontDict =
      fontDictRef instanceof PdfRef
        ? ((await doc.getObject(fontDictRef)) as PdfDict)
        : (fontDictRef as PdfDict);

    // Find first font
    let firstFontDict: PdfDict | null = null;
    for (const [, value] of fontDict) {
      const resolved =
        value instanceof PdfRef ? ((await doc.getObject(value)) as PdfDict) : (value as PdfDict);
      if (resolved instanceof PdfDict) {
        firstFontDict = resolved;
        break;
      }
    }

    if (!firstFontDict) {
      return;
    }

    const font = parseFont(firstFontDict) as SimpleFont;

    expect(font).toBeInstanceOf(SimpleFont);
    expect(font.subtype).toBe("TrueType");
    // OpenOffice embeds subset fonts with prefix like BAAAAA+
    expect(font.baseFontName).toMatch(/TimesNewRomanPSMT/);

    // This font has explicit widths - verify by checking that character widths exist
    // Character code 0 should have a width since FirstChar is 0
    const width0 = font.getWidth(0);
    expect(width0).toBeGreaterThan(0);
  });

  it("should parse Standard 14 font and calculate text widths", () => {
    const dict = new PdfDict([
      [PdfName.of("Subtype"), PdfName.of("Type1")],
      [PdfName.of("BaseFont"), PdfName.of("Helvetica")],
    ]);

    const font = parseFont(dict) as SimpleFont;

    // Known Helvetica metrics (from AFM files)
    // "Hello" in Helvetica at 12pt
    const text = "Hello";
    const width = font.getTextWidth(text, 12);

    // Helvetica widths: H=722, e=556, l=222, l=222, o=556 = 2278 units
    // At 12pt: 2278 * 12 / 1000 = 27.336
    expect(width).toBeCloseTo(27.336, 1);
  });

  it("should encode and decode text with WinAnsiEncoding", () => {
    const dict = new PdfDict([
      [PdfName.of("Subtype"), PdfName.of("Type1")],
      [PdfName.of("BaseFont"), PdfName.of("Helvetica")],
      [PdfName.of("Encoding"), PdfName.of("WinAnsiEncoding")],
    ]);

    const font = parseFont(dict) as SimpleFont;

    // Encode text
    const codes = font.encodeText("Hello");
    expect(codes).toEqual([0x48, 0x65, 0x6c, 0x6c, 0x6f]);

    // Decode back to Unicode
    expect(font.toUnicode(0x48)).toBe("H");
    expect(font.toUnicode(0x65)).toBe("e");
    expect(font.toUnicode(0x6c)).toBe("l");
    expect(font.toUnicode(0x6f)).toBe("o");
  });

  it("should handle special characters in WinAnsiEncoding", () => {
    const dict = new PdfDict([
      [PdfName.of("Subtype"), PdfName.of("Type1")],
      [PdfName.of("BaseFont"), PdfName.of("Helvetica")],
      [PdfName.of("Encoding"), PdfName.of("WinAnsiEncoding")],
    ]);

    const font = parseFont(dict) as SimpleFont;

    // Euro sign is at 0x80 in WinAnsi
    expect(font.toUnicode(0x80)).toBe("€");

    // Em dash is at 0x97
    expect(font.toUnicode(0x97)).toBe("—");

    // Check canEncode
    expect(font.canEncode("Hello")).toBe(true);
    expect(font.canEncode("€100")).toBe(true);
  });

  it("should verify yaddatest.pdf has Helvetica font", async () => {
    const bytes = await loadFixture("text", "yaddatest.pdf");
    const scanner = new Scanner(bytes);
    const parser = new DocumentParser(scanner);
    const doc = await parser.parse();

    // Get the first page
    const pages = await doc.getPages();
    expect(pages.length).toBeGreaterThan(0);

    const pageDict = (await doc.getObject(pages[0]!)) as PdfDict;

    // This PDF has inline resources in the page dict
    const resources = pageDict.getDict("Resources");
    expect(resources).toBeInstanceOf(PdfDict);

    const fontDict = resources?.getDict("Font");
    expect(fontDict).toBeInstanceOf(PdfDict);

    // Get F1 font
    const f1Ref = fontDict?.get("F1");
    const f1Dict = f1Ref ? ((await doc.getObject(f1Ref as PdfRef)) as PdfDict) : null;

    expect(f1Dict).toBeInstanceOf(PdfDict);

    const font = parseFont(f1Dict!) as SimpleFont;

    expect(font).toBeInstanceOf(SimpleFont);
    expect(font.subtype).toBe("Type1");
    expect(font.baseFontName).toBe("Helvetica");
    expect(font.isStandard14).toBe(true);
    expect(font.getEncoding().name).toBe("MacRomanEncoding");
  });

  it("should parse Type0 composite font from hello3.pdf", async () => {
    const bytes = await loadFixture("xref", "hello3.pdf");
    const scanner = new Scanner(bytes);
    const parser = new DocumentParser(scanner);
    const doc = await parser.parse();

    // Get the first page
    const pages = await doc.getPages();
    expect(pages.length).toBeGreaterThan(0);

    const pageDict = (await doc.getObject(pages[0]!)) as PdfDict;

    // Navigate to font resources
    const resources = pageDict.getDict("Resources");
    expect(resources).toBeInstanceOf(PdfDict);

    const fontDict = resources?.getDict("Font");
    expect(fontDict).toBeInstanceOf(PdfDict);

    // Get C2_0 - the Type0 font (TT0 is TrueType)
    const c2Ref = fontDict?.get("C2_0");
    expect(c2Ref).toBeDefined();

    const c2Dict = (await doc.getObject(c2Ref as PdfRef)) as PdfDict;
    expect(c2Dict).toBeInstanceOf(PdfDict);
    expect(c2Dict.getName("Subtype")?.value).toBe("Type0");

    // Create a sync resolver for the font parsing
    // We need to pre-resolve the descendant fonts
    const descendantsArray = c2Dict.getArray("DescendantFonts");
    expect(descendantsArray).toBeDefined();

    const cidFontRef = descendantsArray?.at(0);
    const cidFontDict = (await doc.getObject(cidFontRef as PdfRef)) as PdfDict;

    // Parse the font with resolver
    const font = parseFont(c2Dict, {
      resolveRef: ref => {
        if (ref instanceof PdfRef) {
          // Return pre-resolved CIDFont
          if (ref.objectNumber === (cidFontRef as PdfRef).objectNumber) {
            return cidFontDict;
          }
        }
        return null;
      },
    });

    expect(font).toBeInstanceOf(CompositeFont);
    expect(font.subtype).toBe("Type0");
    expect(font.baseFontName).toMatch(/TimesNewRomanPSMT/);

    // Check the CIDFont was parsed
    const compositeFont = font as CompositeFont;
    const cidFont = compositeFont.getCIDFont();
    expect(cidFont.subtype).toBe("CIDFontType2");

    // Check CMap is Identity-H
    const cmap = compositeFont.getCMap();
    expect(cmap.isIdentity).toBe(true);

    // Test width lookup - the CIDFont has /W array with specific widths
    // From the PDF: /W[932[530]938[337]995 996 394]
    // CID 932 has width 530, CID 938 has width 337, CIDs 995-996 have width 394
    // For Identity-H, character code = CID
    expect(compositeFont.getWidth(932)).toBe(530);
    expect(compositeFont.getWidth(938)).toBe(337);
    expect(compositeFont.getWidth(995)).toBe(394);
    expect(compositeFont.getWidth(996)).toBe(394);

    // Unknown CIDs should get default width (1000)
    expect(compositeFont.getWidth(100)).toBe(1000);
  });

  it("should parse Type0 font with Identity-H encoding", () => {
    // Create a minimal Type0 font dict for unit testing
    const cidFontDict = new PdfDict([
      [PdfName.of("Type"), PdfName.of("Font")],
      [PdfName.of("Subtype"), PdfName.of("CIDFontType2")],
      [PdfName.of("BaseFont"), PdfName.of("TestCJKFont")],
      [
        PdfName.of("CIDSystemInfo"),
        new PdfDict([
          [PdfName.of("Registry"), PdfName.of("Adobe")],
          [PdfName.of("Ordering"), PdfName.of("Identity")],
          [PdfName.of("Supplement"), PdfNumber.of(0)],
        ]),
      ],
      [PdfName.of("DW"), PdfNumber.of(1000)],
    ]);

    const type0Dict = new PdfDict([
      [PdfName.of("Type"), PdfName.of("Font")],
      [PdfName.of("Subtype"), PdfName.of("Type0")],
      [PdfName.of("BaseFont"), PdfName.of("TestCJKFont")],
      [PdfName.of("Encoding"), PdfName.of("Identity-H")],
      [PdfName.of("DescendantFonts"), new PdfArray([PdfRef.of(99, 0)])],
    ]);

    const font = parseFont(type0Dict, {
      resolveRef: ref => {
        if (ref instanceof PdfRef && ref.objectNumber === 99) {
          return cidFontDict;
        }
        return null;
      },
    });

    expect(font).toBeInstanceOf(CompositeFont);
    expect(isCompositeFont(font)).toBe(true);
    expect(isSimpleFont(font)).toBe(false);

    const compositeFont = font as CompositeFont;

    // Identity-H means code = CID = Unicode
    expect(compositeFont.getCMap().isIdentity).toBe(true);

    // Test encoding CJK text
    const codes = compositeFont.encodeText("中");
    expect(codes).toEqual([0x4e2d]); // Unicode for 中

    // Test toUnicode (Identity means code is Unicode)
    expect(compositeFont.toUnicode(0x4e2d)).toBe("中");

    // All text should be encodable with Identity
    expect(compositeFont.canEncode("Hello 世界")).toBe(true);
  });
});
