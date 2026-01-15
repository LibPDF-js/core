/**
 * Text layout utilities for measuring and wrapping text.
 */

import {
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
// Character to Glyph Name Mapping (for Standard 14 fonts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map common Unicode code points to glyph names.
 * This is a subset of the Adobe Glyph List.
 */
const CHAR_TO_GLYPH: Record<number, string> = {
  // ASCII printable characters
  32: "space",
  33: "exclam",
  34: "quotedbl",
  35: "numbersign",
  36: "dollar",
  37: "percent",
  38: "ampersand",
  39: "quotesingle",
  40: "parenleft",
  41: "parenright",
  42: "asterisk",
  43: "plus",
  44: "comma",
  45: "hyphen",
  46: "period",
  47: "slash",
  48: "zero",
  49: "one",
  50: "two",
  51: "three",
  52: "four",
  53: "five",
  54: "six",
  55: "seven",
  56: "eight",
  57: "nine",
  58: "colon",
  59: "semicolon",
  60: "less",
  61: "equal",
  62: "greater",
  63: "question",
  64: "at",
  // Uppercase letters
  65: "A",
  66: "B",
  67: "C",
  68: "D",
  69: "E",
  70: "F",
  71: "G",
  72: "H",
  73: "I",
  74: "J",
  75: "K",
  76: "L",
  77: "M",
  78: "N",
  79: "O",
  80: "P",
  81: "Q",
  82: "R",
  83: "S",
  84: "T",
  85: "U",
  86: "V",
  87: "W",
  88: "X",
  89: "Y",
  90: "Z",
  91: "bracketleft",
  92: "backslash",
  93: "bracketright",
  94: "asciicircum",
  95: "underscore",
  96: "grave",
  // Lowercase letters
  97: "a",
  98: "b",
  99: "c",
  100: "d",
  101: "e",
  102: "f",
  103: "g",
  104: "h",
  105: "i",
  106: "j",
  107: "k",
  108: "l",
  109: "m",
  110: "n",
  111: "o",
  112: "p",
  113: "q",
  114: "r",
  115: "s",
  116: "t",
  117: "u",
  118: "v",
  119: "w",
  120: "x",
  121: "y",
  122: "z",
  123: "braceleft",
  124: "bar",
  125: "braceright",
  126: "asciitilde",
};

/**
 * Get glyph name for a character.
 */
function getGlyphName(char: string): string {
  const code = char.codePointAt(0);

  if (code !== undefined && CHAR_TO_GLYPH[code]) {
    return CHAR_TO_GLYPH[code];
  }

  // Fallback: use the character itself if it's a letter
  if (char.length === 1 && /[a-zA-Z]/.test(char)) {
    return char;
  }

  return "space"; // Default to space width for unknown characters
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
