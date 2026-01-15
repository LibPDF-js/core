import { describe, expect, it } from "vitest";

import { PdfArray } from "./pdf-array";
import { PdfBool } from "./pdf-bool";
import { PdfDict } from "./pdf-dict";
import { PdfName } from "./pdf-name";
import { PdfNull } from "./pdf-null";
import { PdfNumber } from "./pdf-number";
import {
  isPdfArray,
  isPdfBool,
  isPdfDict,
  isPdfName,
  isPdfNull,
  isPdfNumber,
  isPdfRef,
  isPdfStream,
  isPdfString,
  type PdfObject,
} from "./pdf-object";
import { PdfRef } from "./pdf-ref";
import { PdfStream } from "./pdf-stream";
import { PdfString } from "./pdf-string";

describe("PdfObject type guards", () => {
  const objects: PdfObject[] = [
    PdfNull.instance,
    PdfBool.TRUE,
    PdfNumber.of(42),
    PdfName.of("Test"),
    PdfString.fromString("hello"),
    PdfRef.of(1, 0),
    new PdfArray(),
    new PdfDict(),
    new PdfStream(),
  ];

  it("isPdfNull identifies null", () => {
    expect(isPdfNull(PdfNull.instance)).toBe(true);

    const nonNullObjects = objects.filter(o => o.type !== "null");

    expect(nonNullObjects.every(o => isPdfNull(o))).toBe(false);
  });

  it("isPdfBool identifies booleans", () => {
    expect(isPdfBool(PdfBool.TRUE)).toBe(true);
    expect(isPdfBool(PdfBool.FALSE)).toBe(true);

    const nonBoolObjects = objects.filter(o => o.type !== "bool");

    expect(nonBoolObjects.every(o => isPdfBool(o))).toBe(false);
  });

  it("isPdfNumber identifies numbers", () => {
    expect(isPdfNumber(PdfNumber.of(42))).toBe(true);
    expect(isPdfNumber(PdfNumber.of(-3.14))).toBe(true);

    const nonNumberObjects = objects.filter(o => o.type !== "number");

    expect(nonNumberObjects.every(o => isPdfNumber(o))).toBe(false);
  });

  it("isPdfName identifies names", () => {
    expect(isPdfName(PdfName.of("Test"))).toBe(true);
    expect(isPdfName(PdfName.Type)).toBe(true);

    const nonNameObjects = objects.filter(o => o.type !== "name");

    expect(nonNameObjects.every(o => isPdfName(o))).toBe(false);
  });

  it("isPdfString identifies strings", () => {
    expect(isPdfString(PdfString.fromString("test"))).toBe(true);
    expect(isPdfString(PdfString.fromHex("4142"))).toBe(true);

    const nonStringObjects = objects.filter(o => o.type !== "string");

    expect(nonStringObjects.every(o => isPdfString(o))).toBe(false);
  });

  it("isPdfRef identifies refs", () => {
    expect(isPdfRef(PdfRef.of(1, 0))).toBe(true);

    const nonRefObjects = objects.filter(o => o.type !== "ref");

    expect(nonRefObjects.every(o => isPdfRef(o))).toBe(false);
  });

  it("isPdfArray identifies arrays", () => {
    expect(isPdfArray(new PdfArray())).toBe(true);

    const nonArrayObjects = objects.filter(o => o.type !== "array");

    expect(nonArrayObjects.every(o => isPdfArray(o))).toBe(false);
  });

  it("isPdfDict identifies dicts (but not streams)", () => {
    expect(isPdfDict(new PdfDict())).toBe(true);
    expect(isPdfDict(new PdfStream())).toBe(false); // streams have type "stream"

    const nonDictObjects = objects.filter(o => o.type !== "dict");

    expect(nonDictObjects.every(o => isPdfDict(o))).toBe(false);
  });

  it("isPdfStream identifies streams", () => {
    expect(isPdfStream(new PdfStream())).toBe(true);
    expect(isPdfStream(new PdfDict())).toBe(false);

    const nonStreamObjects = objects.filter(o => o.type !== "stream");

    expect(nonStreamObjects.every(o => isPdfStream(o))).toBe(false);
  });

  it("all objects have a type field", () => {
    for (const obj of objects) {
      expect(typeof obj.type).toBe("string");
    }
  });
});
