/**
 * LibPDF Viewer Demo
 *
 * A comprehensive demo application showcasing the PDF viewing capabilities
 * of the @libpdf/core library using PDF.js for rendering. Includes
 * navigation, zoom, rotation, and text search functionality.
 */

import {
  buildPDFJSTextLayer,
  createBoundingBoxControls,
  createBoundingBoxOverlay,
  createPDFJSRenderer,
  createPDFJSSearchEngine,
  createPDFResourceLoader,
  createVirtualScroller,
  createViewportManager,
  initializePDFJS,
  type BoundingBoxControls,
  type BoundingBoxOverlay,
  type OverlayBoundingBox,
  type PageDimensions,
  type PDFDocumentProxy,
  type PDFJSSearchEngine,
  type PDFResourceLoader,
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
  resourceLoader: PDFResourceLoader | null;
  pageElements: Map<number, HTMLElement>;
  pageTextSpans: Map<number, TextSpanInfo[]>;
  boundingBoxOverlay: BoundingBoxOverlay | null;
  boundingBoxControls: BoundingBoxControls | null;
  pageDimensions: Map<number, { width: number; height: number }>;
  searchHighlightOverlays: Map<number, HTMLElement>;
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
  resourceLoader: null,
  pageElements: new Map(),
  pageTextSpans: new Map(),
  boundingBoxOverlay: null,
  boundingBoxControls: null,
  pageDimensions: new Map(),
  searchHighlightOverlays: new Map(),
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
// Resource Loader Setup
// ─────────────────────────────────────────────────────────────────────────────

function getResourceLoader(): PDFResourceLoader {
  if (!state.resourceLoader) {
    state.resourceLoader = createPDFResourceLoader({
      workerSrc: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs",
      maxRetries: 3,
      timeout: 30000,
      onProgress: (loaded, total) => {
        if (total > 0) {
          const percent = Math.round((loaded / total) * 100);
          setProgress(`${percent}%`);
        } else {
          setProgress(`${Math.round(loaded / 1024)}KB`);
        }
      },
      // Example auth refresh callback (can be customized by applications)
      onAuthRefresh: async () => {
        console.log("Auth refresh requested - implement your token refresh logic here");
        // Return new auth config or null to abort
        // return { authorization: 'Bearer new-token' };
        return null;
      },
      // Example URL refresh callback for signed URLs
      onUrlRefresh: async originalUrl => {
        console.log("URL refresh requested for:", originalUrl);
        // Return new URL or null to abort
        // return getNewSignedUrl(originalUrl);
        return null;
      },
    });
  }
  return state.resourceLoader;
}

// ─────────────────────────────────────────────────────────────────────────────
// File Loading
// ─────────────────────────────────────────────────────────────────────────────

async function loadPDF(file: File): Promise<void> {
  setStatus("Loading PDF...");
  setProgress("");

  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Use the resource loader
    const loader = getResourceLoader();
    const result = await loader.load({ type: "bytes", data: bytes });

    state.pdfDocument = result.document;
    state.pdfBytes = result.bytes ?? bytes;

    setStatus(`Loaded: ${file.name}`);
    setProgress("");
    emitEvent("pdf:ready", { pageCount: result.document.numPages, fileName: file.name });
    await initializeViewer();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(`Error: ${message}`);
    setProgress("");
    console.error("Failed to load PDF:", error);
  }
}

/**
 * Load a PDF from a URL using the resource loader.
 * Supports authentication headers and 403 error recovery.
 */
