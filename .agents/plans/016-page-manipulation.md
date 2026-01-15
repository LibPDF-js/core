# Plan 016: Page Manipulation

## Overview

Extend `PageTree` and `PDF` to support adding, removing, and reordering pages. This builds on Plan 015 (PageTree class) and covers both single-document operations and cross-document page copying.

## Operations

| Method                                     | Description                        |
| ------------------------------------------ | ---------------------------------- |
| `insertPage(index, pageRef)`               | Insert existing page at position   |
| `removePage(index)`                        | Remove page at position            |
| `movePage(from, to)`                       | Reorder page within document       |
| `addPage(options?)`                        | Create and append a new blank page |
| `copyPagesFrom(srcPdf, indices, options?)` | Copy pages from another document   |

## PDF Page Tree Structure

Quick refresher on the tree structure we're manipulating:

```
Catalog
  └── /Pages (root)
        ├── /Type /Pages
        ├── /Count 4
        └── /Kids [
              ref1 → /Type /Page, /Parent (root)
              ref2 → /Type /Pages, /Count 2, /Kids [ref3, ref4]
                       ├── ref3 → /Type /Page, /Parent ref2
                       └── ref4 → /Type /Page, /Parent ref2
            ]
```

Key invariants:

- Every `/Pages` node has `/Count` = total leaf pages under it
- Every `/Page` has `/Parent` pointing to its parent `/Pages` node
- `/Kids` arrays are ordered (document page order)

## Design

### PageTree Extensions

```typescript
// src/document/page-tree.ts

export class PageTree {
  // ...existing from Plan 015...

  private readonly rootRef: PdfRef;
  private readonly getObject: (ref: PdfRef) => Promise<PdfObject | null>;
  private pages: PdfRef[]; // Mutable for modifications

  /** Whether the tree has been flattened for modification */
  private flattened: boolean = false;

  /**
   * Insert a page reference at the given index.
   * Flattens nested tree structure on first modification.
   */
  insertPage(index: number, pageRef: PdfRef): void;

  /**
   * Remove the page at the given index.
   * Flattens nested tree structure on first modification.
   */
  removePage(index: number): PdfRef;

  /**
   * Move a page from one index to another.
   * Flattens nested tree structure on first modification.
   */
  movePage(fromIndex: number, toIndex: number): void;

  /**
   * Rebuild internal page list from tree.
   * Call after external modifications to the tree.
   */
  async reload(): Promise<void>;
}
```

### PDF Extensions

```typescript
// In src/api/pdf.ts

export class PDF {
  // ...existing...

  /**
   * Insert a page at the given index.
   * @param index Position to insert (0 = first, -1 or length = last)
   * @param page The page dict or ref to insert
   */
  insertPage(index: number, page: PdfDict | PdfRef): void;

  /**
   * Remove the page at the given index.
   * @returns The removed page reference
   */
  removePage(index: number): PdfRef;

  /**
   * Move a page from one position to another.
   */
  movePage(fromIndex: number, toIndex: number): void;

  /**
   * Add a new blank page at the end.
   * @param options Page size, rotation, etc.
   */
  addPage(options?: AddPageOptions): PdfRef;

  /**
   * Copy pages from another PDF into this one.
   * Pages are deep-copied with all resources.
   * @returns Refs to the copied pages (not yet inserted)
   * @throws {Error} if any page fails to copy (fail-fast, no partial results)
   */
  copyPagesFrom(source: PDF, indices: number[], options?: CopyPagesOptions): PdfRef[];
}

interface AddPageOptions {
  /** Page width in points (default: 612 = US Letter) */
  width?: number;
  /** Page height in points (default: 792 = US Letter) */
  height?: number;
  /** Use a preset size */
  size?: "letter" | "a4" | "legal";
  /** Page orientation (default: "portrait") */
  orientation?: "portrait" | "landscape";
  /** Rotation in degrees (0, 90, 180, 270) */
  rotate?: number;
  /** Insert at index instead of appending */
  insertAt?: number;
}

interface CopyPagesOptions {
  /** Include article thread beads (default: false) */
  includeBeads?: boolean;
  /** Include page thumbnails (default: false) */
  includeThumbnails?: boolean;
  /** Include structure tree references (default: false) */
  includeStructure?: boolean;
}
```

## Implementation Details

### Tree Flattening Strategy

**Decision**: Flatten on first modification (not on load).

This preserves the original tree structure for read-only operations while simplifying modification logic. When a modification occurs:

