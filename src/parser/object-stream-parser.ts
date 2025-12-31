import { Scanner } from "#src/io/scanner";
import type { PdfObject } from "#src/objects/object";
import type { PdfStream } from "#src/objects/pdf-stream";
import { ObjectParser } from "./object-parser";
import { TokenReader } from "./token-reader";

/**
 * Index entry for an object within an object stream.
 */
interface ObjectStreamEntry {
  /** Object number */
  objNum: number;
  /** Byte offset relative to /First */
  offset: number;
}

/**
 * Parser for PDF object streams (/Type /ObjStm).
 *
 * Object streams (PDF 1.5+) store multiple objects in a single compressed stream,
 * enabling significant file size reduction. The stream format is:
 *
 * 1. Index section: N pairs of integers (objNum offset)
 * 2. Object section: Objects stored sequentially without obj/endobj wrappers
 *
 * @example
 * ```typescript
 * const parser = new ObjectStreamParser(stream);
 * await parser.parse();
 *
 * // Get object by index (from XRef entry)
 * const obj = await parser.getObject(0);
 *
 * // Get all objects at once
 * const allObjects = await parser.getAllObjects();
 * ```
 */
export class ObjectStreamParser {
  private index: ObjectStreamEntry[] | null = null;
  private decodedData: Uint8Array | null = null;
  private readonly first: number;
  private readonly n: number;

  constructor(private stream: PdfStream) {
    // Validate stream type
    const type = stream.getName("Type");

    if (type?.value !== "ObjStm") {
      throw new Error(`Expected /Type /ObjStm, got ${type?.value ?? "none"}`);
    }

    // Read required entries
    const n = stream.getNumber("N");
    const first = stream.getNumber("First");

    if (n === undefined) {
      throw new Error("Object stream missing required /N entry");
    }

    if (first === undefined) {
      throw new Error("Object stream missing required /First entry");
    }

    this.n = n.value;
    this.first = first.value;
  }

  /**
   * Decompress and parse the stream index.
   * Called automatically by getObject/getAllObjects if needed.
   */
  async parse(): Promise<void> {
    if (this.index !== null) {
      return; // Already parsed
    }

    // Decompress stream data
    this.decodedData = await this.stream.getDecodedData();

    // Parse the index (N pairs of integers before /First)
    this.index = this.parseIndex();
  }

  /**
   * Parse the index section of the object stream.
   * Returns array of (objNum, offset) pairs.
   */
  private parseIndex(): ObjectStreamEntry[] {
    const result: ObjectStreamEntry[] = [];

    // Create scanner for the index portion only
    const indexData = this.decodedData!.subarray(0, this.first);
    const scanner = new Scanner(indexData);
    const reader = new TokenReader(scanner);

    for (let i = 0; i < this.n; i++) {
      const objNumToken = reader.nextToken();
      const offsetToken = reader.nextToken();

      if (objNumToken.type !== "number") {
        throw new Error(
          `Invalid object stream index at entry ${i}: expected object number, got ${objNumToken.type}`,
        );
      }

      if (offsetToken.type !== "number") {
        throw new Error(
          `Invalid object stream index at entry ${i}: expected offset, got ${offsetToken.type}`,
        );
      }

      result.push({
        objNum: objNumToken.value,
        offset: offsetToken.value,
      });
    }

    return result;
  }

  /**
   * Get an object by its index within the stream.
   *
   * @param index - 0-based index from XRef entry's indexInStream
   * @returns The parsed object, or null if index is out of range
   */
  async getObject(index: number): Promise<PdfObject | null> {
    await this.parse();

    if (index < 0 || index >= this.index!.length) {
      return null;
    }

    const entry = this.index![index];

    // Create scanner starting at the object's offset within the object section
    const objectSection = this.decodedData!.subarray(this.first);
    const scanner = new Scanner(objectSection);

    scanner.moveTo(entry.offset);

    const reader = new TokenReader(scanner);
    const parser = new ObjectParser(reader);

    const result = parser.parseObject();

    return result?.object ?? null;
  }

  /**
   * Get all objects in this stream.
   *
   * @returns Map of object number → parsed object
   */
  async getAllObjects(): Promise<Map<number, PdfObject>> {
    await this.parse();

    const result = new Map<number, PdfObject>();

    for (let i = 0; i < this.index!.length; i++) {
      const obj = await this.getObject(i);

      if (obj !== null) {
        result.set(this.index![i].objNum, obj);
      }
    }

    return result;
  }

  /**
   * Get the object number at a given index.
   *
   * @param index - 0-based index from XRef entry's indexInStream
   * @returns Object number, or null if index is out of range
   */
  getObjectNumber(index: number): number | null {
    if (!this.index || index < 0 || index >= this.index.length) {
      return null;
    }

    return this.index[index].objNum;
  }

  /**
   * Get the number of objects in this stream.
   */
  get objectCount(): number {
    return this.n;
  }

  /**
   * Check if the stream has been parsed yet.
   */
  get isParsed(): boolean {
    return this.index !== null;
  }
}
