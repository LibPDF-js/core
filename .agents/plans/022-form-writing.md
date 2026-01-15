# Plan 019: Form Writing & Appearances

## Overview

Implement form field value modification and appearance stream generation. Builds on 017b (reading) and requires 017a (operators).

## Scope

- Set values on all field types
- Generate appearance streams for text fields
- Handle checkbox/radio state changes
- Update dropdown/listbox appearances
- Dirty tracking for selective updates

**Not in scope**: Flattening (see 017d), signature signing, font embedding.

## Prerequisites

- Plan 017a: Content Stream Operators (for appearance generation)
- Plan 017b: Form Reading (field classes)

## Design

### Value Setting

#### TextField

```typescript
// In TextField class

setValue(value: string): void {
  if (this.isReadOnly()) {
    throw new Error(`Field "${this.name}" is read-only`);
  }

  // Truncate if maxLength set
  const finalValue = this.maxLength > 0
    ? value.slice(0, this.maxLength)
    : value;

  // Set /V on field dict
  this.dict.set("V", PdfString.fromText(finalValue));

  // Mark dirty for appearance regeneration
  this.dirty = true;
}
```

#### CheckboxField

```typescript
// In CheckboxField class

/**
 * Check the checkbox (single checkbox).
 */
check(): void {
  this.setValue(this.getOnValue());
}

/**
 * Uncheck the checkbox.
 */
uncheck(): void {
  this.setValue("Off");
}

/**
 * Set value (works for both single and grouped).
 * @param value - "Off" or one of the on-values
 */
setValue(value: string): void {
  if (this.isReadOnly()) {
    throw new Error(`Field "${this.name}" is read-only`);
  }

  // Validate value
  if (value !== "Off" && !this.getOnValues().includes(value)) {
    throw new Error(`Invalid value "${value}" for checkbox "${this.name}"`);
  }

  // Set /V on field
  this.dict.set("V", PdfName.of(value));

  // Update /AS on each widget
  for (const widget of this.getWidgets()) {
    const widgetOnValue = widget.getOnValue();
    const state = (widgetOnValue === value) ? value : "Off";
    widget.setAppearanceState(state);
  }

  this.dirty = true;
}
```

#### RadioField

```typescript
// In RadioField class

/**
 * Select an option.
 * @param option - One of getOptions() or null to deselect
 */
setValue(option: string | null): void {
  if (this.isReadOnly()) {
    throw new Error(`Field "${this.name}" is read-only`);
  }

  if (option === null) {
    if (this.noToggleToOff) {
      throw new Error(`Field "${this.name}" cannot be deselected`);
    }
    option = "Off";
  }

  // Validate
  if (option !== "Off" && !this.getOptions().includes(option)) {
    throw new Error(`Invalid option "${option}" for radio "${this.name}"`);
  }

  // Set /V
  this.dict.set("V", PdfName.of(option));

  // Update /AS on each widget
  for (const widget of this.getWidgets()) {
    const widgetOption = widget.getOnValue();
    const state = (widgetOption === option) ? option : "Off";
    widget.setAppearanceState(state);
  }

  this.dirty = true;
}
```

#### DropdownField

```typescript
// In DropdownField class

setValue(value: string): void {
  if (this.isReadOnly()) {
    throw new Error(`Field "${this.name}" is read-only`);
  }

  // Validate (unless editable)
  if (!this.isEditable) {
    const options = this.getOptions();
    if (!options.some(o => o.value === value)) {
      throw new Error(`Invalid value "${value}" for dropdown "${this.name}"`);
    }
  }

  this.dict.set("V", PdfString.fromText(value));
  this.dirty = true;
}
```

#### ListBoxField

```typescript
// In ListBoxField class

setValue(values: string[]): void {
  if (this.isReadOnly()) {
    throw new Error(`Field "${this.name}" is read-only`);
  }

  if (!this.isMultiSelect && values.length > 1) {
    throw new Error(`Field "${this.name}" does not allow multiple selection`);
  }

  // Validate all values
  const options = this.getOptions();
  for (const v of values) {
    if (!options.some(o => o.value === v)) {
      throw new Error(`Invalid value "${v}" for listbox "${this.name}"`);
    }
  }

  // Set /V
  if (values.length === 0) {
    this.dict.delete("V");
  } else if (values.length === 1) {
    this.dict.set("V", PdfString.fromText(values[0]));
  } else {
    this.dict.set("V", PdfArray.of(values.map(v => PdfString.fromText(v))));
  }

  // Set /I (indices) for multi-select
  if (this.isMultiSelect) {
    const indices = values
      .map(v => options.findIndex(o => o.value === v))
      .filter(i => i >= 0)
      .sort((a, b) => a - b);

    if (indices.length > 0) {
      this.dict.set("I", PdfArray.of(indices.map(PdfNumber.of)));
    } else {
      this.dict.delete("I");
    }
  }

  this.dirty = true;
}
```

