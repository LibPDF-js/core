import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import type { PdfObject } from "#src/objects/pdf-object";
import type { PdfRef } from "#src/objects/pdf-ref";
import { describe, expect, it } from "vitest";

import { PDF } from "./pdf";
import type { PDFPage } from "./pdf-page";

/**
 * Build a box array. Entries are passed through as given, so a test can author
 * corners in either order.
 */
function box(...values: number[]): PdfArray {
  return new PdfArray(values.map(value => PdfNumber.of(value)));
}

/**
 * A single-page document whose page carries exactly the entries given.
 *
 * `addPage` writes a MediaBox of its own, so it is removed first: a test that says
 * nothing about MediaBox is testing a page that has none.
 */
function pageWith(entries: Record<string, PdfObject>): { pdf: PDF; page: PDFPage } {
  const pdf = PDF.create();
  const page = pdf.addPage();

  page.dict.delete("MediaBox");

  for (const [key, value] of Object.entries(entries)) {
    page.dict.set(key, value);
  }

  return { pdf, page };
}

/**
 * Re-parent a page onto a fresh chain of `/Pages` nodes.
 *
 * `ancestors` runs nearest-first: the first entry becomes the page's parent, the
 * second that node's parent, and so on. Each entry is the set of attributes that
 * node carries, so a test can place an attribute an arbitrary distance away.
 */
function withAncestors(pdf: PDF, page: PDFPage, ancestors: Record<string, PdfObject>[]): void {
  let childRef: PdfRef | null = null;
  let child: PdfDict = page.dict;

  for (const attributes of ancestors) {
    const node = new PdfDict();

    node.set("Type", PdfName.Pages);

    for (const [key, value] of Object.entries(attributes)) {
      node.set(key, value);
    }

    const nodeRef = pdf.register(node);

    child.set("Parent", nodeRef);
    child = node;
    childRef = nodeRef;
  }

  // The topmost synthetic node is a root: it has no parent of its own.
  if (childRef !== null) {
    child.delete("Parent");
  }
}

