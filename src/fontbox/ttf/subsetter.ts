/**
 * TrueType Font Subsetter.
 *
 * Creates a subset of a TrueType font containing only the glyphs needed.
 * Properly handles composite glyphs by including all referenced components.
 *
 * Based on Apache PDFBox fontbox TTFSubsetter.java
 * @see https://learn.microsoft.com/en-us/typography/opentype/spec/
 */

import type { CmapSubtable } from "./tables/cmap.ts";
import {
  ARG_1_AND_2_ARE_WORDS,
  MORE_COMPONENTS,
  WE_HAVE_A_SCALE,
  WE_HAVE_A_TWO_BY_TWO,
  WE_HAVE_AN_X_AND_Y_SCALE,
  WE_HAVE_INSTRUCTIONS,
} from "./tables/glyf.ts";
import { getMacGlyphIndex } from "./tables/post.ts";
import type { TrueTypeFont } from "./truetype-font.ts";

/** Padding buffer for 4-byte alignment */
const PAD_BUF = new Uint8Array([0, 0, 0, 0]);

/**
 * Options for subsetting.
 */
export interface SubsetOptions {
  /** Tables to keep (if present). If not specified, keeps all tables. */
  keepTables?: string[];
  /** Prefix to add to PostScript name */
  prefix?: string;
}

/**
 * TrueType font subsetter.
 */
export class TTFSubsetter {
  private readonly font: TrueTypeFont;
  private readonly unicodeCmap: CmapSubtable | undefined;
  private readonly uniToGID: Map<number, number> = new Map();
  private readonly glyphIds: Set<number> = new Set();
  private readonly invisibleGlyphIds: Set<number> = new Set();
  private readonly keepTables: string[] | undefined;
  private prefix: string | undefined;
  private hasAddedCompoundReferences = false;

  /**
   * Create a subsetter for the given font.
   */
  constructor(font: TrueTypeFont, options?: SubsetOptions) {
    this.font = font;
    this.keepTables = options?.keepTables;
    this.prefix = options?.prefix;

    // Find the best Unicode cmap
    this.unicodeCmap = font.cmap?.getUnicodeCmap();

    // Always include GID 0 (.notdef)
    this.glyphIds.add(0);
  }

  /**
   * Set the prefix to add to the font's PostScript name.
   */
  setPrefix(prefix: string): void {
    this.prefix = prefix;
  }

  /**
   * Add a character code to the subset.
   */
  add(unicode: number): void {
    if (!this.unicodeCmap) {
      return;
    }

    const gid = this.unicodeCmap.getGlyphId(unicode);

    if (gid !== 0) {
      this.uniToGID.set(unicode, gid);
      this.glyphIds.add(gid);
    }
  }

  /**
   * Add multiple character codes to the subset.
   */
  addAll(unicodes: Iterable<number>): void {
    for (const unicode of unicodes) {
      this.add(unicode);
    }
  }

  /**
   * Add a string's characters to the subset.
   */
  addString(text: string): void {
    for (const char of text) {
      // biome-ignore lint/style/noNonNullAssertion: checked above
      this.add(char.codePointAt(0)!);
    }
  }

  /**
   * Force a character's glyph to be invisible (zero width, no contours).
   */
  forceInvisible(unicode: number): void {
    if (!this.unicodeCmap) {
      return;
    }

    const gid = this.unicodeCmap.getGlyphId(unicode);

    if (gid !== 0) {
      this.invisibleGlyphIds.add(gid);
    }
  }

  /**
   * Get the mapping from new GID to old GID.
   */
  getGIDMap(): Map<number, number> {
    this.addCompoundReferences();

    const sortedGids = [...this.glyphIds].sort((a, b) => a - b);
    const newToOld = new Map<number, number>();
    let newGID = 0;

    for (const oldGID of sortedGids) {
      newToOld.set(newGID, oldGID);
      newGID++;
    }

    return newToOld;
  }

  /**
   * Get the mapping from old GID to new GID.
   * This is used for creating CIDToGIDMap streams in PDF.
   */
  getOldToNewGIDMap(): Map<number, number> {
    this.addCompoundReferences();

    const sortedGids = [...this.glyphIds].sort((a, b) => a - b);
    const oldToNew = new Map<number, number>();
    let newGID = 0;

    for (const oldGID of sortedGids) {
      oldToNew.set(oldGID, newGID);
      newGID++;
    }

    return oldToNew;
  }

