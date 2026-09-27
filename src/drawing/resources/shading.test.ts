import { PDFShading } from "#src/drawing/resources/shading";
import { rgb } from "#src/helpers/colors";
import { PdfName } from "#src/objects/pdf-name";
import { PdfRef } from "#src/objects/pdf-ref";
import { describe, expect, it } from "vitest";

describe("PDFShading opacity model", () => {
  it("classifies uniform stop opacity", () => {
    const definition = PDFShading.createDefinition({
      coords: [0, 0, 100, 0],
      stops: [
        { offset: 0, color: rgb(1, 0, 0), opacity: 0.5 },
        { offset: 1, color: rgb(0, 0, 1), opacity: 0.5 },
      ],
    });

    const shading = new PDFShading(PdfRef.of(300, 0), "axial", definition);

    expect(shading.getOpacityClassification()).toEqual({ mode: "uniform", opacity: 0.5 });
    expect(shading.getUniformOpacity()).toBe(0.5);
  });

  it("normalizes stop opacity into [0, 1]", () => {
    const definition = PDFShading.createDefinition({
      coords: [0, 0, 100, 0],
      stops: [
        { offset: 0, color: rgb(1, 0, 0), opacity: -2 },
        { offset: 1, color: rgb(0, 0, 1), opacity: 3 },
      ],
    });

    const shading = new PDFShading(PdfRef.of(301, 0), "axial", definition);

    expect(shading.getOpacityClassification()).toEqual({ mode: "varying" });
  });

  it("creates grayscale opacity shading for soft-mask composition", () => {
    const definition = PDFShading.createDefinition({
      coords: [0, 0, 0, 100, 100, 80],
      stops: [
        { offset: 0, color: rgb(0.9, 0.2, 0.2), opacity: 1 },
        { offset: 1, color: rgb(0.9, 0.2, 0.2), opacity: 0 },
      ],
    });

    const shading = new PDFShading(PdfRef.of(302, 0), "radial", definition);
    const maskDict = shading.createOpacityMaskDict();

    expect(maskDict.getName("ColorSpace")).toEqual(PdfName.of("DeviceGray"));
    expect(maskDict.getNumber("ShadingType")?.value).toBe(3);
    expect(maskDict.get("Function")).toBeDefined();
  });
});
