/**
 * PDF form benchmarks.
 *
 * Tests performance of form operations.
 */

import { bench } from "vitest";

import { PDF } from "../src";
import { formPdfPath, loadFixture } from "./fixtures";

// Pre-load fixture
const formPdf = await loadFixture(formPdfPath);

bench("get form fields", async () => {
  const pdf = await PDF.load(formPdf);
  const form = pdf.getForm();
  form?.getFields();
});

bench("fill text fields", async () => {
  const pdf = await PDF.load(formPdf);
  const form = pdf.getForm();

  if (form) {
    const fields = form.getFields();

    for (const field of fields) {
      if (field.type === "text") {
        form.getTextField(field.name)?.setValue("Test Value");
      }
    }
  }

  await pdf.save();
});

bench("read field values", async () => {
  const pdf = await PDF.load(formPdf);
  const form = pdf.getForm();

  if (form) {
    const fields = form.getFields();

    for (const field of fields) {
      if (field.type === "text") {
        form.getTextField(field.name)?.getValue();
      }
    }
  }
});

bench("flatten form", async () => {
  const pdf = await PDF.load(formPdf);
  const form = pdf.getForm();
  form?.flatten();
  await pdf.save();
});
