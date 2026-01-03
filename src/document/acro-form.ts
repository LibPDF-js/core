/**
 * AcroForm - Interactive form support.
 *
 * Provides access to the document's interactive form, including
 * field tree traversal and field value reading.
 *
 * PDF Reference: Section 12.7 "Interactive Forms"
 */

import { ContentStreamBuilder } from "#src/content/content-stream";
import {
  concatMatrix,
  drawXObject,
  popGraphicsState,
  pushGraphicsState,
} from "#src/helpers/operators";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfStream } from "#src/objects/pdf-stream";
import { AppearanceGenerator, extractAppearanceStyle } from "./appearance-generator";
import { FieldTree } from "./field-tree";
import {
  type AcroFormLike,
  type CheckboxField,
  createFormField,
  type DropdownField,
  type FieldType,
  type ListBoxField,
  type RadioField,
  type TerminalField,
  type TextField,
} from "./form-field";
import { type ExistingFont, type FormFont, parseExistingFont } from "./form-font";
import type { ObjectRegistry } from "./object-registry";
import type { PageTree } from "./page-tree";
import type { WidgetAnnotation } from "./widget-annotation";

/**
 * AcroForm represents a PDF's interactive form.
 */
export class AcroForm implements AcroFormLike {
  private readonly dict: PdfDict;
  private readonly registry: ObjectRegistry;
  private readonly pageTree: PageTree | null;

  private fieldsCache: TerminalField[] | null = null;

  /** Default font for all fields */
  private _defaultFont: FormFont | null = null;

  /** Default font size for all fields */
  private _defaultFontSize = 0;

  /** Cache of existing fonts from /DR */
  private existingFontsCache: Map<string, ExistingFont> | null = null;

