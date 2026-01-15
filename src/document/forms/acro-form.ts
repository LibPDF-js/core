/**
 * AcroForm - Interactive form support.
 *
 * Provides access to the document's interactive form, including
 * field tree traversal and field value reading.
 *
 * PDF Reference: Section 12.7 "Interactive Forms"
 */

import type { PDFPageTree } from "#src/api/pdf-page-tree";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfRef } from "#src/objects/pdf-ref";

import type { ObjectRegistry } from "../object-registry";
import { AppearanceGenerator, extractAppearanceStyle } from "./appearance-generator";
import { FieldTree } from "./field-tree";
import {
  type AcroFormLike,
  type CheckboxField,
  createFormField,
  type DropdownField,
  type ListBoxField,
  type RadioField,
  type TerminalField,
  type TextField,
} from "./fields";
import { type FlattenOptions, FormFlattener } from "./form-flattener";
import { type ExistingFont, type FormFont, parseExistingFont } from "./form-font";

/**
 * AcroForm represents a PDF's interactive form.
 */
export class AcroForm implements AcroFormLike {
  private readonly dict: PdfDict;
  private readonly registry: ObjectRegistry;
  private readonly pageTree: PDFPageTree | null;

  private fieldsCache: TerminalField[] | null = null;

  /** Default font for all fields */
  private _defaultFont: FormFont | null = null;

  /** Default font size for all fields */
  private _defaultFontSize = 0;

  /** Cache of existing fonts from /DR */
  private existingFontsCache: Map<string, ExistingFont> | null = null;

  private constructor(dict: PdfDict, registry: ObjectRegistry, pageTree: PDFPageTree | null) {
    this.dict = dict;
    this.registry = registry;
    this.pageTree = pageTree;
  }

  /**
   * Load AcroForm from catalog.
   * Returns null if no AcroForm present.
   *
   * @param catalog The document catalog dictionary
   * @param registry The object registry for resolving references
   * @param pageTree Optional page tree for efficient page lookups during flattening
   */
  static async load(
    catalog: PdfDict,
    registry: ObjectRegistry,
    pageTree?: PDFPageTree,
  ): Promise<AcroForm | null> {
    const acroFormEntry = catalog.get("AcroForm");

    if (!acroFormEntry) {
      return null;
    }

    let dict: PdfDict | null = null;

    if (acroFormEntry instanceof PdfRef) {
      const resolved = await registry.resolve(acroFormEntry);

      if (resolved instanceof PdfDict) {
        dict = resolved;
      }
    } else if (acroFormEntry instanceof PdfDict) {
      dict = acroFormEntry;
    }

    if (!dict) {
      return null;
    }

    return new AcroForm(dict, registry, pageTree ?? null);
  }

  /**
   * Default resources dictionary (fonts, etc.).
   */
  async getDefaultResources(): Promise<PdfDict | null> {
    const dr = this.dict.get("DR");

    if (!dr) {
      return null;
    }

    if (dr instanceof PdfRef) {
      const resolved = await this.registry.resolve(dr);

      return resolved instanceof PdfDict ? resolved : null;
    }

    return dr instanceof PdfDict ? dr : null;
  }

  /**
   * Default appearance string.
   */
  get defaultAppearance(): string {
    const da = this.dict.getString("DA");

    return da?.asString() ?? "/Helv 0 Tf 0 g";
  }

  /**
   * Default quadding (text alignment).
   * 0 = left, 1 = center, 2 = right
   */
  get defaultQuadding(): number {
    return this.dict.getNumber("Q")?.value ?? 0;
  }

  /**
   * Whether viewer should generate appearances.
   * If true, the viewer generates appearances for fields without /AP.
   */
  get needAppearances(): boolean {
    return this.dict.getBool("NeedAppearances")?.value ?? false;
  }

  /**
   * Signature flags.
   * Bit 1: SignaturesExist
   * Bit 2: AppendOnly
   */
  get signatureFlags(): number {
    return this.dict.getNumber("SigFlags")?.value ?? 0;
  }

  /**
   * Whether the document contains signatures.
   */
  get hasSignatures(): boolean {
    return (this.signatureFlags & 1) !== 0;
  }

