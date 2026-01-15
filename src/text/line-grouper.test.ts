import { describe, expect, it } from "vitest";

import { getPlainText, groupCharsIntoLines } from "./line-grouper";
import type { ExtractedChar } from "./types";

describe("LineGrouper", () => {
  describe("groupCharsIntoLines", () => {
    it("returns empty array for no characters", () => {
      const result = groupCharsIntoLines([]);

      expect(result).toEqual([]);
    });

    it("groups characters on same baseline into one line", () => {
      const chars: ExtractedChar[] = [
        {
          char: "H",
          bbox: { x: 0, y: 0, width: 10, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10,
        },
        {
          char: "e",
          bbox: { x: 10, y: 0, width: 8, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10,
        },
        {
          char: "l",
          bbox: { x: 18, y: 0, width: 4, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10,
        },
        {
          char: "l",
          bbox: { x: 22, y: 0, width: 4, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10,
        },
        {
          char: "o",
          bbox: { x: 26, y: 0, width: 8, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10,
        },
      ];

      const lines = groupCharsIntoLines(chars);

      expect(lines).toHaveLength(1);
      expect(lines[0].text).toBe("Hello");
      expect(lines[0].spans).toHaveLength(1);
    });

    it("creates separate lines for different baselines", () => {
      const chars: ExtractedChar[] = [
        // Line 1 at baseline 100
        {
          char: "A",
          bbox: { x: 0, y: 90, width: 10, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 100,
        },
        {
          char: "B",
          bbox: { x: 10, y: 90, width: 10, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 100,
        },
        // Line 2 at baseline 80
        {
          char: "C",
          bbox: { x: 0, y: 70, width: 10, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 80,
        },
        {
          char: "D",
          bbox: { x: 10, y: 70, width: 10, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 80,
        },
      ];

      const lines = groupCharsIntoLines(chars);

      expect(lines).toHaveLength(2);
      // Lines should be sorted top-to-bottom (higher Y first)
      expect(lines[0].text).toBe("AB");
      expect(lines[0].baseline).toBe(100);
      expect(lines[1].text).toBe("CD");
      expect(lines[1].baseline).toBe(80);
    });

    it("detects spaces between words", () => {
      const chars: ExtractedChar[] = [
        {
          char: "H",
          bbox: { x: 0, y: 0, width: 10, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10,
        },
        {
          char: "i",
          bbox: { x: 10, y: 0, width: 4, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10,
        },
        // Gap that should trigger space insertion
        {
          char: "t",
          bbox: { x: 20, y: 0, width: 6, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10,
        },
        {
          char: "h",
          bbox: { x: 26, y: 0, width: 6, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10,
        },
        {
          char: "e",
          bbox: { x: 32, y: 0, width: 6, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10,
        },
        {
          char: "r",
          bbox: { x: 38, y: 0, width: 5, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10,
        },
        {
          char: "e",
          bbox: { x: 43, y: 0, width: 6, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10,
        },
      ];

      const lines = groupCharsIntoLines(chars);

      expect(lines).toHaveLength(1);
      expect(lines[0].text).toBe("Hi there");
    });

    it("creates new span on font change", () => {
      const chars: ExtractedChar[] = [
        {
          char: "N",
          bbox: { x: 0, y: 0, width: 10, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10,
        },
        {
          char: "o",
          bbox: { x: 10, y: 0, width: 8, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10,
        },
        {
          char: "r",
          bbox: { x: 18, y: 0, width: 5, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10,
        },
        {
          char: "m",
          bbox: { x: 23, y: 0, width: 10, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10,
        },
        {
          char: "a",
          bbox: { x: 33, y: 0, width: 8, height: 14 },
          fontSize: 14,
          fontName: "Helvetica-Bold",
          baseline: 10,
        },
        {
          char: "l",
          bbox: { x: 41, y: 0, width: 4, height: 14 },
          fontSize: 14,
          fontName: "Helvetica-Bold",
          baseline: 10,
        },
      ];

      const lines = groupCharsIntoLines(chars);

      expect(lines).toHaveLength(1);
      expect(lines[0].spans).toHaveLength(2);
      expect(lines[0].spans[0].fontName).toBe("Helvetica");
      expect(lines[0].spans[1].fontName).toBe("Helvetica-Bold");
    });

    it("handles baseline tolerance", () => {
      const chars: ExtractedChar[] = [
        // Slightly different baselines but within tolerance
        {
          char: "A",
          bbox: { x: 0, y: 0, width: 10, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10,
        },
        {
          char: "B",
          bbox: { x: 10, y: 0, width: 10, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10.5,
        },
        {
          char: "C",
          bbox: { x: 20, y: 0, width: 10, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 11,
        },
      ];

      const lines = groupCharsIntoLines(chars, { baselineTolerance: 2 });

      expect(lines).toHaveLength(1);
      expect(lines[0].text).toBe("ABC");
    });

    it("respects custom space threshold", () => {
      const chars: ExtractedChar[] = [
        {
          char: "A",
          bbox: { x: 0, y: 0, width: 10, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10,
        },
        // Small gap - should NOT be a space with high threshold
        {
          char: "B",
          bbox: { x: 12, y: 0, width: 10, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10,
        },
      ];

      // With default threshold (0.3), gap of 2 / fontSize 12 = 0.17 < 0.3, no space
      const lines1 = groupCharsIntoLines(chars, { spaceThreshold: 0.3 });

      expect(lines1[0].text).toBe("AB");

      // With lower threshold, gap is detected
      const lines2 = groupCharsIntoLines(chars, { spaceThreshold: 0.1 });

      expect(lines2[0].text).toBe("A B");
    });
  });

  describe("getPlainText", () => {
    it("joins lines with newlines", () => {
      const chars: ExtractedChar[] = [
        {
          char: "L",
          bbox: { x: 0, y: 90, width: 10, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 100,
        },
        {
          char: "1",
          bbox: { x: 10, y: 90, width: 8, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 100,
        },
        {
          char: "L",
          bbox: { x: 0, y: 70, width: 10, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 80,
        },
        {
          char: "2",
          bbox: { x: 10, y: 70, width: 8, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 80,
        },
      ];

      const lines = groupCharsIntoLines(chars);
      const text = getPlainText(lines);

      expect(text).toBe("L1\nL2");
    });

    it("returns empty string for no lines", () => {
      const text = getPlainText([]);

      expect(text).toBe("");
    });
  });
});
