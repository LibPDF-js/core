/**
 * LineGrouper - Groups extracted characters into lines and spans.
 *
 * Characters arrive in content-stream order and pass through three steps:
 *
 * 1. **Runs.** Consecutive characters advancing along one baseline form a
 *    run: the string a producer drew as a unit (as in pdf.js text items).
 * 2. **Lines.** A run joins a line if it shares the baseline and none of its
 *    glyphs collide with glyphs already there; otherwise it opens a new line
 *    on the same baseline. Strings drawn over each other (a tag printed on an
 *    invisible label) stay intact instead of interleaving glyph by glyph. A
 *    glyph repeating one already on the line at the same position is dropped.
 * 3. **Spans.** Runs are merged left to right by glyph position (stream order
 *    for RTL-placed text) and split into spans on font changes, with spaces
 *    synthesised from gaps.
 *
 * Whitespace and overlay glyphs (combining marks, accents) occupy no space and
 * take no part in collision or repeat checks. Only horizontal text is handled.
 */

import type { ExtractedChar, TextLine, TextSpan } from "./types";
import { mergeBboxes } from "./types";

/**
 * Run continuity, as fractions of the font size. A glyph may start up to
 * RUN_BACKWARD before the previous glyph's right edge (CJK punctuation
 * compression is exactly 0.5em, so the limit sits above it) and up to
 * RUN_FORWARD after it, keeping runs at word granularity.
 */
const RUN_BACKWARD_FACTOR = 0.6;
const RUN_FORWARD_FACTOR = 0.6;

/**
 * A glyph collides with another run once that run covers more than a quarter
 * em of it, or 30% of its own width for narrow glyphs. Less is kerning or
 * italic overhang.
 */
const GLYPH_COVER_EM_FACTOR = 0.25;
const GLYPH_COVER_WIDTH_FACTOR = 0.3;

/** Same character within this fraction of an em is the same glyph drawn twice. */
const REPEAT_POSITION_FACTOR = 0.1;

/** Combining marks and modifier symbols (spacing accents) sit over other glyphs. */
const OVERLAY_CHARS = /^[\p{Mn}\p{Mc}\p{Me}\p{Sk}]+$/u;

/** Fraction of stream-order pairs moving left for a line to count as RTL-placed. */
const RTL_PLACED_THRESHOLD = 0.8;

/**
 * A maximal sequence of characters drawn continuously along one baseline.
 */
interface TextRun {
  chars: ExtractedChar[];
  /** Baseline of the first space-occupying glyph; spaces are often placed oddly */
  baseline: number;
  /** Extent of space-occupying glyphs; empty (left > right) if there are none */
  inkLeft: number;
  inkRight: number;
}

/**
 * A line under construction. Baseline is that of the first run, not an
 * average, so placement does not drift.
 */
interface LineBuilder {
  baseline: number;
  runs: TextRun[];
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
 * @param chars - Extracted characters in content-stream order
 * @param options - Grouping options
 * @returns Array of text lines, top to bottom
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

  const runs = splitIntoRuns(chars, baselineTolerance);
  const builders = placeRunsOnLines(runs, baselineTolerance);

  const lines: TextLine[] = [];

  for (const builder of builders) {
    const { chars: ordered, rtlPlaced } = orderRuns(builder.runs);
    const spans = groupIntoSpans(ordered, spaceThreshold, rtlPlaced);

    if (spans.length === 0) {
      continue;
    }

    lines.push({
      text: spans.map(s => s.text).join(""),
      bbox: mergeBboxes(spans.map(s => s.bbox)),
      spans,
      baseline: averageBaseline(ordered),
    });
  }

  // Top to bottom; stable, so lines sharing a baseline keep stream order
  lines.sort((a, b) => b.baseline - a.baseline);

  return lines;
}

function splitIntoRuns(chars: ExtractedChar[], baselineTolerance: number): TextRun[] {
  const groups: ExtractedChar[][] = [];
  let current: ExtractedChar[] = [];

  for (const char of chars) {
    const prev = current[current.length - 1];

    if (prev && !continuesRun(prev, char, baselineTolerance)) {
      groups.push(current);
      current = [];
    }

    current.push(char);
  }

  if (current.length > 0) {
    groups.push(current);
  }

  return groups.map(createRun);
}

