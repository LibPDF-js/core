/**
 * Tests for SearchEngine and search functionality.
 */

import type { BoundingBox } from "#src/text/types";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { SearchEngine, createSearchEngine } from "../SearchEngine";
import { SearchStateManager, createSearchStateManager } from "../SearchStateManager";
import type {
  SearchCompleteEvent,
  SearchProgressEvent,
  SearchResult,
  SearchStartEvent,
  ResultChangeEvent,
  TextProvider,
} from "../types";
import { createInitialSearchState, createSearchEvent } from "../types";

/**
 * Create a mock text provider for testing.
 */
function createMockTextProvider(pages: string[]): TextProvider {
  return {
    getPageCount: () => pages.length,
    getPageText: async (pageIndex: number) => {
      if (pageIndex >= 0 && pageIndex < pages.length) {
        return pages[pageIndex];
      }
      return null;
    },
    getCharBounds: async (
      _pageIndex: number,
      startOffset: number,
      endOffset: number,
    ): Promise<BoundingBox[]> => {
      const boxes: BoundingBox[] = [];
      for (let i = startOffset; i < endOffset; i++) {
        boxes.push({
          x: i * 10,
          y: 700,
          width: 10,
          height: 12,
        });
      }
      return boxes;
    },
  };
}

describe("SearchEngine", () => {
  describe("construction", () => {
    it("creates search engine with text provider", () => {
      const provider = createMockTextProvider(["Hello world"]);
      const engine = new SearchEngine({ textProvider: provider });

      expect(engine.query).toBe("");
      expect(engine.resultCount).toBe(0);
      expect(engine.currentIndex).toBe(-1);
      expect(engine.currentResult).toBeNull();
      expect(engine.isSearching).toBe(false);
    });

    it("creates engine via helper function", () => {
      const provider = createMockTextProvider(["Test"]);
      const engine = createSearchEngine({ textProvider: provider });

      expect(engine).toBeInstanceOf(SearchEngine);
    });
  });

  describe("basic search", () => {
    it("searches single page for simple string", async () => {
      const provider = createMockTextProvider(["Hello world, hello universe"]);
      const engine = new SearchEngine({ textProvider: provider });

      const results = await engine.search("hello");

      expect(results).toHaveLength(2);
      expect(results[0].text).toBe("Hello");
      expect(results[0].pageIndex).toBe(0);
      expect(results[0].startOffset).toBe(0);
      expect(results[1].text).toBe("hello");
      expect(results[1].startOffset).toBe(13);
    });

    it("searches multiple pages", async () => {
      const provider = createMockTextProvider([
        "First page with hello",
        "Second page without match",
        "Third page with hello again",
      ]);
      const engine = new SearchEngine({ textProvider: provider });

      const results = await engine.search("hello");

      expect(results).toHaveLength(2);
      expect(results[0].pageIndex).toBe(0);
      expect(results[1].pageIndex).toBe(2);
    });

    it("returns empty array for no matches", async () => {
      const provider = createMockTextProvider(["No matching content"]);
      const engine = new SearchEngine({ textProvider: provider });

      const results = await engine.search("xyz");

      expect(results).toHaveLength(0);
      expect(engine.currentResult).toBeNull();
    });

    it("handles empty query by clearing search", async () => {
      const provider = createMockTextProvider(["Hello world"]);
      const engine = new SearchEngine({ textProvider: provider });

      // First do a search
      await engine.search("hello");
      expect(engine.resultCount).toBe(1);

      // Then search with empty query
      const results = await engine.search("");

      expect(results).toHaveLength(0);
      expect(engine.query).toBe("");
    });
  });

  describe("case sensitivity", () => {
    it("searches case-insensitive by default", async () => {
      const provider = createMockTextProvider(["Hello HELLO hello"]);
      const engine = new SearchEngine({ textProvider: provider });

      const results = await engine.search("hello");

      expect(results).toHaveLength(3);
    });

    it("searches case-sensitive when option set", async () => {
      const provider = createMockTextProvider(["Hello HELLO hello"]);
      const engine = new SearchEngine({ textProvider: provider });

      const results = await engine.search("hello", { caseSensitive: true });

      expect(results).toHaveLength(1);
      expect(results[0].text).toBe("hello");
    });
  });

  describe("whole word matching", () => {
    it("matches partial words by default", async () => {
      const provider = createMockTextProvider(["hello helloworld worldhello"]);
      const engine = new SearchEngine({ textProvider: provider });

      const results = await engine.search("hello");

      expect(results).toHaveLength(3);
    });

    it("matches whole words only when option set", async () => {
      const provider = createMockTextProvider(["hello helloworld worldhello"]);
      const engine = new SearchEngine({ textProvider: provider });

      const results = await engine.search("hello", { wholeWord: true });

      expect(results).toHaveLength(1);
      expect(results[0].startOffset).toBe(0);
    });
  });

  describe("regex search", () => {
    it("searches with regex pattern", async () => {
      const provider = createMockTextProvider(["abc123 def456 ghi789"]);
      const engine = new SearchEngine({ textProvider: provider });

      const results = await engine.search("[a-z]+\\d+", { isRegex: true });

      expect(results).toHaveLength(3);
      expect(results[0].text).toBe("abc123");
      expect(results[1].text).toBe("def456");
      expect(results[2].text).toBe("ghi789");
    });

    it("combines regex with case sensitivity", async () => {
      const provider = createMockTextProvider(["ABC123 abc456"]);
      const engine = new SearchEngine({ textProvider: provider });

      const results = await engine.search("[A-Z]+\\d+", {
        isRegex: true,
        caseSensitive: true,
      });

      expect(results).toHaveLength(1);
      expect(results[0].text).toBe("ABC123");
    });

    it("handles invalid regex gracefully", async () => {
      const provider = createMockTextProvider(["test"]);
      const engine = new SearchEngine({ textProvider: provider });

      // Invalid regex sets error state
      await engine.search("[invalid", { isRegex: true });

      expect(engine.state.status).toBe("error");
      expect(engine.state.errorMessage).toContain("Invalid regular expression");
    });
  });

  describe("page filtering", () => {
    it("searches only specified pages", async () => {
      const provider = createMockTextProvider([
        "hello page 0",
        "hello page 1",
        "hello page 2",
        "hello page 3",
      ]);
      const engine = new SearchEngine({ textProvider: provider });

      const results = await engine.search("hello", { pageIndices: [1, 3] });

      expect(results).toHaveLength(2);
      expect(results[0].pageIndex).toBe(1);
      expect(results[1].pageIndex).toBe(3);
    });
  });

  describe("navigation", () => {
    let engine: SearchEngine;

    beforeEach(async () => {
      const provider = createMockTextProvider(["first match", "second match", "third match"]);
      engine = new SearchEngine({ textProvider: provider });
      await engine.search("match");
    });

    it("sets current index to first result after search", () => {
      expect(engine.currentIndex).toBe(0);
      expect(engine.currentResult?.pageIndex).toBe(0);
    });

    it("navigates to next result", () => {
      const result = engine.findNext();

      expect(result?.pageIndex).toBe(1);
      expect(engine.currentIndex).toBe(1);
    });

    it("wraps around to first result from last", () => {
      engine.findNext(); // index 1
      engine.findNext(); // index 2
      const result = engine.findNext(); // should wrap to 0

      expect(result?.pageIndex).toBe(0);
      expect(engine.currentIndex).toBe(0);
    });

    it("navigates to previous result", () => {
      engine.findNext(); // index 1
      const result = engine.findPrevious();

      expect(result?.pageIndex).toBe(0);
      expect(engine.currentIndex).toBe(0);
    });

    it("wraps around to last result from first", () => {
      const result = engine.findPrevious();

      expect(result?.pageIndex).toBe(2);
      expect(engine.currentIndex).toBe(2);
    });

    it("goes to specific result by index", () => {
      const result = engine.goToResult(2);

      expect(result?.pageIndex).toBe(2);
      expect(engine.currentIndex).toBe(2);
    });

    it("returns null for invalid result index", () => {
      expect(engine.goToResult(-1)).toBeNull();
      expect(engine.goToResult(10)).toBeNull();
    });

    it("returns null when navigating with no results", async () => {
      const emptyProvider = createMockTextProvider(["no matches here"]);
      const emptyEngine = new SearchEngine({ textProvider: emptyProvider });
      await emptyEngine.search("xyz");

      expect(emptyEngine.findNext()).toBeNull();
      expect(emptyEngine.findPrevious()).toBeNull();
    });
  });

  describe("getResultsForPage", () => {
    it("filters results by page index", async () => {
      const provider = createMockTextProvider([
        "hello one hello two",
        "nothing here",
        "hello three",
      ]);
      const engine = new SearchEngine({ textProvider: provider });
      await engine.search("hello");

      const page0Results = engine.getResultsForPage(0);
      const page1Results = engine.getResultsForPage(1);
      const page2Results = engine.getResultsForPage(2);

      expect(page0Results).toHaveLength(2);
      expect(page1Results).toHaveLength(0);
      expect(page2Results).toHaveLength(1);
    });
  });

  describe("clearSearch", () => {
    it("clears all results and resets state", async () => {
      const provider = createMockTextProvider(["hello world"]);
      const engine = new SearchEngine({ textProvider: provider });
      await engine.search("hello");

      engine.clearSearch();

      expect(engine.query).toBe("");
      expect(engine.resultCount).toBe(0);
      expect(engine.currentIndex).toBe(-1);
      expect(engine.state.status).toBe("idle");
    });
  });

  describe("event emission", () => {
    it("emits search-start event", async () => {
      const provider = createMockTextProvider(["hello"]);
      const engine = new SearchEngine({ textProvider: provider });
      const listener = vi.fn();

      engine.addEventListener("search-start", listener);
      await engine.search("hello");

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "search-start",
          query: "hello",
        }),
      );
    });

    it("emits search-progress events", async () => {
      const provider = createMockTextProvider(["page1", "page2", "page3"]);
      const engine = new SearchEngine({ textProvider: provider });
      const progressEvents: SearchProgressEvent[] = [];

      engine.addEventListener("search-progress", event => {
        progressEvents.push(event as SearchProgressEvent);
      });
      await engine.search("page");

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[progressEvents.length - 1].pagesSearched).toBe(3);
    });

    it("emits search-complete event", async () => {
      const provider = createMockTextProvider(["hello hello"]);
      const engine = new SearchEngine({ textProvider: provider });
      const listener = vi.fn();

      engine.addEventListener("search-complete", listener);
      await engine.search("hello");

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "search-complete",
          query: "hello",
          totalResults: 2,
        }),
      );
    });

    it("emits result-change event on navigation", async () => {
      const provider = createMockTextProvider(["match1", "match2"]);
      const engine = new SearchEngine({ textProvider: provider });
      await engine.search("match");

      const listener = vi.fn();
      engine.addEventListener("result-change", listener);
      engine.findNext();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "result-change",
          previousIndex: 0,
          currentIndex: 1,
        }),
      );
    });

    it("removes event listener", async () => {
      const provider = createMockTextProvider(["hello"]);
      const engine = new SearchEngine({ textProvider: provider });
      const listener = vi.fn();

      engine.addEventListener("search-start", listener);
      engine.removeEventListener("search-start", listener);
      await engine.search("hello");

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("bounding boxes", () => {
    it("calculates merged bounds for matches", async () => {
      const provider = createMockTextProvider(["hello"]);
      const engine = new SearchEngine({ textProvider: provider });

      const results = await engine.search("hello");

      expect(results[0].bounds).toBeDefined();
      expect(results[0].bounds.width).toBeGreaterThan(0);
      expect(results[0].bounds.height).toBeGreaterThan(0);
    });

    it("provides character-level bounding boxes", async () => {
      const provider = createMockTextProvider(["hello"]);
      const engine = new SearchEngine({ textProvider: provider });

      const results = await engine.search("hello");

      expect(results[0].charBounds).toHaveLength(5);
      expect(results[0].charBounds[0].width).toBe(10);
    });
  });

  describe("search cancellation", () => {
    it("cancels previous search when new search starts", async () => {
      const provider = createMockTextProvider(["hello hello hello"]);
      const engine = new SearchEngine({ textProvider: provider });

      // Start first search
      const firstSearch = engine.search("hello");

      // Start second search immediately
      const secondSearch = engine.search("world");

      await Promise.all([firstSearch, secondSearch]);

      // Should have results from second search only
      expect(engine.query).toBe("world");
    });
  });
});

