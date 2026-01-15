/**
 * Example: Embed Page as XObject
 *
 * This example demonstrates embedding a page from another PDF as a
 * Form XObject, which can be reused across multiple pages.
 *
 * Run: npx tsx examples/11-advanced/embed-page-as-xobject.ts
 */

import { loadFixture } from "#src/test-utils.ts";

import { black, PDF, rgb } from "../../src/index";
import { formatBytes, saveOutput } from "../utils";

async function main() {
  console.log("Embedding page as reusable XObject...\n");

  console.log("=== What is a Form XObject? ===\n");

  console.log("A Form XObject is:");
  console.log("- A self-contained piece of PDF content");
  console.log("- Can be reused multiple times without duplication");
  console.log("- Perfect for watermarks, letterheads, stamps");
  console.log("- Has its own coordinate system and resources\n");

  // Create a "letterhead" template PDF
  console.log("=== Creating Letterhead Template ===\n");

  const templatePdf = PDF.create();
  templatePdf.addPage({ size: "letter" });
  const templatePage = await templatePdf.getPage(0);

  const liberationSansData = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
  const font = templatePdf.embedFont(liberationSansData);

  if (templatePage) {
    // Header area
    templatePage.drawRectangle({
      x: 0,
      y: templatePage.height - 100,
      width: templatePage.width,
      height: 100,
      color: rgb(0.1, 0.3, 0.6),
    });

    templatePage.drawText("ACME CORPORATION", {
      font,
      x: 50,
      y: templatePage.height - 50,
      size: 24,
      color: rgb(1, 1, 1),
    });

    templatePage.drawText("Innovation • Excellence • Trust", {
      font,
      x: 50,
      y: templatePage.height - 80,
      size: 12,
      color: rgb(0.8, 0.8, 0.9),
    });

    // Footer area
    templatePage.drawRectangle({
      x: 0,
      y: 0,
      width: templatePage.width,
      height: 50,
      color: rgb(0.9, 0.9, 0.9),
    });

    templatePage.drawText("123 Business Ave, Suite 100 • contact@acme.example", {
      font,
      x: 130,
      y: 20,
      size: 10,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  const templateBytes = await templatePdf.save({ subsetFonts: true });
  console.log(`Letterhead template: ${formatBytes(templateBytes.length)}`);

  // Create a watermark PDF
  console.log("\n=== Creating Watermark ===\n");

  const watermarkPdf = PDF.create();
  watermarkPdf.addPage({ size: "letter" });
  const watermarkPage = await watermarkPdf.getPage(0);

  if (watermarkPage) {
    // Draw diagonal "DRAFT" watermark
    watermarkPage.drawText("DRAFT", {
      x: 150,
      y: 350,
      size: 72,
      color: rgb(0.9, 0.9, 0.9),
      rotate: { angle: 45 },
      opacity: 0.5,
    });
  }

  const watermarkBytes = await watermarkPdf.save();
  console.log(`Watermark: ${formatBytes(watermarkBytes.length)}`);

  // Create a new document that uses the letterhead
  console.log("\n=== Creating Document with Embedded Templates ===\n");

  const doc = PDF.create();

  // Load the templates as PDFs first
  const letterheadDoc = await PDF.load(templateBytes);
  const watermarkDoc = await PDF.load(watermarkBytes);

  // Embed the letterhead as a Form XObject
  const letterhead = await doc.embedPage(letterheadDoc, 0);
  console.log(`Embedded letterhead: ${letterhead.width} x ${letterhead.height}`);

  // Embed the watermark as a Form XObject
  const watermark = await doc.embedPage(watermarkDoc, 0);
  console.log(`Embedded watermark: ${watermark.width} x ${watermark.height}`);

  // Create multiple pages using the same embedded templates
  for (let i = 1; i <= 3; i++) {
    doc.addPage({ size: "letter" });
    const page = await doc.getPage(i - 1);

    if (page) {
      // Draw letterhead as background (full page)
      page.drawPage(letterhead, {
        x: 0,
        y: 0,
      });

      // Draw watermark (could add rotation/opacity in real use)
      // page.drawPage(watermark, { opacity: 0.3 });

      // Add page content on top
      page.drawText(`Letter ${i}`, {
        x: 50,
        y: page.height - 150,
        size: 18,
        color: black,
      });

      page.drawText(`Dear Customer,`, {
        x: 50,
        y: page.height - 200,
        size: 12,
        color: black,
      });

      page.drawText(`This is page ${i} of our important document.`, {
        x: 50,
        y: page.height - 230,
        size: 12,
        color: black,
      });

      page.drawText(`The letterhead is reused on every page without`, {
        x: 50,
        y: page.height - 260,
        size: 12,
        color: black,
      });

      page.drawText(`duplicating the content in the PDF file.`, {
        x: 50,
        y: page.height - 290,
        size: 12,
        color: black,
      });

      page.drawText(`Page ${i}`, {
        x: 540,
        y: 20,
        size: 10,
        color: black,
      });
    }
  }

  // Save the final document
  const finalBytes = await doc.save();
  const outputPath = await saveOutput("11-advanced/with-letterhead.pdf", finalBytes);

  console.log(`\n=== Result ===`);
  console.log(`Output: ${outputPath}`);
  console.log(`Size: ${formatBytes(finalBytes.length)}`);
  console.log(`Pages: ${doc.getPageCount()}`);

  console.log("\n=== Benefits of Form XObjects ===\n");

  console.log("1. File size efficiency:");
  console.log("   - Template stored once, referenced multiple times");
  console.log("   - Much smaller than copying content to each page");
  console.log();
  console.log("2. Consistency:");
  console.log("   - Same template guaranteed on all pages");
  console.log("   - Easy to update by changing the source");
  console.log();
  console.log("3. Performance:");
  console.log("   - Viewers can cache the XObject");
  console.log("   - Faster rendering of repeated content");

  console.log("\n=== Common Use Cases ===\n");

  console.log("- Company letterhead");
  console.log("- Watermarks (DRAFT, CONFIDENTIAL)");
  console.log("- Page backgrounds");
  console.log("- Stamp overlays");
  console.log("- Certificate templates");
  console.log("- Report headers/footers");
}

main().catch(console.error);
