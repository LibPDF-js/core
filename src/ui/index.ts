/**
 * UI components for the PDF viewer.
 *
 * This module provides state management, toolbar controls, and overlay
 * management for building PDF viewer interfaces.
 */

export {
  createUIStateManager,
  type PartialUIState,
  type UIState,
  UIStateManager,
  type UIStateEvent,
  type UIStateEventListener,
  type UIStateEventType,
  type UIStateManagerOptions,
  type ZoomFitMode,
} from "./UIStateManager";

export {
  createToolbarController,
  ToolbarController,
  type ToolbarButtonId,
  type ToolbarControllerOptions,
  type ToolbarEvent,
  type ToolbarEventListener,
  type ToolbarEventType,
} from "./ToolbarController";

export {
  createOverlayManager,
  OverlayManager,
  type OverlayConfig,
  type OverlayEvent,
  type OverlayEventListener,
  type OverlayEventType,
  type OverlayManagerOptions,
  type OverlayType,
} from "./OverlayManager";
