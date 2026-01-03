# Plan 024: Form Field Fonts & Appearance Generation

## Overview

Enable setting custom fonts on form fields and generating proper appearance streams for all field types. This builds on Plan 020 (Font Embedding) to provide a complete form filling solution with custom font support.

## Problem

Currently:
- No way to set fonts on form fields
- Appearance generation only works for text fields
- Flattening uses existing appearances which may be malformed or use wrong fonts
- No support for CJK or special characters in form fields

## Scope

**In scope:**
- `field.setFont(font)` - set font for any field
- `field.setFontSize(size)` - set font size
- `field.setTextColor(r, g, b)` - set text color
- `form.setDefaultFont(font)` - set default font for all fields
- Appearance generation for ALL field types (text, checkbox, radio, dropdown, listbox, button)
- Font subsetting integration (track used glyphs when setValue is called)
- Flatten with font option: `form.flatten({ font })`
- Support for both embedded fonts and existing PDF fonts
- Comb field (character-spaced) layout
- Real font metrics for accurate text layout

**Out of scope:**
- Font creation/modification
- Complex text layout / RTL (requires HarfBuzz from Plan 020)
- Signature field appearances (require crypto)
- Button rollover/down states (normal state only)

## Desired Usage

### Basic: Set Font on Field

```typescript
const pdf = await PDF.load(file);
const myFont = await pdf.fonts.embed(fontBytes);

const form = await pdf.getForm();
const field = form.getTextField("name");

if (field) {
  field.setFont(myFont);
  field.setFontSize(12);
  field.setValue("John Doe");
}

await pdf.save();
```

### CJK Support

```typescript
const cjkFont = await pdf.fonts.embed(notoSansCJKBytes);

const field = form.getTextField("address");
field.setFont(cjkFont);
field.setValue("東京都渋谷区");  // Font automatically tracks these glyphs for subsetting
```

### Default Font for All Fields

```typescript
const font = await pdf.fonts.embed(fontBytes);

// Set default font for entire form
form.setDefaultFont(font);
form.setDefaultFontSize(10);

// All fields use this font unless overridden
form.fill({
  name: "John Doe",
  address: "123 Main St",
  city: "New York"
});
```

### Flatten with Custom Font

```typescript
const font = await pdf.fonts.embed(fontBytes);

// Flatten regenerates ALL appearances with this font
// (except read-only fields, which keep existing appearances)
await form.flatten({ font });
```

### Check Font Capability

```typescript
const field = form.getTextField("name");
const font = await pdf.fonts.embed(fontBytes);

const text = "Hello 世界";
if (font.canEncode(text)) {
  field.setFont(font);
  field.setValue(text);
} else {
  console.error("Font cannot render this text");
}
```

### Using Existing PDF Fonts

```typescript
const form = await pdf.getForm();

// Get fonts already in the PDF
const existingFont = form.getExistingFont("/Helv");  // Helvetica
if (existingFont) {
  field.setFont(existingFont);
}

// Or embed a new one
const customFont = await pdf.fonts.embed(fontBytes);
field.setFont(customFont);
```

### Text Color

```typescript
const field = form.getTextField("name");
field.setFont(myFont);
field.setTextColor(1, 0, 0);  // RGB red
field.setValue("Error text");
```

## Architecture

### Font Types

The system supports two font types:

```typescript
// Embedded font - full metrics and subsetting
interface EmbeddedFont {
  readonly name: string;
  readonly ref: PdfRef;
  canEncode(text: string): boolean;
  encodeText(text: string): Uint8Array;  // Tracks glyphs for subsetting
  getTextWidth(text: string, fontSize: number): number;
  getAscent(fontSize: number): number;
  getDescent(fontSize: number): number;
}

// Existing PDF font - lightweight wrapper
interface ExistingFont {
  readonly name: string;  // e.g., "/Helv", "/ZaDb"
  readonly ref: PdfRef | null;
  // Limited metrics (approximations for standard fonts)
  getTextWidth(text: string, fontSize: number): number;
}

type FormFont = EmbeddedFont | ExistingFont;
```

### Text Encoding Strategy

**Critical distinction:**
- `/V` (value) stores **Unicode text** — human-readable, searchable, copy-pasteable
- Appearance stream uses **encoded glyph sequences** — font-specific rendering

