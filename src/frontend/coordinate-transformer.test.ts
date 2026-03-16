/**
 * Tests for frontend coordinate transformation utilities.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  CoordinateTransformer,
  createCoordinateTransformer,
  createSelectionRect,
  createTransformerForPageContainer,
  calculateCenteredOffset,
  findAllBoxesAtPoint,
  findBoxesInSelection,
  getMousePdfCoordinates,
  getTouchPdfCoordinates,
  hitTestBoundingBoxes,
  MAX_ZOOM,
  MIN_ZOOM,
  transformBoundingBoxes,
  transformScreenRectToPdf,
  type PdfBoundingBox,
  type Point2D,
} from "./coordinate-transformer";

// Standard US Letter page dimensions in PDF points
const LETTER_WIDTH = 612;
const LETTER_HEIGHT = 792;

/**
 * Simple DOMRect-like object for testing in Node.js environment.
 */
interface MockDOMRect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  left: number;
  right: number;
  bottom: number;
}

/**
 * Create a mock DOMRect for use in tests.
 */
function createMockDOMRect(x: number, y: number, width: number, height: number): MockDOMRect {
  return {
    x,
    y,
    width,
    height,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
  };
}

// Helper to check if two points are approximately equal
function expectPointsClose(actual: Point2D, expected: Point2D, tolerance = 0.001): void {
  expect(actual.x).toBeCloseTo(expected.x, tolerance);
  expect(actual.y).toBeCloseTo(expected.y, tolerance);
}

// Helper to create a mock HTML element with bounds
function createMockElement(rect: MockDOMRect): HTMLElement {
  return {
    getBoundingClientRect: () => rect,
    clientWidth: rect.width,
    clientHeight: rect.height,
  } as HTMLElement;
}

// Helper to create a mock mouse event
function createMockMouseEvent(clientX: number, clientY: number): MouseEvent {
  return {
    clientX,
    clientY,
  } as MouseEvent;
}

// Helper to create a mock touch object
function createMockTouch(clientX: number, clientY: number): Touch {
  return {
    clientX,
    clientY,
  } as Touch;
}

