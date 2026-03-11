import { describe, expect, it } from "vitest";

import { max, min } from "./math";

describe("max", () => {
  it("returns the largest value", () => {
    expect(max([3, 1, 4, 1, 5, 9, 2, 6])).toBe(9);
  });

  it("works with negative values", () => {
    expect(max([-10, -3, -7])).toBe(-3);
  });

  it("returns fallback for empty iterable", () => {
    expect(max([])).toBe(0);
    expect(max([], -1)).toBe(-1);
  });

  it("works with Map keys", () => {
    const map = new Map([
      [5, "a"],
      [2, "b"],
      [8, "c"],
    ]);

    expect(max(map.keys())).toBe(8);
  });

  it("handles 250k elements without stack overflow", () => {
    const arr = Array.from({ length: 250_000 }, (_, i) => i);

    expect(max(arr)).toBe(249_999);
  });
});

describe("min", () => {
  it("returns the smallest value", () => {
    expect(min([3, 1, 4, 1, 5, 9, 2, 6])).toBe(1);
  });

  it("works with negative values", () => {
    expect(min([-10, -3, -7])).toBe(-10);
  });

  it("returns fallback for empty iterable", () => {
    expect(min([])).toBe(0);
    expect(min([], 999)).toBe(999);
  });

  it("works with Map keys", () => {
    const map = new Map([
      [5, "a"],
      [2, "b"],
      [8, "c"],
    ]);

    expect(min(map.keys())).toBe(2);
  });

  it("handles 250k elements without stack overflow", () => {
    const arr = Array.from({ length: 250_000 }, (_, i) => i);

    expect(min(arr)).toBe(0);
  });
});
