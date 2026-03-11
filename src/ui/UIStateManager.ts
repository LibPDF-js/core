/**
 * UIStateManager manages the state of UI components in the PDF viewer.
 *
 * Handles state management, event emission, and localStorage persistence
 * for toolbar state, overlay visibility, zoom settings, and page navigation.
 * This class follows the pattern established by VirtualScroller with
 * event-driven state management.
 */

/**
 * Zoom fit modes for the PDF viewer.
 */
export type ZoomFitMode = "page" | "width" | "custom";

/**
 * UI state for the PDF viewer.
 */
export interface UIState {
  /**
   * Current zoom level (1 = 100%, 2 = 200%, etc.).
   */
  zoom: number;

  /**
   * Current zoom fit mode.
   */
  zoomFitMode: ZoomFitMode;

  /**
   * Current page index (0-based).
   */
  currentPage: number;

  /**
   * Total number of pages in the document.
   */
  totalPages: number;

  /**
   * Whether the sidebar is visible.
   */
  sidebarVisible: boolean;

  /**
   * Whether the toolbar is visible.
   */
  toolbarVisible: boolean;

  /**
   * Whether the search panel is visible.
   */
  searchPanelVisible: boolean;

  /**
   * Whether fullscreen mode is active.
   */
  fullscreen: boolean;

  /**
   * Current sidebar tab (e.g., 'thumbnails', 'outline', 'attachments').
   */
  sidebarTab: string;
}

/**
 * Partial UI state for updates.
 */
export type PartialUIState = Partial<UIState>;

/**
 * Event types emitted by UIStateManager.
 */
export type UIStateEventType =
  | "stateChange"
  | "zoomChange"
  | "pageChange"
  | "sidebarToggle"
  | "toolbarToggle"
  | "searchPanelToggle"
  | "fullscreenToggle";

/**
 * Event data for UIStateManager events.
 */
export interface UIStateEvent {
  /**
   * Event type.
   */
  type: UIStateEventType;

  /**
   * Previous state (for stateChange events).
   */
  previousState?: UIState;

  /**
   * Current state.
   */
  state: UIState;

  /**
   * Changed keys (for stateChange events).
   */
  changedKeys?: Array<keyof UIState>;
}

/**
 * Listener function for UIStateManager events.
 */
export type UIStateEventListener = (event: UIStateEvent) => void;

/**
 * Options for configuring the UIStateManager.
 */
export interface UIStateManagerOptions {
  /**
   * Initial UI state.
   */
  initialState?: PartialUIState;

  /**
   * Key for localStorage persistence.
   * If not provided, state will not be persisted.
   */
  persistenceKey?: string;

  /**
   * Minimum zoom level.
   * @default 0.1
   */
  minZoom?: number;

  /**
   * Maximum zoom level.
   * @default 10
   */
  maxZoom?: number;

  /**
   * Zoom step for zoom in/out operations.
   * @default 0.1
   */
  zoomStep?: number;
}

/**
 * Default UI state values.
 */
const DEFAULT_STATE: UIState = {
  zoom: 1,
  zoomFitMode: "custom",
  currentPage: 0,
  totalPages: 0,
  sidebarVisible: false,
  toolbarVisible: true,
  searchPanelVisible: false,
  fullscreen: false,
  sidebarTab: "thumbnails",
};

/**
 * UIStateManager coordinates UI state across the PDF viewer.
 *
 * It manages zoom levels, page navigation, panel visibility, and other
 * UI-related state. State changes are emitted as events and optionally
 * persisted to localStorage for session continuity.
 *
 * @example
 * ```ts
 * const stateManager = new UIStateManager({
 *   persistenceKey: 'pdf-viewer-state',
 *   initialState: { zoom: 1.5 },
 * });
 *
 * // Listen for state changes
 * stateManager.addEventListener('zoomChange', (event) => {
 *   console.log('Zoom changed to:', event.state.zoom);
 * });
 *
 * // Update state
 * stateManager.setZoom(2);
 * stateManager.nextPage();
 * stateManager.toggleSidebar();
 * ```
 */
export class UIStateManager {
  private _state: UIState;
  private _options: Required<Omit<UIStateManagerOptions, "initialState" | "persistenceKey">> & {
    persistenceKey: string | null;
  };
  private _listeners: Map<UIStateEventType, Set<UIStateEventListener>> = new Map();
  private _disposed = false;

  constructor(options: UIStateManagerOptions = {}) {
    this._options = {
      persistenceKey: options.persistenceKey ?? null,
      minZoom: options.minZoom ?? 0.1,
      maxZoom: options.maxZoom ?? 10,
      zoomStep: options.zoomStep ?? 0.1,
    };

    // Load persisted state or use defaults
    const persistedState = this.loadPersistedState();
    this._state = {
      ...DEFAULT_STATE,
      ...persistedState,
      ...options.initialState,
    };
  }

  // ============================================================================
  // Property Getters
  // ============================================================================

