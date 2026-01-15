# Plan 020a: Fontbox Port (Spike)

## Overview

Port Apache PDFBox's fontbox module to TypeScript for font parsing and subsetting. This provides the foundation for font embedding (Plan 020) and supports legacy font formats found in older PDFs.

## Why Fontbox

- **Battle-tested** - Apache project, handles real-world edge cases
- **Complete coverage** - TTF, OTF, CFF, Type1, AFM - not just modern fonts
- **Proven subsetting** - TTFSubsetter handles composite glyphs correctly
- **We're not just handling modern PDFs** - Legacy Type1 fonts still exist in the wild

## Scope

**Porting (in priority order):**

| Module     | Description                                        | Priority |
| ---------- | -------------------------------------------------- | -------- |
| **ttf/**   | TrueType/OpenType parsing and subsetting           | High     |
| **cff/**   | Compact Font Format (OTF with PostScript outlines) | High     |
| **cmap/**  | CMap parsing for CID-keyed fonts                   | High     |
| **type1/** | Type 1 PostScript fonts                            | Medium   |
| **afm/**   | Adobe Font Metrics                                 | Medium   |
| **pfb/**   | PostScript Font Binary                             | Medium   |

**Adding (not in fontbox):**

- Variable font tables: fvar, avar, gvar
- HarfBuzz integration for text shaping (fontbox's GSUB is incomplete)

## Design Approach

### Heavily Inspired, Idiomatically TypeScript

This is not a line-by-line translation. We:

- Follow fontbox's architecture and battle-tested logic
- Use the same table structures and algorithms
- But express them idiomatically in TypeScript

### Reuse Existing Infrastructure

Use existing `src/io/` utilities:

```typescript
import { Scanner } from "#src/io/scanner";
import { BinaryScanner } from "#src/io/binary-scanner"; // Extends Scanner with big-endian reads
import { ByteWriter } from "#src/io/byte-writer";
```

### Key Differences from Java

| Java (fontbox)          | TypeScript (this port)            |
| ----------------------- | --------------------------------- |
| `TTFDataStream`         | `BinaryScanner` (extends Scanner) |
| `RandomAccessRead`      | `Uint8Array` input                |
| Checked exceptions      | Thrown errors or result types     |
| Synchronized blocks     | Not needed                        |
| Inheritance hierarchies | Composition, interfaces           |
| `GeneralPath`           | Path data arrays                  |

## Source Mapping

Key fontbox sources in `checkouts/pdfbox/fontbox/src/main/java/org/apache/fontbox/`:

### TTF Module

| Java File                         | TypeScript Target    | Purpose               |
| --------------------------------- | -------------------- | --------------------- |
| `ttf/TTFParser.java`              | `ttf/parser.ts`      | Parse table directory |
| `ttf/TrueTypeFont.java`           | `ttf/font.ts`        | Font data model       |
| `ttf/TTFSubsetter.java`           | `ttf/subsetter.ts`   | Subsetting            |
| `ttf/TTFTable.java`               | `ttf/table.ts`       | Base table            |
| `ttf/HeaderTable.java`            | `ttf/tables/head.ts` | head table            |
| `ttf/HorizontalHeaderTable.java`  | `ttf/tables/hhea.ts` | hhea table            |
| `ttf/HorizontalMetricsTable.java` | `ttf/tables/hmtx.ts` | hmtx table            |
| `ttf/MaximumProfileTable.java`    | `ttf/tables/maxp.ts` | maxp table            |
| `ttf/IndexToLocationTable.java`   | `ttf/tables/loca.ts` | loca table            |
| `ttf/GlyphTable.java`             | `ttf/tables/glyf.ts` | glyf table            |
| `ttf/CmapTable.java`              | `ttf/tables/cmap.ts` | cmap table            |
| `ttf/NamingTable.java`            | `ttf/tables/name.ts` | name table            |
| `ttf/PostScriptTable.java`        | `ttf/tables/post.ts` | post table            |
| `ttf/OS2WindowsMetricsTable.java` | `ttf/tables/os2.ts`  | OS/2 table            |

### CFF Module

| Java File                  | TypeScript Target   | Purpose            |
| -------------------------- | ------------------- | ------------------ |
| `cff/CFFParser.java`       | `cff/parser.ts`     | Parse CFF data     |
| `cff/CFFFont.java`         | `cff/font.ts`       | CFF font model     |
| `cff/Type2CharString.java` | `cff/charstring.ts` | Charstring parsing |

### Type1 Module

| Java File                | TypeScript Target | Purpose          |
| ------------------------ | ----------------- | ---------------- |
| `type1/Type1Parser.java` | `type1/parser.ts` | Parse Type1      |
| `type1/Type1Font.java`   | `type1/font.ts`   | Type1 font model |

## File Structure

```
src/
├── io/
│   ├── scanner.ts           # Existing - extend if needed
│   ├── byte-writer.ts       # Existing - extend if needed
│   └── binary-reader.ts     # New - big-endian, fixed-point reads
└── fontbox/
    ├── README.md
    ├── index.ts
    ├── ttf/
    │   ├── index.ts
    │   ├── parser.ts
    │   ├── font.ts
    │   ├── subsetter.ts
    │   ├── table.ts
    │   └── tables/
    │       ├── head.ts
    │       ├── hhea.ts
    │       ├── hmtx.ts
    │       ├── maxp.ts
    │       ├── loca.ts
    │       ├── glyf.ts
    │       ├── cmap.ts
    │       ├── name.ts
    │       ├── post.ts
    │       ├── os2.ts
    │       ├── fvar.ts      # Variable fonts (new)
    │       ├── avar.ts      # Variable fonts (new)
    │       └── gvar.ts      # Variable fonts (new)
    ├── cff/
    │   ├── index.ts
    │   ├── parser.ts
    │   ├── font.ts
    │   └── charstring.ts
    ├── type1/
    │   ├── index.ts
    │   ├── parser.ts
    │   └── font.ts
    ├── afm/
    │   ├── index.ts
    │   └── parser.ts
    └── cmap/
        ├── index.ts
        └── parser.ts
```

## Desired Usage

```typescript
import { TTFParser, TTFSubsetter } from "#src/fontbox/ttf";
import { CFFParser } from "#src/fontbox/cff";
import { Type1Parser } from "#src/fontbox/type1";

// Parse TrueType font
const ttf = TTFParser.parse(ttfBytes);
console.log(ttf.familyName);
console.log(ttf.unitsPerEm);

// Check character support
const glyphId = ttf.getGlyphId(0x4e2d); // 中
if (glyphId !== 0) {
  const width = ttf.getAdvanceWidth(glyphId);
}

// Subset
const subsetter = new TTFSubsetter(ttf);
subsetter.addText("Hello 世界");
const subsetBytes = subsetter.subset();

// Parse CFF (from OTF)
const cff = CFFParser.parse(cffBytes);

// Parse Type1 (legacy)
const type1 = Type1Parser.parse(type1Bytes);
```

### Variable Fonts

```typescript
const font = TTFParser.parse(variableFontBytes);

if (font.isVariable) {
  console.log(font.axes); // [{ tag: "wght", min: 100, max: 900, default: 400 }]

  // Create static instance
  const bold = font.instantiate({ wght: 700 });
}
```

## Test Plan

### TTF Parsing

- Parse valid TTF file
- Parse OTF with TrueType outlines
- Reject truncated/invalid files
- Handle missing optional tables (OS/2)
- Lazy table loading works correctly

### Table Parsing

- head: unitsPerEm, bbox, loca format
- hhea: ascent, descent, lineGap
- hmtx: advance widths
- maxp: numGlyphs
- loca: short and long format
- glyf: simple, composite, empty glyphs
- cmap: format 4 (BMP), format 12 (full Unicode)
- name: family, style, platform variations
- post: glyph names
- OS/2: weight, width, panose

### TTF Subsetting

- Include .notdef always
- Single and multiple glyphs
- Composite glyphs include components
- Nested composites resolved
- GIDs remapped in output
- Output is valid, re-parseable TTF
- Deterministic output

### Variable Fonts

- Parse fvar axes
- Parse gvar glyph variations
- Instantiate at axis values
- Default instance works

### CFF Parsing

- Parse standalone CFF
- Parse CFF from OTF
- Extract glyph outlines
- Handle CID-keyed fonts

### Type1 Parsing

- Parse PFA (ASCII)
- Parse PFB (binary)
- Extract metrics
- Parse charstrings

## Implementation Order

1. **BinaryScanner** - ✅ Done - extends Scanner with big-endian reads
2. **TTF table directory** - Parse offset table
3. **Required tables** - head, hhea, hmtx, maxp, loca, glyf, cmap
4. **TTFSubsetter** - Core subsetting with composite handling
5. **Optional tables** - name, post, OS/2
6. **Variable fonts** - fvar, gvar, avar
7. **CFF** - Parser and font model
8. **Type1** - Parser and font model

## Success Criteria

1. Can parse Noto Sans CJK (large, complex TTF)
2. Can subset to <50 glyphs correctly
3. Subset renders correctly in PDF
4. Can parse OTF with CFF outlines
5. Can parse legacy Type1 fonts
6. Variable font instantiation works

## References

- fontbox source: `checkouts/pdfbox/fontbox/src/main/java/org/apache/fontbox/`
- OpenType spec: https://learn.microsoft.com/en-us/typography/opentype/spec/
- Apple TrueType spec: https://developer.apple.com/fonts/TrueType-Reference-Manual/
