import type { PDFPage } from "#src/api/pdf-page";

import type { TableLayoutResult } from "./layout";
import type {
  DrawTableOptions,
  DrawTableResult,
  MeasuredCell,
  MeasuredRow,
  PageFragment,
} from "./types";

interface RenderContext {
  fragments: PageFragment[];
  columnWidths: number[];
  options: DrawTableOptions;
  startPage: PDFPage;
  addPage: () => PDFPage;
}

export function renderTable(
  layout: TableLayoutResult,
  options: DrawTableOptions,
  startPage: PDFPage,
  addPage: () => PDFPage,
): DrawTableResult {
  const ctx: RenderContext = {
    fragments: layout.fragments,
    columnWidths: layout.columnWidths,
    options,
    startPage,
    addPage,
  };

  const usedPages: PDFPage[] = [];
  let currentPage = startPage;
  let cursorY = 0;
  const seenBodyIndices = new Set<number>();

  for (let fi = 0; fi < ctx.fragments.length; fi++) {
    const fragment = ctx.fragments[fi];

    if (fi > 0) {
      currentPage = ctx.addPage();
    }
    usedPages.push(currentPage);

    cursorY = renderFragment(currentPage, fragment, ctx);
    for (const row of fragment.rows) {
      seenBodyIndices.add(row.bodyIndex);
    }
  }

  return {
    lastPage: currentPage,
    usedPages,
    cursorY,
    rowCountDrawn: seenBodyIndices.size,
  };
}

function renderFragment(page: PDFPage, fragment: PageFragment, ctx: RenderContext): number {
  const { bounds } = ctx.options;
  // PDF y-up: top of bounds is y + height
  const topY = bounds.y + bounds.height;
  let cursor = topY;

  for (const row of fragment.headRows) {
    drawRow(page, row, cursor, ctx);
    cursor -= row.rowHeight;
  }

  for (const row of fragment.rows) {
    drawRow(page, row, cursor, ctx);
    cursor -= row.rowHeight;
  }

  for (const row of fragment.footRows) {
    drawRow(page, row, cursor, ctx);
    cursor -= row.rowHeight;
  }

  const allRows = [...fragment.headRows, ...fragment.rows, ...fragment.footRows];
  drawGrid(page, allRows, topY, ctx);

  return cursor;
}

function drawRow(page: PDFPage, row: MeasuredRow, topY: number, ctx: RenderContext): void {
  const { bounds } = ctx.options;
  let x = bounds.x;

  for (let i = 0; i < row.cells.length; i++) {
    const cell = row.cells[i];
    const colWidth = ctx.columnWidths[i];

    const cellBottomY = topY - row.rowHeight;

    if (cell.style.fillColor) {
      page.drawRectangle({
        x,
        y: cellBottomY,
        width: colWidth,
        height: row.rowHeight,
        color: cell.style.fillColor,
      });
    }

    drawCellText(page, cell, x, topY, cellBottomY, colWidth, row.rowHeight);

    x += colWidth;
  }
}

function drawCellText(
  page: PDFPage,
  cell: MeasuredCell,
  cellX: number,
  cellTopY: number,
  cellBottomY: number,
  colWidth: number,
  rowHeight: number,
): void {
  const { padding, align, valign, font, fontSize, lineHeight, textColor } = cell.style;

  if (cell.lines.length === 0 || (cell.lines.length === 1 && cell.lines[0].text === "")) {
    return;
  }

  const contentAreaWidth = colWidth - padding.left - padding.right;
  const textBlockHeight = cell.lines.length * lineHeight;
  const innerHeight = rowHeight - padding.top - padding.bottom;

  let textTopY: number;
  if (valign === "middle") {
    textTopY = cellTopY - padding.top - (innerHeight - textBlockHeight) / 2;
  } else if (valign === "bottom") {
    textTopY = cellBottomY + padding.bottom + textBlockHeight;
  } else {
    textTopY = cellTopY - padding.top;
  }

  for (let li = 0; li < cell.lines.length; li++) {
    const line = cell.lines[li];
    if (line.text === "") {
      continue;
    }

    let lineX = cellX + padding.left;
    if (align === "center") {
      lineX += (contentAreaWidth - line.width) / 2;
    } else if (align === "right") {
      lineX += contentAreaWidth - line.width;
    }

    const baselineY = textTopY - (li + 1) * lineHeight + (lineHeight - fontSize) / 2;

    page.drawText(line.text, {
      x: lineX,
      y: baselineY,
      font,
      size: fontSize,
      color: textColor,
    });
  }
}

function drawGrid(page: PDFPage, rows: MeasuredRow[], topY: number, ctx: RenderContext): void {
  const { bounds } = ctx.options;
  const outerWidth = ctx.options.outerBorderWidth ?? 0.5;
  const innerWidth = ctx.options.innerBorderWidth ?? 0.5;
  const outerColor = ctx.options.outerBorderColor;
  const innerColor = ctx.options.innerBorderColor;

  if (rows.length === 0) {
    return;
  }

  const totalHeight = rows.reduce((s, r) => s + r.rowHeight, 0);
  const tableWidth = ctx.columnWidths.reduce((s, w) => s + w, 0);
  const bottomY = topY - totalHeight;

  if (outerWidth > 0) {
    page.drawRectangle({
      x: bounds.x,
      y: bottomY,
      width: tableWidth,
      height: totalHeight,
      borderWidth: outerWidth,
      borderColor: outerColor,
    });
  }

  // Inner horizontal lines (between rows)
  if (innerWidth > 0 && rows.length > 1) {
    let y = topY;
    for (let i = 0; i < rows.length - 1; i++) {
      y -= rows[i].rowHeight;
      page.drawLine({
        start: { x: bounds.x, y },
        end: { x: bounds.x + tableWidth, y },
        color: innerColor,
        thickness: innerWidth,
      });
    }
  }

  // Inner vertical lines (between columns)
  if (innerWidth > 0 && ctx.columnWidths.length > 1) {
    let x = bounds.x;
    for (let i = 0; i < ctx.columnWidths.length - 1; i++) {
      x += ctx.columnWidths[i];
      page.drawLine({
        start: { x, y: topY },
        end: { x, y: bottomY },
        color: innerColor,
        thickness: innerWidth,
      });
    }
  }
}
