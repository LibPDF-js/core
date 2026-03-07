---
date: 2026-03-06
title: Practical Table API
---

## Problem

Tables are the highest-friction missing creation feature in libpdf.

Today users can draw text, lines, rectangles, images, and arbitrary operators, but invoice-grade tables still require manual x/y math, manual text measurement, manual row height calculation, and manual page breaking. That is exactly the kind of work users expect the library to absorb.

The current drawing stack is strong enough to support tables:

- `PDFPage.drawText()` already supports wrapped multiline text.
- `src/drawing/text-layout.ts` already measures and wraps text.
- `PDFPage.drawRectangle()` and `PDFPage.drawLine()` already cover the border/background primitives a table needs.
- `PDF.addPage()` already gives us the document-level control required for autopagination.

What is missing is a table-specific layout and pagination engine.

## Goals

1. Add a practical table API for generated PDFs, especially invoices, item lists, statements, and tabular reports.
2. Make the first version good enough for real work: repeated headers, optional repeated footers, flexible columns, wrapped text, deterministic pagination, and useful styling.
3. Keep the public API high-level and task-focused, consistent with `PDF`, `PDFPage`, and the rest of the high-level surface.
4. Keep the implementation architecture aligned with the existing layered design: a high-level user API backed by internal layout and drawing primitives.
5. Preserve future room for richer layout features without forcing v1 to become a full document-flow engine.

## Non-Goals

These should not block v1:

- A general document layout engine for arbitrary flowing elements.
- HTML or CSS table import.
- Rich text, images, or nested tables inside cells.
- `rowSpan` and `colSpan` in v1.
- Streaming/flush APIs for very large tables.
- A full iText-style `Document` flow model.
- Auto-detection of semantic tables from existing page content.

## Research Summary

This plan is based on direct source and docs research, including cloned reference code under `/tmp/libpdf-table-research-sparse-20260306`.

### iText 7

What to copy:

- Tables are true layout elements, not just drawing helpers.
- Header and footer sections are explicit (`addHeaderCell`, `addFooterCell`) instead of being inferred from row indices.
- Repeating header/footer behavior is a first-class concern.
- Row splitting is robust and considered normal behavior.
- `setSkipFirstHeader(true)` and `setSkipLastFooter(true)` support continued-table behavior.

What not to copy in v1:

- The full document-flow engine and large-table flushing model.
- The expectation that tables participate in arbitrary block layout across many unrelated layout elements.

### jsPDF AutoTable

What to copy:

- Declarative `head` / `body` / `foot` sections are practical.
- The style cascade is highly useful in real applications.
- Width modes like fixed, auto-sized, and fill-the-rest are practical.
- Table-focused pagination rules are good enough without requiring a whole document model.

What to avoid:

- Mutation hooks that can change metrics during rendering. Those risk desynchronizing measurement from drawing.
- The known source-level compromise where colspan cells do not properly contribute to width calculation.

### pdfmake

What to copy:

- Star/flex column widths are a simple and powerful idea.
- Repeated header rows and keep-with-header concepts are useful for reports and invoices.
- Repeatable fragments are a good internal model for page-break handling.

What not to copy:

- Placeholder-cell ergonomics for spans.
- Extending the table API into a full document-definition DSL in v1.

### ReportLab

What to copy:

- `repeatRows` and `NOSPLIT` show the value of simple, explicit pagination controls.

What not to copy:

- Style-command-based spans and layout directives. They are powerful but awkward for a TypeScript-first API.

## Proposed Public API

V1 should make the table a document-owned operation, not a page-owned one.

```typescript
const pdf = PDF.create();
const startPage = pdf.addPage({ size: "letter" });

const result = pdf.drawTable(
  startPage,
  {
    columns: [
      { key: "item", width: 72 },
      { key: "description", width: "*" },
      { key: "qty", width: 40, align: "right" },
      { key: "price", width: 72, align: "right" },
      { key: "total", width: 72, align: "right" },
    ],
    head: [["Item", "Description", "Qty", "Price", "Total"]],
    body: lineItems.map(item => [
      item.sku,
      item.description,
      String(item.quantity),
      money(item.unitPrice),
      money(item.total),
    ]),
    foot: [
      ["", "", "", "Subtotal", money(subtotal)],
      ["", "", "", "Tax", money(tax)],
      ["", "", "", "Total", money(total)],
    ],
  },
  {
    bounds: { x: 48, y: 72, width: 516, height: 640 },
    headRepeat: "everyPage",
    footRepeat: "lastPage",
    style: {
      fontSize: 10,
      lineHeight: 14,
      padding: 6,
      borderWidth: 0.5,
    },
    headStyle: {
      font: "Helvetica-Bold",
      fillColor: grayscale(0.9),
    },
    alternateRowStyle: {
      fillColor: grayscale(0.97),
    },
  },
);

result.lastPage.drawText("Thank you for your business", {
  x: 48,
  y: result.cursorY - 24,
  size: 10,
});
```

### Why `PDF.drawTable(...)` Instead of `PDFPage.drawTable(...)`

Autopagination requires document-level control.

