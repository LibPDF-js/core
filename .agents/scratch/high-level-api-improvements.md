# High-Level API Improvements

Analysis of the current API structure and proposed improvements to make it cleaner and more consistent.

## Current State

### Directory Structure

```
src/api/
  pdf.ts           # PDF class (main entry point)
  pdf-form.ts      # PDFForm (high-level form wrapper)
  pdf-attachments.ts
  pdf-fonts.ts

src/document/
  pdf-catalog.ts   # PDFCatalog (wraps catalog dict)
  object-registry.ts
  page-tree.ts
  acro-form.ts     # AcroForm (low-level form)
  form-field.ts    # FormField classes
  ...
```

### Pain Points

1. **Pages are just `PdfRef`** — No `PDFPage` wrapper class. Users must:

   ```typescript
   const pageRef = pdf.getPage(0);
   const pageDict = await pdf.getObject(pageRef); // Returns PdfDict
   // Then work with raw dict...
   ```

2. **PDFCatalog location is confusing** — Lives in `src/document/` but acts like a high-level wrapper. It's exposed indirectly through PDF class.

3. **Registry passed everywhere** — `PDFForm.load()` takes 3 args: registry, catalog, pageTree. Form fields also hold registry references.

4. **Inconsistent patterns** — Some things are lazy (form, attachments), some eager (pages). Some methods async, some sync.

5. **No central document context** — Each subsystem (forms, attachments, fonts) separately stores references to registry/catalog/etc.

---

## Proposed Changes

### 1. Add `PDFPage` Class

Create a high-level page wrapper in `src/api/pdf-page.ts`:

```typescript
export class PDFPage {
  private readonly _ref: PdfRef;
  private readonly _dict: PdfDict;
  private readonly _doc: PDFDocument;  // Back-reference for context

  /** Page index in document (0-based) */
  get index(): number { ... }

  /** Page width in points */
  get width(): number { ... }

  /** Page height in points */
  get height(): number { ... }

  /** Page rotation in degrees (0, 90, 180, 270) */
  get rotation(): number { ... }

  /** Get the MediaBox */
  getMediaBox(): Rectangle { ... }

  /** Get the underlying reference */
  getRef(): PdfRef { ... }

  /** Get the underlying dictionary */
  getDict(): PdfDict { ... }

  /** Draw an embedded page onto this page */
  drawPage(embedded: EmbeddedPage, options?: DrawPageOptions): void { ... }

  /** Set rotation */
  setRotation(degrees: 0 | 90 | 180 | 270): void { ... }
}
```

**Benefits:**

- Type-safe page access
- Convenient dimension/rotation getters
- Natural place for `drawPage()` method (for overlay/underlay)
- Consistent with form fields having wrapper classes

**API Changes:**

```typescript
// Before
const pageRef = pdf.getPage(0);
const pageDict = (await pdf.getObject(pageRef)) as PdfDict;
const mediaBox = pageDict.get("MediaBox");

// After
const page = pdf.getPage(0);
const { width, height } = page;
page.drawPage(watermark, { background: true });
```

### 2. Introduce `PDFContext` Object

Create a central context that subsystems can reference instead of passing registry/catalog/pages separately:

```typescript
// src/api/pdf-context.ts
export class PDFContext {
  readonly registry: ObjectRegistry;
  readonly catalog: PDFCatalog;
  readonly pages: PageTree;
  readonly parsed: ParsedDocument;

  /** Register a new object */
  register(obj: PdfObject): PdfRef { ... }

  /** Resolve a reference */
  resolve(ref: PdfRef): Promise<PdfObject | null> { ... }

  /** Get object synchronously (if already loaded) */
  getObject(ref: PdfRef): PdfObject | null { ... }

  /** Add a warning */
  addWarning(msg: string): void { ... }
}
```

Then `PDF` becomes a thin wrapper that delegates to `PDFContext`:

```typescript
export class PDF {
  private readonly ctx: PDFContext;

  // Existing API unchanged, but internally uses ctx
}
```

**Benefits:**

- Subsystems receive one object instead of 3-4
- Cleaner initialization: `new PDFForm(ctx)` instead of `PDFForm.load(registry, catalog, pageTree)`
- Easier to pass context to new operations (ObjectCopier, PageEmbedder, etc.)

### 3. Move PDFCatalog to `src/api/`

Since PDFCatalog is a wrapper class (not low-level parsing), it belongs in `src/api/`:

```
src/api/
  pdf.ts
  pdf-catalog.ts    # Moved from src/document/
  pdf-context.ts    # New context object
  pdf-form.ts
  pdf-page.ts       # New
  pdf-attachments.ts
  pdf-fonts.ts
```

The `src/document/` directory should contain:

- Low-level document structures (acro-form.ts, form-field.ts, page-tree.ts)
- Object manipulation (object-registry.ts, object-copier.ts)
- Change tracking (change-collector.ts)

### 4. Simplify PDFForm Initialization

Before:

```typescript
// In PDF class
async getForm(): Promise<PDFForm | null> {
  return PDFForm.load(this.registry, this._catalog, this._pages);
}

// PDFForm.load takes 3 separate args
static async load(
  registry: ObjectRegistry,
  catalog: PDFCatalog,
  pageTree: PageTree,
): Promise<PDFForm | null>
```

After:

```typescript
// In PDF class
async getForm(): Promise<PDFForm | null> {
  return PDFForm.load(this.ctx);
}

// PDFForm.load takes the context
static async load(ctx: PDFContext): Promise<PDFForm | null>
```

### 5. Page Access Returns `PDFPage`

Before:

```typescript
getPage(index: number): PdfRef | null
getPages(): PdfRef[]
```

After:

```typescript
getPage(index: number): PDFPage | null
getPages(): PDFPage[]
```

Note: `getPages()` could be lazy (returns iterator/proxy) but for simplicity we can keep it eager since page count is typically small.

---

## Implementation Order

### Phase 1: PDFContext

1. Create `src/api/pdf-context.ts` with core context
2. Refactor `PDF` class to use `PDFContext` internally
3. No external API changes yet

### Phase 2: Move PDFCatalog

1. Move `src/document/pdf-catalog.ts` to `src/api/pdf-catalog.ts`
2. Update imports
3. PDFCatalog now takes `PDFContext` in constructor

### Phase 3: Add PDFPage

1. Create `src/api/pdf-page.ts`
2. Change `PDF.getPage()` to return `PDFPage`
3. Update `PageTree` to work with `PDFPage`
4. Preserve `.getRef()` for low-level access

### Phase 4: Simplify Subsystem Init

1. Update `PDFForm.load()` to take `PDFContext`
2. Update `PDFAttachments` constructor
3. Update `PDFFonts` constructor
4. Form fields receive context via parent

---

## Open Questions

1. **Should PDFPage cache the dict?**
   - Pro: Faster repeated access
   - Con: Could get stale if dict modified externally
   - Recommendation: Cache it, since we control modifications

2. **Should we expose PDFContext publicly?**
   - Pro: Power users can access internals
   - Con: More API surface to maintain
   - Recommendation: Keep internal initially, expose if needed

3. **What about PageTree?**
   - Currently in `src/document/`
   - Could stay there since it's internal machinery
   - PDFPage wraps pages, PageTree manages the tree structure

4. **Backward compatibility?**
   - `getPage()` returning `PDFPage` instead of `PdfRef` is breaking
   - Could add `getPageRef()` for compatibility
   - Or: `page.ref` property provides the ref

---

## Files to Create/Modify

### New Files

- `src/api/pdf-context.ts` — Central context
- `src/api/pdf-page.ts` — Page wrapper

### Move

- `src/document/pdf-catalog.ts` → `src/api/pdf-catalog.ts`

### Modify

- `src/api/pdf.ts` — Use PDFDocument, return PDFPage
- `src/api/pdf-form.ts` — Take PDFDocument
- `src/api/pdf-attachments.ts` — Take PDFDocument
- `src/api/pdf-fonts.ts` — Take PDFDocument
- `src/document/page-tree.ts` — Work with PDFPage
- `src/index.ts` — Export new types

---

## Summary

| Change                     | Impact                     | Priority |
| -------------------------- | -------------------------- | -------- |
| Add PDFPage class          | High (enables overlay API) | **P0**   |
| Add PDFContext             | Medium (cleaner internals) | **P1**   |
| Move PDFCatalog to src/api | Low (organizational)       | **P2**   |
| Simplify subsystem init    | Low (cleaner code)         | **P2**   |

The PDFPage class is the most important change since it directly enables the merge/split overlay functionality and provides a better user experience for page manipulation.

---

## Completed Changes (as of 2026-01-04)

The following improvements have been implemented:

| Phase                                | Status                         |
| ------------------------------------ | ------------------------------ |
| Phase 1: PDFContext                  | ✅ Completed                   |
| Phase 2: Move PDFCatalog to src/api/ | ✅ Completed                   |
| Phase 3: Add PDFPage class           | ✅ Completed                   |
| Phase 4: Simplify subsystem init     | ✅ Completed (part of Phase 1) |
| Move PageTree to src/api/            | ✅ Completed                   |

Current `src/api/` structure:

