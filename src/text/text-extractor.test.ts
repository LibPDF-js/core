import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import type { PdfObject } from "#src/objects/pdf-object";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfStream } from "#src/objects/pdf-stream";
import { describe, expect, it } from "vitest";

import { TextExtractor } from "./text-extractor";
import { TextResources } from "./text-resources";

function helvetica(baseFont = "Helvetica"): PdfDict {
  return PdfDict.of({
    Type: PdfName.of("Font"),
    Subtype: PdfName.of("Type1"),
    BaseFont: PdfName.of(baseFont),
  });
}

function form(
  content: string,
  entries: { matrix?: number[]; resources?: PdfDict; bbox?: number[] } = {},
): PdfStream {
  const dict = PdfDict.of({
    Type: PdfName.of("XObject"),
    Subtype: PdfName.of("Form"),
    BBox: PdfArray.of(...(entries.bbox ?? [0, 0, 100, 100]).map(n => PdfNumber.of(n))),
  });

  if (entries.matrix) {
    dict.set("Matrix", PdfArray.of(...entries.matrix.map(n => PdfNumber.of(n))));
  }

  if (entries.resources) {
    dict.set("Resources", entries.resources);
  }

  return new PdfStream(dict, new TextEncoder().encode(content));
}

function resourcesDict(fonts: Record<string, PdfObject>, xobjects: Record<string, PdfObject> = {}) {
  return PdfDict.of({
    Font: PdfDict.of(fonts),
    XObject: PdfDict.of(xobjects),
  });
}

function resources(dict: PdfDict, table: Map<PdfRef, PdfObject> = new Map()): TextResources {
  return new TextResources(dict, ref => table.get(ref) ?? null);
}

function extract(content: string, res: TextResources) {
  return new TextExtractor(res).extract(new TextEncoder().encode(content));
}

function identityType0(): PdfDict {
  return PdfDict.of({
    Type: PdfName.of("Font"),
    Subtype: PdfName.of("Type0"),
    BaseFont: PdfName.of("Test"),
    Encoding: PdfName.of("Identity-H"),
    DescendantFonts: PdfArray.of(
      PdfDict.of({
        Type: PdfName.of("Font"),
        Subtype: PdfName.of("CIDFontType2"),
        BaseFont: PdfName.of("Test"),
        DW: PdfNumber.of(500),
        CIDSystemInfo: PdfDict.of({
          Registry: PdfName.of("Adobe"),
          Ordering: PdfName.of("Identity"),
          Supplement: PdfNumber.of(0),
        }),
      }),
    ),
  });
}

