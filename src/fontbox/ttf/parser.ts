/**
 * TrueType Font Parser.
 *
 * Parses TrueType (.ttf) and OpenType (.otf) font files.
 *
 * Based on Apache PDFBox fontbox TTFParser.java
 */

import { BinaryScanner } from "#src/io/binary-scanner.ts";

import { TrueTypeFont } from "./truetype-font.ts";
import type { TableRecord } from "./types.ts";

/** TrueType magic number (version 1.0 as Fixed) */
const TTF_MAGIC = 0x00010000;
/** TrueType magic number ('true' - Apple variant) */
const TTF_TRUE_MAGIC = 0x74727565;
/** OpenType magic number ('OTTO') */
const OTF_MAGIC = 0x4f54544f;
/** TrueType collection magic ('ttcf') */
const TTC_MAGIC = 0x74746366;

export interface ParseOptions {
  /**
   * If true, the font is embedded in a PDF and some tables may be optional.
   * @default false
   */
  isEmbedded?: boolean;
}

/**
 * Parse a TrueType or OpenType font from bytes.
 *
 * @param data - Font file bytes
 * @param options - Parse options
 * @returns Parsed TrueTypeFont
 * @throws {Error} if the font is invalid or unsupported
 */
export function parseTTF(data: Uint8Array, options: ParseOptions = {}): TrueTypeFont {
  const scanner = new BinaryScanner(data);
  const isEmbedded = options.isEmbedded ?? false;

  // Read offset table (font header)
  const version = scanner.readUint32();

  // Check magic number
  if (version === TTC_MAGIC) {
    throw new Error("TrueType Collections (.ttc) are not yet supported");
  }

  if (version !== TTF_MAGIC && version !== TTF_TRUE_MAGIC && version !== OTF_MAGIC) {
    throw new Error(`Invalid font: unknown version 0x${version.toString(16)}`);
  }

  const isOpenType = version === OTF_MAGIC;
  const numTables = scanner.readUint16();
  const _searchRange = scanner.readUint16();
  const _entrySelector = scanner.readUint16();
  const _rangeShift = scanner.readUint16();

  // Read table directory
  const tableRecords = new Map<string, TableRecord>();

  for (let i = 0; i < numTables; i++) {
    const tag = scanner.readTag();
    const checksum = scanner.readUint32();
    const offset = scanner.readUint32();
    const length = scanner.readUint32();

    // Skip zero-length tables (except glyf which can be empty)
    if (length === 0 && tag !== "glyf") {
      continue;
    }

    // Validate table doesn't exceed file size
    if (offset + length > data.length) {
      // PDFBOX-5285: Skip tables that go past file size
      console.warn(
        `Skipping table '${tag}' which goes past file size; offset: ${offset}, length: ${length}, file size: ${data.length}`,
      );
      continue;
    }

    tableRecords.set(tag, { tag, checksum, offset, length });
  }

  // Create font instance
  const font = new TrueTypeFont(data, version, tableRecords);

  // Validate required tables
  validateTables(font, isEmbedded, isOpenType);

  return font;
}

/**
 * Validate that required tables are present.
 */
function validateTables(font: TrueTypeFont, isEmbedded: boolean, isOpenType: boolean): void {
  // Check for CFF outlines
  const hasCFF = font.hasTable("CFF ") || font.hasTable("CFF2");
  const isPostScript = isOpenType && hasCFF;

  // Required tables
  if (!font.hasTable("head")) {
    throw new Error("'head' table is mandatory");
  }

  if (!font.hasTable("hhea")) {
    throw new Error("'hhea' table is mandatory");
  }

  if (!font.hasTable("maxp")) {
    throw new Error("'maxp' table is mandatory");
  }

  if (!font.hasTable("hmtx")) {
    throw new Error("'hmtx' table is mandatory");
  }

  // Tables required for non-embedded fonts
  if (!isEmbedded) {
    if (!font.hasTable("post")) {
      throw new Error("'post' table is mandatory");
    }

    if (!font.hasTable("name")) {
      throw new Error("'name' table is mandatory");
    }

    if (!font.hasTable("cmap")) {
      throw new Error("'cmap' table is mandatory");
    }
  }

  // Tables required for TrueType outlines (not CFF)
  if (!isPostScript) {
    if (!font.hasTable("loca")) {
      throw new Error("'loca' table is mandatory");
    }

    if (!font.hasTable("glyf")) {
      throw new Error("'glyf' table is mandatory");
    }
  } else if (!isOpenType) {
    // CFF in non-OpenType is not supported
    throw new Error("TrueType fonts using CFF outlines are not supported");
  }
}

/**
 * Quick check if bytes look like a TrueType/OpenType font.
 */
export function isTTF(data: Uint8Array): boolean {
  if (data.length < 4) {
    return false;
  }

  const version = (data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3];

  return (
    version === TTF_MAGIC ||
    version === TTF_TRUE_MAGIC ||
    version === OTF_MAGIC ||
    version === TTC_MAGIC
  );
}
