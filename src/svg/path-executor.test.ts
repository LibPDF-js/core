import { describe, expect, it, vi } from "vitest";

import { executeSvgPath, executeSvgPathString, type PathSink } from "./path-executor";
import { parseSvgPath } from "./path-parser";

describe("executeSvgPath", () => {
  function createMockSink() {
    return {
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      curveTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      close: vi.fn(),
    };
  }

  // Use flipY: false for all tests to test raw execution logic
  const noFlip = { flipY: false };

  describe("basic commands", () => {
    it("executes moveTo", () => {
      const sink = createMockSink();
      const commands = parseSvgPath("M 10 20");

      executeSvgPath({ commands, sink, ...noFlip });

      expect(sink.moveTo).toHaveBeenCalledWith(10, 20);
    });

    it("executes lineTo", () => {
      const sink = createMockSink();
      const commands = parseSvgPath("M 0 0 L 100 200");

      executeSvgPath({ commands, sink, ...noFlip });

      expect(sink.lineTo).toHaveBeenCalledWith(100, 200);
    });

    it("executes horizontal line", () => {
      const sink = createMockSink();
      const commands = parseSvgPath("M 10 20 H 100");

      executeSvgPath({ commands, sink, ...noFlip });

      expect(sink.lineTo).toHaveBeenCalledWith(100, 20);
    });

    it("executes vertical line", () => {
      const sink = createMockSink();
      const commands = parseSvgPath("M 10 20 V 100");

      executeSvgPath({ commands, sink, ...noFlip });

      expect(sink.lineTo).toHaveBeenCalledWith(10, 100);
    });

    it("executes cubic bezier", () => {
      const sink = createMockSink();
      const commands = parseSvgPath("M 0 0 C 10 20 30 40 50 60");

      executeSvgPath({ commands, sink, ...noFlip });

      expect(sink.curveTo).toHaveBeenCalledWith(10, 20, 30, 40, 50, 60);
    });

    it("executes quadratic bezier", () => {
      const sink = createMockSink();
      const commands = parseSvgPath("M 0 0 Q 50 100 100 0");

      executeSvgPath({ commands, sink, ...noFlip });

      expect(sink.quadraticCurveTo).toHaveBeenCalledWith(50, 100, 100, 0);
    });

    it("executes close path", () => {
      const sink = createMockSink();
      const commands = parseSvgPath("M 0 0 L 100 0 L 50 100 Z");

      executeSvgPath({ commands, sink, ...noFlip });

      expect(sink.close).toHaveBeenCalled();
    });
  });

  describe("relative coordinates", () => {
    it("converts relative moveTo to absolute", () => {
      const sink = createMockSink();
      const commands = parseSvgPath("m 10 20");

      // When starting from (0, 0), relative is same as absolute
      executeSvgPath({ commands, sink, ...noFlip });

      expect(sink.moveTo).toHaveBeenCalledWith(10, 20);
    });

    it("applies translation to initial relative move", () => {
      const sink = createMockSink();
      const commands = parseSvgPath("m 10 10 l 5 0");

      executeSvgPath({ commands, sink, flipY: false, translateX: 100, translateY: 200 });

      expect(sink.moveTo).toHaveBeenCalledWith(110, 210);
      expect(sink.lineTo).toHaveBeenCalledWith(115, 210);
    });

    it("converts relative lineTo to absolute", () => {
      const sink = createMockSink();
      const commands = parseSvgPath("M 100 100 l 50 50");

      executeSvgPath({ commands, sink, ...noFlip });

      expect(sink.lineTo).toHaveBeenCalledWith(150, 150);
    });

    it("converts relative horizontal line to absolute", () => {
      const sink = createMockSink();
      const commands = parseSvgPath("M 100 50 h 25");

      executeSvgPath({ commands, sink, ...noFlip });

      expect(sink.lineTo).toHaveBeenCalledWith(125, 50);
    });

    it("converts relative vertical line to absolute", () => {
      const sink = createMockSink();
      const commands = parseSvgPath("M 50 100 v 25");

      executeSvgPath({ commands, sink, ...noFlip });

      expect(sink.lineTo).toHaveBeenCalledWith(50, 125);
    });

    it("converts relative cubic bezier to absolute", () => {
      const sink = createMockSink();
      const commands = parseSvgPath("M 100 100 c 10 20 30 40 50 60");

      executeSvgPath({ commands, sink, ...noFlip });

      expect(sink.curveTo).toHaveBeenCalledWith(110, 120, 130, 140, 150, 160);
    });

    it("converts relative quadratic bezier to absolute", () => {
      const sink = createMockSink();
      const commands = parseSvgPath("M 100 100 q 25 50 50 0");

      executeSvgPath({ commands, sink, ...noFlip });

      expect(sink.quadraticCurveTo).toHaveBeenCalledWith(125, 150, 150, 100);
    });

    it("handles chain of relative commands", () => {
      const sink = createMockSink();
      const commands = parseSvgPath("M 0 0 l 10 10 l 10 10 l 10 10");

      executeSvgPath({ commands, sink, ...noFlip });

      expect(sink.lineTo).toHaveBeenNthCalledWith(1, 10, 10);
      expect(sink.lineTo).toHaveBeenNthCalledWith(2, 20, 20);
      expect(sink.lineTo).toHaveBeenNthCalledWith(3, 30, 30);
    });
  });

  describe("smooth curves", () => {
    it("reflects control point for smooth cubic after C", () => {
      const sink = createMockSink();
      // First curve ends with CP2 at (80, 80) and endpoint at (100, 100)
      // Smooth curve should reflect CP2 around endpoint: 2*100-80=120, 2*100-80=120
      const commands = parseSvgPath("M 0 0 C 20 20 80 80 100 100 S 180 180 200 200");

      executeSvgPath({ commands, sink, ...noFlip });

      // First curve
      expect(sink.curveTo).toHaveBeenNthCalledWith(1, 20, 20, 80, 80, 100, 100);
      // Second curve - reflected CP1 is (120, 120)
      expect(sink.curveTo).toHaveBeenNthCalledWith(2, 120, 120, 180, 180, 200, 200);
    });

    it("uses current point as CP1 when S not preceded by C", () => {
      const sink = createMockSink();
      // When S is not after C/c/S/s, first control point equals current point
      const commands = parseSvgPath("M 100 100 S 150 150 200 200");

      executeSvgPath({ commands, sink, ...noFlip });

      // CP1 should equal current point (100, 100)
      expect(sink.curveTo).toHaveBeenCalledWith(100, 100, 150, 150, 200, 200);
    });

    it("reflects control point for smooth quadratic after Q", () => {
      const sink = createMockSink();
      // First quadratic has CP at (50, 100), endpoint at (100, 0)
      // Smooth should reflect: 2*100-50=150, 2*0-100=-100
      const commands = parseSvgPath("M 0 0 Q 50 100 100 0 T 200 0");

      executeSvgPath({ commands, sink, ...noFlip });

      expect(sink.quadraticCurveTo).toHaveBeenNthCalledWith(1, 50, 100, 100, 0);
      expect(sink.quadraticCurveTo).toHaveBeenNthCalledWith(2, 150, -100, 200, 0);
    });

    it("uses current point as CP when T not preceded by Q", () => {
      const sink = createMockSink();
      const commands = parseSvgPath("M 100 100 T 200 200");

      executeSvgPath({ commands, sink, ...noFlip });

      // CP should equal current point (100, 100), making it effectively a line
      expect(sink.quadraticCurveTo).toHaveBeenCalledWith(100, 100, 200, 200);
    });

    it("handles chain of smooth cubic curves", () => {
      const sink = createMockSink();
      const commands = parseSvgPath("M 0 0 C 0 50 50 100 100 100 S 200 100 200 50 S 150 0 100 0");

      executeSvgPath({ commands, sink, ...noFlip });

      expect(sink.curveTo).toHaveBeenCalledTimes(3);
    });

    it("handles relative smooth cubic", () => {
      const sink = createMockSink();
      const commands = parseSvgPath("M 0 0 C 20 20 80 80 100 100 s 80 80 100 100");

      executeSvgPath({ commands, sink, ...noFlip });

      // Reflected CP1: 2*100-80=120, 2*100-80=120
      // Relative CP2: 100+80=180, 100+80=180
      // Relative endpoint: 100+100=200, 100+100=200
      expect(sink.curveTo).toHaveBeenNthCalledWith(2, 120, 120, 180, 180, 200, 200);
    });
  });

  describe("arc commands", () => {
    it("converts arc to cubic bezier curves", () => {
      const sink = createMockSink();
      const commands = parseSvgPath("M 100 50 A 50 50 0 0 1 50 100");

      executeSvgPath({ commands, sink, ...noFlip });

      // Arc should be converted to at least one bezier curve
      expect(sink.curveTo).toHaveBeenCalled();
    });

    it("handles relative arc", () => {
      const sink = createMockSink();
      const commands = parseSvgPath("M 100 50 a 50 50 0 0 1 -50 50");

      executeSvgPath({ commands, sink, ...noFlip });

      // Should convert arc ending at (50, 100) relative to start
      expect(sink.curveTo).toHaveBeenCalled();

      // Get the final curve's endpoint
      const lastCall = sink.curveTo.mock.calls[sink.curveTo.mock.calls.length - 1];
      expect(lastCall[4]).toBeCloseTo(50, 1); // x
      expect(lastCall[5]).toBeCloseTo(100, 1); // y
    });

    it("handles zero-radius arc as degenerate case", () => {
      const sink = createMockSink();
      const commands = parseSvgPath("M 0 0 A 0 0 0 0 1 50 50");

      executeSvgPath({ commands, sink, ...noFlip });

      // Zero radius arc becomes a line
      expect(sink.curveTo).toHaveBeenCalled();
      const call = sink.curveTo.mock.calls[0];
      expect(call[4]).toBe(50);
      expect(call[5]).toBe(50);
    });
  });

  describe("close path", () => {
    it("returns to subpath start after close", () => {
      const sink = createMockSink();
      const commands = parseSvgPath("M 100 100 L 200 100 L 200 200 Z L 300 300");

      executeSvgPath({ commands, sink, ...noFlip });

      // After Z, position returns to (100, 100)
      // Then L 300 300 draws from (100, 100) to (300, 300)
      expect(sink.lineTo).toHaveBeenLastCalledWith(300, 300);
    });

    it("handles multiple subpaths", () => {
      const sink = createMockSink();
      const commands = parseSvgPath("M 0 0 L 100 0 Z M 200 200 L 300 200 Z");

      executeSvgPath({ commands, sink, ...noFlip });

      expect(sink.moveTo).toHaveBeenCalledTimes(2);
      expect(sink.close).toHaveBeenCalledTimes(2);
    });
  });

  describe("initial position", () => {
    it("uses default initial position (0, 0)", () => {
      const sink = createMockSink();
      const commands = parseSvgPath("l 50 50");

      executeSvgPath({ commands, sink, ...noFlip });

      expect(sink.lineTo).toHaveBeenCalledWith(50, 50);
    });

    it("respects custom initial position", () => {
      const sink = createMockSink();
      const commands = parseSvgPath("l 50 50");

      executeSvgPath({ commands, sink, initialX: 100, initialY: 100, ...noFlip });

      expect(sink.lineTo).toHaveBeenCalledWith(150, 150);
    });

    it("uses initial position for relative moveTo", () => {
      const sink = createMockSink();
      const commands = parseSvgPath("m 10 20");

      executeSvgPath({ commands, sink, initialX: 100, initialY: 100, ...noFlip });

      expect(sink.moveTo).toHaveBeenCalledWith(110, 120);
    });
  });

  describe("return value", () => {
    it("returns final position", () => {
      const sink = createMockSink();
      const commands = parseSvgPath("M 10 20 L 100 200");

      const result = executeSvgPath({ commands, sink, ...noFlip });

      expect(result).toEqual({ x: 100, y: 200 });
    });

    it("returns subpath start after close", () => {
      const sink = createMockSink();
      const commands = parseSvgPath("M 50 50 L 100 100 Z");

      const result = executeSvgPath({ commands, sink, ...noFlip });

      expect(result).toEqual({ x: 50, y: 50 });
    });

    it("returns initial position for empty path", () => {
      const sink = createMockSink();
      const result = executeSvgPath({ commands: [], sink, initialX: 25, initialY: 75, ...noFlip });

      expect(result).toEqual({ x: 25, y: 75 });
    });
  });

  describe("executeSvgPathString", () => {
    it("parses and executes path string", () => {
      const sink = createMockSink();

      executeSvgPathString({ pathData: "M 10 20 L 100 200", sink, ...noFlip });

      expect(sink.moveTo).toHaveBeenCalledWith(10, 20);
      expect(sink.lineTo).toHaveBeenCalledWith(100, 200);
    });

    it("respects initial position", () => {
      const sink = createMockSink();

      executeSvgPathString({ pathData: "l 50 50", sink, initialX: 100, initialY: 100, ...noFlip });

      expect(sink.lineTo).toHaveBeenCalledWith(150, 150);
    });
  });

  describe("complex paths", () => {
    it("executes a heart shape", () => {
      const sink = createMockSink();
      const path = "M 10,30 A 20,20 0,0,1 50,30 A 20,20 0,0,1 90,30 Q 90,60 50,90 Q 10,60 10,30 Z";

      executeSvgPathString({ pathData: path, sink, ...noFlip });

      expect(sink.moveTo).toHaveBeenCalledWith(10, 30);
      expect(sink.curveTo).toHaveBeenCalled(); // Arcs converted to beziers
      expect(sink.quadraticCurveTo).toHaveBeenCalledTimes(2);
      expect(sink.close).toHaveBeenCalled();
    });

    it("executes a path with mixed absolute and relative commands", () => {
      const sink = createMockSink();
      const path = "M 0 0 L 100 0 l 0 100 L 0 100 l 0 -100 Z";

      executeSvgPathString({ pathData: path, sink, ...noFlip });

      expect(sink.moveTo).toHaveBeenCalledWith(0, 0);
      expect(sink.lineTo).toHaveBeenNthCalledWith(1, 100, 0);
      expect(sink.lineTo).toHaveBeenNthCalledWith(2, 100, 100);
      expect(sink.lineTo).toHaveBeenNthCalledWith(3, 0, 100);
      expect(sink.lineTo).toHaveBeenNthCalledWith(4, 0, 0);
      expect(sink.close).toHaveBeenCalled();
    });
  });

  describe("Y-axis flip", () => {
    it("flips Y coordinates when flipY is true (default)", () => {
      const sink = createMockSink();
      const commands = parseSvgPath("M 10 20 L 100 200");

      // Default is flipY: true
      executeSvgPath({ commands, sink });

      expect(sink.moveTo).toHaveBeenCalledWith(10, -20);
      expect(sink.lineTo).toHaveBeenCalledWith(100, -200);
    });

    it("does not flip Y coordinates when flipY is false", () => {
      const sink = createMockSink();
      const commands = parseSvgPath("M 10 20 L 100 200");

      executeSvgPath({ commands, sink, flipY: false });

      expect(sink.moveTo).toHaveBeenCalledWith(10, 20);
      expect(sink.lineTo).toHaveBeenCalledWith(100, 200);
    });

    it("flips relative coordinates correctly", () => {
      const sink = createMockSink();
      const commands = parseSvgPath("M 0 0 l 50 50");

      executeSvgPath({ commands, sink });

      // With Y flip: 0 + (-50) = -50
      expect(sink.lineTo).toHaveBeenCalledWith(50, -50);
    });

    it("flips arc sweep direction when Y is flipped", () => {
      const sink = createMockSink();
      // A simple arc - sweep flag should be inverted when Y is flipped
      const commands = parseSvgPath("M 0 0 A 50 50 0 0 1 100 0");

      executeSvgPath({ commands, sink });

      // Arc should complete (be converted to beziers)
      expect(sink.curveTo).toHaveBeenCalled();
    });
  });
});
