/**
 * OverlayManager manages modal dialogs, tooltips, and popup menus.
 *
 * Handles z-index stacking, backdrop handling, escape key dismissal,
 * and focus management for overlay elements. Supports multiple overlay
 * types with proper stacking context and lifecycle management.
 */

/**
 * Overlay types supported by the manager.
 */
export type OverlayType = "modal" | "dialog" | "popup" | "tooltip" | "dropdown";

/**
 * Configuration for an overlay.
 */
export interface OverlayConfig {
  /**
   * Unique identifier for the overlay.
   */
  id: string;

  /**
   * Type of overlay.
   */
  type: OverlayType;

  /**
   * The overlay element.
   */
  element: HTMLElement;

  /**
   * Whether to show a backdrop behind the overlay.
   * @default true for modals and dialogs, false for others
   */
  backdrop?: boolean;

  /**
   * Whether clicking the backdrop closes the overlay.
   * @default true
   */
  closeOnBackdropClick?: boolean;

  /**
   * Whether pressing Escape closes the overlay.
   * @default true
   */
  closeOnEscape?: boolean;

  /**
   * Whether to trap focus within the overlay.
   * @default true for modals and dialogs
   */
  trapFocus?: boolean;

  /**
   * Element to return focus to when the overlay closes.
   */
  returnFocusTo?: HTMLElement;

  /**
   * Custom z-index for the overlay (auto-assigned if not provided).
   */
  zIndex?: number;

  /**
   * Callback when the overlay is opened.
   */
  onOpen?: () => void;

  /**
   * Callback when the overlay is closed.
   */
  onClose?: () => void;
}

/**
 * Internal overlay entry with computed properties.
 */
interface OverlayEntry {
  config: Required<OverlayConfig>;
  backdropElement: HTMLElement | null;
  previousActiveElement: Element | null;
  isOpen: boolean;
}

/**
 * Event types emitted by OverlayManager.
 */
export type OverlayEventType = "open" | "close" | "stackChange";

/**
 * Event data for OverlayManager events.
 */
export interface OverlayEvent {
  /**
   * Event type.
   */
  type: OverlayEventType;

  /**
   * Overlay ID.
   */
  overlayId: string;

  /**
   * Overlay configuration.
   */
  overlay?: OverlayConfig;

  /**
   * Current stack of open overlays (for stackChange events).
   */
  stack?: string[];
}

/**
 * Listener function for OverlayManager events.
 */
export type OverlayEventListener = (event: OverlayEvent) => void;

/**
 * Options for configuring the OverlayManager.
 */
export interface OverlayManagerOptions {
  /**
   * Base z-index for overlays.
   * @default 1000
   */
  baseZIndex?: number;

  /**
   * Z-index increment between overlays.
   * @default 10
   */
  zIndexIncrement?: number;

  /**
   * CSS class for the backdrop element.
   * @default 'overlay-backdrop'
   */
  backdropClass?: string;

  /**
   * Container element for overlays.
   * @default document.body
   */
  container?: HTMLElement;
}

/**
 * OverlayManager handles the lifecycle and stacking of overlay elements.
 *
 * It manages modal dialogs, popups, tooltips, and dropdowns with proper
 * z-index stacking, backdrop handling, keyboard navigation, and focus
 * management.
 *
 * @example
 * ```ts
 * const overlayManager = new OverlayManager({
 *   baseZIndex: 1000,
 * });
 *
 * // Register an overlay
 * overlayManager.register({
 *   id: 'settings-modal',
 *   type: 'modal',
 *   element: document.querySelector('.settings-modal'),
 *   backdrop: true,
 *   closeOnEscape: true,
 * });
 *
 * // Open the overlay
 * overlayManager.open('settings-modal');
 *
 * // Close the overlay
 * overlayManager.close('settings-modal');
 *
 * // Listen for events
 * overlayManager.addEventListener('open', (event) => {
 *   console.log('Overlay opened:', event.overlayId);
 * });
 * ```
 */
export class OverlayManager {
  private _options: Required<OverlayManagerOptions>;
  private _overlays: Map<string, OverlayEntry> = new Map();
  private _stack: string[] = [];
  private _listeners: Map<OverlayEventType, Set<OverlayEventListener>> = new Map();
  private _keydownHandler: ((event: KeyboardEvent) => void) | null = null;
  private _disposed = false;

  constructor(options: OverlayManagerOptions = {}) {
    this._options = {
      baseZIndex: options.baseZIndex ?? 1000,
      zIndexIncrement: options.zIndexIncrement ?? 10,
      backdropClass: options.backdropClass ?? "overlay-backdrop",
      container:
        options.container ?? (typeof document !== "undefined" ? document.body : (null as never)),
    };

    // Set up global keyboard handler
    this.setupKeyboardHandler();
  }

