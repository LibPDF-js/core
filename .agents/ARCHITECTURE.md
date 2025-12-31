# Architecture

This document outlines the architecture of @libpdf/core. It's a living document that will evolve as the library develops.

## Layers

```
┌─────────────────────────────────────────────────────────────┐
│                      High-Level API                         │
│                  (PDF, Page, Form, etc.)                    │
├─────────────────────────────────────────────────────────────┤
│                      Object Layer                           │
│    (PdfDict, PdfArray, PdfStream, PdfRef, PdfName, etc.)    │
├─────────────────────────────────────────────────────────────┤
│                    Parser / Writer                          │
├─────────────────────────────────────────────────────────────┤
│                      I/O Abstraction                        │
└─────────────────────────────────────────────────────────────┘
```

- **High-Level API**: User-friendly interface — `import { PDF } from "@libpdf/core"`
- **Object Layer**: Low-level PDF objects — `import { PdfDict, PdfRef } from "@libpdf/core/objects"`
- **Parser / Writer**: Tokenization, xref handling, serialization, incremental updates
- **I/O**: Abstraction over file/stream access for cross-platform compatibility

## High-Level API Usage

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

## Design Decisions

### Lenient Parsing
Be super lenient with malformed PDFs. Fall back to brute-force parsing when standard parsing fails. Prioritize opening files over strict spec compliance.

### Lazy Loading
Parse objects on-demand, not all at once. Opening a 1000-page PDF should be instant — pages are parsed when accessed via `.at(index)`.

### No Proxy Magic
Collections use explicit methods like `.at(index)` rather than Proxy-based bracket notation. Clearer behavior, easier debugging.

### Incremental Updates
Support appending changes without rewriting the entire file. Critical for preserving digital signatures and large file performance.

### Two API Layers
- **High-level**: `@libpdf/core` — PDF, Page, Form
- **Low-level**: `@libpdf/core/objects` — PdfDict, PdfArray, PdfStream, PdfRef, PdfName

### Async-First
All I/O operations return Promises. Enables streaming and keeps the API consistent.

## Reference Mapping

When implementing, consult the reference libraries in `checkouts/`:

| Area | Best Reference |
|------|----------------|
| Parsing, malformed PDFs | pdf.js (`src/core/`) |
| TypeScript API patterns | pdf-lib (`src/`) |
| Feature coverage, edge cases | PDFBox (`pdfbox/src/main/java/`) |

## Not Yet Designed

- Font handling and text extraction
- Content stream operators
- Annotation support
- Encryption/decryption
- Digital signatures