A table that starts on one page may need to create one or more following pages. `PDF.addPage()` already owns that responsibility. `PDFPage` is the right rendering target, but it is not the right owner for a multi-page operation unless `PDFPage` later gains a safe back-reference to its parent `PDF`.

That means:

- `PDF.drawTable(startPage, ...)` is the primary v1 API.
- A `PDFPage.drawTable(...)` convenience can be added later if `PDFPage` gains a safe parent-document reference.

## Proposed API Surface

The exact names can still be tuned, but the shape should be close to this.

```typescript
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

export interface TableRowDefinition {
  cells: readonly (string | TableCell)[];
  keepTogether?: boolean;
  style?: Partial<TableCellStyle>;
}

export type TableRow = readonly (string | TableCell)[] | TableRowDefinition;

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
  borderColor?: Color;
  borderWidth?: number | { top?: number; right?: number; bottom?: number; left?: number };
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
  keepWithNextRows?: number;
}

export interface DrawTableResult {
  lastPage: PDFPage;
  usedPages: PDFPage[];
  contentBox: Rectangle;
  cursorY: number;
  rowCountDrawn: number;
}
```

Important design choices:

- `head`, `body`, and `foot` are explicit sections.
- Row-level metadata is allowed through `TableRowDefinition`, but simple arrays remain the common shorthand.
- Cells are text-only in v1.
- No `any`-typed cell payloads.

## High-Level Architecture

This feature should live in the high-level API layer, but it should be implemented as two internal sublayers.

### 1. Public High-Level API

- `PDF.drawTable(...)` is the only new public entry point in v1.
- The public surface stays task-focused and ergonomic.
- Tables remain a high-level feature built on top of existing drawing APIs.

### 2. Internal Table Layout Layer

Create an internal `src/tables/` module that does not directly talk to `PDFPage` while computing layout.

Suggested internal modules:

- `src/tables/types.ts` - normalized internal table models
- `src/tables/normalize.ts` - validate shorthand input and section structure
- `src/tables/style.ts` - resolve style cascade
- `src/tables/measure.ts` - text measurement and width constraints
- `src/tables/layout.ts` - column sizing, row sizing, pagination, page fragments
- `src/tables/render.ts` - render precomputed fragments to `PDFPage`

This keeps the engine testable and prevents drawing concerns from leaking into layout decisions.

## Layout Model

### Coordinate Strategy

The public API should continue using native PDF coordinates.

That means `bounds` is expressed as:

- `x`, `y` = bottom-left of the allowed drawing area
- `width`, `height` = usable table region

Internally, the table engine should still think in a top-down flow cursor because tables naturally grow downward. The renderer can translate that into native PDF coordinates at the moment of drawing.

### Column Widths

V1 should support three practical width modes:

- `number` - fixed width in points
- `"auto"` - content-driven preferred width with min/max clamping
- `"*"` or `{ star: n }` - proportional share of remaining width

Resolution order:

1. Normalize the table and validate column count.
2. Measure each cell's preferred width and minimum readable width.
3. Lock fixed-width columns.
4. Estimate `auto` widths from content.
5. Distribute remaining width across star columns.
6. If total width still exceeds available width, shrink `auto` and star columns down to min widths.
7. If the table still cannot fit, throw a typed layout error with diagnostics.

V1 should not attempt full CSS-style table layout.

### Row Heights

Row height should be the maximum resolved cell height in that row after:

- applying effective width
- wrapping text
- applying padding
- applying explicit line height

### Text Wrapping

The current `layoutText()` helper only preserves long words; it does not break them.

That is acceptable for generic paragraph drawing, but it is not enough for practical tables because SKUs, IDs, codes, URLs, and account numbers often exceed column width.

V1 table layout therefore needs an explicit cell overflow policy:

- `overflow: "wrap" | "ellipsis" | "clip"`
- `overflowWrap: "word" | "break-word"`

Default recommendation for body cells:

- `overflow: "wrap"`
- `overflowWrap: "break-word"`

This should be implemented in the table engine without changing the existing `PDFPage.drawText()` contract.

## Pagination Rules

V1 should support deterministic row-based pagination.

### Header and Footer Behavior

- `headRepeat: "everyPage"` should be the default when a head section exists.
- `footRepeat: "none"` should be the default.
- `footRepeat: "lastPage"` should support invoice totals naturally.
- `footRepeat: "everyPage"` should support carried subtotals or repeated summaries.

### Row Breaking

Each body row should follow these rules:

1. If the entire row fits, draw it on the current page.
2. If it does not fit and the row is marked `keepTogether`, start a new page.
3. If it still cannot fit on a fresh page, throw a typed error that identifies the row.
4. If it is not `keepTogether`, allow splitting text lines across pages.

V1 row splitting should only support text-only cells. That keeps the problem tractable and matches the declared v1 scope.

### Keep-With-Header Behavior

A small report often looks broken if the header is repeated and only a single body row fits beneath it. V1 should therefore include a simple `keepWithNextRows` control at the table level so callers can require a small minimum number of body rows after a repeated header.

