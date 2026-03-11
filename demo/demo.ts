/**
 * LibPDF Viewer Demo
 *
 * A comprehensive demo application showcasing the PDF viewing capabilities
 * of the @libpdf/core library using PDF.js for rendering. Includes
 * navigation, zoom, rotation, and text search functionality.
 */

import {
  buildPDFJSTextLayer,
  createPDFJSRenderer,
  createPDFJSSearchEngine,
  createVirtualScroller,
  createViewportManager,
  initializePDFJS,
  loadPDFJSDocument,
  type PageDimensions,
  type PDFDocumentProxy,
  type PDFJSSearchEngine,
  type ViewportManager,
  type VirtualScroller,
} from "../src";

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

interface TextSpanInfo {
  element: HTMLElement;
  text: string;
  startOffset: number;
  endOffset: number;
}

interface DemoState {
  pdfDocument: PDFDocumentProxy | null;
  pdfBytes: Uint8Array | null;
  scale: number;
  rotation: number;
  currentPage: number;
  viewportManager: ViewportManager | null;
  virtualScroller: VirtualScroller | null;
  searchEngine: PDFJSSearchEngine | null;
  pageElements: Map<number, HTMLElement>;
  pageTextSpans: Map<number, TextSpanInfo[]>;
}

const state: DemoState = {
  pdfDocument: null,
  pdfBytes: null,
  scale: 1,
  rotation: 0,
  currentPage: 1,
  viewportManager: null,
  virtualScroller: null,
  searchEngine: null,
  pageElements: new Map(),
  pageTextSpans: new Map(),
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

  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    state.pdfBytes = bytes;

    // Initialize PDF.js if not already done
    // Use CDN worker for browser environment
    await initializePDFJS({
      workerSrc: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs",
    });

    // Load the document using PDF.js
    state.pdfDocument = await loadPDFJSDocument(bytes);

    setStatus(`Loaded: ${file.name}`);
    await initializeViewer();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(`Error: ${message}`);
    console.error("Failed to load PDF:", error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Viewer Initialization
// ─────────────────────────────────────────────────────────────────────────────

async function initializeViewer(): Promise<void> {
  if (!state.pdfDocument) {
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
  const pageCount = state.pdfDocument.numPages;
  const pageDimensions: PageDimensions[] = [];

  for (let i = 0; i < pageCount; i++) {
    // PDF.js uses 1-based page numbers
    const page = await state.pdfDocument.getPage(i + 1);
    const viewport = page.getViewport({ scale: 1 });
    pageDimensions.push({
      width: viewport.width,
      height: viewport.height,
    });
  }

  // Create virtual scroller
  // Use clientWidth/clientHeight for accurate viewport size (excludes scrollbars)
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
  // Set width to total content width - pages are centered within this by VirtualScroller
  contentContainer.style.width = `${Math.max(state.virtualScroller.totalWidth, elements.viewer.clientWidth)}px`;
  contentContainer.style.height = `${state.virtualScroller.totalHeight}px`;
  elements.viewer.appendChild(contentContainer);

  // Store reference to content container for page placement
  (state as any).contentContainer = contentContainer;

  // Handle scroll events to update virtual scroller
  elements.viewer.addEventListener("scroll", () => {
    if (state.virtualScroller) {
      state.virtualScroller.scrollTo(elements.viewer.scrollLeft, elements.viewer.scrollTop);
    }
  });

  // Create PDF.js renderer for viewport manager
  const renderer = createPDFJSRenderer();
  await renderer.initialize();

  // Load the document into the renderer
  if (state.pdfBytes) {
    await renderer.loadDocument(state.pdfBytes);
  }

  // Create viewport manager for page rendering
  state.viewportManager = createViewportManager({
    scroller: state.virtualScroller,
    renderer: renderer,
    pageSource: createPageSource(),
    maxConcurrentRenders: 3,
  });

  // Set up scroller events for page tracking
  state.virtualScroller.addEventListener("visiblechange", event => {
    if (event.range) {
      // Update current page
      if (event.range.startIndex + 1 !== state.currentPage) {
        state.currentPage = event.range.startIndex + 1;
        updatePageControls();
      }
    }
  });

  // Set up viewport manager events
  state.viewportManager.addEventListener("pageRendered", event => {
    if (event.element && state.virtualScroller && state.pdfDocument) {
      // Get page layout from virtual scroller for positioning
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

      // The element from ViewportManager is a cloned canvas (renderer clones it)
      const canvas = event.element as HTMLCanvasElement;

      // Position and size the container based on layout
      container.style.position = "absolute";
      container.style.left = `${layout.left}px`;
      container.style.top = `${layout.top}px`;
      container.style.width = `${layout.width}px`;
      container.style.height = `${layout.height}px`;

      // Clear container and add the canvas
      container.innerHTML = "";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.position = "absolute";
      canvas.style.left = "0";
      canvas.style.top = "0";
      container.appendChild(canvas);

      // Add text layer for text selection
      const pdfDocument = state.pdfDocument;
      const scale = state.scale;
      const pageIndex = event.pageIndex;
      void (async () => {
        try {
          const page = await pdfDocument.getPage(pageIndex + 1);
          const viewport = page.getViewport({ scale });

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

          // Build text layer using PDF.js
          const result = await buildPDFJSTextLayer(page, {
            container: textLayerDiv,
            viewport: viewport as any,
          });

          // Store text spans for highlighting
          state.pageTextSpans.set(pageIndex, result.textSpans);

          container!.appendChild(textLayerDiv);

          // Highlight search results on this page
          highlightSearchResults(pageIndex);
        } catch (err) {
          console.error(`Failed to build text layer for page ${pageIndex}:`, err);
        }
      })();
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

function createPageSource() {
  return {
    getPageCount: () => state.pdfDocument?.numPages ?? 0,
    getPageDimensions: async (pageIndex: number) => {
      if (!state.pdfDocument) {
        return { width: 0, height: 0 };
      }
      const page = await state.pdfDocument.getPage(pageIndex + 1);
      const viewport = page.getViewport({ scale: 1 });
      return { width: viewport.width, height: viewport.height };
    },
    getPageRotation: async (pageIndex: number) => {
      if (!state.pdfDocument) {
        return 0;
      }
      const page = await state.pdfDocument.getPage(pageIndex + 1);
      return page.rotate ?? 0;
    },
    // PDF.js handles content rendering internally, so we don't need these
    getPageContentBytes: async (_pageIndex: number): Promise<Uint8Array | null> => {
      return null;
    },
    getPageFontResolver: async (_pageIndex: number) => {
      return null;
    },
  };
}

function cleanupViewer(): void {
  // VirtualScroller doesn't have resources to clean up, just clear reference
  state.virtualScroller = null;

  if (state.viewportManager) {
    state.viewportManager.dispose();
    state.viewportManager = null;
  }
  if (state.searchEngine) {
    state.searchEngine.clearSearch();
    state.searchEngine = null;
  }
  state.pageElements.clear();
  state.pageTextSpans.clear();
  elements.viewer.innerHTML = "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────────────────────────────────────

function goToPage(pageNumber: number): void {
  if (!state.pdfDocument || !state.virtualScroller) {
    return;
  }

  const pageCount = state.pdfDocument.numPages;
  const clampedPage = Math.max(1, Math.min(pageNumber, pageCount));

  state.currentPage = clampedPage;

  // Get the page layout to calculate scroll position
  const layout = state.virtualScroller.getPageLayout(clampedPage - 1);
  if (layout) {
    // Scroll the DOM element to the page position with smooth animation
    elements.viewer.scrollTo({
      top: Math.max(0, layout.top - 20), // Small offset from top
      left: Math.max(0, layout.left - (elements.viewer.clientWidth - layout.width) / 2),
      behavior: "smooth",
    });
  }

  updatePageControls();
}

function updatePageControls(): void {
  if (!state.pdfDocument) {
    return;
  }

  const pageCount = state.pdfDocument.numPages;
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

  state.scale = newScale;

  // Update zoom select to reflect current scale
  const option = Array.from(elements.zoomSelect.options).find(
    opt => Math.abs(Number(opt.value) - state.scale) < 0.01,
  );

  if (option) {
    elements.zoomSelect.value = option.value;
  } else {
    // Custom scale, show percentage
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
    // Store current scroll position ratio to maintain position after resize
    const scrollRatioY = elements.viewer.scrollTop / (elements.viewer.scrollHeight || 1);
    const scrollRatioX = elements.viewer.scrollLeft / (elements.viewer.scrollWidth || 1);

    state.virtualScroller.setScale(state.scale);

    // Update viewport size to reflect any changes in viewer dimensions
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

    // Re-apply search highlights after a short delay to ensure text layers are built
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
  if (!state.pdfDocument || !state.virtualScroller) {
    return;
  }

  const page = await state.pdfDocument.getPage(state.currentPage);
  const viewport = page.getViewport({ scale: 1 });
  const containerWidth = elements.viewer.clientWidth - 40; // Account for padding
  const newScale = containerWidth / viewport.width;
  await setScale(newScale);
}

async function fitPage(): Promise<void> {
  if (!state.pdfDocument || !state.virtualScroller) {
    return;
  }

  const page = await state.pdfDocument.getPage(state.currentPage);
  const viewport = page.getViewport({ scale: 1 });
  const containerWidth = elements.viewer.clientWidth - 40;
  const containerHeight = elements.viewer.clientHeight - 40;

  const scaleX = containerWidth / viewport.width;
  const scaleY = containerHeight / viewport.height;
  await setScale(Math.min(scaleX, scaleY));
}

// ─────────────────────────────────────────────────────────────────────────────
// Rotation
// ─────────────────────────────────────────────────────────────────────────────

function rotate(degrees: number): void {
  state.rotation = (state.rotation + degrees + 360) % 360;

  // Re-render all visible pages
  if (state.viewportManager) {
    void state.viewportManager.invalidateVisiblePages();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────────────────────────────────────

function initializeSearch(): void {
  if (!state.pdfDocument) {
    return;
  }

  state.searchEngine = createPDFJSSearchEngine();
  state.searchEngine.setDocument(state.pdfDocument);

  state.searchEngine.addListener(searchState => {
    updateSearchResults();
    if (!searchState.searching && searchState.results.length > 0) {
      scrollToCurrentResult();
    }
  });
}

async function performSearch(): Promise<void> {
  if (!state.searchEngine) {
    return;
  }

  const query = elements.searchInput.value.trim();
  if (!query) {
    state.searchEngine.clearSearch();
    updateSearchResults();
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
  if (!state.searchEngine) {
    elements.searchResults.textContent = "";
    return;
  }

  const searchState = state.searchEngine.state;
  const count = searchState.results.length;
  const current = searchState.currentIndex;

  if (count === 0) {
    elements.searchResults.textContent = searchState.query ? "No results" : "";
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
  if (!state.searchEngine) {
    return;
  }

  const textSpans = state.pageTextSpans.get(pageIndex);
  if (!textSpans) {
    return;
  }

  // Clear existing highlights from all spans on this page
  for (const spanInfo of textSpans) {
    spanInfo.element.classList.remove("highlight", "selected");
    // Remove any highlight wrapper spans we may have created
    const highlightSpans = spanInfo.element.querySelectorAll(".highlight");
    highlightSpans.forEach(el => el.remove());
    // Reset inner HTML to just the text
    spanInfo.element.textContent = spanInfo.text;
  }

  const results = state.searchEngine.getResultsForPage(pageIndex);
  const currentResult = state.searchEngine.currentResult;

  if (results.length === 0) {
    return;
  }

  // For each result, find overlapping text spans and add highlight class
  for (const result of results) {
    const isCurrent = currentResult && currentResult.resultIndex === result.resultIndex;

    // Find all text spans that overlap with this result
    for (const spanInfo of textSpans) {
      // Check if this span overlaps with the search result
      if (spanInfo.endOffset > result.startOffset && spanInfo.startOffset < result.endOffset) {
        // Calculate the overlap within this span
        const overlapStart =
          Math.max(result.startOffset, spanInfo.startOffset) - spanInfo.startOffset;
        const overlapEnd = Math.min(result.endOffset, spanInfo.endOffset) - spanInfo.startOffset;

        // If the entire span is highlighted
        if (overlapStart === 0 && overlapEnd === spanInfo.text.length) {
          spanInfo.element.classList.add("highlight");
          if (isCurrent) {
            spanInfo.element.classList.add("selected");
          }
        } else {
          // Partial highlight - need to wrap the highlighted portion in a span
          const beforeText = spanInfo.text.slice(0, overlapStart);
          const highlightText = spanInfo.text.slice(overlapStart, overlapEnd);
          const afterText = spanInfo.text.slice(overlapEnd);

          // Clear the span and rebuild with highlight
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

async function scrollToCurrentResult(): Promise<void> {
  const result = state.searchEngine?.currentResult;
  if (!result || !state.virtualScroller || !state.pdfDocument) {
    return;
  }

  // Get the page layout to calculate absolute position
  const layout = state.virtualScroller.getPageLayout(result.pageIndex);
  if (!layout) {
    // Fallback to just going to the page
    goToPage(result.pageIndex + 1);
    return;
  }

  // Try to find the actual highlighted element
  const textSpans = state.pageTextSpans.get(result.pageIndex);
  let resultY = layout.height / 2; // Default to middle of page

  if (textSpans) {
    // Find the first span that contains the search result
    for (const spanInfo of textSpans) {
      if (spanInfo.endOffset > result.startOffset && spanInfo.startOffset < result.endOffset) {
        // Found a span with the highlight - get its position
        const rect = spanInfo.element.getBoundingClientRect();
        const container = state.pageElements.get(result.pageIndex);
        if (container) {
          const containerRect = container.getBoundingClientRect();
          resultY = rect.top - containerRect.top;
        }
        break;
      }
    }
  } else if (result.bounds) {
    // Fallback to bounds-based calculation
    const page = await state.pdfDocument.getPage(result.pageIndex + 1);
    const viewport = page.getViewport({ scale: state.scale });
    resultY = viewport.height - result.bounds.y * state.scale - result.bounds.height * state.scale;
  }

  // Calculate absolute scroll position
  // Position the result in the center of the viewport
  const viewerRect = elements.viewer.getBoundingClientRect();
  const targetScrollTop = layout.top + resultY - viewerRect.height / 2 + 50;
  const targetScrollLeft = Math.max(0, layout.left - (viewerRect.width - layout.width) / 2);

  // Smooth scroll to the result
  elements.viewer.scrollTo({
    top: Math.max(0, targetScrollTop),
    left: targetScrollLeft,
    behavior: "smooth",
  });

  // Update current page
  state.currentPage = result.pageIndex + 1;
  updatePageControls();

  // Update highlights after scrolling
  const container = state.pageElements.get(result.pageIndex);
  if (container) {
    await highlightSearchResults(result.pageIndex, container);
  }
}

function searchNext(): void {
  state.searchEngine?.findNext();
  updateSearchResults();
  void scrollToCurrentResult();
}

function searchPrev(): void {
  state.searchEngine?.findPrevious();
  updateSearchResults();
  void scrollToCurrentResult();
}

// ─────────────────────────────────────────────────────────────────────────────
// UI Helpers
// ─────────────────────────────────────────────────────────────────────────────

function setStatus(message: string): void {
  elements.statusText.textContent = message;
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
  elements.btnLast.addEventListener("click", () => goToPage(state.pdfDocument?.numPages ?? 1));

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
  elements.btnRotateCcw.addEventListener("click", () => rotate(-90));
  elements.btnRotateCw.addEventListener("click", () => rotate(90));

  // Search
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  elements.searchInput.addEventListener("input", () => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    searchTimeout = setTimeout(performSearch, 300);
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

  elements.searchCase.addEventListener("change", performSearch);
  elements.searchWhole.addEventListener("change", performSearch);

  // Keyboard shortcuts
  document.addEventListener("keydown", event => {
    // Don't handle shortcuts when typing in inputs
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
        goToPage(state.pdfDocument?.numPages ?? 1);
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
// Initialization
// ─────────────────────────────────────────────────────────────────────────────

function init(): void {
  setupEventHandlers();
  disableControls();
  setStatus("Ready - Open a PDF file to begin");
}

// Start the demo
init();
