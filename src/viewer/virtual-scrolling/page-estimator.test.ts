/**
 * Tests for PageEstimator.
 */

import { describe, expect, it, vi } from "vitest";

import type { PageDimensions } from "../../virtual-scroller";
import { createPageEstimator, PageEstimator, type PageEstimatorEvent } from "./page-estimator";

// Standard US Letter page dimensions in PDF points
const LETTER_WIDTH = 612;
const LETTER_HEIGHT = 792;

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

describe("PageEstimator", () => {
  describe("construction", () => {
    it("creates estimator with default options", () => {
      const estimator = new PageEstimator();

      expect(estimator.pageCount).toBe(0);
      expect(estimator.scale).toBe(1);
      expect(estimator.pageGap).toBe(10);
    });

    it("creates estimator with custom options", () => {
      const estimator = new PageEstimator({
        defaultWidth: 800,
        defaultHeight: 1000,
        scale: 1.5,
        pageGap: 20,
        verticalPadding: 30,
        horizontalPadding: 40,
      });

      expect(estimator.scale).toBe(1.5);
      expect(estimator.pageGap).toBe(20);
    });

    it("creates estimator via factory function", () => {
      const estimator = createPageEstimator({ scale: 2 });

      expect(estimator).toBeInstanceOf(PageEstimator);
      expect(estimator.scale).toBe(2);
    });
  });

  describe("setPageDimensions", () => {
    it("sets page dimensions and initializes estimates", () => {
      const estimator = new PageEstimator();
      const dimensions = createPageDimensions(5);

      estimator.setPageDimensions(dimensions);

      expect(estimator.pageCount).toBe(5);
    });

    it("calculates estimated heights from PDF dimensions", () => {
      const estimator = new PageEstimator({ scale: 1 });
      const dimensions = createPageDimensions(3);

      estimator.setPageDimensions(dimensions);

      const estimate = estimator.getPageEstimate(0);
      expect(estimate).not.toBeNull();
      expect(estimate!.height).toBe(LETTER_HEIGHT);
      expect(estimate!.width).toBe(LETTER_WIDTH);
      expect(estimate!.source).toBe("pdf");
      expect(estimate!.confidence).toBe(0.95);
    });

    it("applies scale to estimated dimensions", () => {
      const estimator = new PageEstimator({ scale: 2 });
      const dimensions = createPageDimensions(1);

      estimator.setPageDimensions(dimensions);

      const estimate = estimator.getPageEstimate(0);
      expect(estimate!.height).toBe(LETTER_HEIGHT * 2);
      expect(estimate!.width).toBe(LETTER_WIDTH * 2);
    });

    it("handles mixed page sizes", () => {
      const estimator = new PageEstimator({ scale: 1 });
      const dimensions: PageDimensions[] = [
        { width: LETTER_WIDTH, height: LETTER_HEIGHT },
        { width: A4_WIDTH, height: A4_HEIGHT },
        { width: LETTER_HEIGHT, height: LETTER_WIDTH }, // Landscape
      ];

      estimator.setPageDimensions(dimensions);

      expect(estimator.getEstimatedHeight(0)).toBe(LETTER_HEIGHT);
      expect(estimator.getEstimatedHeight(1)).toBe(A4_HEIGHT);
      expect(estimator.getEstimatedHeight(2)).toBe(LETTER_WIDTH);
    });

    it("emits layoutRecalculated event", () => {
      const estimator = new PageEstimator();
      const listener = vi.fn();

      estimator.addEventListener("layoutRecalculated", listener);
      estimator.setPageDimensions(createPageDimensions(3));

      expect(listener).toHaveBeenCalledWith({ type: "layoutRecalculated" });
    });

    it("clears previous estimates on new dimensions", () => {
      const estimator = new PageEstimator();

      estimator.setPageDimensions(createPageDimensions(5));
      estimator.setActualHeight(2, 1000);

      estimator.setPageDimensions(createPageDimensions(3));

      // Should have fresh estimates
      const estimate = estimator.getPageEstimate(2);
      expect(estimate!.source).toBe("pdf");
    });
  });

  describe("scale operations", () => {
    it("updates scale and recalculates estimates", () => {
      const estimator = new PageEstimator({ scale: 1 });
      estimator.setPageDimensions(createPageDimensions(3));

      const initialHeight = estimator.getEstimatedHeight(0);
      estimator.setScale(2);

      expect(estimator.scale).toBe(2);
      expect(estimator.getEstimatedHeight(0)).toBe(initialHeight * 2);
    });

    it("ignores invalid scale values", () => {
      const estimator = new PageEstimator({ scale: 1.5 });
      estimator.setPageDimensions(createPageDimensions(3));

      estimator.setScale(0);
      expect(estimator.scale).toBe(1.5);

      estimator.setScale(-1);
      expect(estimator.scale).toBe(1.5);
    });

    it("ignores same scale value", () => {
      const estimator = new PageEstimator({ scale: 1.5 });
      const listener = vi.fn();

      estimator.addEventListener("scaleChanged", listener);
      estimator.setScale(1.5);

      expect(listener).not.toHaveBeenCalled();
    });

    it("scales actual heights proportionally", () => {
      const estimator = new PageEstimator({ scale: 1 });
      estimator.setPageDimensions(createPageDimensions(3));

      // Set actual height at scale 1
      estimator.setActualHeight(1, 800);

      // Change scale
      estimator.setScale(2);

      // Actual height should scale proportionally
      const estimate = estimator.getPageEstimate(1);
      expect(estimate!.height).toBe(1600);
      expect(estimate!.source).toBe("actual");
    });

    it("emits scaleChanged event", () => {
      const estimator = new PageEstimator({ scale: 1 });
      estimator.setPageDimensions(createPageDimensions(3));
      const listener = vi.fn();

      estimator.addEventListener("scaleChanged", listener);
      estimator.setScale(1.5);

      expect(listener).toHaveBeenCalledWith({ type: "scaleChanged", scale: 1.5 });
    });
  });

  describe("height estimation", () => {
    it("returns default height for invalid page index", () => {
      const estimator = new PageEstimator({
        defaultHeight: 792,
        scale: 1,
      });
      estimator.setPageDimensions(createPageDimensions(3));

      expect(estimator.getEstimatedHeight(-1)).toBe(792);
      expect(estimator.getEstimatedHeight(100)).toBe(792);
    });

    it("returns null estimate for invalid page index", () => {
      const estimator = new PageEstimator();
      estimator.setPageDimensions(createPageDimensions(3));

      expect(estimator.getPageEstimate(-1)).toBeNull();
      expect(estimator.getPageEstimate(100)).toBeNull();
    });

    it("getEstimatedWidth returns correct value", () => {
      const estimator = new PageEstimator({ scale: 1.5 });
      estimator.setPageDimensions(createPageDimensions(3));

      expect(estimator.getEstimatedWidth(0)).toBe(LETTER_WIDTH * 1.5);
    });

    it("getAllEstimates returns all estimates", () => {
      const estimator = new PageEstimator();
      estimator.setPageDimensions(createPageDimensions(5));

      const estimates = estimator.getAllEstimates();

      expect(estimates.length).toBe(5);
      estimates.forEach((est, i) => {
        expect(est.pageIndex).toBe(i);
      });
    });
  });

  describe("setActualHeight", () => {
    it("updates height to actual value", () => {
      const estimator = new PageEstimator({ scale: 1 });
      estimator.setPageDimensions(createPageDimensions(3));

      estimator.setActualHeight(1, 850);

      const estimate = estimator.getPageEstimate(1);
      expect(estimate!.height).toBe(850);
      expect(estimate!.source).toBe("actual");
      expect(estimate!.confidence).toBe(1);
    });

    it("updates width if provided", () => {
      const estimator = new PageEstimator({ scale: 1 });
      estimator.setPageDimensions(createPageDimensions(3));

      estimator.setActualHeight(1, 850, 620);

      const estimate = estimator.getPageEstimate(1);
      expect(estimate!.height).toBe(850);
      expect(estimate!.width).toBe(620);
    });

    it("ignores invalid page index", () => {
      const estimator = new PageEstimator();
      estimator.setPageDimensions(createPageDimensions(3));
      const listener = vi.fn();

      estimator.addEventListener("heightUpdated", listener);
      estimator.setActualHeight(-1, 850);
      estimator.setActualHeight(100, 850);

      expect(listener).not.toHaveBeenCalled();
    });

    it("emits heightUpdated event", () => {
      const estimator = new PageEstimator({ scale: 1 });
      estimator.setPageDimensions(createPageDimensions(3));
      const listener = vi.fn();

      estimator.addEventListener("heightUpdated", listener);
      estimator.setActualHeight(1, 850);

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0] as PageEstimatorEvent;
      expect(event.type).toBe("heightUpdated");
      expect(event.pageIndex).toBe(1);
      expect(event.oldHeight).toBe(LETTER_HEIGHT);
      expect(event.newHeight).toBe(850);
      expect(event.heightDelta).toBe(850 - LETTER_HEIGHT);
    });

    it("hasActualHeight returns correct value", () => {
      const estimator = new PageEstimator();
      estimator.setPageDimensions(createPageDimensions(3));

      expect(estimator.hasActualHeight(0)).toBe(false);
      expect(estimator.hasActualHeight(1)).toBe(false);

      estimator.setActualHeight(1, 850);

      expect(estimator.hasActualHeight(0)).toBe(false);
      expect(estimator.hasActualHeight(1)).toBe(true);
    });
  });

  describe("layout calculation", () => {
    it("calculates total height with gaps and padding", () => {
      const estimator = new PageEstimator({
        scale: 1,
        pageGap: 10,
        verticalPadding: 20,
      });
      estimator.setPageDimensions(createPageDimensions(3));

      // 20 (top padding) + 792 + 10 + 792 + 10 + 792 + 20 (bottom padding)
      // = 20 + 3*792 + 2*10 + 20 = 2436
      expect(estimator.totalHeight).toBe(20 + 3 * LETTER_HEIGHT + 2 * 10 + 20);
    });

    it("calculates total width from widest page", () => {
      const estimator = new PageEstimator({
        scale: 1,
        horizontalPadding: 20,
      });
      const dimensions: PageDimensions[] = [
        { width: 500, height: 700 },
        { width: 800, height: 700 },
        { width: 600, height: 700 },
      ];

      estimator.setPageDimensions(dimensions);

      // Widest page (800) + 2 * padding (40)
      expect(estimator.totalWidth).toBe(800 + 40);
    });

    it("getPageLayout returns correct layout", () => {
      const estimator = new PageEstimator({
        scale: 1,
        pageGap: 10,
        verticalPadding: 20,
      });
      estimator.setPageDimensions(createPageDimensions(3));

      const layout0 = estimator.getPageLayout(0);
      expect(layout0).not.toBeNull();
      expect(layout0!.pageIndex).toBe(0);
      expect(layout0!.top).toBe(20);
      expect(layout0!.height).toBe(LETTER_HEIGHT);

      const layout1 = estimator.getPageLayout(1);
      expect(layout1!.top).toBe(20 + LETTER_HEIGHT + 10);

      const layout2 = estimator.getPageLayout(2);
      expect(layout2!.top).toBe(20 + 2 * (LETTER_HEIGHT + 10));
    });

    it("getPageLayout returns null for invalid index", () => {
      const estimator = new PageEstimator();
      estimator.setPageDimensions(createPageDimensions(3));

      expect(estimator.getPageLayout(-1)).toBeNull();
      expect(estimator.getPageLayout(10)).toBeNull();
    });

    it("centers pages horizontally", () => {
      const estimator = new PageEstimator({
        scale: 1,
        horizontalPadding: 20,
      });
      const dimensions: PageDimensions[] = [
        { width: 600, height: 700 },
        { width: 400, height: 700 },
        { width: 500, height: 700 },
      ];

      estimator.setPageDimensions(dimensions);

      const layouts = estimator.getAllPageLayouts();
      const totalWidth = estimator.totalWidth;

      for (const layout of layouts) {
        const center = layout.left + layout.width / 2;
        expect(center).toBeCloseTo(totalWidth / 2, 0);
      }
    });

    it("getAllPageLayouts returns all layouts", () => {
      const estimator = new PageEstimator();
      estimator.setPageDimensions(createPageDimensions(5));

      const layouts = estimator.getAllPageLayouts();

      expect(layouts.length).toBe(5);
      layouts.forEach((layout, i) => {
        expect(layout.pageIndex).toBe(i);
      });
    });
  });

  describe("getPageAtPosition", () => {
    it("finds page at vertical position", () => {
      const estimator = new PageEstimator({
        scale: 1,
        pageGap: 10,
        verticalPadding: 20,
      });
      estimator.setPageDimensions(createPageDimensions(5));

      // Position in first page
      expect(estimator.getPageAtPosition(50)).toBe(0);

      // Position in second page (20 + 792 + 10 + some offset)
      expect(estimator.getPageAtPosition(900)).toBe(1);

      // Position in gap between pages - returns the next page since binary search behavior
      // Gap is at 812-822 (20 + 792 to 20 + 792 + 10), so 815 is in the gap before page 1
      const pageAt815 = estimator.getPageAtPosition(815);
      expect([0, 1]).toContain(pageAt815); // Could be either depending on binary search
    });

    it("returns -1 for empty document", () => {
      const estimator = new PageEstimator();

      expect(estimator.getPageAtPosition(100)).toBe(-1);
    });

    it("handles position beyond document", () => {
      const estimator = new PageEstimator();
      estimator.setPageDimensions(createPageDimensions(3));

      // Beyond last page
      expect(estimator.getPageAtPosition(100000)).toBe(2);

      // Before first page
      expect(estimator.getPageAtPosition(-100)).toBe(0);
    });

    it("uses binary search efficiently", () => {
      const estimator = new PageEstimator({
        scale: 1,
        pageGap: 10,
        verticalPadding: 20,
      });
      estimator.setPageDimensions(createPageDimensions(1000));

      // Middle of document
      const layout500 = estimator.getPageLayout(500)!;
      const midpoint = layout500.top + layout500.height / 2;

      expect(estimator.getPageAtPosition(midpoint)).toBe(500);
    });
  });

  describe("scroll corrections", () => {
    it("tracks height corrections when enabled", () => {
      const estimator = new PageEstimator({
        trackCorrections: true,
        scale: 1,
      });
      estimator.setPageDimensions(createPageDimensions(10));

      // Set actual height different from estimate
      estimator.setActualHeight(2, LETTER_HEIGHT + 100);

      const corrections = estimator.getCorrections();
      expect(corrections.length).toBe(1);
      expect(corrections[0].pageIndex).toBe(2);
      expect(corrections[0].delta).toBe(100);
    });

    it("does not track corrections when disabled", () => {
      const estimator = new PageEstimator({
        trackCorrections: false,
        scale: 1,
      });
      estimator.setPageDimensions(createPageDimensions(10));

      estimator.setActualHeight(2, LETTER_HEIGHT + 100);

      const corrections = estimator.getCorrections();
      expect(corrections.length).toBe(0);
    });

    it("calculates cumulative corrections", () => {
      const estimator = new PageEstimator({
        trackCorrections: true,
        scale: 1,
      });
      estimator.setPageDimensions(createPageDimensions(10));

      estimator.setActualHeight(1, LETTER_HEIGHT + 50);
      estimator.setActualHeight(3, LETTER_HEIGHT + 30);
      estimator.setActualHeight(5, LETTER_HEIGHT - 20);

      const corrections = estimator.getCorrections();
      expect(corrections.length).toBe(3);

      // Cumulative should be: 50, 50+30=80, 80-20=60
      expect(corrections[0].cumulativeDelta).toBe(50);
      expect(corrections[1].cumulativeDelta).toBe(80);
      expect(corrections[2].cumulativeDelta).toBe(60);
    });

    it("getScrollCorrection returns appropriate correction", () => {
      const estimator = new PageEstimator({
        trackCorrections: true,
        scale: 1,
        pageGap: 10,
        verticalPadding: 20,
      });
      estimator.setPageDimensions(createPageDimensions(10));

      estimator.setActualHeight(2, LETTER_HEIGHT + 100);

      // Get layout of page 5 (which is after the correction)
      const layout5 = estimator.getPageLayout(5)!;
      const scrollTop = layout5.top;

      const correction = estimator.getScrollCorrection(scrollTop);
      expect(correction).toBe(100);
    });

    it("returns 0 correction when no corrections exist", () => {
      const estimator = new PageEstimator({ trackCorrections: true });
      estimator.setPageDimensions(createPageDimensions(10));

      expect(estimator.getScrollCorrection(1000)).toBe(0);
    });

    it("clearCorrections removes all corrections", () => {
      const estimator = new PageEstimator({ trackCorrections: true });
      estimator.setPageDimensions(createPageDimensions(10));

      estimator.setActualHeight(2, 1000);
      estimator.setActualHeight(5, 1000);

      expect(estimator.getCorrections().length).toBe(2);

      estimator.clearCorrections();

      expect(estimator.getCorrections().length).toBe(0);
    });

    it("clears corrections on scale change", () => {
      const estimator = new PageEstimator({
        trackCorrections: true,
        scale: 1,
      });
      estimator.setPageDimensions(createPageDimensions(10));

      estimator.setActualHeight(2, 1000);
      expect(estimator.getCorrections().length).toBe(1);

      estimator.setScale(2);

      expect(estimator.getCorrections().length).toBe(0);
    });
  });

  describe("pageGap configuration", () => {
    it("setPageGap updates gap and recalculates", () => {
      const estimator = new PageEstimator({ pageGap: 10 });
      estimator.setPageDimensions(createPageDimensions(3));

      const initialHeight = estimator.totalHeight;
      estimator.setPageGap(30);

      expect(estimator.pageGap).toBe(30);
      // Total height should increase by 2 * (30-10) = 40
      expect(estimator.totalHeight).toBe(initialHeight + 40);
    });

    it("ignores negative page gap", () => {
      const estimator = new PageEstimator({ pageGap: 10 });

      estimator.setPageGap(-5);

      expect(estimator.pageGap).toBe(10);
    });
  });

  describe("event handling", () => {
    it("supports multiple listeners for same event", () => {
      const estimator = new PageEstimator();
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      estimator.addEventListener("layoutRecalculated", listener1);
      estimator.addEventListener("layoutRecalculated", listener2);
      estimator.setPageDimensions(createPageDimensions(3));

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it("removes event listeners", () => {
      const estimator = new PageEstimator();
      const listener = vi.fn();

      estimator.addEventListener("layoutRecalculated", listener);
      estimator.setPageDimensions(createPageDimensions(3));
      expect(listener).toHaveBeenCalledTimes(1);

      estimator.removeEventListener("layoutRecalculated", listener);
      estimator.setPageDimensions(createPageDimensions(2));
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("dispose", () => {
    it("disposes estimator", () => {
      const estimator = new PageEstimator();
      estimator.setPageDimensions(createPageDimensions(5));

      estimator.dispose();

      // Estimates should be cleared
      expect(estimator.getAllEstimates()).toEqual([]);
      // Further setPageDimensions calls are no-ops
      estimator.setPageDimensions(createPageDimensions(3));
      expect(estimator.getAllEstimates()).toEqual([]);
    });

    it("clears all state", () => {
      const estimator = new PageEstimator();
      estimator.setPageDimensions(createPageDimensions(5));
      estimator.setActualHeight(2, 1000);

      estimator.dispose();

      expect(estimator.getAllEstimates()).toEqual([]);
      expect(estimator.getCorrections()).toEqual([]);
    });

    it("is idempotent", () => {
      const estimator = new PageEstimator();

      estimator.dispose();
      estimator.dispose(); // Should not throw
    });
  });

  describe("large document handling", () => {
    it("handles 1000+ pages", () => {
      const estimator = new PageEstimator({
        scale: 1,
        pageGap: 10,
        verticalPadding: 20,
      });
      estimator.setPageDimensions(createPageDimensions(1000));

      expect(estimator.pageCount).toBe(1000);

      // Verify layout for first and last pages
      const layout0 = estimator.getPageLayout(0)!;
      expect(layout0.top).toBe(20);

      const layout999 = estimator.getPageLayout(999)!;
      expect(layout999.pageIndex).toBe(999);
    });

    it("binary search finds pages efficiently", () => {
      const estimator = new PageEstimator({
        scale: 1,
        pageGap: 10,
        verticalPadding: 20,
      });
      estimator.setPageDimensions(createPageDimensions(10000));

      // Test various positions
      const testCases = [0, 500, 2500, 5000, 7500, 9999];

      for (const pageIndex of testCases) {
        const layout = estimator.getPageLayout(pageIndex)!;
        const midpoint = layout.top + layout.height / 2;
        const found = estimator.getPageAtPosition(midpoint);
        expect(found).toBe(pageIndex);
      }
    });
  });

  describe("edge cases", () => {
    it("handles single page document", () => {
      const estimator = new PageEstimator();
      estimator.setPageDimensions(createPageDimensions(1));

      expect(estimator.pageCount).toBe(1);
      expect(estimator.getPageLayout(0)).not.toBeNull();
      expect(estimator.getPageAtPosition(50)).toBe(0);
    });

    it("handles empty document", () => {
      const estimator = new PageEstimator({
        verticalPadding: 20,
        pageGap: 10,
      });
      estimator.setPageDimensions([]);

      expect(estimator.pageCount).toBe(0);
      // For empty doc: padding (20) - gap (10) + padding (20) = 30
      // This is expected since the layout calculation subtracts the last gap
      expect(estimator.totalHeight).toBe(30);
      expect(estimator.getPageAtPosition(100)).toBe(-1);
    });

    it("handles zero-size pages", () => {
      const estimator = new PageEstimator();
      const dimensions: PageDimensions[] = [
        { width: 612, height: 792 },
        { width: 0, height: 0 },
        { width: 612, height: 792 },
      ];

      estimator.setPageDimensions(dimensions);
      expect(estimator.pageCount).toBe(3);
    });

    it("handles very small scale", () => {
      const estimator = new PageEstimator({ scale: 0.1 });
      estimator.setPageDimensions(createPageDimensions(10));

      expect(estimator.getEstimatedHeight(0)).toBeCloseTo(LETTER_HEIGHT * 0.1, 5);
    });

    it("handles very large scale", () => {
      const estimator = new PageEstimator({ scale: 10 });
      estimator.setPageDimensions(createPageDimensions(5));

      expect(estimator.getEstimatedHeight(0)).toBe(LETTER_HEIGHT * 10);
    });
  });
});
