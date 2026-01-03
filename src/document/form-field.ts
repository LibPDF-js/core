/**
 * Form field classes for reading and writing AcroForm fields.
 *
 * Provides access to field properties and values, and methods
 * to modify field values.
 *
 * PDF Reference: Section 12.7 "Interactive Forms"
 */

import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import type { PdfObject } from "#src/objects/pdf-object";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfString } from "#src/objects/pdf-string";
import type { ObjectRegistry } from "./object-registry";
import { WidgetAnnotation } from "./widget-annotation";

// Forward declaration - AcroForm will be imported where needed
export interface AcroFormLike {
  defaultQuadding: number;
}

/**
 * Field type identifiers.
 */
export type FieldType =
  | "text"
  | "checkbox"
  | "radio"
  | "dropdown"
  | "listbox"
  | "signature"
  | "button"
  | "unknown";

/**
 * Field flags from PDF spec Table 221.
 */
export const FieldFlags = {
  // Common flags (bits 1-3)
  READ_ONLY: 1 << 0,
  REQUIRED: 1 << 1,
  NO_EXPORT: 1 << 2,

  // Text field flags (bits 13-26)
  MULTILINE: 1 << 12,
  PASSWORD: 1 << 13,
  FILE_SELECT: 1 << 20,
  DO_NOT_SPELL_CHECK: 1 << 22,
  DO_NOT_SCROLL: 1 << 23,
  COMB: 1 << 24,
  RICH_TEXT: 1 << 25,

  // Button field flags (bits 15-17, 26)
  NO_TOGGLE_TO_OFF: 1 << 14,
  RADIO: 1 << 15,
  PUSHBUTTON: 1 << 16,
  RADIOS_IN_UNISON: 1 << 25, // Same bit as RICH_TEXT, different field type
  // Choice field flags (bits 18-27)
  COMBO: 1 << 17,
  EDIT: 1 << 18,
  SORT: 1 << 19,
  MULTI_SELECT: 1 << 21,
  COMMIT_ON_SEL_CHANGE: 1 << 26,
} as const;

/**
 * Base class for all form fields.
 */
export abstract class FormField {
  protected readonly dict: PdfDict;
  protected readonly ref: PdfRef | null;
  protected readonly registry: ObjectRegistry;
  protected readonly acroForm: AcroFormLike;

  /** Fully-qualified field name (e.g., "person.name.first") */
  readonly name: string;

  /**
   * Whether the field value has changed and needs appearance update.
   * Set to true by setValue(), cleared by updateAppearance().
   */
  needsAppearanceUpdate = false;

  constructor(
    dict: PdfDict,
    ref: PdfRef | null,
    registry: ObjectRegistry,
    acroForm: AcroFormLike,
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
    return this.dict.getString("T")?.asString() ?? "";
  }

  /** Alternate field name (/TU) for tooltips */
  get alternateName(): string | null {
    return this.dict.getString("TU")?.asString() ?? null;
  }

  /** Mapping name (/TM) for export */
  get mappingName(): string | null {
    return this.dict.getString("TM")?.asString() ?? null;
  }

