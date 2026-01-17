import type { TerminalField } from "#src/document/forms/fields";
import { loadFixture } from "#src/test-utils";
import { describe, expect, it } from "vitest";

import { PDF } from "./pdf";
import { TextAlignment } from "./pdf-form";

describe("PDFForm", () => {
  describe("loading", () => {
    it("returns PDFForm for PDF with form", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);

      const form = pdf.getForm();

      expect(form).not.toBeNull();
    });

    it("returns null for PDF without form", async () => {
      const bytes = await loadFixture("basic", "document.pdf");
      const pdf = await PDF.load(bytes);

      const form = pdf.getForm();

      expect(form).toBeNull();
    });

    it("caches form on subsequent calls", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);

      const form1 = pdf.getForm();
      const form2 = pdf.getForm();

      expect(form1).toBe(form2); // Same instance
    });
  });

  describe("getFields", () => {
    it("returns all fields", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = pdf.getForm();

      const fields = form!.getFields();

      expect(fields.length).toBeGreaterThan(0);
    });
  });

  describe("getFieldNames", () => {
    it("returns all field names", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = pdf.getForm();

      const names = form!.getFieldNames();

      expect(names.length).toBeGreaterThan(0);
      expect(names).toContain("STATE");
    });
  });

  describe("getField", () => {
    it("returns field by name", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = pdf.getForm();

      const field = form!.getField("STATE");

      expect(field).toBeDefined();
      expect(field?.name).toBe("STATE");
      expect(field?.type).toBe("text");
    });

    it("returns undefined for non-existent field", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = pdf.getForm();

      const field = form!.getField("nonexistent");

      expect(field).toBeUndefined();
    });
  });

  describe("hasField", () => {
    it("returns true for existing field", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = pdf.getForm();

      expect(form!.hasField("STATE")).toBe(true);
    });

    it("returns false for non-existent field", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = pdf.getForm();

      expect(form!.hasField("nonexistent")).toBe(false);
    });
  });

  describe("type-safe getters", () => {
    it("getTextField returns text field", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = pdf.getForm();

      const field = form!.getTextField("STATE");

      expect(field).toBeDefined();
      expect(field?.type).toBe("text");
    });

    it("getTextField returns undefined for wrong type", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = pdf.getForm();

      const field = form!.getTextField("TRADE CERTIFICATE");

      expect(field).toBeUndefined();
    });

    it("getCheckbox returns checkbox field", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = pdf.getForm();

      const field = form!.getCheckbox("TRADE CERTIFICATE");

      expect(field).toBeDefined();
      expect(field?.type).toBe("checkbox");
    });

    it("getCheckbox returns undefined for wrong type", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = pdf.getForm();

      const field = form!.getCheckbox("STATE");

      expect(field).toBeUndefined();
    });
  });

  describe("typed field collections", () => {
    it("getTextFields returns only text fields", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = pdf.getForm();

      const fields = form!.getTextFields();

      expect(fields.length).toBeGreaterThan(0);
      expect(fields.every(f => f.type === "text")).toBe(true);
    });

    it("getCheckboxes returns only checkbox fields", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = pdf.getForm();

      const fields = form!.getCheckboxes();

      expect(fields.every(f => f.type === "checkbox")).toBe(true);
    });
  });

  describe("fill", () => {
    it("fills multiple fields at once", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = pdf.getForm();

      const result = form!.fill({
        STATE: "NY",
        "TRADE CERTIFICATE": true,
      });

      expect(result.filled).toContain("STATE");
      expect(result.filled).toContain("TRADE CERTIFICATE");
      expect(result.skipped).toHaveLength(0);

      expect(form!.getTextField("STATE")?.getValue()).toBe("NY");
      expect(form!.getCheckbox("TRADE CERTIFICATE")?.isChecked()).toBe(true);
    });

    it("silently skips non-existent fields", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = pdf.getForm();

      const result = form!.fill({
        STATE: "CA",
        nonexistent: "ignored",
        alsoMissing: "skipped",
      });

      expect(result.filled).toContain("STATE");
      expect(result.skipped).toContain("nonexistent");
      expect(result.skipped).toContain("alsoMissing");
    });

    it("throws on type mismatch", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = pdf.getForm();

      expect(() =>
        form!.fill({
          STATE: true, // Should be string
        }),
      ).toThrow(TypeError);
    });
  });

  describe("resetAll", () => {
    it("resets all fields", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = pdf.getForm();

      // Fill with some values
      form!.fill({
        STATE: "CA",
        "TRADE CERTIFICATE": true,
      });

      // Verify the values were set
      expect(form!.getTextField("STATE")?.getValue()).toBe("CA");
      expect(form!.getCheckbox("TRADE CERTIFICATE")?.isChecked()).toBe(true);

      // Reset all fields
      form!.resetAll();

      // After reset, appearances are regenerated so needsAppearanceUpdate is false
      const fields = form!.getFields() as TerminalField[];
      expect(fields.every(f => !f.needsAppearanceUpdate)).toBe(true);
    });
  });

  describe("flatten", () => {
    it("flattens form fields", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = pdf.getForm();

      form!.flatten();

      expect(form!.getFields()).toHaveLength(0);
      expect(form!.fieldCount).toBe(0);
    });

    it("persists through save/load", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = pdf.getForm();

      form!.getTextField("STATE")?.setValue("WA");
      form!.flatten();

      const saved = await pdf.save();
      const pdf2 = await PDF.load(saved);

      // Form should be empty or null after flattening
      const form2 = pdf2.getForm();
      if (form2) {
        expect(form2.getFields()).toHaveLength(0);
      }
    });
  });

  describe("reloadFields", () => {
    it("reloads fields from AcroForm", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = pdf.getForm();

      const countBefore = form!.fieldCount;
      form!.reloadFields();
      const countAfter = form!.fieldCount;

      expect(countAfter).toBe(countBefore);
    });
  });

  describe("hasUnsavedChanges", () => {
    it("returns false initially", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = pdf.getForm();

      expect(form!.hasUnsavedChanges).toBe(false);
    });
  });

  describe("properties", () => {
    it("returns form properties", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = pdf.getForm();

      const props = form!.properties;

      expect(typeof props.defaultAppearance).toBe("string");
      expect([TextAlignment.Left, TextAlignment.Center, TextAlignment.Right]).toContain(
        props.defaultAlignment,
      );
      expect(typeof props.needAppearances).toBe("boolean");
      expect(typeof props.hasSignatures).toBe("boolean");
      expect(typeof props.isAppendOnly).toBe("boolean");
    });
  });

  describe("fieldCount", () => {
    it("returns number of fields", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = pdf.getForm();

      expect(form!.fieldCount).toBeGreaterThan(0);
      expect(form!.fieldCount).toBe(form!.getFields().length);
    });
  });

  describe("getAcroForm", () => {
    it("returns underlying AcroForm", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = pdf.getForm();

      const acroForm = form!.acroForm();

      expect(acroForm).toBeDefined();
      expect(acroForm.defaultAppearance).toBeDefined();
    });
  });
});

