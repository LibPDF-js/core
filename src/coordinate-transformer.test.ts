/**
 * Tests for CoordinateTransformer.
 */

import { describe, expect, it } from "vitest";

import {
  CoordinateTransformer,
  createCoordinateTransformer,
  MAX_ZOOM,
  MIN_ZOOM,
  type Point2D,
  type Rect2D,
} from "./coordinate-transformer";

// Standard US Letter page dimensions in PDF points
const LETTER_WIDTH = 612; // 8.5 inches * 72 points/inch
const LETTER_HEIGHT = 792; // 11 inches * 72 points/inch

// Helper to check if two points are approximately equal
function expectPointsClose(actual: Point2D, expected: Point2D, tolerance = 0.001): void {
  expect(actual.x).toBeCloseTo(expected.x, tolerance);
  expect(actual.y).toBeCloseTo(expected.y, tolerance);
}

// Helper to check if two rects are approximately equal
function expectRectsClose(actual: Rect2D, expected: Rect2D, tolerance = 0.001): void {
  expect(actual.x).toBeCloseTo(expected.x, tolerance);
  expect(actual.y).toBeCloseTo(expected.y, tolerance);
  expect(actual.width).toBeCloseTo(expected.width, tolerance);
  expect(actual.height).toBeCloseTo(expected.height, tolerance);
}

