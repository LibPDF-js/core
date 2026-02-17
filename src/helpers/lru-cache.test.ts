import { describe, expect, it } from "vitest";

import { LRUCache } from "./lru-cache";

describe("LRUCache", () => {
  it("stores and retrieves values", () => {
    const cache = new LRUCache<string, number>({ max: 10 });

    cache.set("a", 1);
    cache.set("b", 2);

    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBeUndefined();
  });

  it("updates existing values", () => {
    const cache = new LRUCache<string, number>({ max: 10 });

    cache.set("a", 1);
    cache.set("a", 2);

    expect(cache.get("a")).toBe(2);
    expect(cache.size).toBe(1);
  });

  it("evicts least recently used when at capacity", () => {
    const cache = new LRUCache<string, number>({ max: 3 });

    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);

    // Cache is now full: [a, b, c]
    expect(cache.size).toBe(3);

    // Adding d should evict a
    cache.set("d", 4);

    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
    expect(cache.get("d")).toBe(4);
    expect(cache.size).toBe(3);
  });

  it("get updates recency", () => {
    const cache = new LRUCache<string, number>({ max: 3 });

    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);

    // Access 'a' to make it most recent
    cache.get("a");

    // Now add 'd' - should evict 'b' (oldest after 'a' was accessed)
    cache.set("d", 4);

    expect(cache.get("a")).toBe(1); // Still present
    expect(cache.get("b")).toBeUndefined(); // Evicted
    expect(cache.get("c")).toBe(3);
    expect(cache.get("d")).toBe(4);
  });

  it("has checks existence without updating recency", () => {
    const cache = new LRUCache<string, number>({ max: 3 });

    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);

    // Check 'a' with has() - should NOT update recency
    expect(cache.has("a")).toBe(true);
    expect(cache.has("x")).toBe(false);

    // Add 'd' - should evict 'a' since has() doesn't update recency
    cache.set("d", 4);

    expect(cache.get("a")).toBeUndefined();
  });

  it("delete removes entries", () => {
    const cache = new LRUCache<string, number>({ max: 10 });

    cache.set("a", 1);
    cache.set("b", 2);

    expect(cache.delete("a")).toBe(true);
    expect(cache.delete("c")).toBe(false);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.size).toBe(1);
  });

  it("clear removes all entries", () => {
    const cache = new LRUCache<string, number>({ max: 10 });

    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);

    cache.clear();

    expect(cache.size).toBe(0);
    expect(cache.get("a")).toBeUndefined();
  });

  it("works with large capacity", () => {
    const cache = new LRUCache<string, number>({ max: 10000 });

    // Should be able to add many items
    for (let i = 0; i < 1000; i++) {
      cache.set(`key${i}`, i);
    }

    expect(cache.size).toBe(1000);
  });
});
