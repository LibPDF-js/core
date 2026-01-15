# Plan: Form Field Writing and Flattening Rewrite

## Problem Statement

Our current form field implementation has several issues identified during comparison with PDFBox:

1. **Fragile page discovery** - Finding pages for widgets without `/P` requires scanning and is unreliable
2. **Mixed responsibilities** - `AcroForm` handles too much (flattening, appearance generation coordination)
3. **No field tree iterator** - Walking the field tree requires async resolution each time
4. **Limited robustness** - No circular reference protection in some paths, no missing page fallback
5. **Appearance generation coupled to AcroForm** - Generator knows too much about form structure
6. **Button appearances never regenerated** - Blanket skip rather than intelligent preservation
7. **No export values support** for radio buttons (PDFBox handles `/Opt` entries)
8. **Value validation scattered** - Each field class validates differently

## Goals

1. Adopt PDFBox's proven patterns while keeping idiomatic TypeScript
2. Clean separation of concerns between field classes, appearance generation, and flattening
3. Robust handling of malformed PDFs (missing `/P`, circular refs, invalid appearances)
4. Synchronous field tree iteration once loaded
5. Better testability through smaller, focused units
6. Support for export values in button fields

## Non-Goals

- XFA form support (complex, rarely needed)
- JavaScript action execution (would need a JS engine)
- Signature creation/validation (separate feature)
- Rich text rendering (HTML subset - very complex)
- Field creation (defer to later phase, focus on editing existing fields)

---

## Design Decisions

### 1. Terminal vs Non-Terminal Fields

PDFBox distinguishes:

- **Terminal fields**: Have widgets (visual), hold values
- **Non-terminal fields**: Containers only, no value, just organize hierarchy

We currently conflate these. Separating them clarifies the model.

### 2. Field Type Detection via Factory

PDFBox's `PDFieldFactory.createField()`:

- Looks at `/FT` (field type)
- Checks `/Ff` flags for button subtype (push, radio, checkbox)
- Checks `/Ff` flags for choice subtype (combo vs listbox)
- Returns appropriate class

Our factory is similar but needs cycle detection in type lookup.

### 3. Value Setting with Automatic Appearance Update

**Decision**: `setValue()` is async and always regenerates appearances immediately.

```typescript
await field.setValue("new value"); // Regenerates appearance automatically
```

For batch operations, use `Promise.all`:

```typescript
await Promise.all([
  field1.setValue("value1"),
  field2.setValue("value2"),
  field3.setValue("value3"),
]);
```

This replaces the `needsAppearanceUpdate` flag approach.

### 4. Batch Validation Pattern

For batch operations with validation requirements, use validate-then-apply:

```typescript
// Throws ValidationError with all issues if any field invalid
await acroForm.validateChanges([
  { field: nameField, value: "John" },
  { field: ageField, value: "25" },
]);

// Safe to call after validation passes
await acroForm.applyChanges([
  { field: nameField, value: "John" },
  { field: ageField, value: "25" },
]);
```

The `validateChanges()` method throws a `ValidationError` containing all validation failures if any field would reject its value. This acts as a gate before `applyChanges()`.

### 5. Button Export Values (`/Opt`)

PDFBox supports `/Opt` array for radio buttons:

- Allows non-Latin export values
- Allows radio buttons with same visual appearance but different export values
- `getExportValues()` returns the list
- `setValue()` maps export value to widget state

We will add this support.

### 6. Widget State Synchronization

For buttons, update **all widget `/AS` entries** when value changes (following PDFBox):

```typescript
for (const widget of this.getWidgets()) {
  if (widget.hasAppearanceForState(value)) {
    widget.setAppearanceState(value);
  } else {
    widget.setAppearanceState("Off");
  }
}
```

### 7. Merged Field/Widget Handling

**Decision**: Follow PDFBox - always create `WidgetAnnotation` wrapper, even for merged fields.

