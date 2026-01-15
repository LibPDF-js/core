# Plan 019: Font Reading

## Status: COMPLETE ✓

Implemented with 107 tests passing. All core font reading functionality is complete.

### Known Limitations

- **Predefined CJK CMaps**: Only Identity-H and Identity-V are supported. Legacy CJK PDFs
  using predefined CMaps (UniGB-UCS2-H, UniJIS-UCS2-H, etc.) without ToUnicode maps may
  not extract text correctly. Modern PDFs include ToUnicode maps which work correctly.
  This affects a small percentage of legacy PDFs. If needed, predefined CMap support
  can be added later by bundling the Adobe CMap files (~90 files, ~500KB+).

- **Type3 CharProcs**: Type3 fonts are parsed for widths/encoding but glyph drawing
  procedures are not executed (rendering concern, not reading).

- **Embedded font programs**: FontDescriptor references to FontFile/FontFile2/FontFile3
  are parsed but the actual font binaries are not decoded (needed for rendering only).

## Overview

Implement parsing of PDF font dictionaries to extract font metadata, glyph widths, and encoding information. This enables:

- Accurate text width measurement for form field layout
- Text extraction (via ToUnicode maps)
- Understanding existing fonts before embedding new ones

## Scope

**In scope:**

- Parse font dictionary structure (Type0, TrueType, Type1)
- Extract glyph widths from `/Widths` and `/W` arrays
- Parse FontDescriptor for metrics (ascent, descent, etc.)
- Load standard 14 font metrics
- Parse ToUnicode CMaps for text extraction
- Basic CMap parsing for Type0 fonts

**Out of scope:**

- Embedding new fonts (see Plan 020)
- Font subsetting
- Parsing embedded font programs (TrueType/CFF data)
- Rendering glyphs

## Font Types in PDF

| Subtype      | Description            | Encoding            | Use Case         |
| ------------ | ---------------------- | ------------------- | ---------------- |
| Type1        | PostScript Type 1      | Single-byte         | Legacy           |
| TrueType     | TrueType font          | Single-byte         | Common           |
| Type0        | Composite (CID)        | Multi-byte via CMap | **CJK, Unicode** |
| Type3        | User-defined glyphs    | Single-byte         | Special          |
| CIDFontType0 | CFF-based CIDFont      | N/A (descendant)    | CJK              |
| CIDFontType2 | TrueType-based CIDFont | N/A (descendant)    | CJK              |

## Font Dictionary Structures

### Simple Font (TrueType/Type1)

```
<<
  /Type /Font
  /Subtype /TrueType
  /BaseFont /Helvetica
  /FirstChar 32
  /LastChar 255
  /Widths [278 278 355 556 ...]  % 224 values
  /Encoding /WinAnsiEncoding
  /FontDescriptor 10 0 R
  /ToUnicode 11 0 R
>>
```

### Composite Font (Type0)

```
<<
  /Type /Font
  /Subtype /Type0
  /BaseFont /NotoSansCJK-Regular
  /Encoding /Identity-H
  /DescendantFonts [12 0 R]
  /ToUnicode 13 0 R
>>
```

### CIDFont (Descendant)

```
<<
  /Type /Font
  /Subtype /CIDFontType2
  /BaseFont /NotoSansCJK-Regular
  /CIDSystemInfo <<
    /Registry (Adobe)
    /Ordering (Identity)
    /Supplement 0
  >>
  /FontDescriptor 14 0 R
  /W [1 [500 600] 100 200 500]  % Complex width format
  /DW 1000
  /CIDToGIDMap /Identity
>>
```

### FontDescriptor

```
<<
  /Type /FontDescriptor
  /FontName /Helvetica
  /Flags 32
  /FontBBox [-166 -225 1000 931]
  /ItalicAngle 0
  /Ascent 718
  /Descent -207
  /CapHeight 718
  /XHeight 523
  /StemV 88
  /FontFile2 15 0 R  % Embedded font (optional)
>>
```

## Class Design

### PdfFont (Abstract Base)

