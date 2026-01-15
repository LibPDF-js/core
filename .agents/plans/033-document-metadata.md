# Document Metadata API

## Problem Statement

Users need an easy way to read and set document metadata (title, author, subject, etc.) that appears in PDF readers' "Document Properties" dialog. Currently there's no high-level API for this - users would need to manually manipulate the Info dictionary.

## Goals

1. Provide a clean, type-safe API for reading/writing standard PDF metadata fields
2. Support all standard Info dictionary fields from PDF spec (Table 317)
3. Handle date parsing/formatting automatically
4. Support both individual field access and bulk operations
5. Keep API surface minimal - methods directly on `PDF` class, no separate wrapper class needed

## Scope

### In Scope

- Standard Info dictionary fields (Title, Author, Subject, Keywords, Creator, Producer, CreationDate, ModDate, Trapped)
- Language setting (stored in Catalog, not Info)
- ViewerPreferences for "display title in window title bar"
- Reading existing metadata from loaded PDFs
- Writing metadata to new and existing PDFs

### Out of Scope

- XMP metadata streams (complex XML, rarely needed by most users)
- Custom metadata fields (non-standard keys)
- Encryption metadata fields (handled by security layer)

## API Design

### Desired Usage

```typescript
import { PDF } from "@libpdf/core";

// Creating a new PDF - Producer and Creator auto-set to "@libpdf/core"
const pdf = PDF.create();
pdf.getProducer(); // "@libpdf/core"
pdf.getCreator(); // "@libpdf/core"

// Set other metadata
pdf.setTitle("Quarterly Report Q4 2024");
pdf.setAuthor("Jane Smith");
pdf.setSubject("Financial summary for Q4");
pdf.setKeywords(["finance", "quarterly", "2024", "Q4"]);
pdf.setCreator("Report Generator v2.0");
pdf.setProducer("@libpdf/core");
pdf.setCreationDate(new Date());
pdf.setLanguage("en-US");

// Show title in viewer's title bar (instead of filename)
pdf.setTitle("My Document", { showInWindowTitleBar: true });

// Reading metadata from existing PDF
const loaded = await PDF.load(bytes);
const title = loaded.getTitle(); // string | undefined
const author = loaded.getAuthor(); // string | undefined
const subject = loaded.getSubject(); // string | undefined
const keywords = loaded.getKeywords(); // string[] | undefined
const creator = loaded.getCreator(); // string | undefined
const producer = loaded.getProducer(); // string | undefined
const created = loaded.getCreationDate(); // Date | undefined
const modified = loaded.getModificationDate(); // Date | undefined
const trapped = loaded.getTrapped(); // "True" | "False" | "Unknown" | undefined
const language = loaded.getLanguage(); // string | undefined

// Bulk operations
const allMetadata = loaded.getMetadata();
// Returns: {
//   title?: string,
//   author?: string,
//   subject?: string,
//   keywords?: string[],
//   creator?: string,
//   producer?: string,
//   creationDate?: Date,
//   modificationDate?: Date,
//   trapped?: "True" | "False" | "Unknown",
//   language?: string,
// }

pdf.setMetadata({
  title: "New Title",
  author: "New Author",
  creationDate: new Date(),
});
```

## Types

```typescript
/**
 * Trapped status indicating whether trapping has been applied.
 * - "True": Document has been trapped
 * - "False": Document has not been trapped
 * - "Unknown": Unknown trapping status (or not set)
 */
type TrappedStatus = "True" | "False" | "Unknown";

/**
 * Options for setTitle().
 */
interface SetTitleOptions {
  /**
   * If true, PDF viewers should display the title in the window's title bar
   * instead of the filename. Sets ViewerPreferences.DisplayDocTitle.
   */
  showInWindowTitleBar?: boolean;
}

/**
 * Document metadata that can be read or written in bulk.
 */
interface DocumentMetadata {
  /** Document title */
  title?: string;
  /** Name of the person who created the document content */
  author?: string;
  /** Subject/description of the document */
  subject?: string;
  /** Keywords associated with the document */
  keywords?: string[];
  /** Application that created the original content */
  creator?: string;
  /** Application that produced the PDF */
  producer?: string;
  /** Date the document was created */
  creationDate?: Date;
  /** Date the document was last modified */
  modificationDate?: Date;
  /** Whether the document has been trapped for printing */
  trapped?: TrappedStatus;
  /** RFC 3066 language tag (e.g., "en-US", "de-DE") */
  language?: string;
}
```

## Implementation Notes

### Info Dictionary Location

- The Info dictionary is referenced from the trailer: `/Info 5 0 R`
- If no Info dictionary exists, one must be created and registered
- The trailer reference must be updated

### String Encoding

- Use hex strings (`<FEFF...>`) with UTF-16BE BOM for full Unicode support
- This matches pdf-lib's approach and ensures special characters work

### Date Format

- PDF dates use format: `D:YYYYMMDDHHmmSSOHH'mm'`
- Example: `D:20240115143052+05'30'`
- Should parse lenient (many PDFs have non-conforming dates)

### Keywords

- Stored as single space-separated string in PDF
- API presents as array for convenience
- `getKeywords()` splits on whitespace
- `setKeywords()` joins with spaces

### Language

- Unlike other metadata, language is stored in Catalog (`/Lang`), not Info
- This is per PDF spec (Table 28, Catalog dictionary)

### Trapped

- `/Trapped` is a name, not a string: `/Trapped /True`
- Valid values: `/True`, `/False`, `/Unknown`

### ViewerPreferences

- `showInWindowTitleBar` sets `/ViewerPreferences << /DisplayDocTitle true >>`
- Must create ViewerPreferences dict if it doesn't exist

## Test Plan

1. **Round-trip tests**: Set metadata, save, reload, verify values match
2. **Unicode tests**: Verify emoji, CJK, RTL text in metadata fields
3. **Date parsing**: Test various date formats (compliant and non-compliant)
4. **Missing Info dictionary**: Create new PDF, verify Info dict created on first set
5. **Existing PDF**: Load PDF with existing metadata, modify, verify changes
6. **Keywords**: Test array<->string conversion
7. **Language**: Verify stored in Catalog, not Info
8. **ViewerPreferences**: Verify DisplayDocTitle flag works
9. **Trapped status**: Test all three values

## Decisions

1. **Auto-set ModDate on save?** — No, let user control it

2. **Auto-set Producer/Creator on PDF.create()?** — Yes, set both to `"@libpdf/core"` when creating a new PDF from scratch. Users can override if desired. Loaded PDFs keep their existing values.

3. **getKeywords() when not set** — Return `undefined` for consistency with other getters
