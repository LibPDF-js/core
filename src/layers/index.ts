/**
 * Layer (Optional Content Group) operations.
 *
 * Provides functionality to detect and flatten PDF layers.
 * Important for security before signing documents.
 */

export { flattenLayers, getLayers, hasLayers, validateOCGStructure } from "./layers";
export type { FlattenLayersResult, LayerInfo } from "./types";