describe("TextAlignment", () => {
  it("has correct values", () => {
    expect(TextAlignment.Left).toBe(0);
    expect(TextAlignment.Center).toBe(1);
    expect(TextAlignment.Right).toBe(2);
  });
});

describe("Field Creation", () => {
  describe("createTextField", () => {
    it("creates a text field with default options", async () => {
      const pdf = PDF.create();
      const form = pdf.getOrCreateForm();

      const field = form.createTextField("name");

      expect(field).toBeDefined();
      expect(field.name).toBe("name");
      expect(field.type).toBe("text");
      expect(field.getValue()).toBe("");
    });

    it("creates a text field with options", async () => {
      const pdf = PDF.create();
      const form = pdf.getOrCreateForm();

      const field = form.createTextField("name", {
        maxLength: 50,
        multiline: false,
        alignment: TextAlignment.Center,
        defaultValue: "John Doe",
      });

      expect(field.getValue()).toBe("John Doe");
      expect(field.maxLength).toBe(50);
      expect(field.alignment).toBe(TextAlignment.Center);
    });

    it("throws on duplicate field name", async () => {
      const pdf = PDF.create();
      const form = pdf.getOrCreateForm();

      form.createTextField("name");

      expect(() => form.createTextField("name")).toThrow('Field "name" already exists');
    });

    it("adds field to form's field list", async () => {
      const pdf = PDF.create();
      const form = pdf.getOrCreateForm();

      const field = form.createTextField("name");

      expect(form.getFields()).toContain(field);
      expect(form.getField("name")).toBe(field);
    });
  });

  describe("createCheckbox", () => {
    it("creates a checkbox with default options", async () => {
      const pdf = PDF.create();
      const form = pdf.getOrCreateForm();

      const field = form.createCheckbox("agree");

      expect(field).toBeDefined();
      expect(field.name).toBe("agree");
      expect(field.type).toBe("checkbox");
      expect(field.isChecked()).toBe(false);
    });

    it("creates a checked checkbox", async () => {
      const pdf = PDF.create();
      const form = pdf.getOrCreateForm();

      const field = form.createCheckbox("agree", {
        defaultChecked: true,
        onValue: "Agreed",
      });

      expect(field.isChecked()).toBe(true);
      expect(field.getValue()).toBe("Agreed");
    });
  });

  describe("createRadioGroup", () => {
    it("creates a radio group with options", async () => {
      const pdf = PDF.create();
      const form = pdf.getOrCreateForm();

      const field = form.createRadioGroup("payment", {
        options: ["Credit", "PayPal", "Bank"],
        defaultValue: "Credit",
      });

      expect(field).toBeDefined();
      expect(field.name).toBe("payment");
      expect(field.type).toBe("radio");
      expect(field.getValue()).toBe("Credit");
    });

    it("throws without options", async () => {
      const pdf = PDF.create();
      const form = pdf.getOrCreateForm();

      expect(() =>
        form.createRadioGroup("payment", {
          options: [],
        }),
      ).toThrow("Radio group must have at least one option");
    });
  });

  describe("createDropdown", () => {
    it("creates a dropdown with options", async () => {
      const pdf = PDF.create();
      const form = pdf.getOrCreateForm();

      const field = form.createDropdown("country", {
        options: ["USA", "Canada", "UK"],
        defaultValue: "USA",
      });

      expect(field).toBeDefined();
      expect(field.name).toBe("country");
      expect(field.type).toBe("dropdown");
      expect(field.getValue()).toBe("USA");
    });

    it("creates an editable dropdown", async () => {
      const pdf = PDF.create();
      const form = pdf.getOrCreateForm();

      const field = form.createDropdown("city", {
        options: ["New York", "Los Angeles"],
        editable: true,
      });

      expect(field.isEditable).toBe(true);
    });
  });

  describe("createListbox", () => {
    it("creates a listbox with options", async () => {
      const pdf = PDF.create();
      const form = pdf.getOrCreateForm();

      const field = form.createListbox("colors", {
        options: ["Red", "Green", "Blue"],
      });

      expect(field).toBeDefined();
      expect(field.name).toBe("colors");
      expect(field.type).toBe("listbox");
    });

    it("creates a multi-select listbox with defaults", async () => {
      const pdf = PDF.create();
      const form = pdf.getOrCreateForm();

      const field = form.createListbox("colors", {
        options: ["Red", "Green", "Blue"],
        multiSelect: true,
        defaultValue: ["Red", "Blue"],
      });

      expect(field.isMultiSelect).toBe(true);
      const values = field.getValue();
      expect(values).toContain("Red");
      expect(values).toContain("Blue");
    });
  });

  describe("getOrCreateForm", () => {
    it("creates form with proper structure for PDF without form", async () => {
      const pdf = PDF.create();

      const form = pdf.getOrCreateForm();

      expect(form).toBeDefined();
      expect(form.fieldCount).toBe(0);

      // Verify default appearance is set
      const props = form.properties;
      expect(props.defaultAppearance).toContain("Helv");
    });

    it("returns existing form if present", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);

      const form1 = pdf.getOrCreateForm();
      const form2 = pdf.getOrCreateForm();

      expect(form1).toBe(form2);
    });
  });
});

