/**
 * Math utilities that operate on iterables.
 *
 * Unlike `Math.max(...arr)` / `Math.min(...arr)`, these don't spread into
 * function arguments and therefore can't overflow the call stack on large
 * collections.
 */

/**
 * Return the largest value in an iterable, or `fallback` if empty.
 */
export function max(values: Iterable<number>, fallback = 0): number {
  let result = Number.NEGATIVE_INFINITY;

  for (const v of values) {
    if (v > result) {
      result = v;
    }
  }

  return result === Number.NEGATIVE_INFINITY ? fallback : result;
}

/**
 * Return the smallest value in an iterable, or `fallback` if empty.
 */
export function min(values: Iterable<number>, fallback = 0): number {
  let result = Number.POSITIVE_INFINITY;

  for (const v of values) {
    if (v < result) {
      result = v;
    }
  }

  return result === Number.POSITIVE_INFINITY ? fallback : result;
}
