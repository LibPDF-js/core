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
  const viewerRect = elements.viewer.getBoundingClientRect();
  state.virtualScroller = createVirtualScroller({
    pageDimensions,
    scale: state.scale,
    pageGap: 20,
    bufferSize: 1,
    viewportWidth: viewerRect.width,
    viewportHeight: viewerRect.height,
  });

  // Set up viewer container for scrolling
  elements.viewer.style.position = "relative";
  elements.viewer.style.overflow = "auto";

  // Create content container with total height for scrolling
  const contentContainer = document.createElement("div");
  contentContainer.className = "viewer-content";
  contentContainer.style.position = "relative";
  contentContainer.style.width = `${state.virtualScroller.totalWidth}px`;
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

      // The element from ViewportManager is the rendered canvas
      // We need to clone it since the renderer reuses its internal canvas
      const canvas = event.element as HTMLCanvasElement;
      const clonedCanvas = document.createElement("canvas");
      clonedCanvas.width = canvas.width;
      clonedCanvas.height = canvas.height;
      const ctx = clonedCanvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(canvas, 0, 0);
      }

      // Position and size the container based on layout
      container.style.position = "absolute";
      container.style.left = `${layout.left}px`;
      container.style.top = `${layout.top}px`;
      container.style.width = `${layout.width}px`;
      container.style.height = `${layout.height}px`;

      // Clear container and add the cloned canvas
      container.innerHTML = "";
      clonedCanvas.style.width = "100%";
      clonedCanvas.style.height = "100%";
      clonedCanvas.style.position = "absolute";
      clonedCanvas.style.left = "0";
      clonedCanvas.style.top = "0";
      container.appendChild(clonedCanvas);

      // Add text layer for text selection
      const pdfDocument = state.pdfDocument;
      const scale = state.scale;
      void (async () => {
        try {
          const page = await pdfDocument.getPage(event.pageIndex + 1);
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
          await buildPDFJSTextLayer(page, {
            container: textLayerDiv,
            viewport: viewport as any,
          });

          container!.appendChild(textLayerDiv);

          // Highlight search results on this page
          await highlightSearchResults(event.pageIndex, container!);
        } catch (err) {
          console.error(`Failed to build text layer for page ${event.pageIndex}:`, err);
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
  if (state.virtualScroller) {
    state.virtualScroller.destroy();
    state.virtualScroller = null;
  }
  if (state.viewportManager) {
    state.viewportManager.dispose();
    state.viewportManager = null;
  }
  if (state.searchEngine) {
    state.searchEngine.clearSearch();
    state.searchEngine = null;
  }
  state.pageElements.clear();
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
  state.virtualScroller.scrollToPage(clampedPage - 1);
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

function setScale(scale: number): void {
  state.scale = Math.max(0.1, Math.min(5, scale));

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

  // Re-render with new scale
  if (state.virtualScroller) {
    state.virtualScroller.setScale(state.scale);
  }
}

function zoomIn(): void {
  setScale(state.scale * 1.25);
}

function zoomOut(): void {
  setScale(state.scale / 1.25);
}

async function fitWidth(): Promise<void> {
  if (!state.pdfDocument || !state.virtualScroller) {
    return;
  }

  const page = await state.pdfDocument.getPage(state.currentPage);
  const viewport = page.getViewport({ scale: 1 });
  const containerWidth = elements.viewer.clientWidth - 40; // Account for padding
  const newScale = containerWidth / viewport.width;
  setScale(newScale);
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
  setScale(Math.min(scaleX, scaleY));
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

  // Update highlights on visible pages
  for (const [pageIndex, container] of state.pageElements) {
    void highlightSearchResults(pageIndex, container);
  }
}

async function highlightSearchResults(pageIndex: number, container: HTMLElement): Promise<void> {
  if (!state.searchEngine || !state.pdfDocument) {
    return;
  }

  // Remove existing highlights
  container.querySelectorAll(".search-highlight").forEach(el => el.remove());

  const results = state.searchEngine.getResultsForPage(pageIndex);
  const currentResult = state.searchEngine.currentResult;

  if (results.length === 0) {
    return;
  }

  // Get the page to access viewport for coordinate conversion
  const page = await state.pdfDocument.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: state.scale });

  for (const result of results) {
    const highlight = document.createElement("div");
    highlight.className = "search-highlight";

    if (currentResult && currentResult.resultIndex === result.resultIndex) {
      highlight.classList.add("current");
    }

    // Position highlight based on bounds
    // PDF coordinates have origin at bottom-left, need to convert to top-left
    if (result.bounds) {
      // Convert PDF coordinates to viewport coordinates
      const x = result.bounds.x * state.scale;
      // Flip Y coordinate: viewport.height - (y + height) * scale
      const y = viewport.height - (result.bounds.y + result.bounds.height) * state.scale;
      const width = result.bounds.width * state.scale;
      const height = result.bounds.height * state.scale;

      highlight.style.left = `${x}px`;
      highlight.style.top = `${y}px`;
      highlight.style.width = `${Math.max(width, 20)}px`;
      highlight.style.height = `${Math.max(height, 14)}px`;
      container.appendChild(highlight);
    }
  }
}

function scrollToCurrentResult(): void {
  const result = state.searchEngine?.currentResult;
  if (!result || !state.virtualScroller) {
    return;
  }

  // Scroll to the page containing the result
  goToPage(result.pageIndex + 1);
}

function searchNext(): void {
  state.searchEngine?.findNext();
}

function searchPrev(): void {
  state.searchEngine?.findPrevious();
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
  elements.btnZoomOut.addEventListener("click", zoomOut);
  elements.btnZoomIn.addEventListener("click", zoomIn);

  elements.zoomSelect.addEventListener("change", () => {
    const value = elements.zoomSelect.value;
    if (value === "fit-width") {
      void fitWidth();
    } else if (value === "fit-page") {
      void fitPage();
    } else {
      const scale = parseFloat(value);
      if (!isNaN(scale)) {
        setScale(scale);
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
          zoomIn();
          event.preventDefault();
        }
        break;
      case "-":
        if (event.ctrlKey || event.metaKey) {
          zoomOut();
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