describe("Frontend CoordinateTransformer", () => {
  describe("re-exports", () => {
    it("re-exports CoordinateTransformer class", () => {
      expect(CoordinateTransformer).toBeDefined();
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
      });
      expect(transformer).toBeInstanceOf(CoordinateTransformer);
    });

    it("re-exports createCoordinateTransformer helper", () => {
      expect(createCoordinateTransformer).toBeDefined();
      const transformer = createCoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
      });
      expect(transformer).toBeInstanceOf(CoordinateTransformer);
    });

    it("re-exports zoom constants", () => {
      expect(MIN_ZOOM).toBe(0.25);
      expect(MAX_ZOOM).toBe(5.0);
    });
  });

  describe("getMousePdfCoordinates", () => {
    let transformer: CoordinateTransformer;
    let element: HTMLElement;

    beforeEach(() => {
      transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        scale: 1,
      });

      // Create an element positioned at (100, 50) with the page dimensions
      element = createMockElement(createMockDOMRect(100, 50, LETTER_WIDTH, LETTER_HEIGHT));
    });

    it("converts mouse event to PDF coordinates", () => {
      // Click at element position (0, 0) relative to element
      // This is at the top-left of the rendered page
      const event = createMockMouseEvent(100, 50);
      const result = getMousePdfCoordinates(event, element, transformer);

      // Top-left in screen space is (0, pageHeight) in PDF space
      expectPointsClose(result.point, { x: 0, y: LETTER_HEIGHT });
      expect(result.isInPage).toBe(true);
    });

    it("converts click in middle of page", () => {
      // Click at center of page
      const event = createMockMouseEvent(100 + LETTER_WIDTH / 2, 50 + LETTER_HEIGHT / 2);
      const result = getMousePdfCoordinates(event, element, transformer);

      expectPointsClose(result.point, {
        x: LETTER_WIDTH / 2,
        y: LETTER_HEIGHT / 2,
      });
      expect(result.isInPage).toBe(true);
    });

    it("handles scaled page", () => {
      transformer.setScale(2);

      // Element should now be 2x the size
      element = createMockElement(createMockDOMRect(100, 50, LETTER_WIDTH * 2, LETTER_HEIGHT * 2));

      // Click at the center of the scaled page
      const event = createMockMouseEvent(
        100 + LETTER_WIDTH, // Center X at scale 2
        50 + LETTER_HEIGHT, // Center Y at scale 2
      );
      const result = getMousePdfCoordinates(event, element, transformer);

      expectPointsClose(result.point, {
        x: LETTER_WIDTH / 2,
        y: LETTER_HEIGHT / 2,
      });
    });

    it("detects click outside page bounds", () => {
      // Click way outside the page
      const event = createMockMouseEvent(1000, 1000);
      const result = getMousePdfCoordinates(event, element, transformer, {
        clampToPage: false,
      });

      expect(result.isInPage).toBe(false);
    });

    it("clamps coordinates to page bounds by default", () => {
      // Click outside page (negative relative to element)
      const event = createMockMouseEvent(50, 0); // Left of element
      const result = getMousePdfCoordinates(event, element, transformer);

      // Should be clamped to x=0
      expect(result.point.x).toBe(0);
    });

    it("does not clamp when option is disabled", () => {
      const event = createMockMouseEvent(50, 0);
      const result = getMousePdfCoordinates(event, element, transformer, {
        clampToPage: false,
      });

      // Should not be clamped
      expect(result.point.x).toBeLessThan(0);
    });

    it("returns original screen point", () => {
      const event = createMockMouseEvent(200, 150);
      const result = getMousePdfCoordinates(event, element, transformer);

      // Screen point should be relative to element
      expect(result.screenPoint.x).toBe(100); // 200 - 100
      expect(result.screenPoint.y).toBe(100); // 150 - 50
    });
  });

  describe("getTouchPdfCoordinates", () => {
    let transformer: CoordinateTransformer;
    let element: HTMLElement;

    beforeEach(() => {
      transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        scale: 1,
      });

      element = createMockElement(createMockDOMRect(100, 50, LETTER_WIDTH, LETTER_HEIGHT));
    });

    it("converts touch to PDF coordinates", () => {
      const touch = createMockTouch(100, 50);
      const result = getTouchPdfCoordinates(touch, element, transformer);

      expectPointsClose(result.point, { x: 0, y: LETTER_HEIGHT });
      expect(result.isInPage).toBe(true);
    });

    it("handles scaled page", () => {
      transformer.setScale(2);
      element = createMockElement(createMockDOMRect(100, 50, LETTER_WIDTH * 2, LETTER_HEIGHT * 2));

      const touch = createMockTouch(100 + LETTER_WIDTH, 50 + LETTER_HEIGHT);
      const result = getTouchPdfCoordinates(touch, element, transformer);

      expectPointsClose(result.point, {
        x: LETTER_WIDTH / 2,
        y: LETTER_HEIGHT / 2,
      });
    });
  });

  describe("transformBoundingBoxes", () => {
    let transformer: CoordinateTransformer;

    beforeEach(() => {
      transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        scale: 1,
      });
    });

    it("transforms PDF boxes to screen boxes", () => {
      const pdfBoxes: PdfBoundingBox[] = [
        { x: 72, y: 720, width: 100, height: 12, type: "word" },
        { x: 180, y: 720, width: 80, height: 12, type: "word" },
      ];

      const screenBoxes = transformBoundingBoxes(pdfBoxes, transformer);

      expect(screenBoxes).toHaveLength(2);
      expect(screenBoxes[0].type).toBe("word");
      expect(screenBoxes[0].original).toBe(pdfBoxes[0]);
    });

    it("scales boxes correctly", () => {
      transformer.setScale(2);

      const pdfBoxes: PdfBoundingBox[] = [{ x: 0, y: 0, width: 100, height: 50 }];

      const screenBoxes = transformBoundingBoxes(pdfBoxes, transformer);

      // At scale 2, dimensions should be doubled
      expect(screenBoxes[0].width).toBeCloseTo(200, 1);
      expect(screenBoxes[0].height).toBeCloseTo(100, 1);
    });

    it("preserves id and type", () => {
      const pdfBoxes: PdfBoundingBox[] = [
        { x: 0, y: 0, width: 100, height: 50, id: "box-1", type: "character" },
      ];

      const screenBoxes = transformBoundingBoxes(pdfBoxes, transformer);

      expect(screenBoxes[0].id).toBe("box-1");
      expect(screenBoxes[0].type).toBe("character");
    });

    it("handles empty array", () => {
      const screenBoxes = transformBoundingBoxes([], transformer);
      expect(screenBoxes).toHaveLength(0);
    });
  });

  describe("transformScreenRectToPdf", () => {
    it("transforms screen rect to PDF coordinates", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        scale: 2,
      });

      const screenRect = { x: 0, y: 0, width: 200, height: 100 };
      const pdfRect = transformScreenRectToPdf(screenRect, transformer);

      // At scale 2, dimensions should be halved
      expect(pdfRect.width).toBeCloseTo(100, 1);
      expect(pdfRect.height).toBeCloseTo(50, 1);
    });
  });

  describe("createTransformerForPageContainer", () => {
    it("creates transformer with calculated scale", () => {
      const container = createMockElement(
        createMockDOMRect(0, 0, LETTER_WIDTH * 1.5, LETTER_HEIGHT * 1.5),
      );

      const transformer = createTransformerForPageContainer(container, {
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
      });

      expect(transformer.scale).toBeCloseTo(1.5, 1);
    });

    it("fits page in container (width-constrained)", () => {
      // Container is wider than it should be for the page's aspect ratio
      const container = createMockElement(createMockDOMRect(0, 0, LETTER_WIDTH * 2, LETTER_HEIGHT));

      const transformer = createTransformerForPageContainer(container, {
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
      });

      // Should use height-based scale (1.0) since that's the limiting factor
      expect(transformer.scale).toBeCloseTo(1, 1);
    });

    it("fits page in container (height-constrained)", () => {
      // Container is taller than it should be for the page's aspect ratio
      const container = createMockElement(createMockDOMRect(0, 0, LETTER_WIDTH, LETTER_HEIGHT * 2));

      const transformer = createTransformerForPageContainer(container, {
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
      });

      // Should use width-based scale (1.0) since that's the limiting factor
      expect(transformer.scale).toBeCloseTo(1, 1);
    });

    it("handles rotation", () => {
      const container = createMockElement(createMockDOMRect(0, 0, LETTER_HEIGHT, LETTER_WIDTH));

      const transformer = createTransformerForPageContainer(container, {
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        viewerRotation: 90,
      });

      // With 90° rotation, effective dimensions are swapped
      expect(transformer.effectivePageSize.width).toBe(LETTER_HEIGHT);
      expect(transformer.effectivePageSize.height).toBe(LETTER_WIDTH);
    });

    it("defaults to scale 1 for zero-size container", () => {
      const container = createMockElement(createMockDOMRect(0, 0, 0, 0));

      const transformer = createTransformerForPageContainer(container, {
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
      });

      expect(transformer.scale).toBe(1);
    });

    it("uses device pixel ratio when enabled", () => {
      const container = createMockElement(createMockDOMRect(0, 0, LETTER_WIDTH, LETTER_HEIGHT));

      // Mock devicePixelRatio
      const originalDPR = globalThis.devicePixelRatio;
      Object.defineProperty(globalThis, "devicePixelRatio", {
        value: 2,
        configurable: true,
      });

      const transformer = createTransformerForPageContainer(container, {
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        useDevicePixelRatio: true,
      });

      expect(transformer.devicePixelRatio).toBe(2);

      // Restore
      Object.defineProperty(globalThis, "devicePixelRatio", {
        value: originalDPR,
        configurable: true,
      });
    });

    it("ignores device pixel ratio when disabled", () => {
      const container = createMockElement(createMockDOMRect(0, 0, LETTER_WIDTH, LETTER_HEIGHT));

      const transformer = createTransformerForPageContainer(container, {
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        useDevicePixelRatio: false,
      });

      expect(transformer.devicePixelRatio).toBe(1);
    });
  });

  describe("calculateCenteredOffset", () => {
    it("calculates offset to center page horizontally", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: 400,
        pageHeight: 600,
        scale: 1,
      });

      const offset = calculateCenteredOffset(600, 600, transformer);

      // Container is 600 wide, page is 400 wide, so offset should be 100
      expect(offset.offsetX).toBe(100);
      expect(offset.offsetY).toBe(0);
    });

    it("calculates offset to center page vertically", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: 600,
        pageHeight: 400,
        scale: 1,
      });

      const offset = calculateCenteredOffset(600, 600, transformer);

      // Container is 600 tall, page is 400 tall, so offset should be 100
      expect(offset.offsetX).toBe(0);
      expect(offset.offsetY).toBe(100);
    });

    it("calculates offset with scale", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: 400,
        pageHeight: 600,
        scale: 2,
      });

      const offset = calculateCenteredOffset(1000, 1400, transformer);

      // Page at scale 2 is 800x1200
      // Container is 1000x1400
      expect(offset.offsetX).toBe(100);
      expect(offset.offsetY).toBe(100);
    });

    it("returns zero offset when page is larger than container", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: 800,
        pageHeight: 1000,
        scale: 1,
      });

      const offset = calculateCenteredOffset(400, 500, transformer);

      expect(offset.offsetX).toBe(0);
      expect(offset.offsetY).toBe(0);
    });
  });

  describe("hitTestBoundingBoxes", () => {
    let transformer: CoordinateTransformer;
    let boxes: PdfBoundingBox[];

    beforeEach(() => {
      transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        scale: 1,
      });

      boxes = [
        { x: 100, y: 100, width: 50, height: 20, id: "box1" },
        { x: 200, y: 100, width: 50, height: 20, id: "box2" },
        { x: 100, y: 200, width: 50, height: 20, id: "box3" },
      ];
    });

    it("returns box that contains the point", () => {
      // Convert box1 center to screen coordinates
      const pdfCenter = { x: 125, y: 110 };
      const screenCenter = transformer.pdfToScreen(pdfCenter);

      const result = hitTestBoundingBoxes(screenCenter, boxes, transformer);

      expect(result).not.toBeNull();
      expect(result?.id).toBe("box1");
    });

    it("returns null when no box contains the point", () => {
      // Point that's not in any box
      const screenPoint = transformer.pdfToScreen({ x: 50, y: 50 });

      const result = hitTestBoundingBoxes(screenPoint, boxes, transformer);

      expect(result).toBeNull();
    });

    it("returns first matching box when boxes overlap", () => {
      const overlappingBoxes: PdfBoundingBox[] = [
        { x: 100, y: 100, width: 100, height: 50, id: "first" },
        { x: 120, y: 100, width: 100, height: 50, id: "second" },
      ];

      // Point in the overlap region
      const screenPoint = transformer.pdfToScreen({ x: 150, y: 125 });

      const result = hitTestBoundingBoxes(screenPoint, overlappingBoxes, transformer);

      expect(result?.id).toBe("first");
    });
  });

  describe("findAllBoxesAtPoint", () => {
    let transformer: CoordinateTransformer;

    beforeEach(() => {
      transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        scale: 1,
      });
    });

    it("returns all overlapping boxes", () => {
      const overlappingBoxes: PdfBoundingBox[] = [
        { x: 100, y: 100, width: 100, height: 50, id: "first" },
        { x: 120, y: 100, width: 100, height: 50, id: "second" },
        { x: 300, y: 100, width: 50, height: 50, id: "third" },
      ];

      // Point in the overlap region of first two boxes
      const screenPoint = transformer.pdfToScreen({ x: 150, y: 125 });

      const results = findAllBoxesAtPoint(screenPoint, overlappingBoxes, transformer);

      expect(results).toHaveLength(2);
      expect(results.map(b => b.id)).toContain("first");
      expect(results.map(b => b.id)).toContain("second");
    });

    it("returns empty array when no boxes match", () => {
      const boxes: PdfBoundingBox[] = [{ x: 100, y: 100, width: 50, height: 20 }];

      const screenPoint = transformer.pdfToScreen({ x: 0, y: 0 });
      const results = findAllBoxesAtPoint(screenPoint, boxes, transformer);

      expect(results).toHaveLength(0);
    });
  });

  describe("createSelectionRect", () => {
    let transformer: CoordinateTransformer;

    beforeEach(() => {
      transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        scale: 1,
      });
    });

    it("creates rect from start to end (normal direction)", () => {
      const startPoint: Point2D = { x: 100, y: 100 };
      const endPoint: Point2D = { x: 200, y: 150 };

      const rect = createSelectionRect(startPoint, endPoint, transformer);

      expect(rect.width).toBeCloseTo(100, 1);
      expect(rect.height).toBeCloseTo(50, 1);
    });

    it("handles reversed direction (end before start)", () => {
      const startPoint: Point2D = { x: 200, y: 150 };
      const endPoint: Point2D = { x: 100, y: 100 };

      const rect = createSelectionRect(startPoint, endPoint, transformer);

      // Should still have positive dimensions
      expect(rect.width).toBeCloseTo(100, 1);
      expect(rect.height).toBeCloseTo(50, 1);
    });

    it("handles vertical direction", () => {
      const startPoint: Point2D = { x: 100, y: 200 };
      const endPoint: Point2D = { x: 100, y: 100 };

      const rect = createSelectionRect(startPoint, endPoint, transformer);

      expect(rect.width).toBe(0);
      expect(rect.height).toBeCloseTo(100, 1);
    });
  });

  describe("findBoxesInSelection", () => {
    it("finds boxes fully inside selection", () => {
      const selectionRect = { x: 0, y: 0, width: 200, height: 200 };
      const boxes: PdfBoundingBox[] = [
        { x: 50, y: 50, width: 50, height: 50, id: "inside" },
        { x: 300, y: 300, width: 50, height: 50, id: "outside" },
      ];

      const results = findBoxesInSelection(selectionRect, boxes);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("inside");
    });

    it("finds boxes partially overlapping selection", () => {
      const selectionRect = { x: 100, y: 100, width: 100, height: 100 };
      const boxes: PdfBoundingBox[] = [
        { x: 50, y: 50, width: 100, height: 100, id: "partial" }, // Overlaps top-left
        { x: 150, y: 150, width: 100, height: 100, id: "partial2" }, // Overlaps bottom-right
        { x: 300, y: 300, width: 50, height: 50, id: "outside" }, // No overlap
      ];

      const results = findBoxesInSelection(selectionRect, boxes);

      expect(results).toHaveLength(2);
      expect(results.map(b => b.id)).toContain("partial");
      expect(results.map(b => b.id)).toContain("partial2");
    });

    it("returns empty array for no intersections", () => {
      const selectionRect = { x: 0, y: 0, width: 50, height: 50 };
      const boxes: PdfBoundingBox[] = [{ x: 100, y: 100, width: 50, height: 50 }];

      const results = findBoxesInSelection(selectionRect, boxes);

      expect(results).toHaveLength(0);
    });

    it("handles edge-touching boxes as intersecting", () => {
      const selectionRect = { x: 100, y: 100, width: 100, height: 100 };
      const boxes: PdfBoundingBox[] = [
        // Box that touches the selection at x=100 (left edge)
        { x: 50, y: 100, width: 50, height: 50, id: "touching-left" },
      ];

      const results = findBoxesInSelection(selectionRect, boxes);

      // Edge-touching should be considered intersecting
      expect(results).toHaveLength(1);
    });
  });

  describe("integration scenarios", () => {
    it("handles mouse click to PDF coordinate workflow", () => {
      // Simulate a page container at position (50, 100) with scale 1.5
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        scale: 1.5,
      });

      const element = createMockElement(
        createMockDOMRect(50, 100, LETTER_WIDTH * 1.5, LETTER_HEIGHT * 1.5),
      );

      // User clicks at screen position (200, 250)
      const event = createMockMouseEvent(200, 250);
      const result = getMousePdfCoordinates(event, element, transformer);

      // Verify we got a valid PDF coordinate
      expect(result.isInPage).toBe(true);
      expect(result.point.x).toBeGreaterThanOrEqual(0);
      expect(result.point.x).toBeLessThanOrEqual(LETTER_WIDTH);
      expect(result.point.y).toBeGreaterThanOrEqual(0);
      expect(result.point.y).toBeLessThanOrEqual(LETTER_HEIGHT);

      // Verify round-trip: the screen point should transform back
      const screenBack = transformer.pdfToScreen(result.point);
      expectPointsClose(screenBack, result.screenPoint);
    });

    it("handles text selection workflow", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        scale: 2,
      });

      // Word bounding boxes from text extraction
      const wordBoxes: PdfBoundingBox[] = [
        { x: 72, y: 700, width: 60, height: 12, id: "word1", data: "Hello" },
        { x: 140, y: 700, width: 50, height: 12, id: "word2", data: "World" },
        { x: 72, y: 680, width: 80, height: 12, id: "word3", data: "Example" },
      ];

      // User drags to select
      const startScreen = transformer.pdfToScreen({ x: 50, y: 705 });
      const endScreen = transformer.pdfToScreen({ x: 200, y: 695 });

      const selection = createSelectionRect(startScreen, endScreen, transformer);
      const selected = findBoxesInSelection(selection, wordBoxes);

      // Should select word1 and word2 (both on y=700 line)
      expect(selected).toHaveLength(2);
      expect(selected.map(w => w.id)).toContain("word1");
      expect(selected.map(w => w.id)).toContain("word2");
    });

    it("handles bounding box visualization workflow", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        scale: 1.5,
        viewerRotation: 0,
      });

      // Character bounding boxes
      const charBoxes: PdfBoundingBox[] = [
        { x: 72, y: 720, width: 8, height: 12, type: "character" },
        { x: 80, y: 720, width: 8, height: 12, type: "character" },
        { x: 88, y: 720, width: 8, height: 12, type: "character" },
      ];

      // Transform for rendering
      const screenBoxes = transformBoundingBoxes(charBoxes, transformer);

      expect(screenBoxes).toHaveLength(3);

      // Each box should be scaled by 1.5
      for (const box of screenBoxes) {
        expect(box.width).toBeCloseTo(8 * 1.5, 1);
        expect(box.height).toBeCloseTo(12 * 1.5, 1);
        expect(box.original).toBeDefined();
      }
    });

    it("handles rotation with coordinate transformation", () => {
      const transformer = new CoordinateTransformer({
        pageWidth: LETTER_WIDTH,
        pageHeight: LETTER_HEIGHT,
        viewerRotation: 90,
        scale: 1,
      });

      // Test that round-trip works with rotation
      const pdfPoint = { x: 100, y: 200 };
      const screenPoint = transformer.pdfToScreen(pdfPoint);
      const roundTrip = transformer.screenToPdf(screenPoint);

      expectPointsClose(roundTrip, pdfPoint);

      // Test bounding box transformation
      const boxes: PdfBoundingBox[] = [{ x: 100, y: 100, width: 50, height: 20 }];

      const transformed = transformBoundingBoxes(boxes, transformer);
      expect(transformed).toHaveLength(1);

      // Transform back
      const backToPdf = transformScreenRectToPdf(transformed[0], transformer);
      expect(backToPdf.width).toBeCloseTo(50, 1);
      expect(backToPdf.height).toBeCloseTo(20, 1);
    });
  });
});
