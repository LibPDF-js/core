import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfStream } from "#src/objects/pdf-stream";
import { describe, expect, it } from "vitest";

import {
  clearAllDirtyFlags,
  clearDirtyFlags,
  collectChanges,
  hasChanges,
  hasDirtyDescendant,
} from "./change-collector";
import { ObjectRegistry } from "./object-registry";

describe("hasDirtyDescendant", () => {
  describe("primitives", () => {
    it("returns false for PdfNumber", () => {
      expect(hasDirtyDescendant(PdfNumber.of(42))).toBe(false);
    });

    it("returns false for PdfName", () => {
      expect(hasDirtyDescendant(PdfName.Page)).toBe(false);
    });

    it("returns false for PdfRef", () => {
      expect(hasDirtyDescendant(PdfRef.of(1, 0))).toBe(false);
    });
  });

  describe("dict", () => {
    it("returns false for clean dict", () => {
      const dict = PdfDict.of({ Type: PdfName.Page });

      expect(hasDirtyDescendant(dict)).toBe(false);
    });

    it("returns true for dirty dict", () => {
      const dict = new PdfDict();

      dict.set("Type", PdfName.Page); // Makes it dirty

      expect(hasDirtyDescendant(dict)).toBe(true);
    });

    it("returns true when nested dict is dirty", () => {
      const inner = new PdfDict();
      const outer = PdfDict.of({ Resources: inner });

      expect(hasDirtyDescendant(outer)).toBe(false);

      inner.set("Font", new PdfDict()); // Makes inner dirty

      expect(hasDirtyDescendant(outer)).toBe(true);
    });

    it("returns true when deeply nested dict is dirty (3+ levels)", () => {
      const level3 = new PdfDict();
      const level2 = PdfDict.of({ Deep: level3 });
      const level1 = PdfDict.of({ Mid: level2 });
      const root = PdfDict.of({ Top: level1 });

      expect(hasDirtyDescendant(root)).toBe(false);

      level3.set("Value", PdfNumber.of(42)); // Makes level3 dirty

      expect(hasDirtyDescendant(root)).toBe(true);
    });

    it("stops at PdfRef boundary", () => {
      // outer contains a ref to another object
      const outer = PdfDict.of({ Child: PdfRef.of(5, 0) });

      // Even if we conceptually think of ref 5 0 R as dirty,
      // the outer dict doesn't know that - it just sees a ref
      expect(hasDirtyDescendant(outer)).toBe(false);
    });
  });

  describe("array", () => {
    it("returns false for clean array", () => {
      const arr = PdfArray.of(PdfNumber.of(1), PdfNumber.of(2));

      expect(hasDirtyDescendant(arr)).toBe(false);
    });

    it("returns true for dirty array", () => {
      const arr = new PdfArray();

      arr.push(PdfNumber.of(1)); // Makes it dirty

      expect(hasDirtyDescendant(arr)).toBe(true);
    });

    it("returns true when nested array is dirty", () => {
      const inner = new PdfArray();
      const outer = PdfArray.of(inner);

      expect(hasDirtyDescendant(outer)).toBe(false);

      inner.push(PdfNumber.of(42)); // Makes inner dirty

      expect(hasDirtyDescendant(outer)).toBe(true);
    });

    it("returns true when dict inside array is dirty", () => {
      const dict = new PdfDict();
      const arr = PdfArray.of(dict);

      expect(hasDirtyDescendant(arr)).toBe(false);

      dict.set("Key", PdfNumber.of(1)); // Makes dict dirty

      expect(hasDirtyDescendant(arr)).toBe(true);
    });
  });

  describe("stream", () => {
    it("returns false for clean stream", () => {
      const stream = PdfStream.fromDict({ Length: PdfNumber.of(0) });

      expect(hasDirtyDescendant(stream)).toBe(false);
    });

    it("returns true when stream dict is dirty", () => {
      const stream = new PdfStream();

      stream.set("Filter", PdfName.FlateDecode); // Makes it dirty

      expect(hasDirtyDescendant(stream)).toBe(true);
    });

    it("returns true when stream data is changed", () => {
      const stream = new PdfStream();

      stream.setData(new Uint8Array([1, 2, 3])); // Makes it dirty

      expect(hasDirtyDescendant(stream)).toBe(true);
    });
  });
});

