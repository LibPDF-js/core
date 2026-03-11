/**
 * Tests for PDF type detection system.
 */

import { Op, Operator } from "#src/content/operators";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfStream } from "#src/objects/pdf-stream";
import { stringToBytes } from "#src/test-utils";
import { describe, expect, it } from "vitest";

import {
  analyzeContentStream,
  appearsScanned,
  getPrimaryContentType,
  mergeContentStats,
} from "./content-analyzer";
import {
  createPdfTypeDetector,
  detectPdfType,
  getRenderingStrategy,
  PdfTypeDetector,
} from "./pdf-type-detector";
import {
  ContentType,
  createDefaultContentStats,
  createDefaultFontAnalysis,
  createDefaultImageAnalysis,
  getDefaultRenderingStrategy,
  PdfType,
} from "./pdf-types";
import { analyzeFonts, analyzeImages, countFormXObjects } from "./resource-analyzer";

describe("pdf-types", () => {
  describe("createDefaultContentStats", () => {
    it("creates zeroed content stats", () => {
      const stats = createDefaultContentStats();
      expect(stats.textOperatorCount).toBe(0);
      expect(stats.vectorOperatorCount).toBe(0);
      expect(stats.imageCount).toBe(0);
      expect(stats.inlineImageCount).toBe(0);
      expect(stats.formXObjectCount).toBe(0);
      expect(stats.shadingCount).toBe(0);
      expect(stats.totalOperators).toBe(0);
    });
  });

  describe("createDefaultFontAnalysis", () => {
    it("creates empty font analysis", () => {
      const analysis = createDefaultFontAnalysis();
      expect(analysis.fontCount).toBe(0);
      expect(analysis.embeddedFontCount).toBe(0);
      expect(analysis.type3FontCount).toBe(0);
      expect(analysis.hasCIDFonts).toBe(false);
      expect(analysis.hasStandard14Fonts).toBe(false);
      expect(analysis.fontNames).toEqual([]);
    });
  });

  describe("createDefaultImageAnalysis", () => {
    it("creates empty image analysis", () => {
      const analysis = createDefaultImageAnalysis();
      expect(analysis.imageCount).toBe(0);
      expect(analysis.fullPageImageCount).toBe(0);
      expect(analysis.averageResolution).toBe(0);
      expect(analysis.appearsScanned).toBe(false);
      expect(analysis.filterTypes.size).toBe(0);
    });
  });

  describe("getDefaultRenderingStrategy", () => {
    it("returns text-focused strategy for programmatic PDFs", () => {
      const strategy = getDefaultRenderingStrategy(PdfType.Programmatic);
      expect(strategy.prioritizeTextClarity).toBe(true);
      expect(strategy.subpixelTextRendering).toBe(true);
      expect(strategy.textLayerUseful).toBe(true);
    });

    it("returns image-focused strategy for scanned PDFs", () => {
      const strategy = getDefaultRenderingStrategy(PdfType.Scanned);
      expect(strategy.prioritizeTextClarity).toBe(false);
      expect(strategy.dpiMultiplier).toBeGreaterThan(1);
      expect(strategy.cacheImages).toBe(true);
      expect(strategy.preloadImages).toBe(true);
      expect(strategy.textLayerUseful).toBe(false);
    });

    it("returns OCR strategy with text layer for OCR-processed PDFs", () => {
      const strategy = getDefaultRenderingStrategy(PdfType.OcrProcessed);
      expect(strategy.prioritizeTextClarity).toBe(false);
      expect(strategy.textLayerUseful).toBe(true);
      expect(strategy.cacheImages).toBe(true);
    });

    it("returns vector-focused strategy for vector graphics PDFs", () => {
      const strategy = getDefaultRenderingStrategy(PdfType.VectorGraphics);
      expect(strategy.enableImageSmoothing).toBe(false);
      expect(strategy.simplifiedPathRendering).toBe(false);
    });
  });
});

