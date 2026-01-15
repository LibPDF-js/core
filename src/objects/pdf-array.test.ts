import { describe, expect, it } from "vitest";

import { PdfArray } from "./pdf-array";
import { PdfNumber } from "./pdf-number";

describe("PdfArray", () => {
  it("has type 'array'", () => {
    expect(new PdfArray().type).toBe("array");
  });

  it("starts empty", () => {
    const arr = new PdfArray();

    expect(arr.length).toBe(0);
  });

  it("can be constructed with items", () => {
    const arr = new PdfArray([PdfNumber.of(1), PdfNumber.of(2)]);

    expect(arr.length).toBe(2);
  });

  describe("access", () => {
    it("at() returns item at index", () => {
      const arr = PdfArray.of(PdfNumber.of(10), PdfNumber.of(20));

      expect(arr.at(0)).toEqual(PdfNumber.of(10));
      expect(arr.at(1)).toEqual(PdfNumber.of(20));
    });

    it("at() returns undefined for out of bounds", () => {
      const arr = PdfArray.of(PdfNumber.of(1));

      expect(arr.at(5)).toBeUndefined();
      expect(arr.at(-10)).toBeUndefined();
    });

    it("at() supports negative indices", () => {
      const arr = PdfArray.of(PdfNumber.of(1), PdfNumber.of(2), PdfNumber.of(3));

      expect(arr.at(-1)).toEqual(PdfNumber.of(3));
    });
  });

  describe("mutation", () => {
    it("set() updates item at index", () => {
      const arr = PdfArray.of(PdfNumber.of(1), PdfNumber.of(2));

      arr.set(0, PdfNumber.of(99));

      expect(arr.at(0)).toEqual(PdfNumber.of(99));
    });

    it("push() adds items", () => {
      const arr = new PdfArray();

      arr.push(PdfNumber.of(1), PdfNumber.of(2));

      expect(arr.length).toBe(2);
    });

    it("pop() removes and returns last item", () => {
      const arr = PdfArray.of(PdfNumber.of(1), PdfNumber.of(2));

      const popped = arr.pop();

      expect(popped).toEqual(PdfNumber.of(2));
      expect(arr.length).toBe(1);
    });

    it("remove() removes item at index", () => {
      const arr = PdfArray.of(PdfNumber.of(1), PdfNumber.of(2), PdfNumber.of(3));

      arr.remove(1);

      expect(arr.toArray()).toEqual([PdfNumber.of(1), PdfNumber.of(3)]);
    });
  });

  describe("iteration", () => {
    it("is iterable", () => {
      const arr = PdfArray.of(PdfNumber.of(1), PdfNumber.of(2));
      const values = [...arr];

      expect(values).toEqual([PdfNumber.of(1), PdfNumber.of(2)]);
    });

    it("toArray() returns copy", () => {
      const arr = PdfArray.of(PdfNumber.of(1));

      const copy = arr.toArray();

      copy.push(PdfNumber.of(2));

      expect(arr.length).toBe(1); // Original unchanged
    });
  });

  describe("dirty flag", () => {
    it("starts not dirty", () => {
      const arr = new PdfArray();

      expect(arr.dirty).toBe(false);
    });

    it("set() marks as dirty", () => {
      const arr = PdfArray.of(PdfNumber.of(1));

      arr.set(0, PdfNumber.of(2));

      expect(arr.dirty).toBe(true);
    });

    it("push() marks as dirty", () => {
      const arr = new PdfArray();

      arr.push(PdfNumber.of(1));

      expect(arr.dirty).toBe(true);
    });

    it("pop() marks as dirty when item exists", () => {
      const arr = PdfArray.of(PdfNumber.of(1));

      arr.pop();

      expect(arr.dirty).toBe(true);
    });

    it("pop() does not mark dirty when empty", () => {
      const arr = new PdfArray();

      arr.pop();

      expect(arr.dirty).toBe(false);
    });

    it("remove() marks as dirty", () => {
      const arr = PdfArray.of(PdfNumber.of(1), PdfNumber.of(2));

      arr.remove(0);

      expect(arr.dirty).toBe(true);
    });

    it("clearDirty() resets the flag", () => {
      const arr = new PdfArray();

      arr.push(PdfNumber.of(1));
      expect(arr.dirty).toBe(true);

      arr.clearDirty();
      expect(arr.dirty).toBe(false);
    });
  });
});