```typescript
// src/fonts/pdf-font.ts

export abstract class PdfFont {
  protected readonly dict: PdfDict;
  protected readonly registry: ObjectRegistry;

  /** Font subtype (Type1, TrueType, Type0, etc.) */
  abstract readonly subtype: string;

  /** Base font name */
  get baseFontName(): string {
    return this.dict.getName("BaseFont")?.name ?? "Unknown";
  }

  /** Font descriptor (metrics, flags) */
  abstract get descriptor(): FontDescriptor | null;

  /**
   * Get width of a character code in glyph units (typically 1000 units = 1 em).
   */
  abstract getWidth(code: number): number;

  /**
   * Get width of text in points at given font size.
   */
  getTextWidth(text: string, fontSize: number): number {
    let width = 0;
    for (const code of this.encodeText(text)) {
      width += this.getWidth(code);
    }
    return (width * fontSize) / 1000;
  }

  /**
   * Encode text to character codes for this font.
   */
  abstract encodeText(text: string): number[];

  /**
   * Decode character code to Unicode (for text extraction).
   */
  abstract toUnicode(code: number): string;

  /**
   * Check if font can encode given text.
   */
  abstract canEncode(text: string): boolean;
}
```

### SimpleFont (TrueType/Type1)

```typescript
// src/fonts/simple-font.ts

export class SimpleFont extends PdfFont {
  readonly subtype: "TrueType" | "Type1" | "Type3";

  private readonly firstChar: number;
  private readonly lastChar: number;
  private readonly widths: number[];
  private readonly encoding: FontEncoding;
  private readonly toUnicodeMap: Map<number, string> | null;
  private readonly _descriptor: FontDescriptor | null;

  get descriptor(): FontDescriptor | null {
    return this._descriptor;
  }

  getWidth(code: number): number {
    if (code < this.firstChar || code > this.lastChar) {
      return this._descriptor?.missingWidth ?? 0;
    }
    return this.widths[code - this.firstChar] ?? 0;
  }

  encodeText(text: string): number[] {
    return this.encoding.encode(text);
  }

  toUnicode(code: number): string {
    // Try ToUnicode map first
    if (this.toUnicodeMap?.has(code)) {
      return this.toUnicodeMap.get(code)!;
    }
    // Fall back to encoding reverse lookup
    return this.encoding.decode(code);
  }

  canEncode(text: string): boolean {
    try {
      this.encodeText(text);
      return true;
    } catch {
      return false;
    }
  }
}
```

### CompositeFont (Type0)

```typescript
// src/fonts/composite-font.ts

export class CompositeFont extends PdfFont {
  readonly subtype = "Type0";

  private readonly cidFont: CIDFont;
  private readonly cmap: CMap;
  private readonly toUnicodeMap: Map<number, string> | null;

  get descriptor(): FontDescriptor | null {
    return this.cidFont.descriptor;
  }

  getWidth(code: number): number {
    // Map code to CID via CMap, then get width from CIDFont
    const cid = this.cmap.lookup(code);
    return this.cidFont.getWidth(cid);
  }

  encodeText(text: string): number[] {
    // For Identity-H encoding, codes are Unicode code points
    if (this.cmap.isIdentity) {
      return [...text].map(c => c.codePointAt(0)!);
    }
    // Otherwise need to use CMap encoding
    return this.cmap.encode(text);
  }

  toUnicode(code: number): string {
    if (this.toUnicodeMap?.has(code)) {
      return this.toUnicodeMap.get(code)!;
    }
    // For Identity encoding, code is the Unicode value
    if (this.cmap.isIdentity) {
      return String.fromCodePoint(code);
    }
    return "";
  }

  canEncode(text: string): boolean {
    // Type0 with Identity-H can encode any Unicode
    if (this.cmap.isIdentity) {
      return true;
    }
    // Otherwise check CMap coverage
    return this.cmap.canEncode(text);
  }
}
```

### CIDFont

