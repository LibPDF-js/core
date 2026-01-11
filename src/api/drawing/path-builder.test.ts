import { describe, expect, it, vi } from "vitest";
import { rgb } from "#src/helpers/colors";
import { PathBuilder } from "./path-builder";

describe("PathBuilder", () => {
  function createBuilder() {
    const appendContent = vi.fn();
    const registerGraphicsState = vi.fn(() => null);
    const builder = new PathBuilder(appendContent, registerGraphicsState);
    return { builder, appendContent, registerGraphicsState };
  }

  describe("path construction", () => {
    it("moveTo adds move-to operator", () => {
      const { builder, appendContent } = createBuilder();

      builder.moveTo(10, 20).fill({ color: rgb(1, 0, 0) });

      expect(appendContent).toHaveBeenCalled();
      const content = appendContent.mock.calls[0][0];
      expect(content).toContain("10 20 m");
    });

    it("lineTo adds line-to operator", () => {
      const { builder, appendContent } = createBuilder();

      builder
        .moveTo(0, 0)
        .lineTo(100, 100)
        .stroke({ borderColor: rgb(0, 0, 0) });

      expect(appendContent).toHaveBeenCalled();
      const content = appendContent.mock.calls[0][0];
      expect(content).toContain("0 0 m");
      expect(content).toContain("100 100 l");
    });

    it("curveTo adds curve-to operator", () => {
      const { builder, appendContent } = createBuilder();

      builder.moveTo(0, 0).curveTo(10, 20, 30, 40, 50, 60).stroke();

      const content = appendContent.mock.calls[0][0];
      expect(content).toContain("10 20 30 40 50 60 c");
    });

    it("quadraticCurveTo converts to cubic Bezier correctly", () => {
      const { builder, appendContent } = createBuilder();

      // Start at (0, 0), control point at (50, 100), end at (100, 0)
      builder.moveTo(0, 0).quadraticCurveTo(50, 100, 100, 0).stroke();

      const content = appendContent.mock.calls[0][0];
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

      const content = appendContent.mock.calls[0][0];
      // Should have two curve operators
      expect((content.match(/ c\n/g) || []).length).toBe(2);
    });

    it("close adds close-path operator", () => {
      const { builder, appendContent } = createBuilder();

      builder.moveTo(0, 0).lineTo(100, 0).lineTo(50, 100).close().fill();

      const content = appendContent.mock.calls[0][0];
      expect(content).toContain("h"); // close-path operator
    });
  });

  describe("convenience shapes", () => {
    it("rectangle creates a rectangular path", () => {
      const { builder, appendContent } = createBuilder();

      builder.rectangle(10, 20, 100, 50).fill();

      const content = appendContent.mock.calls[0][0];
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

      const content = appendContent.mock.calls[0][0];
      // Should have move-to, 4 curve-to (Bezier approximation), and close
      expect(content).toContain("m");
      expect((content.match(/c/g) || []).length).toBe(4);
      expect(content).toContain("h");
    });

    it("ellipse creates an elliptical path", () => {
      const { builder, appendContent } = createBuilder();

      builder.ellipse(100, 100, 40, 20).fill();

      const content = appendContent.mock.calls[0][0];
      // Should have 4 Bezier curves
      expect((content.match(/c/g) || []).length).toBe(4);
    });
  });

  describe("painting", () => {
    it("fill uses fill operator", () => {
      const { builder, appendContent } = createBuilder();

      builder.rectangle(0, 0, 100, 100).fill({ color: rgb(1, 0, 0) });

      const content = appendContent.mock.calls[0][0];
      expect(content).toContain("f"); // fill operator
      expect(content).not.toMatch(/\bS\b/); // should not have stroke
    });

    it("stroke uses stroke operator", () => {
      const { builder, appendContent } = createBuilder();

      builder.rectangle(0, 0, 100, 100).stroke({ borderColor: rgb(0, 0, 1) });

      const content = appendContent.mock.calls[0][0];
      expect(content).toContain("S"); // stroke operator
    });

    it("fillAndStroke uses fill-and-stroke operator", () => {
      const { builder, appendContent } = createBuilder();

      builder
        .rectangle(0, 0, 100, 100)
        .fillAndStroke({ color: rgb(1, 0, 0), borderColor: rgb(0, 0, 1) });

      const content = appendContent.mock.calls[0][0];
      expect(content).toContain("B"); // fill-and-stroke operator
    });
  });

  describe("graphics state", () => {
    it("registers graphics state for opacity", () => {
      const { builder, registerGraphicsState } = createBuilder();

      builder.rectangle(0, 0, 100, 100).fill({ color: rgb(1, 0, 0), opacity: 0.5 });

      expect(registerGraphicsState).toHaveBeenCalledWith(0.5, undefined);
    });

    it("registers graphics state for border opacity", () => {
      const { builder, registerGraphicsState } = createBuilder();

      builder.rectangle(0, 0, 100, 100).stroke({ borderColor: rgb(0, 0, 1), borderOpacity: 0.7 });

      expect(registerGraphicsState).toHaveBeenCalledWith(undefined, 0.7);
    });
  });

  describe("clipping", () => {
    it("clip uses clip operator", () => {
      const { builder, appendContent } = createBuilder();

      builder.rectangle(0, 0, 100, 100).clip();

      const content = appendContent.mock.calls[0][0];
      expect(content).toContain("W"); // clip operator
    });

    it("clipEvenOdd uses even-odd clip operator", () => {
      const { builder, appendContent } = createBuilder();

      builder.rectangle(0, 0, 100, 100).clipEvenOdd();

      const content = appendContent.mock.calls[0][0];
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
});