```typescript
// In TerminalField.getWidgets()
if (!this.dict.has("Kids")) {
  // Field itself is the widget (merged case)
  return [new WidgetAnnotation(this.dict, this.ref, this.registry)];
} else {
  // Separate widgets in Kids array
  return this._widgets;
}
```

This provides uniform handling - `getWidgets()` always returns a list of `WidgetAnnotation` objects.

### 8. Parent Field Tracking

**Decision**: Store parent as `FormField | null` to handle any hierarchy.

```typescript
class FormField {
  parent: FormField | null = null;
  // Set during field tree iteration
}
```

This handles cases where parent might be NonTerminalField or (in unusual PDFs) another TerminalField.

---

## Error Handling Strategy

### Strict Mode

**Default**: Lenient (warn and continue) - matches PDFBox behavior.

```typescript
// Default behavior - warn and continue
const fields = await acroForm.getFields(); // lenient

// Explicit strict - throw on problems
const fields = await acroForm.getFields({ strict: true });

// Explicit lenient
await acroForm.flatten({ strict: false });
```

Per-operation `{ strict: boolean }` option overrides the default.

### Error Categories

| Scenario                           | Lenient Behavior        | Strict Behavior         |
| ---------------------------------- | ----------------------- | ----------------------- |
| Circular reference in field tree   | Warn, skip field        | Throw                   |
| Widget with missing `/P`           | Warn, scan pages for it | Warn, scan pages for it |
| Invalid field type (`/FT` missing) | Create `UnknownField`   | Throw                   |
| Zero-size appearance BBox          | Warn, skip widget       | Throw                   |
| Font can't encode character        | Throw always            | Throw always            |
| Dynamic XFA form                   | Warn, skip flatten      | Warn, skip flatten      |

**Note**: Font encoding errors always throw - this is data loss that can't be recovered silently.

### Font Encoding Errors

When a font cannot encode text, throw immediately with a clear error:

```typescript
throw new Error(
  `Font "Helvetica" cannot encode character '中' (U+4E2D). ` +
    `Use field.setFont() with a font that supports this character.`,
);
```

Future enhancement: Add font fallback chains via `acroForm.setFontFallbacks([...])`.

---

## Appearance Generation

### Button Appearance Regeneration

**Decision**: Smart detection - only generate if missing or invalid.

Regenerate checkbox/radio appearances when:

1. No `/AP` dictionary exists
2. No `/N` (normal appearance) entry exists
3. Required state key is missing from `/N`
4. BBox has zero width or height
5. Appearance stream has zero bytes
6. `NeedAppearances` flag is set on the form

**Do NOT regenerate when**:

- Valid appearance exists (even if simple)
- Push buttons (always preserve - they have custom artwork)

Check only normal (`/N`) appearances, not rollover (`/R`) or down (`/D`).

### Appearance Generator Refactor

Generator becomes per-field, not per-form:

```typescript
class AppearanceGenerator {
  constructor(
    private field: TerminalField,
    private acroForm: AcroForm,
    private registry: ObjectRegistry
  )

  async generateAppearances(): Promise<void>

  private generateTextAppearance(widget: WidgetAnnotation): PdfStream
  private generateCheckboxAppearance(widget: WidgetAnnotation): { on: PdfStream, off: PdfStream }
  private generateRadioAppearance(widget: WidgetAnnotation): { selected: PdfStream, off: PdfStream }
  private generateDropdownAppearance(widget: WidgetAnnotation): PdfStream
  private generateListBoxAppearance(widget: WidgetAnnotation): PdfStream
}
```

Key behaviors:

- Handles resource copying from widget to form `/DR`
- Preserves extracted styling (colors, fonts) from existing appearance
- Regenerates content from scratch (doesn't preserve BMC/EMC structure)
- Applies rotation via Matrix in appearance stream

---

## Flattening

### Page Discovery Strategy

**Decision**: Follow PDFBox - scan all pages only if any widget lacks `/P`.

```typescript
private buildPageWidgetMap(): Map<PdfRef, WidgetAnnotation[]> {
  const map = new Map();
  let hasMissingPageRef = false;

  // Phase 1: Try /P references
  for (const field of this.fields) {
    for (const widget of field.getWidgets()) {
      const pageRef = widget.pageRef;
      if (pageRef) {
        addToMap(map, pageRef, widget);
      } else {
        warn(`Missing /P entry for widget in field: ${field.name}`);
        hasMissingPageRef = true;
      }
    }
  }

  // Phase 2: If any missing, scan all pages
  if (hasMissingPageRef) {
    warn("Scanning all pages for widgets with missing /P references");
    this.scanAllPagesForWidgets(map);
  }

  return map;
}
```

### Visibility Flag Handling

**Decision**: Follow PDFBox exactly.

Skip widgets with:

- `Invisible` flag (bit 1)
- `Hidden` flag (bit 2)

Flatten widgets with:

- `NoView` flag (print-only content gets flattened)
- No `Print` flag (still flattened)

Also skip if:

- No normal appearance stream
- BBox is null or has zero dimensions

### Form Cleanup After Flatten

**Decision**: Follow PDFBox - selective cleanup.

**Remove**:

- Flattened fields from `/Fields` array
- `/XFA` entry (always)
- `/SigFlags` (only if no signature fields remain)
- Widget annotations from page `/Annots` arrays

**Keep**:

- AcroForm dictionary itself (even if empty)
- `/DR` (default resources - may be referenced by flattened content)
- `/DA` (default appearance)
- `/Q` (default quadding)
- Non-flattened fields (for future selective flatten support)

### Dynamic XFA Forms

**Decision**: Warn and skip (PDFBox approach).

```typescript
if (this.hasDynamicXFA()) {
  this.registry.addWarning("Dynamic XFA forms cannot be flattened");
  return; // No-op
}
```

### Appearance Matrix Handling

**Decision**: Transform BBox corners by Matrix, find axis-aligned bounding box.

```typescript
private getTransformedAppearanceBBox(appearance: PdfStream): BoundingBox {
  const bbox = this.getAppearanceBBox(appearance);
  const matrix = this.getAppearanceMatrix(appearance);

  if (!matrix) return bbox;

  // Transform all 4 corners
  const corners = [
    transform(bbox.x1, bbox.y1, matrix),
    transform(bbox.x2, bbox.y1, matrix),
    transform(bbox.x2, bbox.y2, matrix),
    transform(bbox.x1, bbox.y2, matrix),
  ];

  // Find axis-aligned bounding box
  return {
    x: Math.min(...corners.map(c => c.x)),
    y: Math.min(...corners.map(c => c.y)),
    width: Math.max(...corners.map(c => c.x)) - Math.min(...corners.map(c => c.x)),
    height: Math.max(...corners.map(c => c.y)) - Math.min(...corners.map(c => c.y)),
  };
}
```

### Selective Flatten

**Decision**: All-or-nothing initially, add selective later.

First implementation flattens all fields. Future enhancement:

```typescript
await acroForm.flatten({ fields: [field1, field2] });
```

---

## Proposed Architecture

### Class Hierarchy

```
FormField (abstract)
  - dict: PdfDict
  - ref: PdfRef | null
  - registry: ObjectRegistry
  - parent: FormField | null
  - name: string (fully-qualified)

  abstract getValue(): unknown
  abstract getWidgets(): WidgetAnnotation[]

NonTerminalField extends FormField
  - getChildren(): FormField[]
  - getValue(): never throws (non-terminal fields don't hold values)
  - getWidgets(): WidgetAnnotation[] (always empty)

TerminalField extends FormField
  - abstract setValue(value: unknown): Promise<void>
  - getWidgets(): WidgetAnnotation[]
  - protected applyChange(): Promise<void>  // Calls constructAppearances()
  - protected constructAppearances(): Promise<void>

TextField extends TerminalField
  - getValue(): string
  - setValue(value: string): Promise<void>
  - maxLength, isMultiline, isPassword, isComb, alignment

CheckboxField extends TerminalField
  - getValue(): string  // "Off" or on-value
  - setValue(value: string): Promise<void>
  - isChecked(): boolean
  - check(): Promise<void>
  - uncheck(): Promise<void>
  - getOnValue(): string
  - getOnValues(): string[]  // For checkbox groups

RadioField extends TerminalField
  - getValue(): string | null
  - setValue(value: string | null): Promise<void>
  - getOptions(): string[]
  - getExportValues(): string[]  // NEW: /Opt support
  - noToggleToOff: boolean

DropdownField extends TerminalField
  - getValue(): string
  - setValue(value: string): Promise<void>
  - getOptions(): ChoiceOption[]
  - isEditable: boolean

ListBoxField extends TerminalField
  - getValue(): string[]
  - setValue(values: string[]): Promise<void>
  - getOptions(): ChoiceOption[]
  - isMultiSelect: boolean

SignatureField extends TerminalField
  - getValue(): null
  - isSigned(): boolean
  - getSignatureDict(): PdfDict | null

ButtonField extends TerminalField  // Push button
  - getValue(): null

UnknownField extends TerminalField
  - getValue(): unknown
```

### Field Tree Iterator

```typescript
class FieldTree implements Iterable<FormField> {
  constructor(private acroForm: AcroForm)

  *[Symbol.iterator](): Generator<FormField> {
    // Breadth-first, cycle-safe iteration
    // Sets parent references during iteration
  }

  *terminalFields(): Generator<TerminalField> {
    for (const field of this) {
      if (field instanceof TerminalField) {
        yield field;
      }
    }
  }
}
```

### AcroForm API

```typescript
class AcroForm {
  // Field access - with overloaded signatures for proper typing
  getFields(opts?: { includeNonTerminal?: false; strict?: boolean }): Promise<TerminalField[]>;
  getFields(opts: { includeNonTerminal: true; strict?: boolean }): Promise<FormField[]>;

  getField(name: string): Promise<FormField | null>;
  getFieldTree(): FieldTree;

  // Batch operations
  validateChanges(changes: Array<{ field: TerminalField; value: unknown }>): Promise<void>;
  applyChanges(changes: Array<{ field: TerminalField; value: unknown }>): Promise<void>;

  // Flattening
  flatten(options?: FlattenOptions): Promise<void>;

  // Font management
  getExistingFont(name: string): ExistingFont | null;
  getAvailableFonts(): ExistingFont[];
  setDefaultFont(font: FormFont): void;
  setDefaultFontSize(size: number): void;
  // Future: setFontFallbacks(fonts: FormFont[]): void
}

interface FlattenOptions {
  strict?: boolean;
  // Future: fields?: TerminalField[];
  // Future: removeEmptyForm?: boolean;
}
```

### FormFlattener (Internal)

```typescript
class FormFlattener {
  constructor(
    private acroForm: AcroForm,
    private registry: ObjectRegistry,
    private options: FlattenOptions
  )

  async flatten(): Promise<void>

  private buildPageWidgetMap(): Map<PdfRef, WidgetAnnotation[]>
  private scanAllPagesForWidgets(map: Map<PdfRef, WidgetAnnotation[]>): void
  private isVisibleWidget(widget: WidgetAnnotation): boolean
  private flattenWidgetOnPage(widget: WidgetAnnotation, page: PdfDict): void
  private calculateTransformMatrix(widget: WidgetAnnotation, appearance: PdfStream): Matrix
  private getTransformedAppearanceBBox(appearance: PdfStream): BoundingBox
  private appendToPageContent(page: PdfDict, content: Uint8Array): void
  private removeWidgetFromPage(widget: WidgetAnnotation, page: PdfDict): void
  private cleanupForm(): void
}
```

---

## Implementation Plan

### Phase 1: Field Hierarchy Refactor

1. Add `NonTerminalField` class
2. Add `TerminalField` abstract class with `applyChange()` and `constructAppearances()`
3. Update factory to detect terminal vs non-terminal fields
4. Add parent tracking (set during tree iteration)
5. Update existing field classes to extend `TerminalField`
6. Handle merged field/widget case (widget wraps same dict)

### Phase 2: Value Setting Cleanup

1. Make `setValue()` async and call `applyChange()` automatically
2. Remove `needsAppearanceUpdate` flag entirely
3. Add validation in `setValue()` before setting value
4. Add export values support to `RadioField` (`getExportValues()`)
5. Implement `validateChanges()` and `applyChanges()` on AcroForm

### Phase 3: Field Tree Iterator

1. Create `FieldTree` class with cycle detection
2. Implement breadth-first iteration
3. Set parent references during iteration
4. Add `terminalFields()` generator
5. Update `AcroForm.getFields()` with overloaded signatures

### Phase 4: Appearance Generator Refactor

1. Create per-field `AppearanceGenerator`
2. Add smart button appearance detection (missing/invalid check)
3. Respect `NeedAppearances` flag
4. Handle resource copying from widget to form `/DR`
5. Verify rotation handling via Matrix

### Phase 5: Flatten Refactor

1. Extract `FormFlattener` class from AcroForm
2. Implement two-phase page discovery (PDFBox approach)
3. Add visibility flag handling (Invisible, Hidden only)
4. Implement proper annotation removal from pages
5. Implement form cleanup (remove /XFA, conditional /SigFlags)
6. Add strict mode support

### Phase 6: Testing

1. Hand-craft test PDFs for known patterns:
   - Circular reference in field tree
   - Missing `/P` on widgets
   - Missing `/FT` (unknown field type)
   - Zero-size appearance BBox
   - Merged field/widget
   - Deep field hierarchy

2. Programmatic corruption tests:
   - Delete `/P` from widget, verify page scan
   - Delete `/AP`, verify regeneration
   - Create circular `/Parent` reference

3. Add real-world PDFs as issues are reported

---

## API Changes Summary

### Breaking Changes

1. `field.setValue()` becomes async (triggers appearance generation)
2. Remove `needsAppearanceUpdate` flag (automatic now)
3. `acroForm.updateAppearances()` becomes internal (called automatically)

### New APIs

1. `acroForm.getFields({ includeNonTerminal: true })` - Returns all fields including containers
2. `acroForm.getFieldTree()` - Returns iterable `FieldTree`
3. `acroForm.validateChanges(changes)` - Validate batch before apply
4. `acroForm.applyChanges(changes)` - Apply validated batch
5. `radioField.getExportValues()` - Get `/Opt` values
6. `field.parent` - Get parent field reference
7. `{ strict: boolean }` option on all operations

### Removed

1. `field.needsAppearanceUpdate` - No longer needed (appearance gen is automatic)
2. `acroForm.updateAppearances()` - Now internal, called automatically by `setValue()`

---

## Robustness Features

1. **Cycle detection in field tree** - Track visited dicts by object identity
2. **Missing page fallback** - Scan all pages if any widget has no `/P`
3. **Font encoding validation** - Throw clear error for unencodable characters
4. **XFA detection** - Warn and skip for dynamic XFA forms
5. **Invalid appearance handling** - Check BBox dimensions > 0
6. **Merged field handling** - Uniform WidgetAnnotation wrapper for all cases
7. **Strict mode** - Optional fail-fast behavior for debugging

---

## References

- PDFBox `PDAcroForm.java` - Form-level operations, flatten logic
- PDFBox `PDTerminalField.java` - Terminal field base, `getWidgets()`, `applyChange()`
- PDFBox `PDNonTerminalField.java` - Non-terminal (container) fields
- PDFBox `PDTextField.java`, `PDButton.java` - Field implementations
- PDFBox `AppearanceGeneratorHelper.java` - Appearance generation
- PDFBox `PDFieldTree.java` - Safe iteration with cycle detection
- PDFBox `PDFieldFactory.java` - Field type detection
- PDFBox `PDAnnotation.java` - Visibility flags (isInvisible, isHidden, etc.)
