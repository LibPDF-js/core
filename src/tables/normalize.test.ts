import { describe, expect, it, vi } from "vitest";

import { normalizeTable } from "./normalize";
import type { DrawTableOptions, TableDefinition } from "./types";

const baseBounds = { x: 0, y: 0, width: 500, height: 700 };
const baseOptions: DrawTableOptions = { bounds: baseBounds };

describe("normalizeTable", () => {
  it("normalizes a simple array-based table", () => {
    const def: TableDefinition = {
      columns: [{ key: "a" }, { key: "b" }],
      body: [["hello", "world"]],
    };

    const result = normalizeTable(def, baseOptions);

    expect(result.columns).toHaveLength(2);
    expect(result.body).toHaveLength(1);
    expect(result.body[0].cells).toHaveLength(2);
    expect(result.body[0].cells[0].text).toBe("hello");
    expect(result.body[0].cells[1].text).toBe("world");
    expect(result.body[0].section).toBe("body");
  });

  it("normalizes sparse rows using column keys", () => {
    const def: TableDefinition = {
      columns: [{ key: "a" }, { key: "b" }, { key: "c" }],
      body: [{ cells: { b: "middle", c: "end" } }],
    };

    const result = normalizeTable(def, baseOptions);

    expect(result.body[0].cells[0].text).toBe("");
    expect(result.body[0].cells[1].text).toBe("middle");
    expect(result.body[0].cells[2].text).toBe("end");
  });

  it("pads short rows with empty cells and warns", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const def: TableDefinition = {
      columns: [{ key: "a" }, { key: "b" }, { key: "c" }],
      body: [["only-one"]],
    };

    const result = normalizeTable(def, baseOptions);

    expect(result.body[0].cells).toHaveLength(3);
    expect(result.body[0].cells[0].text).toBe("only-one");
    expect(result.body[0].cells[1].text).toBe("");
    expect(result.body[0].cells[2].text).toBe("");
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("truncates extra cells and warns", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const def: TableDefinition = {
      columns: [{ key: "a" }],
      body: [["one", "two", "three"]],
    };

    const result = normalizeTable(def, baseOptions);

    expect(result.body[0].cells).toHaveLength(1);
    expect(result.body[0].cells[0].text).toBe("one");
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("normalizes head, body, and foot sections", () => {
    const def: TableDefinition = {
      columns: [{ key: "a" }],
      head: [["Header"]],
      body: [["Row 1"], ["Row 2"]],
      foot: [["Footer"]],
    };

    const result = normalizeTable(def, baseOptions);

    expect(result.head).toHaveLength(1);
    expect(result.head[0].section).toBe("head");
    expect(result.body).toHaveLength(2);
    expect(result.body[0].section).toBe("body");
    expect(result.foot).toHaveLength(1);
    expect(result.foot[0].section).toBe("foot");
  });

  it("preserves keepTogether from full row definitions", () => {
    const def: TableDefinition = {
      columns: [{ key: "a" }],
      body: [{ cells: ["data"], keepTogether: true }],
    };

    const result = normalizeTable(def, baseOptions);
    expect(result.body[0].keepTogether).toBe(true);
  });

  it("throws on empty columns", () => {
    const def: TableDefinition = { columns: [], body: [] };
    expect(() => normalizeTable(def, baseOptions)).toThrow("at least one column");
  });

  it("handles TableCell objects in rows", () => {
    const def: TableDefinition = {
      columns: [{ key: "a" }],
      body: [[{ text: "styled", align: "right" }]],
    };

    const result = normalizeTable(def, baseOptions);
    expect(result.body[0].cells[0].text).toBe("styled");
    expect(result.body[0].cells[0].style.align).toBe("right");
  });
});
