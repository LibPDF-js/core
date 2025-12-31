# BruteForceParser Spec

## Purpose

Recovery fallback for corrupted PDFs. When the xref table is damaged or missing, scans the entire file to locate objects by pattern matching, then rebuilds the xref from scratch.

## When to Use

BruteForceParser is activated when normal parsing fails:
- XRef table is missing or corrupted
- Trailer cannot be parsed
- `startxref` offset points to garbage
- Explicit "lenient mode" requested

**Philosophy**: Open files at any cost. A partial document is better than no document.

## Architecture

```
Normal path:
  Read trailer → Parse xref → Resolve objects

Recovery path (BruteForce):
  Scan for "obj" markers → Build xref → Find catalog → Parse objects
```

BruteForceParser inverts the normal order: **find objects first**, then parse them.

## Algorithm

### Phase 1: Scan for Object Markers

Scan the file for the pattern: `<whitespace><number><whitespace><number><whitespace>obj`

```
Example file bytes:
...garbage...
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
...more garbage...
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
...
```

For each match:
1. Record byte offset of object start
2. Extract object number and generation number
3. Add to recovered xref: `{ objNum, genNum, offset }`

### Phase 2: Build Recovered XRef

```typescript
interface RecoveredXRef {
  objects: Map<string, number>;  // "objNum genNum" → byte offset

  getOffset(objNum: number, genNum: number): number | undefined;
}
```

### Phase 3: Find Document Root

Search for the Catalog dictionary:
1. Parse each found object
2. Look for `/Type /Catalog`
3. The Catalog's `/Pages` entry points to the page tree

If no Catalog found:
- Look for `/Type /Pages` as fallback
- Warn user that document structure is incomplete

### Phase 4: Reconstruct Trailer

Build a minimal trailer from discovered objects:

```typescript
interface RecoveredTrailer {
  Root: PdfRef;       // Catalog reference
  Size: number;       // Highest object number + 1
  // Info, Encrypt, etc. may be missing
}
```

## API

```typescript
class BruteForceParser {
  constructor(scanner: Scanner)

  /**
   * Scan file and build recovered xref.
   * Returns null if no objects found.
   */
  recover(): RecoveredDocument | null
}

interface RecoveredDocument {
  xref: RecoveredXRef;
  trailer: RecoveredTrailer;
  warnings: string[];  // Issues encountered during recovery
}
```

## Scanning Strategy

### Object Marker Pattern

Looking for: `\s<digits>\s<digits>\sobj`

```typescript
// Pseudocode
while (position < length) {
  skipToWhitespace();
  mark = position;

  objNum = tryReadInteger();
  if (objNum === null) continue;

  skipWhitespace();
  genNum = tryReadInteger();
  if (genNum === null) { position = mark + 1; continue; }

  skipWhitespace();
  if (matchKeyword("obj")) {
    recordObject(objNum, genNum, mark);
  }
}
```

### Validation

Not every "obj" in the file is a real object marker:
- Could be inside a string: `(the obj was found)`
- Could be inside a stream: binary data containing "obj"

**Heuristics**:
1. Object number should be reasonable (< 10,000,000)
2. Generation number should be small (usually 0, max ~65535)
3. After `obj`, should find valid object start (`<<`, `[`, number, etc.)

### Performance

For large files, avoid re-scanning:
- Single pass through the file
- Build object list in memory
- Only parse objects when needed (lazy)

## Recovery Scenarios

### Scenario 1: Missing XRef

```
%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [] /Count 0 >>
endobj
%%EOF
```

No `xref` table, no `trailer`. BruteForce finds objects 1 and 2, identifies Catalog.

### Scenario 2: Corrupted XRef Offset

```
startxref
999999    ← Points to garbage
%%EOF
```

Normal parser fails at offset 999999. BruteForce scans from start.

### Scenario 3: Truncated File

```
%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pa    ← File ends mid-object
```

BruteForce finds object 1 (complete), object 2 (incomplete). Returns partial document with warnings.

### Scenario 4: Linearized PDF with Corruption

Linearized PDFs have xref at the start. If corrupted:
1. Try normal parsing (fails)
2. Try end-of-file xref (may also fail)
3. Fall back to BruteForce

## Integration with DocumentParser

```typescript
class DocumentParser {
  parse(): PdfDocument {
    try {
      return this.parseNormal();
    } catch (e) {
      if (this.lenientMode) {
        const recovered = new BruteForceParser(this.scanner).recover();
        if (recovered) {
          return this.parseWithRecoveredXRef(recovered);
        }
      }
      throw e;
    }
  }
}
```

## Warnings Collection

Track issues during recovery:

```typescript
warnings: [
  "XRef table not found, using brute-force recovery",
  "Object 5 0 appears corrupted, skipping",
  "No Catalog found, using first Pages object as root",
  "Stream lengths may be incorrect",
]
```

## Test Cases

### Finding Objects
- Single object in file
- Multiple objects
- Objects with various generation numbers
- Objects with large object numbers

### Edge Cases
- "obj" inside string literal (should not match)
- "obj" inside stream data (should not match)
- Overlapping/duplicate object numbers (keep last)
- Zero-length file
- File with no valid objects

### Recovery Quality
- Truncated objects → skip with warning
- Missing Catalog → find Pages instead
- Circular references → detect and warn

## Performance Considerations

- **Memory**: Store only offsets, not parsed objects
- **Speed**: Single sequential scan, no seeking during scan phase
- **Large files**: May need to limit object count or use streaming

## Dependencies

- `Scanner` (existing)
- `ObjectParser` (for parsing found objects)
- `TokenReader` (for keyword matching)

## Non-Goals

- Repairing corrupted object content
- Recovering encrypted documents without password
- Fixing invalid PDF structure (just finding what exists)
- Incremental update recovery (separate concern)