  private constructor(dict: PdfDict, registry: ObjectRegistry, pageTree: PageTree | null) {
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
    pageTree?: PageTree,
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
  async getFieldsOfType<T extends TerminalField>(type: FieldType): Promise<T[]> {
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
    // Apply font/size options if provided
    if (options.font || options.fontSize !== undefined) {
      const fields = await this.getFields();

      for (const field of fields) {
        // Skip read-only fields - they keep their existing appearance
        if (field.isReadOnly()) {
          continue;
        }

        if (options.font) {
          field.setFont(options.font);
        }

        if (options.fontSize !== undefined) {
          field.setFontSize(options.fontSize);
        }
      }
    }

    // Ensure appearances are up-to-date
    if (!options.skipAppearanceUpdate) {
      await this.updateAppearances({
        forceRegenerate: options.regenerateAppearances,
      });
    }

    // Collect widgets grouped by page
    const pageWidgets = await this.collectWidgetsByPage();

    // Process each page
    for (const { pageRef, widgets } of pageWidgets.values()) {
      await this.flattenWidgetsOnPage(pageRef, widgets);
    }

    // Clear form structure
    this.dict.set("Fields", new PdfArray([]));
    this.dict.delete("NeedAppearances");

    // Remove XFA for hybrid forms (per PDFBox)
    // If we flatten a hybrid PDF but leave XFA, viewers might still try to
    // render the XFA (which would now be invalid/disconnected from the flattened fields)
    this.dict.delete("XFA");

    // Remove SigFlags if no signatures remain (per PDFBox)
    // After flattening, signature fields are gone, so the flags are meaningless
    if (!this.hasSignatures) {
      this.dict.delete("SigFlags");
    }

    // Clear field cache
    this.fieldsCache = null;
  }

  /**
   * Collect all widgets grouped by their containing page.
   */
  private async collectWidgetsByPage(): Promise<
    Map<string, { pageRef: PdfRef; widgets: WidgetAnnotation[] }>
  > {
    const result = new Map<string, { pageRef: PdfRef; widgets: WidgetAnnotation[] }>();
    const fields = await this.getFields();

    for (const field of fields) {
      // Widgets are pre-resolved during field creation (resolveWidgets)
      for (const widget of field.getWidgets()) {
        let pageRef = widget.pageRef;

        // If widget doesn't have /P, try to find its page
        if (!pageRef) {
          pageRef = await this.findPageForWidget(widget);
        }

        if (!pageRef) {
          this.registry.addWarning(`Widget without page reference for field "${field.name}"`);
          continue;
        }

        const key = `${pageRef.objectNumber} ${pageRef.generation}`;
        let entry = result.get(key);

        if (!entry) {
          entry = { pageRef, widgets: [] };
          result.set(key, entry);
        }

        entry.widgets.push(widget);
      }
    }

    return result;
  }

  /**
   * Find the page containing a widget by scanning page /Annots arrays.
   * This is expensive but needed for widgets without /P.
   *
   * Uses the PageTree if available for efficient page iteration.
   */
  private async findPageForWidget(widget: WidgetAnnotation): Promise<PdfRef | null> {
    if (!widget.ref) {
      return null;
    }

    // Use the page tree if available
    if (!this.pageTree) {
      this.registry.addWarning("No page tree available; cannot find page for widget without /P");
      return null;
    }

    const pageRefs = this.pageTree.getPages();

    for (const pageRef of pageRefs) {
      const pageDict = await this.registry.resolve(pageRef);

      if (!(pageDict instanceof PdfDict)) {
        continue;
      }

      const annots = pageDict.getArray("Annots");

      if (!annots) {
        continue;
      }

      for (let i = 0; i < annots.length; i++) {
        const annotRef = annots.at(i);

        // PdfRefs are interned, so we can compare with ===
        if (annotRef instanceof PdfRef && annotRef === widget.ref) {
          return pageRef;
        }
      }
    }

    return null;
  }

  /**
   * Flatten widgets on a single page.
   *
   * Following PDFBox's approach, we:
   * 1. Wrap the existing page content in q...Q (save/restore graphics state)
   * 2. Append our flattened content after the Q
   *
   * This isolates the original page's graphics state from our flattened fields.
   */
  private async flattenWidgetsOnPage(pageRef: PdfRef, widgets: WidgetAnnotation[]): Promise<void> {
    const pageDict = await this.registry.resolve(pageRef);

    if (!(pageDict instanceof PdfDict)) {
      return;
    }

    // Get or create page resources
    let resources = pageDict.getDict("Resources");

    if (!resources) {
      resources = new PdfDict();
      pageDict.set("Resources", resources);
    }

    let xObjects = resources.getDict("XObject");

    if (!xObjects) {
      xObjects = new PdfDict();
      resources.set("XObject", xObjects);
    }

    // Build flattening content stream
    const content = new ContentStreamBuilder();
    const widgetRefs = new Set<string>();
    let xObjectIndex = 0;
    let hasVisibleWidgets = false;

    for (const widget of widgets) {
      // Skip hidden widgets
      if (this.isWidgetHidden(widget)) {
        continue;
      }

      // Get appearance stream
      const appearance = await widget.getNormalAppearance(widget.appearanceState ?? undefined);

      if (!appearance) {
        this.registry.addWarning("Widget without appearance stream skipped during flatten");
        continue;
      }

      // Check appearance stream has valid BBox dimensions
      if (!this.isVisibleAppearance(appearance)) {
        continue;
      }

      // Normalize appearance stream - ensure it has required XObject Form entries
      // Some PDFs have appearance streams missing /Subtype /Form which causes
      // rendering failures in some viewers (e.g., Adobe Reader)
      this.normalizeAppearanceStream(appearance);

      // Add appearance as XObject
      const xObjectName = `FlatField${xObjectIndex++}`;
      const appearanceRef = this.registry.register(appearance);
      xObjects.set(xObjectName, appearanceRef);

      // Calculate transformation matrix
      const matrix = this.calculateTransformMatrix(widget, appearance);

      // Add drawing operators
      content.add(
        pushGraphicsState(),
        concatMatrix(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f),
        drawXObject(`/${xObjectName}`),
        popGraphicsState(),
      );

      hasVisibleWidgets = true;

      // Track widget ref for removal
      if (widget.ref) {
        widgetRefs.add(`${widget.ref.objectNumber} ${widget.ref.generation}`);
      }
    }

    // Wrap existing content and append flattened content
    if (hasVisibleWidgets && !content.isEmpty()) {
      this.wrapAndAppendContent(pageDict, content.toBytes());
    }

    // Remove widget annotations from page
    await this.removeAnnotations(pageDict, widgetRefs);
  }

  /**
   * Check if appearance stream has valid dimensions.
   * Per PDFBox: BBox must exist and have width/height > 0.
   */
  private isVisibleAppearance(appearance: PdfStream): boolean {
    const bbox = appearance.getArray("BBox");

    if (!bbox || bbox.length < 4) {
      return false;
    }

    const x1 = (bbox.at(0) as PdfNumber | undefined)?.value ?? 0;
    const y1 = (bbox.at(1) as PdfNumber | undefined)?.value ?? 0;
    const x2 = (bbox.at(2) as PdfNumber | undefined)?.value ?? 0;
    const y2 = (bbox.at(3) as PdfNumber | undefined)?.value ?? 0;

    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);

    return width > 0 && height > 0;
  }

