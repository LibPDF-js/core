/**
 * PDF Search Engine module.
 *
 * Provides text search functionality across PDF documents with support for
 * regex patterns, case sensitivity, whole word matching, and result navigation.
 *
 * @example
 * ```ts
 * import { SearchEngine, createSearchEngine } from '@libpdf/core/frontend/search';
 *
 * const engine = createSearchEngine({
 *   textProvider: myTextProvider,
 * });
 *
 * // Listen for search events
 * engine.addEventListener("search-complete", (event) => {
 *   console.log(`Found ${event.totalResults} matches`);
 * });
 *
 * // Search the document
 * await engine.search("hello world", { caseSensitive: false });
 *
 * // Navigate through results
 * const nextResult = engine.findNext();
 * const prevResult = engine.findPrevious();
 *
 * // Clear search
 * engine.clearSearch();
 * ```
 */

// ─────────────────────────────────────────────────────────────────────────────
// Search Engine
// ─────────────────────────────────────────────────────────────────────────────

export { SearchEngine, createSearchEngine, type SearchEngineOptions } from "./SearchEngine";

// ─────────────────────────────────────────────────────────────────────────────
// State Manager
// ─────────────────────────────────────────────────────────────────────────────

export {
  SearchStateManager,
  createSearchStateManager,
  type SearchStateManagerOptions,
  type SearchHistoryEntry,
} from "./SearchStateManager";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type {
  // Core search types
  SearchResult,
  SearchOptions,
  SearchState,
  SearchStatus,
  // Event types
  SearchEventType,
  SearchEvent,
  SearchEventListener,
  BaseSearchEvent,
  SearchStartEvent,
  SearchProgressEvent,
  SearchCompleteEvent,
  SearchErrorEvent,
  ResultChangeEvent,
  StateChangeEvent,
  // Text provider
  TextProvider,
} from "./types";

export { createInitialSearchState, createSearchEvent } from "./types";