1. Check if already flattened (`this.flattened`)
2. If not, rebuild the tree structure:
   - Set root `/Kids` to the flat list of all page refs
   - Update root `/Count` to total pages
   - Update each page's `/Parent` to point to root
   - Remove orphaned intermediate `/Pages` nodes (optional, for cleanliness)
   - Set `this.flattened = true`
3. Proceed with the modification on the now-flat structure

```typescript
private flattenIfNeeded(): void {
  if (this.flattened) return;

  // Get root Pages dict
  const root = this.root; // Loaded during PageTree.load()

  // Replace Kids with flat page list
  root.set("Kids", new PdfArray(this.pages));
  root.set("Count", PdfNumber.of(this.pages.length));

  // Update Parent on each page to point to root
  for (const pageRef of this.pages) {
    const page = this.loadedPages.get(pageRef.toString());
    if (page) {
      page.set("Parent", this.rootRef);
    }
  }

  this.flattened = true;

  // Add warning for transparency
  this.warnings.push("Page tree flattened during modification");
}
```

### Inserting a Page

```typescript
insertPage(index: number, pageRef: PdfRef): void {
  // Normalize index
  if (index < 0) index = this.pages.length;
  if (index > this.pages.length) {
    throw new RangeError(`Index ${index} out of bounds (0-${this.pages.length})`);
  }

  // Flatten tree if this is first modification
  this.flattenIfNeeded();

  // Update internal list
  this.pages.splice(index, 0, pageRef);

  // Update tree structure (now guaranteed flat)
  const kids = this.root.getArray("Kids")!;
  kids.insert(index, pageRef);

  // Update Count
  const count = this.root.getNumber("Count")?.value ?? 0;
  this.root.set("Count", PdfNumber.of(count + 1));

  // Set Parent on the page
  const page = /* get page dict */;
  page.set("Parent", this.rootRef);
}
```

### Removing a Page

```typescript
removePage(index: number): PdfRef {
  if (index < 0 || index >= this.pages.length) {
    throw new RangeError(`Index ${index} out of bounds (0-${this.pages.length - 1})`);
  }

  // Flatten tree if this is first modification
  this.flattenIfNeeded();

  const pageRef = this.pages[index];

  // Update internal list
  this.pages.splice(index, 1);

  // Update tree structure
  const kids = this.root.getArray("Kids")!;
  kids.remove(index);

  // Update Count
  const count = this.root.getNumber("Count")?.value ?? 0;
  this.root.set("Count", PdfNumber.of(count - 1));

  return pageRef;
}
```

### Moving a Page

```typescript
movePage(fromIndex: number, toIndex: number): void {
  if (fromIndex < 0 || fromIndex >= this.pages.length) {
    throw new RangeError(`fromIndex ${fromIndex} out of bounds`);
  }
  if (toIndex < 0 || toIndex >= this.pages.length) {
    throw new RangeError(`toIndex ${toIndex} out of bounds`);
  }
  if (fromIndex === toIndex) return;

  // Flatten tree if this is first modification
  this.flattenIfNeeded();

  const pageRef = this.pages[fromIndex];

  // Update internal list
  this.pages.splice(fromIndex, 1);
  this.pages.splice(toIndex, 0, pageRef);

  // Replace Kids with reordered list
  // No Count update needed - total unchanged
  this.root.set("Kids", new PdfArray(this.pages));
}
```

### Creating a Blank Page

```typescript
// In PDF class
addPage(options: AddPageOptions = {}): PdfRef {
  const { width, height } = resolvePageSize(options);
  const rotate = options.rotate ?? 0;

  // Create minimal page dict
  const page = PdfDict.of({
    Type: PdfName.Page,
    MediaBox: new PdfArray([
      PdfNumber.of(0),
      PdfNumber.of(0),
      PdfNumber.of(width),
      PdfNumber.of(height),
    ]),
    Resources: new PdfDict(),
  });

  if (rotate !== 0) {
    page.set("Rotate", PdfNumber.of(rotate));
  }

  // Register and insert
  const pageRef = this.register(page);
  const index = options.insertAt ?? this.getPageCount();
  this._pages.insertPage(index, pageRef);

  return pageRef;
}

const PAGE_SIZES = {
  letter: { width: 612, height: 792 },
  a4: { width: 595.28, height: 841.89 },
  legal: { width: 612, height: 1008 },
} as const;

function resolvePageSize(options: AddPageOptions): { width: number; height: number } {
  let width: number;
  let height: number;

  if (options.width && options.height) {
    width = options.width;
    height = options.height;
  } else {
    const preset = PAGE_SIZES[options.size ?? "letter"];
    width = preset.width;
    height = preset.height;
  }

  // Swap dimensions for landscape orientation
  if (options.orientation === "landscape") {
    [width, height] = [height, width];
  }

  return { width, height };
}
```

