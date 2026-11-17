/**
 * Decode size limits for stream filters.
 *
 * A small PDF can hold a stream that decodes to gigabytes (a decompression
 * bomb). By default nothing is limited. Callers that read untrusted PDFs,
 * especially on memory-constrained runtimes, can opt in with
 * `setDecodeLimit()`.
 *
 * The limits are module-level because `getDecodedData()` is called from many
 * places that have no document handle.
 */

/**
 * Thrown when decoding a stream would exceed a configured decode limit.
 */
export class DecodeLimitError extends Error {
  readonly limit: number;

  constructor(limit: number) {
    super(`Decoded data exceeds the limit of ${limit} bytes`);
    this.name = "DecodeLimitError";
    this.limit = limit;
  }
}

export interface DecodeLimitOptions {
  /**
   * Maximum decoded size of a single stream, in bytes.
   *
   * @default Infinity
   */
  maxStreamBytes?: number;

  /**
   * Maximum decoded size of all streams decoded since the last
   * `resetDecodedBytes()` call, in bytes.
   *
   * @default Infinity
   */
  maxTotalBytes?: number;

  /**
   * Called every time a limit is hit, just before `DecodeLimitError` is thrown.
   *
   * Some internal callers catch decode errors and carry on with empty data, so
   * a thrown error alone can go unnoticed. This hook always fires.
   */
  onExceeded?: () => void;
}

let maxStreamBytes = Infinity;
let maxTotalBytes = Infinity;
let onExceeded: (() => void) | undefined;
let totalBytes = 0;

/**
 * Set the decode limits. Options that are omitted are unlimited, so calling
 * `setDecodeLimit({})` removes every limit.
 */
export function setDecodeLimit(options: DecodeLimitOptions): void {
  maxStreamBytes = options.maxStreamBytes ?? Infinity;
  maxTotalBytes = options.maxTotalBytes ?? Infinity;
  onExceeded = options.onExceeded;
}

/**
 * Start a new total count for `maxTotalBytes`.
 */
export function resetDecodedBytes(): void {
  totalBytes = 0;
}

/**
 * Record decoded output and enforce the limits.
 *
 * @param streamBytes - Bytes decoded so far for the current stream, including this chunk
 * @param chunkBytes - Size of the chunk about to be produced
 * @throws {DecodeLimitError} If a limit is exceeded
 */
export function countDecoded(streamBytes: number, chunkBytes: number): void {
  // A count that is not a non-negative number would lower the total.
  if (
    !(
      chunkBytes >= 0 &&
      streamBytes >= 0 &&
      Number.isFinite(chunkBytes) &&
      Number.isFinite(streamBytes)
    )
  ) {
    throw new RangeError(
      `Decoded byte count must be a non-negative number, got ${chunkBytes} of ${streamBytes}`,
    );
  }

  totalBytes += chunkBytes;

  if (streamBytes > maxStreamBytes) {
    onExceeded?.();

    throw new DecodeLimitError(maxStreamBytes);
  }

  if (totalBytes > maxTotalBytes) {
    onExceeded?.();

    throw new DecodeLimitError(maxTotalBytes);
  }
}
