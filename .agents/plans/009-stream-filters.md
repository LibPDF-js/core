# Stream Filters Spec

## Purpose

Decode (decompress) PDF stream data. Supports filter chaining, predictor algorithms, and browser/Node.js environments with optimal performance.

## Architecture

```
PdfStream.data (raw bytes)
       ↓
FilterPipeline.decode(data, filters, params)
       ↓
┌──────────────────────────────────────┐
│  Filter Chain (applied in order)     │
│  ┌─────────────┐  ┌─────────────┐   │
│  │ FlateFilter │→│ Predictor   │   │
│  └─────────────┘  └─────────────┘   │
└──────────────────────────────────────┘
       ↓
Decoded bytes (Uint8Array)
```

## Filter Types

### Priority 1: Core Filters (Required for Object Streams)

| Filter | Description | Implementation |
|--------|-------------|----------------|
| `FlateDecode` | zlib/deflate | Native `DecompressionStream` with pako fallback |
| `Predictor` | PNG/TIFF prediction | Pure JS (row-based algorithm) |

### Priority 2: Text Encoding Filters

| Filter | Description | Implementation |
|--------|-------------|----------------|
| `ASCIIHexDecode` | Hex → binary | Pure JS (trivial) |
| `ASCII85Decode` | Base85 → binary | Pure JS |

### Priority 3: Legacy/Specialized Filters

| Filter | Description | Implementation |
|--------|-------------|----------------|
| `LZWDecode` | LZW compression | Pure JS (port from pdf.js) |
| `RunLengthDecode` | RLE compression | Pure JS (simple) |

### Priority 4: Image Filters (Future)

| Filter | Description | Notes |
|--------|-------------|-------|
| `DCTDecode` | JPEG | Usually pass-through (browser decodes) |
| `JPXDecode` | JPEG2000 | Requires external library |
| `CCITTFaxDecode` | Fax/TIFF | Complex, for scanned docs |
| `JBIG2Decode` | Binary images | Complex, for scanned docs |

## API Design

```typescript
/**
 * Filter specification from PDF stream dictionary.
 */
interface FilterSpec {
  name: string;           // "FlateDecode", "ASCII85Decode", etc.
  params?: PdfDict;       // /DecodeParms for this filter
}

/**
 * A single filter implementation.
 */
interface Filter {
  readonly name: string;

  /**
   * Decode data through this filter.
   * @param data - Input bytes (possibly from previous filter)
   * @param params - Filter-specific parameters from /DecodeParms
   * @returns Decoded bytes
   */
  decode(data: Uint8Array, params?: PdfDict): Promise<Uint8Array>;

  /**
   * Encode data through this filter (for PDF generation).
   */
  encode(data: Uint8Array, params?: PdfDict): Promise<Uint8Array>;
}

/**
 * Filter registry and pipeline executor.
 */
class FilterPipeline {
  /**
   * Register a filter implementation.
   */
  static register(filter: Filter): void;

  /**
   * Decode data through a chain of filters.
   * Filters are applied in order: first filter's output → second filter's input.
   */
  static async decode(
    data: Uint8Array,
    filters: FilterSpec | FilterSpec[]
  ): Promise<Uint8Array>;

  /**
   * Encode data through a chain of filters (reverse order).
   */
  static async encode(
    data: Uint8Array,
    filters: FilterSpec | FilterSpec[]
  ): Promise<Uint8Array>;
}
```

## Filter Implementations

### FlateDecode (zlib/deflate)

**Strategy**: Native-first with fallback (like pdf.js)

```typescript
class FlateFilter implements Filter {
  readonly name = "FlateDecode";

  async decode(data: Uint8Array, params?: PdfDict): Promise<Uint8Array> {
    // 1. Try native DecompressionStream (modern browsers/Node 18+)
    let decompressed: Uint8Array;
    try {
      decompressed = await this.decodeNative(data);
    } catch {
      // 2. Fallback to pako
      decompressed = this.decodePako(data);
    }

    // 3. Apply predictor if specified
    const predictor = params?.getNumber("Predictor")?.value ?? 1;
    if (predictor > 1) {
      return this.applyPredictor(decompressed, params!);
    }

    return decompressed;
  }

  private async decodeNative(data: Uint8Array): Promise<Uint8Array> {
    // Skip zlib header (2 bytes) - DecompressionStream expects raw deflate
    const rawDeflate = data.subarray(2);

    const ds = new DecompressionStream("deflate-raw");
    const writer = ds.writable.getWriter();
    writer.write(rawDeflate);
    writer.close();

    const chunks: Uint8Array[] = [];
    const reader = ds.readable.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    return concat(chunks);
  }

  private decodePako(data: Uint8Array): Uint8Array {
    // pako.inflate handles zlib header automatically
    return pako.inflate(data);
  }
}
```

