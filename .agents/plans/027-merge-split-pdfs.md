# Plan 027: Merge/Split PDFs

## Problem Statement

Users need to combine pages from multiple PDFs into one document, split documents into smaller pieces, and overlay/merge page content (e.g., watermarks, letterheads, stamps). This is Tier 2 functionality that enables common document workflows.

## Goals

1. **Merge PDFs** — Combine pages from multiple documents into one
2. **Split PDFs** — Extract page ranges into new documents
3. **Page-into-page merging** — Overlay/underlay one page's content onto another (watermarks, backgrounds, stamps)

## Non-Goals

- Page imposition (n-up, booklet layouts) — Tier 4 stretch
- Structure tree merging — Complex, defer to later
- Full AcroForm merging with field conflict resolution — Basic support only initially
- OCProperties (layer) merging — Defer

---

## Current Implementation Status

### Completed (Phase 1 & 2)

The following functionality is fully implemented and tested:

| Feature                            | Status  | Location                        |
| ---------------------------------- | ------- | ------------------------------- |
| `ObjectCopier`                     | ✅ Done | `src/document/object-copier.ts` |
| `PDFPageTree`                      | ✅ Done | `src/api/pdf-page-tree.ts`      |
| `PDFPage` class                    | ✅ Done | `src/api/pdf-page.ts`           |
| `PDFContext`                       | ✅ Done | `src/api/pdf-context.ts`        |
| `pdf.copyPagesFrom()`              | ✅ Done | `src/api/pdf.ts`                |
| `pdf.addPage()`                    | ✅ Done | `src/api/pdf.ts`                |
| `pdf.insertPage()`                 | ✅ Done | `src/api/pdf.ts`                |
| `pdf.removePage()`                 | ✅ Done | `src/api/pdf.ts`                |
| `pdf.movePage()`                   | ✅ Done | `src/api/pdf.ts`                |
| `pdf.getPage()` / `pdf.getPages()` | ✅ Done | Returns `PDFPage`               |

### Phase 3 (Completed 2026-01-04)

| Feature                     | Status  | Location                   |
| --------------------------- | ------- | -------------------------- |
| `PDF.create()`              | ✅ Done | `src/api/pdf.ts`           |
| `PDF.merge()` static method | ✅ Done | `src/api/pdf.ts`           |
| `pdf.extractPages()`        | ✅ Done | `src/api/pdf.ts`           |
| `pdf.embedPage()`           | ✅ Done | `src/api/pdf.ts`           |
| `EmbeddedPage` class        | ✅ Done | `src/api/embedded-page.ts` |
| `page.drawPage()`           | ✅ Done | `src/api/pdf-page.ts`      |

---

## Current API (Implemented)

### Page Copying (Cross-Document)

```typescript
import { PDF } from "@libpdf/core";

const dest = await PDF.load(destBytes);
const source = await PDF.load(sourceBytes);

// Copy pages 0 and 2 from source, append to end
const copiedRefs = await dest.copyPagesFrom(source, [0, 2]);

// Copy page 0 and insert at the beginning
await dest.copyPagesFrom(source, [0], { insertAt: 0 });

// Duplicate page 0 in the same document (self-copy works!)
await dest.copyPagesFrom(dest, [0], { insertAt: 1 });

// Options for copying
await dest.copyPagesFrom(source, [0], {
  insertAt: 0, // Insert position (default: append)
  includeAnnotations: true, // Copy annotations (default: true)
  includeBeads: false, // Copy article thread beads (default: false)
  includeThumbnails: false, // Copy thumbnail images (default: false)
  includeStructure: false, // Copy structure tree refs (default: false)
});
```

### Page Manipulation

```typescript
const pdf = await PDF.load(bytes);

// Get page count
const count = pdf.getPageCount(); // => number

// Get a page (returns PDFPage wrapper)
const page = await pdf.getPage(0);
console.log(`Size: ${page.width} x ${page.height}`);
console.log(`Rotation: ${page.rotation}`);

// Get all pages
const pages = await pdf.getPages(); // => PDFPage[]

// Add a new blank page
const newPage = pdf.addPage({ size: "letter" });
const newPage2 = pdf.addPage({ width: 500, height: 700, insertAt: 0 });

// Insert an existing page dict
const pageRef = pdf.insertPage(0, pageDict);

// Remove a page by index
pdf.removePage(2);

// Move a page from one position to another
pdf.movePage(3, 0); // Move page 3 to position 0
```

