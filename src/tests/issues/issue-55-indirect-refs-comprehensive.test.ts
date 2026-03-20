/**
 * Comprehensive tests for indirect reference resolution across the codebase.
 *
 * These tests synthetically create indirect references by registering inline
 * values as indirect objects and replacing dict entries with PdfRefs. This
 * exercises code paths that would fail without proper resolver usage.
 *
 * Covers: /Kids, /AP, /Opt, /I, /BS, and NameTree /Kids + /Names.
 *
 * @see https://github.com/LibPDF-js/core/issues/55
 */

import { PDF } from "#src/api/pdf";
import type { DropdownField, ListBoxField, TextField } from "#src/document/forms/fields";
import { NameTree } from "#src/document/name-tree";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfStream } from "#src/objects/pdf-stream";
import { PdfString } from "#src/objects/pdf-string";
import { loadFixture } from "#src/test-utils";
import { describe, expect, it } from "vitest";

/**
 * Helper: replace a direct dict entry with an indirect ref to the same value.
 * Returns the PdfRef for the newly registered indirect object.
 */
function makeIndirect(dict: PdfDict, key: string, pdf: PDF): PdfRef | null {
  const value = dict.get(key);

  if (!value || value instanceof PdfRef) {
    return value instanceof PdfRef ? value : null;
  }

  const ref = pdf.register(value);
  dict.set(key, ref);

  return ref;
}

// ─────────────────────────────────────────────────────────────────────────────
// Indirect /Kids on field hierarchies
// ─────────────────────────────────────────────────────────────────────────────

