import { describe, expect, it } from "vitest";

import { parseSvgPath } from "./path-parser";

describe("parseSvgPath", () => {
  describe("basic commands", () => {
    it("parses moveTo (M)", () => {
      const commands = parseSvgPath("M 10 20");

      expect(commands).toEqual([{ type: "M", x: 10, y: 20 }]);
    });

    it("parses lineTo (L)", () => {
      const commands = parseSvgPath("M 0 0 L 100 200");

      expect(commands).toHaveLength(2);
      expect(commands[1]).toEqual({ type: "L", x: 100, y: 200 });
    });

    it("parses horizontal line (H)", () => {
      const commands = parseSvgPath("M 0 0 H 100");

      expect(commands).toHaveLength(2);
      expect(commands[1]).toEqual({ type: "H", x: 100 });
    });

    it("parses vertical line (V)", () => {
      const commands = parseSvgPath("M 0 0 V 100");

      expect(commands).toHaveLength(2);
      expect(commands[1]).toEqual({ type: "V", y: 100 });
    });

    it("parses cubic bezier (C)", () => {
      const commands = parseSvgPath("M 0 0 C 10 20 30 40 50 60");

      expect(commands).toHaveLength(2);
      expect(commands[1]).toEqual({
        type: "C",
        x1: 10,
        y1: 20,
        x2: 30,
        y2: 40,
        x: 50,
        y: 60,
      });
    });

    it("parses smooth cubic (S)", () => {
      const commands = parseSvgPath("M 0 0 S 30 40 50 60");

      expect(commands).toHaveLength(2);
      expect(commands[1]).toEqual({
        type: "S",
        x2: 30,
        y2: 40,
        x: 50,
        y: 60,
      });
    });

    it("parses quadratic bezier (Q)", () => {
      const commands = parseSvgPath("M 0 0 Q 50 100 100 0");

      expect(commands).toHaveLength(2);
      expect(commands[1]).toEqual({
        type: "Q",
        x1: 50,
        y1: 100,
        x: 100,
        y: 0,
      });
    });

    it("parses smooth quadratic (T)", () => {
      const commands = parseSvgPath("M 0 0 T 100 0");

      expect(commands).toHaveLength(2);
      expect(commands[1]).toEqual({ type: "T", x: 100, y: 0 });
    });

    it("parses arc (A)", () => {
      const commands = parseSvgPath("M 0 0 A 25 25 0 0 1 50 50");

      expect(commands).toHaveLength(2);
      expect(commands[1]).toEqual({
        type: "A",
        rx: 25,
        ry: 25,
        xAxisRotation: 0,
        largeArcFlag: false,
        sweepFlag: true,
        x: 50,
        y: 50,
      });
    });

    it("parses arc with large-arc flag", () => {
      const commands = parseSvgPath("M 0 0 A 25 25 0 1 0 50 50");

      expect(commands[1]).toEqual({
        type: "A",
        rx: 25,
        ry: 25,
        xAxisRotation: 0,
        largeArcFlag: true,
        sweepFlag: false,
        x: 50,
        y: 50,
      });
    });

    it("parses closePath (Z)", () => {
      const commands = parseSvgPath("M 0 0 L 100 0 L 50 100 Z");

      expect(commands).toHaveLength(4);
      expect(commands[3]).toEqual({ type: "Z" });
    });
  });

  describe("relative commands", () => {
    it("parses relative moveTo (m)", () => {
      const commands = parseSvgPath("m 10 20");

      expect(commands).toEqual([{ type: "m", x: 10, y: 20 }]);
    });

    it("parses relative lineTo (l)", () => {
      const commands = parseSvgPath("M 0 0 l 100 200");

      expect(commands[1]).toEqual({ type: "l", x: 100, y: 200 });
    });

    it("parses relative horizontal line (h)", () => {
      const commands = parseSvgPath("M 0 0 h 100");

      expect(commands[1]).toEqual({ type: "h", x: 100 });
    });

    it("parses relative vertical line (v)", () => {
      const commands = parseSvgPath("M 0 0 v 100");

      expect(commands[1]).toEqual({ type: "v", y: 100 });
    });

    it("parses relative cubic bezier (c)", () => {
      const commands = parseSvgPath("M 0 0 c 10 20 30 40 50 60");

      expect(commands[1]).toEqual({
        type: "c",
        x1: 10,
        y1: 20,
        x2: 30,
        y2: 40,
        x: 50,
        y: 60,
      });
    });

    it("parses relative smooth cubic (s)", () => {
      const commands = parseSvgPath("M 0 0 s 30 40 50 60");

      expect(commands[1]).toEqual({
        type: "s",
        x2: 30,
        y2: 40,
        x: 50,
        y: 60,
      });
    });

    it("parses relative quadratic bezier (q)", () => {
      const commands = parseSvgPath("M 0 0 q 50 100 100 0");

      expect(commands[1]).toEqual({
        type: "q",
        x1: 50,
        y1: 100,
        x: 100,
        y: 0,
      });
    });

    it("parses relative smooth quadratic (t)", () => {
      const commands = parseSvgPath("M 0 0 t 100 0");

      expect(commands[1]).toEqual({ type: "t", x: 100, y: 0 });
    });

    it("parses relative arc (a)", () => {
      const commands = parseSvgPath("M 0 0 a 25 25 0 0 1 50 50");

      expect(commands[1]).toEqual({
        type: "a",
        rx: 25,
        ry: 25,
        xAxisRotation: 0,
        largeArcFlag: false,
        sweepFlag: true,
        x: 50,
        y: 50,
      });
    });

    it("parses relative closePath (z)", () => {
      const commands = parseSvgPath("M 0 0 l 100 0 l -50 100 z");

      expect(commands[3]).toEqual({ type: "z" });
    });
  });

  describe("number formats", () => {
    it("parses integers", () => {
      const commands = parseSvgPath("M 10 20");

      expect(commands[0]).toEqual({ type: "M", x: 10, y: 20 });
    });

    it("parses decimals", () => {
      const commands = parseSvgPath("M 10.5 20.75");

      expect(commands[0]).toEqual({ type: "M", x: 10.5, y: 20.75 });
    });

    it("parses negative numbers", () => {
      const commands = parseSvgPath("M -10 -20");

      expect(commands[0]).toEqual({ type: "M", x: -10, y: -20 });
    });

    it("parses leading decimals (no leading zero)", () => {
      const commands = parseSvgPath("M .5 .75");

      expect(commands[0]).toEqual({ type: "M", x: 0.5, y: 0.75 });
    });

    it("parses scientific notation", () => {
      const commands = parseSvgPath("M 1e2 2e-3");

      expect(commands[0]).toEqual({ type: "M", x: 100, y: 0.002 });
    });

    it("parses scientific notation with uppercase E", () => {
      const commands = parseSvgPath("M 1E2 2E+3");

      expect(commands[0]).toEqual({ type: "M", x: 100, y: 2000 });
    });
  });

  describe("whitespace and separators", () => {
    it("handles spaces between values", () => {
      const commands = parseSvgPath("M 10 20 L 30 40");

      expect(commands).toHaveLength(2);
    });

    it("handles commas between values", () => {
      const commands = parseSvgPath("M10,20 L30,40");

      expect(commands).toHaveLength(2);
      expect(commands[0]).toEqual({ type: "M", x: 10, y: 20 });
      expect(commands[1]).toEqual({ type: "L", x: 30, y: 40 });
    });

    it("handles no separator with negative sign", () => {
      const commands = parseSvgPath("M10-20 L30-40");

      expect(commands).toHaveLength(2);
      expect(commands[0]).toEqual({ type: "M", x: 10, y: -20 });
      expect(commands[1]).toEqual({ type: "L", x: 30, y: -40 });
    });

    it("handles no separator with decimal point", () => {
      const commands = parseSvgPath("M.5.5 L1.5.5");

      expect(commands).toHaveLength(2);
      expect(commands[0]).toEqual({ type: "M", x: 0.5, y: 0.5 });
      expect(commands[1]).toEqual({ type: "L", x: 1.5, y: 0.5 });
    });

    it("handles tabs and newlines", () => {
      const commands = parseSvgPath("M\t10\n20\rL\r\n30\t40");

      expect(commands).toHaveLength(2);
    });

    it("handles no space between command and number", () => {
      const commands = parseSvgPath("M10 20L30 40");

      expect(commands).toHaveLength(2);
    });
  });

  describe("repeated commands", () => {
    it("handles multiple coordinate pairs after L", () => {
      const commands = parseSvgPath("M 0 0 L 10 10 20 20 30 30");

      expect(commands).toHaveLength(4);
      expect(commands[1]).toEqual({ type: "L", x: 10, y: 10 });
      expect(commands[2]).toEqual({ type: "L", x: 20, y: 20 });
      expect(commands[3]).toEqual({ type: "L", x: 30, y: 30 });
    });

    it("converts implicit commands after M to L", () => {
      // After M, subsequent coordinate pairs become L commands
      const commands = parseSvgPath("M 10 10 20 20 30 30");

      expect(commands).toHaveLength(3);
      expect(commands[0]).toEqual({ type: "M", x: 10, y: 10 });
      expect(commands[1]).toEqual({ type: "L", x: 20, y: 20 });
      expect(commands[2]).toEqual({ type: "L", x: 30, y: 30 });
    });

    it("converts implicit commands after m to l", () => {
      // After m, subsequent coordinate pairs become l commands
      const commands = parseSvgPath("m 10 10 20 20 30 30");

      expect(commands).toHaveLength(3);
      expect(commands[0]).toEqual({ type: "m", x: 10, y: 10 });
      expect(commands[1]).toEqual({ type: "l", x: 20, y: 20 });
      expect(commands[2]).toEqual({ type: "l", x: 30, y: 30 });
    });

    it("handles multiple cubic bezier curves", () => {
      const commands = parseSvgPath("M 0 0 C 1 2 3 4 5 6 7 8 9 10 11 12");

      expect(commands).toHaveLength(3);
      expect(commands[1]).toEqual({
        type: "C",
        x1: 1,
        y1: 2,
        x2: 3,
        y2: 4,
        x: 5,
        y: 6,
      });
      expect(commands[2]).toEqual({
        type: "C",
        x1: 7,
        y1: 8,
        x2: 9,
        y2: 10,
        x: 11,
        y: 12,
      });
    });
  });

  describe("complex paths", () => {
    it("parses a triangle", () => {
      const commands = parseSvgPath("M 0 0 L 100 0 L 50 100 Z");

      expect(commands).toHaveLength(4);
    });

    it("parses a rectangle with close", () => {
      const commands = parseSvgPath("M 0 0 H 100 V 50 H 0 Z");

      expect(commands).toHaveLength(5);
    });

    it("parses a heart shape", () => {
      const path = "M 10,30 A 20,20 0,0,1 50,30 A 20,20 0,0,1 90,30 Q 90,60 50,90 Q 10,60 10,30 Z";
      const commands = parseSvgPath(path);

      expect(commands).toHaveLength(6);
      expect(commands[0].type).toBe("M");
      expect(commands[1].type).toBe("A");
      expect(commands[2].type).toBe("A");
      expect(commands[3].type).toBe("Q");
      expect(commands[4].type).toBe("Q");
      expect(commands[5].type).toBe("Z");
    });

    it("parses multiple subpaths", () => {
      const path = "M 0 0 L 100 0 L 100 100 L 0 100 Z M 25 25 L 75 25 L 75 75 L 25 75 Z";
      const commands = parseSvgPath(path);

      expect(commands).toHaveLength(10);
      // First subpath
      expect(commands[0]).toEqual({ type: "M", x: 0, y: 0 });
      expect(commands[4]).toEqual({ type: "Z" });
      // Second subpath
      expect(commands[5]).toEqual({ type: "M", x: 25, y: 25 });
      expect(commands[9]).toEqual({ type: "Z" });
    });
  });

  describe("arc flag edge cases", () => {
    // SVG spec allows arc flags (large-arc-flag and sweep-flag) to be written as
    // single digits without separators. For example: "a1 1 0 00.5.5" has flags 0,0
    // followed by x=0.5, y=0.5.

    it("parses flags 00 followed by decimal coordinates", () => {
      // a rx ry rotation large-arc-flag sweep-flag x y
      // a 1  1  0        0              0          .5 .5
      const commands = parseSvgPath("M0 0 a1 1 0 00.5.5");

      expect(commands).toHaveLength(2);
      expect(commands[1]).toEqual({
        type: "a",
        rx: 1,
        ry: 1,
        xAxisRotation: 0,
        largeArcFlag: false,
        sweepFlag: false,
        x: 0.5,
        y: 0.5,
      });
    });

    it("parses flags 01 followed by decimal coordinates", () => {
      const commands = parseSvgPath("M0 0 a1 1 0 01.5.5");

      expect(commands).toHaveLength(2);
      expect(commands[1]).toEqual({
        type: "a",
        rx: 1,
        ry: 1,
        xAxisRotation: 0,
        largeArcFlag: false,
        sweepFlag: true,
        x: 0.5,
        y: 0.5,
      });
    });

    it("parses flags 10 followed by decimal coordinates", () => {
      const commands = parseSvgPath("M0 0 a1 1 0 10.5.5");

      expect(commands).toHaveLength(2);
      expect(commands[1]).toEqual({
        type: "a",
        rx: 1,
        ry: 1,
        xAxisRotation: 0,
        largeArcFlag: true,
        sweepFlag: false,
        x: 0.5,
        y: 0.5,
      });
    });

    it("parses flags 11 followed by decimal coordinates", () => {
      const commands = parseSvgPath("M0 0 a1 1 0 11.5.5");

      expect(commands).toHaveLength(2);
      expect(commands[1]).toEqual({
        type: "a",
        rx: 1,
        ry: 1,
        xAxisRotation: 0,
        largeArcFlag: true,
        sweepFlag: true,
        x: 0.5,
        y: 0.5,
      });
    });

    it("parses flags followed by negative coordinates", () => {
      const commands = parseSvgPath("M0 0 a1 1 0 00-5-5");

      expect(commands).toHaveLength(2);
      expect(commands[1]).toEqual({
        type: "a",
        rx: 1,
        ry: 1,
        xAxisRotation: 0,
        largeArcFlag: false,
        sweepFlag: false,
        x: -5,
        y: -5,
      });
    });

    it("parses flags followed by integer coordinates", () => {
      const commands = parseSvgPath("M0 0 a1 1 0 0050 50");

      expect(commands).toHaveLength(2);
      expect(commands[1]).toEqual({
        type: "a",
        rx: 1,
        ry: 1,
        xAxisRotation: 0,
        largeArcFlag: false,
        sweepFlag: false,
        x: 50,
        y: 50,
      });
    });

    it("parses multiple arcs with compact flag notation", () => {
      // Two arcs: first with flags 0,0 and second with flags 1,1
      const commands = parseSvgPath("M0 0 a1 1 0 00.5.5 1 1 0 11.5.5");

      expect(commands).toHaveLength(3);
      expect(commands[1]).toEqual({
        type: "a",
        rx: 1,
        ry: 1,
        xAxisRotation: 0,
        largeArcFlag: false,
        sweepFlag: false,
        x: 0.5,
        y: 0.5,
      });
      expect(commands[2]).toEqual({
        type: "a",
        rx: 1,
        ry: 1,
        xAxisRotation: 0,
        largeArcFlag: true,
        sweepFlag: true,
        x: 0.5,
        y: 0.5,
      });
    });

    it("parses absolute arc with compact flag notation", () => {
      const commands = parseSvgPath("M0 0 A1 1 0 00.5.5");

      expect(commands).toHaveLength(2);
      expect(commands[1]).toEqual({
        type: "A",
        rx: 1,
        ry: 1,
        xAxisRotation: 0,
        largeArcFlag: false,
        sweepFlag: false,
        x: 0.5,
        y: 0.5,
      });
    });

    it("parses real-world icon path with compact flags (Docker containers)", () => {
      // Simplified from Docker logo - boxes that use arc-like compact notation patterns
      const commands = parseSvgPath("M0 0a.186.186 0 00.186-.185");

      expect(commands).toHaveLength(2);
      expect(commands[1]).toEqual({
        type: "a",
        rx: 0.186,
        ry: 0.186,
        xAxisRotation: 0,
        largeArcFlag: false,
        sweepFlag: false,
        x: 0.186,
        y: -0.185,
      });
    });
  });

  describe("edge cases", () => {
    it("skips unexpected characters between parameters", () => {
      const commands = parseSvgPath("M 0 0 X 10 10");

      expect(commands).toEqual([
        { type: "M", x: 0, y: 0 },
        { type: "L", x: 10, y: 10 },
      ]);
    });

    it("returns empty array for empty string", () => {
      const commands = parseSvgPath("");

      expect(commands).toEqual([]);
    });

    it("returns empty array for whitespace only", () => {
      const commands = parseSvgPath("   \t\n  ");

      expect(commands).toEqual([]);
    });

    it("handles path starting with whitespace", () => {
      const commands = parseSvgPath("  M 10 20");

      expect(commands).toHaveLength(1);
    });

    it("handles path with trailing whitespace", () => {
      const commands = parseSvgPath("M 10 20  ");

      expect(commands).toHaveLength(1);
    });

    it("handles Z after M (valid but draws nothing)", () => {
      const commands = parseSvgPath("M 10 20 Z");

      expect(commands).toHaveLength(2);
    });
  });
});
