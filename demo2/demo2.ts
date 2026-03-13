/**
 * LibPDF Viewer Demo2 - Native Rendering
 *
 * A comprehensive demo application showcasing the PDF viewing capabilities
 * of the @libpdf/core library using native LibPDF rendering (no PDF.js).
 * Includes navigation, zoom, rotation, and text search functionality.
 */

import {
  createCanvasRenderer,
  createCoordinateTransformer,
  createSearchEngine,
  createTextLayerBuilder,
  createViewportManager,
  createVirtualScroller,
  PDF,
  TextExtractor,
  type CanvasRenderer,
  type PageDimensions,
  type SearchEngine,
  type SearchResult,
  type ViewportManager,
  type VirtualScroller,
} from "../src";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface TextSpanInfo {
  element: HTMLElement;
  text: string;
  startOffset: number;
  endOffset: number;
}

interface DemoState {
  pdf: PDF | null;
  pdfBytes: Uint8Array | null;
  scale: number;
  rotation: number;
  currentPage: number;
  viewportManager: ViewportManager | null;
  virtualScroller: VirtualScroller | null;
  renderer: CanvasRenderer | null;
  searchEngine: SearchEngine | null;
  pageElements: Map<number, HTMLElement>;
  pageTextSpans: Map<number, TextSpanInfo[]>;
  searchResults: SearchResult[];
  currentSearchIndex: number;
}

const state: DemoState = {
  pdf: null,
  pdfBytes: null,
  scale: 1,
  rotation: 0,
  currentPage: 1,
  viewportManager: null,
  virtualScroller: null,
  renderer: null,
  searchEngine: null,
  pageElements: new Map(),
  pageTextSpans: new Map(),
  searchResults: [],
  currentSearchIndex: -1,
};

// ─────────────────────────────────────────────────────────────────────────────
// DOM Elements
// ─────────────────────────────────────────────────────────────────────────────

const elements = {
  fileInput: document.getElementById("file-input") as HTMLInputElement,
  viewer: document.getElementById("viewer") as HTMLDivElement,
  btnFirst: document.getElementById("btn-first") as HTMLButtonElement,
  btnPrev: document.getElementById("btn-prev") as HTMLButtonElement,
  btnNext: document.getElementById("btn-next") as HTMLButtonElement,
  btnLast: document.getElementById("btn-last") as HTMLButtonElement,
  pageInput: document.getElementById("page-input") as HTMLInputElement,
  pageCount: document.getElementById("page-count") as HTMLSpanElement,
  btnZoomOut: document.getElementById("btn-zoom-out") as HTMLButtonElement,
  btnZoomIn: document.getElementById("btn-zoom-in") as HTMLButtonElement,
  zoomSelect: document.getElementById("zoom-select") as HTMLSelectElement,
  btnRotateCcw: document.getElementById("btn-rotate-ccw") as HTMLButtonElement,
  btnRotateCw: document.getElementById("btn-rotate-cw") as HTMLButtonElement,
  searchInput: document.getElementById("search-input") as HTMLInputElement,
  searchResults: document.getElementById("search-results") as HTMLSpanElement,
  btnSearchPrev: document.getElementById("btn-search-prev") as HTMLButtonElement,
  btnSearchNext: document.getElementById("btn-search-next") as HTMLButtonElement,
  searchCase: document.getElementById("search-case") as HTMLInputElement,
  searchWhole: document.getElementById("search-whole") as HTMLInputElement,
  statusText: document.getElementById("status-text") as HTMLSpanElement,
  statusProgress: document.getElementById("status-progress") as HTMLSpanElement,
};

// ─────────────────────────────────────────────────────────────────────────────
// File Loading
// ─────────────────────────────────────────────────────────────────────────────

