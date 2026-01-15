# Drawing API Research

## Summary

Research into how pdf-lib, PDFBox, and pdf.js handle PDF content stream generation (drawing APIs). All three libraries use a layered architecture that separates high-level drawing methods from low-level PDF operators.

**Key recommendation**: Adopt pdf-lib's pattern of pure operation functions that return operator arrays, composed within a stateful `PDFPage` class. This matches our existing infrastructure (`ContentStreamBuilder`, `Operator` class, operator factory functions in `helpers/operators.ts`).

**Current state**: We already have the low-level foundation (operators, serialization, `ContentStreamBuilder`). We need to add the high-level drawing methods to `PDFPage` and supporting components for text measurement and image embedding.

---

## pdf-lib Approach

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  High-Level API: PDFPage.drawText(), drawImage(), etc.         │
├─────────────────────────────────────────────────────────────────┤
│  Operations Layer: drawText(), drawRectangle(), drawEllipse()  │
│  (src/api/operations.ts) - Pure functions returning Operator[] │
├─────────────────────────────────────────────────────────────────┤
│  Operators Layer: pushGraphicsState(), moveTo(), fill(), etc.  │
│  (src/api/operators.ts) - Factory functions for PDFOperator    │
├─────────────────────────────────────────────────────────────────┤
│  Core: PDFOperator, PDFContentStream, PDFPageLeaf              │
└─────────────────────────────────────────────────────────────────┘
```

### Key Files

| File                                 | Purpose                                          |
| ------------------------------------ | ------------------------------------------------ |
| `src/api/PDFPage.ts`                 | High-level page class with draw methods          |
| `src/api/operations.ts`              | Drawing operations (pure functions → Operator[]) |
| `src/api/operators.ts`               | Low-level PDF operators as factory functions     |
| `src/api/colors.ts`                  | Color types (RGB, CMYK, Grayscale)               |
| `src/api/PDFFont.ts`                 | Font wrapper with encoding/measurement           |
| `src/api/PDFImage.ts`                | Image wrapper with dimension helpers             |
| `src/core/structures/PDFPageLeaf.ts` | Resource dictionary management                   |

### PDFPage State

```typescript
class PDFPage {
  private fontKey?: PDFName; // Current font resource name
  private font?: PDFFont; // Current font object
  private fontSize = 24;
  private fontColor = rgb(0, 0, 0);
  private lineHeight = 24;
  private x = 0; // Current position
  private y = 0;
  private contentStream?: PDFContentStream;
}
```

### Drawing Pattern

Every draw method follows this pattern:

1. Validate options
2. Register resources (fonts, images, graphics states) if needed
3. Get/create content stream
4. Generate operators via operations layer
5. Push operators to content stream

Each operation wraps content in `q`/`Q` (save/restore) to isolate graphics state.

### Operations Layer (Pure Functions)

```typescript
// operations.ts - Pure functions returning Operator[]
export const drawImage = (name, { x, y, width, height, rotate, xSkew, ySkew, graphicsState }) =>
  [
    pushGraphicsState(),                              // q
    graphicsState && setGraphicsState(graphicsState), // gs
    translate(x, y),                                  // cm
    rotateRadians(toRadians(rotate)),                 // cm
    scale(width, height),                             // cm
    skewRadians(toRadians(xSkew), toRadians(ySkew)), // cm
    drawObject(name),                                 // Do
    popGraphicsState(),                               // Q
  ].filter(Boolean);

export const drawRectangle = ({ x, y, width, height, borderWidth, color, borderColor, ... }) =>
  [
    pushGraphicsState(),
    graphicsState && setGraphicsState(graphicsState),
    setFillingColor(color),
    setStrokingColor(borderColor),
    setLineWidth(borderWidth),
    ...rotateAndSkew(...),
    moveTo(x, y),
    lineTo(x + width, y),
    lineTo(x + width, y + height),
    lineTo(x, y + height),
    closePath(),
    color && borderColor ? fillAndStroke() : color ? fill() : stroke(),
    popGraphicsState(),
  ].filter(Boolean);
