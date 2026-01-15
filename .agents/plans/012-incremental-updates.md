# Plan 012: Incremental Updates & Object Modification Tracking

## Overview

Enable modifying PDF documents and saving changes efficiently. This plan covers:

1. **Modification tracking** — Know which objects changed
2. **Object creation** — Assign object numbers to new objects
3. **Incremental save** — Append changes without rewriting

This is **Tier 1 Foundation** work, required for digital signatures (which cannot modify the original bytes).

---

## Reference Implementations

### pdf.js Approach

- **No dirty flags** — Changes collected explicitly before writing
- Uses `RefSetCache` (a Map of `ref.toString() → { data, objStreamRef?, index? }`)
- `data: null` means delete, `data: object` means add/modify
- Simple but requires manual collection

### PDFBox Approach

- **Automatic tracking** via `COSUpdateState` per object
- `COSDocumentState` gates when updates are accepted (only after parse completes)
- `setItem()` calls mark both parent and child as updated
- `COSIncrement` recursively collects modified objects from the tree
- More complex but automatic

### Our Approach: Walk-on-Save with Dirty Flags

- Each mutable object has a simple `dirty` boolean flag
- Mutations just set `dirty = true` — no callbacks, no parent tracking
- On `saveIncremental()`, walk loaded objects to find dirty descendants
- Zero overhead on load, zero overhead during editing
- Only pay the cost when you actually save

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       PdfDocument                               │
│  (High-level wrapper around ParsedDocument)                     │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │  ObjectRegistry │  │  ChangeTracker  │  │  PdfWriter     │  │
│  │  - ref → object │  │  - dirty refs   │  │  - serialize   │  │
│  │  - object → ref │  │  - new objects  │  │  - xref        │  │
│  │  - next obj num │  │  - deleted refs │  │  - incremental │  │
│  └─────────────────┘  └─────────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: ObjectRegistry

Central registry for object ↔ reference mapping.

### Interface

```typescript
interface ObjectRegistry {
  /** Get object by reference (with lazy loading) */
  getObject(ref: PdfRef): Promise<PdfObject | null>;

  /** Get reference for an object (returns undefined if not registered) */
  getRef(obj: PdfObject): PdfRef | undefined;

  /** Register a new object, assigning it a fresh object number */
  register(obj: PdfObject): PdfRef;

  /** Check if an object is registered */
  isRegistered(obj: PdfObject): boolean;

  /** Get the next available object number */
  get nextObjectNumber(): number;
}
```

### Implementation Notes

- Uses two maps: `refToObject: Map<string, PdfObject>` and `objectToRef: WeakMap<PdfObject, PdfRef>`
- `WeakMap` for `objectToRef` allows garbage collection of unused objects
- `nextObjectNumber` starts at `max(xref keys) + 1`
- Generation is always 0 for new objects (simplifies things)

### Object Identity

A key insight: **object identity matters**. When you do:

```typescript
const page = await doc.getObject(pageRef);
page.set("MediaBox", newBox); // Modifies the page
```

The `page` object instance is what we track. We need to map it back to its ref.

---

## Phase 2: Dirty Flag Tracking

Simple boolean flags on mutable objects, collected at save time.

### Object-Level Changes

Add a `dirty` flag to `PdfDict` and `PdfArray`:

```typescript
class PdfDict {
  dirty = false;

  set(key: string, value: PdfObject): void {
    this.entries.set(PdfName.of(key), value);
    this.dirty = true;
  }

  delete(key: string): boolean {
    const existed = this.entries.delete(PdfName.of(key));
    if (existed) this.dirty = true;
    return existed;
  }

  /** Reset dirty flag (called after save) */
  clearDirty(): void {
    this.dirty = false;
  }
}

class PdfArray {
  dirty = false;

  set(index: number, value: PdfObject): void {
    this.items[index] = value;
    this.dirty = true;
  }

  push(...values: PdfObject[]): void {
    this.items.push(...values);
    this.dirty = true;
  }

  // ... other mutating methods set dirty = true
}
```

### Collecting Dirty Objects at Save Time

Walk loaded indirect objects to find those with dirty descendants:

