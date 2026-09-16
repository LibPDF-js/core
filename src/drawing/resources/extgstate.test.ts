import { PDFExtGState } from "#src/drawing/resources/extgstate";
import { PDFFormXObject } from "#src/drawing/resources/form-xobject";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfRef } from "#src/objects/pdf-ref";
import { describe, expect, it } from "vitest";

describe("PDFExtGState", () => {
  it("serializes soft mask with alpha subtype", () => {
    const group = new PDFFormXObject(
      PdfRef.of(100, 0),
      { x: 0, y: 0, width: 200, height: 50 },
      { colorSpace: "DeviceGray", isolated: true },
    );

    const dict = PDFExtGState.createDict({
      fillOpacity: 0.8,
      strokeOpacity: 0.6,
      blendMode: "Multiply",
      softMask: {
        subtype: "Alpha",
        group,
        backdropColor: [0.2],
      },
    });

    expect(dict.getNumber("ca")?.value).toBe(0.8);
    expect(dict.getNumber("CA")?.value).toBe(0.6);
    expect(dict.getName("BM")).toEqual(PdfName.of("Multiply"));

    const smask = dict.getDict("SMask");
    expect(smask).toBeInstanceOf(PdfDict);
    expect(smask?.getName("S")).toEqual(PdfName.of("Alpha"));
    expect(smask?.getRef("G")).toEqual(group.ref);
    expect(smask?.getArray("BC")?.length).toBe(1);
  });

  it("supports explicit soft-mask reset with /SMask /None", () => {
    const dict = PDFExtGState.createDict({ softMask: "None" });

    expect(dict.getName("SMask")).toEqual(PdfName.of("None"));
  });

  it("requires luminosity soft masks to use a transparency group color space", () => {
    const group = new PDFFormXObject(PdfRef.of(101, 0), {
      x: 0,
      y: 0,
      width: 20,
      height: 20,
    });

    expect(() =>
      PDFExtGState.createDict({
        softMask: {
          subtype: "Luminosity",
          group,
        },
      }),
    ).toThrow(/Luminosity soft mask requires/);
  });

  it("validates backdrop component counts against group color space", () => {
    const group = new PDFFormXObject(
      PdfRef.of(102, 0),
      { x: 0, y: 0, width: 20, height: 20 },
      { colorSpace: "DeviceRGB", isolated: true },
    );

    expect(() =>
      PDFExtGState.createDict({
        softMask: {
          subtype: "Alpha",
          group,
          backdropColor: [0.1],
        },
      }),
    ).toThrow(/must have 3 components/);
  });
});
