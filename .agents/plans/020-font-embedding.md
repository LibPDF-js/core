# Plan 020: Font Embedding

## Overview

Implement embedding TrueType/OpenType fonts into PDFs with subsetting support. This enables:

- Using custom fonts in form fields
- CJK character support
- Consistent rendering across systems

## Scope

**In scope:**

- Embed TrueType (.ttf) fonts as CIDFontType2
- Embed OpenType with TrueType outlines (.otf)
- Variable fonts (fvar/gvar tables) - flatten to static instance
- Font subsetting (include only used glyphs)
- Generate ToUnicode CMap
- Build /W widths array
- Support for CJK fonts
- Proper text shaping (ligatures, Arabic, Indic)

**Out of scope:**

- OpenType with CFF outlines (Type0 CIDFontType0) - complex, rare need
- Multiple Master fonts
- Font modification (add glyphs)

## External Dependencies: Analysis

Font handling requires two capabilities:

1. **Text shaping** - Convert Unicode text to positioned glyphs (handles ligatures, Arabic joining, etc.)
2. **Font subsetting** - Extract only used glyphs to reduce file size

### Library Comparison

| Library             | Shaping | Subsetting | CJK     | Bundle      | Issues                          |
| ------------------- | ------- | ---------- | ------- | ----------- | ------------------------------- |
| **fontkit**         | Basic   | Yes        | Partial | ~55KB       | Ligature bugs, Noto Sans issues |
| **opentype.js**     | Basic   | No         | Partial | ~45KB       | No subsetting                   |
| **harfbuzzjs**      | Full    | No         | Full    | ~180KB WASM | Shaping only                    |
| **fonteditor-core** | None    | Yes        | Partial | ~90KB       | OTF/CJK glyph mangling          |

**Key insight**: No single library does everything well.

### Known Issues

- **fontkit**: Problems with Noto Sans ligatures, Arabic letter joining broken
- **fonteditor-core**: "can mangle glyphs on e.g. Google's Noto CJK fonts" (per otf2svg docs)
- **opentype.js**: No native subsetting capability

### Recommended Approach

Use a **layered approach** inspired by PDFBox's fontbox (which is self-contained with no font dependencies):

