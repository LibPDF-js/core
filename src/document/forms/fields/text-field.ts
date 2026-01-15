/**
 * Text input field.
 *
 * PDF Reference: Section 12.7.4.3 "Text Fields"
 */

import { PdfString } from "#src/objects/pdf-string";

import { TerminalField } from "./base";
import { FieldFlags } from "./types";

/**
 * Text input field.
 */
export class TextField extends TerminalField {
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
   * This method is async because it regenerates the field's appearance
   * stream after setting the value.
   *
   * @param value The new text value
   * @throws {Error} if field is read-only
   */
  async setValue(value: string): Promise<void> {
    this.assertWritable();

    // Truncate if maxLength is set
    const finalValue = this.maxLength > 0 ? value.slice(0, this.maxLength) : value;

    // Set /V on field dict
    this.dict.set("V", PdfString.fromString(finalValue));
    this.needsAppearanceUpdate = true;

    // Regenerate appearance immediately
    await this.applyChange();
  }
}