### Widget Mutation

```typescript
// In WidgetAnnotation class

/**
 * Set the appearance state (/AS).
 */
setAppearanceState(state: string): void {
  this.dict.set("AS", PdfName.of(state));
}

/**
 * Set the normal appearance stream.
 * For stateful widgets, use state parameter.
 */
setNormalAppearance(stream: PdfStream, state?: string): void {
  let ap = this.dict.getDict("AP");
  if (!ap) {
    ap = new PdfDict();
    this.dict.set("AP", ap);
  }

  if (state) {
    // Stateful: AP.N is a dict of state -> stream
    let n = ap.get("N");
    let nDict: PdfDict;

    if (n instanceof PdfDict) {
      nDict = n;
    } else {
      nDict = new PdfDict();
      ap.set("N", nDict);
    }

    const streamRef = this.registry.register(stream);
    nDict.set(state, streamRef);
  } else {
    // Stateless: AP.N is the stream directly
    const streamRef = this.registry.register(stream);
    ap.set("N", streamRef);
  }
}
```

### Appearance Generation

```typescript
// src/document/appearance-generator.ts

import {
  ContentStreamBuilder,
  beginMarkedContent,
  endMarkedContent,
  pushGraphicsState,
  popGraphicsState,
  rectangle,
  clip,
  endPath,
  beginText,
  endText,
  setFont,
  moveText,
  showText,
  setNonStrokingGray,
  setNonStrokingRGB,
} from "../content";

export class AppearanceGenerator {
  private readonly acroForm: AcroForm;
  private readonly registry: ObjectRegistry;

  constructor(acroForm: AcroForm, registry: ObjectRegistry) {
    this.acroForm = acroForm;
    this.registry = registry;
  }

  /**
   * Generate appearance for a text field.
   */
  generateTextAppearance(field: TextField, widget: WidgetAnnotation): PdfStream {
    const value = field.getValue();
    const { width, height } = widget;

    // Parse default appearance
    const da = this.parseDefaultAppearance(field);

    // Calculate font size (auto-size if 0)
    let fontSize = da.fontSize;
    if (fontSize === 0) {
      fontSize = this.calculateAutoFontSize(value, width, height);
    }

    // Calculate text position
    const { x, y } = this.calculateTextPosition(value, width, height, fontSize, field.alignment);

    // Build content stream
    const content = new ContentStreamBuilder()
      .add(beginMarkedContent("/Tx"))
      .add(pushGraphicsState())
      // Clip to field bounds with small margin
      .add(rectangle(1, 1, width - 2, height - 2))
      .add(clip())
      .add(endPath())
      // Text
      .add(beginText())
      .add(setFont(da.fontName, fontSize))
      .add(...this.colorOperators(da))
      .add(moveText(x, y))
      .add(showText(PdfString.fromText(value)))
      .add(endText())
      .add(popGraphicsState())
      .add(endMarkedContent());

    // Create Form XObject
    return content.toFormXObject([0, 0, width, height], this.buildResources(da.fontName));
  }

  /**
   * Parse /DA string into components.
   */
  private parseDefaultAppearance(field: FormField): ParsedDA {
    const da =
      field.getInheritable<PdfString>("DA")?.decodeText() ?? this.acroForm.defaultAppearance;

    return parseDAString(da);
  }

  /**
   * Calculate font size to fit text in field.
   */
  private calculateAutoFontSize(text: string, width: number, height: number): number {
    const padding = 4;

    // Height-based: fit vertically
    const heightBased = (height - padding) * 0.7;

    // Width-based: approximate (proper would need font metrics)
    // Assume average char width ~0.5 * fontSize
    const avgCharWidth = 0.5;
    const textWidth = text.length * avgCharWidth;
    const widthBased = textWidth > 0 ? (width - padding) / text.length / avgCharWidth : heightBased;

    // Use smaller, with min/max bounds
    return Math.max(4, Math.min(heightBased, widthBased, 14));
  }

  /**
   * Calculate text position based on alignment.
   */
  private calculateTextPosition(
    text: string,
    width: number,
    height: number,
    fontSize: number,
    alignment: number,
  ): { x: number; y: number } {
    const padding = 2;

    // Approximate text width (proper would need font metrics)
    const textWidth = text.length * fontSize * 0.5;

    let x: number;
    switch (alignment) {
      case 1: // center
        x = (width - textWidth) / 2;
        break;
      case 2: // right
        x = width - textWidth - padding;
        break;
      default: // left
        x = padding;
    }

    // Vertical center (approximate baseline)
    const y = (height - fontSize) / 2 + fontSize * 0.2;

    return { x, y };
  }

  /**
   * Build color operators from parsed DA.
   */
  private colorOperators(da: ParsedDA): Operator[] {
    switch (da.colorOp) {
      case "g":
        return [setNonStrokingGray(da.colorArgs[0])];
      case "rg":
        return [setNonStrokingRGB(da.colorArgs[0], da.colorArgs[1], da.colorArgs[2])];
      case "k":
        return [
          setNonStrokingCMYK(da.colorArgs[0], da.colorArgs[1], da.colorArgs[2], da.colorArgs[3]),
        ];
      default:
        return [setNonStrokingGray(0)];
    }
  }

  /**
   * Build resources dict with font reference.
   */
  private buildResources(fontName: string): PdfDict {
    const dr = this.acroForm.defaultResources;
    if (!dr) {
      // Fallback: empty resources
      return new PdfDict();
    }

    // Clone DR or just reference it
    // For now, reference the AcroForm's DR
    return dr;
  }
}

interface ParsedDA {
  fontName: string;
  fontSize: number;
  colorOp: string;
  colorArgs: number[];
}

/**
 * Parse Default Appearance string.
 * Format: "/FontName fontSize Tf [colorArgs] colorOp"
 * Example: "/Helv 12 Tf 0 g" or "/F1 0 Tf 0.5 0.5 0.5 rg"
 */
function parseDAString(da: string): ParsedDA {
  const result: ParsedDA = {
    fontName: "/Helv",
    fontSize: 0,
    colorOp: "g",
    colorArgs: [0],
  };

  // Extract font: /Name size Tf
  const fontMatch = da.match(/\/(\S+)\s+([\d.]+)\s+Tf/);
  if (fontMatch) {
    result.fontName = "/" + fontMatch[1];
    result.fontSize = parseFloat(fontMatch[2]);
  }

  // Extract color: look for g, rg, or k at end
  const grayMatch = da.match(/([\d.]+)\s+g\s*$/);
  if (grayMatch) {
    result.colorOp = "g";
    result.colorArgs = [parseFloat(grayMatch[1])];
    return result;
  }

  const rgbMatch = da.match(/([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+rg\s*$/);
  if (rgbMatch) {
    result.colorOp = "rg";
    result.colorArgs = [parseFloat(rgbMatch[1]), parseFloat(rgbMatch[2]), parseFloat(rgbMatch[3])];
    return result;
  }

  const cmykMatch = da.match(/([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+k\s*$/);
  if (cmykMatch) {
    result.colorOp = "k";
    result.colorArgs = [
      parseFloat(cmykMatch[1]),
      parseFloat(cmykMatch[2]),
      parseFloat(cmykMatch[3]),
      parseFloat(cmykMatch[4]),
    ];
  }

  return result;
}
```