  /**
   * Write the subset font to a byte array.
   */
  async write(): Promise<Uint8Array> {
    if (this.glyphIds.size === 0 && this.uniToGID.size === 0) {
      console.warn("Font subset is empty");
    }

    this.addCompoundReferences();

    const sortedGids = [...this.glyphIds].sort((a, b) => a - b);

    // Build tables
    const newLoca: number[] = new Array(sortedGids.length + 1);
    const head = this.buildHeadTable();
    const hhea = this.buildHheaTable(sortedGids);
    const maxp = this.buildMaxpTable(sortedGids);
    const glyf = this.buildGlyfTable(sortedGids, newLoca);
    const loca = this.buildLocaTable(newLoca);
    const hmtx = this.buildHmtxTable(sortedGids);
    const cmap = this.buildCmapTable(sortedGids);
    const name = this.buildNameTable();
    const post = this.buildPostTable(sortedGids);
    const os2 = this.buildOS2Table();

    // Collect tables in order
    const tables = new Map<string, Uint8Array>();

    if (os2) {
      tables.set("OS/2", os2);
    }

    if (cmap) {
      tables.set("cmap", cmap);
    }

    tables.set("glyf", glyf);
    tables.set("head", head);
    tables.set("hhea", hhea);
    tables.set("hmtx", hmtx);
    tables.set("loca", loca);
    tables.set("maxp", maxp);

    if (name) {
      tables.set("name", name);
    }

    if (post) {
      tables.set("post", post);
    }

    // Copy other tables if needed
    for (const tag of this.font.getTableTags()) {
      if (!tables.has(tag) && (!this.keepTables || this.keepTables.includes(tag))) {
        const bytes = this.font.getTableBytes(tag);

        if (bytes) {
          tables.set(tag, bytes);
        }
      }
    }

    // Sort tables alphabetically for better caching
    const sortedTables = new Map([...tables.entries()].sort((a, b) => a[0].localeCompare(b[0])));

    // Calculate total size
    const numTables = sortedTables.size;
    const headerSize = 12 + numTables * 16;
    let dataSize = 0;

    for (const data of sortedTables.values()) {
      dataSize += Math.ceil(data.length / 4) * 4; // 4-byte aligned
    }

    const result = new Uint8Array(headerSize + dataSize);
    const view = new DataView(result.buffer);
    let offset = 0;

    // Write file header
    view.setUint32(offset, 0x00010000); // version 1.0
    offset += 4;
    view.setUint16(offset, numTables);
    offset += 2;

    const searchRange = 2 ** Math.floor(Math.log2(numTables)) * 16;
    const entrySelector = Math.floor(Math.log2(numTables));
    const rangeShift = numTables * 16 - searchRange;

    view.setUint16(offset, searchRange);
    offset += 2;
    view.setUint16(offset, entrySelector);
    offset += 2;
    view.setUint16(offset, rangeShift);
    offset += 2;

    // Write table records
    let dataOffset = headerSize;
    const tableChecksums: Array<{ tag: string; checksum: number; offset: number; length: number }> =
      [];

    for (const [tag, data] of sortedTables) {
      const checksum = this.calculateChecksum(data);
      tableChecksums.push({ tag, checksum, offset: dataOffset, length: data.length });

      // Write table record
      for (let i = 0; i < 4; i++) {
        view.setUint8(offset + i, tag.charCodeAt(i) || 0x20);
      }

      offset += 4;
      view.setUint32(offset, checksum);
      offset += 4;
      view.setUint32(offset, dataOffset);
      offset += 4;
      view.setUint32(offset, data.length);
      offset += 4;

      // Write table data with padding
      result.set(data, dataOffset);
      dataOffset += Math.ceil(data.length / 4) * 4;
    }

    // Calculate and update checksumAdjustment in head table
    const fullChecksum = this.calculateChecksum(result);
    const checksumAdjustment = 0xb1b0afba - fullChecksum;
    const headRecord = tableChecksums.find(t => t.tag === "head");

    if (headRecord) {
      const headView = new DataView(result.buffer, headRecord.offset);
      headView.setUint32(8, checksumAdjustment);
    }

    return result;
  }