**Browser/Runtime Support:**

| Environment | Native API | Fallback |
|-------------|------------|----------|
| Chrome 80+ | `DecompressionStream` | pako |
| Firefox 113+ | `DecompressionStream` | pako |
| Safari 16.4+ | `DecompressionStream` | pako |
| Node.js 18+ | `DecompressionStream` | pako |
| Bun | `DecompressionStream` | pako |
| Older browsers | N/A | pako |

### Predictor (PNG/TIFF)

Applied after decompression for optimized streams.

**Parameters** (from `/DecodeParms`):

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `/Predictor` | int | 1 | Algorithm: 1=none, 2=TIFF, 10-15=PNG |
| `/Columns` | int | 1 | Samples per row |
| `/Colors` | int | 1 | Color components per sample |
| `/BitsPerComponent` | int | 8 | Bits per component |

**Predictor Values:**

| Value | Name | Algorithm |
|-------|------|-----------|
| 1 | None | Pass-through |
| 2 | TIFF SUB | Add left pixel |
| 10 | PNG None | Pass-through (per-row) |
| 11 | PNG Sub | Add left pixel |
| 12 | PNG Up | Add above pixel |
| 13 | PNG Average | Add (left + above) / 2 |
| 14 | PNG Paeth | Optimal left/up/upper-left |
| 15 | PNG Optimum | Per-row algorithm selection |

```typescript
function applyPredictor(
  data: Uint8Array,
  params: PdfDict
): Uint8Array {
  const predictor = params.getNumber("Predictor")?.value ?? 1;
  const columns = params.getNumber("Columns")?.value ?? 1;
  const colors = params.getNumber("Colors")?.value ?? 1;
  const bpc = params.getNumber("BitsPerComponent")?.value ?? 8;

  if (predictor === 1) return data; // No prediction

  const bytesPerPixel = Math.ceil((colors * bpc) / 8);
  const bytesPerRow = Math.ceil((columns * colors * bpc) / 8);

  if (predictor === 2) {
    return decodeTiffPredictor(data, bytesPerRow, bytesPerPixel);
  }

  if (predictor >= 10 && predictor <= 15) {
    // PNG predictor: each row has a filter byte prefix
    return decodePngPredictor(data, bytesPerRow, bytesPerPixel);
  }

  throw new Error(`Unknown predictor: ${predictor}`);
}

function decodePngPredictor(
  data: Uint8Array,
  bytesPerRow: number,
  bytesPerPixel: number
): Uint8Array {
  const rowSize = bytesPerRow + 1; // +1 for filter byte
  const rows = Math.floor(data.length / rowSize);
  const output = new Uint8Array(rows * bytesPerRow);

  let prevRow = new Uint8Array(bytesPerRow); // zeros

  for (let row = 0; row < rows; row++) {
    const filterByte = data[row * rowSize];
    const rowData = data.subarray(row * rowSize + 1, (row + 1) * rowSize);
    const outRow = output.subarray(row * bytesPerRow, (row + 1) * bytesPerRow);

    switch (filterByte) {
      case 0: // None
        outRow.set(rowData);
        break;
      case 1: // Sub
        decodeSubRow(rowData, outRow, bytesPerPixel);
        break;
      case 2: // Up
        decodeUpRow(rowData, outRow, prevRow);
        break;
      case 3: // Average
        decodeAverageRow(rowData, outRow, prevRow, bytesPerPixel);
        break;
      case 4: // Paeth
        decodePaethRow(rowData, outRow, prevRow, bytesPerPixel);
        break;
    }

    prevRow = outRow.slice(); // Copy for next row
  }

  return output;
}
```

### ASCIIHexDecode

Simple hex-to-binary conversion.

```typescript
class ASCIIHexFilter implements Filter {
  readonly name = "ASCIIHexDecode";

  async decode(data: Uint8Array): Promise<Uint8Array> {
    const result: number[] = [];
    let high: number | null = null;

    for (const byte of data) {
      // Skip whitespace
      if (byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d) {
        continue;
      }

      // End marker
      if (byte === 0x3e) { // '>'
        break;
      }

      const nibble = hexValue(byte);
      if (nibble === -1) continue; // Skip invalid chars (lenient)

      if (high === null) {
        high = nibble;
      } else {
        result.push((high << 4) | nibble);
        high = null;
      }
    }

    // Odd number of digits: pad with 0
    if (high !== null) {
      result.push(high << 4);
    }

    return new Uint8Array(result);
  }
}
```