```
field.setValue("Hello 世界")
       │
       ▼
   ┌─────────────────┐
   │ Store Unicode   │  → /V (Hello 世界) - remains searchable
   │ in field /V     │
   └─────────────────┘
       │
       ▼
   ┌─────────────────┐
   │ font.encodeText │  → Glyph IDs for appearance stream
   │ (tracks glyphs) │     Also tracks for subsetting
   └─────────────────┘
       │
       ▼
   ┌─────────────────┐
   │ Mark field as   │
   │ needsAppearance │
   └─────────────────┘
```

### Font Resolution Order

When generating appearances, fonts are resolved in this order:

1. Field's explicitly set font (`field.setFont()`)
2. Form's default font (`form.setDefaultFont()`)
3. Flatten option font (`flatten({ font })`)
4. Existing font from field's DA string
5. Helvetica (fallback, WinAnsi only)

### Font Size Resolution

Font size is resolved as:

1. Field's explicitly set size (`field.setFontSize()`)
2. Existing size from field's DA string (if non-zero)
3. Form's default size (`form.setDefaultFontSize()`)
4. Auto-size (0) — calculate optimal size to fit field

### Glyph Subsetting

Glyph tracking happens throughout the document's lifetime, finalized at save:

```
setValue("Hello")  →  font tracks: H, e, l, o
setValue("World")  →  font tracks: H, e, l, o, W, r, d
pdf.save()         →  subset contains only: H, W, d, e, l, o, r
```

## API

### FormField (base class)

```typescript
abstract class FormField {
  // Existing
  readonly name: string;
  readonly type: FieldType;
  needsAppearanceUpdate: boolean;
  
  // New - Font
  protected _font: FormFont | null;
  protected _fontSize: number | null;
  protected _textColor: { r: number; g: number; b: number } | null;
  
  /**
   * Set the font for this field.
   * Accepts embedded fonts or existing PDF fonts.
   * Applies to all widgets of this field.
   */
  setFont(font: FormFont): void;
  
  /**
   * Get the font for this field, or null if using default.
   */
  getFont(): FormFont | null;
  
  /**
   * Set the font size in points.
   * Use 0 for auto-size (fit to field).
   */
  setFontSize(size: number): void;
  
  /**
   * Get the font size, or null if using default/DA value.
   */
  getFontSize(): number | null;
  
  /**
   * Set text color as RGB values (0-1 range).
   */
  setTextColor(r: number, g: number, b: number): void;
  
  /**
   * Get text color, or null if using existing DA color.
   */
  getTextColor(): { r: number; g: number; b: number } | null;
}
```

### PDFForm

```typescript
class PDFForm {
  // Existing
  getTextField(name: string): TextField | undefined;
  fill(values: Record<string, FieldValue>): FillResult;
  flatten(options?: FlattenOptions): Promise<void>;
  
  // New - Default Font
  private _defaultFont: FormFont | null;
  private _defaultFontSize: number;
  
  /**
   * Set the default font for all fields.
   */
  setDefaultFont(font: FormFont): void;
  
  /**
   * Get the default font.
   */
  getDefaultFont(): FormFont | null;
  
  /**
   * Set the default font size for all fields.
   */
  setDefaultFontSize(size: number): void;
  
  /**
   * Get the default font size.
   */
  getDefaultFontSize(): number;
  
  // New - Existing Fonts
  /**
   * Get an existing font from the PDF's resources.
   * Returns null if font not found.
   * 
   * @param name Font name including slash, e.g., "/Helv", "/ZaDb"
   */
  getExistingFont(name: string): ExistingFont | null;
  
  /**
   * List all fonts available in the PDF's default resources.
   */
  getAvailableFonts(): ExistingFont[];
}
```

### FlattenOptions

```typescript
interface FlattenOptions {
  /** Skip appearance update (use existing appearances) */
  skipAppearanceUpdate?: boolean;
  
  /** Font to use when regenerating appearances */
  font?: FormFont;
  
  /** Font size to use (0 = auto) */
  fontSize?: number;
}
```

## Appearance Generators

### Text Field

Generates single-line or multi-line text appearance:

- Uses real font metrics from embedded font for accurate layout
- Supports left/center/right alignment via `/Q` field flag
- Auto-sizes font to fit field when size is 0
- Multi-line: word wraps at field width, clips overflow at field height
- Single-line: clips horizontal overflow
- Comb fields: positions each character in equally-spaced cells

