import { HEX_TABLE } from "#src/helpers/buffer";
import { CHAR_HASH, DELIMITERS, WHITESPACE } from "#src/helpers/chars";
import { LRUCache } from "#src/helpers/lru-cache";
import type { ByteWriter } from "#src/io/byte-writer";

import type { PdfPrimitive } from "./pdf-primitive";

// Characters that need hex escaping in names (PDF 1.7 spec 7.3.5)
// These are: whitespace, delimiters (), <>, [], {}, /, %, #
// Plus anything outside printable ASCII (33-126)
const NAME_NEEDS_ESCAPE = new Set([...WHITESPACE, ...DELIMITERS, CHAR_HASH]);

/** Module-level encoder — avoids constructing one per escapeName call. */
const textEncoder = new TextEncoder();

/**
 * Check whether a name is pure "safe" ASCII — every char is printable ASCII
 * (33–126) and not in the escape set. If so, no escaping is needed and we
 * can skip the TextEncoder entirely.
 */
function isSimpleAsciiName(name: string): boolean {
  for (let i = 0; i < name.length; i++) {
    const c = name.charCodeAt(i);

    if (c < 33 || c > 126 || NAME_NEEDS_ESCAPE.has(c)) {
      return false;
    }
  }

  return true;
}

/**
 * Escape a PDF name for serialization.
 *
 * Uses #XX hex escaping for:
 * - Bytes outside printable ASCII (33-126)
 * - Delimiter characters
 * - The # character itself
 */
function escapeName(name: string): string {
  // Fast path: pure safe ASCII — no encoding or escaping needed
  if (isSimpleAsciiName(name)) {
    return name;
  }

  const bytes = textEncoder.encode(name);

  let result = "";

  for (const byte of bytes) {
    if (byte < 33 || byte > 126 || NAME_NEEDS_ESCAPE.has(byte)) {
      result += `#${HEX_TABLE[byte]}`;
    } else {
      result += String.fromCharCode(byte);
    }
  }

  return result;
}

/**
 * Default cache size for PdfName interning.
 * Can be overridden via PdfName.setCacheSize().
 */
const DEFAULT_NAME_CACHE_SIZE = 10000;

/**
 * PDF name object (interned).
 *
 * In PDF: `/Type`, `/Page`, `/Length`
 *
 * Names are interned using an LRU cache to prevent unbounded memory growth.
 * `PdfName.of("Type") === PdfName.of("Type")` as long as both are in cache.
 * Use `.of()` to get or create instances.
 *
 * Common PDF names (Type, Page, etc.) are pre-cached and always available.
 */
export class PdfName implements PdfPrimitive {
  get type(): "name" {
    return "name";
  }

  private static cache = new LRUCache<string, PdfName>({ max: DEFAULT_NAME_CACHE_SIZE });

  /**
   * Pre-cached common names that should never be evicted.
   * These are stored separately from the LRU cache.
   */
  private static readonly permanentCache = new Map<string, PdfName>();

  // Common PDF names (pre-cached in permanent cache)
  static readonly Type = PdfName.createPermanent("Type");
  static readonly Page = PdfName.createPermanent("Page");
  static readonly Pages = PdfName.createPermanent("Pages");
  static readonly Catalog = PdfName.createPermanent("Catalog");
  static readonly Count = PdfName.createPermanent("Count");
  static readonly Kids = PdfName.createPermanent("Kids");
  static readonly Parent = PdfName.createPermanent("Parent");
  static readonly MediaBox = PdfName.createPermanent("MediaBox");
  static readonly Resources = PdfName.createPermanent("Resources");
  static readonly Contents = PdfName.createPermanent("Contents");
  static readonly Length = PdfName.createPermanent("Length");
  static readonly Filter = PdfName.createPermanent("Filter");
  static readonly FlateDecode = PdfName.createPermanent("FlateDecode");

  /** Cached serialized form (e.g. "/Type"). Computed lazily on first toBytes(). */
  private cachedBytes: Uint8Array | null = null;

  private constructor(readonly value: string) {}

  /**
   * Get or create an interned PdfName for the given string.
   * The leading `/` should NOT be included.
   */
  static of(name: string): PdfName {
    // Check permanent cache first (common names)
    const permanent = PdfName.permanentCache.get(name);
    if (permanent) {
      return permanent;
    }

    // Check LRU cache
    let cached = PdfName.cache.get(name);

    if (!cached) {
      cached = new PdfName(name);
      PdfName.cache.set(name, cached);
    }

    return cached;
  }

  /**
   * Clear the name cache.
   *
   * Useful for long-running applications that process many PDFs
   * and want to reclaim memory between documents.
   *
   * Note: Common names (Type, Page, etc.) are not cleared.
   */
  static clearCache(): void {
    PdfName.cache.clear();
  }

  /**
   * Get the current size of the LRU cache.
   */
  static get cacheSize(): number {
    return PdfName.cache.size;
  }

  toBytes(writer: ByteWriter): void {
    let bytes = this.cachedBytes;

    if (bytes === null) {
      const escaped = escapeName(this.value);

      bytes = textEncoder.encode(`/${escaped}`);

      this.cachedBytes = bytes;
    }

    writer.writeBytes(bytes);
  }

  /**
   * Create a permanent (non-evictable) name.
   * Used for common PDF names that should always be cached.
   */
  private static createPermanent(name: string): PdfName {
    const instance = new PdfName(name);

    PdfName.permanentCache.set(name, instance);

    return instance;
  }
}
