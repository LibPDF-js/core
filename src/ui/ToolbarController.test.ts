import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type ToolbarEvent, ToolbarController } from "./ToolbarController";
import { UIStateManager } from "./UIStateManager";

// ============================================================================
// Mock DOM Elements
// ============================================================================

class MockStyle {
  [key: string]: string | undefined;
  display = "";
  zIndex = "";
}

class MockClassList {
  private classes = new Set<string>();

  add(className: string): void {
    this.classes.add(className);
  }

  remove(className: string): void {
    this.classes.delete(className);
  }

  contains(className: string): boolean {
    return this.classes.has(className);
  }
}

class MockElement {
  tagName: string;
  className = "";
  innerHTML = "";
  value = "";
  max = "";
  style = new MockStyle();
  classList = new MockClassList();
  children: MockElement[] = [];
  parentElement: MockElement | null = null;
  private attributes: Map<string, string> = new Map();
  private eventListeners: Map<string, Set<Function>> = new Map();

  constructor(tagName = "DIV") {
    this.tagName = tagName.toUpperCase();
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

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  appendChild(child: MockElement): MockElement {
    this.children.push(child);
    child.parentElement = this;
    return child;
  }

  removeChild(child: MockElement): MockElement {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      child.parentElement = null;
    }
    return child;
  }

  querySelector<T extends MockElement>(selector: string): T | null {
    // Match attribute selector with value: [attr="value"]
    const attrWithValueMatch = selector.match(/\[([^=\]]+)="([^"]+)"\]/);
    if (attrWithValueMatch) {
      const [, attr, value] = attrWithValueMatch;
      if (this.getAttribute(attr) === value) {
        return this as unknown as T;
      }
      for (const child of this.children) {
        const found = child.querySelector<T>(selector);
        if (found) {
          return found;
        }
      }
    }

    // Match attribute selector without value: [attr]
    const attrOnlyMatch = selector.match(/\[([^\]=]+)\]/);
    if (attrOnlyMatch) {
      const [, attr] = attrOnlyMatch;
      if (this.hasAttribute(attr)) {
        return this as unknown as T;
      }
      for (const child of this.children) {
        const found = child.querySelector<T>(selector);
        if (found) {
          return found;
        }
      }
    }

    return null;
  }

  addEventListener(type: string, listener: Function): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: Function): void {
    this.eventListeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: { type: string; key?: string; preventDefault?: () => void }): void {
    // Add target to event
    const eventWithTarget = { ...event, target: this };
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        listener(eventWithTarget);
      }
    }
  }

  click(): void {
    this.dispatchEvent({ type: "click", preventDefault: () => {} });
  }

  blur(): void {
    // No-op
  }

  focus(): void {
    // No-op
  }
}

// Mock document
const mockBody = new MockElement("BODY");
const mockDocument = {
  body: mockBody,
  activeElement: null as MockElement | null,
  createElement(tagName: string): MockElement {
    return new MockElement(tagName);
  },
  addEventListener(_type: string, _listener: Function): void {
    // No-op for document events in these tests
  },
  removeEventListener(_type: string, _listener: Function): void {
    // No-op
  },
};

