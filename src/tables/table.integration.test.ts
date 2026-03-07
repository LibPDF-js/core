import { PDF } from "#src/api/pdf";
import type { PDFPage } from "#src/api/pdf-page";
import { ContentStreamParser } from "#src/content/parsing/content-stream-parser";
import { grayscale } from "#src/helpers/colors";
import { saveTestOutput } from "#src/test-utils";
import { describe, expect, it } from "vitest";

async function saveTablePdf(name: string, bytes: Uint8Array) {
  await saveTestOutput(`tables/${name}.pdf`, bytes);
}

function getPageOperators(page: PDFPage): string[] {
  const contentBytes = (page as unknown as { getContentBytes(): Uint8Array }).getContentBytes();
  return new ContentStreamParser(contentBytes)
    .parse()
    .operations.map(operation => operation.operator);
}

function expectSingleMatch(page: PDFPage, text: string) {
  const matches = page.findText(text);
  expect(matches).toHaveLength(1);
  return matches[0];
}

function rightEdge(page: PDFPage, text: string) {
  const match = expectSingleMatch(page, text);
  return match.bbox.x + match.bbox.width;
}

function currency(value: number) {
  return `$${value.toFixed(2)}`;
}

describe("drawTable integration", () => {
  it("renders a single-page table and preserves text after save/reload", async () => {
    const pdf = PDF.create();
    const page = pdf.addPage({ size: "letter" });

    const result = pdf.drawTable(
      page,
      {
        columns: [
          { key: "name", width: 200 },
          { key: "value", width: "*" },
        ],
        head: [["Name", "Value"]],
        body: [
          ["Alpha", "100"],
          ["Beta", "200"],
          ["Gamma", "300"],
        ],
      },
      {
        bounds: { x: 48, y: 72, width: 516, height: 640 },
        style: { fontSize: 11, lineHeight: 14, padding: 6 },
        headStyle: { font: "Helvetica-Bold", fillColor: grayscale(0.85) },
      },
    );

    expect(result.usedPages).toHaveLength(1);
    expect(result.rowCountDrawn).toBe(3);
    expect(result.cursorY).toBeGreaterThanOrEqual(72);
    expect(result.cursorY).toBeLessThan(72 + 640);

    const bytes = await pdf.save();
    await saveTablePdf("simple-table", bytes);

    const reloaded = await PDF.load(bytes);
    expect(reloaded.getPageCount()).toBe(1);

    const text = reloaded.getPage(0)!.extractText().text;
    expect(text).toContain("Name");
    expect(text).toContain("Alpha");
    expect(text).toContain("Gamma");
    expect(text).toContain("300");
  });

  it("paginates an invoice table and draws the totals footer only on the last page", async () => {
    const pdf = PDF.create();
    const page = pdf.addPage({ size: "letter" });

    const items = Array.from({ length: 50 }, (_, i) => {
      const quantity = (i % 5) + 1;
      const price = 10 + i * 1.35;
      const total = quantity * price;
      return {
        sku: `SKU-${String(i + 1).padStart(4, "0")}`,
        description: `Product description for item ${i + 1} with a deterministic wrapping payload ${i + 11}`,
        quantity,
        price,
        total,
      };
    });

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const tax = subtotal * 0.08;
    const grandTotal = subtotal + tax;

    const result = pdf.drawTable(
      page,
      {
        columns: [
          { key: "sku", width: 72 },
          { key: "desc", width: "*" },
          { key: "qty", width: 40, align: "right" },
          { key: "price", width: 72, align: "right" },
          { key: "total", width: 72, align: "right" },
        ],
        head: [["SKU", "Description", "Qty", "Price", "Total"]],
        body: items.map(item => [
          item.sku,
          item.description,
          String(item.quantity),
          currency(item.price),
          currency(item.total),
        ]),
        foot: [
          { cells: { price: "Subtotal", total: currency(subtotal) } },
          { cells: { price: "Tax", total: currency(tax) } },
          { cells: { price: "Total", total: currency(grandTotal) } },
        ],
      },
      {
        bounds: { x: 48, y: 72, width: 516, height: 640 },
        headRepeat: "everyPage",
        footRepeat: "lastPage",
        style: { fontSize: 10, lineHeight: 13, padding: 5 },
        headStyle: {
          font: "Helvetica-Bold",
          fillColor: grayscale(0.9),
        },
        alternateRowStyle: { fillColor: grayscale(0.97) },
        outerBorderWidth: 1,
        innerBorderWidth: 0.5,
      },
    );

    expect(result.usedPages.length).toBeGreaterThan(1);
    expect(result.rowCountDrawn).toBe(items.length);

    const bytes = await pdf.save();
    await saveTablePdf("invoice-multi-page", bytes);

    const reloaded = await PDF.load(bytes);
    expect(reloaded.getPageCount()).toBe(result.usedPages.length);

    const pageTexts = Array.from(
      { length: reloaded.getPageCount() },
      (_, index) => reloaded.getPage(index)!.extractText().text,
    );

    for (const text of pageTexts) {
      expect(text).toContain("SKU Description Qty Price Total");
    }

    expect(pageTexts[0]).toContain("SKU-0001");
    expect(pageTexts.at(-1)!).toContain("SKU-0050");
    expect(pageTexts.at(-1)!).toContain("Subtotal");
    expect(pageTexts.at(-1)!).toContain(currency(grandTotal));

    for (const text of pageTexts.slice(0, -1)) {
      expect(text).not.toContain("Subtotal");
      expect(text).not.toContain(currency(grandTotal));
    }
  });

  it("omits border strokes when borders are disabled and still fills alternating rows", async () => {
    const pdf = PDF.create();
    const page = pdf.addPage({ size: "letter" });

    pdf.drawTable(
      page,
      {
        columns: [
          { key: "metric", width: "*" },
          { key: "value", width: 100, align: "right" },
        ],
        body: [
          ["Revenue", "$1,250,000"],
          ["Expenses", "$890,000"],
          ["Net Income", "$360,000"],
          ["Margin", "28.8%"],
        ],
      },
      {
        bounds: { x: 48, y: 500, width: 516, height: 200 },
        style: { fontSize: 11, lineHeight: 14, padding: 8 },
        alternateRowStyle: { fillColor: grayscale(0.95) },
        outerBorderWidth: 0,
        innerBorderWidth: 0,
      },
    );

    const bytes = await pdf.save();
    await saveTablePdf("borderless-alternating", bytes);

    const reloaded = await PDF.load(bytes);
    const operators = getPageOperators(reloaded.getPage(0)!);
    const strokeOperators = new Set(["S", "s", "B", "B*", "b", "b*"]);

    expect(operators.filter(operator => operator === "f")).toHaveLength(4);
    expect(operators.some(operator => strokeOperators.has(operator))).toBe(false);
  });

  it("keeps right-aligned numeric columns aligned by their right edge", async () => {
    const pdf = PDF.create();
    const page = pdf.addPage({ size: "letter" });

    pdf.drawTable(
      page,
      {
        columns: [
          { key: "country", width: "*" },
          { key: "pop", width: 100, align: "right" },
          { key: "gdp", width: 100, align: "right" },
        ],
        head: [["Country", "Population", "GDP (B)"]],
        body: [
          ["United States", "331,449,281", "$25,462"],
          ["China", "1,425,671,352", "$17,963"],
          ["Germany", "83,294,633", "$4,072"],
        ],
      },
      {
        bounds: { x: 48, y: 500, width: 400, height: 200 },
        style: { fontSize: 10, lineHeight: 13, padding: 5 },
        headStyle: { font: "Helvetica-Bold" },
        outerBorderWidth: 0.5,
        innerBorderWidth: 0.25,
      },
    );

    const bytes = await pdf.save();
    await saveTablePdf("right-aligned-numeric", bytes);

    const reloaded = await PDF.load(bytes);
    const reloadedPage = reloaded.getPage(0)!;

    const pop1 = expectSingleMatch(reloadedPage, "331,449,281");
    const pop2 = expectSingleMatch(reloadedPage, "1,425,671,352");
    const gdp1 = expectSingleMatch(reloadedPage, "$25,462");
    const gdp2 = expectSingleMatch(reloadedPage, "$4,072");

    expect(pop1.bbox.x).not.toBeCloseTo(pop2.bbox.x, 1);
    expect(gdp1.bbox.x).not.toBeCloseTo(gdp2.bbox.x, 1);
    expect(rightEdge(reloadedPage, "331,449,281")).toBeCloseTo(
      rightEdge(reloadedPage, "1,425,671,352"),
      1,
    );
    expect(rightEdge(reloadedPage, "$25,462")).toBeCloseTo(rightEdge(reloadedPage, "$4,072"), 1);
  });

  it("persists break-word wrapping for long tokens after save/reload", async () => {
    const pdf = PDF.create();
    const page = pdf.addPage({ size: "letter" });

    pdf.drawTable(
      page,
      {
        columns: [
          { key: "id", width: 80 },
          { key: "url", width: "*" },
        ],
        head: [["ID", "URL"]],
        body: [
          ["SKU-0001", "https://example.com/products/very-long-product-name-that-needs-wrapping"],
          ["ABCDEFGHIJKLMNOP", "https://a.co/d/verylongidentifierwithnospaces1234567890abcdef"],
          ["SHORT", "https://example.com"],
        ],
      },
      {
        bounds: { x: 48, y: 500, width: 400, height: 300 },
        style: { fontSize: 10, lineHeight: 13, padding: 5 },
        headStyle: { font: "Helvetica-Bold" },
      },
    );

    const bytes = await pdf.save();
    await saveTablePdf("break-word", bytes);

    const reloaded = await PDF.load(bytes);
    const lines = reloaded
      .getPage(0)!
      .extractText()
      .lines.map(line => line.text);

    expect(lines.length).toBeGreaterThan(4);
    expect(lines.some(line => line.includes("ABCDEFGHIJ"))).toBe(true);
    expect(lines).toContain("KLMNOP");
    expect(lines).toContain("pping");
  });

  it("renders sparse footer rows with only the addressed columns populated", async () => {
    const pdf = PDF.create();
    const page = pdf.addPage({ size: "letter" });

    pdf.drawTable(
      page,
      {
        columns: [
          { key: "item", width: 200 },
          { key: "qty", width: 60, align: "right" },
          { key: "price", width: 80, align: "right" },
          { key: "total", width: 80, align: "right" },
        ],
        head: [["Item", "Qty", "Price", "Total"]],
        body: [
          ["Widget A", "5", "$10.00", "$50.00"],
          ["Widget B", "3", "$25.00", "$75.00"],
        ],
        foot: [
          { cells: { price: "Subtotal:", total: "$125.00" } },
          { cells: { price: "Tax:", total: "$10.00" } },
          { cells: { price: "Total:", total: "$135.00" }, style: { font: "Helvetica-Bold" } },
        ],
      },
      {
        bounds: { x: 48, y: 400, width: 420, height: 300 },
        style: { fontSize: 10, lineHeight: 13, padding: 5 },
        headStyle: { font: "Helvetica-Bold", fillColor: grayscale(0.9) },
        footRepeat: "lastPage",
      },
    );

    const bytes = await pdf.save();
    await saveTablePdf("sparse-footer", bytes);

    const reloaded = await PDF.load(bytes);
    const text = reloaded.getPage(0)!.extractText().text;

    expect(text).toContain("Subtotal:");
    expect(text).toContain("$125.00");
    expect(text).toContain("Tax:");
    expect(text).toContain("$10.00");
    expect(text).toContain("Total:");
    expect(text).toContain("$135.00");
  });

  it("returns a cursorY that can be used to draw content after the table", async () => {
    const pdf = PDF.create();
    const page = pdf.addPage({ size: "letter" });

    const result = pdf.drawTable(
      page,
      {
        columns: [
          { key: "a", width: "*" },
          { key: "b", width: "*" },
        ],
        body: [
          ["Cell 1", "Cell 2"],
          ["Cell 3", "Cell 4"],
        ],
      },
      {
        bounds: { x: 48, y: 72, width: 516, height: 640 },
        style: { fontSize: 11, lineHeight: 14, padding: 6 },
      },
    );

    result.lastPage.drawText("Content after table", {
      x: 48,
      y: result.cursorY - 20,
      size: 12,
    });

    const bytes = await pdf.save();
    await saveTablePdf("content-after-table", bytes);

    const reloaded = await PDF.load(bytes);
    const reloadedPage = reloaded.getPage(0)!;
    const afterTable = expectSingleMatch(reloadedPage, "Content after table");
    const bodyCell = expectSingleMatch(reloadedPage, "Cell 3");

    expect(afterTable.bbox.y).toBeLessThan(bodyCell.bbox.y);
  });

  it("preserves searchable text when mixing auto and star columns", async () => {
    const pdf = PDF.create();
    const page = pdf.addPage({ size: "letter" });

    pdf.drawTable(
      page,
      {
        columns: [
          { key: "id", width: "auto" },
          { key: "name", width: "*" },
          { key: "status", width: "auto" },
        ],
        head: [["ID", "Name", "Status"]],
        body: [
          ["1", "Short name", "Active"],
          ["2", "A longer product name that takes more space", "Inactive"],
          ["3", "Medium name here", "Pending"],
        ],
      },
      {
        bounds: { x: 48, y: 500, width: 516, height: 300 },
        style: { fontSize: 10, lineHeight: 13, padding: 5 },
        headStyle: { font: "Helvetica-Bold" },
      },
    );

    const bytes = await pdf.save();
    await saveTablePdf("auto-star-widths", bytes);

    const reloaded = await PDF.load(bytes);
    expect(reloaded.getPageCount()).toBe(1);

    const text = reloaded.getPage(0)!.extractText().text;
    expect(text).toContain("Short name");
    expect(text).toContain("A longer product name that takes more space");
    expect(text).toContain("Inactive");
    expect(text).toContain("Pending");
  });

  it("keeps rowCountDrawn stable when a body row is split across pages", async () => {
    const pdf = PDF.create();
    const page = pdf.addPage({ size: "letter" });

    const result = pdf.drawTable(
      page,
      {
        columns: [{ key: "a", width: 100 }],
        body: [["short"], [Array(100).fill("word").join(" ")]],
      },
      {
        bounds: { x: 48, y: 72, width: 100, height: 40 },
        style: { fontSize: 12, lineHeight: 14.4, padding: 4 },
      },
    );

    expect(result.usedPages.length).toBeGreaterThan(1);
    expect(result.rowCountDrawn).toBe(2);

    const bytes = await pdf.save();
    await saveTablePdf("split-row-count", bytes);

    const reloaded = await PDF.load(bytes);
    expect(reloaded.getPageCount()).toBe(result.usedPages.length);
    expect(
      reloaded
        .extractText()
        .map(pageText => pageText.text)
        .join("\n"),
    ).toContain("short");
  });
});
