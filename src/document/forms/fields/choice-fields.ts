/**
 * Choice fields: Dropdown and ListBox.
 *
 * PDF Reference: Section 12.7.4.4 "Choice Fields"
 */

import { PdfArray } from "#src/objects/pdf-array";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfString } from "#src/objects/pdf-string";

import { TerminalField } from "./base";
import { type ChoiceOption, FieldFlags } from "./types";

/**
 * Parse /Opt array for choice fields.
 */
function parseChoiceOptions(
  opt: ReturnType<import("#src/objects/pdf-dict").PdfDict["getArray"]>,
): ChoiceOption[] {
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

/**
 * Dropdown (combo box) field.
 */
export class DropdownField extends TerminalField {
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
   * This method is async because it regenerates the field's appearance
   * stream after setting the value.
   *
   * @param value The value to select
   * @throws {Error} if field is read-only or value is invalid (for non-editable dropdowns)
   */
  async setValue(value: string): Promise<void> {
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

    // Regenerate appearance immediately
    await this.applyChange();
  }
}

/**
 * List box field.
 */
export class ListBoxField extends TerminalField {
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
   * Get the top index (first visible option when scrolled).
   * The /TI entry specifies the index of the first option visible at the top.
   * Defaults to 0 (first option).
   */
  getTopIndex(): number {
    return this.dict.getNumber("TI")?.value ?? 0;
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
   * This method is async because it regenerates the field's appearance
   * stream after setting the value.
   *
   * @param values Array of values to select
   * @throws {Error} if field is read-only, multiple selection not allowed, or values are invalid
   */
  async setValue(values: string[]): Promise<void> {
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

    // Regenerate appearance immediately
    await this.applyChange();
  }
}