```
src/api/
  pdf.ts              # Main PDF class
  pdf-context.ts      # Internal context object
  pdf-catalog.ts      # Catalog wrapper
  pdf-page.ts         # Page wrapper (NEW)
  page-tree.ts        # Page tree manager (MOVED)
  pdf-form.ts         # Form API
  pdf-fonts.ts        # Fonts API
  pdf-attachments.ts  # Attachments API
```

---

## Further Directory Structure Improvements

Analysis of remaining organizational issues and proposed solutions.

### 1. Duplicate Operator Files (CRITICAL)

**Problem:** Two files with overlapping purposes:

- `src/content/operators.ts` (184 lines) - `Op` enum and `Operator` class
- `src/helpers/operators.ts` (199 lines) - Factory functions creating Operators

**Issue:** `helpers/operators.ts` imports from `content/operators.ts`. They belong together.

**Recommendation:**

1. Merge factory functions into `src/content/operators.ts`
2. Delete `src/helpers/operators.ts`
3. Update imports throughout codebase

---

### 2. Create `src/forms/` Directory (HIGH PRIORITY)

**Problem:** Form-related files are scattered in `src/document/`:

- `acro-form.ts` (1310 lines) - AcroForm implementation
- `form-field.ts` (1439 lines) - All field classes
- `appearance-generator.ts` (1663 lines) - Appearance stream generation
- `widget-annotation.ts` (474 lines) - Widget annotations
- `form-font.ts` (291 lines) - Font types for forms
- `field-tree.ts` (303 lines) - Field tree iteration

These are form-specific, not document-level structures.

**Recommendation:** Create `src/forms/` with subdirectories:

```
src/forms/
  acro-form.ts              # Core AcroForm class
  form-flattener.ts         # Extract flattening from acro-form.ts
  field-tree.ts
  widget-annotation.ts
  form-font.ts

  fields/                   # Split form-field.ts by type
    index.ts                # Re-exports all
    base.ts                 # FormField, TerminalField base classes
    text-field.ts
    checkbox-field.ts
    radio-field.ts
    choice-fields.ts        # Dropdown, ListBox
    button-field.ts
    signature-field.ts

  appearance/               # Split appearance-generator.ts
    index.ts
    common.ts               # Shared utilities
    text.ts
    checkbox.ts
    radio.ts
    choice.ts
```

**Benefits:**

- `document/` is cleaner (only document-level structures)
- Each field type in its own file (easier to find, modify)
- Appearance generation split by type (1663 lines → ~300 each)

---

### 3. What Should Remain in `src/document/`

After moving forms, `src/document/` should contain only:

```
src/document/
  object-registry.ts   # Object/reference management
  object-copier.ts     # Cross-document copying
  name-tree.ts         # PDF Name Tree structure
  change-collector.ts  # Dirty tracking for incremental saves
  linearization.ts     # Linearization detection
```

These are genuine document-level concerns, not feature-specific.

---

### 4. Reorganize `src/helpers/`

**Problem:** `helpers/` is a grab-bag of unrelated utilities:

```
src/helpers/
  operators.ts   # Should be in content/ (duplicate)
  encoding.ts    # Text encoding
  unicode.ts     # Unicode mapping
  chars.ts       # Character constants
  strings.ts     # String utilities
  page-size.ts   # Page dimensions
  format.ts      # Number formatting
```

**Recommendation:**

```
src/helpers/
  text/
    encoding.ts
    unicode.ts
    chars.ts
    strings.ts
  format.ts
  page-size.ts    # Could also move to api/

# Delete: operators.ts (merge into content/)
```

---

### 5. Split Large Files

#### `standard-14.ts` (3170 lines)

Mostly data tables. Consider:

- `standard-14/index.ts` - Core functions
- `standard-14/widths.ts` - Large width tables

#### `form-field.ts` (1439 lines)

