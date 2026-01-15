/**
 * Radio button group.
 *
 * PDF Reference: Section 12.7.4.2 "Button Fields"
 */

import { PdfName } from "#src/objects/pdf-name";
import { PdfString } from "#src/objects/pdf-string";

import { TerminalField } from "./base";
import { FieldFlags } from "./types";

/**
 * Radio button group.
 */
export class RadioField extends TerminalField {
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
   * Get export values from /Opt array.
   *
   * Radio buttons can have an /Opt array that provides export values
   * that are different from the widget appearance state names.
   */
  getExportValues(): string[] {
    const opt = this.dict.getArray("Opt");

    if (!opt) {
      // Fall back to widget on-values
      return this.getOptions();
    }

    const values: string[] = [];

    for (let i = 0; i < opt.length; i++) {
      const item = opt.at(i);

      if (item instanceof PdfString) {
        values.push(item.asString());
      } else if (item instanceof PdfName) {
        values.push(item.value);
      }
    }

    return values;
  }

  /**
   * Select an option.
   *
   * This method is async because it regenerates the field's appearance
   * stream after setting the value.
   *
   * @param option One of getOptions() or null to deselect
   * @throws {Error} if field is read-only, option is invalid, or deselection not allowed
   */
  async setValue(option: string | null): Promise<void> {
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

    // Regenerate appearance immediately
    await this.applyChange();
  }
}