function createRun(chars: ExtractedChar[]): TextRun {
  const run: TextRun = {
    chars,
    baseline: chars[0].baseline,
    inkLeft: Infinity,
    inkRight: -Infinity,
  };

  for (const char of chars) {
    if (occupiesSpace(char)) {
      if (!hasInk(run)) {
        run.baseline = char.baseline;
      }

      run.inkLeft = Math.min(run.inkLeft, char.bbox.x);
      run.inkRight = Math.max(run.inkRight, char.bbox.x + char.bbox.width);
    }
  }

  return run;
}

function hasInk(run: TextRun): boolean {
  return run.inkLeft <= run.inkRight;
}

function isWhitespace(char: ExtractedChar): boolean {
  return char.char.trim() === "";
}

function occupiesSpace(char: ExtractedChar): boolean {
  return !isWhitespace(char) && !OVERLAY_CHARS.test(char.char);
}

/**
 * Same baseline, and the pen advanced past the previous origin without a
 * large jump either way. A glyph drawn on top of the previous one is a
 * redraw, not a continuation.
 */
function continuesRun(
  prev: ExtractedChar,
  char: ExtractedChar,
  baselineTolerance: number,
): boolean {
  if (Math.abs(char.baseline - prev.baseline) > baselineTolerance) {
    return false;
  }

  const fontSize = (prev.fontSize + char.fontSize) / 2;
  const advanced = char.bbox.x - prev.bbox.x > fontSize * REPEAT_POSITION_FACTOR;
  const gap = char.bbox.x - (prev.bbox.x + prev.bbox.width);

  return advanced && gap >= -fontSize * RUN_BACKWARD_FACTOR && gap <= fontSize * RUN_FORWARD_FACTOR;
}

/**
 * Each run joins the first line that shares its baseline and has room for
 * it, or opens a new line. Repeated glyphs (fake bold, redrawn chunk
 * boundaries) are dropped first. Whitespace-only runs cannot collide and
 * stay with the run drawn before them.
 */
function placeRunsOnLines(runs: TextRun[], baselineTolerance: number): LineBuilder[] {
  const lines: LineBuilder[] = [];
  let previous: LineBuilder | null = null;

  for (const run of runs) {
    previous = hasInk(run)
      ? placeInkRun(run, lines, baselineTolerance)
      : placeInklessRun(run, lines, previous, baselineTolerance);
  }

  return lines;
}

function placeInkRun(run: TextRun, lines: LineBuilder[], baselineTolerance: number): LineBuilder {
  for (const line of lines) {
    if (Math.abs(run.baseline - line.baseline) > baselineTolerance) {
      continue;
    }

    const fresh = withoutRepeatedGlyphs(run, line);

    if (!fresh || !hasInk(fresh)) {
      return line;
    }

    if (!line.runs.some(other => runsConflict(fresh, other))) {
      line.runs.push(fresh);

      return line;
    }
  }

  const line = { baseline: run.baseline, runs: [run] };
  lines.push(line);

  return line;
}

function placeInklessRun(
  run: TextRun,
  lines: LineBuilder[],
  previous: LineBuilder | null,
  baselineTolerance: number,
): LineBuilder {
  const sameBaseline = (line: LineBuilder) =>
    Math.abs(run.baseline - line.baseline) <= baselineTolerance;

  let line = previous && sameBaseline(previous) ? previous : lines.find(sameBaseline);

  if (!line) {
    line = { baseline: run.baseline, runs: [] };
    lines.push(line);
  }

  line.runs.push(run);

  return line;
}

function withoutRepeatedGlyphs(run: TextRun, line: LineBuilder): TextRun | null {
  const existing = line.runs.flatMap(r => r.chars);
  const kept = run.chars.filter(glyph => !existing.some(other => isRepeatedGlyph(glyph, other)));

  if (kept.length === run.chars.length) {
    return run;
  }

  return kept.length > 0 ? createRun(kept) : null;
}

function isRepeatedGlyph(glyph: ExtractedChar, other: ExtractedChar): boolean {
  return (
    glyph.char === other.char &&
    Math.abs(glyph.bbox.x - other.bbox.x) <= glyph.fontSize * REPEAT_POSITION_FACTOR
  );
}

/**
 * Checked per glyph so a run may fill gaps in another (some producers draw
 * narrow glyphs in a second pass); coverage is summed so a glyph straddling
 * two others is still caught.
 */
