/**
 * The 'cmap' table - Character to Glyph Index Mapping Table.
 *
 * Maps character codes to glyph indices.
 * Required in all TrueType fonts.
 *
 * Based on Apache PDFBox fontbox CmapTable.java and CmapSubtable.java
 * @see https://learn.microsoft.com/en-us/typography/opentype/spec/cmap
 */

import type { BinaryScanner } from "#src/io/binary-scanner.ts";

import type { TableParseContext, TTFTable } from "../types.ts";

// Platform IDs
export const PLATFORM_UNICODE = 0;
export const PLATFORM_MACINTOSH = 1;
export const PLATFORM_WINDOWS = 3;

// Windows encoding IDs
export const ENCODING_WIN_SYMBOL = 0;
export const ENCODING_WIN_UNICODE_BMP = 1;
export const ENCODING_WIN_UNICODE_FULL = 10;

// Unicode encoding IDs
export const ENCODING_UNICODE_1_0 = 0;
export const ENCODING_UNICODE_1_1 = 1;
export const ENCODING_UNICODE_2_0_BMP = 3;
export const ENCODING_UNICODE_2_0_FULL = 4;

/**
 * A cmap subtable that maps character codes to glyph IDs.
 */
export interface CmapSubtable {
  /** Platform ID */
  readonly platformId: number;
  /** Platform-specific encoding ID */
  readonly encodingId: number;
  /** Subtable format */
  readonly format: number;

  /** Get glyph ID for a character code. Returns 0 if not found. */
  getGlyphId(charCode: number): number;

  /** Get all character codes that map to a glyph ID */
  getCharCodes(glyphId: number): number[] | undefined;
}

/**
 * Parsed 'cmap' table data.
 */
export interface CmapTable extends TTFTable {
  readonly tag: "cmap";

  /** All subtables in the cmap */
  readonly subtables: CmapSubtable[];

  /** Get subtable by platform and encoding ID */
  getSubtable(platformId: number, encodingId: number): CmapSubtable | undefined;

  /**
   * Get the best Unicode cmap subtable.
   * Preference order: Unicode 2.0 Full, Windows Unicode Full, Unicode 2.0 BMP, Windows Unicode BMP
   */
  getUnicodeCmap(): CmapSubtable | undefined;
}

/**
 * Parse the 'cmap' table.
 */
export function parseCmapTable(ctx: TableParseContext): CmapTable {
  const { data, font } = ctx;
  const tableStart = data.position;

  const _version = data.readUint16();
  const numTables = data.readUint16();

  // Read encoding records
  const encodingRecords: Array<{ platformId: number; encodingId: number; offset: number }> = [];

  for (let i = 0; i < numTables; i++) {
    encodingRecords.push({
      platformId: data.readUint16(),
      encodingId: data.readUint16(),
      offset: data.readUint32(),
    });
  }

  // Parse each subtable
  const numGlyphs = font.numGlyphs;
  const subtables: CmapSubtable[] = [];

  for (const rec of encodingRecords) {
    data.moveTo(tableStart + rec.offset);
    const subtable = parseSubtable(data, rec.platformId, rec.encodingId, numGlyphs);

    if (subtable) {
      subtables.push(subtable);
    }
  }

  return {
    tag: "cmap",
    subtables,

    getSubtable(platformId: number, encodingId: number): CmapSubtable | undefined {
      return subtables.find(s => s.platformId === platformId && s.encodingId === encodingId);
    },

    getUnicodeCmap(): CmapSubtable | undefined {
      // Try in order of preference
      return (
        this.getSubtable(PLATFORM_UNICODE, ENCODING_UNICODE_2_0_FULL) ||
        this.getSubtable(PLATFORM_WINDOWS, ENCODING_WIN_UNICODE_FULL) ||
        this.getSubtable(PLATFORM_UNICODE, ENCODING_UNICODE_2_0_BMP) ||
        this.getSubtable(PLATFORM_WINDOWS, ENCODING_WIN_UNICODE_BMP) ||
        this.getSubtable(PLATFORM_WINDOWS, ENCODING_WIN_SYMBOL) ||
        this.getSubtable(PLATFORM_UNICODE, ENCODING_UNICODE_1_1) ||
        subtables[0]
      );
    },
  };
}

function parseSubtable(
  data: BinaryScanner,
  platformId: number,
  encodingId: number,
  numGlyphs: number,
): CmapSubtable | undefined {
  const format = data.readUint16();

  // Read length and language based on format
  if (format < 8) {
    const _length = data.readUint16();
    const _language = data.readUint16();
  } else {
    data.readUint16(); // reserved
    const _length = data.readUint32();
    const _language = data.readUint32();
  }

  let charToGlyph: Map<number, number>;
  let glyphToChars: Map<number, number[]>;

  switch (format) {
    case 0:
      [charToGlyph, glyphToChars] = parseFormat0(data);
      break;
    case 4:
      [charToGlyph, glyphToChars] = parseFormat4(data, numGlyphs);
      break;
    case 6:
      [charToGlyph, glyphToChars] = parseFormat6(data);
      break;
    case 12:
      [charToGlyph, glyphToChars] = parseFormat12(data, numGlyphs);
      break;
    case 14:
      // Unicode Variation Sequences - not fully supported
      return undefined;
    default:
      // Unsupported format
      return undefined;
  }

  return {
    platformId,
    encodingId,
    format,

    getGlyphId(charCode: number): number {
      return charToGlyph.get(charCode) ?? 0;
    },

    getCharCodes(glyphId: number): number[] | undefined {
      return glyphToChars.get(glyphId);
    },
  };
}

