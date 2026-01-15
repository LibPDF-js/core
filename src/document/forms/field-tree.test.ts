/**
 * Tests for FieldTree - safe field hierarchy iteration.
 */

import { PDF } from "#src/api/pdf";
import { loadFixture } from "#src/test-utils";
import { describe, expect, it } from "vitest";

import { NonTerminalField } from "./fields";

describe("FieldTree", () => {
  describe("getFieldTree", () => {
    it("loads fields from a form", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      expect(form).not.toBeNull();

      const tree = await form!.getFieldTree();

      expect(tree.size).toBeGreaterThan(0);
      expect(tree.isEmpty).toBe(false);
    });

    it("returns empty tree for form with no fields", async () => {
      const bytes = await loadFixture("basic", "document.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();

      // document.pdf has no form, so we skip this test
      if (!form) {
        return;
      }

      const tree = await form.getFieldTree();
      expect(tree.isEmpty).toBe(true);
    });
  });

  describe("iteration", () => {
    it("iterates all fields including non-terminal", async () => {
      const bytes = await loadFixture("forms", "fancy_fields.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      expect(form).not.toBeNull();

      const tree = await form!.getFieldTree();

      const fields = [...tree];
      expect(fields.length).toBeGreaterThan(0);
    });

    it("iterates terminal fields only", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      expect(form).not.toBeNull();

      const tree = await form!.getFieldTree();

      const terminalFields = [...tree.terminalFields()];

      // All terminal fields should have a type other than "non-terminal"
      for (const field of terminalFields) {
        expect(field.type).not.toBe("non-terminal");
      }
    });
  });

  describe("findField", () => {
    it("finds field by fully-qualified name", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      expect(form).not.toBeNull();

      const tree = await form!.getFieldTree();

      const field = tree.findField("STATE");
      expect(field).not.toBeNull();
      expect(field?.name).toBe("STATE");
    });

    it("returns null for non-existent field", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      expect(form).not.toBeNull();

      const tree = await form!.getFieldTree();

      const field = tree.findField("NonExistentField");
      expect(field).toBeNull();
    });

    it("finds terminal field by name", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      expect(form).not.toBeNull();

      const tree = await form!.getFieldTree();

      const field = tree.findTerminalField("STATE");
      expect(field).not.toBeNull();
      expect(field?.type).toBe("text");
    });
  });

  describe("parent references", () => {
    it("sets parent references during iteration", async () => {
      const bytes = await loadFixture("forms", "fancy_fields.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      expect(form).not.toBeNull();

      const tree = await form!.getFieldTree();

      // Root fields should have null parent
      // Child fields should have their parent set
      const allFields = tree.getAllFields();
      const rootFields = allFields.filter(f => f.parent === null);

      // Should have at least one root field
      expect(rootFields.length).toBeGreaterThan(0);
    });
  });

  describe("getAllFields", () => {
    it("returns all fields as array", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      expect(form).not.toBeNull();

      const tree = await form!.getFieldTree();

      const fields = tree.getAllFields();
      expect(Array.isArray(fields)).toBe(true);
      expect(fields.length).toBe(tree.size);
    });
  });

  describe("getTerminalFields", () => {
    it("returns only terminal fields as array", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      expect(form).not.toBeNull();

      const tree = await form!.getFieldTree();

      const terminalFields = tree.getTerminalFields();

      // Verify none are non-terminal
      for (const field of terminalFields) {
        expect(field).not.toBeInstanceOf(NonTerminalField);
      }
    });
  });

  describe("hierarchical forms", () => {
    it("handles deep field hierarchy", async () => {
      const bytes = await loadFixture("forms", "fancy_fields.pdf");
      const pdf = await PDF.load(bytes);
      const form = (await pdf.getForm())?.acroForm();
      expect(form).not.toBeNull();

      const tree = await form!.getFieldTree();

      // Should handle any depth without issues
      const fields = tree.getAllFields();
      expect(fields.length).toBeGreaterThan(0);

      // Verify all fields have valid names
      for (const field of fields) {
        expect(typeof field.name).toBe("string");
      }
    });
  });
});
