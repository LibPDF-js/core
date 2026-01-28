# Architecture

This document outlines the architecture of @libpdf/core. It's a living document that evolves as the library develops.

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

---

## High-Level API (`src/api/`)

The user-facing API for common PDF operations.

### PDF Class

Main entry point for loading, creating, and manipulating PDF documents.

```typescript
import { PDF } from "@libpdf/core";

// Loading
const pdf = await PDF.load(bytes);
const pdf = await PDF.load(bytes, { credentials: "password" });

// Creating
const pdf = PDF.create();

// Merging
const merged = await PDF.merge([bytes1, bytes2, bytes3]);

// Pages
const pages = await pdf.getPages();
const page = await pdf.getPage(0);
const count = pdf.getPageCount();
pdf.addPage({ size: "letter" });
pdf.addPage({ width: 400, height: 600 });
pdf.insertPage(0, pageDict);
pdf.removePage(0);
pdf.movePage(0, 2);

// Extract and copy pages
const extracted = await pdf.extractPages([0, 2, 4]);
await pdf.copyPagesFrom(otherPdf, [0, 1]);

// Page embedding (for overlays, watermarks)
const embedded = await pdf.embedPage(otherPdf, 0);
page.drawPage(embedded, { x: 50, y: 100, scale: 0.5, opacity: 0.3 });

// Forms
const form = await pdf.getForm();
form?.fill({ name: "John", agreed: true });
await form?.flatten();

// Fonts
const font = pdf.embedFont(fontBytes);
const fontRef = pdf.getFontRef(font);

// Attachments
await pdf.addAttachment("doc.pdf", data, { description: "Attached PDF" });
const attachment = await pdf.getAttachment("doc.pdf");

// Saving
const bytes = await pdf.save(); // Full rewrite
const bytes = await pdf.save({ incremental: true }); // Append only
```

### PDFPage Class

Wrapper for individual pages with dimension and drawing methods.

```typescript
// Dimensions
page.width; // Points, rotation-aware
page.height;
page.rotation; // 0, 90, 180, 270

// Box accessors
page.getMediaBox();
page.getCropBox();
page.getTrimBox();
page.getBleedBox();
page.getArtBox();

// Modification
page.setRotation(90);

// Drawing
page.drawPage(embedded, { x, y, scale, opacity, background });
```

### PDFForm Class

Form filling, reading, and flattening.

```typescript
const form = await pdf.getForm();

// Field access
const fields = form.getFields();
const textField = form.getTextField("name");
const checkbox = form.getCheckbox("agree");
const radio = form.getRadioGroup("options");
const dropdown = form.getDropdown("country");

// Bulk fill
form.fill({
  name: "John Doe",
  agree: true,
  options: "option1",
});

// Read values
textField.getValue();
checkbox.isChecked();

// Write values
textField.setValue("New value");
checkbox.check();

// Appearance and flattening
await form.updateAppearances();
await form.flatten();
```

### PDFAttachments Class

Embedded file management.

```typescript
const attachments = pdf.attachments;
await attachments.add("file.pdf", data, { description: "..." });
await attachments.get("file.pdf");
await attachments.remove("file.pdf");
await attachments.list(); // Map<string, AttachmentInfo>
```

### PDFEmbeddedPage Class

Represents a page embedded as a Form XObject (for overlays/watermarks).

```typescript
const embedded = await pdf.embedPage(sourcePdf, 0);
embedded.ref; // PdfRef to the XObject
embedded.width; // Original page width
embedded.height; // Original page height
embedded.box; // Bounding box
```

---

## Drawing Layer (`src/api/drawing/`)

Content drawing API for adding visual elements to pages.

### PDFPage Drawing Methods