describe("SearchStateManager", () => {
  describe("construction", () => {
    it("creates state manager with initial state", () => {
      const manager = new SearchStateManager();

      expect(manager.query).toBe("");
      expect(manager.results).toHaveLength(0);
      expect(manager.currentIndex).toBe(-1);
      expect(manager.isSearching).toBe(false);
      expect(manager.isComplete).toBe(false);
      expect(manager.hasError).toBe(false);
    });

    it("creates manager via helper function", () => {
      const manager = createSearchStateManager();

      expect(manager).toBeInstanceOf(SearchStateManager);
    });
  });

  describe("search state transitions", () => {
    it("transitions to searching state", () => {
      const manager = new SearchStateManager();

      manager.setSearching("test", { caseSensitive: true }, 5);

      expect(manager.query).toBe("test");
      expect(manager.options.caseSensitive).toBe(true);
      expect(manager.isSearching).toBe(true);
      expect(manager.state.totalPages).toBe(5);
    });

    it("updates progress", () => {
      const manager = new SearchStateManager();
      manager.setSearching("test", {}, 5);

      const mockResults: SearchResult[] = [
        createMockResult(0, "test", 0),
        createMockResult(1, "test", 0),
      ];
      manager.setProgress(2, mockResults);

      expect(manager.state.pagesSearched).toBe(2);
      expect(manager.results).toHaveLength(2);
    });

    it("transitions to complete state with results", () => {
      const manager = new SearchStateManager();
      manager.setSearching("test", {}, 3);

      const mockResults: SearchResult[] = [
        createMockResult(0, "test", 0),
        createMockResult(1, "test", 0),
      ];
      manager.setResults(mockResults);

      expect(manager.isComplete).toBe(true);
      expect(manager.results).toHaveLength(2);
      expect(manager.currentIndex).toBe(0);
    });

    it("sets current index to -1 when no results", () => {
      const manager = new SearchStateManager();
      manager.setSearching("test", {}, 3);
      manager.setResults([]);

      expect(manager.currentIndex).toBe(-1);
      expect(manager.currentResult).toBeNull();
    });

    it("transitions to error state", () => {
      const manager = new SearchStateManager();
      manager.setSearching("test", {}, 3);

      manager.setError("Something went wrong");

      expect(manager.hasError).toBe(true);
      expect(manager.state.errorMessage).toBe("Something went wrong");
    });
  });

  describe("navigation", () => {
    let manager: SearchStateManager;

    beforeEach(() => {
      manager = new SearchStateManager();
      manager.setSearching("test", {}, 3);
      manager.setResults([
        createMockResult(0, "test", 0),
        createMockResult(1, "test", 0),
        createMockResult(2, "test", 0),
      ]);
    });

    it("navigates to next result", () => {
      const result = manager.nextResult();

      expect(result?.pageIndex).toBe(1);
      expect(manager.currentIndex).toBe(1);
    });

    it("wraps around from last to first", () => {
      manager.setCurrentIndex(2);
      const result = manager.nextResult();

      expect(result?.pageIndex).toBe(0);
      expect(manager.currentIndex).toBe(0);
    });

    it("navigates to previous result", () => {
      manager.setCurrentIndex(1);
      const result = manager.previousResult();

      expect(result?.pageIndex).toBe(0);
      expect(manager.currentIndex).toBe(0);
    });

    it("wraps around from first to last", () => {
      const result = manager.previousResult();

      expect(result?.pageIndex).toBe(2);
      expect(manager.currentIndex).toBe(2);
    });

    it("sets specific index", () => {
      const result = manager.setCurrentIndex(2);

      expect(result?.pageIndex).toBe(2);
      expect(manager.currentIndex).toBe(2);
    });

    it("returns null for invalid index", () => {
      expect(manager.setCurrentIndex(-1)).toBeNull();
      expect(manager.setCurrentIndex(10)).toBeNull();
    });

    it("returns same result when index unchanged", () => {
      const result1 = manager.setCurrentIndex(0);
      const result2 = manager.setCurrentIndex(0);

      expect(result1).toEqual(result2);
    });
  });

  describe("options management", () => {
    it("updates search options", () => {
      const manager = new SearchStateManager();
      manager.setSearching("test", { caseSensitive: false }, 5);

      manager.updateOptions({ caseSensitive: true, wholeWord: true });

      expect(manager.options.caseSensitive).toBe(true);
      expect(manager.options.wholeWord).toBe(true);
    });
  });

  describe("history", () => {
    it("adds search to history", () => {
      const manager = new SearchStateManager();
      manager.setSearching("first", {}, 3);
      manager.setResults([createMockResult(0, "first", 0)]);

      expect(manager.history).toHaveLength(1);
      expect(manager.history[0].query).toBe("first");
      expect(manager.history[0].resultCount).toBe(1);
    });

    it("maintains history order with most recent first", () => {
      const manager = new SearchStateManager();

      manager.setSearching("first", {}, 3);
      manager.setResults([]);

      manager.setSearching("second", {}, 3);
      manager.setResults([]);

      expect(manager.history[0].query).toBe("second");
      expect(manager.history[1].query).toBe("first");
    });

    it("removes duplicate queries from history", () => {
      const manager = new SearchStateManager();

      manager.setSearching("test", {}, 3);
      manager.setResults([]);

      manager.setSearching("other", {}, 3);
      manager.setResults([]);

      manager.setSearching("test", {}, 3);
      manager.setResults([]);

      expect(manager.history).toHaveLength(2);
      expect(manager.history[0].query).toBe("test");
    });

    it("limits history size", () => {
      const manager = new SearchStateManager({ maxHistorySize: 3 });

      for (let i = 0; i < 5; i++) {
        manager.setSearching(`query${i}`, {}, 3);
        manager.setResults([]);
      }

      expect(manager.history).toHaveLength(3);
      expect(manager.history[0].query).toBe("query4");
    });

    it("clears history", () => {
      const manager = new SearchStateManager();
      manager.setSearching("test", {}, 3);
      manager.setResults([]);

      manager.clearHistory();

      expect(manager.history).toHaveLength(0);
    });
  });

  describe("reset", () => {
    it("resets to initial state", () => {
      const manager = new SearchStateManager();
      manager.setSearching("test", {}, 3);
      manager.setResults([createMockResult(0, "test", 0)]);

      manager.reset();

      expect(manager.query).toBe("");
      expect(manager.results).toHaveLength(0);
      expect(manager.currentIndex).toBe(-1);
      expect(manager.state.status).toBe("idle");
    });
  });

  describe("event emission", () => {
    it("emits search-start event", () => {
      const manager = new SearchStateManager();
      const listener = vi.fn();

      manager.addEventListener("search-start", listener);
      manager.setSearching("test", {}, 5);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "search-start",
          query: "test",
        }),
      );
    });

    it("emits search-progress event", () => {
      const manager = new SearchStateManager();
      const listener = vi.fn();
      manager.setSearching("test", {}, 5);

      manager.addEventListener("search-progress", listener);
      manager.setProgress(2, []);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "search-progress",
          pagesSearched: 2,
          totalPages: 5,
        }),
      );
    });

    it("emits search-complete event", () => {
      const manager = new SearchStateManager();
      const listener = vi.fn();
      manager.setSearching("test", {}, 5);

      manager.addEventListener("search-complete", listener);
      manager.setResults([createMockResult(0, "test", 0)]);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "search-complete",
          totalResults: 1,
        }),
      );
    });

    it("emits search-error event", () => {
      const manager = new SearchStateManager();
      const listener = vi.fn();
      manager.setSearching("test", {}, 5);

      manager.addEventListener("search-error", listener);
      manager.setError("Error message");

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "search-error",
          errorMessage: "Error message",
        }),
      );
    });

    it("emits result-change event on navigation", () => {
      const manager = new SearchStateManager();
      manager.setSearching("test", {}, 3);
      manager.setResults([createMockResult(0, "test", 0), createMockResult(1, "test", 0)]);

      const listener = vi.fn();
      manager.addEventListener("result-change", listener);
      manager.nextResult();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "result-change",
          previousIndex: 0,
          currentIndex: 1,
        }),
      );
    });

    it("emits state-change event", () => {
      const manager = new SearchStateManager();
      const listener = vi.fn();

      manager.addEventListener("state-change", listener);
      manager.setSearching("test", {}, 5);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "state-change",
        }),
      );
    });

    it("removes event listener", () => {
      const manager = new SearchStateManager();
      const listener = vi.fn();

      manager.addEventListener("search-start", listener);
      manager.removeEventListener("search-start", listener);
      manager.setSearching("test", {}, 5);

      expect(listener).not.toHaveBeenCalled();
    });
  });
});