```typescript
interface ChangeSet {
  /** Indirect objects that need to be written */
  modified: Map<PdfRef, PdfObject>;

  /** New objects that were registered */
  created: Map<PdfRef, PdfObject>;

  /** Highest object number used (for /Size in trailer) */
  maxObjectNumber: number;
}

function collectChanges(doc: PdfDocument): ChangeSet {
  const modified = new Map<PdfRef, PdfObject>();

  // Walk all loaded indirect objects
  for (const [ref, obj] of doc.loadedObjects) {
    if (hasDirtyDescendant(obj)) {
      modified.set(ref, obj);
    }
  }

  return {
    modified,
    created: doc.registry.getNewObjects(),
    maxObjectNumber: doc.registry.nextObjectNumber - 1,
  };
}

function hasDirtyDescendant(obj: PdfObject): boolean {
  if (obj instanceof PdfDict || obj instanceof PdfArray) {
    if (obj.dirty) return true;
  }

  if (obj instanceof PdfDict) {
    for (const [, value] of obj) {
      if (!(value instanceof PdfRef) && hasDirtyDescendant(value)) {
        return true;
      }
    }
  }

  if (obj instanceof PdfArray) {
    for (const item of obj) {
      if (!(item instanceof PdfRef) && hasDirtyDescendant(item)) {
        return true;
      }
    }
  }

  return false;
}
```

### Why This Works

- **Nested objects**: We walk INTO nested objects checking their dirty flags
- **Indirect boundaries**: We stop at `PdfRef` (those are separate indirect objects)
- **Zero load overhead**: No wiring, no callbacks, no parent pointers
- **Zero edit overhead**: Just setting a boolean
- **Pay at save time**: Only when calling `saveIncremental()`

### Clearing Dirty Flags After Save

After a successful save, clear all dirty flags:

```typescript
function clearDirtyFlags(obj: PdfObject): void {
  if (obj instanceof PdfDict || obj instanceof PdfArray) {
    obj.clearDirty();
  }

  if (obj instanceof PdfDict) {
    for (const [, value] of obj) {
      if (!(value instanceof PdfRef)) {
        clearDirtyFlags(value);
      }
    }
  }

  if (obj instanceof PdfArray) {
    for (const item of obj) {
      if (!(item instanceof PdfRef)) {
        clearDirtyFlags(item);
      }
    }
  }
}
```

---

## Object Lifecycle

Understanding how objects move through states:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   PARSING                           EDITING                     │
│   ───────                           ───────                     │
│                                                                 │
│   ┌──────────┐                     ┌──────────┐                 │
│   │  Loaded  │ ──── mutation ────► │  Loaded  │                 │
│   │ dirty=F  │                     │ dirty=T  │                 │
│   └──────────┘                     └────┬─────┘                 │
│                                         │                       │
│                                         │ save()                │
│                                         ▼                       │
│   ┌──────────┐     register()      ┌──────────┐                 │
│   │   New    │ ◄───────────────    │ Written  │                 │
│   │(new set) │                     │ dirty=F  │                 │
│   └────┬─────┘                     └──────────┘                 │
│        │                                ▲                       │
│        │ save() ────────────────────────┘                       │
│        │ (move to loaded, clear dirty)                          │
│        ▼                                                        │
│   ┌──────────┐                                                  │
│   │  Loaded  │  (now behaves like any other loaded object)      │
│   │ dirty=F  │                                                  │
│   └──────────┘                                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### New Object Handling

**Registered (indirect) new objects:**

```typescript
const newAnnot = new PdfDict();
const ref = doc.register(newAnnot); // → newObjects set, gets ref 99 0 R
page.getArray("Annots")?.push(ref);

// On first save: written because it's in newObjects set
// After save: moved to loaded set, dirty=false
// On subsequent modification: dirty=true, written on next save
```

**Direct (embedded) new objects:**

```typescript
const newBox = PdfArray.of(...);
page.set("MediaBox", newBox);  // page.dirty = true

// newBox is NOT registered — it's embedded in page
// When page is serialized, newBox is serialized as part of it
// No separate tracking needed
```

---

## Phase 3: Stream Data Modification

Streams need special handling because:

1. The dict part uses dirty flags (already works via PdfDict inheritance)
2. The binary data needs explicit modification API

### Options

**Option A: Immutable data, replace whole stream**

```typescript
// Create new stream with modified data
const newData = modifyImageData(stream.data);
const newStream = new PdfStream(stream, newData);
page.set("XObject", newStream);
```

**Option B: Mutable data with explicit setter**

```typescript
// PdfStream gets a setData method
stream.setData(newData); // This triggers mutation notification
```

**Recommendation**: Option B is more ergonomic. Add to PdfStream:

