import type { RefResolver } from "#src/helpers/types";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfNumber } from "#src/objects/pdf-number";
import type { PdfObject } from "#src/objects/pdf-object";
import { PdfRef } from "#src/objects/pdf-ref";

/**
 * Manages the page tree structure of a PDF document.
 *
 * Provides sync access to pages after initial async load.
 * The page tree is walked once during load, then all access is O(1).
 *
 * Supports modification operations (insert, remove, move) which
 * flatten the tree structure on first mutation.
 */
export class PDFPageTree {
  /** Reference to the root /Pages dict */
  private readonly rootRef: PdfRef;

  /** The root /Pages dict (loaded during construction) */
  private readonly root: PdfDict;

  /** Page refs in document order (mutable for modifications) */
  private pages: PdfRef[];

  /** Whether the tree has been flattened for modification */
  private flattened = false;

  /** Function to resolve page dicts (needed for setting Parent) */
  private readonly getPageDict: (ref: PdfRef) => PdfDict | null;

  /** Warnings generated during operations */
  readonly warnings: string[] = [];

  private constructor(
    rootRef: PdfRef,
    root: PdfDict,
    pages: PdfRef[],
    getPageDict: (ref: PdfRef) => PdfDict | null,
  ) {
    this.rootRef = rootRef;
    this.root = root;
    this.pages = pages;
    this.getPageDict = getPageDict;
  }

  /**
   * Load and build the page tree by walking from the root.
   */
  static load(pagesRef: PdfRef, getObject: RefResolver): PDFPageTree {
    const pages: PdfRef[] = [];
    const visited = new Set<string>();
    const loadedPages = new Map<string, PdfDict>();

    const walk = (ref: PdfRef): void => {
      const key = `${ref.objectNumber} ${ref.generation}`;

      if (visited.has(key)) {
        // Circular reference - skip to avoid infinite loop
        return;
      }

      visited.add(key);

      const node = getObject(ref);

      if (!(node instanceof PdfDict)) {
        return;
      }

      const type = node.getName("Type")?.value;

      if (type === "Page") {
        pages.push(ref);

        loadedPages.set(key, node);
      } else if (type === "Pages") {
        // Kids may be an indirect reference to the array (e.g. /Kids 4 0 R),
        // so resolve through getObject rather than reading the raw value.
        const kids = node.getArray("Kids", getObject);

        if (kids) {
          for (let i = 0; i < kids.length; i++) {
            const kid = kids.at(i);

            if (kid instanceof PdfRef) {
              walk(kid);
            }
          }
        }
      }
      // If no /Type or unknown type, skip silently (lenient parsing)
    };

    walk(pagesRef);

    // Load the root Pages dict
    const root = getObject(pagesRef);

    if (!(root instanceof PdfDict)) {
      throw new Error("Root Pages object is not a dictionary");
    }

    // Create a sync getter for page dicts from our cache
    const getPageDict = (ref: PdfRef): PdfDict | null => {
      const key = `${ref.objectNumber} ${ref.generation}`;

      return loadedPages.get(key) ?? null;
    };

    return new PDFPageTree(pagesRef, root, pages, getPageDict);
  }

  /**
   * Create an empty page tree.
   * Note: This creates a minimal tree without a backing PDF structure.
   * Use only for documents without a page tree.
   */
  static empty(): PDFPageTree {
    // Create a minimal root dict
    const root = new PdfDict();

    root.set("Type", PdfDict.of({}).getName("Pages") ?? new PdfDict());
    root.set("Kids", new PdfArray());
    root.set("Count", PdfNumber.of(0));

    // Use a dummy ref since there's no backing object
    const dummyRef = PdfRef.of(0, 0);

    return new PDFPageTree(dummyRef, root, [], () => null);
  }

  /**
   * Create a page tree from an existing root dict.
   *
   * Used when creating a new document with a fresh page tree.
   *
   * @param rootRef Reference to the Pages dict
   * @param root The Pages dict
   * @param getPageDict Function to look up page dicts by ref
   */
  static fromRoot(
    rootRef: PdfRef,
    root: PdfDict,
    getPageDict: (ref: PdfRef) => PdfDict | null,
  ): PDFPageTree {
    return new PDFPageTree(rootRef, root, [], getPageDict);
  }

