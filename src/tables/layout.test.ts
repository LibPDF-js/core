import { describe, expect, it } from "vitest";

import { layoutTable } from "./layout";
import { TableRowOverflowError } from "./measure";
import { normalizeTable } from "./normalize";
import type { DrawTableOptions, TableDefinition } from "./types";

const bounds = { x: 48, y: 72, width: 500, height: 200 };
const baseOptions: DrawTableOptions = { bounds };

function makeTable(bodyRowCount: number, head = false, foot = false): TableDefinition {
  return {
    columns: [
      { key: "a", width: 250 },
      { key: "b", width: 250 },
    ],
    head: head ? [["H1", "H2"]] : undefined,
    body: Array.from({ length: bodyRowCount }, (_, i) => [`R${i}`, `V${i}`]),
    foot: foot ? [["F1", "F2"]] : undefined,
  };
}

function fragmentHeight(fragment: ReturnType<typeof layoutTable>["fragments"][number]) {
  return [...fragment.headRows, ...fragment.rows, ...fragment.footRows].reduce(
    (sum, row) => sum + row.rowHeight,
    0,
  );
}

describe("layoutTable", () => {
  it("lays out a simple single-page table", () => {
    const def = makeTable(3);
    const table = normalizeTable(def, baseOptions);
    const result = layoutTable(table, baseOptions);

    expect(result.fragments).toHaveLength(1);
    expect(result.fragments[0].rows).toHaveLength(3);
    expect(result.fragments[0].isFirstPage).toBe(true);
    expect(result.fragments[0].isLastPage).toBe(true);
  });

  it("paginates when rows exceed page height", () => {
    // Create enough rows to overflow
    const def = makeTable(20);
    const table = normalizeTable(def, baseOptions);
    const result = layoutTable(table, baseOptions);

    expect(result.fragments.length).toBeGreaterThan(1);
    expect(result.fragments[0].isFirstPage).toBe(true);
    expect(result.fragments[0].isLastPage).toBe(false);
    expect(result.fragments[result.fragments.length - 1].isLastPage).toBe(true);
  });

  it("repeats headers on every page", () => {
    const def = makeTable(20, true);
    const options: DrawTableOptions = { bounds, headRepeat: "everyPage" };
    const table = normalizeTable(def, options);
    const result = layoutTable(table, options);

    for (const fragment of result.fragments) {
      expect(fragment.headRows.length).toBeGreaterThan(0);
    }
  });

  it("shows header only on first page with firstPage repeat", () => {
    const def = makeTable(20, true);
    const options: DrawTableOptions = { bounds, headRepeat: "firstPage" };
    const table = normalizeTable(def, options);
    const result = layoutTable(table, options);

    expect(result.fragments[0].headRows.length).toBeGreaterThan(0);
    if (result.fragments.length > 1) {
      expect(result.fragments[1].headRows).toHaveLength(0);
    }
  });

  it("shows footer only on last page with lastPage repeat", () => {
    const shortBounds = { x: 0, y: 0, width: 100, height: 100 };
    const def: TableDefinition = {
      columns: [{ key: "a", width: 100 }],
      body: [["1"], ["2"], ["3"], ["4"]],
      foot: [["Footer"]],
    };
    const options: DrawTableOptions = { bounds: shortBounds, footRepeat: "lastPage" };
    const table = normalizeTable(def, options);
    const result = layoutTable(table, options);

    const lastFragment = result.fragments[result.fragments.length - 1];
    expect(lastFragment.footRows.length).toBeGreaterThan(0);
    expect(result.fragments.length).toBeGreaterThan(1);
    expect(result.fragments.every(fragment => fragmentHeight(fragment) <= shortBounds.height)).toBe(
      true,
    );

    if (result.fragments.length > 1) {
      expect(result.fragments[0].footRows).toHaveLength(0);
    }
  });

  it("shows footer on every page with everyPage repeat", () => {
    const def = makeTable(20, false, true);
    const options: DrawTableOptions = { bounds, footRepeat: "everyPage" };
    const table = normalizeTable(def, options);
    const result = layoutTable(table, options);

    for (const fragment of result.fragments) {
      expect(fragment.footRows.length).toBeGreaterThan(0);
    }
  });

  it("throws when a single row cannot fit on a fresh page", () => {
    // Use a very small page height but matching column width
    const def: TableDefinition = {
      columns: [{ key: "a", width: 100 }],
      body: [{ cells: [Array(200).fill("word").join(" ")], keepTogether: true }],
    };
    const tinyBounds = { x: 0, y: 0, width: 100, height: 30 };
    const options: DrawTableOptions = { bounds: tinyBounds };
    const table = normalizeTable(def, options);

    expect(() => layoutTable(table, options)).toThrow(TableRowOverflowError);
  });

  it("allows a first-page-only header to push the first body row to the next page", () => {
    const def: TableDefinition = {
      columns: [{ key: "a", width: 100 }],
      head: [["Header"]],
      body: [["Body"]],
    };
    const options: DrawTableOptions = {
      bounds: { x: 0, y: 0, width: 100, height: 40 },
      headRepeat: "firstPage",
    };
    const table = normalizeTable(def, options);
    const result = layoutTable(table, options);

    expect(result.fragments).toHaveLength(2);
    expect(result.fragments[0].headRows).toHaveLength(1);
    expect(result.fragments[0].rows).toHaveLength(0);
    expect(result.fragments[1].headRows).toHaveLength(0);
    expect(result.fragments[1].rows).toHaveLength(1);
  });

  it("splits rows without overflowing a fragment or emitting an empty trailing fragment", () => {
    const def: TableDefinition = {
      columns: [{ key: "a", width: 100 }],
      body: [["short"], [Array(100).fill("word").join(" ")]],
    };
    const options: DrawTableOptions = { bounds: { x: 0, y: 0, width: 100, height: 40 } };
    const table = normalizeTable(def, options);
    const result = layoutTable(table, options);

    expect(result.fragments.length).toBeGreaterThan(1);
    expect(result.fragments.every(fragment => fragment.rows.length > 0)).toBe(true);
    expect(
      result.fragments.every(fragment => fragmentHeight(fragment) <= options.bounds.height),
    ).toBe(true);
    expect(
      result.fragments.flatMap(fragment => fragment.rows.filter(row => row.bodyIndex === 1)).length,
    ).toBeGreaterThan(1);
  });

  it("handles empty body with head and foot", () => {
    const def: TableDefinition = {
      columns: [
        { key: "a", width: 250 },
        { key: "b", width: 250 },
      ],
      head: [["H1", "H2"]],
      body: [],
      foot: [["F1", "F2"]],
    };
    const options: DrawTableOptions = { bounds, footRepeat: "lastPage" };
    const table = normalizeTable(def, options);
    const result = layoutTable(table, options);

    expect(result.fragments).toHaveLength(1);
    expect(result.fragments[0].rows).toHaveLength(0);
    expect(result.fragments[0].headRows.length).toBeGreaterThan(0);
    expect(result.fragments[0].footRows.length).toBeGreaterThan(0);
  });
});
