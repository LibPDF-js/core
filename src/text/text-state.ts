/**
 * TextState - Tracks the text rendering state during content stream processing.
 *
 * This class maintains all the state variables needed to correctly position
 * and measure text during extraction. It follows the PDF specification for
 * text state parameters (Section 9.3).
 */

import type { PdfFont } from "#src/fonts/pdf-font";
import { Matrix } from "#src/helpers/matrix";

/**
 * Graphics state that can be saved/restored with q/Q operators.
 */
export interface GraphicsState {
  /** Current transformation matrix */
  ctm: Matrix;
  /** Text state parameters */
  textState: TextStateParams;
}

/**
 * Text state parameters (9.3); all are part of the graphics state saved by q/Q.
 */
export interface TextStateParams {
  /** Font (Tf) */
  font: PdfFont | null;
  /** Font size (Tf) */
  fontSize: number;
  /** Character spacing (Tc) - extra space after each character */
  charSpacing: number;
  /** Word spacing (Tw) - extra space after space characters */
  wordSpacing: number;
  /** Horizontal scaling (Tz) - percentage, 100 = normal */
  horizontalScale: number;
  /** Leading (TL) - vertical distance between baselines */
  leading: number;
  /** Text rise (Ts) - superscript/subscript offset */
  rise: number;
  /** Text rendering mode (Tr) - 0=fill, 1=stroke, etc. */
  renderMode: number;
}

/**
 * Tracks all text rendering state during content stream processing.
 */
export class TextState {
  /** Current transformation matrix (graphics state) */
  ctm: Matrix = Matrix.identity();

  /** Text matrix (Tm) - set by Tm operator, updated by text operations */
  tm: Matrix = Matrix.identity();

  /** Text line matrix (Tlm) - set at start of each line */
  tlm: Matrix = Matrix.identity();

  /** Current font (set by Tf operator) */
  font: PdfFont | null = null;

  /** Current font size in points (set by Tf operator) */
  fontSize: number = 0;

  /** Character spacing (Tc) */
  charSpacing: number = 0;

  /** Word spacing (Tw) */
  wordSpacing: number = 0;

  /** Horizontal scaling percentage (Tz) - 100 = normal */
  horizontalScale: number = 100;

  /** Leading (TL) - vertical distance between baselines */
  leading: number = 0;

  /** Text rise (Ts) - superscript/subscript offset */
  rise: number = 0;

  /** Text rendering mode (Tr) */
  renderMode: number = 0;

  /** Graphics state stack for q/Q operators */
  private graphicsStateStack: GraphicsState[] = [];

  /** Tm × CTM: maps scaled text space (after Tfs, Tz, Ts) to user space. */
  get textRenderingMatrix(): Matrix {
    return this.tm.multiply(this.ctm);
  }

  /** Font size in user space. */
  get effectiveFontSize(): number {
    return Math.abs(this.fontSize * this.textRenderingMatrix.getScaleY());
  }

  /**
   * Begin text object (BT operator).
   * Resets text matrix and line matrix to identity.
   */
  beginText(): void {
    this.tm = Matrix.identity();
    this.tlm = Matrix.identity();
  }

  /**
   * End text object (ET operator).
   */
  endText(): void {
    // Text matrices become undefined outside text objects
    // but we keep them for simplicity
  }

  /**
   * Set text matrix (Tm operator).
   * Sets both tm and tlm to the specified matrix.
   */
  setTextMatrix(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.tm = new Matrix(a, b, c, d, e, f);
    this.tlm = this.tm.clone();
  }

  /**
   * Move to start of next line (Td operator).
   * Translates the text line matrix and sets text matrix to it.
   */
  moveTextPosition(tx: number, ty: number): void {
    this.tlm = this.tlm.translate(tx, ty);
    this.tm = this.tlm.clone();
  }

  /**
   * Move to start of next line and set leading (TD operator).
   * Same as: -ty TL tx ty Td
   */
  moveTextPositionAndSetLeading(tx: number, ty: number): void {
    this.leading = -ty;
    this.moveTextPosition(tx, ty);
  }

  /**
   * Move to start of next line (T* operator).
   * Uses the current leading value.
   */
  moveToNextLine(): void {
    this.moveTextPosition(0, -this.leading);
  }

