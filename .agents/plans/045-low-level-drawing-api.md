# Plan 045: Low-Level Drawing API

## Problem

We have robust drawing internals (operators, Matrix class, graphics state) but they're not exposed publicly. Users who need advanced control—matrix transforms, graphics state stack, gradients, patterns—can't access these primitives. This limits our ability to support:

- Libraries that need low-level PDF generation (like svg2pdf)
- Power users building custom rendering pipelines
- Future packages like a Canvas2D-compatible layer (`@libpdf/canvas`)

## Goals

1. Expose PDF operators as a public API
2. Add resource registration methods for use with raw operators
3. Add shading (gradient) and pattern support
4. Expose the Matrix class for transform composition
5. Lay groundwork for a future `@libpdf/canvas` package

## Non-Goals

- Implementing the Canvas2D package itself (future work)
- High-level gradient/pattern helpers on existing draw methods (can add later)
- Backwards-incompatible changes to existing API
- Validation of operator sequences (caller responsibility)

## Design Decisions

1. **No validation in `drawOperators`** - caller is responsible for valid operator sequences
2. **No raw `appendContentStream`** - keep API typed via `drawOperators`
3. **`registerXXX` naming** - consistent pattern for all resource registration methods
4. **Operators accept names with or without slash** - `/F1` and `F1` both work, normalized internally
5. **Text operators accept string | PdfString** - strings auto-encoded via `PdfString.fromString()` (picks optimal encoding)
6. **Gradient coordinates in user space** - matches PDF spec; gradients stay fixed, shapes reveal them
7. **Resource deduplication by instance** - same object registered twice returns same name
8. **Pattern paint callbacks are synchronous** - resources must be pre-embedded
9. **Batch operator emission only** - `drawOperators([...])`, no streaming append
10. **PathBuilder remains separate** - different abstraction level from raw operators

---

## Desired Usage

### Raw Operators

```typescript
import { PDF, ops } from "@libpdf/core";

const pdf = await PDF.create();
const page = pdf.addPage();

page.drawOperators([
  ops.pushGraphicsState(),
  ops.concatMatrix(1, 0, 0, 1, 100, 200), // translate
  ops.setNonStrokingRGB(1, 0, 0),
  ops.rectangle(0, 0, 50, 50),
  ops.fill(),
  ops.popGraphicsState(),
]);
```

### Resource Registration

```typescript
const font = await pdf.embedFont(fontBytes);
const image = await pdf.embedImage(imageBytes);

// Register resources on page, get operator names
const fontName = page.registerFont(font); // "F0"
const imageName = page.registerImage(image); // "Im0"

// Names work with or without slash prefix
page.drawOperators([
  ops.beginText(),
  ops.setFont(fontName, 12), // "F0" works
  ops.setFont("/F0", 12), // "/F0" also works
  ops.moveText(100, 700),
  ops.showText("Hello"), // string auto-encoded
  ops.endText(),
  ops.pushGraphicsState(),
  ops.concatMatrix(100, 0, 0, 100, 200, 500),
  ops.paintXObject(imageName),
  ops.popGraphicsState(),
]);
```

### Matrix Transforms

```typescript
import { Matrix, ops } from "@libpdf/core";

// Compose transforms using Matrix class
const transform = Matrix.identity().translate(100, 200).rotate(45).scale(2, 2);

page.drawOperators([
  ops.pushGraphicsState(),
  ops.concatMatrix(...transform.toArray()), // [a, b, c, d, e, f]
  // ... drawing operations
  ops.popGraphicsState(),
]);

// Or use concatMatrix directly with Matrix
page.drawOperators([
  ops.concatMatrix(transform), // accepts Matrix or 6 numbers
]);
```

### Gradients (Shading)

```typescript
// Low-level: explicit coordinates
const gradient = pdf.createAxialShading({
  coords: [0, 0, 100, 0], // x0, y0, x1, y1
  stops: [
    { offset: 0, color: rgb(1, 0, 0) },
    { offset: 0.5, color: rgb(0, 1, 0) },
    { offset: 1, color: rgb(0, 0, 1) },
  ],
});

// Convenience: angle-based (CSS convention)
const horizontalGradient = pdf.createLinearGradient({
  angle: 90, // CSS convention: 0 = up, 90 = right, 180 = down, 270 = left
  length: 100,
  stops: [
    { offset: 0, color: rgb(1, 0, 0) },
    { offset: 1, color: rgb(0, 0, 1) },
  ],
});

const shadingName = page.registerShading(gradient);

page.drawOperators([
  ops.pushGraphicsState(),
  ops.rectangle(50, 50, 100, 100),
  ops.clip(),
  ops.endPath(),
  ops.paintShading(shadingName),
  ops.popGraphicsState(),
]);
```

