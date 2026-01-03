/**
 * PDFForm - High-level API for form operations on a PDF document.
 *
 * Provides functionality for reading, filling, and flattening interactive forms.
 * Accessed via `await pdf.getForm()` (lazy-loaded on first call).
 *
 * **Design Note**: PDFForm caches all fields during construction to enable
 * synchronous field access. This means:
 * - Field lookups are O(1) after initial load
 * - Memory usage is proportional to field count
 * - Call `reloadFields()` if the form structure changes externally
 *
 * @example
 * ```typescript
 * const pdf = await PDF.load(bytes);
 * const form = await pdf.getForm();
 *
 * if (form) {
 *   // Type-safe field access
 *   const name = form.getTextField("name");
 *   const agree = form.getCheckbox("terms");
 *
 *   name?.setValue("John Doe");
 *   agree?.check();
 *
 *   // Or fill multiple at once (lenient - ignores missing fields)
 *   form.fill({
 *     email: "john@example.com",
 *     country: "USA",
 *     nonexistent: "ignored",
 *   });
 *
 *   // Flatten and save
 *   await form.flatten();
 *   const bytes = await pdf.save();
 * }
 * ```
 */

import { AcroForm, type FlattenOptions } from "#src/document/acro-form";
import {
  type ButtonField,
  type CheckboxField,
  type DropdownField,
  type FormField,
  type ListBoxField,
  type RadioField,
  type SignatureField,
  TerminalField,
  type TextField,
} from "#src/document/form-field";
import type { ObjectRegistry } from "#src/document/object-registry";
import type { PageTree } from "#src/document/page-tree";
import type { PDFCatalog } from "#src/document/pdf-catalog";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Text alignment constants for form fields.
 */
export const TextAlignment = {
  Left: 0,
  Center: 1,
  Right: 2,
} as const;

export type TextAlignment = (typeof TextAlignment)[keyof typeof TextAlignment];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Field value types that can be set via fill().
 */
export type FieldValue = string | boolean | string[] | null;

/**
 * Form-level properties.
 */
export interface FormProperties {
  /** Default appearance string for text fields */
  defaultAppearance: string;
  /** Default text alignment */
  defaultAlignment: TextAlignment;
  /** Whether viewer should generate appearances */
  needAppearances: boolean;
  /** Whether the form contains signatures */
  hasSignatures: boolean;
  /** Whether the document is append-only (signed) */
  isAppendOnly: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// PDFForm
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PDFForm manages interactive forms for a PDF document.
 *
 * Instances are created automatically during `PDF.load()`.
 */
export class PDFForm {
  private readonly _acroForm: AcroForm;
  private readonly _catalog: PDFCatalog;
  private fieldsByName: Map<string, FormField>;
  private allFields: FormField[];

  private constructor(acroForm: AcroForm, catalog: PDFCatalog, fields: FormField[]) {
    this._acroForm = acroForm;
    this._catalog = catalog;
    this.allFields = fields;
    this.fieldsByName = new Map(fields.map(f => [f.name, f]));
  }

