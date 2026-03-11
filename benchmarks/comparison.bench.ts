/**
 * Library comparison benchmarks.
 *
 * Compares @libpdf/core against pdf-lib and @cantoo/pdf-lib for overlapping operations.
 * Results are machine-dependent and should be used for relative comparison only.
 */

import { PDFDocument as CantooPDFDocument } from "@cantoo/pdf-lib";
import { PDFDocument } from "pdf-lib";
import { bench, describe } from "vitest";

import { PDF } from "../src";
import {
  fintracPdfPath,
  getHeavyPdf,
  getSynthetic100,
  getSynthetic2000,
  loadFixture,
} from "./fixtures";

// Pre-load fixtures
const pdfBytes = await getHeavyPdf();
const synthetic100 = await getSynthetic100();
const synthetic2000 = await getSynthetic2000();
const fintracBytes = await loadFixture(fintracPdfPath);

describe("Load PDF", () => {
  bench("libpdf", async () => {
    await PDF.load(pdfBytes);
  });

  bench("pdf-lib", async () => {
    await PDFDocument.load(pdfBytes);
  });

  bench("@cantoo/pdf-lib", async () => {
    await CantooPDFDocument.load(pdfBytes);
  });
});

describe("Create blank PDF", () => {
  bench("libpdf", async () => {
    const pdf = PDF.create();
    await pdf.save();
  });

  bench("pdf-lib", async () => {
    const pdf = await PDFDocument.create();
    await pdf.save();
  });

  bench("@cantoo/pdf-lib", async () => {
    const pdf = await CantooPDFDocument.create();
    await pdf.save();
  });
});

describe("Add 10 pages", () => {
  bench("libpdf", async () => {
    const pdf = PDF.create();

    for (let i = 0; i < 10; i++) {
      pdf.addPage();
    }

    await pdf.save();
  });

  bench("pdf-lib", async () => {
    const pdf = await PDFDocument.create();

    for (let i = 0; i < 10; i++) {
      pdf.addPage();
    }

    await pdf.save();
  });

  bench("@cantoo/pdf-lib", async () => {
    const pdf = await CantooPDFDocument.create();

    for (let i = 0; i < 10; i++) {
      pdf.addPage();
    }

    await pdf.save();
  });
});

describe("Draw 50 rectangles", () => {
  bench("libpdf", async () => {
    const pdf = PDF.create();
    const page = pdf.addPage();

    for (let i = 0; i < 50; i++) {
      page.drawRectangle({
        x: 50 + (i % 5) * 100,
        y: 50 + Math.floor(i / 5) * 70,
        width: 80,
        height: 50,
      });
    }

    await pdf.save();
  });

  bench("pdf-lib", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage();

    for (let i = 0; i < 50; i++) {
      page.drawRectangle({
        x: 50 + (i % 5) * 100,
        y: 50 + Math.floor(i / 5) * 70,
        width: 80,
        height: 50,
      });
    }

    await pdf.save();
  });

  bench("@cantoo/pdf-lib", async () => {
    const pdf = await CantooPDFDocument.create();
    const page = pdf.addPage();

    for (let i = 0; i < 50; i++) {
      page.drawRectangle({
        x: 50 + (i % 5) * 100,
        y: 50 + Math.floor(i / 5) * 70,
        width: 80,
        height: 50,
      });
    }

    await pdf.save();
  });
});

describe("Load and save PDF", () => {
  bench("libpdf", async () => {
    const pdf = await PDF.load(pdfBytes);
    await pdf.save();
  });

  bench("pdf-lib", async () => {
    const pdf = await PDFDocument.load(pdfBytes);
    await pdf.save();
  });

  bench("@cantoo/pdf-lib", async () => {
    const pdf = await CantooPDFDocument.load(pdfBytes);
    await pdf.save();
  });
});