  /** Field flags (combined /Ff value) */
  get flags(): number {
    return this.getInheritableNumber("Ff");
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
   * Get the underlying field dictionary for low-level access.
   *
   * Use this when you need to read or modify field properties
   * not exposed by the high-level API.
   *
   * @example
   * ```typescript
   * const fieldDict = field.acroField();
   * fieldDict.set("TU", PdfString.fromString("Custom tooltip"));
   * ```
   */
  acroField(): PdfDict {
    return this.dict;
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

    if (!kids) {
      return [];
    }

    const widgets: WidgetAnnotation[] = [];

    for (let i = 0; i < kids.length; i++) {
      const item = kids.at(i);
      const ref = item instanceof PdfRef ? item : null;
      const widgetDict = ref ? this.registry.getObject(ref) : item;

      if (widgetDict instanceof PdfDict) {
        widgets.push(new WidgetAnnotation(widgetDict, ref, this.registry));
      }
    }

    return widgets;
  }

  /**
   * Get inheritable attribute, walking parent chain.
   */
  protected getInheritable(key: string): PdfObject | null {
    let current: PdfDict | null = this.dict;
    const visited = new Set<PdfDict>();

    while (current) {
      if (visited.has(current)) {
        break;
      }

      visited.add(current);

      const value = current.get(key);

      if (value !== undefined) {
        // Resolve refs
        if (value instanceof PdfRef) {
          return this.registry.getObject(value);
        }

        return value;
      }

      const parentRef = current.getRef("Parent");

      if (!parentRef) {
        break;
      }

      current = this.registry.getObject(parentRef) as PdfDict | null;
    }

    return null;
  }

  /**
   * Get inheritable number (e.g., /Ff, /Q).
   */
  protected getInheritableNumber(key: string): number {
    const value = this.getInheritable(key);

    if (value?.type === "number") {
      return value.value;
    }

    return 0;
  }

  /**
   * Get inheritable string (for /FT).
   */
  protected getInheritableName(key: string): string | null {
    const value = this.getInheritable(key);

    if (value instanceof PdfName) {
      return value.value;
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

  /**
   * Reset field to its default value.
   */
  resetValue(): void {
    const dv = this.getInheritable("DV");

    if (dv) {
      this.dict.set("V", dv);
    } else {
      this.dict.delete("V");
    }

    this.needsAppearanceUpdate = true;
  }

  /**
   * Check read-only and throw if set.
   */
  protected assertWritable(): void {
    if (this.isReadOnly()) {
      throw new Error(`Field "${this.name}" is read-only`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Field Type Classes
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Text input field.
 */
export class TextField extends FormField {
  readonly type = "text" as const;

  /** Maximum character length (0 = no limit) */
  get maxLength(): number {
    return this.dict.getNumber("MaxLen")?.value ?? 0;
  }

  /** Whether this is a multiline text field */
  get isMultiline(): boolean {
    return (this.flags & FieldFlags.MULTILINE) !== 0;
  }

  /** Whether this is a password field (masked input) */
  get isPassword(): boolean {
    return (this.flags & FieldFlags.PASSWORD) !== 0;
  }

  /** Whether this is a comb field (fixed-width character cells) */
  get isComb(): boolean {
    return (this.flags & FieldFlags.COMB) !== 0;
  }

  /** Whether this field supports rich text */
  get isRichText(): boolean {
    return (this.flags & FieldFlags.RICH_TEXT) !== 0;
  }

  /** Whether this is a file select field */
  get isFileSelect(): boolean {
    return (this.flags & FieldFlags.FILE_SELECT) !== 0;
  }

  /** Text alignment (0=left, 1=center, 2=right) */
  get alignment(): number {
    const q = this.getInheritableNumber("Q");

    return q !== 0 ? q : this.acroForm.defaultQuadding;
  }

  /** Default appearance string */
  get defaultAppearance(): string | null {
    const da = this.getInheritable("DA");

    if (da instanceof PdfString) {
      return da.asString();
    }

    return null;
  }

  /**
   * Get current text value.
   */
  getValue(): string {
    const v = this.getInheritable("V");

    if (!v) {
      return "";
    }

    if (v instanceof PdfString) {
      return v.asString();
    }

    return "";
  }

  /**
   * Get default value.
   */
  getDefaultValue(): string {
    const dv = this.getInheritable("DV");

    if (!dv) {
      return "";
    }

    if (dv instanceof PdfString) {
      return dv.asString();
    }

    return "";
  }

  /**
   * Set the text value.
   *
   * @param value The new text value
   * @throws Error if field is read-only
   */
  setValue(value: string): void {
    this.assertWritable();

    // Truncate if maxLength is set
    const finalValue = this.maxLength > 0 ? value.slice(0, this.maxLength) : value;

    // Set /V on field dict
    this.dict.set("V", PdfString.fromString(finalValue));
    this.needsAppearanceUpdate = true;
  }
}

/**
 * Checkbox field (single or group).
 */
export class CheckboxField extends FormField {
  readonly type = "checkbox" as const;

  /**
   * Whether this checkbox is part of a group.
   * A group has multiple widgets with distinct on-values.
   */
  get isGroup(): boolean {
    const onValues = this.getOnValues();

    return onValues.length > 1;
  }

  /**
   * Get all "on" values from widgets.
   * Single checkbox: one value (e.g., "Yes")
   * Group: multiple values (e.g., "Option1", "Option2")
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
   * Returns the on-value or "Off".
   */
  getValue(): string {
    const v = this.getInheritable("V");

    if (v instanceof PdfName) {
      return v.value;
    }

    return "Off";
  }

  /**
   * Check if currently checked.
   */
  isChecked(): boolean {
    const value = this.getValue();

    return value !== "Off";
  }

  /**
   * Check the checkbox (sets to the on-value).
   */
  check(): void {
    this.setValue(this.getOnValue());
  }

  /**
   * Uncheck the checkbox (sets to "Off").
   */
  uncheck(): void {
    this.setValue("Off");
  }

  /**
   * Set the checkbox value.
   *
   * @param value "Off" or one of the on-values
   * @throws Error if field is read-only or value is invalid
   */
  setValue(value: string): void {
    this.assertWritable();

    // Validate value
    if (value !== "Off" && !this.getOnValues().includes(value)) {
      throw new Error(`Invalid value "${value}" for checkbox "${this.name}"`);
    }

    // Set /V on field
    this.dict.set("V", PdfName.of(value));

    // Update /AS on each widget
    for (const widget of this.getWidgets()) {
      const widgetOnValue = widget.getOnValue();
      const state = widgetOnValue === value ? value : "Off";

      widget.setAppearanceState(state);
    }

    this.needsAppearanceUpdate = true;
  }
}

/**
 * Radio button group.
 */
export class RadioField extends FormField {
  readonly type = "radio" as const;

  /**
   * Whether toggling off is prevented.
   * When true, exactly one option must always be selected.
   */
  get noToggleToOff(): boolean {
    return (this.flags & FieldFlags.NO_TOGGLE_TO_OFF) !== 0;
  }

  /**
   * Whether radios in unison is set.
   * When true, selecting one option selects all with same value.
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
   * Get current selected value, or null if none selected.
   */
  getValue(): string | null {
    const v = this.getInheritable("V");

    if (v instanceof PdfName) {
      const value = v.value;

      return value === "Off" ? null : value;
    }

    return null;
  }

  /**
   * Select an option.
   *
   * @param option One of getOptions() or null to deselect
   * @throws Error if field is read-only, option is invalid, or deselection not allowed
   */
  setValue(option: string | null): void {
    this.assertWritable();

    let value: string;

    if (option === null) {
      if (this.noToggleToOff) {
        throw new Error(`Field "${this.name}" cannot be deselected (noToggleToOff is set)`);
      }
      value = "Off";
    } else {
      // Validate
      if (!this.getOptions().includes(option)) {
        throw new Error(`Invalid option "${option}" for radio "${this.name}"`);
      }
      value = option;
    }

    // Set /V
    this.dict.set("V", PdfName.of(value));

    // Update /AS on each widget
    for (const widget of this.getWidgets()) {
      const widgetOption = widget.getOnValue();
      const state = widgetOption === value ? value : "Off";

      widget.setAppearanceState(state);
    }

    this.needsAppearanceUpdate = true;
  }
}

/**
 * Choice option with export value and display text.
 */
export interface ChoiceOption {
  /** Export value (used in form data) */
  value: string;
  /** Display text (shown to user) */
  display: string;
}

/**
 * Dropdown (combo box) field.
 */
export class DropdownField extends FormField {
  readonly type = "dropdown" as const;

  /**
   * Whether user can type custom values.
   */
  get isEditable(): boolean {
    return (this.flags & FieldFlags.EDIT) !== 0;
  }

  /**
   * Whether options are sorted.
   */
  get isSorted(): boolean {
    return (this.flags & FieldFlags.SORT) !== 0;
  }

  /**
   * Whether to commit on selection change.
   */
  get commitOnSelChange(): boolean {
    return (this.flags & FieldFlags.COMMIT_ON_SEL_CHANGE) !== 0;
  }

  /**
   * Get available options.
   */
  getOptions(): ChoiceOption[] {
    return parseChoiceOptions(this.dict.getArray("Opt"));
  }

  /**
   * Get current value.
   */
  getValue(): string {
    const v = this.getInheritable("V");

    if (!v) {
      return "";
    }

    if (v instanceof PdfString) {
      return v.asString();
    }

    if (v instanceof PdfName) {
      return v.value;
    }

    return "";
  }

  /**
   * Get default value.
   */
  getDefaultValue(): string {
    const dv = this.getInheritable("DV");

    if (!dv) {
      return "";
    }

    if (dv instanceof PdfString) {
      return dv.asString();
    }

    if (dv instanceof PdfName) {
      return dv.value;
    }

    return "";
  }

  /**
   * Set the dropdown value.
   *
   * @param value The value to select
   * @throws Error if field is read-only or value is invalid (for non-editable dropdowns)
   */
  setValue(value: string): void {
    this.assertWritable();

    // Validate (unless editable)
    if (!this.isEditable) {
      const options = this.getOptions();

      if (!options.some(o => o.value === value)) {
        throw new Error(`Invalid value "${value}" for dropdown "${this.name}"`);
      }
    }

    this.dict.set("V", PdfString.fromString(value));
    this.needsAppearanceUpdate = true;
  }
}

/**
 * List box field.
 */
export class ListBoxField extends FormField {
  readonly type = "listbox" as const;

  /**
   * Whether multiple selection is allowed.
   */
  get isMultiSelect(): boolean {
    return (this.flags & FieldFlags.MULTI_SELECT) !== 0;
  }

  /**
   * Whether options are sorted.
   */
  get isSorted(): boolean {
    return (this.flags & FieldFlags.SORT) !== 0;
  }

  /**
   * Whether to commit on selection change.
   */
  get commitOnSelChange(): boolean {
    return (this.flags & FieldFlags.COMMIT_ON_SEL_CHANGE) !== 0;
  }

  /**
   * Get available options.
   */
  getOptions(): ChoiceOption[] {
    return parseChoiceOptions(this.dict.getArray("Opt"));
  }

  /**
   * Get selected values.
   * For multi-select, checks /I (indices) first, then /V.
   */
  getValue(): string[] {
    // /I (selection indices) takes precedence for multi-select
    const indices = this.dict.getArray("I");

    if (indices && indices.length > 0) {
      const options = this.getOptions();
      const result: string[] = [];

      for (let i = 0; i < indices.length; i++) {
        const idx = indices.at(i);

        if (idx?.type === "number") {
          const optIdx = idx.value;

          if (optIdx >= 0 && optIdx < options.length) {
            result.push(options[optIdx].value);
          }
        }
      }

      return result;
    }

    // Fall back to /V
    const v = this.getInheritable("V");

    if (!v) {
      return [];
    }

    if (v instanceof PdfArray) {
      const result: string[] = [];

      for (let i = 0; i < v.length; i++) {
        const item = v.at(i);

        if (item instanceof PdfString) {
          result.push(item.asString());
        } else if (item instanceof PdfName) {
          result.push(item.value);
        }
      }

      return result;
    }

    if (v instanceof PdfString) {
      return [v.asString()];
    }

    if (v instanceof PdfName) {
      return [v.value];
    }

    return [];
  }

  /**
   * Set the selected values.
   *
   * @param values Array of values to select
   * @throws Error if field is read-only, multiple selection not allowed, or values are invalid
   */
  setValue(values: string[]): void {
    this.assertWritable();

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
      this.dict.set("V", PdfString.fromString(values[0]));
    } else {
      this.dict.set("V", PdfArray.of(...values.map(v => PdfString.fromString(v))));
    }

    // Set /I (indices) for multi-select
    if (this.isMultiSelect) {
      const indices = values
        .map(v => options.findIndex(o => o.value === v))
        .filter(i => i >= 0)
        .sort((a, b) => a - b);

      if (indices.length > 0) {
        this.dict.set("I", PdfArray.of(...indices.map(i => PdfNumber.of(i))));
      } else {
        this.dict.delete("I");
      }
    }

    this.needsAppearanceUpdate = true;
  }
}

/**
 * Signature field.
 */
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

    if (!v) {
      return null;
    }

    if (v instanceof PdfRef) {
      const resolved = this.registry.getObject(v);

      return resolved instanceof PdfDict ? resolved : null;
    }

    return v instanceof PdfDict ? v : null;
  }

  /**
   * Signature fields don't have simple values.
   */
  getValue(): null {
    return null;
  }
}

/**
 * Push button field.
 */
export class ButtonField extends FormField {
  readonly type = "button" as const;

  /**
   * Push buttons don't have values.
   */
  getValue(): null {
    return null;
  }
}

/**
 * Unknown field type.
 */
export class UnknownField extends FormField {
  readonly type = "unknown" as const;

  getValue(): unknown {
    return this.getInheritable("V") ?? null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Create a FormField instance based on /FT and /Ff.
 */
export function createFormField(
  dict: PdfDict,
  ref: PdfRef | null,
  registry: ObjectRegistry,
  acroForm: AcroFormLike,
  name: string,
): FormField {
  const ft = getInheritableFieldName(dict, "FT", registry);
  const ff = getInheritableFieldNumber(dict, "Ff", registry);

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

/**
 * Get inheritable name value from field hierarchy.
 */
function getInheritableFieldName(
  dict: PdfDict,
  key: string,
  registry: ObjectRegistry,
): string | null {
  let current: PdfDict | null = dict;
  const visited = new Set<PdfDict>();

  while (current) {
    if (visited.has(current)) {
      break;
    }

    visited.add(current);

    const value = current.get(key);

    if (value instanceof PdfName) {
      return value.value;
    }

    const parentRef = current.getRef("Parent");

    if (!parentRef) {
      break;
    }

    current = registry.getObject(parentRef) as PdfDict | null;
  }

  return null;
}

/**
 * Get inheritable number value from field hierarchy.
 */
function getInheritableFieldNumber(dict: PdfDict, key: string, registry: ObjectRegistry): number {
  let current: PdfDict | null = dict;
  const visited = new Set<PdfDict>();

  while (current) {
    if (visited.has(current)) {
      break;
    }
    visited.add(current);

    const value = current.get(key);

    if (value?.type === "number") {
      return value.value;
    }

    const parentRef = current.getRef("Parent");

    if (!parentRef) {
      break;
    }
    current = registry.getObject(parentRef) as PdfDict | null;
  }

  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Parse /Opt array for choice fields.
 */
function parseChoiceOptions(opt: ReturnType<PdfDict["getArray"]>): ChoiceOption[] {
  if (!opt) {
    return [];
  }

  const options: ChoiceOption[] = [];

  for (let i = 0; i < opt.length; i++) {
    const item = opt.at(i);

    if (item instanceof PdfArray && item.length >= 2) {
      // [exportValue, displayText] pair
      const exportVal = item.at(0);
      const displayVal = item.at(1);

      options.push({
        value:
          exportVal instanceof PdfString ? exportVal.asString() : (exportVal?.toString() ?? ""),
        display:
          displayVal instanceof PdfString ? displayVal.asString() : (displayVal?.toString() ?? ""),
      });
    } else if (item instanceof PdfString) {
      // Simple string - same value and display
      const text = item.asString();
      options.push({ value: text, display: text });
    } else if (item instanceof PdfName) {
      // Name as option
      const text = item.value;
      options.push({ value: text, display: text });
    }
  }

  return options;
}