```typescript
class PdfStream extends PdfDict {
  private _data: Uint8Array;

  setData(data: Uint8Array): void {
    this._data = data;
    this.notifyMutation(); // Inherited from PdfDict
  }
}
```

---

## Phase 4: Object Creation

When users create new objects, they need object numbers assigned.

### API Design

```typescript
// Option 1: Explicit registration
const newAnnot = new PdfDict([["Type", PdfName.of("Annot")], ...]);
const annotRef = doc.register(newAnnot);
page.getArray("Annots")?.push(annotRef);

// Option 2: Auto-register on first use
const newAnnot = new PdfDict([["Type", PdfName.of("Annot")], ...]);
page.getArray("Annots")?.push(newAnnot);  // Auto-converts to ref
// ^ This is tricky and might cause confusion

// Option 3: Factory method
const annotRef = doc.createDict([["Type", PdfName.of("Annot")], ...]);
page.getArray("Annots")?.push(annotRef);
```

**Recommendation**: Option 1 (explicit registration). Clear, no magic.

### Implementation

```typescript
class ObjectRegistry {
  private nextObjNum: number;

  register(obj: PdfObject): PdfRef {
    const ref = PdfRef.of(this.nextObjNum++, 0);

    this.refToObject.set(ref.toString(), obj);
    this.objectToRef.set(obj, ref);
    this.changeTracker.markDirty(ref); // Mark as new/modified

    // Wire up mutation tracking
    this.wireUpTracking(obj, ref);

    return ref;
  }
}
```

---

## Phase 5: PdfWriter (Serialization)

Serialize objects to PDF syntax.

### Interface

```typescript
interface PdfWriter {
  /** Write a complete PDF (full rewrite) */
  write(doc: PdfDocument): Uint8Array;

  /** Write incremental update (append only) */
  writeIncremental(doc: PdfDocument, originalBytes: Uint8Array): Uint8Array;
}
```

### Object Serialization

```typescript
function serializeObject(obj: PdfObject): Uint8Array {
  switch (obj.type) {
    case "null":
      return encode("null");
    case "bool":
      return encode(obj.value ? "true" : "false");
    case "number":
      return encode(formatNumber(obj.value));
    case "name":
      return encode("/" + escapeName(obj.value));
    case "string":
      return serializeString(obj);
    case "ref":
      return encode(`${obj.objectNumber} ${obj.generation} R`);
    case "array":
      return serializeArray(obj);
    case "dict":
      return serializeDict(obj);
    case "stream":
      return serializeStream(obj);
  }
}
```

### Incremental Update Structure

```
[Original PDF bytes]
[Modified object 1]
[Modified object 2]
...
[New XRef section]
trailer
<< /Size N /Prev [old startxref] /Root ... >>
startxref
[offset of new xref]
%%EOF
```

### XRef Section Writing

Two formats supported:

**Traditional XRef Table:**

```
xref
0 1
0000000000 65535 f
5 2
0000012345 00000 n
0000012567 00000 n
trailer
<< /Size 7 /Prev 9876 /Root 1 0 R >>
startxref
12800
%%EOF
```

**XRef Stream (PDF 1.5+):**

```
N 0 obj
<< /Type /XRef /Size 7 /Index [0 1 5 2] /W [1 4 2] /Prev 9876 /Root 1 0 R >>
stream
[binary xref data]
endstream
endobj
startxref
12800
%%EOF
```

### Encryption During Write

For encrypted documents, objects must be re-encrypted:

```typescript
function writeObject(
  ref: PdfRef,
  obj: PdfObject,
  encryptionHandler?: StandardSecurityHandler,
): Uint8Array {
  if (encryptionHandler) {
    obj = encryptObject(obj, ref, encryptionHandler);
  }

  return (
    encode(`${ref.objectNumber} ${ref.generation} obj\n`) +
    serializeObject(obj) +
    encode("\nendobj\n")
  );
}
```

---

## Phase 6: High-Level API

### PdfDocument Class