describe("CoordinateTransformer", () => {
  describe("construction", () => {
    it("creates transformer with required options", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
      });

      expect(transformer.pageWidth).toBe(LETTER_WIDTH);
      expect(transformer.pageHeight).toBe(LETTER_HEIGHT);
      expect(transformer.scale).toBe(1);
      expect(transformer.pageRotation).toBe(0);
      expect(transformer.viewerRotation).toBe(0);
      expect(transformer.devicePixelRatio).toBe(1);
      expect(transformer.offsetX).toBe(0);
      expect(transformer.offsetY).toBe(0);
    });

    it("creates transformer with all options", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        pageRotation: 90,
        viewerRotation: 180,
        scale: 2,
        devicePixelRatio: 2,
        offsetX: 10,
        offsetY: 20,
      });

      expect(transformer.pageWidth).toBe(LETTER_WIDTH);
      expect(transformer.pageHeight).toBe(LETTER_HEIGHT);
      expect(transformer.pageRotation).toBe(90);
      expect(transformer.viewerRotation).toBe(180);
      expect(transformer.totalRotation).toBe(270);
      expect(transformer.scale).toBe(2);
      expect(transformer.devicePixelRatio).toBe(2);
      expect(transformer.offsetX).toBe(10);
      expect(transformer.offsetY).toBe(20);
    });

    it("clamps scale to valid range", () => {
      const low = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        scale: 0.1, // Below MIN_ZOOM
      });
      expect(low.scale).toBe(MIN_ZOOM);

      const high = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        scale: 10, // Above MAX_ZOOM
      });
      expect(high.scale).toBe(MAX_ZOOM);
    });

    it("normalizes rotation to valid values", () => {
      const transformer1 = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        // @ts-expect-error Testing normalization of invalid rotation values
        viewerRotation: 45, // Should round to 90
      });
      expect(transformer1.viewerRotation).toBe(90);

      const transformer2 = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        // @ts-expect-error Testing normalization of invalid rotation values
        viewerRotation: -90, // Should normalize to 270
      });
      expect(transformer2.viewerRotation).toBe(270);

      const transformer3 = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        // @ts-expect-error Testing normalization of invalid rotation values
        viewerRotation: 720, // Should normalize to 0
      });
      expect(transformer3.viewerRotation).toBe(0);
    });
  });

  describe("fromViewport", () => {
    it("creates transformer from viewport", () => {
      const viewport = {
        width: LETTER_WIDTH * 1.5,
        height: LETTER_HEIGHT * 1.5,
        scale: 1.5,
        rotation: 90,
        offsetX: 10,
        offsetY: 20,
      };

      const transformer = CoordinateTransformer.fromViewport(viewport, LETTER_WIDTH, LETTER_HEIGHT);

      expect(transformer.pageWidth).toBe(LETTER_WIDTH);
      expect(transformer.pageHeight).toBe(LETTER_HEIGHT);
      expect(transformer.scale).toBe(1.5);
      expect(transformer.viewerRotation).toBe(90);
      expect(transformer.offsetX).toBe(10);
      expect(transformer.offsetY).toBe(20);
    });
  });

  describe("effective page size", () => {
    it("returns original dimensions with no rotation", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
      });

      const size = transformer.effectivePageSize;
      expect(size.width).toBe(LETTER_WIDTH);
      expect(size.height).toBe(LETTER_HEIGHT);
    });

    it("swaps dimensions with 90° rotation", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        viewerRotation: 90,
      });

      const size = transformer.effectivePageSize;
      expect(size.width).toBe(LETTER_HEIGHT);
      expect(size.height).toBe(LETTER_WIDTH);
    });

    it("keeps dimensions with 180° rotation", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        viewerRotation: 180,
      });

      const size = transformer.effectivePageSize;
      expect(size.width).toBe(LETTER_WIDTH);
      expect(size.height).toBe(LETTER_HEIGHT);
    });

    it("swaps dimensions with 270° rotation", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        viewerRotation: 270,
      });

      const size = transformer.effectivePageSize;
      expect(size.width).toBe(LETTER_HEIGHT);
      expect(size.height).toBe(LETTER_WIDTH);
    });
  });

  describe("viewport and canvas size", () => {
    it("calculates viewport size with scale", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        scale: 2,
      });

      const size = transformer.viewportSize;
      expect(size.width).toBe(LETTER_WIDTH * 2);
      expect(size.height).toBe(LETTER_HEIGHT * 2);
    });

    it("calculates canvas size with device pixel ratio", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        scale: 1.5,
        devicePixelRatio: 2,
      });

      const viewportSize = transformer.viewportSize;
      const canvasSize = transformer.canvasSize;

      // Canvas should be 2x viewport for retina
      expect(canvasSize.width).toBe(Math.ceil(viewportSize.width * 2));
      expect(canvasSize.height).toBe(Math.ceil(viewportSize.height * 2));
    });
  });

  describe("pdfToScreen transformation", () => {
    it("converts bottom-left origin to top-left at scale 1", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
      });

      // PDF bottom-left (0, 0) should map to screen top-left of the page bottom
      const bottomLeft = transformer.pdfToScreen({ x: 0, y: 0 });
      expectPointsClose(bottomLeft, { x: 0, y: LETTER_HEIGHT });

      // PDF top-left (0, height) should map to screen (0, 0)
      const topLeft = transformer.pdfToScreen({ x: 0, y: LETTER_HEIGHT });
      expectPointsClose(topLeft, { x: 0, y: 0 });

      // PDF top-right should map to screen top-right
      const topRight = transformer.pdfToScreen({ x: LETTER_WIDTH, y: LETTER_HEIGHT });
      expectPointsClose(topRight, { x: LETTER_WIDTH, y: 0 });
    });

    it("applies scale correctly", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        scale: 2,
      });

      // At scale 2, distances should be doubled
      const distance = transformer.pdfDistanceToScreen(100);
      expect(distance).toBe(200);

      // And the viewport should be twice the page size
      const { width, height } = transformer.viewportSize;
      expect(width).toBe(LETTER_WIDTH * 2);
      expect(height).toBe(LETTER_HEIGHT * 2);

      // Round-trip should work correctly
      const pdfPoint = { x: 100, y: 200 };
      const screenPoint = transformer.pdfToScreen(pdfPoint);
      const roundTrip = transformer.screenToPdf(screenPoint);
      expectPointsClose(roundTrip, pdfPoint);
    });

    it("applies offset correctly", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        offsetX: 50,
        offsetY: 100,
      });

      // Offset should be reflected in the transformer state
      expect(transformer.offsetX).toBe(50);
      expect(transformer.offsetY).toBe(100);

      // Round-trip should work correctly with offset
      const pdfPoint = { x: 100, y: 200 };
      const screenPoint = transformer.pdfToScreen(pdfPoint);
      const roundTrip = transformer.screenToPdf(screenPoint);
      expectPointsClose(roundTrip, pdfPoint);
    });
  });

  describe("screenToPdf transformation", () => {
    it("is the inverse of pdfToScreen at scale 1", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
      });

      // Test several points
      const testPoints: Point2D[] = [
        { x: 0, y: 0 },
        { x: 100, y: 200 },
        { x: LETTER_WIDTH / 2, y: LETTER_HEIGHT / 2 },
        { x: LETTER_WIDTH, y: LETTER_HEIGHT },
      ];

      for (const pdfPoint of testPoints) {
        const screenPoint = transformer.pdfToScreen(pdfPoint);
        const roundTrip = transformer.screenToPdf(screenPoint);
        expectPointsClose(roundTrip, pdfPoint);
      }
    });

    it("is the inverse of pdfToScreen at scale 2", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        scale: 2,
      });

      const testPoints: Point2D[] = [
        { x: 50, y: 50 },
        { x: 306, y: 396 },
      ];

      for (const pdfPoint of testPoints) {
        const screenPoint = transformer.pdfToScreen(pdfPoint);
        const roundTrip = transformer.screenToPdf(screenPoint);
        expectPointsClose(roundTrip, pdfPoint);
      }
    });

    it("is the inverse of pdfToScreen with offset", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        scale: 1.5,
        offsetX: 25,
        offsetY: 50,
      });

      const testPoints: Point2D[] = [
        { x: 100, y: 100 },
        { x: 300, y: 500 },
      ];

      for (const pdfPoint of testPoints) {
        const screenPoint = transformer.pdfToScreen(pdfPoint);
        const roundTrip = transformer.screenToPdf(screenPoint);
        expectPointsClose(roundTrip, pdfPoint);
      }
    });
  });

  describe("rotation transformations", () => {
    it("handles 90° rotation correctly", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        viewerRotation: 90,
      });

      // With 90° rotation, dimensions are swapped
      const { width, height } = transformer.effectivePageSize;
      expect(width).toBe(LETTER_HEIGHT);
      expect(height).toBe(LETTER_WIDTH);

      // Test round-trip for several points
      const testPoints: Point2D[] = [
        { x: 0, y: LETTER_HEIGHT },
        { x: 100, y: 200 },
        { x: LETTER_WIDTH / 2, y: LETTER_HEIGHT / 2 },
      ];

      for (const pdfPoint of testPoints) {
        const screenPoint = transformer.pdfToScreen(pdfPoint);
        const roundTrip = transformer.screenToPdf(screenPoint);
        expectPointsClose(roundTrip, pdfPoint);
      }
    });

    it("handles 180° rotation correctly", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        viewerRotation: 180,
      });

      // Test round-trip
      const pdfPoint = { x: 100, y: 200 };
      const screenPoint = transformer.pdfToScreen(pdfPoint);
      const roundTrip = transformer.screenToPdf(screenPoint);
      expectPointsClose(roundTrip, pdfPoint);
    });

    it("handles 270° rotation correctly", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        viewerRotation: 270,
      });

      // With 270° rotation, dimensions are swapped
      const { width, height } = transformer.effectivePageSize;
      expect(width).toBe(LETTER_HEIGHT);
      expect(height).toBe(LETTER_WIDTH);

      // Test round-trip for several points
      const testPoints: Point2D[] = [
        { x: 150, y: 300 },
        { x: 0, y: 0 },
        { x: LETTER_WIDTH, y: LETTER_HEIGHT },
      ];

      for (const pdfPoint of testPoints) {
        const screenPoint = transformer.pdfToScreen(pdfPoint);
        const roundTrip = transformer.screenToPdf(screenPoint);
        expectPointsClose(roundTrip, pdfPoint);
      }
    });

    it("combines page and viewer rotation", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        pageRotation: 90,
        viewerRotation: 90,
      });

      expect(transformer.totalRotation).toBe(180);

      // Test round-trip
      const pdfPoint = { x: 200, y: 400 };
      const screenPoint = transformer.pdfToScreen(pdfPoint);
      const roundTrip = transformer.screenToPdf(screenPoint);
      expectPointsClose(roundTrip, pdfPoint);
    });
  });

  describe("rectangle transformation", () => {
    it("transforms rectangle from PDF to screen at scale 1", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
      });

      const pdfRect: Rect2D = { x: 100, y: 100, width: 200, height: 150 };
      const screenRect = transformer.pdfRectToScreen(pdfRect);

      // Width and height should be preserved at scale 1
      expect(screenRect.width).toBeCloseTo(200, 1);
      expect(screenRect.height).toBeCloseTo(150, 1);
    });

    it("transforms rectangle with scale", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        scale: 2,
      });

      const pdfRect: Rect2D = { x: 100, y: 100, width: 200, height: 150 };
      const screenRect = transformer.pdfRectToScreen(pdfRect);

      // Width and height should be scaled
      expect(screenRect.width).toBeCloseTo(400, 1);
      expect(screenRect.height).toBeCloseTo(300, 1);
    });

    it("round-trips rectangle correctly", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        scale: 1.5,
      });

      const pdfRect: Rect2D = { x: 100, y: 200, width: 150, height: 100 };
      const screenRect = transformer.pdfRectToScreen(pdfRect);
      const roundTrip = transformer.screenRectToPdf(screenRect);

      expectRectsClose(roundTrip, pdfRect);
    });
  });

  describe("distance conversion", () => {
    it("converts PDF distance to screen distance", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        scale: 2,
      });

      expect(transformer.pdfDistanceToScreen(100)).toBe(200);
      expect(transformer.pdfDistanceToScreen(72)).toBe(144); // 1 inch
    });

    it("converts screen distance to PDF distance", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        scale: 2,
      });

      expect(transformer.screenDistanceToPdf(200)).toBe(100);
      expect(transformer.screenDistanceToPdf(144)).toBe(72); // 1 inch
    });
  });

  describe("batch point conversion", () => {
    it("converts multiple points from PDF to screen", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        scale: 2,
      });

      const pdfPoints: Point2D[] = [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        { x: 200, y: 200 },
      ];

      const screenPoints = transformer.pdfPointsToScreen(pdfPoints);

      expect(screenPoints).toHaveLength(3);
      for (let i = 0; i < pdfPoints.length; i++) {
        const expected = transformer.pdfToScreen(pdfPoints[i]);
        expectPointsClose(screenPoints[i], expected);
      }
    });

    it("converts multiple points from screen to PDF", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        scale: 1.5,
      });

      const screenPoints: Point2D[] = [
        { x: 50, y: 50 },
        { x: 150, y: 200 },
        { x: 300, y: 400 },
      ];

      const pdfPoints = transformer.screenPointsToPdf(screenPoints);

      expect(pdfPoints).toHaveLength(3);
      for (let i = 0; i < screenPoints.length; i++) {
        const expected = transformer.screenToPdf(screenPoints[i]);
        expectPointsClose(pdfPoints[i], expected);
      }
    });
  });

  describe("state modification", () => {
    it("updates scale and invalidates cache", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
      });

      const pdfPoint = { x: 100, y: 100 };

      // Get screen point at scale 1
      const screen1 = transformer.pdfToScreen(pdfPoint);

      // Update scale
      transformer.setScale(2);
      expect(transformer.scale).toBe(2);

      // Get screen point at scale 2 - should be different
      const screen2 = transformer.pdfToScreen(pdfPoint);
      expect(screen2.x).not.toBe(screen1.x);
    });

    it("clamps scale on setScale", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
      });

      transformer.setScale(0.1);
      expect(transformer.scale).toBe(MIN_ZOOM);

      transformer.setScale(10);
      expect(transformer.scale).toBe(MAX_ZOOM);
    });

    it("updates rotation and invalidates cache", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
      });

      transformer.setViewerRotation(90);
      expect(transformer.viewerRotation).toBe(90);
      expect(transformer.totalRotation).toBe(90);
    });

    it("updates offset", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
      });

      transformer.setOffset(50, 100);
      expect(transformer.offsetX).toBe(50);
      expect(transformer.offsetY).toBe(100);
    });

    it("updates page size", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
      });

      // A4 dimensions
      transformer.setPageSize(595, 842, 0);
      expect(transformer.pageWidth).toBe(595);
      expect(transformer.pageHeight).toBe(842);
    });

    it("updates device pixel ratio", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
      });

      transformer.setDevicePixelRatio(2);
      expect(transformer.devicePixelRatio).toBe(2);
      expect(transformer.effectiveScale).toBe(2);
    });
  });

  describe("bounds checking", () => {
    it("checks if screen point is in viewport", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        scale: 1,
        offsetX: 10,
        offsetY: 20,
      });

      // Point inside viewport
      expect(transformer.isPointInViewport({ x: 100, y: 100 })).toBe(true);

      // Point outside viewport (left of offset)
      expect(transformer.isPointInViewport({ x: 5, y: 100 })).toBe(false);

      // Point outside viewport (above offset)
      expect(transformer.isPointInViewport({ x: 100, y: 10 })).toBe(false);

      // Point outside viewport (right of page)
      expect(transformer.isPointInViewport({ x: LETTER_WIDTH + 50, y: 100 })).toBe(false);
    });

    it("checks if PDF point is in page", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
      });

      // Point inside page
      expect(transformer.isPointInPage({ x: 100, y: 100 })).toBe(true);

      // Point at origin
      expect(transformer.isPointInPage({ x: 0, y: 0 })).toBe(true);

      // Point at top-right
      expect(transformer.isPointInPage({ x: LETTER_WIDTH, y: LETTER_HEIGHT })).toBe(true);

      // Point outside page (negative)
      expect(transformer.isPointInPage({ x: -1, y: 100 })).toBe(false);

      // Point outside page (beyond dimensions)
      expect(transformer.isPointInPage({ x: 100, y: LETTER_HEIGHT + 1 })).toBe(false);
    });
  });

  describe("toViewport", () => {
    it("creates compatible viewport object", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        scale: 1.5,
        viewerRotation: 90,
        offsetX: 10,
        offsetY: 20,
      });

      const viewport = transformer.toViewport();

      expect(viewport.scale).toBe(1.5);
      expect(viewport.rotation).toBe(90);
      expect(viewport.offsetX).toBe(10);
      expect(viewport.offsetY).toBe(20);
      // With 90° rotation, width and height are swapped
      expect(viewport.width).toBe(LETTER_HEIGHT * 1.5);
      expect(viewport.height).toBe(LETTER_WIDTH * 1.5);
    });
  });

  describe("clone", () => {
    it("clones transformer with same settings", () => {
      const original = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        scale: 2,
        viewerRotation: 90,
      });

      const cloned = original.clone();

      expect(cloned.pageWidth).toBe(original.pageWidth);
      expect(cloned.pageHeight).toBe(original.pageHeight);
      expect(cloned.scale).toBe(original.scale);
      expect(cloned.viewerRotation).toBe(original.viewerRotation);
    });

    it("clones transformer with overrides", () => {
      const original = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        scale: 2,
      });

      const cloned = original.clone({ scale: 3 });

      expect(cloned.pageWidth).toBe(original.pageWidth);
      expect(cloned.scale).toBe(3);
    });
  });

  describe("createCoordinateTransformer helper", () => {
    it("creates transformer via helper function", () => {
      const transformer = createCoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        scale: 2,
      });

      expect(transformer).toBeInstanceOf(CoordinateTransformer);
      expect(transformer.scale).toBe(2);
    });
  });

  describe("zoom level boundaries", () => {
    it("works at minimum zoom level (25%)", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        scale: MIN_ZOOM,
      });

      expect(transformer.scale).toBe(0.25);

      // Test transformation still works
      const pdfPoint = { x: 100, y: 100 };
      const screenPoint = transformer.pdfToScreen(pdfPoint);
      const roundTrip = transformer.screenToPdf(screenPoint);
      expectPointsClose(roundTrip, pdfPoint);
    });

    it("works at maximum zoom level (500%)", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        scale: MAX_ZOOM,
      });

      expect(transformer.scale).toBe(5);

      // Test transformation still works
      const pdfPoint = { x: 100, y: 100 };
      const screenPoint = transformer.pdfToScreen(pdfPoint);
      const roundTrip = transformer.screenToPdf(screenPoint);
      expectPointsClose(roundTrip, pdfPoint);
    });

    it("works at common zoom levels", () => {
      const zoomLevels = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

      for (const scale of zoomLevels) {
        const transformer = new CoordinateTransformer({
          pageWidth: LETTER_WIDTH,
          pageHeight: LETTER_HEIGHT,
          scale,
        });

        const pdfPoint = { x: LETTER_WIDTH / 2, y: LETTER_HEIGHT / 2 };
        const screenPoint = transformer.pdfToScreen(pdfPoint);
        const roundTrip = transformer.screenToPdf(screenPoint);
        expectPointsClose(roundTrip, pdfPoint);
      }
    });
  });

  describe("edge cases", () => {
    it("handles very small page dimensions", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: 72, // 1 inch
        pageHeight: 72,
      });

      const pdfPoint = { x: 36, y: 36 };
      const screenPoint = transformer.pdfToScreen(pdfPoint);
      const roundTrip = transformer.screenToPdf(screenPoint);
      expectPointsClose(roundTrip, pdfPoint);
    });

    it("handles very large page dimensions", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: 14400, // 200 inches (huge poster)
        pageHeight: 14400,
      });

      const pdfPoint = { x: 7200, y: 7200 };
      const screenPoint = transformer.pdfToScreen(pdfPoint);
      const roundTrip = transformer.screenToPdf(screenPoint);
      expectPointsClose(roundTrip, pdfPoint);
    });

    it("handles non-standard aspect ratios", () => {
      // Panoramic
      const panoramic = new CoordinateTransformer({
        pageWidth: 2000,
        pageHeight: 200,
      });

      const pdfPoint = { x: 1000, y: 100 };
      const screenPoint = panoramic.pdfToScreen(pdfPoint);
      const roundTrip = panoramic.screenToPdf(screenPoint);
      expectPointsClose(roundTrip, pdfPoint);

      // Portrait extreme
      const portrait = new CoordinateTransformer({
        pageWidth: 200,
        pageHeight: 2000,
      });

      const pdfPoint2 = { x: 100, y: 1000 };
      const screenPoint2 = portrait.pdfToScreen(pdfPoint2);
      const roundTrip2 = portrait.screenToPdf(screenPoint2);
      expectPointsClose(roundTrip2, pdfPoint2);
    });

    it("handles zero offset", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        offsetX: 0,
        offsetY: 0,
      });

      expect(transformer.offsetX).toBe(0);
      expect(transformer.offsetY).toBe(0);

      const pdfPoint = { x: 100, y: 100 };
      const screenPoint = transformer.pdfToScreen(pdfPoint);
      const roundTrip = transformer.screenToPdf(screenPoint);
      expectPointsClose(roundTrip, pdfPoint);
    });

    it("handles negative offset", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        offsetX: -50,
        offsetY: -100,
      });

      const pdfPoint = { x: 100, y: 100 };
      const screenPoint = transformer.pdfToScreen(pdfPoint);
      const roundTrip = transformer.screenToPdf(screenPoint);
      expectPointsClose(roundTrip, pdfPoint);
    });
  });

  describe("matrix caching", () => {
    it("caches PDF to screen matrix", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
      });

      const matrix1 = transformer.getPdfToScreenMatrix();
      const matrix2 = transformer.getPdfToScreenMatrix();

      // Should return the same matrix instance
      expect(matrix1).toBe(matrix2);
    });

    it("invalidates cache on state change", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
      });

      const matrix1 = transformer.getPdfToScreenMatrix();
      transformer.setScale(2);
      const matrix2 = transformer.getPdfToScreenMatrix();

      // Should return different matrix instances
      expect(matrix1).not.toBe(matrix2);
    });
  });
});
