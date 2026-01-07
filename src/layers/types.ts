/**
 * Types for Optional Content Groups (Layers).
 *
 * OCGs allow content to be conditionally visible based on viewer settings.
 * Removing layers makes all content unconditionally visible - important
 * for security before signing.
 */

import type { PdfRef } from "#src/objects/pdf-ref";

/**
 * Information about a single layer (OCG).
 */
export interface LayerInfo {
  /** Layer display name from OCG dictionary */
  name: string;

  /** Reference to OCG dictionary */
  ref: PdfRef;

  /** Current visibility based on default configuration */
  visible: boolean;

  /** Intent (View, Design, or custom) */
  intent?: string;

  /** Whether layer is locked (cannot be toggled by user) */
  locked: boolean;
}

/**
 * Result from layer flattening.
 */
export interface FlattenLayersResult {
  /** Whether any layers were flattened */
  flattened: boolean;

  /** Number of OCG layers that existed */
  layerCount: number;
}
