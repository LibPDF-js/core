import { mergeStyle, resolveStyleCascade } from "./style";
import type {
  DrawTableOptions,
  NormalizedRow,
  NormalizedTable,
  ResolvedCellStyle,
  Section,
  TableCell,
  TableCellStyle,
  TableColumn,
  TableDefinition,
  TableFullRow,
  TableRow,
  TableSparseRow,
} from "./types";

function isSparseRow(row: TableRow): row is TableSparseRow {
  return (
    typeof row === "object" && !Array.isArray(row) && "cells" in row && !Array.isArray(row.cells)
  );
}

function isFullRow(row: TableRow): row is TableFullRow {
  return (
    typeof row === "object" && !Array.isArray(row) && "cells" in row && Array.isArray(row.cells)
  );
}

function resolveSparseRow(
  row: TableSparseRow,
  columns: readonly TableColumn[],
): (string | TableCell)[] {
  const cells: (string | TableCell)[] = new Array(columns.length).fill("");
  for (const [key, value] of Object.entries(row.cells)) {
    const colIndex = columns.findIndex(c => c.key === key);
    if (colIndex !== -1) {
      cells[colIndex] = value;
    }
  }
  return cells;
}

function extractCells(row: TableRow, columns: readonly TableColumn[]): (string | TableCell)[] {
  if (Array.isArray(row)) {
    return row as (string | TableCell)[];
  }
  if (isSparseRow(row)) {
    return resolveSparseRow(row, columns);
  }
  if (isFullRow(row)) {
    return row.cells as (string | TableCell)[];
  }
  return row as (string | TableCell)[];
}

function extractRowMeta(row: TableRow): {
  keepTogether: boolean;
  style?: Partial<TableCellStyle>;
} {
  if (Array.isArray(row)) {
    return { keepTogether: false };
  }
  if (typeof row === "object" && "cells" in row) {
    return {
      keepTogether: row.keepTogether ?? false,
      style: row.style,
    };
  }
  return { keepTogether: false };
}

function normalizeRow(
  row: TableRow,
  columns: readonly TableColumn[],
  section: Section,
  bodyIndex: number,
  styles: Map<string, ResolvedCellStyle>,
): NormalizedRow {
  const rawCells = extractCells(row, columns);
  const meta = extractRowMeta(row);

  let padded = [...rawCells];
  if (padded.length < columns.length) {
    if (padded.length > 0) {
      console.warn(
        `Table row has ${padded.length} cells but ${columns.length} columns — padding with empty cells`,
      );
    }
    while (padded.length < columns.length) {
      padded.push("");
    }
  } else if (padded.length > columns.length) {
    console.warn(
      `Table row has ${padded.length} cells but ${columns.length} columns — extra cells ignored`,
    );
    padded = padded.slice(0, columns.length);
  }

  const cells = padded.map((cell, colIndex) => {
    const text = typeof cell === "string" ? cell : cell.text;
    const cellOverrides = typeof cell === "string" ? undefined : cell.style;
    const cellAlign = typeof cell === "string" ? undefined : cell.align;
    const cellValign = typeof cell === "string" ? undefined : cell.valign;
    const cellOverflow = typeof cell === "string" ? undefined : cell.overflow;
    const cellOverflowWrap = typeof cell === "string" ? undefined : cell.overflowWrap;

    const key = columns[colIndex].key;
    const baseStyle = styles.get(`${section}:${bodyIndex}:${key}`)!;

    let style = baseStyle;

    if (meta.style) {
      style = mergeStyle(style, meta.style);
    }

    if (cellOverrides || cellAlign || cellValign || cellOverflow || cellOverflowWrap) {
      style = mergeStyle(style, cellOverrides);
      if (cellAlign) {
        style = { ...style, align: cellAlign };
      }
      if (cellValign) {
        style = { ...style, valign: cellValign };
      }
      if (cellOverflow) {
        style = { ...style, overflow: cellOverflow };
      }
      if (cellOverflowWrap) {
        style = { ...style, overflowWrap: cellOverflowWrap };
      }
    }

    return { text, style };
  });

  return { cells, section, keepTogether: meta.keepTogether, bodyIndex };
}

export function normalizeTable(
  definition: TableDefinition,
  options: DrawTableOptions,
): NormalizedTable {
  const columns = [...definition.columns];
  if (columns.length === 0) {
    throw new Error("Table must have at least one column");
  }

  const styles = resolveStyleCascade(definition, options, columns);

  const head = (definition.head ?? []).map((row, i) =>
    normalizeRow(row, columns, "head", i, styles),
  );

  const body = definition.body.map((row, i) => normalizeRow(row, columns, "body", i, styles));

  const foot = (definition.foot ?? []).map((row, i) =>
    normalizeRow(row, columns, "foot", i, styles),
  );

  return { columns, head, body, foot };
}
