# ObjectParser Spec

## Purpose

Recursive descent parser that builds `PdfObject` instances from tokens. Sits on top of TokenReader and uses 2-token lookahead to handle PDF's ambiguous syntax.

## Architecture

```
TokenReader          ← On-demand tokenization (existing)
       ↓
ObjectParser         ← Direct object parsing (this spec)
       ↓
DocumentParser       ← Indirect objects, xref, trailer (future)
       ↓
BruteForceParser     ← Recovery fallback (future, separate spec)
```

## Scope

**In scope:**
- Parsing direct objects: null, bool, number, name, string, array, dict, ref
- 2-token lookahead for `N M R` reference detection
- Recovery mode for partial results on malformed input
- Stream detection (peek for `stream` keyword after dict)

**Out of scope (handled by higher layers):**
- Indirect object wrapper (`N M obj ... endobj`)
- Stream binary data (needs Length from xref resolution)
- XRef tables and trailers
- Brute-force recovery

## API

```typescript
type ParseResult =
  | { object: PdfObject; hasStream: false }
  | { object: PdfDict; hasStream: true };

type WarningCallback = (message: string, position: number) => void;

class ObjectParser {
  constructor(reader: TokenReader)

  /**
   * Parse a single object at current position.
   * Returns null if at EOF.
   * Returns { object, hasStream } where hasStream indicates
   * the 'stream' keyword follows (caller must read binary data).
   */
  parseObject(): ParseResult | null

  /**
   * Enable recovery mode for lenient parsing.
   * When true, returns partial results instead of throwing.
   */
  recoveryMode: boolean

  /**
   * Optional callback for warnings during parsing.
   * Called for recoverable issues like invalid dict keys.
   */
  onWarning: WarningCallback | null
}
```

## 2-Token Lookahead

PDF syntax is ambiguous:
- `1 0 R` → indirect reference to object 1, generation 0
- `1 0` → two separate numbers

**Solution** (from pdf.js): Maintain two token buffers.

```
buf1: current token
buf2: lookahead token

After reading an integer:
  - If buf1 is also integer AND buf2 is "R" keyword → parse as reference
  - Otherwise → return the number
```

## Parsing Rules

### Primitives

| Token | Result |
|-------|--------|
| `keyword "null"` | `PdfNull.instance` |
| `keyword "true"` | `PdfBool.TRUE` |
| `keyword "false"` | `PdfBool.FALSE` |
| `number` | `PdfNumber.of(value)` |
| `name` | `PdfName.of(value)` |
| `string` | `new PdfString(bytes, format)` |
| EOF | `null` (no object to parse) |

### References

When current token is an integer:
1. Check if `buf1` (next token) is also an integer
2. Check if `buf2` (token after that) is keyword `"R"`
3. If both true → `PdfRef.of(objNum, genNum)`, consume all three tokens
4. Otherwise → return just the number

**Validation:**
- Normal mode: Reject negative objNum, negative genNum, or genNum > 65535
- Recovery mode: Accept any integers, call `onWarning` for invalid values

```
Input: 10 0 R
       ^
       current=10 (number)

Peek ahead:
  buf1=0 (number) ✓
  buf2=R (keyword) ✓

Result: PdfRef.of(10, 0)
```

### Arrays

On `[` delimiter:
1. Create empty array
2. Loop: call `parseObject()` until `]` delimiter or EOF
3. On EOF in recovery mode: return partial array, call `onWarning`
4. On EOF normally: throw error

```
Input: [1 2 /Name]
Result: PdfArray containing [PdfNumber(1), PdfNumber(2), PdfName("Name")]
```

### Dictionaries

On `<<` delimiter:
1. Create empty dict
2. Loop until `>>` or EOF:
   - Read key (must be name token)
   - Read value (recursive `parseObject()`)
   - Store key→value
