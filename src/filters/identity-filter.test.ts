import { describe, expect, it } from "vitest";

import { identityFilter } from "./identity-filter";

describe("identityFilter", () => {
  it("should have correct name", () => {
    expect(identityFilter.name).toBe("Identity");
  });

  it("should return data unchanged on decode", async () => {
    const input = new Uint8Array([1, 2, 3, 4, 5]);
    const result = await identityFilter.decode(input);

    expect(result).toBe(input);
  });

  it("should return data unchanged on encode", async () => {
    const input = new Uint8Array([10, 20, 30, 40, 50]);
    const result = await identityFilter.encode(input);

    expect(result).toBe(input);
  });

  it("should handle empty data", async () => {
    const empty = new Uint8Array(0);

    expect(await identityFilter.decode(empty)).toBe(empty);
    expect(await identityFilter.encode(empty)).toBe(empty);
  });

  it("should ignore params", async () => {
    const data = new Uint8Array([1, 2, 3]);

    // Should not throw even with undefined params
    const decoded = await identityFilter.decode(data, undefined);
    const encoded = await identityFilter.encode(data, undefined);

    expect(decoded).toBe(data);
    expect(encoded).toBe(data);
  });
});