Split by field type (see #2 above).

#### `appearance-generator.ts` (1663 lines)

**Keep as-is.** One class with shared state (acroForm, registry) and helper methods.
Splitting would fragment the class without real benefit - the size is inherent to
the task (lots of PDF operators for each field type).

#### `acro-form.ts` (1310 lines)

Extract flattening logic to `form-flattener.ts`.

---

### 6. Move `form-font.ts` to `src/fonts/`

**Problem:** `document/form-font.ts` defines font types used in forms but is in `document/`.

**Recommendation:** Move to `src/fonts/form-font.ts` since it's font-related.

---

## Proposed Final Structure

```
src/
  api/                      # High-level public API ✅
    pdf.ts
    pdf-context.ts
    pdf-catalog.ts
    pdf-page.ts
    page-tree.ts
    pdf-form.ts
    pdf-fonts.ts
    pdf-attachments.ts

  document/                 # Document infrastructure
    object-registry.ts
    object-copier.ts
    name-tree.ts
    change-collector.ts
    linearization.ts

  document/
    forms/                  # NEW - Form handling (subdirectory)
      acro-form.ts
      form-flattener.ts
      field-tree.ts
      widget-annotation.ts
      appearance-generator.ts
      form-font.ts
      fields/
        index.ts
        base.ts
      text-field.ts
      checkbox-field.ts
      radio-field.ts
      choice-fields.ts
      button-field.ts
      signature-field.ts
    appearance/
      index.ts
      common.ts
      text.ts
      checkbox.ts
      radio.ts
      choice.ts

  content/                  # Content streams
    operators.ts            # Merged with helpers/operators.ts
    content-stream.ts

  fonts/                    # Font handling
    (existing files)
    form-font.ts            # Moved from document/

  parser/                   # (unchanged)
  writer/                   # (unchanged)
  objects/                  # (unchanged)
  io/                       # (unchanged)
  filters/                  # (unchanged)
  security/                 # (unchanged)
  attachments/              # (unchanged)
  fontbox/                  # (unchanged)

  helpers/                  # Utilities
    text/
      encoding.ts
      unicode.ts
      chars.ts
      strings.ts
    format.ts
    page-size.ts
```

---

## Implementation Priority

| Change                        | Impact              | Effort | Priority |
| ----------------------------- | ------------------- | ------ | -------- |
| Merge operators.ts files      | Fixes confusion     | Low    | **P0**   |
| Create src/forms/ directory   | Major cleanup       | Medium | **P1**   |
| Split form-field.ts           | Better organization | Medium | **P2**   |
| Split appearance-generator.ts | Better organization | Medium | **P2**   |
| Reorganize helpers/           | Minor cleanup       | Low    | **P3**   |
| Move form-font.ts             | Minor cleanup       | Low    | **P3**   |

---

## Completed Reorganization (2026-01-04)

All planned reorganization has been completed:

### Directory Structure Changes

1. **Created `src/document/forms/` subdirectory:**
   - Moved: `acro-form.ts`, `appearance-generator.ts`, `field-tree.ts`, `form-font.ts`, `widget-annotation.ts`
   - Created: `form-flattener.ts` (extracted from acro-form.ts)
   - All test files moved alongside their implementations

2. **Split `form-field.ts` (1439 lines) into `src/document/forms/fields/`:**

   ```
   fields/
     index.ts           # Re-exports everything
     types.ts           # FieldType, FieldFlags, RgbColor, ChoiceOption, AcroFormLike
     base.ts            # FormField, NonTerminalField, TerminalField base classes
     text-field.ts      # TextField
     checkbox-field.ts  # CheckboxField
     radio-field.ts     # RadioField
     choice-fields.ts   # DropdownField, ListBoxField
     other-fields.ts    # SignatureField, ButtonField, UnknownField
     factory.ts         # createFormField()
   ```

3. **Extracted `form-flattener.ts` from `acro-form.ts`:**
   - Created `src/document/forms/form-flattener.ts` (~557 lines)
   - Moved all flattening logic (FormFlattener class, FlattenOptions interface)
   - Reduced `acro-form.ts` from 1311 to 752 lines

4. **Created `src/helpers/save-utils.ts`:**
   - Moved `checkIncrementalSaveBlocker()` from linearization.ts
   - Moved `IncrementalSaveBlocker` type
   - Better separation: linearization detection vs save strategy

### Final Structure

```
src/document/
  forms/                        # Form handling
    acro-form.ts               # Core AcroForm class (752 lines)
    acro-form.test.ts
    appearance-generator.ts     # Appearance stream generation
    field-tree.ts              # Field tree iteration
    field-tree.test.ts
    form-flattener.ts          # Flattening logic (NEW)
    form-font.ts               # Font types for forms
    form-font.test.ts
    widget-annotation.ts       # Widget annotations
    fields/                    # Split from form-field.ts
      index.ts
      types.ts
      base.ts
      text-field.ts
      checkbox-field.ts
      radio-field.ts
      choice-fields.ts
      other-fields.ts
      factory.ts
  change-collector.ts
  linearization.ts             # Linearization detection only
  name-tree.ts
  object-copier.ts
  object-registry.ts

src/helpers/
  save-utils.ts               # IncrementalSaveBlocker, checkIncrementalSaveBlocker
  ...existing files...
```

### Benefits Achieved

- `document/` is cleaner - forms are in their own subdirectory
- Each field type is in its own file - easier to find and modify
- `acro-form.ts` reduced from 1311 to 752 lines
- `form-field.ts` split from 1439 lines into 7 smaller files
- Flattening logic separated from form management
- Save strategy helpers separated from linearization detection

### All Tests Passing

1895 tests pass, typecheck clean.
