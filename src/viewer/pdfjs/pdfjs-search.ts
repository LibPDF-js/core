/**
 * PDF.js-based search functionality.
 *
 * This module provides text search capabilities using PDF.js's text extraction.
 * It enables searching across all pages of a PDF document with support for
 * case-sensitive and whole-word matching.
 */

import type { PDFDocumentProxy, PDFPageProxy, TextContent, TextItem } from "./pdfjs-wrapper";
import { getTextContent, isTextItem } from "./pdfjs-wrapper";

/**
 * A single search result.
 */
export interface PDFJSSearchResult {
  /**
   * 0-based page index where the match was found.
   */
  pageIndex: number;

  /**
   * Index of this result in the global results array.
   */
  resultIndex: number;

  /**
   * The matched text.
   */
  matchText: string;

  /**
   * Character offset within the page text where the match starts.
   */
  startOffset: number;

  /**
   * Character offset within the page text where the match ends.
   */
  endOffset: number;

  /**
   * Bounding rectangle in PDF coordinates (if available).
   */
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Search options.
 */
export interface PDFJSSearchOptions {
  /**
   * Whether to match case.
   * @default false
   */
  caseSensitive?: boolean;

  /**
   * Whether to match whole words only.
   * @default false
   */
  wholeWord?: boolean;

  /**
   * Starting page index for search (0-based).
   * @default 0
   */
  startPage?: number;

  /**
   * Maximum number of results to return.
   * @default Infinity
   */
  maxResults?: number;
}

/**
 * Search state for tracking current position.
 */
export interface PDFJSSearchState {
  /**
   * The current search query.
   */
  query: string;

  /**
   * All search results.
   */
  results: PDFJSSearchResult[];

  /**
   * Index of the current result (for navigation).
   */
  currentIndex: number;

  /**
   * Whether search is in progress.
   */
  searching: boolean;

  /**
   * Search options used.
   */
  options: PDFJSSearchOptions;
}

/**
 * Text item with position information.
 */
interface PositionedTextItem {
  text: string;
  transform: number[];
  width: number;
  height: number;
  charWidth: number; // Average character width
}

/**
 * Extract text from a PDF page with position information.
 */
async function extractPageText(page: PDFPageProxy): Promise<{
  text: string;
  items: PositionedTextItem[];
}> {
  const textContent = await getTextContent(page);
  const items: PositionedTextItem[] = [];
  let fullText = "";

  for (const item of textContent.items) {
    if (!isTextItem(item)) {
      continue;
    }

    const textItem = item as TextItem;
    if (textItem.str) {
      const charWidth = textItem.str.length > 0 ? (textItem.width || 0) / textItem.str.length : 0;
      items.push({
        text: textItem.str,
        transform: textItem.transform,
        width: textItem.width,
        height: textItem.height,
        charWidth,
      });
      fullText += textItem.str;
    }
  }

  return { text: fullText, items };
}

/**
 * Find all occurrences of a query in text.
 */
function findMatches(
  text: string,
  query: string,
  options: PDFJSSearchOptions,
): Array<{ start: number; end: number }> {
  const matches: Array<{ start: number; end: number }> = [];

  if (!query) {
    return matches;
  }

  let searchText = text;
  let searchQuery = query;

  if (!options.caseSensitive) {
    searchText = text.toLowerCase();
    searchQuery = query.toLowerCase();
  }

  let startIndex = 0;
  while (startIndex < searchText.length) {
    const index = searchText.indexOf(searchQuery, startIndex);
    if (index === -1) {
      break;
    }

    // Check whole word match if required
    if (options.wholeWord) {
      const before = index > 0 ? text[index - 1] : " ";
      const after = index + query.length < text.length ? text[index + query.length] : " ";

      const wordBoundary = /\W/;
      if (!wordBoundary.test(before) || !wordBoundary.test(after)) {
        startIndex = index + 1;
        continue;
      }
    }

    matches.push({
      start: index,
      end: index + query.length,
    });

    startIndex = index + 1;
  }

  return matches;
}

/**
 * Search a PDF document for text.
 *
 * @param document - The PDF.js document proxy
 * @param query - The search query
 * @param options - Search options
 * @returns Array of search results
 */
export async function searchDocument(
  document: PDFDocumentProxy,
  query: string,
  options: PDFJSSearchOptions = {},
): Promise<PDFJSSearchResult[]> {
  const results: PDFJSSearchResult[] = [];
  const {
    caseSensitive = false,
    wholeWord = false,
    startPage = 0,
    maxResults = Number.POSITIVE_INFINITY,
  } = options;

  const numPages = document.numPages;

  for (let pageIndex = startPage; pageIndex < numPages; pageIndex++) {
    if (results.length >= maxResults) {
      break;
    }

    // PDF.js uses 1-based page numbers
    const page = await document.getPage(pageIndex + 1);
    const { text, items } = await extractPageText(page);

    const matches = findMatches(text, query, { caseSensitive, wholeWord });

    for (const match of matches) {
      if (results.length >= maxResults) {
        break;
      }

      // Calculate precise bounds for the matched text
      let bounds: PDFJSSearchResult["bounds"];
      let charOffset = 0;

      for (const item of items) {
        const itemEnd = charOffset + item.text.length;

        if (match.start >= charOffset && match.start < itemEnd) {
          // Match starts in this item
          const offsetInItem = match.start - charOffset;
          const matchLength = Math.min(match.end - match.start, item.text.length - offsetInItem);

          // Calculate x offset based on character position
          const xOffset = offsetInItem * item.charWidth;
          // Calculate width based on matched text length
          const matchWidth = matchLength * item.charWidth;

          bounds = {
            x: item.transform[4] + xOffset,
            y: item.transform[5],
            width: matchWidth > 0 ? matchWidth : item.charWidth * query.length,
            height: item.height || 12,
          };
          break;
        }
        charOffset = itemEnd;
      }

      results.push({
        pageIndex,
        resultIndex: results.length,
        matchText: text.slice(match.start, match.end),
        startOffset: match.start,
        endOffset: match.end,
        bounds,
      });
    }
  }

  return results;
}

/**
 * Search engine class for managing search state and navigation.
 */
export class PDFJSSearchEngine {
  private _document: PDFDocumentProxy | null = null;
  private _state: PDFJSSearchState = {
    query: "",
    results: [],
    currentIndex: -1,
    searching: false,
    options: {},
  };
  private _listeners: Set<(state: PDFJSSearchState) => void> = new Set();

