# Plan 018: Form Reading

## Overview

Implement read-only AcroForm support: loading the form structure, traversing the field tree, and reading field values. This is the foundation for form filling (017c) and flattening (017d).

## Scope

- Load AcroForm dictionary from Catalog
- Parse field tree (including hierarchical fields)
- Detect field types from `/FT` and `/Ff` flags
- Read current values from all field types
- Access widget annotations

**Not in scope**: Setting values, generating appearances, flattening (see 017c, 017d).

## PDF Structure

### AcroForm Dictionary

```
Catalog
  └── /AcroForm <<
        /Fields [ref1, ref2, ...]      % Root field array
        /NeedAppearances true|false    % Viewer generates appearances?
        /DR << /Font << ... >> >>      % Default resources
        /DA (/Helv 0 Tf 0 g)           % Default appearance string
        /Q 0                           % Default quadding (alignment)
        /SigFlags 0                    % Signature flags
      >>
```

### Field Dictionary

```
Field <<
  /FT /Tx|/Btn|/Ch|/Sig        % Field type (inheritable)
  /T (FieldName)                % Partial field name
  /TU (Tooltip)                 % User-friendly name
  /TM (MappingName)             % Export name
  /Ff 0                         % Field flags (inheritable)
  /V (value)                    % Current value (inheritable)
  /DV (default)                 % Default value
  /DA (/Helv 12 Tf 0 g)        % Default appearance (inheritable)
  /Q 0|1|2                      % Quadding (inheritable)
  /MaxLen 100                   % Max length (text only)
  /Opt [...]                    % Options (choice fields)
  /Parent ref                   % Parent field
  /Kids [...]                   % Child fields or widgets
>>
```

### Field Types

| /FT | /Ff Flags           | Class          | Description                |
| --- | ------------------- | -------------- | -------------------------- |
| Tx  | -                   | TextField      | Text input                 |
| Tx  | MULTILINE (bit 13)  | TextField      | Multiline text             |
| Tx  | PASSWORD (bit 14)   | TextField      | Password (masked)          |
| Tx  | COMB (bit 25)       | TextField      | Fixed-width cells          |
| Btn | -                   | CheckboxField  | Checkbox (single or group) |
| Btn | RADIO (bit 16)      | RadioField     | Radio button group         |
| Btn | PUSHBUTTON (bit 17) | ButtonField    | Push button                |
| Ch  | COMBO (bit 18)      | DropdownField  | Dropdown/combo box         |
| Ch  | -                   | ListBoxField   | List box                   |
| Sig | -                   | SignatureField | Signature field            |

## Class Design

### AcroForm