async function loadPDFFromUrl(url: string): Promise<void> {
  setStatus("Downloading PDF...");
  setProgress("0%");

  try {
    const loader = getResourceLoader();
    const result = await loader.load({ type: "url", url });

    state.pdfDocument = result.document;
    state.pdfBytes = result.bytes ?? null;

    const fileName = url.split("/").pop() || "document.pdf";
    setStatus(`Loaded: ${fileName}`);
    setProgress("");
    emitEvent("pdf:ready", { pageCount: result.document.numPages, fileName, sourceUrl: url });
    await initializeViewer();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(`Error: ${message}`);
    setProgress("");
    console.error("Failed to load PDF from URL:", error);
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
    const dims = {
      width: viewport.width,
      height: viewport.height,
    };
    pageDimensions.push(dims);
    // Store dimensions for bounding box overlay
    state.pageDimensions.set(i, dims);
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
      const newPage = event.range.startIndex + 1;
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

          // Render bounding box overlay if available
          if (state.boundingBoxOverlay && container) {
            const pageDims = state.pageDimensions.get(pageIndex);
            if (pageDims) {
              state.boundingBoxOverlay.renderToPage(pageIndex, container, scale, pageDims.height);
            }
          }

          // Emit page rendered event
          emitEvent("page:rendered", { pageIndex });
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
  // Clean up bounding box overlay
  if (state.boundingBoxOverlay) {
    state.boundingBoxOverlay.removeAllOverlays();
    state.boundingBoxOverlay.clearAllBoundingBoxes();
  }
  // Clean up search highlight overlays
  clearAllSearchHighlightOverlays();
  state.pageElements.clear();
  state.pageTextSpans.clear();
  state.pageDimensions.clear();
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

  const previousPage = state.currentPage;
  state.currentPage = clampedPage;

  // Emit page changed event if page actually changed
  if (previousPage !== clampedPage) {
    emitEvent("page:changed", { previousPage, currentPage: clampedPage });
  }

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

  const previousScale = state.scale;
  state.scale = newScale;

  // Emit scale changed event
  emitEvent("scale:changed", { previousScale, currentScale: newScale });

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
    state.searchHighlightOverlays.clear();

    // Update bounding box overlay scale
    if (state.boundingBoxOverlay) {
      state.boundingBoxOverlay.removeAllOverlays();
    }

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
    // Clear bounding box overlay when no results
    clearSearchHighlightOverlay(pageIndex);
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

  // Render bounding box overlays for search results
  renderSearchHighlightOverlay(pageIndex, results, currentResult?.resultIndex ?? -1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Search Bounding Box Overlays
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates or updates the search highlight overlay for a page.
 * This renders semi-transparent rectangles over all search matches,
 * with the current match having a distinct appearance.
 */
function renderSearchHighlightOverlay(
  pageIndex: number,
  results: {
    bounds?: { x: number; y: number; width: number; height: number };
    boundsArray?: { x: number; y: number; width: number; height: number }[];
    resultIndex: number;
  }[],
  currentResultIndex: number,
): void {
  const container = state.pageElements.get(pageIndex);
  if (!container) {
    return;
  }

  const pageDims = state.pageDimensions.get(pageIndex);
  if (!pageDims) {
    return;
  }

  // Get or create the search highlight overlay
  let overlay = state.searchHighlightOverlays.get(pageIndex);
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "search-highlight-overlay";
    overlay.style.position = "absolute";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.right = "0";
    overlay.style.bottom = "0";
    overlay.style.pointerEvents = "none";
    overlay.style.overflow = "hidden";
    overlay.style.zIndex = "5"; // Above canvas but below text layer
    state.searchHighlightOverlays.set(pageIndex, overlay);
  }

  // Clear existing content
  overlay.innerHTML = "";

  // Append to container if not already there
  if (overlay.parentElement !== container) {
    // Insert before text layer if present, otherwise append
    const textLayer = container.querySelector(".text-layer");
    if (textLayer) {
      container.insertBefore(overlay, textLayer);
    } else {
      container.appendChild(overlay);
    }
  }

  const scale = state.scale;
  const pageHeight = pageDims.height;

  // Create highlight rectangles for each result
  const fragment = document.createDocumentFragment();

  for (const result of results) {
    const isCurrent = result.resultIndex === currentResultIndex;
    const boundsArray = result.boundsArray ?? (result.bounds ? [result.bounds] : []);

    for (const bounds of boundsArray) {
      const rect = document.createElement("div");
      rect.className = isCurrent ? "search-highlight current" : "search-highlight";

      // Convert PDF coordinates to screen coordinates
      // PDF coordinates have origin at bottom-left, screen at top-left
      // The bounds.y is the baseline Y position in PDF coordinates
      const screenY = pageHeight - bounds.y - bounds.height;

      rect.style.left = `${bounds.x * scale}px`;
      rect.style.top = `${screenY * scale}px`;
      rect.style.width = `${bounds.width * scale}px`;
      rect.style.height = `${bounds.height * scale}px`;

      fragment.appendChild(rect);
    }
  }

  overlay.appendChild(fragment);
}

/**
 * Clears the search highlight overlay for a specific page.
 */
function clearSearchHighlightOverlay(pageIndex: number): void {
  const overlay = state.searchHighlightOverlays.get(pageIndex);
  if (overlay) {
    overlay.innerHTML = "";
  }
}

/**
 * Clears all search highlight overlays.
 */
function clearAllSearchHighlightOverlays(): void {
  for (const overlay of state.searchHighlightOverlays.values()) {
    overlay.remove();
  }
  state.searchHighlightOverlays.clear();
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
  highlightSearchResults(result.pageIndex);
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
// Event System
// ─────────────────────────────────────────────────────────────────────────────

type EventType = "pdf:ready" | "scale:changed" | "page:rendered" | "page:changed";

interface EventPayloads {
  "pdf:ready": { pageCount: number; fileName?: string; sourceUrl?: string };
  "scale:changed": { previousScale: number; currentScale: number };
  "page:rendered": { pageIndex: number; renderTime?: number };
  "page:changed": { previousPage: number; currentPage: number };
}

type EventListener<T extends EventType> = (payload: EventPayloads[T]) => void;

const eventListeners = new Map<EventType, Set<EventListener<any>>>();

/**
 * Subscribe to viewer events.
 */
function addEventListener<T extends EventType>(type: T, listener: EventListener<T>): () => void {
  if (!eventListeners.has(type)) {
    eventListeners.set(type, new Set());
  }
  eventListeners.get(type)!.add(listener);

  // Return unsubscribe function
  return () => {
    eventListeners.get(type)?.delete(listener);
  };
}

/**
 * Emit a viewer event.
 */
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
  // Also dispatch a custom DOM event for external listeners
  window.dispatchEvent(new CustomEvent(`libpdf:${type}`, { detail: payload }));
}

// Set up default event logging for demo
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
// Feature Showcase Panel
// ─────────────────────────────────────────────────────────────────────────────

const showcaseElements = {
  featurePanel: document.getElementById("feature-panel") as HTMLElement,
  togglePanelBtn: document.getElementById("toggle-panel") as HTMLButtonElement,
  urlInput: document.getElementById("url-input") as HTMLInputElement,
  btnLoadUrl: document.getElementById("btn-load-url") as HTMLButtonElement,
  eventLog: document.getElementById("event-log") as HTMLDivElement,
  btnClearLog: document.getElementById("btn-clear-log") as HTMLButtonElement,
  btnTestEvents: document.getElementById("btn-test-events") as HTMLButtonElement,
  btnTestZoom: document.getElementById("btn-test-zoom") as HTMLButtonElement,
  btnTestNavigation: document.getElementById("btn-test-navigation") as HTMLButtonElement,
  statusResourceLoader: document.getElementById("status-resource-loader") as HTMLDivElement,
};

/**
 * Log an event to the event log panel.
 */
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

/**
 * Set up event listeners for the feature showcase panel.
 */
function setupShowcasePanel(): void {
  // Toggle panel visibility
  showcaseElements.togglePanelBtn.addEventListener("click", () => {
    showcaseElements.featurePanel.classList.toggle("open");
  });

  // Load PDF from URL
  showcaseElements.btnLoadUrl.addEventListener("click", async () => {
    const url = showcaseElements.urlInput.value.trim();
    if (url) {
      updateResourceLoaderStatus("Loading...");
      await loadPDFFromUrl(url);
      updateResourceLoaderStatus("Ready");
    }
  });

  showcaseElements.urlInput.addEventListener("keydown", async event => {
    if (event.key === "Enter") {
      const url = showcaseElements.urlInput.value.trim();
      if (url) {
        updateResourceLoaderStatus("Loading...");
        await loadPDFFromUrl(url);
        updateResourceLoaderStatus("Ready");
      }
    }
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
    if (state.pdfDocument) {
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
    if (state.pdfDocument && state.pdfDocument.numPages > 1) {
      const pageCount = state.pdfDocument.numPages;
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

/**
 * Update the resource loader status indicator.
 */
function updateResourceLoaderStatus(status: string): void {
  const statusEl = showcaseElements.statusResourceLoader;
  if (statusEl) {
    statusEl.innerHTML = `
      <span class="status-icon">${status === "Ready" ? "●" : "◐"}</span>
      <span>PDFResourceLoader: ${status}</span>
    `;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bounding Box Visualization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate mock bounding box data for demonstration purposes.
 * Creates realistic character, word, line, and paragraph boundaries
 * based on text layer spans.
 */
function generateMockBoundingBoxes(
  pageIndex: number,
  textSpans: TextSpanInfo[],
  pageHeight: number,
  scale: number,
): OverlayBoundingBox[] {
  const boxes: OverlayBoundingBox[] = [];

  if (textSpans.length === 0) {
    return boxes;
  }

  // Group spans into lines based on vertical position
  const lineGroups: Map<number, TextSpanInfo[]> = new Map();
  for (const span of textSpans) {
    const rect = span.element.getBoundingClientRect();
    // Round to nearest 5 pixels to group spans on same line
    const lineKey = Math.round(rect.top / 5) * 5;
    if (!lineGroups.has(lineKey)) {
      lineGroups.set(lineKey, []);
    }
    lineGroups.get(lineKey)!.push(span);
  }

  // Sort lines by vertical position
  const sortedLines = Array.from(lineGroups.entries()).sort((a, b) => a[0] - b[0]);

  // Track paragraph bounds
  let paragraphStartY = 0;
  let paragraphEndY = 0;
  let paragraphMinX = Infinity;
  let paragraphMaxX = 0;
  let lastLineBottom = 0;
  const paragraphBoxes: OverlayBoundingBox[] = [];

  for (const [lineTop, lineSpans] of sortedLines) {
    if (lineSpans.length === 0) {
      continue;
    }

    // Sort spans by horizontal position
    lineSpans.sort((a, b) => {
      const rectA = a.element.getBoundingClientRect();
      const rectB = b.element.getBoundingClientRect();
      return rectA.left - rectB.left;
    });

    // Get page container for coordinate conversion
    const pageContainer = lineSpans[0].element.closest(".page-container");
    if (!pageContainer) {
      continue;
    }
    const containerRect = pageContainer.getBoundingClientRect();

    // Calculate line bounds
    let lineMinX = Infinity;
    let lineMaxX = 0;
    let lineMinY = Infinity;
    let lineMaxY = 0;

    for (const span of lineSpans) {
      const rect = span.element.getBoundingClientRect();
      const relX = (rect.left - containerRect.left) / scale;
      const relY = (rect.top - containerRect.top) / scale;
      const relWidth = rect.width / scale;
      const relHeight = rect.height / scale;

      lineMinX = Math.min(lineMinX, relX);
      lineMaxX = Math.max(lineMaxX, relX + relWidth);
      lineMinY = Math.min(lineMinY, relY);
      lineMaxY = Math.max(lineMaxY, relY + relHeight);

      // Generate word boxes by splitting text on whitespace
      const words = span.text.split(/\s+/).filter(w => w.length > 0);
      if (words.length > 0) {
        const charWidth = relWidth / span.text.length;
        let charOffset = 0;

        for (const word of words) {
          // Find the word position in the span text
          const wordStart = span.text.indexOf(word, charOffset);
          if (wordStart === -1) {
            continue;
          }

          const wordX = relX + wordStart * charWidth;
          const wordWidth = word.length * charWidth;

          // Word bounding box (convert to PDF coordinates - y from bottom)
          boxes.push({
            type: "word",
            pageIndex,
            x: wordX,
            y: pageHeight - relY - relHeight,
            width: wordWidth,
            height: relHeight,
            text: word,
          });

          // Character bounding boxes
          for (let i = 0; i < word.length; i++) {
            boxes.push({
              type: "character",
              pageIndex,
              x: wordX + i * charWidth,
              y: pageHeight - relY - relHeight,
              width: charWidth,
              height: relHeight,
              text: word[i],
            });
          }

          charOffset = wordStart + word.length;
        }
      }
    }

    // Line bounding box (convert to PDF coordinates)
    if (lineMinX !== Infinity) {
      boxes.push({
        type: "line",
        pageIndex,
        x: lineMinX,
        y: pageHeight - lineMaxY,
        width: lineMaxX - lineMinX,
        height: lineMaxY - lineMinY,
      });

      // Check for paragraph break (large vertical gap between lines)
      const lineGap = lineMinY - lastLineBottom;
      const isNewParagraph = lastLineBottom > 0 && lineGap > 20 / scale;

      if (isNewParagraph && paragraphMaxX > 0) {
        // Save previous paragraph
        paragraphBoxes.push({
          type: "paragraph",
          pageIndex,
          x: paragraphMinX,
          y: pageHeight - paragraphEndY,
          width: paragraphMaxX - paragraphMinX,
          height: paragraphEndY - paragraphStartY,
        });

        // Start new paragraph
        paragraphStartY = lineMinY;
        paragraphMinX = lineMinX;
        paragraphMaxX = lineMaxX;
      } else {
        // Extend current paragraph
        if (paragraphStartY === 0) {
          paragraphStartY = lineMinY;
        }
        paragraphMinX = Math.min(paragraphMinX, lineMinX);
        paragraphMaxX = Math.max(paragraphMaxX, lineMaxX);
      }

      paragraphEndY = lineMaxY;
      lastLineBottom = lineMaxY;
    }
  }

  // Add final paragraph
  if (paragraphMaxX > 0) {
    paragraphBoxes.push({
      type: "paragraph",
      pageIndex,
      x: paragraphMinX,
      y: pageHeight - paragraphEndY,
      width: paragraphMaxX - paragraphMinX,
      height: paragraphEndY - paragraphStartY,
    });
  }

  boxes.push(...paragraphBoxes);

  return boxes;
}

/**
 * Set up bounding box visualization components.
 */
function setupBoundingBoxVisualization(): void {
  // Create bounding box overlay
  state.boundingBoxOverlay = createBoundingBoxOverlay();

  // Create bounding box controls
  state.boundingBoxControls = createBoundingBoxControls({
    enableKeyboardShortcuts: true,
  });

  // Wire up controls to overlay
  state.boundingBoxControls.addEventListener("toggle", event => {
    if (event.boxType !== undefined && event.visible !== undefined) {
      state.boundingBoxOverlay?.setVisibility(event.boxType, event.visible);
      logEvent("boundingBox:toggle", { type: event.boxType, visible: event.visible });
    }
  });

  state.boundingBoxControls.addEventListener("toggleAll", event => {
    if (event.visibility) {
      state.boundingBoxOverlay?.setAllVisibility(event.visibility);
      logEvent("boundingBox:toggleAll", { visibility: event.visibility });
    }
  });

  // Add controls to the feature panel
  const featurePanel = document.getElementById("feature-panel");
  if (featurePanel) {
    const panelContent = featurePanel.querySelector(".panel-content");
    if (panelContent) {
      // Create a new section for bounding box controls
      const section = document.createElement("section");
      section.className = "feature-section";
      section.innerHTML = "<h4>Bounding Box Visualization</h4>";
      section.appendChild(state.boundingBoxControls.element);

      // Add a help text
      const helpText = document.createElement("p");
      helpText.style.fontSize = "11px";
      helpText.style.color = "#666";
      helpText.style.marginTop = "8px";
      helpText.style.marginBottom = "0";
      helpText.textContent = "Press 1-4 to toggle boxes, 0 to hide all";
      section.appendChild(helpText);

      // Insert after the first section (URL loading)
      const firstSection = panelContent.querySelector(".feature-section");
      if (firstSection && firstSection.nextSibling) {
        panelContent.insertBefore(section, firstSection.nextSibling);
      } else {
        panelContent.appendChild(section);
      }
    }
  }

  // Listen for page rendered events to generate mock bounding boxes
  addEventListener("page:rendered", payload => {
    const pageIndex = payload.pageIndex;
    const textSpans = state.pageTextSpans.get(pageIndex);
    const pageDims = state.pageDimensions.get(pageIndex);

    if (textSpans && pageDims && state.boundingBoxOverlay) {
      const boxes = generateMockBoundingBoxes(pageIndex, textSpans, pageDims.height, state.scale);
      state.boundingBoxOverlay.setBoundingBoxes(pageIndex, boxes);

      // Re-render the overlay for this page
      const container = state.pageElements.get(pageIndex);
      if (container) {
        state.boundingBoxOverlay.renderToPage(pageIndex, container, state.scale, pageDims.height);
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────────────────────────────────────

function init(): void {
  setupEventHandlers();
  setupShowcasePanel();
  setupBoundingBoxVisualization();
  disableControls();
  setStatus("Ready - Open a PDF file to begin");

  // Log initial ready state
  logEvent("app:initialized", {
    features: [
      "Rendering Pipeline",
      "Coordinate Scaling",
      "Virtual Scrolling",
      "Text Layer",
      "Search & Highlighting",
      "Web Workers",
      "CJK CMap Support",
      "Auth & 403 Recovery",
      "Event System",
      "Toolbar Controls",
      "Bounding Box Visualization",
    ],
  });
}

// Start the demo
init();
