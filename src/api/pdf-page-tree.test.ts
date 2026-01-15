import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import type { PdfObject } from "#src/objects/pdf-object";
import { PdfRef } from "#src/objects/pdf-ref";
import { describe, expect, it } from "vitest";

import { PDFPageTree } from "./pdf-page-tree";

/**
 * Create a resolver that looks up objects in a map.
 */
function createResolver(objects: Map<string, PdfObject>) {
  return async (ref: PdfRef): Promise<PdfObject | null> => {
    const key = `${ref.objectNumber}:${ref.generation}`;
    return objects.get(key) ?? null;
  };
}

/**
 * Create a simple Page dict.
 */
function createPage(): PdfDict {
  const page = new PdfDict();
  page.set("Type", PdfName.Page);
  page.set(
    "MediaBox",
    new PdfArray([PdfNumber.of(0), PdfNumber.of(0), PdfNumber.of(612), PdfNumber.of(792)]),
  );
  return page;
}

/**
 * Create a Pages (intermediate) node.
 */
function createPagesNode(kids: PdfRef[], count: number): PdfDict {
  const pages = new PdfDict();
  pages.set("Type", PdfName.Pages);
  pages.set("Kids", new PdfArray(kids));
  pages.set("Count", PdfNumber.of(count));
  return pages;
}

