import {
  measureRow,
  resolveColumnWidths,
  TableLayoutError,
  TableRowOverflowError,
} from "./measure";
import type { DrawTableOptions, MeasuredRow, NormalizedTable, PageFragment } from "./types";

export interface TableLayoutResult {
  fragments: PageFragment[];
  columnWidths: number[];
}

const EPSILON = 0.01;

export function layoutTable(table: NormalizedTable, options: DrawTableOptions): TableLayoutResult {
  const { bounds } = options;
  const columnWidths = resolveColumnWidths(table, bounds.width);

  // Measure all rows
  const headRows = table.head.map(r => measureRow(r, columnWidths));
  const bodyRows = table.body.map(r => measureRow(r, columnWidths));
  const footRows = table.foot.map(r => measureRow(r, columnWidths));

  const headRepeat = options.headRepeat ?? (table.head.length > 0 ? "everyPage" : "none");
  const footRepeat = options.footRepeat ?? "none";

  const fragments: PageFragment[] = [];
  const remainingBodyRows = [...bodyRows];
  const hasBodyRows = remainingBodyRows.length > 0;

  while (remainingBodyRows.length > 0 || (!hasBodyRows && fragments.length === 0)) {
    const isFirstPage = fragments.length === 0;
    const pageHead = shouldShowHead(headRepeat, isFirstPage) ? headRows : [];
    const repeatedFoot = footRepeat === "everyPage" ? footRows : [];
    const currentCapacity = getBodyCapacity(bounds.height, pageHead, repeatedFoot);

    let pageBodyRows = fillPageRows(remainingBodyRows, currentCapacity);

    if (footRepeat === "lastPage" && remainingBodyRows.length === 0) {
      const lastPageCapacity = getBodyCapacity(bounds.height, pageHead, footRows);

      while (sumRowHeights(pageBodyRows) > lastPageCapacity + EPSILON) {
        if (pageBodyRows.length === 0) {
          break;
        }
        remainingBodyRows.unshift(pageBodyRows.pop()!);
      }

      if (pageBodyRows.length === 0 && remainingBodyRows.length > 0) {
        pageBodyRows = fillPageRows(remainingBodyRows, lastPageCapacity);
      }
    }

    const isLastPage = remainingBodyRows.length === 0;
    const pageFoot = shouldShowFoot(footRepeat, isLastPage) ? footRows : [];

    if (pageBodyRows.length === 0 && remainingBodyRows.length > 0) {
      const row = remainingBodyRows[0];
      const continuationHead = shouldShowHead(headRepeat, false) ? headRows : [];
      const continuationCapacity = getBodyCapacity(bounds.height, continuationHead, repeatedFoot);

      if (
        isFirstPage &&
        pageHead.length > 0 &&
        continuationCapacity > currentCapacity + EPSILON &&
        row.rowHeight <= continuationCapacity + EPSILON
      ) {
        fragments.push({
          rows: [],
          headRows: pageHead,
          footRows: repeatedFoot,
          isFirstPage,
          isLastPage: false,
        });
        continue;
      }

      throw new TableRowOverflowError(row.bodyIndex, row.rowHeight, currentCapacity);
    }

    if (pageHead.length === 0 && pageBodyRows.length === 0 && pageFoot.length === 0) {
      continue;
    }

    fragments.push({
      rows: pageBodyRows,
      headRows: pageHead,
      footRows: pageFoot,
      isFirstPage,
      isLastPage,
    });
  }

  // Edge case: empty body with head/foot only
  if (fragments.length === 0) {
    const pageHead = shouldShowHead(headRepeat, true) ? headRows : [];
    const pageFoot = shouldShowFoot(footRepeat, true) ? footRows : [];
    getBodyCapacity(bounds.height, pageHead, pageFoot);

    fragments.push({
      rows: [],
      headRows: pageHead,
      footRows: pageFoot,
      isFirstPage: true,
      isLastPage: true,
    });
  }

  return { fragments, columnWidths };
}

function shouldShowHead(
  headRepeat: "none" | "firstPage" | "everyPage",
  isFirstPage: boolean,
): boolean {
  if (headRepeat === "everyPage") {
    return true;
  }
  if (headRepeat === "firstPage") {
    return isFirstPage;
  }
  return false;
}

