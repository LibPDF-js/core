import { describe, expect, it } from "vitest";

import { CryptoEngine } from "./crypto-engine";

const data = new TextEncoder().encode("abc");
const SHA256_ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

const hex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, "0")).join("");

describe("CryptoEngine.digest", () => {
  const engine = new CryptoEngine();

  it("accepts the algorithm as an object", async () => {
    expect(hex(await engine.digest({ name: "SHA-256" }, data))).toBe(SHA256_ABC);
  });

  it("accepts the algorithm as a bare string, as pkijs passes it during verification", async () => {
    expect(hex(await engine.digest("SHA-256", data))).toBe(SHA256_ABC);
  });

  it("normalizes SHA256 to SHA-256 in both forms", async () => {
    expect(hex(await engine.digest("SHA256", data))).toBe(SHA256_ABC);
    expect(hex(await engine.digest({ name: "sha256" }, data))).toBe(SHA256_ABC);
  });
});
