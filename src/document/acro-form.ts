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
import { AppearanceGenerator } from "./appearance-generator";
import {
  type AcroFormLike,
  createFormField,
  type FieldType,
  type FormField,
  type TextField,
} from "./form-field";
import type { ObjectRegistry } from "./object-registry";
import type { WidgetAnnotation } from "./widget-annotation";

/**
 * AcroForm represents a PDF's interactive form.
 */
export class AcroForm implements AcroFormLike {
  private readonly dict: PdfDict;
  private readonly registry: ObjectRegistry;

  private fieldsCache: FormField[] | null = null;

  private constructor(dict: PdfDict, registry: ObjectRegistry) {
    this.dict = dict;
    this.registry = registry;
  }

  /**
   * Load AcroForm from catalog.
   * Returns null if no AcroForm present.
   */
  static async load(catalog: PdfDict, registry: ObjectRegistry): Promise<AcroForm | null> {
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

    return new AcroForm(dict, registry);
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
  async getFields(): Promise<FormField[]> {
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
  async getField(name: string): Promise<FormField | null> {
    const fields = await this.getFields();

    return fields.find(f => f.name === name) ?? null;
  }

  /**
   * Get all fields of a specific type.
   */
  async getFieldsOfType<T extends FormField>(type: FieldType): Promise<T[]> {
    const fields = await this.getFields();

    return fields.filter(f => f.type === type) as T[];
  }

  /**
   * Get the underlying dictionary.
   */
  getDict(): PdfDict {
    return this.dict;
  }

  /**
   * Clear the fields cache.
   * Call this after modifying the form structure.
   */
  clearCache(): void {
    this.fieldsCache = null;
  }

  /**
   * Update appearances for all fields that need it.
   *
   * This generates appearance streams for fields whose values
   * have been modified (needsAppearanceUpdate is true).
   */
  async updateAppearances(): Promise<void> {
    const generator = new AppearanceGenerator(this, this.registry);

    const fields = await this.getFields();

    for (const field of fields) {
      if (!field.needsAppearanceUpdate) {
        continue;
      }

      if (field.type === "text") {
        // Generate text field appearances
        const textField = field as TextField;

        for (const widget of textField.getWidgets()) {
          const stream = generator.generateTextAppearance(textField, widget);
          widget.setNormalAppearance(stream);
        }
      }

      // Checkboxes and radios typically use existing AP states
      // Dropdowns/listboxes would need their own generator

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
  ): Promise<FormField[]> {
    const fields: FormField[] = [];

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
    // Ensure appearances are up-to-date

    if (!options.skipAppearanceUpdate) {
      await this.updateAppearances();
    }

    // Collect widgets grouped by page
    const pageWidgets = await this.collectWidgetsByPage();

    // Process each page

    for (const [, { pageRef, widgets }] of pageWidgets) {
      await this.flattenWidgetsOnPage(pageRef, widgets);
    }

    // Clear form structure
    this.dict.set("Fields", new PdfArray([]));
    this.dict.delete("NeedAppearances");

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
   */
  private async findPageForWidget(widget: WidgetAnnotation): Promise<PdfRef | null> {
    if (!widget.ref) {
      return null;
    }

    // Walk from catalog to find all pages
    const pageRefs = await this.collectAllPageRefs();

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
   * Collect all page references by walking the page tree from catalog.
   */
  private async collectAllPageRefs(): Promise<PdfRef[]> {
    const pageRefs: PdfRef[] = [];
    const visited = new Set<string>();

    // Get catalog from the AcroForm's parent - we need to find /Pages
    // The AcroForm dict is under the catalog, so we can try to find the catalog
    // via the registry by looking for a dict with /Pages

    // Walk from form's /Fields to find any field's page, then get catalog
    const fields = await this.getFields();

    if (fields.length === 0) {
      return [];
    }

    // Try to find a widget with /P to get the catalog

    for (const field of fields) {
      for (const widget of field.getWidgets()) {
        const pageRef = widget.pageRef;

        if (pageRef) {
          const pageDict = await this.registry.resolve(pageRef);

          if (pageDict instanceof PdfDict) {
            // Found a page - walk up to find the root Pages
            let parent = pageDict.get("Parent");

            while (parent instanceof PdfRef) {
              const parentDict = await this.registry.resolve(parent);

              if (!(parentDict instanceof PdfDict)) {
                break;
              }

              // Check if this is the root Pages
              const kids = parentDict.getArray("Kids");

              if (kids) {
                // Walk all kids to collect page refs
                await this.walkPageTree(parent, pageRefs, visited);

                return pageRefs;
              }

              parent = parentDict.get("Parent");
            }
          }
        }
      }
    }

    return pageRefs;
  }

  /**
   * Recursively walk page tree to collect page refs.
   */
  private async walkPageTree(
    nodeRef: PdfRef,
    pageRefs: PdfRef[],
    visited: Set<string>,
  ): Promise<void> {
    const key = `${nodeRef.objectNumber} ${nodeRef.generation}`;

    if (visited.has(key)) {
      return;
    }

    visited.add(key);

    const node = await this.registry.resolve(nodeRef);

    if (!(node instanceof PdfDict)) {
      return;
    }

    const type = node.getName("Type")?.value;

    if (type === "Page") {
      pageRefs.push(nodeRef);
    } else if (type === "Pages") {
      const kids = node.getArray("Kids");

      if (kids) {
        for (let i = 0; i < kids.length; i++) {
          const kid = kids.at(i);

          if (kid instanceof PdfRef) {
            await this.walkPageTree(kid, pageRefs, visited);
          }
        }
      }
    }
  }

  /**
   * Flatten widgets on a single page.
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

      // Track widget ref for removal

      if (widget.ref) {
        widgetRefs.add(`${widget.ref.objectNumber} ${widget.ref.generation}`);
      }
    }

    // Append content to page

    if (!content.isEmpty()) {
      this.appendToPageContent(pageDict, content.toBytes());
    }

    // Remove widget annotations from page
    this.removeAnnotations(pageDict, widgetRefs);
  }

  /**
   * Calculate transformation matrix to position appearance in widget rect.
   *
   * The appearance stream has a BBox defining its coordinate system.
   * We transform this to fit in the widget's Rect on the page.
   */
  private calculateTransformMatrix(
    widget: WidgetAnnotation,
    appearance: PdfStream,
  ): TransformMatrix {
    // Widget rectangle on page
    const [rx1, ry1, rx2, ry2] = widget.rect;
    const rectWidth = rx2 - rx1;
    const rectHeight = ry2 - ry1;

    // Appearance BBox
    const bbox = this.getAppearanceBBox(appearance);
    const [bx1, by1, bx2, by2] = bbox;
    const bboxWidth = bx2 - bx1;
    const bboxHeight = by2 - by1;

    // Get rotation from widget's MK dictionary
    const mk = widget.getAppearanceCharacteristics();
    const rotation = mk?.rotation ?? 0;

    // Calculate scale factors
    let scaleX = bboxWidth !== 0 ? rectWidth / bboxWidth : 1;
    let scaleY = bboxHeight !== 0 ? rectHeight / bboxHeight : 1;

    // Apply rotation
    let a: number, b: number, c: number, d: number, e: number, f: number;

    switch (rotation) {
      case 90:
        // Swap scale factors for 90° rotation
        [scaleX, scaleY] = [rectWidth / bboxHeight || 1, rectHeight / bboxWidth || 1];
        a = 0;
        b = scaleY;
        c = -scaleX;
        d = 0;
        e = rx1 + rectWidth;
        f = ry1;
        break;
      case 180:
        a = -scaleX;
        b = 0;
        c = 0;
        d = -scaleY;
        e = rx2;
        f = ry2;
        break;
      case 270:
        [scaleX, scaleY] = [rectWidth / bboxHeight || 1, rectHeight / bboxWidth || 1];
        a = 0;
        b = -scaleY;
        c = scaleX;
        d = 0;
        e = rx1;
        f = ry1 + rectHeight;
        break;
      default: // 0
        a = scaleX;
        b = 0;
        c = 0;
        d = scaleY;
        e = rx1 - bx1 * scaleX;
        f = ry1 - by1 * scaleY;
    }

    return { a, b, c, d, e, f };
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
   * Append content to page's content stream(s).
   */
  private appendToPageContent(page: PdfDict, content: Uint8Array): void {
    const newStream = new PdfStream(new PdfDict(), content);
    const newRef = this.registry.register(newStream);

    const existing = page.get("Contents");

    if (!existing) {
      // No existing content
      page.set("Contents", newRef);
    } else if (existing instanceof PdfArray) {
      // Array of content streams - append
      existing.push(newRef);
    } else {
      // Single stream or ref - convert to array
      page.set("Contents", PdfArray.of(existing, newRef));
    }
  }

  /**
   * Remove specific annotations from page.
   */
  private removeAnnotations(page: PdfDict, toRemove: Set<string>): void {
    const annots = page.getArray("Annots");

    if (!annots) {
      return;
    }

    const remaining: (typeof annots extends PdfArray ? ReturnType<typeof annots.at> : never)[] = [];

    for (let i = 0; i < annots.length; i++) {
      const item = annots.at(i);

      if (item instanceof PdfRef) {
        const key = `${item.objectNumber} ${item.generation}`;

        if (!toRemove.has(key)) {
          remaining.push(item);
        }
      } else if (item) {
        remaining.push(item); // Keep non-ref items
      }
    }

    if (remaining.length === 0) {
      page.delete("Annots");
    } else if (remaining.length < annots.length) {
      page.set("Annots", PdfArray.of(...(remaining as PdfRef[])));
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
