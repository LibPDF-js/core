/**
 * Regression test: drawPage / embedPage loses existing page content
 * when the page's Resources/XObject subdictionary is an indirect reference.
 *
 * The bug: `addXObjectResource` and `registerResource` in PDFPage called
 * `resources.get("XObject")` without passing a resolver. When the XObject
 * entry was a PdfRef (indirect object), the check `!(xobjects instanceof PdfDict)`
 * evaluated to true, causing the method to create a brand-new empty PdfDict
 * and overwrite the existing XObject dictionary. This silently dropped all
 * pre-existing XObject entries (images, form XObjects, etc.), making the
 * original page content invisible.
 *
 * PDFs produced by scanners (e.g. Konica Minolta) commonly use this structure:
 * the page content is a single `Do` operator referencing an Image XObject,
 * and the Resources/XObject dict is stored as an indirect object.
 *
 * The fixture `scenarios/indirect-xobject-resources.pdf` has a page whose
 * /Resources /XObject is an indirect PdfRef pointing to a dict with an
 * existing Form XObject (`Fm0`) that renders the visible page content.
 */

import { PDF } from "#src/api/pdf";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfRef } from "#src/objects/pdf-ref";
import { loadFixture, saveTestOutput } from "#src/test-utils";
import { describe, expect, it } from "vitest";

describe("drawPage with indirect XObject resources", () => {
  it("preserves existing XObject entries when Resources/XObject is an indirect ref", async () => {
    const pdfBytes = await loadFixture("scenarios", "indirect-xobject-resources.pdf");
    const pdf = await PDF.load(pdfBytes);
    const page = pdf.getPage(0)!;

    const resolve = (ref: PdfRef) => pdf.getObject(ref);
    const resources = page.getResources();

    // Precondition: the XObject subdict is an indirect reference
    const xobjectsRaw = resources.get("XObject");
    expect(xobjectsRaw).toBeInstanceOf(PdfRef);

    // Precondition: it resolves to a dict containing the original XObject
    const xobjectsBefore = resources.get("XObject", resolve) as PdfDict;
    expect(xobjectsBefore).toBeInstanceOf(PdfDict);

    const originalKeys = [...xobjectsBefore.keys()].map(k => k.value);
    expect(originalKeys).toContain("Fm0");

    // embedPage + drawPage (the Documenso overlay pattern)
    const overlayPdf = PDF.create();
    const overlayPage = overlayPdf.addPage({ width: page.width, height: page.height });

    overlayPage.drawText("OVERLAY", {
      x: 100,
      y: 100,
      size: 20,
      color: { type: "RGB", red: 0, green: 0, blue: 0 },
    });

    const overlayDoc = await PDF.load(await overlayPdf.save());
    const embedded = await pdf.embedPage(overlayDoc, 0);

    page.drawPage(embedded, { x: 0, y: 0 });

    // The XObject dict must still contain the original entry
    const xobjectsAfter = resources.get("XObject", resolve) as PdfDict;

    expect(xobjectsAfter).toBeInstanceOf(PdfDict);
    expect(xobjectsAfter.has("Fm0")).toBe(true);

    // And also the newly added form XObject (Fm1 since Fm0 is taken)
    const afterKeys = [...xobjectsAfter.keys()].map(k => k.value);
    expect(afterKeys.length).toBeGreaterThan(originalKeys.length);

    // Save, reload, verify content survives round-trip
    const savedBytes = await pdf.save({ useXRefStream: true });

    await saveTestOutput("issues/drawpage-indirect-xobject.pdf", savedBytes);

    const reloaded = await PDF.load(savedBytes);
    const reloadedPage = reloaded.getPage(0)!;
    const reloadedResolve = (ref: PdfRef) => reloaded.getObject(ref);
    const reloadedXObjects = reloadedPage.getResources().get("XObject", reloadedResolve) as PdfDict;

    expect(reloadedXObjects).toBeInstanceOf(PdfDict);

    // Original XObject must still be there
    expect(reloadedXObjects.has("Fm0")).toBe(true);
  });

  it("preserves content through the full flatten + embed + flatten flow", async () => {
    const pdfBytes = await loadFixture("scenarios", "indirect-xobject-resources.pdf");
    const pdf = await PDF.load(pdfBytes);
    const page = pdf.getPage(0)!;

    // Step 1: flattenAll (like Documenso does before signing)
    pdf.flattenAll();

    // Step 2: embed + draw overlay
    const overlayPdf = PDF.create();
    const overlayPage = overlayPdf.addPage({ width: page.width, height: page.height });

    overlayPage.drawRectangle({
      x: 50,
      y: 50,
      width: 200,
      height: 40,
      color: { type: "RGB", red: 0.9, green: 0.9, blue: 1 },
      borderColor: { type: "RGB", red: 0, green: 0, blue: 0.5 },
      borderWidth: 1,
    });

    const overlayDoc = await PDF.load(await overlayPdf.save());
    const embedded = await pdf.embedPage(overlayDoc, 0);

    page.drawPage(embedded, { x: 0, y: 0 });

    // Step 3: flattenAll again
    pdf.flattenAll();

    // Step 4: Save with xref stream
    const savedBytes = await pdf.save({ useXRefStream: true });

    await saveTestOutput("issues/drawpage-indirect-xobject-full-flow.pdf", savedBytes);

    // The file should not have lost the original XObject data.
    // Before the fix, the file shrank dramatically because the original
    // Form XObject (the entire visible page content) was silently dropped.
    expect(savedBytes.length).toBeGreaterThan(pdfBytes.length * 0.5);

    // Reload and verify original XObject is still present
    const reloaded = await PDF.load(savedBytes);

    const reloadedPage = reloaded.getPage(0)!;
    const resolve = (ref: PdfRef) => reloaded.getObject(ref);
    const xobjects = reloadedPage.getResources().get("XObject", resolve) as PdfDict;

    expect(xobjects).toBeInstanceOf(PdfDict);

    const keys = [...xobjects.keys()].map(k => k.value);

    expect(keys).toContain("Fm0");
    expect(keys.length).toBeGreaterThanOrEqual(2);
  });
});
