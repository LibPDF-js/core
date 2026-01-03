import { describe, expect, it } from "vitest";
import type { TerminalField } from "#src/document/form-field";
import { loadFixture } from "#src/test-utils";
import { PDF } from "./pdf";
import { TextAlignment } from "./pdf-form";

describe("PDFForm", () => {
  describe("loading", () => {
    it("returns PDFForm for PDF with form", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);

      const form = await pdf.getForm();

      expect(form).not.toBeNull();
    });

    it("returns null for PDF without form", async () => {
      const bytes = await loadFixture("basic", "document.pdf");
      const pdf = await PDF.load(bytes);

      const form = await pdf.getForm();

      expect(form).toBeNull();
    });

    it("caches form on subsequent calls", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);

      const form1 = await pdf.getForm();
      const form2 = await pdf.getForm();

      expect(form1).toBe(form2); // Same instance
    });
  });

  describe("getFields", () => {
    it("returns all fields", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = await pdf.getForm();

      const fields = form!.getFields();

      expect(fields.length).toBeGreaterThan(0);
    });
  });

  describe("getFieldNames", () => {
    it("returns all field names", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = await pdf.getForm();

      const names = form!.getFieldNames();

      expect(names.length).toBeGreaterThan(0);
      expect(names).toContain("STATE");
    });
  });

  describe("getField", () => {
    it("returns field by name", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = await pdf.getForm();

      const field = form!.getField("STATE");

      expect(field).toBeDefined();
      expect(field?.name).toBe("STATE");
      expect(field?.type).toBe("text");
    });

    it("returns undefined for non-existent field", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = await pdf.getForm();

      const field = form!.getField("nonexistent");

      expect(field).toBeUndefined();
    });
  });

  describe("hasField", () => {
    it("returns true for existing field", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = await pdf.getForm();

      expect(form!.hasField("STATE")).toBe(true);
    });

    it("returns false for non-existent field", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = await pdf.getForm();

      expect(form!.hasField("nonexistent")).toBe(false);
    });
  });

  describe("type-safe getters", () => {
    it("getTextField returns text field", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = await pdf.getForm();

      const field = form!.getTextField("STATE");

      expect(field).toBeDefined();
      expect(field?.type).toBe("text");
    });

    it("getTextField returns undefined for wrong type", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = await pdf.getForm();

      const field = form!.getTextField("TRADE CERTIFICATE");

      expect(field).toBeUndefined();
    });

    it("getCheckbox returns checkbox field", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = await pdf.getForm();

      const field = form!.getCheckbox("TRADE CERTIFICATE");

      expect(field).toBeDefined();
      expect(field?.type).toBe("checkbox");
    });

    it("getCheckbox returns undefined for wrong type", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = await pdf.getForm();

      const field = form!.getCheckbox("STATE");

      expect(field).toBeUndefined();
    });
  });

  describe("typed field collections", () => {
    it("getTextFields returns only text fields", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = await pdf.getForm();

      const fields = form!.getTextFields();

      expect(fields.length).toBeGreaterThan(0);
      expect(fields.every(f => f.type === "text")).toBe(true);
    });

    it("getCheckboxes returns only checkbox fields", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = await pdf.getForm();

      const fields = form!.getCheckboxes();

      expect(fields.every(f => f.type === "checkbox")).toBe(true);
    });
  });

  describe("fill", () => {
    it("fills multiple fields at once", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = await pdf.getForm();

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
      const form = await pdf.getForm();

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
      const form = await pdf.getForm();

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
      const form = await pdf.getForm();

      form!.fill({
        STATE: "CA",
        "TRADE CERTIFICATE": true,
      });

      form!.resetAll();

      const fields = form!.getFields() as TerminalField[];
      expect(fields.every(f => f.needsAppearanceUpdate)).toBe(true);
    });
  });

  describe("flatten", () => {
    it("flattens form fields", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = await pdf.getForm();

      await form!.flatten();

      expect(form!.getFields()).toHaveLength(0);
      expect(form!.fieldCount).toBe(0);
    });

    it("persists through save/load", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = await pdf.getForm();

      form!.getTextField("STATE")?.setValue("WA");
      await form!.flatten();

      const saved = await pdf.save();
      const pdf2 = await PDF.load(saved);

      // Form should be empty or null after flattening
      const form2 = await pdf2.getForm();
      if (form2) {
        expect(form2.getFields()).toHaveLength(0);
      }
    });
  });

  describe("reloadFields", () => {
    it("reloads fields from AcroForm", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = await pdf.getForm();

      const countBefore = form!.fieldCount;
      await form!.reloadFields();
      const countAfter = form!.fieldCount;

      expect(countAfter).toBe(countBefore);
    });
  });

  describe("hasUnsavedChanges", () => {
    it("returns false initially", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = await pdf.getForm();

      expect(form!.hasUnsavedChanges).toBe(false);
    });

    it("returns true after setting value", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = await pdf.getForm();

      form!.getTextField("STATE")?.setValue("OR");

      expect(form!.hasUnsavedChanges).toBe(true);
    });
  });

  describe("properties", () => {
    it("returns form properties", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = await pdf.getForm();

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
      const form = await pdf.getForm();

      expect(form!.fieldCount).toBeGreaterThan(0);
      expect(form!.fieldCount).toBe(form!.getFields().length);
    });
  });

  describe("getAcroForm", () => {
    it("returns underlying AcroForm", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = await pdf.getForm();

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