```typescript
// src/fonts/cid-font.ts

export class CIDFont {
  readonly subtype: "CIDFontType0" | "CIDFontType2";
  readonly descriptor: FontDescriptor | null;

  private readonly defaultWidth: number;
  private readonly widths: CIDWidthMap;
  private readonly cidToGidMap: Uint16Array | "Identity" | null;

  /**
   * Get width for a CID.
   */
  getWidth(cid: number): number {
    return this.widths.get(cid) ?? this.defaultWidth;
  }
}

/**
 * Efficient storage for CID width mappings.
 * Handles the complex /W array format.
 */
class CIDWidthMap {
  private readonly individual = new Map<number, number>();
  private readonly ranges: Array<{ start: number; end: number; width: number }> = [];

  get(cid: number): number | undefined {
    // Check individual mappings first
    if (this.individual.has(cid)) {
      return this.individual.get(cid);
    }
    // Check ranges
    for (const range of this.ranges) {
      if (cid >= range.start && cid <= range.end) {
        return range.width;
      }
    }
    return undefined;
  }

  /**
   * Parse /W array format:
   * [cid [w1 w2 ...]] - individual widths starting at cid
   * [cidStart cidEnd w] - same width for range
   */
  static parse(wArray: PdfArray, registry: ObjectRegistry): CIDWidthMap {
    const map = new CIDWidthMap();
    let i = 0;

    while (i < wArray.length) {
      const first = (wArray.get(i) as PdfNumber).value;
      const second = registry.resolve(wArray.get(i + 1));

      if (second instanceof PdfArray) {
        // Individual widths: cid [w1 w2 w3 ...]
        for (let j = 0; j < second.length; j++) {
          const width = (second.get(j) as PdfNumber).value;
          map.individual.set(first + j, width);
        }
        i += 2;
      } else {
        // Range: cidStart cidEnd width
        const end = (second as PdfNumber).value;
        const width = (wArray.get(i + 2) as PdfNumber).value;
        map.ranges.push({ start: first, end, width });
        i += 3;
      }
    }

    return map;
  }
}
```

### FontDescriptor

```typescript
// src/fonts/font-descriptor.ts

export class FontDescriptor {
  readonly fontName: string;
  readonly flags: number;
  readonly fontBBox: [number, number, number, number];
  readonly italicAngle: number;
  readonly ascent: number;
  readonly descent: number;
  readonly capHeight: number;
  readonly xHeight: number;
  readonly stemV: number;
  readonly stemH: number;
  readonly missingWidth: number;

  /** Check if font is symbolic (uses custom encoding) */
  get isSymbolic(): boolean {
    return (this.flags & FontFlags.SYMBOLIC) !== 0;
  }

  /** Check if font is serif */
  get isSerif(): boolean {
    return (this.flags & FontFlags.SERIF) !== 0;
  }

  /** Check if font is fixed-pitch (monospace) */
  get isFixedPitch(): boolean {
    return (this.flags & FontFlags.FIXED_PITCH) !== 0;
  }

  /** Check if font is italic */
  get isItalic(): boolean {
    return (this.flags & FontFlags.ITALIC) !== 0;
  }

  static parse(dict: PdfDict): FontDescriptor {
    return new FontDescriptor({
      fontName: dict.getName("FontName")?.name ?? "",
      flags: dict.getNumber("Flags")?.value ?? 0,
      fontBBox: parseBBox(dict.getArray("FontBBox")),
      italicAngle: dict.getNumber("ItalicAngle")?.value ?? 0,
      ascent: dict.getNumber("Ascent")?.value ?? 0,
      descent: dict.getNumber("Descent")?.value ?? 0,
      capHeight: dict.getNumber("CapHeight")?.value ?? 0,
      xHeight: dict.getNumber("XHeight")?.value ?? 0,
      stemV: dict.getNumber("StemV")?.value ?? 0,
      stemH: dict.getNumber("StemH")?.value ?? 0,
      missingWidth: dict.getNumber("MissingWidth")?.value ?? 0,
    });
  }
}

const FontFlags = {
  FIXED_PITCH: 1 << 0,
  SERIF: 1 << 1,
  SYMBOLIC: 1 << 2,
  SCRIPT: 1 << 3,
  NONSYMBOLIC: 1 << 5,
  ITALIC: 1 << 6,
  ALL_CAP: 1 << 16,
  SMALL_CAP: 1 << 17,
  FORCE_BOLD: 1 << 18,
} as const;
```

### FontEncoding

```typescript
// src/fonts/font-encoding.ts

export interface FontEncoding {
  /** Encode text to character codes */
  encode(text: string): number[];

  /** Decode character code to Unicode */
  decode(code: number): string;
}

/** WinAnsi encoding (most common) */
export class WinAnsiEncoding implements FontEncoding {
  private static readonly TO_UNICODE: string[] = [...]; // 256 entries
  private static readonly FROM_UNICODE: Map<number, number> = new Map();

  encode(text: string): number[] {
    const codes: number[] = [];
    for (const char of text) {
      const code = WinAnsiEncoding.FROM_UNICODE.get(char.codePointAt(0)!);
      if (code === undefined) {
        throw new Error(`Cannot encode '${char}' in WinAnsiEncoding`);
      }
      codes.push(code);
    }
    return codes;
  }

  decode(code: number): string {
    return WinAnsiEncoding.TO_UNICODE[code] ?? "";
  }
}

/** Mac Roman encoding */
export class MacRomanEncoding implements FontEncoding { ... }

/** Standard encoding (Type1 default) */
export class StandardEncoding implements FontEncoding { ... }

/** Custom encoding with Differences array */
export class DifferencesEncoding implements FontEncoding {
  constructor(
    private readonly base: FontEncoding,
    private readonly differences: Map<number, string>
  ) {}

  encode(text: string): number[] { ... }
  decode(code: number): string { ... }
}
```

