import { measureText } from "#src/drawing/text-layout";
import type { FontInput } from "#src/drawing/types";

import type {
  MeasuredCell,
  MeasuredRow,
  NormalizedRow,
  NormalizedTable,
  ResolvedCellStyle,
  TableColumn,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Text breaking and overflow
// ─────────────────────────────────────────────────────────────────────────────

interface TextLine {
  text: string;
  width: number;
}

export function layoutCellText(
  text: string,
  style: ResolvedCellStyle,
  maxWidth: number,
): TextLine[] {
  if (text === "") {
    return [{ text: "", width: 0 }];
  }
  if (maxWidth <= 0) {
    return [{ text: "", width: 0 }];
  }

  const { font, fontSize, overflow, overflowWrap } = style;

  if (overflow === "clip") {
    return clipText(text, font, fontSize, maxWidth);
  }

  if (overflow === "ellipsis") {
    return ellipsisText(text, font, fontSize, maxWidth);
  }

  // overflow === "wrap"
  const paragraphs = text.split(/\r\n|\r|\n/);
  const lines: TextLine[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph === "") {
      lines.push({ text: "", width: 0 });
      continue;
    }

    const words = paragraph.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) {
      lines.push({ text: "", width: 0 });
      continue;
    }

    const spaceWidth = measureText(" ", font, fontSize);
    let currentLine = "";
    let currentWidth = 0;

    for (const word of words) {
      const wordWidth = measureText(word, font, fontSize);

      if (currentLine === "") {
        ({ currentLine, currentWidth } = placeWord(
          word,
          wordWidth,
          lines,
          font,
          fontSize,
          maxWidth,
          overflowWrap,
        ));
      } else {
        const testWidth = currentWidth + spaceWidth + wordWidth;
        if (testWidth <= maxWidth) {
          currentLine += ` ${word}`;
          currentWidth = testWidth;
        } else {
          lines.push({ text: currentLine, width: currentWidth });
          ({ currentLine, currentWidth } = placeWord(
            word,
            wordWidth,
            lines,
            font,
            fontSize,
            maxWidth,
            overflowWrap,
          ));
        }
      }
    }

    if (currentLine !== "") {
      lines.push({ text: currentLine, width: currentWidth });
    }
  }

  return lines.length > 0 ? lines : [{ text: "", width: 0 }];
}

function placeWord(
  word: string,
  wordWidth: number,
  lines: TextLine[],
  font: FontInput,
  fontSize: number,
  maxWidth: number,
  overflowWrap: string,
): { currentLine: string; currentWidth: number } {
  if (wordWidth > maxWidth && overflowWrap === "break-word") {
    const broken = breakWord(word, font, fontSize, maxWidth);
    for (let i = 0; i < broken.length - 1; i++) {
      lines.push(broken[i]);
    }
    const last = broken[broken.length - 1];
    return { currentLine: last.text, currentWidth: last.width };
  }
  return { currentLine: word, currentWidth: wordWidth };
}

function breakWord(word: string, font: FontInput, fontSize: number, maxWidth: number): TextLine[] {
  const lines: TextLine[] = [];
  let current = "";
  let currentWidth = 0;

  for (const char of word) {
    const charWidth = measureText(char, font, fontSize);
    if (currentWidth + charWidth > maxWidth && current !== "") {
      lines.push({ text: current, width: currentWidth });
      current = char;
      currentWidth = charWidth;
    } else {
      current += char;
      currentWidth += charWidth;
    }
  }

  if (current !== "") {
    lines.push({ text: current, width: currentWidth });
  }

  return lines;
}

function clipText(text: string, font: FontInput, fontSize: number, maxWidth: number): TextLine[] {
  const firstLine = text.split(/\r\n|\r|\n/)[0];
  let clipped = "";
  let width = 0;

  for (const char of firstLine) {
    const charWidth = measureText(char, font, fontSize);
    if (width + charWidth > maxWidth) {
      break;
    }
    clipped += char;
    width += charWidth;
  }

  return [{ text: clipped, width }];
}

function ellipsisText(
  text: string,
  font: FontInput,
  fontSize: number,
  maxWidth: number,
): TextLine[] {
  if (maxWidth <= 0) {
    return [{ text: "", width: 0 }];
  }

  const firstLine = text.split(/\r\n|\r|\n/)[0];
  const fullWidth = measureText(firstLine, font, fontSize);

  if (fullWidth <= maxWidth) {
    return [{ text: firstLine, width: fullWidth }];
  }

  const ellipsis = "...";
  const ellipsisWidth = measureText(ellipsis, font, fontSize);

  if (ellipsisWidth > maxWidth) {
    return clipText(ellipsis, font, fontSize, maxWidth);
  }

  const availWidth = maxWidth - ellipsisWidth;

  let clipped = "";
  let width = 0;

  for (const char of firstLine) {
    const charWidth = measureText(char, font, fontSize);
    if (width + charWidth > availWidth) {
      break;
    }
    clipped += char;
    width += charWidth;
  }

  return [{ text: clipped + ellipsis, width: width + ellipsisWidth }];
}

