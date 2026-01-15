# Plan 020: Form Flattening

## Overview

Implement form flattening: converting interactive form fields into static page content. After flattening, the PDF no longer has editable fields - appearances are "baked" into page content.

## Scope

- Flatten all form fields to page content
- Draw widget appearance streams as XObjects
- Remove widget annotations from pages
- Clear AcroForm structure
- Optionally keep non-form annotations

**Prerequisites**: Plans 017a (operators), 017b (reading), 017c (writing/appearances).

## Use Cases

1. **Print-ready PDFs** - Remove interactivity for archival
2. **Signature preservation** - Flatten before signing to prevent changes
3. **PDF/A compliance** - Some profiles disallow interactive elements
4. **File size** - Flattened forms can be smaller (no field structure)

## Algorithm

```
1. Refresh all appearances (ensure up-to-date)
2. For each page with widgets:
   a. Collect widgets on this page
   b. For each widget:
      - Get normal appearance stream
      - Add appearance as XObject to page resources
      - Calculate transformation matrix (appearance BBox → widget Rect)
      - Append drawing operators to page content
   c. Remove widget annotations from page's /Annots
3. Clear /AcroForm.Fields
4. Remove /NeedAppearances flag
```

## Design

### AcroForm.flatten()

```typescript
// In AcroForm class

/**
 * Flatten all form fields into page content.
 * This removes all interactivity - fields become static graphics.
 */
flatten(options: FlattenOptions = {}): void {
  // Ensure appearances are up-to-date
  if (!options.skipAppearanceUpdate) {
    this.updateAppearances();
  }

  // Collect widgets grouped by page
  const pageWidgets = this.collectWidgetsByPage();

  // Process each page
  for (const [pageRef, widgets] of pageWidgets) {
    this.flattenWidgetsOnPage(pageRef, widgets);
  }

  // Clear form structure
  this.dict.set("Fields", new PdfArray([]));
  this.dict.delete("NeedAppearances");

  // Clear field cache
  this.fieldsCache = null;
}

interface FlattenOptions {
  /** Skip appearance update (use if appearances are known good) */
  skipAppearanceUpdate?: boolean;
}
```

### Collect Widgets by Page

```typescript
private collectWidgetsByPage(): Map<PdfRef, WidgetAnnotation[]> {
  const result = new Map<PdfRef, WidgetAnnotation[]>();

  for (const field of this.getFields()) {
    for (const widget of field.getWidgets()) {
      const pageRef = widget.pageRef;
      if (!pageRef) {
        // Try to find page from document structure
        const foundPageRef = this.findPageForWidget(widget);
        if (!foundPageRef) continue;
      }

      const key = pageRef!;
      if (!result.has(key)) {
        result.set(key, []);
      }
      result.get(key)!.push(widget);
    }
  }

  return result;
}

/**
 * Find page containing a widget by scanning /Annots arrays.
 */
private findPageForWidget(widget: WidgetAnnotation): PdfRef | null {
  // This is expensive but needed for widgets without /P
  // Could cache page → annots mapping
  const pages = this.registry.getPageTree();

  for (let i = 0; i < pages.pageCount; i++) {
    const pageRef = pages.getPageRef(i);
    const pageDict = this.registry.resolve(pageRef) as PdfDict;
    const annots = pageDict?.getArray("Annots");

    if (annots) {
      for (const annotRef of annots) {
        if (annotRef instanceof PdfRef &&
            widget.ref &&
            annotRef.equals(widget.ref)) {
          return pageRef;
        }
      }
    }
  }

  return null;
}
```

### Flatten Widgets on Page

```typescript
private flattenWidgetsOnPage(pageRef: PdfRef, widgets: WidgetAnnotation[]): void {
  const pageDict = this.registry.resolve(pageRef) as PdfDict;
  if (!pageDict) return;

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

  for (let i = 0; i < widgets.length; i++) {
    const widget = widgets[i];

    // Get appearance stream
    const appearance = widget.getNormalAppearance(
      widget.appearanceState ?? undefined
    );
    if (!appearance) continue;

    // Skip invisible or hidden widgets
    if (this.isWidgetHidden(widget)) continue;

    // Add appearance as XObject
    const xObjectName = `FlatField${i}`;
    const appearanceRef = this.registry.register(appearance);
    xObjects.set(xObjectName, appearanceRef);

    // Calculate transformation
    const matrix = this.calculateTransformMatrix(widget, appearance);

    // Add drawing operators
    content.add(
      pushGraphicsState(),
      concatMatrix(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f),
      drawXObject("/" + xObjectName),
      popGraphicsState()
    );

    // Track widget ref for removal
    if (widget.ref) {
      widgetRefs.add(widget.ref.toString());
    }
  }

  // Append content to page
  if (!content.isEmpty()) {
    this.appendToPageContent(pageDict, content.toBytes());
  }

  // Remove widget annotations from page
  this.removeAnnotations(pageDict, widgetRefs);
}
```

### Transform Matrix Calculation

