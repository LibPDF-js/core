/**
 * Example: Draw SVG Icons
 *
 * This example shows how to render real SVG icons from icon libraries
 * onto PDF pages. Icons are extracted from popular open-source libraries.
 *
 * Run: npx tsx examples/04-drawing/draw-svg-icons.ts
 */

import { black, grayscale, PDF, rgb } from "../../src/index";
import { formatBytes, saveOutput } from "../utils";

// =============================================================================
// SVG Icon Paths (from popular open-source icon libraries)
// =============================================================================

// Simple Icons (CC0 license) - Brand icons, 24x24 viewBox, filled
const SIMPLE_ICONS = {
  github:
    "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
  typescript:
    "M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z",
  npm: "M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z",
};

// Lucide Icons (MIT license) - UI icons, 24x24 viewBox, stroked
const LUCIDE_ICONS = {
  heart:
    "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z",
  star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  home: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",
  mail: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6",
  search: "M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M21 21l-4.35-4.35",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
};

async function main() {
  console.log("Drawing SVG icons...\n");

  const pdf = PDF.create();
  const page = pdf.addPage({ size: "letter" });
  const { height } = page;

  // Title
  page.drawText("SVG Icon Examples", {
    x: 180,
    y: height - 40,
    size: 24,
    color: black,
  });

  page.drawText("Real icons from popular open-source icon libraries", {
    x: 130,
    y: height - 60,
    size: 11,
    color: grayscale(0.5),
  });

  // === Simple Icons (Filled brand icons) ===
  console.log("Drawing Simple Icons (brand logos)...");

  page.drawText("Simple Icons (CC0) - Filled brand icons:", {
    x: 50,
    y: height - 100,
    size: 14,
    color: black,
  });

  // GitHub
  page.drawText("GitHub", { x: 60, y: height - 175, size: 10, color: grayscale(0.6) });
  page.drawSvgPath(SIMPLE_ICONS.github, {
    x: 50,
    y: height - 120,
    scale: 2,
    color: grayscale(0.15),
  });

  // TypeScript
  page.drawText("TypeScript", { x: 160, y: height - 175, size: 10, color: grayscale(0.6) });
  page.drawSvgPath(SIMPLE_ICONS.typescript, {
    x: 150,
    y: height - 120,
    scale: 2,
    color: rgb(0.19, 0.47, 0.71),
  });

  // npm
  page.drawText("npm", { x: 275, y: height - 175, size: 10, color: grayscale(0.6) });
  page.drawSvgPath(SIMPLE_ICONS.npm, {
    x: 250,
    y: height - 120,
    scale: 2,
    color: rgb(0.8, 0.22, 0.17),
  });

  // === Lucide Icons (Stroked UI icons) ===
  console.log("Drawing Lucide Icons (UI icons)...");

  page.drawText("Lucide Icons (MIT) - Stroked UI icons:", {
    x: 50,
    y: height - 220,
    size: 14,
    color: black,
  });

  const lucideY = height - 240;
  const iconSpacing = 80;
  let iconX = 50;

  // Heart
  page.drawText("heart", { x: iconX + 10, y: lucideY - 65, size: 10, color: grayscale(0.6) });
  page.drawSvgPath(LUCIDE_ICONS.heart, {
    x: iconX,
    y: lucideY,
    scale: 2,
    borderColor: rgb(0.9, 0.2, 0.2),
    borderWidth: 2,
  });
  iconX += iconSpacing;

  // Star
  page.drawText("star", { x: iconX + 12, y: lucideY - 65, size: 10, color: grayscale(0.6) });
  page.drawSvgPath(LUCIDE_ICONS.star, {
    x: iconX,
    y: lucideY,
    scale: 2,
    borderColor: rgb(0.9, 0.7, 0.1),
    borderWidth: 2,
  });
  iconX += iconSpacing;

  // Home
  page.drawText("home", { x: iconX + 10, y: lucideY - 65, size: 10, color: grayscale(0.6) });
  page.drawSvgPath(LUCIDE_ICONS.home, {
    x: iconX,
    y: lucideY,
    scale: 2,
    borderColor: rgb(0.2, 0.6, 0.4),
    borderWidth: 2,
  });
  iconX += iconSpacing;

  // Mail
  page.drawText("mail", { x: iconX + 12, y: lucideY - 65, size: 10, color: grayscale(0.6) });
  page.drawSvgPath(LUCIDE_ICONS.mail, {
    x: iconX,
    y: lucideY,
    scale: 2,
    borderColor: rgb(0.5, 0.3, 0.7),
    borderWidth: 2,
  });
  iconX += iconSpacing;

  // Search
  page.drawText("search", { x: iconX + 6, y: lucideY - 65, size: 10, color: grayscale(0.6) });
  page.drawSvgPath(LUCIDE_ICONS.search, {
    x: iconX,
    y: lucideY,
    scale: 2,
    borderColor: rgb(0.3, 0.5, 0.8),
    borderWidth: 2,
  });
  iconX += iconSpacing;

  // User
  page.drawText("user", { x: iconX + 12, y: lucideY - 65, size: 10, color: grayscale(0.6) });
  page.drawSvgPath(LUCIDE_ICONS.user, {
    x: iconX,
    y: lucideY,
    scale: 2,
    borderColor: grayscale(0.4),
    borderWidth: 2,
  });

  // === Icon Sizing Demo ===
  console.log("Demonstrating icon scaling...");

  page.drawText("Icon Scaling:", { x: 50, y: height - 360, size: 14, color: black });

  const scales = [1, 1.5, 2, 2.5, 3];
  let scaleX = 50;

  for (const scale of scales) {
    page.drawText(`${scale}x`, {
      x: scaleX + 8,
      y: height - 450,
      size: 10,
      color: grayscale(0.5),
    });

    page.drawSvgPath(LUCIDE_ICONS.heart, {
      x: scaleX,
      y: height - 380,
      scale,
      borderColor: rgb(0.9, 0.2, 0.2),
      borderWidth: 1.5,
    });

    scaleX += 24 * scale + 30;
  }

  // === Practical Use: Icon Buttons ===
  console.log("Creating icon buttons...");

  page.drawText("Practical Example - Icon Buttons:", {
    x: 50,
    y: height - 500,
    size: 14,
    color: black,
  });

  const buttonY = height - 560;
  const buttonSize = 48;
  const buttonPadding = 12;
  let buttonX = 50;

  const buttonIcons = [
    { path: LUCIDE_ICONS.home, color: rgb(0.2, 0.5, 0.8) },
    { path: LUCIDE_ICONS.search, color: rgb(0.5, 0.3, 0.7) },
    { path: LUCIDE_ICONS.mail, color: rgb(0.8, 0.3, 0.3) },
    { path: LUCIDE_ICONS.user, color: rgb(0.3, 0.6, 0.4) },
    { path: LUCIDE_ICONS.star, color: rgb(0.9, 0.7, 0.1) },
  ];

  for (const { path, color } of buttonIcons) {
    // Draw button background
    page.drawRectangle({
      x: buttonX,
      y: buttonY,
      width: buttonSize,
      height: buttonSize,
      color: rgb(0.95, 0.95, 0.97),
      borderColor: grayscale(0.85),
      borderWidth: 1,
      cornerRadius: 8,
    });

    // Draw icon centered in button
    page.drawSvgPath(path, {
      x: buttonX + buttonPadding,
      y: buttonY + buttonSize - buttonPadding,
      borderColor: color,
      borderWidth: 1.5,
    });

    buttonX += buttonSize + 16;
  }

  // === Footer note ===
  page.drawLine({
    start: { x: 50, y: 80 },
    end: { x: 562, y: 80 },
    color: grayscale(0.8),
  });

  page.drawText("Icon paths are from SVG d attributes. Extract from any SVG icon library.", {
    x: 50,
    y: 60,
    size: 10,
    color: grayscale(0.5),
  });

  page.drawText("Simple Icons: simpleicons.org | Lucide: lucide.dev", {
    x: 50,
    y: 45,
    size: 10,
    color: grayscale(0.5),
  });

  // Save the document
  console.log("\n=== Saving Document ===");
  const savedBytes = await pdf.save();
  const outputPath = await saveOutput("04-drawing/svg-icon-examples.pdf", savedBytes);

  console.log(`Output: ${outputPath}`);
  console.log(`Size: ${formatBytes(savedBytes.length)}`);
}

main().catch(console.error);