// ─────────────────────────────────────────────────────────────────────────────
// Cell and row measurement
// ─────────────────────────────────────────────────────────────────────────────

function measureCell(
  cell: { text: string; style: ResolvedCellStyle },
  columnWidth: number,
): MeasuredCell {
  const { padding } = cell.style;
  const contentWidth = columnWidth - padding.left - padding.right;
  const lines = layoutCellText(cell.text, cell.style, contentWidth);

  const textHeight = lines.length * cell.style.lineHeight;
  const cellHeight = textHeight + padding.top + padding.bottom;

  return {
    text: cell.text,
    style: cell.style,
    lines,
    contentWidth,
    contentHeight: textHeight,
    cellHeight,
  };
}

export function measureRow(row: NormalizedRow, columnWidths: number[]): MeasuredRow {
  const cells = row.cells.map((cell, i) => measureCell(cell, columnWidths[i]));
  const rowHeight = Math.max(...cells.map(c => c.cellHeight), 0);

  return {
    cells,
    section: row.section,
    keepTogether: row.keepTogether,
    bodyIndex: row.bodyIndex,
    rowHeight,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Column width resolution
// ─────────────────────────────────────────────────────────────────────────────

export function resolveColumnWidths(table: NormalizedTable, availableWidth: number): number[] {
  const { columns } = table;
  const widths = new Array<number>(columns.length).fill(0);
  const allRows = [...table.head, ...table.body, ...table.foot];

  // Pass 1: lock fixed-width columns
  let fixedTotal = 0;
  const autoIndices: number[] = [];
  const starIndices: number[] = [];
  const starWeights: number[] = [];

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const w = col.width ?? "*";

    if (typeof w === "number") {
      widths[i] = w;
      fixedTotal += w;
    } else if (w === "auto") {
      autoIndices.push(i);
    } else {
      // "*" or { star: n }
      starIndices.push(i);
      starWeights.push(typeof w === "object" ? w.star : 1);
    }
  }

  // Pass 2: auto columns
  let autoTotal = 0;
  for (const i of autoIndices) {
    const col = columns[i];

    if (col.minWidth !== undefined && col.maxWidth !== undefined) {
      widths[i] = col.maxWidth;
      autoTotal += col.maxWidth;
      continue;
    }

    let preferred = 0;
    for (const row of allRows) {
      const cell = row.cells[i];
      const textWidth = measureText(cell.text, cell.style.font, cell.style.fontSize);
      const cellPreferred = textWidth + cell.style.padding.left + cell.style.padding.right;
      preferred = Math.max(preferred, cellPreferred);
    }

    if (col.minWidth !== undefined) {
      preferred = Math.max(preferred, col.minWidth);
    }
    if (col.maxWidth !== undefined) {
      preferred = Math.min(preferred, col.maxWidth);
    }

    widths[i] = preferred;
    autoTotal += preferred;
  }

  // Pass 3: star columns get remaining width
  let remaining = availableWidth - fixedTotal - autoTotal;
  if (remaining < 0) {
    remaining = 0;
  }

  if (starIndices.length > 0) {
    const totalWeight = starWeights.reduce((a, b) => a + b, 0);
    for (let j = 0; j < starIndices.length; j++) {
      const i = starIndices[j];
      const col = columns[i];
      let w = (starWeights[j] / totalWeight) * remaining;

      if (col.minWidth !== undefined) {
        w = Math.max(w, col.minWidth);
      }
      if (col.maxWidth !== undefined) {
        w = Math.min(w, col.maxWidth);
      }

      widths[i] = w;
    }
  }

  const total = widths.reduce((a, b) => a + b, 0);
  if (total > availableWidth + 0.01) {
    const shrinkableIndices = [...autoIndices, ...starIndices];
    let excess = total - availableWidth;

    for (const i of shrinkableIndices) {
      if (excess <= 0) {
        break;
      }
      const col = columns[i];
      const min = col.minWidth ?? 0;
      const shrinkable = widths[i] - min;
      if (shrinkable > 0) {
        const shrink = Math.min(shrinkable, excess);
        widths[i] -= shrink;
        excess -= shrink;
      }
    }

    if (excess > 0.01) {
      throw new TableLayoutError(
        `Table width ${total.toFixed(1)}pt exceeds available ${availableWidth.toFixed(1)}pt`,
      );
    }
  }

  return widths;
}

export class TableLayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TableLayoutError";
  }
}

export class TableRowOverflowError extends TableLayoutError {
  rowIndex: number;
  measuredHeight: number;
  availableHeight: number;

  constructor(rowIndex: number, measuredHeight: number, availableHeight: number) {
    super(
      `Row ${rowIndex} height ${measuredHeight.toFixed(1)}pt exceeds available page height ${availableHeight.toFixed(1)}pt`,
    );
    this.name = "TableRowOverflowError";
    this.rowIndex = rowIndex;
    this.measuredHeight = measuredHeight;
    this.availableHeight = availableHeight;
  }
}
