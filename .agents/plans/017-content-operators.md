# Plan 017: Content Stream Operators

## Overview

Implement a type-safe API for building PDF content streams. This is a prerequisite for form appearance generation, flattening, and future page content manipulation.

## Motivation

Content streams are sequences of operators with operands:

```
q                    % Push graphics state
1 0 0 1 10 20 cm     % Concat matrix
BT                   % Begin text
/Helv 12 Tf          % Set font
(Hello) Tj           % Show text
ET                   % End text
Q                    % Pop graphics state
```

Rather than string concatenation (error-prone), we need a typed API.

## Design Goals

1. **Type-safe** - Operator names as enum, operands validated
2. **Immutable** - Operators created via factory functions
3. **Composable** - Higher-level operations return operator arrays
4. **Efficient** - Direct serialization to bytes

## Research Summary

| Library | Approach                                                  |
| ------- | --------------------------------------------------------- |
| pdf.js  | Numeric enum (`OPS`), parallel arrays for operands        |
| PDFBox  | String constants + fluent builder with state tracking     |
| pdf-lib | TypeScript enum + `PDFOperator` class + factory functions |

We'll follow pdf-lib's pattern (most TypeScript-friendly) but keep it simpler.

## API Design

### Operator Enum

```typescript
// src/content/operators.ts

/** All PDF content stream operator names */
export enum Op {
  // Graphics state (Table 57)
  PushGraphicsState = "q",
  PopGraphicsState = "Q",
  ConcatMatrix = "cm",
  SetLineWidth = "w",
  SetLineCap = "J",
  SetLineJoin = "j",
  SetMiterLimit = "M",
  SetDashPattern = "d",
  SetRenderingIntent = "ri",
  SetFlatness = "i",
  SetGraphicsState = "gs",

  // Path construction (Table 59)
  MoveTo = "m",
  LineTo = "l",
  CurveTo = "c",
  CurveToInitial = "v",
  CurveToFinal = "y",
  ClosePath = "h",
  Rectangle = "re",

  // Path painting (Table 60)
  Stroke = "S",
  CloseAndStroke = "s",
  Fill = "f",
  FillCompat = "F",
  FillEvenOdd = "f*",
  FillAndStroke = "B",
  FillAndStrokeEvenOdd = "B*",
  CloseFillAndStroke = "b",
  CloseFillAndStrokeEvenOdd = "b*",
  EndPath = "n",

  // Clipping (Table 61)
  Clip = "W",
  ClipEvenOdd = "W*",

  // Text state (Table 105)
  SetCharSpacing = "Tc",
  SetWordSpacing = "Tw",
  SetHorizontalScale = "Tz",
  SetLeading = "TL",
  SetFont = "Tf",
  SetTextRenderMode = "Tr",
  SetTextRise = "Ts",

  // Text positioning (Table 106)
  BeginText = "BT",
  EndText = "ET",
  MoveText = "Td",
  MoveTextSetLeading = "TD",
  SetTextMatrix = "Tm",
  NextLine = "T*",

  // Text showing (Table 107)
  ShowText = "Tj",
  ShowTextArray = "TJ",
  MoveAndShowText = "'",
  MoveSetSpacingShowText = '"',

  // Color (Tables 74, 75)
  SetStrokingColorSpace = "CS",
  SetNonStrokingColorSpace = "cs",
  SetStrokingColor = "SC",
  SetStrokingColorN = "SCN",
  SetNonStrokingColor = "sc",
  SetNonStrokingColorN = "scn",
  SetStrokingGray = "G",
  SetNonStrokingGray = "g",
  SetStrokingRGB = "RG",
  SetNonStrokingRGB = "rg",
  SetStrokingCMYK = "K",
  SetNonStrokingCMYK = "k",

  // XObjects (Table 87)
  DrawXObject = "Do",

  // Marked content (Table 320)
  DesignateMarkedContentPoint = "MP",
  DesignateMarkedContentPointProps = "DP",
  BeginMarkedContent = "BMC",
  BeginMarkedContentProps = "BDC",
  EndMarkedContent = "EMC",

  // Shading
  PaintShading = "sh",

  // Inline images
  BeginInlineImage = "BI",
  BeginInlineImageData = "ID",
  EndInlineImage = "EI",
}
```

### Operator Class

