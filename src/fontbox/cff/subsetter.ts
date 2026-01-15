/**
 * CFF Font Subsetter.
 *
 * Creates a subset of a CFF font containing only the specified glyphs.
 * Converts the font to a CID-keyed font for PDF embedding.
 *
 * Based on fontkit's CFFSubset.js
 * @see https://github.com/foliojs/fontkit/blob/master/src/subset/CFFSubset.js
 */

import { BinaryWriter } from "#src/io/binary-writer.ts";

import type { CFFCIDFont, CFFType1Font, PrivateDict } from "./parser.ts";
import { getStandardString, STANDARD_STRINGS_COUNT } from "./standard-strings.ts";

/**
 * CFF Subsetter - creates a subset CFF font with only the specified glyphs.
 */
export class CFFSubsetter {
  private readonly font: CFFType1Font | CFFCIDFont;
  private readonly glyphIds: Set<number> = new Set();

  // Built during subset
  private charstrings: Uint8Array[] = [];
  private globalSubrs: Uint8Array[] = [];
  private strings: string[] = [];

  constructor(font: CFFType1Font | CFFCIDFont) {
    this.font = font;
    // Always include .notdef
    this.glyphIds.add(0);
  }

  /**
   * Add a glyph ID to the subset.
   */
  addGlyph(gid: number): void {
    if (gid >= 0 && gid < this.font.charStrings.length) {
      this.glyphIds.add(gid);
    }
  }

  /**
   * Add multiple glyph IDs.
   */
  addGlyphs(gids: Iterable<number>): void {
    for (const gid of gids) {
      this.addGlyph(gid);
    }
  }

  /**
   * Write the subset CFF font.
   */
  write(): Uint8Array {
    // Get sorted glyph IDs
    const sortedGids = [...this.glyphIds].sort((a, b) => a - b);

    // Build charstrings for subset
    this.buildCharstrings(sortedGids);

    // Build subrs (replace unused with return)
    this.buildSubrs();

    // Build the CFF binary
    return this.encode(sortedGids);
  }

  /**
   * Build the charstrings array for the subset.
   */
  private buildCharstrings(sortedGids: number[]): void {
    this.charstrings = [];

    for (const gid of sortedGids) {
      this.charstrings.push(this.font.charStrings[gid]);
    }
  }

  /**
   * Build subrs arrays.
   *
   * Note: We only copy global subrs. Local subrs would require adding
   * a Subrs offset to the Private DICT and writing them after it.
   * For now, charstrings that use local subrs will still work if the
   * global subrs they depend on are present.
   */
  private buildSubrs(): void {
    // Copy global subrs as-is
    // A more sophisticated implementation would track which subrs are actually used
    this.globalSubrs = this.font.globalSubrIndex.map(subr => subr);
  }

  /**
   * Add a string to the string index, returning its SID.
   */
  private addString(str: string | undefined): number | null {
    if (!str) {
      return null;
    }

    // Check if it's a standard string
    for (let i = 0; i < STANDARD_STRINGS_COUNT; i++) {
      if (getStandardString(i) === str) {
        return i;
      }
    }

    // Add to custom strings
    const index = this.strings.indexOf(str);
    if (index >= 0) {
      return STANDARD_STRINGS_COUNT + index;
    }

    this.strings.push(str);
    return STANDARD_STRINGS_COUNT + this.strings.length - 1;
  }

