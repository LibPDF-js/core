/**
 * Bounding box toggle controls component.
 *
 * Provides a set of toggle buttons for controlling the visibility
 * of different bounding box types (characters, words, lines, paragraphs).
 */

import type { BoundingBoxType, BoundingBoxVisibility } from "./bounding-box-overlay";

/**
 * Configuration for a single toggle button.
 */
export interface BoundingBoxToggleConfig {
  /**
   * The bounding box type this toggle controls.
   */
  type: BoundingBoxType;

  /**
   * Display label for the toggle.
   */
  label: string;

  /**
   * Color indicator to match the bounding box color.
   */
  color: string;

  /**
   * Keyboard shortcut (optional).
   */
  shortcut?: string;
}

/**
 * Default toggle configurations.
 */
export const DEFAULT_TOGGLE_CONFIGS: BoundingBoxToggleConfig[] = [
  { type: "character", label: "Characters", color: "#ef4444", shortcut: "1" },
  { type: "word", label: "Words", color: "#3b82f6", shortcut: "2" },
  { type: "line", label: "Lines", color: "#22c55e", shortcut: "3" },
  { type: "paragraph", label: "Paragraphs", color: "#a855f7", shortcut: "4" },
];

/**
 * Options for creating BoundingBoxControls.
 */
export interface BoundingBoxControlsOptions {
  /**
   * Custom toggle configurations.
   */
  toggles?: BoundingBoxToggleConfig[];

  /**
   * Initial visibility state.
   */
  initialVisibility?: BoundingBoxVisibility;

  /**
   * CSS class name for the container.
   * @default 'bounding-box-controls'
   */
  className?: string;

  /**
   * Whether to enable keyboard shortcuts.
   * @default true
   */
  enableKeyboardShortcuts?: boolean;
}

/**
 * Event types emitted by BoundingBoxControls.
 */
export type BoundingBoxControlsEventType = "toggle" | "toggleAll";

/**
 * Event data for BoundingBoxControls events.
 */
export interface BoundingBoxControlsEvent {
  type: BoundingBoxControlsEventType;
  boxType?: BoundingBoxType;
  visible?: boolean;
  visibility?: BoundingBoxVisibility;
}

/**
 * Listener function for BoundingBoxControls events.
 */
export type BoundingBoxControlsEventListener = (event: BoundingBoxControlsEvent) => void;

/**
 * UI controls for toggling bounding box visibility.
 *
 * Creates a set of styled toggle buttons that allow users to show/hide
 * different types of bounding boxes. Each button has a color indicator
 * matching the corresponding bounding box color.
 *
 * @example
 * ```ts
 * const controls = new BoundingBoxControls({
 *   enableKeyboardShortcuts: true,
 * });
 *
 * // Listen for toggle events
 * controls.addEventListener('toggle', (event) => {
 *   overlay.setVisibility(event.boxType!, event.visible!);
 * });
 *
 * // Mount to DOM
 * container.appendChild(controls.element);
 * ```
 */
export class BoundingBoxControls {
  private _element: HTMLElement;
  private _toggles: BoundingBoxToggleConfig[];
  private _visibility: BoundingBoxVisibility;
  private _toggleButtons: Map<BoundingBoxType, HTMLButtonElement> = new Map();
  private _listeners: Map<BoundingBoxControlsEventType, Set<BoundingBoxControlsEventListener>> =
    new Map();
  private _keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private _enableKeyboardShortcuts: boolean;

  constructor(options: BoundingBoxControlsOptions = {}) {
    this._toggles = options.toggles ?? DEFAULT_TOGGLE_CONFIGS;
    this._visibility = {
      character: false,
      word: false,
      line: false,
      paragraph: false,
      ...options.initialVisibility,
    };
    this._enableKeyboardShortcuts = options.enableKeyboardShortcuts ?? true;

    // Create the container element
    this._element = document.createElement("div");
    this._element.className = options.className ?? "bounding-box-controls";

    // Build the UI
    this.buildUI();

    // Set up keyboard shortcuts
    if (this._enableKeyboardShortcuts) {
      this.setupKeyboardShortcuts();
    }
  }

  /**
   * Get the root element.
   */
  get element(): HTMLElement {
    return this._element;
  }

  /**
   * Get the current visibility state.
   */
  get visibility(): BoundingBoxVisibility {
    return { ...this._visibility };
  }

  /**
   * Update the visibility state from external source.
   * This updates the button states without emitting events.
   */
  setVisibility(visibility: Partial<BoundingBoxVisibility>): void {
    for (const type of Object.keys(visibility) as BoundingBoxType[]) {
      if (visibility[type] !== undefined) {
        this._visibility[type] = visibility[type]!;
        this.updateButtonState(type);
      }
    }
  }

  /**
   * Toggle a specific bounding box type.
   */
  toggle(type: BoundingBoxType): void {
    this._visibility[type] = !this._visibility[type];
    this.updateButtonState(type);
    this.emitEvent({
      type: "toggle",
      boxType: type,
      visible: this._visibility[type],
    });
  }

  /**
   * Show all bounding box types.
   */
  showAll(): void {
    for (const type of Object.keys(this._visibility) as BoundingBoxType[]) {
      this._visibility[type] = true;
      this.updateButtonState(type);
    }
    this.emitEvent({
      type: "toggleAll",
      visibility: this.visibility,
    });
  }