describe("PageTree", () => {
  describe("empty()", () => {
    it("creates an empty page tree", () => {
      const tree = PDFPageTree.empty();

      expect(tree.getPageCount()).toBe(0);
      expect(tree.getPages()).toEqual([]);
      expect(tree.getPage(0)).toBeNull();
    });
  });

  describe("load() - flat tree", () => {
    it("loads a single-page document", async () => {
      const pageRef = PdfRef.of(3, 0);
      const page = createPage();

      const rootRef = PdfRef.of(1, 0);
      const root = createPagesNode([pageRef], 1);

      const objects = new Map<string, PdfObject>([
        ["1:0", root],
        ["3:0", page],
      ]);

      const tree = await PDFPageTree.load(rootRef, createResolver(objects));

      expect(tree.getPageCount()).toBe(1);
      expect(tree.getPages()).toEqual([pageRef]);
      expect(tree.getPage(0)).toBe(pageRef);
    });

    it("loads a multi-page document", async () => {
      const page1Ref = PdfRef.of(3, 0);
      const page2Ref = PdfRef.of(4, 0);
      const page3Ref = PdfRef.of(5, 0);

      const rootRef = PdfRef.of(1, 0);
      const root = createPagesNode([page1Ref, page2Ref, page3Ref], 3);

      const objects = new Map<string, PdfObject>([
        ["1:0", root],
        ["3:0", createPage()],
        ["4:0", createPage()],
        ["5:0", createPage()],
      ]);

      const tree = await PDFPageTree.load(rootRef, createResolver(objects));

      expect(tree.getPageCount()).toBe(3);
      expect(tree.getPages()).toEqual([page1Ref, page2Ref, page3Ref]);
      expect(tree.getPage(0)).toBe(page1Ref);
      expect(tree.getPage(1)).toBe(page2Ref);
      expect(tree.getPage(2)).toBe(page3Ref);
    });
  });

  describe("load() - nested tree", () => {
    it("loads a two-level tree", async () => {
      // Structure:
      // Root (1 0) /Kids [2 0 R, 5 0 R]
      //   ├── Intermediate (2 0) /Kids [3 0 R, 4 0 R]
      //   │     ├── Page (3 0)
      //   │     └── Page (4 0)
      //   └── Page (5 0)

      const page1Ref = PdfRef.of(3, 0);
      const page2Ref = PdfRef.of(4, 0);
      const page3Ref = PdfRef.of(5, 0);
      const intermediateRef = PdfRef.of(2, 0);
      const rootRef = PdfRef.of(1, 0);

      const intermediate = createPagesNode([page1Ref, page2Ref], 2);
      const root = createPagesNode([intermediateRef, page3Ref], 3);

      const objects = new Map<string, PdfObject>([
        ["1:0", root],
        ["2:0", intermediate],
        ["3:0", createPage()],
        ["4:0", createPage()],
        ["5:0", createPage()],
      ]);

      const tree = await PDFPageTree.load(rootRef, createResolver(objects));

      expect(tree.getPageCount()).toBe(3);
      // Pages should be in document order: 3, 4, 5
      expect(tree.getPages()).toEqual([page1Ref, page2Ref, page3Ref]);
    });

    it("loads a deeply nested tree", async () => {
      // Structure:
      // Root (1 0) /Kids [2 0 R]
      //   └── Level1 (2 0) /Kids [3 0 R]
      //         └── Level2 (3 0) /Kids [4 0 R]
      //               └── Page (4 0)

      const pageRef = PdfRef.of(4, 0);
      const level2Ref = PdfRef.of(3, 0);
      const level1Ref = PdfRef.of(2, 0);
      const rootRef = PdfRef.of(1, 0);

      const level2 = createPagesNode([pageRef], 1);
      const level1 = createPagesNode([level2Ref], 1);
      const root = createPagesNode([level1Ref], 1);

      const objects = new Map<string, PdfObject>([
        ["1:0", root],
        ["2:0", level1],
        ["3:0", level2],
        ["4:0", createPage()],
      ]);

      const tree = await PDFPageTree.load(rootRef, createResolver(objects));

      expect(tree.getPageCount()).toBe(1);
      expect(tree.getPage(0)).toBe(pageRef);
    });
  });

  describe("load() - edge cases", () => {
    it("handles circular references", async () => {
      // Root references itself via Kids
      const rootRef = PdfRef.of(1, 0);
      const pageRef = PdfRef.of(2, 0);

      const root = new PdfDict();
      root.set("Type", PdfName.Pages);
      root.set("Kids", new PdfArray([pageRef, rootRef])); // Circular!
      root.set("Count", PdfNumber.of(1));

      const objects = new Map<string, PdfObject>([
        ["1:0", root],
        ["2:0", createPage()],
      ]);

      const tree = await PDFPageTree.load(rootRef, createResolver(objects));

      // Should not hang, should find the page
      expect(tree.getPageCount()).toBe(1);
      expect(tree.getPage(0)).toBe(pageRef);
    });

    it("handles missing /Type gracefully", async () => {
      const pageRef = PdfRef.of(2, 0);
      const rootRef = PdfRef.of(1, 0);

      // Page without /Type
      const page = new PdfDict();
      page.set(
        "MediaBox",
        new PdfArray([PdfNumber.of(0), PdfNumber.of(0), PdfNumber.of(612), PdfNumber.of(792)]),
      );

      const root = createPagesNode([pageRef], 1);

      const objects = new Map<string, PdfObject>([
        ["1:0", root],
        ["2:0", page],
      ]);

      const tree = await PDFPageTree.load(rootRef, createResolver(objects));

      // Should skip the typeless node
      expect(tree.getPageCount()).toBe(0);
    });

    it("handles missing Kids array", async () => {
      const rootRef = PdfRef.of(1, 0);

      const root = new PdfDict();
      root.set("Type", PdfName.Pages);
      root.set("Count", PdfNumber.of(0));
      // No Kids array

      const objects = new Map<string, PdfObject>([["1:0", root]]);

      const tree = await PDFPageTree.load(rootRef, createResolver(objects));

      expect(tree.getPageCount()).toBe(0);
    });

    it("handles unresolvable references", async () => {
      const pageRef = PdfRef.of(2, 0);
      const missingRef = PdfRef.of(99, 0);
      const rootRef = PdfRef.of(1, 0);

      const root = createPagesNode([pageRef, missingRef], 2);

      const objects = new Map<string, PdfObject>([
        ["1:0", root],
        ["2:0", createPage()],
        // 99:0 is missing
      ]);

      const tree = await PDFPageTree.load(rootRef, createResolver(objects));

      // Should find the valid page, skip the missing one
      expect(tree.getPageCount()).toBe(1);
      expect(tree.getPage(0)).toBe(pageRef);
    });

    it("handles non-dict objects in Kids", async () => {
      const pageRef = PdfRef.of(2, 0);
      const rootRef = PdfRef.of(1, 0);

      const root = createPagesNode([pageRef], 1);

      const objects = new Map<string, PdfObject>([
        ["1:0", root],
        ["2:0", PdfNumber.of(42)], // Not a dict!
      ]);

      const tree = await PDFPageTree.load(rootRef, createResolver(objects));

      expect(tree.getPageCount()).toBe(0);
    });
  });

  describe("getPages()", () => {
    it("returns a defensive copy", async () => {
      const pageRef = PdfRef.of(2, 0);
      const rootRef = PdfRef.of(1, 0);
      const root = createPagesNode([pageRef], 1);

      const objects = new Map<string, PdfObject>([
        ["1:0", root],
        ["2:0", createPage()],
      ]);

      const tree = await PDFPageTree.load(rootRef, createResolver(objects));

      const pages1 = tree.getPages();
      const pages2 = tree.getPages();

      // Different array instances
      expect(pages1).not.toBe(pages2);
      // But same contents
      expect(pages1).toEqual(pages2);

      // Mutating returned array doesn't affect internal state
      pages1.push(PdfRef.of(99, 0));
      expect(tree.getPageCount()).toBe(1);
    });
  });

  describe("getPage()", () => {
    it("returns null for negative index", async () => {
      const pageRef = PdfRef.of(2, 0);
      const rootRef = PdfRef.of(1, 0);
      const root = createPagesNode([pageRef], 1);

      const objects = new Map<string, PdfObject>([
        ["1:0", root],
        ["2:0", createPage()],
      ]);

      const tree = await PDFPageTree.load(rootRef, createResolver(objects));

      expect(tree.getPage(-1)).toBeNull();
      expect(tree.getPage(-100)).toBeNull();
    });

    it("returns null for index >= length", async () => {
      const pageRef = PdfRef.of(2, 0);
      const rootRef = PdfRef.of(1, 0);
      const root = createPagesNode([pageRef], 1);

      const objects = new Map<string, PdfObject>([
        ["1:0", root],
        ["2:0", createPage()],
      ]);

      const tree = await PDFPageTree.load(rootRef, createResolver(objects));

      expect(tree.getPage(1)).toBeNull();
      expect(tree.getPage(100)).toBeNull();
    });

    it("returns null on empty tree", () => {
      const tree = PDFPageTree.empty();

      expect(tree.getPage(0)).toBeNull();
    });
  });

  describe("insertPage()", () => {
    it("inserts at the beginning", async () => {
      const page1Ref = PdfRef.of(3, 0);
      const page1 = createPage();
      const rootRef = PdfRef.of(1, 0);
      const root = createPagesNode([page1Ref], 1);

      const objects = new Map<string, PdfObject>([
        ["1:0", root],
        ["3:0", page1],
      ]);

      const tree = await PDFPageTree.load(rootRef, createResolver(objects));

      const newPageRef = PdfRef.of(10, 0);
      const newPage = createPage();
      tree.insertPage(0, newPageRef, newPage);

      expect(tree.getPageCount()).toBe(2);
      expect(tree.getPage(0)).toBe(newPageRef);
      expect(tree.getPage(1)).toBe(page1Ref);

      // Check that Parent was set
      expect(newPage.getRef("Parent")).toBe(rootRef);

      // Check that root Count was updated
      expect(root.getNumber("Count")?.value).toBe(2);
    });

    it("inserts at the end", async () => {
      const page1Ref = PdfRef.of(3, 0);
      const page1 = createPage();
      const rootRef = PdfRef.of(1, 0);
      const root = createPagesNode([page1Ref], 1);

      const objects = new Map<string, PdfObject>([
        ["1:0", root],
        ["3:0", page1],
      ]);

      const tree = await PDFPageTree.load(rootRef, createResolver(objects));

      const newPageRef = PdfRef.of(10, 0);
      const newPage = createPage();
      tree.insertPage(1, newPageRef, newPage);

      expect(tree.getPageCount()).toBe(2);
      expect(tree.getPage(0)).toBe(page1Ref);
      expect(tree.getPage(1)).toBe(newPageRef);
    });

    it("inserts in the middle", async () => {
      const page1Ref = PdfRef.of(3, 0);
      const page2Ref = PdfRef.of(4, 0);
      const rootRef = PdfRef.of(1, 0);
      const root = createPagesNode([page1Ref, page2Ref], 2);

      const objects = new Map<string, PdfObject>([
        ["1:0", root],
        ["3:0", createPage()],
        ["4:0", createPage()],
      ]);

      const tree = await PDFPageTree.load(rootRef, createResolver(objects));

      const newPageRef = PdfRef.of(10, 0);
      const newPage = createPage();
      tree.insertPage(1, newPageRef, newPage);

      expect(tree.getPageCount()).toBe(3);
      expect(tree.getPage(0)).toBe(page1Ref);
      expect(tree.getPage(1)).toBe(newPageRef);
      expect(tree.getPage(2)).toBe(page2Ref);
    });

    it("normalizes negative index to append", async () => {
      const page1Ref = PdfRef.of(3, 0);
      const rootRef = PdfRef.of(1, 0);
      const root = createPagesNode([page1Ref], 1);

      const objects = new Map<string, PdfObject>([
        ["1:0", root],
        ["3:0", createPage()],
      ]);

      const tree = await PDFPageTree.load(rootRef, createResolver(objects));

      const newPageRef = PdfRef.of(10, 0);
      const newPage = createPage();
      tree.insertPage(-1, newPageRef, newPage);

      expect(tree.getPageCount()).toBe(2);
      expect(tree.getPage(1)).toBe(newPageRef);
    });

    it("generates warning on first modification (flattening)", async () => {
      const page1Ref = PdfRef.of(3, 0);
      const rootRef = PdfRef.of(1, 0);
      const root = createPagesNode([page1Ref], 1);

      const objects = new Map<string, PdfObject>([
        ["1:0", root],
        ["3:0", createPage()],
      ]);

      const tree = await PDFPageTree.load(rootRef, createResolver(objects));

      expect(tree.warnings.length).toBe(0);

      const newPageRef = PdfRef.of(10, 0);
      tree.insertPage(0, newPageRef, createPage());

      expect(tree.warnings.length).toBe(1);
      expect(tree.warnings[0]).toContain("flattened");
    });
  });

  describe("removePage()", () => {
    it("removes first page", async () => {
      const page1Ref = PdfRef.of(3, 0);
      const page2Ref = PdfRef.of(4, 0);
      const rootRef = PdfRef.of(1, 0);
      const root = createPagesNode([page1Ref, page2Ref], 2);

      const objects = new Map<string, PdfObject>([
        ["1:0", root],
        ["3:0", createPage()],
        ["4:0", createPage()],
      ]);

      const tree = await PDFPageTree.load(rootRef, createResolver(objects));

      const removed = tree.removePage(0);

      expect(removed).toBe(page1Ref);
      expect(tree.getPageCount()).toBe(1);
      expect(tree.getPage(0)).toBe(page2Ref);
      expect(root.getNumber("Count")?.value).toBe(1);
    });

    it("removes last page", async () => {
      const page1Ref = PdfRef.of(3, 0);
      const page2Ref = PdfRef.of(4, 0);
      const rootRef = PdfRef.of(1, 0);
      const root = createPagesNode([page1Ref, page2Ref], 2);

      const objects = new Map<string, PdfObject>([
        ["1:0", root],
        ["3:0", createPage()],
        ["4:0", createPage()],
      ]);

      const tree = await PDFPageTree.load(rootRef, createResolver(objects));

      const removed = tree.removePage(1);

      expect(removed).toBe(page2Ref);
      expect(tree.getPageCount()).toBe(1);
      expect(tree.getPage(0)).toBe(page1Ref);
    });

    it("removes only page (results in 0 pages)", async () => {
      const page1Ref = PdfRef.of(3, 0);
      const rootRef = PdfRef.of(1, 0);
      const root = createPagesNode([page1Ref], 1);

      const objects = new Map<string, PdfObject>([
        ["1:0", root],
        ["3:0", createPage()],
      ]);

      const tree = await PDFPageTree.load(rootRef, createResolver(objects));

      tree.removePage(0);

      expect(tree.getPageCount()).toBe(0);
      expect(root.getNumber("Count")?.value).toBe(0);
    });

    it("throws RangeError for out of bounds index", async () => {
      const page1Ref = PdfRef.of(3, 0);
      const rootRef = PdfRef.of(1, 0);
      const root = createPagesNode([page1Ref], 1);

      const objects = new Map<string, PdfObject>([
        ["1:0", root],
        ["3:0", createPage()],
      ]);

      const tree = await PDFPageTree.load(rootRef, createResolver(objects));

      expect(() => tree.removePage(5)).toThrow(RangeError);
      expect(() => tree.removePage(-1)).toThrow(RangeError);
    });

    it("throws RangeError on empty tree", () => {
      const tree = PDFPageTree.empty();

      expect(() => tree.removePage(0)).toThrow(RangeError);
    });
  });

  describe("movePage()", () => {
    it("moves page forward", async () => {
      const page1Ref = PdfRef.of(3, 0);
      const page2Ref = PdfRef.of(4, 0);
      const page3Ref = PdfRef.of(5, 0);
      const rootRef = PdfRef.of(1, 0);
      const root = createPagesNode([page1Ref, page2Ref, page3Ref], 3);

      const objects = new Map<string, PdfObject>([
        ["1:0", root],
        ["3:0", createPage()],
        ["4:0", createPage()],
        ["5:0", createPage()],
      ]);

      const tree = await PDFPageTree.load(rootRef, createResolver(objects));

      tree.movePage(0, 2);

      expect(tree.getPages()).toEqual([page2Ref, page3Ref, page1Ref]);
      // Count should be unchanged
      expect(root.getNumber("Count")?.value).toBe(3);
    });

    it("moves page backward", async () => {
      const page1Ref = PdfRef.of(3, 0);
      const page2Ref = PdfRef.of(4, 0);
      const page3Ref = PdfRef.of(5, 0);
      const rootRef = PdfRef.of(1, 0);
      const root = createPagesNode([page1Ref, page2Ref, page3Ref], 3);

      const objects = new Map<string, PdfObject>([
        ["1:0", root],
        ["3:0", createPage()],
        ["4:0", createPage()],
        ["5:0", createPage()],
      ]);

      const tree = await PDFPageTree.load(rootRef, createResolver(objects));

      tree.movePage(2, 0);

      expect(tree.getPages()).toEqual([page3Ref, page1Ref, page2Ref]);
    });

    it("is a no-op when fromIndex equals toIndex", async () => {
      const page1Ref = PdfRef.of(3, 0);
      const page2Ref = PdfRef.of(4, 0);
      const rootRef = PdfRef.of(1, 0);
      const root = createPagesNode([page1Ref, page2Ref], 2);

      const objects = new Map<string, PdfObject>([
        ["1:0", root],
        ["3:0", createPage()],
        ["4:0", createPage()],
      ]);

      const tree = await PDFPageTree.load(rootRef, createResolver(objects));

      // Should not generate warning since no actual modification
      tree.movePage(1, 1);

      expect(tree.getPages()).toEqual([page1Ref, page2Ref]);
      expect(tree.warnings.length).toBe(0);
    });

    it("throws RangeError for out of bounds fromIndex", async () => {
      const page1Ref = PdfRef.of(3, 0);
      const rootRef = PdfRef.of(1, 0);
      const root = createPagesNode([page1Ref], 1);

      const objects = new Map<string, PdfObject>([
        ["1:0", root],
        ["3:0", createPage()],
      ]);

      const tree = await PDFPageTree.load(rootRef, createResolver(objects));

      expect(() => tree.movePage(5, 0)).toThrow(RangeError);
      expect(() => tree.movePage(-1, 0)).toThrow(RangeError);
    });

    it("throws RangeError for out of bounds toIndex", async () => {
      const page1Ref = PdfRef.of(3, 0);
      const rootRef = PdfRef.of(1, 0);
      const root = createPagesNode([page1Ref], 1);

      const objects = new Map<string, PdfObject>([
        ["1:0", root],
        ["3:0", createPage()],
      ]);

      const tree = await PDFPageTree.load(rootRef, createResolver(objects));

      expect(() => tree.movePage(0, 5)).toThrow(RangeError);
      expect(() => tree.movePage(0, -1)).toThrow(RangeError);
    });
  });
});