  /**
   * Add composite glyph references.
   */
  private addCompoundReferences(): void {
    if (this.hasAddedCompoundReferences) {
      return;
    }

    this.hasAddedCompoundReferences = true;

    const loca = this.font.loca;
    const glyfData = this.font.getTableBytes("glyf");

    if (!loca || !glyfData) {
      return;
    }

    let hasNested: boolean;

    do {
      const toAdd = new Set<number>();

      for (const gid of this.glyphIds) {
        const offset = loca.getOffset(gid);
        const length = loca.getLength(gid);

        if (length === 0) {
          continue;
        }

        const buf = glyfData.subarray(offset, offset + length);

        if (buf.length < 2) {
          continue;
        }

        // Check if composite (numberOfContours == -1)
        const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        const numContours = view.getInt16(0);

        // Simple glyph
        if (numContours >= 0) {
          continue;
        }

        // Parse composite glyph components
        let pos = 10; // Skip header
        let flags: number;

        do {
          flags = view.getUint16(pos);
          pos += 2;
          const componentGid = view.getUint16(pos);
          pos += 2;

          if (!this.glyphIds.has(componentGid)) {
            toAdd.add(componentGid);
          }

          // Skip arguments
          if ((flags & ARG_1_AND_2_ARE_WORDS) !== 0) {
            pos += 4;
          } else {
            pos += 2;
          }

          // Skip transformation
          if ((flags & WE_HAVE_A_TWO_BY_TWO) !== 0) {
            pos += 8;
          } else if ((flags & WE_HAVE_AN_X_AND_Y_SCALE) !== 0) {
            pos += 4;
          } else if ((flags & WE_HAVE_A_SCALE) !== 0) {
            pos += 2;
          }
        } while ((flags & MORE_COMPONENTS) !== 0);
      }

      hasNested = toAdd.size > 0;

      for (const gid of toAdd) {
        this.glyphIds.add(gid);
      }
    } while (hasNested);
  }

  /**
   * Build the head table.
   */
  private buildHeadTable(): Uint8Array {
    const head = this.font.head;

    if (!head) {
      throw new Error("Missing head table");
    }

    const buf = new Uint8Array(54);
    const view = new DataView(buf.buffer);
    let pos = 0;

    this.writeFixed(view, pos, head.version);
    pos += 4;
    this.writeFixed(view, pos, head.fontRevision);
    pos += 4;
    view.setUint32(pos, 0);
    pos += 4; // checksumAdjustment (filled later)
    view.setUint32(pos, head.magicNumber);
    pos += 4;
    view.setUint16(pos, head.flags);
    pos += 2;
    view.setUint16(pos, head.unitsPerEm);
    pos += 2;
    this.writeLongDateTime(view, pos, head.created);
    pos += 8;
    this.writeLongDateTime(view, pos, head.modified);
    pos += 8;
    view.setInt16(pos, head.xMin);
    pos += 2;
    view.setInt16(pos, head.yMin);
    pos += 2;
    view.setInt16(pos, head.xMax);
    pos += 2;
    view.setInt16(pos, head.yMax);
    pos += 2;
    view.setUint16(pos, head.macStyle);
    pos += 2;
    view.setUint16(pos, head.lowestRecPPEM);
    pos += 2;
    view.setInt16(pos, head.fontDirectionHint);
    pos += 2;
    view.setInt16(pos, 1);
    pos += 2; // indexToLocFormat: always use long offsets
    view.setInt16(pos, head.glyphDataFormat);
    pos += 2;

    return buf;
  }

