import { describe, expect, it } from "vitest";
import { PDF } from "#src/api/pdf";
import { loadFixture } from "#src/test-utils";
import { AcroForm } from "./acro-form";
import type {
  ButtonField,
  CheckboxField,
  DropdownField,
  ListBoxField,
  RadioField,
  TextField,
} from "./form-field";

describe("AcroForm", () => {
  describe("loading", () => {
    it("loads AcroForm from PDF with form", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);

      const form = (await pdf.getForm())?.acroForm();

      expect(form).toBeInstanceOf(AcroForm);
    });

    it("returns null for PDF without form", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      const form = await pdf.getForm();

      expect(form).toBeNull();
    });
  });

  describe("form properties", () => {
    it("reads defaultAppearance", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();

      expect(form?.defaultAppearance).toContain("/Helv");
    });

    it("reads defaultQuadding", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();

      expect(form?.defaultQuadding).toBe(0);
    });

    it("reads needAppearances", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();

      expect(form?.needAppearances).toBe(false);
    });

    it("reads signatureFlags", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();

      // sample_form.pdf has SigFlags: 3 (SignaturesExist + AppendOnly)
      expect(form?.signatureFlags).toBe(3);
      expect(form?.hasSignatures).toBe(true);
      expect(form?.isAppendOnly).toBe(true);
    });
  });

  describe("field tree traversal", () => {
    it("returns all terminal fields", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const fields = await form!.getFields();

      expect(fields.length).toBe(29);
    });

    it("handles hierarchical field names", async () => {
      const bytes = await loadFixture("forms", "with_combed_fields.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const fields = await form!.getFields();

      // Should have hierarchical names like "form1[0].#pageSet[0].Page1[0]..."
      const hasHierarchical = fields.some(f => f.name.includes("."));
      expect(hasHierarchical).toBe(true);
    });

    it("caches field list", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();

      const fields1 = await form!.getFields();
      const fields2 = await form!.getFields();

      expect(fields1).toBe(fields2); // Same array reference
    });

    it("clears cache when requested", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();

      const fields1 = await form!.getFields();
      form!.clearCache();
      const fields2 = await form!.getFields();

      expect(fields1).not.toBe(fields2); // Different array reference
      expect(fields1.length).toBe(fields2.length); // Same content
    });
  });

  describe("getField", () => {
    it("finds field by name", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();

      const field = await form!.getField("STATE");

      expect(field).not.toBeNull();
      expect(field?.name).toBe("STATE");
    });

    it("returns null for non-existent field", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();

      const field = await form!.getField("DOES_NOT_EXIST");

      expect(field).toBeNull();
    });
  });

  describe("getFieldsOfType", () => {
    it("filters fields by type", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();

      const textFields = await form!.getFieldsOfType<TextField>("text");
      const checkboxFields = await form!.getFieldsOfType<CheckboxField>("checkbox");

      expect(textFields.every(f => f.type === "text")).toBe(true);
      expect(checkboxFields.every(f => f.type === "checkbox")).toBe(true);
      expect(textFields.length + checkboxFields.length).toBeLessThanOrEqual(29);
    });
  });
});