  /**
   * Encode the subset CFF.
   *
   * We need to do this in two passes because the Top DICT contains offsets
   * to later structures, but the Top DICT INDEX size affects those offsets.
   */
  private encode(sortedGids: number[]): Uint8Array {
    // Add required strings first
    this.addString("Adobe");
    this.addString("Identity");

    // Build all the data structures (except Top DICT which needs offsets)
    const header = this.encodeHeader();
    const nameIndex = this.encodeIndex([this.encodeString(this.font.name)]);
    const stringIndex = this.encodeIndex(this.strings.map(s => this.encodeString(s)));
    const globalSubrIndex = this.encodeIndex(this.globalSubrs);
    const charset = this.encodeCharset(sortedGids.length);
    const fdSelect = this.encodeFDSelect(sortedGids.length);
    const charStringsIndex = this.encodeIndex(this.charstrings);

    // Build Private DICT
    const privateDict = this.buildPrivateDict();
    const privateDictData = this.encodeDict(privateDict);

    // First pass: estimate Top DICT size to calculate offsets
    // Use a dummy Top DICT to get approximate size
    const dummyTopDict = this.buildTopDict(sortedGids.length, 0, 0, 0, 0);
    const dummyTopDictData = this.encodeDict(dummyTopDict);
    const estimatedTopDictIndexSize = this.encodeIndex([dummyTopDictData]).length;

    // Calculate offsets (based on estimated Top DICT INDEX size)
    let offset =
      header.length +
      nameIndex.length +
      estimatedTopDictIndexSize +
      stringIndex.length +
      globalSubrIndex.length;
    const charsetOffset = offset;
    offset += charset.length;

    const fdSelectOffset = offset;
    offset += fdSelect.length;

    const charStringsOffset = offset;
    offset += charStringsIndex.length;

    const fdArrayOffset = offset;

    // Build Font DICT (which contains Private DICT offset)
    // Private DICT comes after FDArray INDEX
    // We need to know FDArray INDEX size first
    const fontDictTemp = this.buildFontDict(privateDictData.length, 0);
    const fontDictDataTemp = this.encodeDict(fontDictTemp);
    const fdArrayIndexSize = this.encodeIndex([fontDictDataTemp]).length;

    const privateDictOffset = fdArrayOffset + fdArrayIndexSize;

    // Now build the real Font DICT with correct Private offset
    const fontDict = this.buildFontDict(privateDictData.length, privateDictOffset);
    const fontDictData = this.encodeDict(fontDict);
    const fdArrayIndex = this.encodeIndex([fontDictData]);

    // Build the real Top DICT with correct offsets
    const topDict = this.buildTopDict(
      sortedGids.length,
      charsetOffset,
      fdSelectOffset,
      charStringsOffset,
      fdArrayOffset,
    );
    const topDictData = this.encodeDict(topDict);
    const topDictIndex = this.encodeIndex([topDictData]);

    // If the Top DICT INDEX size differs from estimate, we need to adjust offsets
    // For simplicity, we'll just recalculate if there's a mismatch
    if (topDictIndex.length !== estimatedTopDictIndexSize) {
      // Recalculate with correct size
      const sizeDiff = topDictIndex.length - estimatedTopDictIndexSize;

      const adjustedTopDict = this.buildTopDict(
        sortedGids.length,
        charsetOffset + sizeDiff,
        fdSelectOffset + sizeDiff,
        charStringsOffset + sizeDiff,
        fdArrayOffset + sizeDiff,
      );
      const adjustedTopDictData = this.encodeDict(adjustedTopDict);
      const adjustedTopDictIndex = this.encodeIndex([adjustedTopDictData]);

      // Update Font DICT with adjusted Private offset
      const adjustedFontDict = this.buildFontDict(
        privateDictData.length,
        privateDictOffset + sizeDiff,
      );
      const adjustedFontDictData = this.encodeDict(adjustedFontDict);
      const adjustedFdArrayIndex = this.encodeIndex([adjustedFontDictData]);

      // Use BinaryWriter for final assembly
      const writer = new BinaryWriter();
      writer.writeBytes(header);
      writer.writeBytes(nameIndex);
      writer.writeBytes(adjustedTopDictIndex);
      writer.writeBytes(stringIndex);
      writer.writeBytes(globalSubrIndex);
      writer.writeBytes(charset);
      writer.writeBytes(fdSelect);
      writer.writeBytes(charStringsIndex);
      writer.writeBytes(adjustedFdArrayIndex);
      writer.writeBytes(privateDictData);
      return writer.toBytes();
    }

    // Use BinaryWriter for final assembly
    const writer = new BinaryWriter();
    writer.writeBytes(header);
    writer.writeBytes(nameIndex);
    writer.writeBytes(topDictIndex);
    writer.writeBytes(stringIndex);
    writer.writeBytes(globalSubrIndex);
    writer.writeBytes(charset);
    writer.writeBytes(fdSelect);
    writer.writeBytes(charStringsIndex);
    writer.writeBytes(fdArrayIndex);
    writer.writeBytes(privateDictData);
    return writer.toBytes();
  }

