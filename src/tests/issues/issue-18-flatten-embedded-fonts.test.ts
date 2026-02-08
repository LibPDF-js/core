/**
 * Regression test for issue #18:
 * "Form flatten with embedded fonts produces empty/incorrect output"
 *
 * The bug: appearance streams referenced incomplete stub font dicts
 * (missing DescendantFonts, ToUnicode, FontDescriptor, font data).
 * After flattening, viewers couldn't render the glyph IDs.
 *
 * The fix: EmbeddedFont stores its pre-allocated PdfRef (set by
 * PDFFonts.embed), so appearance streams reference the complete
 * font object that gets built at save time.
 *
 * @see https://github.com/LibPDF-js/core/issues/18
 */

import { PDF } from "#src/api/pdf";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfStream } from "#src/objects/pdf-stream";
import { loadFixture, saveTestOutput } from "#src/test-utils";
import { describe, expect, it } from "vitest";

describe("Issue #18: Flatten with embedded fonts", () => {
  it("produces complete font objects after flatten + save", async () => {
    // Set up: embed DejaVu Sans, fill fields with diacritics, flatten, save
    const pdf = await PDF.load(await loadFixture("forms", "sample_form.pdf"));
    const font = pdf.embedFont(await loadFixture("fonts", "ttf/DejaVuSans.ttf"));
    const form = pdf.getForm()!;

    const acroForm = form.acroForm();
    acroForm.setDefaultFont(font);
    acroForm.setDefaultFontSize(12);

    const textFields = form.getTextFields().filter(f => !f.isReadOnly());
    textFields[0]?.setValue("Ján Novák");
    textFields[1]?.setValue("Žilina");
    textFields[2]?.setValue("čšťňľ áéíóú");

    // Save control (no flatten) for visual comparison
    const controlPath = await saveTestOutput("issues/issue-18-no-flatten.pdf", await pdf.save());
    console.log(`  -> Control (no flatten): ${controlPath}`);

    // Flatten and save
    form.flatten();
    const savedBytes = await pdf.save();
    const flattenedPath = await saveTestOutput("issues/issue-18-flattened.pdf", savedBytes);
    console.log(`  -> Flattened: ${flattenedPath}`);

    // Reload and find Type0 fonts in the flattened XObjects
    const reloaded = await PDF.load(savedBytes);
    const resolve = (ref: PdfRef) => reloaded.getObject(ref);
    const page = reloaded.getPage(0)!;
    const xobjects = page.getResources().getDict("XObject", resolve);
    expect(xobjects).toBeDefined();

    const type0Fonts = findType0Fonts(xobjects!, resolve);
    expect(type0Fonts.length).toBeGreaterThan(0);

    // Each Type0 font must have DescendantFonts and ToUnicode —
    // these were missing in the bug (stub dict only had Type/Subtype/BaseFont/Encoding)
    for (const fontDict of type0Fonts) {
      expect(fontDict.get("DescendantFonts", resolve)).toBeDefined();
      expect(fontDict.get("ToUnicode", resolve)).toBeDefined();
    }
  });
});

type Resolve = (ref: PdfRef) => ReturnType<PDF["getObject"]>;

/**
 * Walk FlatField XObjects and collect their Type0 font dicts.
 */
function findType0Fonts(xobjects: PdfDict, resolve: Resolve): PdfDict[] {
  const results: PdfDict[] = [];

  for (const [key, value] of xobjects) {
    if (!key.value.startsWith("FlatField")) {
      continue;
    }

    const xobj = value instanceof PdfRef ? resolve(value) : value;

    if (!(xobj instanceof PdfStream)) {
      continue;
    }

    const fonts = xobj.getDict("Resources", resolve)?.getDict("Font", resolve);

    if (!fonts) {
      continue;
    }

    for (const [, fontValue] of fonts) {
      const fontObj = fontValue instanceof PdfRef ? resolve(fontValue) : fontValue;

      if (!(fontObj instanceof PdfDict)) {
        continue;
      }

      if (fontObj.getName("Subtype", resolve)?.value === "Type0") {
        results.push(fontObj);
      }
    }
  }

  return results;
}
