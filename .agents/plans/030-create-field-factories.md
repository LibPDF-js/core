# Plan: Create Field Factories

## Problem Statement

Currently, only `createSignatureField` exists for creating new form fields. Users need a way to programmatically create text fields, checkboxes, radio buttons, dropdowns, and list boxes with styling options, then place them on pages.

## Goals

1. Add factory methods to `PDFForm` for all field types
2. Add `page.drawField()` method to place fields on pages
3. Support styling options (colors, border, font, rotation)
4. Enable fields to be placed on multiple pages (multiple widgets per field)

## Scope

### In Scope

- `form.createTextField(name, options)`
- `form.createCheckbox(name, options)`
- `form.createRadioGroup(name, options)`
- `form.createDropdown(name, options)`
- `form.createListbox(name, options)`
- `page.drawField(field, options)` - adds widget to page (async)
- Color types: `rgb()`, `grayscale()`, `cmyk()`
- Rotation: `degrees()` helper
- Font support via embedded fonts
- Checkbox/radio symbol customization

### Out of Scope

- Button fields (rarely needed, complex)
- Rich text fields (complex, limited viewer support)
- JavaScript actions on fields
- Field calculations/validation scripts

## Desired Usage

```typescript
import { PDF, rgb, degrees, TextAlignment } from "@libpdf/core";

const pdf = await PDF.load(bytes);

// Embed a font for the form (full font, no subsetting for forms)
const ubuntuFont = pdf.fonts.embed(fontBytes, { subset: false });

// Get or create the form
const form = await pdf.getOrCreateForm();

// Create a text field with styling
const nameField = form.createTextField("name", {
  font: ubuntuFont,
  fontSize: 12,
  color: rgb(0, 0, 0), // text color
  backgroundColor: rgb(1, 1, 0.9), // light cream
  borderColor: rgb(0.5, 0.5, 0.5),
  borderWidth: 1,
  maxLength: 100,
  multiline: false,
  alignment: TextAlignment.Left,
  defaultValue: "John Doe",
});

// Place the field on a page (async - generates appearance)
const page = await pdf.getPage(0);
await page.drawField(nameField, {
  x: 100,
  y: 700,
  width: 200,
  height: 24,
});

// Create a checkbox with custom symbol
const agreeCheckbox = form.createCheckbox("agree", {
  onValue: "Yes",
  symbol: "check", // or "cross", "square"
  backgroundColor: rgb(1, 1, 1),
  borderColor: rgb(0, 0, 0),
  borderWidth: 1,
  defaultChecked: true,
});

await page.drawField(agreeCheckbox, {
  x: 100,
  y: 650,
  width: 18,
  height: 18,
});

// Create a dropdown
const countryDropdown = form.createDropdown("country", {
  options: ["USA", "Canada", "UK", "Germany", "France"],
  defaultValue: "USA",
  font: ubuntuFont,
  fontSize: 11,
});

await page.drawField(countryDropdown, {
  x: 100,
  y: 600,
  width: 200,
  height: 24,
});

// Create a radio group with options on different locations
const paymentRadio = form.createRadioGroup("payment", {
  options: ["Credit Card", "PayPal", "Bank Transfer"],
  symbol: "circle", // or "check"
  defaultValue: "Credit Card",
});

// Each option gets its own widget (option is required for radio groups)
await page.drawField(paymentRadio, {
  x: 100,
  y: 550,
  width: 16,
  height: 16,
  option: "Credit Card",
});
await page.drawField(paymentRadio, {
  x: 100,
  y: 520,
  width: 16,
  height: 16,
  option: "PayPal",
});
await page.drawField(paymentRadio, {
  x: 100,
  y: 490,
  width: 16,
  height: 16,
  option: "Bank Transfer",
});

// Fields can span multiple pages with different sizes
const page2 = await pdf.getPage(1);
await page2.drawField(nameField, {
  // Same field, different widget
  x: 50,
  y: 500,
  width: 300, // Different size - gets its own appearance stream
  height: 30,
});

// Save with new fields
const bytes = await pdf.save();
```

