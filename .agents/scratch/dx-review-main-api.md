# DX Review: Main Public API

## Summary

The `@libpdf/core` public API is **generally well-designed** with strong TypeScript integration, clear naming, and thoughtful separation of high/low-level concerns. The API follows modern patterns and should feel familiar to developers coming from pdf-lib.

**Top Priorities:**

1. **Async inconsistency** - Some operations are sync, others async, with no clear pattern
2. **Color helper friction** - Required discriminated unions add ceremony for simple cases
3. **Error discoverability** - Error types are exported but not always documented
4. **Missing convenience methods** - Common patterns require multiple calls

**Overall Grade: B+** - Good foundation, needs polish on convenience and consistency.

---

## What's Working Well

### 1. Clean Entry Points

```typescript
// Excellent: Single class with static factory methods
const pdf = await PDF.load(bytes);
const pdf = PDF.create();
const merged = await PDF.merge([bytes1, bytes2]);
```

### 2. Intuitive Class Names

- `PDF` - the document
- `PDFPage` - a page
- `PDFForm` - interactive forms
- `PDFEmbeddedPage` - embedded page XObjects

These match developer mental models. No surprising prefixes or suffixes.

### 3. Type-Safe Field Access

```typescript
// Excellent: Type-narrowed getters prevent runtime surprises
const name = form.getTextField("name"); // TextField | undefined
const agree = form.getCheckbox("agree"); // CheckboxField | undefined
```

### 4. Good Options Pattern

```typescript
// Options are optional with sensible defaults
pdf.addPage(); // US Letter by default
pdf.addPage({ size: "a4" }); // Named preset
pdf.addPage({ width: 400, height: 600 }); // Custom
```

### 5. Comprehensive JSDoc

Most public methods have documentation with examples. The `@example` blocks are particularly valuable.

### 6. Dual API Levels

```typescript
// High-level for common cases
const form = await pdf.getForm();
form.fill({ name: "John" });

// Low-level escape hatch when needed
const catalog = await pdf.getCatalog();
catalog.set("CustomKey", PdfString.fromString("value"));
```

---

## Issues Found

### Issue 1: Async Inconsistency in Form Fields

**Severity:** High  
**Category:** Consistency

**Problem:**
Field value setters are sometimes async, sometimes sync, with no visible pattern:

```typescript
// TextField.setValue is async
await field.setValue("hello");

// But CheckboxField.check is sync
field.check();

// And form.fill appears sync but calls async internally?
const result = form.fill({ name: "John" }); // Returns immediately
```

A developer's intuition about which operations require `await` is broken. This is especially problematic because forgetting `await` on `setValue()` may silently "work" but leave appearances stale.

**Recommendation:**
Either:

1. Make all field mutations async and document clearly
2. Make all field mutations sync and batch appearance updates to `save()`
3. Add a linting rule or runtime warning for unawaited promises

The pattern in pdf-lib (all sync, appearances updated on save) is more ergonomic.

### Issue 2: Color Helpers Require Discriminated Unions

**Severity:** Medium  
**Category:** Ergonomics

**Problem:**
Colors require wrapping in helper functions that create discriminated unions:

```typescript
// Current: Verbose
form.createTextField("name", {
  backgroundColor: rgb(1, 1, 0.9),
  color: rgb(0, 0, 0),
});

// What developers expect from browser/CSS muscle memory:
form.createTextField("name", {
  backgroundColor: "#ffe6cc",
  color: "black",
});
```

The `rgb()`, `grayscale()`, and `cmyk()` helpers are fine for power users, but common cases suffer.

**Recommendation:**
Accept multiple formats and normalize internally:

```typescript
type ColorInput =
  | Color // Existing discriminated union
  | [number, number, number] // [r, g, b] tuple
  | string // "#rrggbb" or CSS color name
  | number; // Grayscale 0-1

// Usage:
backgroundColor: [1, 1, 0.9]; // Quick RGB
backgroundColor: "#ffe6cc"; // Familiar to web devs
backgroundColor: 0.5; // Grayscale shorthand
backgroundColor: rgb(1, 1, 0.9); // Existing precise API
```

### Issue 3: Page Index vs Page Object Confusion

