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
 * // Get font reference (available after prepare or save)
 * await pdf.fonts.prepare();
 * const fontRef = pdf.fonts.getRef(font);
 * ```
 */

import type { ObjectRegistry } from "#src/document/object-registry.ts";
import { EmbeddedFont, type EmbedFontOptions } from "#src/fonts/embedded-font.ts";
import { createFontObjects, registerFontObjects } from "#src/fonts/font-embedder.ts";
import type { PdfRef } from "#src/objects/pdf-ref.ts";

/**
 * PDFFonts manages font embedding for a PDF document.
 */
export class PDFFonts {
  /** Embedded fonts that need to be written on save */
  private readonly embeddedFonts: Map<EmbeddedFont, PdfRef | null> = new Map();

  /** Registry for object management */
  private readonly registry: ObjectRegistry;

  constructor(registry: ObjectRegistry) {
    this.registry = registry;
  }

  /**
   * Embed a font for use in the document.
   *
   * The font is parsed and prepared for embedding. The actual PDF objects
   * are created during save (or when `prepare()` is called), which allows
   * subsetting to only include the glyphs that were actually used.
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
   * // Use the font
   * const codes = font.encodeText("Hello World");
   * const width = font.getTextWidth("Hello World", 12);
   * ```
   */
  embed(data: Uint8Array, options?: EmbedFontOptions): EmbeddedFont {
    const font = EmbeddedFont.fromBytes(data, options);

    // Track the font (ref will be assigned during prepare/save)
    this.embeddedFonts.set(font, null);

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
   * Note: The reference is only available after `prepare()` is called
   * (which happens automatically during save). Before that, this returns null.
   *
   * @param font - The embedded font to get a reference for
   * @returns The PDF reference, or null if not yet prepared
   */
  getRef(font: EmbeddedFont): PdfRef | null {
    return this.embeddedFonts.get(font) ?? null;
  }

  /**
   * Check if a font has been prepared (has a PDF reference).
   *
   * @param font - The embedded font to check
   * @returns True if the font has been prepared
   */
  isPrepared(font: EmbeddedFont): boolean {
    return this.embeddedFonts.get(font) !== null;
  }

  /**
   * Prepare all embedded fonts by creating their PDF objects.
   *
   * This is called automatically during `pdf.save()`, but can be called
   * manually if you need the font references before saving (e.g., to add
   * fonts to page resources).
   *
   * Fonts that have already been prepared are skipped.
   *
   * @example
   * ```typescript
   * const font = pdf.fonts.embed(fontBytes);
   * font.encodeText("Hello"); // Track glyph usage
   *
   * // Prepare fonts to get references
   * await pdf.fonts.prepare();
   *
   * // Now we can get the reference
   * const fontRef = pdf.fonts.getRef(font);
   *
   * // Add to page resources
   * const page = await pdf.getObject(pdf.getPage(0));
   * const resources = page.get("Resources") ?? new PdfDict();
   * const fonts = resources.get("Font") ?? new PdfDict();
   * fonts.set("F1", fontRef);
   * ```
   */
  async prepare(): Promise<void> {
    for (const [font, existingRef] of this.embeddedFonts) {
      // Skip if already prepared
      if (existingRef !== null) {
        continue;
      }

      // Create PDF objects for the font
      const result = await createFontObjects(font);

      // Register all objects and get the Type0 font reference
      const fontRef = registerFontObjects(result, obj => this.registry.register(obj));

      // Store the reference
      this.embeddedFonts.set(font, fontRef);
    }
  }
}
