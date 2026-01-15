# Plan 013: Serializer Refactor

## Problem

The current serializer (`src/writer/serializer.ts`) has several issues:

1. **Excessive allocations** - Every `encode()` call creates a `Uint8Array`, every `concat()` creates another. For large PDFs (10s of MBs), this causes GC pressure.

2. **Serialization logic external to objects** - The serializer uses `instanceof` chains to determine how to serialize each type. Objects should know how to serialize themselves.

3. **Bug in literal string escaping** - `escapeLiteralString()` doesn't properly escape backslashes (writes one `\` instead of two `\\`).

4. **String concatenation anti-pattern** - `escapeName()` builds strings with `+=` in a loop.

## Design Decisions

These decisions were made during the spec interview:

| Decision                 | Choice                                     | Rationale                                                           |
| ------------------------ | ------------------------------------------ | ------------------------------------------------------------------- |
| Incremental save support | ByteWriter initializes with existing bytes | Cleaner API for appending after original PDF                        |
| Encryption handling      | Encrypt before toBytes()                   | Keeps ByteWriter and toBytes() simple/pure                          |
| XRef writer              | Update to use ByteWriter                   | Consistency across all byte output                                  |
| formatNumber() location  | Move to src/helpers/                       | Shared utility, could be reused elsewhere                           |
| Large PDF handling       | Configurable maxSize limit                 | Throws if exceeded, prevents runaway memory                         |
| ByteWriter reusability   | Single-use only                            | Simpler, avoids state management bugs                               |
| Invalid dict values      | Skip silently                              | Lenient, matches parsing philosophy                                 |
| Indirect /Length refs    | Always write direct                        | We know stream.data.length; original bytes preserved in incremental |
| Scanner relationship     | Keep separate                              | Different concerns (reading vs writing)                             |

## Solution

### 1. ByteWriter Class

Create a `ByteWriter` class that manages a growing buffer:

```typescript
// src/io/byte-writer.ts

export interface ByteWriterOptions {
  /** Initial buffer size in bytes. Default: 65536 (64KB) */
  initialSize?: number;
  /** Maximum buffer size in bytes. Throws if exceeded. Default: unlimited */
  maxSize?: number;
}

export class ByteWriter {
  private buffer: Uint8Array;
  private offset = 0;
  private readonly maxSize: number;

  /**
   * Create a new ByteWriter.
   *
   * @param existingBytes - Optional existing bytes to start with (for incremental saves)
   * @param options - Configuration options
   */
  constructor(existingBytes?: Uint8Array, options: ByteWriterOptions = {}) {
    const initialSize = options.initialSize ?? 65536;
    this.maxSize = options.maxSize ?? Number.MAX_SAFE_INTEGER;

    if (existingBytes) {
      // Start with existing bytes, leave room to grow
      const size = Math.max(existingBytes.length * 2, initialSize);
      this.buffer = new Uint8Array(size);
      this.buffer.set(existingBytes);
      this.offset = existingBytes.length;
    } else {
      this.buffer = new Uint8Array(initialSize);
    }
  }

  /**
   * Ensure capacity for `needed` more bytes, doubling buffer if necessary.
   * @throws {Error} if maxSize would be exceeded
   */
  private grow(needed: number): void {
    if (this.offset + needed <= this.buffer.length) return;

    let newSize = this.buffer.length;
    while (newSize < this.offset + needed) {
      newSize *= 2;
    }

    if (newSize > this.maxSize) {
      throw new Error(`ByteWriter exceeded maximum size of ${this.maxSize} bytes`);
    }

    const newBuffer = new Uint8Array(newSize);
    newBuffer.set(this.buffer.subarray(0, this.offset));
    this.buffer = newBuffer;
  }

  /** Current write position (number of bytes written) */
  get position(): number {
    return this.offset;
  }

  /** Write a single byte */
  writeByte(b: number): void {
    this.grow(1);
    this.buffer[this.offset++] = b;
  }

  /** Write raw bytes */
  writeBytes(data: Uint8Array): void {
    this.grow(data.length);
    this.buffer.set(data, this.offset);
    this.offset += data.length;
  }

  /**
   * Write ASCII string (fast path, no encoding needed).
   * Only use for strings known to be ASCII (PDF keywords, numbers, etc.)
   */
  writeAscii(str: string): void {
    this.grow(str.length);
    for (let i = 0; i < str.length; i++) {
      this.buffer[this.offset++] = str.charCodeAt(i);
    }
  }

  /** Write string as UTF-8 */
  writeUtf8(str: string): void {
    const encoded = new TextEncoder().encode(str);
    this.writeBytes(encoded);
  }

  /**
   * Get final bytes.
   * Returns a copy (slice) so the internal buffer can be garbage collected.
   *
   * Note: ByteWriter is single-use. Do not write after calling toBytes().
   */
  toBytes(): Uint8Array {
    return this.buffer.slice(0, this.offset);
  }
}
```