```typescript
// Shapes
page.drawRectangle({ x, y, width, height, color, borderColor, borderWidth, opacity, rotate });
page.drawLine({ start: { x, y }, end: { x, y }, color, thickness, dashArray, opacity });
page.drawCircle({ x, y, radius, color, borderColor, borderWidth, opacity });
page.drawEllipse({ x, y, xScale, yScale, color, borderColor, borderWidth, opacity });

// Text
page.drawText("Hello World", { x, y, font, fontSize, color, opacity, rotate });
page.drawText(longText, { x, y, font, fontSize, maxWidth, lineHeight, align });

// Images
const image = await pdf.embedImage(bytes);
page.drawImage(image, { x, y, width, height, opacity, rotate });

// Embedded pages (for overlays, watermarks)
const embedded = await pdf.embedPage(sourcePdf, 0);
page.drawPage(embedded, { x, y, scale, opacity, background });

// Custom paths
page
  .drawPath()
  .moveTo(100, 100)
  .lineTo(200, 150)
  .curveTo(250, 200, 300, 150, 350, 100)
  .close()
  .fill({ color: rgb(1, 0, 0) });
```

### Text Features

| Feature      | Description                                          |
| ------------ | ---------------------------------------------------- |
| `maxWidth`   | Automatic word wrapping at specified width           |
| `lineHeight` | Line spacing multiplier                              |
| `align`      | Text alignment: "left", "center", "right", "justify" |
| `rotate`     | Rotation in degrees around origin                    |

### Color Helpers

```typescript
import { rgb, cmyk, grayscale } from "@libpdf/core";

rgb(1, 0, 0); // Red in RGB
cmyk(0, 1, 1, 0); // Red in CMYK
grayscale(0.5); // 50% gray
```

---

## Document Layer (`src/document/`)

Internal components for document structure management.

### ObjectRegistry

Tracks all objects and their references in a document.

- Maps object numbers to objects
- Tracks which objects are modified (dirty)
- Assigns new object numbers for new objects
- Provides lookup by reference

### ObjectCopier

Deep-copies objects between documents, remapping references.

- Copies objects with full dependency graphs
- Remaps PdfRef values to new document
- Handles circular references
- Used by `copyPagesFrom()`, `extractPages()`, `embedPage()`

### ChangeCollector

Tracks modifications for incremental saves.

- Records new, modified, and deleted objects
- Determines what to write in incremental update
- Supports change detection via `hasChanges()`

### Forms Subsystem (`src/document/forms/`)

| Component             | Purpose                                                  |
| --------------------- | -------------------------------------------------------- |
| `AcroForm`            | Low-level AcroForm dictionary access                     |
| `FieldTree`           | Traverses form field hierarchy                           |
| `FormFlattener`       | Renders fields to page content and removes interactivity |
| `AppearanceGenerator` | Creates visual appearances for fields                    |
| `WidgetAnnotation`    | Widget annotation wrapper                                |
| `FormFont`            | Font resolution for form fields                          |

---

## Fonts Layer (`src/fonts/`)

PDF font handling for both reading existing fonts and embedding new ones.

### Font Types

| Class           | Description                                |
| --------------- | ------------------------------------------ |
| `SimpleFont`    | Type1, TrueType, and Standard 14 fonts     |
| `CompositeFont` | Type0 (CID) fonts with CIDFont descendants |
| `CIDFont`       | CIDFontType0 (CFF) and CIDFontType2 (TTF)  |
| `EmbeddedFont`  | In-memory font prepared for embedding      |

### FontFactory

Parses existing PDF font dictionaries into usable font objects.

```typescript
const font = await FontFactory.create(fontDict, getObject);
const width = font.getWidth(charCode);
const text = font.decode(bytes);
```

### FontEmbedder

Creates PDF objects for embedding TrueType/OpenType fonts.

- Subsets fonts to include only used glyphs
- Generates CIDFont + Type0 structure
- Builds ToUnicode CMap for text extraction
- Creates FontDescriptor with metrics

### Supporting Components

| Component          | Purpose                                        |
| ------------------ | ---------------------------------------------- |
| `CMap`             | Character code to CID/Unicode mapping          |
| `ToUnicode`        | ToUnicode CMap parsing                         |
| `ToUnicodeBuilder` | ToUnicode CMap generation                      |
| `WidthsBuilder`    | W array generation for CID fonts               |
| `FontDescriptor`   | Font metrics and flags                         |
| `Standard14`       | Built-in font metrics (Helvetica, Times, etc.) |

