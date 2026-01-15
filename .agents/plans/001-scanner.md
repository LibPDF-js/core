# Plan: Scanner

The scanner is the lowest layer — it reads bytes and provides primitives for the lexer to build on.

## Goal

Create a `Scanner` that wraps a `Uint8Array` and provides:

- Position tracking with save/restore for backtracking
- Peeking and advancing through bytes
- Minimal API — lexer builds higher-level patterns on top

## API

```typescript
class Scanner {
  /** The underlying byte array (readonly access) */
  readonly bytes: Uint8Array;

  /** Total number of bytes */
  readonly length: number;

  /** Current byte offset (readable and writable for backtracking) */
  position: number;

  /** True if position >= length */
  readonly isAtEnd: boolean;

  constructor(bytes: Uint8Array);

  /**
   * Returns byte at current position, or -1 if at end.
   * Does not advance position.
   */
  peek(): number;

  /**
   * Returns byte at absolute offset, or -1 if out of bounds.
   * Does not affect position.
   */
  peekAt(offset: number): number;

  /**
   * Advances position by 1 and returns the byte that was at the old position.
   * Returns -1 and does not advance if already at end.
   */
  advance(): number;

  /**
   * If current byte equals expected, advances and returns true.
   * Otherwise returns false without advancing.
   */
  match(expected: number): boolean;

  /**
   * Moves position to the given offset.
   * Clamps to valid range [0, length].
   */
  moveTo(offset: number): void;
}
```

## Design Decisions

### EOF Handling: -1 Sentinel

`peek()` and `advance()` return -1 at end of input. This is the classic C-style approach — simple to check and avoids undefined/null complexity.

```typescript
while (scanner.peek() !== -1) {
  // process byte
}
```

### Backtracking: Save/Restore Position

Following pdf-lib's pattern, backtracking is done by saving and restoring `position`:

```typescript
const mark = scanner.position;
// try to parse something
if (failed) {
  scanner.moveTo(mark); // restore
}
```

No mark stack or dedicated mark/reset API — just use the position property directly.

### Boundary: Bytes Only

Scanner handles only byte-level operations. PDF-specific concepts (whitespace, delimiters, tokens) belong in the lexer. This keeps Scanner simple and reusable.

### Newlines: No Normalization

Scanner sees raw bytes. CR (0x0D), LF (0x0A), and CRLF sequences are passed through unchanged. The lexer handles newline semantics.

### Error Behavior: Return Indicators

- `advance()` returns -1 if at end (does not advance)
- `moveTo()` clamps to valid range instead of throwing
- Matches lenient parsing philosophy — don't crash on edge cases

### No slice()

YAGNI. If the lexer needs a byte range, it can use `scanner.bytes.subarray(start, end)` directly.

## Usage Example

```typescript
const scanner = new Scanner(bytes);

// Read PDF header: %PDF-1.x
if (scanner.match(0x25)) {
  // %
  const mark = scanner.position;

  if (scanner.match(0x50) && scanner.match(0x44) && scanner.match(0x46)) {
    // PDF
    // valid header start
  } else {
    scanner.moveTo(mark); // backtrack
  }
}

// Peek ahead without moving
const nextByte = scanner.peek();
const byteAt100 = scanner.peekAt(100);

// Direct bytes access for slicing
const header = scanner.bytes.subarray(0, 8);
```

## Test Cases

1. **Construction** — scanner from empty and non-empty Uint8Array
2. **peek()** — returns current byte, -1 at end, doesn't advance
3. **peekAt(offset)** — returns byte at offset, -1 if out of bounds
4. **advance()** — returns byte and advances, -1 at end without advancing
5. **match(byte)** — advances and returns true on match, false otherwise
6. **position** — starts at 0, increments correctly
7. **moveTo(offset)** — sets position, clamps to bounds
8. **isAtEnd** — true when position >= length
9. **bytes** — exposes underlying array
10. **Backtracking** — save position, advance, restore, verify position

## File Location

`src/parser/scanner.ts` with tests in `src/parser/scanner.test.ts`

## Next Steps

After scanner is complete:

1. Build lexer on top — `nextToken()` returns typed tokens
2. Token types: Number, Name, String, HexString, Keyword, Delimiter, Comment, EOF