  /**
   * Build the hhea table.
   */
  private buildHheaTable(sortedGids: number[]): Uint8Array {
    const hhea = this.font.hhea;

    if (!hhea) {
      throw new Error("Missing hhea table");
    }

    const buf = new Uint8Array(36);
    const view = new DataView(buf.buffer);
    let pos = 0;

    this.writeFixed(view, pos, hhea.version);
    pos += 4;
    view.setInt16(pos, hhea.ascender);
    pos += 2;
    view.setInt16(pos, hhea.descender);
    pos += 2;
    view.setInt16(pos, hhea.lineGap);
    pos += 2;
    view.setUint16(pos, hhea.advanceWidthMax);
    pos += 2;
    view.setInt16(pos, hhea.minLeftSideBearing);
    pos += 2;
    view.setInt16(pos, hhea.minRightSideBearing);
    pos += 2;
    view.setInt16(pos, hhea.xMaxExtent);
    pos += 2;
    view.setInt16(pos, hhea.caretSlopeRise);
    pos += 2;
    view.setInt16(pos, hhea.caretSlopeRun);
    pos += 2;
    view.setInt16(pos, hhea.caretOffset);
    pos += 2;
    view.setInt16(pos, 0);
    pos += 2; // reserved
    view.setInt16(pos, 0);
    pos += 2; // reserved
    view.setInt16(pos, 0);
    pos += 2; // reserved
    view.setInt16(pos, 0);
    pos += 2; // reserved
    view.setInt16(pos, hhea.metricDataFormat);
    pos += 2;

    // Calculate numberOfHMetrics
    let hmetrics = 0;

    for (const gid of sortedGids) {
      if (gid < hhea.numberOfHMetrics) {
        hmetrics++;
      }
    }
    // Ensure we have at least one if any glyph is >= numberOfHMetrics
    const lastGid = sortedGids[sortedGids.length - 1];

    if (lastGid >= hhea.numberOfHMetrics) {
      if (!sortedGids.includes(hhea.numberOfHMetrics - 1)) {
        hmetrics++;
      }
    }

    view.setUint16(pos, hmetrics);

    return buf;
  }

  /**
   * Build the maxp table.
   */
  private buildMaxpTable(sortedGids: number[]): Uint8Array {
    const maxp = this.font.maxp;

    if (!maxp) {
      throw new Error("Missing maxp table");
    }

    const isVersion1 = maxp.version >= 1.0;
    const size = isVersion1 ? 32 : 6;
    const buf = new Uint8Array(size);
    const view = new DataView(buf.buffer);
    let pos = 0;

    this.writeFixed(view, pos, maxp.version);
    pos += 4;
    view.setUint16(pos, sortedGids.length);
    pos += 2;

    if (isVersion1) {
      view.setUint16(pos, maxp.maxPoints ?? 0);
      pos += 2;
      view.setUint16(pos, maxp.maxContours ?? 0);
      pos += 2;
      view.setUint16(pos, maxp.maxCompositePoints ?? 0);
      pos += 2;
      view.setUint16(pos, maxp.maxCompositeContours ?? 0);
      pos += 2;
      view.setUint16(pos, maxp.maxZones ?? 0);
      pos += 2;
      view.setUint16(pos, maxp.maxTwilightPoints ?? 0);
      pos += 2;
      view.setUint16(pos, maxp.maxStorage ?? 0);
      pos += 2;
      view.setUint16(pos, maxp.maxFunctionDefs ?? 0);
      pos += 2;
      view.setUint16(pos, maxp.maxInstructionDefs ?? 0);
      pos += 2;
      view.setUint16(pos, maxp.maxStackElements ?? 0);
      pos += 2;
      view.setUint16(pos, maxp.maxSizeOfInstructions ?? 0);
      pos += 2;
      view.setUint16(pos, maxp.maxComponentElements ?? 0);
      pos += 2;
      view.setUint16(pos, maxp.maxComponentDepth ?? 0);
      pos += 2;
    }

    return buf;
  }

  /**
   * Build the glyf and loca tables.
   */
  private buildGlyfTable(sortedGids: number[], newLoca: number[]): Uint8Array {
    const loca = this.font.loca;
    const glyfData = this.font.getTableBytes("glyf");

    if (!loca || !glyfData) {
      throw new Error("Missing glyf/loca table");
    }

    const chunks: Uint8Array[] = [];
    let newOffset = 0;
    let newGid = 0;

    for (const gid of sortedGids) {
      newLoca[newGid++] = newOffset;

      const offset = loca.getOffset(gid);
      const length = loca.getLength(gid);

      // Empty glyph or invisible
      if (length === 0 || this.invisibleGlyphIds.has(gid)) {
        continue;
      }

      const buf = new Uint8Array(glyfData.subarray(offset, offset + length));
      const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

      // Check if composite
      const numContours = view.getInt16(0);

      if (numContours < 0) {
        // Rewrite component GIDs
        let pos = 10;
        let flags: number;

        do {
          flags = view.getUint16(pos);
          pos += 2;
          const componentGid = view.getUint16(pos);
          const newComponentGid = this.getNewGlyphId(componentGid, sortedGids, gid);
          view.setUint16(pos, newComponentGid);
          pos += 2;

          // Skip arguments
          if ((flags & ARG_1_AND_2_ARE_WORDS) !== 0) {
            pos += 4;
          } else {
            pos += 2;
          }

          // Skip transformation
          if ((flags & WE_HAVE_A_TWO_BY_TWO) !== 0) {
            pos += 8;
          } else if ((flags & WE_HAVE_AN_X_AND_Y_SCALE) !== 0) {
            pos += 4;
          } else if ((flags & WE_HAVE_A_SCALE) !== 0) {
            pos += 2;
          }
        } while ((flags & MORE_COMPONENTS) !== 0);

        // Handle instructions
        if ((flags & WE_HAVE_INSTRUCTIONS) !== 0) {
          const numInstr = view.getUint16(pos);
          pos += 2 + numInstr;
        }

        // Only write up to pos (trim any extra data)
        chunks.push(buf.subarray(0, pos));
        newOffset += pos;
      } else {
        chunks.push(buf);
        newOffset += buf.length;
      }

      // 4-byte alignment
      const padding = (4 - (newOffset % 4)) % 4;

      if (padding > 0) {
        chunks.push(PAD_BUF.subarray(0, padding));
        newOffset += padding;
      }
    }

    newLoca[newGid] = newOffset;

    // Concatenate chunks
    const result = new Uint8Array(newOffset);
    let resultOffset = 0;

    for (const chunk of chunks) {
      result.set(chunk, resultOffset);
      resultOffset += chunk.length;
    }

    return result;
  }