```typescript
// src/content/operators.ts

/** Valid operand types */
export type Operand = number | string | PdfName | PdfString | PdfArray | PdfDict;

/**
 * A single content stream operator with its operands.
 * Immutable - create via factory functions.
 */
export class Operator {
  private constructor(
    readonly op: Op,
    readonly operands: readonly Operand[],
  ) {}

  /**
   * Create an operator with operands.
   */
  static of(op: Op, ...operands: Operand[]): Operator {
    return new Operator(op, Object.freeze([...operands]));
  }

  /**
   * Serialize to PDF content stream syntax.
   * Format: "operand1 operand2 ... operator"
   */
  toString(): string {
    if (this.operands.length === 0) {
      return this.op;
    }
    const parts = this.operands.map(formatOperand);
    parts.push(this.op);
    return parts.join(" ");
  }

  /**
   * Get byte length when serialized (for pre-allocation).
   */
  byteLength(): number {
    return this.toString().length;
  }
}

/**
 * Format an operand for content stream output.
 */
function formatOperand(op: Operand): string {
  if (typeof op === "number") {
    return formatNumber(op);
  }
  if (typeof op === "string") {
    // Assume already formatted (e.g., "/FontName")
    return op;
  }
  if (op instanceof PdfName) {
    return op.toString();
  }
  if (op instanceof PdfString) {
    return op.toString();
  }
  if (op instanceof PdfArray) {
    return op.toString();
  }
  if (op instanceof PdfDict) {
    return op.toString();
  }
  throw new Error(`Unknown operand type: ${op}`);
}

/**
 * Format a number for PDF output.
 * - Integers: no decimal point
 * - Floats: minimal decimal places, no trailing zeros
 */
function formatNumber(n: number): string {
  if (Number.isInteger(n)) {
    return n.toString();
  }
  // Limit precision to avoid floating point noise
  const s = n.toFixed(6);
  // Remove trailing zeros and unnecessary decimal point
  return s.replace(/\.?0+$/, "");
}
```

### Factory Functions

```typescript
// src/content/operators.ts (continued)

// ============= Graphics State =============

export const pushGraphicsState = () => Operator.of(Op.PushGraphicsState);
export const popGraphicsState = () => Operator.of(Op.PopGraphicsState);

export const concatMatrix = (a: number, b: number, c: number, d: number, e: number, f: number) =>
  Operator.of(Op.ConcatMatrix, a, b, c, d, e, f);

export const setLineWidth = (width: number) => Operator.of(Op.SetLineWidth, width);

export const setLineCap = (cap: 0 | 1 | 2) => Operator.of(Op.SetLineCap, cap);

export const setLineJoin = (join: 0 | 1 | 2) => Operator.of(Op.SetLineJoin, join);

export const setGraphicsState = (name: string) => Operator.of(Op.SetGraphicsState, name);

// ============= Path Construction =============

export const moveTo = (x: number, y: number) => Operator.of(Op.MoveTo, x, y);

export const lineTo = (x: number, y: number) => Operator.of(Op.LineTo, x, y);

export const curveTo = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) =>
  Operator.of(Op.CurveTo, x1, y1, x2, y2, x3, y3);

export const closePath = () => Operator.of(Op.ClosePath);

export const rectangle = (x: number, y: number, width: number, height: number) =>
  Operator.of(Op.Rectangle, x, y, width, height);

// ============= Path Painting =============

export const stroke = () => Operator.of(Op.Stroke);
export const closeAndStroke = () => Operator.of(Op.CloseAndStroke);
export const fill = () => Operator.of(Op.Fill);
export const fillEvenOdd = () => Operator.of(Op.FillEvenOdd);
export const fillAndStroke = () => Operator.of(Op.FillAndStroke);
export const endPath = () => Operator.of(Op.EndPath);

// ============= Clipping =============

export const clip = () => Operator.of(Op.Clip);
export const clipEvenOdd = () => Operator.of(Op.ClipEvenOdd);

// ============= Text State =============

export const setCharSpacing = (spacing: number) => Operator.of(Op.SetCharSpacing, spacing);

export const setWordSpacing = (spacing: number) => Operator.of(Op.SetWordSpacing, spacing);

export const setHorizontalScale = (scale: number) => Operator.of(Op.SetHorizontalScale, scale);

export const setLeading = (leading: number) => Operator.of(Op.SetLeading, leading);

export const setFont = (name: string, size: number) => Operator.of(Op.SetFont, name, size);

export const setTextRenderMode = (mode: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7) =>
  Operator.of(Op.SetTextRenderMode, mode);

export const setTextRise = (rise: number) => Operator.of(Op.SetTextRise, rise);

// ============= Text Positioning =============

export const beginText = () => Operator.of(Op.BeginText);
export const endText = () => Operator.of(Op.EndText);

export const moveText = (tx: number, ty: number) => Operator.of(Op.MoveText, tx, ty);

export const moveTextSetLeading = (tx: number, ty: number) =>
  Operator.of(Op.MoveTextSetLeading, tx, ty);

export const setTextMatrix = (a: number, b: number, c: number, d: number, e: number, f: number) =>
  Operator.of(Op.SetTextMatrix, a, b, c, d, e, f);

export const nextLine = () => Operator.of(Op.NextLine);

// ============= Text Showing =============

export const showText = (text: PdfString) => Operator.of(Op.ShowText, text);

export const showTextArray = (array: PdfArray) => Operator.of(Op.ShowTextArray, array);

// ============= Color =============

export const setStrokingGray = (gray: number) => Operator.of(Op.SetStrokingGray, gray);

export const setNonStrokingGray = (gray: number) => Operator.of(Op.SetNonStrokingGray, gray);

export const setStrokingRGB = (r: number, g: number, b: number) =>
  Operator.of(Op.SetStrokingRGB, r, g, b);

export const setNonStrokingRGB = (r: number, g: number, b: number) =>
  Operator.of(Op.SetNonStrokingRGB, r, g, b);

export const setStrokingCMYK = (c: number, m: number, y: number, k: number) =>
  Operator.of(Op.SetStrokingCMYK, c, m, y, k);

export const setNonStrokingCMYK = (c: number, m: number, y: number, k: number) =>
  Operator.of(Op.SetNonStrokingCMYK, c, m, y, k);

// ============= XObjects =============

export const drawXObject = (name: string) => Operator.of(Op.DrawXObject, name);

// ============= Marked Content =============

export const beginMarkedContent = (tag: string) => Operator.of(Op.BeginMarkedContent, tag);

export const beginMarkedContentProps = (tag: string, props: PdfDict | string) =>
  Operator.of(Op.BeginMarkedContentProps, tag, props);

export const endMarkedContent = () => Operator.of(Op.EndMarkedContent);
```