## Styling Model

The style system should borrow the useful parts of AutoTable while staying deterministic.

Recommended cascade order:

1. library defaults
2. table-wide `style`
3. section style (`headStyle`, `bodyStyle`, `footStyle`)
4. `alternateRowStyle`
5. column style
6. row style
7. cell style

This should all resolve before rendering starts.

What v1 should support:

- font and font size
- line height
- text color and fill color
- padding
- border color and border width
- horizontal and vertical alignment
- text overflow behavior

What v1 should defer:

- border dash patterns
- per-side corner styling
- gradients and patterns in table cells
- mutation hooks that can rewrite styles during draw

## Rendering Model

The renderer should stay thin and build on the existing drawing API.

For each page fragment:

- create or select the target page
- draw cell backgrounds
- draw cell borders
- draw cell text
- update cursor state

The renderer should rely on:

- `PDFPage.drawRectangle()` for backgrounds and simple cell boxes
- `PDFPage.drawLine()` for precise borders when side-specific borders are needed
- `PDFPage.drawText()` only where it matches the already-computed layout, or direct text operators if needed for exact line placement

The important constraint is that measurement must already be complete before this stage.

## Why a Pure Layout Pass Matters

Without a pure layout pass, the implementation will eventually drift into repeated measurement while drawing, hidden pagination side effects, and hooks that change state after the engine has already committed to page breaks.

A pure layout pass gives us:

- deterministic tests for pagination
- easier debugging for row height and width issues
- a future path toward exposing layout information publicly
- a clean separation between table decisions and PDF drawing details

## Phased Delivery

### Phase 1: Core Invoice-Grade Tables

Ship the smallest version that is still practical:

- `PDF.drawTable(...)`
- explicit `head`, `body`, `foot`
- fixed, auto, and star column widths
- text-only cells
- wrapping and break-word behavior
- repeated headers
- optional repeated or last-page-only footers
- row `keepTogether`
- deterministic `DrawTableResult`
- integration tests with visual output

### Phase 2: Controlled Extension Points

Only after the layout model is stable:

- read-only page hooks for drawing repeated content around the table
- optional post-render hooks that cannot change measurement
- a convenience `PDFPage.drawTable(...)` wrapper if `PDFPage` gets a safe back-reference to `PDF`

### Phase 3: Richer Table Features

Once core pagination is stable and well tested:

- `rowSpan` and `colSpan`
- rich cell content
- nested tables
- public `layoutTable(...)` export for custom renderers
- large-table streaming and flush semantics

## Test Plan

This feature needs both unit-level layout tests and integration-level PDF output tests.

### Unit Tests

- column width resolution across fixed, auto, and star columns
- row height resolution with padding and line height
- break-word behavior for long tokens
- overflow behavior for wrap, ellipsis, and clip
- page-break decisions with repeated headers and optional footers
- `keepTogether` behavior on rows
- typed failures when a row cannot fit in a fresh page

### Integration Tests

Generate PDFs in `test-output/` that cover:

- simple table on one page
- invoice table that breaks across pages
- repeated header rows
- last-page-only totals footer
- alternating row background styles
- right-aligned numeric columns
- long SKU / code / URL cells with break-word behavior
- narrow columns with auto + star widths together

### Visual Verification

Like the existing drawing integration tests, these outputs should be easy to open in Preview, Chrome, and Acrobat.

## Risks and Mitigations

### Risk: Wrong public owner for autopagination

If the first API is `PDFPage.drawTable(...)`, the implementation will either need awkward hidden document access or it will quietly fail to own page creation cleanly.

Mitigation:

- start with `PDF.drawTable(startPage, ...)`

### Risk: Reusing generic text layout without table-specific overflow behavior

If v1 depends entirely on the current `layoutText()` behavior, long invoice tokens will overflow or force unusable columns.

Mitigation:

- add table-specific overflow and break-word policy in `src/tables/measure.ts`

### Risk: Overreaching into full document layout

Trying to solve tables, paragraphs, floating blocks, and arbitrary page-flow together will delay the feature and increase design churn.

Mitigation:

- keep v1 narrowly scoped to tables only

### Risk: AutoTable-style hooks altering layout after measurement

If hooks can mutate cell content or styles after page breaks are chosen, bugs will be subtle and hard to test.

Mitigation:

- resolve styles before layout
- keep any future hooks read-only during render

## Success Criteria

This plan is successful when libpdf can support the following without manual page math by the caller:

1. An invoice line-item table that breaks across pages cleanly.
2. A repeated header row on every continuation page.
3. A subtotal/total footer that appears only on the last page or every page, depending on configuration.
4. Numeric columns aligned cleanly to the right.
5. Long descriptions and long codes wrapped predictably.
6. A result object that lets the caller continue drawing after the table.

## Open Questions

None that should block the plan.

The defaults that should be used unless implementation evidence proves otherwise are:

- primary API: `PDF.drawTable(startPage, ...)`
- header repeat default: `everyPage` when `head` exists
- footer repeat default: `none`
- default cell overflow: `wrap`
- default word policy for table cells: `break-word`