describe("collectChanges", () => {
  it("returns empty changeset for unmodified document", () => {
    const registry = new ObjectRegistry();
    const page = PdfDict.of({ Type: PdfName.Page });

    registry.addLoaded(PdfRef.of(1, 0), page);

    const changes = collectChanges(registry);

    expect(changes.modified.size).toBe(0);
    expect(changes.created.size).toBe(0);
    expect(changes.maxObjectNumber).toBe(0);
  });

  it("collects modified top-level dict", () => {
    const registry = new ObjectRegistry();
    const page = PdfDict.of({ Type: PdfName.Page });
    const pageRef = PdfRef.of(1, 0);

    registry.addLoaded(pageRef, page);

    page.set("MediaBox", PdfArray.of()); // Modify it

    const changes = collectChanges(registry);

    expect(changes.modified.size).toBe(1);
    expect(changes.modified.get(pageRef)).toBe(page);
    expect(changes.maxObjectNumber).toBe(1);
  });

  it("collects indirect object when nested dict is dirty", () => {
    const registry = new ObjectRegistry();
    const resources = new PdfDict();
    const page = PdfDict.of({ Type: PdfName.Page, Resources: resources });
    const pageRef = PdfRef.of(1, 0);

    registry.addLoaded(pageRef, page);

    resources.set("Font", new PdfDict()); // Modify nested dict

    const changes = collectChanges(registry);

    expect(changes.modified.size).toBe(1);
    expect(changes.modified.get(pageRef)).toBe(page);
  });

  it("collects indirect object when nested array is dirty", () => {
    const registry = new ObjectRegistry();
    const mediaBox = new PdfArray();
    const page = PdfDict.of({ Type: PdfName.Page, MediaBox: mediaBox });
    const pageRef = PdfRef.of(1, 0);

    registry.addLoaded(pageRef, page);

    mediaBox.push(PdfNumber.of(0), PdfNumber.of(0)); // Modify nested array

    const changes = collectChanges(registry);

    expect(changes.modified.size).toBe(1);
    expect(changes.modified.get(pageRef)).toBe(page);
  });

  it("tracks modifications across PdfRef boundaries separately", () => {
    const registry = new ObjectRegistry();
    const resourceRef = PdfRef.of(2, 0);

    // Page points to resources via ref
    const page = PdfDict.of({ Type: PdfName.Page, Resources: resourceRef });
    const pageRef = PdfRef.of(1, 0);

    // Resources is a separate indirect object
    const resources = new PdfDict();

    registry.addLoaded(pageRef, page);
    registry.addLoaded(resourceRef, resources);

    // Modify only resources
    resources.set("Font", new PdfDict());

    const changes = collectChanges(registry);

    // Only resources should be in modified set, not page
    expect(changes.modified.size).toBe(1);
    expect(changes.modified.has(resourceRef)).toBe(true);
    expect(changes.modified.has(pageRef)).toBe(false);
  });

  it("includes new registered objects in created set", () => {
    const registry = new ObjectRegistry();
    const newDict = new PdfDict();

    const ref = registry.register(newDict);

    const changes = collectChanges(registry);

    expect(changes.created.size).toBe(1);
    expect(changes.created.get(ref)).toBe(newDict);
  });

  it("new unregistered (embedded) objects don't appear separately", () => {
    const registry = new ObjectRegistry();
    const page = PdfDict.of({ Type: PdfName.Page });
    const pageRef = PdfRef.of(1, 0);

    registry.addLoaded(pageRef, page);

    // Add a new embedded dict (not registered)
    const newBox = PdfArray.of(
      PdfNumber.of(0),
      PdfNumber.of(0),
      PdfNumber.of(612),
      PdfNumber.of(792),
    );

    page.set("MediaBox", newBox); // newBox is embedded, not registered

    const changes = collectChanges(registry);

    // Only page should be in modified, newBox is embedded
    expect(changes.modified.size).toBe(1);
    expect(changes.modified.has(pageRef)).toBe(true);
    expect(changes.created.size).toBe(0);
  });

  it("calculates maxObjectNumber from both modified and created", () => {
    // Create registry with xref that has object 10
    const xref = new Map<number, { type: string; offset: number; generation: number }>([
      [10, { type: "uncompressed", offset: 100, generation: 0 }],
    ]);

    const registry = new ObjectRegistry(
      xref as Map<number, import("#src/parser/xref-parser").XRefEntry>,
    );

    // Load object at number 10
    const page = PdfDict.of({ Type: PdfName.Page });
    const pageRef = PdfRef.of(10, 0);

    registry.addLoaded(pageRef, page);
    page.set("Modified", PdfNumber.of(1));

    // Register new object (will get number 11 since xref max is 10)
    const newDict = new PdfDict();
    const newRef = registry.register(newDict);

    const changes = collectChanges(registry);

    expect(newRef.objectNumber).toBe(11);
    expect(changes.maxObjectNumber).toBe(11);
  });
});

