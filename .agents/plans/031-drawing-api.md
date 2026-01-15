# Drawing API Specification

## Overview

Add a comprehensive drawing API to `PDFPage` for creating PDF content programmatically. This includes drawing text, images, and shapes (rectangles, lines, circles, ellipses, paths).

## Goals

1. Provide a simple, intuitive API for common drawing operations
2. Support text with multiline wrapping, alignment, and measurement
3. Support image embedding (JPEG, PNG)
4. Support basic shapes with fill/stroke options
5. Build on existing infrastructure (`ContentStreamBuilder`, `Operator`, operator factories)

## Non-Goals

- Complex text layout (tables, columns, flowing text between regions)
- SVG path parsing (can add later)
- Gradient fills (can add later)
- Pattern fills (can add later)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  PDFPage.drawText(), drawImage(), drawRectangle(), etc.        │
│  (High-level API with sensible defaults)                       │
├─────────────────────────────────────────────────────────────────┤
│  src/api/drawing/operations.ts                                 │
│  (Pure functions: drawTextOps(), drawImageOps(), etc.)         │
├─────────────────────────────────────────────────────────────────┤
│  src/helpers/operators.ts (existing)                           │
│  (Low-level: pushGraphicsState(), setFont(), moveTo(), etc.)   │
├─────────────────────────────────────────────────────────────────┤
│  ContentStreamBuilder (existing)                               │
│  (Assembles operators into content stream bytes)               │
└─────────────────────────────────────────────────────────────────┘
```

### New Files

| File                              | Purpose                               |
| --------------------------------- | ------------------------------------- |
| `src/api/drawing/types.ts`        | Option interfaces and types           |
| `src/api/drawing/operations.ts`   | Pure functions returning `Operator[]` |
| `src/api/drawing/text-layout.ts`  | Text wrapping and measurement         |
| `src/api/drawing/path-builder.ts` | Fluent path building API              |
| `src/api/drawing/index.ts`        | Public exports                        |
| `src/images/pdf-image.ts`         | Image embedding (JPEG, PNG)           |
| `src/images/jpeg.ts`              | JPEG parsing                          |
| `src/images/png.ts`               | PNG parsing                           |

### Modified Files

| File                       | Changes                                            |
| -------------------------- | -------------------------------------------------- |
| `src/helpers/colors.ts`    | Add color presets (black, white, red, green, blue) |
| `src/fonts/standard-14.ts` | Add `StandardFonts` const object                   |
| `src/api/pdf.ts`           | Add `getStandardFont()` method                     |
| `src/api/pdf-page.ts`      | Add all drawing methods                            |

---

## API Design

### Colors (Existing)

Colors are already defined in `src/helpers/colors.ts`:

```typescript
// Existing types
interface RGB { type: "RGB"; red: number; green: number; blue: number; }
interface Grayscale { type: "Grayscale"; gray: number; }
interface CMYK { type: "CMYK"; cyan: number; magenta: number; yellow: number; black: number; }
type Color = RGB | Grayscale | CMYK;

// Existing factory functions
rgb(r: number, g: number, b: number): RGB
grayscale(gray: number): Grayscale
cmyk(c: number, m: number, y: number, k: number): CMYK
colorToArray(color: Color): number[]
```

**To add**: Color presets for convenience:

```typescript
// Add to src/helpers/colors.ts
export const black = grayscale(0);
export const white = grayscale(1);
export const red = rgb(1, 0, 0);
export const green = rgb(0, 1, 0);
export const blue = rgb(0, 0, 1);
```

### Standard Fonts

We already have `Standard14FontName` in `src/fonts/standard-14.ts`. Add a convenience const:

````typescript
// Add to src/fonts/standard-14.ts

/**
 * Standard 14 fonts enum for convenient access.
 *
 * @example
 * ```typescript
 * page.drawText("Hello", { font: StandardFonts.Helvetica });
 * page.drawText("Bold", { font: StandardFonts.HelveticaBold });
 * ```
 */
export const StandardFonts = {
  Helvetica: "Helvetica",
  HelveticaBold: "Helvetica-Bold",
  HelveticaOblique: "Helvetica-Oblique",
  HelveticaBoldOblique: "Helvetica-BoldOblique",

  TimesRoman: "Times-Roman",
  TimesBold: "Times-Bold",
  TimesItalic: "Times-Italic",
  TimesBoldItalic: "Times-BoldItalic",

  Courier: "Courier",
  CourierBold: "Courier-Bold",
  CourierOblique: "Courier-Oblique",
  CourierBoldOblique: "Courier-BoldOblique",

  Symbol: "Symbol",
  ZapfDingbats: "ZapfDingbats",
} as const satisfies Record<string, Standard14FontName>;
````

Drawing methods accept either a `Standard14FontName` string or an embedded `PDFFont`:

```typescript
font?: Standard14FontName | PDFFont;  // Default: "Helvetica"
```

### Drawing Options

```typescript
// src/api/drawing/types.ts