  /**
   * Build the loca table.
   */
  private buildLocaTable(newLoca: number[]): Uint8Array {
    // Always use long format (32-bit offsets)
    const buf = new Uint8Array(newLoca.length * 4);
    const view = new DataView(buf.buffer);

    for (let i = 0; i < newLoca.length; i++) {
      view.setUint32(i * 4, newLoca[i]);
    }

    return buf;
  }

  /**
   * Build the hmtx table.
   */
  private buildHmtxTable(sortedGids: number[]): Uint8Array {
    const hhea = this.font.hhea;
    const hmtx = this.font.hmtx;

    if (!hhea || !hmtx) {
      throw new Error("Missing hhea/hmtx table");
    }

    const numHMetrics = hhea.numberOfHMetrics;
    const lastMetricGid = numHMetrics - 1;
    const chunks: Uint8Array[] = [];

    let needLastWidth = false;
    const lastGid = sortedGids[sortedGids.length - 1];

    if (lastGid >= numHMetrics && !sortedGids.includes(lastMetricGid)) {
      needLastWidth = true;
    }

    for (const gid of sortedGids) {
      if (this.invisibleGlyphIds.has(gid)) {
        // Zero width and lsb
        chunks.push(new Uint8Array([0, 0, 0, 0]));
      } else if (gid < numHMetrics) {
        // Full metric (width + lsb)
        const width = hmtx.getAdvanceWidth(gid);
        const lsb = hmtx.getLeftSideBearing(gid);
        const buf = new Uint8Array(4);
        const view = new DataView(buf.buffer);
        view.setUint16(0, width);
        view.setInt16(2, lsb);
        chunks.push(buf);
      } else {
        if (needLastWidth) {
          // Copy width from last metric
          const width = hmtx.getAdvanceWidth(lastMetricGid);
          const buf = new Uint8Array(2);
          const view = new DataView(buf.buffer);
          view.setUint16(0, width);
          chunks.push(buf);
          needLastWidth = false;
        }

        // Just lsb
        const lsb = hmtx.getLeftSideBearing(gid);
        const buf = new Uint8Array(2);
        const view = new DataView(buf.buffer);
        view.setInt16(0, lsb);
        chunks.push(buf);
      }
    }

    // Concatenate
    let totalLen = 0;

    for (const chunk of chunks) {
      totalLen += chunk.length;
    }

    const result = new Uint8Array(totalLen);
    let offset = 0;

    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  /**
   * Build the cmap table.
   */
  private buildCmapTable(sortedGids: number[]): Uint8Array | undefined {
    if (!this.font.cmap || this.uniToGID.size === 0) {
      if (this.keepTables && !this.keepTables.includes("cmap")) {
        return undefined;
      }

      return undefined;
    }

    // Build format 4 cmap (Unicode BMP)
    const entries = [...this.uniToGID.entries()].sort((a, b) => a[0] - b[0]);

    // Build segments
    const segments: Array<{ start: number; end: number; delta: number }> = [];
    let segStart = entries[0][0];
    let segEnd = entries[0][0];
    let segDelta = this.getNewGlyphId(entries[0][1], sortedGids) - entries[0][0];

    for (let i = 1; i < entries.length; i++) {
      const [unicode, oldGid] = entries[i];
      const newGid = this.getNewGlyphId(oldGid, sortedGids);
      const expectedDelta = newGid - unicode;

      if (unicode === segEnd + 1 && expectedDelta === segDelta) {
        segEnd = unicode;
      } else {
        if (segDelta !== 0) {
          // Don't emit segments that map to GID 0
          segments.push({ start: segStart, end: segEnd, delta: segDelta });
        }

        segStart = unicode;
        segEnd = unicode;
        segDelta = expectedDelta;
      }
    }

    if (segDelta !== 0) {
      segments.push({ start: segStart, end: segEnd, delta: segDelta });
    }

    // Add terminal segment
    segments.push({ start: 0xffff, end: 0xffff, delta: 1 });

    const segCount = segments.length;
    const searchRange = 2 ** Math.floor(Math.log2(segCount)) * 2;
    const entrySelector = Math.floor(Math.log2(segCount));
    const rangeShift = segCount * 2 - searchRange;

    // Calculate size
    const subtableLength = 16 + segCount * 8;
    const totalLength = 12 + subtableLength; // header + encoding record + subtable

    const buf = new Uint8Array(totalLength);
    const view = new DataView(buf.buffer);
    let pos = 0;

    // cmap header
    view.setUint16(pos, 0);
    pos += 2; // version
    view.setUint16(pos, 1);
    pos += 2; // numTables

    // Encoding record
    view.setUint16(pos, 3);
    pos += 2; // platformID (Windows)
    view.setUint16(pos, 1);
    pos += 2; // encodingID (Unicode BMP)
    view.setUint32(pos, 12);
    pos += 4; // offset

    // Format 4 subtable
    view.setUint16(pos, 4);
    pos += 2; // format
    view.setUint16(pos, subtableLength);
    pos += 2; // length
    view.setUint16(pos, 0);
    pos += 2; // language
    view.setUint16(pos, segCount * 2);
    pos += 2; // segCountX2
    view.setUint16(pos, searchRange);
    pos += 2;
    view.setUint16(pos, entrySelector);
    pos += 2;
    view.setUint16(pos, rangeShift);
    pos += 2;

    // endCode
    for (const seg of segments) {
      view.setUint16(pos, seg.end);
      pos += 2;
    }

    view.setUint16(pos, 0);
    pos += 2; // reservedPad

    // startCode
    for (const seg of segments) {
      view.setUint16(pos, seg.start);
      pos += 2;
    }

    // idDelta
    for (const seg of segments) {
      view.setInt16(pos, seg.delta);
      pos += 2;
    }

    // idRangeOffset (all zeros for delta-based mapping)
    for (let i = 0; i < segCount; i++) {
      view.setUint16(pos, 0);
      pos += 2;
    }

    return buf;
  }

  /**
   * Build the name table.
   */
  private buildNameTable(): Uint8Array | undefined {
    const name = this.font.name;

    if (!name) {
      return undefined;
    }

    if (this.keepTables && !this.keepTables.includes("name")) {
      return undefined;
    }

    // Filter to Windows English US records for IDs 0-6
    const filteredRecords = name.records.filter(
      r =>
        r.platformId === 3 &&
        r.encodingId === 1 &&
        r.languageId === 0x0409 &&
        r.nameId >= 0 &&
        r.nameId < 7,
    );

    if (filteredRecords.length === 0) {
      return undefined;
    }

    // Encode strings
    const encodedStrings: Uint8Array[] = [];

    for (const record of filteredRecords) {
      let value = record.string;

      if (record.nameId === 6 && this.prefix) {
        value = this.prefix + value;
      }

      // Encode as UTF-16BE
      const bytes = new Uint8Array(value.length * 2);
      const view = new DataView(bytes.buffer);

      for (let i = 0; i < value.length; i++) {
        view.setUint16(i * 2, value.charCodeAt(i));
      }

      encodedStrings.push(bytes);
    }

    // Calculate size
    const numRecords = filteredRecords.length;
    const headerSize = 6 + numRecords * 12;
    let stringDataSize = 0;

    for (const s of encodedStrings) {
      stringDataSize += s.length;
    }

    const buf = new Uint8Array(headerSize + stringDataSize);
    const view = new DataView(buf.buffer);
    let pos = 0;

    view.setUint16(pos, 0);
    pos += 2; // format
    view.setUint16(pos, numRecords);
    pos += 2;
    view.setUint16(pos, headerSize);
    pos += 2; // stringOffset

    // Name records
    let stringOffset = 0;

    for (let i = 0; i < numRecords; i++) {
      const record = filteredRecords[i];
      const encoded = encodedStrings[i];

      view.setUint16(pos, record.platformId);
      pos += 2;
      view.setUint16(pos, record.encodingId);
      pos += 2;
      view.setUint16(pos, record.languageId);
      pos += 2;
      view.setUint16(pos, record.nameId);
      pos += 2;
      view.setUint16(pos, encoded.length);
      pos += 2;
      view.setUint16(pos, stringOffset);
      pos += 2;

      stringOffset += encoded.length;
    }

    // String data
    for (const encoded of encodedStrings) {
      buf.set(encoded, pos);
      pos += encoded.length;
    }

    return buf;
  }

  /**
   * Build the post table.
   */
  private buildPostTable(sortedGids: number[]): Uint8Array | undefined {
    const post = this.font.post;

    if (!post || !post.glyphNames) {
      return undefined;
    }

    if (this.keepTables && !this.keepTables.includes("post")) {
      return undefined;
    }

    // Build version 2.0 post table
    const chunks: Uint8Array[] = [];

    // Header (32 bytes)
    const header = new Uint8Array(32);
    const hView = new DataView(header.buffer);
    let pos = 0;

    this.writeFixed(hView, pos, 2.0);
    pos += 4; // formatType
    this.writeFixed(hView, pos, post.italicAngle);
    pos += 4;
    hView.setInt16(pos, post.underlinePosition);
    pos += 2;
    hView.setInt16(pos, post.underlineThickness);
    pos += 2;
    hView.setUint32(pos, post.isFixedPitch);
    pos += 4;
    hView.setUint32(pos, post.minMemType42);
    pos += 4;
    hView.setUint32(pos, post.maxMemType42);
    pos += 4;
    hView.setUint32(pos, post.minMemType1);
    pos += 4;
    hView.setUint32(pos, post.maxMemType1);
    pos += 4;
    chunks.push(header);

    // numGlyphs
    const numGlyphsBuf = new Uint8Array(2);
    new DataView(numGlyphsBuf.buffer).setUint16(0, sortedGids.length);
    chunks.push(numGlyphsBuf);

    // Build glyph name indices
    const customNames: string[] = [];
    const indices: number[] = [];

    for (const gid of sortedGids) {
      const name = post.getName(gid) ?? ".notdef";
      const macIndex = getMacGlyphIndex(name);

      if (macIndex !== undefined) {
        indices.push(macIndex);
      } else {
        let customIndex = customNames.indexOf(name);

        if (customIndex === -1) {
          customIndex = customNames.length;
          customNames.push(name);
        }

        indices.push(258 + customIndex);
      }
    }

    // Write indices
    const indicesBuf = new Uint8Array(indices.length * 2);
    const indicesView = new DataView(indicesBuf.buffer);

    for (let i = 0; i < indices.length; i++) {
      indicesView.setUint16(i * 2, indices[i]);
    }

    chunks.push(indicesBuf);

    // Write custom names (Pascal strings)
    for (const name of customNames) {
      const encoded = new TextEncoder().encode(name);
      const nameBuf = new Uint8Array(1 + encoded.length);
      nameBuf[0] = encoded.length;
      nameBuf.set(encoded, 1);
      chunks.push(nameBuf);
    }

    // Concatenate
    let totalLen = 0;

    for (const chunk of chunks) {
      totalLen += chunk.length;
    }

    const result = new Uint8Array(totalLen);
    let offset = 0;

    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  /**
   * Build the OS/2 table.
   */
  private buildOS2Table(): Uint8Array | undefined {
    const os2 = this.font.os2;

    if (!os2 || this.uniToGID.size === 0) {
      return undefined;
    }

    if (this.keepTables && !this.keepTables.includes("OS/2")) {
      return undefined;
    }

    const buf = new Uint8Array(78);
    const view = new DataView(buf.buffer);
    let pos = 0;

    view.setUint16(pos, os2.version);
    pos += 2;
    view.setInt16(pos, os2.averageCharWidth);
    pos += 2;
    view.setUint16(pos, os2.weightClass);
    pos += 2;
    view.setUint16(pos, os2.widthClass);
    pos += 2;
    view.setInt16(pos, os2.fsType);
    pos += 2;
    view.setInt16(pos, os2.subscriptXSize);
    pos += 2;
    view.setInt16(pos, os2.subscriptYSize);
    pos += 2;
    view.setInt16(pos, os2.subscriptXOffset);
    pos += 2;
    view.setInt16(pos, os2.subscriptYOffset);
    pos += 2;
    view.setInt16(pos, os2.superscriptXSize);
    pos += 2;
    view.setInt16(pos, os2.superscriptYSize);
    pos += 2;
    view.setInt16(pos, os2.superscriptXOffset);
    pos += 2;
    view.setInt16(pos, os2.superscriptYOffset);
    pos += 2;
    view.setInt16(pos, os2.strikeoutSize);
    pos += 2;
    view.setInt16(pos, os2.strikeoutPosition);
    pos += 2;
    view.setInt16(pos, os2.familyClass);
    pos += 2;
    buf.set(os2.panose, pos);
    pos += 10;

    // Unicode ranges (set to 0)
    view.setUint32(pos, 0);
    pos += 4;
    view.setUint32(pos, 0);
    pos += 4;
    view.setUint32(pos, 0);
    pos += 4;
    view.setUint32(pos, 0);
    pos += 4;

    // Vendor ID
    const vendorBytes = new TextEncoder().encode(os2.achVendId);
    buf.set(vendorBytes.subarray(0, 4), pos);
    pos += 4;

    view.setUint16(pos, os2.fsSelection);
    pos += 2;

    // First/last char from our subset
    const unicodes = [...this.uniToGID.keys()].sort((a, b) => a - b);
    view.setUint16(pos, unicodes[0] ?? 0);
    pos += 2;
    view.setUint16(pos, unicodes[unicodes.length - 1] ?? 0);
    pos += 2;

    view.setInt16(pos, os2.typoAscender);
    pos += 2;
    view.setInt16(pos, os2.typoDescender);
    pos += 2;
    view.setInt16(pos, os2.typoLineGap);
    pos += 2;
    view.setUint16(pos, os2.winAscent);
    pos += 2;
    view.setUint16(pos, os2.winDescent);
    pos += 2;

    return buf;
  }

  /**
   * Get new glyph ID from old glyph ID.
   *
   * @param oldGid - Original glyph ID to remap
   * @param sortedGids - Sorted array of GIDs in the subset
   * @param parentGid - Optional parent glyph ID for better error context
   */
  private getNewGlyphId(oldGid: number, sortedGids: number[], parentGid?: number): number {
    const index = sortedGids.indexOf(oldGid);

    if (index === -1) {
      const context =
        parentGid !== undefined ? ` (referenced by composite glyph ${parentGid})` : "";
      throw new Error(`Component glyph ${oldGid} not in subset${context}`);
    }

    return index;
  }

  /**
   * Calculate checksum for a table.
   */
  private calculateChecksum(data: Uint8Array): number {
    let sum = 0;

    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const numLongs = Math.floor(data.length / 4);

    for (let i = 0; i < numLongs; i++) {
      sum = (sum + view.getUint32(i * 4)) >>> 0;
    }

    // Handle remaining bytes
    const remaining = data.length % 4;

    if (remaining > 0) {
      let last = 0;

      for (let i = 0; i < remaining; i++) {
        last |= data[numLongs * 4 + i] << (24 - i * 8);
      }

      sum = (sum + last) >>> 0;
    }

    return sum;
  }

  /**
   * Write a 16.16 fixed-point number.
   */
  private writeFixed(view: DataView, offset: number, value: number): void {
    const integer = Math.floor(value);
    const fraction = Math.round((value - integer) * 65536);
    view.setInt16(offset, integer);
    view.setUint16(offset + 2, fraction);
  }

  /**
   * Write a long date/time (seconds since 1904-01-01).
   */
  private writeLongDateTime(view: DataView, offset: number, date: Date): void {
    const epoch1904 = Date.UTC(1904, 0, 1);
    const seconds = Math.floor((date.getTime() - epoch1904) / 1000);

    // Write as 64-bit signed integer
    view.setUint32(offset, Math.floor(seconds / 0x100000000));
    view.setUint32(offset + 4, seconds >>> 0);
  }
}
