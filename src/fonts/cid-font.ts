/**
 * CIDFont - Descendant font for Type0 composite fonts.
 *
 * CIDFonts contain the actual glyph descriptions and metrics for
 * composite (Type0) fonts. They use CIDs (Character IDs) to identify
 * glyphs rather than character codes.
 *
 * Font structure:
 * <<
 *   /Type /Font
 *   /Subtype /CIDFontType2  (or /CIDFontType0)
 *   /BaseFont /NotoSansCJK-Regular
 *   /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >>
 *   /FontDescriptor 14 0 R
 *   /W [1 [500 600] 100 200 500]  % Complex width format
 *   /DW 1000
 *   /CIDToGIDMap /Identity
 * >>
 */

import { PdfArray } from "#src/objects/pdf-array";
import type { PdfDict } from "#src/objects/pdf-dict";
import { PdfRef } from "#src/objects/pdf-ref.ts";

import { type EmbeddedParserOptions, parseEmbeddedProgram } from "./embedded-parser";
import { FontDescriptor } from "./font-descriptor";
import type { FontProgram } from "./font-program/index.ts";

export type CIDFontSubtype = "CIDFontType0" | "CIDFontType2";

/**
 * CID System Info describes the character collection.
 */
export interface CIDSystemInfo {
  registry: string;
  ordering: string;
  supplement: number;
}

/**
 * CIDFont handles CID-keyed fonts (descendants of Type0).
 */
export class CIDFont {
  /** Font subtype (CIDFontType0 = CFF, CIDFontType2 = TrueType) */
  readonly subtype: CIDFontSubtype;

  /** Base font name */
  readonly baseFontName: string;

  /** CID System Info */
  readonly cidSystemInfo: CIDSystemInfo;

  /** Font descriptor with metrics */
  readonly descriptor: FontDescriptor | null;

  /** Default width for CIDs not in /W array */
  readonly defaultWidth: number;

  /** Width map from /W array */
  private readonly widths: CIDWidthMap;

  /** CID to GID mapping (null = Identity, Uint16Array = explicit map) */
  private readonly cidToGidMap: "Identity" | Uint16Array | null;

  /** Embedded font program (if available) */
  private readonly embeddedProgram: FontProgram | null;

  constructor(options: {
    subtype: CIDFontSubtype;
    baseFontName: string;
    cidSystemInfo?: CIDSystemInfo;
    descriptor?: FontDescriptor | null;
    defaultWidth?: number;
    widths?: CIDWidthMap;
    cidToGidMap?: "Identity" | Uint16Array | null;
    embeddedProgram?: FontProgram | null;
  }) {
    this.subtype = options.subtype;
    this.baseFontName = options.baseFontName;
    this.cidSystemInfo = options.cidSystemInfo ?? {
      registry: "Adobe",
      ordering: "Identity",
      supplement: 0,
    };
    this.descriptor = options.descriptor ?? null;
    this.defaultWidth = options.defaultWidth ?? 1000;
    this.widths = options.widths ?? new CIDWidthMap();
    this.cidToGidMap = options.cidToGidMap ?? "Identity";
    this.embeddedProgram = options.embeddedProgram ?? null;
  }

  /**
   * Check if an embedded font program is available.
   */
  get hasEmbeddedProgram(): boolean {
    return this.embeddedProgram !== null;
  }

  /**
   * Get the embedded font program, if available.
   */
  getEmbeddedProgram(): FontProgram | null {
    return this.embeddedProgram;
  }

  /**
   * Get width for a CID in glyph units (1000 = 1 em).
   */
  getWidth(cid: number): number {
    // Try explicit widths first
    const explicitWidth = this.widths.get(cid);

    if (explicitWidth !== undefined) {
      return explicitWidth;
    }

    // Try embedded font program
    if (this.embeddedProgram) {
      const gid = this.getGid(cid);

      if (gid !== 0 || cid === 0) {
        const width = this.embeddedProgram.getAdvanceWidth(gid);

        // Convert from font units to 1000 units
        return Math.round((width * 1000) / this.embeddedProgram.unitsPerEm);
      }
    }

    return this.defaultWidth;
  }

  /**
   * Get GID (glyph index) for a CID.
   * Used when accessing embedded font data.
   */
  getGid(cid: number): number {
    if (this.cidToGidMap === "Identity" || this.cidToGidMap === null) {
      return cid;
    }

    return this.cidToGidMap[cid] ?? 0;
  }
}

/**
 * Efficient storage for CID width mappings.
 * Handles the complex /W array format from PDF.
 */
export class CIDWidthMap {
  /** Individual CID -> width mappings */
  private readonly individual = new Map<number, number>();

  /** Range mappings: all CIDs in range have same width */
  private readonly ranges: Array<{ start: number; end: number; width: number }> = [];

  /**
   * Get width for a CID.
   */
  get(cid: number): number | undefined {
    // Check individual mappings first (more specific)
    const individual = this.individual.get(cid);

    if (individual !== undefined) {
      return individual;
    }

    // Check range mappings
    for (const range of this.ranges) {
      if (cid >= range.start && cid <= range.end) {
        return range.width;
      }
    }

    return undefined;
  }

  /**
   * Set width for a single CID.
   */
  set(cid: number, width: number): void {
    this.individual.set(cid, width);
  }

