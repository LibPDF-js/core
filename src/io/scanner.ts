/**
 * Scanner - the lowest-level byte reader for PDF parsing.
 *
 * Wraps a Uint8Array and provides position tracking, peeking, and advancing.
 * This is a minimal foundation for the lexer to build on.
 *
 * Key design decisions:
 * - Returns -1 for EOF (classic C-style sentinel)
 * - Backtracking via save/restore of position property
 * - Clamps out-of-bounds positions instead of throwing
 * - Bytes-only operations; PDF-specific concepts belong in the lexer
 */
export class Scanner {
  /** The underlying byte array (readonly access) */
  readonly bytes: Uint8Array;

  /** Total number of bytes */
  readonly length: number;

  /** Internal position tracking */
  private _position: number = 0;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
    this.length = bytes.length;
  }

  /**
   * Current byte offset.
   * Readable and writable for backtracking.
   * Setting a value outside [0, length] clamps to that range.
   */
  get position(): number {
    return this._position;
  }

  /**
   * True if position >= length (no more bytes to read).
   */
  get isAtEnd(): boolean {
    return this._position >= this.length;
  }

  /**
   * Returns byte at current position, or -1 if at end.
   * Does not advance position.
   */
  peek(): number {
    if (this._position >= this.length) {
      return -1;
    }

    const byte = this.bytes[this._position];

    if (byte === undefined) {
      return -1;
    }

    return byte;
  }

  /**
   * Returns byte at absolute offset, or -1 if out of bounds.
   * Does not affect position.
   */
  peekAt(offset: number): number {
    if (offset < 0 || offset >= this.length) {
      return -1;
    }

    const byte = this.bytes[offset];

    if (byte === undefined) {
      return -1;
    }

    return byte;
  }

  /**
   * Advances position by 1 and returns the byte that was at the old position.
   * Returns -1 and does not advance if already at end.
   */
  advance(): number {
    if (this._position >= this.length) {
      return -1;
    }

    const byte = this.bytes[this._position];

    if (byte === undefined) {
      return -1;
    }

    this._position++;
    return byte;
  }

  /**
   * If current byte equals expected, advances and returns true.
   * Otherwise returns false without advancing.
   */
  match(expected: number): boolean {
    if (this._position >= this.length) {
      return false;
    }

    const byte = this.bytes[this._position];

    if (byte === undefined) {
      return false;
    }

    if (byte === expected) {
      this._position++;

      return true;
    }

    return false;
  }

  /**
   * Moves position to the given offset.
   * Clamps to valid range [0, length].
   */
  moveTo(offset: number): void {
    this._position = Math.max(0, Math.min(offset, this.length));
  }
}
