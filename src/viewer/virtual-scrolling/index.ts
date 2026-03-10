/**
 * Virtual scrolling module for PDF viewing.
 *
 * Provides DOM recycling and page height estimation for efficient
 * virtual scrolling of large PDF documents with constant memory usage.
 *
 * @example
 * ```ts
 * import {
 *   DOMRecycler,
 *   PageEstimator,
 *   VirtualScrollContainer,
 *   createDefaultPoolConfigs,
 * } from '@libpdf/core/viewer/virtual-scrolling';
 *
 * // Create a virtual scroll container with a scroller
 * const container = new VirtualScrollContainer({ scroller });
 *
 * // Set page dimensions from PDF metadata
 * container.setPageDimensions(pageDimensions);
 *
 * // Elements are automatically managed as pages become visible/hidden
 * container.addEventListener('pageVisible', (event) => {
 *   const { pageIndex, elements } = event;
 *   // Render the page using the acquired elements
 * });
 * ```
 */

// ─────────────────────────────────────────────────────────────────────────────
// DOM Recycler
// ─────────────────────────────────────────────────────────────────────────────

export { DOMRecycler, createDOMRecycler, createDefaultPoolConfigs } from "./dom-recycler";

export type {
  RecyclableElementType,
  RecyclableElement,
  PoolConfig,
  DOMRecyclerOptions,
  RecyclerStats,
  DOMRecyclerEventType,
  DOMRecyclerEvent,
  DOMRecyclerEventListener,
} from "./dom-recycler";

// ─────────────────────────────────────────────────────────────────────────────
// Page Estimator
// ─────────────────────────────────────────────────────────────────────────────

export { PageEstimator, createPageEstimator } from "./page-estimator";

export type {
  EstimationSource,
  PageHeightEstimate,
  PageEstimatorOptions,
  PageEstimatorEventType,
  PageEstimatorEvent,
  PageEstimatorEventListener,
  HeightCorrection,
} from "./page-estimator";

// ─────────────────────────────────────────────────────────────────────────────
// Virtual Scroll Container
// ─────────────────────────────────────────────────────────────────────────────

export { VirtualScrollContainer, createVirtualScrollContainer } from "./virtual-scroll-container";

export type {
  VirtualScrollContainerOptions,
  VirtualScrollContainerEventType,
  VirtualScrollContainerEvent,
  VirtualScrollContainerEventListener,
} from "./virtual-scroll-container";