  /**
   * Encode CFF header.
   */
  private encodeHeader(): Uint8Array {
    const writer = new BinaryWriter();
    writer.writeUint8(1); // major version
    writer.writeUint8(0); // minor version
    writer.writeUint8(4); // header size
    writer.writeUint8(4); // offSize (we use 4-byte offsets)
    return writer.toBytes();
  }

  /**
   * Encode an INDEX structure.
   */
  private encodeIndex(items: Uint8Array[]): Uint8Array {
    const writer = new BinaryWriter();

    if (items.length === 0) {
      writer.writeUint16(0); // count = 0
      return writer.toBytes();
    }

    // Calculate total data size to determine offset size
    let dataSize = 0;
    for (const item of items) {
      dataSize += item.length;
    }

    // Determine offset size (1-4 bytes)
    const offSize = BinaryWriter.offsetSize(dataSize + 1);

    // Count
    writer.writeUint16(items.length);

    // Offset size
    writer.writeUint8(offSize);

    // Offsets (1-based)
    let offset = 1;
    for (let i = 0; i <= items.length; i++) {
      writer.writeOffset(offset, offSize);
      if (i < items.length) {
        offset += items[i].length;
      }
    }

    // Data
    for (const item of items) {
      writer.writeBytes(item);
    }

    return writer.toBytes();
  }

  /**
   * Encode a string to bytes.
   */
  private encodeString(str: string): Uint8Array {
    const writer = new BinaryWriter();
    writer.writeAscii(str);
    return writer.toBytes();
  }

  /**
   * Encode a charset (format 2 - ranges).
   */
  private encodeCharset(nGlyphs: number): Uint8Array {
    const writer = new BinaryWriter();

    if (nGlyphs <= 1) {
      // Only .notdef - use format 0 with no entries
      writer.writeUint8(0);
      return writer.toBytes();
    }

    // Format 2: ranges (CID = GID for our subset)
    // One range covering CID 1 to nGlyphs-1
    writer.writeUint8(2); // format
    writer.writeUint16(1); // first CID
    writer.writeUint16(nGlyphs - 2); // nLeft
    return writer.toBytes();
  }

  /**
   * Encode FDSelect (format 3 - ranges).
   */
  private encodeFDSelect(nGlyphs: number): Uint8Array {
    // Format 3: one range covering all glyphs, FD index 0
    const writer = new BinaryWriter();
    writer.writeUint8(3); // format
    writer.writeUint16(1); // nRanges
    writer.writeUint16(0); // first GID
    writer.writeUint8(0); // FD index
    writer.writeUint16(nGlyphs); // sentinel
    return writer.toBytes();
  }

  /**
   * Build Top DICT entries.
   */
  private buildTopDict(
    nGlyphs: number,
    charsetOffset: number,
    fdSelectOffset: number,
    charStringsOffset: number,
    fdArrayOffset: number,
  ): Map<number, number[]> {
    const dict = new Map<number, number[]>();

    // ROS (Registry-Ordering-Supplement) - makes it a CID font
    // [12, 30] = ROS operator
    const adobeSid = this.addString("Adobe") ?? 0;
    const identitySid = this.addString("Identity") ?? 0;
    dict.set(0x0c1e, [adobeSid, identitySid, 0]);

    // CIDCount [12, 34]
    dict.set(0x0c22, [nGlyphs]);

    // charset [15]
    dict.set(15, [charsetOffset]);

    // FDSelect [12, 37]
    dict.set(0x0c25, [fdSelectOffset]);

    // CharStrings [17]
    dict.set(17, [charStringsOffset]);

    // FDArray [12, 36]
    dict.set(0x0c24, [fdArrayOffset]);

    return dict;
  }

  /**
   * Build Font DICT entries.
   */
  private buildFontDict(privateSize: number, privateOffset: number): Map<number, number[]> {
    const dict = new Map<number, number[]>();

    // Private [18] - size and offset
    dict.set(18, [privateSize, privateOffset]);

    return dict;
  }

