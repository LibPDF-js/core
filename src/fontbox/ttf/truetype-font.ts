/**
 * TrueType Font.
 *
 * Represents a parsed TrueType or OpenType font with lazy table loading.
 *
 * Based on Apache PDFBox fontbox TrueTypeFont.java
 */

import { BinaryScanner } from "#src/io/binary-scanner.ts";

import { type AvarTable, parseAvarTable } from "./tables/avar.ts";
import { type CmapTable, parseCmapTable } from "./tables/cmap.ts";
import {
  type FvarTable,
  type NamedInstance,
  parseFvarTable,
  type VariationAxis,
} from "./tables/fvar.ts";
import { type GlyfTable, parseGlyfTable } from "./tables/glyf.ts";
import { type HeadTable, parseHeadTable } from "./tables/head.ts";
import { type HheaTable, parseHheaTable } from "./tables/hhea.ts";
import { type HmtxTable, parseHmtxTable } from "./tables/hmtx.ts";
import { type LocaTable, parseLocaTable } from "./tables/loca.ts";
import { type MaxpTable, parseMaxpTable } from "./tables/maxp.ts";
import { type NameTable, parseNameTable } from "./tables/name.ts";
import { type OS2Table, parseOS2Table } from "./tables/os2.ts";
import { type PostTable, parsePostTable } from "./tables/post.ts";
import { parseStatTable, type StatTable } from "./tables/stat.ts";
import type { TableParseContext, TableRecord, TrueTypeFontAccess, TTFTable } from "./types.ts";

/**
 * A TrueType or OpenType font.
 */
export class TrueTypeFont implements TrueTypeFontAccess {
  /** Raw font data */
  readonly data: BinaryScanner;

  /** Font version (1.0 for TTF, 'OTTO' for CFF) */
  readonly version: number;

  /** Table records (metadata about table locations) */
  private readonly tableRecords: Map<string, TableRecord>;

  /** Parsed tables (lazily loaded) */
  private readonly tables: Map<string, TTFTable>;

  /** Cached numGlyphs from maxp table */
  private _numGlyphs: number | undefined;

  constructor(data: Uint8Array, version: number, tableRecords: Map<string, TableRecord>) {
    this.data = new BinaryScanner(data);
    this.version = version;
    this.tableRecords = tableRecords;
    this.tables = new Map();
  }

  /** Number of glyphs in the font */
  get numGlyphs(): number {
    if (this._numGlyphs === undefined) {
      const maxp = this.getTable<MaxpTable>("maxp");
      this._numGlyphs = maxp?.numGlyphs ?? 0;
    }

    return this._numGlyphs;
  }

  /** Get raw table record by tag */
  getTableRecord(tag: string): TableRecord | undefined {
    return this.tableRecords.get(tag);
  }

  /** Check if a table exists */
  hasTable(tag: string): boolean {
    return this.tableRecords.has(tag);
  }

  /** Get all table tags */
  getTableTags(): string[] {
    return [...this.tableRecords.keys()];
  }

  /**
   * Get a table by tag. Parses the table on first access.
   */
  getTable<T extends TTFTable>(tag: string): T | undefined {
    // Return cached table if already parsed
    if (this.tables.has(tag)) {
      return this.tables.get(tag) as T;
    }

    // Get the table record
    const record = this.tableRecords.get(tag);

    if (!record) {
      return undefined;
    }

    // Parse the table
    const table = this.parseTable(tag, record);

    if (table) {
      this.tables.set(tag, table);
    }

    return table as T | undefined;
  }

  /**
   * Get raw table bytes.
   */
  getTableBytes(tag: string): Uint8Array | undefined {
    const record = this.tableRecords.get(tag);

    if (!record) {
      return undefined;
    }

    return this.data.bytes.subarray(record.offset, record.offset + record.length);
  }

  // Convenience getters for common tables

  /** Get the 'head' table */
  get head(): HeadTable | undefined {
    return this.getTable<HeadTable>("head");
  }

  /** Get the 'hhea' table */
  get hhea(): HheaTable | undefined {
    return this.getTable<HheaTable>("hhea");
  }

  /** Get the 'maxp' table */
  get maxp(): MaxpTable | undefined {
    return this.getTable<MaxpTable>("maxp");
  }

