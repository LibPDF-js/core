import { ensureCatalogMinVersion, parsePdfVersion } from "#src/helpers/pdf-version";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { describe, expect, it } from "vitest";

describe("pdf-version helpers", () => {
  it("parses version strings for comparison", () => {
    expect(parsePdfVersion("1.4")).toBe(14);
    expect(parsePdfVersion("1.7")).toBe(17);
    expect(parsePdfVersion("2.0")).toBe(20);
  });

  it("handles malformed versions safely", () => {
    expect(parsePdfVersion("abc")).toBe(0);
    expect(parsePdfVersion("1.x")).toBe(0);
  });

  it("upgrades catalog version only when target is higher", () => {
    const catalog = new PdfDict();

    const unchanged = ensureCatalogMinVersion(catalog, "1.7", "1.4");
    expect(unchanged).toBe("1.7");
    expect(catalog.get("Version")).toBeUndefined();

    const upgraded = ensureCatalogMinVersion(catalog, "1.3", "1.4");
    expect(upgraded).toBe("1.4");
    expect(catalog.getName("Version")).toEqual(PdfName.of("1.4"));
  });
});
