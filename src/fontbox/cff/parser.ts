/**
 * CFF (Compact Font Format) Parser.
 *
 * Parses CFF font data from standalone CFF files or from the CFF table
 * of an OpenType font.
 *
 * Based on Adobe Technical Note #5176 "The Compact Font Format Specification"
 */

import { BinaryScanner } from "#src/io/binary-scanner.ts";

import {
  type CFFCharset,
  CFFCharsetCID,
  CFFCharsetType1,
  getPredefinedCharset,
  RangeMappedCharset,
} from "./charset.ts";
import { type CFFEncoding, CFFEncodingBase, getPredefinedEncoding } from "./encoding.ts";
import { getOperator, getOperator2, isTwoByteOperator } from "./operators.ts";
import { getStandardString, STANDARD_STRINGS_COUNT } from "./standard-strings.ts";

// ============================================================================
// Types
// ============================================================================

/** CFF header information */
export interface CFFHeader {
  major: number;
  minor: number;
  hdrSize: number;
  offSize: number;
}

/** A parsed DICT entry with operator name and operands */
export interface DictEntry {
  operator: string;
  operands: number[];
}

/** Parsed DICT data as a map of operator names to operands */
export type DictData = Map<string, number[]>;

/** FDSelect data for CID fonts - maps GID to Font DICT index */
export interface FDSelect {
  getFDIndex(gid: number): number;
}

/** Private DICT data */
export interface PrivateDict {
  blueValues?: number[];
  otherBlues?: number[];
  familyBlues?: number[];
  familyOtherBlues?: number[];
  blueScale: number;
  blueShift: number;
  blueFuzz: number;
  stdHW?: number;
  stdVW?: number;
  stemSnapH?: number[];
  stemSnapV?: number[];
  forceBold: boolean;
  languageGroup: number;
  expansionFactor: number;
  initialRandomSeed: number;
  defaultWidthX: number;
  nominalWidthX: number;
  subrs?: Uint8Array[];
}

/** Base CFF font data */
export interface CFFFont {
  readonly name: string;
  readonly isCIDFont: boolean;
  readonly topDict: DictData;
  readonly charset: CFFCharset;
  readonly charStrings: Uint8Array[];
  readonly globalSubrIndex: Uint8Array[];

  // Top DICT values
  readonly version?: string;
  readonly notice?: string;
  readonly copyright?: string;
  readonly fullName?: string;
  readonly familyName?: string;
  readonly weight?: string;
  readonly isFixedPitch: boolean;
  readonly italicAngle: number;
  readonly underlinePosition: number;
  readonly underlineThickness: number;
  readonly paintType: number;
  readonly charstringType: number;
  readonly fontMatrix: number[];
  readonly fontBBox: number[];
  readonly strokeWidth: number;
  readonly uniqueID?: number;
  readonly xuid?: number[];
}

/** Type 1-equivalent CFF font */
export interface CFFType1Font extends CFFFont {
  readonly isCIDFont: false;
  readonly encoding: CFFEncoding;
  readonly privateDict: PrivateDict;
}

/** CID-keyed CFF font */
export interface CFFCIDFont extends CFFFont {
  readonly isCIDFont: true;
  readonly registry: string;
  readonly ordering: string;
  readonly supplement: number;
  readonly cidCount: number;
  readonly fdSelect: FDSelect;
  readonly fontDicts: DictData[];
  readonly privateDicts: PrivateDict[];
}

// ============================================================================
// Parser Implementation
// ============================================================================

/**
 * Parse CFF font data.
 * @param data The CFF data (standalone or from OTF CFF table)
 * @returns Array of parsed CFF fonts (CFF can contain multiple fonts)
 */
export function parseCFF(data: Uint8Array): Array<CFFType1Font | CFFCIDFont> {
  const scanner = new BinaryScanner(data);

  return new CFFParser(scanner).parse();
}

/**
 * Check if data appears to be CFF format.
 */