export type TextAlignment = "left" | "center" | "right" | "justify";

export type LineCap = "butt" | "round" | "square"; // 0, 1, 2
export type LineJoin = "miter" | "round" | "bevel"; // 0, 1, 2

export interface Rotation {
  angle: number; // Degrees
  origin?: {
    // Rotation center (default: object center)
    x: number;
    y: number;
  };
}

// --- Text Options ---

export interface DrawTextOptions {
  x?: number; // Default: 0
  y?: number; // Default: 0
  font?: StandardFontName | PDFFont; // Default: "Helvetica"
  size?: number; // Default: 12
  color?: Color; // Default: black
  opacity?: number; // Default: 1 (0-1)

  // Multiline options
  maxWidth?: number; // Enable word wrapping
  lineHeight?: number; // Default: size * 1.2
  alignment?: TextAlignment; // Default: "left"

  // Transform
  rotate?: Rotation;
}

// --- Image Options ---

export interface DrawImageOptions {
  x?: number; // Default: 0
  y?: number; // Default: 0
  width?: number; // Default: image natural width
  height?: number; // Default: image natural height (or aspect-preserved)
  opacity?: number; // Default: 1
  rotate?: Rotation;
}

// --- Shape Options ---

export interface DrawRectangleOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  color?: Color; // Fill color (omit for no fill)
  borderColor?: Color; // Stroke color (omit for no stroke)
  borderWidth?: number; // Default: 1 (if borderColor set)
  borderDashArray?: number[]; // Dash pattern
  borderDashPhase?: number; // Dash phase
  cornerRadius?: number; // Rounded corners
  opacity?: number; // Fill opacity
  borderOpacity?: number; // Stroke opacity
  rotate?: Rotation;
}

export interface DrawLineOptions {
  start: { x: number; y: number };
  end: { x: number; y: number };
  color?: Color; // Default: black
  thickness?: number; // Default: 1
  dashArray?: number[];
  dashPhase?: number;
  lineCap?: LineCap; // Default: "butt"
  opacity?: number;
}

export interface DrawCircleOptions {
  x: number; // Center x
  y: number; // Center y
  radius: number;
  color?: Color; // Fill color
  borderColor?: Color; // Stroke color
  borderWidth?: number;
  opacity?: number;
  borderOpacity?: number;
}

export interface DrawEllipseOptions {
  x: number; // Center x
  y: number; // Center y
  xRadius: number;
  yRadius: number;
  color?: Color;
  borderColor?: Color;
  borderWidth?: number;
  opacity?: number;
  borderOpacity?: number;
  rotate?: Rotation;
}

// --- Path Builder Options ---