```typescript
generateTextAppearance(field: TextField, widget: WidgetAnnotation): PdfStream
```

**Comb field handling:**
- Detect comb flag from `/Ff`
- Calculate cell width: `fieldWidth / maxLength`
- Center each character horizontally in its cell
- Draw cell dividers if field has visible border

### Checkbox

Generates two appearance states using ZapfDingbats (standard PDF font, always available):

- `/Yes` or `/On`: Checkmark character (U+2714 ✔) from ZapfDingbats
- `/Off`: Empty (no content, just background if specified)

```typescript
generateCheckboxAppearance(field: CheckboxField, widget: WidgetAnnotation): {
  on: PdfStream;
  off: PdfStream;
}
```

### Radio Button

Similar to checkbox but with circle symbols:

- `/value`: Filled circle (ZapfDingbats bullet ●)
- `/Off`: Empty circle outline

```typescript
generateRadioAppearance(field: RadioField, widget: WidgetAnnotation, value: string): {
  selected: PdfStream;
  off: PdfStream;
}
```

### Dropdown

Shows selected value in collapsed state:

- Single line of text (selected option's display value)
- Uses field's font for text
- Parses `/MK` for highlight color, falls back to standard blue (#0066CC)
- Selection background drawn behind text

```typescript
generateDropdownAppearance(field: DropdownField, widget: WidgetAnnotation): PdfStream
```

### List Box

Shows multiple options with selection highlighting:

- Multiple lines of text (visible options)
- Selected items have highlight background from `/MK` or default blue
- Clips to field bounds (PDF viewer handles scrolling)

```typescript
generateListBoxAppearance(field: ListBoxField, widget: WidgetAnnotation): PdfStream
```

### Button

Shows caption text centered (normal state only):

- Text from `/CA` (caption) entry
- Centered horizontally and vertically
- Only generates `/N` (normal) appearance
- Rollover (`/R`) and down (`/D`) states not generated

```typescript
generateButtonAppearance(field: ButtonField, widget: WidgetAnnotation): PdfStream
```

## Border and Background Rendering

Borders and backgrounds are rendered **only if explicitly set** in the field's `/MK` dictionary:

- `/BG` (background color): Draw filled rectangle behind content
- `/BC` (border color): Draw stroked rectangle
- `/W` (border width): Line width for border

If `/MK` is absent or doesn't specify these values, no border/background is drawn — the appearance contains only the content (text, checkmark, etc.).

## Read-Only Field Handling

When regenerating appearances (during `updateAppearances()` or `flatten()`):

- **Regular fields**: Appearance regenerated with new font
- **Read-only fields**: Keep existing appearance, skip regeneration

This preserves intentionally locked field appearances while updating editable fields.

## RTL Text Handling

Right-to-left text (Arabic, Hebrew) is **not supported** without HarfBuzz integration:

- RTL characters will render left-to-right (incorrect but predictable)
- Proper RTL support requires HarfBuzz from Plan 020
- Document this limitation clearly in API docs

## Error Handling

**Fail-fast strategy** for encoding errors:

```typescript
// Throws immediately if font can't encode character
field.setFont(latinFont);
field.setValue("Hello 世界");  // Throws: "Font cannot encode character '世' (U+4E16)"
```

For bulk operations like `form.fill()`, the first encoding failure throws. User fixes that field and retries.

Future enhancement: Font stacks for automatic fallback to alternative fonts.

## PDF Structure

### Field with Custom Font

```
Field Dictionary
├── /T (Name)
├── /FT /Tx (Text field)
├── /V (Hello 世界)           ← Unicode text (searchable)
├── /DA (/MyFont 12 Tf 0 g)   ← References font by name
└── /AP
    └── /N → Appearance Stream
        ├── Content: encoded glyph sequence
        └── /Resources
            └── /Font
                └── /MyFont → Font Reference
```

### Form Default Resources

```
AcroForm Dictionary
├── /Fields [...]
├── /DA (/Helv 0 Tf 0 g)      ← Default appearance
└── /DR
    └── /Font
        ├── /Helv → Helvetica (standard)
        ├── /ZaDb → ZapfDingbats (standard)
        └── /F1 → Embedded Font Reference
```

## Implementation Order

1. Add `FormFont` type union and `ExistingFont` wrapper class
2. Add `setFont()` / `setFontSize()` / `setTextColor()` to FormField
3. Add `setDefaultFont()` / `getExistingFont()` to PDFForm
4. Update text field appearance generator:
   - Use real font metrics
   - Support embedded fonts
   - Implement comb field layout
5. Implement checkbox appearance generator (ZapfDingbats)
6. Implement radio button appearance generator
7. Implement dropdown appearance generator (with highlight)
8. Implement list box appearance generator (with highlight)
9. Implement button appearance generator (normal state)
10. Add `font` option to flatten
11. Integration tests with embedded fonts

## Test Plan

### Font Setting
- Set embedded font on text field
- Set existing PDF font on text field
- Set font size (explicit value)
- Set font size to 0 (auto-size)
- Set text color
- Verify DA string updated correctly
- Verify font added to resources

### Default Font
- Set form default font
- Fields without explicit font use default
- Explicit font overrides default
- Default font size inheritance

### Existing Fonts
- `getExistingFont()` finds fonts in /DR
- `getAvailableFonts()` lists all fonts
- Using existing font doesn't duplicate resources

### Text Field Appearance
- Single-line with custom font
- Multi-line with word wrap
- Text overflow clips correctly
- CJK characters render correctly
- Comb field character spacing
- Left/center/right alignment
- Auto font size calculation

### Checkbox/Radio Appearance
- Checkbox checked state (ZapfDingbats checkmark)
- Checkbox unchecked state (empty)
- Radio selected state (filled circle)
- Radio unselected state (empty circle)

### Choice Field Appearance
- Dropdown with selected value
- Dropdown selection highlight color
- List box with multiple items
- List box selection highlight
- Scrollable content clips correctly

### Button Appearance
- Button with text caption
- Caption centered correctly
- Only normal state generated

### Border/Background
- Field with /MK background renders background
- Field with /MK border renders border
- Field without /MK has no border/background

### Read-Only Fields
- Read-only fields keep existing appearance during flatten
- Regular fields regenerated with new font

### Font Subsetting
- setValue tracks glyphs correctly
- Multiple setValue calls accumulate glyphs
- Subset contains only used glyphs after save
- CJK characters included in subset

### Error Cases
- Font can't encode character → throws with details
- Missing font reference → falls back gracefully
- Invalid font size → throws

### Edge Cases
- Empty text value
- Very long text (overflow)
- Very small field (font size limits)
- Field with no existing DA
- Multi-widget field (all widgets updated)

## Dependencies

- Plan 020: Font Embedding (EmbeddedFont class, subsetting)
- Plan 020b: Unified Fonts Module (pdf.fonts.embed)
- Plan 022: Form Writing (setValue infrastructure)
- Plan 023: Form Flattening (flatten infrastructure)

## Design Decisions

1. **Text encoding**: Store Unicode in `/V` for searchability, encode glyphs only in appearance stream.

2. **Font/color separation**: `setFont()` only changes font, preserves existing color. Use `setTextColor()` to change color separately.

3. **Existing font support**: Support both `EmbeddedFont` and `ExistingFont` via `FormFont` union type. Enables using PDF's built-in fonts without re-embedding.

4. **Checkbox rendering**: Use ZapfDingbats (standard PDF font, always available in viewers).

5. **Multi-line overflow**: Word wrap at field width, clip at field height. No shrink-to-fit.

6. **Font metrics**: Always use real font metrics from embedded fonts for accurate layout.

7. **Read-only fields**: Skip regeneration during flatten to preserve locked appearances.

8. **Error handling**: Fail fast on encoding errors. User must ensure font supports all characters.

9. **Font size inheritance**: Use field's existing DA size if non-zero, otherwise fall back to form default or auto-size.

10. **Widget vs field fonts**: Fonts set at field level, apply to all widgets. No per-widget font override.

11. **Selection highlight**: Parse `/MK` for highlight color, fall back to standard blue (#0066CC).

12. **Comb fields**: Full support with character cell positioning and dividers.

13. **Button states**: Generate normal state only, skip rollover/down.

14. **Border/background**: Render only if explicitly set in `/MK`.

15. **RTL text**: Not supported without HarfBuzz. Document limitation.

16. **Subsetting timing**: Collect glyphs throughout lifetime, finalize subset at `pdf.save()`.