  // ============================================================================
  // Property Getters
  // ============================================================================

  /**
   * IDs of currently open overlays in stack order (bottom to top).
   */
  get openOverlays(): string[] {
    return [...this._stack];
  }

  /**
   * ID of the topmost open overlay, or null if none.
   */
  get topOverlay(): string | null {
    return this._stack.length > 0 ? this._stack[this._stack.length - 1] : null;
  }

  /**
   * Number of registered overlays.
   */
  get registeredCount(): number {
    return this._overlays.size;
  }

  /**
   * Number of open overlays.
   */
  get openCount(): number {
    return this._stack.length;
  }

  /**
   * Whether any overlay is currently open.
   */
  get hasOpenOverlays(): boolean {
    return this._stack.length > 0;
  }

  // ============================================================================
  // Registration
  // ============================================================================

  /**
   * Register an overlay with the manager.
   *
   * @param config - Overlay configuration
   */
  register(config: OverlayConfig): void {
    if (this._disposed) {
      return;
    }

    if (this._overlays.has(config.id)) {
      // Update existing overlay
      const existing = this._overlays.get(config.id)!;
      existing.config = this.normalizeConfig(config);
      return;
    }

    const entry: OverlayEntry = {
      config: this.normalizeConfig(config),
      backdropElement: null,
      previousActiveElement: null,
      isOpen: false,
    };

    this._overlays.set(config.id, entry);

    // Hide element initially
    config.element.style.display = "none";
  }

  /**
   * Unregister an overlay from the manager.
   *
   * @param id - Overlay ID
   */
  unregister(id: string): void {
    const entry = this._overlays.get(id);
    if (!entry) {
      return;
    }

    // Close if open
    if (entry.isOpen) {
      this.close(id);
    }

    this._overlays.delete(id);
  }

  /**
   * Check if an overlay is registered.
   *
   * @param id - Overlay ID
   * @returns True if registered
   */
  isRegistered(id: string): boolean {
    return this._overlays.has(id);
  }

  /**
   * Check if an overlay is open.
   *
   * @param id - Overlay ID
   * @returns True if open
   */
  isOpen(id: string): boolean {
    const entry = this._overlays.get(id);
    return entry?.isOpen ?? false;
  }

  // ============================================================================
  // Open/Close Operations
  // ============================================================================

  /**
   * Open an overlay.
   *
   * @param id - Overlay ID
   */
  open(id: string): void {
    if (this._disposed) {
      return;
    }

    const entry = this._overlays.get(id);
    if (!entry || entry.isOpen) {
      return;
    }

    entry.isOpen = true;

    // Store current active element for focus restoration
    entry.previousActiveElement = document.activeElement;

    // Calculate z-index (0 means auto-calculate)
    const zIndex = entry.config.zIndex || this.calculateZIndex();

    // Create backdrop if needed
    if (entry.config.backdrop) {
      entry.backdropElement = this.createBackdrop(id, zIndex - 1);
    }

    // Show and position overlay
    const element = entry.config.element;
    element.style.display = "";
    element.style.zIndex = String(zIndex);
    element.setAttribute("aria-hidden", "false");
    element.setAttribute("data-overlay-open", "true");

    // Add to stack
    this._stack.push(id);

    // Set up focus trap if needed
    if (entry.config.trapFocus) {
      this.setupFocusTrap(entry);
    }

    // Call callback
    entry.config.onOpen?.();

    // Emit events
    this.emitEvent({ type: "open", overlayId: id, overlay: entry.config });
    this.emitEvent({ type: "stackChange", overlayId: id, stack: [...this._stack] });
  }

  /**
   * Close an overlay.
   *
   * @param id - Overlay ID
   */
  close(id: string): void {
    const entry = this._overlays.get(id);
    if (!entry || !entry.isOpen) {
      return;
    }

    entry.isOpen = false;

    // Remove from stack
    const stackIndex = this._stack.indexOf(id);
    if (stackIndex !== -1) {
      this._stack.splice(stackIndex, 1);
    }

    // Hide overlay
    const element = entry.config.element;
    element.style.display = "none";
    element.setAttribute("aria-hidden", "true");
    element.removeAttribute("data-overlay-open");

    // Remove backdrop
    if (entry.backdropElement) {
      entry.backdropElement.remove();
      entry.backdropElement = null;
    }

    // Restore focus
    const returnTarget = entry.config.returnFocusTo ?? entry.previousActiveElement;
    if (returnTarget && typeof (returnTarget as HTMLElement).focus === "function") {
      (returnTarget as HTMLElement).focus();
    }
    entry.previousActiveElement = null;

    // Call callback
    entry.config.onClose?.();

    // Emit events
    this.emitEvent({ type: "close", overlayId: id, overlay: entry.config });
    this.emitEvent({ type: "stackChange", overlayId: id, stack: [...this._stack] });
  }