### PDFPage Class

```typescript
const page = await pdf.getPage(0);

// Properties
page.ref; // PdfRef - the page reference
page.dict; // PdfDict - the page dictionary
page.index; // number - page index (0-based)
page.width; // number - width in points (rotation-aware)
page.height; // number - height in points (rotation-aware)
page.rotation; // 0 | 90 | 180 | 270

// Methods
page.getMediaBox(); // Rectangle
page.getCropBox(); // Rectangle (falls back to MediaBox)
page.getBleedBox(); // Rectangle (falls back to CropBox)
page.getTrimBox(); // Rectangle (falls back to CropBox)
page.getArtBox(); // Rectangle (falls back to CropBox)
page.getResources(); // PdfDict (creates if missing)
page.setRotation(90); // Set rotation
```

---

## Desired API (Remaining)

### Static Merge

```typescript
// Merge all pages from multiple documents
const merged = await PDF.merge([pdfBytes1, pdfBytes2, pdfBytes3]);
const bytes = await merged.save();
```

### Extract/Split

```typescript
const pdf = await PDF.load(bytes);

// Extract specific pages into a new document
const extracted = await pdf.extractPages([0, 1, 2]);
await extracted.save();
```

### Page-into-Page (Overlay/Underlay)

```typescript
const pdf = await PDF.load(documentBytes);
const watermark = await PDF.load(watermarkBytes);

// Embed a page from another PDF as a reusable Form XObject
const watermarkXObject = await pdf.embedPage(watermark, 0);

// Draw it onto a page (foreground by default)
const page = await pdf.getPage(0);
page.drawPage(watermarkXObject);

// Draw as background (behind existing content)
page.drawPage(watermarkXObject, { background: true });

// With positioning/scaling
page.drawPage(watermarkXObject, { x: 50, y: 50, scale: 0.5 });
```

---

## Architecture

### Current Structure (Implemented)

```
src/
  api/
    pdf.ts              # Main PDF class with copyPagesFrom, addPage, etc.
    pdf-context.ts      # Central context for subsystems
    pdf-page.ts         # PDFPage wrapper class
    pdf-page-tree.ts    # Page tree management
  document/
    object-copier.ts    # Deep-copies object graphs with ref remapping ✅
```

### Remaining Components (To Implement)

```
src/
  document/
    page-embedder.ts    # Converts pages to Form XObjects
  api/
    embedded-page.ts    # EmbeddedPage class (Form XObject wrapper)
```

### ObjectCopier (Implemented)

Located in `src/document/object-copier.ts`:

```typescript
class ObjectCopier {
  constructor(source: PDF, dest: PDF, options?: ObjectCopierOptions) {}

  // Copy a page with inherited attrs flattened
  async copyPage(srcPageRef: PdfRef): Promise<PdfRef>;

  // Copy any object recursively
  async copyObject(obj: PdfObject): Promise<PdfObject>;
}

interface ObjectCopierOptions {
  includeAnnotations?: boolean; // default: true
  includeBeads?: boolean; // default: false
  includeThumbnails?: boolean; // default: false
  includeStructure?: boolean; // default: false
}
```

Features:

- Deep copies all object types (dicts, arrays, streams, primitives)
- Remaps references to destination document's object space
- Flattens inherited page attributes (Resources, MediaBox, CropBox, Rotate)
- Smart stream handling: raw bytes if unencrypted, re-encode if encrypted
- Circular reference detection
- Filters out page-tree specific keys (/Parent, /Tabs, /StructParents, etc.)
- Optional annotation copying

### Page Embedding (Form XObjects) — TO IMPLEMENT

To merge one page's content into another, we convert it to a Form XObject:

```typescript
class PageEmbedder {
  async embedPage(sourceDoc: PDF, pageIndex: number): Promise<EmbeddedPage> {
    const page = await sourceDoc.getPage(pageIndex);
    const copier = new ObjectCopier(sourceDoc, this.destDoc);

    // Get page dimensions
    const mediaBox = page.getMediaBox();

    // Get and concatenate content streams
    const contentData = await this.getContentData(page);

    // Copy resources
    const resources = await copier.copyObject(page.getResources());

    // Create Form XObject
    const formXObject = PdfStream.fromDict(
      {
        Type: PdfName.XObject,
        Subtype: PdfName.Form,
        BBox: PdfArray.of(
          PdfNumber.of(mediaBox.x1),
          PdfNumber.of(mediaBox.y1),
          PdfNumber.of(mediaBox.x2),
          PdfNumber.of(mediaBox.y2),
        ),
        Resources: resources,
      },
      contentData,
    );

    const ref = this.destDoc.register(formXObject);

    return new EmbeddedPage(ref, mediaBox, page.width, page.height);
  }
}
```

