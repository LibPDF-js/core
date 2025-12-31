# Object Streams Spec (PDF 1.5+)

## Purpose

Parse compressed objects stored inside object streams (`/Type /ObjStm`). This is how modern PDFs achieve smaller file sizes by storing multiple objects in a single compressed stream.

## Dependencies

- `FilterPipeline` (spec 009) - For decompressing stream data
- `ObjectParser` (existing) - For parsing individual objects
- `IndirectObjectParser` (existing) - For parsing the object stream itself

## Object Stream Structure

```
10 0 obj
<< /Type /ObjStm
   /N 4                    % Number of objects
   /First 20               % Byte offset to first object
   /Filter /FlateDecode
   /Length 150
>>
stream
1 0 5 10 8 25 12 40       % Index: objNum offset pairs
<< /Type /Page >>          % Object 1 (at offset 0)
[1 2 3]                    % Object 5 (at offset 10)
(Hello)                    % Object 8 (at offset 25)
/Name                      % Object 12 (at offset 40)
endstream
endobj
```

### Dictionary Entries

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `/Type` | name | Yes | Must be `/ObjStm` |
| `/N` | integer | Yes | Number of objects in stream |
| `/First` | integer | Yes | Byte offset of first object (after index) |
| `/Extends` | reference | No | Reference to another object stream |

### Stream Format

1. **Index Section** (before `/First`):
   - N pairs of integers: `objNum1 offset1 objNum2 offset2 ...`
   - Offsets are relative to `/First`

2. **Object Section** (starting at `/First`):
   - Objects stored sequentially without `obj`/`endobj` wrappers
   - No generation numbers (always 0 for compressed objects)

## XRef Entry Type

Object streams are referenced via `type: "compressed"` XRef entries:

```typescript
interface CompressedXRefEntry {
  type: "compressed";
  streamObjNum: number;    // Object number of the ObjStm
  indexInStream: number;   // Index within that stream (0-based)
}
```

## API Design

```typescript
/**
 * Parser for object streams (/Type /ObjStm).
 */
class ObjectStreamParser {
  private index: Array<{ objNum: number; offset: number }> | null = null;
  private decodedData: Uint8Array | null = null;

  constructor(
    private stream: PdfStream
  ) {}

  /**
   * Parse the object stream's index and cache decoded data.
   * Call this before getObject() for efficiency.
   */
  async parse(): Promise<void>;

  /**
   * Get an object by its index within the stream.
   * @param index - 0-based index from XRef entry
   * @returns The parsed object, or null if index is out of range
   */
  async getObject(index: number): Promise<PdfObject | null>;

  /**
   * Get all objects in this stream.
   * @returns Map of objNum → PdfObject
   */
  async getAllObjects(): Promise<Map<number, PdfObject>>;
}
```

## Implementation

```typescript
class ObjectStreamParser {
  private index: Array<{ objNum: number; offset: number }> | null = null;
  private decodedData: Uint8Array | null = null;
  private first: number = 0;
  private n: number = 0;

  constructor(private stream: PdfStream) {
    // Validate stream type
    const type = stream.getName("Type");
    if (type?.value !== "ObjStm") {
      throw new Error(`Expected /Type /ObjStm, got ${type?.value}`);
    }

    // Read required entries
    const n = stream.getNumber("N");
    const first = stream.getNumber("First");

    if (n === undefined || first === undefined) {
      throw new Error("Object stream missing required /N or /First");
    }

    this.n = n.value;
    this.first = first.value;
  }

  /**
   * Decompress and parse the index.
   */
  async parse(): Promise<void> {
    if (this.index !== null) return; // Already parsed

    // Decompress stream data
    this.decodedData = await this.stream.getDecodedData();

    // Parse the index (N pairs of integers before /First)
    this.index = this.parseIndex();
  }

  private parseIndex(): Array<{ objNum: number; offset: number }> {
    const result: Array<{ objNum: number; offset: number }> = [];

    // Create scanner for the index portion only
    const indexData = this.decodedData!.subarray(0, this.first);
    const scanner = new Scanner(indexData);
    const reader = new TokenReader(scanner);

    for (let i = 0; i < this.n; i++) {
      const objNumToken = reader.nextToken();
      const offsetToken = reader.nextToken();

      if (objNumToken.type !== "number" || offsetToken.type !== "number") {
        throw new Error(`Invalid object stream index at entry ${i}`);
      }

      result.push({
        objNum: objNumToken.value,
        offset: offsetToken.value,
      });
    }

    return result;
  }

  /**
   * Get object at given index.
   */
  async getObject(index: number): Promise<PdfObject | null> {
    await this.parse();

    if (index < 0 || index >= this.index!.length) {
      return null;
    }

    const entry = this.index![index];
    const objectData = this.decodedData!.subarray(this.first);

    // Position to the object's offset
    const scanner = new Scanner(objectData);
    scanner.position = entry.offset;

    const reader = new TokenReader(scanner);
    const parser = new ObjectParser(reader);

    const result = parser.parseObject();

    return result?.object ?? null;
  }

  /**
   * Get all objects at once.
   */
  async getAllObjects(): Promise<Map<number, PdfObject>> {
    await this.parse();

    const result = new Map<number, PdfObject>();

    for (let i = 0; i < this.index!.length; i++) {
      const obj = await this.getObject(i);
      if (obj !== null) {
        result.set(this.index![i].objNum, obj);
      }
    }

    return result;
  }

  /**
   * Get object number at given index.
   */
  getObjectNumber(index: number): number | null {
    if (!this.index || index < 0 || index >= this.index.length) {
      return null;
    }
    return this.index[index].objNum;
  }
}
```