  /**
   * Wrap existing page content in q...Q and append new content.
   *
   * Following PDFBox's approach:
   * - Prepend "q\n" to the existing content streams
   * - Append "Q\n" + new content after
   *
   * This isolates the original page's graphics state from our additions.
   */
  private wrapAndAppendContent(page: PdfDict, newContent: Uint8Array): void {
    const existing = page.get("Contents");

    // Create prefix stream with "q\n"
    const prefixBytes = new Uint8Array([0x71, 0x0a]); // "q\n"
    const prefixStream = new PdfStream(new PdfDict(), prefixBytes);
    const prefixRef = this.registry.register(prefixStream);

    // Create suffix stream with "Q\n" + new content
    const suffixBytes = new Uint8Array(2 + newContent.length);
    suffixBytes[0] = 0x51; // "Q"
    suffixBytes[1] = 0x0a; // "\n"
    suffixBytes.set(newContent, 2);
    const suffixStream = new PdfStream(new PdfDict(), suffixBytes);
    const suffixRef = this.registry.register(suffixStream);

    if (!existing) {
      // No existing content - just add our content (no wrapping needed)
      page.set("Contents", suffixRef);
    } else if (existing instanceof PdfArray) {
      // Array of content streams
      // Insert prefix at start, suffix at end
      const newArray = PdfArray.of(prefixRef, ...this.getArrayItems(existing), suffixRef);
      page.set("Contents", newArray);
    } else {
      // Single stream or ref - convert to array with prefix and suffix
      page.set("Contents", PdfArray.of(prefixRef, existing, suffixRef));
    }
  }

  /**
   * Get all items from a PdfArray.
   */
  private getArrayItems(arr: PdfArray): PdfRef[] {
    const items: PdfRef[] = [];

    for (let i = 0; i < arr.length; i++) {
      const item = arr.at(i);

      if (item instanceof PdfRef) {
        items.push(item);
      }
    }

    return items;
  }

  /**
   * Calculate transformation matrix to position appearance in widget rect.
   *
   * This follows PDFBox's approach:
   * 1. The appearance stream may have its own Matrix (handling rotation)
   * 2. We transform the BBox by the appearance Matrix to get "real" bounds
   * 3. We calculate a simple translate+scale to fit in the annotation rect
   *
   * Rotation is handled by the appearance stream's Matrix, NOT by this transform.
   */
  private calculateTransformMatrix(
    widget: WidgetAnnotation,
    appearance: PdfStream,
  ): TransformMatrix {
    // Widget rectangle on page
    const [rx1, ry1, rx2, ry2] = widget.rect;
    const rectWidth = rx2 - rx1;
    const rectHeight = ry2 - ry1;

    // Get the transformed appearance bounding box
    // This accounts for any Matrix in the appearance stream
    const transformedBBox = this.getTransformedAppearanceBBox(appearance);

    // Calculate simple translate + scale (no rotation - that's in appearance Matrix)
    const scaleX = transformedBBox.width !== 0 ? rectWidth / transformedBBox.width : 1;
    const scaleY = transformedBBox.height !== 0 ? rectHeight / transformedBBox.height : 1;

    // Translate to annotation position, accounting for BBox origin
    const translateX = rx1 - transformedBBox.x * scaleX;
    const translateY = ry1 - transformedBBox.y * scaleY;

    return {
      a: scaleX,
      b: 0,
      c: 0,
      d: scaleY,
      e: translateX,
      f: translateY,
    };
  }

  /**
   * Get the appearance BBox transformed by the appearance's Matrix.
   *
   * The appearance stream may have a Matrix that transforms its coordinate
   * system (e.g., for rotation). We need to transform the BBox corners
   * by this matrix to get the "real" bounding box.
   */
  private getTransformedAppearanceBBox(appearance: PdfStream): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    const bbox = this.getAppearanceBBox(appearance);
    const [bx1, by1, bx2, by2] = bbox;

    // Get the appearance's Matrix (if any)
    const matrixArray = appearance.getArray("Matrix");

    if (!matrixArray || matrixArray.length < 6) {
      // No matrix - return BBox as-is
      return {
        x: bx1,
        y: by1,
        width: bx2 - bx1,
        height: by2 - by1,
      };
    }

    // Extract matrix components [a, b, c, d, e, f]
    const a = (matrixArray.at(0) as PdfNumber | undefined)?.value ?? 1;
    const b = (matrixArray.at(1) as PdfNumber | undefined)?.value ?? 0;
    const c = (matrixArray.at(2) as PdfNumber | undefined)?.value ?? 0;
    const d = (matrixArray.at(3) as PdfNumber | undefined)?.value ?? 1;
    const e = (matrixArray.at(4) as PdfNumber | undefined)?.value ?? 0;
    const f = (matrixArray.at(5) as PdfNumber | undefined)?.value ?? 0;

