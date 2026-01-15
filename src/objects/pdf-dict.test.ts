import { describe, expect, it } from "vitest";

import { PdfArray } from "./pdf-array";
import { PdfDict } from "./pdf-dict";
import { PdfName } from "./pdf-name";
import { PdfNumber } from "./pdf-number";
import { PdfRef } from "./pdf-ref";
import { PdfString } from "./pdf-string";

describe("PdfDict", () => {
  it("has type 'dict'", () => {
    expect(new PdfDict().type).toBe("dict");
  });

  it("starts empty", () => {
    const dict = new PdfDict();

    expect(dict.size).toBe(0);
  });

  it("can be constructed with entries", () => {
    const dict = new PdfDict([
      ["Type", PdfName.Page],
      [PdfName.of("Count"), PdfNumber.of(5)],
    ]);

    expect(dict.size).toBe(2);
  });

  describe("get/set", () => {
    it("set and get with string key", () => {
      const dict = new PdfDict();

      dict.set("Type", PdfName.Page);

      expect(dict.get("Type")).toBe(PdfName.Page);
    });

    it("set and get with PdfName key", () => {
      const dict = new PdfDict();

      dict.set(PdfName.Type, PdfName.Page);

      expect(dict.get(PdfName.Type)).toBe(PdfName.Page);
    });

    it("string and PdfName keys are equivalent", () => {
      const dict = new PdfDict();

      dict.set("Type", PdfName.Page);

      expect(dict.get(PdfName.Type)).toBe(PdfName.Page);
    });

    it("returns undefined for missing key", () => {
      const dict = new PdfDict();

      expect(dict.get("Missing")).toBeUndefined();
    });
  });

  describe("has/delete", () => {
    it("has() checks existence", () => {
      const dict = PdfDict.of({ Type: PdfName.Page });

      expect(dict.has("Type")).toBe(true);
      expect(dict.has("Missing")).toBe(false);
    });

    it("delete() removes key", () => {
      const dict = PdfDict.of({ Type: PdfName.Page });

      expect(dict.delete("Type")).toBe(true);
      expect(dict.has("Type")).toBe(false);
      expect(dict.size).toBe(0);
    });

    it("delete() returns false for missing key", () => {
      const dict = new PdfDict();

      expect(dict.delete("Missing")).toBe(false);
    });
  });

  describe("iteration", () => {
    it("keys() returns all keys", () => {
      const dict = PdfDict.of({
        Type: PdfName.Page,
        Count: PdfNumber.of(5),
      });

      const keys = [...dict.keys()];

      expect(keys).toContain(PdfName.Type);
      expect(keys).toContain(PdfName.of("Count"));
    });

    it("is iterable as entries", () => {
      const dict = PdfDict.of({ Type: PdfName.Page });

      const entries = [...dict];

      expect(entries).toEqual([[PdfName.Type, PdfName.Page]]);
    });
  });

  describe("typed getters", () => {
    const dict = PdfDict.of({
      Type: PdfName.Page,
      Count: PdfNumber.of(5),
      Title: PdfString.fromString("Test"),
      Ref: PdfRef.of(1, 0),
      Kids: PdfArray.of(PdfRef.of(2, 0)),
    });

    it("getName() returns name or undefined", () => {
      expect(dict.getName("Type")).toBe(PdfName.Page);
      expect(dict.getName("Count")).toBeUndefined(); // wrong type
      expect(dict.getName("Missing")).toBeUndefined();
    });

    it("getNumber() returns PdfNumber or undefined", () => {
      expect(dict.getNumber("Count")?.value).toBe(5);
      expect(dict.getNumber("Type")).toBeUndefined(); // wrong type
    });

    it("getString() returns string or undefined", () => {
      expect(dict.getString("Title")?.asString()).toBe("Test");
      expect(dict.getString("Count")).toBeUndefined();
    });

    it("getRef() returns ref or undefined", () => {
      expect(dict.getRef("Ref")).toBe(PdfRef.of(1, 0));
      expect(dict.getRef("Type")).toBeUndefined();
    });

    it("getArray() returns array or undefined", () => {
      expect(dict.getArray("Kids")?.length).toBe(1);
      expect(dict.getArray("Type")).toBeUndefined();
    });
  });

  describe("dirty flag", () => {
    it("starts not dirty", () => {
      const dict = new PdfDict();

      expect(dict.dirty).toBe(false);
    });

    it("set() marks as dirty", () => {
      const dict = new PdfDict();

      dict.set("Type", PdfName.Page);

      expect(dict.dirty).toBe(true);
    });

    it("delete() marks as dirty when key exists", () => {
      const dict = PdfDict.of({ Type: PdfName.Page });

      expect(dict.dirty).toBe(false);
      dict.delete("Type");

      expect(dict.dirty).toBe(true);
    });

    it("delete() does not mark dirty when key missing", () => {
      const dict = new PdfDict();

      dict.delete("Missing");

      expect(dict.dirty).toBe(false);
    });

    it("clearDirty() resets the flag", () => {
      const dict = new PdfDict();

      dict.set("Type", PdfName.Page);
      expect(dict.dirty).toBe(true);

      dict.clearDirty();
      expect(dict.dirty).toBe(false);
    });
  });

  describe("static of()", () => {
    it("creates dict from object", () => {
      const dict = PdfDict.of({
        Type: PdfName.Page,
        Count: PdfNumber.of(3),
      });

      expect(dict.get("Type")).toBe(PdfName.Page);
      expect(dict.getNumber("Count")?.value).toBe(3);
    });
  });
});