## Integration with DocumentParser

```typescript
class DocumentParser {
  private objectStreamCache = new Map<number, ObjectStreamParser>();

  /**
   * Get an object by reference, handling both regular and compressed objects.
   */
  async getObject(ref: PdfRef): Promise<PdfObject | null> {
    const entry = this.xref.entries.get(ref.objectNumber);

    if (!entry) return null;

    switch (entry.type) {
      case "free":
        return null;

      case "uncompressed":
        return this.parseObjectAt(entry.offset);

      case "compressed":
        return this.getCompressedObject(entry.streamObjNum, entry.indexInStream);
    }
  }

  private async getCompressedObject(
    streamObjNum: number,
    indexInStream: number
  ): Promise<PdfObject | null> {
    // Get or create cached parser for this object stream
    let parser = this.objectStreamCache.get(streamObjNum);

    if (!parser) {
      // Parse the object stream itself (must be uncompressed or in different stream)
      const streamObj = await this.getObject(PdfRef.of(streamObjNum, 0));

      if (!(streamObj instanceof PdfStream)) {
        throw new Error(`Object ${streamObjNum} is not a stream`);
      }

      parser = new ObjectStreamParser(streamObj);
      this.objectStreamCache.set(streamObjNum, parser);
    }

    return parser.getObject(indexInStream);
  }
}
```

## Extended Object Streams

The `/Extends` entry allows object streams to extend others (rare in practice):

```typescript
async getAllObjects(): Promise<Map<number, PdfObject>> {
  await this.parse();

  const result = new Map<number, PdfObject>();

  // First, get objects from extended stream (if any)
  const extendsRef = this.stream.getRef("Extends");
  if (extendsRef) {
    // Recursively get extended stream's objects
    // (requires access to document parser - passed via constructor or callback)
    const extendedObjects = await this.getExtendedObjects(extendsRef);
    for (const [objNum, obj] of extendedObjects) {
      result.set(objNum, obj);
    }
  }

  // Then add/override with our objects
  for (let i = 0; i < this.index!.length; i++) {
    const obj = await this.getObject(i);
    if (obj !== null) {
      result.set(this.index![i].objNum, obj);
    }
  }

  return result;
}
```

## XRef Stream Format (Related)

PDF 1.5+ can also store the XRef table itself as a stream. This uses similar decompression but different data format:

```
15 0 obj
<< /Type /XRef
   /Size 100
   /W [1 3 1]           % Field widths: type(1), field2(3), field3(1)
   /Index [0 50 75 25]  % Subsections: 0-49, 75-99
   /Filter /FlateDecode
>>
stream
...binary xref data...
endstream
endobj
```

XRef stream parsing will be added to XRefParser (spec 006) once filters are implemented.

## Test Cases

### Object Stream Parsing
- Parse simple object stream with 1 object
- Parse stream with multiple objects
- Parse stream with various object types (dict, array, string, number)
- Handle missing /N or /First
- Handle invalid index data

### Compressed Object Resolution
- Resolve single compressed object
- Resolve multiple objects from same stream
- Cache object stream parser
- Handle invalid stream reference
- Handle out-of-bounds index

### Integration
- DocumentParser resolves compressed XRef entries
- Object stream inside object stream (should error - not allowed)
- Circular reference detection

## File Structure

```
src/
├── parser/
│   ├── object-stream-parser.ts
│   └── object-stream-parser.test.ts
```

## Implementation Order

1. **ObjectStreamParser** - Parse decompressed stream data
2. **DocumentParser integration** - Handle compressed XRef entries
3. **XRef stream support** - Add to XRefParser (separate task)

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Missing /Type /ObjStm | Throw error |
| Missing /N or /First | Throw error |
| Invalid index format | Throw error (or warn in lenient mode) |
| Index out of bounds | Return null |
| Decompression failure | Propagate filter error |
| Nested object stream | Throw error (not allowed per spec) |

## Performance Considerations

1. **Lazy Parsing**: Only parse index on first access
2. **Stream Caching**: Cache ObjectStreamParser per stream object number
3. **Bulk Loading**: `getAllObjects()` for batch access
4. **Memory**: Large streams may contain many objects - consider memory limits
