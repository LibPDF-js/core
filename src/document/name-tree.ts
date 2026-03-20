/**
 * PDF Name Tree implementation.
 *
 * Name trees are sorted key-value structures used for:
 * - /EmbeddedFiles (attachments)
 * - /Dests (named destinations)
 * - /JavaScript (document-level scripts)
 * - /AP (appearance streams)
 *
 * Structure:
 * - Leaf nodes have /Names: [key1, value1, key2, value2, ...]
 * - Intermediate nodes have /Kids: [ref1, ref2, ...]
 * - Intermediate nodes have /Limits: [minKey, maxKey] for binary search
 *
 * @see PDF 1.7 spec section 7.9.6
 */

import type { RefResolver } from "#src/helpers/types";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import type { PdfObject } from "#src/objects/pdf-object";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfString } from "#src/objects/pdf-string";

/**
 * Maximum depth for tree traversal (prevents infinite loops on malformed PDFs).
 */
const MAX_DEPTH = 10;

/**
 * Extract string key from a PdfString.
 * Handles both literal and hex strings.
 */
function extractKey(obj: PdfObject | undefined): string | null {
  if (obj instanceof PdfString) {
    return obj.asString();
  }
  return null;
}

/**
 * Compare two string keys for binary search.
 * Uses lexicographic comparison (same as PDF spec).
 */
function compareKeys(a: string, b: string): number {
  if (a < b) {
    return -1;
  }

  if (a > b) {
    return 1;
  }

  return 0;
}

/**
 * PDF Name Tree reader.
 *
 * Supports both flat trees (/Names array) and hierarchical trees (/Kids).
 * Uses binary search with /Limits for O(log n) single lookups.
 */
export class NameTree {
  private cache: Map<string, PdfObject> | null = null;

  constructor(
    private readonly root: PdfDict,
    private readonly resolver: RefResolver,
  ) {}

  /**
   * Lookup a single key using binary search.
   * Uses /Limits on intermediate nodes to skip subtrees.
   *
   * @returns The value if found, null otherwise
   */
  get(key: string): PdfObject | null {
    let node = this.root;
    let depth = 0;

    // Navigate through intermediate nodes
    while (node.has("Kids")) {
      if (++depth > MAX_DEPTH) {
        console.warn(`NameTree: max depth (${MAX_DEPTH}) exceeded during lookup`);

        return null;
      }

      const kids = node.getArray("Kids", this.resolver);

      if (!kids || kids.length === 0) {
        return null;
      }

      // Binary search on Kids using Limits
      let lo = 0;
      let hi = kids.length - 1;
      let found = false;

      while (lo <= hi) {
        const mid = (lo + hi) >>> 1;
        const kid = kids.at(mid, this.resolver);

        if (!(kid instanceof PdfDict)) {
          lo = mid + 1;

          continue;
        }

        const limits = kid.getArray("Limits");
        if (!limits || limits.length < 2) {
          // No limits - must search linearly
          // Try this kid
          node = kid;
          found = true;

          break;
        }

        const minKey = extractKey(limits.at(0));
        const maxKey = extractKey(limits.at(1));

        if (minKey === null || maxKey === null) {
          // Malformed limits - try this node anyway
          node = kid;
          found = true;

          break;
        }

        if (compareKeys(key, minKey) < 0) {
          hi = mid - 1;
        } else if (compareKeys(key, maxKey) > 0) {
          lo = mid + 1;
        } else {
          // Key is within this subtree's range
          node = kid;
          found = true;
          break;
        }
      }

      if (!found) {
        return null;
      }
    }

    // We're at a leaf node - search the /Names array
    const names = node.getArray("Names", this.resolver);

    if (!names) {
      return null;
    }

    // Binary search in the Names array (entries are [key, value, key, value, ...])
    const numPairs = Math.floor(names.length / 2);
    let lo = 0;
    let hi = numPairs - 1;

    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const keyIndex = mid * 2;
      const currentKey = extractKey(names.at(keyIndex));

      if (currentKey === null) {
        // Malformed entry - try linear search as fallback
        break;
      }

      const cmp = compareKeys(key, currentKey);
      if (cmp < 0) {
        hi = mid - 1;
      } else if (cmp > 0) {
        lo = mid + 1;
      } else {
        // Found it!
        const valueIndex = keyIndex + 1;

        return names.at(valueIndex, this.resolver) ?? null;
      }
    }

