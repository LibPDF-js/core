# SVG Path Support

## Problem Statement

Users want to draw SVG path data onto PDF pages. A common use case is sewing patterns and technical drawings stored as SVG that need to be rendered to PDF.

**User request from Reddit:**

> I am currently using both PDFKit and pdfjs to create printable sewing patterns from SVG data. I currently have to take all my SVG path data, put it into an A0 PDF, load that PDF into a canvas element, then chop up the canvas image data into US letter sizes.

## Goals

1. Parse SVG path `d` attribute strings and render them via `PathBuilder`
2. Support all SVG path commands (M, L, H, V, C, S, Q, T, A, Z) in both absolute and relative forms
3. Integrate cleanly with existing `PathBuilder` API
4. Flip the Y-axis by default so raw SVG coordinates map correctly into PDF space (with an opt-out)

## Non-Goals

- Full SVG document parsing (elements like `<text>`, `<image>`, `<use>`, CSS, filters)
- SVG transforms (users can apply PDF transforms separately)
- SVG units conversion (assume unitless = points, like the rest of our API)
- Page tiling/splitting (users handle this themselves with our primitives)

## Scope

**In scope:**

- SVG path `d` string parser
- All path commands: M, m, L, l, H, h, V, v, C, c, S, s, Q, q, T, t, A, a, Z, z
- Arc-to-bezier conversion for the `A` command
- `PathBuilder.appendSvgPath()` instance method
- `PDFPage.drawSvgPath()` convenience method

**Out of scope:**

- Helper to extract paths from SVG documents (maybe later as a separate utility)
- Viewbox/coordinate system transforms
- Stroke/fill style parsing from SVG attributes

---

## Desired Usage

### Basic: Draw SVG path data

```typescript
// Convenience method on PDFPage - fill by default
page.drawSvgPath("M 10 10 L 100 10 L 100 100 Z", {
  color: rgb(1, 0, 0),
});

// With stroke
page.drawSvgPath("M 10 10 C 20 20, 40 20, 50 10", {
  borderColor: rgb(0, 0, 0),
  borderWidth: 2,
});
```

### Using PathBuilder for more control

```typescript
// When you need to choose fill vs stroke explicitly
page
  .drawPath()
  .appendSvgPath("M 10 10 L 100 10 L 100 100 Z")
  .stroke({ borderColor: rgb(0, 0, 0) });
```

### Chaining with existing PathBuilder methods

```typescript
page
  .drawPath()
  .moveTo(0, 0)
  .appendSvgPath("l 50 50 c 10 10 20 20 30 10") // relative commands continue from current point
  .lineTo(200, 200)
  .close()
  .stroke();
```

### Complex paths (sewing patterns, icons)

```typescript
// Heart shape
page
  .drawPath()
  .appendSvgPath("M 10,30 A 20,20 0,0,1 50,30 A 20,20 0,0,1 90,30 Q 90,60 50,90 Q 10,60 10,30 Z")
  .fill({ color: rgb(1, 0, 0) });

// Multiple subpaths
page
  .drawPath()
  .appendSvgPath("M 0 0 L 100 0 L 100 100 L 0 100 Z M 25 25 L 75 25 L 75 75 L 25 75 Z")
  .fill({ windingRule: "evenodd" }); // Creates a square with a square hole
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  PathBuilder.fromSvgPath() / .appendSvgPath()               │
│  (Entry points - high-level API)                            │
├─────────────────────────────────────────────────────────────┤
│  src/svg/path-parser.ts                                     │
│  (Parse d string → command objects)                         │
├─────────────────────────────────────────────────────────────┤
│  src/svg/path-executor.ts                                   │
│  (Execute commands via callback interface)                  │
│  - Handles relative → absolute conversion                   │
│  - Handles smooth curve reflection                          │
│  - Handles arc → bezier conversion                          │
├─────────────────────────────────────────────────────────────┤
│  PathBuilder (existing)                                     │
│  (moveTo, lineTo, curveTo, quadraticCurveTo, close)         │
└─────────────────────────────────────────────────────────────┘
```

The `src/svg/` module is intentionally decoupled from `PathBuilder`. The executor takes a callback interface, so it can drive any path-building target (PathBuilder, canvas, testing, etc.).

### New Files

