import type { Rectangle } from "#src/api/pdf-page";
import type { FontInput } from "#src/drawing/types";
import type { Color } from "#src/helpers/colors";

// ─────────────────────────────────────────────────────────────────────────────
// Public API Types
// ─────────────────────────────────────────────────────────────────────────────

export type TableWidth = number | "auto" | "*" | { star: number };
export type TableRepeat = "none" | "firstPage" | "everyPage" | "lastPage";
export type TableOverflow = "wrap" | "ellipsis" | "clip";
export type TableOverflowWrap = "word" | "break-word";
export type TableHAlign = "left" | "center" | "right";
export type TableVAlign = "top" | "middle" | "bottom";

export interface TableColumn {
  key: string;
  width?: TableWidth;
  minWidth?: number;
  maxWidth?: number;
  align?: TableHAlign;
  style?: Partial<TableCellStyle>;
}

export interface TableCell {
  text: string;
  align?: TableHAlign;
  valign?: TableVAlign;
  overflow?: TableOverflow;
  overflowWrap?: TableOverflowWrap;
  style?: Partial<TableCellStyle>;
}

export interface TableSparseRow {
  cells: Record<string, string | TableCell>;
  keepTogether?: boolean;
  style?: Partial<TableCellStyle>;
}

export interface TableFullRow {
  cells: readonly (string | TableCell)[];
  keepTogether?: boolean;
  style?: Partial<TableCellStyle>;
}

export type TableRow = readonly (string | TableCell)[] | TableFullRow | TableSparseRow;

export interface TableDefinition {
  columns: readonly TableColumn[];
  head?: readonly TableRow[];
  body: readonly TableRow[];
  foot?: readonly TableRow[];
}

export interface TableCellStyle {
  font: FontInput;
  fontSize: number;
  lineHeight: number;
  textColor: Color;
  fillColor?: Color;
  padding: number | { top?: number; right?: number; bottom?: number; left?: number };
  align: TableHAlign;
  valign: TableVAlign;
  overflow: TableOverflow;
  overflowWrap: TableOverflowWrap;
}

export interface DrawTableOptions {
  bounds: Rectangle;
  headRepeat?: Extract<TableRepeat, "none" | "firstPage" | "everyPage">;
  footRepeat?: Extract<TableRepeat, "none" | "lastPage" | "everyPage">;
  style?: Partial<TableCellStyle>;
  headStyle?: Partial<TableCellStyle>;
  bodyStyle?: Partial<TableCellStyle>;
  footStyle?: Partial<TableCellStyle>;
  alternateRowStyle?: Partial<TableCellStyle>;
  columnStyles?: Record<string, Partial<TableCellStyle>>;
  outerBorderWidth?: number;
  outerBorderColor?: Color;
  innerBorderWidth?: number;
  innerBorderColor?: Color;
}

export interface DrawTableResult {
  lastPage: import("#src/api/pdf-page").PDFPage;
  usedPages: import("#src/api/pdf-page").PDFPage[];
  cursorY: number;
  rowCountDrawn: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Normalized Types
// ─────────────────────────────────────────────────────────────────────────────

export type Section = "head" | "body" | "foot";

export interface ResolvedPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ResolvedCellStyle {
  font: FontInput;
  fontSize: number;
  lineHeight: number;
  textColor: Color;
  fillColor: Color | undefined;
  padding: ResolvedPadding;
  align: TableHAlign;
  valign: TableVAlign;
  overflow: TableOverflow;
  overflowWrap: TableOverflowWrap;
}

export interface NormalizedCell {
  text: string;
  style: ResolvedCellStyle;
}

export interface NormalizedRow {
  cells: NormalizedCell[];
  section: Section;
  keepTogether: boolean;
  bodyIndex: number;
}

export interface NormalizedTable {
  columns: TableColumn[];
  head: NormalizedRow[];
  body: NormalizedRow[];
  foot: NormalizedRow[];
}

export interface MeasuredCell {
  text: string;
  style: ResolvedCellStyle;
  lines: { text: string; width: number }[];
  contentWidth: number;
  contentHeight: number;
  cellHeight: number;
}

export interface MeasuredRow {
  cells: MeasuredCell[];
  section: Section;
  keepTogether: boolean;
  bodyIndex: number;
  rowHeight: number;
}

export interface PageFragment {
  rows: MeasuredRow[];
  headRows: MeasuredRow[];
  footRows: MeasuredRow[];
  isFirstPage: boolean;
  isLastPage: boolean;
}
