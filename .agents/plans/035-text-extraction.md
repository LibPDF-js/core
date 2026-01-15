# 035: Text Extraction

## Problem Statement

Users need to extract text content from PDF pages with position information. Key use cases:

1. **Search and locate** — Find text patterns (e.g., `{{ field }}`) and get their bounding boxes for replacement or annotation
2. **Plain text extraction** — Get readable text for indexing, accessibility, or processing
3. **Structured extraction** — Access text by line/span with font metadata for layout analysis

This is a Tier 3 feature per GOALS.md, supporting search, indexing, and accessibility.

## Scope

### In Scope

- Extract text content from page content streams
- Track text positioning (bounding boxes)
- Group text into lines and spans based on baseline/font
- Support string and regex search with position results
- Handle common text operators (Tj, TJ, ', ")
- Basic Unicode mapping via ToUnicode CMaps and font encodings
- Page-level and document-level extraction/search APIs

### Out of Scope

- Complex layout analysis (multi-column detection, tables)
- Right-to-left and vertical text layout
- Marked content / tagged PDF structure
- Text extraction from annotations (separate feature)
- OCR or image-based text
- Hyphenation joining across lines

## Dependencies

- **Content stream parser** — Already exists at `src/content/`
- **Font layer** — Already exists at `src/fonts/` with `decode()` and ToUnicode support
- **Graphics state tracking** — Needs CTM (current transformation matrix) integration

## Desired API

### Basic Usage

```typescript
const pdf = await PDF.load(bytes);
const page = pdf.getPage(0);

// Extract all text with positions
const pageText = await page.extractText();
console.log(pageText.text); // "Hello World\nSecond line..."

// Access structured content
for (const line of pageText.lines) {
  console.log(`Line at y=${line.baseline}: "${line.text}"`);
}
```

### Search

```typescript
// String search on a page
const matches = await page.findText("{{ name }}");
for (const match of matches) {
  console.log(`Found at:`, match.bbox); // { x, y, width, height }
}

// Regex search
const fields = await page.findText(/\{\{\s*\w+\s*\}\}/g);

// Document-wide search
const allMatches = await pdf.findText("invoice", {
  pages: [0, 1, 2],
  caseSensitive: false,
});
```

### Template Replacement Pattern

```typescript
const placeholders = await pdf.findText(/\{\{\s*(\w+)\s*\}\}/g);

for (const match of placeholders) {
  const fieldName = match.text.replace(/[{}]/g, "").trim();
  const value = data[fieldName];

  const page = pdf.getPage(match.pageIndex);
  // Cover original text with white rectangle
  page.drawRectangle({ ...match.bbox, color: rgb(1, 1, 1) });
  // Draw replacement text
  page.drawText(value, { x: match.bbox.x, y: match.bbox.y, fontSize: 12 });
}
```

## Types

```typescript
/** Rectangle in PDF coordinates (origin at bottom-left) */
interface BoundingBox {
  x: number; // Left edge
  y: number; // Bottom edge
  width: number;
  height: number;
}

/** Single character with position */
interface ExtractedChar {
  char: string;
  bbox: BoundingBox;
  fontSize: number;
  fontName: string;
  baseline: number;
}

/** Text span (same font/size on same line) */
interface TextSpan {
  text: string;
  bbox: BoundingBox;
  chars: ExtractedChar[];
  fontSize: number;
  fontName: string;
}

/** Line of text (multiple spans on same baseline) */
interface TextLine {
  text: string;
  bbox: BoundingBox;
  spans: TextSpan[];
  baseline: number;
}

/** Full page extraction result */
interface PageText {
  pageIndex: number;
  width: number;
  height: number;
  lines: TextLine[];
  text: string; // Plain text (lines joined with \n)
}

/** Search match */
interface TextMatch {
  text: string;
  bbox: BoundingBox;
  pageIndex: number;
  charBoxes: BoundingBox[]; // Per-character boxes for highlighting
}

/** Extraction options */
interface ExtractTextOptions {
  /** Include individual character positions (default: true for search support) */
  includeChars?: boolean;
}

/** Search options */
interface FindTextOptions {
  /** Pages to search (default: all) */
  pages?: number[];
  /** Case-sensitive matching (default: true) */
  caseSensitive?: boolean;
  /** Match whole words only (default: false) */
  wholeWord?: boolean;
}
```

## Architecture

### Components

```
PDFPage.extractText()
        │
        ▼
TextExtractor
        │
        ├─► ContentStreamParser (existing)
        │
        ├─► TextState (tracks Tm, Tc, Tw, etc.)
        │
        ├─► Font.decode() (existing)
        │
        └─► LineGrouper (groups chars into lines/spans)
```

### TextState

Tracks text-related graphics state during content stream processing:

- **Tm** — Text matrix (position/transform)
- **Tlm** — Text line matrix (start of current line)
- **Tf** — Current font and size
- **Tc** — Character spacing
- **Tw** — Word spacing
- **Tz** — Horizontal scaling
- **TL** — Leading (line spacing)
- **Ts** — Text rise (superscript/subscript)
- **CTM** — Current transformation matrix (from graphics state)

### Text Operators to Handle

| Operator | Description                        |
| -------- | ---------------------------------- |
| BT/ET    | Begin/end text object              |
| Tf       | Set font and size                  |
| Tm       | Set text matrix                    |
| Td       | Move to next line (relative)       |
| TD       | Move and set leading               |
| T\*      | Move to next line (using TL)       |
| Tc       | Set character spacing              |
| Tw       | Set word spacing                   |
| Tz       | Set horizontal scaling             |
| TL       | Set leading                        |
| Ts       | Set text rise                      |
| Tj       | Show string                        |
| TJ       | Show strings with positioning      |
| '        | Move to next line and show string  |
| "        | Set spacing, move, and show string |

### Coordinate Transformation

Character positions must account for:

1. **Text matrix (Tm)** — Position within text object
2. **CTM** — Page-level transformation (rotation, scaling)
3. **Font metrics** — Glyph widths, ascender/descender

Final position = CTM × Tm × glyph_position

### Line Grouping Algorithm

1. Sort characters by baseline Y coordinate (with tolerance for slight variations)
2. Within each baseline group, sort by X coordinate
3. Detect spans based on font/size changes
4. Join characters into text strings, inferring spaces from gaps

Space detection heuristic:

- If gap between characters > 0.3 × font size, insert space
- Configurable threshold for different PDF generators

## Test Plan

### Unit Tests

- Parse text operators correctly (Tj, TJ, Td, Tm, etc.)
- Calculate character positions with various transforms
- Group characters into lines/spans correctly
- Space detection between words
- Handle font changes mid-line

### Integration Tests

- Extract text from simple single-page PDF
- Extract text with multiple fonts/sizes
- Extract text from rotated pages
- Search for literal strings
- Search with regex patterns
- Document-wide search across pages
- Handle PDFs with missing ToUnicode (use font encoding fallback)

### Fixtures Needed

- `fixtures/text/simple.pdf` — Basic text content
- `fixtures/text/multiline.pdf` — Multiple lines and paragraphs
- `fixtures/text/fonts.pdf` — Multiple fonts and sizes
- `fixtures/text/rotated.pdf` — Rotated page content
- `fixtures/text/positioned.pdf` — Text with TJ positioning adjustments
- `fixtures/text/template.pdf` — Document with `{{ placeholder }}` markers

## Open Questions

1. **Reading order**: Should we attempt to detect multi-column layouts, or just use raw position order?
   - _Initial approach_: Position order (left-to-right, top-to-bottom). Complex layout analysis is out of scope.

2. **Whitespace handling**: How to handle multiple spaces, tabs, and form feeds?
   - _Initial approach_: Normalize to single spaces. Provide `preserveWhitespace` option if needed.

3. **Ligatures**: How to handle fi, fl ligatures in glyph names?
   - _Initial approach_: Map via ToUnicode if available, otherwise return ligature character.

4. **CID fonts without ToUnicode**: Some PDFs have CID fonts without ToUnicode CMaps.
   - _Initial approach_: Return replacement character or empty string. Log warning.

## Risks

- **Performance**: Large documents may have many text objects. Consider lazy extraction per page.
- **Font encoding edge cases**: Legacy PDFs may use obscure encodings. May need fallback strategies.
- **Accuracy**: Bounding boxes depend on font metrics which may be incomplete or inaccurate in some PDFs.

## Implementation Phases

### Phase 1: Core Extraction

- TextState class
- Process text operators
- Character-level extraction with positions

### Phase 2: Grouping

- Line grouping by baseline
- Span grouping by font
- Space detection

### Phase 3: Search

- String search with bbox
- Regex search
- Document-wide search API

### Phase 4: API Integration

- `PDFPage.extractText()`
- `PDFPage.findText()`
- `PDF.findText()` (document-wide)
