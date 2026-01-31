import { PDF, rgb } from "#src/index";
import { loadFixture } from "#src/test-utils";
import { beforeEach, describe, expect, it } from "vitest";

describe("Factory Creation and Resource Registration", () => {
  let pdf: PDF;
  let page: ReturnType<typeof pdf.addPage>;

  beforeEach(() => {
    pdf = PDF.create();
    page = pdf.addPage({ width: 612, height: 792 });
  });

  describe("Shading Creation", () => {
    describe("createAxialShading", () => {
      it("should create an axial shading resource", () => {
        const shading = pdf.createAxialShading({
          coords: [0, 0, 100, 0],
          stops: [
            { offset: 0, color: rgb(1, 0, 0) },
            { offset: 1, color: rgb(0, 0, 1) },
          ],
        });

        expect(shading.type).toBe("shading");
        expect(shading.shadingType).toBe("axial");
        expect(shading.ref).toBeDefined();
      });

      it("should create shading with multiple stops", () => {
        const shading = pdf.createAxialShading({
          coords: [0, 0, 100, 0],
          stops: [
            { offset: 0, color: rgb(1, 0, 0) },
            { offset: 0.5, color: rgb(0, 1, 0) },
            { offset: 1, color: rgb(0, 0, 1) },
          ],
        });

        expect(shading.type).toBe("shading");
      });
    });

    describe("createRadialShading", () => {
      it("should create a radial shading resource", () => {
        const shading = pdf.createRadialShading({
          coords: [50, 50, 0, 50, 50, 50],
          stops: [
            { offset: 0, color: rgb(1, 1, 1) },
            { offset: 1, color: rgb(0, 0, 0) },
          ],
        });

        expect(shading.type).toBe("shading");
        expect(shading.shadingType).toBe("radial");
      });
    });

    describe("createLinearGradient", () => {
      it("should create a linear gradient with angle", () => {
        const gradient = pdf.createLinearGradient({
          angle: 90,
          length: 100,
          stops: [
            { offset: 0, color: rgb(1, 0, 0) },
            { offset: 1, color: rgb(0, 0, 1) },
          ],
        });

        expect(gradient.type).toBe("shading");
        expect(gradient.shadingType).toBe("axial");
      });

      it("should create gradient with different angles", () => {
        const angles = [0, 45, 90, 180, 270];

        for (const angle of angles) {
          const gradient = pdf.createLinearGradient({
            angle,
            length: 100,
            stops: [
              { offset: 0, color: rgb(1, 0, 0) },
              { offset: 1, color: rgb(0, 0, 1) },
            ],
          });

          expect(gradient.type).toBe("shading");
        }
      });
    });

    describe("registerShading", () => {
      it("should return a shading resource name", () => {
        const shading = pdf.createAxialShading({
          coords: [0, 0, 100, 0],
          stops: [
            { offset: 0, color: rgb(1, 0, 0) },
            { offset: 1, color: rgb(0, 0, 1) },
          ],
        });
        const name = page.registerShading(shading);

        expect(name).toMatch(/^Sh\d+$/);
      });

      it("should return same name for same shading (deduplication)", () => {
        const shading = pdf.createAxialShading({
          coords: [0, 0, 100, 0],
          stops: [
            { offset: 0, color: rgb(1, 0, 0) },
            { offset: 1, color: rgb(0, 0, 1) },
          ],
        });
        const name1 = page.registerShading(shading);
        const name2 = page.registerShading(shading);

        expect(name1).toBe(name2);
      });
    });
  });

  describe("Pattern Creation", () => {
    describe("createTilingPattern", () => {
      it("should create a tiling pattern resource", () => {
        const pattern = pdf.createTilingPattern({
          bbox: { x: 0, y: 0, width: 10, height: 10 },
          xStep: 10,
          yStep: 10,
          operators: [],
        });

        expect(pattern.type).toBe("pattern");
        expect(pattern.patternType).toBe("tiling");
      });
    });

    describe("registerPattern", () => {
      it("should return a pattern resource name", () => {
        const pattern = pdf.createTilingPattern({
          bbox: { x: 0, y: 0, width: 10, height: 10 },
          xStep: 10,
          yStep: 10,
          operators: [],
        });
        const name = page.registerPattern(pattern);

        expect(name).toMatch(/^P\d+$/);
      });

      it("should return same name for same pattern (deduplication)", () => {
        const pattern = pdf.createTilingPattern({
          bbox: { x: 0, y: 0, width: 10, height: 10 },
          xStep: 10,
          yStep: 10,
          operators: [],
        });
        const name1 = page.registerPattern(pattern);
        const name2 = page.registerPattern(pattern);

        expect(name1).toBe(name2);
      });
    });
  });

  describe("ExtGState Creation", () => {
    describe("createExtGState", () => {
      it("should create an ExtGState with fill opacity", () => {
        const gs = pdf.createExtGState({ fillOpacity: 0.5 });

        expect(gs.type).toBe("extgstate");
        expect(gs.ref).toBeDefined();
      });

      it("should create an ExtGState with stroke opacity", () => {
        const gs = pdf.createExtGState({ strokeOpacity: 0.8 });

        expect(gs.type).toBe("extgstate");
      });

      it("should create an ExtGState with blend mode", () => {
        const gs = pdf.createExtGState({ blendMode: "Multiply" });

        expect(gs.type).toBe("extgstate");
      });

      it("should create an ExtGState with multiple properties", () => {
        const gs = pdf.createExtGState({
          fillOpacity: 0.5,
          strokeOpacity: 0.8,
          blendMode: "Multiply",
        });

        expect(gs.type).toBe("extgstate");
      });
    });

    describe("registerExtGState", () => {
      it("should return an ExtGState resource name", () => {
        const gs = pdf.createExtGState({ fillOpacity: 0.5 });
        const name = page.registerExtGState(gs);

        expect(name).toMatch(/^GS\d+$/);
      });

      it("should return same name for same ExtGState (deduplication)", () => {
        const gs = pdf.createExtGState({ fillOpacity: 0.5 });
        const name1 = page.registerExtGState(gs);
        const name2 = page.registerExtGState(gs);

        expect(name1).toBe(name2);
      });
    });
  });

  describe("Form XObject Creation", () => {
    describe("createFormXObject", () => {
      it("should create a Form XObject resource", () => {
        const xobject = pdf.createFormXObject({
          bbox: { x: 0, y: 0, width: 100, height: 50 },
          operators: [],
        });

        expect(xobject.type).toBe("formxobject");
        expect(xobject.bbox).toEqual({ x: 0, y: 0, width: 100, height: 50 });
      });
    });

    describe("registerXObject", () => {
      it("should return an XObject resource name", () => {
        const formXObject = pdf.createFormXObject({
          bbox: { x: 0, y: 0, width: 100, height: 50 },
          operators: [],
        });
        const name = page.registerXObject(formXObject);

        expect(name).toMatch(/^Fm\d+$/);
      });

      it("should return same name for same XObject (deduplication)", () => {
        const formXObject = pdf.createFormXObject({
          bbox: { x: 0, y: 0, width: 100, height: 50 },
          operators: [],
        });
        const name1 = page.registerXObject(formXObject);
        const name2 = page.registerXObject(formXObject);

        expect(name1).toBe(name2);
      });
    });
  });

  describe("Font Registration", () => {
    describe("registerFont", () => {
      it("should return unique names for different fonts", () => {
        const name1 = page.registerFont("Helvetica");
        const name2 = page.registerFont("Times-Roman");

        expect(name1).not.toBe(name2);
        expect(name1).toMatch(/^F\d+$/);
        expect(name2).toMatch(/^F\d+$/);
      });

      it("should return same name for same font (deduplication)", () => {
        const name1 = page.registerFont("Helvetica");
        const name2 = page.registerFont("Helvetica");

        expect(name1).toBe(name2);
      });
    });
  });

  describe("Image Registration", () => {
    describe("registerImage", () => {
      it("should return an image resource name", async () => {
        const jpegBytes = await loadFixture("images", "red-square.jpg");
        const image = pdf.embedJpeg(jpegBytes);
        const name = page.registerImage(image);

        expect(name).toMatch(/^Im\d+$/);
      });

      it("should return same name for same image (deduplication)", async () => {
        const jpegBytes = await loadFixture("images", "red-square.jpg");
        const image = pdf.embedJpeg(jpegBytes);
        const name1 = page.registerImage(image);
        const name2 = page.registerImage(image);

        expect(name1).toBe(name2);
      });
    });
  });

  describe("Shading Patterns", () => {
    describe("createShadingPattern", () => {
      it("should create a shading pattern from a gradient", () => {
        const gradient = pdf.createAxialShading({
          coords: [0, 0, 100, 0],
          stops: [
            { offset: 0, color: { type: "RGB", red: 1, green: 0, blue: 0 } },
            { offset: 1, color: { type: "RGB", red: 0, green: 0, blue: 1 } },
          ],
        });

        const pattern = pdf.createShadingPattern({ shading: gradient });

        expect(pattern.type).toBe("pattern");
        expect(pattern.patternType).toBe("shading");
        expect(pattern.shading).toBe(gradient);
        expect(pattern.ref).toBeDefined();
      });

      it("should register and use shading pattern with PathBuilder fill", async () => {
        const gradient = pdf.createAxialShading({
          coords: [0, 0, 100, 0],
          stops: [
            { offset: 0, color: { type: "RGB", red: 1, green: 0, blue: 0 } },
            { offset: 1, color: { type: "RGB", red: 0, green: 0, blue: 1 } },
          ],
        });

        const pattern = pdf.createShadingPattern({ shading: gradient });

        // Use with PathBuilder fill({ pattern })
        page.drawPath().rectangle(50, 50, 100, 100).fill({ pattern });

        const bytes = await pdf.save();
        expect(bytes.length).toBeGreaterThan(0);
      });

      it("should register and use shading pattern with PathBuilder stroke", async () => {
        const gradient = pdf.createAxialShading({
          coords: [0, 0, 100, 0],
          stops: [
            { offset: 0, color: { type: "RGB", red: 1, green: 0, blue: 0 } },
            { offset: 1, color: { type: "RGB", red: 0, green: 0, blue: 1 } },
          ],
        });

        const pattern = pdf.createShadingPattern({ shading: gradient });

        // Use with PathBuilder stroke({ borderPattern })
        page
          .drawPath()
          .rectangle(50, 50, 100, 100)
          .stroke({ borderPattern: pattern, borderWidth: 5 });

        const bytes = await pdf.save();
        expect(bytes.length).toBeGreaterThan(0);
      });

      it("should support matrix transformation", () => {
        const gradient = pdf.createAxialShading({
          coords: [0, 0, 100, 0],
          stops: [
            { offset: 0, color: { type: "RGB", red: 1, green: 0, blue: 0 } },
            { offset: 1, color: { type: "RGB", red: 0, green: 0, blue: 1 } },
          ],
        });

        // Create pattern with translation matrix
        const pattern = pdf.createShadingPattern({
          shading: gradient,
          matrix: [1, 0, 0, 1, 50, 100], // Translate by (50, 100)
        });

        expect(pattern.type).toBe("pattern");
        expect(pattern.patternType).toBe("shading");
      });
    });

    describe("registerPattern with shading patterns", () => {
      it("should register shading pattern and return name", () => {
        const gradient = pdf.createAxialShading({
          coords: [0, 0, 100, 0],
          stops: [
            { offset: 0, color: { type: "RGB", red: 1, green: 0, blue: 0 } },
            { offset: 1, color: { type: "RGB", red: 0, green: 0, blue: 1 } },
          ],
        });

        const pattern = pdf.createShadingPattern({ shading: gradient });
        const name = page.registerPattern(pattern);

        expect(name).toMatch(/^P\d+$/);
      });

      it("should deduplicate same shading pattern", () => {
        const gradient = pdf.createAxialShading({
          coords: [0, 0, 100, 0],
          stops: [
            { offset: 0, color: { type: "RGB", red: 1, green: 0, blue: 0 } },
            { offset: 1, color: { type: "RGB", red: 0, green: 0, blue: 1 } },
          ],
        });

        const pattern = pdf.createShadingPattern({ shading: gradient });
        const name1 = page.registerPattern(pattern);
        const name2 = page.registerPattern(pattern);

        expect(name1).toBe(name2);
      });
    });
  });

  describe("Image Patterns", () => {
    describe("createImagePattern", () => {
      it("should create an image pattern", async () => {
        const imageBytes = await loadFixture("images", "red-square.png");
        const image = pdf.embedImage(imageBytes);
        const pattern = pdf.createImagePattern({ image });

        expect(pattern.type).toBe("pattern");
        expect(pattern.patternType).toBe("tiling");
        expect(pattern.ref).toBeDefined();
      });

      it("should create an image pattern with custom dimensions", async () => {
        const imageBytes = await loadFixture("images", "red-square.png");
        const image = pdf.embedImage(imageBytes);
        const pattern = pdf.createImagePattern({
          image,
          width: 50,
          height: 50,
        });

        expect(pattern.type).toBe("pattern");
        expect(pattern.patternType).toBe("tiling");
      });

      it("should register and use image pattern to fill a shape", async () => {
        const imageBytes = await loadFixture("images", "red-square.png");
        const image = pdf.embedImage(imageBytes);
        const pattern = pdf.createImagePattern({
          image,
          width: 30,
          height: 30,
        });

        // Use with PathBuilder fill({ pattern })
        page.drawPath().rectangle(50, 50, 200, 200).fill({ pattern });

        const bytes = await pdf.save();
        expect(bytes.length).toBeGreaterThan(0);
      });

      it("should register image pattern and return name", async () => {
        const imageBytes = await loadFixture("images", "red-square.png");
        const image = pdf.embedImage(imageBytes);
        const pattern = pdf.createImagePattern({ image, width: 50, height: 50 });
        const name = page.registerPattern(pattern);

        expect(name).toMatch(/^P\d+$/);
      });

      it("should deduplicate same image pattern", async () => {
        const imageBytes = await loadFixture("images", "red-square.png");
        const image = pdf.embedImage(imageBytes);
        const pattern = pdf.createImagePattern({ image, width: 50, height: 50 });
        const name1 = page.registerPattern(pattern);
        const name2 = page.registerPattern(pattern);

        expect(name1).toBe(name2);
      });
    });
  });
});