function runsConflict(a: TextRun, b: TextRun): boolean {
  if (overlapOf(a.inkLeft, a.inkRight, b.inkLeft, b.inkRight) <= 0) {
    return false;
  }

  return hasCoveredGlyph(a, b) || hasCoveredGlyph(b, a);
}

function hasCoveredGlyph(run: TextRun, other: TextRun): boolean {
  for (const glyph of run.chars) {
    if (!occupiesSpace(glyph)) {
      continue;
    }

    const left = glyph.bbox.x;
    const right = left + glyph.bbox.width;
    const tolerance = Math.min(
      glyph.fontSize * GLYPH_COVER_EM_FACTOR,
      glyph.bbox.width * GLYPH_COVER_WIDTH_FACTOR,
    );
    let covered = 0;

    for (const ink of other.chars) {
      if (!occupiesSpace(ink)) {
        continue;
      }

      covered += Math.max(0, overlapOf(left, right, ink.bbox.x, ink.bbox.x + ink.bbox.width));

      if (covered > tolerance) {
        return true;
      }
    }
  }

  return false;
}

function overlapOf(aLeft: number, aRight: number, bLeft: number, bRight: number): number {
  return Math.min(aRight, bRight) - Math.max(aLeft, bLeft);
}

/**
 * Flatten a line's runs into reading order: merged by glyph x with intra-run
 * order preserved, or plain stream order when the line is RTL-placed.
 */
function orderRuns(runs: TextRun[]): { chars: ExtractedChar[]; rtlPlaced: boolean } {
  const streamOrder = runs.flatMap(run => run.chars);

  if (isRtlPlaced(streamOrder)) {
    return { chars: streamOrder, rtlPlaced: true };
  }

  return { chars: mergeRunsByPosition(runs), rtlPlaced: false };
}

function mergeRunsByPosition(runs: TextRun[]): ExtractedChar[] {
  const cursors = runs.map(run => ({ chars: run.chars, index: 0 }));
  const merged: ExtractedChar[] = [];

  for (;;) {
    let next: (typeof cursors)[number] | null = null;

    for (const cursor of cursors) {
      if (cursor.index >= cursor.chars.length) {
        continue;
      }

      if (!next || cursor.chars[cursor.index].bbox.x < next.chars[next.index].bbox.x) {
        next = cursor;
      }
    }

    if (!next) {
      return merged;
    }

    merged.push(next.chars[next.index]);
    next.index++;
  }
}

/**
 * Design tools (Figma, Canva) place LTR glyphs right-to-left via TJ
 * adjustments, and genuine RTL text is emitted in logical order; in both
 * cases stream order is reading order. Measured per character, not per run,
 * so two runs drawn right-then-left (page number, then title) don't trigger
 * it. Mixed bidi text needs a real bidi algorithm and is not handled.
 */
function isRtlPlaced(streamOrder: ExtractedChar[]): boolean {
  if (streamOrder.length < 2) {
    return false;
  }

  let decreasingCount = 0;

  for (let i = 1; i < streamOrder.length; i++) {
    if (streamOrder[i].bbox.x < streamOrder[i - 1].bbox.x) {
      decreasingCount++;
    }
  }

  return decreasingCount / (streamOrder.length - 1) >= RTL_PLACED_THRESHOLD;
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

    const fontChanged =
      char.fontName !== currentFontName || Math.abs(char.fontSize - currentFontSize) > 0.5;

    // In RTL-placed lines the next character sits to the left of the previous.
    // A gap beside a real space glyph is the same logical space, not a second one.
    const gap = rtlPlaced
      ? prevChar.bbox.x - (char.bbox.x + char.bbox.width)
      : char.bbox.x - (prevChar.bbox.x + prevChar.bbox.width);
    const avgFontSize = (prevChar.fontSize + char.fontSize) / 2;
    const needsSpace =
      gap > avgFontSize * spaceThreshold && !isWhitespace(prevChar) && !isWhitespace(char);

    if (needsSpace) {
      currentSpan.push(createSpaceChar(prevChar, char, rtlPlaced));
    }

    if (fontChanged) {
      spans.push(buildSpan(currentSpan));

      currentSpan = [char];
      currentFontName = char.fontName;
      currentFontSize = char.fontSize;
    } else {
      currentSpan.push(char);
    }
  }

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
function averageBaseline(chars: ExtractedChar[]): number {
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