```

### Resource Management

Resources are auto-named and added to page's `/Resources` dictionary:

```typescript
// In PDFPage
const xObjectKey = this.node.newXObject("Image", image.ref); // Returns /Image1
const fontKey = this.node.newFontDictionary(font.name, font.ref); // Returns /F1
const gsKey = this.node.newExtGState("GS", gsDict); // Returns /GS1
```

### Pros

- Clean separation of concerns (operations are pure, testable)
- Graphics state isolation via q/Q wrapping
- Sensible defaults for all options
- TypeScript types for all options

### Cons

- No text layout engine (single lines only)
- Limited path building (no fluent API for complex paths)
- SVG path support is basic

---

## PDFBox Approach

### Architecture

```
PDAbstractContentStream (abstract base)
  ├── PDPageContentStream       (page content)
  ├── PDAppearanceContentStream (annotation appearances)
  ├── PDFormContentStream       (Form XObjects)
  └── PDPatternContentStream    (tiling patterns)
```

### Key Files

| File                                       | Purpose                        |
| ------------------------------------------ | ------------------------------ |
| `pdmodel/PDAbstractContentStream.java`     | Base class (1759 lines)        |
| `pdmodel/PDPageContentStream.java`         | Main page drawing API          |
| `pdmodel/PDAppearanceContentStream.java`   | Annotation appearances         |
| `pdmodel/PDResources.java`                 | Resource dictionary management |
| `contentstream/operator/OperatorName.java` | All 73 PDF operators           |

### API Surface (Complete)

PDFBox exposes ALL PDF operators directly:

**Text Operations:**

```java
void beginText()                                    // BT
void endText()                                      // ET
void setFont(PDFont font, float fontSize)           // Tf
void showText(String text)                          // Tj
void showTextWithPositioning(Object[] textArray)   // TJ
void newLineAtOffset(float tx, float ty)            // Td
void setTextMatrix(Matrix matrix)                   // Tm
void setCharacterSpacing(float spacing)             // Tc
void setWordSpacing(float spacing)                  // Tw
```

**Path Operations:**

```java
void moveTo(float x, float y)                       // m
void lineTo(float x, float y)                       // l
void curveTo(float x1, y1, x2, y2, x3, y3)          // c
void addRect(float x, y, width, height)             // re
void closePath()                                    // h
void stroke()                                       // S
void fill()                                         // f
void clip()                                         // W
```

**Image Operations:**

```java
void drawImage(PDImageXObject img, float x, float y)
void drawImage(PDImageXObject img, float x, y, width, height)
void drawImage(PDImageXObject img, Matrix matrix)
void drawForm(PDFormXObject form)                   // Do
```

**Color Operations:**

```java
void setStrokingColor(float r, g, b)                // RG (DeviceRGB)
void setNonStrokingColor(float r, g, b)             // rg
void setStrokingColor(float c, m, y, k)             // K (DeviceCMYK)
void setNonStrokingColor(float gray)                // g (DeviceGray)
void setStrokingColor(PDColor color)                // Handles any color space
```

### State Tracking

PDFBox tracks state to optimize output:

```java
protected boolean inTextMode = false;
protected final Deque<PDFont> fontStack = new ArrayDeque<>();
protected final Deque<PDColorSpace> nonStrokingColorSpaceStack = new ArrayDeque<>();
protected final Deque<PDColorSpace> strokingColorSpaceStack = new ArrayDeque<>();
```

Methods validate state (throws `IllegalStateException` if `beginText()` not called before `showText()`).

### Append Modes

```java
enum AppendMode { OVERWRITE, APPEND, PREPEND }

// Constructor resets graphics state when appending
new PDPageContentStream(doc, page, AppendMode.APPEND, compress, resetContext)
```

### Pros

- Complete PDF operator coverage
- Proper state validation (text mode checks)
- Efficient color space output (only emits CS when it changes)
- Shared base class for page/appearance/form streams

### Cons

- Very low-level (no convenience methods)
- Verbose for common operations
- Manual resource management
- Must call `close()` to finalize

---

## pdf.js Approach

pdf.js is a parser/renderer, not a generator, but its internal representation is instructive.

### Key Files

| File                    | Purpose                                |
| ----------------------- | -------------------------------------- |
| `core/evaluator.js`     | Parses content streams → operator list |
| `core/operator_list.js` | OperatorList structure                 |
| `shared/util.js`        | OPS enum (all operators as numbers)    |
| `display/canvas.js`     | Renders operators to Canvas            |

### Operator Representation

Operators are stored as parallel arrays (efficient for rendering):

```javascript
class OperatorList {
  fnArray = []; // Array of OPS enum values
  argsArray = []; // Array of argument arrays
}