```typescript
class PdfDocument {
  private parsed: ParsedDocument;
  private registry: ObjectRegistry;
  private tracker: ChangeTracker;
  private originalBytes: Uint8Array;

  // ─────────────────────────────────────────────────────────────
  // Loading
  // ─────────────────────────────────────────────────────────────

  static async load(bytes: Uint8Array, options?: LoadOptions): Promise<PdfDocument>;

  // ─────────────────────────────────────────────────────────────
  // Object Access (with automatic tracking)
  // ─────────────────────────────────────────────────────────────

  getObject(ref: PdfRef): Promise<PdfObject | null>;
  getCatalog(): Promise<PdfDict | null>;
  getPages(): Promise<PdfRef[]>;
  getPage(index: number): Promise<PdfDict | null>;

  // ─────────────────────────────────────────────────────────────
  // Object Creation
  // ─────────────────────────────────────────────────────────────

  /** Register a new object, returning its reference */
  register(obj: PdfObject): PdfRef;

  /** Create and register a new dictionary */
  createDict(entries?: Record<string, PdfObject>): PdfRef;

  /** Create and register a new array */
  createArray(items?: PdfObject[]): PdfRef;

  /** Create and register a new stream */
  createStream(dict: PdfDict, data: Uint8Array): PdfRef;

  // ─────────────────────────────────────────────────────────────
  // Change Tracking
  // ─────────────────────────────────────────────────────────────

  /** Check if document has unsaved changes */
  hasChanges(): boolean;

  /** Get list of modified object refs (for debugging) */
  getModifiedRefs(): PdfRef[];

  // ─────────────────────────────────────────────────────────────
  // Saving
  // ─────────────────────────────────────────────────────────────

  /** Save with full rewrite (default) */
  save(): Promise<Uint8Array>;

  /** Save incrementally (append only) */
  saveIncremental(): Promise<Uint8Array>;

  /** Save options */
  save(options: SaveOptions): Promise<Uint8Array>;
}

interface SaveOptions {
  /** Use incremental save (append only) */
  incremental?: boolean;

  /** Use XRef stream instead of table (requires PDF 1.5+) */
  useXRefStream?: boolean;

  /** Compress objects into object streams */
  useObjectStreams?: boolean;
}
```

---

## Implementation Order

### Step 1: Add Dirty Flags to Objects

- [ ] Add `dirty` flag to `PdfDict`
- [ ] Add `dirty` flag to `PdfArray`
- [ ] Add `dirty` flag to `PdfStream` (for data changes)
- [ ] Update all mutating methods to set `dirty = true`
- [ ] Add `clearDirty()` method
- [ ] Remove unused `setMutationHandler` / `onMutate` callback system
- [ ] Add tests

### Step 2: ObjectRegistry

- [ ] Create `src/document/object-registry.ts`
- [ ] Implement ref ↔ object mapping
- [ ] Implement object number allocation
- [ ] Track new objects separately from loaded objects
- [ ] Add tests

### Step 3: Change Collection

- [ ] Create `src/document/change-collector.ts`
- [ ] Implement `hasDirtyDescendant()` walk
- [ ] Implement `collectChanges()` for incremental save
- [ ] Implement `clearDirtyFlags()` for post-save cleanup
- [ ] Add tests

### Step 4: Object Serialization

- [ ] Create `src/writer/serializer.ts`
- [ ] Implement all object type serializers
- [ ] Handle string escaping, name escaping
- [ ] Add tests with round-trip verification

### Step 5: XRef Writing

- [ ] Create `src/writer/xref-writer.ts`
- [ ] Implement traditional xref table format
- [ ] Implement xref stream format
- [ ] Add tests

### Step 6: PDF Writer

- [ ] Create `src/writer/pdf-writer.ts`
- [ ] Implement full save (rewrite everything)
- [ ] Implement incremental save (append only)
- [ ] Handle encryption during write
- [ ] Add tests

### Step 7: Linearization Detection

- [ ] Add `isLinearized` flag to ParsedDocument
- [ ] Detect linearization dict in first object
- [ ] Add `recoveredViaBruteForce` flag (already tracked in parser)
- [ ] Add tests

### Step 8: PdfDocument High-Level API

- [ ] Create `src/document/pdf-document.ts`
- [ ] Wrap ParsedDocument with modification support
- [ ] Add `register()` for new objects
- [ ] Add `save()` with automatic fallback logic
- [ ] Add `canSaveIncrementally()` check
- [ ] Track encryption changes
- [ ] Strip linearization on full save
- [ ] Integration tests with real PDFs

---

## Edge Cases

### Forced Full Save

Some conditions make incremental save impossible. In these cases, `save({ incremental: true })` silently falls back to full save:

