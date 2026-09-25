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
      // The forward jump lands in free space so it doesn't overlap a neighbour.
      const chars = [
        makeChar("A", 50, 0),
        makeChar("B", 42, 1), // decreasing
        makeChar("C", 34, 2), // decreasing
        makeChar("D", 26, 3), // decreasing
        makeChar("E", 18, 4), // decreasing
        makeChar("F", 60, 5), // increasing (forward jump)
      ];

      const lines = groupCharsIntoLines(chars);

      expect(lines).toHaveLength(1);
      expect(lines[0].text).toBe("ABCDEF");
    });

    it("falls back to x-sort below 80% threshold", () => {
      // 6 chars → 5 pairs. 3 decreasing = 60% → NOT detected → x-sort.
      // Every char jumps to a new position, so each is its own run; none overlap.
      const chars = [
        makeChar("A", 40, 0),
        makeChar("B", 24, 1), // decreasing
        makeChar("C", 32, 2), // increasing
        makeChar("D", 8, 3), // decreasing
        makeChar("E", 16, 4), // increasing
        makeChar("F", 0, 5), // decreasing
      ];

      const lines = groupCharsIntoLines(chars);

      expect(lines).toHaveLength(1);
      // x-sorted order: F(0), D(8), E(16), B(24), C(32), A(40)
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

    it("treats array order as stream order even without sequenceIndex", () => {
      const chars = [
        makeChar("A", 30, undefined),
        makeChar("B", 20, undefined),
        makeChar("C", 10, undefined),
        makeChar("D", 0, undefined),
      ];

      const lines = groupCharsIntoLines(chars);

      expect(lines).toHaveLength(1);
      expect(lines[0].text).toBe("ABCD");
    });
  });

  describe("run-based line assembly", () => {
    function makeChar(
      char: string,
      x: number,
      options: { baseline?: number; width?: number; fontSize?: number } = {},
    ): ExtractedChar {
      const { baseline = 10, width = 6, fontSize = 12 } = options;

      return {
        char,
        bbox: { x, y: baseline - 2, width, height: fontSize },
        fontSize,
        fontName: "Helvetica",
        baseline,
      };
    }

    /** Lay out a string as adjacent glyphs starting at x. */
    function makeRun(text: string, x: number, options: Parameters<typeof makeChar>[2] = {}) {
      const width = options.width ?? 6;

      return Array.from(text, (char, i) => makeChar(char, x + i * width, options));
    }

    it("keeps a string intact when another string is drawn over it", () => {
      // Invisible field label under a template tag; x-sorting gave "winte{{xd2adtea,tre2}}"
      const label = makeRun("wintex2date", 482);
      const tag = makeRun("{{date,r2}}", 500);

      const lines = groupCharsIntoLines([...label, ...tag]);

      expect(lines).toHaveLength(2);
      expect(lines.map(l => l.text)).toEqual(["wintex2date", "{{date,r2}}"]);
    });

    it("keeps glyph order inside a run even if x-positions are not monotonic", () => {
      const chars = [
        makeChar("V", 10, { width: 8 }),
        makeChar("A", 17, { width: 8 }), // 1pt overlap with V — still the same run
      ];

      const lines = groupCharsIntoLines(chars);

      expect(lines).toHaveLength(1);
      expect(lines[0].text).toBe("VA");
    });

    it("orders non-overlapping runs left to right regardless of draw order", () => {
      const number = makeRun("42", 500);
      const title = makeRun("Title", 50);

      const lines = groupCharsIntoLines([...number, ...title]);

      expect(lines).toHaveLength(1);
      expect(lines[0].text).toBe("Title 42");
    });

    it("splits a run at a large forward jump so other text can sit in the gap", () => {
      // One TJ with a large jump; a value is drawn into the gap later
      const labels = [...makeRun("Name:", 0), ...makeRun("Date:", 200)];
      const value = makeRun("Alice", 40);

      const lines = groupCharsIntoLines([...labels, ...value]);

      expect(lines).toHaveLength(1);
      expect(lines[0].text).toBe("Name: Alice Date:");
    });

    it("starts a new line for a run that overlaps only part of an existing line", () => {
      const first = makeRun("Hello", 0);
      const overlapping = makeRun("World", 20);
      const after = makeRun("!", 100);

      const lines = groupCharsIntoLines([...first, ...overlapping, ...after]);

      expect(lines.map(l => l.text)).toEqual(["Hello !", "World"]);
    });

    it("tolerates small overlaps between adjacent runs", () => {
      const first = makeRun("fi", 0, { width: 6 });
      const second = makeRun("x", 11);

      const lines = groupCharsIntoLines([...first, ...second]);

      expect(lines).toHaveLength(1);
      expect(lines[0].text).toBe("fix");
    });

    it("lets a run fill gaps inside another run", () => {
      // "l" and "i" drawn in a second pass into gaps left by the first
      const wide = [
        makeChar("F", 0),
        makeChar("o", 6),
        makeChar("a", 18),
        makeChar("t", 24),
        makeChar("o", 36),
        makeChar("n", 42),
      ];
      const narrow = [makeChar("l", 12, { width: 3 }), makeChar("i", 15, { width: 3 })];
      const dot = [makeChar("i", 30)];

      const lines = groupCharsIntoLines([...wide, ...narrow, ...dot]);

      expect(lines).toHaveLength(1);
      expect(lines[0].text).toBe("Foliation");
    });

    it("continues a run through CJK punctuation compression", () => {
      // Full-width "、" advances 1em; the next glyph is pulled in exactly 0.5em
      const chars = [
        makeChar("人", 0, { width: 10.56, fontSize: 10.56 }),
        makeChar("、", 10.56, { width: 10.56, fontSize: 10.56 }),
        makeChar("法", 15.84, { width: 10.56, fontSize: 10.56 }),
        makeChar("人", 26.4, { width: 10.56, fontSize: 10.56 }),
      ];

      const lines = groupCharsIntoLines(chars);

      expect(lines).toHaveLength(1);
      expect(lines[0].text).toBe("人、法人");
    });

    it("ignores whitespace glyphs when checking for overlap", () => {
      // Space glyph kerned back over a ligature (AGaramond "fi ve")
      const chars = [
        makeChar("fi", 0, { width: 5 }),
        makeChar(" ", 2.5, { width: 2.4 }), // starts 2.5pt back — new run, no ink
        makeChar("v", 5, { width: 4 }),
        makeChar("e", 9, { width: 4 }),
      ];

      const lines = groupCharsIntoLines(chars);

      expect(lines).toHaveLength(1);
      expect(lines[0].text).toBe("fi ve");
    });

    it("assigns an overlapping run to the first line where it fits", () => {
      // A (0–24) and B (12–36) collide; C (6–18) collides with both; D (50–62) fits on A's line
      const a = makeRun("AAAA", 0);
      const b = makeRun("BBBB", 12);
      const c = makeRun("CC", 6);
      const d = makeRun("DD", 50);

      const lines = groupCharsIntoLines([...a, ...b, ...c, ...d]);

      expect(lines.map(l => l.text)).toEqual(["AAAA DD", "BBBB", "CC"]);
    });

    it("does not treat zero-width glyphs as overlapping", () => {
      const chars = [
        makeChar("A", 30, { width: 0 }),
        makeChar("B", 20, { width: 0 }),
        makeChar("C", 10, { width: 0 }),
      ];

      const lines = groupCharsIntoLines(chars);

      expect(lines).toHaveLength(1);
      expect(lines[0].spans.flatMap(s => s.chars).filter(c => c.char !== " ")).toHaveLength(3);
    });

    it("anchors a line on its first visible glyph, not leading spaces", () => {
      // Leading spaces sit 2pt below the letters; "Total" is 1.2pt above them
      const spaces = [makeChar(" ", 0, { baseline: 8 }), makeChar(" ", 6, { baseline: 8 })];
      const label = makeRun("Acrobatics", 12, { baseline: 10 });
      const total = makeRun("Total", 120, { baseline: 11.2 });

      const lines = groupCharsIntoLines([...spaces, ...label, ...total]);

      expect(lines).toHaveLength(1);
      expect(lines[0].text).toBe("  Acrobatics Total");
    });

    it("inserts a space at a gap that coincides with a font change", () => {
      const chars = [
        makeChar("P", 0, { fontSize: 4.5 }),
        ...makeRun("SPELL", 40, { fontSize: 6.5 }),
      ];

      const lines = groupCharsIntoLines(chars);

      expect(lines).toHaveLength(1);
      expect(lines[0].text).toBe("P SPELL");
      expect(lines[0].spans).toHaveLength(2);
      expect(lines[0].spans[0].text).toBe("P ");
    });

    it("does not synthesise a space next to a real space glyph", () => {
      const chars = [
        ...makeRun("1.", 0),
        makeChar(" ", 12, { width: 3 }),
        ...makeRun("Lorem", 30, { fontSize: 14 }),
      ];

      const lines = groupCharsIntoLines(chars);

      expect(lines[0].text).toBe("1. Lorem");
    });

    it("detects a glyph straddling two glyphs of another run", () => {
      // "s" covers 3pt of "a" and 3pt of "b": neither pair alone exceeds tolerance
      const first = makeRun("ab", 0);
      const second = [makeChar("s", 3)];

      const lines = groupCharsIntoLines([...first, ...second]);

      expect(lines.map(l => l.text)).toEqual(["ab", "s"]);
    });

    it("detects a narrow glyph fully covered by a wider one", () => {
      const wide = makeRun("mm", 0, { width: 10 });
      const narrow = [makeChar("i", 4, { width: 2 })];

      const lines = groupCharsIntoLines([...wide, ...narrow]);

      expect(lines.map(l => l.text)).toEqual(["mm", "i"]);
    });

    it("keeps an ink-less run with the run drawn before it", () => {
      // Invisible per-glyph layer placed mirrored over visible text; its space
      // glyph must not land inside the visible words
      const visible = makeRun("ab cd ef", 0);
      const layer = [
        makeChar("a", 24),
        makeChar("b", 18),
        makeChar(" ", 12),
        makeChar("c", 6),
        makeChar("d", 0),
      ];

      const lines = groupCharsIntoLines([...visible, ...layer]);

      expect(lines[0].text).toBe("ab cd ef");
    });

    it("preserves stream order for equal-baseline lines", () => {
      const label = makeRun("label", 100);
      const tag = makeRun("{{tag}}", 100);

      const lines = groupCharsIntoLines([...label, ...tag]);

      expect(lines.map(l => l.text)).toEqual(["label", "{{tag}}"]);
    });
  });

  describe("repeated glyphs", () => {
    function makeChar(
      char: string,
      x: number,
      options: { width?: number; baseline?: number } = {},
    ) {
      const { width = 6, baseline = 10 } = options;

      return {
        char,
        bbox: { x, y: baseline - 2, width, height: 12 },
        fontSize: 12,
        fontName: "Helvetica",
        baseline,
      } satisfies ExtractedChar;
    }

    function makeRun(text: string, x: number, options: Parameters<typeof makeChar>[2] = {}) {
      const width = options.width ?? 6;

      return Array.from(text, (char, i) => makeChar(char, x + i * width, options));
    }

    it("collapses fake bold (same text drawn twice with a small offset)", () => {
      const lines = groupCharsIntoLines([...makeRun("Bold", 0), ...makeRun("Bold", 0.3)]);

      expect(lines.map(l => l.text)).toEqual(["Bold"]);
    });

    it("collapses a partial redraw inside a longer line", () => {
      const line = makeRun("the 11th Amendment.", 0);
      const bold = makeRun("Amendment", 9 * 6 + 0.3);

      const lines = groupCharsIntoLines([...line, ...bold]);

      expect(lines.map(l => l.text)).toEqual(["the 11th Amendment."]);
    });

    it("drops the redrawn boundary glyph between paragraph chunks", () => {
      // Chunks scattered through the stream, each redrawing the previous
      // chunk's last glyph at a slightly different x
      const chunk1 = makeRun("By sign", 0);
      const other = makeRun("elsewhere", 0, { baseline: 50 });
      const chunk2 = makeRun("ning below", 6 * 6 - 0.12);

      const lines = groupCharsIntoLines([...chunk1, ...other, ...chunk2]);

      expect(lines.map(l => l.text)).toEqual(["elsewhere", "By signing below"]);
    });

    it("drops only the repeated glyphs and keeps the rest of the run", () => {
      const first = makeRun("abc", 0);
      const second = [makeChar("c", 12.2), makeChar("d", 18), makeChar("e", 24)];

      const lines = groupCharsIntoLines([...first, ...second]);

      expect(lines.map(l => l.text)).toEqual(["abcde"]);
    });

    it("treats a different character at the same position as a collision", () => {
      const lines = groupCharsIntoLines([...makeRun("O", 0), ...makeRun("/", 0.2)]);

      expect(lines.map(l => l.text)).toEqual(["O", "/"]);
    });

    it("lets an accent drawn over its base share the line", () => {
      // OT1 TeX: accent first, then the base glyph drawn underneath it
      const chars = [
        ...makeRun("caf", 0),
        makeChar("\u00B4", 18.5, { width: 3 }),
        makeChar("e", 18),
      ];

      const lines = groupCharsIntoLines(chars);

      expect(lines.map(l => l.text)).toEqual(["cafe\u00B4"]);
    });

    it("keeps identical text that does not overlap", () => {
      const lines = groupCharsIntoLines([...makeRun("0", 0), ...makeRun("0", 100)]);

      expect(lines.map(l => l.text)).toEqual(["0 0"]);
    });

    it("keeps overlapping lines whose text differs", () => {
      const lines = groupCharsIntoLines([...makeRun("label", 0), ...makeRun("{{tag}}", 0)]);

      expect(lines.map(l => l.text)).toEqual(["label", "{{tag}}"]);
    });

    it("keeps identical text on different baselines", () => {
      const lines = groupCharsIntoLines([
        ...makeRun("Title", 0, { baseline: 100 }),
        ...makeRun("Title", 0, { baseline: 80 }),
      ]);

      expect(lines.map(l => l.text)).toEqual(["Title", "Title"]);
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
