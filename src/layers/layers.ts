/**
 * Layer (OCG) detection and flattening.
 *
 * Reads the optional content configuration from PDF catalog and
 * provides functionality to flatten layers (make all content visible).
 */

import type { PDFContext } from "#src/api/pdf-context";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import type { PdfObject } from "#src/objects/pdf-object";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfString } from "#src/objects/pdf-string";

import type { FlattenLayersResult, LayerInfo } from "./types";

/**
 * Parsed default configuration from OCProperties.D
 */
interface DefaultConfig {
  /** Base visibility state */
  baseState: "ON" | "OFF" | "Unchanged";
  /** Set of OCG refs that are explicitly ON */
  onRefs: Set<string>;
  /** Set of OCG refs that are explicitly OFF */
  offRefs: Set<string>;
  /** Set of OCG refs that are locked */
  lockedRefs: Set<string>;
}

/**
 * Create a string key for a PdfRef (for Set lookups).
 */
function refKey(ref: PdfRef): string {
  return `${ref.objectNumber}:${ref.generation}`;
}

/**
 * Parse the default configuration from OCProperties.D
 */
async function parseDefaultConfig(
  dDict: PdfObject | null | undefined,
  resolve: (ref: PdfRef) => Promise<PdfObject | null>,
): Promise<DefaultConfig> {
  const result: DefaultConfig = {
    baseState: "ON",
    onRefs: new Set(),
    offRefs: new Set(),
    lockedRefs: new Set(),
  };

  if (!dDict) {
    return result;
  }

  let dict: PdfDict | null = null;

  if (dDict instanceof PdfRef) {
    const resolved = await resolve(dDict);
    if (resolved instanceof PdfDict) {
      dict = resolved;
    }
  } else if (dDict instanceof PdfDict) {
    dict = dDict;
  }

  if (!dict) {
    return result;
  }

  // BaseState
  const baseState = dict.get("BaseState");
  if (baseState instanceof PdfName) {
    const nameValue = baseState.value;
    if (nameValue === "OFF" || nameValue === "Unchanged") {
      result.baseState = nameValue;
    }
  }

  // ON array
  const onArray = dict.get("ON");
  if (onArray instanceof PdfArray) {
    for (const item of onArray) {
      if (item instanceof PdfRef) {
        result.onRefs.add(refKey(item));
      }
    }
  }

  // OFF array
  const offArray = dict.get("OFF");
  if (offArray instanceof PdfArray) {
    for (const item of offArray) {
      if (item instanceof PdfRef) {
        result.offRefs.add(refKey(item));
      }
    }
  }

  // Locked array
  const lockedArray = dict.get("Locked");
  if (lockedArray instanceof PdfArray) {
    for (const item of lockedArray) {
      if (item instanceof PdfRef) {
        result.lockedRefs.add(refKey(item));
      }
    }
  }

  return result;
}

/**
 * Check if a document has layers (OCGs).
 *
 * Performs a thorough check that verifies OCProperties exists and
 * contains at least one valid OCG entry.
 */
export async function hasLayers(ctx: PDFContext): Promise<boolean> {
  const catalog = ctx.catalog.getDict();

  if (!catalog) {
    return false;
  }

  let ocProperties = catalog.get("OCProperties");

  if (!ocProperties) {
    return false;
  }

  let ocPropsDict: PdfDict | null = null;

  if (ocProperties instanceof PdfRef) {
    ocProperties = (await ctx.resolve(ocProperties)) ?? undefined;
  }

  if (ocProperties instanceof PdfDict) {
    ocPropsDict = ocProperties;
  }

  if (!ocPropsDict) {
    return false;
  }

  let ocgs = ocPropsDict.get("OCGs");

  if (!ocgs) {
    return false;
  }

  let ocgsArray: PdfArray | null = null;

  if (ocgs instanceof PdfRef) {
    ocgs = (await ctx.resolve(ocgs)) ?? undefined;
  }

  if (ocgs instanceof PdfArray) {
    ocgsArray = ocgs;
  }

  if (!ocgsArray || ocgsArray.length === 0) {
    return false;
  }

  return true;
}

/**
 * Get information about all layers in a document.
 *
 * Returns layer metadata including name, visibility state,
 * intent, and locked status based on the default configuration.
 */
