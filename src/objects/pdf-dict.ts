import type { PdfObject } from "./object";
import type { PdfArray } from "./pdf-array";
import type { PdfBool } from "./pdf-bool";
import { PdfName } from "./pdf-name";
import type { PdfNumber } from "./pdf-number";
import type { PdfRef } from "./pdf-ref";
import type { PdfString } from "./pdf-string";

/**
 * PDF dictionary object (mutable).
 *
 * In PDF: `<< /Type /Page /MediaBox [0 0 612 792] >>`
 *
 * Keys are always PdfName. Supports an optional mutation hook.
 */
export class PdfDict {
  get type(): "dict" | "stream" {
    return "dict";
  }

  private entries = new Map<PdfName, PdfObject>();
  private onMutate?: () => void;

  constructor(entries?: Iterable<[PdfName | string, PdfObject]>) {
    if (entries) {
      for (const [key, value] of entries) {
        const name = typeof key === "string" ? PdfName.of(key) : key;

        this.entries.set(name, value);
      }
    }
  }

  /**
   * Set a callback to be invoked whenever the dict is mutated.
   * Used by the document layer for dirty tracking.
   */
  setMutationHandler(handler: () => void): void {
    this.onMutate = handler;
  }

  protected notifyMutation(): void {
    this.onMutate?.();
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

    this.notifyMutation();
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
      this.notifyMutation();
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

    return value?.type === "number" ? (value as PdfNumber) : undefined;
  }

  getString(key: string): PdfString | undefined {
    const value = this.get(key);
    return value?.type === "string" ? (value as PdfString) : undefined;
  }

  getArray(key: string): PdfArray | undefined {
    const value = this.get(key);
    return value?.type === "array" ? (value as PdfArray) : undefined;
  }

  getDict(key: string): PdfDict | undefined {
    const value = this.get(key);
    return value?.type === "dict" ? (value as PdfDict) : undefined;
  }

  getRef(key: string): PdfRef | undefined {
    const value = this.get(key);
    return value?.type === "ref" ? (value as PdfRef) : undefined;
  }

  getBool(key: string): PdfBool | undefined {
    const value = this.get(key);
    return value?.type === "bool" ? (value as PdfBool) : undefined;
  }

  /**
   * Create dict from entries.
   */
  static of(entries: Record<string, PdfObject>): PdfDict {
    return new PdfDict(Object.entries(entries));
  }
}
