# Plan 015: Page Tree Class

## Overview

Create a `PageTree` class in `src/document/` that encapsulates all page tree traversal, caching, and manipulation logic. The high-level `PDF` class will use this internally via a `_pages` property, keeping the API surface clean while the `PageTree` does the heavy lifting.

## Motivation

Currently:

- `getPages()` delegates directly to `ParsedDocument.getPages()` which walks the entire page tree on every call
- No caching of page references at the API level
- Page tree traversal logic lives in `document-parser.ts` (lines 665-742)
- No support for page modification (add/remove/reorder)

This causes:

1. Repeated tree walks on multiple `getPages()` calls
2. Logic scattered between parser and API layers
3. No foundation for future page manipulation features

## Design Philosophy: Sync After Load

Once `PDF.load()` completes, the user has a fully-loaded document. Navigating pages, getting metadata, etc. should all be **synchronous** - no more `await` unless doing actual I/O (like extracting an embedded file).

This means:

- `PageTree` loads eagerly during `PDF.load()`
- All page access methods are sync
- The async work happens once, upfront

### PageTree Class

```typescript
// src/document/page-tree.ts

export class PageTree {
  /** Page refs in document order */
  private readonly pages: PdfRef[];

  private constructor(pages: PdfRef[]);

  /**
   * Load and build the page tree by walking from the root.
   * This is the only async operation.
   */
  static async load(
    pagesRef: PdfRef,
    getObject: (ref: PdfRef) => Promise<PdfObject | null>,
  ): Promise<PageTree>;

  /**
   * Get all page references in document order.
   * Returns a copy to prevent external mutation.
   */
  getPages(): PdfRef[];

  /**
   * Get page count.
   */
  getPageCount(): number;

  /**
   * Get a single page by index (0-based).
   * Returns null if index out of bounds.
   */
  getPage(index: number): PdfRef | null;
}
```

### Integration with PDF class

```typescript
// In src/api/pdf.ts

export class PDF {
  // ...existing fields...

  /** Page tree, loaded during PDF.load() */
  private readonly _pages: PageTree;

  private constructor(
    // ...existing params...
    pages: PageTree,
  ) {
    // ...
    this._pages = pages;
  }

  static async load(bytes: Uint8Array, options?: LoadOptions): Promise<PDF> {
    // ...existing parsing...

    // Load page tree eagerly
    const catalog = await parsed.getCatalog();
    const pagesRef = catalog?.getRef("Pages");
    const pages = pagesRef
      ? await PageTree.load(pagesRef, parsed.getObject.bind(parsed))
      : PageTree.empty();

    return new PDF(parsed, registry, /* ... */, pages);
  }

  /**
   * Get all page references.
   */
  getPages(): PdfRef[] {
    return this._pages.getPages();
  }

  /**
   * Get page count.
   */
  getPageCount(): number {
    return this._pages.getPageCount();
  }

  /**
   * Get a single page by index (0-based).
   */
  getPage(index: number): PdfRef | null {
    return this._pages.getPage(index);
  }
}
```

## Implementation Details

### Tree Walking Algorithm

The static `load()` method walks the tree once:

```typescript
static async load(
  pagesRef: PdfRef,
  getObject: (ref: PdfRef) => Promise<PdfObject | null>,
): Promise<PageTree> {
  const pages: PdfRef[] = [];
  const visited = new Set<string>();

  const walk = async (ref: PdfRef): Promise<void> => {
    const key = `${ref.objectNumber} ${ref.generation}`;
    if (visited.has(key)) return; // Circular reference protection
    visited.add(key);

    const node = await getObject(ref);
    if (!(node instanceof PdfDict)) return;

    const type = node.getName("Type")?.value;

    if (type === "Page") {
      pages.push(ref);
    } else if (type === "Pages") {
      const kids = node.getArray("Kids");
      if (kids) {
        for (let i = 0; i < kids.length; i++) {
          const kid = kids.at(i);
          if (kid instanceof PdfRef) {
            await walk(kid);
          }
        }
      }
    }
  };

  await walk(pagesRef);
  return new PageTree(pages);
}

static empty(): PageTree {
  return new PageTree([]);
}
```

### Sync Accessors

All accessors are simple and sync:

```typescript
getPages(): PdfRef[] {
  return [...this.pages]; // Defensive copy
}

getPageCount(): number {
  return this.pages.length;
}

getPage(index: number): PdfRef | null {
  if (index < 0 || index >= this.pages.length) {
    return null;
  }
  return this.pages[index];
}
```

### No Caching Strategy Needed

Since we load eagerly, there's no lazy cache to manage. The `pages` array is immutable after construction.

## File Structure

```
src/document/
├── page-tree.ts         # New: PageTree class
├── page-tree.test.ts    # New: Tests
├── name-tree.ts         # Existing (similar pattern)
├── object-registry.ts   # Existing
└── ...
```

## Test Plan

1. **Basic traversal** - Single-level page tree
2. **Nested tree** - Multi-level Pages hierarchy (use `fixtures/basic/page_tree_multiple_levels.pdf`)
3. **Caching** - Verify tree is only walked once
4. **Circular reference** - Malformed PDF with circular refs in page tree
5. **Missing /Type** - Handle nodes without /Type gracefully
6. **Empty document** - Document with no pages
7. **Page count optimization** - Verify /Count is used when available
8. **Index access** - `getPage(0)`, `getPage(-1)`, out of bounds

## Future Extensions (Not in Scope)

These are enabled by this architecture but not implemented now:

- `insertPage(index, pageRef)` - Insert page at position
- `removePage(index)` - Remove page at position
- `movePage(from, to)` - Reorder pages
- `Page` wrapper class - High-level page object with MediaBox, rotation, etc.

For mutation, we'd likely need a `reload()` or rebuild method since the internal array is immutable after construction. Cross that bridge when we get there.

## Migration Path

1. Create `PageTree` class with tree walking logic
2. Update `PDF.load()` to build `PageTree` eagerly
3. Change `PDF.getPages()` / `getPageCount()` to sync, delegating to `PageTree`
4. Add new `PDF.getPage(index)` method
5. Keep `ParsedDocument.getPages()` for backward compatibility (document parser tests use it)

## Breaking Changes

- `PDF.getPages()` changes from `Promise<PdfRef[]>` to `PdfRef[]`
- `PDF.getPageCount()` changes from `Promise<number>` to `number`

These are breaking but it's early days. If we want to avoid breaking, we could use different method names (`getPagesSync`) but that feels ugly.

## Dependencies

- `PdfRef`, `PdfDict`, `PdfArray` from `src/objects/`
- `PdfName.Page`, `PdfName.Pages` for type checking
- No new external dependencies

## Decisions Made

1. **Eager loading** - Page tree is walked during `PDF.load()`, not lazily
2. **Sync accessors** - All page access is sync after load
3. **Internal class** - `PageTree` is not exposed; API is through `PDF` methods
4. **Defensive copies** - `getPages()` returns a copy to prevent mutation
