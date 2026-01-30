import { layoutJustifiedLine, layoutText, measureText } from "#src/drawing/text-layout";
import { describe, expect, it } from "vitest";

describe("measureText", () => {
  it("measures text width with Standard 14 font", () => {
    const width = measureText("Hello", "Helvetica", 12);
    // Helvetica 'Hello' at 12pt should be roughly 24-27pt
    expect(width).toBeGreaterThan(20);
    expect(width).toBeLessThan(35);
  });

  it("measures space width", () => {
    const spaceWidth = measureText(" ", "Helvetica", 12);
    expect(spaceWidth).toBeGreaterThan(0);
    expect(spaceWidth).toBeLessThan(5); // Space is narrow
  });

  it("returns 0 for empty string", () => {
    const width = measureText("", "Helvetica", 12);
    expect(width).toBe(0);
  });

  it("scales with font size", () => {
    const width12 = measureText("Hello", "Helvetica", 12);
    const width24 = measureText("Hello", "Helvetica", 24);
    expect(width24).toBeCloseTo(width12 * 2, 1);
  });

  it("handles different Standard 14 fonts", () => {
    const helvetica = measureText("Hello", "Helvetica", 12);
    const courier = measureText("Hello", "Courier", 12);
    const times = measureText("Hello", "Times-Roman", 12);

    // Courier is monospace, usually wider
    expect(courier).toBeGreaterThan(helvetica * 0.8);
    // Times is typically narrower than Helvetica
    expect(times).toBeLessThan(helvetica * 1.2);
  });
});

describe("layoutText", () => {
  it("returns single line for short text", () => {
    const result = layoutText("Hello", "Helvetica", 12, 100, 14);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].text).toBe("Hello");
  });

  it("wraps text at maxWidth", () => {
    const result = layoutText("Hello World", "Helvetica", 12, 40, 14);
    // 40pt is too narrow for "Hello World"
    expect(result.lines.length).toBeGreaterThanOrEqual(2);
  });

  it("preserves explicit line breaks", () => {
    const result = layoutText("Line 1\nLine 2\nLine 3", "Helvetica", 12, 200, 14);
    expect(result.lines).toHaveLength(3);
    expect(result.lines[0].text).toBe("Line 1");
    expect(result.lines[1].text).toBe("Line 2");
    expect(result.lines[2].text).toBe("Line 3");
  });

  it("handles Windows line endings", () => {
    const result = layoutText("Line 1\r\nLine 2", "Helvetica", 12, 200, 14);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].text).toBe("Line 1");
    expect(result.lines[1].text).toBe("Line 2");
  });

  it("handles old Mac line endings", () => {
    const result = layoutText("Line 1\rLine 2", "Helvetica", 12, 200, 14);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].text).toBe("Line 1");
    expect(result.lines[1].text).toBe("Line 2");
  });

  it("calculates total height", () => {
    const lineHeight = 14;
    const result = layoutText("Line 1\nLine 2\nLine 3", "Helvetica", 12, 200, lineHeight);
    expect(result.height).toBe(3 * lineHeight);
  });

  it("handles empty string", () => {
    const result = layoutText("", "Helvetica", 12, 100, 14);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].text).toBe("");
    expect(result.height).toBe(14);
  });

  it("keeps long words intact", () => {
    const result = layoutText("Supercalifragilisticexpialidocious", "Helvetica", 12, 50, 14);
    // Even if maxWidth is narrow, the word should not be broken
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].text).toBe("Supercalifragilisticexpialidocious");
  });
});

describe("layoutJustifiedLine", () => {
  it("returns empty array for no words", () => {
    const result = layoutJustifiedLine([], "Helvetica", 12, 100);
    expect(result).toHaveLength(0);
  });

  it("returns single word at position 0", () => {
    const result = layoutJustifiedLine(["Hello"], "Helvetica", 12, 100);
    expect(result).toHaveLength(1);
    expect(result[0].word).toBe("Hello");
    expect(result[0].x).toBe(0);
  });

  it("distributes space evenly between words", () => {
    const result = layoutJustifiedLine(["Hello", "World"], "Helvetica", 12, 200);
    expect(result).toHaveLength(2);
    expect(result[0].word).toBe("Hello");
    expect(result[0].x).toBe(0);
    expect(result[1].word).toBe("World");
    // Second word should be positioned with space distributed
    expect(result[1].x).toBeGreaterThan(0);
  });

  it("handles three words", () => {
    const result = layoutJustifiedLine(["One", "Two", "Three"], "Helvetica", 12, 200);
    expect(result).toHaveLength(3);
    expect(result[0].x).toBe(0);
    expect(result[1].x).toBeGreaterThan(result[0].x);
    expect(result[2].x).toBeGreaterThan(result[1].x);
  });
});