```typescript
// src/document/acro-form.ts

export class AcroForm {
  private readonly dict: PdfDict;
  private readonly registry: ObjectRegistry;
  private fieldsCache: FormField[] | null = null;

  private constructor(dict: PdfDict, registry: ObjectRegistry) {
    this.dict = dict;
    this.registry = registry;
  }

  /**
   * Load AcroForm from catalog.
   * Returns null if no AcroForm present.
   */
  static load(catalog: PdfDict, registry: ObjectRegistry): AcroForm | null {
    const acroFormRef = catalog.get("AcroForm");
    if (!acroFormRef) return null;

    const dict = registry.resolve(acroFormRef) as PdfDict;
    if (!dict) return null;

    return new AcroForm(dict, registry);
  }

  /** Default resources (fonts, etc.) */
  get defaultResources(): PdfDict | null {
    return this.dict.getDict("DR");
  }

  /** Default appearance string */
  get defaultAppearance(): string {
    return this.dict.getString("DA") ?? "/Helv 0 Tf 0 g";
  }

  /** Default quadding (0=left, 1=center, 2=right) */
  get defaultQuadding(): number {
    return this.dict.getNumber("Q")?.value ?? 0;
  }

  /** Whether viewer should generate appearances */
  get needAppearances(): boolean {
    return this.dict.getBool("NeedAppearances")?.value ?? false;
  }

  /** Signature flags */
  get signatureFlags(): number {
    return this.dict.getNumber("SigFlags")?.value ?? 0;
  }

  /**
   * Get all terminal fields (flattened).
   * Non-terminal fields (containers) are not included.
   */
  getFields(): FormField[] {
    if (this.fieldsCache) return this.fieldsCache;

    const fieldsArray = this.dict.getArray("Fields");
    if (!fieldsArray) return [];

    const visited = new Set<string>();
    const fields = this.collectFields(fieldsArray, visited, "");

    this.fieldsCache = fields;
    return fields;
  }

  /**
   * Get field by fully-qualified name.
   * Returns null if not found.
   */
  getField(name: string): FormField | null {
    return this.getFields().find(f => f.name === name) ?? null;
  }

  /**
   * Get all fields of a specific type.
   */
  getFieldsOfType<T extends FormField>(type: FieldType): T[] {
    return this.getFields().filter(f => f.type === type) as T[];
  }

  /**
   * Get the underlying dictionary.
   */
  getDict(): PdfDict {
    return this.dict;
  }

  private collectFields(kids: PdfArray, visited: Set<string>, parentName: string): FormField[] {
    const fields: FormField[] = [];

    for (const item of kids) {
      const ref = item instanceof PdfRef ? item : null;
      const refKey = ref?.toString() ?? "";

      if (refKey && visited.has(refKey)) {
        console.warn(`Circular reference in form: ${refKey}`);
        continue;
      }
      if (refKey) visited.add(refKey);

      const dict = this.registry.resolve(item) as PdfDict;
      if (!dict) continue;

      // Build fully-qualified name
      const partialName = dict.getString("T") ?? "";
      const fullName = parentName
        ? partialName
          ? `${parentName}.${partialName}`
          : parentName
        : partialName;

      // Check if terminal or non-terminal
      if (this.isTerminalField(dict)) {
        const field = FormFieldFactory.create(dict, ref, this.registry, this, fullName);
        fields.push(field);
      } else {
        // Non-terminal: recurse into children
        const childKids = dict.getArray("Kids");
        if (childKids) {
          fields.push(...this.collectFields(childKids, visited, fullName));
        }
      }
    }

    return fields;
  }

  private isTerminalField(dict: PdfDict): boolean {
    const kids = dict.getArray("Kids");
    if (!kids || kids.length === 0) return true;

    // If first kid has /T, these are child fields (non-terminal)
    // If first kid has no /T, these are widgets (terminal)
    const firstKid = this.registry.resolve(kids.get(0)) as PdfDict;
    return !firstKid?.has("T");
  }
}

export type FieldType =
  | "text"
  | "checkbox"
  | "radio"
  | "dropdown"
  | "listbox"
  | "signature"
  | "button"
  | "unknown";
```

### FormField Base Class

