/**
 * LineGrouper - Groups extracted characters into lines and spans.
 *
 * Characters are grouped into lines based on their baseline Y coordinate,
 * and within lines into spans based on font/size changes.
 * Spaces are detected from gaps between characters.
 */

import type { ExtractedChar, TextLine, TextSpan } from "./types";
import { mergeBboxes } from "./types";

/**
 * Minimum fraction of consecutive char pairs with decreasing x-positions
 * (in stream order) to classify a line as "RTL-placed".
 *
 * Figma/Canva exports produce ~100% decreasing pairs within words.
 * 80% tolerates small forward jumps at word boundaries.
 */
const RTL_PLACED_THRESHOLD = 0.8;

/**
 * Result of ordering characters within a line.
 */
interface OrderedLine {
  /** Characters in reading order */
  chars: ExtractedChar[];
  /** Whether the line was detected as RTL-placed (design-tool pattern) */
  rtlPlaced: boolean;
}

/**
 * Options for line grouping.
 */
export interface LineGrouperOptions {
  /**
   * Tolerance for grouping characters on the same baseline.
   * Characters within this Y distance are considered on the same line.
   * Default: 2 points
   */
  baselineTolerance?: number;

  /**
   * Factor of font size to detect word spacing.
   * If gap between characters exceeds this fraction of font size, insert a space.
   * Default: 0.3 (30% of font size)
   */
  spaceThreshold?: number;
}

/**
 * Group extracted characters into lines and spans.
 *
 * @param chars - Array of extracted characters
 * @param options - Grouping options
 * @returns Array of text lines
 */
export function groupCharsIntoLines(
  chars: ExtractedChar[],
  options: LineGrouperOptions = {},
): TextLine[] {
  if (chars.length === 0) {
    return [];
  }

  const baselineTolerance = options.baselineTolerance ?? 2;
  const spaceThreshold = options.spaceThreshold ?? 0.3;

  // Group characters by baseline
  const lineGroups = groupByBaseline(chars, baselineTolerance);

  // Convert each group to a TextLine
  const lines: TextLine[] = [];

  for (const group of lineGroups) {
    // Order characters within the line.
    // Normally we sort left-to-right by x-position, but some design tools
    // (Figma, Canva) place characters right-to-left via TJ adjustments while
    // the text is actually LTR. In that case, content stream order is correct
    // and position-based sorting would reverse the text.
    const { chars: sorted, rtlPlaced } = orderLineChars(group);

    // Group into spans and detect spaces
    const spans = groupIntoSpans(sorted, spaceThreshold, rtlPlaced);

    if (spans.length === 0) {
      continue;
    }

    // Build the line
    const lineText = spans.map(s => s.text).join("");
    const lineBbox = mergeBboxes(spans.map(s => s.bbox));
    const baseline = calculateAverageBaseline(sorted);

    lines.push({
      text: lineText,
      bbox: lineBbox,
      spans,
      baseline,
    });
  }

  // Sort lines top-to-bottom (higher Y = higher on page in PDF coordinates)
  lines.sort((a, b) => b.baseline - a.baseline);

  return lines;
}

/**
 * Determine the correct character order for a line.
 *
 * Design tools like Figma and Canva export PDFs where LTR characters are placed
 * right-to-left via TJ positioning adjustments (positive values move the pen left).
 * The font has near-zero glyph widths, so all positioning comes from TJ. Characters
 * appear in correct reading order in the content stream, but their x-positions
 * decrease monotonically.
 *
 * When this pattern is detected, we preserve content stream order instead of sorting
 * by x-position, which would reverse the text.
 *
 * **Limitation**: Detection requires `sequenceIndex` on every character. If any
 * character in the group lacks a `sequenceIndex`, we fall back to x-position sorting
 * because stream order cannot be reliably reconstructed.
 */
function orderLineChars(group: ExtractedChar[]): OrderedLine {
  if (group.length <= 1) {
    return { chars: [...group], rtlPlaced: false };
  }

  // If any character lacks sequenceIndex, fall back to x-sort
  const hasStreamOrder = group.every(c => c.sequenceIndex != null);

  if (!hasStreamOrder) {
    return {
      chars: [...group].sort((a, b) => a.bbox.x - b.bbox.x),
      rtlPlaced: false,
    };
  }

  // Sort by sequenceIndex to get content stream order.
  // Safe to use `!` — hasStreamOrder guarantees every char has sequenceIndex.
  const streamOrder = [...group].sort((a, b) => a.sequenceIndex! - b.sequenceIndex!);

  if (isRtlPlaced(streamOrder)) {
    return { chars: streamOrder, rtlPlaced: true };
  }

  // Normal case: sort left-to-right by x-position
  return {
    chars: [...group].sort((a, b) => a.bbox.x - b.bbox.x),
    rtlPlaced: false,
  };
}

/**
 * Detect whether characters are placed right-to-left in user space while
 * content stream order represents the correct reading order.
 *
 * Returns true when x-positions in stream order are predominantly decreasing
 * (≥ 80% of consecutive pairs). In that case, position-based sorting would
 * reverse the reading order, so we preserve stream order instead.
 *
 * This covers two real-world scenarios:
 * - **Design-tool PDFs** (Figma, Canva): LTR text placed right-to-left via
 *   TJ positioning adjustments. Stream order = correct reading order.
 * - **Genuine RTL text** (Arabic, Hebrew): characters naturally placed
 *   right-to-left. PDF producers typically emit them in reading order, so
 *   stream order is again correct.
 *
 * In both cases, when x-positions decrease in stream order, preserving stream
 * order produces the correct reading order.
 *
 * **Known limitation**: mixed bidi text (e.g., Arabic with embedded English)
 * requires a full Unicode bidi algorithm, which is out of scope for this
 * heuristic. For mixed lines, neither stream order nor x-sort is fully
 * correct; a future bidi implementation should replace this heuristic.
 */
