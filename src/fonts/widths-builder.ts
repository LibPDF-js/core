/**
 * Widths Array Builder - Generates /W arrays for CID fonts.
 *
 * The /W array format is:
 *   [cid [w1 w2 w3 ...]]  - individual widths starting at cid
 *   [cidStart cidEnd w]   - same width for a range
 *
 * Example: [1 [500 600 700] 100 200 500]
 *   CID 1 = 500, CID 2 = 600, CID 3 = 700
 *   CIDs 100-200 = 500
 */

import { PdfArray } from "#src/objects/pdf-array.ts";
import { PdfNumber } from "#src/objects/pdf-number.ts";
import type { FontProgram } from "./font-program/index.ts";

/**
 * Width entry types for the /W array.
 */
export type WidthEntry =
  | { type: "individual"; startCid: number; widths: number[] }
  | { type: "range"; startCid: number; endCid: number; width: number };

/**
 * Build a /W array for a CID font from used glyphs.
 *
 * With CIDToGIDMap /Identity, the content stream contains GIDs.
 * Therefore the /W array must be keyed by GID.
 *
 * @param gidToCodePoint - Map of GIDs to code points that are used
 * @param fontProgram - The font program to get widths from
 * @returns Array of width entries keyed by GID
 */
export function buildWidthsArrayFromGids(
  gidToCodePoint: Map<number, number>,
  fontProgram: FontProgram,
): WidthEntry[] {
  // Build widths keyed by GID (since content stream contains GIDs)
  const gidWidths = new Map<number, number>();

  for (const [gid, _codePoint] of gidToCodePoint) {
    const advanceWidth = fontProgram.getAdvanceWidth(gid);
    // Scale to 1000 units per em
    const width = Math.round((advanceWidth * 1000) / fontProgram.unitsPerEm);
    gidWidths.set(gid, width);
  }

  return optimizeWidthsArray(gidWidths);
}

/**
 * @deprecated Use buildWidthsArrayFromGids instead.
 * Build a /W array for a CID font from used glyphs.
 *
 * @param usedCodePoints - Map of code points to GIDs that are used
 * @param fontProgram - The font program to get widths from
 * @returns Array of width entries
 */
export function buildWidthsArray(
  usedCodePoints: Map<number, number>,
  fontProgram: FontProgram,
): WidthEntry[] {
  // For Identity-H encoding, CID = code point (LEGACY - incorrect with CIDToGIDMap /Identity)
  // Get widths for each used code point
  const cidWidths = new Map<number, number>();

  for (const [codePoint, gid] of usedCodePoints) {
    const advanceWidth = fontProgram.getAdvanceWidth(gid);
    // Scale to 1000 units per em
    const width = Math.round((advanceWidth * 1000) / fontProgram.unitsPerEm);
    cidWidths.set(codePoint, width);
  }

  return optimizeWidthsArray(cidWidths);
}

/**
 * Optimize widths into an efficient /W array representation.
 *
 * Strategy:
 * 1. Group consecutive CIDs
 * 2. If a group has all same widths and length >= 3, use range format
 * 3. Otherwise use individual widths format
 */
export function optimizeWidthsArray(cidWidths: Map<number, number>): WidthEntry[] {
  if (cidWidths.size === 0) {
    return [];
  }

  // Sort CIDs
  const sortedCids = [...cidWidths.keys()].sort((a, b) => a - b);
  const entries: WidthEntry[] = [];

  let groupStart = 0;

  while (groupStart < sortedCids.length) {
    // Find consecutive run
    let groupEnd = groupStart;
    while (
      groupEnd < sortedCids.length - 1 &&
      sortedCids[groupEnd + 1] === sortedCids[groupEnd] + 1
    ) {
      groupEnd++;
    }

    const startCid = sortedCids[groupStart];
    const endCid = sortedCids[groupEnd];
    const groupLength = groupEnd - groupStart + 1;

    // Check if all widths in this group are the same
    const firstWidth = cidWidths.get(startCid);

    if (firstWidth === undefined) {
      // Should not happen, but skip this group if it does
      groupStart = groupEnd + 1;
      continue;
    }

    let allSame = true;

    for (let i = groupStart + 1; i <= groupEnd; i++) {
      if (cidWidths.get(sortedCids[i]) !== firstWidth) {
        allSame = false;
        break;
      }
    }

    if (allSame && groupLength >= 3) {
      // Use range format
      entries.push({
        type: "range",
        startCid,
        endCid,
        width: firstWidth,
      });
    } else {
      // Use individual widths format
      const widths: number[] = [];

      for (let i = groupStart; i <= groupEnd; i++) {
        // biome-ignore lint/style/noNonNullAssertion: get(...) above if not has(...)
        widths.push(cidWidths.get(sortedCids[i])!);
      }

      entries.push({
        type: "individual",
        startCid,
        widths,
      });
    }

    groupStart = groupEnd + 1;
  }

  return entries;
}

/**
 * Serialize width entries to a PDF array string.
 *
 * @deprecated Use widthEntriesToPdfArray instead for better performance.
 * @param entries - Width entries from buildWidthsArray
 * @returns String representation for PDF (e.g., "[1 [500 600] 100 200 500]")
 */
export function serializeWidthsArray(entries: WidthEntry[]): string {
  if (entries.length === 0) {
    return "[]";
  }

  const parts: string[] = [];

  for (const entry of entries) {
    if (entry.type === "individual") {
      parts.push(`${entry.startCid} [${entry.widths.join(" ")}]`);
    } else {
      parts.push(`${entry.startCid} ${entry.endCid} ${entry.width}`);
    }
  }

  return `[${parts.join(" ")}]`;
}

/**
 * Convert width entries directly to a PdfArray.
 *
 * This avoids the unnecessary string serialization/parsing round-trip.
 *
 * @param entries - Width entries from buildWidthsArray
 * @returns PdfArray for the /W entry
 */
export function widthEntriesToPdfArray(entries: WidthEntry[]): PdfArray {
  const result: (PdfNumber | PdfArray)[] = [];

  for (const entry of entries) {
    if (entry.type === "individual") {
      // Format: startCid [w1 w2 w3 ...]
      result.push(PdfNumber.of(entry.startCid));
      result.push(new PdfArray(entry.widths.map(w => PdfNumber.of(w))));
    } else {
      // Format: startCid endCid width
      result.push(PdfNumber.of(entry.startCid));
      result.push(PdfNumber.of(entry.endCid));
      result.push(PdfNumber.of(entry.width));
    }
  }

  return new PdfArray(result);
}

/**
 * Build a simple /Widths array for simple fonts (not CID fonts).
 *
 * @param firstChar - First character code
 * @param lastChar - Last character code
 * @param getWidth - Function to get width for a character code
 * @returns Array of widths from firstChar to lastChar
 */
export function buildSimpleWidthsArray(
  firstChar: number,
  lastChar: number,
  getWidth: (code: number) => number,
): number[] {
  const widths: number[] = [];

  for (let code = firstChar; code <= lastChar; code++) {
    widths.push(getWidth(code));
  }

  return widths;
}
