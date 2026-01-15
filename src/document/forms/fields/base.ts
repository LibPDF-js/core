/**
 * Base classes for form fields.
 *
 * This module implements a field hierarchy following PDFBox patterns:
 * - FormField: Abstract base for all fields
 * - NonTerminalField: Container fields (no value, just children)
 * - TerminalField: Value-holding fields with widgets
 *
 * PDF Reference: Section 12.7 "Interactive Forms"
 */

import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import type { PdfObject } from "#src/objects/pdf-object";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfString } from "#src/objects/pdf-string";

import type { ObjectRegistry } from "../../object-registry";
import type { FormFont } from "../form-font";
import { WidgetAnnotation } from "../widget-annotation";
import { type AcroFormLike, FieldFlags, type FieldType, type RgbColor } from "./types";

/**
 * Base class for all form fields.
 *
 * This is an abstract base that provides common functionality for both
 * terminal fields (those with values and widgets) and non-terminal fields
 * (those that serve as containers in the field hierarchy).
 */
export abstract class FormField {
  protected readonly dict: PdfDict;
  protected readonly ref: PdfRef | null;
  protected readonly registry: ObjectRegistry;
  protected readonly acroForm: AcroFormLike;

  /** Fully-qualified field name (e.g., "person.name.first") */
  readonly name: string;

  /** Parent field in the hierarchy, null for root fields */
  parent: FormField | null = null;

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
   * For non-terminal fields, this throws an error.
   */
  abstract getValue(): unknown;

  /**
   * Get widget annotations for this field.
   * For non-terminal fields, this returns an empty array.
   */
  abstract getWidgets(): WidgetAnnotation[];