### 2. Number Formatting Helper

Move number formatting to a shared helper:

```typescript
// src/helpers/format.ts

/**
 * Format a number for PDF output.
 *
 * - Integers are written without decimal point
 * - Reals use minimal precision (no trailing zeros)
 * - PDF spec recommends up to 5 decimal places
 */
export function formatPdfNumber(value: number): string {
  if (Number.isInteger(value)) {
    return value.toString();
  }

  // Use fixed precision, then strip trailing zeros
  let str = value.toFixed(5);

  // Remove trailing zeros and unnecessary decimal point
  str = str.replace(/\.?0+$/, "");

  // Handle edge case where we stripped everything after decimal
  if (str === "" || str === "-") {
    return "0";
  }

  return str;
}
```

### 3. Add PdfPrimitive Interface

Create a new interface that each class implements. The existing `PdfObject` type union stays unchanged.

```typescript
// src/objects/pdf-primitive.ts - NEW file

import type { ByteWriter } from "#src/io/byte-writer";

/**
 * Interface for PDF primitive objects that can serialize themselves.
 * Each concrete class (PdfNull, PdfBool, etc.) implements this.
 */
export interface PdfPrimitive {
  readonly type: string;

  /**
   * Write this object's bytes to the given ByteWriter.
   * Called recursively for nested objects.
   */
  toBytes(writer: ByteWriter): void;
}
```

```typescript
// src/objects/pdf-object.ts - NO CHANGES
// Stays as type union:
export type PdfObject = PdfNull | PdfBool | PdfNumber | PdfName | ...
```

Since all classes in the `PdfObject` union implement `PdfPrimitive`, TypeScript knows `.toBytes()` is available on any `PdfObject`.

### 4. Implement toBytes() in Each Primitive

**PdfNull**

```typescript
toByte(writer: ByteWriter): void {
  writer.writeAscii("null");
}
```

**PdfBool**

```typescript
toBytes(writer: ByteWriter): void {
  writer.writeAscii(this.value ? "true" : "false");
}
```

Etc.

### 5. Update serializer.ts

The main serializer becomes much simpler:

```typescript
// src/writer/serializer.ts

import { ByteWriter } from "#src/io/byte-writer";
import type { PdfObject } from "#src/objects/pdf-object";
import type { PdfRef } from "#src/objects/pdf-ref";

/**
 * Serialize a PDF object to bytes.
 */
export function serializeObject(obj: PdfObject): Uint8Array {
  const writer = new ByteWriter();

  obj.toBytes(writer);

  return writer.toBytes();
}

/**
 * Serialize an indirect object definition.
 * Format: "N G obj\n[object]\nendobj\n"
 */
export function serializeIndirectObject(ref: PdfRef, obj: PdfObject): Uint8Array {
  const writer = new ByteWriter();
  writer.writeAscii(`${ref.objectNumber} ${ref.generation} obj\n`);

  obj.toBytes(writer);

  writer.writeAscii("\nendobj\n");
  return writer.toBytes();
}
```

### 6. Shared ByteWriter for PDF Writing