---

## Fontbox Layer (`src/fontbox/`)

Low-level font file parsing and manipulation. Ported from Apache PDFBox.

### TTF Module (`src/fontbox/ttf/`)

TrueType and OpenType font parsing.

| Component      | Purpose                                  |
| -------------- | ---------------------------------------- |
| `TTFParser`    | Parses TrueType font files               |
| `TTFSubsetter` | Creates subsets with selected glyphs     |
| `TrueTypeFont` | Parsed font data structure               |
| Table parsers  | head, hhea, hmtx, cmap, name, OS/2, etc. |

### CFF Module (`src/fontbox/cff/`)

Compact Font Format parsing (OpenType with CFF outlines).

| Component        | Purpose               |
| ---------------- | --------------------- |
| `CFFParser`      | Parses CFF font data  |
| `CFFSubsetter`   | Creates CFF subsets   |
| `CFFFont`        | Parsed CFF structure  |
| Type2 charstring | Glyph outline parsing |

### Type1 Module (`src/fontbox/type1/`)

PostScript Type 1 font support.

| Component     | Purpose                   |
| ------------- | ------------------------- |
| `Type1Parser` | Parses PFB/PFA font files |
| `Type1Font`   | Parsed Type1 structure    |

### AFM Module (`src/fontbox/afm/`)

Adobe Font Metrics parsing (for Standard 14 fonts).

### Encoding Module (`src/fontbox/encoding/`)

Character encoding tables (WinAnsi, MacRoman, Standard, etc.).

### CMap Module (`src/fontbox/cmap/`)

CMap file parsing for CID fonts.

---

## Parser Layer (`src/parser/`)

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

### DocumentParser

Top-level orchestrator for PDF document loading.

- Parses header for PDF version
- Loads xref chain via XRefParser
- Falls back to BruteForceParser on failure
- Initializes security handler if encrypted
- Provides lazy object loading with caching
- Walks page tree for accurate page counts

```typescript
interface ParsedDocument {
  version: string;
  trailer: PdfDict;
  xref: Map<number, XRefEntry>;
  warnings: string[];
  isEncrypted: boolean;
  isAuthenticated: boolean;

  getObject(ref: PdfRef): Promise<PdfObject | null>;
  getCatalog(): Promise<PdfDict | null>;
  getPageCount(): Promise<number>;
  getPages(): Promise<PdfRef[]>;
}
```

### XRefParser

Parses cross-reference tables and streams.

- **Table format**: Traditional `xref` ... `trailer` format
- **Stream format**: PDF 1.5+ binary xref streams (`/Type /XRef`)
- Auto-detects format at given offset
- Follows `/Prev` chain for incremental updates

### BruteForceParser

Recovery parser for corrupted PDFs.

- Scans entire file for `N M obj` patterns
- Rebuilds xref from discovered objects
- Extracts objects from object streams (ObjStm)
- Finds document root (Catalog or Pages fallback)

---

## Writer Layer (`src/writer/`)

PDF serialization and output.

### PDFWriter

Orchestrates complete and incremental PDF writing.

```typescript
// Full rewrite
const bytes = await writeComplete(registry, trailer);

// Incremental update (append-only)
const bytes = await writeIncremental(originalBytes, registry, changes, trailer);
```

### Serializer

Serializes PDF objects to bytes.

- Handles all object types
- Proper escaping for strings and names
- Stream encoding with filter application

### XRefWriter

Generates xref tables/streams for output.

- Traditional xref table format
- Xref stream format (PDF 1.5+)
- Automatic format selection

---

## Objects Layer (`src/objects/`)

PDF's COS (Carousel Object System) object types. All types have a discriminated `type` field.