export function isCFF(data: Uint8Array): boolean {
  if (data.length < 4) {
    return false;
  }

  // Check for OpenType with CFF: "OTTO"
  if (data[0] === 0x4f && data[1] === 0x54 && data[2] === 0x54 && data[3] === 0x4f) {
    return true;
  }

  // Check for standalone CFF: major version 1, minor version 0
  if (data[0] === 1 && data[1] === 0) {
    return true;
  }

  return false;
}

class CFFParser {
  private scanner: BinaryScanner;
  private stringIndex: string[] = [];

  constructor(scanner: BinaryScanner) {
    this.scanner = scanner;
  }

  parse(): Array<CFFType1Font | CFFCIDFont> {
    // Check for OpenType wrapper
    this.skipOpenTypeHeader();

    // Read CFF header
    const header = this.readHeader();

    // Skip to end of header (in case hdrSize > 4)
    this.scanner.moveTo(header.hdrSize);

    // Read Name INDEX
    const nameIndex = this.readStringIndex();

    if (nameIndex.length === 0) {
      throw new Error("Name INDEX is empty");
    }

    // Read Top DICT INDEX
    const topDictIndex = this.readIndex();

    if (topDictIndex.length === 0) {
      throw new Error("Top DICT INDEX is empty");
    }

    // Read String INDEX
    this.stringIndex = this.readStringIndex();

    // Read Global Subr INDEX
    const globalSubrIndex = this.readIndex();

    // Parse each font
    const fonts: Array<CFFType1Font | CFFCIDFont> = [];

    for (let i = 0; i < nameIndex.length; i++) {
      const font = this.parseFont(nameIndex[i], topDictIndex[i], globalSubrIndex);
      fonts.push(font);
    }

    return fonts;
  }

  private skipOpenTypeHeader(): void {
    const tag = this.scanner.readTag();
    this.scanner.moveTo(0); // Reset after peeking

    if (tag === "OTTO") {
      // OpenType with CFF - find CFF table
      this.scanner.skip(4); // skip tag
      const numTables = this.scanner.readUint16();
      this.scanner.skip(6); // searchRange, entrySelector, rangeShift

      for (let i = 0; i < numTables; i++) {
        const tableTag = this.scanner.readTag();
        this.scanner.skip(4); // checksum
        const offset = this.scanner.readUint32();
        const length = this.scanner.readUint32();

        if (tableTag === "CFF ") {
          // Found CFF table - create new scanner for just the CFF data
          const cffData = this.scanner.bytes.subarray(offset, offset + length);
          this.scanner = new BinaryScanner(cffData);

          return;
        }
      }

      throw new Error("CFF table not found in OpenType font");
    } else if (tag === "ttcf") {
      throw new Error("TrueType Collection fonts are not supported");
    } else if (tag === "\x00\x01\x00\x00") {
      throw new Error("TrueType fonts (not CFF) are not supported by CFF parser");
    }
    // Otherwise assume standalone CFF
  }

  private readHeader(): CFFHeader {
    const major = this.scanner.readUint8();
    const minor = this.scanner.readUint8();
    const hdrSize = this.scanner.readUint8();
    const offSize = this.scanner.readUint8();

    if (offSize < 1 || offSize > 4) {
      throw new Error(`Invalid CFF offSize: ${offSize}`);
    }

    return { major, minor, hdrSize, offSize };
  }

  private readIndex(): Uint8Array[] {
    const count = this.scanner.readUint16();

    if (count === 0) {
      return [];
    }

    const offSize = this.scanner.readUint8();

    if (offSize < 1 || offSize > 4) {
      throw new Error(`Invalid INDEX offSize: ${offSize}`);
    }

    // Read offsets
    const offsets: number[] = [];

    for (let i = 0; i <= count; i++) {
      offsets.push(this.readOffset(offSize));
    }

    // Read data
    const result: Uint8Array[] = [];

    for (let i = 0; i < count; i++) {
      const start = offsets[i] - 1; // Offsets are 1-based
      const end = offsets[i + 1] - 1;
      const length = end - start;

      if (length < 0) {
        throw new Error(`Invalid INDEX entry length: ${length}`);
      }

      const data = new Uint8Array(length);

      for (let j = 0; j < length; j++) {
        data[j] = this.scanner.readUint8();
      }

      result.push(data);
    }

    return result;
  }

