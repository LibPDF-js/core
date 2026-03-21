import { HEX_TABLE } from "#src/helpers/buffer";
import { CHAR_HASH, DELIMITERS, WHITESPACE } from "#src/helpers/chars";
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
 * PDF name object (interned via WeakRef).
 *
 * In PDF: `/Type`, `/Page`, `/Length`
 *
 * Names are interned using a WeakRef cache: as long as any live object
 * (e.g. a PdfDict key) holds a strong reference to a PdfName, calling
 * `PdfName.of()` with the same string returns the *same instance*.
 * Once all strong references are dropped, the GC may collect the
 * PdfName and a FinalizationRegistry cleans up the cache entry.
 *
 * This avoids the correctness bug of LRU-based caching, where eviction
 * of a still-referenced name would break Map key identity in PdfDict.
 *
 * Common PDF names (Type, Page, etc.) are held as static fields and
 * therefore never collected.
 */
export class PdfName implements PdfPrimitive {
  get type(): "name" {
    return "name";
  }

  /** WeakRef cache for interning. Entries are cleaned up by the FinalizationRegistry. */
  private static cache = new Map<string, WeakRef<PdfName>>();

  /** Cleans up dead WeakRef entries from the cache when a PdfName is GC'd. */
  private static registry = new FinalizationRegistry<string>(name => {
    const ref = PdfName.cache.get(name);

    // Only delete if the entry is actually dead — a new instance for the
    // same name may have been inserted since the old one was collected.
    if (ref && ref.deref() === undefined) {
      PdfName.cache.delete(name);
    }
  });

  /**
   * Pre-cached common names that are always available.
   * These are stored as static readonly fields, so they always have
   * strong references and their WeakRefs never die.
   */
  private static readonly permanentCache = new Map<string, PdfName>();

  // Common PDF names (pre-cached in permanent cache)
  // -- Document structure --
  static readonly Type = PdfName.createPermanent("Type");
  static readonly Subtype = PdfName.createPermanent("Subtype");
  static readonly Page = PdfName.createPermanent("Page");
  static readonly Pages = PdfName.createPermanent("Pages");
  static readonly Catalog = PdfName.createPermanent("Catalog");
  static readonly Count = PdfName.createPermanent("Count");
  static readonly Kids = PdfName.createPermanent("Kids");
  static readonly Parent = PdfName.createPermanent("Parent");
  static readonly MediaBox = PdfName.createPermanent("MediaBox");
  static readonly Resources = PdfName.createPermanent("Resources");
  static readonly Contents = PdfName.createPermanent("Contents");
  static readonly Annots = PdfName.createPermanent("Annots");
  // -- Trailer / xref --
  static readonly Root = PdfName.createPermanent("Root");
  static readonly Size = PdfName.createPermanent("Size");
  static readonly Info = PdfName.createPermanent("Info");
  static readonly Prev = PdfName.createPermanent("Prev");
  static readonly ID = PdfName.createPermanent("ID");
  static readonly Encrypt = PdfName.createPermanent("Encrypt");
  // -- Streams --
  static readonly Length = PdfName.createPermanent("Length");
  static readonly Filter = PdfName.createPermanent("Filter");
  static readonly FlateDecode = PdfName.createPermanent("FlateDecode");
  // -- Fonts / resources --
  static readonly Font = PdfName.createPermanent("Font");
  static readonly BaseFont = PdfName.createPermanent("BaseFont");
  static readonly Encoding = PdfName.createPermanent("Encoding");
  static readonly XObject = PdfName.createPermanent("XObject");
  // -- Name trees --
  static readonly Names = PdfName.createPermanent("Names");

  /** Cached serialized form (e.g. "/Type"). Computed lazily on first toBytes(). */
  private cachedBytes: Uint8Array | null = null;

  private constructor(readonly value: string) {}

  /**
   * Get or create an interned PdfName for the given string.
   * The leading `/` should NOT be included.
   */
  static of(name: string): PdfName {
    // Check permanent cache first (common names — always alive)
    const permanent = PdfName.permanentCache.get(name);

    if (permanent) {
      return permanent;
    }

    // Check WeakRef cache
    const ref = PdfName.cache.get(name);

    if (ref) {
      const existing = ref.deref();

      if (existing) {
        return existing;
      }
    }

    // Create new instance, store WeakRef, register for cleanup
    const instance = new PdfName(name);

    PdfName.cache.set(name, new WeakRef(instance));
    PdfName.registry.register(instance, name);

    return instance;
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
   * Get the current number of entries in the WeakRef cache.
   * This includes entries whose targets may have been GC'd but whose
   * FinalizationRegistry callbacks haven't run yet.
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
