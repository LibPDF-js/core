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
          sequenceIndex: 0,
        },
        {
          char: "e",
          bbox: { x: 10, y: 0, width: 8, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10,
          sequenceIndex: 1,
        },
        {
          char: "l",
          bbox: { x: 18, y: 0, width: 4, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10,
          sequenceIndex: 2,
        },
        {
          char: "l",
          bbox: { x: 22, y: 0, width: 4, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10,
          sequenceIndex: 3,
        },
        {
          char: "o",
          bbox: { x: 26, y: 0, width: 8, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10,
          sequenceIndex: 4,
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
          sequenceIndex: 0,
        },
        {
          char: "B",
          bbox: { x: 10, y: 90, width: 10, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 100,
          sequenceIndex: 1,
        },
        // Line 2 at baseline 80
        {
          char: "C",
          bbox: { x: 0, y: 70, width: 10, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 80,
          sequenceIndex: 2,
        },
        {
          char: "D",
          bbox: { x: 10, y: 70, width: 10, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 80,
          sequenceIndex: 3,
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
          sequenceIndex: 0,
        },
        {
          char: "i",
          bbox: { x: 10, y: 0, width: 4, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10,
          sequenceIndex: 1,
        },
        // Gap that should trigger space insertion
        {
          char: "t",
          bbox: { x: 20, y: 0, width: 6, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10,
          sequenceIndex: 2,
        },
        {
          char: "h",
          bbox: { x: 26, y: 0, width: 6, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10,
          sequenceIndex: 3,
        },
        {
          char: "e",
          bbox: { x: 32, y: 0, width: 6, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10,
          sequenceIndex: 4,
        },
        {
          char: "r",
          bbox: { x: 38, y: 0, width: 5, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10,
          sequenceIndex: 5,
        },
        {
          char: "e",
          bbox: { x: 43, y: 0, width: 6, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10,
          sequenceIndex: 6,
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
          sequenceIndex: 0,
        },
        {
          char: "o",
          bbox: { x: 10, y: 0, width: 8, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10,
          sequenceIndex: 1,
        },
        {
          char: "r",
          bbox: { x: 18, y: 0, width: 5, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10,
          sequenceIndex: 2,
        },
        {
          char: "m",
          bbox: { x: 23, y: 0, width: 10, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10,
          sequenceIndex: 3,
        },
        {
          char: "a",
          bbox: { x: 33, y: 0, width: 8, height: 14 },
          fontSize: 14,
          fontName: "Helvetica-Bold",
          baseline: 10,
          sequenceIndex: 4,
        },
        {
          char: "l",
          bbox: { x: 41, y: 0, width: 4, height: 14 },
          fontSize: 14,
          fontName: "Helvetica-Bold",
          baseline: 10,
          sequenceIndex: 5,
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
          sequenceIndex: 0,
        },
        {
          char: "B",
          bbox: { x: 10, y: 0, width: 10, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10.5,
          sequenceIndex: 1,
        },
        {
          char: "C",
          bbox: { x: 20, y: 0, width: 10, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 11,
          sequenceIndex: 2,
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
          sequenceIndex: 0,
        },
        // Small gap - should NOT be a space with high threshold
        {
          char: "B",
          bbox: { x: 12, y: 0, width: 10, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 10,
          sequenceIndex: 1,
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

  describe("RTL-placed text detection", () => {
    /** Helper to build an ExtractedChar with sensible defaults. */
    function makeChar(char: string, x: number, sequenceIndex?: number, width = 8): ExtractedChar {
      return {
        char,
        bbox: { x, y: 0, width, height: 12 },
        fontSize: 12,
        fontName: "Helvetica",
        baseline: 10,
        sequenceIndex,
      };
    }

    it("preserves stream order for 100% RTL-placed chars", () => {
      // Chars placed right-to-left (x decreasing) but stream order is A, B, C, D.
      // Adjacent chars touch (x + width = next x) so no spaces inserted.
      const chars = [
        makeChar("A", 30, 0),
        makeChar("B", 22, 1),
        makeChar("C", 14, 2),
        makeChar("D", 6, 3),
      ];

      const lines = groupCharsIntoLines(chars);

      expect(lines).toHaveLength(1);
      expect(lines[0].text).toBe("ABCD");
    });

    it("detects RTL-placed at exactly 80% threshold", () => {
      // 6 chars → 5 pairs. 4 decreasing = 80% → should be detected.
      // Adjacent chars (width=8) so gaps are 0 and no spaces inserted.
      const chars = [
        makeChar("A", 50, 0),
        makeChar("B", 42, 1), // decreasing
        makeChar("C", 34, 2), // decreasing
        makeChar("D", 26, 3), // decreasing
        makeChar("E", 28, 4), // increasing (forward jump)
        makeChar("F", 20, 5), // decreasing
      ];

      const lines = groupCharsIntoLines(chars);

      expect(lines).toHaveLength(1);
      expect(lines[0].text).toBe("ABCDEF");
    });

    it("falls back to x-sort below 80% threshold", () => {
      // 6 chars → 5 pairs. 3 decreasing = 60% → NOT detected → x-sort.
      const chars = [
        makeChar("A", 50, 0),
        makeChar("B", 42, 1), // decreasing
        makeChar("C", 44, 2), // increasing
        makeChar("D", 36, 3), // decreasing
        makeChar("E", 38, 4), // increasing
        makeChar("F", 30, 5), // decreasing
      ];

      const lines = groupCharsIntoLines(chars);

      expect(lines).toHaveLength(1);
      // x-sorted order: F(30), D(36), E(38), B(42), C(44), A(50)
      expect(lines[0].text).toBe("FDEBCA");
    });

    it("uses x-sort for normal LTR text", () => {
      const chars = [
        makeChar("A", 0, 0),
        makeChar("B", 10, 1),
        makeChar("C", 20, 2),
        makeChar("D", 30, 3),
      ];

      const lines = groupCharsIntoLines(chars);

      expect(lines).toHaveLength(1);
      expect(lines[0].text).toBe("ABCD");
    });

    it("handles single character", () => {
      const chars = [makeChar("X", 10, 0)];

      const lines = groupCharsIntoLines(chars);

      expect(lines).toHaveLength(1);
      expect(lines[0].text).toBe("X");
    });

    it("detects two chars with decreasing x as RTL-placed", () => {
      // 2 chars → 1 pair, 1/1 = 100% decreasing
      const chars = [makeChar("A", 20, 0), makeChar("B", 10, 1)];

      const lines = groupCharsIntoLines(chars);

      expect(lines).toHaveLength(1);
      expect(lines[0].text).toBe("AB");
    });

    it("preserves stream order for genuine RTL text with normal glyph widths", () => {
      // Real RTL text (Arabic/Hebrew) has normal glyph widths and decreasing x.
      // The heuristic correctly detects this and preserves stream order, which
      // IS the correct reading order for RTL text.
      const chars = [
        makeChar("\u0628", 30, 0), // ba
        makeChar("\u0627", 22, 1), // alef
        makeChar("\u062F", 14, 2), // dal
        makeChar("\u0631", 6, 3), // ra
      ];

      const lines = groupCharsIntoLines(chars);

      expect(lines).toHaveLength(1);
      // Stream order preserved: ba, alef, dal, ra (correct reading order)
      expect(lines[0].text).toBe("\u0628\u0627\u062F\u0631");
    });

    it("inserts space correctly in RTL-placed lines", () => {
      // Two words placed right-to-left with a gap between them.
      // Within-word: chars adjacent (prev.x - (char.x + char.width) ≈ 0).
      // Between-word: gap = 42 - (24 + 8) = 10 > 3.6 threshold → space.
      const chars = [
        makeChar("H", 50, 0),
        makeChar("i", 42, 1),
        makeChar("t", 24, 2),
        makeChar("h", 16, 3),
        makeChar("e", 8, 4),
        makeChar("r", 0, 5),
      ];

      const lines = groupCharsIntoLines(chars);

      expect(lines).toHaveLength(1);
      expect(lines[0].text).toBe("Hi ther");
    });

    it("inserts multiple spaces in RTL-placed lines with three words", () => {
      // Three words "AB CD EF" placed right-to-left.
      // Within-word gap = prev.x - (char.x + 8) = 0 → no space.
      // Between-word gap = 10 > 3.6 → space.
      const chars = [
        makeChar("A", 52, 0),
        makeChar("B", 44, 1), // gap = 52 - 52 = 0 → no space
        makeChar("C", 28, 2), // gap = 44 - 36 = 8 → space
        makeChar("D", 20, 3), // gap = 28 - 28 = 0 → no space
        makeChar("E", 4, 4), // gap = 20 - 12 = 8 → space
        makeChar("F", -4, 5), // gap = 4 - 4 = 0 → no space
      ];

      const lines = groupCharsIntoLines(chars);

      expect(lines).toHaveLength(1);
      expect(lines[0].text).toBe("AB CD EF");
    });

    it("handles overlapping RTL-placed characters without crashing", () => {
      // Tightly kerned chars where bboxes overlap slightly.
      // gap = prevChar.x - (char.x + char.width) → negative → no space
      const chars = [
        makeChar("A", 20, 0),
        makeChar("B", 13, 1), // gap = 20 - 21 = -1 → no space (overlap)
        makeChar("C", 6, 2), // gap = 13 - 14 = -1 → no space (overlap)
        makeChar("D", -1, 3), // gap = 6 - 7 = -1 → no space (overlap)
      ];

      const lines = groupCharsIntoLines(chars);

      expect(lines).toHaveLength(1);
      expect(lines[0].text).toBe("ABCD");
    });

    it("handles mixed RTL-placed and LTR lines on the same page", () => {
      // Line 1 (baseline 100): RTL-placed text (decreasing x in stream order)
      // Line 2 (baseline 80): normal LTR text (increasing x)
      // Each line's RTL detection is independent.
      const chars: ExtractedChar[] = [
        // RTL-placed line — adjacent chars (no spaces)
        { ...makeChar("R", 24, 0), baseline: 100, bbox: { x: 24, y: 90, width: 8, height: 12 } },
        { ...makeChar("T", 16, 1), baseline: 100, bbox: { x: 16, y: 90, width: 8, height: 12 } },
        { ...makeChar("L", 8, 2), baseline: 100, bbox: { x: 8, y: 90, width: 8, height: 12 } },
        // Normal LTR line — adjacent chars (no spaces)
        { ...makeChar("L", 0, 3), baseline: 80, bbox: { x: 0, y: 70, width: 8, height: 12 } },
        { ...makeChar("T", 8, 4), baseline: 80, bbox: { x: 8, y: 70, width: 8, height: 12 } },
        { ...makeChar("R", 16, 5), baseline: 80, bbox: { x: 16, y: 70, width: 8, height: 12 } },
      ];

      const lines = groupCharsIntoLines(chars);

      expect(lines).toHaveLength(2);
      // Line 1 (higher baseline): RTL-placed → stream order preserved
      expect(lines[0].text).toBe("RTL");
      expect(lines[0].baseline).toBe(100);
      // Line 2 (lower baseline): normal LTR → x-sort
      expect(lines[1].text).toBe("LTR");
      expect(lines[1].baseline).toBe(80);
    });

    it("falls back to x-sort when sequenceIndex is missing", () => {
      // Chars placed right-to-left but without sequenceIndex — should x-sort
      const chars = [
        makeChar("A", 30, undefined),
        makeChar("B", 20, undefined),
        makeChar("C", 10, undefined),
        makeChar("D", 0, undefined),
      ];

      const lines = groupCharsIntoLines(chars);

      expect(lines).toHaveLength(1);
      // x-sort produces D(0), C(10), B(20), A(30)
      expect(lines[0].text).toBe("DCBA");
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
          sequenceIndex: 0,
        },
        {
          char: "1",
          bbox: { x: 10, y: 90, width: 8, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 100,
          sequenceIndex: 1,
        },
        {
          char: "L",
          bbox: { x: 0, y: 70, width: 10, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 80,
          sequenceIndex: 2,
        },
        {
          char: "2",
          bbox: { x: 10, y: 70, width: 8, height: 12 },
          fontSize: 12,
          fontName: "Helvetica",
          baseline: 80,
          sequenceIndex: 3,
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