  /**
   * Set the document to search.
   */
  setDocument(document: PDFDocumentProxy): void {
    this._document = document;
    this.clearSearch();
  }

  /**
   * Get the current search state.
   */
  get state(): Readonly<PDFJSSearchState> {
    return this._state;
  }

  /**
   * Get the current result.
   */
  get currentResult(): PDFJSSearchResult | null {
    if (this._state.currentIndex >= 0 && this._state.currentIndex < this._state.results.length) {
      return this._state.results[this._state.currentIndex];
    }
    return null;
  }

  /**
   * Get total result count.
   */
  get resultCount(): number {
    return this._state.results.length;
  }

  /**
   * Add a state change listener.
   */
  addListener(listener: (state: PDFJSSearchState) => void): void {
    this._listeners.add(listener);
  }

  /**
   * Remove a state change listener.
   */
  removeListener(listener: (state: PDFJSSearchState) => void): void {
    this._listeners.delete(listener);
  }

  /**
   * Search for text in the document.
   */
  async search(query: string, options: PDFJSSearchOptions = {}): Promise<PDFJSSearchResult[]> {
    if (!this._document) {
      throw new Error("No document set. Call setDocument first.");
    }

    this._state = {
      query,
      results: [],
      currentIndex: -1,
      searching: true,
      options,
    };
    this.notifyListeners();

    try {
      const results = await searchDocument(this._document, query, options);
      this._state = {
        ...this._state,
        results,
        currentIndex: results.length > 0 ? 0 : -1,
        searching: false,
      };
      this.notifyListeners();
      return results;
    } catch (error) {
      this._state = {
        ...this._state,
        searching: false,
      };
      this.notifyListeners();
      throw error;
    }
  }

  /**
   * Clear the current search.
   */
  clearSearch(): void {
    this._state = {
      query: "",
      results: [],
      currentIndex: -1,
      searching: false,
      options: {},
    };
    this.notifyListeners();
  }

  /**
   * Navigate to the next result.
   */
  findNext(): PDFJSSearchResult | null {
    if (this._state.results.length === 0) {
      return null;
    }

    this._state = {
      ...this._state,
      currentIndex: (this._state.currentIndex + 1) % this._state.results.length,
    };
    this.notifyListeners();
    return this.currentResult;
  }

  /**
   * Navigate to the previous result.
   */
  findPrevious(): PDFJSSearchResult | null {
    if (this._state.results.length === 0) {
      return null;
    }

    this._state = {
      ...this._state,
      currentIndex:
        (this._state.currentIndex - 1 + this._state.results.length) % this._state.results.length,
    };
    this.notifyListeners();
    return this.currentResult;
  }

  /**
   * Navigate to a specific result by index.
   */
  goToResult(index: number): PDFJSSearchResult | null {
    if (index < 0 || index >= this._state.results.length) {
      return null;
    }

    this._state = {
      ...this._state,
      currentIndex: index,
    };
    this.notifyListeners();
    return this.currentResult;
  }

  /**
   * Get results for a specific page.
   */
  getResultsForPage(pageIndex: number): PDFJSSearchResult[] {
    return this._state.results.filter(r => r.pageIndex === pageIndex);
  }

  /**
   * Notify all listeners of state change.
   */
  private notifyListeners(): void {
    this._listeners.forEach(listener => {
      listener(this._state);
    });
  }
}

/**
 * Create a new search engine instance.
 */
export function createPDFJSSearchEngine(): PDFJSSearchEngine {
  return new PDFJSSearchEngine();
}