```typescript
// src/document/form-field.ts

export abstract class FormField {
  protected readonly dict: PdfDict;
  protected readonly ref: PdfRef | null;
  protected readonly registry: ObjectRegistry;
  protected readonly acroForm: AcroForm;

  /** Fully-qualified field name */
  readonly name: string;

  constructor(
    dict: PdfDict,
    ref: PdfRef | null,
    registry: ObjectRegistry,
    acroForm: AcroForm,
    name: string,
  ) {
    this.dict = dict;
    this.ref = ref;
    this.registry = registry;
    this.acroForm = acroForm;
    this.name = name;
  }

  /** Field type identifier */
  abstract readonly type: FieldType;

  /** Partial field name (just /T value) */
  get partialName(): string {
    return this.dict.getString("T") ?? "";
  }

  /** Alternate field name (/TU) for tooltips */
  get alternateName(): string | null {
    return this.dict.getString("TU") ?? null;
  }

  /** Mapping name (/TM) for export */
  get mappingName(): string | null {
    return this.dict.getString("TM") ?? null;
  }

  /** Field flags */
  get flags(): number {
    return this.getInheritable<PdfNumber>("Ff")?.value ?? 0;
  }

  /** Check if read-only */
  isReadOnly(): boolean {
    return (this.flags & FieldFlags.READ_ONLY) !== 0;
  }

  /** Check if required */
  isRequired(): boolean {
    return (this.flags & FieldFlags.REQUIRED) !== 0;
  }

  /** Check if should not be exported */
  isNoExport(): boolean {
    return (this.flags & FieldFlags.NO_EXPORT) !== 0;
  }

  /**
   * Get all widget annotations for this field.
   */
  getWidgets(): WidgetAnnotation[] {
    // If field has /Rect, it's merged with its widget
    if (this.dict.has("Rect")) {
      return [new WidgetAnnotation(this.dict, this.ref, this.registry)];
    }

    // Otherwise, /Kids contains widgets
    const kids = this.dict.getArray("Kids");
    if (!kids) return [];

    const widgets: WidgetAnnotation[] = [];
    for (const item of kids) {
      const ref = item instanceof PdfRef ? item : null;
      const widgetDict = this.registry.resolve(item) as PdfDict;
      if (widgetDict) {
        widgets.push(new WidgetAnnotation(widgetDict, ref, this.registry));
      }
    }
    return widgets;
  }

  /**
   * Get inheritable attribute, walking parent chain.
   */
  protected getInheritable<T extends PdfObject>(key: string): T | null {
    let current: PdfDict | null = this.dict;
    const visited = new Set<string>();

    while (current) {
      const id = current.toString();
      if (visited.has(id)) break;
      visited.add(id);

      const value = current.get(key);
      if (value !== undefined) {
        return this.registry.resolve(value) as T;
      }

      const parentRef = current.get("Parent");
      if (!parentRef) break;
      current = this.registry.resolve(parentRef) as PdfDict | null;
    }

    return null;
  }

  /**
   * Get the underlying dictionary.
   */
  getDict(): PdfDict {
    return this.dict;
  }

  /**
   * Get the object reference (if any).
   */
  getRef(): PdfRef | null {
    return this.ref;
  }

  /**
   * Get current value (type depends on field type).
   */
  abstract getValue(): unknown;
}

/** Field flags from PDF spec Table 221 */
export const FieldFlags = {
  READ_ONLY: 1 << 0,
  REQUIRED: 1 << 1,
  NO_EXPORT: 1 << 2,
  MULTILINE: 1 << 12,
  PASSWORD: 1 << 13,
  NO_TOGGLE_TO_OFF: 1 << 14,
  RADIO: 1 << 15,
  PUSHBUTTON: 1 << 16,
  COMBO: 1 << 17,
  EDIT: 1 << 18,
  SORT: 1 << 19,
  FILE_SELECT: 1 << 20,
  MULTI_SELECT: 1 << 21,
  DO_NOT_SPELL_CHECK: 1 << 22,
  DO_NOT_SCROLL: 1 << 23,
  COMB: 1 << 24,
  RICH_TEXT: 1 << 25,
  RADIOS_IN_UNISON: 1 << 25, // Same bit as RICH_TEXT, different field type
  COMMIT_ON_SEL_CHANGE: 1 << 26,
} as const;
```

### Field Type Classes