| Condition                     | Why Full Save Required                                           |
| ----------------------------- | ---------------------------------------------------------------- |
| **Brute-force recovery**      | Original xref is corrupted/missing — nothing to append to        |
| **Encryption added**          | All content must be encrypted from scratch                       |
| **Encryption removed**        | All content must be decrypted and rewritten                      |
| **Encryption params changed** | Password/permissions change requires re-encryption of everything |
| **Linearized PDF**            | Linearization structure is incompatible with appending           |

```typescript
interface ParsedDocument {
  // ... existing fields ...

  /** True if document was recovered via brute-force parsing */
  recoveredViaBruteForce: boolean;

  /** True if document is linearized */
  isLinearized: boolean;
}

function canSaveIncrementally(doc: PdfDocument): boolean {
  if (doc.recoveredViaBruteForce) return false;
  if (doc.isLinearized) return false;
  if (doc.encryptionChanged) return false;
  return true;
}

async save(options: SaveOptions = {}): Promise<Uint8Array> {
  const wantsIncremental = options.incremental ?? false;
  const canIncremental = canSaveIncrementally(this);

  if (wantsIncremental && !canIncremental) {
    this.warnings.push("Incremental save not possible, performing full save");
  }

  if (wantsIncremental && canIncremental) {
    return this.saveIncremental();
  } else {
    return this.saveFull();
  }
}
```

### Linearization Handling

When we detect a linearized PDF:

1. Strip the linearization dictionary (`/Linearized` entry in first-page xref)
2. Remove the hint streams
3. Force full save (structure is incompatible with incremental)

Linearization is a read-optimization — stripping it just makes initial page load slightly slower.

### Circular References

Objects can reference each other. During serialization, track which objects have been written to avoid infinite loops.

### Object Streams

For full save, we can optionally compress objects into object streams. For incremental save, modified objects are written uncompressed (simpler).

### Signature Preservation

Digital signatures cover specific byte ranges. Incremental save preserves these ranges. Our `saveIncremental()` is specifically designed for this.

---

## Success Criteria / Required Tests

The implementation is complete when all these tests pass:

### Dirty Flag Tracking

- [ ] Calling `PdfDict.set()` sets `dirty = true`
- [ ] Calling `PdfDict.delete()` sets `dirty = true`
- [ ] Calling `PdfArray.set()` sets `dirty = true`
- [ ] Calling `PdfArray.push()` sets `dirty = true`
- [ ] Calling `PdfArray.pop()` sets `dirty = true`
- [ ] Calling `PdfArray.remove()` sets `dirty = true`
- [ ] Calling `PdfStream.setData()` sets `dirty = true`
- [ ] `clearDirty()` resets the flag to false
- [ ] Newly constructed objects have `dirty = false`

### Change Collection

- [ ] Unmodified document returns empty changeset
- [ ] Modified top-level dict is collected
- [ ] Modified nested dict causes containing indirect object to be collected
- [ ] Modified nested array causes containing indirect object to be collected
- [ ] Deeply nested modification (3+ levels) still marks root indirect object
- [ ] Modifications across `PdfRef` boundaries are tracked separately
- [ ] New registered objects appear in changeset
- [ ] New unregistered (embedded) objects don't appear separately

### Object Registry

- [ ] `register()` assigns sequential object numbers starting after max existing
- [ ] `register()` returns a valid `PdfRef`
- [ ] `getRef()` returns the ref for a registered object
- [ ] `getRef()` returns undefined for unregistered objects
- [ ] After save, new objects move from "new" set to "loaded" set
- [ ] Subsequent modifications to previously-new objects are tracked via dirty flag

### Object Serialization

- [ ] `PdfNull` serializes to `null`
- [ ] `PdfBool` serializes to `true` / `false`
- [ ] `PdfNumber` integers serialize without decimal (e.g., `42`)
- [ ] `PdfNumber` reals serialize with minimal precision (e.g., `3.14`)
- [ ] `PdfName` serializes with `/` prefix and proper escaping
- [ ] `PdfName` with special chars uses `#XX` hex escaping
- [ ] `PdfString` literal format uses proper escaping for `()\\`
- [ ] `PdfString` hex format produces valid hex
- [ ] `PdfRef` serializes as `N G R` format
- [ ] `PdfArray` serializes with `[ ]` delimiters
- [ ] `PdfDict` serializes with `<< >>` delimiters
- [ ] `PdfStream` includes dict, `stream`, data, `endstream`
- [ ] Nested structures serialize correctly (dict containing array containing dict)

### XRef Table Writing