describe("drawField", () => {
  it("places a text field on a page", async () => {
    const pdf = PDF.create();
    pdf.addPage({ size: "letter" });
    const form = pdf.getOrCreateForm();
    const page = pdf.getPage(0);

    const field = form.createTextField("name", {
      defaultValue: "John",
    });

    page!.drawField(field, {
      x: 100,
      y: 700,
      width: 200,
      height: 24,
    });

    // Field should now have one widget
    const widgets = field.getWidgets();
    expect(widgets).toHaveLength(1);
    expect(widgets[0].width).toBe(200);
    expect(widgets[0].height).toBe(24);
  });

  it("places multiple widgets for same field", async () => {
    const pdf = PDF.create();
    pdf.addPage({ size: "letter" });
    pdf.addPage({ size: "letter" });
    const form = pdf.getOrCreateForm();
    const page1 = pdf.getPage(0);
    const page2 = pdf.getPage(1);

    const field = form.createTextField("name");

    page1!.drawField(field, { x: 100, y: 700, width: 200, height: 24 });
    page2!.drawField(field, { x: 50, y: 500, width: 300, height: 30 });

    const widgets = field.getWidgets();
    expect(widgets).toHaveLength(2);
  });

  it("requires option for radio groups", async () => {
    const pdf = PDF.create();
    pdf.addPage({ size: "letter" });
    const form = pdf.getOrCreateForm();
    const page = pdf.getPage(0);

    const radioField = form.createRadioGroup("payment", {
      options: ["Credit", "PayPal"],
    });

    expect(() => page!.drawField(radioField, { x: 100, y: 700, width: 16, height: 16 })).toThrow(
      "requires option parameter",
    );
  });

  it("places radio widgets with option", async () => {
    const pdf = PDF.create();
    pdf.addPage({ size: "letter" });
    const form = pdf.getOrCreateForm();
    const page = pdf.getPage(0);

    const radioField = form.createRadioGroup("payment", {
      options: ["Credit", "PayPal"],
    });

    page!.drawField(radioField, {
      x: 100,
      y: 700,
      width: 16,
      height: 16,
      option: "Credit",
    });
    page!.drawField(radioField, {
      x: 100,
      y: 670,
      width: 16,
      height: 16,
      option: "PayPal",
    });

    const widgets = radioField.getWidgets();
    expect(widgets).toHaveLength(2);
  });

  it("validates radio option value", async () => {
    const pdf = PDF.create();
    pdf.addPage({ size: "letter" });
    const form = pdf.getOrCreateForm();
    const page = pdf.getPage(0);

    const radioField = form.createRadioGroup("payment", {
      options: ["Credit", "PayPal"],
    });

    expect(() =>
      page!.drawField(radioField, {
        x: 100,
        y: 700,
        width: 16,
        height: 16,
        option: "InvalidOption",
      }),
    ).toThrow("Invalid option");
  });

  it("saves PDF with created fields", async () => {
    const pdf = PDF.create();
    pdf.addPage({ size: "letter" });
    const form = pdf.getOrCreateForm();
    const page = pdf.getPage(0);

    const nameField = form.createTextField("name", {
      defaultValue: "Test User",
    });
    page!.drawField(nameField, { x: 100, y: 700, width: 200, height: 24 });

    const checkbox = form.createCheckbox("agree", { defaultChecked: true });
    page!.drawField(checkbox, { x: 100, y: 650, width: 18, height: 18 });

    // Save and reload
    const bytes = await pdf.save();
    const pdf2 = await PDF.load(bytes);
    const form2 = pdf2.getForm();

    expect(form2).not.toBeNull();
    expect(form2!.fieldCount).toBe(2);

    const nameField2 = form2!.getTextField("name");
    expect(nameField2).toBeDefined();
    expect(nameField2!.getValue()).toBe("Test User");

    const checkbox2 = form2!.getCheckbox("agree");
    expect(checkbox2).toBeDefined();
    expect(checkbox2!.isChecked()).toBe(true);
  });
});

