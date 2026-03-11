/**
 * Test script to render a PDF in the browser using puppeteer and capture a screenshot.
 *
 * Usage: bun scripts/test-browser-render.ts <pdf-path> [output-path]
 */

import { readFileSync, mkdirSync } from "fs";
import puppeteer from "puppeteer";

async function main() {
  const pdfPath =
    process.argv[2] || "/Users/bond/Documents/invoice-INV_c54ef828ead454de0ba11244.pdf";
  const outputPath = process.argv[3] || "test-output/browser-render.png";

  console.log(`Testing PDF: ${pdfPath}`);

  // Ensure output directory exists
  mkdirSync("test-output", { recursive: true });

  // Read PDF file
  const pdfBytes = readFileSync(pdfPath);
  const base64Pdf = pdfBytes.toString("base64");

  // Launch browser
  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  // Set viewport size
  await page.setViewport({ width: 1200, height: 1600 });

  // Navigate to demo (port 3001)
  console.log("Loading demo page...");
  await page.goto("http://localhost:3001", { waitUntil: "networkidle0" });

  // Wait for the page to be ready
  await page.waitForSelector("#file-input", { timeout: 10000 });

  // Inject the PDF file using JavaScript
  console.log("Injecting PDF file...");
  await page.evaluate(async (base64Data: string) => {
    // Convert base64 to blob
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "application/pdf" });
    const file = new File([blob], "test.pdf", { type: "application/pdf" });

    // Create a DataTransfer to simulate file input
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

    // Set the file input
    const fileInput = document.getElementById("file-input") as HTMLInputElement;
    fileInput.files = dataTransfer.files;

    // Trigger change event
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
  }, base64Pdf);

  // Wait for rendering to complete
  console.log("Waiting for PDF to render...");
  await page.waitForSelector(".page-container canvas", { timeout: 30000 });

  // Wait a bit more for full rendering
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Take screenshot of the viewer area
  console.log("Taking screenshot...");
  const viewer = await page.$("#viewer");
  if (viewer) {
    await viewer.screenshot({ path: outputPath });
    console.log(`Screenshot saved to: ${outputPath}`);
  } else {
    console.error("Could not find viewer element");
    await page.screenshot({ path: outputPath, fullPage: true });
  }

  await browser.close();
  console.log("Done!");
}

main().catch(console.error);
