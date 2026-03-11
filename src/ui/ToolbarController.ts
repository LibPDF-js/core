/**
 * ToolbarController manages the PDF viewer toolbar interactions.
 *
 * Handles standard PDF viewer controls including zoom, page navigation,
 * print, download, and other toolbar actions. Integrates with UIStateManager
 * for state management and can coordinate with rendering systems.
 */

import type { UIStateManager } from "./UIStateManager";

/**
 * Toolbar button identifiers.
 */
export type ToolbarButtonId =
  | "zoom-in"
  | "zoom-out"
  | "zoom-reset"
  | "fit-width"
  | "fit-page"
  | "prev-page"
  | "next-page"
  | "first-page"
  | "last-page"
  | "print"
  | "download"
  | "toggle-sidebar"
  | "toggle-search"
  | "toggle-fullscreen"
  | "rotate-cw"
  | "rotate-ccw";

/**
 * Event types emitted by ToolbarController.
 */
export type ToolbarEventType = "action" | "print" | "download" | "rotate";

/**
 * Event data for ToolbarController events.
 */
export interface ToolbarEvent {
  /**
   * Event type.
   */
  type: ToolbarEventType;

  /**
   * Button that triggered the event.
   */
  buttonId: ToolbarButtonId | string;

  /**
   * Additional data for the event.
   */
  data?: {
    /**
     * Rotation direction for rotate events.
     */
    direction?: "cw" | "ccw";

    /**
     * Current rotation angle after rotation.
     */
    rotation?: number;
  };
}

/**
 * Listener function for ToolbarController events.
 */
export type ToolbarEventListener = (event: ToolbarEvent) => void;

/**
 * Options for configuring the ToolbarController.
 */
export interface ToolbarControllerOptions {
  /**
   * UIStateManager instance for state coordination.
   */
  stateManager: UIStateManager;

  /**
   * Container element for the toolbar.
   * If not provided, toolbar must be manually bound with bindElement().
   */
  container?: HTMLElement;

  /**
   * Custom button selectors mapping button IDs to CSS selectors.
   */
  buttonSelectors?: Partial<Record<ToolbarButtonId, string>>;

  /**
   * Selector for the page input field.
   * @default '[data-toolbar-page-input]'
   */
  pageInputSelector?: string;

  /**
   * Selector for the zoom input/select field.
   * @default '[data-toolbar-zoom-input]'
   */
  zoomInputSelector?: string;

  /**
   * Function to calculate zoom for fit-width mode.
   */
  calculateFitWidthZoom?: () => number;

  /**
   * Function to calculate zoom for fit-page mode.
   */
  calculateFitPageZoom?: () => number;

  /**
   * Function to handle print action.
   */
  onPrint?: () => void | Promise<void>;

  /**
   * Function to handle download action.
   */
  onDownload?: () => void | Promise<void>;
}

/**
 * Default button selectors using data attributes.
 */
const DEFAULT_BUTTON_SELECTORS: Record<ToolbarButtonId, string> = {
  "zoom-in": '[data-toolbar-action="zoom-in"]',
  "zoom-out": '[data-toolbar-action="zoom-out"]',
  "zoom-reset": '[data-toolbar-action="zoom-reset"]',
  "fit-width": '[data-toolbar-action="fit-width"]',
  "fit-page": '[data-toolbar-action="fit-page"]',
  "prev-page": '[data-toolbar-action="prev-page"]',
  "next-page": '[data-toolbar-action="next-page"]',
  "first-page": '[data-toolbar-action="first-page"]',
  "last-page": '[data-toolbar-action="last-page"]',
  print: '[data-toolbar-action="print"]',
  download: '[data-toolbar-action="download"]',
  "toggle-sidebar": '[data-toolbar-action="toggle-sidebar"]',
  "toggle-search": '[data-toolbar-action="toggle-search"]',
  "toggle-fullscreen": '[data-toolbar-action="toggle-fullscreen"]',
  "rotate-cw": '[data-toolbar-action="rotate-cw"]',
  "rotate-ccw": '[data-toolbar-action="rotate-ccw"]',
};

/**
 * ToolbarController manages toolbar interactions for a PDF viewer.
 *
 * It binds to DOM elements (buttons, inputs) and coordinates with the
 * UIStateManager to handle zoom, navigation, and other toolbar actions.
 * Custom actions like print and download can be handled via callbacks
 * or events.
 *
 * @example
 * ```ts
 * const stateManager = new UIStateManager();
 * const toolbar = new ToolbarController({
 *   stateManager,
 *   container: document.querySelector('.pdf-toolbar'),
 *   onPrint: () => window.print(),
 *   onDownload: () => downloadPDF(),
 * });
 *
 * // Listen for toolbar events
 * toolbar.addEventListener('action', (event) => {
 *   console.log('Toolbar action:', event.buttonId);
 * });
 *
 * // Programmatically trigger actions
 * toolbar.executeAction('zoom-in');
 *
 * // Update button states
 * toolbar.updateButtonStates();
 * ```
 */
