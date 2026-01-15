# Plan 020b: Unified Fonts Module

## Overview

Rewrite `src/fonts` to unify font reading (Plan 019) and font embedding (Plan 020) using the existing `src/fontbox` module. The current `src/fonts` module parses PDF font dictionaries but doesn't leverage fontbox for embedded font data. This plan creates a cohesive architecture where:

1. **PDF font dictionaries** are parsed to understand fonts already in a PDF
2. **Embedded font programs** (TTF, CFF, Type1) are parsed with fontbox
3. **New fonts can be embedded** into PDFs with automatic subsetting
4. **Text extraction** uses the best available data (ToUnicode > embedded font > encoding)

## Current State

### src/fonts/ (PDF-level)

- Parses PDF font dictionaries (`/Font` objects)
- Handles PDF encodings (WinAnsi, MacRoman, Standard, etc.)
- Works with PDF structures: `/Widths`, `/ToUnicode`, `/FontDescriptor`
- **Gap**: Doesn't parse embedded font programs (`/FontFile`, `/FontFile2`, `/FontFile3`)

### src/fontbox/ (Font file-level)

- Parses raw font files (TTF, OTF, CFF, Type1, AFM)
- Has `TTFSubsetter` for font subsetting
- Supports variable fonts (fvar, stat, avar)
- **Gap**: Not connected to PDF font handling

## Goals

1. Parse embedded font programs when available
2. Use fontbox metrics as fallback when PDF metadata is incomplete
3. Enable font embedding with automatic subsetting
4. Improve text extraction by using embedded font's cmap
5. Maintain backward compatibility with existing API

## Scope

**In scope:**

- Integrate fontbox with PDF font parsing
- Parse `/FontFile` (Type1), `/FontFile2` (TTF), `/FontFile3` (CFF)
- Font embedding API (`pdf.embedFont()`)
- ToUnicode generation for embedded fonts
- Subsetting during save
- Variable font flattening to static instance

**Out of scope:**

- Full text shaping (HarfBuzz integration) - defer to later
- Font collections (.ttc) - single font only
- CFF2 variable fonts
- Font modification (add/remove glyphs)

## Architecture

```
                    ┌─────────────────────────────────────────┐
                    │              PdfFont (abstract)         │
                    │  - getWidth(code): number               │
                    │  - encodeText(text): number[]           │
                    │  - toUnicode(code): string              │
                    │  - canEncode(text): boolean             │
                    └─────────────────────────────────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
              ▼                        ▼                        ▼
    ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
    │   SimpleFont    │      │ CompositeFont   │      │  EmbeddedFont   │
    │  (TrueType,     │      │   (Type0)       │      │  (new fonts)    │
    │   Type1, Type3) │      │                 │      │                 │
    └─────────────────┘      └─────────────────┘      └─────────────────┘
              │                        │                        │
              │                        │                        │
              ▼                        ▼                        ▼
    ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
    │ EmbeddedProgram │      │    CIDFont      │      │ FontProgram     │
    │   (optional)    │      │  + Embedded     │      │ (TrueTypeFont)  │
    │ TrueTypeFont    │      │    Program      │      │                 │
    │ CFFFont         │      │                 │      │                 │
    │ Type1Font       │      │                 │      │                 │
    └─────────────────┘      └─────────────────┘      └─────────────────┘
              │                        │                        │
              └────────────────────────┴────────────────────────┘
                                       │
                                       ▼
                            ┌─────────────────────┐
                            │      fontbox        │
                            │  TTF/CFF/Type1      │
                            │  parsing            │
                            └─────────────────────┘
```

## Desired Usage

### Reading Fonts (existing PDFs)

```typescript
// Parse PDF with fonts
const pdf = await PDF.load(pdfBytes);
const page = pdf.getPage(0);

// Get font from resources
const font = page.getFont("F1");

// Access font properties
console.log(font.baseFontName); // "ABCDEF+Helvetica"
console.log(font.subtype); // "TrueType"
console.log(font.descriptor?.ascent); // 718

// Width measurement
const width = font.getWidth(65); // Width of 'A'
const textWidth = font.getTextWidth("Hello", 12);

// Text extraction
const unicode = font.toUnicode(65); // "A"

// Check encoding capability
if (font.canEncode("Hello")) {
  const codes = font.encodeText("Hello");
}

// Access embedded font program (if available)
if (font.hasEmbeddedProgram) {
  const program = font.getEmbeddedProgram();
  if (program.type === "truetype") {
    const ttf = program as TrueTypeFont;
    console.log(ttf.numGlyphs);
  }
}
```

### Embedding New Fonts