export interface PathOptions {
  color?: Color; // Fill color
  borderColor?: Color; // Stroke color
  borderWidth?: number;
  lineCap?: LineCap;
  lineJoin?: LineJoin;
  miterLimit?: number;
  dashArray?: number[];
  dashPhase?: number;
  opacity?: number;
  borderOpacity?: number;
  windingRule?: "nonzero" | "evenodd";
}
```

### PDFPage Drawing Methods

````typescript
// Added to PDFPage class

class PDFPage {
  // --- Text ---

  /**
   * Draw text on the page.
   *
   * For multiline text, set `maxWidth` to enable word wrapping.
   * Text containing `\n` will always create line breaks.
   *
   * @example
   * ```typescript
   * page.drawText("Hello, World!", {
   *   x: 50,
   *   y: 700,
   *   font,
   *   size: 24,
   *   color: rgb(0, 0, 0),
   * });
   *
   * // Multiline with wrapping
   * page.drawText(longText, {
   *   x: 50,
   *   y: 700,
   *   font,
   *   size: 12,
   *   maxWidth: 500,
   *   lineHeight: 18,
   *   alignment: "justify",
   * });
   * ```
   */
  drawText(text: string, options: DrawTextOptions): void;

  // --- Images ---

  /**
   * Draw an image on the page.
   *
   * If only width or height is specified, aspect ratio is preserved.
   * If neither is specified, image is drawn at natural size.
   *
   * @example
   * ```typescript
   * const image = await pdf.embedImage(jpegBytes);
   * page.drawImage(image, { x: 50, y: 500, width: 200 });
   * ```
   */
  drawImage(image: PDFImage, options?: DrawImageOptions): void;

  // --- Shapes ---

  /**
   * Draw a rectangle.
   *
   * @example
   * ```typescript
   * // Filled rectangle
   * page.drawRectangle({
   *   x: 50, y: 500, width: 200, height: 100,
   *   color: rgb(0.95, 0.95, 0.95),
   * });
   *
   * // Stroked rectangle with rounded corners
   * page.drawRectangle({
   *   x: 50, y: 500, width: 200, height: 100,
   *   borderColor: rgb(0, 0, 0),
   *   borderWidth: 2,
   *   cornerRadius: 10,
   * });
   * ```
   */
  drawRectangle(options: DrawRectangleOptions): void;

  /**
   * Draw a line.
   *
   * @example
   * ```typescript
   * page.drawLine({
   *   start: { x: 50, y: 500 },
   *   end: { x: 550, y: 500 },
   *   color: rgb(0, 0, 0),
   *   thickness: 1,
   * });
   * ```
   */
  drawLine(options: DrawLineOptions): void;

  /**
   * Draw a circle.
   *
   * @example
   * ```typescript
   * page.drawCircle({
   *   x: 300, y: 400,
   *   radius: 50,
   *   color: rgb(1, 0, 0),
   *   borderColor: rgb(0, 0, 0),
   *   borderWidth: 2,
   * });
   * ```
   */
  drawCircle(options: DrawCircleOptions): void;

  /**
   * Draw an ellipse.
   */
  drawEllipse(options: DrawEllipseOptions): void;

  // --- Paths ---

  /**
   * Start building a custom path.
   *
   * @example
   * ```typescript
   * page.drawPath()
   *   .moveTo(100, 100)
   *   .lineTo(200, 100)
   *   .lineTo(150, 200)
   *   .close()
   *   .fill({ color: rgb(1, 0, 0) });
   * ```
   */
  drawPath(): PathBuilder;
}
````

### PathBuilder (Fluent API)

```typescript
// src/api/drawing/path-builder.ts

export class PathBuilder {
  constructor(page: PDFPage);

  // Path construction
  moveTo(x: number, y: number): this;
  lineTo(x: number, y: number): this;
  curveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): this;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): this;
  close(): this;

  // Convenience shapes (add to current path)
  rectangle(x: number, y: number, width: number, height: number): this;
  circle(x: number, y: number, radius: number): this;
  ellipse(x: number, y: number, xRadius: number, yRadius: number): this;

  // Painting (terminates the path)
  stroke(options?: PathOptions): void;
  fill(options?: PathOptions): void;
  fillAndStroke(options?: PathOptions): void;

  // Clipping
  clip(): void;
  clipEvenOdd(): void;
}
```

### Image Embedding

````typescript
// src/images/pdf-image.ts

export class PDFImage {
  /** Image width in pixels */
  readonly width: number;

  /** Image height in pixels */
  readonly height: number;

  /** Reference to the image XObject in the document */
  readonly ref: PdfRef;

  /**
   * Scale factor to convert pixels to points.
   * Default is 1 (1 pixel = 1 point).
   * For print-quality (300 DPI), use 72/300 = 0.24.
   */
  readonly scale: number;

  /** Width in points (pixels * scale) */
  get widthInPoints(): number;

  /** Height in points (pixels * scale) */
  get heightInPoints(): number;
}

// On PDF class
class PDF {
  /**
   * Embed an image for use with page.drawImage().
   *
   * Supports JPEG and PNG formats. PNG alpha channels are
   * converted to PDF soft masks.
   *
   * @example
   * ```typescript
   * const image = await pdf.embedImage(jpegBytes);
   * page.drawImage(image, { x: 50, y: 500 });
   * ```
   */
  embedImage(bytes: Uint8Array): Promise<PDFImage>;

  /**
   * Embed a JPEG image.
   */
  embedJpeg(bytes: Uint8Array): Promise<PDFImage>;

  /**
   * Embed a PNG image.
   */
  embedPng(bytes: Uint8Array): Promise<PDFImage>;
}
````

### Text Layout Utilities

```typescript
// src/api/drawing/text-layout.ts