```typescript
// src/document/form-field.ts (continued)

export class TextField extends FormField {
  readonly type = "text" as const;

  get maxLength(): number {
    return this.dict.getNumber("MaxLen")?.value ?? 0;
  }

  get isMultiline(): boolean {
    return (this.flags & FieldFlags.MULTILINE) !== 0;
  }

  get isPassword(): boolean {
    return (this.flags & FieldFlags.PASSWORD) !== 0;
  }

  get isComb(): boolean {
    return (this.flags & FieldFlags.COMB) !== 0;
  }

  get isRichText(): boolean {
    return (this.flags & FieldFlags.RICH_TEXT) !== 0;
  }

  /** Text alignment (0=left, 1=center, 2=right) */
  get alignment(): number {
    return this.getInheritable<PdfNumber>("Q")?.value ?? this.acroForm.defaultQuadding;
  }

  getValue(): string {
    const v = this.getInheritable<PdfObject>("V");
    if (!v) return "";
    if (v instanceof PdfString) return v.decodeText();
    return v.toString();
  }

  getDefaultValue(): string {
    const dv = this.getInheritable<PdfObject>("DV");
    if (!dv) return "";
    if (dv instanceof PdfString) return dv.decodeText();
    return dv.toString();
  }
}

export class CheckboxField extends FormField {
  readonly type = "checkbox" as const;

  /**
   * Whether this is a checkbox group (multiple widgets with distinct values).
   */
  get isGroup(): boolean {
    const onValues = this.getOnValues();
    return onValues.length > 1;
  }

  /**
   * Get all "on" values from widgets.
   * Single checkbox: one value (e.g., "Yes")
   * Group: multiple values (e.g., "Option1", "Option2", "Option3")
   */
  getOnValues(): string[] {
    const values = new Set<string>();

    for (const widget of this.getWidgets()) {
      const onValue = widget.getOnValue();
      if (onValue && onValue !== "Off") {
        values.add(onValue);
      }
    }

    return Array.from(values);
  }

  /**
   * Get the primary "on" value (for single checkboxes).
   */
  getOnValue(): string {
    return this.getOnValues()[0] ?? "Yes";
  }

  /**
   * Get current value.
   * For single checkbox: the on-value or "Off"
   * For group: one of the on-values or "Off"
   */
  getValue(): string {
    const v = this.getInheritable<PdfName>("V");
    return v?.name ?? "Off";
  }

  /**
   * Check if currently checked (single checkbox).
   */
  isChecked(): boolean {
    const value = this.getValue();
    return value !== "Off";
  }
}

export class RadioField extends FormField {
  readonly type = "radio" as const;

  /**
   * Whether toggling off is prevented.
   */
  get noToggleToOff(): boolean {
    return (this.flags & FieldFlags.NO_TOGGLE_TO_OFF) !== 0;
  }

  /**
   * Whether radios in unison is set.
   */
  get radiosInUnison(): boolean {
    return (this.flags & FieldFlags.RADIOS_IN_UNISON) !== 0;
  }

  /**
   * Get all available options from widgets.
   */
  getOptions(): string[] {
    const options = new Set<string>();

    for (const widget of this.getWidgets()) {
      const onValue = widget.getOnValue();
      if (onValue && onValue !== "Off") {
        options.add(onValue);
      }
    }

    return Array.from(options);
  }

  /**
   * Get current value (selected option or "Off").
   */
  getValue(): string | null {
    const v = this.getInheritable<PdfName>("V");
    const value = v?.name ?? "Off";
    return value === "Off" ? null : value;
  }
}

export class DropdownField extends FormField {
  readonly type = "dropdown" as const;

  /**
   * Whether user can type custom values.
   */
  get isEditable(): boolean {
    return (this.flags & FieldFlags.EDIT) !== 0;
  }

  /**
   * Get available options.
   * Returns array of {value, display} where value is export value
   * and display is shown to user.
   */
  getOptions(): Array<{ value: string; display: string }> {
    return parseChoiceOptions(this.dict.getArray("Opt"));
  }

  getValue(): string {
    const v = this.getInheritable<PdfObject>("V");
    if (!v) return "";
    if (v instanceof PdfString) return v.decodeText();
    return v.toString();
  }
}

export class ListBoxField extends FormField {
  readonly type = "listbox" as const;

  /**
   * Whether multiple selection is allowed.
   */
  get isMultiSelect(): boolean {
    return (this.flags & FieldFlags.MULTI_SELECT) !== 0;
  }

  /**
   * Get available options.
   */
  getOptions(): Array<{ value: string; display: string }> {
    return parseChoiceOptions(this.dict.getArray("Opt"));
  }

  /**
   * Get selected values.
   * For multi-select, checks /I (indices) first, then /V.
   */
  getValue(): string[] {
    // /I takes precedence for multi-select
    const indices = this.dict.getArray("I");
    if (indices && indices.length > 0) {
      const options = this.getOptions();
      return indices.items
        .map(i => (i as PdfNumber).value)
        .filter(i => i >= 0 && i < options.length)
        .map(i => options[i].value);
    }

    // Fall back to /V
    const v = this.getInheritable<PdfObject>("V");
    if (!v) return [];

    if (v instanceof PdfArray) {
      return v.items.map(item => {
        if (item instanceof PdfString) return item.decodeText();
        return item.toString();
      });
    }

    if (v instanceof PdfString) return [v.decodeText()];
    return [v.toString()];
  }
}

export class SignatureField extends FormField {
  readonly type = "signature" as const;

  /**
   * Check if field has been signed.
   */
  isSigned(): boolean {
    return this.dict.has("V");
  }

  /**
   * Get signature dictionary (if signed).
   */
  getSignatureDict(): PdfDict | null {
    const v = this.dict.get("V");
    if (!v) return null;
    return this.registry.resolve(v) as PdfDict | null;
  }

  getValue(): null {
    return null; // Signatures don't have simple values
  }
}

export class ButtonField extends FormField {
  readonly type = "button" as const;

  getValue(): null {
    return null; // Push buttons don't have values
  }
}

export class UnknownField extends FormField {
  readonly type = "unknown" as const;

  getValue(): unknown {
    return this.getInheritable<PdfObject>("V") ?? null;
  }
}

/** Parse /Opt array for choice fields */
function parseChoiceOptions(opt: PdfArray | null): Array<{ value: string; display: string }> {
  if (!opt) return [];

  return opt.items.map(item => {
    if (item instanceof PdfArray && item.length >= 2) {
      // [exportValue, displayText]
      const exportVal = item.get(0);
      const displayVal = item.get(1);
      return {
        value:
          exportVal instanceof PdfString ? exportVal.decodeText() : (exportVal?.toString() ?? ""),
        display:
          displayVal instanceof PdfString
            ? displayVal.decodeText()
            : (displayVal?.toString() ?? ""),
      };
    }
    // Simple string - same value and display
    const text = item instanceof PdfString ? item.decodeText() : (item?.toString() ?? "");
    return { value: text, display: text };
  });
}
```