    // Binary search failed, fall back to linear search (for robustness)
    for (let i = 0; i < names.length; i += 2) {
      const currentKey = extractKey(names.at(i));

      if (currentKey === key) {
        return names.at(i + 1, this.resolver) ?? null;
      }
    }

    return null;
  }

  /**
   * Check if a key exists in the tree.
   */
  has(key: string): boolean {
    const value = this.get(key);

    return value !== null;
  }

  /**
   * Iterate all entries (lazy, yields [key, value] pairs).
   * Uses BFS traversal with cycle detection.
   */
  *entries(): Generator<[string, PdfObject]> {
    const visited = new Set<string>();
    const queue: Array<{ node: PdfDict; depth: number }> = [{ node: this.root, depth: 0 }];

    while (queue.length > 0) {
      // biome-ignore lint/style/noNonNullAssertion: checked in above condition
      const { node, depth } = queue.shift()!;

      if (depth > MAX_DEPTH) {
        console.warn(`NameTree: max depth (${MAX_DEPTH}) exceeded during iteration`);
        continue;
      }

      if (node.has("Kids")) {
        // Intermediate node - queue children
        const kids = node.getArray("Kids", this.resolver);

        if (kids) {
          for (let i = 0; i < kids.length; i++) {
            const kidRef = kids.at(i);

            // Cycle detection (only works for refs)
            if (kidRef instanceof PdfRef) {
              const refKey = `${kidRef.objectNumber}:${kidRef.generation}`;

              if (visited.has(refKey)) {
                console.warn(`NameTree: circular reference detected at ${refKey}`);
                continue;
              }

              visited.add(refKey);
            }

            const kid = kids.at(i, this.resolver);

            if (kid instanceof PdfDict) {
              queue.push({ node: kid, depth: depth + 1 });
            }
          }
        }
      } else if (node.has("Names")) {
        // Leaf node - yield entries
        const names = node.getArray("Names", this.resolver);

        if (names) {
          for (let i = 0; i < names.length; i += 2) {
            const key = extractKey(names.at(i));

            if (key === null) {
              continue;
            }

            const value = names.at(i + 1, this.resolver);

            if (value !== undefined) {
              yield [key, value];
            }
          }
        }
      }
    }
  }

  /**
   * Load all entries into a Map (cached after first call).
   */
  getAll(): ReadonlyMap<string, PdfObject> {
    if (this.cache) {
      return this.cache;
    }

    const result = new Map<string, PdfObject>();

    for (const [key, value] of this.entries()) {
      result.set(key, value);
    }

    this.cache = result;
    return result;
  }

  /**
   * Check if all entries have been loaded into cache.
   */
  get isLoaded(): boolean {
    return this.cache !== null;
  }

  /**
   * Clear the cache (useful if tree is modified externally).
   */
  clearCache(): void {
    this.cache = null;
  }
}

/**
 * Build a flat name tree from sorted entries.
 *
 * For writing - we don't need hierarchical structure for small lists.
 * Entries should be sorted by key before calling.
 *
 * @param entries Array of [key, valueRef] pairs (must be sorted by key)
 * @returns A PdfDict representing the name tree root
 */
export function buildNameTree(entries: Array<[string, PdfRef]>): PdfDict {
  // Sort entries by key (lexicographic)
  const sorted = [...entries].sort((a, b) => compareKeys(a[0], b[0]));

  // Build flat /Names array: [key1, ref1, key2, ref2, ...]
  const namesArray: PdfObject[] = [];

  for (const [key, ref] of sorted) {
    namesArray.push(PdfString.fromString(key));
    namesArray.push(ref);
  }

  const dict = new PdfDict();
  dict.set("Names", new PdfArray(namesArray));

  return dict;
}