  /**
   * Hide all bounding box types.
   */
  hideAll(): void {
    for (const type of Object.keys(this._visibility) as BoundingBoxType[]) {
      this._visibility[type] = false;
      this.updateButtonState(type);
    }
    this.emitEvent({
      type: "toggleAll",
      visibility: this.visibility,
    });
  }

  /**
   * Add an event listener.
   */
  addEventListener(
    type: BoundingBoxControlsEventType,
    listener: BoundingBoxControlsEventListener,
  ): void {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, new Set());
    }
    this._listeners.get(type)!.add(listener);
  }

  /**
   * Remove an event listener.
   */
  removeEventListener(
    type: BoundingBoxControlsEventType,
    listener: BoundingBoxControlsEventListener,
  ): void {
    this._listeners.get(type)?.delete(listener);
  }

  /**
   * Dispose of the controls and clean up resources.
   */
  dispose(): void {
    // Remove keyboard shortcuts
    if (this._keydownHandler) {
      document.removeEventListener("keydown", this._keydownHandler);
      this._keydownHandler = null;
    }

    // Remove from DOM
    this._element.remove();

    // Clear listeners
    this._listeners.clear();
    this._toggleButtons.clear();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private buildUI(): void {
    // Apply inline styles for the container
    this._element.style.display = "flex";
    this._element.style.flexWrap = "wrap";
    this._element.style.gap = "8px";
    this._element.style.alignItems = "center";

    // Create label
    const label = document.createElement("span");
    label.className = "bounding-box-controls-label";
    label.textContent = "Show Boxes:";
    label.style.fontSize = "12px";
    label.style.fontWeight = "500";
    label.style.color = "#555";
    label.style.marginRight = "4px";
    this._element.appendChild(label);

    // Create toggle buttons
    for (const config of this._toggles) {
      const button = this.createToggleButton(config);
      this._toggleButtons.set(config.type, button);
      this._element.appendChild(button);
    }

    // Create "Hide All" button
    const hideAllBtn = document.createElement("button");
    hideAllBtn.className = "bounding-box-btn bounding-box-btn-hide-all";
    hideAllBtn.textContent = "Hide All";
    hideAllBtn.title = "Hide all bounding boxes (0)";
    this.applyButtonStyles(hideAllBtn, false);
    hideAllBtn.style.marginLeft = "8px";
    hideAllBtn.addEventListener("click", () => this.hideAll());
    this._element.appendChild(hideAllBtn);
  }

  private createToggleButton(config: BoundingBoxToggleConfig): HTMLButtonElement {
    const button = document.createElement("button");
    button.className = `bounding-box-btn bounding-box-btn-${config.type}`;
    button.dataset.type = config.type;

    // Create color indicator
    const indicator = document.createElement("span");
    indicator.className = "bounding-box-indicator";
    indicator.style.display = "inline-block";
    indicator.style.width = "12px";
    indicator.style.height = "12px";
    indicator.style.borderRadius = "2px";
    indicator.style.backgroundColor = config.color;
    indicator.style.marginRight = "6px";
    indicator.style.border = "1px solid rgba(0,0,0,0.2)";

    // Create label
    const labelSpan = document.createElement("span");
    labelSpan.textContent = config.label;

    button.appendChild(indicator);
    button.appendChild(labelSpan);

    // Set title with shortcut
    const shortcutText = config.shortcut ? ` (${config.shortcut})` : "";
    button.title = `Toggle ${config.label.toLowerCase()}${shortcutText}`;

    // Apply styles
    this.applyButtonStyles(button, this._visibility[config.type]);

    // Add click handler
    button.addEventListener("click", () => this.toggle(config.type));

    return button;
  }

  private applyButtonStyles(button: HTMLButtonElement, active: boolean): void {
    button.style.display = "inline-flex";
    button.style.alignItems = "center";
    button.style.padding = "6px 12px";
    button.style.fontSize = "12px";
    button.style.fontWeight = "500";
    button.style.border = "1px solid";
    button.style.borderRadius = "4px";
    button.style.cursor = "pointer";
    button.style.transition = "all 0.2s";

    if (active) {
      button.style.backgroundColor = "#e0e7ff";
      button.style.borderColor = "#818cf8";
      button.style.color = "#4338ca";
    } else {
      button.style.backgroundColor = "#f9fafb";
      button.style.borderColor = "#d1d5db";
      button.style.color = "#6b7280";
    }
  }

  private updateButtonState(type: BoundingBoxType): void {
    const button = this._toggleButtons.get(type);
    if (button) {
      this.applyButtonStyles(button, this._visibility[type]);
    }
  }

  private setupKeyboardShortcuts(): void {
    this._keydownHandler = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Check for toggle shortcuts (1-4)
      for (const config of this._toggles) {
        if (config.shortcut && e.key === config.shortcut) {
          e.preventDefault();
          this.toggle(config.type);
          return;
        }
      }

      // "0" hides all
      if (e.key === "0") {
        e.preventDefault();
        this.hideAll();
      }
    };

    document.addEventListener("keydown", this._keydownHandler);
  }

  private emitEvent(event: BoundingBoxControlsEvent): void {
    const listeners = this._listeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        listener(event);
      }
    }
  }
}

/**
 * Create a new BoundingBoxControls instance.
 */
export function createBoundingBoxControls(
  options?: BoundingBoxControlsOptions,
): BoundingBoxControls {
  return new BoundingBoxControls(options);
}
