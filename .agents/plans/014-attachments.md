# Plan 014: PDF Attachments

## Overview

Add support for reading and writing PDF file attachments (embedded files). This is a self-contained feature that enables extracting files from PDFs (invoices, contracts) and embedding files into PDFs.

## PDF Structure

```
Catalog
  └── /Names (dict)
        └── /EmbeddedFiles (name tree)
              └── "filename.pdf" → FileSpec (dict)
                                     ├── /Type /Filespec
                                     ├── /F (filename, ASCII)
                                     ├── /UF (filename, Unicode)
                                     ├── /Desc (description)
                                     └── /EF (dict)
                                           └── /F → EmbeddedFile (stream)
                                                      ├── /Type /EmbeddedFile
                                                      ├── /Subtype (MIME type)
                                                      ├── /Params (dict)
                                                      │     ├── /Size
                                                      │     ├── /CreationDate
                                                      │     ├── /ModDate
                                                      │     └── /CheckSum
                                                      └── [file bytes]
```

## Components to Build

### 1. NameTree Class (`src/document/name-tree.ts`)

Class-based implementation with binary search and caching.

```typescript
type Resolver = (ref: PdfRef) => Promise<PdfObject | null>;

const MAX_DEPTH = 10;

/**
 * PDF Name Tree reader.
 *
 * Supports both flat trees (/Names array) and hierarchical trees (/Kids).
 * Uses binary search with /Limits for O(log n) single lookups.
 */
export class NameTree {
  constructor(
    private root: PdfDict,
    private resolver: Resolver,
  ) {}

  /**
   * Lookup a single key using binary search.
   * Uses /Limits on intermediate nodes to skip subtrees.
   */
  async get(key: string): Promise<PdfObject | null>;

  /**
   * Check if a key exists.
   */
  async has(key: string): Promise<boolean>;

  /**
   * Iterate all entries (lazy, yields [key, value] pairs).
   * Uses BFS traversal with cycle detection.
   */
  async *entries(): AsyncGenerator<[string, PdfObject]>;

  /**
   * Load all entries into a Map (cached after first call).
   */
  async getAll(): Promise<ReadonlyMap<string, PdfObject>>;
}

/**
 * Build a flat name tree from sorted entries.
 * For writing - we don't need hierarchical structure for small lists.
 */
export function buildNameTree(entries: [string, PdfRef][]): PdfDict;
```

**Implementation details:**

- **Binary search for `get()`**: Navigate using `/Limits` [min, max] on `/Kids` nodes
- **Cycle detection**: Track visited refs in a `Set<string>` during traversal
- **Depth limit**: Stop at `MAX_DEPTH` (10) to prevent stack overflow on malformed PDFs
- **Lazy `entries()`**: Generator yields one at a time, doesn't load all into memory
- **Cached `getAll()`**: First call loads everything, subsequent calls return cached Map

### 2. Attachment Types (`src/attachments/types.ts`)

```typescript
export interface AttachmentInfo {
  /** The key name in the EmbeddedFiles tree */
  name: string;
  /** Original filename (from /UF, /F, or platform-specific keys) */
  filename: string;
  /** User-facing description */
  description?: string;
  /** MIME type (from /Subtype) */
  mimeType?: string;
  /** File size in bytes (uncompressed) */
  size?: number;
  /** Creation date */
  createdAt?: Date;
  /** Modification date */
  modifiedAt?: Date;
}

export interface AddAttachmentOptions {
  /** User-facing description */
  description?: string;
  /** MIME type (auto-detected from extension if not provided) */
  mimeType?: string;
  /** Creation date (defaults to now) */
  createdAt?: Date;
  /** Modification date (defaults to now) */
  modifiedAt?: Date;
  /** Overwrite if attachment with same name exists (default: false, throws) */
  overwrite?: boolean;
}
```

### 3. FileSpec Helpers (`src/attachments/file-spec.ts`)

```typescript
/**
 * Filename fallback order (per PDF spec + legacy support):
 * /UF (Unicode) → /F (ASCII) → /Unix → /Mac → /DOS
 */
function getFilename(fileSpec: PdfDict): string;

/**
 * Parse a file specification dictionary.
 * Returns null for external file references (no /EF key).
 */
async function parseFileSpec(
  fileSpec: PdfDict,
  name: string,
  resolver: Resolver,
): Promise<AttachmentInfo | null>;

/**
 * Get the embedded file stream from a file spec.
 * Returns null if /EF is missing (external reference).
 */
async function getEmbeddedFileStream(
  fileSpec: PdfDict,
  resolver: Resolver,
): Promise<PdfStream | null>;

/**
 * Create a file specification dictionary for embedding.
 */
function createFileSpec(
  filename: string,
  embeddedFileRef: PdfRef,
  options: AddAttachmentOptions,
): PdfDict;

/**
 * Create an embedded file stream.
 * Compression is handled by the writer's compressStreams option.
 */
function createEmbeddedFileStream(data: Uint8Array, options: AddAttachmentOptions): PdfStream;
```

### 4. PDF API Methods (`src/api/pdf.ts`)

Add to the PDF class:

