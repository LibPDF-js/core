import { readFileSync } from "fs";

import { PDF } from "../src";
import type { CompositeFont } from "../src/fonts/composite-font";

async function main() {
  const pdfPath = "/Users/bond/Documents/invoice-INV_c54ef828ead454de0ba11244.pdf";
  const pdfBytes = readFileSync(pdfPath);
  const pdf = await PDF.load(new Uint8Array(pdfBytes));

  const page = pdf.getPage(0);
  if (!page) {
    console.error("No page");
    return;
  }

  // Create font resolver
  const fontResolver = page.createFontResolver();
  const font = fontResolver("UWGIWA") as CompositeFont | null;

  if (font) {
    console.log("Font UWGIWA: " + font.constructor.name);
    const cidFont = font.getCIDFont?.();
    if (cidFont) {
      console.log("  CIDFont defaultWidth: " + cidFont.defaultWidth);

      // Check widths for the actual CIDs used in the PDF
      const testCids = [48, 82, 71, 72, 79, 29, 3, 47, 81, 44, 49, 57, 66, 70, 24, 23, 73, 27];
      console.log("\n  Width for actual CIDs used:");
      for (const cid of testCids) {
        console.log("    CID " + cid + ": " + cidFont.getWidth(cid));
      }
    }
  }
}

main().catch(console.error);