### CMap

```typescript
// src/fonts/cmap.ts

export class CMap {
  readonly name: string;
  readonly isIdentity: boolean;

  private readonly codespaceRanges: CodespaceRange[];
  private readonly charMappings: Map<number, number>;
  private readonly rangeMappings: CMapRange[];

  /**
   * Look up CID for character code.
   */
  lookup(code: number): number {
    if (this.isIdentity) return code;

    // Check direct mappings
    if (this.charMappings.has(code)) {
      return this.charMappings.get(code)!;
    }

    // Check ranges
    for (const range of this.rangeMappings) {
      if (code >= range.start && code <= range.end) {
        return range.baseCID + (code - range.start);
      }
    }

    return 0; // .notdef
  }

  /**
   * Encode text to character codes.
   */
  encode(text: string): number[] {
    // Implementation depends on CMap type
    ...
  }

  /**
   * Check if text can be encoded.
   */
  canEncode(text: string): boolean { ... }

  /**
   * Parse CMap from stream.
   */
  static parse(stream: PdfStream): CMap { ... }

  /**
   * Get predefined CMap by name.
   */
  static getPredefined(name: string): CMap | null {
    if (name === "Identity-H" || name === "Identity-V") {
      return CMap.identity(name.endsWith("-V"));
    }
    // Load from bundled CMaps if available
    return PREDEFINED_CMAPS.get(name) ?? null;
  }

  private static identity(vertical: boolean): CMap {
    return new CMap({
      name: vertical ? "Identity-V" : "Identity-H",
      isIdentity: true,
      codespaceRanges: [{ start: 0x0000, end: 0xFFFF, bytes: 2 }],
      charMappings: new Map(),
      rangeMappings: [],
    });
  }
}
```

### ToUnicode CMap Parser

```typescript
// src/fonts/to-unicode.ts

/**
 * Parse ToUnicode CMap for text extraction.
 * Returns mapping from character codes to Unicode strings.
 */
export function parseToUnicode(stream: PdfStream): Map<number, string> {
  const map = new Map<number, string>();
  const content = stream.decodeSync();
  const text = new TextDecoder("latin1").decode(content);

  // Parse beginbfchar sections
  const bfcharRegex = /beginbfchar\s*([\s\S]*?)\s*endbfchar/g;
  let match;
  while ((match = bfcharRegex.exec(text)) !== null) {
    parseBfChar(match[1], map);
  }

  // Parse beginbfrange sections
  const bfrangeRegex = /beginbfrange\s*([\s\S]*?)\s*endbfrange/g;
  while ((match = bfrangeRegex.exec(text)) !== null) {
    parseBfRange(match[1], map);
  }

  return map;
}

function parseBfChar(content: string, map: Map<number, string>): void {
  // Format: <srcCode> <dstString>
  const lineRegex = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
  let match;
  while ((match = lineRegex.exec(content)) !== null) {
    const code = parseInt(match[1], 16);
    const unicode = hexToUnicode(match[2]);
    map.set(code, unicode);
  }
}

function parseBfRange(content: string, map: Map<number, string>): void {
  // Format: <start> <end> <dstStart> or <start> <end> [<dst1> <dst2> ...]
  ...
}

function hexToUnicode(hex: string): string {
  // Convert hex pairs to UTF-16BE string
  const codes: number[] = [];
  for (let i = 0; i < hex.length; i += 4) {
    codes.push(parseInt(hex.slice(i, i + 4), 16));
  }
  return String.fromCharCode(...codes);
}
```

### Standard 14 Fonts