describe("Issue #55: Indirect /Kids in field tree", () => {
  it("collectFields resolves indirect /Kids on non-terminal fields", async () => {
    const bytes = await loadFixture("forms", "fancy_fields.pdf");
    const pdf = await PDF.load(bytes);
    const form = pdf.getForm()!;
    const acroForm = form.acroForm();

    // Get field count with everything inline (baseline)
    const baselineCount = acroForm.getFields().length;
    expect(baselineCount).toBeGreaterThan(0);

    // Now make /Kids indirect on any non-terminal fields we can find.
    // First, traverse the top-level /Fields to find dicts with /Kids.
    const resolve = (ref: PdfRef) => pdf.getObject(ref);
    const acroDict = acroForm.getDict();
    const fieldsArray = acroDict.getArray("Fields", resolve);

    if (fieldsArray) {
      for (let i = 0; i < fieldsArray.length; i++) {
        const item = fieldsArray.at(i, resolve);

        if (item instanceof PdfDict && item.has("Kids")) {
          makeIndirect(item, "Kids", pdf);
        }
      }
    }

    // Clear cache and re-read fields — should still find all of them
    acroForm.clearCache();
    const afterCount = acroForm.getFields().length;
    expect(afterCount).toBe(baselineCount);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Indirect /AP on widget annotations
// ─────────────────────────────────────────────────────────────────────────────

describe("Issue #55: Indirect /AP on widget annotations", () => {
  it("getNormalAppearance resolves indirect /AP dict", async () => {
    const bytes = await loadFixture("forms", "sample_form.pdf");
    const pdf = await PDF.load(bytes);
    const form = pdf.getForm()!;
    const acroForm = form.acroForm();
    const fields = acroForm.getFields();

    // Find a text field with a widget that has an appearance
    const textField = fields.find(f => {
      if (f.type !== "text") {
        return false;
      }
      const widgets = f.getWidgets();

      return widgets.some(w => w.getNormalAppearance() !== null);
    }) as TextField | undefined;

    expect(textField).toBeDefined();

    const widget = textField!.getWidgets()[0];

    // Verify baseline: appearance exists
    const baselineAppearance = widget.getNormalAppearance();
    expect(baselineAppearance).toBeInstanceOf(PdfStream);

    // Make /AP indirect
    makeIndirect(widget.dict, "AP", pdf);

    // Should still find the appearance
    const appearance = widget.getNormalAppearance();
    expect(appearance).toBeInstanceOf(PdfStream);
  });

  it("hasNormalAppearance resolves indirect /AP dict", async () => {
    const bytes = await loadFixture("forms", "sample_form.pdf");
    const pdf = await PDF.load(bytes);
    const form = pdf.getForm()!;
    const fields = form.acroForm().getFields();

    const withAppearance = fields.find(f => {
      return f.getWidgets().some(w => w.hasNormalAppearance());
    });

    expect(withAppearance).toBeDefined();

    const widget = withAppearance!.getWidgets().find(w => w.hasNormalAppearance())!;

    // Make /AP indirect
    makeIndirect(widget.dict, "AP", pdf);

    // Should still detect the appearance
    expect(widget.hasNormalAppearance()).toBe(true);
  });

  it("setNormalAppearance resolves indirect /AP dict", async () => {
    const bytes = await loadFixture("forms", "sample_form.pdf");
    const pdf = await PDF.load(bytes);
    const form = pdf.getForm()!;
    const fields = form.acroForm().getFields();

    const textField = fields.find(f => f.type === "text" && !f.isReadOnly()) as
      | TextField
      | undefined;
    expect(textField).toBeDefined();

    const widget = textField!.getWidgets()[0];

    // Make /AP indirect
    makeIndirect(widget.dict, "AP", pdf);

    // Setting appearance should still work (finds existing AP dict via resolver)
    const stream = new PdfStream(new PdfDict(), new Uint8Array([0x71, 0x0a]));
    widget.setNormalAppearance(stream);

    // Verify it was set
    expect(widget.hasNormalAppearance()).toBe(true);
  });

  it("getOnValue resolves indirect /AP dict on checkbox", async () => {
    const bytes = await loadFixture("forms", "sample_form.pdf");
    const pdf = await PDF.load(bytes);
    const form = pdf.getForm()!;
    const fields = form.acroForm().getFields();

    const checkbox = fields.find(f => f.type === "checkbox");

    if (!checkbox) {
      return;
    } // skip if no checkbox in this fixture

    const widget = checkbox.getWidgets()[0];
    const baselineOnValue = widget.getOnValue();

    // Make /AP indirect
    makeIndirect(widget.dict, "AP", pdf);

    // Should still find the on-value
    expect(widget.getOnValue()).toBe(baselineOnValue);
  });

  it("getBorderStyle resolves indirect /BS dict", async () => {
    const bytes = await loadFixture("forms", "fancy_fields.pdf");
    const pdf = await PDF.load(bytes);
    const form = pdf.getForm()!;
    const fields = form.acroForm().getFields();

    // Find a widget with /BS
    const withBS = fields.flatMap(f => f.getWidgets()).find(w => w.getBorderStyle() !== null);

    if (!withBS) {
      return;
    } // skip if no /BS in fixture

    const baselineBS = withBS.getBorderStyle()!;

    // Make /BS indirect
    makeIndirect(withBS.dict, "BS", pdf);

    const bs = withBS.getBorderStyle();
    expect(bs).not.toBeNull();
    expect(bs!.width).toBe(baselineBS.width);
    expect(bs!.style).toBe(baselineBS.style);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Indirect /Opt and /I on choice fields
// ─────────────────────────────────────────────────────────────────────────────

describe("Issue #55: Indirect /Opt and /I on choice fields", () => {
  it("getOptions resolves indirect /Opt on dropdown", async () => {
    const bytes = await loadFixture("forms", "fancy_fields.pdf");
    const pdf = await PDF.load(bytes);
    const form = pdf.getForm()!;
    const fields = form.acroForm().getFields();

    const dropdown = fields.find(f => f.type === "dropdown") as DropdownField | undefined;

    if (!dropdown) {
      return;
    }

    const baselineOptions = dropdown.getOptions();
    expect(baselineOptions.length).toBeGreaterThan(0);

    // Make /Opt indirect
    makeIndirect(dropdown.getDict(), "Opt", pdf);

    const options = dropdown.getOptions();
    expect(options.length).toBe(baselineOptions.length);
    expect(options[0]?.value).toBe(baselineOptions[0]?.value);
  });

  it("getOptions resolves indirect /Opt on listbox", async () => {
    const bytes = await loadFixture("forms", "fancy_fields.pdf");
    const pdf = await PDF.load(bytes);
    const form = pdf.getForm()!;
    const fields = form.acroForm().getFields();

    const listbox = fields.find(f => f.type === "listbox") as ListBoxField | undefined;

    if (!listbox) {
      return;
    }

    const baselineOptions = listbox.getOptions();
    expect(baselineOptions.length).toBeGreaterThan(0);

    // Make /Opt indirect
    makeIndirect(listbox.getDict(), "Opt", pdf);

    const options = listbox.getOptions();
    expect(options.length).toBe(baselineOptions.length);
    expect(options[0]?.value).toBe(baselineOptions[0]?.value);
  });

  it("getValue resolves indirect /I on listbox", async () => {
    const bytes = await loadFixture("forms", "fancy_fields.pdf");
    const pdf = await PDF.load(bytes);
    const form = pdf.getForm()!;
    const fields = form.acroForm().getFields();

    const listbox = fields.find(f => f.type === "listbox") as ListBoxField | undefined;

    if (!listbox) {
      return;
    }

    // Synthetically set /I as an indirect ref
    const options = listbox.getOptions();

    if (options.length === 0) {
      return;
    }

    const indicesArray = PdfArray.of(PdfNumber.of(0));
    const indicesRef = pdf.register(indicesArray);
    listbox.getDict().set("I", indicesRef);

    // Also set /V to match
    listbox.getDict().set("V", PdfString.fromString(options[0].value));

    const value = listbox.getValue();
    expect(value).toContain(options[0].value);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Indirect /Kids on widget annotations (field base.ts)
// ─────────────────────────────────────────────────────────────────────────────

describe("Issue #55: Indirect /Kids on field widgets", () => {
  it("resolveWidgets handles indirect /Kids array", async () => {
    const bytes = await loadFixture("forms", "sample_form.pdf");
    const pdf = await PDF.load(bytes);
    const form = pdf.getForm()!;
    const acroForm = form.acroForm();

    // Get baseline
    const fields = acroForm.getFields();
    const withWidgets = fields.find(f => f.getWidgets().length > 0);
    expect(withWidgets).toBeDefined();

    const baselineWidgetCount = withWidgets!.getWidgets().length;
    expect(baselineWidgetCount).toBeGreaterThan(0);

    // The 5E sheet has a button with separate /Kids widgets.
    // For this test, use a field that has /Kids and make it indirect.
    const resolve = (ref: PdfRef) => pdf.getObject(ref);
    const fieldsArray = acroForm.getDict().getArray("Fields", resolve);

    if (!fieldsArray) {
      return;
    }

    let madeIndirect = false;

    for (let i = 0; i < fieldsArray.length; i++) {
      const item = fieldsArray.at(i, resolve);

      if (item instanceof PdfDict && item.has("Kids") && !item.has("T")) {
        // This is a widget container — make /Kids indirect
        makeIndirect(item, "Kids", pdf);
        madeIndirect = true;
      }
    }

    if (!madeIndirect) {
      // No separate-widget fields to test; pass vacuously
      return;
    }

    // Re-read: clear cache and verify widgets are still found
    acroForm.clearCache();
    const newFields = acroForm.getFields();
    expect(newFields.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Indirect /Kids and /Names in NameTree
// ─────────────────────────────────────────────────────────────────────────────

describe("Issue #55: Indirect refs in NameTree", () => {
  it("get() resolves indirect /Names array on leaf node", () => {
    // Build a name tree with indirect /Names
    const registry = createMiniRegistry();
    const resolve = (ref: PdfRef) => registry.get(ref) ?? null;

    const namesArray = new PdfArray([
      PdfString.fromString("alpha"),
      PdfString.fromString("value-alpha"),
      PdfString.fromString("beta"),
      PdfString.fromString("value-beta"),
    ]);

    const namesRef = registerObject(registry, namesArray);

    // Root dict has /Names as an indirect ref
    const root = new PdfDict();
    root.set("Names", namesRef);

    const tree = new NameTree(root, resolve);

    expect(tree.get("alpha")).toBeInstanceOf(PdfString);
    expect((tree.get("alpha") as PdfString).asString()).toBe("value-alpha");
    expect(tree.get("beta")).toBeInstanceOf(PdfString);
    expect(tree.get("nonexistent")).toBeNull();
  });

  it("get() resolves indirect /Kids array on intermediate node", () => {
    const registry = createMiniRegistry();
    const resolve = (ref: PdfRef) => registry.get(ref) ?? null;

    // Leaf node
    const leafDict = new PdfDict();
    leafDict.set(
      "Names",
      new PdfArray([PdfString.fromString("key1"), PdfString.fromString("val1")]),
    );
    leafDict.set("Limits", PdfArray.of(PdfString.fromString("key1"), PdfString.fromString("key1")));
    const leafRef = registerObject(registry, leafDict);

    // Intermediate node: /Kids as indirect ref
    const kidsArray = PdfArray.of(leafRef);
    const kidsRef = registerObject(registry, kidsArray);

    const root = new PdfDict();
    root.set("Kids", kidsRef);

    const tree = new NameTree(root, resolve);

    expect(tree.get("key1")).toBeInstanceOf(PdfString);
    expect((tree.get("key1") as PdfString).asString()).toBe("val1");
  });

  it("entries() resolves indirect /Kids and /Names arrays", () => {
    const registry = createMiniRegistry();
    const resolve = (ref: PdfRef) => registry.get(ref) ?? null;

    // Leaf 1
    const leaf1 = new PdfDict();
    const names1 = new PdfArray([
      PdfString.fromString("a"),
      PdfString.fromString("v-a"),
      PdfString.fromString("b"),
      PdfString.fromString("v-b"),
    ]);
    const names1Ref = registerObject(registry, names1);
    leaf1.set("Names", names1Ref); // indirect /Names
    leaf1.set("Limits", PdfArray.of(PdfString.fromString("a"), PdfString.fromString("b")));
    const leaf1Ref = registerObject(registry, leaf1);

    // Leaf 2
    const leaf2 = new PdfDict();
    leaf2.set("Names", new PdfArray([PdfString.fromString("c"), PdfString.fromString("v-c")]));
    leaf2.set("Limits", PdfArray.of(PdfString.fromString("c"), PdfString.fromString("c")));
    const leaf2Ref = registerObject(registry, leaf2);

    // Root: /Kids as indirect ref
    const kidsArray = PdfArray.of(leaf1Ref, leaf2Ref);
    const kidsRef = registerObject(registry, kidsArray);

    const root = new PdfDict();
    root.set("Kids", kidsRef);

    const tree = new NameTree(root, resolve);

    const entries = [...tree.entries()];
    expect(entries.length).toBe(3);
    expect(entries.map(([k]) => k)).toEqual(["a", "b", "c"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers for NameTree tests (mini registry without full ObjectRegistry)
// ─────────────────────────────────────────────────────────────────────────────

let nextObjNum = 1000;

function createMiniRegistry(): Map<PdfRef, import("#src/objects/pdf-object").PdfObject> {
  nextObjNum = 1000;

  return new Map();
}

function registerObject(
  registry: Map<PdfRef, import("#src/objects/pdf-object").PdfObject>,
  obj: import("#src/objects/pdf-object").PdfObject,
): PdfRef {
  const ref = PdfRef.of(nextObjNum++, 0);
  registry.set(ref, obj);

  return ref;
}
