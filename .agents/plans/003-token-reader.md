# TokenReader Spec

## Purpose

On-demand tokenizer sitting on top of Scanner. Reads PDF tokens one at a time without pre-tokenizing the entire input.

## PDF Token Types

| Token            | Example                                                              | Notes                         |
| ---------------- | -------------------------------------------------------------------- | ----------------------------- |
| Number           | `42`, `-3.14`, `.5`                                                  | Integer or real               |
| Name             | `/Type`, `/MediaBox`                                                 | Starts with `/`               |
| String (literal) | `(Hello World)`                                                      | Parentheses, supports escapes |
| String (hex)     | `<48656C6C6F>`                                                       | Angle brackets                |
| Keyword          | `true`, `false`, `null`, `obj`, `endobj`, `stream`, `endstream`, `R` | Reserved words                |
| Delimiter        | `[`, `]`, `<<`, `>>`                                                 | Array and dict markers        |
| EOF              | —                                                                    | End of input                  |

## Whitespace & Comments

**Whitespace characters** (PDF spec 7.2.2):

- `0x00` NUL
- `0x09` TAB
- `0x0A` LF
- `0x0D` CR
- `0x0C` FF
- `0x20` SPACE

**Comments**: `%` to end of line (LF or CR). Treated as whitespace.

## API

```typescript
class TokenReader {
  constructor(scanner: Scanner);

  // Position
  get position(): number;

  // Core reading
  nextToken(): Token;
  peekToken(): Token; // Look ahead without consuming

  // Low-level (for recovery/special cases)
  skipWhitespaceAndComments(): void;
  peekByte(): number;
}
```

## Token Type

```typescript
type Token =
  | { type: "number"; value: number; isInteger: boolean }
  | { type: "name"; value: string } // Without leading /
  | { type: "string"; value: Uint8Array; format: "literal" | "hex" }
  | { type: "keyword"; value: string }
  | { type: "delimiter"; value: "[" | "]" | "<<" | ">>" }
  | { type: "eof" };
```

## Lenient Parsing Rules

### Numbers (from pdf.js/PDFBox)

- Ignore double negatives: `--5` → `5`
- Multiple decimal points: take first, stop at second
- Leading decimal: `.5` → `0.5`
- Trailing garbage: `123abc` → `123` (stop at non-digit)

### Names

- `#XX` hex escapes: `/F#6fo` → `Foo`
- Lone `#` at end: warn, treat as literal `#`
- Empty name `/` is valid

### Literal Strings `(...)`

- Nested parens: `(a(b)c)` → balanced
- Escape sequences: `\n`, `\r`, `\t`, `\b`, `\f`, `\\`, `\(`, `\)`
- Octal: `\ddd` (1-3 digits)
- Line continuation: `\` at EOL ignored
- Unbalanced parens: heuristic recovery (PDFBox pattern)

### Hex Strings `<...>`

- Ignore whitespace inside
- Invalid hex chars: skip with warning
- Odd length: pad with trailing `0`

### Keywords

- Case sensitive: `true` not `TRUE`
- Unknown sequences become keywords (parser decides validity)

## Delimiter Handling

Single char: `[`, `]`
Double char: `<<`, `>>` (must peek to distinguish `<` hex string vs `<<` dict)

## Error Recovery

- Invalid character in unexpected place → skip and warn
- Unterminated string → scan for likely end
- Return best-effort token, let parser decide what to do

## Implementation Notes

### Peek Token Caching

Cache peeked token to avoid re-parsing:

```
peekToken() → if cached, return; else read and cache
nextToken() → if cached, clear and return; else read
```

### Position Tracking

Token should know where it started (for error messages):

```typescript
interface Token {
  // ... type fields
  position: number; // Byte offset where token started
}
```

## Test Cases

1. **Whitespace**: Space, tab, newline, mixed, comments
2. **Numbers**: Integer, negative, decimal, leading dot, edge cases
3. **Names**: Simple, with escapes, empty, unicode
4. **Literal strings**: Simple, escapes, nested parens, multiline
5. **Hex strings**: Normal, whitespace, odd length, invalid chars
6. **Keywords**: true/false/null, obj/endobj, stream/endstream, R
7. **Delimiters**: `[`, `]`, `<<`, `>>`, distinguish `<` from `<<`
8. **Sequences**: Multiple tokens, mixed types
9. **Malformed**: Recovery cases

## Dependencies

- `Scanner` (existing)
- No dependency on PDF object types (returns raw values)

## Out of Scope

- Object parsing (that's ObjectParser)
- Stream content parsing (that's StreamParser)
- XRef parsing (that's XRefParser)