export async function getLayers(ctx: PDFContext): Promise<LayerInfo[]> {
  const catalog = ctx.catalog.getDict();

  if (!catalog) {
    return [];
  }

  let ocProperties = catalog.get("OCProperties");

  if (!ocProperties) {
    return [];
  }

  let ocPropsDict: PdfDict | null = null;

  if (ocProperties instanceof PdfRef) {
    ocProperties = (await ctx.resolve(ocProperties)) ?? undefined;
  }

  if (ocProperties instanceof PdfDict) {
    ocPropsDict = ocProperties;
  }

  if (!ocPropsDict) {
    return [];
  }

  // Get OCGs array
  let ocgs = ocPropsDict.get("OCGs");

  if (!ocgs) {
    return [];
  }

  let ocgsArray: PdfArray | null = null;

  if (ocgs instanceof PdfRef) {
    ocgs = (await ctx.resolve(ocgs)) ?? undefined;
  }

  if (ocgs instanceof PdfArray) {
    ocgsArray = ocgs;
  }

  if (!ocgsArray) {
    return [];
  }

  // Parse default config
  const defaultConfig = await parseDefaultConfig(ocPropsDict.get("D"), ref => ctx.resolve(ref));

  const layers: LayerInfo[] = [];

  for (const item of ocgsArray) {
    if (!(item instanceof PdfRef)) {
      continue;
    }

    const ocg = await ctx.resolve(item);

    if (!(ocg instanceof PdfDict)) {
      continue;
    }

    // Get name - OCG names are typically PdfString
    const nameObj = ocg.get("Name");
    let name = "Unnamed";

    if (nameObj instanceof PdfString) {
      name = nameObj.asString();
    } else if (nameObj instanceof PdfName) {
      name = nameObj.value;
    } else if (nameObj) {
      // Fallback for other types
      name = String(nameObj);
    }

    // Get intent
    const intentObj = ocg.get("Intent");
    let intent: string | undefined;

    if (intentObj instanceof PdfName) {
      intent = intentObj.value;
    } else if (intentObj instanceof PdfArray && intentObj.length > 0) {
      // Intent can be an array, take first
      const first = intentObj.at(0);

      if (first instanceof PdfName) {
        intent = first.value;
      }
    }

    // Determine visibility
    const key = refKey(item);
    let visible: boolean;

    if (defaultConfig.onRefs.has(key)) {
      visible = true;
    } else if (defaultConfig.offRefs.has(key)) {
      visible = false;
    } else {
      // Use base state
      visible = defaultConfig.baseState !== "OFF";
    }

    // Check if locked
    const locked = defaultConfig.lockedRefs.has(key);

    layers.push({
      name,
      ref: item,
      visible,
      intent,
      locked,
    });
  }

  return layers;
}

/**
 * Validate OCG structure before removal.
 *
 * @throws {Error} if structure is malformed
 */
export async function validateOCGStructure(ctx: PDFContext): Promise<void> {
  const catalog = ctx.catalog.getDict();

  if (!catalog) {
    throw new Error("Malformed PDF: No catalog");
  }

  let ocProperties = catalog.get("OCProperties");

  if (!ocProperties) {
    return; // No layers is valid
  }

  let ocPropsDict: PdfDict | null = null;

  if (ocProperties instanceof PdfRef) {
    ocProperties = (await ctx.resolve(ocProperties)) ?? undefined;
  }

  if (ocProperties instanceof PdfDict) {
    ocPropsDict = ocProperties;
  }

  if (!ocPropsDict) {
    throw new Error("Malformed PDF: OCProperties is not a dictionary");
  }

  let ocgs = ocPropsDict.get("OCGs");

  if (ocgs !== undefined) {
    let ocgsArray: PdfArray | null = null;

    if (ocgs instanceof PdfRef) {
      ocgs = (await ctx.resolve(ocgs)) ?? undefined;
    }

    if (ocgs instanceof PdfArray) {
      ocgsArray = ocgs;
    }

    if (!ocgsArray) {
      throw new Error("Malformed PDF: OCProperties.OCGs is not an array");
    }
  }

  let defaultConfig = ocPropsDict.get("D");

  if (defaultConfig !== undefined) {
    let dDict: PdfDict | null = null;

    if (defaultConfig instanceof PdfRef) {
      defaultConfig = (await ctx.resolve(defaultConfig)) ?? undefined;
    }

    if (defaultConfig instanceof PdfDict) {
      dDict = defaultConfig;
    }

    if (!dDict) {
      throw new Error("Malformed PDF: OCProperties.D is not a dictionary");
    }
  }
}

/**
 * Flatten all layers in a document.
 *
 * Removes the OCProperties structure from the catalog, which makes all
 * content unconditionally visible and removes the layer toggle UI from
 * PDF viewers. No content is deleted - layers that were OFF become visible.
 */
export async function flattenLayers(ctx: PDFContext): Promise<FlattenLayersResult> {
  const catalog = ctx.catalog.getDict();

  if (!catalog) {
    return { flattened: false, layerCount: 0 };
  }

  const ocProperties = catalog.get("OCProperties");

  if (!ocProperties) {
    return { flattened: false, layerCount: 0 };
  }

  // Count layers before flattening (getLayers is lenient, returns [] for malformed)
  const layers = await getLayers(ctx);
  const layerCount = layers.length;

  // Remove OCProperties regardless of structure validity.
  // The goal is to flatten, so removing a malformed structure is still correct.
  catalog.delete("OCProperties");

  return {
    flattened: true,
    layerCount,
  };
}
