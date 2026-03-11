import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type OverlayEvent, OverlayManager } from "./OverlayManager";

// ============================================================================
// Mock DOM Elements
// ============================================================================

class MockStyle {
  [key: string]: string | undefined;
  display = "";
  zIndex = "";
  cssText = "";
  position = "";
  top = "";
  left = "";
  right = "";
  bottom = "";
  backgroundColor = "";
}

class MockElement {
  tagName: string;
  className = "";
  innerHTML = "";
  tabIndex = 0;
  style = new MockStyle();
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

  remove(): void {
    if (this.parentElement) {
      this.parentElement.removeChild(this);
    }
  }

  querySelector<T extends MockElement>(selector: string): T | null {
    // Simple class selector matching
    if (selector.startsWith(".")) {
      const className = selector.slice(1);
      if (this.className.includes(className)) {
        return this as unknown as T;
      }
      for (const child of this.children) {
        const found = child.querySelector<T>(selector);
        if (found) {
          return found;
        }
      }
    }
    // Attribute selector matching
    const attrMatch = selector.match(/\[([^=]+)="([^"]+)"\]/);
    if (attrMatch) {
      const [, attr, value] = attrMatch;
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
    return null;
  }

  querySelectorAll<T extends MockElement>(selector: string): T[] {
    const results: T[] = [];
    // Simple selector for focusable elements
    // The selector typically looks like: 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    const isFocusable =
      this.tagName === "BUTTON" ||
      this.tagName === "INPUT" ||
      this.tagName === "SELECT" ||
      this.tagName === "TEXTAREA" ||
      this.hasAttribute("href") ||
      (this.hasAttribute("tabindex") && this.getAttribute("tabindex") !== "-1");

    if (isFocusable) {
      results.push(this as unknown as T);
    }

    for (const child of this.children) {
      results.push(...child.querySelectorAll<T>(selector));
    }
    return results;
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
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        listener(event);
      }
    }
  }

  click(): void {
    const listeners = this.eventListeners.get("click");
    if (listeners) {
      for (const listener of listeners) {
        listener({ type: "click" });
      }
    }
  }

  focus(): void {
    mockDocument.activeElement = this;
  }

  blur(): void {
    if (mockDocument.activeElement === this) {
      mockDocument.activeElement = null;
    }
  }
}

// Mock document
const mockBody = new MockElement("BODY");
const documentKeydownListeners = new Set<Function>();

const mockDocument = {
  body: mockBody,
  activeElement: null as MockElement | null,
  createElement(tagName: string): MockElement {
    return new MockElement(tagName);
  },
  addEventListener(type: string, listener: Function): void {
    if (type === "keydown") {
      documentKeydownListeners.add(listener);
    }
  },
  removeEventListener(type: string, listener: Function): void {
    if (type === "keydown") {
      documentKeydownListeners.delete(listener);
    }
  },
  dispatchKeydown(key: string): void {
    const event = { type: "keydown", key, preventDefault: () => {} };
    for (const listener of documentKeydownListeners) {
      listener(event);
    }
  },
};