export interface TextLine {
  text: string;
  width: number;
}

export interface LayoutResult {
  lines: TextLine[];
  height: number;
}

/**
 * Break text into lines that fit within maxWidth.
 *
 * - Splits on explicit line breaks (\n, \r\n, \r)
 * - Word-wraps at spaces when line exceeds maxWidth
 * - Long words that exceed maxWidth are kept intact (no character-level breaking)
 */
export function layoutText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
  lineHeight: number,
): LayoutResult;

/**
 * Measure the width of text at a given font size.
 */
export function measureText(text: string, font: PDFFont, fontSize: number): number;

/**
 * Calculate positions for justified text.
 * Returns word positions with adjusted spacing.
 */
export function layoutJustifiedLine(
  words: string[],
  font: PDFFont,
  fontSize: number,
  targetWidth: number,
): { word: string; x: number }[];
```

---

## Implementation Details

### Graphics State Isolation

Every drawing operation wraps its content in `q` (save) / `Q` (restore) to isolate graphics state:

```typescript
function drawRectangleOps(options: DrawRectangleOpsOptions): Operator[] {
  return [
    pushGraphicsState(), // q
    // ... set colors, line width, etc.
    // ... draw rectangle
    popGraphicsState(), // Q
  ];
}
```

### Resource Management

Resources (fonts, images, graphics states) are registered in the page's `/Resources` dictionary:

```typescript
// In PDFPage
private ensureResources(): PdfDict {
  let resources = this.dict.get("Resources") as PdfDict | undefined;
  if (!resources) {
    resources = new PdfDict();
    this.dict.set("Resources", resources);
  }
  return resources;
}

addFontResource(font: PDFFont): string {
  const name = this.generateResourceName("F");
  // Add to /Resources/Font
  return name;
}

addImageResource(image: PDFImage): string {
  const name = this.generateResourceName("Im");
  // Add to /Resources/XObject
  return name;
}

addGraphicsState(options: ExtGStateOptions): string {
  const name = this.generateResourceName("GS");
  // Add to /Resources/ExtGState
  return name;
}
```

### Opacity Handling

Opacity requires an ExtGState resource:

```typescript
function withOpacity(fillOpacity?: number, strokeOpacity?: number): Operator | null {
  if (fillOpacity === undefined && strokeOpacity === undefined) {
    return null;
  }
  // Register ExtGState and return setGraphicsState operator
}
```

### Coordinate System

PDF uses bottom-left origin. We keep this convention (don't flip) because:

1. Matches PDF spec and all documentation
2. Consistent with existing `drawPage()` behavior
3. Users can apply transforms if they want different origin

### Ellipse/Circle Drawing

PDF has no ellipse primitive. Approximate with 4 Bezier curves:

```typescript
// Magic number for circular approximation
const KAPPA = 0.5522847498; // 4 * (sqrt(2) - 1) / 3