describe("Load, modify, and save PDF", () => {
  bench("libpdf", async () => {
    const pdf = await PDF.load(pdfBytes);
    const page = pdf.getPage(0)!;
    page.drawRectangle({ x: 50, y: 50, width: 100, height: 100 });
    await pdf.save();
  });

  bench("pdf-lib", async () => {
    const pdf = await PDFDocument.load(pdfBytes);
    const page = pdf.getPage(0);
    page.drawRectangle({ x: 50, y: 50, width: 100, height: 100 });
    await pdf.save();
  });

  bench("@cantoo/pdf-lib", async () => {
    const pdf = await CantooPDFDocument.load(pdfBytes);
    const page = pdf.getPage(0);
    page.drawRectangle({ x: 50, y: 50, width: 100, height: 100 });
    await pdf.save();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Page splitting comparison (issue #26)
// ─────────────────────────────────────────────────────────────────────────────

describe("Extract single page from 100-page PDF", () => {
  bench("libpdf", async () => {
    const pdf = await PDF.load(synthetic100);
    const extracted = await pdf.extractPages([0]);
    await extracted.save();
  });

  bench("pdf-lib", async () => {
    const pdf = await PDFDocument.load(synthetic100);
    const newDoc = await PDFDocument.create();
    const [page] = await newDoc.copyPages(pdf, [0]);
    newDoc.addPage(page);
    await newDoc.save();
  });

  bench("@cantoo/pdf-lib", async () => {
    const pdf = await CantooPDFDocument.load(synthetic100);
    const newDoc = await CantooPDFDocument.create();
    const [page] = await newDoc.copyPages(pdf, [0]);
    newDoc.addPage(page);
    await newDoc.save();
  });
});

describe("Split 100-page PDF into single-page PDFs", () => {
  bench(
    "libpdf",
    async () => {
      const pdf = await PDF.load(synthetic100);
      const pageCount = pdf.getPageCount();

      for (let i = 0; i < pageCount; i++) {
        const single = await pdf.extractPages([i]);
        await single.save();
      }
    },
    { warmupIterations: 1, iterations: 3 },
  );

  bench(
    "pdf-lib",
    async () => {
      const pdf = await PDFDocument.load(synthetic100);
      const pageCount = pdf.getPageCount();

      for (let i = 0; i < pageCount; i++) {
        const newDoc = await PDFDocument.create();
        const [page] = await newDoc.copyPages(pdf, [i]);
        newDoc.addPage(page);
        await newDoc.save();
      }
    },
    { warmupIterations: 1, iterations: 3 },
  );

  bench(
    "@cantoo/pdf-lib",
    async () => {
      const pdf = await CantooPDFDocument.load(synthetic100);
      const pageCount = pdf.getPageCount();

      for (let i = 0; i < pageCount; i++) {
        const newDoc = await CantooPDFDocument.create();
        const [page] = await newDoc.copyPages(pdf, [i]);
        newDoc.addPage(page);
        await newDoc.save();
      }
    },
    { warmupIterations: 1, iterations: 3 },
  );
});

describe(`Split 2000-page PDF into single-page PDFs (${(synthetic2000.length / 1024 / 1024).toFixed(1)}MB)`, () => {
  bench(
    "libpdf",
    async () => {
      const pdf = await PDF.load(synthetic2000);
      const pageCount = pdf.getPageCount();

      for (let i = 0; i < pageCount; i++) {
        const single = await pdf.extractPages([i]);
        await single.save();
      }
    },
    { warmupIterations: 0, iterations: 1, time: 0 },
  );

  bench(
    "pdf-lib",
    async () => {
      const pdf = await PDFDocument.load(synthetic2000);
      const pageCount = pdf.getPageCount();

      for (let i = 0; i < pageCount; i++) {
        const newDoc = await PDFDocument.create();
        const [page] = await newDoc.copyPages(pdf, [i]);
        newDoc.addPage(page);
        await newDoc.save();
      }
    },
    { warmupIterations: 0, iterations: 1, time: 0 },
  );

  bench(
    "@cantoo/pdf-lib",
    async () => {
      const pdf = await CantooPDFDocument.load(synthetic2000);
      const pageCount = pdf.getPageCount();

      for (let i = 0; i < pageCount; i++) {
        const newDoc = await CantooPDFDocument.create();
        const [page] = await newDoc.copyPages(pdf, [i]);
        newDoc.addPage(page);
        await newDoc.save();
      }
    },
    { warmupIterations: 0, iterations: 1, time: 0 },
  );
});

describe("Copy 10 pages between documents", () => {
  bench("libpdf", async () => {
    const source = await PDF.load(synthetic100);
    const dest = PDF.create();
    const indices = Array.from({ length: 10 }, (_, i) => i);
    await dest.copyPagesFrom(source, indices);
    await dest.save();
  });

  bench("pdf-lib", async () => {
    const source = await PDFDocument.load(synthetic100);
    const dest = await PDFDocument.create();
    const indices = Array.from({ length: 10 }, (_, i) => i);
    const pages = await dest.copyPages(source, indices);

    for (const page of pages) {
      dest.addPage(page);
    }

    await dest.save();
  });

  bench("@cantoo/pdf-lib", async () => {
    const source = await CantooPDFDocument.load(synthetic100);
    const dest = await CantooPDFDocument.create();
    const indices = Array.from({ length: 10 }, (_, i) => i);
    const pages = await dest.copyPages(source, indices);

    for (const page of pages) {
      dest.addPage(page);
    }

    await dest.save();
  });
});

describe("Merge 2 x 100-page PDFs", () => {
  bench(
    "libpdf",
    async () => {
      const merged = await PDF.merge([synthetic100, synthetic100]);
      await merged.save();
    },
    { warmupIterations: 1, iterations: 3 },
  );

  bench(
    "pdf-lib",
    async () => {
      const doc1 = await PDFDocument.load(synthetic100);
      const doc2 = await PDFDocument.load(synthetic100);
      const merged = await PDFDocument.create();

      const pages1 = await merged.copyPages(doc1, doc1.getPageIndices());

      for (const page of pages1) {
        merged.addPage(page);
      }

      const pages2 = await merged.copyPages(doc2, doc2.getPageIndices());

      for (const page of pages2) {
        merged.addPage(page);
      }

      await merged.save();
    },
    { warmupIterations: 1, iterations: 3 },
  );

  bench(
    "@cantoo/pdf-lib",
    async () => {
      const doc1 = await CantooPDFDocument.load(synthetic100);
      const doc2 = await CantooPDFDocument.load(synthetic100);
      const merged = await CantooPDFDocument.create();

      const pages1 = await merged.copyPages(doc1, doc1.getPageIndices());

      for (const page of pages1) {
        merged.addPage(page);
      }

      const pages2 = await merged.copyPages(doc2, doc2.getPageIndices());

      for (const page of pages2) {
        merged.addPage(page);
      }

      await merged.save();
    },
    { warmupIterations: 1, iterations: 3 },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Form filling comparison (FINTRAC - CID font PDF with stripped glyph outlines)
//
// This PDF uses a Type0/Identity-H CID font whose glyph outlines have been
// stripped, forcing the appearance generator to fall back to Helvetica.
// ─────────────────────────────────────────────────────────────────────────────

/** Field values used for the FINTRAC form. */
const fintracFields = {
  transaction: "123 main st",
  realtor: "No one",
  date: "2026-02-02",
  full_name: "John Doe",
  client_address: "123 Any Street, Toronto, ON, M0M 0M0",
  date_of_birth: "1968-09-05",
  nature_of_business: "Software Development",
  id_number: "D6101-40706-60905",
  issuing_authority: "Ontario",
  issuing_country: "Canada",
  expiry_date: "2012-11-26",
};

/** Checkbox fields for the FINTRAC form. */
const fintracCheckboxes = {
  driverslicense_button: true,
  passport_button: false,
  third_party_no_button: true,
  question_1_yes: true,
  question_2_no: true,
  question_3_no: true,
  question_4_no: true,
  question_5_yes: true,
  relationship_nature_residential: true,
};

describe("Fill FINTRAC form fields", () => {
  bench("libpdf", async () => {
    const pdf = await PDF.load(fintracBytes);
    const form = pdf.getForm()!;

    form.fill({
      ...fintracFields,
      ...fintracCheckboxes,
    });

    await pdf.save();
  });

  bench("pdf-lib", async () => {
    const pdf = await PDFDocument.load(fintracBytes);
    const form = pdf.getForm();

    for (const [name, value] of Object.entries(fintracFields)) {
      form.getTextField(name).setText(value);
    }

    for (const [name, value] of Object.entries(fintracCheckboxes)) {
      const cb = form.getCheckBox(name);

      if (value) {
        cb.check();
      } else {
        cb.uncheck();
      }
    }

    await pdf.save();
  });

  bench("@cantoo/pdf-lib", async () => {
    const pdf = await CantooPDFDocument.load(fintracBytes);
    const form = pdf.getForm();

    for (const [name, value] of Object.entries(fintracFields)) {
      form.getTextField(name).setText(value);
    }

    for (const [name, value] of Object.entries(fintracCheckboxes)) {
      const cb = form.getCheckBox(name);

      if (value) {
        cb.check();
      } else {
        cb.uncheck();
      }
    }

    await pdf.save();
  });
});

// NOTE: pdf-lib and @cantoo/pdf-lib log errors to stderr during flatten on this
// PDF because they can't resolve widget page refs. The benchmarks still complete
// and produce valid timing data — the noise is expected.
describe("Fill and flatten FINTRAC form", () => {
  bench("libpdf", async () => {
    const pdf = await PDF.load(fintracBytes);
    const form = pdf.getForm()!;

    form.fill({
      ...fintracFields,
      ...fintracCheckboxes,
    });

    form.flatten();
    await pdf.save();
  });

  bench("pdf-lib", async () => {
    const pdf = await PDFDocument.load(fintracBytes);
    const form = pdf.getForm();

    for (const [name, value] of Object.entries(fintracFields)) {
      form.getTextField(name).setText(value);
    }

    for (const [name, value] of Object.entries(fintracCheckboxes)) {
      const cb = form.getCheckBox(name);

      if (value) {
        cb.check();
      } else {
        cb.uncheck();
      }
    }

    form.flatten();
    await pdf.save();
  });

  bench("@cantoo/pdf-lib", async () => {
    const pdf = await CantooPDFDocument.load(fintracBytes);
    const form = pdf.getForm();

    for (const [name, value] of Object.entries(fintracFields)) {
      form.getTextField(name).setText(value);
    }

    for (const [name, value] of Object.entries(fintracCheckboxes)) {
      const cb = form.getCheckBox(name);

      if (value) {
        cb.check();
      } else {
        cb.uncheck();
      }
    }

    form.flatten();
    await pdf.save();
  });
});