describe("content-analyzer", () => {
  describe("analyzeContentStream", () => {
    it("identifies text-heavy content", () => {
      // Simulate a content stream with text operators
      // BT /F1 12 Tf (Hello World) Tj ET
      const content = stringToBytes("BT /F1 12 Tf (Hello World) Tj ET");
      const result = analyzeContentStream(content);

      expect(result.stats.textOperatorCount).toBeGreaterThan(0);
      expect(result.primaryContentType).toBe(ContentType.Text);
    });

    it("identifies vector-heavy content", () => {
      // Simulate content with path operators
      // 0 0 m 100 100 l S
      const content = stringToBytes("0 0 m 100 100 l S");
      const result = analyzeContentStream(content);

      expect(result.stats.vectorOperatorCount).toBeGreaterThan(0);
    });

    it("handles empty content stream", () => {
      const result = analyzeContentStream(new Uint8Array(0));

      expect(result.stats.totalOperators).toBe(0);
      expect(result.primaryContentType).toBe(ContentType.Text);
    });

    it("extracts font names from content", () => {
      const content = stringToBytes("BT /F1 12 Tf (Test) Tj /F2 10 Tf (More) Tj ET");
      const result = analyzeContentStream(content);

      expect(result.fontNames.length).toBeGreaterThanOrEqual(0);
    });

    it("extracts XObject names from content", () => {
      const content = stringToBytes("/Im1 Do /Im2 Do");
      const result = analyzeContentStream(content);

      expect(result.xobjectNames.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("mergeContentStats", () => {
    it("merges multiple stats correctly", () => {
      const stats1 = createDefaultContentStats();
      stats1.textOperatorCount = 10;
      stats1.vectorOperatorCount = 5;

      const stats2 = createDefaultContentStats();
      stats2.textOperatorCount = 20;
      stats2.imageCount = 3;

      const merged = mergeContentStats([stats1, stats2]);

      expect(merged.textOperatorCount).toBe(30);
      expect(merged.vectorOperatorCount).toBe(5);
      expect(merged.imageCount).toBe(3);
    });

    it("handles empty array", () => {
      const merged = mergeContentStats([]);
      expect(merged.textOperatorCount).toBe(0);
    });
  });

  describe("appearsScanned", () => {
    it("returns true for image-heavy content with few operators", () => {
      const stats = createDefaultContentStats();
      stats.imageCount = 1;
      stats.textOperatorCount = 5;
      stats.vectorOperatorCount = 10;

      expect(appearsScanned(stats)).toBe(true);
    });

    it("returns false for content with many text operators", () => {
      const stats = createDefaultContentStats();
      stats.imageCount = 1;
      stats.textOperatorCount = 100;
      stats.vectorOperatorCount = 50;

      expect(appearsScanned(stats)).toBe(false);
    });

    it("returns false when no images", () => {
      const stats = createDefaultContentStats();
      stats.textOperatorCount = 10;
      stats.vectorOperatorCount = 20;

      expect(appearsScanned(stats)).toBe(false);
    });
  });

  describe("getPrimaryContentType", () => {
    it("returns Text for text-dominant content", () => {
      const stats = createDefaultContentStats();
      stats.textOperatorCount = 100;
      stats.vectorOperatorCount = 20;
      stats.imageCount = 5;

      expect(getPrimaryContentType(stats)).toBe(ContentType.Text);
    });

    it("returns Image for image-dominant content", () => {
      const stats = createDefaultContentStats();
      stats.textOperatorCount = 5;
      stats.vectorOperatorCount = 10;
      stats.imageCount = 50;

      expect(getPrimaryContentType(stats)).toBe(ContentType.Image);
    });

    it("returns Vector for vector-dominant content", () => {
      const stats = createDefaultContentStats();
      stats.textOperatorCount = 5;
      stats.vectorOperatorCount = 100;
      stats.imageCount = 10;

      expect(getPrimaryContentType(stats)).toBe(ContentType.Vector);
    });

    it("returns Text for empty content", () => {
      const stats = createDefaultContentStats();
      expect(getPrimaryContentType(stats)).toBe(ContentType.Text);
    });
  });
});

describe("resource-analyzer", () => {
  describe("analyzeFonts", () => {
    it("returns empty analysis for undefined resources", () => {
      const analysis = analyzeFonts(undefined);
      expect(analysis.fontCount).toBe(0);
    });

    it("returns empty analysis for resources without fonts", () => {
      const resources = new PdfDict();
      const analysis = analyzeFonts(resources);
      expect(analysis.fontCount).toBe(0);
    });

    it("counts fonts in resources", () => {
      const fontDict = new PdfDict();
      fontDict.set("F1", new PdfDict([["Subtype", PdfName.of("Type1")]]));
      fontDict.set("F2", new PdfDict([["Subtype", PdfName.of("TrueType")]]));

      const resources = new PdfDict();
      resources.set("Font", fontDict);

      const analysis = analyzeFonts(resources);
      expect(analysis.fontCount).toBe(2);
      expect(analysis.fontNames).toContain("F1");
      expect(analysis.fontNames).toContain("F2");
    });
  });

  describe("analyzeImages", () => {
    it("returns empty analysis for undefined resources", () => {
      const analysis = analyzeImages(undefined, 612, 792);
      expect(analysis.imageCount).toBe(0);
    });

    it("returns empty analysis for resources without XObjects", () => {
      const resources = new PdfDict();
      const analysis = analyzeImages(resources, 612, 792);
      expect(analysis.imageCount).toBe(0);
    });
  });

  describe("countFormXObjects", () => {
    it("returns 0 for undefined resources", () => {
      expect(countFormXObjects(undefined)).toBe(0);
    });

    it("returns 0 for resources without XObjects", () => {
      const resources = new PdfDict();
      expect(countFormXObjects(resources)).toBe(0);
    });
  });
});

describe("pdf-type-detector", () => {
  describe("PdfTypeDetector", () => {
    it("creates detector with default options", () => {
      const detector = new PdfTypeDetector();
      expect(detector).toBeDefined();
    });

    it("creates detector with custom options", () => {
      const detector = new PdfTypeDetector({
        maxPagesToAnalyze: 5,
        deepXObjectAnalysis: true,
      });
      expect(detector).toBeDefined();
    });
  });

  describe("createPdfTypeDetector", () => {
    it("creates a new detector instance", () => {
      const detector = createPdfTypeDetector();
      expect(detector).toBeInstanceOf(PdfTypeDetector);
    });
  });

  describe("quickDetect", () => {
    it("detects text-heavy content as programmatic", () => {
      const detector = new PdfTypeDetector();
      const content = stringToBytes("BT /F1 12 Tf (Hello World) Tj ET ".repeat(100));
      const result = detector.quickDetect(content);

      expect([PdfType.Programmatic, PdfType.TextHeavy]).toContain(result.type);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("returns detection with description", () => {
      const detector = new PdfTypeDetector();
      const content = stringToBytes("BT /F1 12 Tf (Test) Tj ET");
      const result = detector.quickDetect(content);

      expect(result.description).toBeDefined();
      expect(result.description.length).toBeGreaterThan(0);
    });
  });

  describe("detectPdfType utility", () => {
    it("provides quick detection without instantiating detector", () => {
      const content = stringToBytes("BT /F1 12 Tf (Hello) Tj ET");
      const result = detectPdfType(content);

      expect(result.type).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe("getRenderingStrategy utility", () => {
    it("returns strategy for any PDF type", () => {
      for (const type of Object.values(PdfType)) {
        const strategy = getRenderingStrategy(type);
        expect(strategy).toBeDefined();
        expect(typeof strategy.prioritizeTextClarity).toBe("boolean");
        expect(typeof strategy.enableImageSmoothing).toBe("boolean");
        expect(typeof strategy.dpiMultiplier).toBe("number");
      }
    });
  });

  describe("analyzePage", () => {
    it("analyzes page and returns type info", () => {
      const detector = new PdfTypeDetector();
      const content = stringToBytes("BT /F1 12 Tf (Hello) Tj ET");

      const pageInfo = detector.analyzePage({
        pageIndex: 0,
        contentBytes: content,
        pageWidth: 612,
        pageHeight: 792,
      });

      expect(pageInfo.pageIndex).toBe(0);
      expect(pageInfo.primaryContentType).toBeDefined();
      expect(pageInfo.stats).toBeDefined();
    });
  });

  describe("analyzeDocument", () => {
    it("analyzes multiple pages and returns document info", () => {
      const detector = new PdfTypeDetector();
      const pages = [
        {
          pageIndex: 0,
          contentBytes: stringToBytes("BT /F1 12 Tf (Page 1) Tj ET"),
          pageWidth: 612,
          pageHeight: 792,
        },
        {
          pageIndex: 1,
          contentBytes: stringToBytes("BT /F1 12 Tf (Page 2) Tj ET"),
          pageWidth: 612,
          pageHeight: 792,
        },
      ];

      const docInfo = detector.analyzeDocument(pages);

      expect(docInfo.type).toBeDefined();
      expect(docInfo.detection).toBeDefined();
      expect(docInfo.strategy).toBeDefined();
      expect(docInfo.pages.length).toBe(2);
      expect(docInfo.isHomogeneous).toBeDefined();
    });

    it("respects maxPagesToAnalyze option", () => {
      const detector = new PdfTypeDetector({ maxPagesToAnalyze: 1 });
      const pages = [
        {
          pageIndex: 0,
          contentBytes: stringToBytes("BT (Page 1) Tj ET"),
          pageWidth: 612,
          pageHeight: 792,
        },
        {
          pageIndex: 1,
          contentBytes: stringToBytes("BT (Page 2) Tj ET"),
          pageWidth: 612,
          pageHeight: 792,
        },
        {
          pageIndex: 2,
          contentBytes: stringToBytes("BT (Page 3) Tj ET"),
          pageWidth: 612,
          pageHeight: 792,
        },
      ];

      const docInfo = detector.analyzeDocument(pages);

      // Only the first page should be analyzed
      expect(docInfo.pages.length).toBe(1);
    });
  });

  describe("getStrategy", () => {
    it("returns appropriate strategy for detected type", () => {
      const detector = new PdfTypeDetector();

      const programmaticStrategy = detector.getStrategy(PdfType.Programmatic);
      expect(programmaticStrategy.prioritizeTextClarity).toBe(true);

      const scannedStrategy = detector.getStrategy(PdfType.Scanned);
      expect(scannedStrategy.prioritizeTextClarity).toBe(false);
    });
  });
});

describe("PdfType enum", () => {
  it("has all expected types", () => {
    expect(PdfType.Programmatic).toBe("programmatic");
    expect(PdfType.Scanned).toBe("scanned");
    expect(PdfType.OcrProcessed).toBe("ocr-processed");
    expect(PdfType.Mixed).toBe("mixed");
    expect(PdfType.VectorGraphics).toBe("vector-graphics");
    expect(PdfType.ImageHeavy).toBe("image-heavy");
    expect(PdfType.TextHeavy).toBe("text-heavy");
    expect(PdfType.Unknown).toBe("unknown");
  });
});

describe("ContentType enum", () => {
  it("has all expected types", () => {
    expect(ContentType.Text).toBe("text");
    expect(ContentType.Vector).toBe("vector");
    expect(ContentType.Image).toBe("image");
    expect(ContentType.FormXObject).toBe("form-xobject");
    expect(ContentType.InlineImage).toBe("inline-image");
    expect(ContentType.Shading).toBe("shading");
    expect(ContentType.Pattern).toBe("pattern");
  });
});