### Cross-Document Page Copying

```typescript
// In PDF class
copyPagesFrom(
  source: PDF,
  indices: number[],
  options: CopyPagesOptions = {}
): PdfRef[] {
  const copier = new ObjectCopier(source, this, {
    includeAnnotations: true, // Always included
    includeBeads: options.includeBeads ?? false,
    includeThumbnails: options.includeThumbnails ?? false,
    includeStructure: options.includeStructure ?? false,
  });

  const copiedRefs: PdfRef[] = [];

  // Fail-fast: any error aborts the entire operation
  for (const index of indices) {
    const srcPageRef = source.getPage(index);
    if (!srcPageRef) {
      throw new Error(`Source page ${index} not found`);
    }

    const copiedPageRef = copier.copyPage(srcPageRef);
    copiedRefs.push(copiedPageRef);
  }

  return copiedRefs;
}
```

#### ObjectCopier

New class for deep-copying objects between documents:

```typescript
// src/document/object-copier.ts

interface ObjectCopierOptions {
  includeAnnotations: boolean;
  includeBeads: boolean;
  includeThumbnails: boolean;
  includeStructure: boolean;
}

export class ObjectCopier {
  private readonly source: PDF;
  private readonly dest: PDF;
  private readonly options: ObjectCopierOptions;

  /** Maps source ref string -> dest ref */
  private readonly refMap = new Map<string, PdfRef>();

  /** Track visited refs to detect circular references */
  private readonly visiting = new Set<string>();

  constructor(source: PDF, dest: PDF, options: ObjectCopierOptions);

  /**
   * Copy a page and all its resources.
   * Flattens inherited attributes into the page.
   */
  copyPage(srcPageRef: PdfRef): PdfRef;

  /**
   * Deep copy any object, remapping refs.
   */
  private copyObject(obj: PdfObject): PdfObject;

  /**
   * Copy a reference, creating new object in dest if needed.
   */
  private copyRef(ref: PdfRef): PdfRef;

  /**
   * Copy a stream, handling encryption state.
   */
  private copyStream(stream: PdfStream): PdfStream;
}
```

##### Page Copying Implementation

```typescript
copyPage(srcPageRef: PdfRef): PdfRef {
  const srcPage = this.source.getObject(srcPageRef) as PdfDict;
  if (!srcPage) {
    throw new Error(`Page object not found: ${srcPageRef}`);
  }

  // Clone the dict (shallow)
  const cloned = this.cloneDict(srcPage);

  // Flatten inherited attributes
  for (const key of ["Resources", "MediaBox", "CropBox", "Rotate"]) {
    if (!cloned.has(key)) {
      const inherited = this.getInheritedAttribute(srcPage, key);
      if (inherited) {
        cloned.set(key, this.copyObject(inherited));
      }
    }
  }

  // Handle optional page-associated objects
  if (!this.options.includeBeads) {
    cloned.delete("B");
  }
  if (!this.options.includeThumbnails) {
    cloned.delete("Thumb");
  }
  if (!this.options.includeStructure) {
    cloned.delete("StructParents");
  }

  // Annotations are always included (already in page dict as /Annots)
  // They'll be deep-copied when we copy the dict values

  // Remove Parent - will be set when inserted into dest tree
  cloned.delete("Parent");

  // Deep copy all values, remapping refs
  const copied = this.copyDictValues(cloned);

  // Register in destination
  return this.dest.register(copied);
}

private getInheritedAttribute(page: PdfDict, key: string): PdfObject | null {
  let current: PdfDict | null = page;

  while (current) {
    const value = current.get(key);
    if (value) return value;

    const parentRef = current.getRef("Parent");
    if (!parentRef) break;

    current = this.source.getObject(parentRef) as PdfDict | null;
  }

  return null;
}
```

##### Stream Copying Strategy

**Decision**: Smart hybrid - copy raw bytes if source unencrypted, re-encode if encrypted.

