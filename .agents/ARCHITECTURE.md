# Architecture

This document outlines the architecture of @libpdf/core. It's a living document that evolves as the library develops.

## Layer Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      High-Level API                             │
│                  (PDF, Page, Form, etc.)                        │
│                      [not yet built]                            │
├─────────────────────────────────────────────────────────────────┤
│                     DocumentParser                              │
│           Top-level orchestration and document access           │
├─────────────────────────────────────────────────────────────────┤
│                      Object Layer                               │
│    (PdfDict, PdfArray, PdfStream, PdfRef, PdfName, etc.)        │
├─────────────────────────────────────────────────────────────────┤
│                    Parser Components                            │
│  (TokenReader, ObjectParser, XRefParser, BruteForceParser)      │
├─────────────────────────────────────────────────────────────────┤
│                       Filters                                   │
│         (Flate, LZW, ASCII85, ASCIIHex, etc.)                   │
├─────────────────────────────────────────────────────────────────┤
│                      I/O Layer                                  │
│                       (Scanner)                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Planned High-Level API

```typescript
import { PDF } from "@libpdf/core";

// Loading
const pdf = await PDF.load(bytes);

// Pages — lazy collection with explicit .at() access
const pages = pdf.getPages();
const cover = pages.at(0);
const back = pages.last();

// Forms — discriminated getters return specific field types
const form = pdf.getForm();
form.getText("name")?.setValue("John Doe");
form.getCheckbox("agreed")?.check();

// Adding pages
const newPage = pdf.addPage({ size: "A4" });
newPage.drawText("Hello", { x: 50, y: 700, size: 24 });

// Saving
await pdf.save();                        // Full rewrite
await pdf.save({ incremental: true });   // Append only
```

---

## Implemented Components

### I/O Layer (`src/io/`)

**Scanner** — The lowest-level byte reader for PDF parsing.

- Wraps a `Uint8Array` with position tracking
- Returns `-1` for EOF (C-style sentinel)
- Provides `peek()`, `peekAt()`, `advance()`, `match()`, `moveTo()`
- Position is readable/writable for backtracking
- No PDF-specific concepts — just bytes

### Objects Layer (`src/objects/`)

PDF's COS (Carousel Object System) object types. All types have a discriminated `type` field.

| Type | Description | Example |
|------|-------------|---------|
| `PdfNull` | Null value | `null` |
| `PdfBool` | Boolean | `true`, `false` |
| `PdfNumber` | Integer or real | `42`, `-3.14` |
| `PdfName` | Name (interned) | `/Type`, `/Page` |
| `PdfString` | Literal or hex string | `(Hello)`, `<48656C6C6F>` |
| `PdfRef` | Indirect reference (interned) | `1 0 R` |
| `PdfArray` | Array of objects | `[1 2 3]` |
| `PdfDict` | Dictionary | `<< /Type /Page >>` |
| `PdfStream` | Dict + binary data | `<< /Length 5 >> stream...` |

**Design decisions:**
- `PdfName` and `PdfRef` use interning for memory efficiency
- Containers store `PdfRef` directly (no auto-dereferencing)
- Mutable containers to support PDF modification
- `PdfStream` extends `PdfDict` with stream data and filter decoding

### Filters Layer (`src/filters/`)

Stream filter implementations for encoding/decoding.

| Filter | Status | Notes |
|--------|--------|-------|
| FlateDecode | ✅ Full | zlib compression with predictor support |
| LZWDecode | ✅ Full | Including /EarlyChange parameter |
| ASCII85Decode | ✅ Full | |
| ASCIIHexDecode | ✅ Full | |
| RunLengthDecode | ✅ Full | |
| DCTDecode | ⚠️ Passthrough | JPEG — returns raw data |
| CCITTFaxDecode | ⚠️ Passthrough | Fax — returns raw data |
| JBIG2Decode | ⚠️ Passthrough | Returns raw data |
| JPXDecode | ⚠️ Passthrough | JPEG2000 — returns raw data |

**FilterPipeline** orchestrates filter chains. Filters are applied in order for decoding, reverse order for encoding.

### Parser Layer (`src/parser/`)

```
DocumentParser                    ← Top-level orchestration
       │
       ├── XRefParser             ← Parse xref tables and streams
       ├── IndirectObjectParser   ← Parse "N M obj...endobj"
       ├── ObjectStreamParser     ← Extract objects from ObjStm
       └── BruteForceParser       ← Recovery when xref fails
              │
              ▼
       ObjectParser               ← 2-token lookahead recursive descent
              │
              ▼
       TokenReader                ← PDF tokenization
              │
              ▼
       Scanner                    ← Byte-level reading
```

#### TokenReader

Tokenizes PDF syntax on-demand from a Scanner.