  private readStringIndex(): string[] {
    const data = this.readIndex();

    return data.map(bytes => this.decodeLatin1(bytes));
  }

  private decodeLatin1(bytes: Uint8Array): string {
    let result = "";

    for (let i = 0; i < bytes.length; i++) {
      result += String.fromCharCode(bytes[i]);
    }

    return result;
  }

  private readOffset(offSize: number): number {
    let offset = 0;

    for (let i = 0; i < offSize; i++) {
      offset = (offset << 8) | this.scanner.readUint8();
    }

    return offset;
  }

  private readDict(data: Uint8Array): DictData {
    const dict = new Map<string, number[]>();
    const scanner = new BinaryScanner(data);
    const operands: number[] = [];

    while (scanner.position < data.length) {
      const b0 = scanner.readUint8();

      if (b0 >= 0 && b0 <= 21) {
        // Operator
        let operator: string | undefined;

        if (isTwoByteOperator(b0)) {
          const b1 = scanner.readUint8();
          operator = getOperator2(b0, b1);
        } else {
          operator = getOperator(b0);
        }

        if (operator) {
          dict.set(operator, [...operands]);
        }

        operands.length = 0;
      } else if (b0 === 28 || b0 === 29) {
        // Integer
        operands.push(this.readDictInteger(scanner, b0));
      } else if (b0 === 30) {
        // Real number
        operands.push(this.readDictReal(scanner));
      } else if (b0 >= 32 && b0 <= 254) {
        // Integer
        operands.push(this.readDictInteger(scanner, b0));
      } else {
        throw new Error(`Invalid DICT byte: ${b0}`);
      }
    }

    return dict;
  }

  private readDictInteger(scanner: BinaryScanner, b0: number): number {
    if (b0 === 28) {
      return scanner.readInt16();
    } else if (b0 === 29) {
      return scanner.readInt32();
    } else if (b0 >= 32 && b0 <= 246) {
      return b0 - 139;
    } else if (b0 >= 247 && b0 <= 250) {
      const b1 = scanner.readUint8();
      return (b0 - 247) * 256 + b1 + 108;
    } else if (b0 >= 251 && b0 <= 254) {
      const b1 = scanner.readUint8();
      return -(b0 - 251) * 256 - b1 - 108;
    }

    throw new Error(`Invalid DICT integer byte: ${b0}`);
  }

  private readDictReal(scanner: BinaryScanner): number {
    let str = "";
    let done = false;

    while (!done) {
      const b = scanner.readUint8();
      const nibbles = [b >> 4, b & 0x0f];

      for (const nibble of nibbles) {
        switch (nibble) {
          case 0x0:
          case 0x1:
          case 0x2:
          case 0x3:
          case 0x4:
          case 0x5:
          case 0x6:
          case 0x7:
          case 0x8:
          case 0x9:
            str += nibble.toString();
            break;
          case 0xa:
            str += ".";
            break;
          case 0xb:
            str += "E";
            break;
          case 0xc:
            str += "E-";
            break;
          case 0xd:
            // Reserved
            break;
          case 0xe:
            str += "-";
            break;
          case 0xf:
            done = true;
            break;
        }
      }
    }

    return parseFloat(str) || 0;
  }

  private getString(sid: number): string {
    if (sid < STANDARD_STRINGS_COUNT) {
      return getStandardString(sid) ?? `.sid${sid}`;
    }

    const index = sid - STANDARD_STRINGS_COUNT;

    if (index < this.stringIndex.length) {
      return this.stringIndex[index];
    }

    return `.sid${sid}`;
  }

