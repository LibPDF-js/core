import { Scanner } from "./scanner.ts";

/**
 * Scanner extended with big-endian binary reading methods.
 *
 * Used for parsing binary formats like TrueType/OpenType fonts where
 * we need multi-byte reads, fixed-point numbers, and structured data.
 *
 * Key differences from base Scanner:
 * - Throws on out-of-bounds reads (malformed data should error)
 * - Big-endian by default (standard for font files)
 * - Fixed-point number support (16.16, 2.14)
 */
export class BinaryScanner extends Scanner {
  // Shared TextDecoder instance for string decoding.
  // Ideally we'd use "iso-8859-1" for pure ASCII (Latin-1) decoding,
  // but Bun doesn't support it, so we use "utf-8" which correctly handles ASCII
  // and also allows decoding of additional character data beyond ASCII.
  private static readonly _asciiTextDecoder = new TextDecoder("utf-8");

  private view: DataView;

  constructor(bytes: Uint8Array) {
    super(bytes);
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  /** Bytes remaining from current position */
  get remaining(): number {
    return this.length - this.position;
  }

  /** Skip forward by n bytes */
  skip(n: number): void {
    this.moveTo(this.position + n);
  }

  /** Read uint8 and advance */
  readUint8(): number {
    this.ensureAvailable(1);

    const value = this.view.getUint8(this.position);

    this.moveTo(this.position + 1);

    return value;
  }

  /** Read int8 and advance */
  readInt8(): number {
    this.ensureAvailable(1);

    const value = this.view.getInt8(this.position);

    this.moveTo(this.position + 1);

    return value;
  }

  /** Read uint16 big-endian and advance */
  readUint16(): number {
    this.ensureAvailable(2);

    const value = this.view.getUint16(this.position, false);

    this.moveTo(this.position + 2);

    return value;
  }

  /** Read int16 big-endian and advance */
  readInt16(): number {
    this.ensureAvailable(2);

    const value = this.view.getInt16(this.position, false);

    this.moveTo(this.position + 2);

    return value;
  }

  /** Read uint32 big-endian and advance */
  readUint32(): number {
    this.ensureAvailable(4);

    const value = this.view.getUint32(this.position, false);

    this.moveTo(this.position + 4);

    return value;
  }

  /** Read int32 big-endian and advance */
  readInt32(): number {
    this.ensureAvailable(4);

    const value = this.view.getInt32(this.position, false);

    this.moveTo(this.position + 4);

    return value;
  }

  /** Read uint24 big-endian (3 bytes) and advance */
  readUint24(): number {
    this.ensureAvailable(3);

    const b1 = this.view.getUint8(this.position);
    const b2 = this.view.getUint8(this.position + 1);
    const b3 = this.view.getUint8(this.position + 2);

    this.moveTo(this.position + 3);

    return (b1 << 16) | (b2 << 8) | b3;
  }

  /** Read 16.16 fixed-point number and advance */
  readFixed(): number {
    this.ensureAvailable(4);

    const value = this.view.getInt32(this.position, false);

    this.moveTo(this.position + 4);

    return value / 65536;
  }

  /** Read 2.14 fixed-point number and advance (used in glyf composite transforms) */
  readF2Dot14(): number {
    this.ensureAvailable(2);

    const value = this.view.getInt16(this.position, false);

    this.moveTo(this.position + 2);

    return value / 16384;
  }

  /** Read LONGDATETIME (64-bit signed, seconds since 1904-01-01) and advance */
  readLongDateTime(): Date {
    this.ensureAvailable(8);

    const high = this.view.getInt32(this.position, false);
    const low = this.view.getUint32(this.position + 4, false);

    this.moveTo(this.position + 8);

    // Convert to milliseconds since Unix epoch
    // Mac epoch (1904-01-01) to Unix epoch (1970-01-01) = 2082844800 seconds
    const macToUnix = 2082844800n;
    const seconds = (BigInt(high) << 32n) | BigInt(low);
    const unixSeconds = seconds - macToUnix;

    return new Date(Number(unixSeconds) * 1000);
  }

  /** Read 4-byte tag as string and advance */
  readTag(): string {
    this.ensureAvailable(4);

    const a = this.view.getUint8(this.position);
    const b = this.view.getUint8(this.position + 1);
    const c = this.view.getUint8(this.position + 2);
    const d = this.view.getUint8(this.position + 3);

    this.moveTo(this.position + 4);

    return String.fromCharCode(a, b, c, d);
  }

  /** Read n bytes as Uint8Array view (not a copy) and advance */
  readBytes(n: number): Uint8Array {
    this.ensureAvailable(n);

    const bytes = this.bytes.subarray(this.position, this.position + n);

    this.moveTo(this.position + n);

    return bytes;
  }

  /** Read n bytes as a copy and advance */
  readBytesCopy(n: number): Uint8Array {
    return this.readBytes(n).slice();
  }

  /** Read ASCII string of given length and advance */
  readAscii(length: number): string {
    const bytes = this.readBytes(length);

    return BinaryScanner._asciiTextDecoder.decode(bytes);
  }

  /** Read UTF-16BE string of given byte length and advance */
  readUtf16BE(byteLength: number): string {
    const bytes = this.readBytes(byteLength);
    let result = "";

    for (let i = 0; i < bytes.length; i += 2) {
      result += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    }

    return result;
  }

  /** Read null-terminated ASCII string and advance past the null */
  readNullTerminatedAscii(): string {
    const start = this.position;

    while (this.position < this.length && this.bytes[this.position] !== 0) {
      this.moveTo(this.position + 1);
    }

    const str = BinaryScanner._asciiTextDecoder.decode(this.bytes.subarray(start, this.position));

    if (this.position < this.length) {
      this.moveTo(this.position + 1); // Skip null terminator
    }

    return str;
  }

  /** Create a sub-scanner for a portion of the data */
  slice(offset: number, length: number): BinaryScanner {
    if (offset < 0 || offset + length > this.length) {
      throw new RangeError(
        `Slice [${offset}, ${offset + length}) out of bounds [0, ${this.length}]`,
      );
    }

    return new BinaryScanner(this.bytes.subarray(offset, offset + length));
  }

  /** Peek at uint16 big-endian without advancing */
  peekUint16(offset = 0): number {
    const pos = this.position + offset;
    if (pos + 2 > this.length) {
      throw new RangeError(`Cannot peek uint16 at offset ${pos}`);
    }

    return this.view.getUint16(pos, false);
  }

  /** Peek at int16 big-endian without advancing */
  peekInt16(offset = 0): number {
    const pos = this.position + offset;

    if (pos + 2 > this.length) {
      throw new RangeError(`Cannot peek int16 at offset ${pos}`);
    }

    return this.view.getInt16(pos, false);
  }

  /** Throw if not enough bytes available */
  private ensureAvailable(n: number): void {
    if (this.position + n > this.length) {
      throw new RangeError(
        `Cannot read ${n} bytes at position ${this.position}, only ${this.remaining} remaining`,
      );
    }
  }
}