### FormFieldFactory

```typescript
// src/document/form-field.ts (continued)

export class FormFieldFactory {
  static create(
    dict: PdfDict,
    ref: PdfRef | null,
    registry: ObjectRegistry,
    acroForm: AcroForm,
    name: string,
  ): FormField {
    const ft = this.getInheritableString(dict, "FT", registry);
    const ff = this.getInheritableNumber(dict, "Ff", registry);

    switch (ft) {
      case "Tx":
        return new TextField(dict, ref, registry, acroForm, name);

      case "Btn":
        if (ff & FieldFlags.PUSHBUTTON) {
          return new ButtonField(dict, ref, registry, acroForm, name);
        }
        if (ff & FieldFlags.RADIO) {
          return new RadioField(dict, ref, registry, acroForm, name);
        }
        return new CheckboxField(dict, ref, registry, acroForm, name);

      case "Ch":
        if (ff & FieldFlags.COMBO) {
          return new DropdownField(dict, ref, registry, acroForm, name);
        }
        return new ListBoxField(dict, ref, registry, acroForm, name);

      case "Sig":
        return new SignatureField(dict, ref, registry, acroForm, name);

      default:
        return new UnknownField(dict, ref, registry, acroForm, name);
    }
  }

  private static getInheritableString(
    dict: PdfDict,
    key: string,
    registry: ObjectRegistry,
  ): string | null {
    let current: PdfDict | null = dict;
    const visited = new Set<string>();

    while (current) {
      const id = current.toString();
      if (visited.has(id)) break;
      visited.add(id);

      const value = current.get(key);
      if (value instanceof PdfName) return value.name;

      const parentRef = current.get("Parent");
      if (!parentRef) break;
      current = registry.resolve(parentRef) as PdfDict | null;
    }

    return null;
  }

  private static getInheritableNumber(
    dict: PdfDict,
    key: string,
    registry: ObjectRegistry,
  ): number {
    let current: PdfDict | null = dict;
    const visited = new Set<string>();

    while (current) {
      const id = current.toString();
      if (visited.has(id)) break;
      visited.add(id);

      const value = current.get(key);
      if (value instanceof PdfNumber) return value.value;

      const parentRef = current.get("Parent");
      if (!parentRef) break;
      current = registry.resolve(parentRef) as PdfDict | null;
    }

    return 0;
  }
}
```

### WidgetAnnotation