### ASCII85Decode (Base85)

```typescript
class ASCII85Filter implements Filter {
  readonly name = "ASCII85Decode";

  async decode(data: Uint8Array): Promise<Uint8Array> {
    const result: number[] = [];
    let buffer = 0;
    let count = 0;

    for (const byte of data) {
      // Skip whitespace
      if (byte <= 0x20) continue;

      // End marker "~>"
      if (byte === 0x7e) break;

      // 'z' = zero shortcut (represents 4 zero bytes)
      if (byte === 0x7a && count === 0) {
        result.push(0, 0, 0, 0);
        continue;
      }

      // Decode base-85 digit
      buffer = buffer * 85 + (byte - 33);
      count++;

      if (count === 5) {
        result.push(
          (buffer >> 24) & 0xff,
          (buffer >> 16) & 0xff,
          (buffer >> 8) & 0xff,
          buffer & 0xff
        );
        buffer = 0;
        count = 0;
      }
    }

    // Handle partial group
    if (count > 1) {
      // Pad with 'u' (84) and extract partial bytes
      for (let i = count; i < 5; i++) {
        buffer = buffer * 85 + 84;
      }
      for (let i = 0; i < count - 1; i++) {
        result.push((buffer >> (24 - i * 8)) & 0xff);
      }
    }

    return new Uint8Array(result);
  }
}
```

### LZWDecode

Port from pdf.js/pdf-lib implementation.

```typescript
class LZWFilter implements Filter {
  readonly name = "LZWDecode";

  async decode(data: Uint8Array, params?: PdfDict): Promise<Uint8Array> {
    const earlyChange = params?.getNumber("EarlyChange")?.value ?? 1;

    // LZW decoder state
    const output: number[] = [];
    let codeLength = 9;
    let nextCode = 258;
    const dictionary: Uint8Array[] = [];

    // Initialize dictionary with single-byte entries
    for (let i = 0; i < 256; i++) {
      dictionary[i] = new Uint8Array([i]);
    }

    // ... LZW algorithm implementation
    // (Port from pdf-lib's LZWStream.ts)

    // Apply predictor if specified
    const predictor = params?.getNumber("Predictor")?.value ?? 1;
    if (predictor > 1) {
      return applyPredictor(new Uint8Array(output), params!);
    }

    return new Uint8Array(output);
  }
}
```

### RunLengthDecode

Simple RLE decoder.

```typescript
class RunLengthFilter implements Filter {
  readonly name = "RunLengthDecode";

  async decode(data: Uint8Array): Promise<Uint8Array> {
    const output: number[] = [];
    let i = 0;

    while (i < data.length) {
      const length = data[i++];

      if (length === 128) {
        // EOD marker
        break;
      }

      if (length < 128) {
        // Copy next (length + 1) bytes literally
        const count = length + 1;
        for (let j = 0; j < count && i < data.length; j++) {
          output.push(data[i++]);
        }
      } else {
        // Repeat next byte (257 - length) times
        const count = 257 - length;
        const value = data[i++];
        for (let j = 0; j < count; j++) {
          output.push(value);
        }
      }
    }

    return new Uint8Array(output);
  }
}
```

## Filter Chain Execution

```typescript
class FilterPipeline {
  private static filters = new Map<string, Filter>();

  static register(filter: Filter): void {
    this.filters.set(filter.name, filter);
  }

  static async decode(
    data: Uint8Array,
    filters: FilterSpec | FilterSpec[]
  ): Promise<Uint8Array> {
    const filterList = Array.isArray(filters) ? filters : [filters];

    let result = data;

    // Apply filters in order (first filter's output → second filter's input)
    for (const spec of filterList) {
      const filter = this.filters.get(spec.name);

      if (!filter) {
        throw new Error(`Unknown filter: ${spec.name}`);
      }

      result = await filter.decode(result, spec.params);
    }

    return result;
  }

  static async encode(
    data: Uint8Array,
    filters: FilterSpec | FilterSpec[]
  ): Promise<Uint8Array> {
    const filterList = Array.isArray(filters) ? filters : [filters];

    let result = data;

    // Apply filters in REVERSE order for encoding
    for (let i = filterList.length - 1; i >= 0; i--) {
      const spec = filterList[i];
      const filter = this.filters.get(spec.name);

      if (!filter) {
        throw new Error(`Unknown filter: ${spec.name}`);
      }

      result = await filter.encode(result, spec.params);
    }

    return result;
  }
}

// Register built-in filters
FilterPipeline.register(new FlateFilter());
FilterPipeline.register(new ASCIIHexFilter());
FilterPipeline.register(new ASCII85Filter());
FilterPipeline.register(new LZWFilter());
FilterPipeline.register(new RunLengthFilter());
```