## Architecture

### Field Creation Flow

```
form.createTextField("name", options)
    │
    ├─► Validate unique name
    ├─► Create field dict (no widget yet)
    │     /FT /Tx
    │     /T (name)
    │     /Ff (flags based on options)
    │     /DA (default appearance for font/color)
    │     /Q (alignment)
    │     /MaxLen (if set)
    │     /V (defaultValue if provided)
    │     /DV (defaultValue if provided)
    │     /Kids [] (empty array)
    │
    ├─► If font provided, auto-prepare and add to AcroForm /DR
    ├─► Register in ObjectRegistry
    ├─► Add to AcroForm /Fields
    ├─► Create field wrapper (TextField)
    └─► Return field (no widgets yet)

page.drawField(field, { x, y, width, height }) → Promise<void>
    │
    ├─► Validate options (radio requires option param)
    ├─► Create widget annotation dict
    │     /Type /Annot
    │     /Subtype /Widget
    │     /Rect [x, y, x+width, y+height]
    │     /P (page ref)
    │     /Parent (field ref)
    │     /MK (appearance characteristics from field options)
    │     /BS (border style)
    │     /F 4 (Print flag)
    │
    ├─► Register widget in ObjectRegistry
    ├─► Add widget ref to field's /Kids array
    ├─► Add widget ref to page's /Annots array
    ├─► Generate appearance stream (async, sized to this widget's rect)
    └─► Update field's widget cache
```

### Always Use /Kids (Separate Widgets)

PDF allows two models:

1. **Merged** (single widget): Field and widget share the same dictionary
2. **Separate** (multiple widgets): Field has `/Kids` pointing to widget dicts

We always use the **separate** model with `/Kids`:

- Simpler, consistent implementation (no conditional logic)
- No need to "split" a merged field when adding a second widget
- Works uniformly for single or multiple widgets
- Required anyway for radio groups (one widget per option)

The flow:

- `createField()` creates a field dict with empty `/Kids` array
- Each `drawField()` creates a widget dict with `/Parent` pointing to field
- Widget ref is added to field's `/Kids` and page's `/Annots`

### Per-Widget Appearance Streams

Each widget gets its own appearance stream sized to its rectangle. This matches PDFBox and pdf-lib behavior:

- The field value (`/V`) is shared across all widgets
- Each widget can have different dimensions
- Font auto-sizing calculates based on each widget's size
- The same text may appear at different font sizes in different widgets

### Orphan Fields Allowed

If a field is created but `drawField` is never called, the field exists in the AcroForm but has no widgets (empty `/Kids`). This is:

- Technically valid PDF
- Field is invisible/unusable in viewers
- Documented as user's responsibility to place fields

### Color Types

Create simple color helper functions in `src/helpers/colors.ts`:

```typescript
export interface RGB {
  type: "RGB";
  red: number; // 0-1
  green: number;
  blue: number;
}

export interface Grayscale {
  type: "Grayscale";
  gray: number; // 0-1
}

export interface CMYK {
  type: "CMYK";
  cyan: number; // 0-1
  magenta: number;
  yellow: number;
  black: number;
}

export type Color = RGB | Grayscale | CMYK;

export function rgb(r: number, g: number, b: number): RGB {
  return { type: "RGB", red: r, green: g, blue: b };
}

export function grayscale(gray: number): Grayscale {
  return { type: "Grayscale", gray };
}

export function cmyk(c: number, m: number, y: number, k: number): CMYK {
  return { type: "CMYK", cyan: c, magenta: m, yellow: y, black: k };
}
```

### Rotation Helper

Create in `src/helpers/rotations.ts`:

```typescript
export interface Degrees {
  type: "degrees";
  angle: number;
}

export function degrees(angle: number): Degrees {
  return { type: "degrees", angle };
}
```

### Checkbox/Radio Symbols