  private getDictString(dict: DictData, key: string): string | undefined {
    const operands = dict.get(key);

    if (operands && operands.length > 0) {
      return this.getString(operands[0]);
    }

    return undefined;
  }

  private getDictNumber(dict: DictData, key: string, defaultValue: number): number {
    const operands = dict.get(key);

    if (operands && operands.length > 0) {
      return operands[0];
    }

    return defaultValue;
  }

  private getDictBoolean(dict: DictData, key: string, defaultValue: boolean): boolean {
    const operands = dict.get(key);

    if (operands && operands.length > 0) {
      return operands[0] === 1;
    }

    return defaultValue;
  }

  private getDictArray(dict: DictData, key: string, defaultValue: number[]): number[] {
    const operands = dict.get(key);

    if (operands && operands.length > 0) {
      return operands;
    }

    return defaultValue;
  }

  private getDictDelta(dict: DictData, key: string): number[] | undefined {
    const operands = dict.get(key);

    if (!operands || operands.length === 0) {
      return undefined;
    }

    // Delta-encoded: each value is added to the previous
    const result = [...operands];

    for (let i = 1; i < result.length; i++) {
      result[i] += result[i - 1];
    }

    return result;
  }

  private parseFont(
    name: string,
    topDictData: Uint8Array,
    globalSubrIndex: Uint8Array[],
  ): CFFType1Font | CFFCIDFont {
    const topDict = this.readDict(topDictData);

    // Check for synthetic font (not supported)
    if (topDict.has("SyntheticBase")) {
      throw new Error("Synthetic fonts are not supported");
    }

    // Check if CID font (has ROS operator)
    const rosOperands = topDict.get("ROS");
    const isCIDFont = rosOperands !== undefined && rosOperands.length >= 3;

    // Read CharStrings INDEX
    const charStringsOffset = this.getDictNumber(topDict, "CharStrings", 0);

    if (charStringsOffset === 0) {
      throw new Error("CharStrings offset is missing");
    }

    this.scanner.moveTo(charStringsOffset);
    const charStrings = this.readIndex();

    // Read charset
    const charset = this.readCharset(topDict, charStrings.length, isCIDFont);

    // Common top dict values
    const baseFont = {
      name,
      topDict,
      charset,
      charStrings,
      globalSubrIndex,
      version: this.getDictString(topDict, "version"),
      notice: this.getDictString(topDict, "Notice"),
      copyright: this.getDictString(topDict, "Copyright"),
      fullName: this.getDictString(topDict, "FullName"),
      familyName: this.getDictString(topDict, "FamilyName"),
      weight: this.getDictString(topDict, "Weight"),
      isFixedPitch: this.getDictBoolean(topDict, "isFixedPitch", false),
      italicAngle: this.getDictNumber(topDict, "ItalicAngle", 0),
      underlinePosition: this.getDictNumber(topDict, "UnderlinePosition", -100),
      underlineThickness: this.getDictNumber(topDict, "UnderlineThickness", 50),
      paintType: this.getDictNumber(topDict, "PaintType", 0),
      charstringType: this.getDictNumber(topDict, "CharstringType", 2),
      fontMatrix: this.getDictArray(topDict, "FontMatrix", [0.001, 0, 0, 0.001, 0, 0]),
      fontBBox: this.getDictArray(topDict, "FontBBox", [0, 0, 0, 0]),
      strokeWidth: this.getDictNumber(topDict, "StrokeWidth", 0),
      uniqueID: topDict.has("UniqueID") ? this.getDictNumber(topDict, "UniqueID", 0) : undefined,
      xuid: topDict.has("XUID") ? this.getDictArray(topDict, "XUID", []) : undefined,
    };

    if (isCIDFont) {
      // biome-ignore lint/style/noNonNullAssertion: checked in above condition
      return this.parseCIDFont(baseFont, topDict, rosOperands!);
    } else {
      return this.parseType1Font(baseFont, topDict);
    }
  }