    // Transform all four corners of the BBox
    // x' = a*x + c*y + e
    // y' = b*x + d*y + f
    const corners = [
      { x: bx1, y: by1 }, // bottom-left
      { x: bx2, y: by1 }, // bottom-right
      { x: bx2, y: by2 }, // top-right
      { x: bx1, y: by2 }, // top-left
    ];

    const transformed = corners.map(({ x, y }) => ({
      x: a * x + c * y + e,
      y: b * x + d * y + f,
    }));

    // Find the bounding box of transformed corners
    const xs = transformed.map(p => p.x);
    const ys = transformed.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * Get appearance BBox, with fallback.
   */
  private getAppearanceBBox(appearance: PdfStream): [number, number, number, number] {
    // PdfStream extends PdfDict, so we call getArray directly
    const bbox = appearance.getArray("BBox");

    if (!bbox || bbox.length < 4) {
      return [0, 0, 1, 1]; // Fallback
    }

    return [
      (bbox.at(0) as PdfNumber | undefined)?.value ?? 0,
      (bbox.at(1) as PdfNumber | undefined)?.value ?? 0,
      (bbox.at(2) as PdfNumber | undefined)?.value ?? 0,
      (bbox.at(3) as PdfNumber | undefined)?.value ?? 0,
    ];
  }

  /**
   * Remove specific annotations from page.
   */
  private async removeAnnotations(page: PdfDict, toRemove: Set<string>): Promise<void> {
    // Get Annots - may be direct array or a reference to an array
    const annotsEntry = page.get("Annots");

    if (!annotsEntry) {
      return;
    }

    let annots: PdfArray | null = null;

    if (annotsEntry instanceof PdfArray) {
      annots = annotsEntry;
    } else if (annotsEntry instanceof PdfRef) {
      const resolved = await this.registry.resolve(annotsEntry);
      if (resolved instanceof PdfArray) {
        annots = resolved;
      }
    }

    if (!annots) {
      return;
    }

    const remaining: PdfRef[] = [];

    for (let i = 0; i < annots.length; i++) {
      const item = annots.at(i);

      if (item instanceof PdfRef) {
        const key = `${item.objectNumber} ${item.generation}`;

        if (!toRemove.has(key)) {
          remaining.push(item);
        }
      }
    }

    if (remaining.length === 0) {
      page.delete("Annots");
    } else if (remaining.length < annots.length) {
      // Replace the Annots entry with the filtered array
      page.set("Annots", PdfArray.of(...remaining));
    }
  }

  /**
   * Normalize an appearance stream to ensure it has required XObject Form entries.
   *
   * Per PDF spec, a Form XObject stream requires:
   * - /Subtype /Form (required)
   * - /BBox (required, should already exist for appearance streams)
   * - /FormType 1 (optional, defaults to 1)
   *
   * Some PDFs have appearance streams missing /Subtype /Form, which causes
   * Adobe Reader and other strict viewers to fail rendering.
   */
  private normalizeAppearanceStream(appearance: PdfStream): void {
    // Ensure /Subtype /Form is set (required for XObject Form)
    if (!appearance.has("Subtype")) {
      appearance.set("Subtype", PdfName.of("Form"));
    }

    // Ensure /FormType is set (optional, but good practice)
    if (!appearance.has("FormType")) {
      appearance.set("FormType", new PdfNumber(1));
    }
  }

  /**
   * Check if widget should be skipped (hidden/invisible).
   */
  private isWidgetHidden(widget: WidgetAnnotation): boolean {
    const flags = widget.flags;

    const HIDDEN = 1 << 1; // Bit 2: Hidden
    const INVISIBLE = 1 << 0; // Bit 1: Invisible
    const NO_VIEW = 1 << 5; // Bit 6: NoView

    return (flags & (HIDDEN | INVISIBLE | NO_VIEW)) !== 0;
  }
}

/**
 * Options for form flattening.
 */
export interface FlattenOptions {
  /** Skip appearance update (use if appearances are known good) */
  skipAppearanceUpdate?: boolean;

  /**
   * Force regeneration of all appearances even if they already exist.
   *
   * By default, existing appearances are preserved to maintain styling
   * (backgrounds, borders, rotation) that the generator cannot reproduce.
   * Set this to true to always use generated appearances with new values.
   *
   * Note: Generated appearances may lack custom styling from the original PDF.
   */
  regenerateAppearances?: boolean;

  /** Font to use when regenerating appearances */
  font?: FormFont;

  /** Font size to use (0 = auto) */
  fontSize?: number;
}

/**
 * Transformation matrix components.
 */
interface TransformMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}
