import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfNumber } from "#src/objects/pdf-number";
import type { PdfObject } from "#src/objects/pdf-object";
import { describe, expect, it } from "vitest";

import { PDF } from "./pdf";
import type { PDFPage } from "./pdf-page";

const toPdfArray = (values: number[]) => new PdfArray(values.map(value => PdfNumber.of(value)));

const createPage = () => {
  const pdf = PDF.create();
  const page = pdf.addPage({ size: "letter" });

  return { pdf, page };
};

/**
 * Return the parent /Pages node dictionary for a page.
 */
const getParentNode = (pdf: PDF, page: PDFPage): PdfDict => {
  const parentRef = page.dict.getRef("Parent");
  const parent = parentRef ? pdf.getObject(parentRef) : null;

  if (!(parent instanceof PdfDict)) {
    throw new Error("Expected the page to have a parent pages node");
  }

  return parent;
};

/**
 * Move an attribute from the page dictionary onto its parent /Pages node so
 * it is inherited rather than defined on the page itself.
 */
const inheritAttribute = (pdf: PDF, page: PDFPage, key: string, value?: PdfObject) => {
  const parent = getParentNode(pdf, page);

  if (value !== undefined) {
    parent.set(key, value);
  } else {
    const existing = page.dict.get(key);

    if (existing === undefined) {
      throw new Error(`Page has no ${key} to inherit`);
    }

    parent.set(key, existing);
    page.dict.delete(key);
  }
};

describe("PDFPage page attributes", () => {
  describe("MediaBox", () => {
    it("reads a MediaBox defined on the page", () => {
      const { page } = createPage();

      expect(page.getMediaBox()).toEqual({ x: 0, y: 0, width: 612, height: 792 });
    });

    it("inherits MediaBox from the parent pages node", () => {
      const { pdf, page } = createPage();

      inheritAttribute(pdf, page, "MediaBox", toPdfArray([0, 0, 595.28, 841.89]));
      page.dict.delete("MediaBox");

      expect(page.getMediaBox()).toEqual({ x: 0, y: 0, width: 595.28, height: 841.89 });
      expect(page.width).toBeCloseTo(595.28);
      expect(page.height).toBeCloseTo(841.89);
    });

    it("prefers the page's own MediaBox over an inherited one", () => {
      const { pdf, page } = createPage();

      getParentNode(pdf, page).set("MediaBox", toPdfArray([0, 0, 100, 200]));

      // The page's own MediaBox (612x792) must win over the parent's (100x200).
      expect(page.getMediaBox()).toEqual({ x: 0, y: 0, width: 612, height: 792 });
    });

    it("computes width and height from the box origin for offset boxes", () => {
      const { page } = createPage();

      page.dict.set("MediaBox", toPdfArray([20, 30, 632, 822]));

      expect(page.getMediaBox()).toEqual({ x: 20, y: 30, width: 612, height: 792 });
      expect(page.width).toBe(612);
      expect(page.height).toBe(792);
    });

    it("skips a malformed nearer MediaBox in favor of a valid ancestor", () => {
      const { pdf, page } = createPage();

      page.dict.set("MediaBox", new PdfArray([PdfNumber.of(1)]));
      inheritAttribute(pdf, page, "MediaBox", toPdfArray([0, 0, 595.28, 841.89]));

      // The page's malformed entry is skipped; the parent's valid one applies.
      expect(page.getMediaBox()).toEqual({ x: 0, y: 0, width: 595.28, height: 841.89 });
    });
  });

  describe("CropBox", () => {
    it("inherits CropBox from the parent pages node", () => {
      const { pdf, page } = createPage();

      page.dict.delete("CropBox");
      inheritAttribute(pdf, page, "CropBox", toPdfArray([0, 0, 300, 400]));

      expect(page.getCropBox()).toEqual({ x: 0, y: 0, width: 300, height: 400 });
    });

    it("falls back to an inherited MediaBox when CropBox is absent", () => {
      const { pdf, page } = createPage();

      page.dict.delete("MediaBox");
      inheritAttribute(pdf, page, "MediaBox", toPdfArray([0, 0, 595.28, 841.89]));

      expect(page.getCropBox()).toEqual({ x: 0, y: 0, width: 595.28, height: 841.89 });
    });

    it("uses an inherited CropBox for page dimensions when smaller than MediaBox", () => {
      const { pdf, page } = createPage();

      page.dict.delete("CropBox");
      inheritAttribute(pdf, page, "CropBox", toPdfArray([0, 0, 300, 400]));

      // CropBox 300x400 is smaller than the page MediaBox, so it wins.
      expect(page.width).toBe(300);
      expect(page.height).toBe(400);
    });
  });

  describe("Rotate", () => {
    it("inherits Rotate from the parent pages node", () => {
      const { pdf, page } = createPage();

      inheritAttribute(pdf, page, "Rotate", PdfNumber.of(90));

      expect(page.rotation).toBe(90);
      // Rotation swaps the effective dimensions.
      expect(page.width).toBe(792);
      expect(page.height).toBe(612);
    });

    it("prefers the page's own Rotate over an inherited one", () => {
      const { pdf, page } = createPage();

      page.setRotation(180);
      inheritAttribute(pdf, page, "Rotate", PdfNumber.of(90));

      expect(page.rotation).toBe(180);
    });
  });

  describe("malformed page trees", () => {
    it("terminates when the parent chain cycles back to the page", () => {
      const { page } = createPage();

      page.dict.delete("MediaBox");
      page.dict.set("Parent", page.ref);

      expect(page.getMediaBox()).toEqual({ x: 0, y: 0, width: 612, height: 792 });
    });
  });
});