describe("removeField", () => {
  it("removes a field by instance", async () => {
    const pdf = PDF.create();
    pdf.addPage({ size: "letter" });
    const form = pdf.getOrCreateForm();
    const page = pdf.getPage(0);

    const field = form.createTextField("name");
    page!.drawField(field, { x: 100, y: 700, width: 200, height: 24 });

    expect(form.hasField("name")).toBe(true);
    expect(form.fieldCount).toBe(1);

    const removed = form.removeField(field);

    expect(removed).toBe(true);
    expect(form.hasField("name")).toBe(false);
    expect(form.fieldCount).toBe(0);
    expect(form.getField("name")).toBeUndefined();
  });

  it("removes a field by name", async () => {
    const pdf = PDF.create();
    pdf.addPage({ size: "letter" });
    const form = pdf.getOrCreateForm();
    const page = pdf.getPage(0);

    form.createTextField("email");
    page!.drawField(form.getTextField("email")!, { x: 100, y: 700, width: 200, height: 24 });

    const removed = form.removeField("email");

    expect(removed).toBe(true);
    expect(form.hasField("email")).toBe(false);
  });

  it("returns false for non-existent field", async () => {
    const pdf = PDF.create();
    const form = pdf.getOrCreateForm();

    const removed = form.removeField("nonexistent");

    expect(removed).toBe(false);
  });

  it("removes widget annotations from page", async () => {
    const pdf = PDF.create();
    pdf.addPage({ size: "letter" });
    const form = pdf.getOrCreateForm();
    const page = pdf.getPage(0);

    const field = form.createTextField("name");
    page!.drawField(field, { x: 100, y: 700, width: 200, height: 24 });

    // Verify widget was added
    expect(field.getWidgets()).toHaveLength(1);

    form.removeField(field);

    // After removal, the page should not have form field annotations
    // We can verify by saving and reloading
    const bytes = await pdf.save();
    const pdf2 = await PDF.load(bytes);
    const form2 = pdf2.getForm();

    // Form should exist but be empty
    if (form2) {
      expect(form2.fieldCount).toBe(0);
    }
  });

  it("removes field with multiple widgets across pages", async () => {
    const pdf = PDF.create();
    pdf.addPage({ size: "letter" });
    pdf.addPage({ size: "letter" });
    const form = pdf.getOrCreateForm();
    const page1 = pdf.getPage(0);
    const page2 = pdf.getPage(1);

    const field = form.createTextField("sharedField");
    page1!.drawField(field, { x: 100, y: 700, width: 200, height: 24 });
    page2!.drawField(field, { x: 50, y: 500, width: 300, height: 30 });

    expect(field.getWidgets()).toHaveLength(2);

    form.removeField(field);

    expect(form.hasField("sharedField")).toBe(false);
    expect(form.fieldCount).toBe(0);
  });

  it("allows creating a new field with the same name after removal", async () => {
    const pdf = PDF.create();
    pdf.addPage({ size: "letter" });
    const form = pdf.getOrCreateForm();
    const page = pdf.getPage(0);

    const field1 = form.createTextField("name", { defaultValue: "First" });
    page!.drawField(field1, { x: 100, y: 700, width: 200, height: 24 });

    form.removeField(field1);

    // Should be able to create a new field with the same name
    const field2 = form.createTextField("name", { defaultValue: "Second" });
    page!.drawField(field2, { x: 100, y: 700, width: 200, height: 24 });

    expect(form.hasField("name")).toBe(true);
    expect(form.getTextField("name")?.getValue()).toBe("Second");
  });

  it("removes existing field from loaded PDF", async () => {
    const bytes = await loadFixture("forms", "sample_form.pdf");
    const pdf = await PDF.load(bytes);
    const form = pdf.getForm();

    const initialCount = form!.fieldCount;
    const fieldToRemove = form!.getFields()[0];
    const fieldName = fieldToRemove.name;

    const removed = form!.removeField(fieldToRemove);

    expect(removed).toBe(true);
    expect(form!.hasField(fieldName)).toBe(false);
    expect(form!.fieldCount).toBe(initialCount - 1);
  });

  it("persists removal through save/load cycle", async () => {
    const pdf = PDF.create();
    pdf.addPage({ size: "letter" });
    const form = pdf.getOrCreateForm();
    const page = pdf.getPage(0);

    form.createTextField("keep");
    form.createTextField("remove");
    page!.drawField(form.getTextField("keep")!, { x: 100, y: 700, width: 200, height: 24 });
    page!.drawField(form.getTextField("remove")!, { x: 100, y: 650, width: 200, height: 24 });

    form.removeField("remove");

    const bytes = await pdf.save();
    const pdf2 = await PDF.load(bytes);
    const form2 = pdf2.getForm();

    expect(form2).not.toBeNull();
    expect(form2!.fieldCount).toBe(1);
    expect(form2!.hasField("keep")).toBe(true);
    expect(form2!.hasField("remove")).toBe(false);
  });
});