async function loadPDF(file: File): Promise<void> {
  setStatus("Loading PDF...");
  setProgress("");

  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Parse with LibPDF
    state.pdf = await PDF.load(bytes);
    state.pdfBytes = bytes;

    setStatus(`Loaded: ${file.name}`);
    setProgress("");
    emitEvent("pdf:ready", { pageCount: state.pdf.getPageCount(), fileName: file.name });
    await initializeViewer();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(`Error: ${message}`);
    setProgress("");
    console.error("Failed to load PDF:", error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Viewer Initialization
// ─────────────────────────────────────────────────────────────────────────────

async function initializeViewer(): Promise<void> {
  if (!state.pdf) {
    return;
  }

  // Clear previous viewer state
  cleanupViewer();

  // Remove placeholder
  const placeholder = elements.viewer.querySelector(".viewer-placeholder");
  if (placeholder) {
    placeholder.remove();
  }

  // Get page dimensions for virtual scroller
  const pageCount = state.pdf.getPageCount();
  const pageDimensions: PageDimensions[] = [];

  for (let i = 0; i < pageCount; i++) {
    const page = state.pdf.getPage(i);
    pageDimensions.push({
      width: page.width,
      height: page.height,
    });
  }

  // Create virtual scroller
  state.virtualScroller = createVirtualScroller({
    pageDimensions,
    scale: state.scale,
    pageGap: 20,
    bufferSize: 1,
    viewportWidth: elements.viewer.clientWidth,
    viewportHeight: elements.viewer.clientHeight,
  });

  // Set up viewer container for scrolling
  elements.viewer.style.position = "relative";
  elements.viewer.style.overflow = "auto";

  // Create content container with total height for scrolling
  const contentContainer = document.createElement("div");
  contentContainer.className = "viewer-content";
  contentContainer.style.position = "relative";
  contentContainer.style.width = `${Math.max(state.virtualScroller.totalWidth, elements.viewer.clientWidth)}px`;
  contentContainer.style.height = `${state.virtualScroller.totalHeight}px`;
  elements.viewer.appendChild(contentContainer);

  // Store reference to content container for page placement
  (state as any).contentContainer = contentContainer;

  // Handle scroll events to update virtual scroller
  elements.viewer.addEventListener("scroll", handleScroll);

  // Create Canvas renderer
  state.renderer = createCanvasRenderer();
  await state.renderer.initialize();

  // Create viewport manager for page rendering
  state.viewportManager = createViewportManager({
    scroller: state.virtualScroller,
    renderer: state.renderer,
    pageSource: createPageSource(),
    maxConcurrentRenders: 3,
  });

  // Set up scroller events for page tracking
  state.virtualScroller.addEventListener("visibleRangeChange", event => {
    if (event.visibleRange) {
      const newPage = event.visibleRange.start + 1;
      if (newPage !== state.currentPage) {
        const previousPage = state.currentPage;
        state.currentPage = newPage;
        emitEvent("page:changed", { previousPage, currentPage: newPage });
        updatePageControls();
      }
    }
  });

  // Set up viewport manager events
  state.viewportManager.addEventListener("pageRendered", event => {
    if (event.element && state.virtualScroller && state.pdf) {
      const layout = state.virtualScroller.getPageLayout(event.pageIndex);
      if (!layout) {
        console.error(`No layout for page ${event.pageIndex}`);
        return;
      }

      // Get or create the page container
      let container = state.pageElements.get(event.pageIndex);
      const contentContainer = (state as any).contentContainer as HTMLElement;
      if (!container && contentContainer) {
        container = document.createElement("div");
        container.className = "page-container";
        container.dataset.pageIndex = String(event.pageIndex);
        state.pageElements.set(event.pageIndex, container);
        contentContainer.appendChild(container);
      }
      if (!container) {
        return;
      }

      // Clone the canvas to display it
      const canvas = event.element as HTMLCanvasElement;
      const displayCanvas = canvas.cloneNode(true) as HTMLCanvasElement;
      const srcCtx = canvas.getContext("2d");
      const dstCtx = displayCanvas.getContext("2d");
      if (srcCtx && dstCtx) {
        dstCtx.drawImage(canvas, 0, 0);
      }

      // Position and size the container based on layout
      container.style.position = "absolute";
      container.style.left = `${layout.left}px`;
      container.style.top = `${layout.top}px`;
      container.style.width = `${layout.width}px`;
      container.style.height = `${layout.height}px`;

      // Clear container and add the canvas
      container.innerHTML = "";
      displayCanvas.style.width = "100%";
      displayCanvas.style.height = "100%";
      displayCanvas.style.position = "absolute";
      displayCanvas.style.left = "0";
      displayCanvas.style.top = "0";
      container.appendChild(displayCanvas);

      // Build text layer for text selection
      buildTextLayer(event.pageIndex, container);

      // Emit page rendered event
      emitEvent("page:rendered", { pageIndex: event.pageIndex });
    }
  });

  state.viewportManager.addEventListener("pageStateChange", event => {
    console.log(`Page ${event.pageIndex} state: ${event.state}`);
  });

  state.viewportManager.addEventListener("pageError", event => {
    console.error(`Page ${event.pageIndex} error:`, event.error);
  });

  // Initialize search engine
  initializeSearch();

  // Enable controls
  enableControls();
  updatePageControls();

  // Initialize viewport manager (loads page dimensions and triggers initial render)
  await state.viewportManager.initialize();
}

function handleScroll(): void {
  if (state.virtualScroller) {
    state.virtualScroller.scrollTo(elements.viewer.scrollLeft, elements.viewer.scrollTop);
  }
}

function createPageSource() {
  return {
    getPageCount: () => state.pdf?.getPageCount() ?? 0,
    getPageDimensions: async (pageIndex: number) => {
      if (!state.pdf) {
        return { width: 0, height: 0 };
      }
      const page = state.pdf.getPage(pageIndex);
      return { width: page.width, height: page.height };
    },
    getPageRotation: async (pageIndex: number) => {
      if (!state.pdf) {
        return 0;
      }
      const page = state.pdf.getPage(pageIndex);
      return page.rotation;
    },
    getPageContentBytes: async (pageIndex: number): Promise<Uint8Array | null> => {
      if (!state.pdf) {
        return null;
      }
      try {
        const page = state.pdf.getPage(pageIndex);
        return page.getContentBytes();
      } catch {
        return null;
      }
    },
    getPageFontResolver: async (pageIndex: number) => {
      if (!state.pdf) {
        return null;
      }
      try {
        const page = state.pdf.getPage(pageIndex);
        return page.createFontResolver();
      } catch {
        return null;
      }
    },
  };
}

async function buildTextLayer(pageIndex: number, container: HTMLElement): Promise<void> {
  if (!state.pdf || !state.renderer) {
    return;
  }

  try {
    const page = state.pdf.getPage(pageIndex);
    const pageWidth = page.width;
    const pageHeight = page.height;
    const rotation = page.rotation;

    // Create text layer container
    const textLayerDiv = document.createElement("div");
    textLayerDiv.className = "text-layer";
    textLayerDiv.style.position = "absolute";
    textLayerDiv.style.left = "0";
    textLayerDiv.style.top = "0";
    textLayerDiv.style.right = "0";
    textLayerDiv.style.bottom = "0";
    textLayerDiv.style.overflow = "hidden";
    textLayerDiv.style.lineHeight = "1";

    // Create coordinate transformer for positioning text spans
    const transformer = createCoordinateTransformer({
      pageWidth,
      pageHeight,
      pageRotation: rotation as 0 | 90 | 180 | 270,
      viewerRotation: state.rotation as 0 | 90 | 180 | 270,
      scale: state.scale,
    });

    // Extract text from page using TextExtractor
    const textSpans: TextSpanInfo[] = [];
    let currentOffset = 0;

    // Build text layer with extracted text
    const builder = createTextLayerBuilder({
      container: textLayerDiv,
      transformer,
    });

    // Extract characters for text layer
    try {
      const contentBytes = page.getContentBytes();
      const fontResolver = page.createFontResolver();
      const extractor = new TextExtractor({ resolveFont: fontResolver });
      const chars = extractor.extract(contentBytes);

      if (chars.length > 0) {
        builder.buildTextLayer(chars);

        // Track text spans for search highlighting
        const spans = textLayerDiv.querySelectorAll("span");
        spans.forEach(span => {
          const charText = span.textContent || "";
          textSpans.push({
            element: span as HTMLElement,
            text: charText,
            startOffset: currentOffset,
            endOffset: currentOffset + charText.length,
          });
          currentOffset += charText.length;
        });
      }
    } catch {
      // Fallback: create simple text spans from plain text
      const pageText = page.extractText();
      const text = pageText.text;
      if (text) {
        const lines = text.split("\n");
        let y = 20;
        for (const line of lines) {
          if (line.trim()) {
            const span = document.createElement("span");
            span.textContent = line;
            span.style.position = "absolute";
            span.style.left = "10px";
            span.style.top = `${y}px`;
            span.style.color = "transparent";
            span.style.pointerEvents = "auto";
            span.style.cursor = "text";
            textLayerDiv.appendChild(span);

            textSpans.push({
              element: span,
              text: line,
              startOffset: currentOffset,
              endOffset: currentOffset + line.length,
            });
            currentOffset += line.length + 1; // +1 for newline
            y += 16;
          }
        }
      }
    }

    state.pageTextSpans.set(pageIndex, textSpans);
    container.appendChild(textLayerDiv);

    // Highlight search results on this page
    highlightSearchResults(pageIndex);
  } catch (err) {
    console.error(`Failed to build text layer for page ${pageIndex}:`, err);
  }
}

function cleanupViewer(): void {
  // Remove scroll listener
  elements.viewer.removeEventListener("scroll", handleScroll);

  state.virtualScroller = null;

  if (state.viewportManager) {
    state.viewportManager.dispose();
    state.viewportManager = null;
  }
  if (state.renderer) {
    state.renderer.destroy();
    state.renderer = null;
  }
  state.searchEngine = null;
  state.pageElements.clear();
  state.pageTextSpans.clear();
  state.searchResults = [];
  state.currentSearchIndex = -1;
  elements.viewer.innerHTML = "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────────────────────────────────────

function goToPage(pageNumber: number): void {
  if (!state.pdf || !state.virtualScroller) {
    return;
  }

  const pageCount = state.pdf.getPageCount();
  const clampedPage = Math.max(1, Math.min(pageNumber, pageCount));

  const previousPage = state.currentPage;
  state.currentPage = clampedPage;

  if (previousPage !== clampedPage) {
    emitEvent("page:changed", { previousPage, currentPage: clampedPage });
  }

  // Get the page layout to calculate scroll position
  const layout = state.virtualScroller.getPageLayout(clampedPage - 1);
  if (layout) {
    elements.viewer.scrollTo({
      top: Math.max(0, layout.top - 20),
      left: Math.max(0, layout.left - (elements.viewer.clientWidth - layout.width) / 2),
      behavior: "smooth",
    });
  }

  updatePageControls();
}

function updatePageControls(): void {
  if (!state.pdf) {
    return;
  }

  const pageCount = state.pdf.getPageCount();
  elements.pageInput.value = String(state.currentPage);
  elements.pageInput.max = String(pageCount);
  elements.pageCount.textContent = String(pageCount);

  elements.btnFirst.disabled = state.currentPage <= 1;
  elements.btnPrev.disabled = state.currentPage <= 1;
  elements.btnNext.disabled = state.currentPage >= pageCount;
  elements.btnLast.disabled = state.currentPage >= pageCount;
}

// ─────────────────────────────────────────────────────────────────────────────
// Zoom
// ─────────────────────────────────────────────────────────────────────────────

async function setScale(scale: number): Promise<void> {
  const newScale = Math.max(0.1, Math.min(5, scale));
  if (newScale === state.scale) {
    return;
  }

  const previousScale = state.scale;
  state.scale = newScale;

  emitEvent("scale:changed", { previousScale, currentScale: newScale });

  // Update zoom select to reflect current scale
  const option = Array.from(elements.zoomSelect.options).find(
    opt => Math.abs(Number(opt.value) - state.scale) < 0.01,
  );

  if (option) {
    elements.zoomSelect.value = option.value;
  } else {
    const customOption = elements.zoomSelect.querySelector('option[value="custom"]');
    if (!customOption) {
      const opt = document.createElement("option");
      opt.value = "custom";
      opt.textContent = `${Math.round(state.scale * 100)}%`;
      elements.zoomSelect.insertBefore(opt, elements.zoomSelect.firstChild);
    } else {
      customOption.textContent = `${Math.round(state.scale * 100)}%`;
    }
    elements.zoomSelect.value = "custom";
  }

  // Update virtual scroller with new scale
  if (state.virtualScroller) {
    const scrollRatioY = elements.viewer.scrollTop / (elements.viewer.scrollHeight || 1);
    const scrollRatioX = elements.viewer.scrollLeft / (elements.viewer.scrollWidth || 1);

    state.virtualScroller.setScale(state.scale);
    state.virtualScroller.setViewportSize(
      elements.viewer.clientWidth,
      elements.viewer.clientHeight,
    );

    // Update content container size
    const contentContainer = (state as any).contentContainer as HTMLElement;
    if (contentContainer) {
      contentContainer.style.width = `${Math.max(state.virtualScroller.totalWidth, elements.viewer.clientWidth)}px`;
      contentContainer.style.height = `${state.virtualScroller.totalHeight}px`;
    }

    // Clear existing page elements and text spans, then re-render
    for (const [, container] of state.pageElements) {
      container.remove();
    }
    state.pageTextSpans.clear();
    state.pageElements.clear();

    // Restore scroll position proportionally
    elements.viewer.scrollTop = scrollRatioY * state.virtualScroller.totalHeight;
    elements.viewer.scrollLeft = scrollRatioX * state.virtualScroller.totalWidth;

    // Trigger re-render of visible pages
    if (state.viewportManager) {
      await state.viewportManager.invalidateVisiblePages();
    }

    // Re-apply search highlights after a short delay
    setTimeout(() => {
      for (const pageIndex of state.pageTextSpans.keys()) {
        highlightSearchResults(pageIndex);
      }
    }, 100);
  }
}

async function zoomIn(): Promise<void> {
  await setScale(state.scale * 1.25);
}

async function zoomOut(): Promise<void> {
  await setScale(state.scale / 1.25);
}

async function fitWidth(): Promise<void> {
  if (!state.pdf || !state.virtualScroller) {
    return;
  }

  const page = state.pdf.getPage(state.currentPage - 1);
  const containerWidth = elements.viewer.clientWidth - 40;
  const newScale = containerWidth / page.width;
  await setScale(newScale);
}

async function fitPage(): Promise<void> {
  if (!state.pdf || !state.virtualScroller) {
    return;
  }

  const page = state.pdf.getPage(state.currentPage - 1);
  const containerWidth = elements.viewer.clientWidth - 40;
  const containerHeight = elements.viewer.clientHeight - 40;

  const scaleX = containerWidth / page.width;
  const scaleY = containerHeight / page.height;
  await setScale(Math.min(scaleX, scaleY));
}

// ─────────────────────────────────────────────────────────────────────────────
// Rotation
// ─────────────────────────────────────────────────────────────────────────────

async function rotate(degrees: number): Promise<void> {
  state.rotation = (state.rotation + degrees + 360) % 360;

  // Re-render all visible pages
  if (state.viewportManager) {
    await state.viewportManager.invalidateVisiblePages();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────────────────────────────────────

function initializeSearch(): void {
  if (!state.pdf) {
    return;
  }

  // Create search engine with text provider
  state.searchEngine = createSearchEngine({
    textProvider: {
      getPageCount: () => state.pdf?.getPageCount() ?? 0,
      getPageText: async (pageIndex: number) => {
        if (!state.pdf) {
          return "";
        }
        try {
          const page = state.pdf.getPage(pageIndex);
          const pageText = page.extractText();
          return pageText.text || "";
        } catch {
          return "";
        }
      },
    },
  });

  // Listen for search events
  state.searchEngine.addEventListener("search-complete", event => {
    state.searchResults = event.results;
    state.currentSearchIndex = event.results.length > 0 ? 0 : -1;
    updateSearchResults();
    if (state.searchResults.length > 0) {
      scrollToCurrentResult();
    }
  });

  state.searchEngine.addEventListener("result-change", event => {
    state.currentSearchIndex = event.currentIndex;
    updateSearchResults();
    scrollToCurrentResult();
  });
}

async function performSearch(): Promise<void> {
  if (!state.searchEngine) {
    return;
  }

  const query = elements.searchInput.value.trim();
  if (!query) {
    state.searchEngine.clearSearch();
    state.searchResults = [];
    state.currentSearchIndex = -1;
    updateSearchResults();
    clearAllHighlights();
    return;
  }

  setStatus("Searching...");

  await state.searchEngine.search(query, {
    caseSensitive: elements.searchCase.checked,
    wholeWord: elements.searchWhole.checked,
  });

  setStatus("Ready");
}

function updateSearchResults(): void {
  const count = state.searchResults.length;
  const current = state.currentSearchIndex;

  if (count === 0) {
    elements.searchResults.textContent = elements.searchInput.value.trim() ? "No results" : "";
  } else {
    elements.searchResults.textContent = `${current + 1} of ${count}`;
  }

  elements.btnSearchPrev.disabled = count === 0;
  elements.btnSearchNext.disabled = count === 0;

  // Update highlights on all pages with text spans
  for (const pageIndex of state.pageTextSpans.keys()) {
    highlightSearchResults(pageIndex);
  }
}

function highlightSearchResults(pageIndex: number): void {
  const textSpans = state.pageTextSpans.get(pageIndex);
  if (!textSpans) {
    return;
  }

  // Clear existing highlights from all spans on this page
  for (const spanInfo of textSpans) {
    spanInfo.element.classList.remove("highlight", "selected");
    const highlightSpans = spanInfo.element.querySelectorAll(".highlight");
    highlightSpans.forEach(el => el.remove());
    spanInfo.element.textContent = spanInfo.text;
  }

  // Get results for this page
  const pageResults = state.searchResults.filter(r => r.pageIndex === pageIndex);

  if (pageResults.length === 0) {
    return;
  }

  // For each result, find overlapping text spans and add highlight class
  for (const result of pageResults) {
    const isCurrent =
      state.currentSearchIndex >= 0 && state.searchResults[state.currentSearchIndex] === result;

    for (const spanInfo of textSpans) {
      // Check if this span overlaps with the search result
      if (spanInfo.endOffset > result.startOffset && spanInfo.startOffset < result.endOffset) {
        const overlapStart =
          Math.max(result.startOffset, spanInfo.startOffset) - spanInfo.startOffset;
        const overlapEnd = Math.min(result.endOffset, spanInfo.endOffset) - spanInfo.startOffset;

        if (overlapStart === 0 && overlapEnd === spanInfo.text.length) {
          spanInfo.element.classList.add("highlight");
          if (isCurrent) {
            spanInfo.element.classList.add("selected");
          }
        } else {
          // Partial highlight
          const beforeText = spanInfo.text.slice(0, overlapStart);
          const highlightText = spanInfo.text.slice(overlapStart, overlapEnd);
          const afterText = spanInfo.text.slice(overlapEnd);

          spanInfo.element.textContent = "";

          if (beforeText) {
            spanInfo.element.appendChild(document.createTextNode(beforeText));
          }

          const highlightSpan = document.createElement("span");
          highlightSpan.className = "highlight";
          if (isCurrent) {
            highlightSpan.classList.add("selected");
          }
          highlightSpan.textContent = highlightText;
          spanInfo.element.appendChild(highlightSpan);

          if (afterText) {
            spanInfo.element.appendChild(document.createTextNode(afterText));
          }
        }
      }
    }
  }
}

function clearAllHighlights(): void {
  for (const pageIndex of state.pageTextSpans.keys()) {
    const textSpans = state.pageTextSpans.get(pageIndex);
    if (textSpans) {
      for (const spanInfo of textSpans) {
        spanInfo.element.classList.remove("highlight", "selected");
        spanInfo.element.textContent = spanInfo.text;
      }
    }
  }
}

function scrollToCurrentResult(): void {
  if (state.currentSearchIndex < 0 || state.currentSearchIndex >= state.searchResults.length) {
    return;
  }

  const result = state.searchResults[state.currentSearchIndex];
  if (!state.virtualScroller) {
    return;
  }

  // Go to the page with the result
  const layout = state.virtualScroller.getPageLayout(result.pageIndex);
  if (!layout) {
    goToPage(result.pageIndex + 1);
    return;
  }

  // Calculate scroll position to center the result
  const viewerRect = elements.viewer.getBoundingClientRect();
  const targetScrollTop = layout.top + layout.height / 2 - viewerRect.height / 2;
  const targetScrollLeft = Math.max(0, layout.left - (viewerRect.width - layout.width) / 2);

  elements.viewer.scrollTo({
    top: Math.max(0, targetScrollTop),
    left: targetScrollLeft,
    behavior: "smooth",
  });

  state.currentPage = result.pageIndex + 1;
  updatePageControls();
}

function searchNext(): void {
  if (state.searchEngine) {
    state.searchEngine.findNext();
  }
}

function searchPrev(): void {
  if (state.searchEngine) {
    state.searchEngine.findPrevious();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Event System
// ─────────────────────────────────────────────────────────────────────────────

type EventType = "pdf:ready" | "scale:changed" | "page:rendered" | "page:changed";

interface EventPayloads {
  "pdf:ready": { pageCount: number; fileName?: string };
  "scale:changed": { previousScale: number; currentScale: number };
  "page:rendered": { pageIndex: number };
  "page:changed": { previousPage: number; currentPage: number };
}

type EventListener<T extends EventType> = (payload: EventPayloads[T]) => void;

const eventListeners = new Map<EventType, Set<EventListener<any>>>();

function addEventListener<T extends EventType>(type: T, listener: EventListener<T>): () => void {
  if (!eventListeners.has(type)) {
    eventListeners.set(type, new Set());
  }
  eventListeners.get(type)!.add(listener);

  return () => {
    eventListeners.get(type)?.delete(listener);
  };
}

function emitEvent<T extends EventType>(type: T, payload: EventPayloads[T]): void {
  const listeners = eventListeners.get(type);
  if (listeners) {
    for (const listener of listeners) {
      try {
        listener(payload);
      } catch (error) {
        console.error(`Error in event listener for ${type}:`, error);
      }
    }
  }
  window.dispatchEvent(new CustomEvent(`libpdf:${type}`, { detail: payload }));
}

// Set up default event logging
addEventListener("pdf:ready", payload => {
  console.log("[Event] PDF Ready:", payload);
});

addEventListener("scale:changed", payload => {
  console.log("[Event] Scale Changed:", payload);
});

addEventListener("page:rendered", payload => {
  console.log("[Event] Page Rendered:", payload);
});

addEventListener("page:changed", payload => {
  console.log("[Event] Page Changed:", payload);
});

// ─────────────────────────────────────────────────────────────────────────────
// UI Helpers
// ─────────────────────────────────────────────────────────────────────────────

function setStatus(message: string): void {
  elements.statusText.textContent = message;
}

function setProgress(progress: string): void {
  elements.statusProgress.textContent = progress;
}

function enableControls(): void {
  elements.btnFirst.disabled = false;
  elements.btnPrev.disabled = false;
  elements.btnNext.disabled = false;
  elements.btnLast.disabled = false;
  elements.pageInput.disabled = false;
  elements.btnZoomOut.disabled = false;
  elements.btnZoomIn.disabled = false;
  elements.zoomSelect.disabled = false;
  elements.btnRotateCcw.disabled = false;
  elements.btnRotateCw.disabled = false;
  elements.searchInput.disabled = false;
  elements.searchCase.disabled = false;
  elements.searchWhole.disabled = false;
}

function disableControls(): void {
  elements.btnFirst.disabled = true;
  elements.btnPrev.disabled = true;
  elements.btnNext.disabled = true;
  elements.btnLast.disabled = true;
  elements.pageInput.disabled = true;
  elements.btnZoomOut.disabled = true;
  elements.btnZoomIn.disabled = true;
  elements.zoomSelect.disabled = true;
  elements.btnRotateCcw.disabled = true;
  elements.btnRotateCw.disabled = true;
  elements.searchInput.disabled = true;
  elements.btnSearchPrev.disabled = true;
  elements.btnSearchNext.disabled = true;
  elements.searchCase.disabled = true;
  elements.searchWhole.disabled = true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Handlers
// ─────────────────────────────────────────────────────────────────────────────

function setupEventHandlers(): void {
  // File input
  elements.fileInput.addEventListener("change", async event => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      await loadPDF(file);
    }
  });

  // Navigation
  elements.btnFirst.addEventListener("click", () => goToPage(1));
  elements.btnPrev.addEventListener("click", () => goToPage(state.currentPage - 1));
  elements.btnNext.addEventListener("click", () => goToPage(state.currentPage + 1));
  elements.btnLast.addEventListener("click", () => goToPage(state.pdf?.getPageCount() ?? 1));

  elements.pageInput.addEventListener("change", () => {
    const page = parseInt(elements.pageInput.value, 10);
    if (!isNaN(page)) {
      goToPage(page);
    }
  });

  elements.pageInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      const page = parseInt(elements.pageInput.value, 10);
      if (!isNaN(page)) {
        goToPage(page);
      }
    }
  });

  // Zoom
  elements.btnZoomOut.addEventListener("click", () => void zoomOut());
  elements.btnZoomIn.addEventListener("click", () => void zoomIn());

  elements.zoomSelect.addEventListener("change", () => {
    const value = elements.zoomSelect.value;
    if (value === "fit-width") {
      void fitWidth();
    } else if (value === "fit-page") {
      void fitPage();
    } else {
      const scale = parseFloat(value);
      if (!isNaN(scale)) {
        void setScale(scale);
      }
    }
  });

  // Rotation
  elements.btnRotateCcw.addEventListener("click", () => void rotate(-90));
  elements.btnRotateCw.addEventListener("click", () => void rotate(90));

  // Search
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  elements.searchInput.addEventListener("input", () => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    searchTimeout = setTimeout(() => void performSearch(), 300);
  });

  elements.searchInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      if (event.shiftKey) {
        searchPrev();
      } else {
        searchNext();
      }
    }
  });

  elements.btnSearchPrev.addEventListener("click", searchPrev);
  elements.btnSearchNext.addEventListener("click", searchNext);

  elements.searchCase.addEventListener("change", () => void performSearch());
  elements.searchWhole.addEventListener("change", () => void performSearch());

  // Keyboard shortcuts
  document.addEventListener("keydown", event => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    switch (event.key) {
      case "ArrowLeft":
      case "PageUp":
        goToPage(state.currentPage - 1);
        event.preventDefault();
        break;
      case "ArrowRight":
      case "PageDown":
        goToPage(state.currentPage + 1);
        event.preventDefault();
        break;
      case "Home":
        goToPage(1);
        event.preventDefault();
        break;
      case "End":
        goToPage(state.pdf?.getPageCount() ?? 1);
        event.preventDefault();
        break;
      case "+":
      case "=":
        if (event.ctrlKey || event.metaKey) {
          void zoomIn();
          event.preventDefault();
        }
        break;
      case "-":
        if (event.ctrlKey || event.metaKey) {
          void zoomOut();
          event.preventDefault();
        }
        break;
      case "f":
        if (event.ctrlKey || event.metaKey) {
          elements.searchInput.focus();
          event.preventDefault();
        }
        break;
    }
  });

  // Handle drag and drop
  elements.viewer.addEventListener("dragover", event => {
    event.preventDefault();
    event.dataTransfer!.dropEffect = "copy";
    elements.viewer.classList.add("drag-over");
  });

  elements.viewer.addEventListener("dragleave", () => {
    elements.viewer.classList.remove("drag-over");
  });

  elements.viewer.addEventListener("drop", async event => {
    event.preventDefault();
    elements.viewer.classList.remove("drag-over");

    const file = event.dataTransfer?.files[0];
    if (file && file.type === "application/pdf") {
      await loadPDF(file);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature Showcase Panel
// ─────────────────────────────────────────────────────────────────────────────

const showcaseElements = {
  featurePanel: document.getElementById("feature-panel") as HTMLElement,
  togglePanelBtn: document.getElementById("toggle-panel") as HTMLButtonElement,
  eventLog: document.getElementById("event-log") as HTMLDivElement,
  btnClearLog: document.getElementById("btn-clear-log") as HTMLButtonElement,
  btnTestEvents: document.getElementById("btn-test-events") as HTMLButtonElement,
  btnTestZoom: document.getElementById("btn-test-zoom") as HTMLButtonElement,
  btnTestNavigation: document.getElementById("btn-test-navigation") as HTMLButtonElement,
};

function logEvent(type: string, data: Record<string, unknown>): void {
  const log = showcaseElements.eventLog;
  const time = new Date().toLocaleTimeString();

  const entry = document.createElement("div");
  entry.className = "event-entry";
  entry.innerHTML = `
    <span class="event-time">${time}</span>
    <span class="event-type">${type}</span>
    <span class="event-data">${JSON.stringify(data)}</span>
  `;

  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

function setupShowcasePanel(): void {
  // Toggle panel visibility
  showcaseElements.togglePanelBtn.addEventListener("click", () => {
    showcaseElements.featurePanel.classList.toggle("open");
  });

  // Clear event log
  showcaseElements.btnClearLog.addEventListener("click", () => {
    showcaseElements.eventLog.innerHTML = "";
    logEvent("log:cleared", {});
  });

  // Test Events button
  showcaseElements.btnTestEvents.addEventListener("click", () => {
    logEvent("test:manual", { message: "Manual test event triggered" });
    emitEvent("pdf:ready", { pageCount: 0, fileName: "test-event.pdf" });
  });

  // Test Zoom button
  showcaseElements.btnTestZoom.addEventListener("click", async () => {
    if (state.pdf) {
      const scales = [0.5, 1, 1.5, 2, 1];
      for (const scale of scales) {
        await setScale(scale);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } else {
      logEvent("test:error", { message: "No PDF loaded - open a PDF first" });
    }
  });

  // Test Navigation button
  showcaseElements.btnTestNavigation.addEventListener("click", async () => {
    if (state.pdf && state.pdf.getPageCount() > 1) {
      const pageCount = state.pdf.getPageCount();
      goToPage(1);
      await new Promise(resolve => setTimeout(resolve, 500));
      goToPage(Math.min(3, pageCount));
      await new Promise(resolve => setTimeout(resolve, 500));
      goToPage(pageCount);
      await new Promise(resolve => setTimeout(resolve, 500));
      goToPage(1);
    } else {
      logEvent("test:error", { message: "Need a multi-page PDF to test navigation" });
    }
  });

  // Connect event system to log panel
  addEventListener("pdf:ready", payload => {
    logEvent("pdf:ready", payload as unknown as Record<string, unknown>);
  });

  addEventListener("scale:changed", payload => {
    logEvent("scale:changed", payload as unknown as Record<string, unknown>);
  });

  addEventListener("page:rendered", payload => {
    logEvent("page:rendered", payload as unknown as Record<string, unknown>);
  });

  addEventListener("page:changed", payload => {
    logEvent("page:changed", payload as unknown as Record<string, unknown>);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────────────────────────────────────

function init(): void {
  setupEventHandlers();
  setupShowcasePanel();
  disableControls();
  setStatus("Ready - Open a PDF file to begin (Native LibPDF rendering)");

  logEvent("app:initialized", {
    features: [
      "Native CanvasRenderer",
      "VirtualScroller",
      "ViewportManager",
      "Coordinate Transformation",
      "DOM Text Layer",
      "Text Search",
      "Zoom Controls",
      "Page Navigation",
      "Rotation",
      "Keyboard Shortcuts",
    ],
  });
}

// Start the demo
init();