- [ ] Produces valid xref table syntax (`xref`, entries, `trailer`)
- [ ] Entry format is correct (`OOOOOOOOOO GGGGG n\r\n` - 20 bytes exactly)
- [ ] Free entries use `f` marker
- [ ] Subsections are compacted (non-contiguous ranges)
- [ ] `/Size` equals max object number + 1
- [ ] `/Prev` points to previous xref offset for incremental

### XRef Stream Writing

- [ ] Produces valid xref stream object
- [ ] `/Type` is `/XRef`
- [ ] `/W` array specifies correct field widths
- [ ] `/Index` array specifies object ranges
- [ ] Binary data encodes entries correctly
- [ ] Stream can be decoded and matches expected entries

### Incremental Save

- [ ] Original PDF bytes are preserved exactly (byte-for-byte)
- [ ] Modified objects appear after original EOF
- [ ] New objects appear after original EOF
- [ ] New xref section follows the objects
- [ ] Trailer has `/Prev` pointing to original startxref
- [ ] Result is a valid PDF (parseable)
- [ ] Re-parsing shows the modifications

### Full Save

- [ ] Produces complete valid PDF from scratch
- [ ] Header is `%PDF-X.Y` with correct version
- [ ] Binary comment follows header
- [ ] All objects are written
- [ ] XRef covers all objects
- [ ] Trailer has `/Root` and `/Size`
- [ ] `startxref` points to xref
- [ ] Ends with `%%EOF`

### Forced Full Save Conditions

- [ ] Brute-force recovered document forces full save
- [ ] Linearized document forces full save
- [ ] Adding encryption forces full save
- [ ] Removing encryption forces full save
- [ ] Changing password forces full save
- [ ] Changing permissions forces full save
- [ ] Warning is added when incremental was requested but full was used

### Linearization Detection

- [ ] Linearized PDF is detected (`isLinearized = true`)
- [ ] Non-linearized PDF is not flagged
- [ ] Linearization dict is stripped on full save

### Encryption Integration

- [ ] Modified objects in encrypted PDF are re-encrypted on save
- [ ] New objects in encrypted PDF are encrypted on save
- [ ] Encryption key is preserved for incremental save
- [ ] Decrypted content round-trips correctly

### Round-Trip Verification

- [ ] Load → save (no changes) → load produces identical structure
- [ ] Load → modify → save → load shows modification
- [ ] Load → modify → save → modify → save → load shows both modifications
- [ ] Incremental save preserves ability to do another incremental save
- [ ] Modified PDF opens in external reader (pdf.js, browser, Preview.app)

### Edge Cases

- [ ] Empty document (no changes) produces no-op or identical output
- [ ] Object that was in object stream is written uncompressed after modification
- [ ] Circular object references don't cause infinite loops
- [ ] Very long strings are handled (test with 10KB+ string)
- [ ] Binary stream data with all byte values (0x00-0xFF) round-trips
- [ ] Unicode in strings round-trips correctly
- [ ] Multiple saves in sequence work correctly

### High-Level API

- [ ] `PdfDocument.load()` returns usable document
- [ ] `doc.getObject(ref)` returns objects with working dirty tracking
- [ ] `doc.register(obj)` assigns ref and tracks as new
- [ ] `doc.hasChanges()` returns false for unmodified doc
- [ ] `doc.hasChanges()` returns true after modification
- [ ] `doc.save()` produces valid PDF
- [ ] `doc.save({ incremental: true })` appends when possible
- [ ] `doc.save({ incremental: true })` falls back to full when needed
- [ ] After save, `hasChanges()` returns false

---

## Testing Strategy

1. **Unit tests**: Each component in isolation
2. **Round-trip tests**: Parse → Modify → Save → Parse → Verify
3. **Incremental save tests**: Verify original bytes unchanged
4. **Cross-tool tests**: Open our output in Adobe Reader, pdf.js, etc.
5. **Fixture tests**: Modify various fixture PDFs

---

## Open Questions

1. **Should we support object deletion?**
   - Adds complexity (free entries in xref)
   - Not common in typical workflows
   - Recommendation: Defer to later

2. **Should we support object stream compression for new objects?**
   - More complex writer logic
   - Smaller output files
   - Recommendation: Defer to later, start with uncompressed

3. **Should mutation tracking be opt-in?**
   - Performance impact of always tracking?
   - Could add `trackChanges: false` option
   - Recommendation: Always track, measure performance first
