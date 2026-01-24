/**
 * Integration tests for the Drawing API.
 *
 * These tests generate actual PDF files that can be visually inspected
 * in the test-output directory.
 */

import { Standard14Font } from "#src/fonts/standard-14-font";
import { black, blue, cmyk, grayscale, green, red, rgb, white } from "#src/helpers/colors";
import { isPdfHeader, loadFixture, saveTestOutput } from "#src/test-utils";
import { describe, expect, it } from "vitest";

import { PDF } from "../pdf";

describe("Drawing API Integration", () => {
  describe("shapes", () => {
    it("draws rectangles with various styles", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ size: "letter" });

      // Simple filled rectangle
      page.drawRectangle({
        x: 50,
        y: 650,
        width: 100,
        height: 60,
        color: red,
      });

      // Stroked rectangle
      page.drawRectangle({
        x: 200,
        y: 650,
        width: 100,
        height: 60,
        borderColor: blue,
        borderWidth: 2,
      });

      // Filled and stroked
      page.drawRectangle({
        x: 350,
        y: 650,
        width: 100,
        height: 60,
        color: rgb(1, 1, 0),
        borderColor: black,
        borderWidth: 1,
      });

      // Rounded corners
      page.drawRectangle({
        x: 50,
        y: 550,
        width: 100,
        height: 60,
        color: green,
        cornerRadius: 10,
      });

      // Dashed border
      page.drawRectangle({
        x: 200,
        y: 550,
        width: 100,
        height: 60,
        borderColor: rgb(0.5, 0, 0.5),
        borderWidth: 2,
        borderDashArray: [5, 3],
      });

      // Semi-transparent
      page.drawRectangle({
        x: 350,
        y: 550,
        width: 100,
        height: 60,
        color: blue,
        opacity: 0.5,
      });

      const bytes = await pdf.save();
      expect(isPdfHeader(bytes)).toBe(true);
      await saveTestOutput("drawing/rectangles.pdf", bytes);
    });

    it("draws lines with various styles", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ size: "letter" });

      // Simple line
      page.drawLine({
        start: { x: 50, y: 700 },
        end: { x: 200, y: 700 },
        color: black,
      });

      // Thick line
      page.drawLine({
        start: { x: 50, y: 650 },
        end: { x: 200, y: 650 },
        color: red,
        thickness: 5,
      });

      // Dashed line
      page.drawLine({
        start: { x: 50, y: 600 },
        end: { x: 200, y: 600 },
        color: blue,
        dashArray: [10, 5],
      });

      // Different line caps
      page.drawLine({
        start: { x: 250, y: 700 },
        end: { x: 400, y: 700 },
        color: black,
        thickness: 10,
        lineCap: "butt",
      });

      page.drawLine({
        start: { x: 250, y: 650 },
        end: { x: 400, y: 650 },
        color: black,
        thickness: 10,
        lineCap: "round",
      });

      page.drawLine({
        start: { x: 250, y: 600 },
        end: { x: 400, y: 600 },
        color: black,
        thickness: 10,
        lineCap: "square",
      });

      // Diagonal line
      page.drawLine({
        start: { x: 50, y: 500 },
        end: { x: 200, y: 400 },
        color: green,
        thickness: 2,
      });

      const bytes = await pdf.save();
      expect(isPdfHeader(bytes)).toBe(true);
      await saveTestOutput("drawing/lines.pdf", bytes);
    });

    it("draws circles and ellipses", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ size: "letter" });

      // Filled circle
      page.drawCircle({
        x: 100,
        y: 650,
        radius: 40,
        color: red,
      });

      // Stroked circle
      page.drawCircle({
        x: 250,
        y: 650,
        radius: 40,
        borderColor: blue,
        borderWidth: 3,
      });

      // Filled and stroked circle
      page.drawCircle({
        x: 400,
        y: 650,
        radius: 40,
        color: rgb(1, 1, 0),
        borderColor: black,
        borderWidth: 2,
      });

      // Filled ellipse
      page.drawEllipse({
        x: 100,
        y: 500,
        xRadius: 60,
        yRadius: 30,
        color: green,
      });

      // Stroked ellipse
      page.drawEllipse({
        x: 300,
        y: 500,
        xRadius: 40,
        yRadius: 60,
        borderColor: rgb(0.5, 0, 0.5),
        borderWidth: 2,
      });

      // Semi-transparent ellipse
      page.drawEllipse({
        x: 450,
        y: 500,
        xRadius: 50,
        yRadius: 40,
        color: blue,
        opacity: 0.5,
      });

      const bytes = await pdf.save();
      expect(isPdfHeader(bytes)).toBe(true);
      await saveTestOutput("drawing/circles-ellipses.pdf", bytes);
    });
  });

  describe("text", () => {
    it("draws text with Standard 14 fonts", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ size: "letter" });

      // Different fonts
      page.drawText("Helvetica Regular", {
        x: 50,
        y: 700,
        font: "Helvetica",
        size: 16,
        color: black,
      });

      page.drawText("Helvetica Bold", {
        x: 50,
        y: 670,
        font: "Helvetica-Bold",
        size: 16,
        color: black,
      });

      page.drawText("Times Roman", {
        x: 50,
        y: 640,
        font: "Times-Roman",
        size: 16,
        color: black,
      });

      page.drawText("Courier", {
        x: 50,
        y: 610,
        font: "Courier",
        size: 16,
        color: black,
      });

      // Different sizes
      page.drawText("Small (10pt)", {
        x: 50,
        y: 550,
        size: 10,
        color: black,
      });

      page.drawText("Medium (16pt)", {
        x: 50,
        y: 520,
        size: 16,
        color: black,
      });

      page.drawText("Large (24pt)", {
        x: 50,
        y: 480,
        size: 24,
        color: black,
      });

      // Different colors
      page.drawText("Red Text", {
        x: 50,
        y: 420,
        size: 18,
        color: red,
      });

      page.drawText("Green Text", {
        x: 50,
        y: 390,
        size: 18,
        color: green,
      });

      page.drawText("Blue Text", {
        x: 50,
        y: 360,
        size: 18,
        color: blue,
      });

      const bytes = await pdf.save();
      expect(isPdfHeader(bytes)).toBe(true);
      await saveTestOutput("drawing/text-basic.pdf", bytes);
    });

    it("draws text with correct opacity using non-stroking alpha (ca)", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ size: "letter" });

      // Draw text with 50% opacity
      page.drawText("Semi-transparent text", {
        x: 50,
        y: 700,
        size: 16,
        color: black,
        opacity: 0.5,
      });

      const bytes = await pdf.save();
      expect(isPdfHeader(bytes)).toBe(true);

      // Parse the saved PDF and verify the ExtGState has correct ca value
      const parsed = await PDF.load(bytes);
      const parsedPage = parsed.getPage(0)!;

      // Get page resources and check ExtGState
      const resources = parsedPage.getResources();
      const extGState = resources.getDict("ExtGState");

      expect(extGState).toBeDefined();

      // Find the graphics state with ca = 0.5 (non-stroking alpha for text)
      let foundCa = false;

      for (const [, gsDict] of extGState!) {
        if (gsDict.type === "dict") {
          const caValue = gsDict.getNumber("ca");

          if (caValue && caValue.value === 0.5) {
            foundCa = true;
            // Ensure CA (stroking) is not set for text opacity
            const caStroking = gsDict.getNumber("CA");
            expect(caStroking).toBeUndefined();
          }
        }
      }

      expect(foundCa).toBe(true);
      await saveTestOutput("drawing/text-opacity.pdf", bytes);
    });

    it("draws text with various opacities for visual verification", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ size: "letter" });
      const { width, height } = page;

      // Title
      page.drawText("Text Opacity Test", {
        x: 50,
        y: height - 50,
        size: 24,
        font: "Helvetica-Bold",
        color: black,
      });

      page.drawText("Each row shows text at different opacity levels over a colored background", {
        x: 50,
        y: height - 80,
        size: 12,
        color: black,
      });

      // Draw background rectangles to make opacity visible
      const bgColors = [
        { color: rgb(0.2, 0.6, 1), label: "Blue background" },
        { color: rgb(1, 0.8, 0), label: "Yellow background" },
        { color: rgb(0.9, 0.3, 0.3), label: "Red background" },
      ];

      const opacities = [1.0, 0.75, 0.5, 0.25, 0.1];
      let yPos = height - 130;

      for (const bg of bgColors) {
        // Draw background strip
        page.drawRectangle({
          x: 40,
          y: yPos - 10,
          width: width - 80,
          height: 70,
          color: bg.color,
        });

        // Label the background
        page.drawText(bg.label, {
          x: 50,
          y: yPos + 45,
          size: 10,
          color: black,
        });

        // Draw text at various opacities
        let xPos = 50;

        for (const opacity of opacities) {
          const label = `${Math.round(opacity * 100)}%`;

          page.drawText(label, {
            x: xPos,
            y: yPos + 25,
            size: 18,
            font: "Helvetica-Bold",
            color: black,
            opacity,
          });

          page.drawText("Sample", {
            x: xPos,
            y: yPos + 5,
            size: 14,
            color: black,
            opacity,
          });

          xPos += 100;
        }

        yPos -= 100;
      }

      // White text on dark background
      yPos -= 20;
      page.drawText("White text on dark background:", {
        x: 50,
        y: yPos + 60,
        size: 12,
        color: black,
      });

      page.drawRectangle({
        x: 40,
        y: yPos - 10,
        width: width - 80,
        height: 70,
        color: rgb(0.1, 0.1, 0.2),
      });

      let xPos = 50;

      for (const opacity of opacities) {
        const label = `${Math.round(opacity * 100)}%`;

        page.drawText(label, {
          x: xPos,
          y: yPos + 25,
          size: 18,
          font: "Helvetica-Bold",
          color: white,
          opacity,
        });

        page.drawText("Sample", {
          x: xPos,
          y: yPos + 5,
          size: 14,
          color: white,
          opacity,
        });

        xPos += 100;
      }

      // Overlapping text demonstration
      yPos -= 120;
      page.drawText("Overlapping text demonstration:", {
        x: 50,
        y: yPos + 60,
        size: 12,
        color: black,
      });

      // Background text (fully opaque)
      page.drawText("BACKGROUND", {
        x: 100,
        y: yPos + 20,
        size: 48,
        font: "Helvetica-Bold",
        color: rgb(0.8, 0.2, 0.2),
      });

      // Foreground text with various opacities
      page.drawText("OVERLAY 100%", {
        x: 120,
        y: yPos + 35,
        size: 24,
        font: "Helvetica-Bold",
        color: rgb(0.2, 0.2, 0.8),
        opacity: 1.0,
      });

      page.drawText("OVERLAY 50%", {
        x: 120,
        y: yPos + 5,
        size: 24,
        font: "Helvetica-Bold",
        color: rgb(0.2, 0.2, 0.8),
        opacity: 0.5,
      });

      page.drawText("OVERLAY 25%", {
        x: 120,
        y: yPos - 25,
        size: 24,
        font: "Helvetica-Bold",
        color: rgb(0.2, 0.2, 0.8),
        opacity: 0.25,
      });

      const bytes = await pdf.save();
      expect(isPdfHeader(bytes)).toBe(true);
      await saveTestOutput("drawing/text-opacity-visual.pdf", bytes);
    });

    it("draws multiline text with word wrap", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ size: "letter" });

      const loremIpsum =
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.";

      // Left aligned (default)
      page.drawText(loremIpsum, {
        x: 50,
        y: 700,
        size: 12,
        color: black,
        maxWidth: 200,
        lineHeight: 16,
      });

      // With a box around it to show the bounds
      page.drawRectangle({
        x: 50,
        y: 600,
        width: 200,
        height: 120,
        borderColor: grayscale(0.7),
        borderWidth: 0.5,
      });

      // Center aligned
      page.drawText(loremIpsum, {
        x: 300,
        y: 700,
        size: 12,
        color: black,
        maxWidth: 200,
        lineHeight: 16,
        alignment: "center",
      });

      page.drawRectangle({
        x: 300,
        y: 600,
        width: 200,
        height: 120,
        borderColor: grayscale(0.7),
        borderWidth: 0.5,
      });

      // Right aligned
      page.drawText("Right aligned text that wraps to multiple lines when it gets long enough.", {
        x: 50,
        y: 500,
        size: 12,
        color: black,
        maxWidth: 200,
        lineHeight: 16,
        alignment: "right",
      });

      page.drawRectangle({
        x: 50,
        y: 420,
        width: 200,
        height: 100,
        borderColor: grayscale(0.7),
        borderWidth: 0.5,
      });

      const bytes = await pdf.save();
      expect(isPdfHeader(bytes)).toBe(true);
      await saveTestOutput("drawing/text-multiline.pdf", bytes);
    });

    it("draws text with embedded custom fonts", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ size: "letter" });

      // Load fonts from fixtures
      const caveatData = await loadFixture("fonts", "variable/Caveat-Variable.ttf");
      const pacificoData = await loadFixture("fonts", "ttf/Pacifico-Regular.ttf");
      const josefinData = await loadFixture("fonts", "ttf/JosefinSans-Italic.ttf");
      const liberationData = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");

      // Embed fonts
      const caveat = pdf.embedFont(caveatData);
      const pacifico = pdf.embedFont(pacificoData);
      const josefin = pdf.embedFont(josefinData);
      const liberation = pdf.embedFont(liberationData);

      // Title
      page.drawText("Custom Embedded Fonts", {
        x: 50,
        y: 720,
        font: "Helvetica-Bold",
        size: 24,
        color: black,
      });

      page.drawLine({
        start: { x: 50, y: 710 },
        end: { x: 400, y: 710 },
        color: grayscale(0.5),
      });

      // Caveat - handwritten style
      page.drawText("Caveat - A beautiful handwritten font", {
        x: 50,
        y: 660,
        font: caveat,
        size: 28,
        color: rgb(0.2, 0.4, 0.6),
      });

      page.drawText("Perfect for personal notes and signatures!", {
        x: 50,
        y: 620,
        font: caveat,
        size: 22,
        color: black,
      });

      // Pacifico - script style
      page.drawText("Pacifico - Fun script font", {
        x: 50,
        y: 560,
        font: pacifico,
        size: 28,
        color: rgb(0.8, 0.2, 0.4),
      });

      page.drawText("Great for headers and titles!", {
        x: 50,
        y: 520,
        font: pacifico,
        size: 22,
        color: black,
      });

      // Josefin Sans Italic
      page.drawText("Josefin Sans Italic - Elegant and modern", {
        x: 50,
        y: 460,
        font: josefin,
        size: 22,
        color: rgb(0.3, 0.5, 0.3),
      });

      page.drawText("Works beautifully for body text and captions.", {
        x: 50,
        y: 425,
        font: josefin,
        size: 18,
        color: black,
      });

      // Liberation Sans
      page.drawText("Liberation Sans - Clean and professional", {
        x: 50,
        y: 370,
        font: liberation,
        size: 20,
        color: rgb(0.4, 0.4, 0.4),
      });

      page.drawText("A metrically-compatible replacement for Arial.", {
        x: 50,
        y: 340,
        font: liberation,
        size: 16,
        color: black,
      });

      // Mixed fonts in same document
      page.drawText("Mixing Fonts", {
        x: 50,
        y: 280,
        font: "Helvetica-Bold",
        size: 16,
        color: black,
      });

      page.drawLine({
        start: { x: 50, y: 270 },
        end: { x: 200, y: 270 },
        color: grayscale(0.7),
      });

      page.drawText("Standard 14: Helvetica for system text", {
        x: 50,
        y: 245,
        font: "Helvetica",
        size: 14,
        color: black,
      });

      page.drawText("Caveat: For personal touches", {
        x: 50,
        y: 220,
        font: caveat,
        size: 18,
        color: black,
      });

      page.drawText("Pacifico: For decorative headers", {
        x: 50,
        y: 190,
        font: pacifico,
        size: 18,
        color: black,
      });

      // Footer
      page.drawText("All fonts are embedded and will display correctly on any device.", {
        x: 50,
        y: 50,
        font: liberation,
        size: 10,
        color: grayscale(0.5),
      });

      const bytes = await pdf.save();
      expect(isPdfHeader(bytes)).toBe(true);
      await saveTestOutput("drawing/text-custom-fonts.pdf", bytes);
    });

    it("draws Unicode text with embedded fonts", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ size: "letter" });

      // Load fonts that support different scripts
      const liberationData = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
      const bengaliData = await loadFixture("fonts", "ttf/Lohit-Bengali.ttf");
      const caveatData = await loadFixture("fonts", "variable/Caveat-Variable.ttf");

      const liberation = pdf.embedFont(liberationData);
      const bengali = pdf.embedFont(bengaliData);
      const caveat = pdf.embedFont(caveatData);

      // Title
      page.drawText("Unicode Text Support", {
        x: 50,
        y: 720,
        font: "Helvetica-Bold",
        size: 24,
        color: black,
      });

      page.drawLine({
        start: { x: 50, y: 710 },
        end: { x: 350, y: 710 },
        color: grayscale(0.5),
      });

      // Latin extended characters
      page.drawText("Latin Extended:", {
        x: 50,
        y: 670,
        font: "Helvetica-Bold",
        size: 14,
        color: black,
      });

      page.drawText("Café, naïve, résumé, piñata, façade", {
        x: 50,
        y: 645,
        font: liberation,
        size: 16,
        color: black,
      });

      page.drawText("Ångström, Zürich, São Paulo, Malmö", {
        x: 50,
        y: 620,
        font: liberation,
        size: 16,
        color: black,
      });

      // Currency and symbols
      page.drawText("Currencies & Symbols:", {
        x: 50,
        y: 580,
        font: "Helvetica-Bold",
        size: 14,
        color: black,
      });

      page.drawText("€100  £50  ¥1000  $99  ©2024  ®  ™", {
        x: 50,
        y: 555,
        font: liberation,
        size: 16,
        color: black,
      });

      // Bengali script
      page.drawText("Bengali Script:", {
        x: 50,
        y: 510,
        font: "Helvetica-Bold",
        size: 14,
        color: black,
      });

      page.drawText("বাংলা ভাষা", {
        x: 50,
        y: 480,
        font: bengali,
        size: 24,
        color: rgb(0.2, 0.5, 0.3),
      });

      page.drawText("(Bengali Language)", {
        x: bengali.getTextWidth("বাংলা ভাষা", 24) + 70,
        y: 480,
        font: liberation,
        size: 14,
        color: grayscale(0.5),
      });

      // Caveat with accents
      page.drawText("Handwritten with Accents:", {
        x: 50,
        y: 420,
        font: "Helvetica-Bold",
        size: 14,
        color: black,
      });

      page.drawText("Très élégant! Señor García says ¡Hola!", {
        x: 50,
        y: 390,
        font: caveat,
        size: 22,
        color: rgb(0.4, 0.2, 0.6),
      });

      // Note about font support
      page.drawRectangle({
        x: 50,
        y: 60,
        width: 512,
        height: 60,
        color: rgb(0.95, 0.95, 0.95),
        borderColor: grayscale(0.7),
        borderWidth: 0.5,
      });

      page.drawText("Note: Characters display correctly only if the embedded font", {
        x: 60,
        y: 100,
        font: liberation,
        size: 11,
        color: grayscale(0.4),
      });

      page.drawText("contains glyphs for those characters. Font subsetting preserves", {
        x: 60,
        y: 85,
        font: liberation,
        size: 11,
        color: grayscale(0.4),
      });

      page.drawText("only the glyphs actually used in the document.", {
        x: 60,
        y: 70,
        font: liberation,
        size: 11,
        color: grayscale(0.4),
      });

      const bytes = await pdf.save();
      expect(isPdfHeader(bytes)).toBe(true);
      await saveTestOutput("drawing/text-unicode.pdf", bytes);
    });

    it("draws CJK text with embedded fonts", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ size: "letter" });

      // Load language-specific Noto Sans fonts
      const scFontData = await loadFixture("fonts", "ttf/NotoSansSC-Regular.ttf");
      const jpFontData = await loadFixture("fonts", "ttf/NotoSansJP-Regular.ttf");
      const krFontData = await loadFixture("fonts", "ttf/NotoSansKR-Regular.ttf");

      const scFont = pdf.embedFont(scFontData);
      const jpFont = pdf.embedFont(jpFontData);
      const krFont = pdf.embedFont(krFontData);

      // Also load Liberation Sans for note text
      const liberationData = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
      const liberation = pdf.embedFont(liberationData);

      // Title
      page.drawText("CJK Text Support", {
        x: 50,
        y: 720,
        font: "Helvetica-Bold",
        size: 24,
        color: black,
      });

      page.drawLine({
        start: { x: 50, y: 710 },
        end: { x: 350, y: 710 },
        color: grayscale(0.5),
      });

      // Chinese (Simplified)
      page.drawText("Chinese (Simplified):", {
        x: 50,
        y: 670,
        font: "Helvetica-Bold",
        size: 14,
        color: black,
      });

      page.drawText("你好世界 - Hello World", {
        x: 50,
        y: 640,
        font: scFont,
        size: 20,
        color: rgb(0.8, 0.2, 0.2),
      });

      page.drawText("欢迎使用 PDF 库", {
        x: 50,
        y: 610,
        font: scFont,
        size: 18,
        color: black,
      });

      // Japanese
      page.drawText("Japanese:", {
        x: 50,
        y: 560,
        font: "Helvetica-Bold",
        size: 14,
        color: black,
      });

      page.drawText("日本語テキスト - こんにちは", {
        x: 50,
        y: 530,
        font: jpFont,
        size: 20,
        color: rgb(0.2, 0.5, 0.8),
      });

      // Korean
      page.drawText("Korean:", {
        x: 50,
        y: 480,
        font: "Helvetica-Bold",
        size: 14,
        color: black,
      });

      page.drawText("안녕하세요 - Hello", {
        x: 50,
        y: 450,
        font: krFont,
        size: 20,
        color: rgb(0.3, 0.6, 0.3),
      });

      // Mixed CJK and Latin (using Chinese font)
      page.drawText("Mixed Text:", {
        x: 50,
        y: 400,
        font: "Helvetica-Bold",
        size: 14,
        color: black,
      });

      page.drawText("PDF文档 (Document) 生成 Generation", {
        x: 50,
        y: 370,
        font: scFont,
        size: 18,
        color: black,
      });

      // Numbers and punctuation in CJK
      page.drawText("Numbers & Punctuation:", {
        x: 50,
        y: 320,
        font: "Helvetica-Bold",
        size: 14,
        color: black,
      });

      page.drawText("价格：¥1,234.56 （含税）", {
        x: 50,
        y: 290,
        font: scFont,
        size: 18,
        color: black,
      });

      // Note box
      page.drawRectangle({
        x: 50,
        y: 60,
        width: 512,
        height: 80,
        color: rgb(0.95, 0.95, 0.95),
        borderColor: grayscale(0.7),
        borderWidth: 0.5,
      });

      page.drawText("Note: CJK fonts are large (17MB+) but font subsetting", {
        x: 60,
        y: 120,
        font: liberation,
        size: 11,
        color: grayscale(0.4),
      });

      page.drawText("embeds only the glyphs used in the document, keeping", {
        x: 60,
        y: 105,
        font: liberation,
        size: 11,
        color: grayscale(0.4),
      });

      page.drawText("the final PDF size small.", {
        x: 60,
        y: 90,
        font: liberation,
        size: 11,
        color: grayscale(0.4),
      });

      const bytes = await pdf.save({ subsetFonts: true });
      expect(isPdfHeader(bytes)).toBe(true);
      // With subsetting, PDF should be much smaller than the 17MB font
      expect(bytes.length).toBeLessThan(500_000); // Should be under 500KB
      await saveTestOutput("drawing/text-cjk.pdf", bytes);
    });

    it("creates a fancy invitation with custom fonts", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ size: "letter" });

      // Load decorative fonts
      const pacificoData = await loadFixture("fonts", "ttf/Pacifico-Regular.ttf");
      const caveatData = await loadFixture("fonts", "variable/Caveat-Variable.ttf");
      const josefinData = await loadFixture("fonts", "ttf/JosefinSans-Italic.ttf");

      const pacifico = pdf.embedFont(pacificoData);
      const caveat = pdf.embedFont(caveatData);
      const josefin = pdf.embedFont(josefinData);

      // Decorative border
      page.drawRectangle({
        x: 30,
        y: 30,
        width: 552,
        height: 732,
        borderColor: rgb(0.7, 0.5, 0.3),
        borderWidth: 3,
      });

      page.drawRectangle({
        x: 40,
        y: 40,
        width: 532,
        height: 712,
        borderColor: rgb(0.8, 0.6, 0.4),
        borderWidth: 1,
      });

      // Header flourish
      page.drawLine({
        start: { x: 150, y: 680 },
        end: { x: 462, y: 680 },
        color: rgb(0.7, 0.5, 0.3),
        thickness: 1,
      });

      // Title
      page.drawText("You're Invited!", {
        x: 150,
        y: 620,
        font: pacifico,
        size: 48,
        color: rgb(0.6, 0.3, 0.4),
        alignment: "center",
      });

      // Subtitle
      page.drawText("to celebrate", {
        x: 150,
        y: 560,
        font: josefin,
        size: 20,
        color: grayscale(0.4),
        alignment: "center",
      });

      // Event name
      page.drawText("Sarah's Birthday Party", {
        x: 150,
        y: 510,
        font: caveat,
        size: 36,
        color: rgb(0.3, 0.5, 0.6),
        alignment: "center",
      });

      // Details section
      page.drawLine({
        start: { x: 150, y: 450 },
        end: { x: 462, y: 450 },
        color: rgb(0.8, 0.6, 0.4),
        thickness: 0.5,
      });

      page.drawText("When", {
        x: 150,
        y: 400,
        font: josefin,
        size: 14,
        color: grayscale(0.5),
      });

      page.drawText("Saturday, March 15th at 7:00 PM", {
        x: 150,
        y: 375,
        font: caveat,
        size: 22,
        color: black,
      });

      page.drawText("Where", {
        x: 150,
        y: 330,
        font: josefin,
        size: 14,
        color: grayscale(0.5),
      });

      page.drawText("The Garden Pavilion", {
        x: 150,
        y: 305,
        font: caveat,
        size: 22,
        color: black,
      });

      page.drawText("123 Celebration Lane, Party City", {
        x: 150,
        y: 280,
        font: josefin,
        size: 14,
        color: grayscale(0.4),
      });

      // Decorative divider
      page.drawLine({
        start: { x: 150, y: 230 },
        end: { x: 462, y: 230 },
        color: rgb(0.8, 0.6, 0.4),
        thickness: 0.5,
      });

      // RSVP
      page.drawText("RSVP", {
        x: 150,
        y: 180,
        font: pacifico,
        size: 28,
        color: rgb(0.6, 0.3, 0.4),
        alignment: "center",
      });

      page.drawText("sarah@example.com  |  (555) 123-4567", {
        x: 150,
        y: 145,
        font: josefin,
        size: 14,
        color: grayscale(0.4),
        alignment: "center",
      });

      // Bottom flourish
      page.drawText("We hope to see you there!", {
        x: 150,
        y: 80,
        font: caveat,
        size: 20,
        color: rgb(0.5, 0.5, 0.5),
        alignment: "center",
      });

      const bytes = await pdf.save();
      expect(isPdfHeader(bytes)).toBe(true);
      await saveTestOutput("drawing/invitation.pdf", bytes);
    });
  });

  describe("paths", () => {
    it("draws custom paths with PathBuilder", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ size: "letter" });

      // Triangle
      page
        .drawPath()
        .moveTo(100, 700)
        .lineTo(150, 750)
        .lineTo(50, 750)
        .close()
        .fill({ color: red });

      // Star (5-pointed)
      const starPath = page.drawPath();
      const cx = 250,
        cy = 725,
        outerR = 40,
        innerR = 15;
      for (let i = 0; i < 5; i++) {
        const outerAngle = ((i * 72 - 90) * Math.PI) / 180;
        const innerAngle = ((i * 72 + 36 - 90) * Math.PI) / 180;
        const ox = cx + outerR * Math.cos(outerAngle);
        const oy = cy + outerR * Math.sin(outerAngle);
        const ix = cx + innerR * Math.cos(innerAngle);
        const iy = cy + innerR * Math.sin(innerAngle);
        if (i === 0) {
          starPath.moveTo(ox, oy);
        } else {
          starPath.lineTo(ox, oy);
        }
        starPath.lineTo(ix, iy);
      }
      starPath.close().fill({ color: rgb(1, 0.8, 0) });

      // Curved path (heart shape approximation)
      page
        .drawPath()
        .moveTo(400, 700)
        .curveTo(400, 730, 370, 750, 350, 750)
        .curveTo(320, 750, 300, 720, 300, 700)
        .curveTo(300, 670, 350, 640, 400, 620)
        .curveTo(450, 640, 500, 670, 500, 700)
        .curveTo(500, 720, 480, 750, 450, 750)
        .curveTo(430, 750, 400, 730, 400, 700)
        .close()
        .fill({ color: rgb(1, 0.2, 0.4) });

      // Rectangle with different fill rule demonstration
      // Outer rectangle
      page.drawPath().rectangle(50, 550, 150, 100).fill({ color: blue });

      // Inner cutout using even-odd rule
      page
        .drawPath()
        .rectangle(100, 500, 200, 100)
        .rectangle(130, 520, 140, 60) // Inner rectangle (will be cut out)
        .fill({ color: green, windingRule: "evenodd" });

      const bytes = await pdf.save();
      expect(isPdfHeader(bytes)).toBe(true);
      await saveTestOutput("drawing/paths.pdf", bytes);
    });
  });

  describe("colors", () => {
    it("uses various color spaces", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ size: "letter" });

      // RGB colors
      page.drawRectangle({ x: 50, y: 700, width: 80, height: 40, color: rgb(1, 0, 0) });
      page.drawRectangle({ x: 140, y: 700, width: 80, height: 40, color: rgb(0, 1, 0) });
      page.drawRectangle({ x: 230, y: 700, width: 80, height: 40, color: rgb(0, 0, 1) });
      page.drawRectangle({ x: 320, y: 700, width: 80, height: 40, color: rgb(1, 1, 0) });
      page.drawRectangle({ x: 410, y: 700, width: 80, height: 40, color: rgb(1, 0, 1) });
      page.drawRectangle({ x: 500, y: 700, width: 80, height: 40, color: rgb(0, 1, 1) });

      // Color presets
      page.drawRectangle({ x: 50, y: 640, width: 80, height: 40, color: black });
      page.drawRectangle({
        x: 140,
        y: 640,
        width: 80,
        height: 40,
        color: white,
        borderColor: black,
      });
      page.drawRectangle({ x: 230, y: 640, width: 80, height: 40, color: red });
      page.drawRectangle({ x: 320, y: 640, width: 80, height: 40, color: green });
      page.drawRectangle({ x: 410, y: 640, width: 80, height: 40, color: blue });

      // Grayscale
      for (let i = 0; i <= 10; i++) {
        page.drawRectangle({
          x: 50 + i * 50,
          y: 580,
          width: 45,
          height: 40,
          color: grayscale(i / 10),
          borderColor: black,
          borderWidth: 0.5,
        });
      }

      // CMYK colors
      page.drawRectangle({ x: 50, y: 520, width: 80, height: 40, color: cmyk(1, 0, 0, 0) }); // Cyan
      page.drawRectangle({ x: 140, y: 520, width: 80, height: 40, color: cmyk(0, 1, 0, 0) }); // Magenta
      page.drawRectangle({ x: 230, y: 520, width: 80, height: 40, color: cmyk(0, 0, 1, 0) }); // Yellow
      page.drawRectangle({ x: 320, y: 520, width: 80, height: 40, color: cmyk(0, 0, 0, 1) }); // Black

      // Opacity variations
      page.drawRectangle({ x: 50, y: 450, width: 80, height: 40, color: red, opacity: 1.0 });
      page.drawRectangle({ x: 140, y: 450, width: 80, height: 40, color: red, opacity: 0.75 });
      page.drawRectangle({ x: 230, y: 450, width: 80, height: 40, color: red, opacity: 0.5 });
      page.drawRectangle({ x: 320, y: 450, width: 80, height: 40, color: red, opacity: 0.25 });

      const bytes = await pdf.save();
      expect(isPdfHeader(bytes)).toBe(true);
      await saveTestOutput("drawing/colors.pdf", bytes);
    });
  });

  describe("combined", () => {
    it("creates a complete document with all drawing features", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ size: "letter" });

      // Header
      page.drawRectangle({
        x: 0,
        y: 742,
        width: 612,
        height: 50,
        color: rgb(0.2, 0.4, 0.6),
      });

      page.drawText("Drawing API Demo", {
        x: 50,
        y: 760,
        font: "Helvetica-Bold",
        size: 24,
        color: white,
      });

      // Shapes section
      page.drawText("Shapes", {
        x: 50,
        y: 700,
        font: "Helvetica-Bold",
        size: 14,
        color: black,
      });

      page.drawLine({
        start: { x: 50, y: 695 },
        end: { x: 200, y: 695 },
        color: grayscale(0.5),
      });

      page.drawRectangle({ x: 50, y: 630, width: 60, height: 50, color: red });
      page.drawCircle({ x: 170, y: 655, radius: 25, color: green });
      page.drawEllipse({ x: 280, y: 655, xRadius: 40, yRadius: 25, color: blue });

      // Lines section
      page.drawText("Lines", {
        x: 50,
        y: 580,
        font: "Helvetica-Bold",
        size: 14,
        color: black,
      });

      page.drawLine({
        start: { x: 50, y: 575 },
        end: { x: 200, y: 575 },
        color: grayscale(0.5),
      });

      page.drawLine({ start: { x: 50, y: 550 }, end: { x: 150, y: 550 }, color: black });
      page.drawLine({
        start: { x: 50, y: 530 },
        end: { x: 150, y: 530 },
        color: red,
        thickness: 3,
      });
      page.drawLine({
        start: { x: 50, y: 510 },
        end: { x: 150, y: 510 },
        color: blue,
        dashArray: [5, 3],
      });

      // Text section
      page.drawText("Text Styles", {
        x: 350,
        y: 700,
        font: "Helvetica-Bold",
        size: 14,
        color: black,
      });

      page.drawLine({
        start: { x: 350, y: 695 },
        end: { x: 500, y: 695 },
        color: grayscale(0.5),
      });

      page.drawText("Regular text", { x: 350, y: 670, size: 12, color: black });
      page.drawText("Bold text", {
        x: 350,
        y: 650,
        font: "Helvetica-Bold",
        size: 12,
        color: black,
      });
      page.drawText("Colored text", { x: 350, y: 630, size: 12, color: rgb(0.8, 0.2, 0.2) });

      // Custom path section
      page.drawText("Custom Paths", {
        x: 350,
        y: 580,
        font: "Helvetica-Bold",
        size: 14,
        color: black,
      });

      page.drawLine({
        start: { x: 350, y: 575 },
        end: { x: 500, y: 575 },
        color: grayscale(0.5),
      });

      // Draw a simple arrow
      page
        .drawPath()
        .moveTo(350, 540)
        .lineTo(420, 540)
        .lineTo(420, 550)
        .lineTo(450, 530)
        .lineTo(420, 510)
        .lineTo(420, 520)
        .lineTo(350, 520)
        .close()
        .fill({ color: rgb(0.3, 0.6, 0.3) });

      // Footer
      page.drawLine({
        start: { x: 50, y: 50 },
        end: { x: 562, y: 50 },
        color: grayscale(0.7),
      });

      page.drawText("Generated with @libpdf/core Drawing API", {
        x: 50,
        y: 30,
        size: 10,
        color: grayscale(0.5),
      });

      const bytes = await pdf.save();
      expect(isPdfHeader(bytes)).toBe(true);
      await saveTestOutput("drawing/complete-demo.pdf", bytes);
    });
  });

  describe("rotation origins", () => {
    // Helper to calculate origin point for visualization
    function getOriginPoint(
      x: number,
      y: number,
      width: number,
      height: number,
      origin:
        | "top-left"
        | "top-center"
        | "top-right"
        | "center-left"
        | "center"
        | "center-right"
        | "bottom-left"
        | "bottom-center"
        | "bottom-right",
    ): { x: number; y: number } {
      switch (origin) {
        case "top-left":
          return { x, y: y + height };
        case "top-center":
          return { x: x + width / 2, y: y + height };
        case "top-right":
          return { x: x + width, y: y + height };
        case "center-left":
          return { x, y: y + height / 2 };
        case "center":
          return { x: x + width / 2, y: y + height / 2 };
        case "center-right":
          return { x: x + width, y: y + height / 2 };
        case "bottom-left":
          return { x, y };
        case "bottom-center":
          return { x: x + width / 2, y };
        case "bottom-right":
          return { x: x + width, y };
        default:
          return { x, y };
      }
    }

    it("rotates rectangles around different named origins", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ size: "letter" });
      const gray = grayscale(0.8);

      // Title
      page.drawText("Rectangle Rotation Origins", {
        x: 50,
        y: 750,
        size: 18,
        font: "Helvetica-Bold",
      });
      page.drawText("Gray border = original position, colored = rotated 30 degrees", {
        x: 50,
        y: 730,
        size: 10,
        color: grayscale(0.4),
      });

      const origins = [
        "top-left",
        "top-center",
        "top-right",
        "center-left",
        "center",
        "center-right",
        "bottom-left",
        "bottom-center",
        "bottom-right",
      ] as const;

      const colors = [
        rgb(0.9, 0.3, 0.3), // red
        rgb(0.3, 0.7, 0.3), // green
        rgb(0.3, 0.3, 0.9), // blue
        rgb(0.9, 0.6, 0.2), // orange
        rgb(0.6, 0.3, 0.9), // purple
        rgb(0.2, 0.7, 0.7), // teal
        rgb(0.9, 0.5, 0.7), // pink
        rgb(0.5, 0.5, 0.2), // olive
        rgb(0.4, 0.6, 0.8), // steel blue
      ];

      // Draw a 3x3 grid of rotated rectangles
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const i = row * 3 + col;
          const x = 80 + col * 180;
          const y = 550 - row * 200;
          const width = 100;
          const height = 60;
          const origin = origins[i];

          // Draw label
          page.drawText(origin, {
            x: x + width / 2 - 30,
            y: y + height + 15,
            size: 9,
            font: "Helvetica",
          });

          // Draw original position as gray border
          page.drawRectangle({
            x,
            y,
            width,
            height,
            borderColor: gray,
            borderWidth: 1,
            borderDashArray: [3, 2],
          });

          // Draw rotated rectangle
          page.drawRectangle({
            x,
            y,
            width,
            height,
            color: colors[i],
            opacity: 0.7,
            rotate: { angle: 30, origin },
          });

          // Mark the rotation origin point with a small circle
          const originPoint = getOriginPoint(x, y, width, height, origin);
          page.drawCircle({
            x: originPoint.x,
            y: originPoint.y,
            radius: 3,
            color: black,
          });
        }
      }

      const bytes = await pdf.save();
      expect(isPdfHeader(bytes)).toBe(true);
      await saveTestOutput("drawing/rotation-origins-rectangles.pdf", bytes);
    });

    it("rotates text around different named origins", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ size: "letter" });
      const gray = grayscale(0.8);

      // Get font metrics for accurate bounds
      const font = Standard14Font.of("Helvetica-Bold");
      const fontSize = 14;
      const text = "Hello!";
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const textHeight = font.heightAtSize(fontSize);

      // Title
      page.drawText("Text Rotation Origins", {
        x: 50,
        y: 750,
        size: 18,
        font: "Helvetica-Bold",
      });
      page.drawText("Gray border = text bounds, rotated 30 degrees", {
        x: 50,
        y: 730,
        size: 10,
        color: grayscale(0.4),
      });

      const origins = [
        "top-left",
        "top-center",
        "top-right",
        "center-left",
        "center",
        "center-right",
        "bottom-left",
        "bottom-center",
        "bottom-right",
      ] as const;

      const colors = [
        rgb(0.9, 0.3, 0.3),
        rgb(0.3, 0.7, 0.3),
        rgb(0.3, 0.3, 0.9),
        rgb(0.9, 0.6, 0.2),
        rgb(0.6, 0.3, 0.9),
        rgb(0.2, 0.7, 0.7),
        rgb(0.9, 0.5, 0.7),
        rgb(0.5, 0.5, 0.2),
        rgb(0.4, 0.6, 0.8),
      ];

      // Draw a 3x3 grid of rotated text
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const i = row * 3 + col;
          const x = 80 + col * 180;
          const y = 550 - row * 200;
          const origin = origins[i];

          // Draw label
          page.drawText(origin, {
            x: x + 10,
            y: y + 35,
            size: 9,
            font: "Helvetica",
          });

          // Draw text bounds as gray border
          page.drawRectangle({
            x,
            y,
            width: textWidth,
            height: textHeight,
            borderColor: gray,
            borderWidth: 1,
            borderDashArray: [3, 2],
          });

          // Draw rotated text
          page.drawText(text, {
            x,
            y,
            size: fontSize,
            font: "Helvetica-Bold",
            color: colors[i],
            rotate: { angle: 30, origin },
          });

          // Mark the rotation origin point
          const bounds = { x, y, width: textWidth, height: textHeight };
          const originPoint = getOriginPoint(
            bounds.x,
            bounds.y,
            bounds.width,
            bounds.height,
            origin,
          );
          page.drawCircle({
            x: originPoint.x,
            y: originPoint.y,
            radius: 3,
            color: black,
          });
        }
      }

      const bytes = await pdf.save();
      expect(isPdfHeader(bytes)).toBe(true);
      await saveTestOutput("drawing/rotation-origins-text.pdf", bytes);
    });

    it("rotates ellipses around different named origins", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ size: "letter" });
      const gray = grayscale(0.8);

      // Title
      page.drawText("Ellipse Rotation Origins", {
        x: 50,
        y: 750,
        size: 18,
        font: "Helvetica-Bold",
      });
      page.drawText("Gray border = bounding box, colored ellipse = rotated 45 degrees", {
        x: 50,
        y: 730,
        size: 10,
        color: grayscale(0.4),
      });

      const origins = [
        "top-left",
        "top-center",
        "top-right",
        "center-left",
        "center",
        "center-right",
        "bottom-left",
        "bottom-center",
        "bottom-right",
      ] as const;

      const colors = [
        rgb(0.9, 0.3, 0.3),
        rgb(0.3, 0.7, 0.3),
        rgb(0.3, 0.3, 0.9),
        rgb(0.9, 0.6, 0.2),
        rgb(0.6, 0.3, 0.9),
        rgb(0.2, 0.7, 0.7),
        rgb(0.9, 0.5, 0.7),
        rgb(0.5, 0.5, 0.2),
        rgb(0.4, 0.6, 0.8),
      ];

      // Draw a 3x3 grid of rotated ellipses
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const i = row * 3 + col;
          const cx = 130 + col * 180;
          const cy = 580 - row * 200;
          const xRadius = 60;
          const yRadius = 30;
          const origin = origins[i];

          // Draw label
          page.drawText(origin, {
            x: cx - 30,
            y: cy + yRadius + 20,
            size: 9,
            font: "Helvetica",
          });

          // Draw bounding box as gray border
          page.drawRectangle({
            x: cx - xRadius,
            y: cy - yRadius,
            width: xRadius * 2,
            height: yRadius * 2,
            borderColor: gray,
            borderWidth: 1,
            borderDashArray: [3, 2],
          });

          // Draw rotated ellipse
          page.drawEllipse({
            x: cx,
            y: cy,
            xRadius,
            yRadius,
            color: colors[i],
            opacity: 0.7,
            rotate: { angle: 45, origin },
          });

          // Mark the rotation origin point
          const bounds = {
            x: cx - xRadius,
            y: cy - yRadius,
            width: xRadius * 2,
            height: yRadius * 2,
          };
          const originPoint = getOriginPoint(
            bounds.x,
            bounds.y,
            bounds.width,
            bounds.height,
            origin,
          );
          page.drawCircle({
            x: originPoint.x,
            y: originPoint.y,
            radius: 3,
            color: black,
          });
        }
      }

      const bytes = await pdf.save();
      expect(isPdfHeader(bytes)).toBe(true);
      await saveTestOutput("drawing/rotation-origins-ellipses.pdf", bytes);
    });

    it("supports explicit {x, y} coordinates for rotation origin", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ size: "letter" });
      const gray = grayscale(0.8);

      // Title
      page.drawText("Custom {x, y} Rotation Origin", {
        x: 50,
        y: 750,
        size: 18,
        font: "Helvetica-Bold",
      });
      page.drawText("Rectangle rotated around a point outside its bounds", {
        x: 50,
        y: 730,
        size: 10,
        color: grayscale(0.4),
      });

      // Draw a rectangle rotating around an external point
      const x = 200;
      const y = 500;
      const width = 80;
      const height = 50;
      const pivotX = 150;
      const pivotY = 450;

      // Draw the pivot point
      page.drawCircle({
        x: pivotX,
        y: pivotY,
        radius: 5,
        color: red,
      });
      page.drawText("Pivot", {
        x: pivotX - 15,
        y: pivotY - 20,
        size: 10,
      });

      // Draw original and multiple rotated versions
      for (let angle = 0; angle <= 90; angle += 30) {
        const opacity = angle === 0 ? 1 : 0.5;
        const color = angle === 0 ? gray : rgb(0.3, 0.5, 0.9);

        page.drawRectangle({
          x,
          y,
          width,
          height,
          color,
          opacity,
          borderColor: black,
          borderWidth: angle === 0 ? 1 : 0.5,
          rotate: angle === 0 ? undefined : { angle, origin: { x: pivotX, y: pivotY } },
        });
      }

      const bytes = await pdf.save();
      expect(isPdfHeader(bytes)).toBe(true);
      await saveTestOutput("drawing/rotation-origins-custom.pdf", bytes);
    });
  });

  describe("images", () => {
    it("draws PNG images at various positions and sizes", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ size: "letter" });

      // Load PNG fixtures
      const redSquare = await loadFixture("images", "red-square.png");
      const blueRect = await loadFixture("images", "blue-rectangle.png");
      const gradientCircle = await loadFixture("images", "gradient-circle.png");

      // Embed images
      const redImg = pdf.embedImage(redSquare);
      const blueImg = pdf.embedImage(blueRect);
      const gradientImg = pdf.embedImage(gradientCircle);

      // Title
      page.drawText("PNG Images", {
        x: 50,
        y: 720,
        font: "Helvetica-Bold",
        size: 24,
        color: black,
      });

      page.drawLine({
        start: { x: 50, y: 710 },
        end: { x: 300, y: 710 },
        color: grayscale(0.5),
      });

      // Natural size
      page.drawText("Natural size:", {
        x: 50,
        y: 680,
        size: 12,
        color: black,
      });

      page.drawImage(redImg, { x: 50, y: 570 });

      page.drawText("100x100 px", {
        x: 50,
        y: 555,
        size: 10,
        color: grayscale(0.5),
      });

      page.drawImage(blueImg, { x: 180, y: 570 });

      page.drawText("200x100 px", {
        x: 180,
        y: 555,
        size: 10,
        color: grayscale(0.5),
      });

      // Scaled by width
      page.drawText("Scaled by width (150pt):", {
        x: 50,
        y: 520,
        size: 12,
        color: black,
      });

      page.drawImage(redImg, { x: 50, y: 410, width: 150 });
      page.drawImage(blueImg, { x: 220, y: 410, width: 150 });

      // Scaled by height
      page.drawText("Scaled by height (80pt):", {
        x: 50,
        y: 380,
        size: 12,
        color: black,
      });

      page.drawImage(redImg, { x: 50, y: 290, height: 80 });
      page.drawImage(gradientImg, { x: 150, y: 290, height: 80 });

      // Explicit dimensions (may distort)
      page.drawText("Explicit dimensions (distorted):", {
        x: 50,
        y: 260,
        size: 12,
        color: black,
      });

      page.drawImage(redImg, { x: 50, y: 170, width: 200, height: 80 });
      page.drawImage(gradientImg, { x: 270, y: 170, width: 80, height: 80 });

      // Multiple images in a row
      page.drawText("Multiple images:", {
        x: 50,
        y: 140,
        size: 12,
        color: black,
      });

      for (let i = 0; i < 5; i++) {
        page.drawImage(redImg, { x: 50 + i * 55, y: 50, width: 50 });
      }

      const bytes = await pdf.save();
      expect(isPdfHeader(bytes)).toBe(true);
      await saveTestOutput("drawing/images-png.pdf", bytes);
    });

    it("draws JPEG images at various positions and sizes", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ size: "letter" });

      // Load JPEG fixtures
      const redSquare = await loadFixture("images", "red-square.jpg");
      const gradient = await loadFixture("images", "gradient.jpg");
      const sample = await loadFixture("images", "sample.jpg");

      // Embed images
      const redImg = pdf.embedImage(redSquare);
      const gradientImg = pdf.embedImage(gradient);
      const sampleImg = pdf.embedImage(sample);

      // Title
      page.drawText("JPEG Images", {
        x: 50,
        y: 720,
        font: "Helvetica-Bold",
        size: 24,
        color: black,
      });

      page.drawLine({
        start: { x: 50, y: 710 },
        end: { x: 300, y: 710 },
        color: grayscale(0.5),
      });

      // Natural size
      page.drawText("Natural size:", {
        x: 50,
        y: 680,
        size: 12,
        color: black,
      });

      page.drawImage(redImg, { x: 50, y: 570 });

      page.drawText("100x100 px", {
        x: 50,
        y: 555,
        size: 10,
        color: grayscale(0.5),
      });

      page.drawImage(gradientImg, { x: 180, y: 570 });

      page.drawText("200x150 px", {
        x: 180,
        y: 555,
        size: 10,
        color: grayscale(0.5),
      });

      // Scaled sample image
      page.drawText("Scaled sample image:", {
        x: 50,
        y: 500,
        size: 12,
        color: black,
      });

      page.drawImage(sampleImg, { x: 50, y: 300, width: 200 });
      page.drawImage(sampleImg, { x: 280, y: 300, width: 100 });
      page.drawImage(sampleImg, { x: 400, y: 300, width: 50 });

      // Multiple gradient images
      page.drawText("Multiple gradients:", {
        x: 50,
        y: 260,
        size: 12,
        color: black,
      });

      for (let i = 0; i < 4; i++) {
        page.drawImage(gradientImg, { x: 50 + i * 130, y: 120, width: 120 });
      }

      const bytes = await pdf.save();
      expect(isPdfHeader(bytes)).toBe(true);
      await saveTestOutput("drawing/images-jpeg.pdf", bytes);
    });

    it("draws PNG images with alpha transparency", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ size: "letter" });

      // Load PNG with alpha channel
      const greenCircle = await loadFixture("images", "green-circle-alpha.png");

      // Embed image
      const circleImg = pdf.embedImage(greenCircle);

      // Title
      page.drawText("PNG with Alpha Transparency", {
        x: 50,
        y: 720,
        font: "Helvetica-Bold",
        size: 24,
        color: black,
      });

      page.drawLine({
        start: { x: 50, y: 710 },
        end: { x: 400, y: 710 },
        color: grayscale(0.5),
      });

      // Draw colored backgrounds with transparent images on top
      page.drawText("Transparent PNG over colored backgrounds:", {
        x: 50,
        y: 680,
        size: 12,
        color: black,
      });

      // Red background
      page.drawRectangle({
        x: 50,
        y: 500,
        width: 150,
        height: 150,
        color: red,
      });
      page.drawImage(circleImg, { x: 50, y: 500, width: 150 });

      // Blue background
      page.drawRectangle({
        x: 220,
        y: 500,
        width: 150,
        height: 150,
        color: blue,
      });
      page.drawImage(circleImg, { x: 220, y: 500, width: 150 });

      // Yellow background
      page.drawRectangle({
        x: 390,
        y: 500,
        width: 150,
        height: 150,
        color: rgb(1, 1, 0),
      });
      page.drawImage(circleImg, { x: 390, y: 500, width: 150 });

      // Overlapping transparent images
      page.drawText("Overlapping transparent images:", {
        x: 50,
        y: 460,
        size: 12,
        color: black,
      });

      page.drawImage(circleImg, { x: 50, y: 300, width: 150 });
      page.drawImage(circleImg, { x: 100, y: 320, width: 150 });
      page.drawImage(circleImg, { x: 150, y: 300, width: 150 });

      // Grid pattern behind transparent image
      page.drawText("Grid pattern behind transparent image:", {
        x: 50,
        y: 260,
        size: 12,
        color: black,
      });

      // Draw checkerboard
      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 6; col++) {
          const isLight = (row + col) % 2 === 0;
          page.drawRectangle({
            x: 50 + col * 25,
            y: 100 + row * 25,
            width: 25,
            height: 25,
            color: isLight ? white : grayscale(0.7),
          });
        }
      }
      page.drawImage(circleImg, { x: 50, y: 100, width: 150 });

      const bytes = await pdf.save();
      expect(isPdfHeader(bytes)).toBe(true);
      await saveTestOutput("drawing/images-alpha.pdf", bytes);
    });

    it("draws images with opacity", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ size: "letter" });

      // Load images
      const sample = await loadFixture("images", "sample.jpg");
      const gradient = await loadFixture("images", "gradient-circle.png");

      const sampleImg = pdf.embedImage(sample);
      const gradientImg = pdf.embedImage(gradient);

      // Title
      page.drawText("Image Opacity", {
        x: 50,
        y: 720,
        font: "Helvetica-Bold",
        size: 24,
        color: black,
      });

      page.drawLine({
        start: { x: 50, y: 710 },
        end: { x: 300, y: 710 },
        color: grayscale(0.5),
      });

      // Various opacity levels
      page.drawText("Opacity levels:", {
        x: 50,
        y: 680,
        size: 12,
        color: black,
      });

      const opacityLevels = [1.0, 0.75, 0.5, 0.25, 0.1];
      const labels = ["100%", "75%", "50%", "25%", "10%"];

      for (let i = 0; i < opacityLevels.length; i++) {
        page.drawImage(sampleImg, {
          x: 50 + i * 110,
          y: 550,
          width: 100,
          opacity: opacityLevels[i],
        });
        page.drawText(labels[i], {
          x: 50 + i * 110 + 35,
          y: 535,
          size: 10,
          color: black,
        });
      }

      // Gradient image opacity
      page.drawText("Gradient with opacity:", {
        x: 50,
        y: 500,
        size: 12,
        color: black,
      });

      for (let i = 0; i < opacityLevels.length; i++) {
        page.drawImage(gradientImg, {
          x: 50 + i * 110,
          y: 370,
          width: 100,
          opacity: opacityLevels[i],
        });
        page.drawText(labels[i], {
          x: 50 + i * 110 + 35,
          y: 355,
          size: 10,
          color: black,
        });
      }

      // Semi-transparent images over a background
      page.drawText("Semi-transparent over background:", {
        x: 50,
        y: 320,
        size: 12,
        color: black,
      });

      page.drawRectangle({
        x: 50,
        y: 150,
        width: 500,
        height: 150,
        color: rgb(0.9, 0.9, 0.95),
      });

      page.drawImage(sampleImg, { x: 70, y: 170, width: 130, opacity: 0.8 });
      page.drawImage(gradientImg, { x: 180, y: 170, width: 120, opacity: 0.6 });
      page.drawImage(sampleImg, { x: 290, y: 170, width: 130, opacity: 0.4 });
      page.drawImage(gradientImg, { x: 400, y: 170, width: 120, opacity: 0.3 });

      const bytes = await pdf.save();
      expect(isPdfHeader(bytes)).toBe(true);
      await saveTestOutput("drawing/images-opacity.pdf", bytes);
    });

    it("draws images with rotation", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ size: "letter" });

      // Load images
      const sample = await loadFixture("images", "sample.jpg");
      const redSquare = await loadFixture("images", "red-square.png");

      const sampleImg = pdf.embedImage(sample);
      const redImg = pdf.embedImage(redSquare);

      // Title
      page.drawText("Image Rotation", {
        x: 50,
        y: 720,
        font: "Helvetica-Bold",
        size: 24,
        color: black,
      });

      page.drawLine({
        start: { x: 50, y: 710 },
        end: { x: 300, y: 710 },
        color: grayscale(0.5),
      });

      // Various rotation angles
      page.drawText("Rotation angles:", {
        x: 50,
        y: 680,
        size: 12,
        color: black,
      });

      const angles = [0, 45, 90, 135, 180];
      for (let i = 0; i < angles.length; i++) {
        page.drawImage(redImg, {
          x: 70 + i * 110,
          y: 550,
          width: 80,
          rotate: { angle: angles[i] },
        });
        page.drawText(`${angles[i]}°`, {
          x: 70 + i * 110 + 25,
          y: 530,
          size: 10,
          color: black,
        });
      }

      // Sample image rotations
      page.drawText("Sample image rotations:", {
        x: 50,
        y: 480,
        size: 12,
        color: black,
      });

      page.drawImage(sampleImg, {
        x: 100,
        y: 320,
        width: 100,
        rotate: { angle: 0 },
      });
      page.drawText("0°", {
        x: 140,
        y: 300,
        size: 10,
        color: black,
      });

      page.drawImage(sampleImg, {
        x: 280,
        y: 320,
        width: 100,
        rotate: { angle: 30 },
      });
      page.drawText("30°", {
        x: 320,
        y: 300,
        size: 10,
        color: black,
      });

      page.drawImage(sampleImg, {
        x: 460,
        y: 320,
        width: 100,
        rotate: { angle: -45 },
      });
      page.drawText("-45°", {
        x: 495,
        y: 300,
        size: 10,
        color: black,
      });

      // Full rotation series
      page.drawText("Full rotation series:", {
        x: 50,
        y: 240,
        size: 12,
        color: black,
      });

      for (let i = 0; i < 8; i++) {
        const angle = i * 45;
        page.drawImage(redImg, {
          x: 60 + i * 70,
          y: 130,
          width: 50,
          rotate: { angle },
        });
      }

      const bytes = await pdf.save();
      expect(isPdfHeader(bytes)).toBe(true);
      await saveTestOutput("drawing/images-rotation.pdf", bytes);
    });

    it("creates an image gallery document", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ size: "letter" });

      // Load all images
      const redPng = await loadFixture("images", "red-square.png");
      const bluePng = await loadFixture("images", "blue-rectangle.png");
      const gradientPng = await loadFixture("images", "gradient-circle.png");
      const greenAlpha = await loadFixture("images", "green-circle-alpha.png");
      const redJpg = await loadFixture("images", "red-square.jpg");
      const gradientJpg = await loadFixture("images", "gradient.jpg");
      const sampleJpg = await loadFixture("images", "sample.jpg");

      const images = [
        { img: pdf.embedImage(redPng), label: "Red PNG" },
        { img: pdf.embedImage(bluePng), label: "Blue PNG" },
        { img: pdf.embedImage(gradientPng), label: "Gradient PNG" },
        { img: pdf.embedImage(greenAlpha), label: "Alpha PNG" },
        { img: pdf.embedImage(redJpg), label: "Red JPEG" },
        { img: pdf.embedImage(gradientJpg), label: "Gradient JPEG" },
        { img: pdf.embedImage(sampleJpg), label: "Sample JPEG" },
      ];

      // Header
      page.drawRectangle({
        x: 0,
        y: 742,
        width: 612,
        height: 50,
        color: rgb(0.2, 0.3, 0.5),
      });

      page.drawText("Image Gallery", {
        x: 50,
        y: 760,
        font: "Helvetica-Bold",
        size: 24,
        color: white,
      });

      page.drawText("PNG and JPEG image embedding demo", {
        x: 50,
        y: 748,
        size: 10,
        color: rgb(0.8, 0.8, 0.9),
      });

      // Grid layout
      const cols = 3;
      const cellWidth = 180;
      const cellHeight = 160;
      const startX = 35;
      const startY = 560;
      const padding = 10;

      for (let i = 0; i < images.length; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = startX + col * cellWidth;
        const y = startY - row * cellHeight;

        // Cell border
        page.drawRectangle({
          x,
          y,
          width: cellWidth - padding,
          height: cellHeight - padding,
          borderColor: grayscale(0.8),
          borderWidth: 0.5,
        });

        // Image (centered in cell)
        const { img, label } = images[i];
        const maxSize = 100;
        const scale = Math.min(maxSize / img.width, (cellHeight - 50) / img.height);
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        const imgX = x + (cellWidth - padding - drawWidth) / 2;
        const imgY = y + (cellHeight - padding - drawHeight) / 2 + 10;

        page.drawImage(img, {
          x: imgX,
          y: imgY,
          width: drawWidth,
          height: drawHeight,
        });

        // Label
        page.drawText(label, {
          x: x + (cellWidth - padding) / 2,
          y: y + 10,
          size: 10,
          color: black,
          alignment: "center",
        });
      }

      // Footer with image info
      page.drawLine({
        start: { x: 50, y: 80 },
        end: { x: 562, y: 80 },
        color: grayscale(0.7),
      });

      page.drawText("Image formats: PNG (with alpha support) and JPEG (DCT encoded)", {
        x: 50,
        y: 60,
        size: 10,
        color: grayscale(0.5),
      });

      page.drawText("Generated with @libpdf/core Drawing API", {
        x: 50,
        y: 45,
        size: 10,
        color: grayscale(0.5),
      });

      const bytes = await pdf.save();
      expect(isPdfHeader(bytes)).toBe(true);
      await saveTestOutput("drawing/image-gallery.pdf", bytes);
    });

    it("demonstrates image aspect ratio handling", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ size: "letter" });

      // Load non-square image
      const blueRect = await loadFixture("images", "blue-rectangle.png");
      const sample = await loadFixture("images", "sample.jpg");

      const blueImg = pdf.embedImage(blueRect);
      const sampleImg = pdf.embedImage(sample);

      // Title
      page.drawText("Aspect Ratio Handling", {
        x: 50,
        y: 720,
        font: "Helvetica-Bold",
        size: 24,
        color: black,
      });

      page.drawLine({
        start: { x: 50, y: 710 },
        end: { x: 350, y: 710 },
        color: grayscale(0.5),
      });

      // Original dimensions
      page.drawText(
        `Blue rectangle: ${blueImg.width}x${blueImg.height} px (aspect: ${blueImg.aspectRatio.toFixed(2)})`,
        {
          x: 50,
          y: 680,
          size: 11,
          color: black,
        },
      );

      page.drawText(
        `Sample image: ${sampleImg.width}x${sampleImg.height} px (aspect: ${sampleImg.aspectRatio.toFixed(2)})`,
        {
          x: 50,
          y: 665,
          size: 11,
          color: black,
        },
      );

      // Width-only scaling (preserves aspect ratio)
      page.drawText("Width only (preserves aspect):", {
        x: 50,
        y: 630,
        size: 12,
        color: black,
      });

      page.drawRectangle({
        x: 50,
        y: 530,
        width: 200,
        height: 100,
        borderColor: grayscale(0.7),
        borderWidth: 0.5,
        borderDashArray: [3, 2],
      });
      page.drawImage(blueImg, { x: 50, y: 530, width: 200 });
      page.drawText("width: 200", { x: 50, y: 515, size: 9, color: grayscale(0.5) });

      page.drawRectangle({
        x: 280,
        y: 530,
        width: 100,
        height: 100,
        borderColor: grayscale(0.7),
        borderWidth: 0.5,
        borderDashArray: [3, 2],
      });
      page.drawImage(sampleImg, { x: 280, y: 530, width: 100 });
      page.drawText("width: 100", { x: 280, y: 515, size: 9, color: grayscale(0.5) });

      // Height-only scaling (preserves aspect ratio)
      page.drawText("Height only (preserves aspect):", {
        x: 50,
        y: 480,
        size: 12,
        color: black,
      });

      page.drawRectangle({
        x: 50,
        y: 400,
        width: 200,
        height: 80,
        borderColor: grayscale(0.7),
        borderWidth: 0.5,
        borderDashArray: [3, 2],
      });
      page.drawImage(blueImg, { x: 50, y: 400, height: 80 });
      page.drawText("height: 80", { x: 50, y: 385, size: 9, color: grayscale(0.5) });

      page.drawRectangle({
        x: 280,
        y: 400,
        width: 100,
        height: 80,
        borderColor: grayscale(0.7),
        borderWidth: 0.5,
        borderDashArray: [3, 2],
      });
      page.drawImage(sampleImg, { x: 280, y: 400, height: 80 });
      page.drawText("height: 80", { x: 280, y: 385, size: 9, color: grayscale(0.5) });

      // Explicit dimensions (may distort)
      page.drawText("Explicit width & height (may distort):", {
        x: 50,
        y: 350,
        size: 12,
        color: black,
      });

      page.drawRectangle({
        x: 50,
        y: 250,
        width: 100,
        height: 100,
        borderColor: grayscale(0.7),
        borderWidth: 0.5,
        borderDashArray: [3, 2],
      });
      page.drawImage(blueImg, { x: 50, y: 250, width: 100, height: 100 });
      page.drawText("100x100 (squished)", { x: 50, y: 235, size: 9, color: grayscale(0.5) });

      page.drawRectangle({
        x: 180,
        y: 250,
        width: 150,
        height: 50,
        borderColor: grayscale(0.7),
        borderWidth: 0.5,
        borderDashArray: [3, 2],
      });
      page.drawImage(sampleImg, { x: 180, y: 250, width: 150, height: 50 });
      page.drawText("150x50 (stretched)", { x: 180, y: 235, size: 9, color: grayscale(0.5) });

      page.drawRectangle({
        x: 360,
        y: 250,
        width: 80,
        height: 120,
        borderColor: grayscale(0.7),
        borderWidth: 0.5,
        borderDashArray: [3, 2],
      });
      page.drawImage(sampleImg, { x: 360, y: 250, width: 80, height: 120 });
      page.drawText("80x120 (stretched)", { x: 360, y: 235, size: 9, color: grayscale(0.5) });

      const bytes = await pdf.save();
      expect(isPdfHeader(bytes)).toBe(true);
      await saveTestOutput("drawing/images-aspect-ratio.pdf", bytes);
    });

    it("reuses the same embedded image multiple times", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ size: "letter" });

      // Load and embed just one image
      const sample = await loadFixture("images", "sample.jpg");
      const sampleImg = pdf.embedImage(sample);

      // Title
      page.drawText("Image Reuse (Single Embed, Multiple Draws)", {
        x: 50,
        y: 720,
        font: "Helvetica-Bold",
        size: 20,
        color: black,
      });

      page.drawLine({
        start: { x: 50, y: 710 },
        end: { x: 500, y: 710 },
        color: grayscale(0.5),
      });

      page.drawText("Same image embedded once, drawn 12 times:", {
        x: 50,
        y: 680,
        size: 12,
        color: black,
      });

      // Draw the same image 12 times in a grid
      const cols = 4;
      const rows = 3;
      const cellWidth = 130;
      const cellHeight = 140;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = 50 + col * cellWidth;
          const y = 520 - row * cellHeight;

          // Different styling for each instance
          const rotation = (row * cols + col) * 10;
          const opacity = 1 - (row * cols + col) * 0.05;
          const size = 80 - (row * cols + col) * 3;

          page.drawImage(sampleImg, {
            x: x + (cellWidth - size) / 2,
            y: y + (cellHeight - size) / 2,
            width: size,
            rotate: { angle: rotation },
            opacity,
          });
        }
      }

      // Note about efficiency
      page.drawRectangle({
        x: 50,
        y: 50,
        width: 512,
        height: 50,
        color: rgb(0.95, 0.95, 0.95),
        borderColor: grayscale(0.7),
        borderWidth: 0.5,
      });

      page.drawText("The image data is stored once in the PDF. Each draw references", {
        x: 60,
        y: 80,
        size: 10,
        color: grayscale(0.4),
      });

      page.drawText("the same XObject, keeping the file size minimal.", {
        x: 60,
        y: 65,
        size: 10,
        color: grayscale(0.4),
      });

      const bytes = await pdf.save();
      expect(isPdfHeader(bytes)).toBe(true);

      // Verify file size is reasonable (not duplicating image data)
      // A 200x200 JPEG at quality 90 is ~8KB, so 12 copies would be ~96KB if duplicated
      // With proper reuse, should be much smaller
      expect(bytes.length).toBeLessThan(50_000);

      await saveTestOutput("drawing/images-reuse.pdf", bytes);
    });
  });

  describe("content stream integrity", () => {
    it("preserves original content after many append operations", async () => {
      // Regression test: multiple appendContent calls should not corrupt the Contents array
      // Previously, a missing `return` caused nested arrays that lost original content
      const bytes = await loadFixture("text", "proposal.pdf");
      const pdf = await PDF.load(bytes);
      const page = pdf.getPage(0)!;

      // Draw many rectangles (simulates highlighting every character)
      for (let i = 0; i < 100; i++) {
        page.drawRectangle({
          x: 10 + (i % 10) * 50,
          y: 700 - Math.floor(i / 10) * 50,
          width: 40,
          height: 40,
          borderColor: rgb(0.5, 0.5, 0.5),
          borderWidth: 0.5,
        });
      }

      // The Contents should still be a flat array of streams, not nested
      const { PdfArray } = await import("#src/objects/pdf-array");
      const { PdfStream } = await import("#src/objects/pdf-stream");

      const contents = page.dict.get("Contents");
      expect(contents).toBeInstanceOf(PdfArray);

      // Verify no nested arrays - all items should resolve to streams
      if (contents instanceof PdfArray) {
        for (let i = 0; i < contents.length; i++) {
          const item = contents.at(i);

          // Items should not be nested arrays
          expect(item).not.toBeInstanceOf(PdfArray);
        }
      }

      // Save should succeed
      const savedBytes = await pdf.save();
      expect(isPdfHeader(savedBytes)).toBe(true);
    });

    it("preserves original content after many prepend operations", async () => {
      // Test that prependContent also maintains a flat Contents array
      // Uses drawPage with background:true which triggers prependContent
      const bytes = await loadFixture("text", "proposal.pdf");
      const pdf = await PDF.load(bytes);
      const page = pdf.getPage(0)!;

      // Embed a page from the same PDF to use as background stamp
      const stampPage = await pdf.embedPage(pdf, 0);

      // Draw as background many times (uses prependContent)
      for (let i = 0; i < 20; i++) {
        page.drawPage(stampPage, {
          x: i * 5,
          y: i * 5,
          scale: 0.1,
          background: true,
        });
      }

      const { PdfArray } = await import("#src/objects/pdf-array");

      const contents = page.dict.get("Contents");
      expect(contents).toBeInstanceOf(PdfArray);

      // Verify no nested arrays
      if (contents instanceof PdfArray) {
        for (let i = 0; i < contents.length; i++) {
          const item = contents.at(i);
          expect(item).not.toBeInstanceOf(PdfArray);
        }
      }

      const savedBytes = await pdf.save();
      expect(isPdfHeader(savedBytes)).toBe(true);
    });

    it("preserves original content with mixed append and prepend", async () => {
      // Test interleaved append and prepend operations
      const bytes = await loadFixture("text", "proposal.pdf");
      const pdf = await PDF.load(bytes);
      const page = pdf.getPage(0)!;

      const stampPage = await pdf.embedPage(pdf, 0);

      for (let i = 0; i < 30; i++) {
        if (i % 2 === 0) {
          // Background (prepend)
          page.drawPage(stampPage, { x: i * 3, y: i * 3, scale: 0.05, background: true });
        } else {
          // Foreground (append)
          page.drawRectangle({
            x: 10 + (i % 10) * 50,
            y: 700 - Math.floor(i / 10) * 50,
            width: 40,
            height: 40,
            color: rgb(0.5, 0.5, 0.5),
          });
        }
      }

      const { PdfArray } = await import("#src/objects/pdf-array");

      const contents = page.dict.get("Contents");
      expect(contents).toBeInstanceOf(PdfArray);

      if (contents instanceof PdfArray) {
        for (let i = 0; i < contents.length; i++) {
          const item = contents.at(i);
          expect(item).not.toBeInstanceOf(PdfArray);
        }
      }

      const savedBytes = await pdf.save();
      expect(isPdfHeader(savedBytes)).toBe(true);
    });
  });

  describe("opacity", () => {
    it("draws all shapes with various opacities (kitchen sink)", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ size: "letter" });
      const { width, height } = page;

      // Title
      page.drawText("Opacity Kitchen Sink Test", {
        x: 50,
        y: height - 40,
        size: 24,
        font: "Helvetica-Bold",
        color: black,
      });

      page.drawText("All drawing methods at 100%, 50%, and 25% opacity", {
        x: 50,
        y: height - 60,
        size: 10,
        color: grayscale(0.4),
      });

      const opacities = [1.0, 0.5, 0.25];
      const labels = ["100%", "50%", "25%"];
      let yPos = height - 100;

      // === RECTANGLES ===
      page.drawText("Rectangles (filled)", {
        x: 50,
        y: yPos,
        size: 12,
        font: "Helvetica-Bold",
        color: black,
      });
      yPos -= 15;

      for (let i = 0; i < opacities.length; i++) {
        page.drawRectangle({
          x: 50 + i * 100,
          y: yPos - 40,
          width: 80,
          height: 40,
          color: rgb(0.2, 0.5, 0.9),
          opacity: opacities[i],
        });
        page.drawText(labels[i], { x: 75 + i * 100, y: yPos - 55, size: 9, color: black });
      }

      // Rectangles with border
      page.drawText("Rectangles (border)", {
        x: 350,
        y: yPos + 15,
        size: 12,
        font: "Helvetica-Bold",
        color: black,
      });

      for (let i = 0; i < opacities.length; i++) {
        page.drawRectangle({
          x: 350 + i * 90,
          y: yPos - 40,
          width: 70,
          height: 40,
          borderColor: rgb(0.8, 0.2, 0.2),
          borderWidth: 3,
          borderOpacity: opacities[i],
        });
        page.drawText(labels[i], { x: 370 + i * 90, y: yPos - 55, size: 9, color: black });
      }

      yPos -= 85;

      // === CIRCLES ===
      page.drawText("Circles", { x: 50, y: yPos, size: 12, font: "Helvetica-Bold", color: black });
      yPos -= 15;

      for (let i = 0; i < opacities.length; i++) {
        page.drawCircle({
          x: 90 + i * 100,
          y: yPos - 25,
          radius: 25,
          color: rgb(0.9, 0.6, 0.1),
          opacity: opacities[i],
        });
        page.drawText(labels[i], { x: 75 + i * 100, y: yPos - 60, size: 9, color: black });
      }

      // Circles with border
      page.drawText("Circles (border)", {
        x: 350,
        y: yPos + 15,
        size: 12,
        font: "Helvetica-Bold",
        color: black,
      });

      for (let i = 0; i < opacities.length; i++) {
        page.drawCircle({
          x: 385 + i * 90,
          y: yPos - 25,
          radius: 25,
          borderColor: rgb(0.2, 0.7, 0.3),
          borderWidth: 3,
          borderOpacity: opacities[i],
        });
        page.drawText(labels[i], { x: 370 + i * 90, y: yPos - 60, size: 9, color: black });
      }

      yPos -= 85;

      // === ELLIPSES ===
      page.drawText("Ellipses", { x: 50, y: yPos, size: 12, font: "Helvetica-Bold", color: black });
      yPos -= 15;

      for (let i = 0; i < opacities.length; i++) {
        page.drawEllipse({
          x: 90 + i * 100,
          y: yPos - 20,
          xRadius: 40,
          yRadius: 20,
          color: rgb(0.7, 0.2, 0.7),
          opacity: opacities[i],
        });
        page.drawText(labels[i], { x: 75 + i * 100, y: yPos - 50, size: 9, color: black });
      }

      yPos -= 75;

      // === LINES ===
      page.drawText("Lines", { x: 50, y: yPos, size: 12, font: "Helvetica-Bold", color: black });
      yPos -= 15;

      for (let i = 0; i < opacities.length; i++) {
        page.drawLine({
          start: { x: 50 + i * 100, y: yPos - 5 },
          end: { x: 130 + i * 100, y: yPos - 25 },
          color: rgb(0.1, 0.1, 0.1),
          thickness: 4,
          opacity: opacities[i],
        });
        page.drawText(labels[i], { x: 75 + i * 100, y: yPos - 40, size: 9, color: black });
      }

      yPos -= 65;

      // === TEXT ===
      page.drawText("Text", { x: 50, y: yPos, size: 12, font: "Helvetica-Bold", color: black });
      yPos -= 20;

      for (let i = 0; i < opacities.length; i++) {
        page.drawText("Hello PDF", {
          x: 50 + i * 120,
          y: yPos,
          size: 18,
          font: "Helvetica-Bold",
          color: rgb(0.1, 0.4, 0.7),
          opacity: opacities[i],
        });
        page.drawText(labels[i], { x: 75 + i * 120, y: yPos - 18, size: 9, color: black });
      }

      yPos -= 50;

      // === OVERLAPPING SHAPES ===
      page.drawText("Overlapping shapes (opacity blending)", {
        x: 50,
        y: yPos,
        size: 12,
        font: "Helvetica-Bold",
        color: black,
      });
      yPos -= 20;

      // Background rectangle
      page.drawRectangle({
        x: 50,
        y: yPos - 80,
        width: 200,
        height: 80,
        color: rgb(0.2, 0.6, 0.9),
      });

      // Overlapping circles at different opacities
      page.drawCircle({
        x: 100,
        y: yPos - 40,
        radius: 35,
        color: rgb(0.9, 0.2, 0.2),
        opacity: 0.7,
      });

      page.drawCircle({
        x: 150,
        y: yPos - 40,
        radius: 35,
        color: rgb(0.2, 0.9, 0.2),
        opacity: 0.7,
      });

      page.drawCircle({
        x: 200,
        y: yPos - 40,
        radius: 35,
        color: rgb(0.9, 0.9, 0.2),
        opacity: 0.7,
      });

      // Text over shapes
      page.drawText("Layered", {
        x: 115,
        y: yPos - 45,
        size: 16,
        font: "Helvetica-Bold",
        color: white,
        opacity: 0.9,
      });

      // Second demo: gradient-like effect with rectangles
      const gradientX = 300;

      for (let i = 0; i < 10; i++) {
        page.drawRectangle({
          x: gradientX + i * 15,
          y: yPos - 80,
          width: 30,
          height: 80,
          color: rgb(0.1, 0.1, 0.8),
          opacity: (i + 1) / 10,
        });
      }

      page.drawText("Opacity gradient effect", {
        x: gradientX,
        y: yPos - 95,
        size: 9,
        color: black,
      });

      yPos -= 130;

      // === PATH BUILDER ===
      page.drawText("Custom paths (PathBuilder)", {
        x: 50,
        y: yPos,
        size: 12,
        font: "Helvetica-Bold",
        color: black,
      });
      yPos -= 20;

      for (let i = 0; i < opacities.length; i++) {
        const startX = 60 + i * 120;
        page
          .drawPath()
          .moveTo(startX, yPos - 10)
          .lineTo(startX + 40, yPos - 10)
          .lineTo(startX + 50, yPos - 40)
          .lineTo(startX + 20, yPos - 55)
          .lineTo(startX - 10, yPos - 40)
          .close()
          .fillAndStroke({
            color: rgb(0.6, 0.3, 0.1),
            opacity: opacities[i],
            borderColor: rgb(0.2, 0.1, 0.05),
            borderWidth: 2,
            borderOpacity: opacities[i],
          });
        page.drawText(labels[i], { x: startX + 10, y: yPos - 70, size: 9, color: black });
      }

      const bytes = await pdf.save();
      expect(isPdfHeader(bytes)).toBe(true);
      await saveTestOutput("drawing/opacity-kitchen-sink.pdf", bytes);
    });

    it("draws images with various opacities", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ size: "letter" });
      const { height } = page;

      // Load test images
      const jpegData = await loadFixture("images", "sample.jpg");
      const pngData = await loadFixture("images", "gradient-circle.png");

      const jpegImg = pdf.embedImage(jpegData);
      const pngImg = pdf.embedImage(pngData);

      // Title
      page.drawText("Image Opacity Test", {
        x: 50,
        y: height - 40,
        size: 24,
        font: "Helvetica-Bold",
        color: black,
      });

      const opacities = [1.0, 0.75, 0.5, 0.25, 0.1];
      const labels = ["100%", "75%", "50%", "25%", "10%"];

      // JPEG images
      page.drawText("JPEG at various opacities:", {
        x: 50,
        y: height - 80,
        size: 12,
        font: "Helvetica-Bold",
        color: black,
      });

      for (let i = 0; i < opacities.length; i++) {
        page.drawImage(jpegImg, {
          x: 50 + i * 110,
          y: height - 200,
          width: 100,
          opacity: opacities[i],
        });
        page.drawText(labels[i], {
          x: 85 + i * 110,
          y: height - 215,
          size: 9,
          color: black,
        });
      }

      // PNG images (with alpha)
      page.drawText("PNG (with alpha) at various opacities:", {
        x: 50,
        y: height - 250,
        size: 12,
        font: "Helvetica-Bold",
        color: black,
      });

      // Draw colored background to show transparency
      page.drawRectangle({
        x: 45,
        y: height - 380,
        width: 520,
        height: 110,
        color: rgb(0.9, 0.85, 0.7),
      });

      for (let i = 0; i < opacities.length; i++) {
        page.drawImage(pngImg, {
          x: 50 + i * 110,
          y: height - 370,
          width: 100,
          opacity: opacities[i],
        });
        page.drawText(labels[i], {
          x: 85 + i * 110,
          y: height - 385,
          size: 9,
          color: black,
        });
      }

      // Overlapping images
      page.drawText("Overlapping images with opacity:", {
        x: 50,
        y: height - 420,
        size: 12,
        font: "Helvetica-Bold",
        color: black,
      });

      page.drawImage(jpegImg, {
        x: 50,
        y: height - 550,
        width: 150,
      });

      page.drawImage(pngImg, {
        x: 120,
        y: height - 520,
        width: 120,
        opacity: 0.7,
      });

      page.drawImage(jpegImg, {
        x: 190,
        y: height - 540,
        width: 100,
        opacity: 0.5,
      });

      const bytes = await pdf.save();
      expect(isPdfHeader(bytes)).toBe(true);
      await saveTestOutput("drawing/opacity-images.pdf", bytes);
    });
  });
});