### AcroForm Appearance Update

```typescript
// In AcroForm class

/**
 * Update appearances for all dirty fields.
 */
updateAppearances(): void {
  const generator = new AppearanceGenerator(this, this.registry);

  for (const field of this.getFields()) {
    if (!field.dirty) continue;

    if (field instanceof TextField) {
      for (const widget of field.getWidgets()) {
        const stream = generator.generateTextAppearance(field, widget);
        widget.setNormalAppearance(stream);
      }
    }
    // Checkboxes and radios typically use existing AP states
    // Dropdowns would need their own generator

    field.dirty = false;
  }

  // Clear NeedAppearances flag
  this.dict.delete("NeedAppearances");
}

/**
 * Mark all fields as needing appearance update.
 */
markAllDirty(): void {
  for (const field of this.getFields()) {
    field.dirty = true;
  }
}
```

### FormField Base Updates

```typescript
// In FormField base class

export abstract class FormField {
  // ... existing ...

  /** Whether field value has changed and needs appearance update */
  dirty: boolean = false;

  /**
   * Reset field to default value.
   */
  resetValue(): void {
    const dv = this.getInheritable<PdfObject>("DV");
    if (dv) {
      this.dict.set("V", dv);
    } else {
      this.dict.delete("V");
    }
    this.dirty = true;
  }

  /**
   * Set value (implemented by subclasses).
   */
  abstract setValue(value: unknown): void;
}
```