| File                       | Purpose                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------- |
| `src/svg/path-parser.ts`   | Tokenize and parse SVG path `d` strings into command objects                       |
| `src/svg/path-executor.ts` | Execute parsed commands with state tracking (relative coords, smooth curves, arcs) |
| `src/svg/arc-to-bezier.ts` | Arc endpoint → center parameterization and bezier approximation                    |
| `src/svg/index.ts`         | Public exports                                                                     |

### Modified Files

| File                              | Changes                                 |
| --------------------------------- | --------------------------------------- |
| `src/api/drawing/path-builder.ts` | Add `appendSvgPath()` instance method   |
| `src/api/pdf-page.ts`             | Add `drawSvgPath()` convenience method  |
| `src/index.ts`                    | Export svg utilities for advanced users |

---

## SVG Path Command Reference

| Command | Parameters                      | Description      | PathBuilder equivalent                        |
| ------- | ------------------------------- | ---------------- | --------------------------------------------- |
| M/m     | x y                             | Move to          | `moveTo(x, y)`                                |
| L/l     | x y                             | Line to          | `lineTo(x, y)`                                |
| H/h     | x                               | Horizontal line  | `lineTo(x, currentY)`                         |
| V/v     | y                               | Vertical line    | `lineTo(currentX, y)`                         |
| C/c     | x1 y1 x2 y2 x y                 | Cubic bezier     | `curveTo(...)`                                |
| S/s     | x2 y2 x y                       | Smooth cubic     | Reflect last CP, then `curveTo(...)`          |
| Q/q     | x1 y1 x y                       | Quadratic bezier | `quadraticCurveTo(...)`                       |
| T/t     | x y                             | Smooth quadratic | Reflect last CP, then `quadraticCurveTo(...)` |
| A/a     | rx ry angle large-arc sweep x y | Elliptical arc   | Convert to bezier curves                      |
| Z/z     | (none)                          | Close path       | `close()`                                     |

**Lowercase = relative coordinates** (offset from current point)
**Uppercase = absolute coordinates**

---

## Test Plan

### Unit Tests

**Parser tests (`src/svg/path-parser.test.ts`):**

- Basic commands: M, L, H, V, C, Q, Z
- Relative commands: m, l, h, v, c, q, z
- Smooth curves: S, s, T, t
- Arcs: A, a (various flag combinations)
- Number formats: integers, decimals, negative, scientific notation
- Whitespace variations: spaces, commas, no separators
- Repeated commands (implicit repetition)
- Invalid input handling (malformed paths)

**Executor tests (`src/svg/path-executor.test.ts`):**

- Relative to absolute conversion
- Smooth curve control point reflection
- Arc to bezier conversion accuracy
- State tracking across commands

**Arc conversion tests (`src/svg/arc-to-bezier.test.ts`):**

- Various arc flag combinations (large-arc, sweep)
- Degenerate cases (zero radii, same start/end point)
- Accuracy of bezier approximation

### Integration Tests

**PathBuilder integration:**

- `fromSvgPath()` produces correct operators
- `appendSvgPath()` continues from current point
- Chaining with other PathBuilder methods
- Complex real-world paths (icons, shapes)

### Visual Tests

- Generate PDFs with various SVG paths
- Compare with SVG rendered in browser
- Test paths from real-world sources (Font Awesome icons, map data)

### Edge Cases

- Empty path string
- Path with only M command (no drawing)
- Very large coordinates
- Very small arc radii (degenerate to line)
- Zero-length arcs
- Arcs with rx=0 or ry=0 (should become lines per SVG spec)

---

## Open Questions

1. **Error handling**: Should malformed paths throw or silently skip bad commands?

- **Recommendation**: Skip bad commands with console warning, continue parsing. Matches browser behavior.

2. **Coordinate precision**: Should we round coordinates?

- **Recommendation**: No rounding, preserve full precision. PDF handles it fine.

---

## Future Enhancements (Not in this plan)

- `parseSvgPaths(svgDocument: string)`: Extract `<path>` elements with basic styles
- Transform parsing (`transform` attribute)
- Style extraction (`fill`, `stroke`, `stroke-width` attributes)
- Support for other SVG shape elements (`<rect>`, `<circle>`, `<ellipse>`, `<polygon>`)