```typescript
private copyStream(srcStream: PdfStream): PdfStream {
  // Check if source document was encrypted
  const sourceWasEncrypted = this.source.isEncrypted;

  if (!sourceWasEncrypted) {
    // Source wasn't encrypted - we can copy raw encoded bytes
    // This preserves exact encoding and is fastest
    const rawData = srcStream.getRawData(); // Original encoded bytes
    const dictCopy = this.copyDictValues(this.cloneDict(srcStream));
    return new PdfStream(dictCopy, rawData);
  } else {
    // Source was encrypted - we have decrypted data in memory
    // Must re-encode since we can't access original encrypted bytes
    const decodedData = srcStream.getDecodedData();
    const dictCopy = this.copyDictValues(this.cloneDict(srcStream));

    // Get original filters to re-apply
    const filters = srcStream.get("Filter");
    const params = srcStream.get("DecodeParms");

    if (filters) {
      // Re-encode with same filters
      const encodedData = this.encodeWithFilters(decodedData, filters, params);
      dictCopy.set("Length", PdfNumber.of(encodedData.length));
      return new PdfStream(dictCopy, encodedData);
    } else {
      // No filters - store uncompressed
      dictCopy.set("Length", PdfNumber.of(decodedData.length));
      dictCopy.delete("Filter");
      dictCopy.delete("DecodeParms");
      return new PdfStream(dictCopy, decodedData);
    }
  }
}

private encodeWithFilters(
  data: Uint8Array,
  filters: PdfObject,
  params: PdfObject | undefined
): Uint8Array {
  // Use FilterPipeline to re-encode
  // Falls back to uncompressed if encoding fails
  try {
    return FilterPipeline.encode(data, filters, params);
  } catch {
    // If re-encoding fails, store uncompressed
    return data;
  }
}
```

## Sync vs Async

Per Plan 015's philosophy, we want sync operations after load.

**Approach**: Load root Pages dict during `PDF.load()`:

```typescript
export class PageTree {
  private readonly rootRef: PdfRef;
  private readonly root: PdfDict; // Loaded during construction
  private pages: PdfRef[];
  private flattened: boolean = false;

  /** Warnings generated during operations */
  readonly warnings: string[] = [];

  static async load(
    pagesRef: PdfRef,
    getObject: (ref: PdfRef) => Promise<PdfObject | null>,
  ): Promise<PageTree> {
    // Walk tree to collect pages (existing logic)
    const pages = await walkPageTree(pagesRef, getObject);

    // Also load and cache the root dict
    const root = (await getObject(pagesRef)) as PdfDict;

    return new PageTree(pagesRef, root, pages, getObject);
  }
}
```

All modification methods are then sync since we have the root dict in memory.

**Note**: `copyPagesFrom` needs object access which is currently async. Options:

1. Make it async (breaks sync-after-load philosophy for this one method)
2. Require pages to be pre-loaded before copy
3. Accept that cross-document operations are inherently async

**Decision**: `copyPagesFrom` is async - cross-document operations involve resolving objects from the source, which may require decompression/decryption.

```typescript
async copyPagesFrom(source: PDF, indices: number[], options?: CopyPagesOptions): Promise<PdfRef[]>;
```

## Edge Cases

### Empty Document

- `removePage()` on empty doc throws `RangeError`
- `movePage()` on empty doc throws `RangeError`
- `addPage()` on empty doc works (creates first page)

### Last Page Removal

- Allowed - results in 0-page document
- Some PDF readers may not like this, but it's valid per spec

### Index Normalization

- Negative indices for `insertPage`: `-1` means append (same as `length`)
- Negative indices for `removePage`/`movePage`: throw `RangeError` (explicit is better)
- Out of bounds: throw `RangeError` with descriptive message

### Nested Page Trees

- Preserved for read-only operations
- Flattened on first modification (insert/remove/move)
- Warning added to `warnings` array: "Page tree flattened during modification"
- Intermediate `/Pages` nodes become orphaned (not removed, just unreferenced)

### Circular References in Source (for copy)

- Track visiting refs in `ObjectCopier.visiting` Set
- If we encounter a ref we're currently visiting, throw an error
- Already-copied refs (in `refMap`) are fine - just return the mapped ref

### Annotations During Copy

- `/Annots` array is deep-copied with the page
- Each annotation dict is copied with remapped refs
- Form field annotations may have broken `/Parent` refs to AcroForm - this is expected; form functionality requires additional work

### Same-Document Copy

- `pdf.copyPagesFrom(pdf, [0])` duplicates page 0
- Works with same `ObjectCopier` logic
- Creates new objects with new refs
- Useful for templates

## Error Handling

### Error Types

```typescript
// Thrown for index out of bounds
throw new RangeError(`Index ${index} out of bounds (0-${max})`);

// Thrown for missing objects during copy
throw new Error(`Page object not found: ${ref}`);

// Thrown for circular references that can't be resolved
throw new Error(`Circular reference detected: ${ref}`);
```

