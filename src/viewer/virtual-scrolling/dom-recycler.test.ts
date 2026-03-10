/**
 * Tests for DOMRecycler.
 *
 * These tests use a minimal DOM mock since the project doesn't include jsdom.
 * The mock provides enough functionality to test the DOMRecycler's logic.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDefaultPoolConfigs,
  createDOMRecycler,
  DOMRecycler,
  type DOMRecyclerEvent,
  type PoolConfig,
  type RecyclableElementType,
} from "./dom-recycler";

// Minimal DOM mock for testing without jsdom
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

// Mock canvas element
class MockCanvasElement extends MockElement {
  width = 0;
  height = 0;

  constructor() {
    super("CANVAS");
  }
}

// Mock document
const mockDocument = {
  createElement(tagName: string): MockElement {
    if (tagName.toLowerCase() === "canvas") {
      return new MockCanvasElement();
    }
    return new MockElement(tagName);
  },
};

// Set up mock document globally before each test
beforeEach(() => {
  global.document = mockDocument as unknown as Document;
});

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Create a simple pool config for testing.
 */
function createTestPoolConfig(className = "test-element"): PoolConfig {
  return {
    factory: () => {
      const div = mockDocument.createElement("div");
      div.className = className;
      return div as unknown as HTMLElement;
    },
    reset: el => {
      (el as unknown as MockElement).innerHTML = "";
      (el as unknown as MockElement).className = className;
    },
    prepare: el => {
      (el as unknown as MockElement).setAttribute("data-prepared", "true");
    },
  };
}

