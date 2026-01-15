/**
 * Change collection for incremental PDF saves.
 *
 * Walks object graphs to find dirty objects and collect changes.
 * Uses the "walk-on-save" pattern: zero overhead during editing,
 * cost paid only when saving.
 */

import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import type { PdfObject } from "#src/objects/pdf-object";
import { PdfRef } from "#src/objects/pdf-ref";

import type { ObjectRegistry } from "./object-registry";

/**
 * Result of collecting changes for incremental save.
 */
export interface ChangeSet {
  /** Objects loaded from PDF that have been modified */
  modified: Map<PdfRef, PdfObject>;

  /** New objects registered by the user */
  created: Map<PdfRef, PdfObject>;

  /** Highest object number used (for /Size in trailer) */
  maxObjectNumber: number;
}

/**
 * Check if an object or any of its direct descendants are dirty.
 *
 * This walks INTO nested objects but STOPS at PdfRef boundaries
 * (those are separate indirect objects tracked by the registry).
 *
 * @param obj - The object to check
 * @returns True if the object or any nested child is dirty
 */
export function hasDirtyDescendant(obj: PdfObject): boolean {
  // Check if this object itself is dirty
  if (obj instanceof PdfDict || obj instanceof PdfArray) {
    if (obj.dirty) {
      return true;
    }
  }

  // Walk into dict values (skip PdfRef - those are separate indirect objects)
  if (obj instanceof PdfDict) {
    for (const [, value] of obj) {
      if (!(value instanceof PdfRef) && hasDirtyDescendant(value)) {
        return true;
      }
    }
  }

  // Walk into array items (skip PdfRef - those are separate indirect objects)
  if (obj instanceof PdfArray) {
    for (const item of obj) {
      if (!(item instanceof PdfRef) && hasDirtyDescendant(item)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Collect all changes from a document for incremental save.
 *
 * Walks all loaded indirect objects to find those with dirty descendants,
 * and includes all newly registered objects.
 *
 * @param registry - The object registry to scan
 * @returns The collected changes
 */
export function collectChanges(registry: ObjectRegistry): ChangeSet {
  const modified = new Map<PdfRef, PdfObject>();

  // Walk all loaded objects to find dirty ones
  for (const [ref, obj] of registry.getLoadedObjects()) {
    if (hasDirtyDescendant(obj)) {
      modified.set(ref, obj);
    }
  }

  // Get all new objects (always included in changes)
  const created = registry.getNewObjects();

  // Calculate max object number
  let maxObjectNumber = 0;

  for (const ref of modified.keys()) {
    maxObjectNumber = Math.max(maxObjectNumber, ref.objectNumber);
  }

  for (const ref of created.keys()) {
    maxObjectNumber = Math.max(maxObjectNumber, ref.objectNumber);
  }

  return {
    modified,
    created,
    maxObjectNumber,
  };
}

/**
 * Clear dirty flags on an object and all its direct descendants.
 *
 * Called after a successful save to reset modification tracking.
 * Walks INTO nested objects but STOPS at PdfRef boundaries.
 *
 * @param obj - The object to clear
 */
export function clearDirtyFlags(obj: PdfObject): void {
  // Clear this object's dirty flag
  if (obj instanceof PdfDict || obj instanceof PdfArray) {
    obj.clearDirty();
  }

  // Recurse into dict values (skip PdfRef)
  if (obj instanceof PdfDict) {
    for (const [, value] of obj) {
      if (!(value instanceof PdfRef)) {
        clearDirtyFlags(value);
      }
    }
  }

  // Recurse into array items (skip PdfRef)
  if (obj instanceof PdfArray) {
    for (const item of obj) {
      if (!(item instanceof PdfRef)) {
        clearDirtyFlags(item);
      }
    }
  }
}

/**
 * Clear all dirty flags in the registry after a successful save.
 *
 * @param registry - The object registry to clear
 */
export function clearAllDirtyFlags(registry: ObjectRegistry): void {
  // Clear loaded objects
  for (const [, obj] of registry.getLoadedObjects()) {
    clearDirtyFlags(obj);
  }

  // Clear new objects (they'll be moved to loaded after this)
  for (const [, obj] of registry.getNewObjects()) {
    clearDirtyFlags(obj);
  }
}

/**
 * Check if a document has any unsaved changes.
 *
 * @param registry - The object registry to check
 * @returns True if there are any dirty objects or new objects
 */
export function hasChanges(registry: ObjectRegistry): boolean {
  // New objects always count as changes
  if (registry.hasNewObjects()) {
    return true;
  }

  // Check loaded objects for dirty descendants
  for (const [, obj] of registry.getLoadedObjects()) {
    if (hasDirtyDescendant(obj)) {
      return true;
    }
  }

  return false;
}