export class ToolbarController {
  private _stateManager: UIStateManager;
  private _container: HTMLElement | null = null;
  private _options: Required<
    Omit<
      ToolbarControllerOptions,
      | "container"
      | "stateManager"
      | "calculateFitWidthZoom"
      | "calculateFitPageZoom"
      | "onPrint"
      | "onDownload"
    >
  > & {
    calculateFitWidthZoom: (() => number) | null;
    calculateFitPageZoom: (() => number) | null;
    onPrint: (() => void | Promise<void>) | null;
    onDownload: (() => void | Promise<void>) | null;
  };
  private _listeners: Map<ToolbarEventType, Set<ToolbarEventListener>> = new Map();
  private _boundElements: Map<string, HTMLElement> = new Map();
  private _eventCleanup: Array<() => void> = [];
  private _rotation = 0;
  private _disposed = false;

  constructor(options: ToolbarControllerOptions) {
    this._stateManager = options.stateManager;
    this._options = {
      buttonSelectors: { ...DEFAULT_BUTTON_SELECTORS, ...options.buttonSelectors },
      pageInputSelector: options.pageInputSelector ?? "[data-toolbar-page-input]",
      zoomInputSelector: options.zoomInputSelector ?? "[data-toolbar-zoom-input]",
      calculateFitWidthZoom: options.calculateFitWidthZoom ?? null,
      calculateFitPageZoom: options.calculateFitPageZoom ?? null,
      onPrint: options.onPrint ?? null,
      onDownload: options.onDownload ?? null,
    };

    // Bind to container if provided
    if (options.container) {
      this.bindElement(options.container);
    }

    // Listen to state changes
    this._stateManager.addEventListener("stateChange", this.handleStateChange);
  }

  // ============================================================================
  // Property Getters
  // ============================================================================

  /**
   * The bound container element.
   */
  get container(): HTMLElement | null {
    return this._container;
  }

  /**
   * Current rotation angle in degrees (0, 90, 180, 270).
   */
  get rotation(): number {
    return this._rotation;
  }

  /**
   * The associated UIStateManager.
   */
  get stateManager(): UIStateManager {
    return this._stateManager;
  }

  // ============================================================================
  // Element Binding
  // ============================================================================

  /**
   * Bind the toolbar to a container element.
   * This will find all toolbar buttons and inputs within the container.
   *
   * @param container - Container element
   */
  bindElement(container: HTMLElement): void {
    if (this._disposed) {
      return;
    }

    // Unbind previous container
    this.unbindElement();

    this._container = container;

    // Bind buttons
    for (const [buttonId, selector] of Object.entries(this._options.buttonSelectors)) {
      const element = container.querySelector<HTMLElement>(selector);
      if (element) {
        this.bindButton(buttonId as ToolbarButtonId, element);
      }
    }

    // Bind page input
    const pageInput = container.querySelector<HTMLInputElement>(this._options.pageInputSelector);
    if (pageInput) {
      this.bindPageInput(pageInput);
    }

    // Bind zoom input
    const zoomInput = container.querySelector<HTMLInputElement | HTMLSelectElement>(
      this._options.zoomInputSelector,
    );
    if (zoomInput) {
      this.bindZoomInput(zoomInput);
    }

    // Initial state update
    this.updateButtonStates();
    this.updateInputValues();
  }

  /**
   * Unbind the toolbar from its container.
   */
  unbindElement(): void {
    // Clean up event listeners
    for (const cleanup of this._eventCleanup) {
      cleanup();
    }
    this._eventCleanup = [];
    this._boundElements.clear();
    this._container = null;
  }

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * Execute a toolbar action programmatically.
   *
   * @param buttonId - The action to execute
   */
  executeAction(buttonId: ToolbarButtonId | string): void {
    if (this._disposed) {
      return;
    }

    switch (buttonId) {
      case "zoom-in":
        this._stateManager.zoomIn();
        break;

      case "zoom-out":
        this._stateManager.zoomOut();
        break;

      case "zoom-reset":
        this._stateManager.resetZoom();
        break;

      case "fit-width":
        if (this._options.calculateFitWidthZoom) {
          const zoom = this._options.calculateFitWidthZoom();
          this._stateManager.fitWidth(zoom);
        }
        break;

      case "fit-page":
        if (this._options.calculateFitPageZoom) {
          const zoom = this._options.calculateFitPageZoom();
          this._stateManager.fitPage(zoom);
        }
        break;

      case "prev-page":
        this._stateManager.previousPage();
        break;

      case "next-page":
        this._stateManager.nextPage();
        break;

      case "first-page":
        this._stateManager.firstPage();
        break;

      case "last-page":
        this._stateManager.lastPage();
        break;

      case "print":
        this.handlePrint();
        break;

      case "download":
        this.handleDownload();
        break;

      case "toggle-sidebar":
        this._stateManager.toggleSidebar();
        break;

      case "toggle-search":
        this._stateManager.toggleSearchPanel();
        break;

      case "toggle-fullscreen":
        this._stateManager.toggleFullscreen();
        break;

      case "rotate-cw":
        this.rotate("cw");
        break;

      case "rotate-ccw":
        this.rotate("ccw");
        break;
    }

    // Emit action event
    this.emitEvent({
      type: "action",
      buttonId,
    });
  }