1. **Custom TTF parser** (port patterns from fontbox)
   - Lazy table loading - parse table directory first, load tables on demand
   - Tables needed: head, hhea, hmtx, maxp, loca, glyf, cmap, name, post, OS/2
   - Use DataView for binary reading (maps well to fontbox's TTFDataStream)

2. **Custom TTF subsetter** (port from fontbox)
   - PDFBox's TTFSubsetter is well-tested
   - Key insight: composite glyph resolution via loop until no new GIDs discovered
   - GID remapping using sorted set (O(log n) new GID lookup)
   - Always output long loca format for simplicity

3. **harfbuzzjs** for text shaping (optional, WASM)
   - Industry standard, handles all scripts correctly
   - fontbox has limited GSUB support (Types 1-4, 7 only) - not worth porting
   - Defer full shaping to HarfBuzz rather than incomplete implementation

## Desired Usage

### Basic Font Embedding

```typescript
// Load PDF and font
const pdf = await PDF.load(existingPdfBytes);
const fontBytes = await fs.readFile("NotoSansCJK-Regular.ttf");

// Embed font
const font = await pdf.embedFont(fontBytes);

// Use in form field
const form = pdf.getForm();
const field = form.getTextField("name");
field.setFont(font);
field.setValue("你好世界");

// Save - font is automatically subsetted to only include used glyphs
const output = await pdf.save();
```

### Check Font Capability

```typescript
const font = await pdf.embedFont(fontBytes);

// Check if font can render text
if (font.canEncode("你好")) {
  field.setValue("你好");
} else {
  console.error("Font cannot render CJK characters");
}
```

### Multiple Fonts

```typescript
const latinFont = await pdf.embedFont(helveticaBytes);
const cjkFont = await pdf.embedFont(notoSansCJKBytes);

// Use different fonts for different fields
nameField.setFont(latinFont);
addressField.setFont(cjkFont);
```

### Text Width Calculation

```typescript
const font = await pdf.embedFont(fontBytes);

// Get text width for layout calculations
const width = font.getTextWidth("Hello World", 12); // 12pt font size
```

### Complex Script Support (Optional)

```typescript
// User opts in to complex script support (Arabic, Hebrew, Indic)
import { initHarfBuzz } from "@aspect-build/harfbuzzjs";

const pdf = await PDF.load(bytes);

// Register HarfBuzz for complex scripts
const hb = await initHarfBuzz();
pdf.registerTextShaper(hb);

// Now Arabic text renders correctly with proper letter joining
const arabicFont = await pdf.embedFont(notoArabicBytes);
field.setFont(arabicFont);
field.setValue("مرحبا بالعالم");
```

Without HarfBuzz registration, Arabic/Indic text will render as disconnected glyphs (technically valid PDF, but visually wrong).

## Architecture

```
User provides TTF/OTF bytes
         │
         ▼
    ┌─────────────┐
    │ TTFParser   │  Parse font tables (custom, minimal)
    └─────────────┘
         │
         ▼
    ┌─────────────┐
    │ EmbeddedFont│  Track usage, get metrics
    └─────────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼ (optional)
┌────────┐  ┌─────────────┐
│Identity│  │ HarfBuzz    │  Text shaping for complex scripts
│Shaper  │  │ (WASM)      │  Arabic, Indic, ligatures
└────────┘  └─────────────┘
    │              │
    └──────┬───────┘
           ▼
    ┌─────────────┐
    │ TTFSubsetter│  Create minimal font (ported from fontbox)
    └─────────────┘
         │
         ▼
    ┌─────────────┐
    │ FontEmbedder│  Create PDF objects
    └─────────────┘
         │
         ▼
    PDF Font Dictionaries
```

### Key Components

| Component        | Responsibility                                                         |
| ---------------- | ---------------------------------------------------------------------- |
| **TTFParser**    | Parse TTF/OTF tables, extract metrics, map codepoints to glyphs        |
| **TextShaper**   | Interface for text shaping (IdentityShaper default, HarfBuzz optional) |
| **TTFSubsetter** | Create minimal font with only used glyphs                              |
| **EmbeddedFont** | User-facing API, tracks usage, coordinates encoding                    |
| **FontEmbedder** | Creates PDF font dictionary structure (Type0, CIDFont, FontDescriptor) |

### Two Encoding Modes

1. **Identity-H (default)**: Character codes = Unicode code points
   - Simple, works for most CJK
   - No shaping needed for non-complex scripts
2. **Shaped (with HarfBuzz)**: Character codes = glyph IDs
   - Required for: Arabic, Hebrew, Indic scripts, complex ligatures
   - User opts in by registering HarfBuzz

## PDF Structure Created

When a font is embedded, these PDF objects are created:

```
Type0 Font Dictionary
├── /Subtype /Type0
├── /BaseFont /ABCDEF+FontName
├── /Encoding /Identity-H
├── /DescendantFonts → [CIDFont]
└── /ToUnicode → Stream (CMap)

CIDFont Dictionary
├── /Subtype /CIDFontType2
├── /BaseFont /ABCDEF+FontName
├── /CIDSystemInfo (Adobe-Identity-0)
├── /FontDescriptor → FontDescriptor
├── /W [widths array]
└── /CIDToGIDMap /Identity

FontDescriptor
├── /FontName /ABCDEF+FontName
├── /Flags 4
├── /FontBBox [...]
├── /Ascent, /Descent, /CapHeight, etc.
└── /FontFile2 → Stream (subset TTF)
```

## File Structure

```
src/fonts/
├── index.ts               # Re-exports
├── ttf-parser.ts          # Minimal TTF parser
├── ttf-subsetter.ts       # Font subsetting (port from fontbox)
├── text-shaper.ts         # TextShaper interface + IdentityShaper
├── harfbuzz-shaper.ts     # Optional HarfBuzz integration
├── embedded-font.ts       # User-facing EmbeddedFont class
├── font-embedder.ts       # Create PDF objects
└── cmap-builder.ts        # Build cmap tables for subset
```

## Test Plan

### TTFParser

- Parse valid TTF and OTF fonts
- Reject invalid/corrupted fonts
- Extract metrics (unitsPerEm, ascent, descent, bbox)
- Map codepoints to glyph IDs (ASCII, CJK)
- Return 0 (.notdef) for missing characters
- Get advance widths

### TTFSubsetter

- Include .notdef by default
- Subset to only requested glyphs
- Handle composite glyphs (remap component references)
- Output valid, parseable TTF
- Deterministic output (same input = same output)

### TextShaper

- IdentityShaper maps codepoints directly
- HarfBuzzShaper handles ligatures and RTL scripts

### EmbeddedFont

- Encode text to hex string for PDF content streams
- Track used codepoints for subsetting
- Calculate text width
- Report whether font can encode given text

### FontEmbedder

- Create complete Type0 font structure
- Build correct /W widths array
- Generate ToUnicode CMap for text extraction
- Include subset tag in font name

### Integration

- Embed font → save → load → font renders correctly
- Text searchable/copyable via ToUnicode
- Only used glyphs in subset (verify file size)

### Variable Fonts

- Parse fvar table (axes and named instances)
- Parse gvar table (glyph variations)
- Apply axis values to produce static instance
- Default to font's default axis values if not specified
- Subset variable font same as static font after flattening

### Edge Cases

- Font with no OS/2 table
- Short vs long loca format
- Composite glyphs with nested components
- Very large fonts (>65535 glyphs)
- Empty text (no glyphs to embed)
- Font collections (.ttc) - extract single font

## Bundle Size Estimate

| Component      | Size (gzip) | Required |
| -------------- | ----------- | -------- |
| TTFParser      | ~5KB        | Yes      |
| TTFSubsetter   | ~8KB        | Yes      |
| IdentityShaper | ~1KB        | Yes      |
| FontEmbedder   | ~3KB        | Yes      |
| **Core Total** | **~17KB**   | -        |
| HarfBuzz WASM  | ~180KB      | Optional |

## PDFBox Fontbox Insights

PDFBox's fontbox module is self-contained (only depends on pdfbox-io for seekable reading) and provides a solid reference:

### Patterns to Adopt

| Pattern                     | Rationale                                               |
| --------------------------- | ------------------------------------------------------- |
| Lazy table loading          | Tables parsed on first access, not all at once          |
| Table directory as registry | Parse directory first, load tables by tag on demand     |
| Factory for table types     | Switch on tag to create appropriate parser              |
| Sorted set for GIDs         | Enables O(log n) GID remapping during subsetting        |
| Composite resolution loop   | Run until no new component GIDs discovered              |
| Preserve unknown tables     | Copy tables we don't understand for round-trip fidelity |

### Patterns to Avoid

| Pattern                 | Issue                                                          |
| ----------------------- | -------------------------------------------------------------- |
| Excessive inheritance   | OpenTypeFont extends TrueTypeFont creates confusion            |
| Incomplete GSUB         | Types 5/6 not implemented, no GPOS - defer to HarfBuzz instead |
| Missing bounds checking | Some parsers trust input too much                              |

### Notable Gaps in Fontbox

- **No variable font support** (fvar, avar, gvar, STAT tables)
- **No CFF2 support** (throws for CFF2 fonts)
- **No GPOS** (kerning, mark positioning)
- **No bidirectional algorithm**

We should address variable fonts since they're increasingly common.

## Variable Font Handling

Variable fonts contain multiple styles (weights, widths, etc.) in a single file. PDFs don't support variable fonts natively, so we must flatten to a static instance.

### Approach

1. Parse variation tables: `fvar` (axes), `avar` (axis mappings), `gvar` (glyph variations)
2. Accept axis values from user (e.g., `{ weight: 700, width: 100 }`)
3. Apply variations to glyph outlines and metrics
4. Output static TTF with baked-in values

### Usage

```typescript
const font = await pdf.embedFont(variableFontBytes, {
  variations: { wght: 700, wdth: 100 }, // Bold, normal width
});
```

If no variations specified, use font's default axis values.

## Dependencies

- Plan 018: Text Encoding
- Plan 019: Font Reading (for parsing existing fonts in PDF)
- **No external runtime dependencies for core functionality**
- Optional: `harfbuzzjs` for complex script shaping

## Open Questions

1. Should we support font collections (.ttc)?
2. How to handle fonts that are already embedded (re-use vs re-embed)?
3. Should subset tag be deterministic or random?
4. Error handling: throw vs return null for unsupported fonts?
5. Variable font default: use default instance or require explicit axis values?