**Severity:** Medium  
**Category:** Consistency

**Problem:**
Some methods take page indices, others take page objects:

```typescript
// Index-based
await pdf.getPage(0);
await pdf.extractPages([0, 2, 4]);
await pdf.embedPage(source, 0);

// Object-based
page.drawPage(embedded);

// But also index-based for field drawing
await page.drawField(field, { x, y, width, height });
```

When copying pages, users work with indices:

```typescript
const [copiedRef] = await dest.copyPagesFrom(source, [0]);
```

But `copiedRef` is a `PdfRef`, not a `PDFPage`. To work with the copied page, you need:

```typescript
const copiedPage = await dest.getPage(dest.getPageCount() - 1); // Awkward
```

**Recommendation:**

- `copyPagesFrom` should return `PDFPage[]` not `PdfRef[]`
- Consider adding `embedPageFromDocument(pdf, pageIndex)` overload to accept `PDFPage` directly

### Issue 4: Missing Bulk Operations

**Severity:** Medium  
**Category:** Ergonomics

**Problem:**
Common multi-step workflows require boilerplate:

```typescript
// Removing multiple pages (awkward - indices shift!)
pdf.removePage(3);
pdf.removePage(2); // Index 2 is now different!

// Setting rotation on multiple pages
for (const page of await pdf.getPages()) {
  page.setRotation(90);
}
```

**Recommendation:**
Add bulk operations:

```typescript
pdf.removePages([2, 3]); // Handle index shifting internally
pdf.setRotationAll(90); // Apply to all pages
pdf.applyToPages(p => p.setRotation(90), [0, 2, 4]); // Apply to subset
```

### Issue 5: Error Types Not Discoverable

**Severity:** Medium  
**Category:** Errors

**Problem:**
Error types are exported but their relationship isn't clear:

```typescript
// User sees: RangeError, Error, or custom types?
try {
  await pdf.extractPages([999]);
} catch (e) {
  // What type is e? RangeError? SignatureError? Error?
}

// Signature errors are well-structured but discovery is hard:
// SignatureError, TimestampError, RevocationError, PlaceholderError...
```

Documentation doesn't list which methods throw which errors.

**Recommendation:**

1. Add `@throws` JSDoc to all methods that can throw
2. Consider a single `PdfError` base class for all library errors
3. Add error code constants for programmatic handling:

```typescript
if (error instanceof PdfError && error.code === "PAGE_OUT_OF_BOUNDS") {
  // Handle specifically
}
```

### Issue 6: `getForm()` vs `getOrCreateForm()` Naming

**Severity:** Low  
**Category:** Discoverability

**Problem:**
The names don't clearly convey the difference:

```typescript
const form = await pdf.getForm(); // Returns null if no form
const form = await pdf.getOrCreateForm(); // Never returns null
```

"OrCreate" is fine but verbose. Users must read docs to understand when each is appropriate.

**Recommendation:**
Keep both but add a `hasForm()` method for explicit checking:

```typescript
if (pdf.hasForm()) {
  const form = await pdf.getForm()!;
}
// Or require creation when needed
const form = await pdf.getOrCreateForm();
```

Actually, a sync `hasForm()` would improve the workflow significantly.

### Issue 7: DrawPageOptions Width/Height Override Scale Silently

**Severity:** Low  
**Category:** Ergonomics

**Problem:**
When both `scale` and `width/height` are provided, behavior isn't documented:

```typescript
page.drawPage(embedded, {
  scale: 0.5,
  width: 100, // Does this override scale? Combine with it?
});
```

Reading the implementation: `width` and `height` override `scale` entirely.

**Recommendation:**
Document this explicitly in JSDoc, or throw an error when conflicting options are provided.

### Issue 8: TextAlignment Is an Object, Not Enum

**Severity:** Low  
**Category:** Types

**Problem:**

```typescript
// Current
export const TextAlignment = {
  Left: 0,
  Center: 1,
  Right: 2,
} as const;

// Usage
form.createTextField("name", { alignment: TextAlignment.Left });
```

This works but differs from TypeScript enum pattern. Autocomplete shows `TextAlignment.Left` but hover shows `0`.

