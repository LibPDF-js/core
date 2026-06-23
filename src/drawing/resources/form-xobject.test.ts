import { PDFFormXObject } from "#src/drawing/resources/form-xobject";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { describe, expect, it } from "vitest";

describe("PDFFormXObject", () => {
  it("emits Group and Resources dictionaries when configured", () => {
    const resources = PdfDict.of({
      Font: new PdfDict(),
    });

    const stream = PDFFormXObject.createStream(
      {
        bbox: { x: 10, y: 20, width: 100, height: 50 },
        operators: [],
        resources,
        group: {
          colorSpace: "DeviceRGB",
          isolated: true,
          knockout: false,
        },
      },
      new Uint8Array([0x71, 0x0a]),
    );

    expect(stream.get("Resources")).toBe(resources);

    const group = stream.getDict("Group");
    expect(group).toBeDefined();
    expect(group?.getName("S")?.value).toBe("Transparency");
    expect(group?.getName("CS")?.value).toBe("DeviceRGB");
    expect(group?.getBool("I")?.value).toBe(true);
    expect(group?.getBool("K")?.value).toBe(false);
  });

  it("keeps classic form dictionary when transparency options are absent", () => {
    const stream = PDFFormXObject.createStream(
      {
        bbox: { x: 0, y: 0, width: 40, height: 20 },
        operators: [],
      },
      new Uint8Array([0x51]),
    );

    expect(stream.get("Group")).toBeUndefined();
    expect(stream.get("Resources")).toBeUndefined();
    expect(stream.getName("Subtype")).toEqual(PdfName.of("Form"));
  });
});