operatorList.addOp(OPS.setFillRGBColor, [r, g, b]);
operatorList.addOp(OPS.fill, []);
```

### OPS Enum

All PDF operators are numbered constants:

```javascript
const OPS = {
  // Graphics state (1-12)
  setLineWidth: 2,
  setLineCap: 3,
  save: 10,
  restore: 11,
  transform: 12,

  // Path (13-30)
  moveTo: 13,
  lineTo: 14,
  curveTo: 15,
  rectangle: 19,
  stroke: 20,
  fill: 22,

  // Text (31-49)
  beginText: 31,
  endText: 32,
  setFont: 37,
  showText: 44,

  // Color (50-61)
  setFillRGBColor: 59,
  setStrokeRGBColor: 58,

  // XObjects (62-93)
  paintXObject: 66,
  paintImageXObject: 85,
};
```

### Graphics State

```javascript
class EvalState {
  ctm = new Float32Array(IDENTITY_MATRIX);
  font = null;
  textRenderingMode = TextRenderingMode.FILL;
  _fillColorSpace = ColorSpaceUtils.gray;
  _strokeColorSpace = ColorSpaceUtils.gray;
}
```

### Insights for Generation

- Numeric operator IDs are efficient for rendering but overkill for generation
- Parallel arrays are good for serialization (can iterate fnArray and argsArray together)
- State tracking is essential for optimization

---

## Current @libpdf/core Infrastructure

### What We Have

| Component                 | Location                        | Purpose                            |
| ------------------------- | ------------------------------- | ---------------------------------- |
| `Operator` class          | `src/content/operators.ts`      | Single operator with args          |
| Operator factories        | `src/helpers/operators.ts`      | All PDF operators as functions     |
| `ContentStreamBuilder`    | `src/content/content-stream.ts` | Builds operator arrays → bytes     |
| `ContentStreamSerializer` | `src/content/parsing/`          | Serializes operators to PDF syntax |
| `PDFPage.drawPage()`      | `src/api/pdf-page.ts`           | Only drawing method so far         |

### Existing Operator Factories

We already have comprehensive operator factories in `helpers/operators.ts`:

```typescript
// Graphics state
pushGraphicsState(), popGraphicsState(), concatMatrix(), setLineWidth(), ...

// Path
moveTo(), lineTo(), curveTo(), rectangle(), closePath()

// Painting
stroke(), fill(), fillAndStroke(), clip(), ...

// Text
beginText(), endText(), setFont(), showText(), setTextMatrix(), ...

// Color
setStrokingRGB(), setNonStrokingRGB(), setStrokingCMYK(), setNonStrokingGray(), ...

// XObjects
drawXObject()
```

### Current drawPage Implementation

```typescript
drawPage(embedded: PDFEmbeddedPage, options: DrawPageOptions = {}): void {
  // Manual string building (should use ContentStreamBuilder)
  const ops: string[] = [];
  ops.push("q");

  if (options.opacity !== undefined) {
    const gsName = this.addGraphicsState({ ca: options.opacity, CA: options.opacity });
    ops.push(`/${gsName} gs`);
  }

  ops.push(`${scaleX} 0 0 ${scaleY} ${x} ${y} cm`);
  ops.push(`/${xobjectName} Do`);
  ops.push("Q");

  this.appendContent(ops.join("\n"));
}
```

---

## Recommendations for @libpdf/core

### 1. Architecture

Adopt pdf-lib's layered approach, building on our existing infrastructure:

```
┌─────────────────────────────────────────────────────────────────┐
│  PDFPage.drawText(), drawImage(), drawRect(), drawLine(), etc. │
├─────────────────────────────────────────────────────────────────┤
│  Operations (pure functions): drawTextOps(), drawImageOps()    │
│  (new file: src/api/operations.ts)                             │
├─────────────────────────────────────────────────────────────────┤
│  Operator factories (existing): src/helpers/operators.ts       │
├─────────────────────────────────────────────────────────────────┤
│  ContentStreamBuilder (existing): src/content/content-stream.ts│
└─────────────────────────────────────────────────────────────────┘
```

### 2. PDFPage Drawing Methods

Add these methods to `PDFPage`:

```typescript
// Text
drawText(text: string, options?: DrawTextOptions): void

// Images
drawImage(image: PDFImage, options?: DrawImageOptions): void

// Shapes
drawLine(options: DrawLineOptions): void
drawRectangle(options: DrawRectangleOptions): void
drawEllipse(options?: DrawEllipseOptions): void
drawCircle(options?: DrawCircleOptions): void