**Recommendation:**
Fine as-is, but consider:

```typescript
export type TextAlignment = "left" | "center" | "right";
```

Which would be more self-documenting:

```typescript
{
  alignment: "left";
} // Clear without import
```

### Issue 9: Degrees Helper Feels Over-Engineered

**Severity:** Low  
**Category:** Ergonomics

**Problem:**

```typescript
// Current: Requires helper function
form.createTextField("name", { rotate: degrees(90) });

// Why not just:
form.createTextField("name", { rotate: 90 });
```

The `Degrees` interface with `type: "degrees"` seems to anticipate radians support that doesn't exist.

**Recommendation:**
Accept plain numbers for degrees (the common case):

```typescript
rotate?: number | Degrees;  // Number is degrees, Degrees for explicitness
```

### Issue 10: Missing Convenience for Common Checks

**Severity:** Low  
**Category:** Discoverability

**Problem:**
Some obvious questions require multiple steps:

```typescript
// "Does this PDF have any form fields?"
const form = await pdf.getForm();
const hasFields = form !== null && form.fieldCount > 0;

// "Is this page landscape?"
const isLandscape = page.width > page.height; // User must compute

// "What are all the field names?"
const names = form.getFieldNames(); // Good!
```

**Recommendation:**
Add computed getters:

```typescript
page.isLandscape: boolean
page.isPortrait: boolean
form.isEmpty: boolean
pdf.hasForm: boolean  // Sync version
```

### Issue 11: No Way to Iterate All Objects

**Severity:** Low  
**Category:** Advanced Use Cases

**Problem:**
For debugging or analysis, users can't easily enumerate all objects:

```typescript
// No way to do:
for (const [ref, obj] of pdf.getAllObjects()) {
  console.log(ref, obj.type);
}
```

The `ObjectRegistry` has this data but isn't exposed.

**Recommendation:**
Consider an advanced API:

```typescript
pdf.debug.getAllObjects(): Iterable<[PdfRef, PdfObject]>
pdf.debug.getObjectCount(): number
```

---

## Recommendations Summary

### Priority 1 (High Impact)

1. **Unify async pattern** - Either all field ops async or all sync with deferred appearance updates
2. **Improve `copyPagesFrom` return type** - Return `PDFPage[]` not `PdfRef[]`

### Priority 2 (Medium Impact)

3. **Add color input flexibility** - Accept hex strings, tuples alongside current helpers
4. **Add bulk page operations** - `removePages`, `applyToPages`
5. **Document throws in JSDoc** - Add `@throws` to all public methods
6. **Add sync `hasForm()`** - Quick check without async

### Priority 3 (Low Impact, Nice to Have)

7. **Accept plain numbers for degrees** - `rotate: 90` instead of `degrees(90)`
8. **Add computed convenience getters** - `page.isLandscape`, `form.isEmpty`
9. **Document option conflicts** - e.g., `scale` vs `width/height`
10. **Consider string alignment type** - `"left" | "center" | "right"`

---

## Comparison Notes

### vs pdf-lib

- **Similar:** High-level class pattern (`PDF` vs `PDFDocument`), page manipulation API
- **Better:** TypeScript types are more precise, form field access is type-narrowed
- **Worse:** Async inconsistency (pdf-lib is consistently sync mutations)

### vs pdfjs (Mozilla)

- **Different purpose** - pdfjs is rendering-focused, this is manipulation-focused
- **Better:** API is much simpler for common tasks
- **Similar:** Async-first approach for I/O operations

### Platform Conventions

- Follows Node.js conventions: `Uint8Array` for binary, Promises for async
- Follows web platform: `PDF.load(bytes)` similar to `fetch().arrayBuffer()`
- JSDoc comments enable good editor integration

---

## Final Thoughts

The API is well on its way to being excellent. The main friction points are around consistency (async patterns) and ceremony (color helpers, degrees wrapper). These are fixable without breaking changes.

The type-safety story is strong - TypeScript users will find good autocomplete and catch errors early. The dual-layer architecture (high-level API + low-level PDF object access) provides flexibility without overwhelming beginners.

Focus on the Priority 1 and 2 items to significantly improve DX with minimal effort.
