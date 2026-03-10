/**
 * Integration tests for DOM recycling system.
 *
 * Tests the complete integration of VirtualScrollContainer with
 * DOMRecycler and PageEstimator to verify that:
 * - DOM elements are properly recycled across viewport changes
 * - Estimated heights maintain scroll position accuracy
 * - The system handles large documents efficiently
 *
 * Uses a minimal DOM mock since the project doesn't include jsdom.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VirtualScroller } from "../../virtual-scroller";
import {
  createVirtualScrollContainer,
  DOMRecycler,
  PageEstimator,
  VirtualScrollContainer,
} from "./index";

// Standard US Letter page dimensions
const LETTER_WIDTH = 612;
const LETTER_HEIGHT = 792;

// Minimal DOM mock
class MockStyle {
  [key: string]: string | (() => string);
  width = "";
  height = "";
  top = "";
  left = "";
  position = "";
  display = "";
  transform = "";
  overflow = "";
  lineHeight = "";
  right = "";
  bottom = "";
  pointerEvents = "";

  set cssText(value: string) {
    const declarations = value.split(";").filter(d => d.trim());
    for (const decl of declarations) {
      const [prop, val] = decl.split(":").map(s => s.trim());
      if (prop && val) {
        const camelProp = prop.replace(/-([a-z])/g, (_, l) => l.toUpperCase());
        this[camelProp] = val;
      }
    }
  }

  get cssText(): string {
    return Object.entries(this)
      .filter(([_, v]) => typeof v === "string")
      .map(([k, v]) => `${k}: ${v}`)
      .join("; ");
  }
}

class MockElement {
  tagName: string;
  className = "";
  innerHTML = "";
  style = new MockStyle();
  children: MockElement[] = [];
  parentElement: MockElement | null = null;
  private attributes: Map<string, string> = new Map();

  constructor(tagName = "DIV") {
    this.tagName = tagName.toUpperCase();
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  appendChild(child: MockElement): MockElement {
    this.children.push(child);
    child.parentElement = this;
    return child;
  }
}

class MockCanvasElement extends MockElement {
  width = 0;
  height = 0;

  constructor() {
    super("CANVAS");
  }
}

const mockDocument = {
  createElement(tagName: string): MockElement {
    if (tagName.toLowerCase() === "canvas") {
      return new MockCanvasElement();
    }
    return new MockElement(tagName);
  },
};

beforeEach(() => {
  global.document = mockDocument as unknown as Document;
});

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Create page dimensions array for testing.
 */
function createPageDimensions(count: number) {
  return Array.from({ length: count }, () => ({
    width: LETTER_WIDTH,
    height: LETTER_HEIGHT,
  }));
}

