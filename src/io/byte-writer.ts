/**
 * Efficient byte buffer writer with growing capacity.
 *
 * Used for serializing PDF objects without excessive allocations.
 * The buffer doubles when needed, and toBytes() returns a trimmed slice
 * to release the oversized buffer for garbage collection.
 */

export interface ByteWriterOptions {
  /** Initial buffer size in bytes. Default: 65536 (64KB) */
  initialSize?: number;
  /** Maximum buffer size in bytes. Throws if exceeded. Default: unlimited */
  maxSize?: number;
}

export class ByteWriter {
  private buffer: Uint8Array;
  private offset = 0;
  private readonly maxSize: number;

  /**
   * Create a new ByteWriter.
   *
   * @param existingBytes - Optional existing bytes to start with (for incremental saves)
   * @param options - Configuration options
   */
  constructor(existingBytes?: Uint8Array, options: ByteWriterOptions = {}) {
    this.maxSize = options.maxSize ?? Number.MAX_SAFE_INTEGER;

    if (existingBytes) {
      // When initialSize is provided, use it directly — the caller knows the
      // expected final size. Otherwise default to 2x the existing bytes.
      const size = options.initialSize ?? existingBytes.length * 2;

      this.buffer = new Uint8Array(Math.max(size, existingBytes.length));
      this.buffer.set(existingBytes);

      this.offset = existingBytes.length;
    } else {
      this.buffer = new Uint8Array(options.initialSize ?? 65536);
    }
  }

  /**
   * Ensure capacity for `needed` more bytes, doubling buffer if necessary.
   * @throws {Error} if maxSize would be exceeded
   */
  private grow(needed: number): void {
    const requiredSize = this.offset + needed;

    // Check maxSize first, even if no growth needed
    if (requiredSize > this.maxSize) {
      throw new Error(`ByteWriter exceeded maximum size of ${this.maxSize} bytes`);
    }

    if (requiredSize <= this.buffer.length) {
      return;
    }

    let newSize = this.buffer.length;
    while (newSize < requiredSize) {
      newSize *= 2;
    }

    // Cap at maxSize to avoid over-allocating
    newSize = Math.min(newSize, this.maxSize);

    const newBuffer = new Uint8Array(newSize);
    newBuffer.set(this.buffer.subarray(0, this.offset));
    this.buffer = newBuffer;
  }

  /** Current write position (number of bytes written) */
  get position(): number {
    return this.offset;
  }

  /** Write a single byte */
  writeByte(b: number): void {
    this.grow(1);
    this.buffer[this.offset++] = b;
  }

  /** Write raw bytes */
  writeBytes(data: Uint8Array): void {
    this.grow(data.length);
    this.buffer.set(data, this.offset);
    this.offset += data.length;
  }

  /**
   * Write ASCII string (fast path, no encoding needed).
   * Only use for strings known to be ASCII (PDF keywords, numbers, etc.)
   */
  writeAscii(str: string): void {
    this.grow(str.length);
    for (let i = 0; i < str.length; i++) {
      this.buffer[this.offset++] = str.charCodeAt(i);
    }
  }

  /** Write string as UTF-8 */
  writeUtf8(str: string): void {
    const encoded = new TextEncoder().encode(str);
    this.writeBytes(encoded);
  }

  /**
   * Get final bytes.
   *
   * If the internal buffer is exactly the right size, returns it directly
   * (zero-copy). Otherwise returns a trimmed copy so the oversized buffer
   * can be garbage collected.
   *
   * Note: ByteWriter is single-use. Do not write after calling toBytes().
   */
  toBytes(): Uint8Array {
    if (this.offset === this.buffer.length) {
      return this.buffer;
    }

    return this.buffer.subarray(0, this.offset);
  }
}
