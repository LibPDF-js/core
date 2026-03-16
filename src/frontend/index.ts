/**
 * Frontend module for PDF viewing and interaction.
 *
 * This module provides browser-specific functionality for rendering,
 * text handling, and user interaction with PDF documents.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Search engine
  SearchEngine,
  createSearchEngine,
  type SearchEngineOptions,
  // State manager
  SearchStateManager,
  createSearchStateManager,
  type SearchStateManagerOptions,
  type SearchHistoryEntry,
  // Types
  type SearchResult,
  type SearchOptions,
  type SearchState,
  type SearchStatus,
  type SearchEventType,
  type SearchEvent,
  type SearchEventListener,
  type BaseSearchEvent,
  type SearchStartEvent,
  type SearchProgressEvent,
  type SearchCompleteEvent,
  type SearchErrorEvent,
  type ResultChangeEvent,
  type StateChangeEvent,
  type TextProvider,
  // Helpers
  createInitialSearchState,
  createSearchEvent,
} from "./search";

// ─────────────────────────────────────────────────────────────────────────────
// Bounding Box Visualization
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Overlay component
  BoundingBoxOverlay,
  createBoundingBoxOverlay,
  DEFAULT_BOUNDING_BOX_COLORS,
  DEFAULT_BOUNDING_BOX_BORDER_COLORS,
  // Types
  type OverlayBoundingBox,
  type BoundingBoxType,
  type BoundingBoxColors,
  type BoundingBoxVisibility,
  type BoundingBoxOverlayOptions,
  type BoundingBoxOverlayEventType,
  type BoundingBoxOverlayEvent,
  type BoundingBoxOverlayEventListener,
} from "./bounding-box-overlay";

export {
  // Controls component
  BoundingBoxControls,
  createBoundingBoxControls,
  DEFAULT_TOGGLE_CONFIGS,
  // Types
  type BoundingBoxToggleConfig,
  type BoundingBoxControlsOptions,
  type BoundingBoxControlsEventType,
  type BoundingBoxControlsEvent,
  type BoundingBoxControlsEventListener,
} from "./bounding-box-controls";