  private parseType1Font(baseFont: Omit<CFFFont, "isCIDFont">, topDict: DictData): CFFType1Font {
    // Read encoding
    const encoding = this.readEncoding(topDict, baseFont.charset);

    // Read Private DICT
    const privateEntry = topDict.get("Private");

    if (!privateEntry || privateEntry.length < 2) {
      throw new Error("Private DICT is missing");
    }

    const privateSize = privateEntry[0];
    const privateOffset = privateEntry[1];
    const privateDict = this.readPrivateDict(privateOffset, privateSize);

    return {
      ...baseFont,
      isCIDFont: false as const,
      encoding,
      privateDict,
    };
  }

  private parseCIDFont(
    baseFont: Omit<CFFFont, "isCIDFont">,
    topDict: DictData,
    rosOperands: number[],
  ): CFFCIDFont {
    const registry = this.getString(rosOperands[0]);
    const ordering = this.getString(rosOperands[1]);
    const supplement = rosOperands[2];

    // Read FDArray
    const fdArrayOffset = this.getDictNumber(topDict, "FDArray", 0);

    if (fdArrayOffset === 0) {
      throw new Error("FDArray is missing for CID font");
    }

    this.scanner.moveTo(fdArrayOffset);
    const fdIndex = this.readIndex();

    // Parse Font DICTs and Private DICTs
    const fontDicts: DictData[] = [];
    const privateDicts: PrivateDict[] = [];

    for (const fdData of fdIndex) {
      const fontDict = this.readDict(fdData);
      fontDicts.push(fontDict);

      const privateEntry = fontDict.get("Private");

      if (privateEntry && privateEntry.length >= 2) {
        const privateSize = privateEntry[0];
        const privateOffset = privateEntry[1];
        privateDicts.push(this.readPrivateDict(privateOffset, privateSize));
      } else {
        // Empty private dict
        privateDicts.push(this.createDefaultPrivateDict());
      }
    }

    // Read FDSelect
    const fdSelectOffset = this.getDictNumber(topDict, "FDSelect", 0);

    if (fdSelectOffset === 0) {
      throw new Error("FDSelect is missing for CID font");
    }

    this.scanner.moveTo(fdSelectOffset);
    const fdSelect = this.readFDSelect(baseFont.charStrings.length);

    const cidCount = this.getDictNumber(topDict, "CIDCount", 8720);

    return {
      ...baseFont,
      isCIDFont: true as const,
      registry,
      ordering,
      supplement,
      cidCount,
      fdSelect,
      fontDicts,
      privateDicts,
    };
  }

  private readCharset(topDict: DictData, nGlyphs: number, isCIDFont: boolean): CFFCharset {
    const charsetEntry = topDict.get("charset");
    const charsetId = charsetEntry && charsetEntry.length > 0 ? charsetEntry[0] : 0;

    // Check for predefined charset
    if (!isCIDFont && charsetId <= 2) {
      const predefined = getPredefinedCharset(charsetId, isCIDFont);

      if (predefined) {
        return predefined;
      }
    }

    // Read custom charset
    this.scanner.moveTo(charsetId);
    const format = this.scanner.readUint8();

    if (isCIDFont) {
      return this.readCIDCharset(format, nGlyphs);
    } else {
      return this.readType1Charset(format, nGlyphs);
    }
  }