### Radial Gradients

```typescript
const radial = pdf.createRadialShading({
  coords: [50, 50, 0, 50, 50, 50], // x0, y0, r0, x1, y1, r1
  stops: [
    { offset: 0, color: rgb(1, 1, 1) },
    { offset: 1, color: rgb(0, 0, 0) },
  ],
  extend: [true, true], // extend beyond start/end circles
});
```

### Patterns

```typescript
const pattern = pdf.createTilingPattern({
  bbox: [0, 0, 10, 10],
  xStep: 10,
  yStep: 10,
  paint: ctx => {
    ctx.drawOperators([
      ops.setNonStrokingRGB(0.8, 0.8, 0.8),
      ops.rectangle(0, 0, 5, 5),
      ops.fill(),
    ]);
  },
});

const patternName = page.registerPattern(pattern);

page.drawOperators([
  ops.setNonStrokingColorSpace(ColorSpace.Pattern),
  ops.setNonStrokingColorN(patternName),
  ops.rectangle(100, 100, 200, 200),
  ops.fill(),
]);
```

### Extended Graphics State

```typescript
const gs = pdf.createExtGState({
  fillOpacity: 0.5,
  strokeOpacity: 0.8,
  blendMode: "Multiply",
});

const gsName = page.registerExtGState(gs);

page.drawOperators([
  ops.pushGraphicsState(),
  ops.setGraphicsState(gsName),
  ops.setNonStrokingRGB(1, 0, 0),
  ops.rectangle(100, 100, 50, 50),
  ops.fill(),
  ops.popGraphicsState(),
]);
```

### Form XObjects (Reusable Content)

```typescript
// Create a reusable content group
const stamp = pdf.createFormXObject({
  bbox: [0, 0, 100, 50],
  paint: ctx => {
    ctx.drawOperators([
      ops.setNonStrokingRGB(1, 0, 0),
      ops.rectangle(0, 0, 100, 50),
      ops.fill(),
      ops.setNonStrokingRGB(1, 1, 1),
      ops.beginText(),
      ops.setFont("Helvetica", 12),
      ops.moveText(10, 20),
      ops.showText("DRAFT"),
      ops.endText(),
    ]);
  },
});

// Use on multiple pages
for (const page of pdf.getPages()) {
  const name = page.registerXObject(stamp);
  page.drawOperators([
    ops.pushGraphicsState(),
    ops.concatMatrix(1, 0, 0, 1, 200, 700),
    ops.paintXObject(name),
    ops.popGraphicsState(),
  ]);
}
```

---

## Architecture

### Public Exports

The library should export:

- **`ops` namespace** — all PDF operators as factory functions
- **`Matrix` class** — for composing transforms before passing to operators
- **`ColorSpace` constants** — DeviceGray, DeviceRGB, DeviceCMYK, Pattern
- **Types** — PDFShading, PDFPattern, PDFExtGState, PDFFormXObject, and their option types

### PDFPage Additions

New methods on PDFPage:

- **`drawOperators(operators[])`** — emits raw operators to page content stream
- **`registerFont(font)`** — registers font, returns operator name (e.g., "F0")
- **`registerImage(image)`** — registers image, returns name
- **`registerShading(shading)`** — registers shading, returns name
- **`registerPattern(pattern)`** — registers pattern, returns name
- **`registerExtGState(state)`** — registers graphics state, returns name
- **`registerXObject(xobject)`** — registers form XObject, returns name

### PDF Class Additions

New factory methods on PDF. Each creates a PDF object, adds it to the document's object table, and returns a wrapper holding the ref:

- **`createAxialShading(options)`** — creates linear gradient with explicit coordinates
- **`createRadialShading(options)`** — creates radial gradient
- **`createLinearGradient(options)`** — convenience method using angle instead of coordinates
- **`createTilingPattern(options)`** — creates repeating pattern
- **`createExtGState(options)`** — creates extended graphics state (opacity, blend mode)
- **`createFormXObject(options)`** — creates reusable content group

The returned wrapper types (PDFShading, PDFPattern, etc.) hold a ref internally. When passed to `page.registerX()`, the ref is added to the page's resource dictionary.

### Operator Behavior

