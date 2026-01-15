# Incremental Updates Implementation Summary

**Date**: January 2025
**Status**: Complete

## Overview

Implemented full incremental updates support for @libpdf/core, enabling PDFs to be modified and saved while preserving the original bytes. This is critical for digital signatures (modifying a signed PDF requires incremental save).

## Files Created

### Core Document Layer (`src/document/`)

| File                  | Purpose                                                             |
| --------------------- | ------------------------------------------------------------------- |
| `object-registry.ts`  | Bidirectional ref↔object mapping, tracks new vs loaded objects      |
| `change-collector.ts` | Walk-on-save dirty detection, collects changes for incremental save |
| `linearization.ts`    | Linearization detection, incremental save blocker checks            |
| `pdf.ts`              | High-level `PDF` class - load, modify, save API                     |

### Writer Layer (`src/writer/`)

| File             | Purpose                                 |
| ---------------- | --------------------------------------- |
| `serializer.ts`  | PDF object → bytes serialization        |
| `xref-writer.ts` | XRef table and stream writing           |
| `pdf-writer.ts`  | Full and incremental save orchestration |

## Key Design Decisions

### 1. Walk-on-Save Pattern

- **Zero overhead during editing** - no observers or proxies
- Dirty flags on `PdfDict`, `PdfArray`, `PdfStream` set when mutated
- On save, walk object graph to find dirty objects
- Walk INTO nested objects, STOP at `PdfRef` (separate indirect objects)

### 2. Dirty Flag Behavior

```typescript
// Simple boolean on each container
dict.set("Key", value); // → sets dict.dirty = true
array.push(item); // → sets array.dirty = true
stream.setData(bytes); // → sets stream.dirty = true
```

### 3. Incremental Save Flow

1. Collect changes: walk registry, find dirty loaded + all new objects
2. Serialize changed objects to bytes
3. Append to original PDF bytes
4. Write new xref with `/Prev` pointer to original xref
5. Write trailer + `startxref` + `%%EOF`

### 4. Full Save Blockers

Certain conditions force full rewrite (can't incremental save):

- **Linearized PDFs** - first object has `/Linearized` key
- **Brute-force recovery** - xref was corrupted, can't trust structure
- **Encryption changes** - encryption added/removed/modified

## Stream Compression

**Compression is maintained on write.** The serializer is a pass-through:

- `PdfStream.data` stores raw bytes (possibly compressed)
- `serializeStream()` writes `stream.data` directly without modification
- The `/Filter` entry (e.g., `/FlateDecode`) is preserved in the dict

Relevant tests:

- `serializer.test.ts:252-258` - Stream with Filter preserved
- `serializer.test.ts:273-288` - Binary data preserved exactly
- `pdf-writer.test.ts:371-393` - Stream in incremental save

## API Changes Made Today

### Removed: `saveIncremental()` method

**Rationale**: Consolidated to single `save(options)` API

```typescript
// Before (removed)
await pdf.saveIncremental();

// After (use this)
await pdf.save({ incremental: true });
```

### Added: `recoveredViaBruteForce` to ParsedDocument

**Rationale**: Previously detected by grepping warnings (fragile)

```typescript
// Now a proper boolean on ParsedDocument
interface ParsedDocument {
  // ...
  recoveredViaBruteForce: boolean; // New field
}
```

## Test Coverage

| Component        | Tests    |
| ---------------- | -------- |
| ObjectRegistry   | 18 tests |
| Change Collector | 35 tests |
| Serializer       | 47 tests |
| XRef Writer      | 23 tests |
| PDF Writer       | 26 tests |
| Linearization    | 14 tests |
| PDF (high-level) | 23 tests |

**Total**: 944 tests passing

## Usage Example

```typescript
import { PDF, PdfString } from "@libpdf/core";

// Load existing PDF
const pdf = await PDF.load(bytes);

// Modify
const catalog = await pdf.getCatalog();
catalog?.set("ModDate", PdfString.fromString("D:20250101"));

// Check if incremental save is possible
const blocker = pdf.canSaveIncrementally();
if (blocker) {
  console.log(`Can't save incrementally: ${blocker}`);
}

// Save (falls back to full save if incremental not possible)
const saved = await pdf.save({ incremental: true });
```

## Next Steps

With incremental updates complete, digital signature support is now unblocked:

- Signature fields can be added
- Signed PDFs can be modified without breaking signatures
- PKCS#7 signatures can be applied