function shouldShowFoot(
  footRepeat: "none" | "lastPage" | "everyPage",
  isLastPage: boolean,
): boolean {
  if (footRepeat === "everyPage") {
    return true;
  }
  if (footRepeat === "lastPage") {
    return isLastPage;
  }
  return false;
}

function fillPageRows(remainingRows: MeasuredRow[], availableHeight: number): MeasuredRow[] {
  const pageRows: MeasuredRow[] = [];
  let remainingHeight = availableHeight;

  while (remainingRows.length > 0) {
    const row = remainingRows[0];

    if (row.rowHeight <= remainingHeight + EPSILON) {
      pageRows.push(remainingRows.shift()!);
      remainingHeight -= row.rowHeight;
      continue;
    }

    if (!row.keepTogether) {
      const split = splitRow(row, remainingHeight);
      if (split) {
        pageRows.push(split.first);
        remainingRows[0] = split.rest;
      }
    }

    break;
  }

  return pageRows;
}

function getBodyCapacity(
  boundsHeight: number,
  pageHead: readonly MeasuredRow[],
  pageFoot: readonly MeasuredRow[],
): number {
  const capacity = boundsHeight - sumRowHeights(pageHead) - sumRowHeights(pageFoot);
  if (capacity < -EPSILON) {
    throw new TableLayoutError("Table header/footer exceed available page height");
  }
  return Math.max(capacity, 0);
}

function sumRowHeights(rows: readonly MeasuredRow[]): number {
  return rows.reduce((sum, row) => sum + row.rowHeight, 0);
}

/**
 * Split a row at a given height boundary.
 * Only works for text-only cells — splits at line boundaries.
 */
function splitRow(
  row: MeasuredRow,
  availableHeight: number,
): { first: MeasuredRow; rest: MeasuredRow } | null {
  if (availableHeight <= 0) {
    return null;
  }

  const firstCells = [];
  const restCells = [];
  let maxFirstHeight = 0;
  let maxRestHeight = 0;
  let didSplit = false;

  for (const cell of row.cells) {
    const { padding } = cell.style;
    const availForText = availableHeight - padding.top - padding.bottom;
    const linesPerPage = Math.floor((availForText + EPSILON) / cell.style.lineHeight);

    if (linesPerPage <= 0) {
      return null;
    }

    if (linesPerPage >= cell.lines.length) {
      // Entire cell fits on first page
      firstCells.push({ ...cell });
      restCells.push({
        ...cell,
        text: "",
        lines: [],
        contentHeight: 0,
        cellHeight: padding.top + padding.bottom,
      });
      maxFirstHeight = Math.max(maxFirstHeight, cell.cellHeight);
      maxRestHeight = Math.max(maxRestHeight, padding.top + padding.bottom);
    } else {
      const firstLines = cell.lines.slice(0, linesPerPage);
      const restLines = cell.lines.slice(linesPerPage);

      if (firstLines.length === 0 || restLines.length === 0) {
        return null;
      }

      didSplit = true;

      const firstTextHeight = firstLines.length * cell.style.lineHeight;
      const restTextHeight = restLines.length * cell.style.lineHeight;

      firstCells.push({
        ...cell,
        text: firstLines.map(l => l.text).join("\n"),
        lines: firstLines,
        contentHeight: firstTextHeight,
        cellHeight: firstTextHeight + padding.top + padding.bottom,
      });

      restCells.push({
        ...cell,
        text: restLines.map(l => l.text).join("\n"),
        lines: restLines,
        contentHeight: restTextHeight,
        cellHeight: restTextHeight + padding.top + padding.bottom,
      });

      maxFirstHeight = Math.max(maxFirstHeight, firstTextHeight + padding.top + padding.bottom);
      maxRestHeight = Math.max(maxRestHeight, restTextHeight + padding.top + padding.bottom);
    }
  }

  if (!didSplit || maxFirstHeight <= 0 || maxFirstHeight > availableHeight + EPSILON) {
    return null;
  }

  return {
    first: {
      cells: firstCells,
      section: row.section,
      keepTogether: false,
      bodyIndex: row.bodyIndex,
      rowHeight: maxFirstHeight,
    },
    rest: {
      cells: restCells,
      section: row.section,
      keepTogether: false,
      bodyIndex: row.bodyIndex,
      rowHeight: maxRestHeight,
    },
  };
}
