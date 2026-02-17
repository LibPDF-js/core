import { LRUCache } from "#src/helpers/lru-cache";
import type { ByteWriter } from "#src/io/byte-writer";

import type { PdfPrimitive } from "./pdf-primitive";

/**
 * Default cache size for PdfRef interning.
 * Object references tend to be more numerous than names in typical PDFs.
 */
const DEFAULT_REF_CACHE_SIZE = 20000;

/**
 * PDF indirect reference (interned).
 *
 * In PDF: `1 0 R`, `42 0 R`
 *
 * References are interned using an LRU cache to prevent unbounded memory growth.
 * `PdfRef.of(1, 0) === PdfRef.of(1, 0)` as long as both are in cache.
 * Use `.of()` to get or create instances.
 */
export class PdfRef implements PdfPrimitive {
  get type(): "ref" {
    return "ref";
  }

  private static cache = new LRUCache<string, PdfRef>({ max: DEFAULT_REF_CACHE_SIZE });

  private constructor(
    readonly objectNumber: number,
    readonly generation: number,
  ) {}

  /**
   * Get or create an interned PdfRef for the given object/generation pair.
   */
  static of(objectNumber: number, generation: number = 0): PdfRef {
    const key = `${objectNumber} ${generation}`;

    let cached = PdfRef.cache.get(key);

    if (!cached) {
      cached = new PdfRef(objectNumber, generation);
      PdfRef.cache.set(key, cached);
    }

    return cached;
  }

  /**
   * Clear the reference cache.
   *
   * Useful for long-running applications that process many PDFs
   * and want to reclaim memory between documents.
   */
  static clearCache(): void {
    PdfRef.cache.clear();
  }

  /**
   * Get the current size of the LRU cache.
   */
  static get cacheSize(): number {
    return PdfRef.cache.size;
  }

  /**
   * Returns the PDF syntax representation: "1 0 R"
   */
  toString(): string {
    return `${this.objectNumber} ${this.generation} R`;
  }

  toBytes(writer: ByteWriter): void {
    writer.writeAscii(`${this.objectNumber} ${this.generation} R`);
  }
}