  /**
   * Rotate the document.
   *
   * @param direction - Rotation direction ('cw' for clockwise, 'ccw' for counter-clockwise)
   */
  rotate(direction: "cw" | "ccw"): void {
    if (this._disposed) {
      return;
    }

    const delta = direction === "cw" ? 90 : -90;
    this._rotation = (this._rotation + delta + 360) % 360;

    this.emitEvent({
      type: "rotate",
      buttonId: direction === "cw" ? "rotate-cw" : "rotate-ccw",
      data: {
        direction,
        rotation: this._rotation,
      },
    });
  }

  /**
   * Set the rotation angle directly.
   *
   * @param angle - Rotation angle in degrees (will be normalized to 0, 90, 180, 270)
   */
  setRotation(angle: number): void {
    this._rotation = (((Math.round(angle / 90) * 90) % 360) + 360) % 360;
  }

  /**
   * Go to a specific page.
   *
   * @param pageNumber - Page number (1-based for user-facing value)
   */
  goToPage(pageNumber: number): void {
    this._stateManager.setCurrentPage(pageNumber - 1);
  }

  /**
   * Set the zoom level.
   *
   * @param zoom - Zoom level (1 = 100%)
   */
  setZoom(zoom: number): void {
    this._stateManager.setZoom(zoom);
  }

  // ============================================================================
  // State Updates
  // ============================================================================

  /**
   * Update button disabled states based on current UI state.
   */
  updateButtonStates(): void {
    if (!this._container || this._disposed) {
      return;
    }

    const state = this._stateManager.state;

    // Page navigation buttons
    this.setButtonDisabled("prev-page", state.currentPage <= 0);
    this.setButtonDisabled("first-page", state.currentPage <= 0);
    this.setButtonDisabled("next-page", state.currentPage >= state.totalPages - 1);
    this.setButtonDisabled("last-page", state.currentPage >= state.totalPages - 1);

    // Zoom buttons
    this.setButtonDisabled("zoom-in", state.zoom >= this._stateManager.maxZoom);
    this.setButtonDisabled("zoom-out", state.zoom <= this._stateManager.minZoom);

    // Toggle buttons - update active state
    this.setButtonActive("toggle-sidebar", state.sidebarVisible);
    this.setButtonActive("toggle-search", state.searchPanelVisible);
    this.setButtonActive("toggle-fullscreen", state.fullscreen);
  }

