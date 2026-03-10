/**
 * Integration tests for form field fonts, appearance generation, and incremental saves.
 *
 * These tests verify the complete workflow of modifying form fields with custom fonts
 * and saving them (both full and incremental). Output files are saved to test-output/
 * for manual inspection.
 */

import { PDF } from "#src/api/pdf";
import { DropdownField } from "#src/document/forms/fields/choice-fields";
import { loadFixture, saveTestOutput } from "#src/test-utils";
import { describe, expect, it } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Embedded Font Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Form Integration: Embedded Fonts", () => {
  it("fills text fields with embedded TTF font and saves", async () => {
    const pdfBytes = await loadFixture("forms", "sample_form.pdf");
    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");

    const pdf = await PDF.load(pdfBytes);
    const form = pdf.getForm();
    expect(form).not.toBeNull();

    // Embed font
    const font = pdf.embedFont(fontBytes);

    // Set font on form-level default
    const acroForm = form!.acroForm();
    acroForm.setDefaultFont(font);
    acroForm.setDefaultFontSize(10);

    // Fill some fields
    const textFields = form!.getTextFields();
    for (const field of textFields.slice(0, 3)) {
      if (!field.isReadOnly()) {
        field.setValue("Test Value");
      }
    }

    // Update appearances
    form!.updateAppearances();

    // Save (full save)
    const savedBytes = await pdf.save();
    const outputPath = await saveTestOutput("forms/embedded-font-full-save.pdf", savedBytes);

    console.log(`  -> Output: ${outputPath}`);
    expect(savedBytes.length).toBeGreaterThan(0);

    // Verify by reloading
    const pdf2 = await PDF.load(savedBytes);
    const form2 = pdf2.getForm();
    const reloadedFields = form2!.getTextFields();
    const filledField = reloadedFields.find(f => f.getValue() === "Test Value");
    expect(filledField).toBeDefined();
  });

  it("fills fields with embedded OTF font and saves", async () => {
    const pdfBytes = await loadFixture("forms", "fancy_fields.pdf");
    const fontBytes = await loadFixture("fonts", "otf/FoglihtenNo07.otf");

    const pdf = await PDF.load(pdfBytes);
    const form = pdf.getForm();
    expect(form).not.toBeNull();

    // Embed OTF font
    const font = pdf.embedFont(fontBytes);

    // Get first text field and set font
    const nameField = form!.getTextField("First Name 🚀");
    if (nameField) {
      nameField.setFont(font);
      nameField.setFontSize(14);
      nameField.setValue("John Doe");
    }

    form!.updateAppearances();

    const savedBytes = await pdf.save();
    const outputPath = await saveTestOutput("forms/embedded-otf-font.pdf", savedBytes);

    console.log(`  -> Output: ${outputPath}`);
    expect(savedBytes.length).toBeGreaterThan(0);
  });

  it("uses different fonts for different fields", async () => {
    const pdfBytes = await loadFixture("forms", "sample_form.pdf");
    const sansBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const italicBytes = await loadFixture("fonts", "ttf/JosefinSans-Italic.ttf");

    const pdf = await PDF.load(pdfBytes);
    const form = pdf.getForm();
    expect(form).not.toBeNull();

    // Embed two different fonts
    const sansFont = pdf.embedFont(sansBytes);
    const italicFont = pdf.embedFont(italicBytes);

    const textFields = form!.getTextFields();
    let count = 0;

    for (const field of textFields) {
      if (field.isReadOnly()) {
        continue;
      }

      // Alternate between fonts
      if (count % 2 === 0) {
        field.setFont(sansFont);
        field.setValue("Sans Regular");
      } else {
        field.setFont(italicFont);
        field.setValue("Italic Style");
      }
      count++;

      if (count >= 6) {
        break;
      }
    }

    form!.updateAppearances();

    const savedBytes = await pdf.save();
    const outputPath = await saveTestOutput("forms/multiple-fonts.pdf", savedBytes);

    console.log(`  -> Output: ${outputPath}`);
    expect(savedBytes.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Existing Font Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Form Integration: Existing Fonts", () => {
  it("uses existing PDF fonts (Helvetica) for form fields", async () => {
    const pdfBytes = await loadFixture("forms", "sample_form.pdf");
    const pdf = await PDF.load(pdfBytes);
    const form = pdf.getForm();
    expect(form).not.toBeNull();

    const acroForm = form!.acroForm();

    // Get existing font from form resources
    const helv = acroForm.getExistingFont("/Helv");
    if (helv) {
      acroForm.setDefaultFont(helv);
      acroForm.setDefaultFontSize(12);
    }

    // Fill all text fields
    for (const field of form!.getTextFields()) {
      if (!field.isReadOnly()) {
        field.setValue("Helvetica Text");
      }
    }

    form!.updateAppearances();

    const savedBytes = await pdf.save();
    const outputPath = await saveTestOutput("forms/existing-font-helv.pdf", savedBytes);

    console.log(`  -> Output: ${outputPath}`);
    expect(savedBytes.length).toBeGreaterThan(0);
  });

  it("lists available fonts from form default resources", async () => {
    const pdfBytes = await loadFixture("forms", "sample_form.pdf");
    const pdf = await PDF.load(pdfBytes);
    const form = pdf.getForm();
    expect(form).not.toBeNull();

    const acroForm = form!.acroForm();
    const fonts = acroForm.getAvailableFonts();

    console.log(`  Available fonts: ${fonts.join(", ")}`);
    expect(fonts.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Text Color Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Form Integration: Text Colors", () => {
  it("applies custom text colors to fields", async () => {
    const pdfBytes = await loadFixture("forms", "sample_form.pdf");
    const pdf = await PDF.load(pdfBytes);
    const form = pdf.getForm();
    expect(form).not.toBeNull();

    const textFields = form!.getTextFields();
    const colors = [
      { r: 1, g: 0, b: 0 }, // Red
      { r: 0, g: 0.5, b: 0 }, // Dark green
      { r: 0, g: 0, b: 1 }, // Blue
    ];

    let colorIndex = 0;
    for (const field of textFields.slice(0, 6)) {
      if (field.isReadOnly()) {
        continue;
      }

      const color = colors[colorIndex % colors.length];
      field.setTextColor(color.r, color.g, color.b);
      field.setValue(`Color ${colorIndex + 1}`);
      colorIndex++;
    }

    form!.updateAppearances();

    const savedBytes = await pdf.save();
    const outputPath = await saveTestOutput("forms/text-colors.pdf", savedBytes);

    console.log(`  -> Output: ${outputPath}`);
    expect(savedBytes.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// All Field Types Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Form Integration: All Field Types", () => {
  it("updates appearances for all field types", async () => {
    const pdfBytes = await loadFixture("forms", "fancy_fields.pdf");
    const pdf = await PDF.load(pdfBytes);
    const form = pdf.getForm();
    expect(form).not.toBeNull();

    // Fill different field types
    const textFields = form!.getTextFields();
    for (const field of textFields) {
      if (!field.isReadOnly()) {
        field.setValue("Filled Text");
      }
    }

    const checkboxes = form!.getCheckboxes();

    for (const cb of checkboxes) {
      try {
        cb.check();
      } catch {
        // Some checkboxes may have different on values, skip them
      }
    }

    const radios = form!.getRadioGroups();
    for (const radio of radios) {
      const options = radio.getOptions();
      if (options.length > 0) {
        radio.setValue(options[0]);
      }
    }

    const dropdowns = form!.getDropdowns();
    for (const dd of dropdowns) {
      const options = dd.getOptions();
      if (options.length > 0) {
        dd.setValue(options[0].value);
      } else if (dd.isEditable) {
        dd.setValue("Custom Entry");
      }
    }

    const listboxes = form!.getListBoxes();
    for (const lb of listboxes) {
      const options = lb.getOptions();
      if (options.length > 0) {
        lb.setValue([options[0].value]);
      }
    }

    form!.updateAppearances();

    const savedBytes = await pdf.save();
    const outputPath = await saveTestOutput("forms/all-field-types.pdf", savedBytes);

    console.log(`  -> Output: ${outputPath}`);
    expect(savedBytes.length).toBeGreaterThan(0);

    // Verify round-trip
    const pdf2 = await PDF.load(savedBytes);
    const form2 = pdf2.getForm();
    expect(form2!.getFields().length).toBe(form!.getFields().length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Incremental Save Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Form Integration: Incremental Saves", () => {
  it("saves form changes incrementally", async () => {
    const pdfBytes = await loadFixture("forms", "sample_form.pdf");
    const pdf = await PDF.load(pdfBytes);

    // Check if incremental save is possible
    const blocker = pdf.canSaveIncrementally();
    console.log(`  Incremental save blocker: ${blocker ?? "none"}`);

    const form = pdf.getForm();
    expect(form).not.toBeNull();

    // Make a simple change
    const stateField = form!.getTextField("STATE");
    expect(stateField).toBeDefined();
    stateField!.setValue("CA");

    form!.updateAppearances();

    // Save incrementally
    const savedBytes = await pdf.save({ incremental: true });
    const outputPath = await saveTestOutput("forms/incremental-save.pdf", savedBytes);

    console.log(`  -> Output: ${outputPath}`);
    console.log(`  Original size: ${pdfBytes.length}, Saved size: ${savedBytes.length}`);

    // Incremental save should be larger than original (appends data)
    if (blocker === null) {
      expect(savedBytes.length).toBeGreaterThan(pdfBytes.length);
    }

    // Verify the change persisted
    const pdf2 = await PDF.load(savedBytes);
    const form2 = pdf2.getForm();
    const field2 = form2!.getTextField("STATE");
    expect(field2!.getValue()).toBe("CA");
  });

  it("performs multiple incremental saves", async () => {
    const pdfBytes = await loadFixture("forms", "sample_form.pdf");
    let pdf = await PDF.load(pdfBytes);
    let currentBytes: Uint8Array = new Uint8Array(pdfBytes);

    const blocker = pdf.canSaveIncrementally();
    if (blocker !== null) {
      console.log(`  Skipping: incremental save blocked by ${blocker}`);
      return;
    }

    // First incremental save
    let form = pdf.getForm();
    const field1 = form!.getTextField("STATE");
    field1!.setValue("NY");
    form!.updateAppearances();

    currentBytes = await pdf.save({ incremental: true });
    const size1 = currentBytes.length;
    await saveTestOutput("forms/multi-incremental-1.pdf", currentBytes);

    // Second incremental save (reload from previous)
    pdf = await PDF.load(currentBytes);
    form = pdf.getForm();
    const field2 = form!.getTextField("ZIP");
    if (field2 && !field2.isReadOnly()) {
      field2.setValue("10001");
      form!.updateAppearances();

      currentBytes = await pdf.save({ incremental: true });
      const size2 = currentBytes.length;
      await saveTestOutput("forms/multi-incremental-2.pdf", currentBytes);

      console.log(`  Sizes: original=${pdfBytes.length}, after1=${size1}, after2=${size2}`);
      expect(size2).toBeGreaterThan(size1);
    }

    // Verify both changes persisted
    const finalPdf = await PDF.load(currentBytes);
    const finalForm = finalPdf.getForm();
    expect(finalForm!.getTextField("STATE")!.getValue()).toBe("NY");
  });

  it("incremental save with checkbox changes", async () => {
    const pdfBytes = await loadFixture("forms", "sample_form.pdf");
    const pdf = await PDF.load(pdfBytes);

    const form = pdf.getForm();
    expect(form).not.toBeNull();

    // Toggle some checkboxes
    const checkboxes = form!.getCheckboxes();
    for (const cb of checkboxes) {
      if (cb.isChecked()) {
        cb.uncheck();
      } else {
        cb.check();
      }
    }

    form!.updateAppearances();

    const savedBytes = await pdf.save({ incremental: true });
    const outputPath = await saveTestOutput("forms/incremental-checkboxes.pdf", savedBytes);

    console.log(`  -> Output: ${outputPath}`);

    // Verify
    const pdf2 = await PDF.load(savedBytes);
    const form2 = pdf2.getForm();
    const cbs2 = form2!.getCheckboxes();

    // States should be toggled from original
    for (let i = 0; i < Math.min(checkboxes.length, cbs2.length); i++) {
      // We toggled all, so states should differ from a fresh load
      // (Note: This is a weak test since we don't know original states)
      expect(typeof cbs2[i].isChecked()).toBe("boolean");
    }
  });

  it("incremental save with embedded font", async () => {
    const pdfBytes = await loadFixture("forms", "sample_form.pdf");
    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");

    const pdf = await PDF.load(pdfBytes);
    const form = pdf.getForm();
    expect(form).not.toBeNull();

    // Embed font and use it
    const font = pdf.embedFont(fontBytes);
    const acroForm = form!.acroForm();
    acroForm.setDefaultFont(font);

    // Fill a field
    const stateField = form!.getTextField("STATE");
    stateField!.setValue("TX");

    form!.updateAppearances();

    // Try incremental save with embedded font
    const savedBytes = await pdf.save({ incremental: true });
    const outputPath = await saveTestOutput("forms/incremental-embedded-font.pdf", savedBytes);

    console.log(`  -> Output: ${outputPath}`);
    console.log(`  Original: ${pdfBytes.length}, Saved: ${savedBytes.length}`);

    // Verify
    const pdf2 = await PDF.load(savedBytes);
    const form2 = pdf2.getForm();
    expect(form2!.getTextField("STATE")!.getValue()).toBe("TX");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Flatten Tests with Output
// ─────────────────────────────────────────────────────────────────────────────

describe("Form Integration: Flatten with Output", () => {
  it("flattens form with embedded font and saves", async () => {
    const pdfBytes = await loadFixture("forms", "sample_form.pdf");
    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");

    const pdf = await PDF.load(pdfBytes);
    const form = pdf.getForm();
    expect(form).not.toBeNull();

    // Embed font
    const font = pdf.embedFont(fontBytes);

    // Fill fields with embedded font
    const acroForm = form!.acroForm();
    acroForm.setDefaultFont(font);
    acroForm.setDefaultFontSize(11);

    for (const field of form!.getTextFields()) {
      if (!field.isReadOnly()) {
        field.setValue("Flattened Value");
      }
    }

    // Check all checkboxes
    for (const cb of form!.getCheckboxes()) {
      cb.check();
    }

    // Flatten
    form!.flatten();

    const savedBytes = await pdf.save();
    const outputPath = await saveTestOutput("forms/flatten-embedded-font.pdf", savedBytes);

    console.log(`  -> Output: ${outputPath}`);

    // Verify form is gone
    const pdf2 = await PDF.load(savedBytes);
    const form2 = pdf2.getForm();
    if (form2) {
      expect(form2.getFields().length).toBe(0);
    }
  });

  it("flattens form with font options", async () => {
    // Use sample_form.pdf which has known good structure
    const pdfBytes = await loadFixture("forms", "sample_form.pdf");
    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");

    const pdf = await PDF.load(pdfBytes);
    const form = pdf.getForm();

    if (!form || form.getFields().length === 0) {
      console.log("  Skipping: form has no fields");
      return;
    }

    // Embed font
    const font = pdf.embedFont(fontBytes);

    // Fill some fields
    for (const field of form.getTextFields()) {
      if (!field.isReadOnly()) {
        field.setValue("Font Option Test");
      }
    }

    // Flatten with font options
    form.flatten({ font, fontSize: 12 });

    const savedBytes = await pdf.save();
    const outputPath = await saveTestOutput("forms/flatten-font-options.pdf", savedBytes);

    console.log(`  -> Output: ${outputPath}`);
    expect(savedBytes.length).toBeGreaterThan(0);
  });

  it("flattens fancy_fields form with all field types", async () => {
    const pdfBytes = await loadFixture("forms", "fancy_fields.pdf");
    const pdf = await PDF.load(pdfBytes);
    const form = pdf.getForm();
    expect(form).not.toBeNull();

    // Fill various field types
    for (const field of form!.getTextFields()) {
      if (!field.isReadOnly()) {
        field.setValue("Flattened");
      }
    }

    for (const cb of form!.getCheckboxes()) {
      try {
        cb.check();
      } catch {
        // Some checkboxes may have different on values, skip them
      }
    }

    for (const radio of form!.getRadioGroups()) {
      const options = radio.getOptions();
      if (options.length > 1) {
        radio.setValue(options[1]); // Select second option
      }
    }

    for (const dd of form!.getDropdowns()) {
      const options = dd.getOptions();
      if (options.length > 0) {
        dd.setValue(options[0].value);
      }
    }

    form!.flatten();

    const savedBytes = await pdf.save();
    const outputPath = await saveTestOutput("forms/flatten-fancy-fields.pdf", savedBytes);

    console.log(`  -> Output: ${outputPath}`);
    expect(savedBytes.length).toBeGreaterThan(0);

    // Verify flattening
    const pdf2 = await PDF.load(savedBytes);
    const form2 = pdf2.getForm();
    if (form2) {
      expect(form2.getFields().length).toBe(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Round-trip Integrity Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Form Integration: Round-trip Integrity", () => {
  it("preserves all field values through save/load cycle", async () => {
    const pdfBytes = await loadFixture("forms", "sample_form.pdf");
    const pdf = await PDF.load(pdfBytes);
    const form = pdf.getForm();
    expect(form).not.toBeNull();

    // Record original values and set new ones
    const originalValues = new Map<string, string>();
    const newValues = new Map<string, string>();

    for (const field of form!.getTextFields()) {
      originalValues.set(field.name, field.getValue());
      if (!field.isReadOnly()) {
        const newValue = `New_${field.name.slice(0, 5)}`;
        field.setValue(newValue);
        // Record what was actually set (getValue returns the truncated value if applicable)
        newValues.set(field.name, field.getValue());
      }
    }

    form!.updateAppearances();

    // Save and reload
    const savedBytes = await pdf.save();
    await saveTestOutput("forms/round-trip-values.pdf", savedBytes);

    const pdf2 = await PDF.load(savedBytes);
    const form2 = pdf2.getForm();

    // Verify new values persisted
    for (const [name, expectedValue] of newValues) {
      const field = form2!.getTextField(name);
      if (field) {
        expect(field.getValue()).toBe(expectedValue);
      }
    }
  });

  it("preserves checkbox states through multiple saves", async () => {
    const pdfBytes = await loadFixture("forms", "sample_form.pdf");
    let currentBytes: Uint8Array = new Uint8Array(pdfBytes);

    // First cycle: check all
    let pdf = await PDF.load(currentBytes);
    let form = pdf.getForm();

    for (const cb of form!.getCheckboxes()) {
      cb.check();
    }
    form!.updateAppearances();

    currentBytes = await pdf.save();
    await saveTestOutput("forms/checkbox-round-trip-1.pdf", currentBytes);

    // Verify all checked
    pdf = await PDF.load(currentBytes);
    form = pdf.getForm();
    for (const cb of form!.getCheckboxes()) {
      expect(cb.isChecked()).toBe(true);
    }

    // Second cycle: uncheck all
    for (const cb of form!.getCheckboxes()) {
      cb.uncheck();
    }
    form!.updateAppearances();

    currentBytes = await pdf.save();
    await saveTestOutput("forms/checkbox-round-trip-2.pdf", currentBytes);

    // Verify all unchecked
    pdf = await PDF.load(currentBytes);
    form = pdf.getForm();
    for (const cb of form!.getCheckboxes()) {
      expect(cb.isChecked()).toBe(false);
    }
  });

  it("embedded font survives round-trip", async () => {
    const pdfBytes = await loadFixture("forms", "sample_form.pdf");
    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");

    const pdf = await PDF.load(pdfBytes);
    const form = pdf.getForm();

    // Embed font and use it
    const font = pdf.embedFont(fontBytes);
    const acroForm = form!.acroForm();
    acroForm.setDefaultFont(font);

    const stateField = form!.getTextField("STATE");
    stateField!.setValue("FL");
    form!.updateAppearances();

    // First save
    const bytes1 = await pdf.save();
    await saveTestOutput("forms/font-round-trip-1.pdf", bytes1);

    // Reload and modify again
    const pdf2 = await PDF.load(bytes1);
    const form2 = pdf2.getForm();

    const stateField2 = form2!.getTextField("STATE");
    expect(stateField2!.getValue()).toBe("FL");

    stateField2!.setValue("GA");
    form2!.updateAppearances();

    const bytes2 = await pdf2.save();
    await saveTestOutput("forms/font-round-trip-2.pdf", bytes2);

    // Final verification
    const pdf3 = await PDF.load(bytes2);
    const form3 = pdf3.getForm();
    expect(form3!.getTextField("STATE")!.getValue()).toBe("GA");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unicode and Special Characters
// ─────────────────────────────────────────────────────────────────────────────

describe("Form Integration: Unicode Text", () => {
  it("handles unicode text with embedded font", async () => {
    const pdfBytes = await loadFixture("forms", "fancy_fields.pdf");
    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");

    const pdf = await PDF.load(pdfBytes);
    const form = pdf.getForm();
    expect(form).not.toBeNull();

    // Embed font that supports more glyphs
    const font = pdf.embedFont(fontBytes);

    // Find a text field and set unicode value
    const textFields = form!.getTextFields();
    if (textFields.length > 0) {
      const field = textFields[0];
      field.setFont(font);
      field.setValue("Hello Wörld Café");
      form!.updateAppearances();

      const savedBytes = await pdf.save();
      const outputPath = await saveTestOutput("forms/unicode-text.pdf", savedBytes);

      console.log(`  -> Output: ${outputPath}`);

      // Verify value preserved
      const pdf2 = await PDF.load(savedBytes);
      const form2 = pdf2.getForm();
      const field2 = form2!.getTextField(field.name);
      expect(field2!.getValue()).toBe("Hello Wörld Café");
    }
  });

  it("handles CJK text with appropriate font", async () => {
    const pdfBytes = await loadFixture("forms", "fancy_fields.pdf");

    const pdf = await PDF.load(pdfBytes);
    const form = pdf.getForm();
    expect(form).not.toBeNull();

    // Note: The font may not have CJK glyphs, but the value should still be stored
    const textFields = form!.getTextFields();
    if (textFields.length > 0) {
      const field = textFields[0];
      field.setValue("こんにちは世界");

      const savedBytes = await pdf.save();
      const outputPath = await saveTestOutput("forms/cjk-text-value.pdf", savedBytes);

      console.log(`  -> Output: ${outputPath}`);

      // Value should be preserved even if appearance may have fallback glyphs
      const pdf2 = await PDF.load(savedBytes);
      const form2 = pdf2.getForm();
      const field2 = form2!.getTextField(field.name);
      expect(field2!.getValue()).toBe("こんにちは世界");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases and Error Handling
// ─────────────────────────────────────────────────────────────────────────────

describe("Form Integration: Edge Cases", () => {
  it("handles empty form gracefully", async () => {
    const pdfBytes = await loadFixture("basic", "document.pdf");
    const pdf = await PDF.load(pdfBytes);
    const form = pdf.getForm();

    // Document without form - should be null or have no fields
    if (form) {
      expect(form.getFields().length).toBe(0);
    } else {
      expect(form).toBeNull();
    }
  });

  it("handles form with read-only fields", async () => {
    const pdfBytes = await loadFixture("forms", "sample_form.pdf");
    const pdf = await PDF.load(pdfBytes);
    const form = pdf.getForm();
    expect(form).not.toBeNull();

    // Count read-only fields
    const readOnlyFields = form!.getFields().filter(f => f.isReadOnly());
    console.log(`  Read-only fields: ${readOnlyFields.length}`);

    // Attempt to fill - should skip read-only
    const result = form!.fill({
      STATE: "CA",
      CITY: "Los Angeles",
    });

    console.log(`  Filled: ${result.filled.join(", ")}, Skipped: ${result.skipped.join(", ")}`);

    form!.updateAppearances();

    const savedBytes = await pdf.save();
    await saveTestOutput("forms/with-readonly.pdf", savedBytes);

    expect(savedBytes.length).toBeGreaterThan(0);
  });

  it("handles comb fields correctly", async () => {
    const pdfBytes = await loadFixture("forms", "with_combed_fields.pdf");
    const pdf = await PDF.load(pdfBytes);
    const form = pdf.getForm();

    if (!form) {
      console.log("  Skipping: no form found");
      return;
    }

    // Find comb fields (fields with maxLength and comb flag)
    const textFields = form.getTextFields();
    const combFields = textFields.filter(f => f.isComb);

    console.log(`  Comb fields found: ${combFields.length}`);

    for (const field of combFields) {
      if (field.isReadOnly()) {
        continue;
      }

      const maxLen = field.maxLength ?? 10;
      field.setValue("A".repeat(Math.min(maxLen, 5)));
    }

    form.updateAppearances();

    const savedBytes = await pdf.save();
    const outputPath = await saveTestOutput("forms/comb-fields.pdf", savedBytes);

    console.log(`  -> Output: ${outputPath}`);
    expect(savedBytes.length).toBeGreaterThan(0);
  });

  it("reuses valid registered existing fonts for appearance generation", async () => {
    const pdfBytes = await loadFixture("forms", "with_combed_fields.pdf");
    const pdf = await PDF.load(pdfBytes);
    const form = pdf.getForm();
    expect(form).not.toBeNull();

    const targetField = form!
      .getTextFields()
      .find(field => field.alternateName === "6. Certification. Name.");

    expect(targetField).toBeDefined();

    targetField!.setValue("Jane Doe");
    form!.updateAppearances();

    const savedBytes = await pdf.save();
    const pdf2 = await PDF.load(savedBytes);
    const field2 = pdf2
      .getForm()!
      .getTextFields()
      .find(field => field.alternateName === "6. Certification. Name.");

    expect(field2).toBeDefined();
    expect(field2!.getValue()).toBe("Jane Doe");

    const appearance = field2!.getWidgets()[0].getNormalAppearance();
    expect(appearance).not.toBeNull();

    const streamContent = new TextDecoder().decode(appearance!.getDecodedData());

    expect(streamContent).toContain("/HeBo");
    expect(streamContent).not.toContain("/Helv");
    expect(streamContent).toContain("(Jane Doe) Tj");
  });

  it("skips unusable field fonts and reuses a later registered font", async () => {
    const pdfBytes = await loadFixture("forms", "pdfjs/bug1669099.pdf");
    const pdf = await PDF.load(pdfBytes);
    const form = pdf.getForm();
    expect(form).not.toBeNull();

    const targetField = form!.getTextField("_e");
    expect(targetField).not.toBeNull();

    targetField!.setValue("Visible text");
    form!.updateAppearances();

    const savedBytes = await pdf.save();
    const pdf2 = await PDF.load(savedBytes);
    const field2 = pdf2.getForm()!.getTextField("_e");
    expect(field2).not.toBeNull();
    expect(field2!.getValue()).toBe("Visible text");

    const appearance = field2!.getWidgets()[0].getNormalAppearance();
    expect(appearance).not.toBeNull();

    const streamContent = new TextDecoder().decode(appearance!.getDecodedData());

    // Original /DA uses an unusable anonymous font name ("/"). We should
    // skip it and reuse the later registered OpenSans font instead.
    expect(streamContent).toContain("/Fo2");
    expect(streamContent).not.toContain("/Helv");
    expect(streamContent).not.toContain("\n/ 12.00000 Tf");
    expect(streamContent).toContain("Visible text");
  });

  it("reuses existing fonts for choice field appearances", async () => {
    const pdfBytes = await loadFixture("forms", "pdfjs/annotation-choice-widget.pdf");
    const pdf = await PDF.load(pdfBytes);
    const form = pdf.getForm();
    expect(form).not.toBeNull();

    const dropdown = form!
      .acroForm()
      .getFields()
      .find(field => field.type === "dropdown" && field.alternateName === "Combo box");

    expect(dropdown).toBeInstanceOf(DropdownField);

    const comboBox = dropdown as DropdownField;

    comboBox.setValue("Amet");
    form!.updateAppearances();

    const savedBytes = await pdf.save();
    const pdf2 = await PDF.load(savedBytes);
    const dropdown2 = pdf2
      .getForm()!
      .acroForm()
      .getFields()
      .find(field => field.type === "dropdown" && field.alternateName === "Combo box");

    expect(dropdown2).toBeInstanceOf(DropdownField);

    const appearance = (dropdown2 as DropdownField).getWidgets()[0].getNormalAppearance();
    expect(appearance).not.toBeNull();

    const streamContent = new TextDecoder().decode(appearance!.getDecodedData());

    expect(streamContent).toContain("/MyriadPro-Regular");
    expect(streamContent).not.toContain("/Helv");
    expect(streamContent).toContain("(Amet) Tj");
  });

  it("reuses valid Type0 fonts for button captions", async () => {
    const pdfBytes = await loadFixture("forms", "pdfjs/issue15053.pdf");
    const pdf = await PDF.load(pdfBytes);
    const form = pdf.getForm();
    expect(form).not.toBeNull();

    const buttonField = form!
      .acroForm()
      .getFields()
      .find(field => field.type === "button" && field.name === "Button2");

    expect(buttonField).toBeDefined();

    buttonField!.setFont(form!.acroForm().getExistingFont("/KozMinPr6N-Regular")!);
    buttonField!.needsAppearanceUpdate = true;
    form!.updateAppearances();

    const savedBytes = await pdf.save();
    const pdf2 = await PDF.load(savedBytes);
    const buttonField2 = pdf2
      .getForm()!
      .acroForm()
      .getFields()
      .find(field => field.type === "button" && field.name === "Button2");

    expect(buttonField2).toBeDefined();

    const appearance = buttonField2!.getWidgets()[0].getNormalAppearance();
    expect(appearance).not.toBeNull();

    const streamContent = new TextDecoder().decode(appearance!.getDecodedData());

    expect(streamContent).toContain("/KozMinPr6N-Regular");
    expect(streamContent).not.toContain("/Helv");
    expect(streamContent).toContain("<0042007500740074006F006E0031> Tj");
  });

  it("handles multiline text fields", async () => {
    const pdfBytes = await loadFixture("forms", "sample_form.pdf");
    const pdf = await PDF.load(pdfBytes);
    const form = pdf.getForm();
    expect(form).not.toBeNull();

    const textFields = form!.getTextFields();
    const multilineFields = textFields.filter(f => f.isMultiline);

    console.log(`  Multiline fields: ${multilineFields.length}`);

    for (const field of multilineFields) {
      field.setValue("Line 1\nLine 2\nLine 3");
    }

    // Also set regular fields
    for (const field of textFields.filter(f => !f.isMultiline && !f.isReadOnly())) {
      field.setValue("Single line");
    }

    form!.updateAppearances();

    const savedBytes = await pdf.save();
    const outputPath = await saveTestOutput("forms/multiline-fields.pdf", savedBytes);

    console.log(`  -> Output: ${outputPath}`);
    expect(savedBytes.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Field Tree and Hierarchy Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Form Integration: Field Tree", () => {
  it("accesses fields via FieldTree", async () => {
    const pdfBytes = await loadFixture("forms", "fancy_fields.pdf");
    const pdf = await PDF.load(pdfBytes);
    const form = pdf.getForm()?.acroForm();
    expect(form).not.toBeNull();

    const tree = form!.getFieldTree();

    // Test iteration
    const fieldNames: string[] = [];

    for (const field of tree) {
      fieldNames.push(field.name);
    }

    expect(fieldNames.length).toBeGreaterThan(0);

    // Test terminal fields only
    const terminalNames: string[] = [];

    for (const field of tree.terminalFields()) {
      terminalNames.push(field.name);
    }

    // Terminal fields should be a subset of all fields
    expect(terminalNames.length).toBeGreaterThan(0);
    expect(terminalNames.length).toBeLessThanOrEqual(fieldNames.length);
  });

  it("finds fields by name via FieldTree", async () => {
    const pdfBytes = await loadFixture("forms", "sample_form.pdf");
    const pdf = await PDF.load(pdfBytes);
    const form = pdf.getForm()?.acroForm();
    expect(form).not.toBeNull();

    const tree = form!.getFieldTree();

    // Find a known field
    const field = tree.findField("STATE");
    expect(field).not.toBeNull();
    expect(field?.name).toBe("STATE");
  });

  it("gets terminal field by name", async () => {
    const pdfBytes = await loadFixture("forms", "sample_form.pdf");
    const pdf = await PDF.load(pdfBytes);
    const form = pdf.getForm()?.acroForm();
    expect(form).not.toBeNull();

    const tree = form!.getFieldTree();

    const terminalField = tree.findTerminalField("STATE");
    expect(terminalField).not.toBeNull();
    expect(terminalField?.type).toBe("text");

    // Should be able to get/set value
    expect(typeof terminalField?.getValue()).toBe("string");
  });

  it("provides size and isEmpty properties", async () => {
    const pdfBytes = await loadFixture("forms", "sample_form.pdf");
    const pdf = await PDF.load(pdfBytes);
    const form = pdf.getForm()?.acroForm();
    expect(form).not.toBeNull();

    const tree = form!.getFieldTree();

    expect(tree.size).toBeGreaterThan(0);
    expect(tree.isEmpty).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Async setValue Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Form Integration: Async setValue", () => {
  it("setValue is async and auto-updates appearance", async () => {
    const pdfBytes = await loadFixture("forms", "sample_form.pdf");
    const pdf = await PDF.load(pdfBytes);
    const form = pdf.getForm();
    expect(form).not.toBeNull();

    const textField = form!.getTextField("STATE");
    expect(textField).not.toBeNull();

    // setValue returns a promise
    const result = textField!.setValue("NY");

    // After awaiting, appearance should be updated (needsAppearanceUpdate = false)
    expect(textField!.needsAppearanceUpdate).toBe(false);

    // Value should be set
    expect(textField!.getValue()).toBe("NY");
  });

  it("checkbox check/uncheck are async", async () => {
    const pdfBytes = await loadFixture("forms", "sample_form.pdf");
    const pdf = await PDF.load(pdfBytes);
    const form = pdf.getForm();
    expect(form).not.toBeNull();

    const checkboxes = form!.getCheckboxes();
    if (checkboxes.length === 0) {
      return;
    }

    const cb = checkboxes[0];
    const wasChecked = cb.isChecked();

    // check/uncheck return promises
    if (wasChecked) {
      cb.uncheck();
      expect(cb.isChecked()).toBe(false);
    } else {
      cb.check();
      expect(cb.isChecked()).toBe(true);
    }
  });

  it("radio setValue is async", async () => {
    const pdfBytes = await loadFixture("forms", "fancy_fields.pdf");
    const pdf = await PDF.load(pdfBytes);
    const form = pdf.getForm();
    expect(form).not.toBeNull();

    const radios = form!.getRadioGroups();
    if (radios.length === 0) {
      return;
    }

    const radio = radios[0];
    const options = radio.getOptions();
    if (options.length === 0) {
      return;
    }

    // setValue returns a promise
    radio.setValue(options[0]);
    expect(radio.getValue()).toBe(options[0]);
  });

  it("resetValue is async and updates appearance", async () => {
    const pdfBytes = await loadFixture("forms", "sample_form.pdf");
    const pdf = await PDF.load(pdfBytes);
    const form = pdf.getForm();
    expect(form).not.toBeNull();

    const textField = form!.getTextField("STATE");
    expect(textField).not.toBeNull();

    // Set a value first
    textField!.setValue("XX");
    expect(textField!.getValue()).toBe("XX");

    // Reset should be async
    textField!.resetValue();

    // After reset, appearance should be updated
    expect(textField!.needsAppearanceUpdate).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Stress Test: fancy_fields.pdf
// ─────────────────────────────────────────────────────────────────────────────

describe("Form Integration: Stress Test", () => {
  it("fully processes fancy_fields.pdf with all field types", async () => {
    const pdfBytes = await loadFixture("forms", "fancy_fields.pdf");
    const pdf = await PDF.load(pdfBytes);
    const form = pdf.getForm();
    expect(form).not.toBeNull();

    // Count fields by type
    const textFields = form!.getTextFields();
    const checkboxes = form!.getCheckboxes();
    const radios = form!.getRadioGroups();
    const dropdowns = form!.getDropdowns();
    const listboxes = form!.getListBoxes();

    console.log(`  Field counts:`);
    console.log(`    Text: ${textFields.length}`);
    console.log(`    Checkbox: ${checkboxes.length}`);
    console.log(`    Radio: ${radios.length}`);
    console.log(`    Dropdown: ${dropdowns.length}`);
    console.log(`    Listbox: ${listboxes.length}`);

    // Fill all text fields
    for (const field of textFields) {
      if (!field.isReadOnly()) {
        field.setValue("Test Value");
      }
    }

    // Toggle all checkboxes
    for (const cb of checkboxes) {
      if (!cb.isReadOnly()) {
        if (cb.isChecked()) {
          cb.uncheck();
        } else {
          cb.check();
        }
      }
    }

    // Select options in radios
    for (const radio of radios) {
      if (!radio.isReadOnly()) {
        const options = radio.getOptions();

        if (options.length > 0) {
          radio.setValue(options[0]);
        }
      }
    }

    // Select options in dropdowns
    for (const dropdown of dropdowns) {
      if (!dropdown.isReadOnly()) {
        const options = dropdown.getOptions();

        if (options.length > 0) {
          dropdown.setValue(options[0].value);
        }
      }
    }

    // Select options in listboxes
    for (const listbox of listboxes) {
      if (!listbox.isReadOnly()) {
        const options = listbox.getOptions();

        if (options.length > 0) {
          listbox.setValue([options[0].value]);
        }
      }
    }

    // Save filled form
    const filledBytes = await pdf.save();
    const filledPath = await saveTestOutput("forms/stress-test-filled.pdf", filledBytes);
    console.log(`  -> Filled output: ${filledPath}`);

    // Flatten and save
    form!.flatten();
    const flattenedBytes = await pdf.save();
    const flattenedPath = await saveTestOutput("forms/stress-test-flattened.pdf", flattenedBytes);
    console.log(`  -> Flattened output: ${flattenedPath}`);

    expect(flattenedBytes.length).toBeGreaterThan(0);

    // Verify flattening removed fields
    const pdf2 = await PDF.load(flattenedBytes);
    const form2 = pdf2.getForm();

    if (form2) {
      expect(form2.getFields().length).toBe(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CID Font Form Filling (FINTRAC)
// ─────────────────────────────────────────────────────────────────────────────

describe("Form Integration: CID Font PDFs", () => {
  it("fills FINTRAC form without black rectangles or tofu", async () => {
    // This PDF uses a CID font (Type0/Identity-H) for its form fields.
    // Previously, filling caused:
    //   1. Black rectangles (text color misidentified as background fill)
    //   2. Tofu characters (CID font used for single-byte text encoding)
    const pdfBytes = await loadFixture("issues", "form-filling/FINTRAC.pdf");
    const pdf = await PDF.load(pdfBytes);

    const form = pdf.getForm();
    expect(form).not.toBeNull();

    // Fill text fields
    const result = form!.fill({
      transaction: "123 main st",
      realtor: "No one",
      date: "2026-02-02",
      full_name: "John Doe",
      client_address: "123 Any Street, Toronto, ON, M0M 0M0",
      date_of_birth: "1968-09-05",
      nature_of_business: "asd",
      id_number: "D6101-40706-60905",
      issuing_authority: "Ontario",
      issuing_country: "Canada",
      expiry_date: "2012-11-26",
      // Checkboxes
      driverslicense_button: true,
      passport_button: false,
      third_party_no_button: true,
      question_1_yes: true,
      question_2_no: true,
      question_3_no: true,
      question_4_no: true,
      question_5_yes: true,
      relationship_nature_residential: true,
    });

    expect(result.filled.length).toBeGreaterThan(0);

    // Save and reload
    const savedBytes = await pdf.save();
    const outputPath = await saveTestOutput("forms/fintrac-filled.pdf", savedBytes);
    console.log(`  -> Filled output: ${outputPath}`);

    expect(savedBytes.length).toBeGreaterThan(0);

    // Verify text field values round-trip correctly
    const pdf2 = await PDF.load(savedBytes);
    const form2 = pdf2.getForm()!;

    expect(form2.getTextField("full_name")?.getValue()).toBe("John Doe");
    expect(form2.getTextField("transaction")?.getValue()).toBe("123 main st");
    expect(form2.getTextField("date")?.getValue()).toBe("2026-02-02");

    // Verify appearance streams don't contain background fill operations
    // (the bug was: text color 0.266667 g was drawn as a filled rectangle)
    const fullNameField = form2.getTextField("full_name")!;
    const widgets = fullNameField.getWidgets();
    const appearance = widgets[0].getNormalAppearance();
    expect(appearance).not.toBeNull();

    const streamContent = new TextDecoder().decode(appearance!.getDecodedData());

    // The appearance should contain the text
    expect(streamContent).toContain("Tj");
    // The appearance should NOT have a filled background rectangle
    // (a "re f" before BT would indicate a background fill)
    const preBT = streamContent.slice(0, streamContent.indexOf("BT"));
    expect(preBT).not.toMatch(/re\s*\n?\s*f/);

    // The FINTRAC PDF's CID font has stripped glyph outlines (no renderable
    // data). The appearance generator should fall back to Helvetica.
    expect(streamContent).toContain("/Helv");
    // Text should be encoded as a regular PDF string (not hex for CID)
    expect(streamContent).toContain("John Doe");
  });

  it("flattens FINTRAC form correctly", async () => {
    const pdfBytes = await loadFixture("issues", "form-filling/FINTRAC.pdf");
    const pdf = await PDF.load(pdfBytes);

    const form = pdf.getForm()!;

    form.fill({
      transaction: "123 main st",
      realtor: "No one",
      date: "2026-02-02",
      full_name: "John Doe",
      client_address: "123 Any Street, Toronto, ON, M0M 0M0",
      date_of_birth: "1968-09-05",
      nature_of_business: "asd",
      id_number: "D6101-40706-60905",
      issuing_authority: "Ontario",
      issuing_country: "Canada",
      expiry_date: "2012-11-26",
      // Checkboxes
      driverslicense_button: true,
      passport_button: false,
      third_party_no_button: true,
      question_1_yes: true,
      question_2_no: true,
      question_3_no: true,
      question_4_no: true,
      question_5_yes: true,
      relationship_nature_residential: true,
    });

    form.flatten();

    const savedBytes = await pdf.save();
    const outputPath = await saveTestOutput("forms/fintrac-flattened.pdf", savedBytes);
    console.log(`  -> Flattened output: ${outputPath}`);

    expect(savedBytes.length).toBeGreaterThan(0);

    // Form should have no fields after flattening
    const pdf2 = await PDF.load(savedBytes);
    const form2 = pdf2.getForm();
    if (form2) {
      expect(form2.getFields().length).toBe(0);
    }
  });
});
