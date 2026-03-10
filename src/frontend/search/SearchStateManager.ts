/**
 * Search state management with observable pattern.
 *
 * Provides centralized state management for search functionality with
 * event emission for state changes, search progress, and result navigation.
 */

import type {
  SearchEvent,
  SearchEventListener,
  SearchEventType,
  SearchOptions,
  SearchResult,
  SearchState,
} from "./types";
import { createInitialSearchState, createSearchEvent } from "./types";

/**
 * Options for creating a SearchStateManager instance.
 */
export interface SearchStateManagerOptions {
  /**
   * Maximum number of items to keep in search history.
   * @default 10
   */
  maxHistorySize?: number;
}

/**
 * Entry in the search history.
 */
export interface SearchHistoryEntry {
  /** The search query */
  query: string;
  /** Search options used */
  options: SearchOptions;
  /** Number of results found */
  resultCount: number;
  /** Timestamp when the search was performed */
  timestamp: number;
}

/**
 * SearchStateManager provides centralized state management for search operations.
 *
 * It follows an observable pattern, allowing components to subscribe to state
 * changes and receive notifications when the search state updates. It also
 * maintains a search history for recent queries.
 *
 * @example
 * ```ts
 * const stateManager = new SearchStateManager();
 *
 * // Subscribe to state changes
 * stateManager.addEventListener("state-change", (event) => {
 *   console.log("State updated:", event.state);
 * });
 *
 * // Update search state
 * stateManager.setSearching("hello", { caseSensitive: true });
 *
 * // Add results
 * stateManager.setResults(searchResults);
 *
 * // Navigate results
 * stateManager.setCurrentIndex(0);
 * ```
 */
export class SearchStateManager {
  private _state: SearchState;
  private _listeners: Map<SearchEventType, Set<SearchEventListener>>;
  private _history: SearchHistoryEntry[];
  private readonly _maxHistorySize: number;

  constructor(options: SearchStateManagerOptions = {}) {
    this._state = createInitialSearchState();
    this._listeners = new Map();
    this._history = [];
    this._maxHistorySize = options.maxHistorySize ?? 10;
  }

  /**
   * Get the current search state.
   */
  get state(): SearchState {
    return { ...this._state };
  }

  /**
   * Get the current search query.
   */
  get query(): string {
    return this._state.query;
  }

  /**
   * Get the current search options.
   */
  get options(): SearchOptions {
    return { ...this._state.options };
  }

  /**
   * Get the current search results.
   */
  get results(): readonly SearchResult[] {
    return this._state.results;
  }

  /**
   * Get the current result index.
   */
  get currentIndex(): number {
    return this._state.currentIndex;
  }

  /**
   * Get the current result.
   */
  get currentResult(): SearchResult | null {
    const { currentIndex, results } = this._state;
    if (currentIndex >= 0 && currentIndex < results.length) {
      return results[currentIndex];
    }
    return null;
  }

  /**
   * Get the search history.
   */
  get history(): readonly SearchHistoryEntry[] {
    return this._history;
  }

  /**
   * Check if a search is in progress.
   */
  get isSearching(): boolean {
    return this._state.status === "searching";
  }

  /**
   * Check if the search has completed.
   */
  get isComplete(): boolean {
    return this._state.status === "complete";
  }

  /**
   * Check if there was a search error.
   */
  get hasError(): boolean {
    return this._state.status === "error";
  }

  /**
   * Set the state to searching.
   *
   * @param query - The search query
   * @param options - Search options
   * @param totalPages - Total number of pages to search
   */
  setSearching(query: string, options: SearchOptions, totalPages: number): void {
    const previousState = this._state;

    this._state = {
      query,
      options,
      results: [],
      currentIndex: -1,
      status: "searching",
      totalPages,
      pagesSearched: 0,
    };

    this.emit(createSearchEvent("search-start", { query, options }));
    this.emitStateChange(previousState);
  }

  /**
   * Update search progress.
   *
   * @param pagesSearched - Number of pages searched so far
   * @param results - Current results found
   */
  setProgress(pagesSearched: number, results: SearchResult[]): void {
    const previousState = this._state;

    this._state = {
      ...this._state,
      pagesSearched,
      results,
    };

    this.emit(
      createSearchEvent("search-progress", {
        pagesSearched,
        totalPages: this._state.totalPages,
        resultsFound: results.length,
      }),
    );
    this.emitStateChange(previousState);
  }

  /**
   * Set the search results and mark search as complete.
   *
   * @param results - The search results
   */
  setResults(results: SearchResult[]): void {
    const previousState = this._state;
    const previousIndex = this._state.currentIndex;

    this._state = {
      ...this._state,
      results,
      status: "complete",
      currentIndex: results.length > 0 ? 0 : -1,
      pagesSearched: this._state.totalPages,
    };

    // Add to history
    this.addToHistory({
      query: this._state.query,
      options: this._state.options,
      resultCount: results.length,
      timestamp: Date.now(),
    });

    this.emit(
      createSearchEvent("search-complete", {
        query: this._state.query,
        totalResults: results.length,
        pagesSearched: this._state.pagesSearched,
      }),
    );

    if (results.length > 0 && previousIndex !== 0) {
      this.emit(
        createSearchEvent("result-change", {
          previousIndex,
          currentIndex: 0,
          result: results[0],
        }),
      );
    }

    this.emitStateChange(previousState);
  }

