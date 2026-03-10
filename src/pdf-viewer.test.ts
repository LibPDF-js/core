/**
 * Tests for PDFViewer class.
 */

import { loadFixture } from "#src/test-utils";
import { describe, expect, it, vi } from "vitest";

import { PDF } from "./api/pdf";
import { createPDFViewer, PDFViewer } from "./pdf-viewer";

describe("PDFViewer", () => {
  describe("construction", () => {
    it("creates a viewer with default options", () => {
      const viewer = new PDFViewer();

      expect(viewer).toBeInstanceOf(PDFViewer);
      expect(viewer.initialized).toBe(false);
      expect(viewer.scale).toBe(1);
      expect(viewer.rotation).toBe(0);
      expect(viewer.scrollMode).toBe("vertical");
      expect(viewer.spreadMode).toBe("none");
      expect(viewer.currentPage).toBe(1);
      expect(viewer.pageCount).toBe(0);
      expect(viewer.document).toBeUndefined();
    });

    it("creates a viewer with custom options", () => {
      const viewer = new PDFViewer({
        scale: 2,
        rotation: 90,
        scrollMode: "horizontal",
        spreadMode: "odd",
        renderer: "svg",
      });

      expect(viewer.scale).toBe(2);
      expect(viewer.rotation).toBe(90);
      expect(viewer.scrollMode).toBe("horizontal");
      expect(viewer.spreadMode).toBe("odd");
    });

    it("creates a viewer with a document", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      const viewer = new PDFViewer({ document: pdf });

      expect(viewer.document).toBe(pdf);
      expect(viewer.pageCount).toBeGreaterThan(0);
    });

    it("createPDFViewer factory function works", () => {
      const viewer = createPDFViewer({ scale: 1.5 });

      expect(viewer).toBeInstanceOf(PDFViewer);
      expect(viewer.scale).toBe(1.5);
    });
  });

  describe("initialization", () => {
    it("initializes successfully", async () => {
      const viewer = new PDFViewer();

      await viewer.initialize();

      expect(viewer.initialized).toBe(true);
      expect(viewer.pipeline).not.toBeNull();
    });

    it("is idempotent - multiple calls do not error", async () => {
      const viewer = new PDFViewer();

      await viewer.initialize();
      await viewer.initialize();

      expect(viewer.initialized).toBe(true);
    });

    it("initializes with canvas renderer by default", async () => {
      const viewer = new PDFViewer();

      await viewer.initialize();

      expect(viewer.pipeline?.rendererType).toBe("canvas");
    });

    it("initializes with SVG renderer when specified", async () => {
      const viewer = new PDFViewer({ renderer: "svg" });

      await viewer.initialize();

      expect(viewer.pipeline?.rendererType).toBe("svg");
    });
  });

  describe("document management", () => {
    it("setDocument updates the document", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const viewer = new PDFViewer();

      viewer.setDocument(pdf);

      expect(viewer.document).toBe(pdf);
      expect(viewer.pageCount).toBeGreaterThan(0);
    });

    it("setDocument resets current page to 1", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf1 = await PDF.load(bytes);
      const pdf2 = await PDF.load(bytes);
      const viewer = new PDFViewer({ document: pdf1 });

      await viewer.initialize();
      if (viewer.pageCount > 1) {
        viewer.goToPage(2);
      }

      viewer.setDocument(pdf2);

      expect(viewer.currentPage).toBe(1);
    });

    it("getPage returns the correct page", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const viewer = new PDFViewer({ document: pdf });

      const page = viewer.getPage(1);

      expect(page).not.toBeNull();
      expect(page.index).toBe(0);
    });

    it("getPage throws for invalid page number", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const viewer = new PDFViewer({ document: pdf });

      expect(() => viewer.getPage(0)).toThrow("Invalid page number");
      expect(() => viewer.getPage(1000)).toThrow("Invalid page number");
    });

    it("getPage throws when no document is loaded", () => {
      const viewer = new PDFViewer();

      expect(() => viewer.getPage(1)).toThrow("No document loaded");
    });
  });

  describe("navigation", () => {
    it("goToPage updates current page", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const viewer = new PDFViewer({ document: pdf });

      if (viewer.pageCount >= 2) {
        viewer.goToPage(2);
        expect(viewer.currentPage).toBe(2);
      }
    });

    it("goToPage throws for invalid page number", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const viewer = new PDFViewer({ document: pdf });

      expect(() => viewer.goToPage(0)).toThrow("Invalid page number");
      expect(() => viewer.goToPage(1000)).toThrow("Invalid page number");
    });

    it("nextPage advances to next page", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const viewer = new PDFViewer({ document: pdf });

      if (viewer.pageCount >= 2) {
        viewer.nextPage();
        expect(viewer.currentPage).toBe(2);
      }
    });

    it("nextPage does nothing at last page", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const viewer = new PDFViewer({ document: pdf });

      viewer.goToPage(viewer.pageCount);
      viewer.nextPage();

      expect(viewer.currentPage).toBe(viewer.pageCount);
    });

    it("previousPage goes to previous page", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const viewer = new PDFViewer({ document: pdf });

      if (viewer.pageCount >= 2) {
        viewer.goToPage(2);
        viewer.previousPage();
        expect(viewer.currentPage).toBe(1);
      }
    });

    it("previousPage does nothing at first page", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const viewer = new PDFViewer({ document: pdf });

      viewer.previousPage();

      expect(viewer.currentPage).toBe(1);
    });

    it("firstPage goes to page 1", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const viewer = new PDFViewer({ document: pdf });

      if (viewer.pageCount >= 2) {
        viewer.goToPage(2);
        viewer.firstPage();
        expect(viewer.currentPage).toBe(1);
      }
    });

    it("lastPage goes to last page", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const viewer = new PDFViewer({ document: pdf });

      viewer.lastPage();

      expect(viewer.currentPage).toBe(viewer.pageCount);
    });
  });

  describe("scale and rotation", () => {
    it("setScale updates scale", async () => {
      const viewer = new PDFViewer();
      await viewer.initialize();

      viewer.setScale(2);

      expect(viewer.scale).toBe(2);
    });

    it("setScale throws for non-positive scale", () => {
      const viewer = new PDFViewer();

      expect(() => viewer.setScale(0)).toThrow("Scale must be positive");
      expect(() => viewer.setScale(-1)).toThrow("Scale must be positive");
    });

    it("setRotation updates rotation", async () => {
      const viewer = new PDFViewer();
      await viewer.initialize();

      viewer.setRotation(90);

      expect(viewer.rotation).toBe(90);
    });

    it("setRotation normalizes rotation values", async () => {
      const viewer = new PDFViewer();
      await viewer.initialize();

      viewer.setRotation(450);
      expect(viewer.rotation).toBe(90);

      viewer.setRotation(-90);
      expect(viewer.rotation).toBe(270);
    });

    it("setScrollMode updates scroll mode", () => {
      const viewer = new PDFViewer();

      viewer.setScrollMode("horizontal");

      expect(viewer.scrollMode).toBe("horizontal");
    });

    it("setSpreadMode updates spread mode", () => {
      const viewer = new PDFViewer();

      viewer.setSpreadMode("even");

      expect(viewer.spreadMode).toBe("even");
    });
  });

  describe("events", () => {
    it("emits pagechange event on navigation", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const viewer = new PDFViewer({ document: pdf });
      const listener = vi.fn();

      viewer.addEventListener("pagechange", listener);

      if (viewer.pageCount >= 2) {
        viewer.goToPage(2);

        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "pagechange",
            pageNumber: 2,
          }),
        );
      }
    });

    it("emits scalechange event on scale change", async () => {
      const viewer = new PDFViewer();
      await viewer.initialize();
      const listener = vi.fn();

      viewer.addEventListener("scalechange", listener);
      viewer.setScale(2);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "scalechange",
          scale: 2,
        }),
      );
    });

    it("emits rotationchange event on rotation change", async () => {
      const viewer = new PDFViewer();
      await viewer.initialize();
      const listener = vi.fn();

      viewer.addEventListener("rotationchange", listener);
      viewer.setRotation(90);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "rotationchange",
          rotation: 90,
        }),
      );
    });

    it("removeEventListener removes listener", async () => {
      const viewer = new PDFViewer();
      await viewer.initialize();
      const listener = vi.fn();

      viewer.addEventListener("scalechange", listener);
      viewer.removeEventListener("scalechange", listener);
      viewer.setScale(2);

      expect(listener).not.toHaveBeenCalled();
    });

    it("does not emit event when value unchanged", async () => {
      const viewer = new PDFViewer({ scale: 1 });
      await viewer.initialize();
      const listener = vi.fn();

      viewer.addEventListener("scalechange", listener);
      viewer.setScale(1);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("viewport creation", () => {
    it("createViewport throws before initialization", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const viewer = new PDFViewer({ document: pdf });

      expect(() => viewer.createViewport(1)).toThrow("Viewer must be initialized");
    });

    it("createViewport returns viewport with correct dimensions", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const viewer = new PDFViewer({ document: pdf });
      await viewer.initialize();

      const viewport = viewer.createViewport(1);

      expect(viewport.width).toBeGreaterThan(0);
      expect(viewport.height).toBeGreaterThan(0);
      expect(viewport.scale).toBe(1);
      expect(viewport.rotation).toBe(0);
    });

    it("createViewport respects custom scale and rotation", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const viewer = new PDFViewer({ document: pdf });
      await viewer.initialize();

      const viewport = viewer.createViewport(1, 2, 90);

      expect(viewport.scale).toBe(2);
      expect(viewport.rotation).toBe(90);
    });

    it("createViewport uses viewer scale and rotation when not specified", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const viewer = new PDFViewer({ document: pdf, scale: 1.5, rotation: 180 });
      await viewer.initialize();

      const viewport = viewer.createViewport(1);

      expect(viewport.scale).toBe(1.5);
      expect(viewport.rotation).toBe(180);
    });
  });

  describe("rendering", () => {
    it("renderPage throws before initialization", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const viewer = new PDFViewer({ document: pdf });

      expect(() => viewer.renderPage(1)).toThrow("Viewer must be initialized");
    });

    it("renderPages returns tasks for multiple pages", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const viewer = new PDFViewer({ document: pdf });
      await viewer.initialize();

      const tasks = viewer.renderPages([1]);

      expect(tasks.size).toBe(1);
      expect(tasks.has(1)).toBe(true);
    });
  });

  describe("cleanup", () => {
    it("destroy cleans up resources", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const viewer = new PDFViewer({ document: pdf });
      await viewer.initialize();

      viewer.destroy();

      expect(viewer.initialized).toBe(false);
      expect(viewer.pipeline).toBeNull();
    });

    it("clearCache clears the render cache", async () => {
      const viewer = new PDFViewer();
      await viewer.initialize();

      // Should not throw
      viewer.clearCache();
    });

    it("cancelAllRenders cancels pending renders", async () => {
      const viewer = new PDFViewer();
      await viewer.initialize();

      // Should not throw
      viewer.cancelAllRenders();
    });
  });
});