```typescript
// Load PDF and font bytes
const pdf = await PDF.load(existingPdfBytes);
const fontBytes = await fs.readFile("NotoSansCJK-Regular.ttf");

// Embed font - parses with fontbox, tracks usage
const font = await pdf.embedFont(fontBytes);

// Use in form field
const form = pdf.getForm();
const field = form.getTextField("name");
field.setFont(font);
field.setValue("Hello "); // Mixed scripts

// Check encoding capability
if (!font.canEncode("")) {
  console.log("Missing glyph");
}

// Width calculation works immediately
const width = font.getTextWidth("Hello", 12);

// Save - font is automatically subsetted
const output = await pdf.save();
```

### Variable Font Embedding

```typescript
// Embed variable font with specific axis values
const font = await pdf.embedFont(variableFontBytes, {
  variations: { wght: 700, wdth: 100 }, // Bold, normal width
});

// Or use a named instance
const font = await pdf.embedFont(variableFontBytes, {
  instance: "Bold", // Use named instance from fvar
});

// Default: use font's default axis values
const font = await pdf.embedFont(variableFontBytes);
```

## File Structure

```
src/fonts/
├── index.ts                    # Public API exports
├── types.ts                    # Shared types and interfaces
│
├── base/
│   ├── pdf-font.ts             # Abstract PdfFont base class
│   ├── font-descriptor.ts      # FontDescriptor (unchanged)
│   └── font-program.ts         # FontProgram interface for embedded fonts
│
├── reading/
│   ├── simple-font.ts          # SimpleFont (TrueType, Type1, Type3)
│   ├── composite-font.ts       # CompositeFont (Type0)
│   ├── cid-font.ts             # CIDFont (descendant)
│   ├── font-factory.ts         # Factory for parsing font dicts
│   └── embedded-parser.ts      # Parse FontFile/FontFile2/FontFile3
│
├── encoding/
│   ├── encoding.ts             # FontEncoding interface
│   ├── standard.ts             # StandardEncoding
│   ├── win-ansi.ts             # WinAnsiEncoding
│   ├── mac-roman.ts            # MacRomanEncoding
│   ├── symbol.ts               # SymbolEncoding
│   ├── zapf-dingbats.ts        # ZapfDingbatsEncoding
│   ├── differences.ts          # DifferencesEncoding
│   └── glyph-list.ts           # Adobe Glyph List
│
├── cmap/
│   ├── cmap.ts                 # CMap class for Type0
│   ├── cmap-parser.ts          # Parse CMap streams
│   └── to-unicode.ts           # ToUnicode CMap parsing
│
├── embedding/
│   ├── embedded-font.ts        # EmbeddedFont class (user-facing)
│   ├── font-embedder.ts        # Create PDF font dictionaries
│   ├── to-unicode-builder.ts   # Build ToUnicode CMap
│   ├── widths-builder.ts       # Build /W and /Widths arrays
│   └── subset-writer.ts        # Write subsetted font stream
│
├── standard-14/
│   ├── metrics.ts              # Standard 14 font metrics
│   └── afm-data.ts             # AFM data for standard fonts
│
└── tests/
    ├── simple-font.test.ts
    ├── composite-font.test.ts
    ├── embedded-parser.test.ts
    ├── embedded-font.test.ts
    ├── font-embedder.test.ts
    └── integration.test.ts
```

## Key Components

### 1. FontProgram Interface

Bridge between PDF fonts and fontbox:

```typescript
// src/fonts/base/font-program.ts

import type { TrueTypeFont } from "#src/fontbox/ttf/truetype-font.ts";
import type { CFFFont } from "#src/fontbox/cff/parser.ts";
import type { Type1Font } from "#src/fontbox/type1/font.ts";

export type FontProgramType = "truetype" | "cff" | "type1";

export interface FontProgram {
  readonly type: FontProgramType;

  /** Number of glyphs in the font */
  readonly numGlyphs: number;

  /** Units per em */
  readonly unitsPerEm: number;

  /** Get glyph ID for Unicode code point */
  getGlyphId(codePoint: number): number;

  /** Get advance width for glyph ID */
  getAdvanceWidth(glyphId: number): number;

  /** Check if font has glyph for code point */
  hasGlyph(codePoint: number): boolean;

  /** Get raw font data */
  getData(): Uint8Array;
}

// Wrapper for TrueTypeFont
export class TrueTypeFontProgram implements FontProgram {
  readonly type = "truetype" as const;
  constructor(readonly font: TrueTypeFont) {}

  get numGlyphs(): number {
    return this.font.numGlyphs;
  }
  get unitsPerEm(): number {
    return this.font.unitsPerEm;
  }

  getGlyphId(codePoint: number): number {
    return this.font.getGlyphId(codePoint);
  }

  getAdvanceWidth(glyphId: number): number {
    return this.font.getAdvanceWidth(glyphId);
  }

  hasGlyph(codePoint: number): boolean {
    return this.font.hasGlyph(codePoint);
  }

  getData(): Uint8Array {
    return this.font.data.bytes;
  }
}

// Similar wrappers for CFF and Type1...
```