  /**
   * Advance the text position after showing a character.
   *
   * @param width - Character width in glyph units (1000 = 1 em)
   * @param isSpace - Whether this is a space character (for word spacing)
   */
  advanceChar(width: number, isSpace: boolean): void {
    // Width is in glyph units (1000 = 1 em)
    // Convert to text space units
    const w0 = width / 1000;

    // Calculate horizontal displacement
    // tx = ((w0 - Tj/1000) * Tfs + Tc + Tw) * Th
    // Note: For text extraction, we don't have Tj adjustments here
    // Those are handled separately in TJ processing
    const tx =
      (w0 * this.fontSize + this.charSpacing + (isSpace ? this.wordSpacing : 0)) *
      (this.horizontalScale / 100);

    // Update text matrix (translate in text space)
    this.tm = this.tm.translate(tx, 0);
  }

  /**
   * Apply a TJ position adjustment.
   *
   * @param adjustment - Adjustment in thousandths of an em
   *                     Negative = move right, Positive = move left
   */
  applyTjAdjustment(adjustment: number): void {
    // Adjustment is in thousandths of em, negative = move right
    const tx = (-adjustment / 1000) * this.fontSize * (this.horizontalScale / 100);
    this.tm = this.tm.translate(tx, 0);
  }

  /**
   * Save graphics state (q operator).
   */
  saveGraphicsState(): void {
    this.graphicsStateStack.push({
      ctm: this.ctm.clone(),
      textState: {
        font: this.font,
        fontSize: this.fontSize,
        charSpacing: this.charSpacing,
        wordSpacing: this.wordSpacing,
        horizontalScale: this.horizontalScale,
        leading: this.leading,
        rise: this.rise,
        renderMode: this.renderMode,
      },
    });
  }

  /**
   * Restore graphics state (Q operator).
   */
  restoreGraphicsState(): void {
    const saved = this.graphicsStateStack.pop();

    if (saved) {
      this.ctm = saved.ctm;
      this.font = saved.textState.font;
      this.fontSize = saved.textState.fontSize;
      this.charSpacing = saved.textState.charSpacing;
      this.wordSpacing = saved.textState.wordSpacing;
      this.horizontalScale = saved.textState.horizontalScale;
      this.leading = saved.textState.leading;
      this.rise = saved.textState.rise;
      this.renderMode = saved.textState.renderMode;
    }
  }

  /**
   * Number of saved graphics states.
   */
  get stackDepth(): number {
    return this.graphicsStateStack.length;
  }

  /** Pop saved states until the stack is back at `depth`. */
  restoreGraphicsStateTo(depth: number): void {
    while (this.graphicsStateStack.length > depth) {
      this.restoreGraphicsState();
    }
  }

  /**
   * Modify current transformation matrix (cm operator).
   * Prepends the given matrix to the CTM.
   */
  concatMatrix(a: number, b: number, c: number, d: number, e: number, f: number): void {
    const newMatrix = new Matrix(a, b, c, d, e, f);
    this.ctm = newMatrix.multiply(this.ctm);
  }

  /**
   * Bounding box for a glyph at the current position: laid out in scaled
   * text space, rise included, and mapped through Tm × CTM.
   *
   * @param width - Glyph width in glyph units (1000 = 1 em)
   * @returns Axis-aligned bounding box and baseline in user space
   */
  getCharBbox(width: number): {
    x: number;
    y: number;
    width: number;
    height: number;
    baseline: number;
  } {
    const { ascent, descent } = this.fontMetrics();
    const trm = this.textRenderingMatrix;

    const glyphWidth = (width / 1000) * this.fontSize * (this.horizontalScale / 100);
    const bottom = (descent / 1000) * this.fontSize + this.rise;
    const top = (ascent / 1000) * this.fontSize + this.rise;

    const corners = [
      trm.transformPoint(0, bottom),
      trm.transformPoint(glyphWidth, bottom),
      trm.transformPoint(glyphWidth, top),
      trm.transformPoint(0, top),
    ];

    const xs = corners.map(c => c.x);
    const ys = corners.map(c => c.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);

    return {
      x: minX,
      y: minY,
      width: Math.max(...xs) - minX,
      height: Math.max(...ys) - minY,
      baseline: trm.transformPoint(0, this.rise).y,
    };
  }

  /** Ascent/descent in glyph units, falling back to FontBBox (Type3) then defaults. */
  private fontMetrics(): { ascent: number; descent: number } {
    const descriptor = this.font?.descriptor;
    let ascent = descriptor?.ascent;
    let descent = descriptor?.descent;

    if (!ascent && !descent && descriptor?.fontBBox) {
      ascent = descriptor.fontBBox[3];
      descent = descriptor.fontBBox[1];
    }

    return { ascent: ascent || 800, descent: descent ?? -200 };
  }
}
