/**
 * Core search engine for PDF text search.
 *
 * Provides regex-based search across all document pages with support for
 * case sensitivity, whole word matching, and find next/previous navigation.
 */

import { mergeBboxes, type BoundingBox } from "#src/text/types";

import type {
  SearchEventListener,
  SearchOptions,
  SearchResult,
  SearchState,
  TextProvider,
} from "./types";
import { createInitialSearchState, createSearchEvent } from "./types";

/**
 * Options for creating a SearchEngine instance.
 */
export interface SearchEngineOptions {
  /**
   * The text provider for accessing document text content.
   */
  textProvider: TextProvider;
}

/**
 * SearchEngine handles text search across PDF document pages.
 *
 * It performs async searches across the full document, maintains search state,
 * and provides navigation through results with wraparound support.
 *
 * @example
 * ```ts
 * const engine = new SearchEngine({
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
export class SearchEngine {
  private readonly _textProvider: TextProvider;
  private _state: SearchState;
  private _listeners: Map<string, Set<SearchEventListener>>;
  private _abortController: AbortController | null = null;

  constructor(options: SearchEngineOptions) {
    this._textProvider = options.textProvider;
    this._state = createInitialSearchState();
    this._listeners = new Map();
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
   * Get the current search results.
   */
  get results(): readonly SearchResult[] {
    return this._state.results;
  }

  /**
   * Get the total number of results.
   */
  get resultCount(): number {
    return this._state.results.length;
  }

  /**
   * Get the current result index.
   */
  get currentIndex(): number {
    return this._state.currentIndex;
  }

  /**
   * Get the current result, or null if none.
   */
  get currentResult(): SearchResult | null {
    const { currentIndex, results } = this._state;
    if (currentIndex >= 0 && currentIndex < results.length) {
      return results[currentIndex];
    }
    return null;
  }

  /**
   * Check if a search is currently in progress.
   */
  get isSearching(): boolean {
    return this._state.status === "searching";
  }

  /**
   * Search the document for the given query.
   *
   * @param query - The search query (string or regex pattern)
   * @param options - Search configuration options
   * @returns Promise that resolves when the search is complete
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    // Cancel any existing search
    this.cancelSearch();

    // Empty query clears the search
    if (!query) {
      this.clearSearch();
      return [];
    }

    // Set up new abort controller
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    // Update state
    const totalPages = this._textProvider.getPageCount();
    this._state = {
      query,
      options,
      results: [],
      currentIndex: -1,
      status: "searching",
      totalPages,
      pagesSearched: 0,
    };

    // Emit start event
    this.emit(createSearchEvent("search-start", { query, options }));
    this.emitStateChange();

    try {
      // Build the regex pattern
      const regex = this.buildRegex(query, options);

      // Determine pages to search
      const pageIndices = options.pageIndices ?? Array.from({ length: totalPages }, (_, i) => i);

      const results: SearchResult[] = [];
      let resultIndex = 0;

      // Search each page
      for (const pageIndex of pageIndices) {
        // Check for cancellation
        if (signal.aborted) {
          throw new Error("Search cancelled");
        }

        // Get page text
        const pageText = await this._textProvider.getPageText(pageIndex);
        if (pageText === null) {
          this._state.pagesSearched++;
          continue;
        }

        // Find all matches on this page
        let match: RegExpExecArray | null;
        regex.lastIndex = 0; // Reset regex state

        while ((match = regex.exec(pageText)) !== null) {
          // Check for cancellation
          if (signal.aborted) {
            throw new Error("Search cancelled");
          }

          const startOffset = match.index;
          const endOffset = startOffset + match[0].length;

          // Get character bounding boxes
          const charBounds = await this._textProvider.getCharBounds(
            pageIndex,
            startOffset,
            endOffset,
          );

          // Calculate overall bounds
          const bounds = charBounds.length > 0 ? mergeBboxes(charBounds) : createEmptyBounds();

          results.push({
            pageIndex,
            text: match[0],
            startOffset,
            endOffset,
            bounds,
            charBounds,
            resultIndex: resultIndex++,
          });

          // Prevent infinite loop on zero-width matches
          if (match[0].length === 0) {
            regex.lastIndex++;
          }
        }

        // Update progress
        this._state.pagesSearched++;
        this._state.results = results;

        // Emit progress event
        this.emit(
          createSearchEvent("search-progress", {
            pagesSearched: this._state.pagesSearched,
            totalPages,
            resultsFound: results.length,
          }),
        );
      }

      // Search complete
      this._state.status = "complete";
      this._state.results = results;

      // Set current index to first result if any
      if (results.length > 0) {
        this._state.currentIndex = 0;
        this.emit(
          createSearchEvent("result-change", {
            previousIndex: -1,
            currentIndex: 0,
            result: results[0],
          }),
        );
      }

      // Emit complete event
      this.emit(
        createSearchEvent("search-complete", {
          query,
          totalResults: results.length,
          pagesSearched: this._state.pagesSearched,
        }),
      );

      this.emitStateChange();

      return results;
    } catch (error) {
      // Handle error
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Only emit error if not cancelled
      if (!signal.aborted) {
        this._state.status = "error";
        this._state.errorMessage = errorMessage;

        this.emit(
          createSearchEvent("search-error", {
            query,
            errorMessage,
          }),
        );

        this.emitStateChange();
      }

      return this._state.results;
    } finally {
      this._abortController = null;
    }
  }

  /**
   * Cancel the current search operation.
   */
  cancelSearch(): void {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
  }

  /**
   * Clear the current search and reset state.
   */
  clearSearch(): void {
    this.cancelSearch();

    const hadResults = this._state.results.length > 0;
    const previousIndex = this._state.currentIndex;

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

    this.emitStateChange();
  }

  /**
   * Navigate to the next search result.
   *
   * Wraps around to the first result after reaching the last result.
   *
   * @returns The next search result, or null if no results
   */
  findNext(): SearchResult | null {
    const { results, currentIndex } = this._state;

    if (results.length === 0) {
      return null;
    }

    const previousIndex = currentIndex;
    let nextIndex: number;

    if (currentIndex < 0) {
      // No current selection, start at first
      nextIndex = 0;
    } else if (currentIndex >= results.length - 1) {
      // At last result, wrap to first
      nextIndex = 0;
    } else {
      // Move to next
      nextIndex = currentIndex + 1;
    }

    this._state.currentIndex = nextIndex;
    const result = results[nextIndex];

    this.emit(
      createSearchEvent("result-change", {
        previousIndex,
        currentIndex: nextIndex,
        result,
      }),
    );

    this.emitStateChange();

    return result;
  }

  /**
   * Navigate to the previous search result.
   *
   * Wraps around to the last result when going before the first result.
   *
   * @returns The previous search result, or null if no results
   */
  findPrevious(): SearchResult | null {
    const { results, currentIndex } = this._state;

    if (results.length === 0) {
      return null;
    }

    const previousIndex = currentIndex;
    let nextIndex: number;

    if (currentIndex <= 0) {
      // At first result or no selection, wrap to last
      nextIndex = results.length - 1;
    } else {
      // Move to previous
      nextIndex = currentIndex - 1;
    }

    this._state.currentIndex = nextIndex;
    const result = results[nextIndex];

    this.emit(
      createSearchEvent("result-change", {
        previousIndex,
        currentIndex: nextIndex,
        result,
      }),
    );

    this.emitStateChange();

    return result;
  }

  /**
   * Navigate to a specific result by index.
   *
   * @param index - The result index to navigate to
   * @returns The result at the specified index, or null if invalid
   */
  goToResult(index: number): SearchResult | null {
    const { results, currentIndex } = this._state;

    if (index < 0 || index >= results.length) {
      return null;
    }

    if (index === currentIndex) {
      return results[index];
    }

    const previousIndex = currentIndex;
    this._state.currentIndex = index;
    const result = results[index];

    this.emit(
      createSearchEvent("result-change", {
        previousIndex,
        currentIndex: index,
        result,
      }),
    );

    this.emitStateChange();

    return result;
  }

  /**
   * Get results for a specific page.
   *
   * @param pageIndex - The page index to filter by
   * @returns Results on the specified page
   */
  getResultsForPage(pageIndex: number): SearchResult[] {
    return this._state.results.filter(r => r.pageIndex === pageIndex);
  }

  /**
   * Add an event listener.
   *
   * @param type - The event type to listen for
   * @param listener - The callback function
   */
  addEventListener(type: string, listener: SearchEventListener): void {
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
  removeEventListener(type: string, listener: SearchEventListener): void {
    const listeners = this._listeners.get(type);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Build a RegExp from the search query and options.
   */
  private buildRegex(query: string, options: SearchOptions): RegExp {
    let pattern: string;

    if (options.isRegex) {
      // Use query as-is for regex
      pattern = query;
    } else {
      // Escape special regex characters
      pattern = escapeRegex(query);
    }

    // Add word boundary for whole word matching
    if (options.wholeWord) {
      pattern = `\\b${pattern}\\b`;
    }

    // Build flags
    const flags = options.caseSensitive ? "g" : "gi";

    return new RegExp(pattern, flags);
  }

  /**
   * Emit an event to all registered listeners.
   */
  private emit(event: ReturnType<typeof createSearchEvent>): void {
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
  private emitStateChange(): void {
    this.emit(createSearchEvent("state-change", { state: this.state }));
  }
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Create an empty bounding box.
 */
function createEmptyBounds(): BoundingBox {
  return { x: 0, y: 0, width: 0, height: 0 };
}

/**
 * Create a new SearchEngine instance.
 *
 * @param options - Configuration options
 * @returns A new SearchEngine instance
 */
export function createSearchEngine(options: SearchEngineOptions): SearchEngine {
  return new SearchEngine(options);
}