describe("TextExtractor", () => {
  describe("word spacing", () => {
    it("applies Tw to single-byte code 32", () => {
      const res = resources(resourcesDict({ F1: helvetica() }));

      const chars = extract("BT /F1 10 Tf 100 Tw 0 0 Td (a b) Tj ET", res);
      const b = chars.find(c => c.char === "b")!;
      const space = chars.find(c => c.char === " ")!;

      expect(b.bbox.x).toBeCloseTo(space.bbox.x + space.bbox.width + 100);
    });

    it("does not apply Tw to byte 32 inside a two-byte code", () => {
      const res = resources(resourcesDict({ F1: identityType0() }));

      const chars = extract("BT /F1 10 Tf 100 Tw 0 0 Td <00200041> Tj ET", res);
      const a = chars.find(c => c.char === "A")!;

      expect(a.bbox.x).toBeCloseTo(5);
    });

    it("splits multi-byte strings by the font's CMap", () => {
      const res = resources(resourcesDict({ F1: identityType0() }));

      const chars = extract("BT /F1 10 Tf 0 0 Td <004100420043> Tj ET", res);

      expect(chars.map(c => c.char).join("")).toBe("ABC");
      expect(chars.map(c => c.bbox.x)).toEqual([0, 5, 10]);
    });
  });

  describe("text rise", () => {
    it("scales rise through the text matrix", () => {
      const res = resources(resourcesDict({ F1: helvetica() }));

      const chars = extract("BT /F1 10 Tf 2 0 0 2 0 0 Tm 5 Ts (a) Tj ET", res);

      expect(chars[0].baseline).toBeCloseTo(10);
    });

    it("rotates rise with the text matrix", () => {
      const res = resources(resourcesDict({ F1: helvetica() }));

      const chars = extract("BT /F1 10 Tf 0 1 -1 0 100 100 Tm 5 Ts (a) Tj ET", res);

      expect(chars[0].baseline).toBeCloseTo(100);
      expect(chars[0].bbox.x + chars[0].bbox.width).toBeLessThan(100);
    });
  });

  describe("graphics state", () => {
    it("restores font and size on Q", () => {
      const res = resources(
        resourcesDict({ F1: helvetica("Helvetica"), F2: helvetica("Helvetica-Bold") }),
      );
      const chars = extract(
        `BT /F1 10 Tf 0 0 Td (a) Tj ET
         q BT /F2 20 Tf 0 0 Td (b) Tj ET Q
         BT 0 0 Td (c) Tj ET`,
        res,
      );

      expect(chars.map(c => [c.char, c.fontName, c.fontSize])).toEqual([
        ["a", "Helvetica", 10],
        ["b", "Helvetica-Bold", 20],
        ["c", "Helvetica", 10],
      ]);
    });
  });

  describe("form XObjects", () => {
    it("extracts text drawn inside a form", () => {
      const inner = form("BT /F1 10 Tf 5 5 Td (in) Tj ET", {
        resources: resourcesDict({ F1: helvetica() }),
      });
      const res = resources(resourcesDict({ F1: helvetica() }, { Fm1: inner }));

      const chars = extract("BT /F1 10 Tf 0 0 Td (out) Tj ET /Fm1 Do", res);

      expect(chars.map(c => c.char).join("")).toBe("outin");
    });

    it("positions form text through cm and the form Matrix", () => {
      const inner = form("BT /F1 10 Tf 5 5 Td (x) Tj ET", {
        matrix: [1, 0, 0, 1, 100, 0],
        resources: resourcesDict({ F1: helvetica() }),
      });
      const res = resources(resourcesDict({}, { Fm1: inner }));

      const chars = extract("q 1 0 0 1 0 200 cm /Fm1 Do Q", res);

      expect(chars).toHaveLength(1);
      expect(chars[0].bbox.x).toBeCloseTo(105);
      expect(chars[0].baseline).toBeCloseTo(205);
    });

    it("restores the CTM and font after the form", () => {
      const inner = form("2 0 0 2 0 0 cm BT /F2 30 Tf 0 0 Td (x) Tj ET", {
        resources: resourcesDict({ F2: helvetica() }),
      });
      const res = resources(resourcesDict({ F1: helvetica() }, { Fm1: inner }));

      const chars = extract("BT /F1 10 Tf 0 0 Td (a) Tj ET /Fm1 Do BT 50 0 Td (b) Tj ET", res);

      const b = chars.find(c => c.char === "b")!;

      expect(b.fontSize).toBe(10);
      expect(b.bbox.x).toBeCloseTo(50);
    });

    it("restores state even when the form leaves q/Q unbalanced", () => {
      const inner = form("q q 2 0 0 2 0 0 cm BT /F1 10 Tf 0 0 Td (x) Tj ET", {
        resources: resourcesDict({ F1: helvetica() }),
      });
      const res = resources(resourcesDict({ F1: helvetica() }, { Fm1: inner }));

      const chars = extract("/Fm1 Do BT /F1 10 Tf 50 0 Td (b) Tj ET", res);

      expect(chars.find(c => c.char === "b")!.bbox.x).toBeCloseTo(50);
    });

    it("falls back to the invoking stream's resources when the form has none", () => {
      const inner = form("BT /F1 10 Tf 0 0 Td (x) Tj ET");
      const res = resources(resourcesDict({ F1: helvetica() }, { Fm1: inner }));

      const chars = extract("/Fm1 Do", res);

      expect(chars.map(c => c.char).join("")).toBe("x");
    });

    it("resolves forms and fonts through indirect references", () => {
      const fontRef = PdfRef.of(10, 0);
      const formRef = PdfRef.of(11, 0);
      const table = new Map<PdfRef, PdfObject>([
        [fontRef, helvetica()],
        [
          formRef,
          form("BT /F1 10 Tf 0 0 Td (x) Tj ET", { resources: resourcesDict({ F1: fontRef }) }),
        ],
      ]);
      const res = resources(resourcesDict({}, { Fm1: formRef }), table);

      const chars = extract("/Fm1 Do", res);

      expect(chars.map(c => c.char).join("")).toBe("x");
    });

    it("recurses into nested forms", () => {
      const leaf = form("BT /F1 10 Tf 0 0 Td (leaf) Tj ET", {
        resources: resourcesDict({ F1: helvetica() }),
      });
      const branch = form("/Leaf Do", { resources: resourcesDict({}, { Leaf: leaf }) });
      const res = resources(resourcesDict({}, { Branch: branch }));

      const chars = extract("/Branch Do", res);

      expect(chars.map(c => c.char).join("")).toBe("leaf");
    });

    it("terminates when a form invokes itself", () => {
      const formRef = PdfRef.of(12, 0);
      const table = new Map<PdfRef, PdfObject>();
      const self = form("BT /F1 10 Tf 0 0 Td (x) Tj ET /Me Do", {
        resources: resourcesDict({ F1: helvetica() }, { Me: formRef }),
      });
      table.set(formRef, self);
      const res = resources(resourcesDict({}, { Fm1: formRef }), table);

      const chars = extract("/Fm1 Do", res);

      expect(chars.map(c => c.char).join("")).toBe("x");
    });

    it("ignores image XObjects and unknown names", () => {
      const image = new PdfStream(
        PdfDict.of({ Type: PdfName.of("XObject"), Subtype: PdfName.of("Image") }),
        new Uint8Array([1, 2, 3]),
      );
      const res = resources(resourcesDict({ F1: helvetica() }, { Im1: image }));

      const chars = extract("/Im1 Do /Missing Do BT /F1 10 Tf 0 0 Td (a) Tj ET", res);

      expect(chars.map(c => c.char).join("")).toBe("a");
    });
  });
});

describe("TextResources", () => {
  it("parses a font once when shared between page and form", () => {
    const shared = helvetica();
    const fontRef = PdfRef.of(20, 0);
    const table = new Map<PdfRef, PdfObject>([[fontRef, shared]]);
    const inner = form("", { resources: resourcesDict({ F9: fontRef }) });
    const res = resources(resourcesDict({ F1: fontRef }, { Fm1: inner }), table);

    const fromPage = res.getFont("F1");
    const fromForm = res.getForm("Fm1")!.resources.getFont("F9");

    expect(fromPage).not.toBeNull();
    expect(fromForm).toBe(fromPage);
  });

  it("returns null for unknown or non-font entries", () => {
    const res = resources(resourcesDict({ Bad: PdfNumber.of(1) }));

    expect(res.getFont("Bad")).toBeNull();
    expect(res.getFont("Nope")).toBeNull();
    expect(res.getForm("Nope")).toBeNull();
  });

  it("handles a missing resources dictionary", () => {
    const res = new TextResources(null, () => null);

    expect(res.getFont("F1")).toBeNull();
    expect(res.getForm("Fm1")).toBeNull();
  });
});