/**
 * Format 0: Byte encoding table (256 entries)
 */
function parseFormat0(data: BinaryScanner): [Map<number, number>, Map<number, number[]>] {
  const charToGlyph = new Map<number, number>();
  const glyphToChars = new Map<number, number[]>();

  for (let i = 0; i < 256; i++) {
    const glyphId = data.readUint8();
    charToGlyph.set(i, glyphId);
    addGlyphMapping(glyphToChars, glyphId, i);
  }

  return [charToGlyph, glyphToChars];
}

/**
 * Format 4: Segment mapping to delta values (BMP only)
 */
function parseFormat4(
  data: BinaryScanner,
  numGlyphs: number,
): [Map<number, number>, Map<number, number[]>] {
  const segCountX2 = data.readUint16();
  const segCount = segCountX2 / 2;
  data.skip(6); // searchRange, entrySelector, rangeShift

  const endCodes: number[] = [];

  for (let i = 0; i < segCount; i++) {
    endCodes.push(data.readUint16());
  }

  data.skip(2); // reservedPad

  const startCodes: number[] = [];

  for (let i = 0; i < segCount; i++) {
    startCodes.push(data.readUint16());
  }

  const idDeltas: number[] = [];

  for (let i = 0; i < segCount; i++) {
    idDeltas.push(data.readInt16());
  }

  const idRangeOffsetPos = data.position;
  const idRangeOffsets: number[] = [];

  for (let i = 0; i < segCount; i++) {
    idRangeOffsets.push(data.readUint16());
  }

  const charToGlyph = new Map<number, number>();
  const glyphToChars = new Map<number, number[]>();

  for (let i = 0; i < segCount; i++) {
    const start = startCodes[i];
    const end = endCodes[i];

    if (start === 0xffff && end === 0xffff) {
      continue; // Terminal segment
    }

    const delta = idDeltas[i];
    const rangeOffset = idRangeOffsets[i];
    const segmentRangeOffset = idRangeOffsetPos + i * 2 + rangeOffset;

    for (let charCode = start; charCode <= end; charCode++) {
      let glyphId: number;

      if (rangeOffset === 0) {
        glyphId = (charCode + delta) & 0xffff;
      } else {
        const glyphOffset = segmentRangeOffset + (charCode - start) * 2;

        data.moveTo(glyphOffset);
        glyphId = data.readUint16();

        if (glyphId !== 0) {
          glyphId = (glyphId + delta) & 0xffff;
        }
      }

      if (glyphId < numGlyphs) {
        charToGlyph.set(charCode, glyphId);
        addGlyphMapping(glyphToChars, glyphId, charCode);
      }
    }
  }

  return [charToGlyph, glyphToChars];
}

/**
 * Format 6: Trimmed table mapping
 */
function parseFormat6(data: BinaryScanner): [Map<number, number>, Map<number, number[]>] {
  const firstCode = data.readUint16();
  const entryCount = data.readUint16();

  const charToGlyph = new Map<number, number>();
  const glyphToChars = new Map<number, number[]>();

  for (let i = 0; i < entryCount; i++) {
    const glyphId = data.readUint16();
    const charCode = firstCode + i;

    charToGlyph.set(charCode, glyphId);

    addGlyphMapping(glyphToChars, glyphId, charCode);
  }

  return [charToGlyph, glyphToChars];
}

/**
 * Format 12: Segmented coverage (full Unicode)
 */
function parseFormat12(
  data: BinaryScanner,
  numGlyphs: number,
): [Map<number, number>, Map<number, number[]>] {
  const numGroups = data.readUint32();

  const charToGlyph = new Map<number, number>();
  const glyphToChars = new Map<number, number[]>();

  for (let i = 0; i < numGroups; i++) {
    const startCode = data.readUint32();
    const endCode = data.readUint32();
    const startGlyph = data.readUint32();

    for (let j = 0; j <= endCode - startCode; j++) {
      const charCode = startCode + j;
      const glyphId = startGlyph + j;

      if (glyphId >= numGlyphs) {
        break;
      }

      charToGlyph.set(charCode, glyphId);
      addGlyphMapping(glyphToChars, glyphId, charCode);
    }
  }

  return [charToGlyph, glyphToChars];
}

function addGlyphMapping(map: Map<number, number[]>, glyphId: number, charCode: number): void {
  const existing = map.get(glyphId);

  if (existing) {
    existing.push(charCode);
  } else {
    map.set(glyphId, [charCode]);
  }
}