For writing complete PDFs, use a single `ByteWriter` across all objects:

```typescript
// In pdf-writer.ts

export function writeComplete(registry: ObjectRegistry, options: WriteOptions): WriteResult {
  const writer = new ByteWriter();

  // Header
  writer.writeAscii(`%PDF-${options.version ?? "1.7"}\n`);
  writer.writeBytes(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // Binary comment

  // Objects
  const offsets = new Map<number, { offset: number; generation: number }>();

  for (const [ref, obj] of registry.entries()) {
    offsets.set(ref.objectNumber, {
      offset: writer.position,
      generation: ref.generation,
    });

    writer.writeAscii(`${ref.objectNumber} ${ref.generation} obj\n`);
    obj.toBytes(writer);
    writer.writeAscii("\nendobj\n");
  }

  // XRef + trailer (xref-writer also uses the shared writer)
  const xrefOffset = writer.position;
  writeXRefSection(writer, offsets, options);

  return {
    bytes: writer.toBytes(),
    xrefOffset,
  };
}

export function writeIncremental(
  registry: ObjectRegistry,
  options: IncrementalWriteOptions,
): WriteResult {
  // Initialize with original bytes - they're preserved exactly
  const writer = new ByteWriter(options.originalBytes);

  // Ensure newline before appended content
  const lastByte = options.originalBytes[options.originalBytes.length - 1];
  if (lastByte !== 0x0a && lastByte !== 0x0d) {
    writer.writeByte(0x0a); // newline
  }

  // Write modified/new objects
  // ... rest of incremental save logic ...

  return {
    bytes: writer.toBytes(),
    xrefOffset,
  };
}
```

### 7. Update xref-writer.ts

The XRef writer also uses ByteWriter for consistency:

```typescript
// src/writer/xref-writer.ts

import { ByteWriter } from "#src/io/byte-writer";

/**
 * Write XRef table entries to a ByteWriter.
 */
export function writeXRefTable(writer: ByteWriter, options: XRefWriteOptions): void {
  writer.writeAscii("xref\n");

  // ... subsection logic ...

  for (const entry of subsection) {
    // Each entry is exactly 20 bytes: offset(10) + space + gen(5) + space + flag + CRLF
    const line =
      `${entry.offset.toString().padStart(10, "0")} ` +
      `${entry.generation.toString().padStart(5, "0")} ` +
      `${entry.type === "free" ? "f" : "n"}\r\n`;
    writer.writeAscii(line);
  }

  // Trailer
  writer.writeAscii("trailer\n");
  trailerDict.toBytes(writer);
  writer.writeAscii(`\nstartxref\n${options.xrefOffset}\n%%EOF\n`);
}

/**
 * Write XRef stream to a ByteWriter.
 */
export function writeXRefStream(writer: ByteWriter, options: XRefStreamOptions): PdfStream {
  // Build stream object, then serialize it
  const stream = buildXRefStream(options);

  writer.writeAscii(`${options.streamObjectNumber} 0 obj\n`);
  stream.toBytes(writer);
  writer.writeAscii("\nendobj\n");
  writer.writeAscii(`startxref\n${options.xrefOffset}\n%%EOF\n`);

  return stream;
}
```

## Encryption Notes

Encryption is handled **before** serialization, keeping ByteWriter and toBytes() pure:

```typescript
// In pdf-writer.ts (when encryption support is added)

function prepareForWrite(obj: PdfObject, ref: PdfRef, handler: SecurityHandler): PdfObject {
  if (obj instanceof PdfString) {
    // Return new PdfString with encrypted bytes
    return new PdfString(handler.encryptString(obj.bytes, ref), obj.format);
  }
  if (obj instanceof PdfStream) {
    // Return new PdfStream with encrypted data
    return new PdfStream(obj, handler.encryptStream(obj.data, ref));
  }
  // ... handle nested dicts/arrays ...
  return obj;
}
```

## Files to Modify

