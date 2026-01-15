/**
 * Appearance stream generation for form fields.
 *
 * This module provides the main AppearanceGenerator class which generates
 * Form XObjects (appearance streams) for all field types. The implementation
 * is split across several modules:
 *
 * - appearance-utils.ts: Shared utilities, types, constants
 * - text-appearance.ts: Text field appearance (single-line, multiline, comb)
 * - button-appearance.ts: Checkbox, radio button, push button
 * - choice-appearance.ts: Dropdown, listbox
 *
 * PDF Reference: Section 12.5.5 "Appearance Streams"
 */

import type { PdfStream } from "#src/objects/pdf-stream";

import type { ObjectRegistry } from "../object-registry";
import type { AcroForm } from "./acro-form";
import type {
  ButtonField,
  CheckboxField,
  DropdownField,
  ListBoxField,
  RadioField,
  TextField,
} from "./fields";
import type { FormFont } from "./form-font";
import type { WidgetAnnotation } from "./widget-annotation";

// Re-export types and utilities for external use
export {
  type ExtractedAppearanceStyle,
  extractAppearanceStyle,
  type FontMetrics,
  type ParsedDA,
  parseDAString,
} from "./appearance-utils";

// Import implementation modules
import type { ExtractedAppearanceStyle } from "./appearance-utils";
import * as ButtonAppearance from "./button-appearance";
import * as ChoiceAppearance from "./choice-appearance";
import * as TextAppearance from "./text-appearance";

/**
 * Generator for form field appearance streams.
 *
 * This class maintains state for font resource naming and delegates
 * to specialized modules for each field type.
 */
export class AppearanceGenerator {
  private readonly acroForm: AcroForm;
  private readonly registry: ObjectRegistry;

  /** Counter for generating unique font names in resources */
  private fontNameCounter = 0;

  /** Map of fonts to their resource names for this generation session */
  private fontResourceNames: Map<FormFont, string> = new Map();

  constructor(acroForm: AcroForm, registry: ObjectRegistry) {
    this.acroForm = acroForm;
    this.registry = registry;
  }

  /**
   * Get the shared context for appearance generation.
   */
  private getContext(): TextAppearance.TextAppearanceContext &
    ButtonAppearance.ButtonAppearanceContext &
    ChoiceAppearance.ChoiceAppearanceContext {
    return {
      acroForm: this.acroForm,
      registry: this.registry,
      fontResourceNames: this.fontResourceNames,
      fontNameCounter: this.fontNameCounter,
    };
  }

  /**
   * Update the font name counter after generation.
   */
  private updateCounter(newCounter: number): void {
    this.fontNameCounter = newCounter;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Text Field
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate appearance stream for a text field widget.
   *
   * @param field The text field
   * @param widget The widget annotation
   * @param existingStyle Optional styling extracted from existing appearance
   */
  generateTextAppearance(
    field: TextField,
    widget: WidgetAnnotation,
    existingStyle?: ExtractedAppearanceStyle,
  ): PdfStream {
    const ctx = this.getContext();

    const result = TextAppearance.generateTextAppearance(ctx, field, widget, existingStyle);

    this.updateCounter(result.fontNameCounter);

    return result.stream;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Checkbox
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate appearance streams for a checkbox.
   */
  generateCheckboxAppearance(
    field: CheckboxField,
    widget: WidgetAnnotation,
    onValue: string,
  ): { on: PdfStream; off: PdfStream } {
    const ctx = this.getContext();
    return ButtonAppearance.generateCheckboxAppearance(ctx, field, widget, onValue);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Radio Button
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate appearance streams for a radio button.
   */
  generateRadioAppearance(
    field: RadioField,
    widget: WidgetAnnotation,
    value: string,
  ): { selected: PdfStream; off: PdfStream } {
    const ctx = this.getContext();

    return ButtonAppearance.generateRadioAppearance(ctx, field, widget, value);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Dropdown
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate appearance stream for a dropdown (combo box).
   */
  generateDropdownAppearance(field: DropdownField, widget: WidgetAnnotation): PdfStream {
    const ctx = this.getContext();

    const result = ChoiceAppearance.generateDropdownAppearance(ctx, field, widget);

    this.updateCounter(result.fontNameCounter);

    return result.stream;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // List Box
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate appearance stream for a list box.
   */
  generateListBoxAppearance(field: ListBoxField, widget: WidgetAnnotation): PdfStream {
    const ctx = this.getContext();

    const result = ChoiceAppearance.generateListBoxAppearance(ctx, field, widget);

    this.updateCounter(result.fontNameCounter);

    return result.stream;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Push Button
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate appearance stream for a push button.
   */
  generateButtonAppearance(field: ButtonField, widget: WidgetAnnotation): PdfStream {
    const ctx = this.getContext();

    const result = ButtonAppearance.generateButtonAppearance(ctx, field, widget);

    this.updateCounter(result.fontNameCounter);

    return result.stream;
  }
}