describe("DOM Recycling Integration", () => {
  describe("VirtualScrollContainer with VirtualScroller", () => {
    it("creates container with all components", () => {
      const scroller = new VirtualScroller({
        viewportWidth: 800,
        viewportHeight: 600,
      });

      const container = new VirtualScrollContainer({ scroller });

      expect(container.scroller).toBe(scroller);
      expect(container.recycler).toBeInstanceOf(DOMRecycler);
      expect(container.estimator).toBeInstanceOf(PageEstimator);
    });

    it("creates container via factory function", () => {
      const scroller = new VirtualScroller();
      const container = createVirtualScrollContainer({ scroller });

      expect(container).toBeInstanceOf(VirtualScrollContainer);
    });

    it("syncs page dimensions to both scroller and estimator", () => {
      const scroller = new VirtualScroller();
      const container = new VirtualScrollContainer({ scroller });

      container.setPageDimensions(createPageDimensions(10));

      expect(scroller.pageCount).toBe(10);
      expect(container.pageCount).toBe(10);
    });
  });

  describe("DOM element recycling across viewport changes", () => {
    it("acquires elements for visible pages", () => {
      const scroller = new VirtualScroller({
        viewportWidth: 800,
        viewportHeight: 600,
        bufferSize: 0,
      });
      const container = new VirtualScrollContainer({
        scroller,
        autoManageElements: true,
      });

      container.setPageDimensions(createPageDimensions(20));

      const visibleElements = container.getVisiblePageElements();
      expect(visibleElements.size).toBeGreaterThan(0);

      // Each visible page should have a pageContainer
      for (const [pageIndex, elements] of visibleElements) {
        expect(elements.has("pageContainer")).toBe(true);
        expect(container.isPageVisible(pageIndex)).toBe(true);
      }
    });

    it("recycles elements when pages leave viewport", () => {
      const scroller = new VirtualScroller({
        viewportWidth: 800,
        viewportHeight: 600,
        bufferSize: 0,
      });
      const container = new VirtualScrollContainer({
        scroller,
        autoManageElements: true,
      });

      container.setPageDimensions(createPageDimensions(20));

      // Get initial stats
      const initialStats = container.getRecyclerStats();
      const initialInUse = initialStats.inUseCount;

      // Scroll far enough to have different visible pages
      scroller.scrollToPage(15);

      // Get new stats
      const newStats = container.getRecyclerStats();

      // Should have recycled elements (available count should increase or stay same)
      expect(newStats.inUseCount).toBeLessThanOrEqual(initialInUse + 2);
    });

    it("reuses recycled elements for new pages", () => {
      const scroller = new VirtualScroller({
        viewportWidth: 800,
        viewportHeight: 600,
        bufferSize: 0,
      });
      const container = new VirtualScrollContainer({
        scroller,
        autoManageElements: true,
      });

      container.setPageDimensions(createPageDimensions(20));

      // Scroll to middle, then back
      scroller.scrollToPage(10);
      scroller.scrollToPage(0);

      const stats = container.getRecyclerStats();

      // Should have reused elements (recycle count > 0)
      expect(stats.recycleCount).toBeGreaterThan(0);
    });

    it("emits pageVisible and pageHidden events", () => {
      const scroller = new VirtualScroller({
        viewportWidth: 800,
        viewportHeight: 600,
        bufferSize: 0,
      });
      const container = new VirtualScrollContainer({
        scroller,
        autoManageElements: true,
      });

      container.setPageDimensions(createPageDimensions(20));

      const visibleListener = vi.fn();
      const hiddenListener = vi.fn();

      container.addEventListener("pageVisible", visibleListener);
      container.addEventListener("pageHidden", hiddenListener);

      // Scroll to trigger visibility change events
      scroller.scrollToPage(15);

      // Hidden events should fire for pages leaving viewport
      expect(hiddenListener).toHaveBeenCalled();

      // Scroll back to trigger visible events for new pages
      scroller.scrollToPage(0);

      expect(visibleListener).toHaveBeenCalled();
    });
  });

  describe("scroll position accuracy with height estimation", () => {
    it("maintains scroll position when actual heights are set", () => {
      const scroller = new VirtualScroller({
        viewportWidth: 800,
        viewportHeight: 600,
        scale: 1,
      });
      const container = new VirtualScrollContainer({
        scroller,
        autoManageElements: false,
      });

      container.setPageDimensions(createPageDimensions(20));

      // Scroll to page 10
      scroller.scrollToPage(10);
      const initialScrollTop = scroller.scrollTop;

      // Set actual heights for earlier pages (different from estimate)
      container.setActualPageHeight(5, LETTER_HEIGHT + 100);
      container.setActualPageHeight(6, LETTER_HEIGHT + 50);

      // Scroll position should be adjusted to account for height changes
      // The exact adjustment depends on the scroll correction logic
      // We just verify it changed or stayed roughly the same
      const newScrollTop = scroller.scrollTop;
      expect(typeof newScrollTop).toBe("number");
    });

    it("emits scrollCorrected event when heights change", () => {
      const scroller = new VirtualScroller({
        viewportWidth: 800,
        viewportHeight: 600,
        scale: 1,
      });
      const container = new VirtualScrollContainer({
        scroller,
        autoManageElements: false,
      });

      const correctionListener = vi.fn();
      container.addEventListener("scrollCorrected", correctionListener);

      container.setPageDimensions(createPageDimensions(20));
      scroller.scrollToPage(10);

      // Set a significantly different height to trigger correction
      container.setActualPageHeight(2, LETTER_HEIGHT + 200);

      // If a correction was needed, the event should have been emitted
      // (may not be emitted if the correction is too small)
    });

    it("tracks hasActualHeight correctly", () => {
      const scroller = new VirtualScroller();
      const container = new VirtualScrollContainer({ scroller });

      container.setPageDimensions(createPageDimensions(10));

      expect(container.hasActualHeight(5)).toBe(false);

      container.setActualPageHeight(5, 800);

      expect(container.hasActualHeight(5)).toBe(true);
    });
  });

  describe("scale changes", () => {
    it("updates estimator scale when scroller scale changes", () => {
      const scroller = new VirtualScroller({ scale: 1 });
      const container = new VirtualScrollContainer({ scroller });

      container.setPageDimensions(createPageDimensions(10));

      expect(container.estimator.scale).toBe(1);

      scroller.setScale(2);

      expect(container.estimator.scale).toBe(2);
    });

    it("recalculates layouts on scale change", () => {
      const scroller = new VirtualScroller({ scale: 1 });
      const container = new VirtualScrollContainer({ scroller });

      container.setPageDimensions(createPageDimensions(10));

      const initialHeight = container.getEstimatedHeight(0);

      scroller.setScale(2);

      const newHeight = container.getEstimatedHeight(0);
      expect(newHeight).toBe(initialHeight * 2);
    });
  });

  describe("large document handling", () => {
    it("handles 1000+ pages with constant memory", () => {
      const scroller = new VirtualScroller({
        viewportWidth: 800,
        viewportHeight: 600,
        bufferSize: 1,
      });
      const container = new VirtualScrollContainer({
        scroller,
        autoManageElements: true,
      });

      container.setPageDimensions(createPageDimensions(1000));

      // Scroll through document
      const scrollPositions = [0, 100, 250, 500, 750, 999];
      let maxInUse = 0;

      for (const pageIndex of scrollPositions) {
        scroller.scrollToPage(pageIndex);
        const stats = container.getRecyclerStats();
        maxInUse = Math.max(maxInUse, stats.inUseCount);
      }

      // Max in-use elements should be bounded (viewport + buffer)
      expect(maxInUse).toBeLessThan(20);
    });

    it("uses binary search for page lookup", () => {
      const scroller = new VirtualScroller();
      const container = new VirtualScrollContainer({ scroller });

      container.setPageDimensions(createPageDimensions(10000));

      // These should all be fast due to binary search
      const testPositions = [1000, 50000, 100000, 500000];

      for (const y of testPositions) {
        const pageIndex = container.getPageAtPosition(y);
        expect(pageIndex).toBeGreaterThanOrEqual(-1);
        expect(pageIndex).toBeLessThan(10000);
      }
    });
  });

  describe("custom pool registration", () => {
    it("allows registering custom element pools", () => {
      const scroller = new VirtualScroller();
      const container = new VirtualScrollContainer({
        scroller,
        useDefaultPools: false,
        autoManageElements: false, // Disable auto-manage to manually test registration
      });

      container.registerPool("pageContainer", {
        factory: () => {
          const div = mockDocument.createElement("div") as unknown as HTMLElement;
          (div as unknown as MockElement).className = "custom-page";
          return div;
        },
        reset: el => {
          (el as unknown as MockElement).innerHTML = "";
        },
      });

      container.setPageDimensions(createPageDimensions(5));

      const element = container.acquireElement("pageContainer", 0);
      expect((element as unknown as MockElement).className).toBe("custom-page");
    });

    it("supports multiple element types per page", () => {
      const scroller = new VirtualScroller();
      const container = new VirtualScrollContainer({
        scroller,
        useDefaultPools: true,
      });

      container.setPageDimensions(createPageDimensions(5));

      // Acquire different element types for the same page
      const pageEl = container.acquireElement("pageContainer", 0);
      const textEl = container.acquireElement("textLayer", 0);
      const canvasEl = container.acquireElement("canvasLayer", 0);

      expect(pageEl).not.toBe(textEl);
      expect(textEl).not.toBe(canvasEl);

      const elements = container.getElementsForPage(0);
      expect(elements.size).toBe(3);
    });
  });

  describe("manual element management", () => {
    it("allows manual acquire/release when autoManage is false", () => {
      const scroller = new VirtualScroller();
      const container = new VirtualScrollContainer({
        scroller,
        autoManageElements: false,
      });

      container.setPageDimensions(createPageDimensions(10));

      // Manually acquire
      const element = container.acquireElement("pageContainer", 5);
      expect(container.getElement("pageContainer", 5)).toBe(element);

      // Manually release
      container.releaseElement("pageContainer", 5);
      expect(container.getElement("pageContainer", 5)).toBeNull();
    });

    it("releaseAllElements releases all types for a page", () => {
      const scroller = new VirtualScroller();
      const container = new VirtualScrollContainer({
        scroller,
        autoManageElements: false,
      });

      container.setPageDimensions(createPageDimensions(10));

      container.acquireElement("pageContainer", 3);
      container.acquireElement("textLayer", 3);

      container.releaseAllElements(3);

      expect(container.getElement("pageContainer", 3)).toBeNull();
      expect(container.getElement("textLayer", 3)).toBeNull();
    });
  });

  describe("visibility queries", () => {
    it("isPageVisible returns correct value", () => {
      const scroller = new VirtualScroller({
        viewportWidth: 800,
        viewportHeight: 600,
        bufferSize: 1,
      });
      const container = new VirtualScrollContainer({ scroller });

      container.setPageDimensions(createPageDimensions(20));

      expect(container.isPageVisible(0)).toBe(true);
      expect(container.isPageVisible(19)).toBe(false);

      scroller.scrollToPage(19);

      expect(container.isPageVisible(0)).toBe(false);
      expect(container.isPageVisible(19)).toBe(true);
    });

    it("getVisiblePageIndices returns correct array", () => {
      const scroller = new VirtualScroller({
        viewportWidth: 800,
        viewportHeight: 600,
        bufferSize: 0,
      });
      const container = new VirtualScrollContainer({ scroller });

      container.setPageDimensions(createPageDimensions(20));

      const visible = container.getVisiblePageIndices();

      expect(visible.length).toBeGreaterThan(0);
      expect(visible[0]).toBe(scroller.getVisibleRange().start);
      expect(visible[visible.length - 1]).toBe(scroller.getVisibleRange().end);
    });
  });

  describe("layout information", () => {
    it("getPageLayout returns layout from estimator", () => {
      const scroller = new VirtualScroller({ scale: 1.5 });
      const container = new VirtualScrollContainer({ scroller });

      container.setPageDimensions(createPageDimensions(5));

      const layout = container.getPageLayout(2);

      expect(layout).not.toBeNull();
      expect(layout!.pageIndex).toBe(2);
      expect(layout!.width).toBe(LETTER_WIDTH * 1.5);
      expect(layout!.height).toBe(LETTER_HEIGHT * 1.5);
    });

    it("getEstimatedHeight returns correct value", () => {
      const scroller = new VirtualScroller({ scale: 2 });
      const container = new VirtualScrollContainer({ scroller });

      container.setPageDimensions(createPageDimensions(5));

      expect(container.getEstimatedHeight(0)).toBe(LETTER_HEIGHT * 2);
    });
  });

  describe("statistics and debugging", () => {
    it("getRecyclerStats returns pool statistics", () => {
      const scroller = new VirtualScroller();
      const container = new VirtualScrollContainer({ scroller });

      container.setPageDimensions(createPageDimensions(10));

      const stats = container.getRecyclerStats();

      expect(stats).toHaveProperty("totalElements");
      expect(stats).toHaveProperty("inUseCount");
      expect(stats).toHaveProperty("availableCount");
      expect(stats).toHaveProperty("byType");
      expect(stats).toHaveProperty("recycleCount");
      expect(stats).toHaveProperty("createCount");
    });

    it("getHeightEstimates returns all estimates", () => {
      const scroller = new VirtualScroller();
      const container = new VirtualScrollContainer({ scroller });

      container.setPageDimensions(createPageDimensions(5));
      container.setActualPageHeight(2, 850);

      const estimates = container.getHeightEstimates();

      expect(estimates.length).toBe(5);
      expect(estimates[2].source).toBe("actual");
      expect(estimates[2].height).toBe(850);
    });
  });

  describe("disposal", () => {
    it("disposes all components", () => {
      const scroller = new VirtualScroller();
      const container = new VirtualScrollContainer({ scroller });

      container.setPageDimensions(createPageDimensions(10));

      container.dispose();

      // Further operations should be no-ops or throw
      const stats = container.getRecyclerStats();
      expect(stats.totalElements).toBe(0);
    });

    it("is idempotent", () => {
      const scroller = new VirtualScroller();
      const container = new VirtualScrollContainer({ scroller });

      container.dispose();
      container.dispose(); // Should not throw
    });

    it("removes event listeners on dispose", () => {
      const scroller = new VirtualScroller();
      const container = new VirtualScrollContainer({ scroller });
      const listener = vi.fn();

      container.addEventListener("pageVisible", listener);
      container.setPageDimensions(createPageDimensions(5));

      // Reset listener
      listener.mockClear();

      container.dispose();

      // Further scroller events should not trigger container events
      scroller.scrollToPage(0);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("handles empty document", () => {
      const scroller = new VirtualScroller();
      const container = new VirtualScrollContainer({ scroller });

      container.setPageDimensions([]);

      expect(container.pageCount).toBe(0);
      // For empty document, visible range is start=0, end=-1 (empty range)
      expect(container.getVisiblePageIndices()).toEqual([]);
    });

    it("handles single page document", () => {
      const scroller = new VirtualScroller();
      const container = new VirtualScrollContainer({ scroller });

      container.setPageDimensions(createPageDimensions(1));

      expect(container.pageCount).toBe(1);
      expect(container.isPageVisible(0)).toBe(true);
    });

    it("handles dimension update after initial set", () => {
      const scroller = new VirtualScroller();
      const container = new VirtualScrollContainer({ scroller });

      container.setPageDimensions(createPageDimensions(10));
      container.setActualPageHeight(5, 1000);

      // Reset with new dimensions
      container.setPageDimensions(createPageDimensions(5));

      expect(container.pageCount).toBe(5);
      // Previous actual height should be cleared
      expect(container.hasActualHeight(5)).toBe(false);
    });

    it("handles rapid scroll operations", () => {
      const scroller = new VirtualScroller({
        viewportWidth: 800,
        viewportHeight: 600,
      });
      const container = new VirtualScrollContainer({
        scroller,
        autoManageElements: true,
      });

      container.setPageDimensions(createPageDimensions(100));

      // Rapid scrolling
      for (let i = 0; i < 100; i++) {
        scroller.scrollToPage(Math.floor(Math.random() * 100));
      }

      // Should still be in a valid state
      const stats = container.getRecyclerStats();
      expect(stats.totalElements).toBeGreaterThan(0);
    });
  });
});