| File                           | Changes                                           |
| ------------------------------ | ------------------------------------------------- |
| `src/io/byte-writer.ts`        | **New** - ByteWriter class                        |
| `src/io/byte-writer.test.ts`   | **New** - Tests                                   |
| `src/helpers/format.ts`        | **New** - formatPdfNumber helper                  |
| `src/objects/pdf-primitive.ts` | **New** - PdfPrimitive interface with `toBytes()` |
| `src/objects/pdf-null.ts`      | Add `toBytes()`                                   |
| `src/objects/pdf-bool.ts`      | Add `toBytes()`                                   |
| `src/objects/pdf-number.ts`    | Add `toBytes()`                                   |
| `src/objects/pdf-name.ts`      | Add `toBytes()`                                   |
| `src/objects/pdf-string.ts`    | Add `toBytes()`                                   |
| `src/objects/pdf-ref.ts`       | Add `toBytes()`                                   |
| `src/objects/pdf-array.ts`     | Add `toBytes()`                                   |
| `src/objects/pdf-dict.ts`      | Add `toBytes()`                                   |
| `src/objects/pdf-stream.ts`    | Add `toBytes()`                                   |
| `src/writer/serializer.ts`     | Simplify to use `toBytes()`                       |
| `src/writer/pdf-writer.ts`     | Use shared ByteWriter                             |
| `src/writer/xref-writer.ts`    | Update to use ByteWriter                          |

## Test Plan

### 1. ByteWriter Tests

- `writeByte()` single bytes
- `writeBytes()` byte arrays
- `writeAscii()` ASCII strings
- `writeUtf8()` UTF-8 strings with multi-byte chars
- Buffer growth (write >64KB)
- `position` tracking accuracy
- `toBytes()` returns correct slice
- **Initialize with existing bytes** (for incremental saves)
- **maxSize limit** - throws when exceeded
- **Large writes** - 1MB+, verify no corruption

### 2. Primitive toBytes() Tests

- Each type serializes correctly
- Edge cases:
  - Empty arrays `[]`
  - Empty dicts `<<>>`
  - Empty strings `()` and `<>`
  - Special chars in names (`/Name#20With#23Space`)
  - **Backslash in strings** (the bug fix!) - `(a\\b)` for `a\b`
  - Nested parens in strings `(a(b)c)` → `(a\(b\)c)`
- Nested structures (dict in array in dict)
- Null values in dicts (should be skipped)

### 3. Existing Serializer Tests

- All existing tests in `serializer.test.ts` should still pass
- They test the output, not the implementation

### 4. Integration Tests

- Full PDF round-trip: load → modify → save → load
- Incremental save preserves original bytes exactly
- XRef offsets are correct after refactor

### 5. Performance Tests

- Serialize a PDF >10MB
- Verify memory stays bounded
- Compare allocation count before/after (if possible)

## Implementation Order

1. Create `src/helpers/format.ts` with `formatPdfNumber()`
2. Create `ByteWriter` class + tests
3. Add `toBytes()` to `PdfObject` interface
4. Implement `toBytes()` in simple types (null, bool, number)
5. Implement `toBytes()` in name, string, ref
6. Implement `toBytes()` in containers (array, dict)
7. Implement `toBytes()` in stream
8. Update `serializer.ts` to use new pattern
9. Update `xref-writer.ts` to use ByteWriter
10. Update `pdf-writer.ts` to use shared ByteWriter
11. Run all existing tests
12. Add performance/large PDF test

## Success Criteria

- [ ] All 944+ existing tests pass
- [ ] ByteWriter has full test coverage
- [ ] Backslash bug is fixed (test: `\` in string → `\\` in output)
- [ ] Memory usage is bounded for large PDFs (no unbounded growth)
- [ ] maxSize limit works (throws when exceeded)
- [ ] Initialize-with-bytes works for incremental saves
- [ ] No `instanceof` chain in serializer
- [ ] Each object type owns its serialization logic
- [ ] XRef writer uses ByteWriter consistently
- [ ] Incremental save still preserves original bytes exactly
