/**
 * Tests for layer (OCG) detection and removal.
 */

import { describe, expect, it } from "vitest";
import { PDF } from "#src/api/pdf";
import { loadFixture, saveTestOutput } from "#src/test-utils";
import { flattenLayers, getLayers, hasLayers } from "./index";

describe("hasLayers", () => {
  it("returns false for PDF without OCProperties", async () => {
    const bytes = await loadFixture("layers", "no-layers.pdf");
    const pdf = await PDF.load(bytes);

    const result = await hasLayers(pdf.context);

    expect(result).toBe(false);
  });

  it("returns true for PDF with single layer ON", async () => {
    const bytes = await loadFixture("layers", "single-layer-on.pdf");
    const pdf = await PDF.load(bytes);

    const result = await hasLayers(pdf.context);

    expect(result).toBe(true);
  });

  it("returns true for PDF with single layer OFF", async () => {
    const bytes = await loadFixture("layers", "single-layer-off.pdf");
    const pdf = await PDF.load(bytes);

    const result = await hasLayers(pdf.context);

    expect(result).toBe(true);
  });

  it("returns true for PDF with multiple layers", async () => {
    const bytes = await loadFixture("layers", "multiple-layers.pdf");
    const pdf = await PDF.load(bytes);

    const result = await hasLayers(pdf.context);

    expect(result).toBe(true);
  });
});

describe("getLayers", () => {
  it("returns empty array for PDF without layers", async () => {
    const bytes = await loadFixture("layers", "no-layers.pdf");
    const pdf = await PDF.load(bytes);

    const layers = await getLayers(pdf.context);

    expect(layers).toEqual([]);
  });

  it("returns single layer with correct properties", async () => {
    const bytes = await loadFixture("layers", "single-layer-on.pdf");
    const pdf = await PDF.load(bytes);

    const layers = await getLayers(pdf.context);

    expect(layers).toHaveLength(1);
    expect(layers[0].name).toBe("Layer 1");
    expect(layers[0].visible).toBe(true);
    expect(layers[0].locked).toBe(false);
  });

  it("returns single layer with BaseState OFF", async () => {
    const bytes = await loadFixture("layers", "single-layer-off.pdf");
    const pdf = await PDF.load(bytes);

    const layers = await getLayers(pdf.context);

    expect(layers).toHaveLength(1);
    expect(layers[0].name).toBe("Hidden Layer");
    expect(layers[0].visible).toBe(false);
    expect(layers[0].locked).toBe(false);
  });

  it("returns multiple layers with mixed visibility and locked status", async () => {
    const bytes = await loadFixture("layers", "multiple-layers.pdf");
    const pdf = await PDF.load(bytes);

    const layers = await getLayers(pdf.context);

    expect(layers).toHaveLength(3);

    // Background layer - ON by default, has Intent
    const background = layers.find(l => l.name === "Background");
    expect(background).toBeDefined();
    expect(background!.visible).toBe(true);
    expect(background!.locked).toBe(false);
    expect(background!.intent).toBe("View");

    // Hidden layer - explicitly OFF
    const hidden = layers.find(l => l.name === "Hidden Layer");
    expect(hidden).toBeDefined();
    expect(hidden!.visible).toBe(false);
    expect(hidden!.locked).toBe(false);

    // Locked layer - ON and locked
    const locked = layers.find(l => l.name === "Locked Layer");
    expect(locked).toBeDefined();
    expect(locked!.visible).toBe(true);
    expect(locked!.locked).toBe(true);
    expect(locked!.intent).toBe("Design");
  });
});