  /**
   * Whether the document should be saved incrementally (append-only).
   */
  get isAppendOnly(): boolean {
    return (this.signatureFlags & 2) !== 0;
  }

  /**
   * Get all terminal fields (flattened).
   * Non-terminal fields (containers) are not included.
   */
  async getFields(): Promise<TerminalField[]> {
    if (this.fieldsCache) {
      return this.fieldsCache;
    }

    const fieldsArray = this.dict.getArray("Fields");

    if (!fieldsArray) {
      return [];
    }

    const visited = new Set<string>();
    const fields = await this.collectFields(fieldsArray, visited, "");

    this.fieldsCache = fields;

    return fields;
  }

  /**
   * Get field by fully-qualified name.
   * Returns null if not found.
   */
  async getField(name: string): Promise<TerminalField | null> {
    const fields = await this.getFields();

    return fields.find(f => f.name === name) ?? null;
  }

  /**
   * Get all fields of a specific type.
   */
  async getFieldsOfType<T extends TerminalField>(type: T["type"]): Promise<T[]> {
    const fields = await this.getFields();

    return fields.filter(f => f.type === type) as unknown as T[];
  }

  /**
   * Get the underlying dictionary.
   */
  getDict(): PdfDict {
    return this.dict;
  }

  /**
   * Get the field tree for safe iteration over the form hierarchy.
   *
   * The field tree provides:
   * - Cycle-safe iteration (handles circular references)
   * - Breadth-first ordering
   * - Access to both terminal and non-terminal fields
   * - Parent references set on all fields
   *
   * @example
   * ```typescript
   * const tree = await form.getFieldTree();
   *
   * // Iterate all fields
   * for (const field of tree) {
   *   console.log(field.name, field.type);
   * }
   *
   * // Iterate only terminal fields (value-holding)
   * for (const field of tree.terminalFields()) {
   *   console.log(field.name, field.getValue());
   * }
   * ```
   */
  async getFieldTree(): Promise<FieldTree> {
    return FieldTree.load(this, this.registry);
  }