3. On non-name key in recovery mode: call `onWarning`, skip to next name
4. On non-name key normally: throw error
5. On EOF: return partial dict (recovery) or throw

```
Input: << /Type /Page /Count 5 >>
Result: PdfDict { Type: PdfName("Page"), Count: PdfNumber(5) }
```

### Stream Detection

After parsing a dictionary, peek at the next token:
- If `keyword "stream"` → return `{ object: dict, hasStream: true }`
- Otherwise → return `{ object: dict, hasStream: false }`

The `stream` keyword is NOT consumed. Caller (DocumentParser) is responsible for:
1. Consuming the `stream` keyword
2. Resolving `/Length` if it's an indirect reference
3. Reading the binary data
4. Constructing `PdfStream`

**Rationale**: Stream length may be an indirect reference that requires xref lookup. ObjectParser doesn't have xref access.

## Recovery Mode

When `recoveryMode = true`:

| Situation | Normal | Recovery |
|-----------|--------|----------|
| EOF in array | throw | return partial array + warn |
| EOF in dict | throw | return partial dict + warn |
| Invalid dict key | throw | skip to next name + warn |
| Invalid reference values | throw | accept + warn |
| Unexpected token | throw | skip + warn |

All warnings go through the `onWarning` callback with message and byte position.

## Recursion Protection

Limit nesting depth to prevent stack overflow on malformed input:

```typescript
private static readonly MAX_DEPTH = 500;
private depth = 0;

parseObject(): ParseResult | null {
  if (++this.depth > MAX_DEPTH) {
    throw new Error("Maximum nesting depth exceeded");
  }
  try {
    // ... parsing logic
  } finally {
    this.depth--;
  }
}
```

## Internal State

```typescript
class ObjectParser {
  private reader: TokenReader;
  private buf1: Token | null = null;
  private buf2: Token | null = null;

  recoveryMode = false;
  onWarning: WarningCallback | null = null;

  private shift(): void {
    this.buf1 = this.buf2;
    this.buf2 = this.reader.nextToken();
  }

  private refill(): void {
    this.buf1 = this.reader.nextToken();
    this.buf2 = this.reader.nextToken();
  }

  private warn(message: string): void {
    this.onWarning?.(message, this.reader.position);
  }
}
```

## Test Cases

### Primitives
- `null` → PdfNull
- `true`, `false` → PdfBool
- `42`, `-3.14`, `.5` → PdfNumber
- `/Name`, `/Type` → PdfName
- `(Hello)`, `<48656C6C6F>` → PdfString
- (empty input) → null

### References
- `1 0 R` → PdfRef(1, 0)
- `1 0` (no R) → PdfNumber(1), then PdfNumber(0) on next call
- `-1 0 R` in normal mode → throw
- `-1 0 R` in recovery mode → PdfRef(-1, 0) + warning

### Arrays
- `[]` → empty array
- `[1 2 3]` → array of numbers
- `[/Name (string) 1 0 R]` → mixed types
- `[[1 2] [3 4]]` → nested arrays
- `[1 2` (missing `]`) in recovery → partial array + warning

### Dictionaries
- `<< >>` → empty dict
- `<< /Type /Page >>` → simple dict
- `<< /Kids [1 0 R 2 0 R] >>` → dict with array value
- `<< /A << /B 1 >> >>` → nested dicts
- `<< /Type /Page` (missing `>>`) in recovery → partial dict + warning

### Stream Detection
- `<< /Length 5 >> stream` → { object: dict, hasStream: true }
- `<< /Type /Page >>` → { object: dict, hasStream: false }

### Edge Cases
- Deeply nested structures (recursion limit)
- 500+ nesting levels → throw

## Dependencies

- `TokenReader` (existing)
- `PdfObject` types (existing)

## Non-Goals

- Parsing `N M obj ... endobj` wrapper
- Reading stream binary content
- XRef table parsing
- Trailer parsing
- Brute-force recovery (separate spec)
