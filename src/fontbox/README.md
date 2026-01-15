# fontbox

TypeScript port of [Apache PDFBox fontbox](https://pdfbox.apache.org/) - a standalone font handling library.

## Origin

This is a TypeScript port heavily inspired by fontbox from Apache PDFBox. The original Java source is available at `checkouts/pdfbox/fontbox/`.

We retain TypeScript idiomaticness while following fontbox's proven patterns and battle-tested logic.

## Scope

| Module     | Status  | Description                                      |
| ---------- | ------- | ------------------------------------------------ |
| **ttf/**   | Planned | TrueType/OpenType parsing and subsetting         |
| **cff/**   | Planned | Compact Font Format (PostScript outlines in OTF) |
| **type1/** | Planned | Type 1 PostScript fonts                          |
| **afm/**   | Planned | Adobe Font Metrics                               |
| **cmap/**  | Planned | CMap parsing for CID-keyed fonts                 |
| **pfb/**   | Planned | PostScript Font Binary                           |

## Design Principles

### Idiomatic TypeScript

- Reuse existing `src/io/scanner.ts`, `src/io/binary-scanner.ts`, and `src/io/byte-writer.ts`
- `BinaryScanner` extends `Scanner` with big-endian and fixed-point reads for font parsing
- Prefer composition over inheritance
- Use `Map` and `Set` where appropriate
- Strong typing throughout

### Relationship to fontbox

This is a **heavily inspired port**, not a line-by-line translation. We:

- Follow fontbox's architecture and proven parsing strategies
- Adopt its battle-tested edge case handling
- Use the same table structures and subsetting algorithms
- But express them idiomatically in TypeScript

### Differences from Java Original

| Java (fontbox)                   | TypeScript (this port)            |
| -------------------------------- | --------------------------------- |
| `TTFDataStream` abstract class   | `BinaryScanner` extends `Scanner` |
| `RandomAccessRead` interface     | `Uint8Array` input                |
| Checked exceptions               | Return types / thrown errors      |
| Synchronized blocks              | Not needed (single-threaded)      |
| Class inheritance hierarchies    | Composition, interfaces           |
| Getter/setter methods            | Properties or readonly fields     |
| `GeneralPath` for glyph outlines | Path data arrays or SVG-style     |

### What We're Adding

- **Variable font support** - fvar, avar, gvar tables (not in original fontbox)
- **HarfBuzz integration** - For proper text shaping (fontbox's GSUB is incomplete)

## Usage

```typescript
import { TTFParser, TTFSubsetter } from "#src/fontbox";

// Parse a font
const font = TTFParser.parse(fontBytes);
console.log(font.familyName); // "Noto Sans"
console.log(font.unitsPerEm); // 2048

// Check character support
const glyphId = font.getGlyphId(0x4e2d); // 中
if (glyphId !== 0) {
  const width = font.getAdvanceWidth(glyphId);
}

// Create a subset
const subsetter = new TTFSubsetter(font);
subsetter.addText("Hello 世界");
const subsetBytes = subsetter.subset();
```

## License

This port maintains the Apache 2.0 license of the original PDFBox project.