  /**
   * Load and create a PDFForm instance.
   *
   * @internal Called by `PDF.load()`.
   * @param registry The object registry
   * @param catalog The PDF catalog
   * @param pageTree The page tree for efficient page lookups during flattening
   * @returns PDFForm instance, or null if no form exists
   */
  static async load(
    registry: ObjectRegistry,
    catalog: PDFCatalog,
    pageTree: PageTree,
  ): Promise<PDFForm | null> {
    const acroForm = await AcroForm.load(catalog.getDict(), registry, pageTree);
    if (!acroForm) return null;

    const fields = await acroForm.getFields();
    return new PDFForm(acroForm, catalog, fields);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Field Access (Sync)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get all form fields.
   */
  getFields(): FormField[] {
    return [...this.allFields];
  }

  /**
   * Get the names of all fields.
   */
  getFieldNames(): string[] {
    return [...this.fieldsByName.keys()];
  }

  /**
   * Get a field by name (untyped).
   *
   * For type-safe access, prefer `getTextField()`, `getCheckbox()`, etc.
   */
  getField(name: string): FormField | undefined {
    return this.fieldsByName.get(name);
  }

  /**
   * Get a text field by name.
   *
   * @returns The text field, or undefined if not found or wrong type
   */
  getTextField(name: string): TextField | undefined {
    const field = this.fieldsByName.get(name);

    return field?.type === "text" ? (field as TextField) : undefined;
  }

  /**
   * Get a checkbox field by name.
   *
   * @returns The checkbox field, or undefined if not found or wrong type
   */
  getCheckbox(name: string): CheckboxField | undefined {
    const field = this.fieldsByName.get(name);
    return field?.type === "checkbox" ? (field as CheckboxField) : undefined;
  }

  /**
   * Get a radio button group by name.
   *
   * @returns The radio field, or undefined if not found or wrong type
   */
  getRadioGroup(name: string): RadioField | undefined {
    const field = this.fieldsByName.get(name);
    return field?.type === "radio" ? (field as RadioField) : undefined;
  }

  /**
   * Get a dropdown (combo box) field by name.
   *
   * @returns The dropdown field, or undefined if not found or wrong type
   */
  getDropdown(name: string): DropdownField | undefined {
    const field = this.fieldsByName.get(name);
    return field?.type === "dropdown" ? (field as DropdownField) : undefined;
  }

  /**
   * Get a list box field by name.
   *
   * @returns The list box field, or undefined if not found or wrong type
   */
  getListBox(name: string): ListBoxField | undefined {
    const field = this.fieldsByName.get(name);
    return field?.type === "listbox" ? (field as ListBoxField) : undefined;
  }

  /**
   * Get a signature field by name.
   *
   * @returns The signature field, or undefined if not found or wrong type
   */
  getSignatureField(name: string): SignatureField | undefined {
    const field = this.fieldsByName.get(name);
    return field?.type === "signature" ? (field as SignatureField) : undefined;
  }

  /**
   * Get a button field by name.
   *
   * @returns The button field, or undefined if not found or wrong type
   */
  getButton(name: string): ButtonField | undefined {
    const field = this.fieldsByName.get(name);
    return field?.type === "button" ? (field as ButtonField) : undefined;
  }

  /**
   * Check if a field exists.
   */
  hasField(name: string): boolean {
    return this.fieldsByName.has(name);
  }

  /**
   * Get all text fields.
   */
  getTextFields(): TextField[] {
    return this.allFields.filter(f => f.type === "text") as TextField[];
  }

  /**
   * Get all checkboxes.
   */
  getCheckboxes(): CheckboxField[] {
    return this.allFields.filter(f => f.type === "checkbox") as CheckboxField[];
  }

  /**
   * Get all radio button groups.
   */
  getRadioGroups(): RadioField[] {
    return this.allFields.filter(f => f.type === "radio") as RadioField[];
  }

  /**
   * Get all dropdowns.
   */
  getDropdowns(): DropdownField[] {
    return this.allFields.filter(f => f.type === "dropdown") as DropdownField[];
  }

  /**
   * Get all list boxes.
   */
  getListBoxes(): ListBoxField[] {
    return this.allFields.filter(f => f.type === "listbox") as ListBoxField[];
  }

  /**
   * Get all signature fields.
   */
  getSignatureFields(): SignatureField[] {
    return this.allFields.filter(f => f.type === "signature") as SignatureField[];
  }

  /**
   * Get all buttons.
   */
  getButtons(): ButtonField[] {
    return this.allFields.filter(f => f.type === "button") as ButtonField[];
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Bulk Operations
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Fill multiple fields at once.
   *
   * This method is **lenient**: fields that don't exist are silently ignored.
   * Type mismatches will still throw errors.
   *
   * @param values Object mapping field names to values
   * @returns Object with `filled` (successful) and `skipped` (missing) field names
   *
   * @example
   * ```typescript
   * const result = pdf.form.fill({
   *   name: "John Doe",
   *   email: "john@example.com",
   *   agree: true,
   *   nonexistent: "ignored",
   * });
   * // result.filled: ["name", "email", "agree"]
   * // result.skipped: ["nonexistent"]
   * ```
   */
  fill(values: Record<string, FieldValue>): { filled: string[]; skipped: string[] } {
    const filled: string[] = [];
    const skipped: string[] = [];

    for (const [name, value] of Object.entries(values)) {
      const field = this.fieldsByName.get(name);

      if (!field) {
        skipped.push(name);

        continue;
      }

      this.setFieldValue(field, value);

      filled.push(name);
    }

    return { filled, skipped };
  }

  /**
   * Reset all fields to their default values.
   */
  resetAll(): void {
    for (const field of this.allFields) {
      if (field instanceof TerminalField) {
        field.resetValue();
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Form Properties
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get form-level properties.
   */
  get properties(): FormProperties {
    return {
      defaultAppearance: this._acroForm.defaultAppearance,
      defaultAlignment: this._acroForm.defaultQuadding as TextAlignment,
      needAppearances: this._acroForm.needAppearances,
      hasSignatures: this._acroForm.hasSignatures,
      isAppendOnly: this._acroForm.isAppendOnly,
    };
  }

  /**
   * Check if any field has been modified and needs appearance update.
   */
  get hasUnsavedChanges(): boolean {
    return this.allFields.some(f => f instanceof TerminalField && f.needsAppearanceUpdate);
  }

  /**
   * Number of fields in the form.
   */
  get fieldCount(): number {
    return this.allFields.length;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Async Operations
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Reload fields from the underlying AcroForm.
   *
   * Call this if the form structure has been modified externally
   * (e.g., fields added or removed via low-level API).
   */
  async reloadFields(): Promise<void> {
    const fields = await this._acroForm.getFields();

    this.allFields = fields;
    this.fieldsByName = new Map(fields.map(f => [f.name, f]));
  }

  /**
   * Update appearance streams for all modified fields.
   *
   * This regenerates the visual appearance of fields whose values have changed.
   * Called automatically during `flatten()`.
   */
  async updateAppearances(): Promise<void> {
    await this._acroForm.updateAppearances();
  }

  /**
   * Flatten all form fields into static page content.
   *
   * After flattening:
   * - Field appearances are drawn directly in page content
   * - Widget annotations are removed from pages
   * - The form structure is cleared (no more editable fields)
   *
   * **Warning**: This operation is irreversible. The form can no longer be edited.
   *
   * @param options Flattening options
   *
   * @example
   * ```typescript
   * pdf.form.fill({ name: "John", email: "john@example.com" });
   * await pdf.form.flatten();
   * const bytes = await pdf.save();
   * ```
   */
  async flatten(options: FlattenOptions = {}): Promise<void> {
    await this._acroForm.flatten(options);

    // Remove AcroForm from catalog to fully eliminate form interactivity
    this._catalog.removeAcroForm();

    // Clear cached fields since form is now empty
    this.allFields = [];
    this.fieldsByName.clear();
  }

  /**
   * Get the underlying AcroForm for low-level operations.
   *
   * Use this when you need direct access to the form dictionary or
   * AcroForm-specific features not exposed by PDFForm.
   *
   * @example
   * ```typescript
   * const acroForm = form.acroForm();
   * console.log(acroForm.defaultAppearance);
   * console.log(acroForm.signatureFlags);
   * ```
   */
  acroForm(): AcroForm {
    return this._acroForm;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Internal
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Set a field's value with type checking.
   */
  private setFieldValue(field: FormField, value: FieldValue): void {
    switch (field.type) {
      case "text":
        if (typeof value !== "string") {
          throw new TypeError(
            `Text field "${field.name}" requires string value, got ${typeof value}`,
          );
        }

        (field as TextField).setValue(value);
        break;

      case "checkbox":
        if (typeof value === "boolean") {
          if (value) {
            (field as CheckboxField).check();
          } else {
            (field as CheckboxField).uncheck();
          }
        } else if (typeof value === "string") {
          (field as CheckboxField).setValue(value);
        } else {
          throw new TypeError(`Checkbox "${field.name}" requires boolean or string value`);
        }
        break;

      case "radio":
        if (typeof value !== "string" && value !== null) {
          throw new TypeError(`Radio field "${field.name}" requires string or null value`);
        }

        (field as RadioField).setValue(value);
        break;

      case "dropdown":
        if (typeof value !== "string") {
          throw new TypeError(`Dropdown "${field.name}" requires string value`);
        }

        (field as DropdownField).setValue(value);
        break;

      case "listbox":
        if (!Array.isArray(value)) {
          throw new TypeError(`Listbox "${field.name}" requires string[] value`);
        }

        (field as ListBoxField).setValue(value);
        break;

      case "signature":
      case "button":
        throw new Error(`Cannot set value on ${field.type} field "${field.name}"`);

      default:
        throw new Error(`Unknown field type for "${field.name}"`);
    }
  }
}
