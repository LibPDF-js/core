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

import type { RefResolver } from "#src/helpers/types.ts";
import { PdfName } from "#src/index.ts";
import { PdfArray } from "#src/objects/pdf-array";
import type { PdfDict } from "#src/objects/pdf-dict";
import { PdfRef } from "#src/objects/pdf-ref.ts";
import { PdfStream } from "#src/objects/pdf-stream.ts";

import { type EmbeddedParserOptions, parseEmbeddedProgram } from "./embedded-parser";
import { FontDescriptor } from "./font-descriptor";
import { isCFFCIDFontProgram } from "./font-program/cff-cid.ts";
import type { FontProgram } from "./font-program/index.ts";
import type { ToUnicodeMap } from "./to-unicode";

export type CIDFontSubtype = "CIDFontType0" | "CIDFontType2";

const isCIDFontSubtype = (subtype: unknown): subtype is CIDFontSubtype => {
  return subtype === "CIDFontType0" || subtype === "CIDFontType2";
};

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

  /** Inverse CID to GID map: GID → CID (built lazily for stream-based maps) */
  private gidToCidMap: Map<number, number> | null = null;

  /** Embedded font program (if available) */
  private readonly embeddedProgram: FontProgram | null;

  /** ToUnicode map from the parent Type0 font, if available */
  private readonly toUnicodeMap: ToUnicodeMap | null;

  /** Reverse ToUnicode map: Unicode code point -> character code */
  private unicodeToCharCodeMap: Map<number, number> | null = null;

  constructor(options: {
    subtype: CIDFontSubtype;
    baseFontName: string;
    cidSystemInfo?: CIDSystemInfo;
    descriptor?: FontDescriptor | null;
    defaultWidth?: number;
    widths?: CIDWidthMap;
    cidToGidMap?: "Identity" | Uint16Array | null;
    embeddedProgram?: FontProgram | null;
    toUnicodeMap?: ToUnicodeMap | null;
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
    this.toUnicodeMap = options.toUnicodeMap ?? null;
  }

  /**
   * Check if an embedded font program is available.
   */
  get hasEmbeddedProgram(): boolean {
    return this.embeddedProgram !== null;
  }

  /**
   * Check if the embedded font program has renderable glyph outlines.
   *
   * Some PDFs embed fonts with metrics and cmap data but stripped outlines.
   * These fonts are usable for text extraction but cannot render new text.
   */
  get hasRenderableGlyphs(): boolean {
    return this.embeddedProgram?.hasRenderableGlyphs() ?? false;
  }

  /**
   * Check whether the embedded program can render a glyph for the given CID.
   */
  hasRenderableGlyphForCID(cid: number): boolean {
    if (!this.embeddedProgram) {
      return false;
    }

    const gid = this.getGid(cid);

    return this.embeddedProgram.hasRenderableGlyph(gid);
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
    if (this.embeddedProgram && isCFFCIDFontProgram(this.embeddedProgram)) {
      return this.embeddedProgram.getGlyphIdForCID(cid);
    }

    if (this.cidToGidMap === "Identity" || this.cidToGidMap === null) {
      return cid;
    }

    return this.cidToGidMap[cid] ?? 0;
  }

  /**
   * Whether the CIDToGIDMap is Identity (or absent, which defaults to Identity).
   */
  get isIdentityCidToGid(): boolean {
    return this.cidToGidMap === "Identity" || this.cidToGidMap === null;
  }

  /**
   * Get the character code (= CID for Identity-H) to write in a PDF string
   * for a given Unicode code point.
   *
   * The encoding pipeline for Identity-H is:
   *   character code (in PDF string) = CID (because Identity-H maps 1:1)
   *   CID → GID (via CIDToGIDMap)
   *   GID → glyph in font file
   *
   * We need to find the character code such that after the CIDToGIDMap
   * transformation, we get the GID corresponding to the desired Unicode
   * character in the embedded font program.
   *
   * For Identity CIDToGIDMap: charCode = CID = GID = fontProgram.getGlyphId(unicode)
   * For stream CIDToGIDMap: charCode = CID where CIDToGIDMap[CID] = desired GID
   */
  getCharCodeForUnicode(unicode: number): number {
    return this.tryGetCharCodeForUnicode(unicode) ?? unicode;
  }

  /**
   * Try to resolve the character code (= CID for Identity-H) for a Unicode
   * code point. Returns null when the mapping cannot be proven.
   */
  tryGetCharCodeForUnicode(unicode: number): number | null {
    const fontProgram = this.getEmbeddedProgram();

    if (fontProgram) {
      const desiredGid = fontProgram.getGlyphId(unicode);

      if (desiredGid !== 0) {
        if (this.isIdentityCidToGid) {
          // Identity CIDToGIDMap: CID = GID, so write GID directly.
          return desiredGid;
        }

        const cid = this.getCharCodeForGid(desiredGid);

        if (cid !== null) {
          return cid;
        }
      }
    }

    if (!this.toUnicodeMap) {
      return null;
    }

    if (!this.unicodeToCharCodeMap) {
      this.unicodeToCharCodeMap = new Map();
      const unicodeToCharCodeMap = this.unicodeToCharCodeMap;

      this.toUnicodeMap.forEach((unicodeValue, charCode) => {
        const chars = Array.from(unicodeValue);

        if (chars.length !== 1) {
          return;
        }

        const codePoint = chars[0].codePointAt(0);

        if (codePoint === undefined || unicodeToCharCodeMap.has(codePoint)) {
          return;
        }

        unicodeToCharCodeMap.set(codePoint, charCode);
      });
    }

    return this.unicodeToCharCodeMap.get(unicode) ?? null;
  }

  private getCharCodeForGid(gid: number): number | null {
    if (!this.gidToCidMap) {
      this.gidToCidMap = new Map();

      if (this.cidToGidMap instanceof Uint16Array) {
        for (let cid = 0; cid < this.cidToGidMap.length; cid++) {
          const mappedGid = this.cidToGidMap[cid];

          if (mappedGid !== 0 && !this.gidToCidMap.has(mappedGid)) {
            this.gidToCidMap.set(mappedGid, cid);
          }
        }
      }
    }

    return this.gidToCidMap.get(gid) ?? null;
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
      const widthArray = second;

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
    resolver?: RefResolver;
    toUnicodeMap?: ToUnicodeMap | null;
  } = {},
): CIDFont {
  const subtypeName = dict.getName("Subtype");
  const subtype = isCIDFontSubtype(subtypeName?.value) ? subtypeName.value : "CIDFontType2";
  const baseFontName = dict.getName("BaseFont")?.value ?? "Unknown";

  // Parse CIDSystemInfo
  let cidSystemInfo: CIDSystemInfo = {
    registry: "Adobe",
    ordering: "Identity",
    supplement: 0,
  };

  const sysInfoDict = dict.getDict("CIDSystemInfo", options.resolver);

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
  const w = dict.get("W", options.resolver);
  const widths = w instanceof PdfArray ? parseCIDWidths(w) : new CIDWidthMap();

  // Parse FontDescriptor and embedded font program
  let descriptor: FontDescriptor | null = null;
  let embeddedProgram: FontProgram | null = null;

  const fontDescriptor = dict.getDict("FontDescriptor", options.resolver);

  if (fontDescriptor) {
    descriptor = FontDescriptor.parse(fontDescriptor);

    embeddedProgram = parseEmbeddedProgram(fontDescriptor, {
      resolver: options.resolver,
    });
  }

  // Parse CIDToGIDMap
  let cidToGidMap: "Identity" | Uint16Array | null = "Identity";
  const cidToGidValue = dict.get("CIDToGIDMap", options.resolver);

  if (cidToGidValue) {
    if (cidToGidValue instanceof PdfName && cidToGidValue.value === "Identity") {
      cidToGidMap = "Identity";
    }

    // Stream-based CIDToGIDMap - decode to Uint16Array
    if (cidToGidValue instanceof PdfStream) {
      const mapData = cidToGidValue.getDecodedData();

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
    toUnicodeMap: options.toUnicodeMap,
  });
}