### ContentStreamBuilder

````typescript
// src/content/content-stream.ts

import { PdfDict, PdfNumber, PdfStream } from "../objects";
import { Operator } from "./operators";

/**
 * Builder for constructing content streams from operators.
 */
export class ContentStreamBuilder {
  private readonly operators: Operator[] = [];

  /**
   * Create a builder from an array of operators.
   * Convenient for building content streams declaratively.
   *
   * @example
   * ```ts
   * const content = ContentStreamBuilder.from([
   *   pushGraphicsState(),
   *   setLineWidth(2),
   *   moveTo(0, 0),
   *   lineTo(100, 100),
   *   stroke(),
   *   popGraphicsState(),
   * ]);
   * ```
   */
  static from(operators: Operator[]): ContentStreamBuilder {
    const builder = new ContentStreamBuilder();
    builder.operators.push(...operators);
    return builder;
  }

  /**
   * Add one or more operators.
   */
  add(...ops: Operator[]): this {
    this.operators.push(...ops);
    return this;
  }

  /**
   * Add operators conditionally.
   */
  addIf(condition: boolean, ...ops: Operator[]): this {
    if (condition) {
      this.operators.push(...ops);
    }
    return this;
  }

  /**
   * Get the number of operators.
   */
  get length(): number {
    return this.operators.length;
  }

  /**
   * Check if builder is empty.
   */
  isEmpty(): boolean {
    return this.operators.length === 0;
  }

  /**
   * Get a copy of the operators array.
   */
  getOperators(): Operator[] {
    return [...this.operators];
  }

  /**
   * Serialize to content stream string.
   * Each operator on its own line.
   */
  toString(): string {
    return this.operators.map(op => op.toString()).join("\n");
  }

  /**
   * Serialize to bytes.
   */
  toBytes(): Uint8Array {
    return new TextEncoder().encode(this.toString());
  }

  /**
   * Create a PdfStream with this content.
   * Optionally provide a dict to merge (e.g., for Form XObjects).
   */
  toStream(baseDict?: PdfDict): PdfStream {
    const bytes = this.toBytes();
    const dict = baseDict?.clone() ?? new PdfDict();
    dict.set("Length", PdfNumber.of(bytes.length));
    return new PdfStream(dict, bytes);
  }