| Type        | Description                   | Example                     |
| ----------- | ----------------------------- | --------------------------- |
| `PdfNull`   | Null value                    | `null`                      |
| `PdfBool`   | Boolean                       | `true`, `false`             |
| `PdfNumber` | Integer or real               | `42`, `-3.14`               |
| `PdfName`   | Name (interned)               | `/Type`, `/Page`            |
| `PdfString` | Literal or hex string         | `(Hello)`, `<48656C6C6F>`   |
| `PdfRef`    | Indirect reference (interned) | `1 0 R`                     |
| `PdfArray`  | Array of objects              | `[1 2 3]`                   |
| `PdfDict`   | Dictionary                    | `<< /Type /Page >>`         |
| `PdfStream` | Dict + binary data            | `<< /Length 5 >> stream...` |

**Design decisions:**

- `PdfName` and `PdfRef` use interning for memory efficiency
- Containers store `PdfRef` directly (no auto-dereferencing)
- Mutable containers to support PDF modification
- `PdfStream` extends `PdfDict` with stream data and filter decoding

---

## Filters Layer (`src/filters/`)

Stream filter implementations for encoding/decoding.

| Filter          | Status      | Notes                                   |
| --------------- | ----------- | --------------------------------------- |
| FlateDecode     | Full        | zlib compression with predictor support |
| LZWDecode       | Full        | Including /EarlyChange parameter        |
| ASCII85Decode   | Full        |                                         |
| ASCIIHexDecode  | Full        |                                         |
| RunLengthDecode | Full        |                                         |
| DCTDecode       | Passthrough | JPEG — returns raw data                 |
| CCITTFaxDecode  | Passthrough | Fax — returns raw data                  |
| JBIG2Decode     | Passthrough | Returns raw data                        |
| JPXDecode       | Passthrough | JPEG2000 — returns raw data             |

**FilterPipeline** orchestrates filter chains. Filters are applied in order for decoding, reverse order for encoding.

---

## Security Layer (`src/security/`)

Handles PDF encryption and decryption for the Standard security handler.

### Encryption Revisions

| Revision | Algorithm      | Key Size   | Notes                      |
| -------- | -------------- | ---------- | -------------------------- |
| R2       | RC4            | 40-bit     | PDF 1.1, legacy            |
| R3       | RC4            | 40-128 bit | PDF 1.4                    |
| R4       | RC4 or AES-128 | 128-bit    | PDF 1.5, crypt filters     |
| R5       | AES-256        | 256-bit    | PDF 1.7 ext 3 (deprecated) |
| R6       | AES-256        | 256-bit    | PDF 2.0, current standard  |

### Key Components

**StandardSecurityHandler** — Main entry point for encryption/decryption.

- Authenticates user/owner passwords
- Provides `decryptString()` and `decryptStream()` methods
- Tracks permission flags

**Ciphers** (`src/security/ciphers/`)

- `RC4Cipher` — Stream cipher for R2-R4
- `AESCipher` — Block cipher for R4+ (CBC mode with PKCS7 padding)

**Key Derivation** (`src/security/key-derivation/`)

- `md5-based.ts` — R2-R4 key derivation using MD5 + RC4
- `sha-based.ts` — R5-R6 key derivation using SHA-256/384/512

**Handlers** (`src/security/handlers/`)

- `AbstractSecurityHandler` — Interface for encryption handlers
- `RC4Handler` — R2-R4 with per-object key derivation
- `AES128Handler` — R4 AES-128-CBC
- `AES256Handler` — R5-R6 AES-256-CBC (document-wide key)
- `IdentityHandler` — Passthrough for unencrypted content

---

## Signatures Layer (`src/signatures/`)

PDF digital signature creation with PAdES compliance.

### High-Level API

```typescript
import { PDF } from "@libpdf/core";

const pdf = await PDF.load(bytes);

// Basic signing (B-B level)
const signed = await pdf.sign({
  signer: await P12Signer.create(p12Bytes, "password"),
  reason: "I approve this document",
});

// With timestamp (B-T level)
const signed = await pdf.sign({
  signer,
  timestampAuthority: new HttpTimestampAuthority("http://tsa.example.com"),
});

// Long-term archival (B-LTA level)
const signed = await pdf.sign({
  signer,
  level: "B-LTA",
  timestampAuthority,
});

// Multiple signatures (each returns new bytes)
let bytes = await pdf.sign({ signer: signer1, fieldName: "Author" });
bytes = await (await PDF.load(bytes)).sign({ signer: signer2, fieldName: "Reviewer" });
```