// Set up mock document globally
beforeEach(() => {
  // @ts-expect-error - mocking global
  global.document = mockDocument;
  mockBody.children = [];
  mockDocument.activeElement = null;
  documentKeydownListeners.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================================
// Test Helpers
// ============================================================================

function createMockOverlayElement(): MockElement {
  const element = new MockElement("DIV");
  element.className = "test-overlay";

  const button = new MockElement("BUTTON");
  button.innerHTML = "Focus me";
  element.appendChild(button);

  return element;
}

// ============================================================================
// Tests
// ============================================================================

describe("OverlayManager", () => {
  let container: MockElement;
  let overlayElement: MockElement;

  beforeEach(() => {
    container = new MockElement("DIV");
    mockBody.appendChild(container);

    overlayElement = createMockOverlayElement();
    container.appendChild(overlayElement);
  });

  describe("constructor", () => {
    it("should create with default options", () => {
      const manager = new OverlayManager();
      expect(manager.registeredCount).toBe(0);
      expect(manager.openCount).toBe(0);
      manager.dispose();
    });

    it("should create with custom options", () => {
      const manager = new OverlayManager({
        baseZIndex: 2000,
        zIndexIncrement: 20,
        backdropClass: "custom-backdrop",
        container: container as unknown as HTMLElement,
      });

      expect(manager.registeredCount).toBe(0);
      manager.dispose();
    });
  });

  describe("registration", () => {
    it("should register an overlay", () => {
      const manager = new OverlayManager({ container: container as unknown as HTMLElement });

      manager.register({
        id: "test-modal",
        type: "modal",
        element: overlayElement as unknown as HTMLElement,
      });

      expect(manager.isRegistered("test-modal")).toBe(true);
      expect(manager.registeredCount).toBe(1);
      manager.dispose();
    });

    it("should hide element on registration", () => {
      const manager = new OverlayManager({ container: container as unknown as HTMLElement });

      manager.register({
        id: "test-modal",
        type: "modal",
        element: overlayElement as unknown as HTMLElement,
      });

      expect(overlayElement.style.display).toBe("none");
      manager.dispose();
    });

    it("should unregister an overlay", () => {
      const manager = new OverlayManager({ container: container as unknown as HTMLElement });

      manager.register({
        id: "test-modal",
        type: "modal",
        element: overlayElement as unknown as HTMLElement,
      });

      manager.unregister("test-modal");
      expect(manager.isRegistered("test-modal")).toBe(false);
      manager.dispose();
    });

    it("should update existing registration", () => {
      const manager = new OverlayManager({ container: container as unknown as HTMLElement });

      manager.register({
        id: "test-modal",
        type: "modal",
        element: overlayElement as unknown as HTMLElement,
        backdrop: false,
      });

      const newElement = new MockElement("DIV");
      manager.register({
        id: "test-modal",
        type: "dialog",
        element: newElement as unknown as HTMLElement,
        backdrop: true,
      });

      expect(manager.registeredCount).toBe(1);
      manager.dispose();
    });
  });

  describe("open/close", () => {
    it("should open an overlay", () => {
      const manager = new OverlayManager({ container: container as unknown as HTMLElement });

      manager.register({
        id: "test-modal",
        type: "modal",
        element: overlayElement as unknown as HTMLElement,
      });

      manager.open("test-modal");

      expect(manager.isOpen("test-modal")).toBe(true);
      expect(manager.openCount).toBe(1);
      expect(overlayElement.style.display).toBe("");
      expect(overlayElement.getAttribute("aria-hidden")).toBe("false");
      manager.dispose();
    });

    it("should not open non-existent overlay", () => {
      const manager = new OverlayManager({ container: container as unknown as HTMLElement });
      manager.open("non-existent");
      expect(manager.openCount).toBe(0);
      manager.dispose();
    });

    it("should not open already open overlay", () => {
      const manager = new OverlayManager({ container: container as unknown as HTMLElement });

      manager.register({
        id: "test-modal",
        type: "modal",
        element: overlayElement as unknown as HTMLElement,
      });

      manager.open("test-modal");
      manager.open("test-modal");

      expect(manager.openCount).toBe(1);
      manager.dispose();
    });

    it("should close an overlay", () => {
      const manager = new OverlayManager({ container: container as unknown as HTMLElement });

      manager.register({
        id: "test-modal",
        type: "modal",
        element: overlayElement as unknown as HTMLElement,
      });

      manager.open("test-modal");
      manager.close("test-modal");

      expect(manager.isOpen("test-modal")).toBe(false);
      expect(manager.openCount).toBe(0);
      expect(overlayElement.style.display).toBe("none");
      expect(overlayElement.getAttribute("aria-hidden")).toBe("true");
      manager.dispose();
    });

    it("should close overlay on unregister", () => {
      const manager = new OverlayManager({ container: container as unknown as HTMLElement });

      manager.register({
        id: "test-modal",
        type: "modal",
        element: overlayElement as unknown as HTMLElement,
      });

      manager.open("test-modal");
      manager.unregister("test-modal");

      expect(manager.openCount).toBe(0);
      manager.dispose();
    });
  });

  describe("stacking", () => {
    it("should stack overlays correctly", () => {
      const manager = new OverlayManager({
        container: container as unknown as HTMLElement,
        baseZIndex: 1000,
      });

      const element1 = createMockOverlayElement();
      const element2 = createMockOverlayElement();
      container.appendChild(element1);
      container.appendChild(element2);

      manager.register({
        id: "modal1",
        type: "modal",
        element: element1 as unknown as HTMLElement,
        backdrop: false, // Disable backdrop to simplify
      });
      manager.register({
        id: "modal2",
        type: "modal",
        element: element2 as unknown as HTMLElement,
        backdrop: false,
      });

      manager.open("modal1");
      manager.open("modal2");

      expect(manager.openOverlays).toEqual(["modal1", "modal2"]);
      expect(manager.topOverlay).toBe("modal2");
      // Both should have z-index set
      expect(element1.style.zIndex).toBe("1000");
      expect(element2.style.zIndex).toBe("1010");
      manager.dispose();
    });

    it("should return null for topOverlay when no overlays are open", () => {
      const manager = new OverlayManager({ container: container as unknown as HTMLElement });
      expect(manager.topOverlay).toBeNull();
      manager.dispose();
    });

    it("should closeTop correctly", () => {
      const manager = new OverlayManager({ container: container as unknown as HTMLElement });

      const element1 = createMockOverlayElement();
      const element2 = createMockOverlayElement();
      container.appendChild(element1);
      container.appendChild(element2);

      manager.register({
        id: "modal1",
        type: "modal",
        element: element1 as unknown as HTMLElement,
        backdrop: false,
      });
      manager.register({
        id: "modal2",
        type: "modal",
        element: element2 as unknown as HTMLElement,
        backdrop: false,
      });

      manager.open("modal1");
      manager.open("modal2");

      const closedId = manager.closeTop();
      expect(closedId).toBe("modal2");
      expect(manager.openCount).toBe(1);
      expect(manager.topOverlay).toBe("modal1");
      manager.dispose();
    });

    it("should closeAll correctly", () => {
      const manager = new OverlayManager({ container: container as unknown as HTMLElement });

      const element1 = createMockOverlayElement();
      const element2 = createMockOverlayElement();
      container.appendChild(element1);
      container.appendChild(element2);

      manager.register({
        id: "modal1",
        type: "modal",
        element: element1 as unknown as HTMLElement,
        backdrop: false,
      });
      manager.register({
        id: "modal2",
        type: "modal",
        element: element2 as unknown as HTMLElement,
        backdrop: false,
      });

      manager.open("modal1");
      manager.open("modal2");
      manager.closeAll();

      expect(manager.openCount).toBe(0);
      expect(manager.hasOpenOverlays).toBe(false);
      manager.dispose();
    });
  });

  describe("toggle", () => {
    it("should toggle overlay open/closed", () => {
      const manager = new OverlayManager({ container: container as unknown as HTMLElement });

      manager.register({
        id: "test-modal",
        type: "modal",
        element: overlayElement as unknown as HTMLElement,
      });

      expect(manager.toggle("test-modal")).toBe(true);
      expect(manager.isOpen("test-modal")).toBe(true);

      expect(manager.toggle("test-modal")).toBe(false);
      expect(manager.isOpen("test-modal")).toBe(false);
      manager.dispose();
    });

    it("should return false for unregistered overlay", () => {
      const manager = new OverlayManager({ container: container as unknown as HTMLElement });
      expect(manager.toggle("non-existent")).toBe(false);
      manager.dispose();
    });
  });

  describe("backdrop", () => {
    it("should create backdrop for modal by default", () => {
      const manager = new OverlayManager({
        container: container as unknown as HTMLElement,
        backdropClass: "test-backdrop",
      });

      manager.register({
        id: "test-modal",
        type: "modal",
        element: overlayElement as unknown as HTMLElement,
      });

      manager.open("test-modal");

      const backdrop = container.querySelector<MockElement>(".test-backdrop");
      expect(backdrop).not.toBeNull();
      manager.dispose();
    });

    it("should not create backdrop when backdrop: false", () => {
      const manager = new OverlayManager({
        container: container as unknown as HTMLElement,
        backdropClass: "test-backdrop",
      });

      manager.register({
        id: "test-popup",
        type: "popup",
        element: overlayElement as unknown as HTMLElement,
        backdrop: false,
      });

      manager.open("test-popup");

      const backdrop = container.querySelector<MockElement>(".test-backdrop");
      expect(backdrop).toBeNull();
      manager.dispose();
    });

    it("should not create backdrop for popup by default", () => {
      const manager = new OverlayManager({
        container: container as unknown as HTMLElement,
        backdropClass: "test-backdrop",
      });

      manager.register({
        id: "test-popup",
        type: "popup",
        element: overlayElement as unknown as HTMLElement,
      });

      manager.open("test-popup");

      const backdrop = container.querySelector<MockElement>(".test-backdrop");
      expect(backdrop).toBeNull();
      manager.dispose();
    });

    it("should remove backdrop on close", () => {
      const manager = new OverlayManager({
        container: container as unknown as HTMLElement,
        backdropClass: "test-backdrop",
      });

      manager.register({
        id: "test-modal",
        type: "modal",
        element: overlayElement as unknown as HTMLElement,
      });

      manager.open("test-modal");
      manager.close("test-modal");

      const backdrop = container.querySelector<MockElement>(".test-backdrop");
      expect(backdrop).toBeNull();
      manager.dispose();
    });

    it("should close overlay when backdrop is clicked", () => {
      const manager = new OverlayManager({
        container: container as unknown as HTMLElement,
        backdropClass: "test-backdrop",
      });

      manager.register({
        id: "test-modal",
        type: "modal",
        element: overlayElement as unknown as HTMLElement,
        closeOnBackdropClick: true,
      });

      manager.open("test-modal");

      const backdrop = container.querySelector<MockElement>(".test-backdrop")!;
      backdrop.click();

      expect(manager.isOpen("test-modal")).toBe(false);
      manager.dispose();
    });

    it("should not close overlay when closeOnBackdropClick is false", () => {
      const manager = new OverlayManager({
        container: container as unknown as HTMLElement,
        backdropClass: "test-backdrop",
      });

      manager.register({
        id: "test-modal",
        type: "modal",
        element: overlayElement as unknown as HTMLElement,
        closeOnBackdropClick: false,
      });

      manager.open("test-modal");

      const backdrop = container.querySelector<MockElement>(".test-backdrop")!;
      backdrop.click();

      expect(manager.isOpen("test-modal")).toBe(true);
      manager.dispose();
    });
  });

  describe("escape key handling", () => {
    it("should close overlay on Escape key", () => {
      const manager = new OverlayManager({ container: container as unknown as HTMLElement });

      manager.register({
        id: "test-modal",
        type: "modal",
        element: overlayElement as unknown as HTMLElement,
        closeOnEscape: true,
      });

      manager.open("test-modal");

      mockDocument.dispatchKeydown("Escape");

      expect(manager.isOpen("test-modal")).toBe(false);
      manager.dispose();
    });

    it("should not close overlay when closeOnEscape is false", () => {
      const manager = new OverlayManager({ container: container as unknown as HTMLElement });

      manager.register({
        id: "test-modal",
        type: "modal",
        element: overlayElement as unknown as HTMLElement,
        closeOnEscape: false,
      });

      manager.open("test-modal");

      mockDocument.dispatchKeydown("Escape");

      expect(manager.isOpen("test-modal")).toBe(true);
      manager.dispose();
    });

    it("should close only top overlay on Escape", () => {
      const manager = new OverlayManager({ container: container as unknown as HTMLElement });

      const element1 = createMockOverlayElement();
      const element2 = createMockOverlayElement();
      container.appendChild(element1);
      container.appendChild(element2);

      manager.register({
        id: "modal1",
        type: "modal",
        element: element1 as unknown as HTMLElement,
        backdrop: false,
      });
      manager.register({
        id: "modal2",
        type: "modal",
        element: element2 as unknown as HTMLElement,
        backdrop: false,
      });

      manager.open("modal1");
      manager.open("modal2");

      mockDocument.dispatchKeydown("Escape");

      expect(manager.isOpen("modal2")).toBe(false);
      expect(manager.isOpen("modal1")).toBe(true);
      manager.dispose();
    });
  });

  describe("focus management", () => {
    it("should focus first focusable element on open", () => {
      const manager = new OverlayManager({ container: container as unknown as HTMLElement });

      const button = overlayElement.children[0];

      manager.register({
        id: "test-modal",
        type: "modal",
        element: overlayElement as unknown as HTMLElement,
        trapFocus: true,
      });

      manager.open("test-modal");

      expect(mockDocument.activeElement).toBe(button);
      manager.dispose();
    });

    it("should return focus on close", () => {
      const manager = new OverlayManager({ container: container as unknown as HTMLElement });

      const triggerButton = new MockElement("BUTTON");
      container.appendChild(triggerButton);
      triggerButton.focus();

      manager.register({
        id: "test-modal",
        type: "modal",
        element: overlayElement as unknown as HTMLElement,
        trapFocus: true,
        backdrop: false,
      });

      manager.open("test-modal");
      manager.close("test-modal");

      expect(mockDocument.activeElement).toBe(triggerButton);
      manager.dispose();
    });

    it("should return focus to specified element", () => {
      const manager = new OverlayManager({ container: container as unknown as HTMLElement });

      const returnTarget = new MockElement("BUTTON");
      container.appendChild(returnTarget);

      manager.register({
        id: "test-modal",
        type: "modal",
        element: overlayElement as unknown as HTMLElement,
        returnFocusTo: returnTarget as unknown as HTMLElement,
        backdrop: false,
      });

      manager.open("test-modal");
      manager.close("test-modal");

      expect(mockDocument.activeElement).toBe(returnTarget);
      manager.dispose();
    });
  });

  describe("callbacks", () => {
    it("should call onOpen callback", () => {
      const manager = new OverlayManager({ container: container as unknown as HTMLElement });
      const onOpen = vi.fn();

      manager.register({
        id: "test-modal",
        type: "modal",
        element: overlayElement as unknown as HTMLElement,
        onOpen,
      });

      manager.open("test-modal");

      expect(onOpen).toHaveBeenCalledTimes(1);
      manager.dispose();
    });

    it("should call onClose callback", () => {
      const manager = new OverlayManager({ container: container as unknown as HTMLElement });
      const onClose = vi.fn();

      manager.register({
        id: "test-modal",
        type: "modal",
        element: overlayElement as unknown as HTMLElement,
        onClose,
      });

      manager.open("test-modal");
      manager.close("test-modal");

      expect(onClose).toHaveBeenCalledTimes(1);
      manager.dispose();
    });
  });

  describe("events", () => {
    it("should emit open event", () => {
      const manager = new OverlayManager({ container: container as unknown as HTMLElement });
      const listener = vi.fn();

      manager.addEventListener("open", listener);

      manager.register({
        id: "test-modal",
        type: "modal",
        element: overlayElement as unknown as HTMLElement,
      });

      manager.open("test-modal");

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0] as OverlayEvent;
      expect(event.type).toBe("open");
      expect(event.overlayId).toBe("test-modal");
      manager.dispose();
    });

    it("should emit close event", () => {
      const manager = new OverlayManager({ container: container as unknown as HTMLElement });
      const listener = vi.fn();

      manager.addEventListener("close", listener);

      manager.register({
        id: "test-modal",
        type: "modal",
        element: overlayElement as unknown as HTMLElement,
      });

      manager.open("test-modal");
      manager.close("test-modal");

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0] as OverlayEvent;
      expect(event.type).toBe("close");
      expect(event.overlayId).toBe("test-modal");
      manager.dispose();
    });

    it("should emit stackChange event on open/close", () => {
      const manager = new OverlayManager({ container: container as unknown as HTMLElement });
      const listener = vi.fn();

      manager.addEventListener("stackChange", listener);

      manager.register({
        id: "test-modal",
        type: "modal",
        element: overlayElement as unknown as HTMLElement,
      });

      manager.open("test-modal");
      manager.close("test-modal");

      expect(listener).toHaveBeenCalledTimes(2);

      const openEvent = listener.mock.calls[0][0] as OverlayEvent;
      expect(openEvent.stack).toEqual(["test-modal"]);

      const closeEvent = listener.mock.calls[1][0] as OverlayEvent;
      expect(closeEvent.stack).toEqual([]);
      manager.dispose();
    });

    it("should add and remove event listeners", () => {
      const manager = new OverlayManager({ container: container as unknown as HTMLElement });
      const listener = vi.fn();

      manager.addEventListener("open", listener);

      manager.register({
        id: "test-modal",
        type: "modal",
        element: overlayElement as unknown as HTMLElement,
        backdrop: false,
      });

      manager.open("test-modal");
      expect(listener).toHaveBeenCalledTimes(1);

      manager.close("test-modal");
      manager.removeEventListener("open", listener);

      manager.open("test-modal");
      expect(listener).toHaveBeenCalledTimes(1);
      manager.dispose();
    });
  });

  describe("dispose", () => {
    it("should close all overlays on dispose", () => {
      const manager = new OverlayManager({ container: container as unknown as HTMLElement });

      manager.register({
        id: "test-modal",
        type: "modal",
        element: overlayElement as unknown as HTMLElement,
      });

      manager.open("test-modal");
      manager.dispose();

      expect(overlayElement.style.display).toBe("none");
    });

    it("should not crash on double dispose", () => {
      const manager = new OverlayManager({ container: container as unknown as HTMLElement });
      manager.dispose();
      expect(() => manager.dispose()).not.toThrow();
    });

    it("should ignore operations after dispose", () => {
      const manager = new OverlayManager({ container: container as unknown as HTMLElement });
      manager.dispose();

      manager.register({
        id: "test-modal",
        type: "modal",
        element: overlayElement as unknown as HTMLElement,
      });

      expect(manager.registeredCount).toBe(0);
    });
  });

  describe("custom z-index", () => {
    it("should use custom z-index when provided", () => {
      const manager = new OverlayManager({
        container: container as unknown as HTMLElement,
        baseZIndex: 1000,
      });

      manager.register({
        id: "test-modal",
        type: "modal",
        element: overlayElement as unknown as HTMLElement,
        zIndex: 5000,
      });

      manager.open("test-modal");

      expect(overlayElement.style.zIndex).toBe("5000");
      manager.dispose();
    });
  });

  describe("overlay types defaults", () => {
    it("should set backdrop true for dialog type by default", () => {
      const manager = new OverlayManager({
        container: container as unknown as HTMLElement,
        backdropClass: "test-backdrop",
      });

      manager.register({
        id: "test-dialog",
        type: "dialog",
        element: overlayElement as unknown as HTMLElement,
      });

      manager.open("test-dialog");

      const backdrop = container.querySelector<MockElement>(".test-backdrop");
      expect(backdrop).not.toBeNull();
      manager.dispose();
    });

    it("should set trapFocus true for modal type by default", () => {
      const manager = new OverlayManager({ container: container as unknown as HTMLElement });

      const button = overlayElement.children[0];

      manager.register({
        id: "test-modal",
        type: "modal",
        element: overlayElement as unknown as HTMLElement,
      });

      manager.open("test-modal");

      // Focus should have been trapped to the first focusable element
      expect(mockDocument.activeElement).toBe(button);
      manager.dispose();
    });
  });
});
