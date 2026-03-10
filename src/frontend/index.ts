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