## Integration with PdfStream

```typescript
class PdfStream extends PdfDict {
  private _data: Uint8Array;
  private _decodedData: Uint8Array | null = null;

  /**
   * Get raw (possibly compressed) stream data.
   */
  get data(): Uint8Array {
    return this._data;
  }

  /**
   * Get decoded (decompressed) stream data.
   * Caches result for repeated access.
   */
  async getDecodedData(): Promise<Uint8Array> {
    if (this._decodedData !== null) {
      return this._decodedData;
    }

    const filter = this.get("Filter");

    if (filter === undefined) {
      // No filter - data is already decoded
      this._decodedData = this._data;
      return this._data;
    }

    const filterSpecs = this.buildFilterSpecs(filter);
    this._decodedData = await FilterPipeline.decode(this._data, filterSpecs);

    return this._decodedData;
  }

  private buildFilterSpecs(filter: PdfObject): FilterSpec[] {
    const decodeParms = this.get("DecodeParms");

    if (filter.type === "name") {
      // Single filter
      const params = decodeParms?.type === "dict" ? decodeParms as PdfDict : undefined;
      return [{ name: (filter as PdfName).value, params }];
    }

    if (filter.type === "array") {
      // Multiple filters
      const filterArray = filter as PdfArray;
      const paramsArray = decodeParms?.type === "array" ? decodeParms as PdfArray : null;

      return filterArray.items.map((f, i) => ({
        name: (f as PdfName).value,
        params: paramsArray?.at(i)?.type === "dict" ? paramsArray.at(i) as PdfDict : undefined,
      }));
    }

    throw new Error(`Invalid filter type: ${filter.type}`);
  }
}
```

## File Structure

```
src/
├── filters/
│   ├── index.ts              # Exports + FilterPipeline
│   ├── filter.ts             # Filter interface
│   ├── flate-filter.ts       # FlateDecode (native + pako)
│   ├── predictor.ts          # PNG/TIFF predictor algorithms
│   ├── ascii-hex-filter.ts   # ASCIIHexDecode
│   ├── ascii85-filter.ts     # ASCII85Decode
│   ├── lzw-filter.ts         # LZWDecode
│   ├── run-length-filter.ts  # RunLengthDecode
│   └── *.test.ts             # Tests for each filter
```

## Dependencies

| Package | Purpose | Size |
|---------|---------|------|
| `pako` | FlateDecode fallback | ~47KB |

**Note**: pako is only loaded when native `DecompressionStream` is unavailable. Consider dynamic import for tree-shaking:

```typescript
async function decodePako(data: Uint8Array): Promise<Uint8Array> {
  const pako = await import("pako");
  return pako.inflate(data);
}
```

## Test Cases

### FlateDecode
- Decompress simple zlib data
- Decompress with PNG predictor
- Decompress with TIFF predictor
- Native API fallback to pako
- Invalid zlib header handling

### Predictor
- PNG None (filter byte 0)
- PNG Sub (filter byte 1)
- PNG Up (filter byte 2)
- PNG Average (filter byte 3)
- PNG Paeth (filter byte 4)
- TIFF horizontal differencing
- Multi-component (colors > 1)
- Non-8-bit components

### ASCII85
- Standard encoding
- 'z' shortcut
- Partial final group
- Whitespace handling
- End marker "~>"

### Filter Chains
- FlateDecode + ASCIIHexDecode
- Multiple filters in array
- DecodeParms array matching

## Implementation Order

1. **FlateFilter** - Most common, needed for object streams
2. **Predictor** - Required for many FlateDecode streams
3. **ASCIIHexFilter** - Simple, useful for testing
4. **ASCII85Filter** - Slightly more complex encoding
5. **LZWFilter** - Legacy but still encountered
6. **RunLengthFilter** - Simple, rarely used

## Non-Goals (For Now)

- Image-specific filters (DCT, JPX, CCITT, JBIG2)
- Encryption/Crypt filter (separate module)
- Streaming decode (full buffer approach first)
- Custom filter registration by users
