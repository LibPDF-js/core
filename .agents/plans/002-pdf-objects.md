# PDF Object Types Plan

## Goal

Define PDF's low-level object primitives in `src/objects/`. These form the foundation for the parser layer.

## Types

| Type        | Description           | Example                     |
| ----------- | --------------------- | --------------------------- |
| `PdfNull`   | Null value            | `null`                      |
| `PdfBool`   | Boolean               | `true`, `false`             |
| `PdfNumber` | Integer or real       | `42`, `-3.14`               |
| `PdfName`   | Name token            | `/Type`, `/Page`            |
| `PdfString` | Literal or hex string | `(Hello)`, `<48656C6C6F>`   |
| `PdfRef`    | Indirect reference    | `1 0 R`                     |
| `PdfArray`  | Array of objects      | `[1 2 3]`                   |
| `PdfDict`   | Dictionary            | `<< /Type /Page >>`         |
| `PdfStream` | Dict + binary data    | `<< /Length 5 >> stream...` |

## Design Decisions

### Discriminated Union

All types share a `type` field for runtime discrimination. Enables type guards and switch statements.

### Interning for PdfName and PdfRef

These repeat constantly in PDFs. Interning via a static `.of()` factory:

- Saves memory (one instance per unique value)
- Enables fast equality via `===`

### Mutable Containers with Mutation Hook

`PdfArray` and `PdfDict` are mutable — PDF modification requires changing entries. They support an optional `onMutate` callback that fires on changes (`set`, `push`, `delete`, etc.). The document layer wires this up for automatic dirty tracking during incremental saves.

### PdfString Stores Raw Bytes

PDF strings can contain binary data, and encoding is context-dependent (PDFDocEncoding, UTF-16BE, etc.). Store raw bytes; decode on demand.

### No Auto-Dereferencing

Containers store `PdfRef` as-is. Callers dereference via xref when needed. Matches PDF structure and enables lazy loading.

### PdfStream Extends PdfDict

Streams are dictionaries with attached binary data. Inheritance avoids duplication.

## File Structure

One file per type in `src/objects/`, plus:

- `object.ts` — Union type and type guards

## Implementation Order

1. Simple types: `PdfNull`, `PdfBool`, `PdfNumber`
2. Interned types: `PdfName`, `PdfRef`
3. `PdfString` (byte handling)
4. `PdfObject` union + type guards
5. Containers: `PdfArray`, `PdfDict`
6. `PdfStream`

## References

- **pdf.js**: `checkouts/pdfjs/src/core/primitives.js` — Name interning pattern
- **pdf-lib**: `checkouts/pdf-lib/src/core/objects/` — TypeScript object hierarchy
