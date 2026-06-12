/**
 * Structure tree maintenance for annotation removal.
 *
 * Tagged (accessible) PDFs reference annotations from the logical structure
 * tree via /OBJR (object reference) entries, and map annotations back to
 * their structure elements through the /ParentTree number tree (keyed by the
 * annotation's /StructParent).
 *
 * When annotations are removed (e.g. widgets during form flattening), these
 * references must be cleaned up too. Otherwise:
 * - The /OBJR entries keep the removed annotations reachable, so full-save
 *   garbage collection writes the orphaned objects back into the output.
 * - The /ParentTree retains stale keys pointing at structure elements whose
 *   annotations no longer exist.
 *
 * PDF Reference: Section 14.7 "Logical Structure"
 */

import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfNumber } from "#src/objects/pdf-number";
import type { PdfObject } from "#src/objects/pdf-object";
import { PdfRef } from "#src/objects/pdf-ref";

import type { ObjectRegistry } from "./object-registry";

/**
 * Remove all structure tree references to the given annotations.
 *
 * Walks the structure tree from the catalog's /StructTreeRoot and:
 * - Removes /OBJR kids whose /Obj points to a removed annotation
 * - Removes /ParentTree entries keyed by the removed annotations'
 *   /StructParent values
 *
 * No-op if the document has no structure tree.
 *
 * @param catalog The document catalog dictionary
 * @param registry The object registry for resolving references
 * @param removedAnnotations Refs of annotations being removed. PdfRefs are
 *        interned, so identity comparison via Set membership is safe.
 */
export function removeAnnotationsFromStructTree(
  catalog: PdfDict,
  registry: ObjectRegistry,
  removedAnnotations: ReadonlySet<PdfRef>,
): void {
  if (removedAnnotations.size === 0) {
    return;
  }

  const resolve = registry.resolve.bind(registry);
  const structTreeRoot = catalog.getDict("StructTreeRoot", resolve);

  if (!structTreeRoot) {
    return;
  }

  // Collect the /StructParent keys of the removed annotations before any
  // teardown, so we can prune the matching ParentTree entries.
  const removedKeys = new Set<number>();

  for (const ref of removedAnnotations) {
    const annot = resolve(ref);

    if (annot instanceof PdfDict) {
      const structParent = annot.getNumber("StructParent")?.value;

      if (structParent !== undefined) {
        removedKeys.add(structParent);
      }
    }
  }

  pruneObjrKids(structTreeRoot, registry, removedAnnotations);

  if (removedKeys.size > 0) {
    const parentTree = structTreeRoot.getDict("ParentTree", resolve);

    if (parentTree) {
      pruneNumberTree(parentTree, registry, removedKeys, new Set());
    }
  }
}

/**
 * Check if a dict is an /OBJR entry pointing at one of the removed annotations.
 */
function isRemovedObjr(dict: PdfDict, removed: ReadonlySet<PdfRef>): boolean {
  if (dict.getName("Type")?.value !== "OBJR") {
    return false;
  }

  const obj = dict.get("Obj");

  return obj instanceof PdfRef && removed.has(obj);
}

/**
 * Check if a dict is a structure element (as opposed to an /MCR or /OBJR kid).
 * Structure elements may omit /Type, in which case /StructElem is assumed.
 */
function isStructElement(dict: PdfDict): boolean {
  const type = dict.getName("Type")?.value;

  return type === undefined || type === "StructElem";
}

/**
 * Walk the structure tree and remove /OBJR kids referencing removed annotations.
 *
 * The /K entry of a structure element can be: a number (MCID), a dict
 * (struct element, MCR, or OBJR), a ref to either, or an array of any of
 * these. All forms are handled.
 */
function pruneObjrKids(
  root: PdfDict,
  registry: ObjectRegistry,
  removed: ReadonlySet<PdfRef>,
): void {
  const resolve = registry.resolve.bind(registry);
  const visited = new Set<PdfDict>();
  const stack: PdfDict[] = [root];

  while (stack.length > 0) {
    const elem = stack.pop()!;

    if (visited.has(elem)) {
      continue;
    }

    visited.add(elem);

    const k = elem.get("K");
    const kResolved = k instanceof PdfRef ? resolve(k) : k;

    if (kResolved instanceof PdfArray) {
      // Filter in place (iterate backwards so removal doesn't shift indices)
      for (let i = kResolved.length - 1; i >= 0; i--) {
        const item = kResolved.at(i);
        const itemResolved = item instanceof PdfRef ? resolve(item) : item;

        if (!(itemResolved instanceof PdfDict)) {
          continue; // MCID numbers etc.
        }

        if (isRemovedObjr(itemResolved, removed)) {
          kResolved.remove(i);
        } else if (isStructElement(itemResolved)) {
          stack.push(itemResolved);
        }
      }

      if (kResolved.length === 0) {
        elem.delete("K");
      }
    } else if (kResolved instanceof PdfDict) {
      if (isRemovedObjr(kResolved, removed)) {
        elem.delete("K");
      } else if (isStructElement(kResolved)) {
        stack.push(kResolved);
      }
    }
  }
}

/**
 * Remove entries with the given keys from a number tree (the /ParentTree).
 *
 * Handles both flat trees (/Nums on the root) and trees with intermediate
 * /Kids nodes. Recomputes /Limits on modified leaf nodes.
 */
function pruneNumberTree(
  node: PdfDict,
  registry: ObjectRegistry,
  keys: ReadonlySet<number>,
  visited: Set<PdfDict>,
): void {
  if (visited.has(node)) {
    return;
  }

  visited.add(node);

  const resolve = registry.resolve.bind(registry);
  const kids = node.getArray("Kids", resolve);

  if (kids) {
    for (let i = 0; i < kids.length; i++) {
      const kid = kids.at(i, resolve);

      if (kid instanceof PdfDict) {
        pruneNumberTree(kid, registry, keys, visited);
      }
    }
  }

  const nums = node.getArray("Nums", resolve);

  if (!nums) {
    return;
  }

  // Nums is a flat [key value key value ...] array
  const remaining: PdfObject[] = [];
  const remainingKeys: number[] = [];
  let changed = false;

  for (let i = 0; i + 1 < nums.length; i += 2) {
    const keyObj = nums.at(i, resolve);
    const key = keyObj instanceof PdfNumber ? keyObj.value : undefined;

    if (key !== undefined && keys.has(key)) {
      changed = true;
      continue;
    }

    remaining.push(nums.at(i)!, nums.at(i + 1)!);

    if (key !== undefined) {
      remainingKeys.push(key);
    }
  }

  if (!changed) {
    return;
  }

  node.set("Nums", new PdfArray(remaining));

  // Keep /Limits consistent with the remaining keys (required on all nodes
  // except the root; harmless to update wherever it exists).
  if (node.has("Limits")) {
    if (remainingKeys.length > 0) {
      node.set(
        "Limits",
        PdfArray.of(
          new PdfNumber(Math.min(...remainingKeys)),
          new PdfNumber(Math.max(...remainingKeys)),
        ),
      );
    } else {
      node.delete("Limits");
    }
  }
}