```typescript
// src/fonts/standard-14.ts

/**
 * Built-in metrics for the standard 14 PDF fonts.
 * These don't require embedded font data.
 */
export const STANDARD_14_FONTS: Record<string, StandardFontMetrics> = {
  "Helvetica": {
    ascent: 718,
    descent: -207,
    capHeight: 718,
    xHeight: 523,
    widths: {
      32: 278, 33: 278, 34: 355, 35: 556, // space, !, ", #
      // ... all 256 widths for WinAnsi
    },
  },
  "Helvetica-Bold": { ... },
  "Helvetica-Oblique": { ... },
  "Helvetica-BoldOblique": { ... },
  "Times-Roman": { ... },
  "Times-Bold": { ... },
  "Times-Italic": { ... },
  "Times-BoldItalic": { ... },
  "Courier": { ... },  // All widths are 600 (monospace)
  "Courier-Bold": { ... },
  "Courier-Oblique": { ... },
  "Courier-BoldOblique": { ... },
  "Symbol": { ... },
  "ZapfDingbats": { ... },
};

export function isStandard14Font(name: string): boolean {
  // Handle subset prefix (e.g., "ABCDEF+Helvetica")
  const baseName = name.includes("+") ? name.split("+")[1] : name;
  return baseName in STANDARD_14_FONTS;
}

export function getStandard14Metrics(name: string): StandardFontMetrics | null {
  const baseName = name.includes("+") ? name.split("+")[1] : name;
  return STANDARD_14_FONTS[baseName] ?? null;
}
```

### FontFactory

```typescript
// src/fonts/font-factory.ts

export class FontFactory {
  /**
   * Parse a font dictionary and return appropriate PdfFont subclass.
   */
  static parse(dict: PdfDict, registry: ObjectRegistry): PdfFont {
    const subtype = dict.getName("Subtype")?.name;

    switch (subtype) {
      case "Type0":
        return CompositeFont.parse(dict, registry);
      case "TrueType":
      case "Type1":
      case "Type3":
        return SimpleFont.parse(dict, registry, subtype);
      default:
        throw new Error(`Unsupported font subtype: ${subtype}`);
    }
  }
}
```

## File Structure

```
src/fonts/
├── index.ts                # Re-exports
├── pdf-font.ts             # Abstract base class
├── simple-font.ts          # TrueType, Type1, Type3
├── composite-font.ts       # Type0 (CID fonts)
├── cid-font.ts             # CIDFont (descendant)
├── font-descriptor.ts      # FontDescriptor
├── font-encoding.ts        # WinAnsi, MacRoman, etc.
├── cmap.ts                 # CMap parser
├── to-unicode.ts           # ToUnicode CMap parser
├── standard-14.ts          # Standard 14 font metrics
├── font-factory.ts         # Factory for creating fonts
└── tests/
    ├── simple-font.test.ts
    ├── composite-font.test.ts
    ├── cmap.test.ts
    └── standard-14.test.ts
```

## Test Plan

### Simple Font Parsing

1. Parse TrueType font dict
2. Parse Type1 font dict
3. Extract widths from /Widths array
4. Handle /FirstChar and /LastChar
5. Get width for valid character code
6. Get missing width for invalid code
7. Parse FontDescriptor

### Composite Font Parsing

1. Parse Type0 font dict
2. Extract DescendantFonts
3. Parse CIDFont dict
4. Parse /W array (individual widths)
5. Parse /W array (range widths)
6. Get /DW default width
7. Handle Identity-H encoding

### Encoding

1. WinAnsiEncoding encode/decode
2. MacRomanEncoding encode/decode
3. Differences array parsing
4. Symbol encoding
5. Identity encoding for Type0

### CMap

1. Identity-H is identity
2. Identity-V is identity with vertical flag
3. Parse embedded CMap stream
4. Parse codespacerange
5. Parse bfchar mappings
6. Parse bfrange mappings

### ToUnicode

1. Parse simple bfchar mappings
2. Parse bfrange with start code
3. Parse bfrange with array
4. Handle surrogate pairs
5. Empty ToUnicode stream

### Standard 14 Fonts

1. Recognize Helvetica
2. Recognize with subset prefix
3. Get correct widths for Helvetica
4. Courier is monospace (all 600)
5. Unknown font returns null

### Integration

1. Text width calculation
2. encodeText for simple font
3. encodeText for Type0 (Identity-H)
4. toUnicode for text extraction

## Dependencies

- Plan 018: Text Encoding (for string handling)
- `ObjectRegistry` for resolving references
- `PdfStream.decodeSync()` for CMap streams

## Future Extensions (Plan 020)

- Font embedding
- Font subsetting
- TrueType/OpenType parsing
- CFF parsing