Supported symbols using ZapfDingbats:

**Checkboxes:**
| Symbol | ZapfDingbats Code | Appearance |
|--------|-------------------|------------|
| `"check"` (default) | `\x34` | ✓ |
| `"cross"` | `\x38` | ✗ |
| `"square"` | `\x6E` | ■ |

**Radio buttons:**
| Symbol | ZapfDingbats Code | Appearance |
|--------|-------------------|------------|
| `"circle"` (default) | `\x6C` | ● |
| `"check"` | `\x34` | ✓ |

### Font Integration

Fields need fonts for text rendering:

1. **Default Resources (DR)**: Form-level font dictionary
   - Standard fonts (Helv, ZaDb) always available in new AcroForms
   - Embedded fonts added to `/DR/Font` when used with fields

2. **Per-field DA string**: `/DA` entry like `/Helv 12 Tf 0 g`
   - Font name references DR entry
   - Size and color encoded in DA

**Auto-prepare on field creation:**

When a font is passed to `createTextField` etc., the font is automatically prepared (if not already) and added to the AcroForm's `/DR/Font` dictionary:

```typescript
const font = pdf.fonts.embed(fontBytes, { subset: false });
// No need to call pdf.fonts.prepare() manually

const field = form.createTextField("name", { font });
// Font is auto-prepared and added to /DR
```

**No subsetting for form fonts:**

Form fonts must NOT be subsetted. Users may type any character when filling the form in a PDF viewer, so all glyphs must be available. Use `{ subset: false }` when embedding fonts for forms.

### getOrCreateForm() Behavior

When creating a new AcroForm for a PDF that doesn't have one:

```typescript
const form = await pdf.getOrCreateForm();
```

Creates a full AcroForm with defaults:

- `/Fields []` - empty fields array
- `/DR` - default resources containing Helvetica and ZapfDingbats
- `/DA "/Helv 0 Tf 0 g"` - default appearance string
- `/NeedAppearances false` - we generate appearances ourselves

## API Design

### Sync vs Async

- **Field creation is sync**: `createTextField()`, `createCheckbox()`, etc. return immediately
- **Widget placement is async**: `page.drawField()` returns `Promise<void>` because it generates appearance streams

### Validation Behavior

**Radio group `option` parameter:**

- Radio groups **require** the `option` parameter in `drawField` - throws error if missing
- Non-radio fields with `option` specified - ignored silently (lenient)
- Invalid option value for radio group - throws error

**Field names:**

- Any characters allowed, user's responsibility
- Document risks: dots imply hierarchy in some viewers, brackets used for array notation
- Unicode fully supported

### Tab Order

Widgets are added to the page's `/Annots` array in the order `drawField` is called. Tab order in PDF viewers follows this order (when page `/Tabs` is not set or is `/S` structure order).

## Component Changes

### New Files

| File                       | Purpose                                                  |
| -------------------------- | -------------------------------------------------------- |
| `src/helpers/colors.ts`    | Color types and `rgb()`, `grayscale()`, `cmyk()` helpers |
| `src/helpers/rotations.ts` | `degrees()` helper                                       |

### Modified Files

| File                                         | Changes                                                                                        |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/api/pdf.ts`                             | Add `getOrCreateForm()` method                                                                 |
| `src/api/pdf-form.ts`                        | Add `createTextField`, `createCheckbox`, `createRadioGroup`, `createDropdown`, `createListbox` |
| `src/api/pdf-page.ts`                        | Add `drawField()` method, add internal `addAnnotation()` helper                                |
| `src/document/forms/acro-form.ts`            | Add `addFontToResources()`, support creating new AcroForm                                      |
| `src/document/forms/fields/base.ts`          | Support adding widgets to `/Kids` via `addWidget()` method                                     |
| `src/document/forms/appearance-generator.ts` | Add symbol support for checkbox/radio                                                          |
| `src/index.ts`                               | Export new types and helpers                                                                   |

### Type Definitions

```typescript
// Checkbox/radio symbols
type CheckboxSymbol = "check" | "cross" | "square";
type RadioSymbol = "circle" | "check";

