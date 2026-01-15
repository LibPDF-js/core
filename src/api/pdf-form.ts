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
 *
 * @example
 * ```typescript
 * const pdf = await PDF.load(bytes);
 * const form = await pdf.getForm();
 *
 * if (form) {
 *   // Type-safe field access (all mutations are async)
 *   const name = form.getTextField("name");
 *   const agree = form.getCheckbox("terms");
 *
 *   await name?.setValue("John Doe");
 *   await agree?.check();
 *
 *   // Or fill multiple at once (lenient - ignores missing fields)
 *   await form.fill({
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

import { AcroForm } from "#src/document/forms/acro-form";
import {
  type ButtonField,
  type CheckboxField,
  createFormField,
  type DropdownField,
  FieldFlags,
  type FormField,
  type ListBoxField,
  type RadioField,
  type SignatureField,
  TerminalField,
  type TextField,
} from "#src/document/forms/fields";
import type { FlattenOptions } from "#src/document/forms/form-flattener";
import type { EmbeddedFont } from "#src/fonts/embedded-font";
import { type Color, colorToArray } from "#src/helpers/colors";
import type { Degrees } from "#src/helpers/rotations";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfString } from "#src/objects/pdf-string";

import type { PDFContext } from "./pdf-context";

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
// Field Creation Options
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checkbox/radio symbol types.
 */
export type CheckboxSymbol = "check" | "cross" | "square";
export type RadioSymbol = "circle" | "check";

/**
 * Common options for all field types.
 */
export interface FieldOptions {
  /** Background color */
  backgroundColor?: Color;
  /** Border color */
  borderColor?: Color;
  /** Border width in points (default: 1) */
  borderWidth?: number;
  /** Rotation angle (0, 90, 180, 270) */
  rotate?: Degrees;
}

/**
 * Options for creating a text field.
 */
export interface TextFieldOptions extends FieldOptions {
  /** Font for text rendering */
  font?: EmbeddedFont;
  /** Font size in points (0 = auto-size) */
  fontSize?: number;
  /** Text color (default: black) */
  color?: Color;
  /** Maximum character length (0 = no limit) */
  maxLength?: number;
  /** Whether this is a multiline field */
  multiline?: boolean;
  /** Whether to mask input (password field) */
  password?: boolean;
  /** Whether to use comb layout (fixed-width character cells) */
  comb?: boolean;
  /** Text alignment (default: Left) */
  alignment?: TextAlignment;
  /** Default value */
  defaultValue?: string;
}

/**
 * Options for creating a checkbox.
 */
export interface CheckboxOptions extends FieldOptions {
  /** Value when checked (default: "Yes") */
  onValue?: string;
  /** Symbol to display when checked (default: "check") */
  symbol?: CheckboxSymbol;
  /** Whether checked by default */
  defaultChecked?: boolean;
}

/**
 * Options for creating a radio button group.
 */
export interface RadioGroupOptions extends FieldOptions {
  /** Available option values (required) */
  options: string[];
  /** Symbol to display when selected (default: "circle") */
  symbol?: RadioSymbol;
  /** Default selected value */
  defaultValue?: string;
}

/**
 * Options for creating a dropdown (combo box).
 */
export interface DropdownOptions extends FieldOptions {
  /** Available options (required) */
  options: string[];
  /** Font for text rendering */
  font?: EmbeddedFont;
  /** Font size in points */
  fontSize?: number;
  /** Text color */
  color?: Color;
  /** Whether user can type custom values */
  editable?: boolean;
  /** Default selected value */
  defaultValue?: string;
}

/**
 * Options for creating a list box.
 */
export interface ListboxOptions extends FieldOptions {
  /** Available options (required) */
  options: string[];
  /** Font for text rendering */
  font?: EmbeddedFont;
  /** Font size in points */
  fontSize?: number;
  /** Text color */
  color?: Color;
  /** Whether multiple selection is allowed */
  multiSelect?: boolean;
  /** Default selected value(s) */
  defaultValue?: string[];
}

/**
 * Options for creating a signature field.
 */
export interface SignatureFieldOptions extends FieldOptions {
  // Signature fields typically don't have styling options since
  // they are usually invisible or show signature appearance after signing.
  // Extend FieldOptions for consistency with border/background.
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
  private readonly _ctx: PDFContext;
  private fieldsByName: Map<string, FormField>;
  private allFields: FormField[];

  private constructor(acroForm: AcroForm, ctx: PDFContext, fields: FormField[]) {
    this._acroForm = acroForm;
    this._ctx = ctx;

    this.allFields = fields;
    this.fieldsByName = new Map(fields.map(f => [f.name, f]));
  }

  /**
   * Load and create a PDFForm instance.
   *
   * @internal Called by `PDF.getForm()`.
   * @param ctx The PDF context
   * @returns PDFForm instance, or null if no form exists
   */
  static async load(ctx: PDFContext): Promise<PDFForm | null> {
    const acroForm = await AcroForm.load(ctx.catalog.getDict(), ctx.registry, ctx.pages);

    if (!acroForm) {
      return null;
    }

    const fields = await acroForm.getFields();

    return new PDFForm(acroForm, ctx, fields);
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
  // Field Creation
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a new signature field.
   *
   * Creates an empty (unsigned) signature field that can later be signed.
   * The field is created with an empty /Kids array. Widget properties
   * (page, rect, etc.) are set by PDFSignature during signing.
   *
   * @param name - Field name (must be unique)
   * @param options - Signature field options
   * @returns The created signature field
   * @throws {Error} If a field with the same name already exists
   *
   * @example
   * ```typescript
   * const form = await pdf.getForm();
   * const sigField = form.createSignatureField("Signature1");
   * // Later: sign the field via PDFSignature
   * ```
   */
  createSignatureField(name: string, options: SignatureFieldOptions = {}): SignatureField {
    this.validateUniqueName(name);

    // Create field dictionary with /Kids array (like other field types)
    // Widget properties are added by PDFSignature during signing
    const fieldDict = PdfDict.of({
      FT: PdfName.of("Sig"),
      T: PdfString.fromString(name),
      Kids: new PdfArray([]),
    });

    // Store styling metadata (even though sig fields are usually invisible)
    this.storeFieldStyling(fieldDict, options);

    // Register the field and add to AcroForm
    const fieldRef = this._ctx.registry.register(fieldDict);
    this._acroForm.addField(fieldRef);

    // Create the SignatureField instance
    const field = createFormField(
      fieldDict,
      fieldRef,
      this._ctx.registry,
      this._acroForm,
      name,
    ) as SignatureField;

    // Add to cache
    this.allFields.push(field);
    this.fieldsByName.set(name, field);

    return field;
  }

  /**
   * Create a new text field.
   *
   * Creates a text field with an empty /Kids array. Use `page.drawField()` to
   * add widgets that place the field on pages.
   *
   * @param name - Field name (must be unique)
   * @param options - Text field options
   * @returns The created text field
   * @throws {Error} If a field with the same name already exists
   *
   * @example
   * ```typescript
   * const nameField = form.createTextField("name", {
   *   fontSize: 12,
   *   maxLength: 100,
   *   defaultValue: "John Doe",
   * });
   *
   * await page.drawField(nameField, { x: 100, y: 700, width: 200, height: 24 });
   * ```
   */
  createTextField(name: string, options: TextFieldOptions = {}): TextField {
    this.validateUniqueName(name);

    // Build field flags
    let flags = 0;

    if (options.multiline) {
      flags |= FieldFlags.MULTILINE;
    }

    if (options.password) {
      flags |= FieldFlags.PASSWORD;
    }

    if (options.comb && options.maxLength && options.maxLength > 0) {
      flags |= FieldFlags.COMB;
    }

    // Build default appearance string
    const da = this.buildDefaultAppearance(options.font, options.fontSize, options.color);

    // Create field dictionary with /Kids array (separate widget model)
    const fieldDict = PdfDict.of({
      FT: PdfName.of("Tx"),
      T: PdfString.fromString(name),
      Kids: new PdfArray([]),
    });

    if (flags !== 0) {
      fieldDict.set("Ff", PdfNumber.of(flags));
    }

    if (da) {
      fieldDict.set("DA", PdfString.fromString(da));
    }

    if (options.alignment !== undefined) {
      fieldDict.set("Q", PdfNumber.of(options.alignment));
    }

    if (options.maxLength !== undefined && options.maxLength > 0) {
      fieldDict.set("MaxLen", PdfNumber.of(options.maxLength));
    }

    if (options.defaultValue !== undefined) {
      fieldDict.set("V", PdfString.fromString(options.defaultValue));
      fieldDict.set("DV", PdfString.fromString(options.defaultValue));
    }

    // Register font in form resources if embedded font provided
    if (options.font) {
      this.registerFontInFormResources(options.font);
    }

    // Register and add to form
    const fieldRef = this._ctx.registry.register(fieldDict);
    this._acroForm.addField(fieldRef);

    // Create the TextField instance
    const field = createFormField(
      fieldDict,
      fieldRef,
      this._ctx.registry,
      this._acroForm,
      name,
    ) as TextField;

    // Apply styling options
    if (options.font) {
      field.setFont(options.font);
    }

    if (options.fontSize !== undefined) {
      field.setFontSize(options.fontSize);
    }

    if (options.color) {
      const [r, g, b] = colorToArray(options.color);
      field.setTextColor(r, g ?? 0, b ?? 0);
    }

    // Store styling metadata
    this.storeFieldStyling(fieldDict, options);

    // Add to cache
    this.allFields.push(field);
    this.fieldsByName.set(name, field);

    return field;
  }

  /**
   * Create a new checkbox field.
   *
   * @param name - Field name (must be unique)
   * @param options - Checkbox options
   * @returns The created checkbox field
   * @throws {Error} If a field with the same name already exists
   *
   * @example
   * ```typescript
   * const agreeCheckbox = form.createCheckbox("agree", {
   *   onValue: "Yes",
   *   symbol: "check",
   *   defaultChecked: true,
   * });
   *
   * await page.drawField(agreeCheckbox, { x: 100, y: 650, width: 18, height: 18 });
   * ```
   */
  createCheckbox(name: string, options: CheckboxOptions = {}): CheckboxField {
    this.validateUniqueName(name);

    const onValue = options.onValue ?? "Yes";
    const isChecked = options.defaultChecked ?? false;

    // Button field type without Radio or Pushbutton flags = checkbox
    // Create field dictionary with /Kids array (separate widget model)
    const fieldDict = PdfDict.of({
      FT: PdfName.of("Btn"),
      T: PdfString.fromString(name),
      Kids: new PdfArray([]),
      V: PdfName.of(isChecked ? onValue : "Off"),
    });

    if (isChecked) {
      fieldDict.set("DV", PdfName.of(onValue));
    }

    // Store symbol preference as metadata on field
    if (options.symbol) {
      // Store in custom key for appearance generation
      fieldDict.set("_Symbol", PdfName.of(options.symbol));
    }

    // Store styling metadata
    this.storeFieldStyling(fieldDict, options);

    // Register and add to form
    const fieldRef = this._ctx.registry.register(fieldDict);
    this._acroForm.addField(fieldRef);

    // Create the CheckboxField instance
    const field = createFormField(
      fieldDict,
      fieldRef,
      this._ctx.registry,
      this._acroForm,
      name,
    ) as CheckboxField;

    // Add to cache
    this.allFields.push(field);
    this.fieldsByName.set(name, field);

    return field;
  }

  /**
   * Create a new radio button group.
   *
   * Radio groups must have at least one option. Each option gets its own widget
   * when you call `page.drawField()` with the `option` parameter.
   *
   * @param name - Field name (must be unique)
   * @param options - Radio group options (options array is required)
   * @returns The created radio field
   * @throws {Error} If a field with the same name already exists
   * @throws {Error} If options array is empty or missing
   *
   * @example
   * ```typescript
   * const paymentRadio = form.createRadioGroup("payment", {
   *   options: ["Credit Card", "PayPal", "Bank Transfer"],
   *   defaultValue: "Credit Card",
   * });
   *
   * // Each option gets its own widget
   * await page.drawField(paymentRadio, { x: 100, y: 550, width: 16, height: 16, option: "Credit Card" });
   * await page.drawField(paymentRadio, { x: 100, y: 520, width: 16, height: 16, option: "PayPal" });
   * await page.drawField(paymentRadio, { x: 100, y: 490, width: 16, height: 16, option: "Bank Transfer" });
   * ```
   */
  createRadioGroup(name: string, options: RadioGroupOptions): RadioField {
    this.validateUniqueName(name);

    if (!options.options || options.options.length === 0) {
      throw new Error("Radio group must have at least one option");
    }

    // Button field type with Radio flag
    const flags = FieldFlags.RADIO;

    const selectedValue = options.defaultValue ?? null;

    // Create field dictionary with /Kids array (separate widget model)
    const fieldDict = PdfDict.of({
      FT: PdfName.of("Btn"),
      T: PdfString.fromString(name),
      Ff: PdfNumber.of(flags),
      Kids: new PdfArray([]),
    });

    if (selectedValue && options.options.includes(selectedValue)) {
      fieldDict.set("V", PdfName.of(selectedValue));
      fieldDict.set("DV", PdfName.of(selectedValue));
    } else {
      fieldDict.set("V", PdfName.of("Off"));
    }

    // Store options for validation in drawField
    fieldDict.set("Opt", PdfArray.of(...options.options.map(o => PdfString.fromString(o))));

    // Store symbol preference
    if (options.symbol) {
      fieldDict.set("_Symbol", PdfName.of(options.symbol));
    }

    // Store styling metadata
    this.storeFieldStyling(fieldDict, options);

    // Register and add to form
    const fieldRef = this._ctx.registry.register(fieldDict);
    this._acroForm.addField(fieldRef);

    // Create the RadioField instance
    const field = createFormField(
      fieldDict,
      fieldRef,
      this._ctx.registry,
      this._acroForm,
      name,
    ) as RadioField;

    // Add to cache
    this.allFields.push(field);
    this.fieldsByName.set(name, field);

    return field;
  }

  /**
   * Create a new dropdown (combo box) field.
   *
   * @param name - Field name (must be unique)
   * @param options - Dropdown options (options array is required)
   * @returns The created dropdown field
   * @throws {Error} If a field with the same name already exists
   * @throws {Error} If options array is empty or missing
   *
   * @example
   * ```typescript
   * const countryDropdown = form.createDropdown("country", {
   *   options: ["USA", "Canada", "UK", "Germany", "France"],
   *   defaultValue: "USA",
   *   fontSize: 11,
   * });
   *
   * await page.drawField(countryDropdown, { x: 100, y: 600, width: 200, height: 24 });
   * ```
   */
  createDropdown(name: string, options: DropdownOptions): DropdownField {
    this.validateUniqueName(name);

    if (!options.options || options.options.length === 0) {
      throw new Error("Dropdown must have at least one option");
    }

    // Choice field type with Combo flag
    let flags = FieldFlags.COMBO;

    if (options.editable) {
      flags |= FieldFlags.EDIT;
    }

    // Build default appearance string
    const da = this.buildDefaultAppearance(options.font, options.fontSize, options.color);

    // Create field dictionary with /Kids array (separate widget model)
    const fieldDict = PdfDict.of({
      FT: PdfName.of("Ch"),
      T: PdfString.fromString(name),
      Ff: PdfNumber.of(flags),
      Kids: new PdfArray([]),
      Opt: PdfArray.of(...options.options.map(o => PdfString.fromString(o))),
    });

    if (da) {
      fieldDict.set("DA", PdfString.fromString(da));
    }

    if (options.defaultValue !== undefined && options.options.includes(options.defaultValue)) {
      fieldDict.set("V", PdfString.fromString(options.defaultValue));
      fieldDict.set("DV", PdfString.fromString(options.defaultValue));
    }

    // Register font in form resources if embedded font provided
    if (options.font) {
      this.registerFontInFormResources(options.font);
    }

    // Store styling metadata
    this.storeFieldStyling(fieldDict, options);

    // Register and add to form
    const fieldRef = this._ctx.registry.register(fieldDict);
    this._acroForm.addField(fieldRef);

    // Create the DropdownField instance
    const field = createFormField(
      fieldDict,
      fieldRef,
      this._ctx.registry,
      this._acroForm,
      name,
    ) as DropdownField;

    // Apply styling options
    if (options.font) {
      field.setFont(options.font);
    }

    if (options.fontSize !== undefined) {
      field.setFontSize(options.fontSize);
    }

    if (options.color) {
      const [r, g, b] = colorToArray(options.color);
      field.setTextColor(r, g ?? 0, b ?? 0);
    }

    // Add to cache
    this.allFields.push(field);
    this.fieldsByName.set(name, field);

    return field;
  }

  /**
   * Create a new list box field.
   *
   * @param name - Field name (must be unique)
   * @param options - Listbox options (options array is required)
   * @returns The created listbox field
   * @throws {Error} If a field with the same name already exists
   * @throws {Error} If options array is empty or missing
   *
   * @example
   * ```typescript
   * const colorListbox = form.createListbox("colors", {
   *   options: ["Red", "Green", "Blue", "Yellow"],
   *   multiSelect: true,
   *   defaultValue: ["Red", "Blue"],
   * });
   *
   * await page.drawField(colorListbox, { x: 100, y: 400, width: 150, height: 100 });
   * ```
   */
  createListbox(name: string, options: ListboxOptions): ListBoxField {
    this.validateUniqueName(name);

    if (!options.options || options.options.length === 0) {
      throw new Error("Listbox must have at least one option");
    }

    // Choice field type without Combo flag = list box
    let flags = 0;

    if (options.multiSelect) {
      flags |= FieldFlags.MULTI_SELECT;
    }

    // Build default appearance string
    const da = this.buildDefaultAppearance(options.font, options.fontSize, options.color);

    // Create field dictionary with /Kids array (separate widget model)
    const fieldDict = PdfDict.of({
      FT: PdfName.of("Ch"),
      T: PdfString.fromString(name),
      Kids: new PdfArray([]),
      Opt: PdfArray.of(...options.options.map(o => PdfString.fromString(o))),
    });

    if (flags !== 0) {
      fieldDict.set("Ff", PdfNumber.of(flags));
    }

    if (da) {
      fieldDict.set("DA", PdfString.fromString(da));
    }

    // Handle default value(s)
    if (options.defaultValue && options.defaultValue.length > 0) {
      const validDefaults = options.defaultValue.filter(v => options.options.includes(v));

      if (validDefaults.length === 1) {
        fieldDict.set("V", PdfString.fromString(validDefaults[0]));
        fieldDict.set("DV", PdfString.fromString(validDefaults[0]));
      } else if (validDefaults.length > 1) {
        fieldDict.set("V", PdfArray.of(...validDefaults.map(v => PdfString.fromString(v))));
        fieldDict.set("DV", PdfArray.of(...validDefaults.map(v => PdfString.fromString(v))));

        // Set /I (selection indices)
        const indices = validDefaults
          .map(v => options.options.indexOf(v))
          .filter(i => i >= 0)
          .sort((a, b) => a - b);
        fieldDict.set("I", PdfArray.of(...indices.map(i => PdfNumber.of(i))));
      }
    }

    // Register font in form resources if embedded font provided
    if (options.font) {
      this.registerFontInFormResources(options.font);
    }

    // Store styling metadata
    this.storeFieldStyling(fieldDict, options);

    // Register and add to form
    const fieldRef = this._ctx.registry.register(fieldDict);
    this._acroForm.addField(fieldRef);

    // Create the ListBoxField instance
    const field = createFormField(
      fieldDict,
      fieldRef,
      this._ctx.registry,
      this._acroForm,
      name,
    ) as ListBoxField;

    // Apply styling options
    if (options.font) {
      field.setFont(options.font);
    }

    if (options.fontSize !== undefined) {
      field.setFontSize(options.fontSize);
    }

    if (options.color) {
      const [r, g, b] = colorToArray(options.color);
      field.setTextColor(r, g ?? 0, b ?? 0);
    }

    // Add to cache
    this.allFields.push(field);
    this.fieldsByName.set(name, field);

    return field;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Field Creation Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Validate that a field name is unique.
   */
  private validateUniqueName(name: string): void {
    if (this.fieldsByName.has(name)) {
      throw new Error(`Field "${name}" already exists`);
    }
  }

  /**
   * Build a default appearance (DA) string for text-based fields.
   */
  private buildDefaultAppearance(
    font?: EmbeddedFont,
    fontSize?: number,
    color?: Color,
  ): string | null {
    const parts: string[] = [];

    // Font and size
    if (font) {
      // Font name will be determined when registered
      parts.push(`/F1 ${fontSize ?? 0} Tf`);
    } else if (fontSize !== undefined) {
      parts.push(`/Helv ${fontSize} Tf`);
    }

    // Color
    if (color) {
      const colorArray = colorToArray(color);

      if (colorArray.length === 1) {
        parts.push(`${colorArray[0]} g`);
      } else if (colorArray.length === 3) {
        parts.push(`${colorArray[0]} ${colorArray[1]} ${colorArray[2]} rg`);
      } else if (colorArray.length === 4) {
        parts.push(`${colorArray[0]} ${colorArray[1]} ${colorArray[2]} ${colorArray[3]} k`);
      }
    } else {
      parts.push("0 g"); // Default to black
    }

    return parts.length > 0 ? parts.join(" ") : null;
  }

  /**
   * Register an embedded font in the form's default resources.
   */
  private registerFontInFormResources(font: EmbeddedFont): void {
    // Prepare the font if not already done
    const ctx = this._ctx;

    // Get or create font reference from PDFFonts
    const fontRef = ctx.registry.register(
      PdfDict.of({
        Type: PdfName.of("Font"),
        Subtype: PdfName.of("Type0"),
        BaseFont: PdfName.of(font.baseFontName),
        Encoding: PdfName.of("Identity-H"),
      }),
    );

    // Add to AcroForm resources
    this._acroForm.addFontToResources(fontRef);
  }

  /**
   * Store field styling metadata for appearance generation.
   */
  private storeFieldStyling(fieldDict: PdfDict, options: FieldOptions): void {
    if (options.backgroundColor) {
      const bg = colorToArray(options.backgroundColor);
      fieldDict.set("_BG", PdfArray.of(...bg.map(v => PdfNumber.of(v))));
    }

    if (options.borderColor) {
      const bc = colorToArray(options.borderColor);
      fieldDict.set("_BC", PdfArray.of(...bc.map(v => PdfNumber.of(v))));
    }

    if (options.borderWidth !== undefined) {
      fieldDict.set("_BW", PdfNumber.of(options.borderWidth));
    }

    if (options.rotate) {
      fieldDict.set("_R", PdfNumber.of(options.rotate.angle));
    }
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
   * @param values - Object mapping field names to values
   * @returns Object with `filled` (successful) and `skipped` (missing) field names
   * @throws {TypeError} If a value type doesn't match the field type
   *
   * @example
   * ```typescript
   * const result = await form.fill({
   *   name: "John Doe",
   *   email: "john@example.com",
   *   agree: true,
   *   nonexistent: "ignored",
   * });
   * // result.filled: ["name", "email", "agree"]
   * // result.skipped: ["nonexistent"]
   * ```
   */
  async fill(values: Record<string, FieldValue>): Promise<{ filled: string[]; skipped: string[] }> {
    const filled: string[] = [];
    const skipped: string[] = [];

    for (const [name, value] of Object.entries(values)) {
      const field = this.fieldsByName.get(name);

      if (!field) {
        skipped.push(name);

        continue;
      }

      await this.setFieldValue(field, value);

      filled.push(name);
    }

    return { filled, skipped };
  }

  /**
   * Reset all fields to their default values.
   */
  async resetAll(): Promise<void> {
    for (const field of this.allFields) {
      if (field instanceof TerminalField) {
        await field.resetValue();
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

  /**
   * Whether the form has no fields.
   *
   * @example
   * ```typescript
   * if (form.isEmpty) {
   *   console.log("Form has no fields");
   * }
   * ```
   */
  get isEmpty(): boolean {
    return this.allFields.length === 0;
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
   * @param options - Flattening options
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
    this._ctx.catalog.removeAcroForm();

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
  private async setFieldValue(field: FormField, value: FieldValue): Promise<void> {
    switch (field.type) {
      case "text":
        if (typeof value !== "string") {
          throw new TypeError(
            `Text field "${field.name}" requires string value, got ${typeof value}`,
          );
        }

        await (field as TextField).setValue(value);
        break;

      case "checkbox":
        if (typeof value === "boolean") {
          if (value) {
            await (field as CheckboxField).check();
          } else {
            await (field as CheckboxField).uncheck();
          }
        } else if (typeof value === "string") {
          await (field as CheckboxField).setValue(value);
        } else {
          throw new TypeError(`Checkbox "${field.name}" requires boolean or string value`);
        }
        break;

      case "radio":
        if (typeof value !== "string" && value !== null) {
          throw new TypeError(`Radio field "${field.name}" requires string or null value`);
        }

        await (field as RadioField).setValue(value);
        break;

      case "dropdown":
        if (typeof value !== "string") {
          throw new TypeError(`Dropdown "${field.name}" requires string value`);
        }

        await (field as DropdownField).setValue(value);
        break;

      case "listbox":
        if (!Array.isArray(value)) {
          throw new TypeError(`Listbox "${field.name}" requires string[] value`);
        }

        await (field as ListBoxField).setValue(value);
        break;

      case "signature":
      case "button":
        throw new Error(`Cannot set value on ${field.type} field "${field.name}"`);

      default:
        throw new Error(`Unknown field type for "${field.name}"`);
    }
  }
}
