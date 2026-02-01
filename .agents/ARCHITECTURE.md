# Architecture

This document outlines the core architecture of @libpdf/core.

## Layer Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                      High-Level API                              │
│   (PDF, PDFPage, PDFForm, PDFAttachments, PDFSignature, PDFImage)│
├──────────────────────────────────────────────────────────────────┤
│                    Annotations Layer                             │
│   (PDFAnnotation types, appearance generation, flattening)       │
├──────────────────────────────────────────────────────────────────┤
│                       Text Layer                                 │
│     (TextExtractor, TextState, LineGrouper, text-search)         │
├──────────────────────────────────────────────────────────────────┤
│                      Drawing Layer                               │
│    (DrawingContext, PathBuilder, TextLayout, ColorHelpers)       │
├──────────────────────────────────────────────────────────────────┤
│                     Document Layer                               │
│    (ObjectRegistry, ObjectCopier, AcroForm, ChangeCollector)     │
├──────────────────────────────────────────────────────────────────┤
│                     Signatures Layer                             │
│  (Signers, CMS Formats, Timestamp, Revocation, DSS, Placeholder) │
├──────────────────────────────────────────────────────────────────┤
│                       Images Layer                               │
│            (JPEG embedding, PNG embedding, PDFImage)             │
├──────────────────────────────────────────────────────────────────┤
│                       Fonts Layer                                │
│    (FontFactory, FontEmbedder, SimpleFont, CompositeFont)        │
├──────────────────────────────────────────────────────────────────┤
│                      Fontbox Layer                               │
│         (TTF/CFF/Type1 parsing, subsetting, encoding)            │
├──────────────────────────────────────────────────────────────────┤
│                       Layers (OCG)                               │
│            (Layer detection, flattening)                         │
├──────────────────────────────────────────────────────────────────┤
│                     DocumentParser                               │
│           Top-level orchestration and document access            │
├──────────────────────────────────────────────────────────────────┤
│                     Security Layer                               │
│   (StandardSecurityHandler, Ciphers, Key Derivation, Encryption) │
├──────────────────────────────────────────────────────────────────┤
│                      Object Layer                                │
│    (PdfDict, PdfArray, PdfStream, PdfRef, PdfName, etc.)         │
├──────────────────────────────────────────────────────────────────┤
│                    Parser Components                             │
│  (TokenReader, ObjectParser, XRefParser, BruteForceParser)       │
├──────────────────────────────────────────────────────────────────┤
│                       Filters                                    │
│         (Flate, LZW, ASCII85, ASCIIHex, etc.)                    │
├──────────────────────────────────────────────────────────────────┤
│                       Writer                                     │
│        (PDFWriter, Serializer, XRefWriter)                       │
├──────────────────────────────────────────────────────────────────┤
│                      I/O Layer                                   │
│              (Scanner, BinaryWriter)                             │
└──────────────────────────────────────────────────────────────────┘
```

## Key Components

### I/O Layer (`src/io/`)

**Scanner** — Byte reader for PDF parsing with position tracking.

**BinaryWriter** — Sequential byte writer for PDF output.

### Objects Layer (`src/objects/`)

PDF COS (Carousel Object System) types with discriminated `type` fields:

| Type        | Description                   |
| ----------- | ----------------------------- |
| `PdfNull`   | Null value                    |
| `PdfBool`   | Boolean                       |
| `PdfNumber` | Integer or real               |
| `PdfName`   | Name (interned)               |
| `PdfString` | Literal or hex string         |
| `PdfRef`    | Indirect reference (interned) |
| `PdfArray`  | Array of objects              |
| `PdfDict`   | Dictionary                    |
| `PdfStream` | Dict + binary data            |

### Filters Layer (`src/filters/`)

Stream filter implementations:

| Filter          | Status      |
| --------------- | ----------- |
| FlateDecode     | Full        |
| LZWDecode       | Full        |
| ASCII85Decode   | Full        |
| ASCIIHexDecode  | Full        |
| RunLengthDecode | Full        |
| DCTDecode       | Passthrough |
| CCITTFaxDecode  | Passthrough |
| JBIG2Decode     | Passthrough |
| JPXDecode       | Passthrough |

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

### Writer Layer (`src/writer/`)

- **PDFWriter**: Orchestrates complete and incremental PDF writing
- **Serializer**: Serializes PDF objects to bytes
- **XRefWriter**: Generates xref tables/streams for output

### Security Layer (`src/security/`)

Encryption/decryption for Standard security handler (R2-R6):

| Revision | Algorithm      | Key Size   |
| -------- | -------------- | ---------- |
| R2       | RC4            | 40-bit     |
| R3       | RC4            | 40-128 bit |
| R4       | RC4 or AES-128 | 128-bit    |
| R5       | AES-256        | 256-bit    |
| R6       | AES-256        | 256-bit    |

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
    ├─► If /Encrypt in trailer:
    │       │
    │       ▼
    │   StandardSecurityHandler
    │       ├─► parseEncryptionDict()
    │       ├─► authenticate(credentials)
    │       └─► Store handler for object decryption
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
            │       │
            │       └─► If encrypted: decrypt strings/streams
            │
            └─► "compressed" ─► ObjectStreamParser
                    │
                    └─► Decompress stream (already decrypted)
```

### Saving a PDF

```
PDF.save()
    │
    ├─► incremental: false (or not possible)
    │       │
    │       ▼
    │   writeComplete()
    │       ├─► Serialize all objects
    │       ├─► Build xref table/stream
    │       └─► Write header + objects + xref + trailer
    │
    └─► incremental: true
            │
            ▼
        writeIncremental()
            ├─► Append modified/new objects
            ├─► Build new xref referencing old
            └─► Append xref + trailer
```

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

- **High-level**: `PDF`, `PDFPage`, `PDFForm` — simple, task-focused
- **Low-level**: `PdfDict`, `PdfArray`, `PdfStream` — full control

### Memory Efficiency

- Interning for frequently repeated values (`PdfName`, `PdfRef`)
- Lazy object loading with caching
- Object stream parsing only when needed
- Font subsetting for embedded fonts

## Reference Libraries

Cross-reference these implementations in `checkouts/`:

| Area                         | Best Reference                   |
| ---------------------------- | -------------------------------- |
| Parsing, malformed PDFs      | pdf.js (`src/core/`)             |
| TypeScript API patterns      | pdf-lib (`src/`)                 |
| Feature coverage, edge cases | PDFBox (`pdfbox/src/main/java/`) |
