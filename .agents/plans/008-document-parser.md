# DocumentParser Spec

## Purpose

Top-level PDF document parser. Orchestrates header parsing, xref loading, trailer resolution, and object access. Provides the main entry point for opening PDF files.

## Architecture

```
PdfDocument (future high-level API)
       ↓
DocumentParser        ← This spec
       ↓
├── XRefParser        ← Cross-reference tables/streams
├── IndirectObjectParser ← Object definitions
├── ObjectParser      ← Direct objects
├── BruteForceParser  ← Recovery fallback
└── Scanner           ← Byte I/O
```

## PDF File Structure

```
%PDF-1.7                    ← Header (version)
%âãÏÓ                       ← Binary marker (optional)

1 0 obj                     ← Body: indirect objects
<< /Type /Catalog ... >>
endobj

2 0 obj
<< /Type /Pages ... >>
endobj
...

xref                        ← Cross-reference table
0 5
0000000000 65535 f
...

trailer                     ← Trailer dictionary
<< /Size 5 /Root 1 0 R >>

startxref                   ← Pointer to xref
500
%%EOF                       ← End marker
```

## API

```typescript
/**
 * Options for document parsing.
 */
interface ParseOptions {
  /** Enable lenient parsing for malformed PDFs (default: true) */
  lenient?: boolean;

  /** Password for encrypted PDFs */
  password?: string;
}

/**
 * Parsed PDF document.
 */
interface ParsedDocument {
  /** PDF version from header (e.g., "1.7", "2.0") */
  version: string;

  /** Trailer dictionary */
  trailer: PdfDict;

  /** Cross-reference table */
  xref: XRefData;

  /** Warnings encountered during parsing */
  warnings: string[];

  /** Get an object by reference */
  getObject(ref: PdfRef): PdfObject | null;

  /** Get the document catalog */
  getCatalog(): PdfDict;
}

/**
 * Main document parser.
 */
class DocumentParser {
  constructor(bytes: Uint8Array, options?: ParseOptions);

  /**
   * Parse the PDF document.
   * Returns structured document for further processing.
   */
  parse(): ParsedDocument;

  /**
   * Parse and return just the catalog (for quick access).
   */
  parseCatalog(): PdfDict;
}
```

## Parsing Phases

### Phase 1: Header

Read the PDF version from the header:

```
%PDF-1.7
```

1. Check first bytes are `%PDF-`
2. Read version string (e.g., "1.7", "2.0")
3. Optionally check for binary marker on line 2

**Lenient handling**:

- Accept `%PDF-` not at byte 0 (scan first 1024 bytes)
- Accept version with extra characters
- Accept missing binary marker

### Phase 2: Find startxref

Scan backwards from end of file:

```
startxref
500
%%EOF
```

1. Seek to end of file minus ~1024 bytes
2. Search for `startxref` keyword
3. Read the offset number following it
4. Store offset for xref parsing

**Lenient handling**:

- Accept `startxref` not immediately before `%%EOF`
- Accept extra whitespace
- Accept missing `%%EOF`

### Phase 3: Parse XRef Chain

Follow the xref chain (handling incremental updates):

1. Parse xref at `startxref` offset (using XRefParser)
2. Merge entries into combined xref
3. If trailer has `/Prev`, parse that xref
4. Repeat until no more `/Prev`
5. Later entries override earlier (most recent wins)

**Result**: Complete xref mapping objNum → offset

### Phase 4: Build Document

With xref and trailer available:

1. Extract `/Root` from trailer → catalog reference
2. Create object cache (Map<string, PdfObject>)
3. Return ParsedDocument with lazy object loading

## Object Resolution

### getObject(ref: PdfRef)

```typescript
getObject(ref: PdfRef): PdfObject | null {
  const key = `${ref.objectNumber} ${ref.generation}`;

  // Check cache
  if (this.cache.has(key)) {
    return this.cache.get(key);
  }

  // Look up in xref
  const entry = this.xref.get(ref.objectNumber);
  if (!entry) return null;

  // Parse based on entry type
  let obj: PdfObject;
  switch (entry.type) {
    case "free":
      return null;

    case "uncompressed":
      obj = this.parseObjectAt(entry.offset);
      break;

    case "compressed":
      obj = this.parseFromObjectStream(entry.streamObjNum, entry.indexInStream);
      break;
  }

  // Cache and return
  this.cache.set(key, obj);
  return obj;
}
```

