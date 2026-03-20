/**
 * Regression test for issue #55:
 * "Bug: Missing resolver when reading indirect /Fields and /Contents references"
 *
 * Bug 1: AcroForm.getFields() calls getArray("Fields") without a resolver.
 * When /Fields is stored as a PdfRef (indirect object), getArray returns
 * undefined because the value type is "ref", not "array". The form appears empty.
 *
 * Bug 2: FormFlattener.wrapAndAppendContent() doesn't resolve /Contents before
 * checking its type. When /Contents is a PdfRef pointing to a PdfArray of
 * stream refs, the code wraps the ref as-is, producing a nested array reference
 * that PDF viewers cannot interpret. All original page content disappears.
 *
 * @see https://github.com/LibPDF-js/core/issues/55
 */

import { PDF } from "#src/api/pdf";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfRef } from "#src/objects/pdf-ref";
import { loadFixture, saveTestOutput } from "#src/test-utils";
import { describe, expect, it } from "vitest";

describe("Issue #55: Indirect /Fields and /Contents references", () => {
  describe("Bug 1: Indirect /Fields reference", () => {
    it("loads form fields from PDF with indirect /Fields array", async () => {
      // The 5E character sheet stores /Fields as an indirect reference
      const bytes = await loadFixture("issues", "form-filling/5e_character_sheet.pdf");
      const pdf = await PDF.load(bytes);

      const form = pdf.getForm();
      expect(form).not.toBeNull();

      const acroForm = form!.acroForm();
      const fields = acroForm.getFields();

      // Before the fix, this returned [] because getArray("Fields") returned
      // undefined when /Fields was a PdfRef
      expect(fields.length).toBeGreaterThan(0);
    });

    it("can read field names from the 5E character sheet", async () => {
      const bytes = await loadFixture("issues", "form-filling/5e_character_sheet.pdf");
      const pdf = await PDF.load(bytes);

      const form = pdf.getForm()!;
      const fields = form.getFields();

      // The sheet should have many named fields
      expect(fields.length).toBeGreaterThan(10);

      // At least some fields should have names
      const named = fields.filter(f => f.name.length > 0);
      expect(named.length).toBeGreaterThan(0);
    });

    it("can fill fields in the 5E character sheet", async () => {
      const bytes = await loadFixture("issues", "form-filling/5e_character_sheet.pdf");
      const pdf = await PDF.load(bytes);

      const form = pdf.getForm()!;
      const textFields = form.getTextFields();

      // Should have text fields to fill
      expect(textFields.length).toBeGreaterThan(0);

      // Fill the first writable text field
      const writable = textFields.find(f => !f.isReadOnly());
      expect(writable).toBeDefined();

      writable!.setValue("Test Value");
      expect(writable!.getValue()).toBe("Test Value");
    });

    it("removeField works with indirect /Fields array", async () => {
      const bytes = await loadFixture("issues", "form-filling/5e_character_sheet.pdf");
      const pdf = await PDF.load(bytes);

      const form = pdf.getForm()!;
      const fields = form.getFields();
      const countBefore = fields.length;
      expect(countBefore).toBeGreaterThan(0);

      // Remove first field by name
      const removed = form.removeField(fields[0].name);
      expect(removed).toBe(true);

      // Field count should decrease
      const countAfter = form.getFields().length;
      expect(countAfter).toBe(countBefore - 1);
    });

    it("round-trips: fill, save, reload, verify fields persist", async () => {
      const bytes = await loadFixture("issues", "form-filling/5e_character_sheet.pdf");
      const pdf = await PDF.load(bytes);

      const form = pdf.getForm()!;
      const textFields = form.getTextFields();
      const writable = textFields.find(f => !f.isReadOnly());
      expect(writable).toBeDefined();

      const fieldName = writable!.name;
      writable!.setValue("Round Trip");

      // Save and reload
      const saved = await pdf.save();
      await saveTestOutput("issues/issue-55-filled.pdf", saved);

      const pdf2 = await PDF.load(saved);
      const form2 = pdf2.getForm()!;
      const field2 = form2.getField(fieldName);

      expect(field2).not.toBeNull();
      expect(field2!.getValue()).toBe("Round Trip");
    });
  });

  describe("Bug 2: Indirect /Contents reference during flatten", () => {
    it("preserves page content when flattening PDF with indirect /Contents", async () => {
      const bytes = await loadFixture("issues", "form-filling/5e_character_sheet.pdf");
      const pdf = await PDF.load(bytes);

      const form = pdf.getForm()!;
      const acroForm = form.acroForm();

      // Fill a field so flatten has something to bake in
      const textFields = form.getTextFields();
      const writable = textFields.find(f => !f.isReadOnly());
      if (writable) {
        writable.setValue("Flattened");
      }

      // Flatten the form
      form.flatten();

      // Save and reload
      const saved = await pdf.save();
      await saveTestOutput("issues/issue-55-flattened.pdf", saved);

      const pdf2 = await PDF.load(saved);

      // Verify pages still exist and have content
      const pageCount = pdf2.getPageCount();
      expect(pageCount).toBeGreaterThan(0);

      // Check that /Contents on pages with former fields is an array
      // (not a nested array ref). Each page's Contents should be a flat
      // array of stream refs, not contain refs-to-arrays.
      const resolve = (ref: PdfRef) => pdf2.getObject(ref);

      for (let i = 0; i < pageCount; i++) {
        const page = pdf2.getPage(i)!;
        const pageDict = pdf2.getObject(page.ref);
        expect(pageDict).toBeDefined();

        if (pageDict instanceof PdfDict) {
          const contents = pageDict.get("Contents", resolve);

          if (contents instanceof PdfArray) {
            // Every item in the contents array should be a PdfRef to a stream,
            // NOT a PdfRef to another PdfArray (which was the bug)
            for (let j = 0; j < contents.length; j++) {
              const item = contents.at(j);

              if (item instanceof PdfRef) {
                const resolved = resolve(item);
                // The resolved value should NOT be a PdfArray — that would mean
                // we have a nested array (the bug condition)
                expect(resolved).not.toBeInstanceOf(PdfArray);
              }
            }
          }
        }
      }
    });

    it("flatten + save produces valid PDF", async () => {
      const bytes = await loadFixture("issues", "form-filling/5e_character_sheet.pdf");
      const pdf = await PDF.load(bytes);

      const form = pdf.getForm()!;
      form.flatten();

      const saved = await pdf.save();

      // Should be a valid PDF that can be reloaded
      const pdf2 = await PDF.load(saved);
      expect(pdf2.getPageCount()).toBeGreaterThan(0);

      // Form should have no fields after flattening
      const form2 = pdf2.getForm()?.acroForm();
      if (form2) {
        expect(form2.getFields().length).toBe(0);
      }
    });
  });
});
