# IndirectObjectParser Spec

## Purpose

Parses indirect object definitions (`N M obj ... endobj`) and object streams. This wraps ObjectParser to handle the PDF indirect object syntax and stream binary data.

## Architecture

```
DocumentParser
       ↓
IndirectObjectParser  ← This spec
       ↓
├── ObjectParser      ← Direct object content
└── StreamReader      ← Binary stream data
```

## Indirect Object Formats

### Standard Indirect Object

```
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
```

Structure:

- `<objNum> <genNum> obj` - header
- Any direct object (dict, array, number, etc.)
- `endobj` - terminator

### Stream Object

```
5 0 obj
<< /Length 44 /Filter /FlateDecode >>
stream
...44 bytes of binary data...
endstream
endobj
```

Structure:

- Same header as standard object
- Dictionary with `/Length` (required)
- `stream` keyword
- Exactly `/Length` bytes of data
- `endstream` keyword
- `endobj` terminator

### Object Stream (PDF 1.5+)

```
10 0 obj
<< /Type /ObjStm /N 3 /First 15 /Length 100 >>
stream
1 0 2 20 3 40
<< /Type /Page >>
<< /Type /Font >>
...
endstream
endobj
```

An object stream contains multiple objects packed together:

- `/Type /ObjStm` identifies it
- `/N` - number of objects in stream
- `/First` - byte offset to first object within stream
- Stream data format:
  - First: pairs of `objNum offset` (N pairs)
  - Then: concatenated object values

Objects in a stream:

- Have generation 0
- Cannot themselves contain streams
- Are referenced via xref type 2 entries

## API

```typescript
/**
 * Parsed indirect object.
 */
interface IndirectObject {
  objNum: number;
  genNum: number;
  value: PdfObject;
}

/**
 * Parsed stream object.
 */
interface StreamObject extends IndirectObject {
  value: PdfStream;
}

/**
 * Parser for indirect objects and object streams.
 */
class IndirectObjectParser {
  constructor(
    private scanner: Scanner,
    private lengthResolver?: (ref: PdfRef) => number | null
  )

  /**
   * Parse indirect object at current position.
   * Returns the parsed object with its number and generation.
   */
  parseObject(): IndirectObject

  /**
   * Parse object at given byte offset.
   */
  parseObjectAt(offset: number): IndirectObject

  /**
   * Parse object from an object stream.
   * @param streamObj - The object stream
   * @param index - Index of object within stream (0-based)
   */
  parseFromObjectStream(streamObj: PdfStream, index: number): PdfObject

  /**
   * Read stream binary data.
   * Handles /Length resolution (direct or indirect reference).
   */
  private readStreamData(dict: PdfDict): Uint8Array
}
```

## Parsing Rules

### Standard Object

```
<objNum> <genNum> obj
<value>
endobj
```

1. Read object number (integer)
2. Read generation number (integer)
3. Consume `obj` keyword
4. Parse value using ObjectParser
5. Consume `endobj` keyword

### Stream Object

When ObjectParser returns `{ hasStream: true }`:

1. Parse dict (already done by ObjectParser)
2. Consume `stream` keyword
3. Skip EOL after `stream` (CR, LF, or CRLF)
4. Resolve `/Length`:
   - If direct number: use it
   - If indirect reference: call `lengthResolver`
5. Read exactly `/Length` bytes
6. Consume `endstream` keyword
7. Consume `endobj` keyword
8. Return `PdfStream` with dict and data

### Stream EOL Handling

Per PDF spec, after `stream` keyword:

- Single EOL (LF or CRLF) before data
- No EOL → error (but be lenient)
- CR alone is technically not valid but accept it

Before `endstream`:

- EOL is recommended but not required
- Data should be exactly `/Length` bytes

### /Length Resolution

The `/Length` value is critical for stream parsing:

```
% Direct length
5 0 obj
<< /Length 100 >>
stream
...100 bytes...
endstream

% Indirect length (common in linearized PDFs)
5 0 obj
<< /Length 6 0 R >>
stream
...bytes...
endstream

6 0 obj
100
endobj
```

When `/Length` is a reference:

1. We need the xref to find object 6
2. Parse object 6 to get the number
3. Then read that many bytes

This is why `lengthResolver` callback exists - DocumentParser provides it.

### Object Stream Parsing

```
/N 3 /First 15
stream
1 0 2 8 3 16      ← Object index (N pairs)
<< /A 1 >>        ← Object 1's value at offset 0
<< /B 2 >>        ← Object 2's value at offset 8
<< /C 3 >>        ← Object 3's value at offset 16
endstream
```

1. Decompress stream if filtered
2. Parse `/N` pairs of integers: `objNum relativeOffset`
3. For requested object:
   - Find its relative offset from the index
   - Seek to `/First` + relative offset
   - Parse the object value (no `obj`/`endobj` wrapper)

## Lenient Parsing

| Issue                         | Lenient Handling                |
| ----------------------------- | ------------------------------- |
| Missing `endobj`              | Warn, accept object             |
| Whitespace before `stream`    | Accept any whitespace           |
| Wrong EOL after `stream`      | Try to detect actual data start |
| `/Length` off by small amount | Scan for `endstream`            |
| Extra bytes after `endstream` | Ignore, warn                    |
| Missing `endstream`           | Scan backwards from `endobj`    |

### Stream Length Recovery

When `/Length` seems wrong:

1. Read `/Length` bytes
2. Check if next bytes are `endstream`
3. If not, scan for `endstream` keyword
4. Adjust data length accordingly
5. Emit warning

## Test Cases

### Standard Objects

- Simple dict object
- Array object
- Number object
- Nested dict object
- Object with generation > 0

### Stream Objects

- Direct `/Length`
- Indirect `/Length` reference
- Empty stream (length 0)
- Large stream
- Stream with various filters (for future decompression)

### EOL Handling

- LF after `stream`
- CRLF after `stream`
- CR only after `stream` (lenient)
- No EOL before `endstream`

### Object Streams

- Parse object from stream by index
- Multiple objects in stream
- Compressed object stream

### Error Recovery

- Missing `endobj`
- Wrong `/Length`
- Truncated stream

## Dependencies

- `Scanner` (existing)
- `TokenReader` (existing)
- `ObjectParser` (existing)
- `PdfStream` (existing)
- Stream decompression (future) - for object streams

## Implementation Notes

### Stream Data Ownership

The `Uint8Array` for stream data should be a view or copy of the underlying bytes, not a reference to the scanner's buffer. This allows:

- Multiple streams to exist simultaneously
- Scanner to continue reading other parts

### Lazy vs Eager Stream Reading

Two approaches:

1. **Eager**: Read and store stream data immediately
2. **Lazy**: Store offset and length, read on demand

For initial implementation, use eager reading. Lazy can be added later for memory optimization with large PDFs.

### Object Number Validation

Object numbers in the `obj` header should match the xref entry that led us here. In lenient mode, accept mismatches with a warning.

## Non-Goals

- Stream decompression (separate module)
- Stream interpretation (content streams, images, etc.)
- Encryption decryption (separate module)