describe("flattenLayers", () => {
  it("returns flattened=false for PDF without layers", async () => {
    const bytes = await loadFixture("layers", "no-layers.pdf");
    const pdf = await PDF.load(bytes);

    const result = await flattenLayers(pdf.context);

    expect(result.flattened).toBe(false);
    expect(result.layerCount).toBe(0);
  });

  it("flattens single layer and returns correct count", async () => {
    const bytes = await loadFixture("layers", "single-layer-on.pdf");
    const pdf = await PDF.load(bytes);

    const result = await flattenLayers(pdf.context);

    expect(result.flattened).toBe(true);
    expect(result.layerCount).toBe(1);

    // Verify OCProperties is gone
    const catalog = await pdf.getCatalog();
    expect(catalog?.has("OCProperties")).toBe(false);
  });

  it("flattens multiple layers", async () => {
    const bytes = await loadFixture("layers", "multiple-layers.pdf");
    const pdf = await PDF.load(bytes);

    const result = await flattenLayers(pdf.context);

    expect(result.flattened).toBe(true);
    expect(result.layerCount).toBe(3);

    // Verify OCProperties is gone
    const catalog = await pdf.getCatalog();
    expect(catalog?.has("OCProperties")).toBe(false);
  });

  it("hasLayers returns false after flattening", async () => {
    const bytes = await loadFixture("layers", "single-layer-on.pdf");
    const pdf = await PDF.load(bytes);

    await flattenLayers(pdf.context);

    expect(await hasLayers(pdf.context)).toBe(false);
  });

  it("getLayers returns empty after flattening", async () => {
    const bytes = await loadFixture("layers", "multiple-layers.pdf");
    const pdf = await PDF.load(bytes);

    await flattenLayers(pdf.context);

    const layers = await getLayers(pdf.context);
    expect(layers).toEqual([]);
  });
});

describe("round-trip", () => {
  it("saved PDF without layers opens correctly", async () => {
    const bytes = await loadFixture("layers", "single-layer-on.pdf");
    const pdf = await PDF.load(bytes);

    await flattenLayers(pdf.context);
    const savedBytes = await pdf.save();

    const reloaded = await PDF.load(savedBytes);
    expect(reloaded.getPageCount()).toBe(1);
    expect(await hasLayers(reloaded.context)).toBe(false);
  });

  it("page content preserved after layer flattening", async () => {
    const bytes = await loadFixture("layers", "single-layer-on.pdf");
    const pdf = await PDF.load(bytes);

    await flattenLayers(pdf.context);
    const savedBytes = await pdf.save();

    const reloaded = await PDF.load(savedBytes);
    expect(reloaded.getPageCount()).toBe(1);

    // The page should still have contents
    const page = await reloaded.getPage(0);
    expect(page?.dict.has("Contents")).toBe(true);
  });
});

describe("PDF class integration", () => {
  it("pdf.hasLayers() returns false for PDF without layers", async () => {
    const bytes = await loadFixture("layers", "no-layers.pdf");
    const pdf = await PDF.load(bytes);

    expect(await pdf.hasLayers()).toBe(false);
  });

  it("pdf.hasLayers() returns true for PDF with layers", async () => {
    const bytes = await loadFixture("layers", "single-layer-on.pdf");
    const pdf = await PDF.load(bytes);

    expect(await pdf.hasLayers()).toBe(true);
  });

  it("pdf.getLayers() returns layer information", async () => {
    const bytes = await loadFixture("layers", "multiple-layers.pdf");
    const pdf = await PDF.load(bytes);

    const layers = await pdf.getLayers();

    expect(layers).toHaveLength(3);
    expect(layers.map(l => l.name)).toContain("Background");
    expect(layers.map(l => l.name)).toContain("Hidden Layer");
    expect(layers.map(l => l.name)).toContain("Locked Layer");
  });

  it("pdf.flattenLayers() flattens layers", async () => {
    const bytes = await loadFixture("layers", "single-layer-on.pdf");
    const pdf = await PDF.load(bytes);

    const result = await pdf.flattenLayers();

    expect(result.flattened).toBe(true);
    expect(result.layerCount).toBe(1);
    expect(await pdf.hasLayers()).toBe(false);
  });

  it("flattenLayers before sign workflow", async () => {
    const bytes = await loadFixture("layers", "single-layer-on.pdf");
    const pdf = await PDF.load(bytes);

    // Flatten layers (security best practice before signing)
    await pdf.flattenLayers();

    // Verify layers are gone
    expect(await pdf.hasLayers()).toBe(false);

    // Document is ready for signing
    const savedBytes = await pdf.save();
    expect(savedBytes.length).toBeGreaterThan(0);
  });
});