  /**
   * Clear the fields cache.
   * Call this after modifying the form structure.
   */
  clearCache(): void {
    this.fieldsCache = null;
    this.existingFontsCache = null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Default Font Management
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Set the default font for all fields.
   *
   * This font will be used for fields that don't have an explicit font set.
   */
  setDefaultFont(font: FormFont): void {
    this._defaultFont = font;
  }

  /**
   * Get the default font.
   */
  getDefaultFont(): FormFont | null {
    return this._defaultFont;
  }

  /**
   * Set the default font size for all fields.
   *
   * Use 0 for auto-size.
   */
  setDefaultFontSize(size: number): void {
    if (size < 0) {
      throw new Error(`Font size cannot be negative: ${size}`);
    }

    this._defaultFontSize = size;
  }

  /**
   * Get the default font size.
   */
  getDefaultFontSize(): number {
    return this._defaultFontSize;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Existing Font Access
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get an existing font from the PDF's resources.
   *
   * Looks up fonts in the AcroForm's /DR (Default Resources) dictionary.
   *
   * @param name Font name including slash, e.g., "/Helv", "/ZaDb"
   * @returns ExistingFont wrapper or null if not found
   */
  getExistingFont(name: string): ExistingFont | null {
    this.ensureExistingFontsLoaded();

    const cleanName = name.startsWith("/") ? name.slice(1) : name;

    return this.existingFontsCache?.get(cleanName) ?? null;
  }

  /**
   * List all fonts available in the PDF's default resources.
   */
  getAvailableFonts(): ExistingFont[] {
    this.ensureExistingFontsLoaded();

    return this.existingFontsCache ? [...this.existingFontsCache.values()] : [];
  }

  /**
   * Load existing fonts from /DR if not already cached.
   */
  private ensureExistingFontsLoaded(): void {
    if (this.existingFontsCache !== null) {
      return;
    }

    this.existingFontsCache = new Map();

    const dr = this.dict.getDict("DR");

    if (!dr) {
      return;
    }

    const fonts = dr.getDict("Font");

    if (!fonts) {
      return;
    }

    for (const key of fonts.keys()) {
      const fontName = key.value;
      const fontObj = fonts.get(fontName);

      if (fontObj) {
        const existingFont = parseExistingFont(
          fontName,
          fontObj as PdfDict | PdfRef,
          this.registry,
        );

        this.existingFontsCache.set(fontName, existingFont);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Appearance Generation
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Update appearance for a single field.
   *
   * Called automatically by setValue() on field classes.
   * Regenerates the visual appearance stream for the field.
   *
   * @internal
   */
  async updateFieldAppearance(field: TerminalField): Promise<void> {
    // Skip read-only fields during regeneration (preserve existing appearance)
    if (field.isReadOnly()) {
      return;
    }

    const generator = new AppearanceGenerator(this, this.registry);

    switch (field.type) {
      case "text": {
        const textField = field as TextField;

        for (const widget of textField.getWidgets()) {
          const existingAppearance = await widget.getNormalAppearance();
          const existingStyle = existingAppearance
            ? await extractAppearanceStyle(existingAppearance)
            : undefined;

          const stream = generator.generateTextAppearance(textField, widget, existingStyle);
          widget.setNormalAppearance(stream);
        }

        break;
      }

      case "checkbox": {
        const checkboxField = field as CheckboxField;

        for (const widget of checkboxField.getWidgets()) {
          const onValue = widget.getOnValue() ?? "Yes";

          // Skip if all state appearances exist
          if (widget.hasAppearancesForStates([onValue, "Off"])) {
            continue;
          }

          const { on, off } = generator.generateCheckboxAppearance(checkboxField, widget, onValue);
          widget.setNormalAppearance(on, onValue);
          widget.setNormalAppearance(off, "Off");
        }

        break;
      }

      case "radio": {
        const radioField = field as RadioField;

        for (const widget of radioField.getWidgets()) {
          const value = widget.getOnValue() ?? "Choice";

          // Skip if all state appearances exist
          if (widget.hasAppearancesForStates([value, "Off"])) {
            continue;
          }

          const { selected, off } = generator.generateRadioAppearance(radioField, widget, value);
          widget.setNormalAppearance(selected, value);
          widget.setNormalAppearance(off, "Off");
        }

        break;
      }

      case "dropdown": {
        const dropdownField = field as DropdownField;

        for (const widget of dropdownField.getWidgets()) {
          const stream = generator.generateDropdownAppearance(dropdownField, widget);
          widget.setNormalAppearance(stream);
        }

        break;
      }

      case "listbox": {
        const listboxField = field as ListBoxField;

        for (const widget of listboxField.getWidgets()) {
          const stream = generator.generateListBoxAppearance(listboxField, widget);
          widget.setNormalAppearance(stream);
        }

        break;
      }

      case "button": {
        // NEVER regenerate button appearances
        break;
      }
    }

    // Clear NeedAppearances flag
    this.dict.delete("NeedAppearances");
  }

  /**
   * Update appearances for all fields that need it.
   *
   * This generates appearance streams for fields whose values
   * have been modified (needsAppearanceUpdate is true).
   *
   * @param options.forceRegenerate Force regeneration even if appearances exist
   */
  async updateAppearances(options: { forceRegenerate?: boolean } = {}): Promise<void> {
    const generator = new AppearanceGenerator(this, this.registry);

    const fields = await this.getFields();

    for (const field of fields) {
      if (!field.needsAppearanceUpdate) {
        continue;
      }

      // Skip read-only fields during regeneration (preserve existing appearance)
      if (field.isReadOnly()) {
        field.needsAppearanceUpdate = false;
        continue;
      }

      const forceRegen = options.forceRegenerate ?? false;

      switch (field.type) {
        case "text": {
          const textField = field as TextField;

          for (const widget of textField.getWidgets()) {
            // Extract existing styling before regenerating
            // This preserves colors, fonts, borders from the original appearance
            const existingAppearance = await widget.getNormalAppearance();
            const existingStyle = existingAppearance
              ? await extractAppearanceStyle(existingAppearance)
              : undefined;

            const stream = generator.generateTextAppearance(textField, widget, existingStyle);
            widget.setNormalAppearance(stream);
          }

          break;
        }

        case "checkbox": {
          const checkboxField = field as CheckboxField;

          for (const widget of checkboxField.getWidgets()) {
            const onValue = widget.getOnValue() ?? "Yes";

            // Skip if all state appearances exist and not forcing regeneration
            // Existing appearances are usually better than generated ones
            if (!forceRegen && widget.hasAppearancesForStates([onValue, "Off"])) {
              continue;
            }

            const { on, off } = generator.generateCheckboxAppearance(
              checkboxField,
              widget,
              onValue,
            );
            widget.setNormalAppearance(on, onValue);
            widget.setNormalAppearance(off, "Off");
          }

          break;
        }

        case "radio": {
          const radioField = field as RadioField;

          for (const widget of radioField.getWidgets()) {
            const value = widget.getOnValue() ?? "Choice";

            // Skip if all state appearances exist and not forcing regeneration
            if (!forceRegen && widget.hasAppearancesForStates([value, "Off"])) {
              continue;
            }

            const { selected, off } = generator.generateRadioAppearance(radioField, widget, value);
            widget.setNormalAppearance(selected, value);
            widget.setNormalAppearance(off, "Off");
          }

          break;
        }

        case "dropdown": {
          const dropdownField = field as DropdownField;

          for (const widget of dropdownField.getWidgets()) {
            // Skip if appearance exists and not forcing regeneration
            if (!forceRegen && widget.hasNormalAppearance()) {
              continue;
            }

            const stream = generator.generateDropdownAppearance(dropdownField, widget);
            widget.setNormalAppearance(stream);
          }

          break;
        }

        case "listbox": {
          const listboxField = field as ListBoxField;

          for (const widget of listboxField.getWidgets()) {
            // Skip if appearance exists and not forcing regeneration
            if (!forceRegen && widget.hasNormalAppearance()) {
              continue;
            }

            const stream = generator.generateListBoxAppearance(listboxField, widget);
            widget.setNormalAppearance(stream);
          }

          break;
        }

        case "button": {
          // NEVER regenerate button appearances - they have custom artwork
          // that we cannot faithfully reproduce. Button appearances are
          // created by the PDF author and should be preserved.
          break;
        }
      }

      field.needsAppearanceUpdate = false;
    }

    // Clear NeedAppearances flag since we've generated them
    this.dict.delete("NeedAppearances");
  }

  /**
   * Mark all fields as needing appearance update.
   */
  async markAllNeedAppearanceUpdate(): Promise<void> {
    const fields = await this.getFields();

    for (const field of fields) {
      field.needsAppearanceUpdate = true;
    }
  }

  /**
   * Collect all terminal fields from a /Kids or /Fields array.
   */
  private async collectFields(
    kids: PdfArray,
    visited: Set<string>,
    parentName: string,
  ): Promise<TerminalField[]> {
    const fields: TerminalField[] = [];

    for (let i = 0; i < kids.length; i++) {
      const item = kids.at(i);
      const ref = item instanceof PdfRef ? item : null;
      const refKey = ref ? `${ref.objectNumber} ${ref.generation}` : "";

      // Detect circular references
      if (refKey && visited.has(refKey)) {
        this.registry.addWarning(`Circular reference in form field tree: ${refKey}`);
        continue;
      }

      if (refKey) {
        visited.add(refKey);
      }

      // Resolve the field dictionary
      let dict: PdfDict | null = null;

      if (item instanceof PdfRef) {
        const resolved = await this.registry.resolve(item);

        if (resolved instanceof PdfDict) {
          dict = resolved;
        }
      } else if (item instanceof PdfDict) {
        dict = item;
      }

      if (!dict) {
        continue;
      }

      // Build fully-qualified name
      const partialName = dict.getString("T")?.asString() ?? "";
      const fullName = parentName
        ? partialName
          ? `${parentName}.${partialName}`
          : parentName
        : partialName;

      // Check if terminal or non-terminal

      if (await this.isTerminalField(dict)) {
        const field = createFormField(dict, ref, this.registry, this, fullName);

        await field.resolveWidgets();

        fields.push(field);
      } else {
        // Non-terminal: recurse into children
        const childKids = dict.getArray("Kids");

        if (childKids) {
          fields.push(...(await this.collectFields(childKids, visited, fullName)));
        }
      }
    }

    return fields;
  }

  /**
   * Check if a field dictionary is a terminal field.
   *
   * A field is terminal if:
   * - It has no /Kids, OR
   * - Its /Kids contain widgets (no /T) rather than child fields (have /T)
   */
  private async isTerminalField(dict: PdfDict): Promise<boolean> {
    const kids = dict.getArray("Kids");

    if (!kids || kids.length === 0) {
      return true;
    }

    // Check the first kid - if it has /T, these are child fields (non-terminal)
    // If it has no /T, these are widgets (terminal)
    const firstKid = kids.at(0);

    if (!firstKid) {
      return true;
    }

    let firstKidDict: PdfDict | null = null;

    if (firstKid instanceof PdfRef) {
      const resolved = await this.registry.resolve(firstKid);

      if (resolved instanceof PdfDict) {
        firstKidDict = resolved;
      }
    } else if (firstKid instanceof PdfDict) {
      firstKidDict = firstKid;
    }

    if (!firstKidDict) {
      return true;
    }

    // If first kid has /T, it's a child field → parent is non-terminal
    // If first kid has no /T, it's a widget → parent is terminal

    return !firstKidDict.has("T");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Font Management
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Add a font to the AcroForm's Default Resources (/DR) dictionary.
   *
   * This is called automatically when creating fields with embedded fonts.
   * The font is added to /DR/Font with an auto-generated name if not already present.
   *
   * @param fontRef Reference to the font dictionary
   * @param name Optional name for the font (e.g., "F1"). If not provided, one is generated.
   * @returns The font name used in the /DR dictionary
   */
  addFontToResources(fontRef: PdfRef, name?: string): string {
    // Ensure /DR exists
    let dr = this.dict.getDict("DR");

    if (!dr) {
      dr = new PdfDict();
      this.dict.set("DR", dr);
    }

    // Ensure /DR/Font exists
    let fontsDict = dr.getDict("Font");

    if (!fontsDict) {
      fontsDict = new PdfDict();
      dr.set("Font", fontsDict);
    }

    // Check if font is already in resources (PdfRef is interned, so === works)
    for (const key of fontsDict.keys()) {
      const existing = fontsDict.get(key.value);

      if (existing instanceof PdfRef && existing === fontRef) {
        return key.value;
      }
    }

    // Generate a name if not provided
    const fontName = name ?? this.generateFontName(fontsDict);
    fontsDict.set(fontName, fontRef);

    // Clear existing fonts cache since we modified DR
    this.existingFontsCache = null;

    return fontName;
  }

  /**
   * Generate a unique font name for the /DR/Font dictionary.
   */
  private generateFontName(fontsDict: PdfDict): string {
    let counter = 1;
    let name = `F${counter}`;

    while (fontsDict.has(name)) {
      counter++;
      name = `F${counter}`;
    }

    return name;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Field Creation
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Add a field reference to the Fields array.
   *
   * @param fieldRef Reference to the field dictionary
   */
  addField(fieldRef: PdfRef): void {
    let fieldsArray = this.dict.getArray("Fields");

    if (!fieldsArray) {
      fieldsArray = new PdfArray([]);
      this.dict.set("Fields", fieldsArray);
    }

    fieldsArray.push(fieldRef);

    // Set signature flags if not already set
    const currentFlags = this.signatureFlags;

    if ((currentFlags & 3) !== 3) {
      this.dict.set("SigFlags", PdfNumber.of(3)); // SignaturesExist + AppendOnly
    }

    // Clear cache since we added a field
    this.clearCache();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Form Flattening
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Flatten all form fields into static page content.
   *
   * This converts interactive form fields into static graphics. After flattening:
   * - Field appearances are drawn directly in page content
   * - Widget annotations are removed from pages
   * - The form structure is cleared
   *
   * Use cases:
   * - Creating print-ready PDFs
   * - Archival (remove interactivity)
   * - PDF/A compliance (some profiles disallow forms)
   *
   * @param options Flattening options
   */
  async flatten(options: FlattenOptions = {}): Promise<void> {
    const flattener = new FormFlattener(this, this.registry, this.pageTree);
    await flattener.flatten(options);

    // Clear field cache after flattening
    this.fieldsCache = null;
  }
}