  /**
   * Set an error state.
   *
   * @param errorMessage - The error message
   */
  setError(errorMessage: string): void {
    const previousState = this._state;

    this._state = {
      ...this._state,
      status: "error",
      errorMessage,
    };

    this.emit(
      createSearchEvent("search-error", {
        query: this._state.query,
        errorMessage,
      }),
    );
    this.emitStateChange(previousState);
  }

  /**
   * Set the current result index.
   *
   * @param index - The result index to set
   * @returns The result at the index, or null if invalid
   */
  setCurrentIndex(index: number): SearchResult | null {
    const { results, currentIndex: previousIndex } = this._state;

    if (index < 0 || index >= results.length) {
      return null;
    }

    if (index === previousIndex) {
      return results[index];
    }

    this._state = {
      ...this._state,
      currentIndex: index,
    };

    const result = results[index];

    this.emit(
      createSearchEvent("result-change", {
        previousIndex,
        currentIndex: index,
        result,
      }),
    );
    this.emitStateChange({ ...this._state, currentIndex: previousIndex });

    return result;
  }

  /**
   * Move to the next result with wraparound.
   *
   * @returns The next result, or null if no results
   */
  nextResult(): SearchResult | null {
    const { results, currentIndex } = this._state;

    if (results.length === 0) {
      return null;
    }

    let nextIndex: number;
    if (currentIndex < 0 || currentIndex >= results.length - 1) {
      nextIndex = 0;
    } else {
      nextIndex = currentIndex + 1;
    }

    return this.setCurrentIndex(nextIndex);
  }

  /**
   * Move to the previous result with wraparound.
   *
   * @returns The previous result, or null if no results
   */
  previousResult(): SearchResult | null {
    const { results, currentIndex } = this._state;

    if (results.length === 0) {
      return null;
    }

    let nextIndex: number;
    if (currentIndex <= 0) {
      nextIndex = results.length - 1;
    } else {
      nextIndex = currentIndex - 1;
    }

    return this.setCurrentIndex(nextIndex);
  }

  /**
   * Update the search options.
   *
   * @param options - The options to update
   */
  updateOptions(options: Partial<SearchOptions>): void {
    const previousState = this._state;

    this._state = {
      ...this._state,
      options: { ...this._state.options, ...options },
    };

    this.emitStateChange(previousState);
  }

  /**
   * Reset the state to initial values.
   */
  reset(): void {
    const previousState = this._state;
    const previousIndex = this._state.currentIndex;
    const hadResults = this._state.results.length > 0;

    this._state = createInitialSearchState();

    if (hadResults && previousIndex >= 0) {
      this.emit(
        createSearchEvent("result-change", {
          previousIndex,
          currentIndex: -1,
          result: null,
        }),
      );
    }

    this.emitStateChange(previousState);
  }

  /**
   * Clear the search history.
   */
  clearHistory(): void {
    this._history = [];
  }

  /**
   * Add an event listener.
   *
   * @param type - The event type to listen for
   * @param listener - The callback function
   */
  addEventListener<T extends SearchEventType>(type: T, listener: SearchEventListener): void {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, new Set());
    }
    this._listeners.get(type)!.add(listener);
  }

  /**
   * Remove an event listener.
   *
   * @param type - The event type
   * @param listener - The callback function to remove
   */
  removeEventListener<T extends SearchEventType>(type: T, listener: SearchEventListener): void {
    const listeners = this._listeners.get(type);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Add an entry to the search history.
   */
  private addToHistory(entry: SearchHistoryEntry): void {
    // Remove duplicate queries
    this._history = this._history.filter(h => h.query !== entry.query);

    // Add new entry at the beginning
    this._history.unshift(entry);

    // Trim to max size
    if (this._history.length > this._maxHistorySize) {
      this._history = this._history.slice(0, this._maxHistorySize);
    }
  }

  /**
   * Emit an event to all registered listeners.
   */
  private emit(event: SearchEvent): void {
    const listeners = this._listeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch {
          // Ignore listener errors
        }
      }
    }
  }

  /**
   * Emit a state change event.
   */
  private emitStateChange(_previousState: SearchState): void {
    this.emit(createSearchEvent("state-change", { state: this.state }));
  }
}

/**
 * Create a new SearchStateManager instance.
 *
 * @param options - Configuration options
 * @returns A new SearchStateManager instance
 */
export function createSearchStateManager(options?: SearchStateManagerOptions): SearchStateManager {
  return new SearchStateManager(options);
}