### Length Resolution

For stream objects with indirect `/Length`:

```typescript
resolveLengthFor(ref: PdfRef): number | null {
  const obj = this.getObject(ref);
  if (obj instanceof PdfNumber) {
    return obj.value;
  }
  return null;
}
```

This is passed to IndirectObjectParser as a callback.

## Recovery Mode

When normal parsing fails, fall back to BruteForceParser:

```typescript
parse(): ParsedDocument {
  try {
    return this.parseNormal();
  } catch (error) {
    if (this.options.lenient) {
      this.warnings.push(`Normal parsing failed: ${error.message}`);
      return this.parseWithRecovery();
    }
    throw error;
  }
}

private parseWithRecovery(): ParsedDocument {
  const bruteForce = new BruteForceParser(this.scanner);
  const recovered = bruteForce.recover();

  if (!recovered) {
    throw new Error("Could not recover PDF structure");
  }

  this.warnings.push(...recovered.warnings);

  return {
    version: this.parseHeader() ?? "1.0",
    trailer: this.buildTrailerFromRecovered(recovered),
    xref: recovered.xref,
    warnings: this.warnings,
    getObject: (ref) => this.getObjectFromRecovered(ref, recovered),
    getCatalog: () => this.getObject(recovered.trailer.Root),
  };
}
```

## Trailer Dictionary

The trailer contains critical document metadata:

| Key        | Type       | Description             |
| ---------- | ---------- | ----------------------- |
| `/Size`    | integer    | Total number of objects |
| `/Root`    | reference  | Catalog dictionary      |
| `/Encrypt` | dictionary | Encryption settings     |
| `/Info`    | reference  | Document information    |
| `/ID`      | array      | File identifiers        |
| `/Prev`    | integer    | Previous xref offset    |

### Merged Trailer

With incremental updates, trailers are merged:

- Later trailers override earlier values
- `/Prev` chain is followed but not kept in final trailer

## Caching Strategy

### Object Cache

- Cache parsed objects by "objNum genNum" key
- Lazy loading: only parse when requested
- Memory limit: evict LRU entries if cache grows too large

### XRef Cache

- Parse xref chain once at document open
- Keep combined xref in memory (it's small)

## Lenient Parsing Summary

| Component      | Strict            | Lenient                    |
| -------------- | ----------------- | -------------------------- |
| Header         | Must be at byte 0 | Search first 1024 bytes    |
| Version        | Valid format only | Accept malformed           |
| startxref      | Must exist        | Use brute-force if missing |
| XRef           | Valid format      | Accept spacing issues      |
| Object offsets | Exact             | Scan for `obj` keyword     |
| endobj         | Required          | Accept missing             |
| Stream length  | Exact             | Scan for `endstream`       |

## Test Cases

### Basic Parsing

- Minimal valid PDF
- PDF with multiple objects
- PDF with streams

### Version Detection

- PDF 1.0 through 2.0
- Version at offset > 0
- Malformed version string

### XRef Handling

- Traditional table format
- Stream format (PDF 1.5+)
- Incremental updates with /Prev
- Hybrid (mixed table/stream)

### Object Resolution

- Simple object fetch
- Object from object stream
- Stream with indirect /Length
- Circular reference detection

### Recovery

- Missing xref → brute-force
- Corrupted trailer → brute-force
- Invalid startxref → brute-force
- Partial file → best effort

### Edge Cases

- Linearized PDF (xref at start)
- Very large object numbers
- Encrypted PDF (detect, don't decrypt yet)

## Dependencies

- `Scanner` (existing)
- `XRefParser` (spec 006)
- `IndirectObjectParser` (spec 007)
- `ObjectParser` (existing)
- `BruteForceParser` (existing)
- All PDF object types (existing)

## Implementation Order

1. **Header parsing** - simple, immediate value
2. **startxref finding** - backwards scan
3. **XRefParser integration** - parse table format first
4. **Basic getObject** - uncompressed objects only
5. **Stream support** - /Length resolution
6. **XRef stream format** - PDF 1.5+
7. **Object streams** - compressed objects
8. **Incremental updates** - /Prev chain
9. **Recovery integration** - BruteForceParser fallback

## Non-Goals (For Now)

- Encryption/decryption (separate module)
- Stream decompression (separate module)
- Content stream parsing (separate module)
- Document modification (future)
- Writing/serialization (future)
