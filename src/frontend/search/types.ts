/**
 * Types for the PDF search engine.
 *
 * Defines interfaces for search results, options, and state management
 * used throughout the search functionality.
 */

import type { BoundingBox } from "#src/text/types";

/**
 * A single search result with location and match information.
 */
export interface SearchResult {
  /** Page index where the match was found (0-based) */
  pageIndex: number;

  /** The matched text string */
  text: string;

  /** Character offset of the match start within the page text */
  startOffset: number;

  /** Character offset of the match end within the page text */
  endOffset: number;

  /** Bounding box of the matched text in PDF coordinates */
  bounds: BoundingBox;

  /** Individual character bounding boxes for precise highlighting */
  charBounds: BoundingBox[];

  /** Unique identifier for this result */
  resultIndex: number;
}

/**
 * Options for configuring search behavior.
 */
export interface SearchOptions {
  /**
   * Whether the search pattern is a regular expression.
   * @default false
   */
  isRegex?: boolean;

  /**
   * Whether to perform case-sensitive matching.
   * @default false
   */
  caseSensitive?: boolean;

  /**
   * Whether to match whole words only.
   * @default false
   */
  wholeWord?: boolean;

  /**
   * Page indices to search (0-based).
   * If not specified, searches all pages.
   */
  pageIndices?: number[];
}

/**
 * Status of the search operation.
 */
export type SearchStatus = "idle" | "searching" | "complete" | "error";

/**
 * Current state of the search engine.
 */
export interface SearchState {
  /** The current search query string */
  query: string;

  /** Search configuration options */
  options: SearchOptions;

  /** Array of search results */
  results: SearchResult[];

  /** Index of the currently highlighted result (-1 if none) */
  currentIndex: number;

  /** Current status of the search */
  status: SearchStatus;

  /** Error message if status is 'error' */
  errorMessage?: string;

  /** Total number of pages in the document */
  totalPages: number;

  /** Number of pages searched so far */
  pagesSearched: number;
}

/**
 * Event types emitted by the search engine.
 */
export type SearchEventType =
  | "search-start"
  | "search-progress"
  | "search-complete"
  | "search-error"
  | "result-change"
  | "state-change";

/**
 * Base event structure for search events.
 */
export interface BaseSearchEvent<T extends SearchEventType> {
  type: T;
  timestamp: number;
}

/**
 * Event emitted when a search starts.
 */
export interface SearchStartEvent extends BaseSearchEvent<"search-start"> {
  query: string;
  options: SearchOptions;
}

/**
 * Event emitted to report search progress.
 */
export interface SearchProgressEvent extends BaseSearchEvent<"search-progress"> {
  pagesSearched: number;
  totalPages: number;
  resultsFound: number;
}

/**
 * Event emitted when a search completes.
 */
export interface SearchCompleteEvent extends BaseSearchEvent<"search-complete"> {
  query: string;
  totalResults: number;
  pagesSearched: number;
}

/**
 * Event emitted when a search error occurs.
 */
export interface SearchErrorEvent extends BaseSearchEvent<"search-error"> {
  query: string;
  errorMessage: string;
}

/**
 * Event emitted when the current result changes.
 */
export interface ResultChangeEvent extends BaseSearchEvent<"result-change"> {
  previousIndex: number;
  currentIndex: number;
  result: SearchResult | null;
}

/**
 * Event emitted when the search state changes.
 */
export interface StateChangeEvent extends BaseSearchEvent<"state-change"> {
  state: SearchState;
}

/**
 * Union type of all search events.
 */
export type SearchEvent =
  | SearchStartEvent
  | SearchProgressEvent
  | SearchCompleteEvent
  | SearchErrorEvent
  | ResultChangeEvent
  | StateChangeEvent;

/**
 * Callback function for search event listeners.
 */
export type SearchEventListener<T extends SearchEvent = SearchEvent> = (event: T) => void;

/**
 * Interface for text providers that supply page text for searching.
 */
export interface TextProvider {
  /**
   * Get the total number of pages in the document.
   */
  getPageCount(): number;

  /**
   * Get the text content of a specific page.
   * @param pageIndex - The page index (0-based)
   * @returns The page text content, or null if not available
   */
  getPageText(pageIndex: number): Promise<string | null>;

  /**
   * Get character bounding boxes for a range of text on a page.
   * @param pageIndex - The page index (0-based)
   * @param startOffset - Start character offset
   * @param endOffset - End character offset
   * @returns Array of bounding boxes for each character
   */
  getCharBounds(pageIndex: number, startOffset: number, endOffset: number): Promise<BoundingBox[]>;
}

/**
 * Create an initial search state.
 */
export function createInitialSearchState(): SearchState {
  return {
    query: "",
    options: {},
    results: [],
    currentIndex: -1,
    status: "idle",
    totalPages: 0,
    pagesSearched: 0,
  };
}

/**
 * Create a search event with timestamp.
 */
export function createSearchEvent<T extends SearchEventType>(
  type: T,
  data: Omit<Extract<SearchEvent, { type: T }>, "type" | "timestamp">,
): Extract<SearchEvent, { type: T }> {
  return {
    type,
    timestamp: Date.now(),
    ...data,
  } as Extract<SearchEvent, { type: T }>;
}