// Paths (fluent builder)
drawPath(): PathBuilder  // Returns builder with moveTo/lineTo/curveTo/close/stroke/fill
```

### 3. Operations Layer

Create pure functions that return `Operator[]`:

```typescript
// src/api/operations.ts
export function drawTextOps(text: PdfString, options: DrawTextOpsOptions): Operator[] {
  return [
    pushGraphicsState(),
    options.graphicsState && setGraphicsState(options.graphicsState),
    beginText(),
    setFont(options.fontName, options.fontSize),
    setNonStrokingRGB(options.color.r, options.color.g, options.color.b),
    setTextMatrix(1, 0, 0, 1, options.x, options.y),
    showText(text),
    endText(),
    popGraphicsState(),
  ].filter(Boolean) as Operator[];
}

export function drawImageOps(xobjectName: string, options: DrawImageOpsOptions): Operator[] {
  return [
    pushGraphicsState(),
    options.graphicsState && setGraphicsState(options.graphicsState),
    concatMatrix(options.width, 0, 0, options.height, options.x, options.y),
    drawXObject(xobjectName),
    popGraphicsState(),
  ].filter(Boolean) as Operator[];
}
```

### 4. Resource Management

Add resource registration methods to `PDFPage`:

```typescript
class PDFPage {
  private fontCounter = 0;
  private imageCounter = 0;
  private gsCounter = 0;

  addFontResource(fontRef: PdfRef): string {
    const name = `F${++this.fontCounter}`;
    // Add to /Resources/Font
    return name;
  }

  addImageResource(imageRef: PdfRef): string {
    const name = `Im${++this.imageCounter}`;
    // Add to /Resources/XObject
    return name;
  }

  addGraphicsState(options: { ca?: number; CA?: number; BM?: string }): string {
    const name = `GS${++this.gsCounter}`;
    // Add to /Resources/ExtGState
    return name;
  }
}
```

### 5. Image Embedding

Need a `PDFImage` class that:

- Parses JPEG/PNG into PDF image XObject
- Handles color space detection
- Supports alpha channel (via SMask)
- Provides dimensions for scaling

### 6. Text Measurement

Fonts need a `measureText()` method for layout:

```typescript
interface PDFFont {
  encodeText(text: string): PdfString; // Already have via font embedding
  measureText(text: string, fontSize: number): { width: number; height: number };
}
```

### 7. Color Types

Create color factory functions:

```typescript
// src/api/colors.ts
export type Color = RGB | CMYK | Grayscale;

export const rgb = (r: number, g: number, b: number): RGB => ({ type: 'rgb', r, g, b });
export const cmyk = (c: number, m: number, y: number, k: number): CMYK => ({ type: 'cmyk', c, m, y, k });
export const grayscale = (gray: number): Grayscale => ({ type: 'gray', gray });

export function toFillOperator(color: Color): Operator { ... }
export function toStrokeOperator(color: Color): Operator { ... }
```

### 8. Options Interfaces

```typescript
interface DrawTextOptions {
  x?: number;
  y?: number;
  font?: PDFFont;
  size?: number;
  color?: Color;
  opacity?: number;
  rotate?: Rotation;
}

interface DrawImageOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  opacity?: number;
  rotate?: Rotation;
}

interface DrawRectangleOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  color?: Color; // Fill color
  borderColor?: Color; // Stroke color
  borderWidth?: number;
  opacity?: number;
  borderOpacity?: number;
}
```

---

## Implementation Order

1. **Colors module** - Simple, foundational
2. **Image embedding** - JPEG first (simple), then PNG
3. **PDFPage.drawImage()** - Uses image embedding
4. **Text measurement** - Add to font system
5. **PDFPage.drawText()** - Uses font measurement
6. **Shape methods** - drawRectangle, drawLine, drawEllipse, drawCircle
7. **Path builder** - Fluent API for complex paths

---

## Edge Cases to Handle

1. **Coordinate system** - PDF origin is bottom-left, users may expect top-left
2. **Text encoding** - Must use font's encoding (we already handle this)
3. **Color space inheritance** - Should set color space explicitly to avoid inheritance issues
4. **Rotation pivot** - Rotate around origin vs. center of object
5. **Existing content** - Append vs prepend (background layers)
6. **Resource name conflicts** - Ensure unique names when adding to existing pages
7. **Font subsetting** - Track glyphs used for later subsetting

---

## References

- pdf-lib: `checkouts/pdf-lib/src/api/PDFPage.ts`, `operations.ts`, `operators.ts`
- PDFBox: `checkouts/pdfbox/pdfbox/src/main/java/org/apache/pdfbox/pdmodel/PDAbstractContentStream.java`
- pdf.js: `checkouts/pdfjs/src/core/evaluator.js`, `shared/util.js`