### 2. EmbeddedParser

Parse font programs from FontDescriptor:

```typescript
// src/fonts/reading/embedded-parser.ts

import { parseTTF } from "#src/fontbox/ttf/parser.ts";
import { parseCFF } from "#src/fontbox/cff/parser.ts";
import { parseType1 } from "#src/fontbox/type1/parser.ts";

export function parseEmbeddedProgram(
  descriptor: PdfDict,
  options: { decodeStream: (stream: unknown) => Uint8Array | null },
): FontProgram | null {
  // Try FontFile2 (TrueType)
  const fontFile2 = descriptor.get("FontFile2");
  if (fontFile2) {
    const data = options.decodeStream(fontFile2);
    if (data) {
      const ttf = parseTTF(data);
      return new TrueTypeFontProgram(ttf);
    }
  }

  // Try FontFile3 (CFF or OpenType with CFF)
  const fontFile3 = descriptor.get("FontFile3");
  if (fontFile3) {
    const subtype = fontFile3.getName("Subtype")?.value;
    const data = options.decodeStream(fontFile3);
    if (data) {
      if (subtype === "CIDFontType0C" || subtype === "Type1C") {
        const cff = parseCFF(data);
        return new CFFProgram(cff);
      }
      if (subtype === "OpenType") {
        // OpenType with CFF - parse as TTF, CFF is in 'CFF ' table
        const ttf = parseTTF(data);
        return new TrueTypeFontProgram(ttf);
      }
    }
  }

  // Try FontFile (Type1)
  const fontFile = descriptor.get("FontFile");
  if (fontFile) {
    const data = options.decodeStream(fontFile);
    if (data) {
      const t1 = parseType1(data);
      return new Type1Program(t1);
    }
  }

  return null;
}
```

### 3. Enhanced SimpleFont

Use embedded program when available:

```typescript
// src/fonts/reading/simple-font.ts

export class SimpleFont extends PdfFont {
  // ... existing properties ...

  /** Embedded font program (if available) */
  private readonly embeddedProgram: FontProgram | null;

  constructor(options: {
    // ... existing options ...
    embeddedProgram?: FontProgram | null;
  }) {
    // ...
    this.embeddedProgram = options.embeddedProgram ?? null;
  }

  /** Check if embedded font program is available */
  get hasEmbeddedProgram(): boolean {
    return this.embeddedProgram !== null;
  }

  /** Get embedded font program */
  getEmbeddedProgram(): FontProgram | null {
    return this.embeddedProgram;
  }

  /**
   * Enhanced toUnicode with embedded font fallback.
   */
  toUnicode(code: number): string {
    // 1. Try ToUnicode map first (most accurate)
    if (this.toUnicodeMap?.has(code)) {
      return this.toUnicodeMap.get(code)!;
    }

    // 2. Try encoding
    const fromEncoding = this.encoding.decode(code);
    if (fromEncoding) {
      return fromEncoding;
    }

    // 3. Try embedded font's cmap (reverse lookup)
    if (this.embeddedProgram) {
      // For embedded fonts, the code might be a GID
      // Try to find Unicode via post table or cmap reverse
      // This is complex - defer for now
    }

    return "";
  }

  /**
   * Enhanced getWidth with embedded font fallback.
   */
  getWidth(code: number): number {
    // Try explicit widths array first
    if (code >= this.firstChar && code <= this.lastChar) {
      const width = this.widths[code - this.firstChar];
      if (width !== undefined) {
        return width;
      }
    }

    // For Standard 14 fonts, use built-in metrics
    if (this.isStandard14) {
      // ... existing Standard 14 logic ...
    }

    // Try embedded font program
    if (this.embeddedProgram) {
      // Map code to GID, get width
      const gid = this.codeToGid(code);
      if (gid !== 0) {
        const width = this.embeddedProgram.getAdvanceWidth(gid);
        // Convert from font units to 1000 units
        return (width * 1000) / this.embeddedProgram.unitsPerEm;
      }
    }

    return this._descriptor?.missingWidth ?? 0;
  }
}
```

### 4. EmbeddedFont (for new fonts)