```typescript
// src/document/widget-annotation.ts

export class WidgetAnnotation {
  readonly dict: PdfDict;
  readonly ref: PdfRef | null;
  private readonly registry: ObjectRegistry;

  constructor(dict: PdfDict, ref: PdfRef | null, registry: ObjectRegistry) {
    this.dict = dict;
    this.ref = ref;
    this.registry = registry;
  }

  /** Annotation rectangle [x1, y1, x2, y2] */
  get rect(): [number, number, number, number] {
    const arr = this.dict.getArray("Rect");
    if (!arr || arr.length < 4) return [0, 0, 0, 0];
    return [
      (arr.get(0) as PdfNumber)?.value ?? 0,
      (arr.get(1) as PdfNumber)?.value ?? 0,
      (arr.get(2) as PdfNumber)?.value ?? 0,
      (arr.get(3) as PdfNumber)?.value ?? 0,
    ];
  }

  /** Widget width */
  get width(): number {
    const [x1, , x2] = this.rect;
    return Math.abs(x2 - x1);
  }

  /** Widget height */
  get height(): number {
    const [, y1, , y2] = this.rect;
    return Math.abs(y2 - y1);
  }

  /** Page reference (may be null) */
  get pageRef(): PdfRef | null {
    const p = this.dict.get("P");
    return p instanceof PdfRef ? p : null;
  }

  /** Current appearance state (/AS) */
  get appearanceState(): string | null {
    const as = this.dict.get("AS");
    return as instanceof PdfName ? as.name : null;
  }

  /** Rotation from /MK.R (0, 90, 180, 270) */
  get rotation(): number {
    const mk = this.dict.getDict("MK");
    return mk?.getNumber("R")?.value ?? 0;
  }

  /**
   * Get the "on" value for this widget (from AP.N keys).
   */
  getOnValue(): string | null {
    const ap = this.dict.getDict("AP");
    if (!ap) return null;

    const n = ap.get("N");
    if (!n) return null;

    // If N is a dict, find the non-"Off" key
    const nDict = this.registry.resolve(n) as PdfDict;
    if (nDict && !(nDict instanceof PdfStream)) {
      for (const [key] of nDict.entries()) {
        if (key !== "Off") return key;
      }
    }

    return null;
  }

  /**
   * Get normal appearance stream.
   * For stateful widgets, pass the state name.
   */
  getNormalAppearance(state?: string): PdfStream | null {
    const ap = this.dict.getDict("AP");
    if (!ap) return null;

    const n = ap.get("N");
    if (!n) return null;

    const resolved = this.registry.resolve(n);

    // N can be a stream directly or a dict of state -> stream
    if (resolved instanceof PdfStream) {
      return resolved;
    }

    if (resolved instanceof PdfDict) {
      const stateKey = state ?? this.appearanceState ?? "Off";
      const stateStream = resolved.get(stateKey);
      return stateStream ? (this.registry.resolve(stateStream) as PdfStream) : null;
    }

    return null;
  }

  /**
   * Get border style.
   */
  getBorderStyle(): { width: number; style: string } | null {
    const bs = this.dict.getDict("BS");
    if (!bs) return null;

    return {
      width: bs.getNumber("W")?.value ?? 1,
      style: bs.getName("S")?.name ?? "S",
    };
  }

  /**
   * Get appearance characteristics (/MK).
   */
  getAppearanceCharacteristics(): AppearanceCharacteristics | null {
    const mk = this.dict.getDict("MK");
    if (!mk) return null;

    return {
      rotation: mk.getNumber("R")?.value ?? 0,
      borderColor: parseColorArray(mk.getArray("BC")),
      backgroundColor: parseColorArray(mk.getArray("BG")),
      caption: mk.getString("CA") ?? undefined,
    };
  }
}

interface AppearanceCharacteristics {
  rotation: number;
  borderColor?: number[];
  backgroundColor?: number[];
  caption?: string;
}

function parseColorArray(arr: PdfArray | null): number[] | undefined {
  if (!arr || arr.length === 0) return undefined;
  return arr.items.map(n => (n as PdfNumber)?.value ?? 0);
}
```

### PDF API Extension