  private readType1Charset(format: number, nGlyphs: number): CFFCharsetType1 {
    const charset = new CFFCharsetType1();
    charset.addSID(0, 0, ".notdef");

    switch (format) {
      case 0: {
        // Format 0: array of SIDs
        for (let gid = 1; gid < nGlyphs; gid++) {
          const sid = this.scanner.readUint16();
          const name = this.getString(sid);
          charset.addSID(gid, sid, name);
        }

        break;
      }
      case 1: {
        // Format 1: ranges with 1-byte count
        let gid = 1;

        while (gid < nGlyphs) {
          const first = this.scanner.readUint16();
          const nLeft = this.scanner.readUint8();

          for (let i = 0; i <= nLeft && gid < nGlyphs; i++) {
            const sid = first + i;
            const name = this.getString(sid);
            charset.addSID(gid++, sid, name);
          }
        }

        break;
      }
      case 2: {
        // Format 2: ranges with 2-byte count
        let gid = 1;

        while (gid < nGlyphs) {
          const first = this.scanner.readUint16();
          const nLeft = this.scanner.readUint16();

          for (let i = 0; i <= nLeft && gid < nGlyphs; i++) {
            const sid = first + i;
            const name = this.getString(sid);
            charset.addSID(gid++, sid, name);
          }
        }

        break;
      }
      default:
        throw new Error(`Invalid charset format: ${format}`);
    }

    return charset;
  }

  private readCIDCharset(format: number, nGlyphs: number): CFFCharsetCID {
    const charset = format === 0 ? new CFFCharsetCID() : new RangeMappedCharset();
    charset.addCID(0, 0);

    switch (format) {
      case 0: {
        // Format 0: array of CIDs
        for (let gid = 1; gid < nGlyphs; gid++) {
          const cid = this.scanner.readUint16();
          charset.addCID(gid, cid);
        }

        break;
      }
      case 1: {
        // Format 1: ranges with 1-byte count
        let gid = 1;

        while (gid < nGlyphs) {
          const first = this.scanner.readUint16();
          const nLeft = this.scanner.readUint8();

          if (charset instanceof RangeMappedCharset) {
            charset.addRange(gid, first, nLeft);
          }

          gid += nLeft + 1;
        }

        break;
      }
      case 2: {
        // Format 2: ranges with 2-byte count
        let gid = 1;

        while (gid < nGlyphs) {
          const first = this.scanner.readUint16();
          const nLeft = this.scanner.readUint16();

          if (charset instanceof RangeMappedCharset) {
            charset.addRange(gid, first, nLeft);
          }

          gid += nLeft + 1;
        }

        break;
      }
      default:
        throw new Error(`Invalid charset format: ${format}`);
    }

    return charset;
  }

  private readEncoding(topDict: DictData, charset: CFFCharset): CFFEncoding {
    const encodingEntry = topDict.get("Encoding");
    const encodingId = encodingEntry && encodingEntry.length > 0 ? encodingEntry[0] : 0;

    // Check for predefined encoding
    if (encodingId <= 1) {
      const predefined = getPredefinedEncoding(encodingId);

      if (predefined) {
        return predefined;
      }
    }

    // Read custom encoding
    this.scanner.moveTo(encodingId);
    const format = this.scanner.readUint8();
    const baseFormat = format & 0x7f;
    const hasSupplement = (format & 0x80) !== 0;

    const encoding = new CFFEncodingBase();
    encoding.add(0, 0, ".notdef");

    switch (baseFormat) {
      case 0: {
        // Format 0: array of codes
        const nCodes = this.scanner.readUint8();

        for (let gid = 1; gid <= nCodes; gid++) {
          const code = this.scanner.readUint8();
          const sid = charset.getSIDForGID(gid);
          const name = this.getString(sid);
          encoding.add(code, sid, name);
        }

        break;
      }
      case 1: {
        // Format 1: ranges
        const nRanges = this.scanner.readUint8();
        let gid = 1;

        for (let i = 0; i < nRanges; i++) {
          const first = this.scanner.readUint8();
          const nLeft = this.scanner.readUint8();

          for (let j = 0; j <= nLeft; j++) {
            const code = first + j;
            const sid = charset.getSIDForGID(gid);
            const name = this.getString(sid);
            encoding.add(code, sid, name);

            gid++;
          }
        }

        break;
      }
      default:
        throw new Error(`Invalid encoding format: ${baseFormat}`);
    }

    // Read supplement if present
    if (hasSupplement) {
      const nSups = this.scanner.readUint8();

      for (let i = 0; i < nSups; i++) {
        const code = this.scanner.readUint8();
        const sid = this.scanner.readUint16();
        const name = this.getString(sid);

        encoding.add(code, sid, name);
      }
    }

    return encoding;
  }

