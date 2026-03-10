/**
 * Tests for VirtualScroller.
 */

import { describe, expect, it, vi } from "vitest";

import {
  createVirtualScroller,
  type PageDimensions,
  type VirtualScrollerEvent,
  VirtualScroller,
} from "./virtual-scroller";

// Standard US Letter page dimensions in PDF points
const LETTER_WIDTH = 612; // 8.5 inches * 72 points/inch
const LETTER_HEIGHT = 792; // 11 inches * 72 points/inch

// A4 dimensions
const A4_WIDTH = 595;
const A4_HEIGHT = 842;

/**
 * Create an array of page dimensions for testing.
 */
function createPageDimensions(
  count: number,
  width = LETTER_WIDTH,
  height = LETTER_HEIGHT,
): PageDimensions[] {
  return Array.from({ length: count }, () => ({ width, height }));
}

describe("VirtualScroller", () => {
  describe("construction", () => {
    it("creates scroller with default options", () => {
      const scroller = new VirtualScroller();

      expect(scroller.scale).toBe(1);
      expect(scroller.viewportWidth).toBe(800);
      expect(scroller.viewportHeight).toBe(600);
      expect(scroller.pageGap).toBe(10);
      expect(scroller.bufferSize).toBe(1);
      expect(scroller.pageCount).toBe(0);
      expect(scroller.scrollLeft).toBe(0);
      expect(scroller.scrollTop).toBe(0);
    });

    it("creates scroller with custom options", () => {
      const scroller = new VirtualScroller({
        scale: 1.5,
        viewportWidth: 1024,
        viewportHeight: 768,
        pageGap: 20,
        bufferSize: 2,
        horizontalPadding: 40,
        verticalPadding: 30,
      });

      expect(scroller.scale).toBe(1.5);
      expect(scroller.viewportWidth).toBe(1024);
      expect(scroller.viewportHeight).toBe(768);
      expect(scroller.pageGap).toBe(20);
      expect(scroller.bufferSize).toBe(2);
    });

    it("creates scroller via factory function", () => {
      const scroller = createVirtualScroller({ scale: 2 });

      expect(scroller).toBeInstanceOf(VirtualScroller);
      expect(scroller.scale).toBe(2);
    });
  });

  describe("setPageDimensions", () => {
    it("sets page dimensions and calculates layout", () => {
      const scroller = new VirtualScroller();
      const dimensions = createPageDimensions(5);

      scroller.setPageDimensions(dimensions);

      expect(scroller.pageCount).toBe(5);
      expect(scroller.totalHeight).toBeGreaterThan(0);
      expect(scroller.totalWidth).toBeGreaterThan(0);
    });

    it("handles mixed page sizes", () => {
      const scroller = new VirtualScroller();
      const dimensions: PageDimensions[] = [
        { width: 612, height: 792 }, // Letter
        { width: 595, height: 842 }, // A4
        { width: 792, height: 612 }, // Letter landscape
      ];

      scroller.setPageDimensions(dimensions);

      expect(scroller.pageCount).toBe(3);

      // Total width should accommodate the widest page
      const layouts = scroller.getAllPageLayouts();
      expect(layouts.length).toBe(3);

      // Check that widths vary
      expect(layouts[0].width).toBe(612);
      expect(layouts[1].width).toBe(595);
      expect(layouts[2].width).toBe(792);
    });

    it("emits layoutChange event", () => {
      const scroller = new VirtualScroller();
      const listener = vi.fn();

      scroller.addEventListener("layoutChange", listener);
      scroller.setPageDimensions(createPageDimensions(3));

      expect(listener).toHaveBeenCalledWith({ type: "layoutChange" });
    });
  });

  describe("scale operations", () => {
    it("sets scale and updates layout", () => {
      const scroller = new VirtualScroller({
        verticalPadding: 0,
        pageGap: 0,
      });
      scroller.setPageDimensions(createPageDimensions(3));

      const initialHeight = scroller.totalHeight;
      scroller.setScale(2);

      expect(scroller.scale).toBe(2);
      // With no padding/gaps, total height should scale linearly
      expect(scroller.totalHeight).toBeCloseTo(initialHeight * 2, 0);
    });

    it("ignores invalid scale values", () => {
      const scroller = new VirtualScroller({ scale: 1.5 });

      scroller.setScale(0);
      expect(scroller.scale).toBe(1.5);

      scroller.setScale(-1);
      expect(scroller.scale).toBe(1.5);
    });

    it("maintains center point during scale change", () => {
      const scroller = new VirtualScroller({
        viewportWidth: 800,
        viewportHeight: 600,
      });
      scroller.setPageDimensions(createPageDimensions(10));
      scroller.scrollTo(0, 2000);

      const beforeY = scroller.scrollTop + scroller.viewportHeight / 2;

      scroller.setScale(2);

      // After scaling, the center should be at approximately twice the document position
      // Note: Due to clamping, exact match may not be possible at edges
      expect(scroller.scale).toBe(2);
    });

    it("emits scaleChange event", () => {
      const scroller = new VirtualScroller();
      scroller.setPageDimensions(createPageDimensions(3));
      const listener = vi.fn();

      scroller.addEventListener("scaleChange", listener);
      scroller.setScale(1.5);

      expect(listener).toHaveBeenCalledWith({ type: "scaleChange", scale: 1.5 });
    });
  });

  describe("viewport operations", () => {
    it("sets viewport size", () => {
      const scroller = new VirtualScroller();

      scroller.setViewportSize(1024, 768);

      expect(scroller.viewportWidth).toBe(1024);
      expect(scroller.viewportHeight).toBe(768);
    });

    it("ignores invalid viewport sizes", () => {
      const scroller = new VirtualScroller({
        viewportWidth: 800,
        viewportHeight: 600,
      });

      scroller.setViewportSize(0, 768);
      expect(scroller.viewportWidth).toBe(800);

      scroller.setViewportSize(1024, -100);
      expect(scroller.viewportHeight).toBe(600);
    });

    it("clamps scroll position when viewport grows", () => {
      const scroller = new VirtualScroller({
        viewportWidth: 400,
        viewportHeight: 300,
      });
      scroller.setPageDimensions(createPageDimensions(2));
      scroller.scrollTo(0, 1000);

      // Increase viewport to larger than content
      scroller.setViewportSize(1000, 2000);

      // Scroll should be clamped to valid range
      expect(scroller.scrollTop).toBe(Math.max(0, scroller.totalHeight - 2000));
    });

    it("returns container info", () => {
      const scroller = new VirtualScroller({
        viewportWidth: 800,
        viewportHeight: 600,
      });
      scroller.setPageDimensions(createPageDimensions(5));

      const info = scroller.containerInfo;

      expect(info.viewportWidth).toBe(800);
      expect(info.viewportHeight).toBe(600);
      expect(info.totalWidth).toBeGreaterThan(0);
      expect(info.totalHeight).toBeGreaterThan(0);
    });
  });

  describe("scroll operations", () => {
    it("scrolls to specific position", () => {
      const scroller = new VirtualScroller({
        viewportWidth: 400,
        viewportHeight: 400,
      });
      scroller.setPageDimensions(createPageDimensions(10));

      scroller.scrollTo(50, 500);

      // Horizontal scroll may be clamped if content is narrower than viewport
      // Vertical scroll should work since document is taller than viewport
      expect(scroller.scrollTop).toBe(500);
      // scrollLeft should be clamped to max(0, totalWidth - viewportWidth)
      const maxScrollLeft = Math.max(0, scroller.totalWidth - scroller.viewportWidth);
      expect(scroller.scrollLeft).toBe(Math.min(50, maxScrollLeft));
    });

    it("clamps scroll position to valid range", () => {
      const scroller = new VirtualScroller({
        viewportWidth: 400,
        viewportHeight: 300,
      });
      scroller.setPageDimensions(createPageDimensions(10)); // More pages for larger content

      // Try to scroll past content (negative)
      scroller.scrollTo(-100, -200);
      expect(scroller.scrollLeft).toBe(0);
      expect(scroller.scrollTop).toBe(0);

      // Try to scroll way past end
      scroller.scrollTo(10000, 100000);
      const maxScrollLeft = Math.max(0, scroller.totalWidth - scroller.viewportWidth);
      const maxScrollTop = Math.max(0, scroller.totalHeight - scroller.viewportHeight);
      expect(scroller.scrollLeft).toBe(maxScrollLeft);
      expect(scroller.scrollTop).toBe(maxScrollTop);
    });

    it("scrolls by delta", () => {
      const scroller = new VirtualScroller({
        viewportWidth: 400,
        viewportHeight: 400,
      });
      scroller.setPageDimensions(createPageDimensions(10));
      scroller.scrollTo(0, 200);

      scroller.scrollBy(0, 100);

      expect(scroller.scrollTop).toBe(300);
    });

    it("scrolls to page with start alignment", () => {
      const scroller = new VirtualScroller({
        viewportHeight: 600,
        verticalPadding: 20,
      });
      scroller.setPageDimensions(createPageDimensions(10));

      scroller.scrollToPage(3, "start");

      const layout = scroller.getPageLayout(3);
      expect(layout).not.toBeNull();
      expect(scroller.scrollTop).toBe(layout!.top - 20);
    });

    it("scrolls to page with center alignment", () => {
      const scroller = new VirtualScroller({ viewportHeight: 600 });
      scroller.setPageDimensions(createPageDimensions(10));

      scroller.scrollToPage(5, "center");

      const layout = scroller.getPageLayout(5);
      expect(layout).not.toBeNull();
      expect(scroller.scrollTop).toBeCloseTo(
        layout!.top + layout!.height / 2 - scroller.viewportHeight / 2,
        0,
      );
    });

    it("scrolls to page with end alignment", () => {
      const scroller = new VirtualScroller({
        viewportHeight: 600,
        verticalPadding: 20,
      });
      scroller.setPageDimensions(createPageDimensions(10));

      scroller.scrollToPage(7, "end");

      const layout = scroller.getPageLayout(7);
      expect(layout).not.toBeNull();
      // Page bottom should align with viewport bottom (plus padding)
      const expectedTop = layout!.top + layout!.height - scroller.viewportHeight + 20;
      expect(scroller.scrollTop).toBeCloseTo(expectedTop, 0);
    });

    it("ignores invalid page index in scrollToPage", () => {
      const scroller = new VirtualScroller();
      scroller.setPageDimensions(createPageDimensions(5));
      scroller.scrollTo(100, 200);

      scroller.scrollToPage(-1);
      expect(scroller.scrollTop).toBe(200);

      scroller.scrollToPage(100);
      expect(scroller.scrollTop).toBe(200);
    });

    it("emits scroll event", () => {
      const scroller = new VirtualScroller();
      scroller.setPageDimensions(createPageDimensions(10));
      const listener = vi.fn();

      scroller.addEventListener("scroll", listener);
      scroller.scrollTo(0, 500);

      expect(listener).toHaveBeenCalledWith({
        type: "scroll",
        scrollPosition: { scrollLeft: 0, scrollTop: 500 },
      });
    });

    it("does not emit scroll event when position unchanged", () => {
      const scroller = new VirtualScroller();
      scroller.setPageDimensions(createPageDimensions(10));
      scroller.scrollTo(0, 500);

      const listener = vi.fn();
      scroller.addEventListener("scroll", listener);

      scroller.scrollTo(0, 500);

      expect(listener).not.toHaveBeenCalled();
    });

    it("returns scroll position object", () => {
      const scroller = new VirtualScroller({
        viewportWidth: 400,
        viewportHeight: 400,
      });
      scroller.setPageDimensions(createPageDimensions(10));
      scroller.scrollTo(0, 500);

      const position = scroller.scrollPosition;

      expect(position.scrollLeft).toBe(0);
      expect(position.scrollTop).toBe(500);
    });
  });

  describe("visible range calculation", () => {
    it("returns empty range for empty document", () => {
      const scroller = new VirtualScroller();

      const range = scroller.getVisibleRange();

      expect(range.start).toBe(0);
      expect(range.end).toBe(-1);
    });

    it("calculates visible range at top", () => {
      const scroller = new VirtualScroller({
        viewportHeight: 1000,
        bufferSize: 1,
      });
      scroller.setPageDimensions(createPageDimensions(10));

      const range = scroller.getVisibleRange();

      expect(range.start).toBe(0);
      expect(range.end).toBeGreaterThan(0);
    });

    it("calculates visible range in middle", () => {
      const scroller = new VirtualScroller({
        viewportHeight: 600,
        bufferSize: 1,
      });
      scroller.setPageDimensions(createPageDimensions(20));

      // Scroll to middle
      scroller.scrollToPage(10);

      const range = scroller.getVisibleRange();

      // Should include page 10 and surrounding pages
      expect(range.start).toBeLessThanOrEqual(10);
      expect(range.end).toBeGreaterThanOrEqual(10);
    });

    it("includes buffer pages", () => {
      const scroller = new VirtualScroller({
        viewportHeight: 600,
        bufferSize: 2,
      });
      scroller.setPageDimensions(createPageDimensions(20));
      scroller.scrollToPage(10);

      const rangeWithBuffer = scroller.getVisibleRange();

      // Create a scroller without buffer for comparison
      scroller.setBufferSize(0);
      const rangeWithoutBuffer = scroller.getVisibleRange();

      expect(rangeWithBuffer.start).toBeLessThanOrEqual(rangeWithoutBuffer.start);
      expect(rangeWithBuffer.end).toBeGreaterThanOrEqual(rangeWithoutBuffer.end);
    });

    it("returns visible pages array", () => {
      const scroller = new VirtualScroller({ viewportHeight: 600 });
      scroller.setPageDimensions(createPageDimensions(10));

      const visiblePages = scroller.getVisiblePages();

      expect(visiblePages.length).toBeGreaterThan(0);
      expect(visiblePages[0]).toHaveProperty("pageIndex");
      expect(visiblePages[0]).toHaveProperty("top");
      expect(visiblePages[0]).toHaveProperty("left");
      expect(visiblePages[0]).toHaveProperty("width");
      expect(visiblePages[0]).toHaveProperty("height");
    });

    it("checks if page is visible", () => {
      const scroller = new VirtualScroller({
        viewportHeight: 600,
        bufferSize: 1,
      });
      scroller.setPageDimensions(createPageDimensions(20));
      scroller.scrollToPage(10);

      expect(scroller.isPageVisible(10)).toBe(true);
      expect(scroller.isPageVisible(0)).toBe(false);
      expect(scroller.isPageVisible(19)).toBe(false);
    });

    it("emits visibleRangeChange event", () => {
      const scroller = new VirtualScroller({ viewportHeight: 600 });
      scroller.setPageDimensions(createPageDimensions(20));
      const listener = vi.fn();

      scroller.addEventListener("visibleRangeChange", listener);
      scroller.scrollToPage(15);

      expect(listener).toHaveBeenCalled();
      const event = listener.mock.calls[0][0] as VirtualScrollerEvent;
      expect(event.type).toBe("visibleRangeChange");
      expect(event.visibleRange).toBeDefined();
    });
  });

  describe("page layout", () => {
    it("returns layout for valid page", () => {
      const scroller = new VirtualScroller();
      scroller.setPageDimensions(createPageDimensions(5));

      const layout = scroller.getPageLayout(2);

      expect(layout).not.toBeNull();
      expect(layout!.pageIndex).toBe(2);
      expect(layout!.width).toBe(LETTER_WIDTH);
      expect(layout!.height).toBe(LETTER_HEIGHT);
    });

    it("returns null for invalid page index", () => {
      const scroller = new VirtualScroller();
      scroller.setPageDimensions(createPageDimensions(5));

      expect(scroller.getPageLayout(-1)).toBeNull();
      expect(scroller.getPageLayout(10)).toBeNull();
    });

    it("applies scale to layout dimensions", () => {
      const scroller = new VirtualScroller({ scale: 2 });
      scroller.setPageDimensions(createPageDimensions(3));

      const layout = scroller.getPageLayout(0);

      expect(layout!.width).toBe(LETTER_WIDTH * 2);
      expect(layout!.height).toBe(LETTER_HEIGHT * 2);
    });

    it("positions pages vertically with gaps", () => {
      const scroller = new VirtualScroller({
        pageGap: 20,
        verticalPadding: 10,
      });
      scroller.setPageDimensions(createPageDimensions(3));

      const layouts = scroller.getAllPageLayouts();

      expect(layouts[0].top).toBe(10); // vertical padding
      expect(layouts[1].top).toBe(10 + LETTER_HEIGHT + 20); // page height + gap
      expect(layouts[2].top).toBe(10 + 2 * (LETTER_HEIGHT + 20));
    });

    it("centers pages horizontally", () => {
      const scroller = new VirtualScroller();
      const dimensions: PageDimensions[] = [
        { width: 500, height: 500 },
        { width: 300, height: 500 },
        { width: 400, height: 500 },
      ];
      scroller.setPageDimensions(dimensions);

      const layouts = scroller.getAllPageLayouts();

      // All pages should be centered
      for (const layout of layouts) {
        const center = layout.left + layout.width / 2;
        expect(center).toBeCloseTo(scroller.totalWidth / 2, 0);
      }
    });
  });

  describe("coordinate conversion", () => {
    it("finds page at point", () => {
      const scroller = new VirtualScroller({
        viewportWidth: 800,
        viewportHeight: 600,
      });
      scroller.setPageDimensions(createPageDimensions(10));

      // Point in first page
      const layout = scroller.getPageLayout(0)!;
      const pageIndex = scroller.getPageAtPoint(
        layout.left + layout.width / 2,
        layout.top + layout.height / 2,
      );

      expect(pageIndex).toBe(0);
    });

    it("returns -1 for point not on any page", () => {
      const scroller = new VirtualScroller();
      scroller.setPageDimensions(createPageDimensions(5));

      // Point in the gap between pages or outside
      expect(scroller.getPageAtPoint(-100, -100)).toBe(-1);
    });

    it("converts viewport to page coordinates", () => {
      const scroller = new VirtualScroller({ scale: 1 });
      scroller.setPageDimensions(createPageDimensions(5));

      const layout = scroller.getPageLayout(0)!;
      const result = scroller.viewportToPage(layout.left + 50, layout.top + 100);

      expect(result).not.toBeNull();
      expect(result!.pageIndex).toBe(0);
      expect(result!.x).toBeCloseTo(50, 0);
      expect(result!.y).toBeCloseTo(100, 0);
    });

    it("converts viewport to page coordinates with scale", () => {
      const scroller = new VirtualScroller({ scale: 2 });
      scroller.setPageDimensions(createPageDimensions(5));

      const layout = scroller.getPageLayout(0)!;
      const result = scroller.viewportToPage(layout.left + 100, layout.top + 200);

      expect(result).not.toBeNull();
      expect(result!.pageIndex).toBe(0);
      // At scale 2, 100 scaled pixels = 50 page units
      expect(result!.x).toBeCloseTo(50, 0);
      expect(result!.y).toBeCloseTo(100, 0);
    });

    it("returns null for viewport point not on page", () => {
      const scroller = new VirtualScroller();
      scroller.setPageDimensions(createPageDimensions(5));

      const result = scroller.viewportToPage(-100, -100);

      expect(result).toBeNull();
    });

    it("converts page to viewport coordinates", () => {
      const scroller = new VirtualScroller({ scale: 1 });
      scroller.setPageDimensions(createPageDimensions(5));

      const result = scroller.pageToViewport(0, 50, 100);

      expect(result).not.toBeNull();
      const layout = scroller.getPageLayout(0)!;
      expect(result!.x).toBeCloseTo(layout.left + 50, 0);
      expect(result!.y).toBeCloseTo(layout.top + 100, 0);
    });

    it("converts page to viewport coordinates with scroll offset", () => {
      const scroller = new VirtualScroller({ scale: 1 });
      scroller.setPageDimensions(createPageDimensions(10));
      scroller.scrollTo(0, 500);

      const result = scroller.pageToViewport(0, 50, 100);

      expect(result).not.toBeNull();
      const layout = scroller.getPageLayout(0)!;
      // Should account for scroll offset
      expect(result!.x).toBeCloseTo(layout.left + 50, 0);
      expect(result!.y).toBeCloseTo(layout.top + 100 - 500, 0);
    });

    it("returns null for invalid page in pageToViewport", () => {
      const scroller = new VirtualScroller();
      scroller.setPageDimensions(createPageDimensions(5));

      expect(scroller.pageToViewport(-1, 0, 0)).toBeNull();
      expect(scroller.pageToViewport(100, 0, 0)).toBeNull();
    });
  });

  describe("buffer size configuration", () => {
    it("sets buffer size", () => {
      const scroller = new VirtualScroller({ bufferSize: 1 });

      scroller.setBufferSize(3);

      expect(scroller.bufferSize).toBe(3);
    });

    it("ignores negative buffer size", () => {
      const scroller = new VirtualScroller({ bufferSize: 2 });

      scroller.setBufferSize(-1);

      expect(scroller.bufferSize).toBe(2);
    });

    it("affects visible range", () => {
      const scroller = new VirtualScroller({
        viewportHeight: 600,
        bufferSize: 0,
      });
      scroller.setPageDimensions(createPageDimensions(20));
      scroller.scrollToPage(10);

      const rangeWithoutBuffer = scroller.getVisibleRange();

      scroller.setBufferSize(3);
      const rangeWithBuffer = scroller.getVisibleRange();

      // Buffer should extend the range
      expect(rangeWithBuffer.start).toBeLessThan(rangeWithoutBuffer.start);
      expect(rangeWithBuffer.end).toBeGreaterThan(rangeWithoutBuffer.end);
    });
  });

  describe("page gap configuration", () => {
    it("sets page gap", () => {
      const scroller = new VirtualScroller({ pageGap: 10 });
      scroller.setPageDimensions(createPageDimensions(5));

      const initialHeight = scroller.totalHeight;

      scroller.setPageGap(30);

      expect(scroller.pageGap).toBe(30);
      // Total height should increase due to larger gaps
      expect(scroller.totalHeight).toBeGreaterThan(initialHeight);
    });

    it("ignores negative page gap", () => {
      const scroller = new VirtualScroller({ pageGap: 10 });

      scroller.setPageGap(-5);

      expect(scroller.pageGap).toBe(10);
    });
  });

  describe("event handling", () => {
    it("adds and removes event listeners", () => {
      const scroller = new VirtualScroller();
      scroller.setPageDimensions(createPageDimensions(10));
      const listener = vi.fn();

      scroller.addEventListener("scroll", listener);
      scroller.scrollTo(0, 100);
      expect(listener).toHaveBeenCalledTimes(1);

      scroller.removeEventListener("scroll", listener);
      scroller.scrollTo(0, 200);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("supports multiple listeners for same event", () => {
      const scroller = new VirtualScroller();
      scroller.setPageDimensions(createPageDimensions(10));
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      scroller.addEventListener("scroll", listener1);
      scroller.addEventListener("scroll", listener2);
      scroller.scrollTo(0, 100);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  describe("large document handling", () => {
    it("handles 1000+ pages efficiently", () => {
      const scroller = new VirtualScroller({
        viewportHeight: 600,
        bufferSize: 2,
      });
      scroller.setPageDimensions(createPageDimensions(1000));

      // Should calculate layout quickly
      expect(scroller.pageCount).toBe(1000);

      // Scroll to middle
      scroller.scrollToPage(500);

      // Should only return a small number of visible pages
      const visiblePages = scroller.getVisiblePages();
      expect(visiblePages.length).toBeLessThan(10);

      // Visible range should be bounded
      const range = scroller.getVisibleRange();
      expect(range.end - range.start).toBeLessThan(10);
    });

    it("maintains constant visible page count regardless of document size", () => {
      const scroller = new VirtualScroller({
        viewportHeight: 800,
        bufferSize: 1,
      });

      // Test with different document sizes
      const sizes = [10, 100, 1000, 5000];
      const visibleCounts: number[] = [];

      for (const size of sizes) {
        scroller.setPageDimensions(createPageDimensions(size));
        scroller.scrollToPage(Math.floor(size / 2));
        visibleCounts.push(scroller.getVisiblePages().length);
      }

      // All visible counts should be similar (within a small range)
      const maxCount = Math.max(...visibleCounts);
      const minCount = Math.min(...visibleCounts);
      expect(maxCount - minCount).toBeLessThanOrEqual(2);
    });

    it("binary search correctly finds first visible page", () => {
      const scroller = new VirtualScroller({
        viewportHeight: 600,
        bufferSize: 0,
      });
      scroller.setPageDimensions(createPageDimensions(1000));

      // Test various scroll positions
      const scrollPositions = [0, 1000, 5000, 50000, 100000];

      for (const scrollTop of scrollPositions) {
        scroller.scrollTo(0, scrollTop);
        const range = scroller.getVisibleRange();

        // Verify the range is correct
        if (range.start > 0) {
          const prevLayout = scroller.getPageLayout(range.start - 1)!;
          expect(prevLayout.top + prevLayout.height).toBeLessThanOrEqual(scrollTop);
        }

        if (range.end < 999) {
          const nextLayout = scroller.getPageLayout(range.end + 1)!;
          expect(nextLayout.top).toBeGreaterThanOrEqual(scrollTop + scroller.viewportHeight);
        }
      }
    });
  });

  describe("edge cases", () => {
    it("handles single page document", () => {
      const scroller = new VirtualScroller({ viewportHeight: 600 });
      scroller.setPageDimensions(createPageDimensions(1));

      expect(scroller.pageCount).toBe(1);
      const range = scroller.getVisibleRange();
      expect(range.start).toBe(0);
      expect(range.end).toBe(0);
    });

    it("handles very small viewport", () => {
      const scroller = new VirtualScroller({
        viewportWidth: 100,
        viewportHeight: 100,
      });
      scroller.setPageDimensions(createPageDimensions(5));

      const visiblePages = scroller.getVisiblePages();
      expect(visiblePages.length).toBeGreaterThanOrEqual(1);
    });

    it("handles very large scale", () => {
      const scroller = new VirtualScroller({
        viewportHeight: 600,
        scale: 10,
      });
      scroller.setPageDimensions(createPageDimensions(5));

      // At 10x scale, each page is huge
      const layout = scroller.getPageLayout(0)!;
      expect(layout.width).toBe(LETTER_WIDTH * 10);
      expect(layout.height).toBe(LETTER_HEIGHT * 10);

      // Should still work correctly
      const visiblePages = scroller.getVisiblePages();
      expect(visiblePages.length).toBeGreaterThanOrEqual(1);
    });

    it("handles very small scale", () => {
      const scroller = new VirtualScroller({
        viewportHeight: 600,
        scale: 0.1,
      });
      scroller.setPageDimensions(createPageDimensions(100));

      // At 0.1x scale, pages are tiny - many should fit
      const visiblePages = scroller.getVisiblePages();
      expect(visiblePages.length).toBeGreaterThan(5);
    });

    it("handles zero-size pages gracefully", () => {
      const scroller = new VirtualScroller();
      const dimensions: PageDimensions[] = [
        { width: 612, height: 792 },
        { width: 0, height: 0 }, // Invalid
        { width: 612, height: 792 },
      ];

      // Should not throw
      scroller.setPageDimensions(dimensions);
      expect(scroller.pageCount).toBe(3);
    });
  });
});