```typescript
// Internal cache
private embeddedFilesTree: NameTree | null | undefined = undefined;

/**
 * List all attachments in the document.
 * Skips external file references (logs warning).
 */
async getAttachments(): Promise<Map<string, AttachmentInfo>>;

/**
 * Get the raw bytes of an attachment.
 */
async getAttachment(name: string): Promise<Uint8Array | null>;

/**
 * Check if an attachment exists.
 */
async hasAttachment(name: string): Promise<boolean>;

/**
 * Add a file attachment to the document.
 * @throws {Error} if name already exists and overwrite !== true
 */
async addAttachment(
  name: string,
  data: Uint8Array,
  options?: AddAttachmentOptions
): Promise<void>;

/**
 * Remove an attachment from the document.
 * @returns true if removed, false if not found
 */
async removeAttachment(name: string): Promise<boolean>;
```

## Implementation Order

### Phase 1: Name Tree Infrastructure

1. Create `src/document/name-tree.ts`
2. Implement `NameTree` class with:
   - `get()` with binary search using `/Limits`
   - `entries()` generator with cycle detection + depth limit
   - `getAll()` with caching
3. Implement `buildNameTree()` for writing
4. Add tests with mock name tree structures (flat + hierarchical)

### Phase 2: Reading Attachments

1. Create `src/attachments/types.ts` with interfaces
2. Create `src/attachments/file-spec.ts` with:
   - `getFilename()` with fallback chain
   - `parseFileSpec()` (returns null for external refs)
   - `getEmbeddedFileStream()`
3. Add `getAttachments()` to PDF class
4. Add `getAttachment()` to PDF class
5. Add `hasAttachment()` to PDF class
6. Test with real PDFs containing attachments

### Phase 3: Writing Attachments

1. Add `createFileSpec()` and `createEmbeddedFileStream()` helpers
2. Add `addAttachment()` to PDF class with:
   - Duplicate name detection (throw unless `overwrite: true`)
   - Create/update `/Names` dict in catalog
   - Rebuild name tree with new entry
3. Add `removeAttachment()` to PDF class
4. Test round-trip: add attachment, save, reload, extract

### Phase 4: Polish

1. Add MIME type auto-detection from file extension
2. Parse PDF dates into JS Date objects
3. Add checksum verification (optional)
4. Export types from main index.ts
5. Update ARCHITECTURE.md

## Files to Create/Modify

```
src/
├── document/
│   ├── name-tree.ts           # NEW - NameTree class
│   └── name-tree.test.ts      # NEW - Tests
├── attachments/
│   ├── index.ts               # NEW - Exports
│   ├── types.ts               # NEW - AttachmentInfo, options
│   ├── file-spec.ts           # NEW - FileSpec parsing/creation
│   └── file-spec.test.ts      # NEW - Tests
├── api/
│   └── pdf.ts                 # MODIFY - Add attachment methods
└── index.ts                   # MODIFY - Export attachment types
```

## Test Fixtures Needed

- `fixtures/attachments/with-single-file.pdf` - PDF with one embedded file
- `fixtures/attachments/with-multiple-files.pdf` - PDF with several attachments
- `fixtures/attachments/with-nested-tree.pdf` - PDF with hierarchical name tree
- `fixtures/attachments/empty.pdf` - PDF with no attachments

**Bootstrap strategy**: Create initial fixtures using pdf-lib or external tools, expand once we can write attachments ourselves.

## Edge Cases & Handling

| Case                            | Handling                                        |
| ------------------------------- | ----------------------------------------------- |
| No `/Names` dictionary          | Return empty map                                |
| No `/EmbeddedFiles` in `/Names` | Return empty map                                |
| Hierarchical name tree          | Walk `/Kids` with cycle detection               |
| Missing `/EF` in FileSpec       | External file reference → skip + warn           |
| Circular refs in tree           | Cycle detection via visited Set                 |
| Very deep tree                  | Stop at MAX_DEPTH (10) + warn                   |
| Duplicate name on add           | Throw error unless `overwrite: true`            |
| Unicode filenames               | Prefer `/UF`, fall back through chain           |
| Platform-specific names         | Check: `/UF` → `/F` → `/Unix` → `/Mac` → `/DOS` |
| Compressed streams              | Handled by `PdfStream.getDecodedData()`         |
| Encrypted attachments           | Handled by security layer                       |

## MIME Type Detection

Common mappings for auto-detection:

```typescript
const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".xml": "application/xml",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".zip": "application/zip",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
```

## Out of Scope (Future)

- **AFRelationship** (PDF 2.0 / PDF/A-3) — For ZUGFeRD/Factur-X compliance
- **NumberTree** generalization — Reuse patterns when we need PageLabels
- **Collection/Portfolio** display — `/Collection` dict for attachment presentation
- **Streaming large files** — Current API requires full `Uint8Array` in memory

## Reference Code

- **pdf.js**: `checkouts/pdfjs/src/core/name_number_tree.js` (binary search), `catalog.js` (attachments getter), `file_spec.js`
- **pdf-lib**: `checkouts/pdf-lib/src/api/PDFDocument.ts` (attach method), `FileEmbedder.ts`
- **PDFBox**: `checkouts/pdfbox/.../pdmodel/PDEmbeddedFile.java`, `PDComplexFileSpecification.java`