// Set up mock document globally
beforeEach(() => {
  // @ts-expect-error - mocking global
  global.document = mockDocument;
  mockBody.children = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================================
// Test Helpers
// ============================================================================

function createMockContainer(): MockElement {
  const container = new MockElement("DIV");

  // Create buttons
  const buttons = [
    "zoom-in",
    "zoom-out",
    "zoom-reset",
    "fit-width",
    "fit-page",
    "prev-page",
    "next-page",
    "first-page",
    "last-page",
    "print",
    "download",
    "toggle-sidebar",
    "toggle-search",
    "toggle-fullscreen",
    "rotate-cw",
    "rotate-ccw",
  ];

  for (const action of buttons) {
    const button = new MockElement("BUTTON");
    button.setAttribute("data-toolbar-action", action);
    container.appendChild(button);
  }

  // Create page input
  const pageInput = new MockElement("INPUT");
  pageInput.setAttribute("data-toolbar-page-input", "");
  pageInput.setAttribute("type", "number");
  container.appendChild(pageInput);

  // Create zoom select
  const zoomSelect = new MockElement("SELECT");
  zoomSelect.setAttribute("data-toolbar-zoom-input", "");
  container.appendChild(zoomSelect);

  mockBody.appendChild(container);
  return container;
}

// ============================================================================
// Tests
// ============================================================================

describe("ToolbarController", () => {
  let stateManager: UIStateManager;
  let container: MockElement;

  beforeEach(() => {
    stateManager = new UIStateManager({
      initialState: { totalPages: 10, currentPage: 5 },
    });
    container = createMockContainer();
  });

  afterEach(() => {
    stateManager.dispose();
  });

  describe("constructor", () => {
    it("should create without container", () => {
      const toolbar = new ToolbarController({ stateManager });
      expect(toolbar.container).toBeNull();
      toolbar.dispose();
    });

    it("should create with container and bind elements", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });
      expect(toolbar.container).toBe(container);
      toolbar.dispose();
    });
  });

  describe("element binding", () => {
    it("should bind element after construction", () => {
      const toolbar = new ToolbarController({ stateManager });
      toolbar.bindElement(container as unknown as HTMLElement);
      expect(toolbar.container).toBe(container);
      toolbar.dispose();
    });

    it("should unbind element", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });
      toolbar.unbindElement();
      expect(toolbar.container).toBeNull();
      toolbar.dispose();
    });

    it("should rebind to new container", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      const newContainer = createMockContainer();
      toolbar.bindElement(newContainer as unknown as HTMLElement);
      expect(toolbar.container).toBe(newContainer);
      toolbar.dispose();
    });
  });

  describe("button click handling", () => {
    it("should handle zoom-in click", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      const initialZoom = stateManager.zoom;
      const button = container.querySelector<MockElement>('[data-toolbar-action="zoom-in"]')!;
      button.click();

      expect(stateManager.zoom).toBeGreaterThan(initialZoom);
      toolbar.dispose();
    });

    it("should handle zoom-out click", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      const initialZoom = stateManager.zoom;
      const button = container.querySelector<MockElement>('[data-toolbar-action="zoom-out"]')!;
      button.click();

      expect(stateManager.zoom).toBeLessThan(initialZoom);
      toolbar.dispose();
    });

    it("should handle zoom-reset click", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      stateManager.setZoom(2);
      const button = container.querySelector<MockElement>('[data-toolbar-action="zoom-reset"]')!;
      button.click();

      expect(stateManager.zoom).toBe(1);
      toolbar.dispose();
    });

    it("should handle prev-page click", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      const initialPage = stateManager.currentPage;
      const button = container.querySelector<MockElement>('[data-toolbar-action="prev-page"]')!;
      button.click();

      expect(stateManager.currentPage).toBe(initialPage - 1);
      toolbar.dispose();
    });

    it("should handle next-page click", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      const initialPage = stateManager.currentPage;
      const button = container.querySelector<MockElement>('[data-toolbar-action="next-page"]')!;
      button.click();

      expect(stateManager.currentPage).toBe(initialPage + 1);
      toolbar.dispose();
    });

    it("should handle first-page click", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      const button = container.querySelector<MockElement>('[data-toolbar-action="first-page"]')!;
      button.click();

      expect(stateManager.currentPage).toBe(0);
      toolbar.dispose();
    });

    it("should handle last-page click", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      const button = container.querySelector<MockElement>('[data-toolbar-action="last-page"]')!;
      button.click();

      expect(stateManager.currentPage).toBe(9);
      toolbar.dispose();
    });

    it("should handle toggle-sidebar click", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      expect(stateManager.sidebarVisible).toBe(false);
      const button = container.querySelector<MockElement>(
        '[data-toolbar-action="toggle-sidebar"]',
      )!;
      button.click();

      expect(stateManager.sidebarVisible).toBe(true);
      toolbar.dispose();
    });

    it("should handle toggle-search click", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      expect(stateManager.searchPanelVisible).toBe(false);
      const button = container.querySelector<MockElement>('[data-toolbar-action="toggle-search"]')!;
      button.click();

      expect(stateManager.searchPanelVisible).toBe(true);
      toolbar.dispose();
    });

    it("should handle toggle-fullscreen click", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      expect(stateManager.fullscreen).toBe(false);
      const button = container.querySelector<MockElement>(
        '[data-toolbar-action="toggle-fullscreen"]',
      )!;
      button.click();

      expect(stateManager.fullscreen).toBe(true);
      toolbar.dispose();
    });
  });

  describe("fit-width and fit-page", () => {
    it("should call calculateFitWidthZoom and apply result", () => {
      const calculateFitWidthZoom = vi.fn(() => 1.5);
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
        calculateFitWidthZoom,
      });

      const button = container.querySelector<MockElement>('[data-toolbar-action="fit-width"]')!;
      button.click();

      expect(calculateFitWidthZoom).toHaveBeenCalled();
      expect(stateManager.zoom).toBe(1.5);
      expect(stateManager.zoomFitMode).toBe("width");
      toolbar.dispose();
    });

    it("should call calculateFitPageZoom and apply result", () => {
      const calculateFitPageZoom = vi.fn(() => 0.8);
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
        calculateFitPageZoom,
      });

      const button = container.querySelector<MockElement>('[data-toolbar-action="fit-page"]')!;
      button.click();

      expect(calculateFitPageZoom).toHaveBeenCalled();
      expect(stateManager.zoom).toBe(0.8);
      expect(stateManager.zoomFitMode).toBe("page");
      toolbar.dispose();
    });
  });

  describe("print and download", () => {
    it("should call onPrint callback", () => {
      const onPrint = vi.fn();
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
        onPrint,
      });

      const button = container.querySelector<MockElement>('[data-toolbar-action="print"]')!;
      button.click();

      expect(onPrint).toHaveBeenCalled();
      toolbar.dispose();
    });

    it("should call onDownload callback", () => {
      const onDownload = vi.fn();
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
        onDownload,
      });

      const button = container.querySelector<MockElement>('[data-toolbar-action="download"]')!;
      button.click();

      expect(onDownload).toHaveBeenCalled();
      toolbar.dispose();
    });

    it("should emit print event", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      const listener = vi.fn();
      toolbar.addEventListener("print", listener);

      const button = container.querySelector<MockElement>('[data-toolbar-action="print"]')!;
      button.click();

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].type).toBe("print");
      toolbar.dispose();
    });

    it("should emit download event", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      const listener = vi.fn();
      toolbar.addEventListener("download", listener);

      const button = container.querySelector<MockElement>('[data-toolbar-action="download"]')!;
      button.click();

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].type).toBe("download");
      toolbar.dispose();
    });
  });

  describe("rotation", () => {
    it("should rotate clockwise", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      expect(toolbar.rotation).toBe(0);
      const button = container.querySelector<MockElement>('[data-toolbar-action="rotate-cw"]')!;
      button.click();

      expect(toolbar.rotation).toBe(90);
      toolbar.dispose();
    });

    it("should rotate counter-clockwise", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      expect(toolbar.rotation).toBe(0);
      const button = container.querySelector<MockElement>('[data-toolbar-action="rotate-ccw"]')!;
      button.click();

      expect(toolbar.rotation).toBe(270);
      toolbar.dispose();
    });

    it("should wrap rotation at 360 degrees", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      toolbar.setRotation(270);
      toolbar.rotate("cw");

      expect(toolbar.rotation).toBe(0);
      toolbar.dispose();
    });

    it("should emit rotate event", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      const listener = vi.fn();
      toolbar.addEventListener("rotate", listener);

      toolbar.rotate("cw");

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0] as ToolbarEvent;
      expect(event.type).toBe("rotate");
      expect(event.data?.direction).toBe("cw");
      expect(event.data?.rotation).toBe(90);
      toolbar.dispose();
    });

    it("should set rotation directly", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      toolbar.setRotation(180);
      expect(toolbar.rotation).toBe(180);

      // Math.round(44/90) = Math.round(0.49) = 0 -> 0
      toolbar.setRotation(44);
      expect(toolbar.rotation).toBe(0);

      // Math.round(46/90) = Math.round(0.51) = 1 -> 90
      toolbar.setRotation(46);
      expect(toolbar.rotation).toBe(90);

      // Math.round(135/90) = Math.round(1.5) = 2 -> 180
      toolbar.setRotation(135);
      expect(toolbar.rotation).toBe(180);

      // Math.round(225/90) = Math.round(2.5) = 3 -> 270
      toolbar.setRotation(225);
      expect(toolbar.rotation).toBe(270);

      // Math.round(315/90) = Math.round(3.5) = 4 -> 360 % 360 = 0
      toolbar.setRotation(315);
      expect(toolbar.rotation).toBe(0);
      toolbar.dispose();
    });
  });

  describe("page input", () => {
    it("should update page on input change", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      const input = container.querySelector<MockElement>("[data-toolbar-page-input]")!;
      input.value = "3";
      input.dispatchEvent({ type: "change" });

      expect(stateManager.currentPage).toBe(2); // 0-indexed
      toolbar.dispose();
    });

    it("should update page on Enter key", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      const input = container.querySelector<MockElement>("[data-toolbar-page-input]")!;
      input.value = "7";
      input.dispatchEvent({ type: "keydown", key: "Enter" });

      expect(stateManager.currentPage).toBe(6);
      toolbar.dispose();
    });
  });

  describe("zoom input", () => {
    it("should update zoom on select change", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      const select = container.querySelector<MockElement>("[data-toolbar-zoom-input]")!;
      select.value = "150";
      select.dispatchEvent({ type: "change" });

      expect(stateManager.zoom).toBe(1.5);
      toolbar.dispose();
    });

    it("should handle fit-width option", () => {
      const calculateFitWidthZoom = vi.fn(() => 1.2);
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
        calculateFitWidthZoom,
      });

      const select = container.querySelector<MockElement>("[data-toolbar-zoom-input]")!;
      select.value = "fit-width";
      select.dispatchEvent({ type: "change" });

      expect(calculateFitWidthZoom).toHaveBeenCalled();
      toolbar.dispose();
    });

    it("should handle fit-page option", () => {
      const calculateFitPageZoom = vi.fn(() => 0.9);
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
        calculateFitPageZoom,
      });

      const select = container.querySelector<MockElement>("[data-toolbar-zoom-input]")!;
      select.value = "fit-page";
      select.dispatchEvent({ type: "change" });

      expect(calculateFitPageZoom).toHaveBeenCalled();
      toolbar.dispose();
    });
  });

  describe("executeAction", () => {
    it("should execute actions programmatically", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      toolbar.executeAction("zoom-in");
      expect(stateManager.zoom).toBeGreaterThan(1);

      toolbar.executeAction("toggle-sidebar");
      expect(stateManager.sidebarVisible).toBe(true);
      toolbar.dispose();
    });

    it("should emit action event for all actions", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      const listener = vi.fn();
      toolbar.addEventListener("action", listener);

      toolbar.executeAction("zoom-in");

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].buttonId).toBe("zoom-in");
      toolbar.dispose();
    });
  });

  describe("button states", () => {
    it("should disable prev-page when on first page", () => {
      stateManager.setCurrentPage(0);

      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      const button = container.querySelector<MockElement>('[data-toolbar-action="prev-page"]')!;
      expect(button.hasAttribute("disabled")).toBe(true);
      expect(button.getAttribute("aria-disabled")).toBe("true");
      toolbar.dispose();
    });

    it("should disable next-page when on last page", () => {
      stateManager.setCurrentPage(9);

      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      const button = container.querySelector<MockElement>('[data-toolbar-action="next-page"]')!;
      expect(button.hasAttribute("disabled")).toBe(true);
      toolbar.dispose();
    });

    it("should update button states on state change", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      const prevButton = container.querySelector<MockElement>('[data-toolbar-action="prev-page"]')!;
      expect(prevButton.hasAttribute("disabled")).toBe(false);

      stateManager.setCurrentPage(0);
      expect(prevButton.hasAttribute("disabled")).toBe(true);
      toolbar.dispose();
    });

    it("should set active state on toggle buttons", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      const sidebarButton = container.querySelector<MockElement>(
        '[data-toolbar-action="toggle-sidebar"]',
      )!;
      expect(sidebarButton.classList.contains("active")).toBe(false);
      expect(sidebarButton.getAttribute("aria-pressed")).toBe("false");

      stateManager.toggleSidebar();
      expect(sidebarButton.classList.contains("active")).toBe(true);
      expect(sidebarButton.getAttribute("aria-pressed")).toBe("true");
      toolbar.dispose();
    });
  });

  describe("input value updates", () => {
    it("should update page input value on state change", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      const input = container.querySelector<MockElement>("[data-toolbar-page-input]")!;
      expect(input.value).toBe("6"); // currentPage 5 + 1

      stateManager.setCurrentPage(2);
      expect(input.value).toBe("3");
      toolbar.dispose();
    });

    it("should update zoom input value on state change", () => {
      // Use an INPUT element instead of SELECT to test value updates
      // (SELECT requires options to be present, which is complex to mock)
      const zoomInput = new MockElement("INPUT");
      zoomInput.setAttribute("data-toolbar-zoom-input", "");
      container.appendChild(zoomInput);

      // Remove the existing SELECT (which was added in createMockContainer)
      const existingSelect = container.querySelector<MockElement>("[data-toolbar-zoom-input]");
      if (existingSelect?.tagName === "SELECT") {
        const idx = container.children.indexOf(existingSelect);
        if (idx !== -1) {
          container.children.splice(idx, 1);
        }
      }

      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      stateManager.setZoom(2);
      expect(zoomInput.value).toBe("200");
      toolbar.dispose();
    });
  });

  describe("goToPage", () => {
    it("should navigate to page using 1-based number", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      toolbar.goToPage(3);
      expect(stateManager.currentPage).toBe(2); // 0-indexed
      toolbar.dispose();
    });
  });

  describe("setZoom", () => {
    it("should set zoom level directly", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      toolbar.setZoom(2.5);
      expect(stateManager.zoom).toBe(2.5);
      toolbar.dispose();
    });
  });

  describe("event handling", () => {
    it("should add and remove event listeners", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      const listener = vi.fn();
      toolbar.addEventListener("action", listener);
      toolbar.executeAction("zoom-in");
      expect(listener).toHaveBeenCalledTimes(1);

      toolbar.removeEventListener("action", listener);
      toolbar.executeAction("zoom-in");
      expect(listener).toHaveBeenCalledTimes(1);
      toolbar.dispose();
    });
  });

  describe("dispose", () => {
    it("should clean up event listeners on dispose", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      const listener = vi.fn();
      toolbar.addEventListener("action", listener);

      toolbar.dispose();
      toolbar.executeAction("zoom-in");

      expect(listener).not.toHaveBeenCalled();
    });

    it("should unbind from container on dispose", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      toolbar.dispose();
      expect(toolbar.container).toBeNull();
    });

    it("should not crash on double dispose", () => {
      const toolbar = new ToolbarController({
        stateManager,
        container: container as unknown as HTMLElement,
      });

      toolbar.dispose();
      expect(() => toolbar.dispose()).not.toThrow();
    });
  });
});