describe("PDFPage geometry", () => {
  describe("box corners vs origin and size", () => {
    it("derives width and height from the corner difference, not the upper corner", () => {
      const { page } = pageWith({ MediaBox: box(10, 25, 380, 550) });

      expect(page.getMediaBox()).toEqual({ x: 10, y: 25, width: 370, height: 525 });
    });

    it("reads an origin-zero box unchanged", () => {
      const { page } = pageWith({ MediaBox: box(0, 0, 612, 792) });

      expect(page.getMediaBox()).toEqual({ x: 0, y: 0, width: 612, height: 792 });
    });

    it("derives a CropBox offset inside the MediaBox", () => {
      const { page } = pageWith({
        MediaBox: box(0, 0, 612, 792),
        CropBox: box(20, 30, 512, 692),
      });

      expect(page.getCropBox()).toEqual({ x: 20, y: 30, width: 492, height: 662 });
    });

    it("orders corners given upper-first", () => {
      const { page } = pageWith({
        MediaBox: box(0, 0, 612, 792),
        CropBox: box(512, 692, 20, 30),
      });

      expect(page.getCropBox()).toEqual({ x: 20, y: 30, width: 492, height: 662 });
    });

    it("orders fully swapped MediaBox corners", () => {
      const { page } = pageWith({ MediaBox: box(612, 792, 0, 0) });

      expect(page.getMediaBox()).toEqual({ x: 0, y: 0, width: 612, height: 792 });
    });

    it("handles a box with a negative origin", () => {
      const { page } = pageWith({ MediaBox: box(-10, -20, 100, 80) });

      expect(page.getMediaBox()).toEqual({ x: -10, y: -20, width: 110, height: 100 });
    });

    it("keeps fractional coordinates exact", () => {
      const { page } = pageWith({ MediaBox: box(0.5, 1.25, 595.5, 842.25) });

      expect(page.getMediaBox()).toEqual({ x: 0.5, y: 1.25, width: 595, height: 841 });
    });

    it("resolves indirect entries inside the box array", () => {
      const { pdf, page } = pageWith({});
      const upperY = pdf.register(PdfNumber.of(550));

      page.dict.set(
        "MediaBox",
        new PdfArray([PdfNumber.of(10), PdfNumber.of(25), PdfNumber.of(380), upperY]),
      );

      expect(page.getMediaBox()).toEqual({ x: 10, y: 25, width: 370, height: 525 });
    });

    it("resolves an indirect box array", () => {
      const { pdf, page } = pageWith({});

      page.dict.set("MediaBox", pdf.register(box(10, 25, 380, 550)));

      expect(page.getMediaBox()).toEqual({ x: 10, y: 25, width: 370, height: 525 });
    });

    it("ignores a box with fewer than four entries", () => {
      const { page } = pageWith({ MediaBox: box(0, 0, 612) });

      expect(page.getMediaBox()).toEqual({ x: 0, y: 0, width: 612, height: 792 });
    });

    it("ignores a box with a non-numeric entry", () => {
      const { page } = pageWith({
        MediaBox: new PdfArray([
          PdfNumber.of(0),
          PdfNumber.of(0),
          PdfName.of("Letter"),
          PdfNumber.of(792),
        ]),
      });

      expect(page.getMediaBox()).toEqual({ x: 0, y: 0, width: 612, height: 792 });
    });

    it("falls back to MediaBox for an unusable CropBox", () => {
      const { page } = pageWith({
        MediaBox: box(0, 0, 400, 500),
        CropBox: box(1, 2),
      });

      expect(page.getCropBox()).toEqual({ x: 0, y: 0, width: 400, height: 500 });
    });
  });

  describe("non-inheritable boxes", () => {
    it("derives BleedBox, TrimBox and ArtBox from their corners", () => {
      const { page } = pageWith({
        MediaBox: box(0, 0, 612, 792),
        BleedBox: box(5, 5, 607, 787),
        TrimBox: box(10, 10, 602, 782),
        ArtBox: box(20, 20, 592, 772),
      });

      expect(page.getBleedBox()).toEqual({ x: 5, y: 5, width: 602, height: 782 });
      expect(page.getTrimBox()).toEqual({ x: 10, y: 10, width: 592, height: 772 });
      expect(page.getArtBox()).toEqual({ x: 20, y: 20, width: 572, height: 752 });
    });

    it("does not inherit BleedBox from an ancestor", () => {
      const { pdf, page } = pageWith({ MediaBox: box(0, 0, 612, 792) });

      withAncestors(pdf, page, [{ BleedBox: box(5, 5, 607, 787) }]);

      // Not an inheritable attribute, so this must fall through to CropBox, which
      // in turn falls back to MediaBox.
      expect(page.getBleedBox()).toEqual({ x: 0, y: 0, width: 612, height: 792 });
    });
  });

  describe("page tree attribute inheritance", () => {
    it("takes MediaBox from the parent when the page has none", () => {
      const { pdf, page } = pageWith({});

      withAncestors(pdf, page, [{ MediaBox: box(0, 0, 400, 500) }]);

      expect(page.getMediaBox()).toEqual({ x: 0, y: 0, width: 400, height: 500 });
    });

    it("keeps walking past an ancestor that does not carry the attribute", () => {
      const { pdf, page } = pageWith({});

      withAncestors(pdf, page, [{}, { MediaBox: box(0, 0, 400, 500) }]);

      expect(page.getMediaBox()).toEqual({ x: 0, y: 0, width: 400, height: 500 });
    });

    it("prefers the nearest ancestor's value", () => {
      const { pdf, page } = pageWith({});

      withAncestors(pdf, page, [
        { MediaBox: box(0, 0, 400, 500) },
        { MediaBox: box(0, 0, 612, 792) },
      ]);

      expect(page.getMediaBox()).toEqual({ x: 0, y: 0, width: 400, height: 500 });
    });

    it("prefers the page's own value over an ancestor's", () => {
      const { pdf, page } = pageWith({ MediaBox: box(0, 0, 200, 300) });

      withAncestors(pdf, page, [{ MediaBox: box(0, 0, 400, 500) }]);

      expect(page.getMediaBox()).toEqual({ x: 0, y: 0, width: 200, height: 300 });
    });

    it("inherits CropBox", () => {
      const { pdf, page } = pageWith({ MediaBox: box(0, 0, 612, 792) });

      withAncestors(pdf, page, [{ CropBox: box(20, 30, 512, 692) }]);

      expect(page.getCropBox()).toEqual({ x: 20, y: 30, width: 492, height: 662 });
    });

    it("inherits Rotate", () => {
      const { pdf, page } = pageWith({ MediaBox: box(0, 0, 612, 792) });

      withAncestors(pdf, page, [{ Rotate: PdfNumber.of(90) }]);

      expect(page.rotation).toBe(90);
    });

    it("lets an explicit Rotate 0 on the page beat an inherited rotation", () => {
      const { pdf, page } = pageWith({
        MediaBox: box(0, 0, 612, 792),
        Rotate: PdfNumber.of(0),
      });

      withAncestors(pdf, page, [{ Rotate: PdfNumber.of(90) }]);

      // The stopping condition is "the entry is present", not "the value is
      // truthy" — the page says it is unrotated.
      expect(page.rotation).toBe(0);
      expect(page.width).toBe(612);
      expect(page.height).toBe(792);
    });

    it("falls back to US Letter when no ancestor defines a MediaBox", () => {
      const { pdf, page } = pageWith({});

      withAncestors(pdf, page, [{}, {}]);

      expect(page.getMediaBox()).toEqual({ x: 0, y: 0, width: 612, height: 792 });
    });

    it("terminates on a circular Parent chain", () => {
      const { pdf, page } = pageWith({});
      const node = new PdfDict();

      node.set("Type", PdfName.Pages);

      const nodeRef = pdf.register(node);

      // The page points at the node and the node points back at the page.
      page.dict.set("Parent", nodeRef);
      node.set("Parent", page.ref);

      expect(page.getMediaBox()).toEqual({ x: 0, y: 0, width: 612, height: 792 });
      expect(page.rotation).toBe(0);
    });

    it("stops after the depth cap on a chain longer than any real page tree", () => {
      const { pdf, page } = pageWith({});

      // 80 empty nodes, then the MediaBox — further away than the walk looks.
      const ancestors: Record<string, PdfObject>[] = Array.from({ length: 80 }, () => ({}));

      ancestors.push({ MediaBox: box(0, 0, 400, 500) });
      withAncestors(pdf, page, ancestors);

      expect(page.getMediaBox()).toEqual({ x: 0, y: 0, width: 612, height: 792 });
    });
  });

  describe("effective page size", () => {
    it("measures the CropBox when it crops the page down", () => {
      const { page } = pageWith({
        MediaBox: box(0, 0, 612, 792),
        CropBox: box(20, 30, 512, 692),
      });

      expect(page.width).toBe(492);
      expect(page.height).toBe(662);
    });

    it("does not let a CropBox larger than the MediaBox enlarge the page", () => {
      const { page } = pageWith({
        MediaBox: box(0, 0, 612, 792),
        CropBox: box(-10, -10, 700, 900),
      });

      expect(page.width).toBe(612);
      expect(page.height).toBe(792);
    });

    it("measures the overlap when the CropBox overhangs on some sides only", () => {
      const { page } = pageWith({
        MediaBox: box(0, 0, 612, 792),
        CropBox: box(-50, 100, 400, 900),
      });

      // Intersection is [0 100 400 792].
      expect(page.width).toBe(400);
      expect(page.height).toBe(692);
    });

    it("falls back to the MediaBox when the CropBox shares no area with it", () => {
      const { page } = pageWith({
        MediaBox: box(0, 0, 612, 792),
        CropBox: box(700, 900, 800, 1000),
      });

      // Degenerate input with no correct answer. A zero-sized page would push a 0
      // into every derived dimension, so the MediaBox is reported instead.
      expect(page.width).toBe(612);
      expect(page.height).toBe(792);
    });

    it("measures a non-zero-origin MediaBox with no CropBox", () => {
      const { page } = pageWith({ MediaBox: box(10, 25, 380, 550) });

      expect(page.width).toBe(370);
      expect(page.height).toBe(525);
    });

    it("reports the CropBox unclipped even where it exceeds the MediaBox", () => {
      const { page } = pageWith({
        MediaBox: box(0, 0, 612, 792),
        CropBox: box(-10, -10, 700, 900),
      });

      // The intersection applies to the page's size, not to the accessor: this
      // reports the box as authored.
      expect(page.getCropBox()).toEqual({ x: -10, y: -10, width: 710, height: 910 });
    });
  });

  describe("rotation and size together", () => {
    it("swaps the axes of an offset CropBox at 90 degrees", () => {
      const { page } = pageWith({
        MediaBox: box(0, 0, 612, 792),
        CropBox: box(20, 30, 512, 692),
        Rotate: PdfNumber.of(90),
      });

      expect(page.width).toBe(662);
      expect(page.height).toBe(492);
    });

    it("keeps the axes of an offset CropBox at 180 degrees", () => {
      const { page } = pageWith({
        MediaBox: box(0, 0, 612, 792),
        CropBox: box(20, 30, 512, 692),
        Rotate: PdfNumber.of(180),
      });

      expect(page.width).toBe(492);
      expect(page.height).toBe(662);
    });

    it("swaps the axes of an offset CropBox at 270 degrees", () => {
      const { page } = pageWith({
        MediaBox: box(0, 0, 612, 792),
        CropBox: box(20, 30, 512, 692),
        Rotate: PdfNumber.of(270),
      });

      expect(page.width).toBe(662);
      expect(page.height).toBe(492);
    });

    it("normalizes rotations outside 0-359 and negative rotations", () => {
      const cases: [number, 0 | 90 | 180 | 270][] = [
        [450, 90],
        [-90, 270],
        [-180, 180],
        [720, 0],
        [810, 90],
      ];

      for (const [authored, expected] of cases) {
        const { page } = pageWith({
          MediaBox: box(0, 0, 612, 792),
          Rotate: PdfNumber.of(authored),
        });

        expect(page.rotation, `/Rotate ${authored}`).toBe(expected);
      }
    });

    it("reads a rotation that is not a quarter turn as unrotated", () => {
      const { page } = pageWith({
        MediaBox: box(0, 0, 612, 792),
        Rotate: PdfNumber.of(45),
      });

      expect(page.rotation).toBe(0);
    });
  });

  describe("parsed documents", () => {
    /**
     * Assemble a single-page PDF by hand.
     *
     * Attributes are spliced in as raw dictionary text so a fixture can put an
     * entry on the page or on the root `/Pages` node, which is the only way to
     * exercise inheritance through the parser rather than through a built dict.
     */
    function buildPdf(pageAttributes: string, rootAttributes = ""): Uint8Array {
      const bodies = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        `<< /Type /Pages /Kids [3 0 R] /Count 1 ${rootAttributes} >>`,
        `<< /Type /Page /Parent 2 0 R /Resources << >> ${pageAttributes} >>`,
      ];

      let body = "%PDF-1.7\n";
      const offsets: number[] = [];

      for (const [index, dict] of bodies.entries()) {
        offsets.push(body.length);
        body += `${index + 1} 0 obj\n${dict}\nendobj\n`;
      }

      const startXref = body.length;

      body += `xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n`;

      for (const offset of offsets) {
        body += `${String(offset).padStart(10, "0")} 00000 n \n`;
      }

      body += `trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;

      return new TextEncoder().encode(body);
    }

    /**
     * Expected sizes are measured, not derived: each row is what PDFium reports
     * for the same input (FPDF_GetPageWidthF / HeightF, cross-checked against the
     * size of the bitmap it rasterizes).
     */
    const measured: [string, string, string, number, number][] = [
      ["origin-zero MediaBox", "/MediaBox [0 0 612 792]", "", 612, 792],
      ["non-zero-origin MediaBox", "/MediaBox [10 25 380 550]", "", 370, 525],
      ["offset CropBox", "/MediaBox [0 0 612 792] /CropBox [20 30 512 692]", "", 492, 662],
      [
        "CropBox with swapped corners",
        "/MediaBox [0 0 612 792] /CropBox [512 692 20 30]",
        "",
        492,
        662,
      ],
      ["MediaBox with swapped corners", "/MediaBox [612 792 0 0]", "", 612, 792],
      [
        "CropBox exceeding the MediaBox",
        "/MediaBox [0 0 612 792] /CropBox [-10 -10 700 900]",
        "",
        612,
        792,
      ],
      [
        "CropBox overhanging two sides",
        "/MediaBox [0 0 612 792] /CropBox [-50 100 400 900]",
        "",
        400,
        692,
      ],
      [
        "offset CropBox rotated 90",
        "/MediaBox [0 0 612 792] /CropBox [20 30 512 692] /Rotate 90",
        "",
        662,
        492,
      ],
      [
        "offset CropBox rotated 180",
        "/MediaBox [0 0 612 792] /CropBox [20 30 512 692] /Rotate 180",
        "",
        492,
        662,
      ],
      [
        "offset CropBox rotated 270",
        "/MediaBox [0 0 612 792] /CropBox [20 30 512 692] /Rotate 270",
        "",
        662,
        492,
      ],
      ["inherited MediaBox and Rotate", "", "/MediaBox [0 0 792 612] /Rotate 90", 612, 792],
      [
        "own Rotate 0 under an inherited Rotate 90",
        "/Rotate 0",
        "/MediaBox [0 0 612 792] /Rotate 90",
        612,
        792,
      ],
    ];

    for (const [name, pageAttributes, rootAttributes, width, height] of measured) {
      it(`reports ${width} x ${height} for a page with ${name}`, async () => {
        const pdf = await PDF.load(buildPdf(pageAttributes, rootAttributes));
        const page = pdf.getPage(0);

        expect(page).not.toBeNull();
        expect(page?.width).toBe(width);
        expect(page?.height).toBe(height);
      });
    }

    it("resolves an inherited MediaBox and Rotate, not just a size that looks right", async () => {
      const pdf = await PDF.load(buildPdf("", "/MediaBox [0 0 792 612] /Rotate 90"));
      const page = pdf.getPage(0);

      // The size alone does not prove inheritance here: 612 x 792 is also what a
      // reader reports when it finds neither attribute and falls back to US Letter
      // unrotated. The box and the rotation are what distinguish the two.
      expect(page?.getMediaBox()).toEqual({ x: 0, y: 0, width: 792, height: 612 });
      expect(page?.rotation).toBe(90);
      expect(page?.width).toBe(612);
      expect(page?.height).toBe(792);
    });

    it("keeps an inherited CropBox out of an ancestor's MediaBox decision", async () => {
      const pdf = await PDF.load(buildPdf("/MediaBox [0 0 612 792]", "/CropBox [20 30 512 692]"));
      const page = pdf.getPage(0);

      expect(page?.getCropBox()).toEqual({ x: 20, y: 30, width: 492, height: 662 });
      expect(page?.width).toBe(492);
      expect(page?.height).toBe(662);
    });
  });

  describe("consumers of the resolved box", () => {
    it("gives an embedded page a box matching the source corners", async () => {
      const source = PDF.create();
      const sourcePage = source.addPage();

      sourcePage.dict.set("MediaBox", box(10, 25, 380, 550));

      const target = PDF.create();
      const embedded = await target.embedPage(source, 0);

      // The Form XObject BBox is written as [x, y, x + width, y + height], so a
      // size taken from the upper corner pushes it out to [10 25 390 575] — the
      // box grows by its own origin.
      expect(embedded.box).toEqual({ x: 10, y: 25, width: 370, height: 525 });
      expect(embedded.width).toBe(370);
      expect(embedded.height).toBe(525);
    });
  });
});