// Field creation options (common to all)
interface FieldOptions {
  backgroundColor?: Color;
  borderColor?: Color;
  borderWidth?: number;
  rotate?: Degrees;
}

// Text field specific
interface TextFieldOptions extends FieldOptions {
  font?: EmbeddedFont;
  fontSize?: number;
  color?: Color; // text color
  maxLength?: number;
  multiline?: boolean;
  password?: boolean;
  comb?: boolean;
  alignment?: TextAlignment;
  defaultValue?: string;
}

// Checkbox specific
interface CheckboxOptions extends FieldOptions {
  onValue?: string; // default "Yes"
  symbol?: CheckboxSymbol; // default "check"
  defaultChecked?: boolean;
}

// Radio group specific
interface RadioGroupOptions extends FieldOptions {
  options: string[]; // required: option values
  symbol?: RadioSymbol; // default "circle"
  defaultValue?: string;
}

// Dropdown specific
interface DropdownOptions extends FieldOptions {
  options: string[];
  font?: EmbeddedFont;
  fontSize?: number;
  color?: Color;
  editable?: boolean; // allow user to type
  defaultValue?: string;
}

// Listbox specific
interface ListboxOptions extends FieldOptions {
  options: string[];
  font?: EmbeddedFont;
  fontSize?: number;
  color?: Color;
  multiSelect?: boolean;
  defaultValue?: string[];
}

// Draw field options
interface DrawFieldOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  option?: string; // required for radio groups, ignored for others
}
```

## Test Plan

### Unit Tests

1. **Field creation** - each type creates correct dict structure with empty `/Kids`
2. **Unique name validation** - throws on duplicate name
3. **drawField** - creates widget, adds to `/Kids` and page `/Annots`
4. **Multi-widget** - multiple `drawField` calls add multiple widgets to `/Kids`
5. **Different widget sizes** - each widget gets its own appearance stream
6. **Radio groups** - each option gets separate widget with correct `/AS`
7. **Radio validation** - throws if `option` missing, throws if invalid option
8. **Non-radio with option** - option param ignored silently
9. **Appearance generation** - visual appearance created for each widget
10. **Font in DR** - embedded fonts added to form resources
11. **Symbol customization** - correct ZapfDingbats character used
12. **Default values** - `/V` and `/DV` set, appearance shows default
13. **getOrCreateForm** - creates proper AcroForm structure for PDFs without forms

### Integration Tests

1. Create PDF from scratch with various field types
2. Open in PDF viewer and verify interactivity
3. Fill fields programmatically and verify values
4. Test tab order matches draw order
5. Flatten and verify appearance matches
6. Load existing PDF, add fields, save and verify
7. Test multi-page fields with different widget sizes

### Viewer Testing

Test in multiple PDF viewers:

- Adobe Acrobat
- macOS Preview
- Chrome PDF viewer
- Firefox PDF viewer
- PDF.js

## Dependencies

- `AppearanceGenerator` must support creating appearances for new (empty) fields ✓ (already works)
- `AppearanceGenerator` must support symbol selection for checkbox/radio (needs update)
- Font embedding pipeline must support `{ subset: false }` option
- Page must have method to add to `/Annots` array (new)
- `PDF` class needs `getOrCreateForm()` method (new)

## Risks

1. **Appearance complexity**: Different PDF viewers render fields differently. Testing across viewers essential.

2. **Font size**: Form fonts cannot be subsetted (users need all glyphs when typing). This means larger file sizes for CJK fonts. Document this tradeoff clearly.

3. **Radio group state**: Radio buttons share field value but have individual widget states. Coordination between `/V` and `/AS` values requires careful implementation.

4. **Auto-prepare side effect**: Passing a font to `createTextField` automatically prepares it. This is convenient but may surprise users who expected to control preparation timing.