  /**
   * Current UI state (read-only copy).
   */
  get state(): UIState {
    return { ...this._state };
  }

  /**
   * Current zoom level.
   */
  get zoom(): number {
    return this._state.zoom;
  }

  /**
   * Current zoom fit mode.
   */
  get zoomFitMode(): ZoomFitMode {
    return this._state.zoomFitMode;
  }

  /**
   * Current page index (0-based).
   */
  get currentPage(): number {
    return this._state.currentPage;
  }

  /**
   * Total number of pages.
   */
  get totalPages(): number {
    return this._state.totalPages;
  }

  /**
   * Whether the sidebar is visible.
   */
  get sidebarVisible(): boolean {
    return this._state.sidebarVisible;
  }

  /**
   * Whether the toolbar is visible.
   */
  get toolbarVisible(): boolean {
    return this._state.toolbarVisible;
  }

  /**
   * Whether the search panel is visible.
   */
  get searchPanelVisible(): boolean {
    return this._state.searchPanelVisible;
  }

  /**
   * Whether fullscreen mode is active.
   */
  get fullscreen(): boolean {
    return this._state.fullscreen;
  }

  /**
   * Current sidebar tab.
   */
  get sidebarTab(): string {
    return this._state.sidebarTab;
  }

  /**
   * Minimum zoom level.
   */
  get minZoom(): number {
    return this._options.minZoom;
  }

  /**
   * Maximum zoom level.
   */
  get maxZoom(): number {
    return this._options.maxZoom;
  }

  // ============================================================================
  // State Updates
  // ============================================================================

  /**
   * Update multiple state properties at once.
   *
   * @param updates - Partial state to merge
   */
  setState(updates: PartialUIState): void {
    if (this._disposed) {
      return;
    }

    const previousState = { ...this._state };
    const changedKeys: Array<keyof UIState> = [];

    for (const key of Object.keys(updates) as Array<keyof UIState>) {
      const newValue = updates[key];
      if (newValue !== undefined && this._state[key] !== newValue) {
        changedKeys.push(key);
        (this._state as Record<keyof UIState, unknown>)[key] = newValue;
      }
    }

    if (changedKeys.length === 0) {
      return;
    }

    // Persist state
    this.persistState();

    // Emit specific events based on what changed
    this.emitSpecificEvents(changedKeys, previousState);

    // Emit general state change event
    this.emitEvent({
      type: "stateChange",
      previousState,
      state: { ...this._state },
      changedKeys,
    });
  }

  /**
   * Set the zoom level.
   *
   * @param zoom - New zoom level (clamped to min/max)
   * @param fitMode - Optional fit mode ('page', 'width', or 'custom')
   */
  setZoom(zoom: number, fitMode?: ZoomFitMode): void {
    const clampedZoom = Math.max(this._options.minZoom, Math.min(this._options.maxZoom, zoom));
    this.setState({
      zoom: clampedZoom,
      zoomFitMode: fitMode ?? "custom",
    });
  }

  /**
   * Zoom in by the configured step amount.
   */
  zoomIn(): void {
    this.setZoom(this._state.zoom + this._options.zoomStep);
  }

  /**
   * Zoom out by the configured step amount.
   */
  zoomOut(): void {
    this.setZoom(this._state.zoom - this._options.zoomStep);
  }

  /**
   * Reset zoom to 100%.
   */
  resetZoom(): void {
    this.setZoom(1);
  }

  /**
   * Set zoom to fit the page width.
   *
   * @param zoom - The calculated zoom level for width fit
   */
  fitWidth(zoom: number): void {
    this.setZoom(zoom, "width");
  }

  /**
   * Set zoom to fit the entire page.
   *
   * @param zoom - The calculated zoom level for page fit
   */
  fitPage(zoom: number): void {
    this.setZoom(zoom, "page");
  }

  /**
   * Set the current page.
   *
   * @param pageIndex - Page index (0-based, clamped to valid range)
   */
  setCurrentPage(pageIndex: number): void {
    const clampedPage = Math.max(0, Math.min(this._state.totalPages - 1, pageIndex));
    if (this._state.totalPages === 0) {
      return;
    }
    this.setState({ currentPage: clampedPage });
  }

  /**
   * Go to the next page.
   */
  nextPage(): void {
    this.setCurrentPage(this._state.currentPage + 1);
  }

  /**
   * Go to the previous page.
   */
  previousPage(): void {
    this.setCurrentPage(this._state.currentPage - 1);
  }

  /**
   * Go to the first page.
   */
  firstPage(): void {
    this.setCurrentPage(0);
  }

  /**
   * Go to the last page.
   */
  lastPage(): void {
    this.setCurrentPage(this._state.totalPages - 1);
  }

  /**
   * Set the total number of pages.
   *
   * @param totalPages - Total page count
   */
  setTotalPages(totalPages: number): void {
    this.setState({ totalPages: Math.max(0, totalPages) });
    // Ensure current page is valid
    if (this._state.currentPage >= totalPages) {
      this.setCurrentPage(totalPages - 1);
    }
  }

