/**
 * Tests for TextLayerBuilder.
 *
 * Uses a mock DOM environment since TextLayerBuilder requires DOM APIs.
 */

import { CoordinateTransformer } from "#src/coordinate-transformer";
import type { ExtractedChar } from "#src/text/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTextLayerBuilder, TextLayerBuilder } from "./text-layer-builder";

// Standard US Letter page dimensions
const LETTER_WIDTH = 612;
const LETTER_HEIGHT = 792;

/**
 * Create a mock ExtractedChar for testing.
 */
function createMockChar(overrides: Partial<ExtractedChar> = {}): ExtractedChar {
  return {
    char: "A",
    bbox: {
      x: 100,
      y: 700, // PDF coordinates - near top
      width: 10,
      height: 12,
    },
    fontSize: 12,
    fontName: "Helvetica",
    baseline: 700,
    sequenceIndex: 0,
    ...overrides,
  };
}

/**
 * Mock HTMLElement for testing.
 */
class MockHTMLElement {
  style: Record<string, string> = {};
  children: MockHTMLElement[] = [];
  textContent: string | null = null;
  private attributes: Map<string, string> = new Map();
  private _firstChild: MockHTMLElement | null = null;

  get firstChild(): MockHTMLElement | null {
    return this.children[0] ?? null;
  }

  appendChild(child: MockHTMLElement): void {
    this.children.push(child);
  }

  removeChild(child: MockHTMLElement): void {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
    }
  }

  querySelectorAll(selector: string): MockHTMLElement[] {
    if (selector === "span") {
      return this.children.filter(c => c instanceof MockSpanElement);
    }
    return [];
  }

  querySelector(selector: string): MockHTMLElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }
}

/**
 * Mock span element.
 */
class MockSpanElement extends MockHTMLElement {}

/**
 * Create a mock container element for testing.
 */
function createMockContainer(): MockHTMLElement {
  return new MockHTMLElement();
}

/**
 * Create a standard coordinate transformer for testing.
 */
function createTransformer(scale = 1, rotation = 0): CoordinateTransformer {
  return new CoordinateTransformer({
    pageWidth: LETTER_WIDTH,
    pageHeight: LETTER_HEIGHT,
    scale,
    viewerRotation: rotation as 0 | 90 | 180 | 270,
  });
}