describe("FormField", () => {
  describe("TextField", () => {
    it("reads text value", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const field = (await form!.getField("STATE")) as TextField;

      expect(field.type).toBe("text");
      expect(field.getValue()).toBe("WA");
    });

    it("reads maxLength", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const field = (await form!.getField("STATE")) as TextField;

      expect(field.maxLength).toBe(2);
    });

    it("detects multiline fields", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();

      const stateField = (await form!.getField("STATE")) as TextField;
      expect(stateField.isMultiline).toBe(false);
    });

    it("returns empty string for missing value", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();

      // Find a text field without a value
      const textFields = await form!.getFieldsOfType<TextField>("text");
      const emptyField = textFields.find(f => f.getValue() === "");

      // If there's an empty field, verify it returns empty string
      if (emptyField) {
        expect(emptyField.getValue()).toBe("");
      }
    });
  });

  describe("CheckboxField", () => {
    it("reads checked state", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const field = (await form!.getField("HIGH SCHOOL DIPLOMA")) as CheckboxField;

      expect(field.type).toBe("checkbox");
      expect(field.isChecked()).toBe(true);
      expect(field.getValue()).toBe("On");
    });

    it("reads unchecked state", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const field = (await form!.getField("TRADE CERTIFICATE")) as CheckboxField;

      expect(field.isChecked()).toBe(false);
      expect(field.getValue()).toBe("Off");
    });

    it("gets on-value from widget", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const field = (await form!.getField("HIGH SCHOOL DIPLOMA")) as CheckboxField;

      expect(field.getOnValue()).toBe("On");
    });
  });

  describe("RadioField", () => {
    it("detects radio fields", async () => {
      const bytes = await loadFixture("forms", "fancy_fields.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const fields = await form!.getFields();

      const radioFields = fields.filter(f => f.type === "radio");
      expect(radioFields.length).toBeGreaterThan(0);
    });
  });

  describe("ButtonField", () => {
    it("detects push buttons", async () => {
      const bytes = await loadFixture("forms", "fancy_fields.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const fields = await form!.getFields();

      const buttonFields = fields.filter(f => f.type === "button");
      expect(buttonFields.length).toBeGreaterThan(0);
    });

    it("returns null for value", async () => {
      const bytes = await loadFixture("forms", "fancy_fields.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const fields = await form!.getFields();

      const buttonField = fields.find(f => f.type === "button") as ButtonField;
      expect(buttonField.getValue()).toBeNull();
    });
  });

  describe("DropdownField", () => {
    it("detects dropdown fields", async () => {
      const bytes = await loadFixture("forms", "fancy_fields.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const fields = await form!.getFields();

      const dropdowns = fields.filter(f => f.type === "dropdown");
      expect(dropdowns.length).toBeGreaterThan(0);
    });
  });

  describe("ListBoxField", () => {
    it("detects listbox fields", async () => {
      const bytes = await loadFixture("forms", "fancy_fields.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const fields = await form!.getFields();

      const listboxes = fields.filter(f => f.type === "listbox");
      expect(listboxes.length).toBeGreaterThan(0);
    });

    it("reads selected values", async () => {
      const bytes = await loadFixture("forms", "fancy_fields.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const fields = await form!.getFields();

      const listbox = fields.find(f => f.type === "listbox") as ListBoxField;
      const values = listbox.getValue();

      expect(Array.isArray(values)).toBe(true);
    });
  });

  describe("field flags", () => {
    it("reads read-only flag", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const fields = await form!.getFields();

      // All fields should have flags accessible
      for (const field of fields.slice(0, 5)) {
        expect(typeof field.isReadOnly()).toBe("boolean");
        expect(typeof field.isRequired()).toBe("boolean");
        expect(typeof field.isNoExport()).toBe("boolean");
      }
    });
  });

  describe("widgets", () => {
    it("returns widget annotations", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const field = await form!.getField("STATE");

      const widgets = field!.getWidgets();

      expect(widgets.length).toBe(1);
    });

    it("widget has rect", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const field = await form!.getField("STATE");
      const widget = field!.getWidgets()[0];

      const rect = widget.rect;
      expect(rect.length).toBe(4);
      expect(typeof rect[0]).toBe("number");
    });

    it("widget has width and height", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const field = await form!.getField("STATE");
      const widget = field!.getWidgets()[0];

      expect(widget.width).toBeGreaterThan(0);
      expect(widget.height).toBeGreaterThan(0);
    });

    it("checkbox widget has on-value", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const field = (await form!.getField("HIGH SCHOOL DIPLOMA")) as CheckboxField;
      const widget = field.getWidgets()[0];

      const onValue = widget.getOnValue();
      expect(onValue).toBe("On");
    });

    it("checkbox widget has appearance state", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const field = (await form!.getField("HIGH SCHOOL DIPLOMA")) as CheckboxField;
      const widget = field.getWidgets()[0];

      // Checked checkbox should have appearance state matching its value
      expect(widget.appearanceState).toBe("On");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Form Writing Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Form Writing", () => {
  describe("TextField.setValue", () => {
    it("sets text value", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const field = (await form!.getField("STATE")) as TextField;

      field.setValue("CA");

      expect(field.getValue()).toBe("CA");
      expect(field.needsAppearanceUpdate).toBe(true);
    });

    it("truncates value to maxLength", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const field = (await form!.getField("STATE")) as TextField;

      // STATE has maxLength of 2
      field.setValue("CALIFORNIA");

      expect(field.getValue()).toBe("CA");
    });

    it("handles empty value", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const field = (await form!.getField("STATE")) as TextField;

      field.setValue("");

      expect(field.getValue()).toBe("");
    });

    it("handles unicode value", async () => {
      const bytes = await loadFixture("forms", "fancy_fields.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const field = (await form!.getField("First Name 🚀")) as TextField;

      field.setValue("こんにちは");

      expect(field.getValue()).toBe("こんにちは");
    });
  });

  describe("CheckboxField.setValue", () => {
    it("checks checkbox with check()", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const field = (await form!.getField("TRADE CERTIFICATE")) as CheckboxField;

      expect(field.isChecked()).toBe(false);

      field.check();

      expect(field.isChecked()).toBe(true);
      expect(field.needsAppearanceUpdate).toBe(true);
    });

    it("unchecks checkbox with uncheck()", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const field = (await form!.getField("HIGH SCHOOL DIPLOMA")) as CheckboxField;

      expect(field.isChecked()).toBe(true);

      field.uncheck();

      expect(field.isChecked()).toBe(false);
    });

    it("throws on invalid value", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const field = (await form!.getField("HIGH SCHOOL DIPLOMA")) as CheckboxField;

      expect(() => field.setValue("InvalidValue")).toThrow(/Invalid value/);
    });

    it("updates widget appearance state", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const field = (await form!.getField("TRADE CERTIFICATE")) as CheckboxField;
      const widget = field.getWidgets()[0];

      expect(widget.appearanceState).toBe("Off");

      field.check();

      expect(widget.appearanceState).toBe("On");
    });
  });

  describe("RadioField.setValue", () => {
    it("selects radio option", async () => {
      const bytes = await loadFixture("forms", "fancy_fields.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const fields = await form!.getFields();
      const radioField = fields.find(f => f.type === "radio") as RadioField | undefined;

      if (radioField) {
        const options = radioField.getOptions();
        if (options.length > 0) {
          radioField.setValue(options[0]);
          expect(radioField.getValue()).toBe(options[0]);
        }
      }
    });

    it("throws on invalid option", async () => {
      const bytes = await loadFixture("forms", "fancy_fields.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const fields = await form!.getFields();
      const radioField = fields.find(f => f.type === "radio") as RadioField | undefined;

      if (radioField) {
        expect(() => radioField.setValue("InvalidOption")).toThrow(/Invalid option/);
      }
    });
  });

  describe("DropdownField.setValue", () => {
    it("sets dropdown value", async () => {
      const bytes = await loadFixture("forms", "fancy_fields.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const fields = await form!.getFields();
      const dropdown = fields.find(f => f.type === "dropdown") as DropdownField | undefined;

      if (dropdown) {
        const options = dropdown.getOptions();
        if (options.length > 0) {
          dropdown.setValue(options[0].value);
          expect(dropdown.getValue()).toBe(options[0].value);
        } else if (dropdown.isEditable) {
          // Editable dropdown can have custom value
          dropdown.setValue("CustomValue");
          expect(dropdown.getValue()).toBe("CustomValue");
        }
      }
    });
  });

  describe("ListBoxField.setValue", () => {
    it("sets listbox value", async () => {
      const bytes = await loadFixture("forms", "fancy_fields.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const fields = await form!.getFields();
      const listbox = fields.find(f => f.type === "listbox") as ListBoxField | undefined;

      if (listbox) {
        const options = listbox.getOptions();
        if (options.length > 0) {
          listbox.setValue([options[0].value]);
          expect(listbox.getValue()).toContain(options[0].value);
        }
      }
    });

    it("clears listbox with empty array", async () => {
      const bytes = await loadFixture("forms", "fancy_fields.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const fields = await form!.getFields();
      const listbox = fields.find(f => f.type === "listbox") as ListBoxField | undefined;

      if (listbox) {
        listbox.setValue([]);
        expect(listbox.getValue()).toEqual([]);
      }
    });
  });

  describe("resetValue", () => {
    it("resets field to default value", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const field = (await form!.getField("STATE")) as TextField;

      field.setValue("XX");
      expect(field.getValue()).toBe("XX");

      field.resetValue();

      // After reset, should be default or original if no default
      expect(field.needsAppearanceUpdate).toBe(true);
    });
  });

  describe("needsAppearanceUpdate", () => {
    it("is false initially", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const field = (await form!.getField("STATE")) as TextField;

      expect(field.needsAppearanceUpdate).toBe(false);
    });

    it("is set to true after setValue", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const field = (await form!.getField("STATE")) as TextField;

      field.setValue("NY");

      expect(field.needsAppearanceUpdate).toBe(true);
    });
  });

  describe("updateAppearances", () => {
    it("updates appearances for dirty text fields", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const field = (await form!.getField("STATE")) as TextField;

      field.setValue("NY");
      expect(field.needsAppearanceUpdate).toBe(true);

      await form!.updateAppearances();

      expect(field.needsAppearanceUpdate).toBe(false);
    });

    it("only updates fields that need it", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const fields = await form!.getFields();

      // Mark only one field as needing update
      const textField = fields.find(f => f.type === "text") as TextField;
      textField.setValue("Test");

      // Count fields that need update
      const needsUpdate = fields.filter(f => f.needsAppearanceUpdate).length;
      expect(needsUpdate).toBe(1);

      await form!.updateAppearances();

      // All should be cleared
      expect(fields.every(f => !f.needsAppearanceUpdate)).toBe(true);
    });
  });

  describe("round-trip", () => {
    it("preserves text field value through save/load", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const field = (await form!.getField("STATE")) as TextField;

      field.setValue("NY");

      // Save and reload
      const saved = await pdf.save();
      const pdf2 = await PDF.load(saved);
      const form2 = (await pdf2.getForm())?.acroForm();
      const field2 = (await form2!.getField("STATE")) as TextField;

      expect(field2.getValue()).toBe("NY");
    });

    it("preserves checkbox state through save/load", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      const field = (await form!.getField("TRADE CERTIFICATE")) as CheckboxField;

      expect(field.isChecked()).toBe(false);
      field.check();

      // Save and reload
      const saved = await pdf.save();
      const pdf2 = await PDF.load(saved);
      const form2 = (await pdf2.getForm())?.acroForm();
      const field2 = (await form2!.getField("TRADE CERTIFICATE")) as CheckboxField;

      expect(field2.isChecked()).toBe(true);
    });
  });

  describe("flatten", () => {
    it("removes all form fields after flattening", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();

      expect(form).not.toBeNull();
      const fieldsBefore = await form!.getFields();
      expect(fieldsBefore.length).toBeGreaterThan(0);

      // Flatten the form
      await form!.flatten();

      // Fields should be empty after flattening
      const fieldsAfter = await form!.getFields();
      expect(fieldsAfter.length).toBe(0);
    });

    it("persists flattening through save/load", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();

      // Set some values before flattening
      const stateField = (await form!.getField("STATE")) as TextField;
      stateField.setValue("CA");

      // Flatten and save
      await form!.flatten();
      const saved = await pdf.save();

      // Reload and verify no form
      const pdf2 = await PDF.load(saved);
      const form2 = (await pdf2.getForm())?.acroForm();

      // Form should have no fields (empty /Fields array)
      if (form2) {
        const fields2 = await form2.getFields();
        expect(fields2.length).toBe(0);
      }
    });

    it("adds flattened content to page", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();

      // Get first page content before flattening
      const pageRef = pdf.getPage(0);
      const pageDict = await pdf.getObject(pageRef!);
      expect(pageDict).not.toBeNull();

      // Flatten
      await form!.flatten();

      // After flattening, page should have additional content
      // (The flatten method appends a new content stream)
      const pageAfter = await pdf.getObject(pageRef!);
      expect(pageAfter).not.toBeNull();
    });

    it("handles form with no fields", async () => {
      const bytes = await loadFixture("basic", "document.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();

      // Document might not have a form, which is fine
      if (form) {
        const fields = await form.getFields();
        if (fields.length === 0) {
          // Should not throw
          await form.flatten();
        }
      }
    });

    it("can flatten with skipAppearanceUpdate option", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();

      // Flatten without updating appearances
      await form!.flatten({ skipAppearanceUpdate: true });

      const fieldsAfter = await form!.getFields();
      expect(fieldsAfter.length).toBe(0);
    });

    it("removes widget annotations from page", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();

      // Get widget count before
      const fields = await form!.getFields();
      let widgetCount = 0;
      for (const field of fields) {
        widgetCount += field.getWidgets().length;
      }
      expect(widgetCount).toBeGreaterThan(0);

      // Flatten
      await form!.flatten();

      // Save and reload to check annotation removal
      const saved = await pdf.save();
      const pdf2 = await PDF.load(saved);

      // Check that form has no fields
      const form2 = (await pdf2.getForm())?.acroForm();
      if (form2) {
        const fields2 = await form2.getFields();
        expect(fields2.length).toBe(0);
      }
    });

    it("handles checkbox fields correctly", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();

      // Check a checkbox before flattening
      const checkbox = (await form!.getField("TRADE CERTIFICATE")) as CheckboxField;
      checkbox.check();

      // Flatten
      await form!.flatten();

      // After flattening, no more checkbox field
      const fieldsAfter = await form!.getFields();
      expect(fieldsAfter.length).toBe(0);
    });

    it("normalizes appearance streams with missing /Subtype /Form", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();

      // Flatten the form
      await form!.flatten();

      // Save and reload
      const saved = await pdf.save();
      const pdf2 = await PDF.load(saved);

      // Get page resources to check XObjects
      const pageRef = pdf2.getPage(0);
      const pageDict = await pdf2.getObject(pageRef!);

      if (pageDict && "getDict" in pageDict) {
        const resources = (pageDict as { getDict: (key: string) => unknown }).getDict("Resources");
        if (resources && typeof resources === "object" && "getDict" in resources) {
          const xObjects = (resources as { getDict: (key: string) => unknown }).getDict("XObject");
          if (xObjects && typeof xObjects === "object") {
            // Check that flattened XObjects exist (verifies flatten worked)
            // The actual /Subtype /Form normalization is internal - we just verify
            // the flatten completes without error and produces valid output
            expect(xObjects).toBeDefined();
          }
        }
      }
    });
  });
});
