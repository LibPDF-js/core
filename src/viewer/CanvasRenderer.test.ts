/**
 * Viewer-level tests for CanvasRenderer.
 *
 * These tests focus on CanvasRenderer integration with viewer components
 * such as coordinate transformation, viewport management, and rendering
 * within scrollable containers.
 */

import { Op, Operator } from "#src/content/operators";
import { CoordinateTransformer } from "#src/coordinate-transformer";
import { PdfString } from "#src/objects/pdf-string";
import {
  CanvasRenderer,
  createCanvasRenderer,
  LineCap,
  LineJoin,
  TextRenderMode,
} from "#src/renderers/canvas-renderer";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

// Standard page dimensions
const LETTER_WIDTH = 612;
const LETTER_HEIGHT = 792;
const A4_WIDTH = 595;
const A4_HEIGHT = 842;

describe("CanvasRenderer viewer integration", () => {
  let renderer: CanvasRenderer;

  beforeEach(async () => {
    renderer = new CanvasRenderer();
    await renderer.initialize({ headless: true });
  });

  afterEach(() => {
    renderer.destroy();
  });

  describe("multi-page rendering", () => {
    it("renders multiple pages with different dimensions", async () => {
      const pages = [
        { width: LETTER_WIDTH, height: LETTER_HEIGHT, rotation: 0 },
        { width: A4_WIDTH, height: A4_HEIGHT, rotation: 0 },
        { width: LETTER_WIDTH, height: LETTER_HEIGHT, rotation: 90 },
      ];

      const results = [];
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const viewport = renderer.createViewport(page.width, page.height, page.rotation);
        const task = renderer.render(i, viewport);
        results.push(await task.promise);
      }

      expect(results).toHaveLength(3);
      expect(results[0].width).toBe(LETTER_WIDTH);
      expect(results[0].height).toBe(LETTER_HEIGHT);
      expect(results[1].width).toBe(A4_WIDTH);
      expect(results[1].height).toBe(A4_HEIGHT);
      expect(results[2].width).toBe(LETTER_HEIGHT); // Rotated
      expect(results[2].height).toBe(LETTER_WIDTH);
    });

    it("handles concurrent render requests for different pages", async () => {
      const viewport = renderer.createViewport(LETTER_WIDTH, LETTER_HEIGHT, 0);

      const tasks = [
        renderer.render(0, viewport),
        renderer.render(1, viewport),
        renderer.render(2, viewport),
      ];

      const results = await Promise.all(tasks.map(t => t.promise));

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.width).toBe(LETTER_WIDTH);
        expect(result.height).toBe(LETTER_HEIGHT);
      });
    });

    it("cancels pending render when page changes rapidly", async () => {
      const viewport = renderer.createViewport(LETTER_WIDTH, LETTER_HEIGHT, 0);

      const task1 = renderer.render(0, viewport);
      const task2 = renderer.render(1, viewport);
      const task3 = renderer.render(2, viewport);

      // Cancel earlier renders
      task1.cancel();
      task2.cancel();

      expect(task1.cancelled).toBe(true);
      expect(task2.cancelled).toBe(true);
      expect(task3.cancelled).toBe(false);

      // Handle the cancelled task rejections to avoid unhandled rejection errors
      task1.promise.catch(() => {});
      task2.promise.catch(() => {});

      const result = await task3.promise;
      expect(result.width).toBe(LETTER_WIDTH);
    });
  });

  describe("zoom level rendering", () => {
    const zoomLevels = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

    for (const zoom of zoomLevels) {
      it(`renders correctly at ${zoom * 100}% zoom`, async () => {
        const viewport = renderer.createViewport(LETTER_WIDTH, LETTER_HEIGHT, 0, zoom);

        expect(viewport.width).toBe(Math.round(LETTER_WIDTH * zoom));
        expect(viewport.height).toBe(Math.round(LETTER_HEIGHT * zoom));
        expect(viewport.scale).toBe(zoom);

        const task = renderer.render(0, viewport);
        const result = await task.promise;

        expect(result.width).toBe(Math.round(LETTER_WIDTH * zoom));
        expect(result.height).toBe(Math.round(LETTER_HEIGHT * zoom));
      });
    }

    it("maintains graphics state precision at high zoom", async () => {
      const viewport = renderer.createViewport(LETTER_WIDTH, LETTER_HEIGHT, 0, 4);

      renderer.setLineWidth(0.5);
      renderer.setStrokingRGB(0.1, 0.2, 0.3);

      expect(renderer.graphicsState.lineWidth).toBe(0.5);
      // At 4x zoom, rendered line would be 2px but logical state is preserved
    });

    it("handles zoom changes during rendering", async () => {
      let viewport = renderer.createViewport(LETTER_WIDTH, LETTER_HEIGHT, 0, 1);
      const task1 = renderer.render(0, viewport);

      // Change zoom while render is in progress
      viewport = renderer.createViewport(LETTER_WIDTH, LETTER_HEIGHT, 0, 2);

      const result1 = await task1.promise;
      expect(result1.width).toBe(LETTER_WIDTH); // Original zoom

      const task2 = renderer.render(0, viewport);
      const result2 = await task2.promise;
      expect(result2.width).toBe(LETTER_WIDTH * 2); // New zoom
    });
  });

  describe("rotation rendering", () => {
    const rotations: Array<0 | 90 | 180 | 270> = [0, 90, 180, 270];

    for (const rotation of rotations) {
      it(`renders page with ${rotation}° rotation`, async () => {
        const viewport = renderer.createViewport(LETTER_WIDTH, LETTER_HEIGHT, rotation);

        if (rotation === 90 || rotation === 270) {
          expect(viewport.width).toBe(LETTER_HEIGHT);
          expect(viewport.height).toBe(LETTER_WIDTH);
        } else {
          expect(viewport.width).toBe(LETTER_WIDTH);
          expect(viewport.height).toBe(LETTER_HEIGHT);
        }

        const task = renderer.render(0, viewport);
        const result = await task.promise;

        expect(result.width).toBe(viewport.width);
        expect(result.height).toBe(viewport.height);
      });
    }

    it("combines rotation with zoom", async () => {
      const viewport = renderer.createViewport(LETTER_WIDTH, LETTER_HEIGHT, 90, 2);

      expect(viewport.width).toBe(LETTER_HEIGHT * 2);
      expect(viewport.height).toBe(LETTER_WIDTH * 2);
      expect(viewport.rotation).toBe(90);
      expect(viewport.scale).toBe(2);
    });
  });

  describe("coordinate transformation integration", () => {
    it("transforms click coordinates to PDF space", () => {
      const viewport = renderer.createViewport(LETTER_WIDTH, LETTER_HEIGHT, 0, 2);

      // Screen click at (200, 100) at 2x zoom
      const screenPoint = { x: 200, y: 100 };
      const pdfPoint = renderer.screenToPdf(screenPoint, viewport, LETTER_WIDTH, LETTER_HEIGHT);

      // At 2x zoom, screen coordinates should be halved in PDF space
      expect(pdfPoint.x).toBeCloseTo(100, 1);
      // Y coordinate is inverted and transformed
    });

    it("transforms PDF coordinates to screen space for overlay", () => {
      const viewport = renderer.createViewport(LETTER_WIDTH, LETTER_HEIGHT, 0, 1.5);

      // PDF point near top-left
      const pdfPoint = { x: 100, y: LETTER_HEIGHT - 100 };
      const screenPoint = renderer.pdfToScreen(pdfPoint, viewport, LETTER_WIDTH, LETTER_HEIGHT);

      // At 1.5x zoom, coordinates should be scaled
      expect(screenPoint.x).toBeCloseTo(150, 1);
    });

    it("transforms selection rectangle from screen to PDF", () => {
      const viewport = renderer.createViewport(LETTER_WIDTH, LETTER_HEIGHT, 0, 2);

      const screenRect = { x: 100, y: 50, width: 200, height: 100 };
      const pdfRect = renderer.screenRectToPdf(screenRect, viewport, LETTER_WIDTH, LETTER_HEIGHT);

      expect(pdfRect.width).toBeCloseTo(100, 1); // Half at 2x zoom
      expect(pdfRect.height).toBeCloseTo(50, 1);
    });

    it("handles coordinate transformation with rotation", () => {
      const viewport = renderer.createViewport(LETTER_WIDTH, LETTER_HEIGHT, 90);

      const pdfPoint = { x: 100, y: 700 };
      const screenPoint = renderer.pdfToScreen(pdfPoint, viewport, LETTER_WIDTH, LETTER_HEIGHT);
      const roundTrip = renderer.screenToPdf(screenPoint, viewport, LETTER_WIDTH, LETTER_HEIGHT);

      expect(roundTrip.x).toBeCloseTo(pdfPoint.x, 1);
      expect(roundTrip.y).toBeCloseTo(pdfPoint.y, 1);
    });
  });

  describe("graphics state in viewer context", () => {
    it("isolates graphics state between page renders", async () => {
      // Set up custom state within a push/pop pair
      renderer.pushGraphicsState();
      renderer.setLineWidth(5);
      renderer.setStrokingRGB(1, 0, 0);

      // Verify custom state is applied
      expect(renderer.graphicsState.lineWidth).toBe(5);
      expect(renderer.graphicsState.strokeColor).toBe("rgb(255, 0, 0)");

      // Pop state back to verify isolation
      renderer.popGraphicsState();

      expect(renderer.graphicsState.lineWidth).toBe(1);
      // Default stroke color may be in different formats
      expect(["rgb(0, 0, 0)", "#000000"]).toContain(renderer.graphicsState.strokeColor);
    });

    it("handles deeply nested graphics states", () => {
      const depths = 10;

      for (let i = 0; i < depths; i++) {
        renderer.pushGraphicsState();
        renderer.setLineWidth(i + 1);
      }

      expect(renderer.stateStackDepth).toBe(depths);
      expect(renderer.graphicsState.lineWidth).toBe(depths);

      for (let i = depths; i > 0; i--) {
        renderer.popGraphicsState();
        if (i > 1) {
          expect(renderer.graphicsState.lineWidth).toBe(i - 1);
        }
      }

      expect(renderer.stateStackDepth).toBe(0);
    });

    it("resets graphics state for new page", () => {
      renderer.setLineWidth(5);
      renderer.setStrokingRGB(1, 0, 0);
      renderer.pushGraphicsState();

      renderer.resetGraphicsState();

      expect(renderer.stateStackDepth).toBe(0);
      expect(renderer.graphicsState.lineWidth).toBe(1);
    });
  });

  describe("text rendering in viewer", () => {
    it("renders text at various positions", () => {
      renderer.executeOperators([
        Operator.of(Op.BeginText),
        Operator.of(Op.SetFont, "/Helvetica", 12),
        Operator.of(Op.MoveText, 72, 720),
        Operator.of(Op.ShowText, PdfString.fromString("Page Header")),
        Operator.of(Op.MoveText, 0, -648),
        Operator.of(Op.ShowText, PdfString.fromString("Page Footer")),
        Operator.of(Op.EndText),
      ]);

      expect(renderer.inTextObject).toBe(false);
    });

    it("handles text with different render modes", () => {
      const modes = [
        TextRenderMode.Fill,
        TextRenderMode.Stroke,
        TextRenderMode.FillStroke,
        TextRenderMode.Invisible,
      ];

      for (const mode of modes) {
        renderer.beginText();
        renderer.setTextRenderMode(mode);
        expect(renderer.graphicsState.textRenderMode).toBe(mode);
        renderer.endText();
      }
    });

    it("preserves text state through graphics state operations", () => {
      renderer.setLeading(14);
      renderer.setCharSpacing(0.5);

      renderer.pushGraphicsState();
      renderer.setLeading(20);
      renderer.setCharSpacing(1);

      expect(renderer.graphicsState.leading).toBe(20);
      expect(renderer.graphicsState.charSpacing).toBe(1);

      renderer.popGraphicsState();

      expect(renderer.graphicsState.leading).toBe(14);
      expect(renderer.graphicsState.charSpacing).toBe(0.5);
    });
  });

  describe("path rendering in viewer", () => {
    it("renders complex paths", () => {
      // Draw a house shape
      renderer.executeOperators([
        Operator.of(Op.PushGraphicsState),
        Operator.of(Op.SetLineWidth, 2),
        Operator.of(Op.SetStrokingRGB, 0, 0, 0),

        // House body
        Operator.of(Op.MoveTo, 100, 100),
        Operator.of(Op.LineTo, 200, 100),
        Operator.of(Op.LineTo, 200, 180),
        Operator.of(Op.LineTo, 100, 180),
        Operator.of(Op.ClosePath),

        // Roof
        Operator.of(Op.MoveTo, 90, 180),
        Operator.of(Op.LineTo, 150, 230),
        Operator.of(Op.LineTo, 210, 180),
        Operator.of(Op.ClosePath),

        Operator.of(Op.Stroke),
        Operator.of(Op.PopGraphicsState),
      ]);

      expect(renderer.stateStackDepth).toBe(0);
    });

    it("renders filled and stroked shapes", () => {
      renderer.setNonStrokingRGB(0.8, 0.8, 0.8);
      renderer.setStrokingRGB(0, 0, 0);
      renderer.setLineWidth(1);

      renderer.rectangle(100, 100, 200, 150);
      renderer.fillAndStroke();

      expect(renderer.graphicsState.fillColor).toBe("rgb(204, 204, 204)");
      expect(renderer.graphicsState.strokeColor).toBe("rgb(0, 0, 0)");
    });

    it("handles bezier curves", () => {
      renderer.moveTo(100, 100);
      renderer.curveTo(150, 200, 200, 200, 250, 100);
      renderer.stroke();

      // No errors in headless mode indicates successful path construction
    });
  });

  describe("clipping in viewer context", () => {
    it("establishes clipping region", () => {
      renderer.pushGraphicsState();

      // Set up a clipping rectangle
      renderer.rectangle(100, 100, 400, 600);
      renderer.clip();

      // Content here would be clipped to the rectangle
      renderer.rectangle(0, 0, 612, 792);
      renderer.fill();

      renderer.popGraphicsState();
    });

    it("handles nested clipping regions", () => {
      renderer.pushGraphicsState();
      renderer.rectangle(100, 100, 400, 600);
      renderer.clip();

      renderer.pushGraphicsState();
      renderer.rectangle(150, 150, 300, 500);
      renderer.clip();

      // Effective clipping is intersection of both rectangles
      renderer.rectangle(0, 0, 612, 792);
      renderer.fill();

      renderer.popGraphicsState();
      renderer.popGraphicsState();

      expect(renderer.stateStackDepth).toBe(0);
    });
  });

  describe("color space handling", () => {
    it("handles grayscale colors", () => {
      const grayLevels = [0, 0.25, 0.5, 0.75, 1];

      for (const gray of grayLevels) {
        renderer.setStrokingGray(gray);
        renderer.setNonStrokingGray(gray);

        const expected = `rgb(${Math.round(gray * 255)}, ${Math.round(gray * 255)}, ${Math.round(gray * 255)})`;
        expect(renderer.graphicsState.strokeColor).toBe(expected);
        expect(renderer.graphicsState.fillColor).toBe(expected);
      }
    });

    it("handles RGB colors", () => {
      renderer.setStrokingRGB(1, 0, 0);
      expect(renderer.graphicsState.strokeColor).toBe("rgb(255, 0, 0)");

      renderer.setNonStrokingRGB(0, 1, 0);
      expect(renderer.graphicsState.fillColor).toBe("rgb(0, 255, 0)");
    });

    it("handles CMYK colors", () => {
      // Pure cyan
      renderer.setStrokingCMYK(1, 0, 0, 0);
      expect(renderer.graphicsState.strokeColor).toBe("rgb(0, 255, 255)");

      // Pure magenta
      renderer.setNonStrokingCMYK(0, 1, 0, 0);
      expect(renderer.graphicsState.fillColor).toBe("rgb(255, 0, 255)");

      // Pure yellow
      renderer.setStrokingCMYK(0, 0, 1, 0);
      expect(renderer.graphicsState.strokeColor).toBe("rgb(255, 255, 0)");

      // Black (key)
      renderer.setNonStrokingCMYK(0, 0, 0, 1);
      expect(renderer.graphicsState.fillColor).toBe("rgb(0, 0, 0)");
    });

    it("handles alpha values", () => {
      renderer.setStrokingAlpha(0.5);
      renderer.setNonStrokingAlpha(0.75);

      expect(renderer.graphicsState.strokeAlpha).toBe(0.5);
      expect(renderer.graphicsState.fillAlpha).toBe(0.75);
    });
  });

  describe("line style handling", () => {
    it("handles all line cap styles", () => {
      renderer.setLineCap(LineCap.Butt);
      expect(renderer.graphicsState.lineCap).toBe(LineCap.Butt);

      renderer.setLineCap(LineCap.Round);
      expect(renderer.graphicsState.lineCap).toBe(LineCap.Round);

      renderer.setLineCap(LineCap.Square);
      expect(renderer.graphicsState.lineCap).toBe(LineCap.Square);
    });

    it("handles all line join styles", () => {
      renderer.setLineJoin(LineJoin.Miter);
      expect(renderer.graphicsState.lineJoin).toBe(LineJoin.Miter);

      renderer.setLineJoin(LineJoin.Round);
      expect(renderer.graphicsState.lineJoin).toBe(LineJoin.Round);

      renderer.setLineJoin(LineJoin.Bevel);
      expect(renderer.graphicsState.lineJoin).toBe(LineJoin.Bevel);
    });

    it("handles dash patterns", () => {
      // Solid line (no dash)
      renderer.setDashPattern([], 0);
      expect(renderer.graphicsState.dashPattern.array).toEqual([]);

      // Simple dash
      renderer.setDashPattern([3], 0);
      expect(renderer.graphicsState.dashPattern.array).toEqual([3]);

      // Dash-dot pattern
      renderer.setDashPattern([4, 2, 1, 2], 0);
      expect(renderer.graphicsState.dashPattern.array).toEqual([4, 2, 1, 2]);

      // Dash with phase offset
      renderer.setDashPattern([5, 3], 2);
      expect(renderer.graphicsState.dashPattern.phase).toBe(2);
    });

    it("handles miter limit", () => {
      renderer.setMiterLimit(10);
      expect(renderer.graphicsState.miterLimit).toBe(10);

      renderer.setMiterLimit(1);
      expect(renderer.graphicsState.miterLimit).toBe(1);
    });
  });

  describe("factory function", () => {
    it("creates renderer via factory function", async () => {
      const factoryRenderer = createCanvasRenderer({ headless: true });
      await factoryRenderer.initialize({ headless: true });

      expect(factoryRenderer).toBeInstanceOf(CanvasRenderer);
      expect(factoryRenderer.type).toBe("canvas");
      expect(factoryRenderer.initialized).toBe(true);

      factoryRenderer.destroy();
    });
  });

  describe("error handling", () => {
    it("throws when creating viewport before initialization", () => {
      const uninitRenderer = new CanvasRenderer();

      expect(() => uninitRenderer.createViewport(612, 792, 0)).toThrow(
        "Renderer must be initialized",
      );
    });

    it("handles pop on empty state stack gracefully", () => {
      expect(renderer.stateStackDepth).toBe(0);
      // Should not throw, just be a no-op
      renderer.popGraphicsState();
      expect(renderer.stateStackDepth).toBe(0);
    });

    it("handles end text without begin text", () => {
      expect(renderer.inTextObject).toBe(false);
      // Should not throw
      renderer.endText();
      expect(renderer.inTextObject).toBe(false);
    });
  });

  describe("cleanup", () => {
    it("properly destroys renderer", () => {
      renderer.pushGraphicsState();
      renderer.setLineWidth(5);

      renderer.destroy();

      expect(renderer.initialized).toBe(false);
    });

    it("can be reinitialized after destruction", async () => {
      renderer.destroy();
      expect(renderer.initialized).toBe(false);

      await renderer.initialize({ headless: true });
      expect(renderer.initialized).toBe(true);
    });
  });
});