  /**
   * Default appearance string (/DA).
   *
   * Format: "/FontName fontSize Tf [colorArgs] colorOp"
   * Example: "/Helv 12 Tf 0 g"
   */
  get defaultAppearance(): string | null {
    const da = this.getInheritable("DA");

    if (da instanceof PdfString) {
      return da.asString();
    }

    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Non-Terminal Field (Container)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A non-terminal field is a container in the field hierarchy.
 *
 * Non-terminal fields:
 * - Have child fields (other fields with /Parent pointing to this)
 * - Do NOT have a value (/V)
 * - Do NOT have widgets
 *
 * They exist purely to organize the field tree structure.
 */
export class NonTerminalField extends FormField {
  readonly type = "non-terminal" as const;

  private _children: FormField[] = [];

  /**
   * Non-terminal fields don't have values.
   * @throws {Error} always - non-terminal fields don't hold values
   */
  getValue(): never {
    throw new Error(`Non-terminal field "${this.name}" does not have a value`);
  }

  /**
   * Non-terminal fields don't have widgets.
   * @returns Empty array
   */
  getWidgets(): WidgetAnnotation[] {
    return [];
  }

  /**
   * Get child fields of this non-terminal field.
   */
  getChildren(): FormField[] {
    return this._children;
  }

  /**
   * Add a child field (called during field tree construction).
   * @internal
   */
  addChild(field: FormField): void {
    this._children.push(field);
    field.parent = this;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Terminal Field (Value-Holding)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A terminal field holds a value and has widgets.
 *
 * Terminal fields:
 * - Can have a value (/V)
 * - Have one or more widget annotations (visual representations)
 * - Are the actual interactive form elements
 *
 * All specific field types (TextField, CheckboxField, etc.) extend this.
 */
export abstract class TerminalField extends FormField {
  /**
   * Whether the field's appearance needs to be regenerated.
   *
   * This is set to true when font, font size, or text color changes.
   * setValue() automatically regenerates the appearance and clears this flag.
   */
  needsAppearanceUpdate = false;

  /** Custom font set via setFont() */
  protected _font: FormFont | null = null;

  /** Custom font size set via setFontSize() */
  protected _fontSize: number | null = null;

  /** Custom text color set via setTextColor() */
  protected _textColor: RgbColor | null = null;

  /** Cached widgets, populated during field creation */
  private _widgets: WidgetAnnotation[] | null = null;

  // ─────────────────────────────────────────────────────────────────────────────
  // Font and Text Styling
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Set the font for this field.
   *
   * Accepts embedded fonts or existing PDF fonts.
   * Applies to all widgets of this field.
   *
   * @param font The font to use for this field
   */
  setFont(font: FormFont): void {
    this._font = font;
    this.needsAppearanceUpdate = true;
  }

  /**
   * Get the font for this field, or null if using default.
   */
  getFont(): FormFont | null {
    return this._font;
  }

  /**
   * Set the font size in points.
   *
   * Use 0 for auto-size (fit to field).
   *
   * @param size Font size in points (0 = auto)
   * @throws {Error} if size is negative
   */
  setFontSize(size: number): void {
    if (size < 0) {
      throw new Error(`Font size cannot be negative: ${size}`);
    }

    this._fontSize = size;
    this.needsAppearanceUpdate = true;
  }

  /**
   * Get the font size, or null if using default/DA value.
   */
  getFontSize(): number | null {
    return this._fontSize;
  }

  /**
   * Set text color as RGB values (0-1 range).
   *
   * @param r Red component (0-1)
   * @param g Green component (0-1)
   * @param b Blue component (0-1)
   * @throws {Error} if values are out of range
   */
  setTextColor(r: number, g: number, b: number): void {
    if (r < 0 || r > 1 || g < 0 || g > 1 || b < 0 || b > 1) {
      throw new Error(`Color values must be between 0 and 1: (${r}, ${g}, ${b})`);
    }

    this._textColor = { r, g, b };
    this.needsAppearanceUpdate = true;
  }

  /**
   * Get text color, or null if using existing DA color.
   */
  getTextColor(): RgbColor | null {
    return this._textColor;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Widget Management
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get all widget annotations for this field.
   *
   * Widgets are resolved and cached during field creation (in AcroForm.getFields()),
   * so this method is synchronous and always returns all widgets.
   */
  getWidgets(): WidgetAnnotation[] {
    // Return cached widgets if available
    if (this._widgets !== null) {
      return this._widgets;
    }

    // Fallback: build widgets synchronously (may miss unresolved refs)
    // This path is only hit if resolveWidgets() wasn't called during creation
    if (this.dict.has("Rect")) {
      this._widgets = [new WidgetAnnotation(this.dict, this.ref, this.registry)];

      return this._widgets;
    }

    const kids = this.dict.getArray("Kids");

    if (!kids) {
      this._widgets = [];

      return this._widgets;
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

    this._widgets = widgets;

    return this._widgets;
  }

  /**
   * Resolve and cache all widgets for this field.
   *
   * Called during field creation to ensure all widget refs are resolved.
   * After this, getWidgets() will return the complete list synchronously.
   *
   * @internal
   */
  async resolveWidgets(): Promise<void> {
    // If field has /Rect, it's merged with its widget
    if (this.dict.has("Rect")) {
      // Also resolve MK if it's a reference
      await this.resolveMK(this.dict);
      this._widgets = [new WidgetAnnotation(this.dict, this.ref, this.registry)];

      return;
    }

    // Otherwise, /Kids contains widgets
    const kids = this.dict.getArray("Kids");

    if (!kids) {
      this._widgets = [];

      return;
    }

    const widgets: WidgetAnnotation[] = [];

    for (let i = 0; i < kids.length; i++) {
      const item = kids.at(i);
      const ref = item instanceof PdfRef ? item : null;

      let widgetDict: PdfObject | null = null;

      if (ref) {
        widgetDict = await this.registry.resolve(ref);
      } else if (item instanceof PdfDict) {
        widgetDict = item;
      }

      if (widgetDict instanceof PdfDict) {
        // Also resolve MK if it's a reference
        await this.resolveMK(widgetDict);
        widgets.push(new WidgetAnnotation(widgetDict, ref, this.registry));
      }
    }

    this._widgets = widgets;
  }

  /**
   * Resolve MK dictionary if it's a reference.
   * This ensures getAppearanceCharacteristics() can work synchronously.
   */
  private async resolveMK(dict: PdfDict): Promise<void> {
    const mkEntry = dict.get("MK");

    if (mkEntry instanceof PdfRef) {
      await this.registry.resolve(mkEntry);
    }
  }

  /**
   * Add a widget to this field's /Kids array.
   *
   * This is used when creating new fields that use the separate widget model.
   * The widget dict is registered and its ref is added to /Kids.
   *
   * @param widgetDict The widget annotation dictionary
   * @returns The WidgetAnnotation wrapper for the new widget
   */
  addWidget(widgetDict: PdfDict): WidgetAnnotation {
    // Register the widget dict
    const widgetRef = this.registry.register(widgetDict);

    // Ensure /Kids array exists
    let kids = this.dict.getArray("Kids");

    if (!kids) {
      kids = new PdfArray([]);
      this.dict.set("Kids", kids);
    }

    // Add widget ref to /Kids
    kids.push(widgetRef);

    // Create widget annotation and add to cache
    const widget = new WidgetAnnotation(widgetDict, widgetRef, this.registry);

    if (this._widgets === null) {
      this._widgets = [];
    }

    this._widgets.push(widget);

    return widget;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Value Management
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Reset field to its default value.
   *
   * This method is async because it regenerates the field's appearance
   * stream after resetting the value.
   */
  async resetValue(): Promise<void> {
    const dv = this.getInheritable("DV");

    if (dv) {
      this.dict.set("V", dv);
    } else {
      this.dict.delete("V");
    }

    this.needsAppearanceUpdate = true;

    // Regenerate appearance immediately
    await this.applyChange();
  }

  /**
   * Check read-only and throw if set.
   */
  protected assertWritable(): void {
    if (this.isReadOnly()) {
      throw new Error(`Field "${this.name}" is read-only`);
    }
  }

  /**
   * Apply the current value change and regenerate appearances.
   *
   * Called after value modification to update the visual representation.
   * Subclasses should call this from their setValue() methods.
   *
   * @internal
   */
  protected async applyChange(): Promise<void> {
    if (this.acroForm.updateFieldAppearance) {
      await this.acroForm.updateFieldAppearance(this);
    }

    this.needsAppearanceUpdate = false;
  }
}