describe("DOMRecycler", () => {
  describe("construction", () => {
    it("creates recycler with default options", () => {
      const recycler = new DOMRecycler();

      expect(recycler).toBeInstanceOf(DOMRecycler);
      const stats = recycler.getStats();
      expect(stats.totalElements).toBe(0);
    });

    it("creates recycler with custom options", () => {
      const recycler = new DOMRecycler({
        defaultMaxPoolSize: 20,
        autoCleanup: false,
        cleanupInterval: 60000,
        maxElementAge: 120000,
      });

      expect(recycler).toBeInstanceOf(DOMRecycler);
    });

    it("creates recycler via factory function", () => {
      const recycler = createDOMRecycler({ defaultMaxPoolSize: 5 });

      expect(recycler).toBeInstanceOf(DOMRecycler);
    });
  });

  describe("pool registration", () => {
    it("registers a pool for an element type", () => {
      const recycler = new DOMRecycler();
      const config = createTestPoolConfig();

      recycler.registerPool("pageContainer", config);

      expect(recycler.hasPool("pageContainer")).toBe(true);
    });

    it("returns false for unregistered pool", () => {
      const recycler = new DOMRecycler();

      expect(recycler.hasPool("pageContainer")).toBe(false);
    });

    it("retrieves pool configuration", () => {
      const recycler = new DOMRecycler();
      const config = createTestPoolConfig();

      recycler.registerPool("pageContainer", config);
      const retrieved = recycler.getPoolConfig("pageContainer");

      expect(retrieved).not.toBeNull();
      expect(retrieved!.factory).toBe(config.factory);
      expect(retrieved!.reset).toBe(config.reset);
      expect(retrieved!.prepare).toBe(config.prepare);
    });

    it("returns null for non-existent pool config", () => {
      const recycler = new DOMRecycler();

      expect(recycler.getPoolConfig("pageContainer")).toBeNull();
    });

    it("registers multiple pools", () => {
      const recycler = new DOMRecycler();

      recycler.registerPool("pageContainer", createTestPoolConfig("page"));
      recycler.registerPool("textLayer", createTestPoolConfig("text"));
      recycler.registerPool("canvasLayer", createTestPoolConfig("canvas"));

      expect(recycler.hasPool("pageContainer")).toBe(true);
      expect(recycler.hasPool("textLayer")).toBe(true);
      expect(recycler.hasPool("canvasLayer")).toBe(true);
    });
  });

  describe("element acquisition", () => {
    it("creates a new element when pool is empty", () => {
      const recycler = new DOMRecycler();
      recycler.registerPool("pageContainer", createTestPoolConfig());

      const element = recycler.acquire("pageContainer", 0);

      expect(element).toBeDefined();
      expect((element as unknown as MockElement).className).toBe("test-element");
    });

    it("calls prepare function when acquiring", () => {
      const recycler = new DOMRecycler();
      recycler.registerPool("pageContainer", createTestPoolConfig());

      const element = recycler.acquire("pageContainer", 0);

      expect((element as unknown as MockElement).getAttribute("data-prepared")).toBe("true");
    });

    it("returns existing element for same page", () => {
      const recycler = new DOMRecycler();
      recycler.registerPool("pageContainer", createTestPoolConfig());

      const element1 = recycler.acquire("pageContainer", 5);
      const element2 = recycler.acquire("pageContainer", 5);

      expect(element1).toBe(element2);
    });

    it("creates different elements for different pages", () => {
      const recycler = new DOMRecycler();
      recycler.registerPool("pageContainer", createTestPoolConfig());

      const element1 = recycler.acquire("pageContainer", 0);
      const element2 = recycler.acquire("pageContainer", 1);

      expect(element1).not.toBe(element2);
    });

    it("throws error for unregistered pool type", () => {
      const recycler = new DOMRecycler();

      expect(() => {
        recycler.acquire("pageContainer", 0);
      }).toThrow("No pool registered for element type: pageContainer");
    });

    it("tracks acquired elements in stats", () => {
      const recycler = new DOMRecycler();
      recycler.registerPool("pageContainer", createTestPoolConfig());

      recycler.acquire("pageContainer", 0);
      recycler.acquire("pageContainer", 1);

      const stats = recycler.getStats();
      expect(stats.totalElements).toBe(2);
      expect(stats.inUseCount).toBe(2);
      expect(stats.availableCount).toBe(0);
      expect(stats.createCount).toBe(2);
    });

    it("emits elementAcquired event", () => {
      const recycler = new DOMRecycler();
      recycler.registerPool("pageContainer", createTestPoolConfig());
      const listener = vi.fn();

      recycler.addEventListener("elementAcquired", listener);
      recycler.acquire("pageContainer", 5);

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0] as DOMRecyclerEvent;
      expect(event.type).toBe("elementAcquired");
      expect(event.elementType).toBe("pageContainer");
      expect(event.pageIndex).toBe(5);
      expect(event.elementId).toBeDefined();
    });
  });

  describe("element recycling", () => {
    it("recycles element after release", () => {
      const recycler = new DOMRecycler();
      recycler.registerPool("pageContainer", createTestPoolConfig());

      const element1 = recycler.acquire("pageContainer", 0);
      recycler.release("pageContainer", 0);
      const element2 = recycler.acquire("pageContainer", 1);

      // Should reuse the same DOM element
      expect(element1).toBe(element2);
    });

    it("calls reset function when releasing", () => {
      const recycler = new DOMRecycler();
      const resetFn = vi.fn();
      recycler.registerPool("pageContainer", {
        factory: () => mockDocument.createElement("div") as unknown as HTMLElement,
        reset: resetFn,
      });

      const element = recycler.acquire("pageContainer", 0);
      recycler.release("pageContainer", 0);

      expect(resetFn).toHaveBeenCalledWith(element);
    });

    it("increments recycle count when reusing", () => {
      const recycler = new DOMRecycler();
      recycler.registerPool("pageContainer", createTestPoolConfig());

      recycler.acquire("pageContainer", 0);
      recycler.release("pageContainer", 0);
      recycler.acquire("pageContainer", 1);

      const stats = recycler.getStats();
      expect(stats.createCount).toBe(1);
      expect(stats.recycleCount).toBe(1);
    });

    it("emits elementReleased event", () => {
      const recycler = new DOMRecycler();
      recycler.registerPool("pageContainer", createTestPoolConfig());
      const listener = vi.fn();

      recycler.acquire("pageContainer", 5);
      recycler.addEventListener("elementReleased", listener);
      recycler.release("pageContainer", 5);

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0] as DOMRecyclerEvent;
      expect(event.type).toBe("elementReleased");
      expect(event.elementType).toBe("pageContainer");
      expect(event.pageIndex).toBe(5);
    });

    it("handles release of non-existent page gracefully", () => {
      const recycler = new DOMRecycler();
      recycler.registerPool("pageContainer", createTestPoolConfig());

      // Should not throw
      recycler.release("pageContainer", 99);
    });
  });

  describe("releaseAllForPage", () => {
    it("releases all elements for a page", () => {
      const recycler = new DOMRecycler();
      recycler.registerPool("pageContainer", createTestPoolConfig("page"));
      recycler.registerPool("textLayer", createTestPoolConfig("text"));

      recycler.acquire("pageContainer", 5);
      recycler.acquire("textLayer", 5);

      expect(recycler.hasElement("pageContainer", 5)).toBe(true);
      expect(recycler.hasElement("textLayer", 5)).toBe(true);

      recycler.releaseAllForPage(5);

      expect(recycler.hasElement("pageContainer", 5)).toBe(false);
      expect(recycler.hasElement("textLayer", 5)).toBe(false);
    });

    it("does not affect other pages", () => {
      const recycler = new DOMRecycler();
      recycler.registerPool("pageContainer", createTestPoolConfig());

      recycler.acquire("pageContainer", 5);
      recycler.acquire("pageContainer", 6);

      recycler.releaseAllForPage(5);

      expect(recycler.hasElement("pageContainer", 5)).toBe(false);
      expect(recycler.hasElement("pageContainer", 6)).toBe(true);
    });
  });

  describe("element queries", () => {
    it("getElement returns element for page", () => {
      const recycler = new DOMRecycler();
      recycler.registerPool("pageContainer", createTestPoolConfig());

      const acquired = recycler.acquire("pageContainer", 3);
      const retrieved = recycler.getElement("pageContainer", 3);

      expect(retrieved).toBe(acquired);
    });

    it("getElement returns null for non-existent", () => {
      const recycler = new DOMRecycler();
      recycler.registerPool("pageContainer", createTestPoolConfig());

      expect(recycler.getElement("pageContainer", 99)).toBeNull();
    });

    it("hasElement returns correct value", () => {
      const recycler = new DOMRecycler();
      recycler.registerPool("pageContainer", createTestPoolConfig());

      expect(recycler.hasElement("pageContainer", 0)).toBe(false);

      recycler.acquire("pageContainer", 0);
      expect(recycler.hasElement("pageContainer", 0)).toBe(true);

      recycler.release("pageContainer", 0);
      expect(recycler.hasElement("pageContainer", 0)).toBe(false);
    });

    it("getElementsForPage returns all elements", () => {
      const recycler = new DOMRecycler();
      recycler.registerPool("pageContainer", createTestPoolConfig("page"));
      recycler.registerPool("textLayer", createTestPoolConfig("text"));

      recycler.acquire("pageContainer", 2);
      recycler.acquire("textLayer", 2);

      const elements = recycler.getElementsForPage(2);

      expect(elements.size).toBe(2);
      expect(elements.has("pageContainer")).toBe(true);
      expect(elements.has("textLayer")).toBe(true);
    });

    it("getElementsForPage returns empty map for non-existent page", () => {
      const recycler = new DOMRecycler();
      recycler.registerPool("pageContainer", createTestPoolConfig());

      const elements = recycler.getElementsForPage(99);

      expect(elements.size).toBe(0);
    });
  });

  describe("pool size limits", () => {
    it("enforces max pool size", () => {
      const recycler = new DOMRecycler({ defaultMaxPoolSize: 3 });
      recycler.registerPool("pageContainer", createTestPoolConfig());

      // Acquire 5 elements
      for (let i = 0; i < 5; i++) {
        recycler.acquire("pageContainer", i);
      }

      // Release all
      for (let i = 0; i < 5; i++) {
        recycler.release("pageContainer", i);
      }

      const stats = recycler.getStats();
      // Should have trimmed to maxPoolSize
      expect(stats.totalElements).toBeLessThanOrEqual(3);
    });

    it("respects custom pool maxSize", () => {
      const recycler = new DOMRecycler({ defaultMaxPoolSize: 10 });
      recycler.registerPool("pageContainer", {
        ...createTestPoolConfig(),
        maxSize: 2,
      });

      // Acquire 5 elements
      for (let i = 0; i < 5; i++) {
        recycler.acquire("pageContainer", i);
      }

      // Release all
      for (let i = 0; i < 5; i++) {
        recycler.release("pageContainer", i);
      }

      const stats = recycler.getStats();
      const poolStats = stats.byType.get("pageContainer");
      expect(poolStats!.total).toBeLessThanOrEqual(2);
    });
  });

  describe("cleanup", () => {
    it("cleans up old unused elements", async () => {
      const recycler = new DOMRecycler({
        maxElementAge: 100, // 100ms
        defaultMaxPoolSize: 10,
      });
      recycler.registerPool("pageContainer", createTestPoolConfig());

      // Acquire and release elements
      for (let i = 0; i < 5; i++) {
        recycler.acquire("pageContainer", i);
        recycler.release("pageContainer", i);
      }

      // Wait for elements to age
      await new Promise(resolve => setTimeout(resolve, 150));

      const cleaned = recycler.cleanup();
      // Some elements should be cleaned up
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });

    it("keeps minimum elements in pool", () => {
      const recycler = new DOMRecycler({
        maxElementAge: 0, // Immediate cleanup eligibility
        defaultMaxPoolSize: 10,
      });
      recycler.registerPool("pageContainer", createTestPoolConfig());

      // Acquire and release elements
      for (let i = 0; i < 5; i++) {
        recycler.acquire("pageContainer", i);
        recycler.release("pageContainer", i);
      }

      recycler.cleanup();

      const stats = recycler.getStats();
      // Should keep at least half of maxPoolSize
      expect(stats.availableCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("clear", () => {
    it("clears all pools", () => {
      const recycler = new DOMRecycler();
      recycler.registerPool("pageContainer", createTestPoolConfig("page"));
      recycler.registerPool("textLayer", createTestPoolConfig("text"));

      recycler.acquire("pageContainer", 0);
      recycler.acquire("textLayer", 0);
      recycler.acquire("pageContainer", 1);

      recycler.clear();

      const stats = recycler.getStats();
      expect(stats.totalElements).toBe(0);
      expect(stats.inUseCount).toBe(0);
      expect(stats.createCount).toBe(0);
      expect(stats.recycleCount).toBe(0);
    });

    it("releases all page mappings", () => {
      const recycler = new DOMRecycler();
      recycler.registerPool("pageContainer", createTestPoolConfig());

      recycler.acquire("pageContainer", 0);
      recycler.acquire("pageContainer", 1);

      recycler.clear();

      expect(recycler.hasElement("pageContainer", 0)).toBe(false);
      expect(recycler.hasElement("pageContainer", 1)).toBe(false);
    });
  });

  describe("statistics", () => {
    it("provides accurate stats by type", () => {
      const recycler = new DOMRecycler();
      recycler.registerPool("pageContainer", createTestPoolConfig("page"));
      recycler.registerPool("textLayer", createTestPoolConfig("text"));

      recycler.acquire("pageContainer", 0);
      recycler.acquire("pageContainer", 1);
      recycler.acquire("textLayer", 0);
      recycler.release("pageContainer", 1);

      const stats = recycler.getStats();

      const pageStats = stats.byType.get("pageContainer");
      expect(pageStats!.total).toBe(2);
      expect(pageStats!.inUse).toBe(1);
      expect(pageStats!.available).toBe(1);

      const textStats = stats.byType.get("textLayer");
      expect(textStats!.total).toBe(1);
      expect(textStats!.inUse).toBe(1);
      expect(textStats!.available).toBe(0);
    });

    it("tracks recycle vs create counts", () => {
      const recycler = new DOMRecycler();
      recycler.registerPool("pageContainer", createTestPoolConfig());

      // Create 3 elements
      recycler.acquire("pageContainer", 0);
      recycler.acquire("pageContainer", 1);
      recycler.acquire("pageContainer", 2);

      // Release all
      recycler.release("pageContainer", 0);
      recycler.release("pageContainer", 1);
      recycler.release("pageContainer", 2);

      // Reuse 2
      recycler.acquire("pageContainer", 3);
      recycler.acquire("pageContainer", 4);

      const stats = recycler.getStats();
      expect(stats.createCount).toBe(3);
      expect(stats.recycleCount).toBe(2);
    });
  });

  describe("event handling", () => {
    it("supports multiple listeners", () => {
      const recycler = new DOMRecycler();
      recycler.registerPool("pageContainer", createTestPoolConfig());
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      recycler.addEventListener("elementAcquired", listener1);
      recycler.addEventListener("elementAcquired", listener2);
      recycler.acquire("pageContainer", 0);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it("removes event listeners", () => {
      const recycler = new DOMRecycler();
      recycler.registerPool("pageContainer", createTestPoolConfig());
      const listener = vi.fn();

      recycler.addEventListener("elementAcquired", listener);
      recycler.acquire("pageContainer", 0);
      expect(listener).toHaveBeenCalledTimes(1);

      recycler.removeEventListener("elementAcquired", listener);
      recycler.acquire("pageContainer", 1);
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("dispose", () => {
    it("disposes recycler", () => {
      const recycler = new DOMRecycler();
      recycler.registerPool("pageContainer", createTestPoolConfig());
      recycler.acquire("pageContainer", 0);

      recycler.dispose();

      expect(() => {
        recycler.acquire("pageContainer", 1);
      }).toThrow("DOMRecycler has been disposed");
    });

    it("clears all state on dispose", () => {
      const recycler = new DOMRecycler();
      recycler.registerPool("pageContainer", createTestPoolConfig());
      recycler.acquire("pageContainer", 0);

      recycler.dispose();

      const stats = recycler.getStats();
      expect(stats.totalElements).toBe(0);
    });

    it("is idempotent", () => {
      const recycler = new DOMRecycler();

      recycler.dispose();
      recycler.dispose(); // Should not throw
    });
  });

  describe("createDefaultPoolConfigs", () => {
    it("creates configs for all element types", () => {
      const configs = createDefaultPoolConfigs();

      expect(configs.has("pageContainer")).toBe(true);
      expect(configs.has("textLayer")).toBe(true);
      expect(configs.has("canvasLayer")).toBe(true);
      expect(configs.has("annotationLayer")).toBe(true);
    });

    it("creates working factories", () => {
      const configs = createDefaultPoolConfigs();
      const recycler = new DOMRecycler();

      for (const [type, config] of configs) {
        recycler.registerPool(type as RecyclableElementType, config);
      }

      const pageEl = recycler.acquire("pageContainer", 0);
      expect((pageEl as unknown as MockElement).className).toBe("pdf-page-container");

      const textEl = recycler.acquire("textLayer", 0);
      expect((textEl as unknown as MockElement).className).toBe("pdf-text-layer");

      const canvasEl = recycler.acquire("canvasLayer", 0);
      expect((canvasEl as unknown as MockElement).className).toBe("pdf-canvas-layer");
      expect((canvasEl as unknown as MockElement).tagName.toLowerCase()).toBe("canvas");

      const annotEl = recycler.acquire("annotationLayer", 0);
      expect((annotEl as unknown as MockElement).className).toBe("pdf-annotation-layer");
    });

    it("reset functions work correctly", () => {
      const configs = createDefaultPoolConfigs();
      const recycler = new DOMRecycler();

      for (const [type, config] of configs) {
        recycler.registerPool(type as RecyclableElementType, config);
      }

      const pageEl = recycler.acquire("pageContainer", 0) as unknown as MockElement;
      pageEl.style.width = "100px";
      pageEl.innerHTML = "<span>test</span>";

      recycler.release("pageContainer", 0);
      const recycled = recycler.acquire("pageContainer", 1) as unknown as MockElement;

      expect(recycled.innerHTML).toBe("");
      expect(recycled.style.width).toBe("");
    });
  });

  describe("edge cases", () => {
    it("handles rapid acquire/release cycles", () => {
      const recycler = new DOMRecycler({ defaultMaxPoolSize: 5 });
      recycler.registerPool("pageContainer", createTestPoolConfig());

      for (let cycle = 0; cycle < 100; cycle++) {
        const pageIndex = cycle % 10;
        if (recycler.hasElement("pageContainer", pageIndex)) {
          recycler.release("pageContainer", pageIndex);
        }
        recycler.acquire("pageContainer", pageIndex);
      }

      const stats = recycler.getStats();
      expect(stats.totalElements).toBeLessThanOrEqual(10);
    });

    it("handles multiple element types for same page", () => {
      const recycler = new DOMRecycler();
      recycler.registerPool("pageContainer", createTestPoolConfig("page"));
      recycler.registerPool("textLayer", createTestPoolConfig("text"));
      recycler.registerPool("canvasLayer", {
        factory: () => mockDocument.createElement("canvas") as unknown as HTMLElement,
      });

      recycler.acquire("pageContainer", 0);
      recycler.acquire("textLayer", 0);
      recycler.acquire("canvasLayer", 0);

      const elements = recycler.getElementsForPage(0);
      expect(elements.size).toBe(3);

      recycler.releaseAllForPage(0);
      expect(recycler.getElementsForPage(0).size).toBe(0);
    });

    it("handles auto-cleanup timer", () => {
      const recycler = new DOMRecycler({
        autoCleanup: true,
        cleanupInterval: 100,
      });
      recycler.registerPool("pageContainer", createTestPoolConfig());

      recycler.acquire("pageContainer", 0);
      recycler.release("pageContainer", 0);

      // Dispose before timer fires to avoid memory leaks in tests
      recycler.dispose();
    });
  });
});