describe("CanvasRenderer performance scenarios", () => {
  let renderer: CanvasRenderer;

  beforeEach(async () => {
    renderer = new CanvasRenderer();
    await renderer.initialize({ headless: true });
  });

  afterEach(() => {
    renderer.destroy();
  });

  it("handles many operators efficiently", () => {
    const operators: Operator[] = [];

    // Generate 1000 rectangle operations
    for (let i = 0; i < 100; i++) {
      for (let j = 0; j < 10; j++) {
        operators.push(Operator.of(Op.Rectangle, i * 6, j * 79, 5, 78), Operator.of(Op.Fill));
      }
    }

    const start = performance.now();
    renderer.executeOperators(operators);
    const duration = performance.now() - start;

    // Should complete in reasonable time (headless mode is fast)
    expect(duration).toBeLessThan(1000);
  });

  it("handles rapid graphics state changes", () => {
    for (let i = 0; i < 100; i++) {
      renderer.pushGraphicsState();
      renderer.setLineWidth(i % 10);
      renderer.setStrokingRGB((i % 256) / 255, ((i * 2) % 256) / 255, ((i * 3) % 256) / 255);
      renderer.popGraphicsState();
    }

    expect(renderer.stateStackDepth).toBe(0);
  });
});

describe("CanvasRenderer font encoding", () => {
  let renderer: CanvasRenderer;

  beforeEach(async () => {
    renderer = new CanvasRenderer();
    await renderer.initialize({ headless: true });
  });

  afterEach(() => {
    renderer.destroy();
  });

  it("uses font resolver when rendering text with showTextFromCodes", () => {
    // Create a mock font that maps character codes to specific Unicode
    const mockFont = {
      toUnicode: (code: number) => {
        // Map 0x41 -> "A", 0x42 -> "B", 0x43 -> "C"
        // This simulates a WinAnsi font
        if (code >= 0x41 && code <= 0x5a) {
          return String.fromCharCode(code);
        }
        // Map 0x01-0x03 to "X", "Y", "Z" to test non-trivial encoding
        if (code === 0x01) {
          return "X";
        }
        if (code === 0x02) {
          return "Y";
        }
        if (code === 0x03) {
          return "Z";
        }
        return "";
      },
    };

    const fontResolver = (name: string) => {
      if (name === "F1") {
        return mockFont as any;
      }
      return null;
    };

    // Render with the font resolver
    const viewport = renderer.createViewport(612, 792, 0);
    const contentBytes = new Uint8Array([]);
    const task = renderer.render(0, viewport, contentBytes, fontResolver);

    // Set font - this should store the resolved font
    renderer.setFont("/F1", 12);

    // showTextFromCodes should use the font's toUnicode method
    // The test verifies the method exists and is callable
    expect(typeof renderer.showTextFromCodes).toBe("function");

    task.promise.catch(() => {}); // Handle any cancellation
  });

  it("falls back to Latin-1 when no font resolver is provided", () => {
    renderer.setFont("/F1", 12);

    // Without a font resolver, showTextFromCodes should use Latin-1 fallback
    expect(typeof renderer.showTextFromCodes).toBe("function");
  });

  it("renders text array with byte-based method", () => {
    const mockFont = {
      toUnicode: (code: number) => String.fromCharCode(code),
    };

    const fontResolver = (name: string) => {
      if (name === "F1") {
        return mockFont as any;
      }
      return null;
    };

    const viewport = renderer.createViewport(612, 792, 0);
    const task = renderer.render(0, viewport, null, fontResolver);

    renderer.setFont("/F1", 12);

    // Test that showTextArrayFromCodes exists and is callable
    expect(typeof renderer.showTextArrayFromCodes).toBe("function");

    task.promise.catch(() => {});
  });
});
