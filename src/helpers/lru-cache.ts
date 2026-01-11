/**
 * Simple LRU (Least Recently Used) cache implementation.
 *
 * Used for interning frequently-used PDF objects (PdfName, PdfRef)
 * while preventing unbounded memory growth.
 */

/**
 * A bounded cache that evicts least-recently-used entries when full.
 *
 * @typeParam K - Key type
 * @typeParam V - Value type
 */
export class LRUCache<K, V> {
  private readonly maxSize: number;
  private readonly cache = new Map<K, V>();

  /**
   * Create a new LRU cache.
   *
   * @param maxSize - Maximum number of entries to retain (default: 10000)
   */
  constructor(maxSize = 10000) {
    this.maxSize = maxSize;
  }

  /**
   * Get a value from the cache, updating its recency.
   *
   * @returns The cached value, or undefined if not present
   */
  get(key: K): V | undefined {
    const value = this.cache.get(key);

    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }

    return value;
  }

  /**
   * Check if a key exists in the cache (without updating recency).
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Add or update a value in the cache.
   *
   * If the cache is at capacity, the least-recently-used entry is evicted.
   */
  set(key: K, value: V): void {
    // If key exists, delete it first so it becomes the most recent
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict the oldest entry (first in Map iteration order)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, value);
  }

  /**
   * Remove a value from the cache.
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries from the cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the current number of entries in the cache.
   */
  get size(): number {
    return this.cache.size;
  }
}