### Signers (`src/signatures/signers/`)

| Component         | Purpose                               |
| ----------------- | ------------------------------------- |
| `Signer`          | Interface for signing implementations |
| `P12Signer`       | Signs using PKCS#12 files (.p12/.pfx) |
| `CryptoKeySigner` | Signs using Web Crypto CryptoKey      |

### Signature Formats (`src/signatures/formats/`)

| Component           | Purpose                                     |
| ------------------- | ------------------------------------------- |
| `pkcs7-detached.ts` | Legacy `adbe.pkcs7.detached` format         |
| `cades-detached.ts` | Modern `ETSI.CAdES.detached` format (PAdES) |

### Supporting Components

| Component        | Purpose                                      |
| ---------------- | -------------------------------------------- |
| `placeholder.ts` | ByteRange/Contents placeholder handling      |
| `timestamp.ts`   | RFC 3161 timestamp authority client          |
| `revocation.ts`  | OCSP/CRL fetching for certificate validation |
| `dss.ts`         | Document Security Store for LTV data         |
| `aia.ts`         | Authority Information Access chain building  |
| `sign.ts`        | Main signing orchestration                   |

### Crypto Utilities (`src/signatures/crypto/`)

Legacy cryptographic implementations for PKCS#12 parsing (Web Crypto doesn't support these older algorithms):

| Component       | Purpose                         |
| --------------- | ------------------------------- |
| `pkcs12-kdf.ts` | PKCS#12 key derivation function |
| `rc2.ts`        | RC2 cipher (legacy P12 files)   |
| `triple-des.ts` | 3DES cipher (legacy P12 files)  |

### PAdES Compliance Levels

| Level | Features                          |
| ----- | --------------------------------- |
| B-B   | Basic signature with certificate  |
| B-T   | + RFC 3161 timestamp              |
| B-LT  | + DSS with OCSP/CRL data          |
| B-LTA | + Document timestamp for archival |

---

## I/O Layer (`src/io/`)

**Scanner** — Lowest-level byte reader for PDF parsing.

- Wraps a `Uint8Array` with position tracking
- Returns `-1` for EOF (C-style sentinel)
- Provides `peek()`, `peekAt()`, `advance()`, `match()`, `moveTo()`
- Position is readable/writable for backtracking

**BinaryWriter** — Sequential byte writer for PDF output.

- Builds output buffer
- Tracks current position for xref offsets
- Provides write methods for bytes, strings, numbers

---

## Content Layer (`src/content/`)

Content stream parsing and operators.

| Component       | Purpose                                       |
| --------------- | --------------------------------------------- |
| `ContentStream` | Parses page content streams into operators    |
| `operators.ts`  | PDF operator definitions and argument parsing |

---

## Images Layer (`src/images/`)

Image embedding for JPEG and PNG formats.

### PDFImage Class

Represents an embedded image that can be drawn on pages.

```typescript
const image = await pdf.embedImage(bytes); // Auto-detect format
const image = await pdf.embedJpeg(bytes); // Force JPEG
const image = await pdf.embedPng(bytes); // Force PNG

image.ref; // PdfRef to the XObject
image.width; // Original image width
image.height; // Original image height
```

### JPEG Handling

- Parses JPEG header for dimensions and color space
- Direct DCTDecode embedding (no re-encoding)
- Supports RGB, CMYK, and grayscale

### PNG Handling

- Full PNG parsing with deflate decompression
- Alpha channel embedded as separate SMask
- Supports RGB and grayscale with optional alpha

---

## Layers (OCG) Layer (`src/layers/`)

Optional Content Groups (layers) detection and flattening.