describe("clearDirtyFlags", () => {
  it("clears dirty flag on dict", () => {
    const dict = new PdfDict();

    dict.set("Key", PdfNumber.of(1));
    expect(dict.dirty).toBe(true);

    clearDirtyFlags(dict);
    expect(dict.dirty).toBe(false);
  });

  it("clears dirty flag on array", () => {
    const arr = new PdfArray();

    arr.push(PdfNumber.of(1));
    expect(arr.dirty).toBe(true);

    clearDirtyFlags(arr);
    expect(arr.dirty).toBe(false);
  });

  it("clears dirty on nested objects", () => {
    const inner = new PdfDict();
    const outer = PdfDict.of({ Inner: inner });

    inner.set("Key", PdfNumber.of(1));
    expect(inner.dirty).toBe(true);

    clearDirtyFlags(outer);

    expect(outer.dirty).toBe(false);
    expect(inner.dirty).toBe(false);
  });

  it("clears dirty on deeply nested objects", () => {
    const level3 = new PdfDict();
    const level2 = PdfDict.of({ Deep: level3 });
    const level1 = PdfDict.of({ Mid: level2 });
    const root = PdfDict.of({ Top: level1 });

    level3.set("Value", PdfNumber.of(42));
    expect(level3.dirty).toBe(true);

    clearDirtyFlags(root);

    expect(root.dirty).toBe(false);
    expect(level1.dirty).toBe(false);
    expect(level2.dirty).toBe(false);
    expect(level3.dirty).toBe(false);
  });

  it("stops at PdfRef boundaries", () => {
    // We can't test this directly because we don't have the referenced object
    // But we can verify it doesn't throw when encountering refs
    const dict = PdfDict.of({ Child: PdfRef.of(5, 0) });

    dict.set("Other", PdfNumber.of(1));

    // Should not throw
    clearDirtyFlags(dict);
    expect(dict.dirty).toBe(false);
  });

  it("clears dirty on stream", () => {
    const stream = new PdfStream();

    stream.setData(new Uint8Array([1, 2, 3]));
    expect(stream.dirty).toBe(true);

    clearDirtyFlags(stream);
    expect(stream.dirty).toBe(false);
  });
});

describe("clearAllDirtyFlags", () => {
  it("clears all loaded objects", () => {
    const registry = new ObjectRegistry();
    const dict1 = new PdfDict();
    const dict2 = new PdfDict();

    registry.addLoaded(PdfRef.of(1, 0), dict1);
    registry.addLoaded(PdfRef.of(2, 0), dict2);

    dict1.set("Key", PdfNumber.of(1));
    dict2.set("Key", PdfNumber.of(2));

    expect(dict1.dirty).toBe(true);
    expect(dict2.dirty).toBe(true);

    clearAllDirtyFlags(registry);

    expect(dict1.dirty).toBe(false);
    expect(dict2.dirty).toBe(false);
  });

  it("clears new objects", () => {
    const registry = new ObjectRegistry();
    const newDict = new PdfDict();

    registry.register(newDict);
    newDict.set("Key", PdfNumber.of(1));

    expect(newDict.dirty).toBe(true);

    clearAllDirtyFlags(registry);

    expect(newDict.dirty).toBe(false);
  });
});

describe("hasChanges", () => {
  it("returns false for unmodified document", () => {
    const registry = new ObjectRegistry();
    const page = PdfDict.of({ Type: PdfName.Page });

    registry.addLoaded(PdfRef.of(1, 0), page);

    expect(hasChanges(registry)).toBe(false);
  });

  it("returns true when loaded object is dirty", () => {
    const registry = new ObjectRegistry();
    const page = PdfDict.of({ Type: PdfName.Page });

    registry.addLoaded(PdfRef.of(1, 0), page);
    page.set("Modified", PdfNumber.of(1));

    expect(hasChanges(registry)).toBe(true);
  });

  it("returns true when new objects exist", () => {
    const registry = new ObjectRegistry();

    registry.register(new PdfDict());

    expect(hasChanges(registry)).toBe(true);
  });

  it("returns true when nested object is dirty", () => {
    const registry = new ObjectRegistry();
    const resources = new PdfDict();
    const page = PdfDict.of({ Type: PdfName.Page, Resources: resources });

    registry.addLoaded(PdfRef.of(1, 0), page);

    resources.set("Font", new PdfDict());

    expect(hasChanges(registry)).toBe(true);
  });
});