  /** Get the 'hmtx' table */
  get hmtx(): HmtxTable | undefined {
    return this.getTable<HmtxTable>("hmtx");
  }

  /** Get the 'loca' table */
  get loca(): LocaTable | undefined {
    return this.getTable<LocaTable>("loca");
  }

  /** Get the 'cmap' table */
  get cmap(): CmapTable | undefined {
    return this.getTable<CmapTable>("cmap");
  }

  /** Get the 'glyf' table */
  get glyf(): GlyfTable | undefined {
    return this.getTable<GlyfTable>("glyf");
  }

  /** Get the 'name' table */
  get name(): NameTable | undefined {
    return this.getTable<NameTable>("name");
  }

  /** Get the 'post' table */
  get post(): PostTable | undefined {
    return this.getTable<PostTable>("post");
  }

  /** Get the 'OS/2' table */
  get os2(): OS2Table | undefined {
    return this.getTable<OS2Table>("OS/2");
  }

  /** Get the 'fvar' table (font variations) */
  get fvar(): FvarTable | undefined {
    return this.getTable<FvarTable>("fvar");
  }

  /** Get the 'STAT' table (style attributes) */
  get stat(): StatTable | undefined {
    return this.getTable<StatTable>("STAT");
  }

  /** Get the 'avar' table (axis variations) */
  get avar(): AvarTable | undefined {
    return this.getTable<AvarTable>("avar");
  }

  /** Units per em (from head table) */
  get unitsPerEm(): number {
    return this.head?.unitsPerEm ?? 1000;
  }

  /** Font bounding box */
  get bbox(): { xMin: number; yMin: number; xMax: number; yMax: number } {
    const head = this.head;

    return {
      xMin: head?.xMin ?? 0,
      yMin: head?.yMin ?? 0,
      xMax: head?.xMax ?? 0,
      yMax: head?.yMax ?? 0,
    };
  }

  /**
   * Get glyph ID for a Unicode code point.
   * Returns 0 if the character is not in the font.
   */
  getGlyphId(codePoint: number): number {
    const cmap = this.cmap?.getUnicodeCmap();

    return cmap?.getGlyphId(codePoint) ?? 0;
  }

  /**
   * Get advance width for a glyph ID.
   */
  getAdvanceWidth(glyphId: number): number {
    return this.hmtx?.getAdvanceWidth(glyphId) ?? 0;
  }

  /**
   * Check if the font has a glyph for the given code point.
   */
  hasGlyph(codePoint: number): boolean {
    return this.getGlyphId(codePoint) !== 0;
  }

  /**
   * Check if this is a variable font (has fvar table).
   */
  isVariableFont(): boolean {
    return this.hasTable("fvar");
  }

  /**
   * Get the variation axes defined in this font.
   * Returns empty array if not a variable font.
   */
  getVariationAxes(): readonly VariationAxis[] {
    return this.fvar?.axes ?? [];
  }

  /**
   * Get the named instances defined in this font.
   * Returns empty array if not a variable font.
   */
  getNamedInstances(): readonly NamedInstance[] {
    return this.fvar?.instances ?? [];
  }

  /**
   * Parse a table by tag.
   */
  private parseTable(tag: string, record: TableRecord): TTFTable | undefined {
    // Create scanner positioned at table start
    const tableData = new BinaryScanner(
      this.data.bytes.subarray(record.offset, record.offset + record.length),
    );

    const ctx: TableParseContext = {
      data: tableData,
      font: this,
      record,
    };

    switch (tag) {
      case "head":
        return parseHeadTable(ctx);
      case "hhea":
        return parseHheaTable(ctx);
      case "maxp":
        return parseMaxpTable(ctx);
      case "hmtx":
        return parseHmtxTable(ctx);
      case "loca":
        return parseLocaTable(ctx);
      case "cmap":
        return parseCmapTable(ctx);
      case "glyf":
        return parseGlyfTable(ctx);
      case "name":
        return parseNameTable(ctx);
      case "post":
        return parsePostTable(ctx);
      case "OS/2":
        return parseOS2Table(ctx);
      case "fvar":
        return parseFvarTable(ctx);
      case "STAT":
        return parseStatTable(ctx);
      case "avar":
        return parseAvarTable(ctx);
      default:
        // Unknown table - could add more parsers here
        return undefined;
    }
  }
}