```typescript
// Check for layers
if (pdf.hasLayers()) {
  const layers = await pdf.getLayers();
  // Returns: [{ name, visible, locked, intent }, ...]

  // Flatten to make all content visible and remove OCG
  await pdf.flattenLayers();
}
```

**Use case**: Required before signing to prevent hidden content attacks.

---

## Attachments Layer (`src/attachments/`)

Embedded file specification handling.

| Component  | Purpose                                        |
| ---------- | ---------------------------------------------- |
| `FileSpec` | Parses/creates file specification dictionaries |
| `types.ts` | Attachment metadata types                      |

---

## Annotations Layer (`src/annotations/`)

PDF annotation support for reading, creating, and flattening annotations. **Status: Beta**

### Supported Annotation Types

| Type                    | Class                         | Features                              |
| ----------------------- | ----------------------------- | ------------------------------------- |
| Text markup (highlight) | `PDFHighlightAnnotation`      | QuadPoints, color, opacity            |
| Text markup (underline) | `PDFUnderlineAnnotation`      | QuadPoints with appearance generation |
| Text markup (strikeout) | `PDFStrikeOutAnnotation`      | QuadPoints with appearance generation |
| Text markup (squiggly)  | `PDFSquigglyAnnotation`       | QuadPoints with wavy line appearance  |
| Link                    | `PDFLinkAnnotation`           | URI, GoTo, Named destinations         |
| Text (sticky note)      | `PDFTextAnnotation`           | Icons, open/closed state              |
| FreeText                | `PDFFreeTextAnnotation`       | Direct text on page                   |
| Line                    | `PDFLineAnnotation`           | Start/end points, line endings        |
| Square                  | `PDFSquareAnnotation`         | Rectangle with border/fill            |
| Circle                  | `PDFCircleAnnotation`         | Ellipse with border/fill              |
| Polygon                 | `PDFPolygonAnnotation`        | Closed path with vertices             |
| Polyline                | `PDFPolylineAnnotation`       | Open path with vertices               |
| Ink                     | `PDFInkAnnotation`            | Freehand drawing paths                |
| Stamp                   | `PDFStampAnnotation`          | Standard and custom stamps            |
| Caret                   | `PDFCaretAnnotation`          | Text insertion point                  |
| FileAttachment          | `PDFFileAttachmentAnnotation` | Embedded file with icon               |
| Popup                   | `PDFPopupAnnotation`          | Associated popup for markup annots    |

### Usage

```typescript
// Get annotations from a page
const annotations = await page.getAnnotations();

// Add annotations
page.addHighlightAnnotation({ rects: [...], color: rgb(1, 1, 0) });
page.addLinkAnnotation({ rect: [...], uri: "https://example.com" });
page.addTextAnnotation({ rect: [...], contents: "Note text" });
page.addStampAnnotation({ rect: [...], stampName: "Approved" });

// Remove annotations
await page.removeAnnotation(annotation);
await page.removeAnnotations({ subtypes: ["Highlight", "Underline"] });

// Flatten annotations
await page.flattenAnnotations();
```

### Architecture

| Component                 | Purpose                                     |
| ------------------------- | ------------------------------------------- |
| `PDFAnnotation`           | Base class for all annotation types         |
| `PDFMarkupAnnotation`     | Base for annotations with popup/reply       |
| `PDFTextMarkupAnnotation` | Base for highlight/underline/etc.           |
| `factory.ts`              | Creates annotation objects from PDF dicts   |
| `appearance/*.ts`         | Generates appearance streams for flattening |

---

## Text Layer (`src/text/`)

Text extraction from PDF content streams with position tracking.

### Usage

```typescript
// Extract text from a page
const text = await page.extractText();
// Returns: "Hello World\nSecond line..."

// Extract with position information
const result = await page.extractText({ includePositions: true });
// Returns: { text: "...", lines: [{ text, chars: [{ char, x, y, width, height }] }] }

// Search for text
const matches = await page.findText("search term");
// Returns: [{ text, rect: { x, y, width, height }, pageIndex }]

// Search with regex
const matches = await page.findText(/pattern/gi);

// Document-level search
const allMatches = await pdf.findText("term");
```