  /**
   * Toggle sidebar visibility.
   */
  toggleSidebar(): void {
    this.setState({ sidebarVisible: !this._state.sidebarVisible });
  }

  /**
   * Set sidebar visibility.
   *
   * @param visible - Whether sidebar should be visible
   */
  setSidebarVisible(visible: boolean): void {
    this.setState({ sidebarVisible: visible });
  }

  /**
   * Set the sidebar tab.
   *
   * @param tab - Tab identifier
   */
  setSidebarTab(tab: string): void {
    this.setState({ sidebarTab: tab });
  }

  /**
   * Toggle toolbar visibility.
   */
  toggleToolbar(): void {
    this.setState({ toolbarVisible: !this._state.toolbarVisible });
  }

  /**
   * Set toolbar visibility.
   *
   * @param visible - Whether toolbar should be visible
   */
  setToolbarVisible(visible: boolean): void {
    this.setState({ toolbarVisible: visible });
  }

  /**
   * Toggle search panel visibility.
   */
  toggleSearchPanel(): void {
    this.setState({ searchPanelVisible: !this._state.searchPanelVisible });
  }

  /**
   * Set search panel visibility.
   *
   * @param visible - Whether search panel should be visible
   */
  setSearchPanelVisible(visible: boolean): void {
    this.setState({ searchPanelVisible: visible });
  }

  /**
   * Toggle fullscreen mode.
   */
  toggleFullscreen(): void {
    this.setState({ fullscreen: !this._state.fullscreen });
  }

  /**
   * Set fullscreen mode.
   *
   * @param fullscreen - Whether fullscreen should be active
   */
  setFullscreen(fullscreen: boolean): void {
    this.setState({ fullscreen });
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
  addEventListener(type: UIStateEventType, listener: UIStateEventListener): void {
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
  removeEventListener(type: UIStateEventType, listener: UIStateEventListener): void {
    this._listeners.get(type)?.delete(listener);
  }

  // ============================================================================
  // Persistence
  // ============================================================================

  /**
   * Manually persist the current state to localStorage.
   */
  persistState(): void {
    if (!this._options.persistenceKey) {
      return;
    }

    try {
      // Only persist UI preferences, not document-specific state
      const stateToPersist: Partial<UIState> = {
        zoom: this._state.zoom,
        zoomFitMode: this._state.zoomFitMode,
        sidebarVisible: this._state.sidebarVisible,
        toolbarVisible: this._state.toolbarVisible,
        sidebarTab: this._state.sidebarTab,
      };

      localStorage.setItem(this._options.persistenceKey, JSON.stringify(stateToPersist));
    } catch {
      // Silently ignore localStorage errors (quota exceeded, private mode, etc.)
    }
  }

  /**
   * Clear persisted state from localStorage.
   */
  clearPersistedState(): void {
    if (!this._options.persistenceKey) {
      return;
    }

    try {
      localStorage.removeItem(this._options.persistenceKey);
    } catch {
      // Silently ignore localStorage errors
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Dispose of the state manager and clean up resources.
   */
  dispose(): void {
    if (this._disposed) {
      return;
    }

    this._disposed = true;
    this._listeners.clear();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Load persisted state from localStorage.
   */
  private loadPersistedState(): Partial<UIState> {
    if (!this._options.persistenceKey) {
      return {};
    }

    try {
      const stored = localStorage.getItem(this._options.persistenceKey);
      if (stored) {
        return JSON.parse(stored) as Partial<UIState>;
      }
    } catch {
      // Silently ignore localStorage/parse errors
    }

    return {};
  }

  /**
   * Emit specific events based on changed keys.
   */
  private emitSpecificEvents(changedKeys: Array<keyof UIState>, previousState: UIState): void {
    for (const key of changedKeys) {
      let eventType: UIStateEventType | null = null;

      switch (key) {
        case "zoom":
        case "zoomFitMode":
          eventType = "zoomChange";
          break;
        case "currentPage":
          eventType = "pageChange";
          break;
        case "sidebarVisible":
        case "sidebarTab":
          eventType = "sidebarToggle";
          break;
        case "toolbarVisible":
          eventType = "toolbarToggle";
          break;
        case "searchPanelVisible":
          eventType = "searchPanelToggle";
          break;
        case "fullscreen":
          eventType = "fullscreenToggle";
          break;
      }

      if (eventType) {
        this.emitEvent({
          type: eventType,
          previousState,
          state: { ...this._state },
        });
      }
    }
  }

  /**
   * Emit an event to all registered listeners.
   */
  private emitEvent(event: UIStateEvent): void {
    const listeners = this._listeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        listener(event);
      }
    }
  }
}

/**
 * Create a new UIStateManager instance.
 */
export function createUIStateManager(options?: UIStateManagerOptions): UIStateManager {
  return new UIStateManager(options);
}