### EmbeddedPage Class — TO IMPLEMENT

```typescript
class EmbeddedPage {
  readonly ref: PdfRef;
  readonly box: Rectangle;
  readonly width: number;
  readonly height: number;

  constructor(ref: PdfRef, box: Rectangle, width: number, height: number) {
    this.ref = ref;
    this.box = box;
    this.width = width;
    this.height = height;
  }
}
```

### PDFPage.drawPage() — TO IMPLEMENT

```typescript
interface DrawPageOptions {
  /** X position (default: 0) */
  x?: number;
  /** Y position (default: 0) */
  y?: number;
  /** Scale factor (default: 1) */
  scale?: number;
  /** Width to fit (overrides scale) */
  width?: number;
  /** Height to fit (overrides scale) */
  height?: number;
  /** Opacity 0-1 (default: 1) */
  opacity?: number;
  /** Draw as background behind existing content */
  background?: boolean;
}

// On PDFPage class:
drawPage(embedded: EmbeddedPage, options?: DrawPageOptions): void {
  // Add Form XObject to page resources
  const xobjectName = this.addXObjectResource(embedded.ref);

  // Build transformation matrix
  const matrix = this.buildMatrix(embedded, options);

  // Create content stream operations
  const ops = [
    "q",  // Save graphics state
    ...this.buildMatrixOps(matrix),
    ...this.buildOpacityOps(options?.opacity),
    `/${xobjectName} Do`,  // Draw XObject
    "Q",  // Restore graphics state
  ].join("\n");

  if (options?.background) {
    this.prependContent(ops);
  } else {
    this.appendContent(ops);
  }
}
```

### Content Stream Wrapping

When modifying content streams, we must wrap existing content in `q`/`Q` to isolate graphics state:

```typescript
function wrapContentStream(page: PdfDict): void {
  const contents = page.get("Contents");
  // Wrap in q/Q to save/restore graphics state
  // Prevents overlay transformations from affecting original content
}
```

---

## Edge Cases & Considerations

### Resource Name Conflicts

When adding an XObject to a page's resources, we may have name conflicts:

```typescript
function generateUniqueName(resources: PdfDict, prefix: string): string {
  const xobjects = resources.get(PdfName.of("XObject")) as PdfDict;
  let counter = 0;
  let name = prefix;
  while (xobjects?.has(PdfName.of(name))) {
    name = `${prefix}${++counter}`;
  }
  return name;
}
```

### Encrypted Documents

- Source documents may be encrypted — must decrypt before copying
- Destination document encryption is separate (applied on save)
- Object copier should work with decrypted data

### Cross-Reference Handling

- New objects need refs allocated in destination document
- Must track all new refs for xref table on save
- Object streams may need to be expanded for copied objects

### Page Tree Management

```typescript
class PageTree {
  addPage(page: PdfDict): void {
    // Add to /Kids array
    // Update /Count
    // Set page's /Parent
  }

  insertPage(index: number, page: PdfDict): void {
    // Insert at specific position
  }

  removePage(index: number): PdfDict {
    // Remove from /Kids
    // Update /Count
    // Return removed page for potential reuse
  }
}
```

### Incremental Updates

All modifications should work with incremental updates:

- Track all modified objects
- New pages and copied objects get new refs
- Only write changed objects on incremental save

---

## What Other Libraries Offer

Features we're implementing now:

| Feature                  | pdf-lib | PDFBox | Us  |
| ------------------------ | ------- | ------ | --- |
| Copy pages between docs  | ✅      | ✅     | ✅  |
| Page embedding (XObject) | ✅      | ✅     | ✅  |
| Overlay position (fg/bg) | Manual  | ✅     | ✅  |
| Extract pages            | Manual  | ✅     | ✅  |

Future considerations (not in scope):