  /**
   * Update input field values based on current UI state.
   */
  updateInputValues(): void {
    if (!this._container || this._disposed) {
      return;
    }

    const state = this._stateManager.state;

    // Update page input
    const pageInput = this._container.querySelector<HTMLInputElement>(
      this._options.pageInputSelector,
    );
    if (pageInput) {
      pageInput.value = String(state.currentPage + 1);
      pageInput.max = String(state.totalPages);
    }

    // Update zoom input
    const zoomInput = this._container.querySelector<HTMLInputElement | HTMLSelectElement>(
      this._options.zoomInputSelector,
    );
    if (zoomInput) {
      const zoomPercent = Math.round(state.zoom * 100);
      if (zoomInput.tagName === "SELECT") {
        // Try to find a matching option
        const option = zoomInput.querySelector<HTMLOptionElement>(`option[value="${zoomPercent}"]`);
        if (option) {
          zoomInput.value = String(zoomPercent);
        }
      } else {
        zoomInput.value = String(zoomPercent);
      }
    }
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  /**
   * Add an event listener.
   *
   * @param type - Event type to listen for
   * @param listener - Callback function
   */
  addEventListener(type: ToolbarEventType, listener: ToolbarEventListener): void {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, new Set());
    }
    this._listeners.get(type)!.add(listener);
  }

  /**
   * Remove an event listener.
   *
   * @param type - Event type
   * @param listener - Callback function to remove
   */
  removeEventListener(type: ToolbarEventType, listener: ToolbarEventListener): void {
    this._listeners.get(type)?.delete(listener);
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Dispose of the toolbar controller and clean up resources.
   */
  dispose(): void {
    if (this._disposed) {
      return;
    }

    this._disposed = true;

    // Unbind from container
    this.unbindElement();

    // Remove state listener
    this._stateManager.removeEventListener("stateChange", this.handleStateChange);

    // Clear listeners
    this._listeners.clear();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Bind a button element to an action.
   */
  private bindButton(buttonId: ToolbarButtonId, element: HTMLElement): void {
    const handler = (event: Event) => {
      event.preventDefault();
      this.executeAction(buttonId);
    };

    element.addEventListener("click", handler);
    this._boundElements.set(buttonId, element);
    this._eventCleanup.push(() => element.removeEventListener("click", handler));
  }

  /**
   * Bind a page input field.
   */
  private bindPageInput(input: HTMLInputElement): void {
    const handler = (event: Event) => {
      const target = event.target as HTMLInputElement;
      const pageNumber = parseInt(target.value, 10);
      if (!isNaN(pageNumber)) {
        this.goToPage(pageNumber);
      }
    };

    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        handler(event);
        (event.target as HTMLInputElement).blur();
      }
    };

    input.addEventListener("change", handler);
    input.addEventListener("keydown", keyHandler);
    this._boundElements.set("page-input", input);
    this._eventCleanup.push(() => {
      input.removeEventListener("change", handler);
      input.removeEventListener("keydown", keyHandler);
    });
  }

  /**
   * Bind a zoom input field.
   */
  private bindZoomInput(input: HTMLInputElement | HTMLSelectElement): void {
    const handler = (event: Event) => {
      const target = event.target as HTMLInputElement | HTMLSelectElement;
      const value = target.value;

      // Handle special values
      if (value === "fit-width") {
        this.executeAction("fit-width");
        return;
      }
      if (value === "fit-page") {
        this.executeAction("fit-page");
        return;
      }

      // Parse percentage
      const zoomPercent = parseInt(value, 10);
      if (!isNaN(zoomPercent)) {
        this.setZoom(zoomPercent / 100);
      }
    };

    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === "Enter" && input.tagName !== "SELECT") {
        handler(event);
        (event.target as HTMLInputElement).blur();
      }
    };

    input.addEventListener("change", handler);
    if (input.tagName !== "SELECT") {
      input.addEventListener("keydown", keyHandler);
    }
    this._boundElements.set("zoom-input", input);
    this._eventCleanup.push(() => {
      input.removeEventListener("change", handler);
      if (input.tagName !== "SELECT") {
        input.removeEventListener("keydown", keyHandler);
      }
    });
  }

  /**
   * Set a button's disabled state.
   */
  private setButtonDisabled(buttonId: ToolbarButtonId, disabled: boolean): void {
    const element = this._boundElements.get(buttonId);
    if (element) {
      if (disabled) {
        element.setAttribute("disabled", "");
        element.setAttribute("aria-disabled", "true");
      } else {
        element.removeAttribute("disabled");
        element.setAttribute("aria-disabled", "false");
      }
    }
  }

  /**
   * Set a button's active state.
   */
  private setButtonActive(buttonId: ToolbarButtonId, active: boolean): void {
    const element = this._boundElements.get(buttonId);
    if (element) {
      if (active) {
        element.classList.add("active");
        element.setAttribute("aria-pressed", "true");
      } else {
        element.classList.remove("active");
        element.setAttribute("aria-pressed", "false");
      }
    }
  }

  /**
   * Handle print action.
   */
  private handlePrint(): void {
    if (this._options.onPrint) {
      void this._options.onPrint();
    }
    this.emitEvent({
      type: "print",
      buttonId: "print",
    });
  }

  /**
   * Handle download action.
   */
  private handleDownload(): void {
    if (this._options.onDownload) {
      void this._options.onDownload();
    }
    this.emitEvent({
      type: "download",
      buttonId: "download",
    });
  }

  /**
   * Handle state changes from UIStateManager.
   */
  private handleStateChange = (): void => {
    this.updateButtonStates();
    this.updateInputValues();
  };

  /**
   * Emit an event to all registered listeners.
   */
  private emitEvent(event: ToolbarEvent): void {
    const listeners = this._listeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        listener(event);
      }
    }
  }
}

/**
 * Create a new ToolbarController instance.
 */
export function createToolbarController(options: ToolbarControllerOptions): ToolbarController {
  return new ToolbarController(options);
}
