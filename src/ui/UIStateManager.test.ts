import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type UIStateEvent, UIStateManager } from "./UIStateManager";

describe("UIStateManager", () => {
  let originalLocalStorage: Storage;
  let mockStorage: Map<string, string>;

  beforeEach(() => {
    // Mock localStorage
    mockStorage = new Map();
    originalLocalStorage = globalThis.localStorage;

    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: (key: string) => mockStorage.get(key) ?? null,
        setItem: (key: string, value: string) => mockStorage.set(key, value),
        removeItem: (key: string) => mockStorage.delete(key),
        clear: () => mockStorage.clear(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: originalLocalStorage,
      writable: true,
    });
  });

  describe("constructor", () => {
    it("should create with default state", () => {
      const manager = new UIStateManager();
      expect(manager.zoom).toBe(1);
      expect(manager.currentPage).toBe(0);
      expect(manager.totalPages).toBe(0);
      expect(manager.sidebarVisible).toBe(false);
      expect(manager.toolbarVisible).toBe(true);
    });

    it("should create with initial state", () => {
      const manager = new UIStateManager({
        initialState: {
          zoom: 1.5,
          currentPage: 5,
          sidebarVisible: true,
        },
      });

      expect(manager.zoom).toBe(1.5);
      expect(manager.currentPage).toBe(5);
      expect(manager.sidebarVisible).toBe(true);
    });

    it("should load persisted state from localStorage", () => {
      mockStorage.set(
        "pdf-viewer-state",
        JSON.stringify({
          zoom: 2,
          sidebarVisible: true,
        }),
      );

      const manager = new UIStateManager({
        persistenceKey: "pdf-viewer-state",
      });

      expect(manager.zoom).toBe(2);
      expect(manager.sidebarVisible).toBe(true);
    });

    it("should merge persisted state with initial state (initial takes precedence)", () => {
      mockStorage.set(
        "pdf-viewer-state",
        JSON.stringify({
          zoom: 2,
          sidebarVisible: true,
        }),
      );

      const manager = new UIStateManager({
        persistenceKey: "pdf-viewer-state",
        initialState: {
          zoom: 1.5,
        },
      });

      expect(manager.zoom).toBe(1.5);
      expect(manager.sidebarVisible).toBe(true);
    });
  });

  describe("state getter", () => {
    it("should return a copy of the state", () => {
      const manager = new UIStateManager();
      const state1 = manager.state;
      const state2 = manager.state;

      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2);
    });
  });

  describe("setState", () => {
    it("should update multiple properties at once", () => {
      const manager = new UIStateManager();
      manager.setState({
        zoom: 2,
        currentPage: 10,
        sidebarVisible: true,
      });

      expect(manager.zoom).toBe(2);
      expect(manager.currentPage).toBe(10);
      expect(manager.sidebarVisible).toBe(true);
    });

    it("should not emit events if no values changed", () => {
      const manager = new UIStateManager();
      const listener = vi.fn();
      manager.addEventListener("stateChange", listener);

      manager.setState({ zoom: 1 }); // Same as default

      expect(listener).not.toHaveBeenCalled();
    });

    it("should emit stateChange event with changed keys", () => {
      const manager = new UIStateManager();
      const listener = vi.fn();
      manager.addEventListener("stateChange", listener);

      manager.setState({ zoom: 2, sidebarVisible: true });

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0] as UIStateEvent;
      expect(event.type).toBe("stateChange");
      expect(event.changedKeys).toContain("zoom");
      expect(event.changedKeys).toContain("sidebarVisible");
      expect(event.previousState?.zoom).toBe(1);
      expect(event.state.zoom).toBe(2);
    });
  });

  describe("zoom operations", () => {
    it("should set zoom within bounds", () => {
      const manager = new UIStateManager({
        initialState: { zoom: 1 },
      });

      manager.setZoom(5);
      expect(manager.zoom).toBe(5);

      manager.setZoom(0.05); // Below min
      expect(manager.zoom).toBe(0.1);

      manager.setZoom(15); // Above max
      expect(manager.zoom).toBe(10);
    });

    it("should zoom in by step", () => {
      const manager = new UIStateManager({
        initialState: { zoom: 1 },
        zoomStep: 0.25,
      });

      manager.zoomIn();
      expect(manager.zoom).toBe(1.25);
    });

    it("should zoom out by step", () => {
      const manager = new UIStateManager({
        initialState: { zoom: 1 },
        zoomStep: 0.25,
      });

      manager.zoomOut();
      expect(manager.zoom).toBe(0.75);
    });

    it("should reset zoom to 100%", () => {
      const manager = new UIStateManager({
        initialState: { zoom: 2 },
      });

      manager.resetZoom();
      expect(manager.zoom).toBe(1);
    });

    it("should set fit width mode", () => {
      const manager = new UIStateManager();
      manager.fitWidth(1.5);

      expect(manager.zoom).toBe(1.5);
      expect(manager.zoomFitMode).toBe("width");
    });

    it("should set fit page mode", () => {
      const manager = new UIStateManager();
      manager.fitPage(0.8);

      expect(manager.zoom).toBe(0.8);
      expect(manager.zoomFitMode).toBe("page");
    });

    it("should emit zoomChange event", () => {
      const manager = new UIStateManager();
      const listener = vi.fn();
      manager.addEventListener("zoomChange", listener);

      manager.setZoom(2);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].type).toBe("zoomChange");
    });
  });

  describe("page navigation", () => {
    it("should set current page within bounds", () => {
      const manager = new UIStateManager({
        initialState: { totalPages: 10, currentPage: 0 },
      });

      manager.setCurrentPage(5);
      expect(manager.currentPage).toBe(5);

      manager.setCurrentPage(-1);
      expect(manager.currentPage).toBe(0);

      manager.setCurrentPage(100);
      expect(manager.currentPage).toBe(9);
    });

    it("should not change page if totalPages is 0", () => {
      const manager = new UIStateManager();
      manager.setCurrentPage(5);
      expect(manager.currentPage).toBe(0);
    });

    it("should navigate to next page", () => {
      const manager = new UIStateManager({
        initialState: { totalPages: 10, currentPage: 5 },
      });

      manager.nextPage();
      expect(manager.currentPage).toBe(6);
    });

    it("should navigate to previous page", () => {
      const manager = new UIStateManager({
        initialState: { totalPages: 10, currentPage: 5 },
      });

      manager.previousPage();
      expect(manager.currentPage).toBe(4);
    });

    it("should navigate to first page", () => {
      const manager = new UIStateManager({
        initialState: { totalPages: 10, currentPage: 5 },
      });

      manager.firstPage();
      expect(manager.currentPage).toBe(0);
    });

    it("should navigate to last page", () => {
      const manager = new UIStateManager({
        initialState: { totalPages: 10, currentPage: 0 },
      });

      manager.lastPage();
      expect(manager.currentPage).toBe(9);
    });

    it("should update totalPages and clamp currentPage", () => {
      const manager = new UIStateManager({
        initialState: { totalPages: 10, currentPage: 8 },
      });

      manager.setTotalPages(5);
      expect(manager.totalPages).toBe(5);
      expect(manager.currentPage).toBe(4);
    });

    it("should emit pageChange event", () => {
      const manager = new UIStateManager({
        initialState: { totalPages: 10 },
      });
      const listener = vi.fn();
      manager.addEventListener("pageChange", listener);

      manager.setCurrentPage(5);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].type).toBe("pageChange");
    });
  });

  describe("sidebar operations", () => {
    it("should toggle sidebar", () => {
      const manager = new UIStateManager();
      expect(manager.sidebarVisible).toBe(false);

      manager.toggleSidebar();
      expect(manager.sidebarVisible).toBe(true);

      manager.toggleSidebar();
      expect(manager.sidebarVisible).toBe(false);
    });

    it("should set sidebar visibility", () => {
      const manager = new UIStateManager();
      manager.setSidebarVisible(true);
      expect(manager.sidebarVisible).toBe(true);
    });

    it("should set sidebar tab", () => {
      const manager = new UIStateManager();
      manager.setSidebarTab("outline");
      expect(manager.sidebarTab).toBe("outline");
    });

    it("should emit sidebarToggle event", () => {
      const manager = new UIStateManager();
      const listener = vi.fn();
      manager.addEventListener("sidebarToggle", listener);

      manager.toggleSidebar();

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].type).toBe("sidebarToggle");
    });
  });

  describe("toolbar operations", () => {
    it("should toggle toolbar", () => {
      const manager = new UIStateManager();
      expect(manager.toolbarVisible).toBe(true);

      manager.toggleToolbar();
      expect(manager.toolbarVisible).toBe(false);
    });

    it("should set toolbar visibility", () => {
      const manager = new UIStateManager();
      manager.setToolbarVisible(false);
      expect(manager.toolbarVisible).toBe(false);
    });

    it("should emit toolbarToggle event", () => {
      const manager = new UIStateManager();
      const listener = vi.fn();
      manager.addEventListener("toolbarToggle", listener);

      manager.toggleToolbar();

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("search panel operations", () => {
    it("should toggle search panel", () => {
      const manager = new UIStateManager();
      expect(manager.searchPanelVisible).toBe(false);

      manager.toggleSearchPanel();
      expect(manager.searchPanelVisible).toBe(true);
    });

    it("should set search panel visibility", () => {
      const manager = new UIStateManager();
      manager.setSearchPanelVisible(true);
      expect(manager.searchPanelVisible).toBe(true);
    });

    it("should emit searchPanelToggle event", () => {
      const manager = new UIStateManager();
      const listener = vi.fn();
      manager.addEventListener("searchPanelToggle", listener);

      manager.toggleSearchPanel();

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("fullscreen operations", () => {
    it("should toggle fullscreen", () => {
      const manager = new UIStateManager();
      expect(manager.fullscreen).toBe(false);

      manager.toggleFullscreen();
      expect(manager.fullscreen).toBe(true);
    });

    it("should set fullscreen", () => {
      const manager = new UIStateManager();
      manager.setFullscreen(true);
      expect(manager.fullscreen).toBe(true);
    });

    it("should emit fullscreenToggle event", () => {
      const manager = new UIStateManager();
      const listener = vi.fn();
      manager.addEventListener("fullscreenToggle", listener);

      manager.toggleFullscreen();

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("event handling", () => {
    it("should add and remove event listeners", () => {
      const manager = new UIStateManager();
      const listener = vi.fn();

      manager.addEventListener("zoomChange", listener);
      manager.setZoom(2);
      expect(listener).toHaveBeenCalledTimes(1);

      manager.removeEventListener("zoomChange", listener);
      manager.setZoom(3);
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("persistence", () => {
    it("should persist state to localStorage", () => {
      const manager = new UIStateManager({
        persistenceKey: "test-state",
      });

      manager.setZoom(2);
      manager.toggleSidebar();

      const stored = JSON.parse(mockStorage.get("test-state") || "{}");
      expect(stored.zoom).toBe(2);
      expect(stored.sidebarVisible).toBe(true);
    });

    it("should only persist UI preferences, not document-specific state", () => {
      const manager = new UIStateManager({
        persistenceKey: "test-state",
        initialState: { totalPages: 100, currentPage: 50 },
      });

      const stored = JSON.parse(mockStorage.get("test-state") || "{}");
      expect(stored.totalPages).toBeUndefined();
      expect(stored.currentPage).toBeUndefined();
    });

    it("should clear persisted state", () => {
      mockStorage.set("test-state", JSON.stringify({ zoom: 2 }));

      const manager = new UIStateManager({
        persistenceKey: "test-state",
      });

      manager.clearPersistedState();
      expect(mockStorage.get("test-state")).toBeUndefined();
    });
  });

  describe("dispose", () => {
    it("should clear listeners on dispose", () => {
      const manager = new UIStateManager();
      const listener = vi.fn();
      manager.addEventListener("stateChange", listener);

      manager.dispose();
      manager.setZoom(2);

      expect(listener).not.toHaveBeenCalled();
    });

    it("should ignore state changes after dispose", () => {
      const manager = new UIStateManager();
      manager.dispose();

      const initialZoom = manager.zoom;
      manager.setZoom(5);

      expect(manager.zoom).toBe(initialZoom);
    });
  });
});