describe("TextLayerBuilder", () => {
  let container: MockHTMLElement;
  let transformer: CoordinateTransformer;
  let builder: TextLayerBuilder;
  let originalDocument: typeof globalThis.document;
  let mockCreateElement: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Store original document
    originalDocument = globalThis.document;

    // Create mock createElement
    mockCreateElement = vi.fn((tagName: string) => {
      if (tagName === "span") {
        return new MockSpanElement();
      }
      return new MockHTMLElement();
    });

    // Set up minimal document mock
    (globalThis as unknown as { document: unknown }).document = {
      createElement: mockCreateElement,
    };

    container = createMockContainer();
    transformer = createTransformer();
    builder = new TextLayerBuilder({
      container: container as unknown as HTMLElement,
      transformer,
    });
  });

  afterEach(() => {
    // Restore original document
    (globalThis as unknown as { document: typeof document }).document = originalDocument;
  });

  describe("constructor", () => {
    it("creates a TextLayerBuilder instance", () => {
      expect(builder).toBeInstanceOf(TextLayerBuilder);
    });

    it("stores the container reference", () => {
      expect(builder.container).toBe(container);
    });

    it("stores the transformer reference", () => {
      expect(builder.transformer).toBe(transformer);
    });

    it("can be created via factory function", () => {
      const factoryBuilder = createTextLayerBuilder({
        container: container as unknown as HTMLElement,
        transformer,
      });
      expect(factoryBuilder).toBeInstanceOf(TextLayerBuilder);
      expect(factoryBuilder.container).toBe(container);
    });
  });

  describe("buildTextLayer", () => {
    it("returns result with span count and container", () => {
      const chars = [createMockChar()];
      const result = builder.buildTextLayer(chars);

      expect(result.spanCount).toBe(1);
      expect(result.container).toBe(container);
    });

    it("creates span elements for each character", () => {
      const chars = [
        createMockChar({ char: "H", sequenceIndex: 0 }),
        createMockChar({
          char: "i",
          sequenceIndex: 1,
          bbox: { x: 110, y: 700, width: 5, height: 12 },
        }),
      ];

      builder.buildTextLayer(chars);

      const spans = container.querySelectorAll("span");
      expect(spans.length).toBe(2);
    });

    it("sets text content on spans", () => {
      const chars = [createMockChar({ char: "X" })];

      builder.buildTextLayer(chars);

      const span = container.querySelector("span");
      expect(span?.textContent).toBe("X");
    });

    it("creates spans for space characters", () => {
      const chars = [
        createMockChar({ char: "A", sequenceIndex: 0 }),
        createMockChar({
          char: " ",
          sequenceIndex: 1,
          bbox: { x: 110, y: 700, width: 4, height: 12 },
        }),
        createMockChar({
          char: "B",
          sequenceIndex: 2,
          bbox: { x: 114, y: 700, width: 10, height: 12 },
        }),
      ];

      const result = builder.buildTextLayer(chars);

      expect(result.spanCount).toBe(3);
    });

    it("clears previous content before building", () => {
      builder.buildTextLayer([createMockChar()]);
      builder.buildTextLayer([createMockChar()]);

      const spans = container.querySelectorAll("span");
      expect(spans.length).toBe(1);
    });

    it("handles empty char array", () => {
      const result = builder.buildTextLayer([]);

      expect(result.spanCount).toBe(0);
      expect(container.children.length).toBe(0);
    });
  });

  describe("span positioning", () => {
    it("positions spans using screen coordinates", () => {
      const chars = [
        createMockChar({
          bbox: { x: 100, y: 700, width: 10, height: 12 },
        }),
      ];

      builder.buildTextLayer(chars);

      const span = container.querySelector("span");
      expect(span?.style.position).toBe("absolute");
      expect(span?.style.left).toBeTruthy();
      expect(span?.style.top).toBeTruthy();
    });

    it("sets width and height on spans", () => {
      const chars = [
        createMockChar({
          bbox: { x: 100, y: 700, width: 15, height: 14 },
        }),
      ];

      builder.buildTextLayer(chars);

      const span = container.querySelector("span");
      expect(span?.style.width).toContain("px");
      expect(span?.style.height).toContain("px");
    });

    it("applies scale transformation to coordinates", () => {
      const scaledTransformer = createTransformer(2);
      const scaledBuilder = new TextLayerBuilder({
        container: container as unknown as HTMLElement,
        transformer: scaledTransformer,
      });

      const chars = [
        createMockChar({
          bbox: { x: 100, y: 700, width: 10, height: 12 },
        }),
      ];

      scaledBuilder.buildTextLayer(chars);

      const span = container.querySelector("span");
      const width = parseFloat(span?.style.width ?? "0");
      // At 2x scale, width should be doubled
      expect(width).toBeCloseTo(20, 0);
    });

    it("skips characters with zero width", () => {
      const chars = [
        createMockChar({
          bbox: { x: 100, y: 700, width: 0, height: 12 },
        }),
      ];

      const result = builder.buildTextLayer(chars);

      expect(result.spanCount).toBe(0);
    });

    it("skips characters with zero height", () => {
      const chars = [
        createMockChar({
          bbox: { x: 100, y: 700, width: 10, height: 0 },
        }),
      ];

      const result = builder.buildTextLayer(chars);

      expect(result.spanCount).toBe(0);
    });
  });

  describe("transparent text styling", () => {
    it("makes text color transparent", () => {
      const chars = [createMockChar()];

      builder.buildTextLayer(chars);

      const span = container.querySelector("span");
      expect(span?.style.color).toBe("transparent");
    });

    it("enables pointer events on spans", () => {
      const chars = [createMockChar()];

      builder.buildTextLayer(chars);

      const span = container.querySelector("span");
      expect(span?.style.pointerEvents).toBe("auto");
    });

    it("sets nowrap whitespace", () => {
      const chars = [createMockChar()];

      builder.buildTextLayer(chars);

      const span = container.querySelector("span");
      expect(span?.style.whiteSpace).toBe("nowrap");
    });

    it("hides overflow", () => {
      const chars = [createMockChar()];

      builder.buildTextLayer(chars);

      const span = container.querySelector("span");
      expect(span?.style.overflow).toBe("hidden");
    });
  });

  describe("font handling", () => {
    it("scales font size based on transformer", () => {
      const chars = [createMockChar({ fontSize: 14 })];

      builder.buildTextLayer(chars);

      const span = container.querySelector("span");
      const fontSize = parseFloat(span?.style.fontSize ?? "0");
      expect(fontSize).toBe(14); // At scale 1
    });

    it("maps Helvetica font correctly", () => {
      const chars = [createMockChar({ fontName: "Helvetica" })];

      builder.buildTextLayer(chars);

      const span = container.querySelector("span");
      expect(span?.style.fontFamily).toContain("Helvetica");
    });

    it("maps Times font correctly", () => {
      const chars = [createMockChar({ fontName: "Times-Roman" })];

      builder.buildTextLayer(chars);

      const span = container.querySelector("span");
      expect(span?.style.fontFamily).toContain("Times New Roman");
    });

    it("maps Courier font correctly", () => {
      const chars = [createMockChar({ fontName: "Courier" })];

      builder.buildTextLayer(chars);

      const span = container.querySelector("span");
      expect(span?.style.fontFamily).toContain("Courier New");
    });

    it("falls back to sans-serif for unknown fonts", () => {
      const chars = [createMockChar({ fontName: "CustomFont" })];

      builder.buildTextLayer(chars);

      const span = container.querySelector("span");
      expect(span?.style.fontFamily).toBe("sans-serif");
    });

    it("handles font names with leading slash", () => {
      const chars = [createMockChar({ fontName: "/Helvetica" })];

      builder.buildTextLayer(chars);

      const span = container.querySelector("span");
      expect(span?.style.fontFamily).toContain("Helvetica");
    });
  });

  describe("data attributes", () => {
    it("adds data-char attribute", () => {
      const chars = [createMockChar({ char: "Z" })];

      builder.buildTextLayer(chars);

      const span = container.querySelector("span");
      expect(span?.getAttribute("data-char")).toBe("Z");
    });

    it("adds data-index attribute when sequenceIndex is present", () => {
      const chars = [createMockChar({ sequenceIndex: 42 })];

      builder.buildTextLayer(chars);

      const span = container.querySelector("span");
      expect(span?.getAttribute("data-index")).toBe("42");
    });

    it("omits data-index when sequenceIndex is undefined", () => {
      const chars = [createMockChar({ sequenceIndex: undefined })];

      builder.buildTextLayer(chars);

      const span = container.querySelector("span");
      expect(span?.hasAttribute("data-index")).toBe(false);
    });
  });

  describe("container setup", () => {
    it("sets container to absolute positioning", () => {
      builder.buildTextLayer([createMockChar()]);

      expect(container.style.position).toBe("absolute");
    });

    it("sets container to fill parent", () => {
      builder.buildTextLayer([createMockChar()]);

      expect(container.style.left).toBe("0");
      expect(container.style.top).toBe("0");
      expect(container.style.right).toBe("0");
      expect(container.style.bottom).toBe("0");
    });

    it("disables pointer events on container", () => {
      builder.buildTextLayer([createMockChar()]);

      expect(container.style.pointerEvents).toBe("none");
    });

    it("hides overflow on container", () => {
      builder.buildTextLayer([createMockChar()]);

      expect(container.style.overflow).toBe("hidden");
    });
  });

  describe("clear method", () => {
    it("removes all child elements", () => {
      builder.buildTextLayer([createMockChar(), createMockChar()]);
      expect(container.children.length).toBe(2);

      builder.clear();

      expect(container.children.length).toBe(0);
    });

    it("can be called on empty container", () => {
      expect(() => builder.clear()).not.toThrow();
    });
  });

  describe("coordinate transformation integration", () => {
    it("converts PDF bottom-left to screen top-left", () => {
      // Create a character at PDF top-left (0, pageHeight)
      const chars = [
        createMockChar({
          bbox: { x: 0, y: LETTER_HEIGHT, width: 10, height: 12 },
        }),
      ];

      builder.buildTextLayer(chars);

      const span = container.querySelector("span");
      const top = parseFloat(span?.style.top ?? "0");
      // PDF top (y = pageHeight) should map to screen top (y near 0)
      expect(top).toBeLessThan(20);
    });

    it("handles different zoom levels", () => {
      const transformer2x = createTransformer(2);
      const builder2x = new TextLayerBuilder({
        container: container as unknown as HTMLElement,
        transformer: transformer2x,
      });

      const chars = [
        createMockChar({
          bbox: { x: 100, y: 700, width: 10, height: 12 },
          fontSize: 12,
        }),
      ];

      builder2x.buildTextLayer(chars);

      const span = container.querySelector("span");
      const fontSize = parseFloat(span?.style.fontSize ?? "0");
      // At 2x scale, font size should be doubled
      expect(fontSize).toBeCloseTo(24, 0);
    });

    it("handles page rotation", () => {
      const rotatedTransformer = createTransformer(1, 90);
      const rotatedBuilder = new TextLayerBuilder({
        container: container as unknown as HTMLElement,
        transformer: rotatedTransformer,
      });

      const chars = [createMockChar()];

      rotatedBuilder.buildTextLayer(chars);

      // Should create span without errors
      const span = container.querySelector("span");
      expect(span).toBeTruthy();
    });
  });

  describe("multiple characters", () => {
    it("builds text layer for a word", () => {
      const word = "Hello";
      const chars: ExtractedChar[] = [];
      let x = 100;

      for (let i = 0; i < word.length; i++) {
        chars.push(
          createMockChar({
            char: word[i],
            sequenceIndex: i,
            bbox: { x, y: 700, width: 10, height: 12 },
          }),
        );
        x += 10;
      }

      const result = builder.buildTextLayer(chars);

      expect(result.spanCount).toBe(5);

      const spans = container.querySelectorAll("span");
      expect(spans[0].textContent).toBe("H");
      expect(spans[1].textContent).toBe("e");
      expect(spans[2].textContent).toBe("l");
      expect(spans[3].textContent).toBe("l");
      expect(spans[4].textContent).toBe("o");
    });

    it("handles multi-line text", () => {
      const chars = [
        createMockChar({ char: "A", bbox: { x: 100, y: 700, width: 10, height: 12 } }),
        createMockChar({ char: "B", bbox: { x: 100, y: 680, width: 10, height: 12 } }),
      ];

      const result = builder.buildTextLayer(chars);

      expect(result.spanCount).toBe(2);

      const spans = container.querySelectorAll("span");
      const top1 = parseFloat(spans[0].style.top ?? "0");
      const top2 = parseFloat(spans[1].style.top ?? "0");
      // Different PDF y values should result in different screen positions
      expect(top1).not.toBe(top2);
    });

    it("preserves character order", () => {
      const chars = [
        createMockChar({ char: "1", sequenceIndex: 0 }),
        createMockChar({ char: "2", sequenceIndex: 1 }),
        createMockChar({ char: "3", sequenceIndex: 2 }),
      ];

      builder.buildTextLayer(chars);

      const spans = container.querySelectorAll("span");
      expect(spans[0].getAttribute("data-index")).toBe("0");
      expect(spans[1].getAttribute("data-index")).toBe("1");
      expect(spans[2].getAttribute("data-index")).toBe("2");
    });
  });

  describe("edge cases", () => {
    it("handles special characters", () => {
      const chars = [
        createMockChar({ char: "&" }),
        createMockChar({ char: "<", bbox: { x: 110, y: 700, width: 10, height: 12 } }),
        createMockChar({ char: ">", bbox: { x: 120, y: 700, width: 10, height: 12 } }),
      ];

      const result = builder.buildTextLayer(chars);

      expect(result.spanCount).toBe(3);
      const spans = container.querySelectorAll("span");
      expect(spans[0].textContent).toBe("&");
      expect(spans[1].textContent).toBe("<");
      expect(spans[2].textContent).toBe(">");
    });

    it("handles unicode characters", () => {
      const chars = [
        createMockChar({ char: "\u00e9" }), // e with accent
        createMockChar({
          char: "\u4e2d",
          bbox: { x: 110, y: 700, width: 12, height: 12 },
        }), // Chinese character
      ];

      const result = builder.buildTextLayer(chars);

      expect(result.spanCount).toBe(2);
    });

    it("handles very small bounding boxes", () => {
      const chars = [
        createMockChar({
          bbox: { x: 100, y: 700, width: 0.5, height: 1 },
        }),
      ];

      const result = builder.buildTextLayer(chars);

      expect(result.spanCount).toBe(1);
    });

    it("handles negative coordinates", () => {
      const chars = [
        createMockChar({
          bbox: { x: -10, y: 700, width: 10, height: 12 },
        }),
      ];

      // Should not throw
      expect(() => builder.buildTextLayer(chars)).not.toThrow();
    });
  });
});