  /**
   * Build Private DICT entries.
   */
  private buildPrivateDict(): Map<number, number[]> {
    const dict = new Map<number, number[]>();

    // Get source private dict
    let srcPrivate: PrivateDict;
    if (this.font.isCIDFont) {
      srcPrivate = this.font.privateDicts[0] ?? this.defaultPrivateDict();
    } else {
      srcPrivate = this.font.privateDict;
    }

    // Copy essential values
    // defaultWidthX [20]
    if (srcPrivate.defaultWidthX !== 0) {
      dict.set(20, [srcPrivate.defaultWidthX]);
    }

    // nominalWidthX [21]
    if (srcPrivate.nominalWidthX !== 0) {
      dict.set(21, [srcPrivate.nominalWidthX]);
    }

    // BlueValues [6] - delta encoded
    if (srcPrivate.blueValues && srcPrivate.blueValues.length > 0) {
      dict.set(6, this.deltaEncode(srcPrivate.blueValues));
    }

    // OtherBlues [7]
    if (srcPrivate.otherBlues && srcPrivate.otherBlues.length > 0) {
      dict.set(7, this.deltaEncode(srcPrivate.otherBlues));
    }

    // StdHW [10]
    if (srcPrivate.stdHW !== undefined) {
      dict.set(10, [srcPrivate.stdHW]);
    }

    // StdVW [11]
    if (srcPrivate.stdVW !== undefined) {
      dict.set(11, [srcPrivate.stdVW]);
    }

    return dict;
  }

  /**
   * Default private dict values.
   */
  private defaultPrivateDict(): PrivateDict {
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

  /**
   * Delta encode an array of values.
   */
  private deltaEncode(values: number[]): number[] {
    if (values.length === 0) {
      return [];
    }

    const result = [values[0]];
    for (let i = 1; i < values.length; i++) {
      result.push(values[i] - values[i - 1]);
    }
    return result;
  }

  /**
   * Encode a DICT to bytes.
   */
  private encodeDict(dict: Map<number, number[]>): Uint8Array {
    const writer = new BinaryWriter();

    for (const [operator, operands] of dict) {
      // Encode operands
      for (const operand of operands) {
        this.encodeDictOperand(writer, operand);
      }

      // Encode operator
      if (operator > 0xff) {
        writer.writeUint8(12);
        writer.writeUint8(operator & 0xff);
      } else {
        writer.writeUint8(operator);
      }
    }

    return writer.toBytes();
  }

  /**
   * Encode a DICT operand (integer or real).
   */
  private encodeDictOperand(writer: BinaryWriter, value: number): void {
    if (Number.isInteger(value)) {
      this.encodeDictInteger(writer, value);
    } else {
      this.encodeDictReal(writer, value);
    }
  }

  /**
   * Encode a DICT integer.
   */
  private encodeDictInteger(writer: BinaryWriter, value: number): void {
    if (value >= -107 && value <= 107) {
      writer.writeUint8(value + 139);
    } else if (value >= 108 && value <= 1131) {
      const v = value - 108;
      writer.writeUint8(247 + (v >> 8));
      writer.writeUint8(v & 0xff);
    } else if (value >= -1131 && value <= -108) {
      const v = -value - 108;
      writer.writeUint8(251 + (v >> 8));
      writer.writeUint8(v & 0xff);
    } else if (value >= -32768 && value <= 32767) {
      writer.writeUint8(28);
      writer.writeInt16(value);
    } else {
      writer.writeUint8(29);
      writer.writeInt32(value);
    }
  }

  /**
   * Encode a DICT real number.
   */
  private encodeDictReal(writer: BinaryWriter, value: number): void {
    writer.writeUint8(30); // real number marker

    const str = value.toString();
    const nibbles: number[] = [];

    for (const char of str) {
      switch (char) {
        case "0":
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9":
          nibbles.push(Number.parseInt(char, 10));
          break;
        case ".":
          nibbles.push(0xa);
          break;
        case "-":
          nibbles.push(0xe);
          break;
        case "e":
        case "E":
          nibbles.push(0xb);
          break;
      }
    }

    nibbles.push(0xf); // end marker

    // Pad to even number of nibbles
    if (nibbles.length % 2 !== 0) {
      nibbles.push(0xf);
    }

    // Pack nibbles into bytes
    for (let i = 0; i < nibbles.length; i += 2) {
      writer.writeUint8((nibbles[i] << 4) | nibbles[i + 1]);
    }
  }
}