  /**
   * Get all page references in document order.
   * Returns a copy to prevent external mutation.
   */
  getPages(): PdfRef[] {
    return [...this.pages];
  }

  /**
   * Get page count.
   */
  getPageCount(): number {
    return this.pages.length;
  }

  /**
   * Get a single page by index (0-based).
   * Returns null if index out of bounds.
   */
  getPage(index: number): PdfRef | null {
    if (index < 0 || index >= this.pages.length) {
      return null;
    }

    return this.pages[index];
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Mutation methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Flatten the page tree to a single level if not already flattened.
   * Called automatically before any mutation.
   */
  private flattenIfNeeded(): void {
    if (this.flattened) {
      return;
    }

    // Replace Kids with flat page list
    this.root.set("Kids", new PdfArray(this.pages));
    this.root.set("Count", PdfNumber.of(this.pages.length));

    // Update Parent on each page to point to root
    for (const pageRef of this.pages) {
      const page = this.getPageDict(pageRef);

      if (page) {
        page.set("Parent", this.rootRef);
      }
    }

    this.flattened = true;
    this.warnings.push("Page tree flattened during modification");
  }

  /**
   * Insert a page reference at the given index.
   * Flattens nested tree structure on first modification.
   *
   * @param index Position to insert (0 = first, negative = from end, > length = append)
   * @param pageRef The page reference to insert
   * @param pageDict The page dictionary (needed to set Parent)
   */
  insertPage(index: number, pageRef: PdfRef, pageDict: PdfDict): void {
    // Normalize index
    if (index < 0) {
      index = this.pages.length;
    }

    if (index > this.pages.length) {
      index = this.pages.length;
    }

    // Flatten tree if this is first modification
    this.flattenIfNeeded();

    // Update internal list
    this.pages.splice(index, 0, pageRef);

    // Update tree structure (now guaranteed flat)
    const kids = this.root.getArray("Kids");

    if (kids) {
      kids.insert(index, pageRef);
    }

    // Update Count
    const count = this.root.getNumber("Count")?.value ?? 0;
    this.root.set("Count", PdfNumber.of(count + 1));

    // Set Parent on the page
    pageDict.set("Parent", this.rootRef);
  }

  /**
   * Remove the page at the given index.
   * Flattens nested tree structure on first modification.
   *
   * @param index The page index to remove
   * @returns The removed page reference
   * @throws {RangeError} if index is out of bounds
   */
  removePage(index: number): PdfRef {
    if (index < 0 || index >= this.pages.length) {
      throw new RangeError(
        `Index ${index} out of bounds (0-${this.pages.length > 0 ? this.pages.length - 1 : 0})`,
      );
    }

    // Flatten tree if this is first modification
    this.flattenIfNeeded();

    const pageRef = this.pages[index];

    // Update internal list
    this.pages.splice(index, 1);

    // Update tree structure
    const kids = this.root.getArray("Kids");

    if (kids) {
      kids.remove(index);
    }

    // Update Count
    const count = this.root.getNumber("Count")?.value ?? 0;
    this.root.set("Count", PdfNumber.of(Math.max(0, count - 1)));

    return pageRef;
  }

  /**
   * Move a page from one index to another.
   * Flattens nested tree structure on first modification.
   *
   * @param fromIndex The current page index
   * @param toIndex The target page index
   * @throws {RangeError} if either index is out of bounds
   */
  movePage(fromIndex: number, toIndex: number): void {
    if (fromIndex < 0 || fromIndex >= this.pages.length) {
      throw new RangeError(`fromIndex ${fromIndex} out of bounds (0-${this.pages.length - 1})`);
    }

    if (toIndex < 0 || toIndex >= this.pages.length) {
      throw new RangeError(`toIndex ${toIndex} out of bounds (0-${this.pages.length - 1})`);
    }

    if (fromIndex === toIndex) {
      return;
    }

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
}