  private readPrivateDict(offset: number, size: number): PrivateDict {
    if (size === 0) {
      return this.createDefaultPrivateDict();
    }

    this.scanner.moveTo(offset);
    const data = new Uint8Array(size);

    for (let i = 0; i < size; i++) {
      data[i] = this.scanner.readUint8();
    }

    const dict = this.readDict(data);

    const privateDict: PrivateDict = {
      blueValues: this.getDictDelta(dict, "BlueValues"),
      otherBlues: this.getDictDelta(dict, "OtherBlues"),
      familyBlues: this.getDictDelta(dict, "FamilyBlues"),
      familyOtherBlues: this.getDictDelta(dict, "FamilyOtherBlues"),
      blueScale: this.getDictNumber(dict, "BlueScale", 0.039625),
      blueShift: this.getDictNumber(dict, "BlueShift", 7),
      blueFuzz: this.getDictNumber(dict, "BlueFuzz", 1),
      stdHW: dict.has("StdHW") ? this.getDictNumber(dict, "StdHW", 0) : undefined,
      stdVW: dict.has("StdVW") ? this.getDictNumber(dict, "StdVW", 0) : undefined,
      stemSnapH: this.getDictDelta(dict, "StemSnapH"),
      stemSnapV: this.getDictDelta(dict, "StemSnapV"),
      forceBold: this.getDictBoolean(dict, "ForceBold", false),
      languageGroup: this.getDictNumber(dict, "LanguageGroup", 0),
      expansionFactor: this.getDictNumber(dict, "ExpansionFactor", 0.06),
      initialRandomSeed: this.getDictNumber(dict, "initialRandomSeed", 0),
      defaultWidthX: this.getDictNumber(dict, "defaultWidthX", 0),
      nominalWidthX: this.getDictNumber(dict, "nominalWidthX", 0),
    };

    // Read local subrs if present
    const subrsOffset = this.getDictNumber(dict, "Subrs", 0);

    if (subrsOffset > 0) {
      this.scanner.moveTo(offset + subrsOffset);
      privateDict.subrs = this.readIndex();
    }

    return privateDict;
  }

  private createDefaultPrivateDict(): PrivateDict {
    return {
      blueScale: 0.039625,
      blueShift: 7,
      blueFuzz: 1,
      forceBold: false,
      languageGroup: 0,
      expansionFactor: 0.06,
      initialRandomSeed: 0,
      defaultWidthX: 0,
      nominalWidthX: 0,
    };
  }

  private readFDSelect(nGlyphs: number): FDSelect {
    const format = this.scanner.readUint8();

    switch (format) {
      case 0: {
        // Format 0: array of FD indices
        const fds: number[] = [];

        for (let i = 0; i < nGlyphs; i++) {
          fds.push(this.scanner.readUint8());
        }

        return {
          getFDIndex(gid: number): number {
            return gid < fds.length ? fds[gid] : 0;
          },
        };
      }

      case 3: {
        // Format 3: ranges
        const nRanges = this.scanner.readUint16();
        const ranges: Array<{ first: number; fd: number }> = [];

        for (let i = 0; i < nRanges; i++) {
          ranges.push({
            first: this.scanner.readUint16(),
            fd: this.scanner.readUint8(),
          });
        }

        const sentinel = this.scanner.readUint16();

        return {
          getFDIndex(gid: number): number {
            for (let i = 0; i < ranges.length; i++) {
              const rangeStart = ranges[i].first;
              const rangeEnd = i + 1 < ranges.length ? ranges[i + 1].first : sentinel;

              if (gid >= rangeStart && gid < rangeEnd) {
                return ranges[i].fd;
              }
            }

            return 0;
          },
        };
      }
      default:
        throw new Error(`Invalid FDSelect format: ${format}`);
    }
  }
}