```typescript
/**
 * Calculate transformation matrix to position appearance in widget rect.
 *
 * The appearance stream has a BBox defining its coordinate system.
 * We need to transform this to fit in the widget's Rect on the page.
 */
private calculateTransformMatrix(
  widget: WidgetAnnotation,
  appearance: PdfStream
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

  // Handle rotation from widget's /MK.R
  const rotation = widget.rotation;

  // Calculate scale factors
  let scaleX = bboxWidth !== 0 ? rectWidth / bboxWidth : 1;
  let scaleY = bboxHeight !== 0 ? rectHeight / bboxHeight : 1;

  // Apply rotation
  let a: number, b: number, c: number, d: number, e: number, f: number;

  switch (rotation) {
    case 90:
      a = 0;
      b = scaleX;
      c = -scaleY;
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
      a = 0;
      b = -scaleX;
      c = scaleY;
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

private getAppearanceBBox(appearance: PdfStream): [number, number, number, number] {
  const bbox = appearance.dict.getArray("BBox");
  if (!bbox || bbox.length < 4) {
    return [0, 0, 1, 1]; // Fallback
  }
  return [
    (bbox.get(0) as PdfNumber)?.value ?? 0,
    (bbox.get(1) as PdfNumber)?.value ?? 0,
    (bbox.get(2) as PdfNumber)?.value ?? 0,
    (bbox.get(3) as PdfNumber)?.value ?? 0,
  ];
}

interface TransformMatrix {
  a: number; b: number; c: number;
  d: number; e: number; f: number;
}
```

### Page Content Manipulation

```typescript
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
    // Single stream - convert to array
    page.set("Contents", PdfArray.of([existing, newRef]));
  }
}

/**
 * Remove specific annotations from page.
 */
private removeAnnotations(page: PdfDict, toRemove: Set<string>): void {
  const annots = page.getArray("Annots");
  if (!annots) return;

  const remaining = annots.items.filter(item => {
    if (item instanceof PdfRef) {
      return !toRemove.has(item.toString());
    }
    return true; // Keep non-ref items (shouldn't happen but be safe)
  });

  if (remaining.length === 0) {
    page.delete("Annots");
  } else if (remaining.length < annots.length) {
    page.set("Annots", PdfArray.of(remaining));
  }
}

/**
 * Check if widget should be skipped (hidden/invisible).
 */
private isWidgetHidden(widget: WidgetAnnotation): boolean {
  // Check annotation flags
  const flags = widget.dict.getNumber("F")?.value ?? 0;

  const HIDDEN = 1 << 1;      // Bit 2: Hidden
  const INVISIBLE = 1 << 0;   // Bit 1: Invisible
  const NO_VIEW = 1 << 5;     // Bit 6: NoView

  return (flags & (HIDDEN | INVISIBLE | NO_VIEW)) !== 0;
}
```

### High-Level API

```typescript
// In PDF class or as Form method

/**
 * Flatten form fields into static content.
 */
async flattenForm(): Promise<void> {
  const form = this.getForm();
  if (!form) return;

  form.flatten();
}
```

## Usage Examples

```typescript
// Load and fill form
const pdf = await PDF.load(bytes);
const form = pdf.getForm()!;

form.getField("name").setValue("John Doe");
form.getField("email").setValue("john@example.com");
form.getField("agree").setValue(true);

// Flatten and save
form.flatten();
const flattened = await pdf.save();

// Verify no form remains
const reloaded = await PDF.load(flattened);
assert(reloaded.getForm() === null || reloaded.getForm()!.getFields().length === 0);
```

## File Structure

```
src/document/
├── acro-form.ts           # + flatten() method
└── ...

No new files needed - flattening is part of AcroForm class.
```

## Test Plan

### Basic Flattening

1. Flatten form with text fields → appearances in page content
2. Flatten form with checkboxes → correct state rendered
3. Flatten form with radio buttons → selected option rendered
4. Flatten form with dropdowns → selected value rendered
5. Flatten empty form → no errors, empty fields
6. Flatten already-flattened form → no-op

### Transform Matrix

1. Widget at origin → identity-ish transform
2. Widget with offset → translation applied
3. Widget with scaling (BBox ≠ Rect size) → scaled correctly
4. Widget with 90° rotation → rotated correctly
5. Widget with 180° rotation → rotated correctly
6. Widget with 270° rotation → rotated correctly

### Page Content

1. Page with no existing content → content set
2. Page with single content stream → converted to array
3. Page with content array → appended to array
4. Content resources include flattened XObjects

### Annotation Removal

1. Widget annotations removed from /Annots
2. Non-widget annotations preserved
3. Empty /Annots array removed entirely
4. Widget without /P found via page scan

### AcroForm Cleanup

1. /Fields cleared (empty array)
2. /NeedAppearances removed
3. Form.getFields() returns empty after flatten

### Edge Cases

1. **Hidden widgets** - Skipped (not rendered)
2. **Widget without appearance** - Skipped with warning
3. **Widget without /P** - Page found via scan
4. **Appearance without BBox** - Fallback BBox used
5. **Zero-size widget** - Handled gracefully
6. **Multi-page form** - All pages processed

### Round-Trip

1. Fill → flatten → save → load → verify no form
2. Fill → flatten → save → visual verification (manual)
3. Flatten → can still parse as valid PDF

## Limitations

1. **Signatures** - Flattening destroys signature validity
2. **JavaScript** - Calculations lost
3. **XFA forms** - Not supported
4. **Streaming** - Entire form processed in memory

## Dependencies

- Plan 017a: Content operators (pushGraphicsState, concatMatrix, drawXObject)
- Plan 017b: Form reading (field/widget access)
- Plan 017c: Appearance generation (updateAppearances)
- ObjectRegistry for registering streams
- PageTree for page access (finding widgets without /P)