describe("types and helpers", () => {
  describe("createInitialSearchState", () => {
    it("creates valid initial state", () => {
      const state = createInitialSearchState();

      expect(state.query).toBe("");
      expect(state.options).toEqual({});
      expect(state.results).toEqual([]);
      expect(state.currentIndex).toBe(-1);
      expect(state.status).toBe("idle");
      expect(state.totalPages).toBe(0);
      expect(state.pagesSearched).toBe(0);
    });
  });

  describe("createSearchEvent", () => {
    it("creates event with timestamp", () => {
      const event = createSearchEvent("search-start", {
        query: "test",
        options: {},
      });

      expect(event.type).toBe("search-start");
      expect(event.timestamp).toBeGreaterThan(0);
      expect((event as SearchStartEvent).query).toBe("test");
    });
  });
});

/**
 * Helper to create a mock search result.
 */
function createMockResult(
  pageIndex: number,
  text: string,
  startOffset: number,
  resultIndex = 0,
): SearchResult {
  return {
    pageIndex,
    text,
    startOffset,
    endOffset: startOffset + text.length,
    bounds: { x: 0, y: 0, width: 100, height: 12 },
    charBounds: Array.from({ length: text.length }, (_, i) => ({
      x: i * 10,
      y: 0,
      width: 10,
      height: 12,
    })),
    resultIndex,
  };
}
