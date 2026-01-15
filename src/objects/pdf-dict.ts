import type { ByteWriter } from "#src/io/byte-writer";

import type { PdfArray } from "./pdf-array";
import type { PdfBool } from "./pdf-bool";
import { PdfName } from "./pdf-name";
import type { PdfNumber } from "./pdf-number";
import type { PdfObject } from "./pdf-object";
import type { PdfPrimitive } from "./pdf-primitive";
import type { PdfRef } from "./pdf-ref";
import type { PdfString } from "./pdf-string";

/**
 * PDF dictionary object (mutable).
 *
 * In PDF: `<< /Type /Page /MediaBox [0 0 612 792] >>`
 *
 * Keys are always PdfName. Tracks modifications via a dirty flag
 * for incremental save support.
 */
export class PdfDict implements PdfPrimitive {
  get type(): "dict" | "stream" {
    return "dict";
  }

  private entries = new Map<PdfName, PdfObject>();

  /**
   * Dirty flag for modification tracking.
   * Set to true when the dict is mutated, cleared after save.
   */
  dirty = false;

  constructor(entries?: Iterable<[PdfName | string, PdfObject]>) {
    if (entries) {
      for (const [key, value] of entries) {
        const name = typeof key === "string" ? PdfName.of(key) : key;

        this.entries.set(name, value);
      }
    }
  }

  /**
   * Clear the dirty flag. Called after saving.
   */
  clearDirty(): void {
    this.dirty = false;
  }

  get size(): number {
    return this.entries.size;
  }

  /**
   * Get value for key. Key can be string or PdfName.
   */
  get(key: PdfName | string): PdfObject | undefined {
    const name = typeof key === "string" ? PdfName.of(key) : key;

    return this.entries.get(name);
  }

  /**
   * Set value for key. Key can be string or PdfName.
   */
  set(key: PdfName | string, value: PdfObject): void {
    const name = typeof key === "string" ? PdfName.of(key) : key;

    this.entries.set(name, value);
    this.dirty = true;
  }

  /**
   * Check if key exists.
   */
  has(key: PdfName | string): boolean {
    const name = typeof key === "string" ? PdfName.of(key) : key;

    return this.entries.has(name);
  }

  /**
   * Delete key. Returns true if key existed.
   */
  delete(key: PdfName | string): boolean {
    const name = typeof key === "string" ? PdfName.of(key) : key;
    const existed = this.entries.delete(name);

    if (existed) {
      this.dirty = true;
    }

    return existed;
  }

  /**
   * Iterate over keys.
   */
  keys(): Iterable<PdfName> {
    return this.entries.keys();
  }

  /**
   * Iterate over entries.
   */
  *[Symbol.iterator](): Iterator<[PdfName, PdfObject]> {
    yield* this.entries;
  }

  /**
   * Typed getters
   */

  getName(key: string): PdfName | undefined {
    const value = this.get(key);

    return value?.type === "name" ? value : undefined;
  }

  getNumber(key: string): PdfNumber | undefined {
    const value = this.get(key);

    return value?.type === "number" ? value : undefined;
  }

  getString(key: string): PdfString | undefined {
    const value = this.get(key);
    return value?.type === "string" ? value : undefined;
  }

  getArray(key: string): PdfArray | undefined {
    const value = this.get(key);
    return value?.type === "array" ? value : undefined;
  }

  getDict(key: string): PdfDict | undefined {
    const value = this.get(key);
    return value?.type === "dict" ? value : undefined;
  }

  getRef(key: string): PdfRef | undefined {
    const value = this.get(key);
    return value?.type === "ref" ? value : undefined;
  }

  getBool(key: string): PdfBool | undefined {
    const value = this.get(key);
    return value?.type === "bool" ? value : undefined;
  }

  /**
   * Create a shallow clone of this dictionary.
   * Values are shared, not deep-copied.
   */
  clone(): PdfDict {
    const cloned = new PdfDict();

    for (const [key, value] of this.entries) {
      cloned.entries.set(key, value);
    }

    return cloned;
  }

  /**
   * Create dict from entries.
   */
  static of(entries: Record<string, PdfObject>): PdfDict {
    return new PdfDict(Object.entries(entries));
  }

  toBytes(writer: ByteWriter): void {
    writer.writeAscii("<<\n");

    for (const [key, value] of this.entries) {
      // Skip null/undefined values silently (lenient serialization)
      if (value == null) {
        continue;
      }

      // Write key (PdfName implements toBytes)
      key.toBytes(writer);
      writer.writeAscii(" ");

      // Write value (each type in PdfObject union implements PdfPrimitive)
      value.toBytes(writer);
      writer.writeAscii("\n");
    }

    writer.writeAscii(">>");
  }
}
