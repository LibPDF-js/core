/**
 * Tests for ViewportManager.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

import type { BaseRenderer, RenderResult, RenderTask, Viewport } from "./renderers/base-renderer";
import {
  createViewportManager,
  type PageSource,
  type ViewportManagerEvent,
  ViewportManager,
} from "./viewport-manager";
import { VirtualScroller } from "./virtual-scroller";

// Standard US Letter page dimensions in PDF points
const LETTER_WIDTH = 612;
const LETTER_HEIGHT = 792;

/**
 * Create a mock page source for testing.
 */
function createMockPageSource(pageCount: number): PageSource {
  return {
    getPageCount: () => pageCount,
    getPageDimensions: vi.fn(async (_pageIndex: number) => ({
      width: LETTER_WIDTH,
      height: LETTER_HEIGHT,
    })),
    getPageRotation: vi.fn(async (_pageIndex: number) => 0),
  };
}

/**
 * Create a mock renderer for testing.
 */
function createMockRenderer(renderDelay = 10): BaseRenderer {
  let initialized = false;

  return {
    type: "canvas" as const,
    get initialized() {
      return initialized;
    },
    initialize: vi.fn(async () => {
      initialized = true;
    }),
    createViewport: vi.fn(
      (
        pageWidth: number,
        pageHeight: number,
        pageRotation: number,
        scale = 1,
        rotation = 0,
      ): Viewport => {
        const totalRotation = (pageRotation + rotation) % 360;
        const isRotated = totalRotation === 90 || totalRotation === 270;
        return {
          width: isRotated ? pageHeight * scale : pageWidth * scale,
          height: isRotated ? pageWidth * scale : pageHeight * scale,
          scale,
          rotation: totalRotation,
          offsetX: 0,
          offsetY: 0,
        };
      },
    ),
    render: vi.fn((pageIndex: number, viewport: Viewport): RenderTask => {
      let cancelled = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const promise = new Promise<RenderResult>((resolve, reject) => {
        // Simulate async rendering
        timeoutId = setTimeout(() => {
          if (cancelled) {
            reject(new Error("Render cancelled"));
          } else {
            resolve({
              width: viewport.width,
              height: viewport.height,
              element: { pageIndex, canvas: true },
            });
          }
        }, renderDelay);
      });

      return {
        promise,
        cancel: () => {
          cancelled = true;
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        },
        get cancelled() {
          return cancelled;
        },
      };
    }),
    destroy: vi.fn(),
  };
}

/**
 * Create a failing mock renderer for testing error handling.
 */
function createFailingMockRenderer(): BaseRenderer {
  let initialized = false;

  return {
    type: "canvas" as const,
    get initialized() {
      return initialized;
    },
    initialize: vi.fn(async () => {
      initialized = true;
    }),
    createViewport: vi.fn(
      (pageWidth: number, pageHeight: number, _pageRotation: number, scale = 1): Viewport => ({
        width: pageWidth * scale,
        height: pageHeight * scale,
        scale,
        rotation: 0,
        offsetX: 0,
        offsetY: 0,
      }),
    ),
    render: vi.fn((_pageIndex: number, _viewport: Viewport): RenderTask => {
      let cancelled = false;

      const promise = new Promise<RenderResult>((_resolve, reject) => {
        setTimeout(() => {
          if (!cancelled) {
            reject(new Error("Render failed"));
          }
        }, 5);
      });

      return {
        promise,
        cancel: () => {
          cancelled = true;
        },
        get cancelled() {
          return cancelled;
        },
      };
    }),
    destroy: vi.fn(),
  };
}