  /**
   * Close the topmost overlay.
   *
   * @returns The ID of the closed overlay, or null if none were open
   */
  closeTop(): string | null {
    const topId = this.topOverlay;
    if (topId) {
      this.close(topId);
      return topId;
    }
    return null;
  }

  /**
   * Close all open overlays.
   */
  closeAll(): void {
    // Close in reverse order (top to bottom)
    const overlaysToClose = [...this._stack].reverse();
    for (const id of overlaysToClose) {
      this.close(id);
    }
  }

  /**
   * Toggle an overlay's open state.
   *
   * @param id - Overlay ID
   * @returns True if overlay is now open, false if closed
   */
  toggle(id: string): boolean {
    const entry = this._overlays.get(id);
    if (!entry) {
      return false;
    }

    if (entry.isOpen) {
      this.close(id);
      return false;
    } else {
      this.open(id);
      return true;
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
  addEventListener(type: OverlayEventType, listener: OverlayEventListener): void {
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
  removeEventListener(type: OverlayEventType, listener: OverlayEventListener): void {
    this._listeners.get(type)?.delete(listener);
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Dispose of the overlay manager and clean up resources.
   */
  dispose(): void {
    if (this._disposed) {
      return;
    }

    this._disposed = true;

    // Close all overlays
    this.closeAll();

    // Remove keyboard handler
    if (this._keydownHandler && typeof document !== "undefined") {
      document.removeEventListener("keydown", this._keydownHandler);
      this._keydownHandler = null;
    }

    // Clear collections
    this._overlays.clear();
    this._stack = [];
    this._listeners.clear();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Normalize overlay configuration with defaults.
   */
  private normalizeConfig(config: OverlayConfig): Required<OverlayConfig> {
    const isModalType = config.type === "modal" || config.type === "dialog";

    return {
      id: config.id,
      type: config.type,
      element: config.element,
      backdrop: config.backdrop ?? isModalType,
      closeOnBackdropClick: config.closeOnBackdropClick ?? true,
      closeOnEscape: config.closeOnEscape ?? true,
      trapFocus: config.trapFocus ?? isModalType,
      returnFocusTo: config.returnFocusTo ?? (null as unknown as HTMLElement),
      zIndex: config.zIndex ?? 0,
      onOpen: config.onOpen ?? (() => {}),
      onClose: config.onClose ?? (() => {}),
    };
  }

  /**
   * Calculate z-index for the next overlay.
   */
  private calculateZIndex(): number {
    return this._options.baseZIndex + this._stack.length * this._options.zIndexIncrement;
  }

  /**
   * Create a backdrop element.
   */
  private createBackdrop(overlayId: string, zIndex: number): HTMLElement {
    const backdrop = document.createElement("div");
    backdrop.className = this._options.backdropClass;
    backdrop.setAttribute("data-overlay-backdrop", overlayId);
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      z-index: ${zIndex};
    `;

    // Handle backdrop click
    const entry = this._overlays.get(overlayId);
    if (entry?.config.closeOnBackdropClick) {
      backdrop.addEventListener("click", () => {
        this.close(overlayId);
      });
    }

    this._options.container.appendChild(backdrop);
    return backdrop;
  }

  /**
   * Set up keyboard handler for escape key.
   */
  private setupKeyboardHandler(): void {
    if (typeof document === "undefined") {
      return;
    }

    this._keydownHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && this._stack.length > 0) {
        const topId = this.topOverlay;
        if (topId) {
          const entry = this._overlays.get(topId);
          if (entry?.config.closeOnEscape) {
            event.preventDefault();
            this.close(topId);
          }
        }
      }
    };

    document.addEventListener("keydown", this._keydownHandler);
  }

  /**
   * Set up focus trap for an overlay.
   */
  private setupFocusTrap(entry: OverlayEntry): void {
    const element = entry.config.element;

    // Find focusable elements
    const focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusableElements = element.querySelectorAll<HTMLElement>(focusableSelector);

    if (focusableElements.length > 0) {
      // Focus the first focusable element
      focusableElements[0].focus();
    } else {
      // Make the overlay itself focusable
      element.setAttribute("tabindex", "-1");
      element.focus();
    }
  }

  /**
   * Emit an event to all registered listeners.
   */
  private emitEvent(event: OverlayEvent): void {
    const listeners = this._listeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        listener(event);
      }
    }
  }
}

/**
 * Create a new OverlayManager instance.
 */
export function createOverlayManager(options?: OverlayManagerOptions): OverlayManager {
  return new OverlayManager(options);
}