- Handles whitespace and `%` comments
- Produces tokens: `number`, `name`, `string`, `keyword`, `delimiter`, `eof`
- Lenient parsing: tolerates malformed numbers, unbalanced hex strings, etc.

#### ObjectParser

Recursive descent parser with 2-token lookahead.

- Parses any PDF object: primitives, arrays, dicts
- Distinguishes `1 0 R` (reference) from `1 0` (two numbers) via lookahead
- Recovery mode for truncated files

#### IndirectObjectParser

Parses indirect object definitions: `N M obj ... endobj`

- Handles streams with `stream`/`endstream` keywords
- Resolves indirect `/Length` references
- Lenient with missing `endstream` markers

#### ObjectStreamParser

Parses compressed object streams (`/Type /ObjStm`, PDF 1.5+).

- Decompresses stream data via FilterPipeline
- Parses index section (N pairs of `objNum offset`)
- Extracts individual objects by index

#### XRefParser

Parses cross-reference tables and streams.

- **Table format**: Traditional `xref` ... `trailer` format
- **Stream format**: PDF 1.5+ binary xref streams (`/Type /XRef`)
- Auto-detects format at given offset
- Follows `/Prev` chain for incremental updates

#### BruteForceParser

Recovery parser for corrupted PDFs.

- Scans entire file for `N M obj` patterns
- Rebuilds xref from discovered objects
- Extracts objects from object streams (ObjStm)
- Finds document root (Catalog or Pages fallback)

#### DocumentParser

Top-level orchestrator for PDF document loading.

- Parses header for PDF version
- Loads xref chain via XRefParser
- Falls back to BruteForceParser on failure
- Provides lazy object loading with caching
- Walks page tree for accurate page counts

```typescript
interface ParsedDocument {
  version: string;
  trailer: PdfDict;
  xref: Map<number, XRefEntry>;
  warnings: string[];

  getObject(ref: PdfRef): Promise<PdfObject | null>;
  getCatalog(): Promise<PdfDict | null>;
  getPageCount(): Promise<number>;
  getPages(): Promise<PdfRef[]>;
}
```

---

## Data Flow

### Opening a PDF

```
Uint8Array
    │
    ▼
DocumentParser.parse()
    │
    ├─► parseHeader() ─► version string
    │
    ├─► XRefParser.findStartXRef()
    │       │
    │       ▼
    │   XRefParser.parseAt(offset)
    │       ├─► parseTable() (traditional)
    │       └─► parseStream() (PDF 1.5+)
    │
    └─► On failure: BruteForceParser.recover()
            ├─► scanForObjects()
            ├─► extractFromObjectStreams()
            └─► findRoot()
```

### Loading an Object

```
PdfRef(1, 0)
    │
    ▼
ParsedDocument.getObject()
    │
    ├─► Check cache ─► hit ─► return
    │
    └─► Lookup in xref
            │
            ├─► "uncompressed" ─► IndirectObjectParser
            │
            └─► "compressed" ─► ObjectStreamParser
```

---

## Design Principles

### Lenient Parsing
Be super lenient with malformed PDFs. Fall back to brute-force parsing when standard parsing fails. Prioritize opening files over strict spec compliance.

### Layered Recovery
1. **Normal path**: Follow xref chain from `startxref`
2. **Lenient xref**: Skip corrupted entries, continue with valid ones
3. **Brute-force**: Scan entire file, rebuild xref from scratch

### Lazy Loading
Parse objects on-demand, not all at once. Opening a 1000-page PDF should be instant.

### No Proxy Magic
Collections use explicit methods like `.at(index)` rather than Proxy-based bracket notation.

### Incremental Updates
Support appending changes without rewriting the entire file. Critical for preserving digital signatures.

### Two API Layers
- **High-level**: `@libpdf/core` — PDF, Page, Form (planned)
- **Low-level**: `@libpdf/core/objects` — PdfDict, PdfArray, PdfStream, etc.

### Async-First
All I/O and decompression operations return Promises.

### Memory Efficiency
- Interning for frequently repeated values (`PdfName`, `PdfRef`)
- Lazy object loading with caching
- Object stream parsing only when needed

---

## Reference Mapping

When implementing, consult the reference libraries in `checkouts/`:

| Area | Best Reference |
|------|----------------|
| Parsing, malformed PDFs | pdf.js (`src/core/`) |
| TypeScript API patterns | pdf-lib (`src/`) |
| Feature coverage, edge cases | PDFBox (`pdfbox/src/main/java/`) |

---

## Not Yet Built

- [ ] High-level API (PDF, Page, Form classes)
- [ ] Encryption/decryption support
- [ ] Linearized PDF fast-open
- [ ] Incremental update writing
- [ ] Content stream parsing
- [ ] Text extraction
- [ ] Font handling
- [ ] Annotation support
- [ ] Digital signatures
