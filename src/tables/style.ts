import { black } from "#src/helpers/colors";

import type {
  DrawTableOptions,
  ResolvedCellStyle,
  ResolvedPadding,
  Section,
  TableCellStyle,
  TableColumn,
  TableDefinition,
} from "./types";

const DEFAULT_STYLE: ResolvedCellStyle = {
  font: "Helvetica",
  fontSize: 12,
  lineHeight: 14.4,
  textColor: black,
  fillColor: undefined,
  padding: { top: 4, right: 4, bottom: 4, left: 4 },
  align: "left",
  valign: "top",
  overflow: "wrap",
  overflowWrap: "break-word",
};

export function resolvePadding(
  padding: number | { top?: number; right?: number; bottom?: number; left?: number } | undefined,
  fallback: ResolvedPadding,
): ResolvedPadding {
  if (padding === undefined) {
    return fallback;
  }
  if (typeof padding === "number") {
    return { top: padding, right: padding, bottom: padding, left: padding };
  }
  return {
    top: padding.top ?? fallback.top,
    right: padding.right ?? fallback.right,
    bottom: padding.bottom ?? fallback.bottom,
    left: padding.left ?? fallback.left,
  };
}

export function mergeStyle(
  base: ResolvedCellStyle,
  partial: Partial<TableCellStyle> | undefined,
): ResolvedCellStyle {
  if (!partial) {
    return base;
  }
  return {
    font: partial.font ?? base.font,
    fontSize: partial.fontSize ?? base.fontSize,
    lineHeight: partial.lineHeight ?? base.lineHeight,
    textColor: partial.textColor ?? base.textColor,
    fillColor: partial.fillColor !== undefined ? partial.fillColor : base.fillColor,
    padding: resolvePadding(partial.padding, base.padding),
    align: partial.align ?? base.align,
    valign: partial.valign ?? base.valign,
    overflow: partial.overflow ?? base.overflow,
    overflowWrap: partial.overflowWrap ?? base.overflowWrap,
  };
}

/**
 * Pre-compute the resolved style for every cell position in the table.
 *
 * Cascade order (later wins):
 *   1. library defaults
 *   2. table-wide `style`
 *   3. section style (`headStyle`, `bodyStyle`, `footStyle`)
 *   4. `alternateRowStyle` (body only, continuous counter)
 *   5. column style (`columnStyles[key]`)
 *   6. row style (handled in normalize.ts at extraction time)
 *   7. cell style (handled in normalize.ts at extraction time)
 *
 * Returns a map keyed by `"section:rowIndex:columnKey"`.
 * Levels 6 and 7 are applied in normalize.ts since they depend on per-row/cell data.
 */
export function resolveStyleCascade(
  definition: TableDefinition,
  options: DrawTableOptions,
  columns: TableColumn[],
): Map<string, ResolvedCellStyle> {
  const styles = new Map<string, ResolvedCellStyle>();

  // Level 1: defaults
  let base = { ...DEFAULT_STYLE };

  // Level 2: table-wide style
  base = mergeStyle(base, options.style);

  const sectionStyleMap: Record<Section, Partial<TableCellStyle> | undefined> = {
    head: options.headStyle,
    body: options.bodyStyle,
    foot: options.footStyle,
  };

  const sections: { name: Section; rows: readonly import("./types").TableRow[] }[] = [
    { name: "head", rows: definition.head ?? [] },
    { name: "body", rows: definition.body },
    { name: "foot", rows: definition.foot ?? [] },
  ];

  for (const { name: section, rows } of sections) {
    // Level 3: section style
    const sectionBase = mergeStyle(base, sectionStyleMap[section]);

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      // Level 4: alternate row style (body only)
      let rowBase = sectionBase;
      if (section === "body" && options.alternateRowStyle && rowIdx % 2 === 1) {
        rowBase = mergeStyle(sectionBase, options.alternateRowStyle);
      }

      for (const col of columns) {
        // Level 5: column style
        let cellBase = rowBase;
        if (options.columnStyles?.[col.key]) {
          cellBase = mergeStyle(rowBase, options.columnStyles[col.key]);
        }

        // Level 5.5: column-level align from TableColumn
        if (col.align) {
          cellBase = { ...cellBase, align: col.align };
        }

        // Column-level style from TableColumn.style
        if (col.style) {
          cellBase = mergeStyle(cellBase, col.style);
        }

        styles.set(`${section}:${rowIdx}:${col.key}`, cellBase);
      }
    }
  }

  return styles;
}