  /**
   * Create a Form XObject stream.
   */
  toFormXObject(bbox: [number, number, number, number], resources?: PdfDict): PdfStream {
    const dict = PdfDict.of({
      Type: PdfName.of("XObject"),
      Subtype: PdfName.of("Form"),
      BBox: PdfArray.of(bbox.map(PdfNumber.of)),
    });
    if (resources) {
      dict.set("Resources", resources);
    }
    return this.toStream(dict);
  }
}
````

## Usage Examples

### Basic Path Drawing

```typescript
import {
  ContentStreamBuilder,
  pushGraphicsState,
  popGraphicsState,
  moveTo,
  lineTo,
  closePath,
  stroke,
  setLineWidth,
  setStrokingRGB,
} from "./content";

const content = new ContentStreamBuilder()
  .add(pushGraphicsState())
  .add(setLineWidth(2))
  .add(setStrokingRGB(1, 0, 0)) // Red
  .add(moveTo(100, 100))
  .add(lineTo(200, 100))
  .add(lineTo(200, 200))
  .add(lineTo(100, 200))
  .add(closePath())
  .add(stroke())
  .add(popGraphicsState());

console.log(content.toString());
// q
// 2 w
// 1 0 0 RG
// 100 100 m
// 200 100 l
// 200 200 l
// 100 200 l
// h
// S
// Q
```

### Text Field Appearance

```typescript
const appearance = new ContentStreamBuilder()
  .add(beginMarkedContent("/Tx"))
  .add(pushGraphicsState())
  .add(rectangle(0, 0, width, height), clip(), endPath())
  .add(beginText())
  .add(setFont("/Helv", 12))
  .add(setNonStrokingGray(0))
  .add(moveText(2, 5))
  .add(showText(PdfString.of("Hello World")))
  .add(endText())
  .add(popGraphicsState())
  .add(endMarkedContent());

const stream = appearance.toFormXObject([0, 0, width, height], resources);
```

### Drawing XObject

```typescript
// For flattening forms
const flatten = new ContentStreamBuilder()
  .add(pushGraphicsState())
  .add(concatMatrix(scaleX, 0, 0, scaleY, translateX, translateY))
  .add(drawXObject("/FlatField0"))
  .add(popGraphicsState());
```

### Using .from() for Declarative Style

```typescript
// Build content from an array (nice for conditional composition)
const ops = [pushGraphicsState(), setLineWidth(1)];

if (hasFill) {
  ops.push(setNonStrokingRGB(1, 0, 0));
}

ops.push(rectangle(10, 10, 100, 50), hasFill ? fillAndStroke() : stroke(), popGraphicsState());

const content = ContentStreamBuilder.from(ops);
```

## File Structure

```
src/content/
├── index.ts              # Re-exports
├── operators.ts          # Op enum, Operator class, factory functions
├── operators.test.ts
├── content-stream.ts     # ContentStreamBuilder
└── content-stream.test.ts
```

## Test Plan

### Operator Serialization

1. Zero-operand operators: `q`, `Q`, `BT`, `ET`, `h`, `S`, `f`, `n`
2. Single number: `2 w`, `0.5 g`
3. Multiple numbers: `100 200 m`, `1 0 0 rg`
4. Six numbers (matrix): `1 0 0 1 10 20 cm`
5. Name operand: `/Helv 12 Tf`
6. String operand: `(Hello) Tj`
7. Array operand: `[(H) 10 (ello)] TJ`

### Number Formatting

1. Integers: `100` not `100.0`
2. Simple decimals: `0.5` not `0.500000`
3. Precision limit: avoid floating point noise
4. Negative numbers: `-10`
5. Zero: `0`

### ContentStreamBuilder

1. Empty builder: `toString()` returns empty string
2. Single operator: no trailing newline issues
3. Multiple operators: newline separated
4. `from([...])`: creates builder with operators
5. `from([])`: creates empty builder
6. `addIf(true, ...)`: includes operators
7. `addIf(false, ...)`: excludes operators
8. `getOperators()`: returns copy of operators
9. `toBytes()`: UTF-8 encoded
10. `toStream()`: includes Length in dict
11. `toFormXObject()`: includes Type, Subtype, BBox

### Round-Trip (Future)

1. Build content → serialize → parse → operators match

## Dependencies

- `PdfName`, `PdfString`, `PdfArray`, `PdfDict`, `PdfNumber` from `src/objects`
- `PdfStream` for stream output

## Future Extensions

1. **Content stream parsing** - Parse existing streams into Operator[]
2. **Operator validation** - Check operand count/types at creation
3. **State tracking** - Track graphics state for validation (optional)
4. **Optimization** - Collapse redundant state changes
