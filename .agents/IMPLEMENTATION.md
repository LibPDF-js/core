# Implementation Details

Detailed implementation documentation for @libpdf/core components.

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

## Security Layer Details

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

## Signatures Layer (`src/signatures/`)

PDF digital signature creation with PAdES compliance.

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

## Content Layer (`src/content/`)

Content stream parsing and operators.

| Component       | Purpose                                       |
| --------------- | --------------------------------------------- |
| `ContentStream` | Parses page content streams into operators    |
| `operators.ts`  | PDF operator definitions and argument parsing |

## Images Layer (`src/images/`)

Image embedding for JPEG and PNG formats.

### JPEG Handling

- Parses JPEG header for dimensions and color space
- Direct DCTDecode embedding (no re-encoding)
- Supports RGB, CMYK, and grayscale

### PNG Handling

- Full PNG parsing with deflate decompression
- Alpha channel embedded as separate SMask
- Supports RGB and grayscale with optional alpha

## Attachments Layer (`src/attachments/`)

Embedded file specification handling.

| Component  | Purpose                                        |
| ---------- | ---------------------------------------------- |
| `FileSpec` | Parses/creates file specification dictionaries |
| `types.ts` | Attachment metadata types                      |

## Text Layer (`src/text/`)

Text extraction from PDF content streams with position tracking.

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

## Annotations Layer (`src/annotations/`)

PDF annotation support for reading, creating, and flattening annotations.

### Architecture

| Component                 | Purpose                                     |
| ------------------------- | ------------------------------------------- |
| `PDFAnnotation`           | Base class for all annotation types         |
| `PDFMarkupAnnotation`     | Base for annotations with popup/reply       |
| `PDFTextMarkupAnnotation` | Base for highlight/underline/etc.           |
| `factory.ts`              | Creates annotation objects from PDF dicts   |
| `appearance/*.ts`         | Generates appearance streams for flattening |

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
