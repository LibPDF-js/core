# XRefParser Spec

## Purpose

Parses PDF cross-reference data in both traditional table format and compressed stream format (PDF 1.5+). The xref maps object numbers to byte offsets, enabling random access to objects.

## Architecture

```
DocumentParser
       ↓
XRefParser          ← This spec
       ↓
├── XRefTable       ← Traditional "xref" keyword format
└── XRefStream      ← Compressed stream format (PDF 1.5+)
```

## XRef Formats

### Traditional Table Format

```
xref
0 6
0000000000 65535 f
0000000015 00000 n
0000000074 00000 n
0000000120 00000 n
0000000179 00000 n
0000000322 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
408
%%EOF
```

Structure:
- `xref` keyword
- Subsections: `<first-obj-num> <count>`
- Entries: `<10-digit-offset> <5-digit-gen> <n|f>`
  - `n` = in-use object
  - `f` = free object (deleted)
- `trailer` keyword followed by dictionary
- `startxref` followed by byte offset to this xref

### Stream Format (PDF 1.5+)

```
15 0 obj
<< /Type /XRef /Size 6 /W [1 2 1] /Root 1 0 R /Index [0 6] >>
stream
...binary data...
endstream
endobj
startxref
408
%%EOF
```

The xref is encoded as a stream object:
- `/Type /XRef` identifies it
- `/W [w1 w2 w3]` - field widths in bytes
- `/Size` - total object count
- `/Index [start count ...]` - subsection ranges (optional)
- Stream contains packed binary entries

Entry fields (based on `/W`):
- Field 1: Type (0=free, 1=uncompressed, 2=compressed)
- Field 2: Offset (type 1) or object stream number (type 2)
- Field 3: Generation (type 1) or index in object stream (type 2)

## API

```typescript
/**
 * Entry in the cross-reference table.
 */
type XRefEntry =
  | { type: "free"; nextFree: number; generation: number }
  | { type: "uncompressed"; offset: number; generation: number }
  | { type: "compressed"; streamObjNum: number; indexInStream: number };

/**
 * Parsed cross-reference data.
 */
interface XRefData {
  entries: Map<number, XRefEntry>;  // objNum → entry
  trailer: PdfDict;
  prev?: number;  // Offset to previous xref (incremental updates)
}

/**
 * Parser for cross-reference tables and streams.
 */
class XRefParser {
  constructor(scanner: Scanner)

  /**
   * Parse xref at given offset.
   * Auto-detects table vs stream format.
   */
  parseAt(offset: number): XRefData

  /**
   * Parse traditional xref table.
   * Scanner must be positioned at "xref" keyword.
   */
  parseTable(): XRefData

  /**
   * Parse xref stream.
   * Scanner must be positioned at stream object start.
   */
  parseStream(): XRefData
}
```

## Parsing Rules

### Finding the XRef

1. Seek to end of file
2. Scan backwards for `startxref`
3. Read the offset number
4. Seek to that offset
5. Detect format:
   - Starts with `xref` → table format
   - Starts with `N M obj` → stream format

### Table Format Parsing

```
xref
<first> <count>
<offset> <gen> <type>
...
trailer
<< ... >>
```

1. Consume `xref` keyword
2. Loop reading subsections:
   - Read first object number and count
   - Read `count` entries (20 bytes each: 10 + space + 5 + space + 1 + EOL)
3. Consume `trailer` keyword
4. Parse trailer dictionary
5. Check for `/Prev` entry (previous xref for incremental updates)

**Entry format**: `OOOOOOOOOO GGGGG T\n`
- O: 10-digit offset (zero-padded)
- G: 5-digit generation (zero-padded)
- T: 'n' (in-use) or 'f' (free)

### Stream Format Parsing

1. Parse the stream object header (indirect object wrapper)
2. Extract stream dictionary:
   - `/W [w1 w2 w3]` - required field widths
   - `/Size` - total object count
   - `/Index [start count ...]` - optional subsection ranges
3. Decode stream data (may need decompression)
4. Read packed entries according to `/W` widths

**Field widths**: If `/W [1 2 1]`:
- 1 byte for type
- 2 bytes for offset/stream-num
- 1 byte for generation/index

**Default values**: If a width is 0, use default:
- Field 1: default 1 (uncompressed)
- Field 3: default 0 (generation 0 / index 0)

### Incremental Updates

PDFs can have multiple xref sections (appended updates):

```
%PDF-1.4
... original objects ...
xref
... original xref ...
trailer
<< /Size 10 /Root 1 0 R >>
startxref
500
%%EOF
... updated objects ...
xref
... updated xref ...
trailer
<< /Size 12 /Root 1 0 R /Prev 500 >>
startxref
1200
%%EOF
```

The `/Prev` entry points to the previous xref. To build complete xref:
1. Parse most recent xref (at `startxref` offset)
2. If `/Prev` exists, parse that xref
3. Repeat until no `/Prev`
4. Merge entries (later entries override earlier)

## Lenient Parsing

Real-world PDFs have issues:

| Issue | Lenient Handling |
|-------|------------------|
| Whitespace variations in entries | Accept flexible spacing |
| Missing EOL after entry | Scan for next digit |
| Offset points to whitespace before obj | Scan forward to find `obj` |
| `/W` with unusual widths | Handle arbitrary byte counts |
| Invalid generation numbers | Accept and warn |

## Test Cases

### Table Format
- Empty xref (only object 0 free entry)
- Single subsection
- Multiple subsections with gaps
- Large offsets (10-digit)
- Free entries forming linked list

### Stream Format
- Basic `/W [1 2 1]` encoding
- Different field widths `/W [1 3 2]`
- Compressed objects (type 2 entries)
- Zero-width fields (use defaults)
- FlateDecode compressed stream

### Incremental Updates
- Single update with `/Prev`
- Multiple chained updates
- Object overwritten in update

### Edge Cases
- Hybrid xref (some table, some stream)
- Cross-reference stream as first object
- Linearized PDF (xref at start)

## Dependencies

- `Scanner` (existing)
- `TokenReader` (existing)
- `ObjectParser` (existing) - for trailer dict
- `PdfDict` (existing)
- Stream decompression (future) - for compressed xref streams

## Implementation Notes

### Byte-Level Precision

XRef offsets must be exact. Even one byte off and the object won't parse. This is why:
- Table format uses fixed 10-digit offsets
- Stream format uses precise binary encoding

### Object 0

Object 0 is always free and heads the free list:
- Generation 65535 (max)
- Points to next free object (or 0 if none)

### Hybrid Reference

PDF 1.5+ allows mixing table and stream xrefs in the same file. Each section can independently be either format.

## Non-Goals

- Stream decompression (separate module)
- Object stream parsing (IndirectObjectParser handles this)
- Encryption handling (separate module)
