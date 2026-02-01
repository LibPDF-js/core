import { PathBuilder } from "#src/drawing/path-builder";
import { rgb } from "#src/helpers/colors";
import { describe, expect, it, vi } from "vitest";

const decoder = new TextDecoder();

describe("PathBuilder", () => {
  function createBuilder() {
    const appendContent = vi.fn();
    const registerGraphicsState = vi.fn(() => null);
    const builder = new PathBuilder(appendContent, registerGraphicsState);
    return { builder, appendContent, registerGraphicsState };
  }

  /** Get the content string from the first appendContent call */
  function getContent(appendContent: ReturnType<typeof vi.fn>): string {
    const raw = appendContent.mock.calls[0][0];
    return raw instanceof Uint8Array ? decoder.decode(raw) : raw;
  }

  describe("path construction", () => {
    it("moveTo adds move-to operator", () => {
      const { builder, appendContent } = createBuilder();

      builder.moveTo(10, 20).fill({ color: rgb(1, 0, 0) });

      expect(appendContent).toHaveBeenCalled();
      const content = getContent(appendContent);
      expect(content).toContain("10 20 m");
    });

    it("lineTo adds line-to operator", () => {
      const { builder, appendContent } = createBuilder();

      builder
        .moveTo(0, 0)
        .lineTo(100, 100)
        .stroke({ borderColor: rgb(0, 0, 0) });

      expect(appendContent).toHaveBeenCalled();
      const content = getContent(appendContent);
      expect(content).toContain("0 0 m");
      expect(content).toContain("100 100 l");
    });

    it("curveTo adds curve-to operator", () => {
      const { builder, appendContent } = createBuilder();

      builder.moveTo(0, 0).curveTo(10, 20, 30, 40, 50, 60).stroke();

      const content = getContent(appendContent);
      expect(content).toContain("10 20 30 40 50 60 c");
    });

    it("quadraticCurveTo converts to cubic Bezier correctly", () => {
      const { builder, appendContent } = createBuilder();

      // Start at (0, 0), control point at (50, 100), end at (100, 0)
      builder.moveTo(0, 0).quadraticCurveTo(50, 100, 100, 0).stroke();

      const content = getContent(appendContent);
      // Quadratic to cubic conversion:
      // CP1 = P0 + 2/3 * (QCP - P0) = (0,0) + 2/3 * (50,100) = (33.333, 66.667)
      // CP2 = P  + 2/3 * (QCP - P)  = (100,0) + 2/3 * (50-100, 100-0) = (100,0) + 2/3 * (-50, 100) = (66.667, 66.667)
      expect(content).toContain("0 0 m");
      // Check for curve operator with approximately correct values
      expect(content).toMatch(/33\.333.*66\.666.*66\.666.*66\.666.*100 0 c/);
    });

    it("quadraticCurveTo tracks current point correctly", () => {
      const { builder, appendContent } = createBuilder();

      // Chain two quadratic curves - the second should use end of first as start
      builder
        .moveTo(0, 0)
        .quadraticCurveTo(25, 50, 50, 0) // First curve: (0,0) -> (50,0)
        .quadraticCurveTo(75, 50, 100, 0) // Second curve: (50,0) -> (100,0)
        .stroke();

      const content = getContent(appendContent);
      // Should have two curve operators
      expect((content.match(/ c\n/g) || []).length).toBe(2);
    });

    it("close adds close-path operator", () => {
      const { builder, appendContent } = createBuilder();

      builder.moveTo(0, 0).lineTo(100, 0).lineTo(50, 100).close().fill();

      const content = getContent(appendContent);
      expect(content).toContain("h"); // close-path operator
    });
  });

  describe("convenience shapes", () => {
    it("rectangle creates a rectangular path", () => {
      const { builder, appendContent } = createBuilder();

      builder.rectangle(10, 20, 100, 50).fill();

      const content = getContent(appendContent);
      // Should have move-to, 3 line-to, and close
      expect(content).toContain("10 20 m");
      expect(content).toContain("110 20 l");
      expect(content).toContain("110 70 l");
      expect(content).toContain("10 70 l");
      expect(content).toContain("h");
    });

    it("circle creates a circular path", () => {
      const { builder, appendContent } = createBuilder();

      builder.circle(50, 50, 25).fill();

      const content = getContent(appendContent);
      // Should have move-to, 4 curve-to (Bezier approximation), and close
      expect(content).toContain("m");
      expect((content.match(/c/g) || []).length).toBe(4);
      expect(content).toContain("h");
    });

    it("ellipse creates an elliptical path", () => {
      const { builder, appendContent } = createBuilder();

      builder.ellipse(100, 100, 40, 20).fill();

      const content = getContent(appendContent);
      // Should have 4 Bezier curves
      expect((content.match(/c/g) || []).length).toBe(4);
    });
  });

  describe("painting", () => {
    it("fill uses fill operator", () => {
      const { builder, appendContent } = createBuilder();

      builder.rectangle(0, 0, 100, 100).fill({ color: rgb(1, 0, 0) });

      const content = getContent(appendContent);
      expect(content).toContain("f"); // fill operator
      expect(content).not.toMatch(/\bS\b/); // should not have stroke
    });

    it("stroke uses stroke operator", () => {
      const { builder, appendContent } = createBuilder();

      builder.rectangle(0, 0, 100, 100).stroke({ borderColor: rgb(0, 0, 1) });

      const content = getContent(appendContent);
      expect(content).toContain("S"); // stroke operator
    });

    it("fillAndStroke uses fill-and-stroke operator", () => {
      const { builder, appendContent } = createBuilder();

      builder
        .rectangle(0, 0, 100, 100)
        .fillAndStroke({ color: rgb(1, 0, 0), borderColor: rgb(0, 0, 1) });

      const content = getContent(appendContent);
      expect(content).toContain("B"); // fill-and-stroke operator
    });
  });

  describe("graphics state", () => {
    it("registers graphics state for opacity", () => {
      const { builder, registerGraphicsState } = createBuilder();

      builder.rectangle(0, 0, 100, 100).fill({ color: rgb(1, 0, 0), opacity: 0.5 });

      expect(registerGraphicsState).toHaveBeenCalledWith({
        fillOpacity: 0.5,
        strokeOpacity: undefined,
      });
    });

    it("registers graphics state for border opacity", () => {
      const { builder, registerGraphicsState } = createBuilder();

      builder.rectangle(0, 0, 100, 100).stroke({ borderColor: rgb(0, 0, 1), borderOpacity: 0.7 });

      expect(registerGraphicsState).toHaveBeenCalledWith({
        fillOpacity: undefined,
        strokeOpacity: 0.7,
      });
    });
  });

  describe("clipping", () => {
    it("clip uses clip operator", () => {
      const { builder, appendContent } = createBuilder();

      builder.rectangle(0, 0, 100, 100).clip();

      const content = getContent(appendContent);
      expect(content).toContain("W"); // clip operator
    });

    it("clipEvenOdd uses even-odd clip operator", () => {
      const { builder, appendContent } = createBuilder();

      builder.rectangle(0, 0, 100, 100).clipEvenOdd();

      const content = getContent(appendContent);
      expect(content).toContain("W*"); // even-odd clip operator
    });
  });

  describe("chaining", () => {
    it("supports method chaining for complex paths", () => {
      const { builder, appendContent } = createBuilder();

      builder
        .moveTo(0, 0)
        .lineTo(100, 0)
        .lineTo(100, 100)
        .lineTo(0, 100)
        .close()
        .fill({ color: rgb(0.5, 0.5, 0.5) });

      expect(appendContent).toHaveBeenCalled();
    });
  });

  describe("appendSvgPath", () => {
    it("parses and appends simple SVG path", () => {
      const { builder, appendContent } = createBuilder();

      builder.appendSvgPath("M 10 20 L 100 200").stroke();

      const content = getContent(appendContent);
      expect(content).toContain("10 20 m");
      expect(content).toContain("100 200 l");
    });

    it("handles relative commands from current position", () => {
      const { builder, appendContent } = createBuilder();

      // Start at (100, 100), then draw relative line (50, 50)
      builder.moveTo(100, 100).appendSvgPath("l 50 50").stroke();

      const content = getContent(appendContent);
      expect(content).toContain("100 100 m");
      expect(content).toContain("150 150 l"); // 100+50, 100+50
    });

    it("handles triangle path", () => {
      const { builder, appendContent } = createBuilder();

      builder.appendSvgPath("M 10 10 L 100 10 L 55 90 Z").fill();

      const content = getContent(appendContent);
      expect(content).toContain("10 10 m");
      expect(content).toContain("100 10 l");
      expect(content).toContain("55 90 l");
      expect(content).toContain("h"); // close path
    });

    it("handles cubic bezier curves", () => {
      const { builder, appendContent } = createBuilder();

      builder.appendSvgPath("M 0 0 C 10 20 30 40 50 60").stroke();

      const content = getContent(appendContent);
      expect(content).toContain("10 20 30 40 50 60 c");
    });

    it("handles quadratic curves (converted to cubic)", () => {
      const { builder, appendContent } = createBuilder();

      builder.appendSvgPath("M 0 0 Q 50 100 100 0").stroke();

      const content = getContent(appendContent);
      // Should have a cubic curve (quadratic converted)
      expect(content).toMatch(/c/);
    });

    it("handles smooth cubic curves (S)", () => {
      const { builder, appendContent } = createBuilder();

      builder.appendSvgPath("M 0 0 C 20 20 80 80 100 100 S 180 180 200 200").stroke();

      const content = getContent(appendContent);
      // Should have two cubic curves
      expect((content.match(/\d+ c/g) || []).length).toBe(2);
    });

    it("handles arcs (converted to beziers)", () => {
      const { builder, appendContent } = createBuilder();

      builder.appendSvgPath("M 100 50 A 50 50 0 0 1 50 100").stroke();

      const content = getContent(appendContent);
      // Arc should be converted to at least one bezier curve
      expect(content).toMatch(/c/);
    });

    it("handles horizontal and vertical lines", () => {
      const { builder, appendContent } = createBuilder();

      builder.appendSvgPath("M 0 0 H 100 V 50").stroke();

      const content = getContent(appendContent);
      expect(content).toContain("100 0 l"); // H 100 from (0,0)
      expect(content).toContain("100 50 l"); // V 50 from (100,0)
    });

    it("chains with other PathBuilder methods", () => {
      const { builder, appendContent } = createBuilder();

      builder.moveTo(0, 0).appendSvgPath("l 50 50").lineTo(200, 200).close().stroke();

      const content = getContent(appendContent);
      expect(content).toContain("0 0 m");
      expect(content).toContain("50 50 l"); // relative from (0,0)
      expect(content).toContain("200 200 l"); // absolute
      expect(content).toContain("h");
    });

    it("handles multiple subpaths", () => {
      const { builder, appendContent } = createBuilder();

      builder
        .appendSvgPath("M 0 0 L 100 0 L 100 100 L 0 100 Z M 25 25 L 75 25 L 75 75 L 25 75 Z")
        .fill({ windingRule: "evenodd" });

      const content = getContent(appendContent);
      // Two move-to commands for two subpaths
      expect((content.match(/ m/g) || []).length).toBe(2);
      // Two close-path commands
      expect((content.match(/h/g) || []).length).toBe(2);
    });

    it("handles heart shape with arcs", () => {
      const { builder, appendContent } = createBuilder();

      builder
        .appendSvgPath(
          "M 10,30 A 20,20 0,0,1 50,30 A 20,20 0,0,1 90,30 Q 90,60 50,90 Q 10,60 10,30 Z",
        )
        .fill();

      const content = getContent(appendContent);
      expect(content).toContain("10 30 m"); // Move to start
      // Should have bezier curves (from arcs and quadratics)
      expect(content).toMatch(/c/);
      expect(content).toContain("h"); // Close path
    });

    it("returns this for chaining", () => {
      const { builder } = createBuilder();

      const result = builder.appendSvgPath("M 0 0 L 100 100");

      expect(result).toBe(builder);
    });
  });
});
