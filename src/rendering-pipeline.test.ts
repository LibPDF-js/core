/**
 * Tests for RenderingPipeline class.
 */

import { describe, expect, it } from "vitest";

import { CanvasRenderer } from "./renderers/canvas-renderer";
import { SVGRenderer } from "./renderers/svg-renderer";
import { createRenderingPipeline, RenderingPipeline } from "./rendering-pipeline";

describe("RenderingPipeline", () => {
  describe("construction", () => {
    it("creates a pipeline with default options", () => {
      const pipeline = new RenderingPipeline();

      expect(pipeline).toBeInstanceOf(RenderingPipeline);
      expect(pipeline.initialized).toBe(false);
      expect(pipeline.renderer).toBeNull();
      expect(pipeline.rendererType).toBe("canvas");
      expect(pipeline.activeRenderCount).toBe(0);
    });

    it("creates a pipeline with custom options", () => {
      const pipeline = new RenderingPipeline({
        renderer: "svg",
        maxConcurrent: 2,
        cacheEnabled: false,
        cacheSize: 5,
      });

      expect(pipeline.rendererType).toBe("svg");
    });

    it("createRenderingPipeline factory function works", () => {
      const pipeline = createRenderingPipeline({ renderer: "canvas" });

      expect(pipeline).toBeInstanceOf(RenderingPipeline);
    });
  });

  describe("initialization", () => {
    it("initializes with canvas renderer by default", async () => {
      const pipeline = new RenderingPipeline();

      await pipeline.initialize();

      expect(pipeline.initialized).toBe(true);
      expect(pipeline.renderer).toBeInstanceOf(CanvasRenderer);
    });

    it("initializes with SVG renderer when specified", async () => {
      const pipeline = new RenderingPipeline({ renderer: "svg" });

      await pipeline.initialize();

      expect(pipeline.initialized).toBe(true);
      expect(pipeline.renderer).toBeInstanceOf(SVGRenderer);
    });

    it("is idempotent - multiple calls do not error", async () => {
      const pipeline = new RenderingPipeline();

      await pipeline.initialize();
      await pipeline.initialize();

      expect(pipeline.initialized).toBe(true);
    });

    it("throws for unknown renderer type", async () => {
      const pipeline = new RenderingPipeline({
        renderer: "unknown" as "canvas",
      });

      await expect(pipeline.initialize()).rejects.toThrow("Unknown renderer type");
    });
  });

  describe("viewport creation", () => {
    it("creates viewport with correct dimensions", async () => {
      const pipeline = new RenderingPipeline();
      await pipeline.initialize();

      const viewport = pipeline.createViewport(612, 792, 0);

      expect(viewport.width).toBe(612);
      expect(viewport.height).toBe(792);
      expect(viewport.scale).toBe(1);
      expect(viewport.rotation).toBe(0);
    });

    it("applies scale to viewport dimensions", async () => {
      const pipeline = new RenderingPipeline();
      await pipeline.initialize();

      const viewport = pipeline.createViewport(612, 792, 0, 2);

      expect(viewport.width).toBe(1224);
      expect(viewport.height).toBe(1584);
      expect(viewport.scale).toBe(2);
    });

    it("applies rotation to viewport", async () => {
      const pipeline = new RenderingPipeline();
      await pipeline.initialize();

      const viewport = pipeline.createViewport(612, 792, 0, 1, 90);

      expect(viewport.rotation).toBe(90);
      // Rotated 90 degrees swaps width and height
      expect(viewport.width).toBe(792);
      expect(viewport.height).toBe(612);
    });

    it("combines page rotation with additional rotation", async () => {
      const pipeline = new RenderingPipeline();
      await pipeline.initialize();

      // Page rotated 90, additional rotation 90 = 180 total
      const viewport = pipeline.createViewport(612, 792, 90, 1, 90);

      expect(viewport.rotation).toBe(180);
    });

    it("throws before initialization", () => {
      const pipeline = new RenderingPipeline();

      expect(() => pipeline.createViewport(612, 792, 0)).toThrow("Pipeline must be initialized");
    });
  });

  describe("caching", () => {
    it("isCached returns false when cache is disabled", async () => {
      const pipeline = new RenderingPipeline({ cacheEnabled: false });
      await pipeline.initialize();

      const viewport = pipeline.createViewport(612, 792, 0);
      const isCached = pipeline.isCached(0, viewport);

      expect(isCached).toBe(false);
    });

    it("getCached returns null when not cached", async () => {
      const pipeline = new RenderingPipeline();
      await pipeline.initialize();

      const viewport = pipeline.createViewport(612, 792, 0);
      const cached = pipeline.getCached(0, viewport);

      expect(cached).toBeNull();
    });

    it("clearCache clears the cache", async () => {
      const pipeline = new RenderingPipeline();
      await pipeline.initialize();

      // Should not throw
      pipeline.clearCache();
    });
  });

  describe("rendering", () => {
    it("render throws before initialization", () => {
      const pipeline = new RenderingPipeline();

      const viewport = {
        width: 612,
        height: 792,
        scale: 1,
        rotation: 0,
        offsetX: 0,
        offsetY: 0,
      };

      expect(() => pipeline.render(0, viewport)).toThrow("Pipeline must be initialized");
    });

    it("render returns a task with promise", async () => {
      const pipeline = new RenderingPipeline();
      await pipeline.initialize();

      const viewport = pipeline.createViewport(612, 792, 0);
      const task = pipeline.render(0, viewport);

      expect(task).toHaveProperty("promise");
      expect(task).toHaveProperty("cancel");
      expect(task.cancelled).toBe(false);
    });

    it("render task can be cancelled", async () => {
      const pipeline = new RenderingPipeline();
      await pipeline.initialize();

      const viewport = pipeline.createViewport(612, 792, 0);
      const task = pipeline.render(0, viewport);

      task.cancel();

      expect(task.cancelled).toBe(true);

      // The promise should reject when cancelled
      await expect(task.promise).rejects.toThrow("cancelled");
    });

    it("cancelAll cancels all pending renders", async () => {
      const pipeline = new RenderingPipeline();
      await pipeline.initialize();

      // Should not throw
      pipeline.cancelAll();
    });
  });

  describe("coordinate transformation", () => {
    it("pdfToScreen converts coordinates correctly", async () => {
      const pipeline = new RenderingPipeline();
      await pipeline.initialize();

      const viewport = {
        width: 612,
        height: 792,
        scale: 1,
        rotation: 0,
        offsetX: 0,
        offsetY: 0,
      };

      // PDF origin is bottom-left, screen is top-left
      const screen = pipeline.pdfToScreen(0, 792, viewport);

      expect(screen.x).toBe(0);
      expect(screen.y).toBe(0);
    });

    it("pdfToScreen applies scale", async () => {
      const pipeline = new RenderingPipeline();
      await pipeline.initialize();

      const viewport = {
        width: 1224,
        height: 1584,
        scale: 2,
        rotation: 0,
        offsetX: 0,
        offsetY: 0,
      };

      const screen = pipeline.pdfToScreen(100, 100, viewport);

      expect(screen.x).toBe(200);
      // Y is flipped and scaled
      expect(screen.y).toBe(1584 - 200);
    });

    it("screenToPdf converts coordinates correctly", async () => {
      const pipeline = new RenderingPipeline();
      await pipeline.initialize();

      const viewport = {
        width: 612,
        height: 792,
        scale: 1,
        rotation: 0,
        offsetX: 0,
        offsetY: 0,
      };

      // Screen top-left to PDF bottom-left
      const pdf = pipeline.screenToPdf(0, 0, viewport);

      expect(pdf.x).toBe(0);
      expect(pdf.y).toBe(792);
    });

    it("pdfToScreen and screenToPdf are inverses", async () => {
      const pipeline = new RenderingPipeline();
      await pipeline.initialize();

      const viewport = {
        width: 612,
        height: 792,
        scale: 1.5,
        rotation: 0,
        offsetX: 10,
        offsetY: 20,
      };

      const originalPdf = { x: 100, y: 200 };
      const screen = pipeline.pdfToScreen(originalPdf.x, originalPdf.y, viewport);
      const backToPdf = pipeline.screenToPdf(screen.x, screen.y, viewport);

      expect(backToPdf.x).toBeCloseTo(originalPdf.x, 5);
      expect(backToPdf.y).toBeCloseTo(originalPdf.y, 5);
    });
  });

  describe("cleanup", () => {
    it("destroy cleans up resources", async () => {
      const pipeline = new RenderingPipeline();
      await pipeline.initialize();

      pipeline.destroy();

      expect(pipeline.initialized).toBe(false);
      expect(pipeline.renderer).toBeNull();
    });

    it("destroy can be called multiple times", async () => {
      const pipeline = new RenderingPipeline();
      await pipeline.initialize();

      pipeline.destroy();
      pipeline.destroy();

      expect(pipeline.initialized).toBe(false);
    });
  });
});