  /**
   * Add a range where all CIDs have the same width.
   */
  addRange(start: number, end: number, width: number): void {
    this.ranges.push({ start, end, width });
  }

  /**
   * Get the number of individual mappings.
   */
  get size(): number {
    return this.individual.size;
  }
}

/**
 * Parse /W array format from PDF.
 *
 * Format:
 *   [cid [w1 w2 ...]] - individual widths starting at cid
 *   [cidStart cidEnd w] - same width for range
 *
 * Example: [1 [500 600 700] 100 200 500]
 *   CID 1 = 500, CID 2 = 600, CID 3 = 700
 *   CIDs 100-200 = 500
 */
export function parseCIDWidths(wArray: PdfArray): CIDWidthMap {
  const map = new CIDWidthMap();
  let i = 0;

  while (i < wArray.length) {
    const first = wArray.at(i);

    if (!first || first.type !== "number") {
      i++;
      continue;
    }

    const startCid = first.value;
    const second = wArray.at(i + 1);

    if (!second) {
      break;
    }

    if (second.type === "array") {
      // Individual widths: cid [w1 w2 w3 ...]
      const widthArray = second as PdfArray;

      for (let j = 0; j < widthArray.length; j++) {
        const widthItem = widthArray.at(j);

        if (widthItem && widthItem.type === "number") {
          map.set(startCid + j, widthItem.value);
        }
      }

      i += 2;
    } else if (second.type === "number") {
      // Range: cidStart cidEnd width
      const endCid = second.value;
      const third = wArray.at(i + 2);

      if (third && third.type === "number") {
        map.addRange(startCid, endCid, third.value);
      }

      i += 3;
    } else {
      i++;
    }
  }

  return map;
}

/**
 * Parse a CIDFont from a PDF font dictionary.
 */
export function parseCIDFont(
  dict: PdfDict,
  options: {
    resolveRef?: (ref: unknown) => PdfDict | PdfArray | null;
    decodeStream?: (stream: unknown) => Uint8Array | null;
  } = {},
): CIDFont {
  const subtypeName = dict.getName("Subtype");
  const subtype = (subtypeName?.value ?? "CIDFontType2") as CIDFontSubtype;
  const baseFontName = dict.getName("BaseFont")?.value ?? "Unknown";

  // Parse CIDSystemInfo
  let cidSystemInfo: CIDSystemInfo = {
    registry: "Adobe",
    ordering: "Identity",
    supplement: 0,
  };

  const sysInfoDict = dict.getDict("CIDSystemInfo");

  if (sysInfoDict) {
    cidSystemInfo = {
      registry: sysInfoDict.getString("Registry")?.asString() ?? "Adobe",
      ordering: sysInfoDict.getString("Ordering")?.asString() ?? "Identity",
      supplement: sysInfoDict.getNumber("Supplement")?.value ?? 0,
    };
  }

  // Parse default width
  const defaultWidth = dict.getNumber("DW")?.value ?? 1000;

  // Parse /W array (can be inline or a ref)
  let widths = new CIDWidthMap();
  let w = dict.get("W");

  let wArray: PdfArray | null = null;

  // W might be a ref to an array - resolve it
  if (w instanceof PdfRef && options.resolveRef) {
    w = options.resolveRef(w) ?? undefined;
  }

  if (w instanceof PdfArray) {
    wArray = w;
  }

  if (wArray) {
    widths = parseCIDWidths(wArray);
  }

  // Parse FontDescriptor and embedded font program
  let descriptor: FontDescriptor | null = null;
  let embeddedProgram: FontProgram | null = null;

  const descriptorRef = dict.get("FontDescriptor");

  if (descriptorRef && options.resolveRef) {
    const descriptorDict = options.resolveRef(descriptorRef);

    if (descriptorDict && descriptorDict.type === "dict") {
      descriptor = FontDescriptor.parse(descriptorDict as PdfDict);

      // Try to parse embedded font program from FontDescriptor
      if (options.decodeStream) {
        const parserOptions: EmbeddedParserOptions = {
          decodeStream: options.decodeStream,
          resolveRef: options.resolveRef as ((ref: unknown) => unknown) | undefined,
        };

        embeddedProgram = parseEmbeddedProgram(descriptorDict as PdfDict, parserOptions);
      }
    }
  }

  // Parse CIDToGIDMap
  let cidToGidMap: "Identity" | Uint16Array | null = "Identity";
  const cidToGidValue = dict.get("CIDToGIDMap");

  if (cidToGidValue) {
    if (cidToGidValue.type === "name" && cidToGidValue.value === "Identity") {
      cidToGidMap = "Identity";
    }

    // Stream-based CIDToGIDMap - decode to Uint16Array
    if (cidToGidValue.type === "stream" && options.decodeStream) {
      const mapData = options.decodeStream(cidToGidValue);

      if (mapData && mapData.length >= 2) {
        // CIDToGIDMap is a stream of 2-byte big-endian integers
        const numEntries = mapData.length / 2;
        cidToGidMap = new Uint16Array(numEntries);

        for (let i = 0; i < numEntries; i++) {
          cidToGidMap[i] = (mapData[i * 2] << 8) | mapData[i * 2 + 1];
        }
      }
    }
  }

  return new CIDFont({
    subtype,
    baseFontName,
    cidSystemInfo,
    descriptor,
    defaultWidth,
    widths,
    cidToGidMap,
    embeddedProgram,
  });
}
