import { describe, expect, it } from "vitest";

import { PdfDict } from "./pdf-dict";
import { PdfName } from "./pdf-name";
import { PdfNumber } from "./pdf-number";
import { PdfStream } from "./pdf-stream";

describe("PdfStream", () => {
  it("has type 'stream'", () => {
    expect(new PdfStream().type).toBe("stream");
  });

  it("starts with empty data", () => {
    const stream = new PdfStream();

    expect(stream.data.length).toBe(0);
  });

  it("can be constructed with data", () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const stream = new PdfStream(undefined, data);

    expect(stream.data).toBe(data);
  });

  it("can be constructed from dict entries", () => {
    const stream = new PdfStream([
      ["Length", PdfNumber.of(5)],
      ["Filter", PdfName.FlateDecode],
    ]);

    expect(stream.getNumber("Length")?.value).toBe(5);
    expect(stream.getName("Filter")).toBe(PdfName.FlateDecode);
  });

  it("can be constructed from existing PdfDict", () => {
    const dict = PdfDict.of({
      Length: PdfNumber.of(100),
      Filter: PdfName.FlateDecode,
    });

    const stream = new PdfStream(dict, new Uint8Array(100));

    expect(stream.getNumber("Length")?.value).toBe(100);
    expect(stream.data.length).toBe(100);
  });

  describe("inherits PdfDict behavior", () => {
    it("supports get/set", () => {
      const stream = new PdfStream();

      stream.set("Type", PdfName.of("XObject"));

      expect(stream.get("Type")).toBe(PdfName.of("XObject"));
    });

    it("supports typed getters", () => {
      const stream = PdfStream.fromDict({
        Length: PdfNumber.of(42),
      });

      expect(stream.getNumber("Length")?.value).toBe(42);
    });
  });

  describe("data mutation", () => {
    it("setData() updates data", () => {
      const stream = new PdfStream();
      const newData = new Uint8Array([10, 20, 30]);

      stream.setData(newData);

      expect(stream.data).toBe(newData);
    });

    it("setData() marks as dirty", () => {
      const stream = new PdfStream();

      stream.setData(new Uint8Array([1, 2, 3]));

      expect(stream.dirty).toBe(true);
    });

    it("setData() clears Filter and DecodeParms", () => {
      const stream = new PdfStream([
        ["Filter", PdfName.FlateDecode],
        ["DecodeParms", PdfDict.of({ Predictor: PdfNumber.of(12) })],
      ]);

      expect(stream.has("Filter")).toBe(true);
      expect(stream.has("DecodeParms")).toBe(true);

      stream.setData(new Uint8Array([1, 2, 3]));

      expect(stream.has("Filter")).toBe(false);
      expect(stream.has("DecodeParms")).toBe(false);
    });

    it("dict changes mark as dirty", () => {
      const stream = new PdfStream();

      stream.set("Filter", PdfName.FlateDecode);

      expect(stream.dirty).toBe(true);
    });

    it("clearDirty() resets the flag", () => {
      const stream = new PdfStream();

      stream.setData(new Uint8Array([1, 2, 3]));
      expect(stream.dirty).toBe(true);

      stream.clearDirty();
      expect(stream.dirty).toBe(false);
    });
  });

  describe("static fromDict()", () => {
    it("creates stream from entries and data", () => {
      const data = new Uint8Array([1, 2, 3]);

      const stream = PdfStream.fromDict({ Length: PdfNumber.of(3) }, data);

      expect(stream.getNumber("Length")?.value).toBe(3);
      expect(stream.data).toBe(data);
    });
  });
});