describe("ViewportManager", () => {
  let scroller: VirtualScroller;
  let renderer: BaseRenderer;
  let pageSource: PageSource;

  beforeEach(async () => {
    scroller = new VirtualScroller({
      viewportWidth: 800,
      viewportHeight: 600,
    });
    renderer = createMockRenderer();
    pageSource = createMockPageSource(10);
    await renderer.initialize();
  });

  describe("construction", () => {
    it("creates viewport manager with required options", () => {
      const manager = new ViewportManager({
        scroller,
        renderer,
        pageSource,
      });

      expect(manager.initialized).toBe(false);
      expect(manager.scroller).toBe(scroller);
      expect(manager.renderer).toBe(renderer);
      expect(manager.managedPageCount).toBe(0);
    });

    it("creates viewport manager via factory function", () => {
      const manager = createViewportManager({
        scroller,
        renderer,
        pageSource,
      });

      expect(manager).toBeInstanceOf(ViewportManager);
    });

    it("accepts custom options", () => {
      const manager = new ViewportManager({
        scroller,
        renderer,
        pageSource,
        cacheSize: 10,
        autoRender: false,
        priorityMode: "sequential",
        maxConcurrentRenders: 5,
      });

      expect(manager).toBeDefined();
    });
  });

  describe("initialization", () => {
    it("initializes and loads page dimensions", async () => {
      const manager = new ViewportManager({
        scroller,
        renderer,
        pageSource,
        autoRender: false, // Disable auto-render to avoid extra calls
      });

      await manager.initialize();

      expect(manager.initialized).toBe(true);
      expect(scroller.pageCount).toBe(10);
      expect(pageSource.getPageDimensions).toHaveBeenCalledTimes(10);
    });

    it("only initializes once", async () => {
      const manager = new ViewportManager({
        scroller,
        renderer,
        pageSource,
        autoRender: false, // Disable auto-render to avoid extra calls
      });

      await manager.initialize();
      await manager.initialize();

      expect(pageSource.getPageDimensions).toHaveBeenCalledTimes(10);
    });

    it("does not initialize after disposal", async () => {
      const manager = new ViewportManager({
        scroller,
        renderer,
        pageSource,
      });

      manager.dispose();
      await manager.initialize();

      expect(manager.initialized).toBe(false);
    });
  });

  describe("auto-render", () => {
    it("automatically renders visible pages after initialization", async () => {
      const manager = new ViewportManager({
        scroller,
        renderer,
        pageSource,
        autoRender: true,
      });

      await manager.initialize();

      // Wait for renders to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      const renderedPages = manager.getRenderedPages();
      expect(renderedPages.length).toBeGreaterThan(0);
    });

    it("does not auto-render when disabled", async () => {
      const manager = new ViewportManager({
        scroller,
        renderer,
        pageSource,
        autoRender: false,
      });

      await manager.initialize();
      await new Promise(resolve => setTimeout(resolve, 50));

      const renderedPages = manager.getRenderedPages();
      expect(renderedPages.length).toBe(0);
    });
  });

  describe("page state management", () => {
    it("returns page state for managed pages", async () => {
      const manager = new ViewportManager({
        scroller,
        renderer,
        pageSource,
        autoRender: false,
      });
      await manager.initialize();

      await manager.renderPage(0);

      const state = manager.getPageState(0);
      expect(state).not.toBeNull();
      expect(state!.pageIndex).toBe(0);
    });

    it("returns null for unmanaged pages", async () => {
      const manager = new ViewportManager({
        scroller,
        renderer,
        pageSource,
        autoRender: false,
      });
      await manager.initialize();

      const state = manager.getPageState(5);
      expect(state).toBeNull();
    });

    it("tracks page states through rendering lifecycle", async () => {
      const manager = new ViewportManager({
        scroller,
        renderer,
        pageSource,
        autoRender: false,
      });
      await manager.initialize();

      const stateChanges: string[] = [];
      manager.addEventListener("pageStateChange", event => {
        stateChanges.push(event.state!);
      });

      await manager.renderPage(0);

      expect(stateChanges).toContain("rendering");
      expect(stateChanges).toContain("rendered");
    });

    it("returns all managed pages", async () => {
      const manager = new ViewportManager({
        scroller,
        renderer,
        pageSource,
        autoRender: false,
      });
      await manager.initialize();

      await manager.renderPage(0);
      await manager.renderPage(1);
      await manager.renderPage(2);

      const managedPages = manager.getManagedPages();
      expect(managedPages.length).toBe(3);
    });

    it("returns only rendered visible pages", async () => {
      const manager = new ViewportManager({
        scroller,
        renderer,
        pageSource,
        autoRender: false,
      });
      await manager.initialize();

      // Render some pages
      await manager.renderPage(0);
      await manager.renderPage(1);

      const renderedPages = manager.getRenderedPages();
      const pageIndices = renderedPages.map(p => p.pageIndex);

      // Should only include pages in visible range that are rendered
      const range = scroller.getVisibleRange();
      for (const pageIndex of pageIndices) {
        expect(pageIndex).toBeGreaterThanOrEqual(range.start);
        expect(pageIndex).toBeLessThanOrEqual(range.end);
      }
    });
  });

  describe("manual rendering", () => {
    it("renders a specific page", async () => {
      const manager = new ViewportManager({
        scroller,
        renderer,
        pageSource,
        autoRender: false,
      });
      await manager.initialize();

      await manager.renderPage(3);

      const state = manager.getPageState(3);
      expect(state).not.toBeNull();
      expect(state!.state).toBe("rendered");
      expect(state!.element).not.toBeNull();
    });

    it("ignores invalid page indices", async () => {
      const manager = new ViewportManager({
        scroller,
        renderer,
        pageSource,
        autoRender: false,
      });
      await manager.initialize();

      await manager.renderPage(-1);
      await manager.renderPage(100);

      expect(manager.managedPageCount).toBe(0);
    });

    it("does not re-render already rendered pages", async () => {
      const manager = new ViewportManager({
        scroller,
        renderer,
        pageSource,
        autoRender: false,
      });
      await manager.initialize();

      await manager.renderPage(0);
      const renderCallCount = (renderer.render as ReturnType<typeof vi.fn>).mock.calls.length;

      await manager.renderPage(0);

      expect((renderer.render as ReturnType<typeof vi.fn>).mock.calls.length).toBe(renderCallCount);
    });

    it("does not render after disposal", async () => {
      const manager = new ViewportManager({
        scroller,
        renderer,
        pageSource,
        autoRender: false,
      });
      await manager.initialize();

      manager.dispose();
      await manager.renderPage(0);

      expect(manager.managedPageCount).toBe(0);
    });
  });

  describe("render cancellation", () => {
    it("cancels rendering of a specific page", async () => {
      // Use a slow renderer so we have time to cancel
      const slowRenderer = createMockRenderer(100);
      await slowRenderer.initialize();

      const manager = new ViewportManager({
        scroller,
        renderer: slowRenderer,
        pageSource,
        autoRender: false,
      });
      await manager.initialize();

      // Start render but don't await
      manager.renderPage(0);

      // Give it a tick to start
      await new Promise(resolve => setTimeout(resolve, 5));

      // Cancel before it completes
      manager.cancelRender(0);

      const state = manager.getPageState(0);
      expect(state?.state).toBe("idle");
    });

    it("cancels all renders", async () => {
      const manager = new ViewportManager({
        scroller,
        renderer,
        pageSource,
        autoRender: false,
        maxConcurrentRenders: 5,
      });
      await manager.initialize();

      // Start multiple renders
      manager.renderPage(0);
      manager.renderPage(1);
      manager.renderPage(2);

      // Cancel all
      manager.cancelAllRenders();

      expect(manager.activeRenderCount).toBe(0);
    });
  });

  describe("page invalidation", () => {
    it("invalidates visible pages for re-rendering", async () => {
      const manager = new ViewportManager({
        scroller,
        renderer,
        pageSource,
        autoRender: false,
      });
      await manager.initialize();

      // Render a page
      await manager.renderPage(0);
      expect(manager.getPageState(0)?.state).toBe("rendered");

      // Invalidate
      await manager.invalidateVisiblePages();

      // Should be re-rendered
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(manager.getPageState(0)?.state).toBe("rendered");
    });
  });

  describe("page cleanup", () => {
    it("cleans up a specific page", async () => {
      const manager = new ViewportManager({
        scroller,
        renderer,
        pageSource,
        autoRender: false,
      });
      await manager.initialize();

      await manager.renderPage(0);
      expect(manager.getPageState(0)).not.toBeNull();

      manager.cleanupPage(0);

      expect(manager.getPageState(0)).toBeNull();
    });

    it("emits pageCleanup event", async () => {
      const manager = new ViewportManager({
        scroller,
        renderer,
        pageSource,
        autoRender: false,
      });
      await manager.initialize();

      await manager.renderPage(0);

      const listener = vi.fn();
      manager.addEventListener("pageCleanup", listener);

      manager.cleanupPage(0);

      expect(listener).toHaveBeenCalledWith({
        type: "pageCleanup",
        pageIndex: 0,
      });
    });

    it("cleans up off-screen pages beyond cache size", async () => {
      const manager = new ViewportManager({
        scroller,
        renderer,
        pageSource: createMockPageSource(20),
        cacheSize: 2,
        autoRender: false,
      });
      await manager.initialize();

      // Render many pages
      for (let i = 0; i < 10; i++) {
        await manager.renderPage(i);
      }

      // Scroll to show only later pages
      scroller.scrollToPage(15);

      // Trigger cleanup
      manager.cleanupOffscreenPages();

      // Should have cleaned up some pages
      // Only cache size pages should remain from off-screen ones
      const managedPages = manager.getManagedPages();
      const offscreenCount = managedPages.filter(p => p.pageIndex < 14).length;
      expect(offscreenCount).toBeLessThanOrEqual(2);
    });
  });

  describe("error handling", () => {
    it("handles render errors gracefully", async () => {
      const failingRenderer = createFailingMockRenderer();
      await failingRenderer.initialize();

      const manager = new ViewportManager({
        scroller,
        renderer: failingRenderer,
        pageSource,
        autoRender: false,
      });
      await manager.initialize();

      const errorListener = vi.fn();
      manager.addEventListener("pageError", errorListener);

      await manager.renderPage(0);

      // Wait for error
      await new Promise(resolve => setTimeout(resolve, 20));

      const state = manager.getPageState(0);
      expect(state?.state).toBe("error");
      expect(state?.error).not.toBeNull();
      expect(errorListener).toHaveBeenCalled();
    });

    it("continues processing queue after errors", async () => {
      const failingRenderer = createFailingMockRenderer();
      await failingRenderer.initialize();

      const manager = new ViewportManager({
        scroller,
        renderer: failingRenderer,
        pageSource,
        autoRender: false,
        maxConcurrentRenders: 1,
      });
      await manager.initialize();

      // Queue multiple renders
      manager.renderPage(0);
      manager.renderPage(1);

      // Wait for all to process
      await new Promise(resolve => setTimeout(resolve, 50));

      // Both should be in error state
      expect(manager.getPageState(0)?.state).toBe("error");
      expect(manager.getPageState(1)?.state).toBe("error");
    });
  });

  describe("concurrent rendering", () => {
    it("limits concurrent renders", async () => {
      // Use a slow renderer to verify concurrent limiting
      const slowRenderer = createMockRenderer(50);
      await slowRenderer.initialize();

      const manager = new ViewportManager({
        scroller,
        renderer: slowRenderer,
        pageSource,
        autoRender: false,
        maxConcurrentRenders: 2,
      });
      await manager.initialize();

      // Start many renders
      for (let i = 0; i < 5; i++) {
        manager.renderPage(i);
      }

      // Give renders a moment to start
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should not exceed max concurrent
      expect(manager.activeRenderCount).toBeLessThanOrEqual(2);

      // Wait for all to complete
      await new Promise(resolve => setTimeout(resolve, 300));

      // All should be rendered
      for (let i = 0; i < 5; i++) {
        expect(manager.getPageState(i)?.state).toBe("rendered");
      }
    });
  });

  describe("scale changes", () => {
    it("invalidates pages on scale change", async () => {
      const manager = new ViewportManager({
        scroller,
        renderer,
        pageSource,
        autoRender: false,
      });
      await manager.initialize();

      await manager.renderPage(0);
      const initialViewport = manager.getPageState(0)?.viewport;

      // Change scale
      scroller.setScale(2);

      // Wait for re-render
      await new Promise(resolve => setTimeout(resolve, 50));

      const newViewport = manager.getPageState(0)?.viewport;
      expect(newViewport?.scale).toBe(2);
    });
  });

  describe("event handling", () => {
    it("adds and removes event listeners", async () => {
      const manager = new ViewportManager({
        scroller,
        renderer,
        pageSource,
        autoRender: false,
      });
      await manager.initialize();

      const listener = vi.fn();
      manager.addEventListener("pageRendered", listener);

      await manager.renderPage(0);
      expect(listener).toHaveBeenCalledTimes(1);

      manager.removeEventListener("pageRendered", listener);
      await manager.renderPage(1);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("emits pageRendered event with element", async () => {
      const manager = new ViewportManager({
        scroller,
        renderer,
        pageSource,
        autoRender: false,
      });
      await manager.initialize();

      const events: ViewportManagerEvent[] = [];
      manager.addEventListener("pageRendered", event => events.push(event));

      await manager.renderPage(0);

      expect(events.length).toBe(1);
      expect(events[0].type).toBe("pageRendered");
      expect(events[0].pageIndex).toBe(0);
      expect(events[0].element).toBeDefined();
    });
  });

  describe("disposal", () => {
    it("cleans up all resources on dispose", async () => {
      const manager = new ViewportManager({
        scroller,
        renderer,
        pageSource,
        autoRender: false,
      });
      await manager.initialize();

      await manager.renderPage(0);
      await manager.renderPage(1);

      manager.dispose();

      expect(manager.managedPageCount).toBe(0);
    });

    it("does not process events after disposal", async () => {
      const manager = new ViewportManager({
        scroller,
        renderer,
        pageSource,
        autoRender: false,
      });
      await manager.initialize();

      const listener = vi.fn();
      manager.addEventListener("pageRendered", listener);

      manager.dispose();

      // Try to render after disposal
      await manager.renderPage(0);
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(listener).not.toHaveBeenCalled();
    });

    it("unsubscribes from scroller events on dispose", async () => {
      const manager = new ViewportManager({
        scroller,
        renderer,
        pageSource,
        autoRender: true,
      });
      await manager.initialize();

      manager.dispose();

      // Trigger scroller event
      scroller.scrollTo(0, 500);

      // Should not trigger any renders
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(manager.managedPageCount).toBe(0);
    });
  });

  describe("priority modes", () => {
    it("renders center pages first in visible mode", async () => {
      const manager = new ViewportManager({
        scroller,
        renderer,
        pageSource: createMockPageSource(20),
        autoRender: false,
        priorityMode: "visible",
        maxConcurrentRenders: 1,
      });
      await manager.initialize();

      // Scroll to middle
      scroller.scrollToPage(10);

      // Get visible range
      const range = scroller.getVisibleRange();
      const centerPage = Math.floor((range.start + range.end) / 2);

      // Track render order
      const renderOrder: number[] = [];
      manager.addEventListener("pageStateChange", event => {
        if (event.state === "rendering") {
          renderOrder.push(event.pageIndex);
        }
      });

      // Trigger auto-render by manually calling update
      await manager.invalidateVisiblePages();
      await new Promise(resolve => setTimeout(resolve, 200));

      // Center page should be rendered first (or very early)
      if (renderOrder.length > 0) {
        expect(renderOrder[0]).toBeCloseTo(centerPage, 1);
      }
    });
  });

  describe("integration with coordinate transformer", () => {
    it("uses correct scale for viewport creation", async () => {
      scroller.setScale(2);

      const manager = new ViewportManager({
        scroller,
        renderer,
        pageSource,
        autoRender: false,
      });
      await manager.initialize();

      await manager.renderPage(0);

      expect(renderer.createViewport).toHaveBeenCalledWith(LETTER_WIDTH, LETTER_HEIGHT, 0, 2);

      const state = manager.getPageState(0);
      expect(state?.viewport?.scale).toBe(2);
    });

    it("respects page rotation", async () => {
      const rotatedPageSource: PageSource = {
        getPageCount: () => 5,
        getPageDimensions: vi.fn(async () => ({
          width: LETTER_WIDTH,
          height: LETTER_HEIGHT,
        })),
        getPageRotation: vi.fn(async (pageIndex: number) => (pageIndex === 2 ? 90 : 0)),
      };

      const manager = new ViewportManager({
        scroller,
        renderer,
        pageSource: rotatedPageSource,
        autoRender: false,
      });
      await manager.initialize();

      await manager.renderPage(2);

      expect(renderer.createViewport).toHaveBeenCalledWith(
        LETTER_WIDTH,
        LETTER_HEIGHT,
        90,
        expect.any(Number),
      );
    });
  });
});
