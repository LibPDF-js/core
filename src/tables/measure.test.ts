import { black } from "#src/helpers/colors";
import { describe, expect, it } from "vitest";

import { layoutCellText, resolveColumnWidths, TableLayoutError } from "./measure";
import { normalizeTable } from "./normalize";
import type { DrawTableOptions, ResolvedCellStyle, TableDefinition } from "./types";

const baseStyle: ResolvedCellStyle = {
  font: "Helvetica",
  fontSize: 12,
  lineHeight: 14,
  textColor: black,
  fillColor: undefined,
  padding: { top: 4, right: 4, bottom: 4, left: 4 },
  align: "left",
  valign: "top",
  overflow: "wrap",
  overflowWrap: "break-word",
};

describe("layoutCellText", () => {
  it("returns a single line for short text", () => {
    const lines = layoutCellText("Hello", baseStyle, 200);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe("Hello");
    expect(lines[0].width).toBeGreaterThan(0);
  });

  it("wraps text at word boundaries", () => {
    const lines = layoutCellText("Hello World Foo Bar", baseStyle, 50);
    expect(lines.length).toBeGreaterThan(1);
  });

  it("breaks long words with break-word", () => {
    const style = { ...baseStyle, overflowWrap: "break-word" as const };
    const lines = layoutCellText("ABCDEFGHIJKLMNOPQRSTUVWXYZ", style, 30);
    expect(lines.length).toBeGreaterThan(1);
    // Each line fragment should fit within maxWidth
    for (const line of lines) {
      expect(line.width).toBeLessThanOrEqual(30 + 1); // small tolerance
    }
  });

  it("does not break words with word wrap mode", () => {
    const style = { ...baseStyle, overflowWrap: "word" as const };
    const lines = layoutCellText("ABCDEFGHIJKLMNOP", style, 30);
    // Long word kept intact on one line
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe("ABCDEFGHIJKLMNOP");
  });

  it("handles clip overflow", () => {
    const style = { ...baseStyle, overflow: "clip" as const };
    const lines = layoutCellText("Hello World This Is Long", style, 40);
    expect(lines).toHaveLength(1);
    expect(lines[0].width).toBeLessThanOrEqual(40 + 1);
  });

  it("handles ellipsis overflow", () => {
    const style = { ...baseStyle, overflow: "ellipsis" as const };
    const lines = layoutCellText("Hello World This Is Very Long Text", style, 60);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toContain("...");
    expect(lines[0].width).toBeLessThanOrEqual(60 + 1);
  });

  it("clips the ellipsis token itself when the column is extremely narrow", () => {
    const style = { ...baseStyle, overflow: "ellipsis" as const };
    const lines = layoutCellText("Hello", style, 1);

    expect(lines).toHaveLength(1);
    expect(lines[0].width).toBeLessThanOrEqual(1 + 0.001);
    expect(lines[0].text.length).toBeLessThanOrEqual(3);
  });

  it("returns empty text for empty input", () => {
    const lines = layoutCellText("", baseStyle, 200);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe("");
  });

  it("handles newlines in text", () => {
    const lines = layoutCellText("Line 1\nLine 2\nLine 3", baseStyle, 200);
    expect(lines).toHaveLength(3);
    expect(lines[0].text).toBe("Line 1");
    expect(lines[1].text).toBe("Line 2");
    expect(lines[2].text).toBe("Line 3");
  });
});

describe("resolveColumnWidths", () => {
  const baseBounds = { x: 0, y: 0, width: 500, height: 700 };
  const baseOptions: DrawTableOptions = { bounds: baseBounds };

  it("resolves fixed-width columns", () => {
    const def: TableDefinition = {
      columns: [
        { key: "a", width: 100 },
        { key: "b", width: 200 },
      ],
      body: [["x", "y"]],
    };
    const table = normalizeTable(def, baseOptions);
    const widths = resolveColumnWidths(table, 500);

    expect(widths[0]).toBe(100);
    expect(widths[1]).toBe(200);
  });

  it("distributes star columns equally", () => {
    const def: TableDefinition = {
      columns: [
        { key: "a", width: 100 },
        { key: "b", width: "*" },
        { key: "c", width: "*" },
      ],
      body: [["x", "y", "z"]],
    };
    const table = normalizeTable(def, baseOptions);
    const widths = resolveColumnWidths(table, 500);

    expect(widths[0]).toBe(100);
    expect(widths[1]).toBe(200);
    expect(widths[2]).toBe(200);
  });

  it("distributes weighted star columns", () => {
    const def: TableDefinition = {
      columns: [
        { key: "a", width: { star: 1 } },
        { key: "b", width: { star: 3 } },
      ],
      body: [["x", "y"]],
    };
    const table = normalizeTable(def, baseOptions);
    const widths = resolveColumnWidths(table, 400);

    expect(widths[0]).toBe(100);
    expect(widths[1]).toBe(300);
  });

  it("throws when columns exceed available width", () => {
    const def: TableDefinition = {
      columns: [
        { key: "a", width: 300 },
        { key: "b", width: 300 },
      ],
      body: [["x", "y"]],
    };
    const table = normalizeTable(def, baseOptions);

    expect(() => resolveColumnWidths(table, 500)).toThrow(TableLayoutError);
  });

  it("auto columns measure content width", () => {
    const def: TableDefinition = {
      columns: [
        { key: "a", width: "auto" },
        { key: "b", width: "*" },
      ],
      body: [["Short", "Fill"]],
    };
    const table = normalizeTable(def, baseOptions);
    const widths = resolveColumnWidths(table, 500);

    // Auto column should be roughly the text width + padding
    expect(widths[0]).toBeGreaterThan(0);
    expect(widths[0]).toBeLessThan(200);
    // Star column gets the rest
    expect(widths[0] + widths[1]).toBeCloseTo(500, 0);
  });
});