function ellipseOps(cx: number, cy: number, rx: number, ry: number): Operator[] {
  const kx = rx * KAPPA;
  const ky = ry * KAPPA;

  return [
    moveTo(cx - rx, cy),
    curveTo(cx - rx, cy + ky, cx - kx, cy + ry, cx, cy + ry),
    curveTo(cx + kx, cy + ry, cx + rx, cy + ky, cx + rx, cy),
    curveTo(cx + rx, cy - ky, cx + kx, cy - ry, cx, cy - ry),
    curveTo(cx - kx, cy - ry, cx - rx, cy - ky, cx - rx, cy),
    closePath(),
  ];
}
```

### Rounded Rectangles

Implemented with arcs at corners:

```typescript
function roundedRectOps(x, y, w, h, r): Operator[] {
  const k = r * KAPPA;
  return [
    moveTo(x + r, y),
    lineTo(x + w - r, y),
    curveTo(x + w - r + k, y, x + w, y + r - k, x + w, y + r), // bottom-right
    lineTo(x + w, y + h - r),
    curveTo(x + w, y + h - r + k, x + w - r + k, y + h, x + w - r, y + h), // top-right
    lineTo(x + r, y + h),
    curveTo(x + r - k, y + h, x, y + h - r + k, x, y + h - r), // top-left
    lineTo(x, y + r),
    curveTo(x, y + r - k, x + r - k, y, x + r, y), // bottom-left
    closePath(),
  ];
}
```

### Text Justify Implementation

For justified text, calculate extra space and distribute between words:

```typescript
function drawJustifiedLine(
  words: string[],
  font: PDFFont,
  fontSize: number,
  x: number,
  y: number,
  targetWidth: number,
): Operator[] {
  if (words.length <= 1) {
    // Single word - just draw left-aligned
    return drawTextLineOps(...);
  }

  // Calculate total word width
  const totalWordWidth = words.reduce((sum, w) => sum + measureText(w, font, fontSize), 0);

  // Calculate space to distribute
  const extraSpace = targetWidth - totalWordWidth;
  const spacePerGap = extraSpace / (words.length - 1);

  // Draw each word with TJ array for precise positioning
  // ... or use word spacing (Tw operator)
}
```

---

## Image Embedding Details

### JPEG

JPEG can be embedded directly without re-encoding:

```typescript
interface JpegInfo {
  width: number;
  height: number;
  colorSpace: "DeviceGray" | "DeviceRGB" | "DeviceCMYK";
  bitsPerComponent: number;
}

function parseJpegHeader(bytes: Uint8Array): JpegInfo;

function createJpegXObject(bytes: Uint8Array, info: JpegInfo): PdfStream {
  return new PdfStream(
    PdfDict.of({
      Type: PdfName.of("XObject"),
      Subtype: PdfName.of("Image"),
      Width: PdfNumber.of(info.width),
      Height: PdfNumber.of(info.height),
      ColorSpace: PdfName.of(info.colorSpace),
      BitsPerComponent: PdfNumber.of(info.bitsPerComponent),
      Filter: PdfName.of("DCTDecode"),
    }),
    bytes, // Raw JPEG data
  );
}
```

### PNG

PNG requires decoding and re-encoding:

```typescript
interface PngInfo {
  width: number;
  height: number;
  colorType: number; // 0=gray, 2=RGB, 3=indexed, 4=gray+alpha, 6=RGBA
  bitDepth: number;
  hasAlpha: boolean;
}

function parsePng(bytes: Uint8Array): {
  info: PngInfo;
  pixels: Uint8Array; // Decoded RGB/Gray pixels
  alpha?: Uint8Array; // Alpha channel (if present)
};

function createPngXObject(
  pixels: Uint8Array,
  alpha: Uint8Array | undefined,
  info: PngInfo,
): PdfStream {
  const dict = PdfDict.of({
    Type: PdfName.of("XObject"),
    Subtype: PdfName.of("Image"),
    Width: PdfNumber.of(info.width),
    Height: PdfNumber.of(info.height),
    ColorSpace: PdfName.of(info.colorType === 0 ? "DeviceGray" : "DeviceRGB"),
    BitsPerComponent: PdfNumber.of(8),
    Filter: PdfName.of("FlateDecode"),
  });

  if (alpha) {
    // Create soft mask for alpha channel
    const smask = createAlphaMask(alpha, info.width, info.height);
    dict.set("SMask", smask);
  }

  return new PdfStream(dict, deflate(pixels));
}
```

---

## Usage Examples

### Basic Text

```typescript
import { PDF, rgb, StandardFonts } from "@libpdf/core";

const pdf = PDF.create();
const page = pdf.addPage({ size: "letter" });

// Simple - uses default Helvetica 12pt
page.drawText("Hello, World!", { x: 72, y: 700 });

// With options
page.drawText("Hello, World!", {
  x: 72,
  y: 700,
  size: 24,
  color: rgb(0, 0, 0),
});

// Using a different Standard 14 font (by name or enum)
page.drawText("Bold Title", {
  x: 72,
  y: 650,
  font: "Times-Bold", // or StandardFonts.TimesBold
  size: 18,
});

// Using an embedded font (for Unicode support)
const customFont = await pdf.embedFont(fontBytes);
page.drawText("Hello 世界", {
  x: 72,
  y: 600,
  font: customFont,
  size: 16,
});
```

### Multiline Text with Wrapping

```typescript
const longText = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`;

page.drawText(longText, {
  x: 72,
  y: 700,
  size: 12,
  maxWidth: 468, // 612 - 72*2 margins
  lineHeight: 18,
  alignment: "justify",
});
```

