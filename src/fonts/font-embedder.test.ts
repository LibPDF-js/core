import { describe, expect, it } from "vitest";
import type { PdfDict } from "#src/objects/pdf-dict";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfStream } from "#src/objects/pdf-stream";
import { loadFixture } from "#src/test-utils";
import { EmbeddedFont } from "./embedded-font";
import { createFontObjects, generateSubsetTag, registerFontObjects } from "./font-embedder";

describe("generateSubsetTag", () => {
  it("should generate 6 uppercase letters", () => {
    const tag = generateSubsetTag();
    expect(tag).toMatch(/^[A-Z]{6}$/);
  });

  it("should generate different tags", () => {
    const tags = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tags.add(generateSubsetTag());
    }
    // With 26^6 possibilities, 100 samples should all be unique
    expect(tags.size).toBe(100);
  });
});

describe("createFontObjects", () => {
  it("should create all required PDF objects", async () => {
    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const font = EmbeddedFont.fromBytes(fontBytes);

    // Encode some text to track glyph usage
    font.encodeText("Hello World");

    const result = await createFontObjects(font, { subsetTag: "ABCDEF" });

    // Check Type0 dict
    expect(result.type0Dict.getName("Type")?.value).toBe("Font");
    expect(result.type0Dict.getName("Subtype")?.value).toBe("Type0");
    expect(result.type0Dict.getName("Encoding")?.value).toBe("Identity-H");
    expect(result.type0Dict.getName("BaseFont")?.value).toContain("ABCDEF+");

    // Check CIDFont dict
    expect(result.cidFontDict.getName("Type")?.value).toBe("Font");
    expect(result.cidFontDict.getName("Subtype")?.value).toBe("CIDFontType2");
    // CIDToGIDMap is now a stream for subsetted TTF fonts (set during registration)
    // So we check that the stream exists in the result
    expect(result.cidToGidMapStream).toBeInstanceOf(PdfStream);
    expect(result.cidFontDict.has("W")).toBe(true);

    // Check CIDSystemInfo
    const cidSystemInfo = result.cidFontDict.get("CIDSystemInfo") as PdfDict;
    expect(cidSystemInfo.getString("Registry")?.asString()).toBe("Adobe");
    expect(cidSystemInfo.getString("Ordering")?.asString()).toBe("Identity");

    // Check FontDescriptor
    expect(result.descriptorDict.getName("Type")?.value).toBe("FontDescriptor");
    expect(result.descriptorDict.has("FontBBox")).toBe(true);
    expect(result.descriptorDict.has("Ascent")).toBe(true);
    expect(result.descriptorDict.has("Descent")).toBe(true);
    expect(result.descriptorDict.has("Flags")).toBe(true);

    // Check streams
    expect(result.fontStream).toBeInstanceOf(PdfStream);
    expect(result.fontStream.data.length).toBeGreaterThan(0);
    expect(result.toUnicodeStream).toBeInstanceOf(PdfStream);
    expect(result.toUnicodeStream.data.length).toBeGreaterThan(0);
  });

  it("should set subset tag on font", async () => {
    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const font = EmbeddedFont.fromBytes(fontBytes);

    font.encodeText("Test");

    await createFontObjects(font, { subsetTag: "XYZABC" });

    expect(font.subsetTag).toBe("XYZABC");
    expect(font.baseFontName).toContain("XYZABC+");
  });

  it("should include font metrics in descriptor", async () => {
    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const font = EmbeddedFont.fromBytes(fontBytes);

    font.encodeText("ABC");

    const result = await createFontObjects(font);

    const ascent = result.descriptorDict.getNumber("Ascent")?.value;
    const descent = result.descriptorDict.getNumber("Descent")?.value;

    expect(ascent).toBeGreaterThan(0);
    expect(descent).toBeLessThan(0);
  });

  it("should generate ToUnicode CMap", async () => {
    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const font = EmbeddedFont.fromBytes(fontBytes);

    font.encodeText("Hi");

    const result = await createFontObjects(font);

    const toUnicodeData = result.toUnicodeStream.data;
    const text = new TextDecoder().decode(toUnicodeData);

    expect(text).toContain("begincmap");
    expect(text).toContain("endcmap");
    expect(text).toContain("begincodespacerange");
  });
});

describe("registerFontObjects", () => {
  it("should register all objects and return type0 ref", async () => {
    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const font = EmbeddedFont.fromBytes(fontBytes);

    font.encodeText("Test");

    const result = await createFontObjects(font);

    // Mock register function
    let nextObjNum = 1;
    const registeredObjects: Array<{ ref: PdfRef; obj: PdfDict | PdfStream }> = [];

    const register = (obj: PdfDict | PdfStream): PdfRef => {
      const ref = PdfRef.of(nextObjNum++, 0);
      registeredObjects.push({ ref, obj });
      return ref;
    };

    const type0Ref = registerFontObjects(result, register);

    // Should have registered 6 objects (fontStream, toUnicode, cidToGidMap, descriptor, cidFont, type0)
    expect(registeredObjects.length).toBe(6);

    // Type0 should be the last registered (highest object number)
    expect(type0Ref.objectNumber).toBe(6);

    // Check that references were linked correctly
    // Type0 should have DescendantFonts array
    expect(result.type0Dict.has("DescendantFonts")).toBe(true);
    expect(result.type0Dict.has("ToUnicode")).toBe(true);

    // CIDFont should have FontDescriptor ref
    expect(result.cidFontDict.has("FontDescriptor")).toBe(true);

    // FontDescriptor should have FontFile2 ref
    expect(result.descriptorDict.has("FontFile2")).toBe(true);
  });
});
