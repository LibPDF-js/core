/**
 * Checkbox field (single or group).
 *
 * PDF Reference: Section 12.7.4.2 "Button Fields"
 */

import { PdfName } from "#src/objects/pdf-name";

import { TerminalField } from "./base";

/**
 * Checkbox field (single or group).
 */
export class CheckboxField extends TerminalField {
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
  async check(): Promise<void> {
    await this.setValue(this.getOnValue());
  }

  /**
   * Uncheck the checkbox (sets to "Off").
   */
  async uncheck(): Promise<void> {
    await this.setValue("Off");
  }

  /**
   * Set the checkbox value.
   *
   * This method is async because it regenerates the field's appearance
   * stream after setting the value.
   *
   * @param value "Off" or one of the on-values
   * @throws {Error} if field is read-only or value is invalid
   */
  async setValue(value: string): Promise<void> {
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

    // Regenerate appearance immediately
    await this.applyChange();
  }
}