describe("visual output tests", () => {
  it("outputs multiple-layers flattened", async () => {
    const bytes = await loadFixture("layers", "multiple-layers.pdf");
    const pdf = await PDF.load(bytes);

    const layers = await pdf.getLayers();
    console.log(`  Source: multiple-layers.pdf (${layers.length} layers)`);
    for (const layer of layers) {
      console.log(`    - "${layer.name}" (visible: ${layer.visible}, locked: ${layer.locked})`);
    }

    const result = await pdf.flattenLayers();
    const saved = await pdf.save();
    const path = await saveTestOutput("layers/multiple-layers-flattened.pdf", saved);
    console.log(`  -> Output: ${path}`);
    console.log(`     Layers flattened: ${result.layerCount}`);

    expect(saved.length).toBeGreaterThan(0);
  });

  it("outputs PDFBox header/footer layer flattened", async () => {
    const bytes = await loadFixture("layers", "pdfbox-header-footer.pdf");

    const layers = await (await PDF.load(bytes)).getLayers();
    console.log(
      `  Source: pdfbox-header-footer.pdf (${(await PDF.load(bytes)).getPageCount()} pages, ${layers.length} layer)`,
    );

    const pdf = await PDF.load(bytes);
    const result = await pdf.flattenLayers();
    const saved = await pdf.save();
    const path = await saveTestOutput("layers/pdfbox-header-footer-flattened.pdf", saved);
    console.log(`  -> Output: ${path}`);
    console.log(`     Layers flattened: ${result.layerCount}`);

    expect(saved.length).toBeGreaterThan(0);
    const reloaded = await PDF.load(saved);
    expect(await reloaded.hasLayers()).toBe(false);
    expect(reloaded.getPageCount()).toBe(8);
  });

  it("outputs PDF.js 49-layer flattened (complex OCG structure)", async () => {
    const bytes = await loadFixture("layers", "pdfjs-49-layers.pdf");

    const layers = await (await PDF.load(bytes)).getLayers();
    console.log(
      `  Source: pdfjs-49-layers.pdf (${(await PDF.load(bytes)).getPageCount()} page, ${layers.length} layers)`,
    );
    console.log(
      `  Sample layers: ${layers
        .slice(0, 3)
        .map(l => `"${l.name}"`)
        .join(", ")}...`,
    );

    const pdf = await PDF.load(bytes);
    const result = await pdf.flattenLayers();
    const saved = await pdf.save();
    const path = await saveTestOutput("layers/pdfjs-49-layers-flattened.pdf", saved);
    console.log(`  -> Output: ${path}`);
    console.log(`     Layers flattened: ${result.layerCount}`);

    expect(saved.length).toBeGreaterThan(0);
    const reloaded = await PDF.load(saved);
    expect(await reloaded.hasLayers()).toBe(false);
  });

  it("outputs PDF.js visibility expressions layer flattened", async () => {
    const bytes = await loadFixture("layers", "pdfjs-visibility-expressions.pdf");

    const layers = await (await PDF.load(bytes)).getLayers();
    console.log(
      `  Source: pdfjs-visibility-expressions.pdf (${(await PDF.load(bytes)).getPageCount()} page, ${layers.length} layers)`,
    );
    for (const layer of layers) {
      console.log(`    - "${layer.name}" (visible: ${layer.visible})`);
    }

    const pdf = await PDF.load(bytes);
    const result = await pdf.flattenLayers();
    const saved = await pdf.save();
    const path = await saveTestOutput("layers/pdfjs-visibility-expressions-flattened.pdf", saved);
    console.log(`  -> Output: ${path}`);
    console.log(`     Layers flattened: ${result.layerCount}`);

    expect(saved.length).toBeGreaterThan(0);
    const reloaded = await PDF.load(saved);
    expect(await reloaded.hasLayers()).toBe(false);
  });
});