### Components

| Component       | Purpose                                          |
| --------------- | ------------------------------------------------ |
| `TextExtractor` | Parses content streams, tracks text state        |
| `TextState`     | Manages text matrix, font, and positioning       |
| `LineGrouper`   | Groups characters into lines based on baseline   |
| `text-search`   | String and regex search with bounding boxes      |
| `types.ts`      | TextChar, TextLine, TextSpan, SearchResult types |

### Supported Text Operators

- Positioning: `Td`, `TD`, `Tm`, `T*`
- Showing: `Tj`, `TJ`, `'`, `"`
- State: `Tf`, `Tc`, `Tw`, `Tz`, `TL`, `Ts`, `Tr`
- Graphics: `cm`, `q`, `Q` (matrix transformations)

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

- **High-level**: `PDF`, `PDFPage`, `PDFForm` — simple, task-focused
- **Low-level**: `PdfDict`, `PdfArray`, `PdfStream` — full control

### Async-First

All I/O and decompression operations return Promises.

### Memory Efficiency

- Interning for frequently repeated values (`PdfName`, `PdfRef`)
- Lazy object loading with caching
- Object stream parsing only when needed
- Font subsetting for embedded fonts

---

## Reference Mapping

When implementing, consult the reference libraries in `checkouts/`:

| Area                         | Best Reference                   |
| ---------------------------- | -------------------------------- |
| Parsing, malformed PDFs      | pdf.js (`src/core/`)             |
| TypeScript API patterns      | pdf-lib (`src/`)                 |
| Feature coverage, edge cases | PDFBox (`pdfbox/src/main/java/`) |

---

## Status

### Complete

- [x] I/O Layer (Scanner, BinaryWriter)
- [x] Objects Layer (PdfDict, PdfArray, PdfStream, etc.)
- [x] Filters (Flate, LZW, ASCII85, ASCIIHex, RunLength)
- [x] Parser Layer (TokenReader, ObjectParser, XRefParser, BruteForceParser)
- [x] DocumentParser with lazy loading and recovery
- [x] Encryption/decryption (R2-R6, RC4, AES-128, AES-256)
- [x] Writer (complete rewrite and incremental update)
- [x] High-level API (PDF, PDFPage, PDFForm, PDFImage)
- [x] Form filling, reading, and flattening
- [x] Form field creation (text, checkbox, radio, dropdown, listbox, signature)
- [x] Font parsing (SimpleFont, CompositeFont, CIDFont)
- [x] Font embedding with subsetting (TTF, OpenType/CFF)
- [x] Fontbox (TTF, CFF, Type1, AFM parsing)
- [x] Attachments (add, get, list, remove)
- [x] Page manipulation (add, insert, remove, move, copy)
- [x] PDF merge and split
- [x] Page embedding (Form XObjects for overlays/watermarks)
- [x] Content stream parsing
- [x] Digital signature creation (PAdES B-B, B-T, B-LT, B-LTA)
- [x] Signature signers (P12/PKCS#12, CryptoKey)
- [x] Timestamp authority support (RFC 3161)
- [x] Long-term validation (DSS, OCSP, CRL)
- [x] Image embedding (JPEG, PNG with alpha)
- [x] Drawing API (drawText, drawImage, drawRectangle, drawLine, drawCircle, drawEllipse, drawPath)
- [x] Text layout (word wrapping, alignment, multiline)
- [x] Layer (OCG) detection and flattening
- [x] Document encryption/protection API (setProtection, removeProtection)
- [x] Text extraction with position tracking and search
- [x] Annotation support (beta) - text markup, links, shapes, stamps, etc.
- [x] Annotation flattening

### Partial / In Progress

- [ ] Linearized PDF fast-open (detection only, no optimization)

### Not Yet Built

- [ ] Digital signature verification
- [ ] Certificate-based decryption (/Adobe.PubSec handler)
- [ ] Outline/bookmark support
- [ ] Metadata (XMP) editing
- [ ] PDF/A compliance
