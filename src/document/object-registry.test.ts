import { describe, expect, it } from "vitest";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfRef } from "#src/objects/pdf-ref";
import type { XRefEntry } from "#src/parser/xref-parser";
import { ObjectRegistry } from "./object-registry";

describe("ObjectRegistry", () => {
  describe("construction", () => {
    it("starts with nextObjectNumber = 1 when no xref", () => {
      const registry = new ObjectRegistry();

      expect(registry.nextObjectNumber).toBe(1);
    });

    it("starts after max xref object number", () => {
      const xref = new Map<number, XRefEntry>([
        [1, { type: "uncompressed", offset: 100, generation: 0 }],
        [5, { type: "uncompressed", offset: 200, generation: 0 }],
        [3, { type: "uncompressed", offset: 150, generation: 0 }],
      ]);

      const registry = new ObjectRegistry(xref);

      expect(registry.nextObjectNumber).toBe(6); // max(1,5,3) + 1
    });
  });

  describe("loaded objects", () => {
    it("addLoaded stores object", () => {
      const registry = new ObjectRegistry();
      const ref = PdfRef.of(1, 0);
      const obj = new PdfDict([["Type", PdfName.Page]]);

      registry.addLoaded(ref, obj);

      expect(registry.getObject(ref)).toBe(obj);
    });

    it("getRef returns ref for loaded object", () => {
      const registry = new ObjectRegistry();
      const ref = PdfRef.of(1, 0);
      const obj = new PdfDict();

      registry.addLoaded(ref, obj);

      expect(registry.getRef(obj)).toBe(ref);
    });

    it("isRegistered returns true for loaded objects", () => {
      const registry = new ObjectRegistry();
      const obj = new PdfDict();

      registry.addLoaded(PdfRef.of(1, 0), obj);

      expect(registry.isRegistered(obj)).toBe(true);
    });

    it("isNew returns false for loaded objects", () => {
      const registry = new ObjectRegistry();
      const ref = PdfRef.of(1, 0);

      registry.addLoaded(ref, new PdfDict());

      expect(registry.isNew(ref)).toBe(false);
    });
  });

  describe("new objects", () => {
    it("register assigns sequential object numbers", () => {
      const registry = new ObjectRegistry();
      const obj1 = new PdfDict();
      const obj2 = new PdfDict();

      const ref1 = registry.register(obj1);
      const ref2 = registry.register(obj2);

      expect(ref1.objectNumber).toBe(1);
      expect(ref2.objectNumber).toBe(2);
      expect(ref1.generation).toBe(0);
      expect(ref2.generation).toBe(0);
    });

    it("register continues from xref max", () => {
      const xref = new Map<number, XRefEntry>([
        [10, { type: "uncompressed", offset: 100, generation: 0 }],
      ]);

      const registry = new ObjectRegistry(xref);
      const ref = registry.register(new PdfDict());

      expect(ref.objectNumber).toBe(11);
    });

    it("getRef returns ref for new object", () => {
      const registry = new ObjectRegistry();
      const obj = new PdfDict();

      const ref = registry.register(obj);

      expect(registry.getRef(obj)).toBe(ref);
    });

    it("getObject returns new object", () => {
      const registry = new ObjectRegistry();
      const obj = new PdfDict();

      const ref = registry.register(obj);

      expect(registry.getObject(ref)).toBe(obj);
    });

    it("isNew returns true for new objects", () => {
      const registry = new ObjectRegistry();
      const ref = registry.register(new PdfDict());

      expect(registry.isNew(ref)).toBe(true);
    });

    it("hasNewObjects returns true when new objects exist", () => {
      const registry = new ObjectRegistry();

      expect(registry.hasNewObjects()).toBe(false);

      registry.register(new PdfDict());

      expect(registry.hasNewObjects()).toBe(true);
    });

    it("getNewObjects returns all new objects", () => {
      const registry = new ObjectRegistry();
      const obj1 = new PdfDict();
      const obj2 = new PdfDict();

      const ref1 = registry.register(obj1);
      const ref2 = registry.register(obj2);

      const newObjs = registry.getNewObjects();

      expect(newObjs.size).toBe(2);
      expect(newObjs.get(ref1)).toBe(obj1);
      expect(newObjs.get(ref2)).toBe(obj2);
    });
  });

  describe("commitNewObjects", () => {
    it("moves new objects to loaded", () => {
      const registry = new ObjectRegistry();
      const obj = new PdfDict();
      const ref = registry.register(obj);

      expect(registry.isNew(ref)).toBe(true);

      registry.commitNewObjects();

      expect(registry.isNew(ref)).toBe(false);
      expect(registry.getObject(ref)).toBe(obj);
      expect(registry.hasNewObjects()).toBe(false);
    });

    it("clears new objects set", () => {
      const registry = new ObjectRegistry();

      registry.register(new PdfDict());
      registry.register(new PdfDict());

      registry.commitNewObjects();

      expect(registry.getNewObjects().size).toBe(0);
    });
  });

  describe("primitives", () => {
    it("getRef returns undefined for primitives", () => {
      const registry = new ObjectRegistry();
      const num = PdfNumber.of(42);

      // Primitives can't be tracked in WeakMap
      expect(registry.getRef(num)).toBeNull();
    });

    it("isRegistered returns false for primitives", () => {
      const registry = new ObjectRegistry();
      const num = PdfNumber.of(42);

      expect(registry.isRegistered(num)).toBe(false);
    });
  });

  describe("entries iterator", () => {
    it("yields all loaded and new objects", () => {
      const registry = new ObjectRegistry();

      // Add loaded
      const loaded = new PdfDict();
      const loadedRef = PdfRef.of(1, 0);

      registry.addLoaded(loadedRef, loaded);

      // Add new
      const newObj = new PdfDict();
      const newRef = registry.register(newObj);

      // Collect all entries
      const entries = [...registry.entries()];

      expect(entries).toHaveLength(2);
      expect(entries).toContainEqual([loadedRef, loaded]);
      expect(entries).toContainEqual([newRef, newObj]);
    });
  });
});
