/**
 * Text layout utilities for measuring and wrapping text.
 */

import {
  getGlyphName,
  getStandard14DefaultWidth,
  getStandard14GlyphWidth,
  isStandard14Font,
  type Standard14FontName,
} from "#src/fonts/standard-14";

import type { FontInput } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single line of laid out text.
 */
export interface TextLine {
  /** The text content of the line */
  text: string;
  /** Width of the line in points */
  width: number;
}

/**
 * Result of laying out text.
 */
export interface LayoutResult {
  /** The lines of text */
  lines: TextLine[];
  /** Total height of all lines */
  height: number;
}

/**
 * A word with its position for justified text.
 */
export interface PositionedWord {
  /** The word text */
  word: string;
  /** X position relative to line start */
  x: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Measurement Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Measure the width of text at a given font size.
 *
 * @param text - The text to measure
 * @param font - The font (Standard 14 name or EmbeddedFont)
 * @param fontSize - Font size in points
 * @returns Width in points
 */
export function measureText(text: string, font: FontInput, fontSize: number): number {
  if (typeof font === "string") {
    return measureStandard14Text(text, font, fontSize);
  }

  return font.getTextWidth(text, fontSize);
}

/**
 * Measure text width for a Standard 14 font.
 */
function measureStandard14Text(
  text: string,
  fontName: Standard14FontName,
  fontSize: number,
): number {
  if (!isStandard14Font(fontName)) {
    throw new Error(`Unknown Standard 14 font: ${fontName}`);
  }

  let totalWidth = 0;

  for (const char of text) {
    const glyphName = getGlyphName(char);
    const width =
      getStandard14GlyphWidth(fontName, glyphName) ?? getStandard14DefaultWidth(fontName);
    totalWidth += width;
  }

  return (totalWidth * fontSize) / 1000;
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Break text into lines that fit within maxWidth.
 *
 * - Splits on explicit line breaks (\n, \r\n, \r)
 * - Word-wraps at spaces when line exceeds maxWidth
 * - Long words that exceed maxWidth are kept intact (no character-level breaking)
 *
 * @param text - The text to layout
 * @param font - The font to use
 * @param fontSize - Font size in points
 * @param maxWidth - Maximum line width in points
 * @param lineHeight - Line height in points
 * @returns Layout result with lines and total height
 */
export function layoutText(
  text: string,
  font: FontInput,
  fontSize: number,
  maxWidth: number,
  lineHeight: number,
): LayoutResult {
  const lines: TextLine[] = [];

  // Split on explicit line breaks first
  const paragraphs = text.split(/\r\n|\r|\n/);

  for (const paragraph of paragraphs) {
    if (paragraph === "") {
      // Empty paragraph = blank line
      lines.push({ text: "", width: 0 });
      continue;
    }

    // Split paragraph into words
    const words = paragraph.split(/\s+/).filter(w => w.length > 0);

    if (words.length === 0) {
      lines.push({ text: "", width: 0 });
      continue;
    }

    let currentLine = "";
    let currentWidth = 0;
    const spaceWidth = measureText(" ", font, fontSize);

    for (const word of words) {
      const wordWidth = measureText(word, font, fontSize);

      if (currentLine === "") {
        // First word on line - always add it (even if too long)
        currentLine = word;
        currentWidth = wordWidth;
      } else {
        // Check if word fits on current line
        const testWidth = currentWidth + spaceWidth + wordWidth;

        if (testWidth <= maxWidth) {
          // Word fits - add it
          currentLine += ` ${word}`;
          currentWidth = testWidth;
        } else {
          // Word doesn't fit - start new line
          lines.push({ text: currentLine, width: currentWidth });
          currentLine = word;
          currentWidth = wordWidth;
        }
      }
    }

    // Add the last line of the paragraph
    if (currentLine !== "") {
      lines.push({ text: currentLine, width: currentWidth });
    }
  }

  return {
    lines,
    height: lines.length * lineHeight,
  };
}

/**
 * Calculate positions for justified text.
 *
 * Distributes extra space evenly between words to fill the target width.
 * For single-word lines or the last line of a paragraph, returns left-aligned.
 *
 * @param words - Array of words to position
 * @param font - The font to use
 * @param fontSize - Font size in points
 * @param targetWidth - Target line width in points
 * @returns Array of words with their x positions
 */
export function layoutJustifiedLine(
  words: string[],
  font: FontInput,
  fontSize: number,
  targetWidth: number,
): PositionedWord[] {
  if (words.length === 0) {
    return [];
  }

  if (words.length === 1) {
    return [{ word: words[0], x: 0 }];
  }

  // Calculate total word width
  let totalWordWidth = 0;

  for (const word of words) {
    totalWordWidth += measureText(word, font, fontSize);
  }

  // Calculate space between words
  const totalSpace = targetWidth - totalWordWidth;
  const spacePerGap = totalSpace / (words.length - 1);

  // Position each word
  const result: PositionedWord[] = [];
  let x = 0;

  for (let i = 0; i < words.length; i++) {
    result.push({ word: words[i], x });
    x += measureText(words[i], font, fontSize);

    if (i < words.length - 1) {
      x += spacePerGap;
    }
  }

  return result;
}
