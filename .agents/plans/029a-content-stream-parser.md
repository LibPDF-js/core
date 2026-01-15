# 029a: Content Stream Parser

## Problem Statement

PDF content streams contain a sequence of operators and operands that define what appears on a page. We need to parse these streams for:

1. **Layer removal (029)** - Remove `/OC ... BDC ... EMC` marked content blocks
2. **Text extraction** - Read text operators (`Tj`, `TJ`, `'`, `"`)
3. **Content modification** - Insert/remove/modify operators
4. **SVG rendering** - Convert SVG paths to PDF operators
5. **Drawing API** - Programmatically add content

Currently we can only BUILD content streams (via `ContentStreamBuilder`), not PARSE them.

## Goals

- Parse content streams into structured operator/operand representation
- Support round-trip: parse -> modify -> serialize
- Handle all standard PDF operators
- Handle inline images (BI/ID/EI) correctly
- Provide building blocks for higher-level features
- Interoperate with existing `Operator` class for mixed parsed/generated content

## Non-Goals (This Plan)

- Text extraction logic (separate feature using this parser)
- SVG conversion logic (separate feature using this parser)
- Graphics state tracking/interpretation
- Rendering or visual output
- Byte-for-byte round-trip fidelity (semantic equivalence is sufficient)
- Streaming/lazy parsing (may add later if needed)

---

## Design Decisions

### Tokenizer: Compose with TokenReader

`ContentTokenizer` wraps and delegates to the existing `TokenReader` for basic token parsing (numbers, names, strings, arrays, dictionaries). Post-processes `KeywordToken` to distinguish operators from keywords (`true`/`false`/`null`).

### Inline Image EI Detection: Port pdf.js

The pdf.js implementation is battle-tested. Key features:

- Filter-specific detection (DCT looks for JPEG EOI `0xFFD9`, ASCII85 looks for `~>`)
- Default heuristic: scan for `EI` + whitespace, verify next bytes are ASCII, validate a known PDF operator follows with correct argument count
- Recovery: remember last potential EI position if stream ends unexpectedly

### Operation Representation: Structured

Parser returns `ParsedOperation[]` where each operation bundles operator + its operands. More ergonomic than a flat token list for filtering and modification.

### Error Handling: Lenient with Warnings

Parser collects warnings in an array, continues best-effort. Never throws except for truly unrecoverable errors. Matches project principle of "super lenient with malformed PDFs."

### Serialization: Normalized Output

Always output canonical format (single space between operands, newline after each operation). Semantic equivalence is sufficient; byte-identical round-trip is not a goal.

### Type Integration: Serializer Accepts Both Types

`ContentStreamSerializer.serialize()` accepts both `ParsedOperation` (from parsing) and `Operator` (from builder API), allowing mixed workflows.

---

## Module Structure

```
src/content/
  content-tokenizer.ts        # Wraps TokenReader, adds operator detection
  content-stream-parser.ts    # Tokens -> ParsedOperation[]
  content-stream-serializer.ts # Operations -> bytes
  inline-image.ts             # EI detection (pdf.js port)
  types.ts                    # ContentToken, ParsedOperation types
```

---

## Desired Usage

### Basic Parsing

```typescript
const { operations, warnings } = new ContentStreamParser(streamBytes).parse();

for (const op of operations) {
  console.log(op.operator, op.operands);
}
```

### Layer Removal

```typescript
const { operations } = new ContentStreamParser(streamBytes).parse();

// Filter out OC marked content blocks
const filtered = filterMarkedContent(operations, tag => tag === "OC");

const newBytes = ContentStreamSerializer.serialize(filtered);
```

### Mixed Parsed + Generated Content

```typescript
// Parse existing content
const { operations } = new ContentStreamParser(existingBytes).parse();

// Build watermark using existing Operator API
const watermark = [
  pushGraphicsState(),
  setNonStrokingGray(0.8),
  beginText(),
  showText(PdfString.of("DRAFT")),
  endText(),
  popGraphicsState(),
];

// Serialize both together
const newBytes = ContentStreamSerializer.serialize([...operations, ...watermark]);
```

### Text Extraction (Future Consumer)

```typescript
const { operations } = new ContentStreamParser(streamBytes).parse();

for (const op of operations) {
  if (op.operator === "Tj") {
    const text = op.operands[0]; // string token
    yield decodeText(text.value, currentFont);
  }
  if (op.operator === "Tf") {
    currentFont = resolveFont(op.operands);
  }
}
```

---

## Types

```typescript
type ContentToken =
  | { type: "number"; value: number }
  | { type: "name"; value: string }
  | { type: "string"; value: Uint8Array; hex: boolean }
  | { type: "array"; items: ContentToken[] }
  | { type: "dict"; entries: Map<string, ContentToken> }
  | { type: "bool"; value: boolean }
  | { type: "null" };

interface ParsedOperation {
  operator: string;
  operands: ContentToken[];
}

interface InlineImageOperation {
  operator: "BI";
  params: Map<string, ContentToken>;
  data: Uint8Array;
}

type AnyOperation = ParsedOperation | InlineImageOperation;

interface ParseResult {
  operations: AnyOperation[];
  warnings: string[];
}
```

---

## Utility Functions

Separate from core parser, for common operations:

- `filterMarkedContent(ops, shouldRemove)` - Remove BMC/BDC/EMC blocks by tag
- `extractTextOperations(ops)` - Get only Tj/TJ/'/" operations

---

## Test Strategy

### Unit Tests

- Tokenizer handles all token types
- Parser bundles operands with operators correctly
- Inline image parsing with various filters
- Round-trip produces semantically equivalent result
- Malformed input triggers warnings, not exceptions

### Integration Tests

- Parse real content streams from fixtures
- Layer removal produces valid output
- Mixed parsed + generated content serializes correctly

### Fixtures Needed

- Inline images (DCT, ASCII85, raw)
- Inline images with false-positive `EI` in data
- Marked content blocks (nested)
- Malformed streams (trailing operands, missing EI)

---

## References

- PDF 1.7 Specification, Chapter 9 (Content Streams and Operators)
- pdf.js: `src/core/parser.js` (inline image detection)
- PDFBox: `PDFStreamParser.java`, `ContentStreamWriter.java`