- **Name normalization**: Operators that take resource names (setFont, setGraphicsState, paintXObject, etc.) should accept names with or without the leading slash — "F0" and "/F0" both work
- **Text encoding**: showText should accept plain strings (auto-encoded via PdfString.fromString) or PdfString instances
- **Matrix overload**: concatMatrix should accept either a Matrix instance or 6 individual numbers

### Matrix Class

The Matrix class should support:

- Static factories: `identity()`, `translate()`, `scale()`, `rotate()`
- Instance methods for chaining: `translate()`, `scale()`, `rotate()`, `multiply()`
- Conversion: `toArray()` returning `[a, b, c, d, e, f]` for use with concatMatrix

### Pattern and FormXObject Contexts

When creating patterns or form XObjects, the paint callback receives a context object that allows:

- Emitting operators via `drawOperators()`
- Registering resources scoped to that pattern/XObject

Resources (fonts, images, etc.) must be embedded on the PDF before being used in the paint callback.

---

## Implementation Notes

### Shading Functions

PDF shadings require Function objects to define color interpolation. For gradients with two stops, a simple exponential interpolation function suffices. Multi-stop gradients require stitching multiple functions together. This complexity should be hidden from users — they just provide a stops array.

### Pattern Resources

Patterns have their own resource dictionaries. Resources used within a pattern must be registered on the pattern's context, not the page.

### Resource Deduplication

The same resource object registered multiple times on the same page should return the same name. Different pages may assign different names to the same underlying resource.

### Coordinate System

All operators use PDF coordinates (Y-up, origin bottom-left). No automatic coordinate transformation is performed. A future `@libpdf/canvas` package would handle the Y-flip for Canvas2D compatibility.

### Error Handling

- Invalid operator sequences produce invalid PDFs (caller responsibility)
- Missing resources cause PDF viewer errors at render time
- TypeScript catches type errors at compile time

---

## Future: @libpdf/canvas

This API lays the groundwork for a future `@libpdf/canvas` package that would provide a Canvas2D-compatible interface. Such a package would:

- Implement the CanvasRenderingContext2D interface
- Internally use `page.drawOperators()` and `page.register*()` methods
- Handle the Y-flip coordinate transform automatically

The core API additions here provide exactly the primitives that package would need.

---

## Test Plan

### Unit Tests

- Operator emission produces valid PDF content streams
- Resource registration returns unique names per page
- Same resource registered twice returns same name (deduplication)
- Name normalization works (with/without slash)
- Matrix class composes transforms correctly
- concatMatrix accepts Matrix or 6 numbers
- showText accepts string or PdfString

### Integration Tests (with PDF output)

These tests generate PDF files in `fixtures/output/` for visual verification:

- `low-level-operators.pdf` — basic operator emission (rectangles, colors, transforms)
- `axial-shading.pdf` — linear gradients with 2 and multiple stops
- `radial-shading.pdf` — radial gradients with various configurations
- `linear-gradient-angles.pdf` — angle-based convenience method at 0°, 45°, 90°, 180°
- `tiling-patterns.pdf` — repeating patterns with different step sizes
- `extgstate-opacity.pdf` — overlapping shapes with varying opacity
- `extgstate-blend-modes.pdf` — blend mode examples (Multiply, Screen, Overlay)
- `form-xobjects.pdf` — reusable content stamped at multiple positions
- `combined-features.pdf` — complex drawing using all features together

### Visual Verification

For visual inspection during development or debugging, convert PDF output to PNG using ImageMagick:

```bash
# Convert single PDF to PNG (300 DPI)
magick -density 300 test-output/axial-shading.pdf -quality 100 test-output/axial-shading.png

# Convert specific page of multi-page PDF
magick -density 300 "test-output/form-xobjects.pdf[0]" test-output/form-xobjects-page1.png
```

The PNG files are gitignored but useful for:

- Agent-assisted visual verification during implementation
- Debugging rendering issues
- Comparing output across changes

### Manual Verification

Final verification should include opening test PDFs in:

- Adobe Acrobat Reader
- Chrome's built-in PDF viewer
- macOS Preview

---

## Implementation Order

1. **Exports and basics** — expose ops namespace, Matrix class, ColorSpace constants
2. **Operator improvements** — name normalization, string overload for showText, Matrix overload for concatMatrix
3. **Core emission** — page.drawOperators() method
4. **Resource registration** — page.registerFont/Image/ExtGState methods (expose existing internals)
5. **Shading support** — createAxialShading, createRadialShading, createLinearGradient, registerShading
6. **Pattern support** — createTilingPattern, registerPattern
7. **Form XObjects** — createFormXObject, registerXObject