```typescript
// In src/api/pdf.ts

export class PDF {
  // ... existing ...

  private _form: AcroForm | null | undefined;

  /**
   * Get the document's interactive form.
   * Returns null if the document has no form.
   */
  getForm(): AcroForm | null {
    if (this._form === undefined) {
      this._form = AcroForm.load(this.catalog, this.registry);
    }
    return this._form;
  }

  /**
   * Check if document has an interactive form.
   */
  hasForm(): boolean {
    return this.getForm() !== null;
  }
}
```

## File Structure

```
src/document/
├── acro-form.ts            # AcroForm class
├── acro-form.test.ts
├── form-field.ts           # FormField base, subclasses, factory, flags
├── form-field.test.ts
├── widget-annotation.ts    # WidgetAnnotation class
├── widget-annotation.test.ts
└── index.ts                # Re-exports

src/api/
└── pdf.ts                  # getForm() added
```

## Test Plan

### Loading AcroForm

1. PDF with AcroForm → returns AcroForm instance
2. PDF without AcroForm → returns null
3. AcroForm with /DR → defaultResources accessible
4. AcroForm with /DA → defaultAppearance parsed
5. AcroForm with /NeedAppearances true → flag accessible

### Field Tree Traversal

1. Flat field list → all fields returned
2. Hierarchical fields → fully-qualified names built correctly
3. Merged field/widget → single widget returned
4. Separate field/widgets → multiple widgets returned
5. Circular reference → detected, warned, skipped
6. Empty /Fields → returns empty array

### Field Type Detection

1. /FT Tx → TextField
2. /FT Btn → CheckboxField
3. /FT Btn + RADIO flag → RadioField
4. /FT Btn + PUSHBUTTON flag → ButtonField
5. /FT Ch + COMBO flag → DropdownField
6. /FT Ch → ListBoxField
7. /FT Sig → SignatureField
8. No /FT → UnknownField
9. Inherited /FT from parent → correct type

### Reading Values

#### TextField

1. /V present → returns string
2. /V absent → returns empty string
3. /V with special characters → decoded correctly
4. /DV → getDefaultValue() works

#### CheckboxField

1. /V /Yes → isChecked() true
2. /V /Off → isChecked() false
3. Custom on-value (/V /1) → isChecked() true
4. Group with multiple on-values → getOnValues() returns all
5. Single checkbox → isGroup false
6. Grouped checkbox → isGroup true

#### RadioField

1. /V with option → getValue() returns option
2. /V /Off → getValue() returns null
3. Multiple widgets → getOptions() returns all values

#### DropdownField

1. /V present → getValue() returns selection
2. /Opt with simple strings → getOptions() parses correctly
3. /Opt with [export, display] pairs → both accessible
4. Editable flag → isEditable true

#### ListBoxField

1. Single selection → getValue() returns [value]
2. Multi-select via /V array → getValue() returns all
3. Multi-select via /I indices → getValue() uses indices
4. /I takes precedence over /V

#### SignatureField

1. /V present → isSigned() true
2. /V absent → isSigned() false
3. getSignatureDict() returns dict when signed

### Widget Annotation

1. /Rect parsed → rect, width, height correct
2. /AS present → appearanceState returns value
3. /MK.R present → rotation correct
4. /AP.N stream → getNormalAppearance() returns stream
5. /AP.N dict of states → state lookup works
6. /BS → getBorderStyle() works
7. /MK with colors → getAppearanceCharacteristics() works

### Edge Cases

1. Field name with dots → handled correctly
2. Empty field name → name is empty string
3. Very deep field hierarchy → no stack overflow
4. Widget with no /AP → getNormalAppearance() returns null

## Dependencies

- `ObjectRegistry` for resolving references
- `PdfDict`, `PdfArray`, `PdfName`, `PdfString`, `PdfNumber`, `PdfRef`
- `PdfStream` for appearance streams

## Test Fixtures

Use existing and new fixtures:

- `fixtures/forms/sample_form.pdf` - various field types
- `fixtures/forms/fancy_fields.pdf` - complex fields
- `fixtures/forms/with_combed_fields.pdf` - comb text fields
- `fixtures/basic/SimpleForm2Fields.pdf` - simple text fields