### Fail-Fast for copyPagesFrom

If any page fails to copy, the entire operation throws immediately. No partial results are returned. This keeps behavior predictable - either all pages copy or none do.

```typescript
// This either returns 5 refs or throws
const refs = await pdf.copyPagesFrom(source, [0, 1, 2, 3, 4]);
```

## File Structure

```
src/document/
├── page-tree.ts         # PageTree class (from Plan 015 + extensions)
├── page-tree.test.ts    # Tests
├── object-copier.ts     # New: cross-document copying
├── object-copier.test.ts
└── ...

src/objects/
├── pdf-array.ts         # Needs insert() method added
├── pdf-dict.ts          # Needs clone() method added
└── ...
```

## Required Additions to Existing Classes

### PdfArray.insert()

```typescript
// In src/objects/pdf-array.ts
insert(index: number, value: PdfObject): void {
  this.items.splice(index, 0, value);
  this.dirty = true;
}
```

### PdfDict.clone()

```typescript
// In src/objects/pdf-dict.ts
clone(): PdfDict {
  const cloned = new PdfDict();
  for (const [key, value] of this.entries) {
    cloned.entries.set(key, value); // Shallow copy of values
  }
  return cloned;
}
```

### PdfStream additions

May need:

- `getRawData()` - get original encoded bytes (for unencrypted copy)
- Ensure `getDecodedData()` exists (it does in current impl)

## Test Plan

### Insertion

1. Insert at beginning (index 0)
2. Insert at end (index = length)
3. Insert in middle
4. Insert into empty document (after removing all pages)
5. Insert with negative index (-1 = append)
6. Insert out of bounds throws `RangeError`
7. Verify `/Count` updated correctly
8. Verify `/Parent` set on inserted page
9. Verify tree flattened on first insert (check warning)

### Removal

1. Remove first page
2. Remove last page
3. Remove middle page
4. Remove only page (results in 0 pages)
5. Remove from nested tree structure
6. Remove out of bounds throws `RangeError`
7. Remove from empty doc throws `RangeError`
8. Verify `/Count` updated correctly
9. Verify tree flattened on first remove

### Reordering

1. Move page forward (index 0 → 2)
2. Move page backward (index 2 → 0)
3. Move to same position (no-op)
4. Move in 2-page document
5. Move out of bounds throws `RangeError`

### Adding Blank Pages

1. Default size (letter, portrait)
2. Custom dimensions
3. Preset sizes (a4, legal)
4. With landscape orientation
5. With rotation
6. With insertAt option

### Cross-Document Copy

1. Copy single page
2. Copy multiple pages
3. Copy page with embedded images (stream copying)
4. Copy page with fonts
5. Copy page with annotations
6. Copy from encrypted source (re-encoding)
7. Copy from unencrypted source (raw bytes)
8. Verify resources are copied
9. Verify no refs to source document remain
10. Copied pages can be inserted into dest
11. Copy page with optional beads (opt-in)
12. Error on missing page throws immediately
13. Same-document copy (duplication)

### Round-Trip

1. Load → modify pages → save → reload → verify structure
2. Load nested tree → modify → save → verify flattened
3. Load → copy from another → insert → save → reload

### Edge Cases

1. Circular reference in source document during copy
2. Very large streams (memory handling)
3. Page with missing /Type (lenient handling)

## Dependencies

- Plan 015 (PageTree base class)
- `PdfArray.insert()` method - **needs to be added**
- `PdfDict.clone()` method - **needs to be added**
- `PdfDict.delete()` method - already exists
- `FilterPipeline.encode()` - may need to be added for re-encoding

## Decisions

1. **Flatten on first modification** - Nested tree structure preserved for read-only, flattened when first mutation occurs.

2. **Smart hybrid stream copying** - Copy raw bytes if source unencrypted, decode and re-encode if source was encrypted.

3. **Annotations copied by default** - Beads, thumbnails, and structure tree refs are opt-in via `CopyPagesOptions`.

4. **Fail-fast on copy errors** - Any error during `copyPagesFrom` aborts immediately, no partial results.

5. **Minimal size presets with orientation** - Only letter/a4/legal, but support `orientation: "landscape"` option.

6. **`ObjectCopier` stays internal** - Not exposed publicly for now.

7. **Same-document copying works** - `copyPagesFrom(this, [0])` duplicates page 0.

8. **`removePage()` returns ref** - User can call `getObject(ref)` if they need the dict.

9. **`copyPagesFrom` is async** - Cross-document operations require resolving objects from source.