function isRtlPlaced(streamOrder: ExtractedChar[]): boolean {
  if (streamOrder.length < 2) {
    return false;
  }

  // Count how many consecutive character pairs have decreasing x
  let decreasingCount = 0;
  for (let i = 1; i < streamOrder.length; i++) {
    if (streamOrder[i].bbox.x < streamOrder[i - 1].bbox.x) {
      decreasingCount++;
    }
  }

  const totalPairs = streamOrder.length - 1;

  return decreasingCount / totalPairs >= RTL_PLACED_THRESHOLD;
}

/**
 * Group characters by baseline Y coordinate.
 */
function groupByBaseline(chars: ExtractedChar[], tolerance: number): ExtractedChar[][] {
  const groups: ExtractedChar[][] = [];

  for (const char of chars) {
    // Find an existing group with a similar baseline
    let foundGroup = false;

    for (const group of groups) {
      const avgBaseline = calculateAverageBaseline(group);

      if (Math.abs(char.baseline - avgBaseline) <= tolerance) {
        group.push(char);
        foundGroup = true;
        break;
      }
    }

    if (!foundGroup) {
      groups.push([char]);
    }
  }

  return groups;
}

/**
 * Group characters into spans based on font/size and detect spaces.
 */
function groupIntoSpans(
  chars: ExtractedChar[],
  spaceThreshold: number,
  rtlPlaced: boolean,
): TextSpan[] {
  if (chars.length === 0) {
    return [];
  }

  const spans: TextSpan[] = [];
  let currentSpan: ExtractedChar[] = [chars[0]];
  let currentFontName = chars[0].fontName;
  let currentFontSize = chars[0].fontSize;

  for (let i = 1; i < chars.length; i++) {
    const prevChar = chars[i - 1];
    const char = chars[i];

    // Check for font/size change
    const fontChanged =
      char.fontName !== currentFontName || Math.abs(char.fontSize - currentFontSize) > 0.5;

    // Check for space gap — in RTL-placed lines, the "next" character in
    // reading order sits to the left of the previous one, so the gap is
    // measured from the left edge of prevChar to the right edge of char.
    const gap = rtlPlaced
      ? prevChar.bbox.x - (char.bbox.x + char.bbox.width)
      : char.bbox.x - (prevChar.bbox.x + prevChar.bbox.width);
    const avgFontSize = (prevChar.fontSize + char.fontSize) / 2;
    const needsSpace = gap > avgFontSize * spaceThreshold;

    if (fontChanged) {
      // Complete current span
      spans.push(buildSpan(currentSpan));

      // Start new span
      currentSpan = [char];
      currentFontName = char.fontName;
      currentFontSize = char.fontSize;
    } else if (needsSpace) {
      // Add space to current span and continue
      // We insert a synthetic space character
      currentSpan.push(createSpaceChar(prevChar, char, rtlPlaced));
      currentSpan.push(char);
    } else {
      currentSpan.push(char);
    }
  }

  // Complete final span
  if (currentSpan.length > 0) {
    spans.push(buildSpan(currentSpan));
  }

  return spans;
}

/**
 * Build a TextSpan from characters.
 */
function buildSpan(chars: ExtractedChar[]): TextSpan {
  const text = chars.map(c => c.char).join("");
  const bbox = mergeBboxes(chars.map(c => c.bbox));

  // Use the first non-space character for font info
  const fontChar = chars.find(c => c.char !== " ") ?? chars[0];

  return {
    text,
    bbox,
    chars,
    fontSize: fontChar.fontSize,
    fontName: fontChar.fontName,
  };
}

/**
 * Create a synthetic space character between two characters.
 */
function createSpaceChar(
  before: ExtractedChar,
  after: ExtractedChar,
  rtlPlaced: boolean,
): ExtractedChar {
  const x = rtlPlaced ? after.bbox.x + after.bbox.width : before.bbox.x + before.bbox.width;
  const width = rtlPlaced ? before.bbox.x - x : after.bbox.x - x;

  return {
    char: " ",
    bbox: {
      x,
      y: before.bbox.y,
      width: Math.max(width, 0),
      height: before.bbox.height,
    },
    fontSize: (before.fontSize + after.fontSize) / 2,
    fontName: before.fontName,
    baseline: (before.baseline + after.baseline) / 2,
    sequenceIndex: before.sequenceIndex != null ? before.sequenceIndex + 0.5 : undefined,
  };
}

/**
 * Calculate the average baseline of a group of characters.
 */
function calculateAverageBaseline(chars: ExtractedChar[]): number {
  if (chars.length === 0) {
    return 0;
  }

  const sum = chars.reduce((acc, c) => acc + c.baseline, 0);

  return sum / chars.length;
}

/**
 * Get plain text from extracted characters.
 * Inserts newlines between lines.
 */
export function getPlainText(lines: TextLine[]): string {
  return lines.map(line => line.text).join("\n");
}
