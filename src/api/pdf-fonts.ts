/**
 * PDFFonts - High-level API for font operations on a PDF document.
 *
 * Provides font embedding, tracking, and management functionality.
 * Accessed via `pdf.fonts` on a PDF instance.
 *
 * @example
 * ```typescript
 * const pdf = await PDF.load(bytes);
 *
 * // Embed a font
 * const font = pdf.fonts.embed(fontBytes);
 *
 * // Use the font for encoding
 * const codes = font.encodeText("Hello World");
 * const width = font.getTextWidth("Hello World", 12);
 *
 * // Font refs are available immediately
 * const fontRef = pdf.fonts.getRef(font);
 *
 * // Subsetting happens at save time
 * await pdf.save({ subsetFonts: true });
 * ```
 */

import { EmbeddedFont, type EmbedFontOptions } from "#src/fonts/embedded-font.ts";
import {
  createFontObjects,
  createFontObjectsFull,
  registerFontObjects,
} from "#src/fonts/font-embedder.ts";
import type { PdfRef } from "#src/objects/pdf-ref.ts";

import type { PDFContext } from "./pdf-context.ts";

/**
 * PDFFonts manages font embedding for a PDF document.
 */
export class PDFFonts {
  /** Embedded fonts with pre-allocated refs */
  private readonly embeddedFonts: Map<EmbeddedFont, PdfRef> = new Map();

  /** Whether fonts have been finalized (PDF objects created) */
  private finalized = false;

  /** PDF context */
  private readonly ctx: PDFContext;

  constructor(ctx: PDFContext) {
    this.ctx = ctx;
  }

  /**
   * Embed a font for use in the document.
   *
   * The font is parsed immediately and a PDF reference is pre-allocated.
   * Font objects are created during `save()`, which allows subsetting to
   * only include glyphs that were actually used.
   *
   * @param data - Font data (TTF, OTF, or Type1)
   * @param options - Embedding options (variations for variable fonts)
   * @returns EmbeddedFont instance for encoding text
   *
   * @example
   * ```typescript
   * const fontBytes = await fs.readFile("NotoSans-Regular.ttf");
   * const font = pdf.fonts.embed(fontBytes);
   *
   * // Use the font - ref is immediately available
   * const fontRef = pdf.fonts.getRef(font);
   *
   * // Encode text and draw (sync)
   * page.drawText("Hello World", { font });
   *
   * // Subsetting happens at save time
   * await pdf.save({ subsetFonts: true });
   * ```
   */
  embed(data: Uint8Array, options?: EmbedFontOptions): EmbeddedFont {
    const font = EmbeddedFont.fromBytes(data, options);

    // Pre-allocate a reference for the font
    // This ref points to nothing until finalize() creates the actual objects
    const ref = this.ctx.registry.allocateRef();

    this.embeddedFonts.set(font, ref);
    font.setRef(ref);

    return font;
  }

  /**
   * Get all embedded fonts.
   *
   * @returns Iterator of embedded fonts
   */
  getAll(): IterableIterator<EmbeddedFont> {
    return this.embeddedFonts.keys();
  }

  /**
   * Get the number of embedded fonts.
   */
  get count(): number {
    return this.embeddedFonts.size;
  }

  /**
   * Check if any fonts have been embedded.
   */
  get hasEmbeddedFonts(): boolean {
    return this.embeddedFonts.size > 0;
  }

  /**
   * Get the PDF reference for an embedded font.
   *
   * The reference is available immediately after embedding.
   *
   * @param font - The embedded font to get a reference for
   * @returns The PDF reference
   * @throws {Error} if font was not embedded via this PDFFonts instance
   */
  getRef(font: EmbeddedFont): PdfRef {
    const ref = this.embeddedFonts.get(font);

    if (!ref) {
      throw new Error("Font was not embedded via this document's fonts API");
    }

    return ref;
  }

  /**
   * Check if the fonts have been finalized.
   */
  get isFinalized(): boolean {
    return this.finalized;
  }

  /**
   * Finalize all embedded fonts by creating their PDF objects.
   *
   * This is called automatically during `pdf.save()`. It creates the actual
   * font objects (Type0, CIDFont, descriptor, font file, ToUnicode) and
   * registers them with the pre-allocated references.
   *
   * @param subsetFonts - Whether to subset fonts (only include used glyphs)
   */
  finalize(subsetFonts: boolean): void {
    if (this.finalized) {
      return;
    }

    for (const [font, ref] of this.embeddedFonts) {
      // Choose full or subset embedding based on option and font usage
      const shouldSubset = subsetFonts && font.canSubset();

      // Create PDF objects for the font
      const result = shouldSubset ? createFontObjects(font) : createFontObjectsFull(font);

      // Register all objects and link to the pre-allocated ref
      registerFontObjects(
        result,
        obj => this.ctx.register(obj),
        ref,
        (allocatedRef, obj) => this.ctx.registry.registerAt(allocatedRef, obj),
      );
    }

    this.finalized = true;
  }

  /**
   * @deprecated Use `finalize()` instead. This method exists for backwards compatibility.
   */
  prepare(): void {
    this.finalize(true);
  }
}