## Usage Examples

```typescript
const pdf = await PDF.load(bytes);
const form = pdf.getForm()!;

// Fill text fields
const name = form.getField("name") as TextField;
name.setValue("John Doe");

const email = form.getField("email") as TextField;
email.setValue("john@example.com");

// Check a checkbox
const agree = form.getField("agree") as CheckboxField;
agree.check();

// Or for checkbox groups
const option = form.getField("preference") as CheckboxField;
option.setValue("Option2");

// Select radio option
const gender = form.getField("gender") as RadioField;
gender.setValue("male");

// Set dropdown
const country = form.getField("country") as DropdownField;
country.setValue("US");

// Update appearances
form.updateAppearances();

// Save
const output = await pdf.save();
```

## File Structure

```
src/document/
├── acro-form.ts            # + updateAppearances()
├── form-field.ts           # + setValue(), dirty tracking
├── widget-annotation.ts    # + setAppearanceState(), setNormalAppearance()
├── appearance-generator.ts # NEW: appearance stream generation
└── appearance-generator.test.ts
```

## Test Plan

### Value Setting

#### TextField

1. Set simple string value
2. Set value with special characters (Unicode)
3. Set value on read-only field (throws)
4. Set value exceeding maxLength (truncates)
5. Reset to default value

#### CheckboxField

1. check() sets to on-value
2. uncheck() sets to "Off"
3. setValue("Off") unchecks
4. setValue(onValue) checks
5. setValue(invalidValue) throws
6. Grouped checkbox: setValue selects correct widget

#### RadioField

1. setValue(option) selects option
2. setValue(null) deselects (if allowed)
3. setValue(null) throws if noToggleToOff
4. setValue(invalidOption) throws
5. Updates all widget /AS correctly

#### DropdownField

1. setValue(validOption) works
2. setValue(invalidOption) throws (non-editable)
3. setValue(customValue) works (editable)

#### ListBoxField

1. setValue([single]) works
2. setValue([multiple]) works (multi-select)
3. setValue([multiple]) throws (single-select)
4. setValue([invalid]) throws
5. /I indices updated correctly

### Appearance Generation

#### Text Field

1. Simple text renders correctly
2. Empty value renders empty field
3. Auto-sizing calculates reasonable size
4. Left/center/right alignment positions correctly
5. Color from DA applied
6. Clipping to field bounds

#### Widget Updates

1. setAppearanceState changes /AS
2. setNormalAppearance updates /AP.N (stateless)
3. setNormalAppearance updates /AP.N.state (stateful)

### Dirty Tracking

1. setValue marks dirty
2. updateAppearances clears dirty
3. Only dirty fields regenerated
4. markAllDirty marks all fields

### Round-Trip

1. Fill form → save → reload → values preserved
2. Fill form → updateAppearances → save → appearances correct
3. Multiple edits → single updateAppearances

## Edge Cases

1. **No existing AP** - Create new AP dict
2. **Missing /DR** - Use minimal resources
3. **Zero fontSize** - Auto-calculate
4. **Very long text** - Clips to bounds
5. **Empty value** - Renders empty
6. **Unicode text** - Encodes correctly in PdfString

## Limitations (Out of Scope)

1. **Multiline text** - Word wrapping not implemented
2. **Comb fields** - Character spacing not implemented
3. **Rich text** - RTF rendering not implemented
4. **Font metrics** - Using approximations
5. **Font embedding** - Characters must exist in font
6. **Dropdown appearance** - Uses existing or skips

## Dependencies

- Plan 017a: Content Stream Operators
- Plan 017b: Form Reading classes
- `PdfString.fromText()` for proper encoding
- `ObjectRegistry.register()` for stream refs