### Drawing Shapes

```typescript
// Filled rectangle with border
page.drawRectangle({
  x: 72,
  y: 500,
  width: 200,
  height: 100,
  color: rgb(0.95, 0.95, 0.95),
  borderColor: rgb(0.5, 0.5, 0.5),
  borderWidth: 1,
  cornerRadius: 8,
});

// Red circle
page.drawCircle({
  x: 300,
  y: 400,
  radius: 50,
  color: rgb(1, 0, 0),
});

// Dashed line
page.drawLine({
  start: { x: 72, y: 300 },
  end: { x: 540, y: 300 },
  color: rgb(0, 0, 0),
  thickness: 1,
  dashArray: [5, 3],
});
```

### Custom Path

```typescript
// Triangle
page
  .drawPath()
  .moveTo(300, 200)
  .lineTo(350, 300)
  .lineTo(250, 300)
  .close()
  .fill({ color: rgb(0, 0, 1) });
```

### Image

```typescript
const image = await pdf.embedImage(jpegBytes);

page.drawImage(image, {
  x: 72,
  y: 400,
  width: 200, // Height auto-calculated to preserve aspect ratio
});

// With rotation
page.drawImage(image, {
  x: 300,
  y: 400,
  width: 100,
  height: 100,
  rotate: { angle: 45 },
});
```

---

## Implementation Order

1. **Color presets** (`src/helpers/colors.ts`)
   - Add `black`, `white`, `red`, `green`, `blue` exports

2. **StandardFonts enum** (`src/fonts/standard-14.ts`)
   - Add `StandardFonts` const object

3. **Types module** (`src/api/drawing/types.ts`)
   - All option interfaces

4. **Operations module** (`src/api/drawing/operations.ts`)
   - Pure functions for all shapes
   - `drawRectangleOps()`, `drawLineOps()`, `drawCircleOps()`, `drawEllipseOps()`

5. **PDFPage shape methods**
   - `drawRectangle()`, `drawLine()`, `drawCircle()`, `drawEllipse()`

6. **PathBuilder** (`src/api/drawing/path-builder.ts`)
   - Fluent path construction API

7. **Text layout** (`src/api/drawing/text-layout.ts`)
   - `layoutText()`, `measureText()`, `layoutJustifiedLine()`
   - Ensure fonts support `widthOfTextAtSize()`

8. **Text operations and PDFPage.drawText()**
   - Single line and multiline
   - All alignment modes
   - Default to Helvetica

9. **Image parsing** (`src/images/`)
   - JPEG header parsing
   - PNG decoding

10. **Image embedding and PDFPage.drawImage()**
    - `PDFImage` class
    - `pdf.embedImage()`, `embedJpeg()`, `embedPng()`

---

## Testing Strategy

1. **Unit tests** for pure operations functions
   - Verify correct operators generated
   - Test edge cases (empty text, zero dimensions)

2. **Integration tests** with fixture PDFs
   - Draw content, save, verify renders correctly
   - Test in multiple viewers (Preview, Chrome, Acrobat)

3. **Visual regression tests**
   - Generate PDFs and compare to reference images
   - Test text alignment, wrapping, shapes

4. **Edge cases**
   - Very long words that exceed maxWidth
   - Empty strings
   - Special characters in text
   - Zero-dimension shapes
   - Negative coordinates
   - Large opacity values (clamp to 0-1)

---

## Design Decisions

1. **Default font for drawText**: Helvetica (Standard 14)
   - Standard 14 fonts don't require embedding
   - Helvetica is the most commonly used
   - Users can override with `font` option or `pdf.getStandardFont()` / `pdf.embedFont()`

2. **Coordinate origin**: Keep bottom-left (PDF native)
   - Consistent with PDF spec and existing code
   - Users can apply transforms if they want different origin

3. **Long word handling**: Keep intact (no character-level breaking)
   - Like pdf-lib's approach
   - Character-level breaking requires proper hyphenation which is complex

4. **Image DPI handling**: Provide `scale` property on PDFImage
   - Default to 1 (1 pixel = 1 point)
   - Users can pass explicit width/height to override