User-facing API for embedding fonts:

```typescript
// src/fonts/embedding/embedded-font.ts

export class EmbeddedFont extends PdfFont {
  readonly subtype = "Type0" as const;

  /** Underlying font program */
  private readonly fontProgram: TrueTypeFontProgram;

  /** Track used glyphs for subsetting */
  private readonly usedGlyphs: Set<number> = new Set([0]); // Always include .notdef

  /** Track used code points for ToUnicode */
  private readonly usedCodePoints: Map<number, number> = new Map(); // codePoint -> GID

  /** Font name with subset tag */
  private subsetTag: string | null = null;

  constructor(fontProgram: TrueTypeFontProgram, options?: EmbedOptions) {
    super();
    this.fontProgram = fontProgram;
    // Apply variable font options if provided
  }

  get baseFontName(): string {
    // Return subset-tagged name after save
    const name = this.fontProgram.font.name?.getPostScriptName() ?? "Unknown";
    return this.subsetTag ? `${this.subsetTag}+${name}` : name;
  }

  get descriptor(): FontDescriptor | null {
    // Build from font program metrics
    return this.buildDescriptor();
  }

  /**
   * Encode text to character codes.
   * Uses Identity-H encoding (code = Unicode code point).
   */
  encodeText(text: string): number[] {
    const codes: number[] = [];

    for (const char of text) {
      const codePoint = char.codePointAt(0)!;
      const gid = this.fontProgram.getGlyphId(codePoint);

      // Track usage for subsetting
      this.usedGlyphs.add(gid);
      this.usedCodePoints.set(codePoint, gid);

      // Identity-H: code = code point
      codes.push(codePoint);
    }

    return codes;
  }

  /**
   * Get width in glyph units (1000 = 1 em).
   */
  getWidth(code: number): number {
    const gid = this.fontProgram.getGlyphId(code);
    const width = this.fontProgram.getAdvanceWidth(gid);
    return (width * 1000) / this.fontProgram.unitsPerEm;
  }

  toUnicode(code: number): string {
    // For Identity-H, code is the Unicode code point
    return String.fromCodePoint(code);
  }

  canEncode(text: string): boolean {
    for (const char of text) {
      const codePoint = char.codePointAt(0)!;
      if (!this.fontProgram.hasGlyph(codePoint)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Build PDF objects for this font.
   * Called during PDF save.
   */
  buildPdfObjects(context: WriteContext): PdfFontObjects {
    // Generate subset tag
    this.subsetTag = generateSubsetTag();

    // Subset the font
    const subsetter = new TTFSubsetter(this.fontProgram.font);
    for (const gid of this.usedGlyphs) {
      subsetter.addGlyph(gid);
    }
    const subsetData = subsetter.subset();

    // Build ToUnicode CMap
    const toUnicode = buildToUnicodeCMap(this.usedCodePoints);

    // Build widths array
    const widths = buildWidthsArray(this.usedCodePoints, this.fontProgram);

    // Create PDF dictionaries
    return {
      type0Dict: this.buildType0Dict(toUnicode),
      cidFontDict: this.buildCIDFontDict(widths),
      descriptorDict: this.buildDescriptorDict(),
      fontStream: subsetData,
      toUnicodeStream: toUnicode,
    };
  }
}
```

### 5. FontEmbedder

Create PDF objects from EmbeddedFont:

```typescript
// src/fonts/embedding/font-embedder.ts

export function createFontObjects(
  embeddedFont: EmbeddedFont,
  context: WriteContext,
): PdfFontObjects {
  const program = embeddedFont.fontProgram;
  const subsetTag = generateSubsetTag();
  const fontName = `${subsetTag}+${program.getPostScriptName()}`;

  // 1. Subset the font
  const subsetter = new TTFSubsetter(program.font);
  for (const gid of embeddedFont.usedGlyphs) {
    subsetter.addGlyph(gid);
  }
  const subsetData = subsetter.subset();

  // 2. Build font stream
  const fontStream = new PdfStream({
    data: subsetData,
    dict: new PdfDict({
      Length1: subsetData.length,
    }),
  });

  // 3. Build FontDescriptor
  const descriptorDict = new PdfDict({
    Type: new PdfName("FontDescriptor"),
    FontName: new PdfName(fontName),
    Flags: 4, // Symbolic
    FontBBox: buildFontBBox(program),
    ItalicAngle: program.font.post?.italicAngle ?? 0,
    Ascent: scaleMetric(program.font.os2?.sTypoAscender ?? 0, program),
    Descent: scaleMetric(program.font.os2?.sTypoDescender ?? 0, program),
    CapHeight: scaleMetric(program.font.os2?.sCapHeight ?? 0, program),
    StemV: 80, // Estimate
    FontFile2: fontStream.ref,
  });

  // 4. Build CIDFont
  const cidFontDict = new PdfDict({
    Type: new PdfName("Font"),
    Subtype: new PdfName("CIDFontType2"),
    BaseFont: new PdfName(fontName),
    CIDSystemInfo: new PdfDict({
      Registry: new PdfString("Adobe"),
      Ordering: new PdfString("Identity"),
      Supplement: new PdfNumber(0),
    }),
    FontDescriptor: descriptorDict.ref,
    W: buildWidthsArray(embeddedFont.usedCodePoints, program),
    CIDToGIDMap: new PdfName("Identity"),
  });

  // 5. Build ToUnicode CMap
  const toUnicodeStream = buildToUnicodeCMap(embeddedFont.usedCodePoints);

  // 6. Build Type0 font
  const type0Dict = new PdfDict({
    Type: new PdfName("Font"),
    Subtype: new PdfName("Type0"),
    BaseFont: new PdfName(fontName),
    Encoding: new PdfName("Identity-H"),
    DescendantFonts: new PdfArray([cidFontDict.ref]),
    ToUnicode: toUnicodeStream.ref,
  });

  return { type0Dict, cidFontDict, descriptorDict, fontStream, toUnicodeStream };
}
```

## Migration Strategy

1. **Phase 1: Add fontbox integration** (non-breaking)
   - Add `embedded-parser.ts` to parse FontFile/FontFile2/FontFile3
   - Add `FontProgram` interface and wrappers
   - Enhance `SimpleFont` and `CIDFont` to use embedded programs
   - Keep existing API unchanged

2. **Phase 2: Add embedding support** (new API)
   - Add `EmbeddedFont` class
   - Add `pdf.embedFont()` API
   - Add subsetting during save
   - Add ToUnicode generation

3. **Phase 3: Reorganize files** (refactor)
   - Move files to new structure
   - Update imports
   - Update tests

## Test Plan

### Embedded Program Parsing

- Parse FontFile2 (TrueType) from PDF
- Parse FontFile3/CIDFontType0C (CFF) from PDF
- Parse FontFile3/OpenType from PDF
- Parse FontFile (Type1) from PDF
- Handle missing/corrupt font programs gracefully
- Get metrics from embedded font

### Enhanced Font Reading

- Use embedded font metrics when /Widths is missing
- Use embedded font cmap for toUnicode fallback
- Prefer explicit PDF data over embedded font

### Font Embedding

- Embed TTF font
- Embed OTF font (TrueType outlines)
- Track used glyphs correctly
- Generate valid ToUnicode CMap
- Generate correct /W widths array
- Subset removes unused glyphs
- Subset tag is deterministic
- Variable font: flatten to default instance
- Variable font: flatten with custom axis values
- Variable font: use named instance

### Integration

- Embed font -> save -> load -> text renders
- Embed font -> save -> load -> text extractable
- Embed CJK font with many glyphs
- Embed font, use in multiple fields
- Round-trip: load PDF with embedded font, save, load again

### Edge Cases

- Font with no OS/2 table
- Font with no post table
- Composite glyphs during subsetting
- Very large fonts (>65535 glyphs)
- Empty text (no glyphs used)
- Font with custom cmap format

## Dependencies

- fontbox module (TTF, CFF, Type1 parsers)
- TTFSubsetter (already implemented)
- BinaryScanner for parsing
- PdfDict, PdfStream, etc. for PDF objects

## Open Questions

1. **Subset tag format**: Random vs deterministic (hash of used glyphs)?
   - Recommend: 6 uppercase letters, hash-based for determinism

2. **Error handling**: Throw vs fallback for corrupt embedded fonts?
   - Recommend: Fallback with warning, prioritize opening files

3. **Variable fonts**: Require explicit axis values or default to font defaults?
   - Recommend: Default to font defaults, allow override

4. **CFF fonts in OpenType**: Parse CFF table or treat as TTF?
   - Recommend: Parse as TTF, access CFF via 'CFF ' table if needed

5. **Re-embedding**: Allow re-embedding already-embedded fonts?
   - Recommend: Yes, but with option to reuse existing

## Risks

1. **Bundle size**: fontbox adds code, but it's tree-shakeable
2. **Performance**: Parsing large fonts on load - mitigate with lazy loading
3. **Compatibility**: Some malformed fonts may fail - add lenient parsing
4. **Variable fonts**: Flattening is complex - start with static fonts only