| Feature                       | pdf-lib | PDFBox |
| ----------------------------- | ------- | ------ |
| Page-type overlays (odd/even) | ❌      | ✅     |
| Split by page count           | Manual  | ✅     |
| AcroForm field renaming       | ❌      | ✅     |
| Bookmark merging              | ❌      | ✅     |
| Structure tree merge          | ❌      | ✅     |

---

## Implementation Phases

### Phase 1: Core Infrastructure ✅ COMPLETE

- [x] `ObjectCopier` — Deep copy objects with ref remapping
- [x] Page tree manipulation (add, insert, remove, move)
- [x] `PDFPage` class with dimension/rotation accessors
- [x] `PDFContext` for shared document state
- [x] Tests with multi-page PDFs (22 tests in object-copier.test.ts)

### Phase 2: High-Level Page API ✅ COMPLETE

- [x] `pdf.copyPagesFrom()` instance method
- [x] `pdf.addPage()` with size options
- [x] `pdf.insertPage()` at specific index
- [x] `pdf.removePage()` instance method
- [x] `pdf.movePage()` instance method
- [x] `pdf.getPage()` returns `PDFPage`
- [x] `pdf.getPages()` returns `PDFPage[]`
- [x] Tests with merge/copy scenarios

### Phase 3: Convenience Methods & Page Embedding ✅ COMPLETE

- [x] `PDF.create()` static method (create empty document)
- [x] `PDF.merge()` static method (convenience wrapper)
- [x] `pdf.extractPages()` instance method
- [x] `pdf.embedPage()` method
- [x] `EmbeddedPage` class
- [x] `page.drawPage()` method with background option
- [x] Tests with overlay/underlay scenarios (19 new tests)

### Phase 4: Polish ✅ COMPLETE

- [x] Handle encrypted source documents (ObjectCopier re-encodes)
- [x] Resource name conflict resolution (unique name generation)
- [x] Rotation handling (PDFPage.rotation, setRotation)
- [x] Opacity support via ExtGState
- [x] Position and scale options for drawPage

---

## Test Plan

### Unit Tests ✅ COMPLETE

- ObjectCopier with various object types (primitives, arrays, dicts, streams)
- Circular reference handling
- Page copying with inherited attributes
- Page tree add/remove/move
- Stream handling (encrypted vs unencrypted)
- Self-document copying (page duplication)

### Integration Tests ✅ COMPLETE

- [x] Copy specific pages from one PDF to another
- [x] Copy pages from encrypted source
- [x] Copy form pages with annotations
- [x] Same-document page duplication
- [x] Visual output tests in `test-output/object-copier/`
- [x] Static merge API
- [x] Extract pages into new document
- [x] Overlay/underlay tests with embedPage/drawPage

### Fixtures Used

- `fixtures/basic/rot0.pdf` — Simple test PDF
- `fixtures/forms/sample_form.pdf` — Form with annotations
- `fixtures/encryption/PasswordSample-128bit.pdf` — Encrypted source

---

## Open Questions

1. **AcroForm handling on merge?**
   - Current: copy annotations with page, form fields NOT merged into AcroForm
   - Future: option to merge form fields with renaming

2. **Page rotation in overlays?**
   - Current: PDFPage.rotation provides access, setRotation() for modification
   - Future: option to match target rotation in drawPage()

3. **Static merge vs instance method?**
   - `PDF.merge([bytes1, bytes2])` vs `pdf1.mergeWith(pdf2)`
   - Recommend both: static for convenience, instance for control

---

## Implementation Notes

### ObjectCopier Key Behaviors

1. **Reference Remapping**: Source refs are mapped to new dest refs via `refMap`
2. **Lazy Allocation**: Dest ref allocated before copying content (handles cycles)
3. **Stream Handling**:
   - Unencrypted: copy raw bytes, preserve filters
   - Encrypted: decode, copy raw, let dest re-encode on save
4. **Filtered Keys**: Removes /Parent, /Tabs, /StructParents, /B (beads), /Thumb

### PDFPageTree Key Behaviors

1. **Lazy Flattening**: Tree structure preserved until first modification
2. **Parent Updates**: Modified pages get /Parent set to root
3. **Count Updates**: /Count on root updated after modifications

---

## References

- pdf-lib: `PDFObjectCopier`, `PDFPageEmbedder`
- PDFBox: `PDFMergerUtility`, `Overlay`, `Splitter`, `PDFCloneUtility`
- PDF Spec: Section 7.7 (Document Structure), Section 8.10 (Form XObjects)
