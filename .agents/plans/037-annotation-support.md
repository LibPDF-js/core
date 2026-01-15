# 037 - Annotation Support

This plan covers adding comprehensive annotation support to @libpdf/core, including reading, adding, removing, drawing, and flattening annotations.

## Problem Statement

Currently, @libpdf/core only supports Widget annotations (form field widgets) through the forms subsystem. The library lacks support for other annotation types that are common in PDF workflows:

- **Text annotations** (sticky notes)
- **Link annotations** (hyperlinks, internal navigation)
- **Markup annotations** (highlight, underline, strikeout, squiggly)
- **Shape annotations** (line, square, circle, polygon, polyline)
- **Text markup** (FreeText annotations)
- **Stamps** (rubber stamp annotations)
- **Ink annotations** (freehand drawings)
- **File attachment annotations**

These are needed for:

- Review workflows (comments, highlights, stamps)
- Interactive PDFs (links, navigation)
- Print-ready PDFs (flattening annotations)

## Goals

1. **Read annotations** - Parse all standard annotation types from existing PDFs
2. **Add annotations** - Create and add annotations to pages programmatically
3. **Remove annotations** - Delete annotations from pages (with cascade to linked Popups)
4. **Modify annotations** - Update annotation properties (auto-tracked for incremental save)
5. **Flatten annotations** - Convert annotation appearances to static page content
6. **Draw annotations** - Generate appearance streams for annotations that lack them

## Non-Goals

- Custom annotation handlers (beyond standard types)
- 3D annotations
- Movie/Screen annotations (multimedia)
- Redaction (requires content removal, not just visual hiding)
- Annotation validation/conformance checking
- Widget annotation management (handled by existing forms subsystem)

## Scope

### Annotation Types to Support

Based on PDF spec Table 169 and reference library analysis:

| Priority | Type           | Subtype          | Description               |
| -------- | -------------- | ---------------- | ------------------------- |
| P1       | Link           | `Link`           | Hyperlinks, go-to actions |
| P1       | Text           | `Text`           | Sticky notes/comments     |
| P1       | Highlight      | `Highlight`      | Yellow highlight          |
| P1       | Underline      | `Underline`      | Text underline            |
| P1       | StrikeOut      | `StrikeOut`      | Strikethrough             |
| P1       | Squiggly       | `Squiggly`       | Wavy underline            |
| P2       | FreeText       | `FreeText`       | Text box on page          |
| P2       | Line           | `Line`           | Line with optional arrows |
| P2       | Square         | `Square`         | Rectangle                 |
| P2       | Circle         | `Circle`         | Ellipse                   |
| P2       | Stamp          | `Stamp`          | Rubber stamps             |
| P2       | Ink            | `Ink`            | Freehand drawings         |
| P3       | Polygon        | `Polygon`        | Filled polygon            |
| P3       | PolyLine       | `PolyLine`       | Polyline                  |
| P3       | Caret          | `Caret`          | Insertion caret           |
| P3       | FileAttachment | `FileAttachment` | Embedded file icon        |
| P3       | Popup          | `Popup`          | Associated popup window   |

**Handled Separately:** Widget annotations (via forms subsystem - completely separate, not exposed via annotation API)

**Out of Scope:** Sound, Movie, Screen, PrinterMark, TrapNet, Watermark, 3D, Redact

## Key Design Decisions

### Widget Annotation Separation

Widget annotations are **completely separate** from this annotation system. They are accessed only via `PDFForm`. The `getAnnotations()` method excludes widgets entirely. This maintains backwards compatibility and keeps the forms subsystem self-contained.

### Link Action Security

For Link annotations, we support a **safe subset of actions only**:

- **Supported:** URI actions, GoTo actions (internal navigation)
- **Ignored/Warned:** JavaScript, Launch, ImportData, and other potentially dangerous actions

This protects users from security risks. Dangerous action types are not parsed or exposed.

### Flatten Behavior for Missing Appearances

When flattening annotations that have no appearance stream and we cannot generate one (e.g., custom stamp names, unrecognized icons):

- **Remove the annotation** - The annotation is deleted from the page
- This ensures a clean result without orphaned interactive elements

### Popup Annotation Handling

Popup annotations are accessed via a **dedicated method**, consistent with other annotation types:

- `page.getAnnotations()` - excludes Popups (they're not standalone)
- `page.getPopupAnnotations()` - get all Popups on a page
- `annotation.getPopup()` - access Popup linked from a markup annotation

Popups are **never auto-created**. Users explicitly create them if needed via `annotation.createPopup()`.

### Cascade Deletion

When removing an annotation via `page.removeAnnotation(annot)`:

- The annotation is removed from the page's Annots array
- Any linked Popup annotation is also removed
- Appearance streams are left in place (may be shared; garbage collected later)

### Incremental Save Support

Annotation modifications are **fully tracked** for incremental saves:

- New annotations are appended in incremental updates
- Modified annotations are re-written in incremental updates
- This preserves digital signatures on documents

### Change Tracking

Annotation property changes are **auto-tracked**:

- Any property setter (e.g., `highlight.setColor(red)`) automatically marks the annotation as modified
- The document is marked dirty for save
- No explicit `markModified()` call required

### Malformed Annotation Handling

When parsing annotations from PDFs with invalid/missing data:

- **Lenient with defaults** - Use sensible defaults for missing data
- Missing Rect defaults to `[0, 0, 0, 0]`
- Invalid QuadPoints are normalized or defaulted
- Corrupt appearance streams are treated as missing
- Matches library's overall "be lenient" philosophy

### Caching Strategy

Parsed annotation objects are **cached always**:

- `getAnnotations()` returns the same object instances on repeated calls
- Faster for repeated access
- Cache is invalidated when annotations are added/removed from the page

### Page Copy Behavior

When copying pages between documents via `copyPagesFrom()`:

- **Default: exclude annotations** - `copyPagesFrom(src, pages)` copies page content only
- **Opt-in:** `copyPagesFrom(src, pages, { includeAnnotations: true })` copies annotations
- This avoids broken internal links and unwanted annotation transfer

## Desired API

### High-Level API (User-Facing)

```typescript
import { PDF } from "@libpdf/core";

const pdf = await PDF.load(bytes);
const page = await pdf.getPage(0);

// === Reading Annotations ===

// Get all annotations on a page (excludes Widgets and Popups)
const annotations = await page.getAnnotations();

// Get specific annotation types (typed return values)
const highlights = await page.getHighlightAnnotations();  // PDFHighlightAnnotation[]
const underlines = await page.getUnderlineAnnotations();  // PDFUnderlineAnnotation[]
const strikeouts = await page.getStrikeOutAnnotations();  // PDFStrikeOutAnnotation[]
const squigglies = await page.getSquigglyAnnotations();   // PDFSquigglyAnnotation[]
const links = await page.getLinkAnnotations();            // PDFLinkAnnotation[]
const textAnnots = await page.getTextAnnotations();       // PDFTextAnnotation[]
const freeTexts = await page.getFreeTextAnnotations();    // PDFFreeTextAnnotation[]
const lines = await page.getLineAnnotations();            // PDFLineAnnotation[]
const squares = await page.getSquareAnnotations();        // PDFSquareAnnotation[]
const circles = await page.getCircleAnnotations();        // PDFCircleAnnotation[]
const stamps = await page.getStampAnnotations();          // PDFStampAnnotation[]
const inks = await page.getInkAnnotations();              // PDFInkAnnotation[]
const polygons = await page.getPolygonAnnotations();      // PDFPolygonAnnotation[]
const polylines = await page.getPolylineAnnotations();    // PDFPolylineAnnotation[]
const carets = await page.getCaretAnnotations();          // PDFCaretAnnotation[]
const fileAttachments = await page.getFileAttachmentAnnotations(); // PDFFileAttachmentAnnotation[]
const popups = await page.getPopupAnnotations();          // PDFPopupAnnotation[]

// Get annotation properties
for (const annot of annotations) {
  console.log(annot.type);        // "Highlight", "Link", etc.
  console.log(annot.rect);        // { x, y, width, height }
  console.log(annot.contents);    // Text content/alt description
  console.log(annot.color);       // { r, g, b } or null
  console.log(annot.flags);       // AnnotationFlags
}

// Type-specific properties (already typed from getXxxAnnotations)
for (const link of links) {
  console.log(link.destination);  // Internal destination or null
  console.log(link.uri);          // External URI or null
}

for (const hl of highlights) {
  console.log(hl.quadPoints);     // Raw: number[][] (advanced use)
  console.log(hl.getBounds());    // Convenience: { x, y, width, height }
  console.log(hl.opacity);        // 0-1

  // Access linked Popup
  const popup = hl.getPopup();    // PDFPopupAnnotation or null
}

// === Adding Annotations ===
// All add methods are synchronous. Appearance streams are generated lazily on save/flatten.

// Text annotation (sticky note)
page.addTextAnnotation({
  rect: { x: 100, y: 500, width: 24, height: 24 },
  contents: "This is a comment",
  title: "Reviewer Name",
  color: rgb(1, 1, 0),  // Yellow
  icon: "Comment",      // "Comment", "Note", "Help", "Paragraph", etc.
});

// Highlight annotation - simple rect for horizontal text (common case)
page.addHighlightAnnotation({
  rect: { x: 100, y: 680, width: 200, height: 20 },
  color: rgb(1, 1, 0),  // Yellow
  opacity: 0.5,
});

// Highlight annotation - multiple rects (e.g., multi-line selection)
page.addHighlightAnnotation({
  rects: [
    { x: 100, y: 700, width: 400, height: 14 },  // Line 1
    { x: 100, y: 680, width: 250, height: 14 },  // Line 2
  ],
  color: rgb(1, 1, 0),
});

// Highlight annotation - raw quadPoints for rotated/skewed text (advanced)
page.addHighlightAnnotation({
  quadPoints: [
    // Each quad: 8 numbers defining 4 corners in counterclockwise order
    [x1, y1, x2, y2, x3, y3, x4, y4],
  ],
  color: rgb(1, 1, 0),
});

// Underline annotation - same rect-based API
page.addUnderlineAnnotation({
  rect: { x: 100, y: 680, width: 200, height: 14 },
  color: rgb(0, 0, 1),  // Blue
});

// StrikeOut annotation
page.addStrikeOutAnnotation({
  rect: { x: 100, y: 680, width: 200, height: 14 },
  color: rgb(1, 0, 0),  // Red
});

// Squiggly underline
page.addSquigglyAnnotation({
  rect: { x: 100, y: 680, width: 200, height: 14 },
  color: rgb(1, 0, 0),
});

// Link annotation with URI
page.addLinkAnnotation({
  rect: { x: 100, y: 600, width: 200, height: 20 },
  uri: "https://example.com",
  borderWidth: 0,  // No visible border
});

// Link annotation with internal destination
// Page can be: zero-based index, or PDFPage object
page.addLinkAnnotation({
  rect: { x: 100, y: 600, width: 200, height: 20 },
  destination: { page: 5, type: "Fit" },      // Zero-based index
  // OR: destination: { page: targetPage, type: "Fit" }  // PDFPage object
});

// FreeText annotation
page.addFreeTextAnnotation({
  rect: { x: 100, y: 400, width: 200, height: 50 },
  contents: "This is a text callout",
  font: embeddedFont,
  fontSize: 12,
  color: rgb(0, 0, 0),
  backgroundColor: rgb(1, 1, 0.8),
  borderColor: rgb(0, 0, 0),
  borderWidth: 1,
});

// Line annotation
page.addLineAnnotation({
  start: { x: 100, y: 300 },
  end: { x: 300, y: 300 },
  color: rgb(1, 0, 0),
  width: 2,
  startStyle: "None",      // "None", "Square", "Circle", "Diamond", "OpenArrow", "ClosedArrow"
  endStyle: "ClosedArrow",
});

// Square/Rectangle annotation
page.addSquareAnnotation({
  rect: { x: 100, y: 200, width: 100, height: 100 },
  color: rgb(0, 0, 1),
  fillColor: rgb(0.9, 0.9, 1),
  borderWidth: 2,
});

// Circle/Ellipse annotation
page.addCircleAnnotation({
  rect: { x: 250, y: 200, width: 100, height: 100 },
  color: rgb(0, 1, 0),
  borderWidth: 2,
});

// Stamp annotation (built-in appearances for standard stamps)
page.addStampAnnotation({
  rect: { x: 400, y: 500, width: 150, height: 50 },
  name: "Approved",  // "Approved", "Rejected", "Draft", "Final", "Confidential", etc.
});

// Stamp with custom appearance
page.addStampAnnotation({
  rect: { x: 400, y: 500, width: 150, height: 50 },
  appearance: customAppearanceStream,
});

// Ink annotation
page.addInkAnnotation({
  paths: [
    [{ x: 100, y: 100 }, { x: 150, y: 150 }, { x: 200, y: 100 }],
    [{ x: 100, y: 80 }, { x: 200, y: 80 }],
  ],
  color: rgb(0, 0, 1),
  width: 2,
});

// === Creating Popups (explicit, not automatic) ===

const highlight = page.addHighlightAnnotation({ ... });
highlight.createPopup({
  rect: { x: 300, y: 680, width: 200, height: 100 },
  open: true,  // Initially open
});

// === Modifying Annotations ===
// Changes are auto-tracked for incremental save

highlight.setColor(rgb(0, 1, 0));  // Change to green
highlight.setContents("Updated comment");
highlight.setOpacity(0.3);

// === Removing Annotations ===

// Remove specific annotation (also removes linked Popup)
page.removeAnnotation(annotation);

// Remove all annotations of a specific type
await page.removeAnnotations({ type: "Highlight" });
await page.removeAnnotations({ type: "Link" });

// Remove all annotations
await page.removeAnnotations();

// === Flattening Annotations ===
// Annotations without appearances that can't be generated are removed.
// Print flag is ignored - all flattenable annotations are flattened.

// Flatten all annotations on all pages
await pdf.flattenAnnotations();

// Flatten single page
await page.flattenAnnotations();

// Flatten excluding certain types (keep them interactive)
await pdf.flattenAnnotations({
  exclude: ["Link"]  // Keep links interactive (they have no visual to flatten anyway)
});
```

### Low-Level API

```typescript
// Access annotation dictionaries directly
const annotDict = annotation.dict; // PdfDict

// Get raw appearance streams
const normalAppearance = await annotation.getNormalAppearance();
const rolloverAppearance = await annotation.getRolloverAppearance();
const downAppearance = await annotation.getDownAppearance();

// Set appearance streams manually
annotation.setNormalAppearance(appearanceStream);

// Access annotation flags
annotation.hasFlag(AnnotationFlags.Hidden);
annotation.hasFlag(AnnotationFlags.Print);
annotation.setFlag(AnnotationFlags.Print, true);

// Page-level annotation management
const annots = await page.getAnnotsArray(); // PdfArray of refs
page.addAnnotRef(annotRef);
page.removeAnnotRef(annotRef);
```

### Page Copy API

```typescript
// Default: exclude annotations
await targetPdf.copyPagesFrom(sourcePdf, [0, 1, 2]);

// Include annotations (note: internal link destinations may break)
await targetPdf.copyPagesFrom(sourcePdf, [0, 1, 2], {
  includeAnnotations: true,
});
```

## Architecture

### Class Hierarchy

```
PDFAnnotation (base class)
├── rect, contents, color, flags, appearances
├── getNormalAppearance(), setNormalAppearance()
├── getPopup(), createPopup()
├── markModified() [called automatically by setters]
├── PDFLinkAnnotation
│   └── destination, uri (no action property - dangerous actions filtered)
├── PDFMarkupAnnotation (abstract)
│   ├── title, popup, opacity, creationDate, richText
│   ├── PDFTextAnnotation
│   │   └── icon, open, state
│   ├── PDFFreeTextAnnotation
│   │   └── defaultAppearance, justification, defaultStyle
│   ├── PDFLineAnnotation
│   │   └── start, end, lineEndingStyles, interiorColor
│   ├── PDFSquareAnnotation
│   │   └── interiorColor, borderEffect
│   ├── PDFCircleAnnotation
│   │   └── interiorColor, borderEffect
│   ├── PDFPolygonAnnotation
│   │   └── vertices, interiorColor
│   ├── PDFPolylineAnnotation
│   │   └── vertices, lineEndingStyles
│   ├── PDFTextMarkupAnnotation (abstract)
│   │   ├── quadPoints, getBounds()
│   │   ├── PDFHighlightAnnotation
│   │   ├── PDFUnderlineAnnotation
│   │   ├── PDFStrikeOutAnnotation
│   │   └── PDFSquigglyAnnotation
│   ├── PDFStampAnnotation
│   │   └── name
│   ├── PDFInkAnnotation
│   │   └── inkList (paths)
│   ├── PDFCaretAnnotation
│   │   └── symbol
│   └── PDFFileAttachmentAnnotation
│       └── fileSpec, name
└── PDFPopupAnnotation
    └── parent, open
```

### File Structure

```
src/
  annotations/
    index.ts                    # Public exports
    types.ts                    # Shared types (flags, colors, rects)
    base.ts                     # PDFAnnotation base class
    factory.ts                  # Annotation factory (parse by subtype)
    cache.ts                    # Annotation cache per page

    # Annotation types
    link.ts                     # PDFLinkAnnotation
    text.ts                     # PDFTextAnnotation (sticky notes)
    free-text.ts                # PDFFreeTextAnnotation
    line.ts                     # PDFLineAnnotation
    square.ts                   # PDFSquareAnnotation
    circle.ts                   # PDFCircleAnnotation
    polygon.ts                  # PDFPolygonAnnotation, PDFPolylineAnnotation
    text-markup.ts              # Highlight, Underline, StrikeOut, Squiggly
    stamp.ts                    # PDFStampAnnotation
    ink.ts                      # PDFInkAnnotation
    caret.ts                    # PDFCaretAnnotation
    file-attachment.ts          # PDFFileAttachmentAnnotation
    popup.ts                    # PDFPopupAnnotation

    # Appearance generation
    appearance/
      index.ts
      base.ts                   # Base appearance handler
      highlight.ts              # Highlight with transparency group + Multiply blend
      underline.ts              # Underline appearance generation
      strikeout.ts              # StrikeOut appearance generation
      squiggly.ts               # Squiggly wavy line generation
      line.ts                   # Line with arrow endings
      square.ts                 # Square/rectangle appearance
      circle.ts                 # Circle/ellipse appearance
      ink.ts                    # Ink path appearance
      free-text.ts              # FreeText with font rendering

    # Built-in assets
    icons/
      index.ts                  # Icon registry
      text-icons.ts             # Comment, Note, Help, Paragraph, etc.
      stamp-appearances.ts      # Approved, Draft, Confidential, etc.

    # Flattening
    flattener.ts                # AnnotationFlattener
```

### Integration Points

1. **PDFPage**: Add annotation access methods, cache management
2. **PDF**: Add `flattenAnnotations()` method
3. **ObjectRegistry**: Track annotation objects, change tracking
4. **ObjectCopier**: Handle `includeAnnotations` option for page copying
5. **Writer**: Serialize new/modified annotations in incremental saves

## Implementation Approach

### Phase 1: Core Infrastructure & Reading

1. **Base annotation class** (`PDFAnnotation`)
   - Common properties: rect, contents, color, flags, name, modificationDate
   - Appearance stream access (N/R/D)
   - Border style parsing
   - Change tracking (auto-mark dirty on property changes)

2. **Annotation factory** (`AnnotationFactory.create()`)
   - Dispatch to concrete classes based on `/Subtype`
   - Lenient parsing with defaults for malformed data
   - Skip Widget annotations (handled by forms)
   - Fallback to `PDFUnknownAnnotation` for unsupported types

3. **Page integration**
   - `page.getAnnotations()` - parse `/Annots` array, cache results
   - `page.getPopupAnnotations()` - separate access to Popups
   - Type filtering
   - Cache invalidation on add/remove

4. **Caching layer**
   - Cache parsed annotation objects per page
   - Return same instances on repeated calls
   - Invalidate on page annotation changes

### Phase 2: Text Markup Annotations (P1)

1. **PDFTextMarkupAnnotation** base class
   - QuadPoints parsing and normalization
   - `getBounds()` convenience method
   - Common properties (opacity, title, popup)

2. **Concrete types**: Highlight, Underline, StrikeOut, Squiggly

3. **Appearance generation with full transparency support**
   - Highlight: transparency group with `/BM /Multiply` blend mode
   - Underline/StrikeOut: simple lines with opacity
   - Squiggly: wavy sine-wave path

4. **Add methods**: `page.addHighlightAnnotation()`, etc.
   - Accept rect, rects, or quadPoints
   - Synchronous API, lazy appearance generation

### Phase 3: Link Annotations (P1)

1. **PDFLinkAnnotation**
   - Parse `/Dest` (destination) - safe
   - Parse `/A` (action) - **URI and GoTo only**, ignore dangerous types
   - Expose `uri` and `destination` properties, no raw action access

2. **Destination handling**
   - Accept page as zero-based index or PDFPage object
   - Support destination types: Fit, FitH, FitV, FitR, XYZ

3. **Add method**: `page.addLinkAnnotation()`

### Phase 4: Text Annotations (P1)

1. **PDFTextAnnotation** (sticky notes)
   - Icon property with validation against known icons
   - Open/closed state

2. **Built-in icon appearances**
   - Ship pre-built appearance streams for standard icons
   - Comment, Note, Help, Paragraph, Insert, Key, NewParagraph

3. **Popup management**
   - `annotation.getPopup()` - retrieve linked Popup
   - `annotation.createPopup(options)` - explicit creation

### Phase 5: Shape Annotations (P2)

1. **Line, Square, Circle**
   - Interior color (fill)
   - Line ending styles for Line
   - Border effects (cloudy) - basic support

2. **Appearance generation**
   - Path construction
   - Fill and stroke with proper color spaces

### Phase 6: Stamp Annotations (P2)

1. **Built-in stamp appearances**
   - Pre-built for standard stamps: Approved, Rejected, Draft, Final, Confidential, Experimental, Expired, NotApproved, NotForPublicRelease, ForPublicRelease, ForComment, TopSecret, Departmental, AsIs, Sold
   - English text (localization via custom appearances)

2. **Custom stamp support**
   - Accept user-provided appearance stream

### Phase 7: Other Annotations (P2-P3)

1. **FreeText** - text boxes with font/styling
2. **Ink** - freehand path drawing
3. **Polygon/Polyline** - multi-point shapes
4. **Caret** - insertion markers
5. **FileAttachment** - file icons

### Phase 8: Flattening

1. **AnnotationFlattener** class
   - Reuse patterns from `FormFlattener`
   - Handle visibility flags (but ignore Print flag - flatten all)
   - Transform appearance streams to page coordinates

2. **Appearance generation before flatten**
   - Generate missing appearances using appearance handlers
   - **Remove annotations** that have no appearance and can't be generated

3. **Cascade cleanup**
   - Remove flattened annotations from page
   - Remove their linked Popups

### Phase 9: Integration

1. **Incremental save support**
   - Track new/modified annotations via ObjectRegistry
   - Append changes in incremental updates

2. **Page copy integration**
   - Add `includeAnnotations` option to `copyPagesFrom()`
   - Default false, opt-in to include

## Key Implementation Details

### Annotation Flags (from PDF spec)

```typescript
export enum AnnotationFlags {
  Invisible = 1 << 0, // Don't display unknown types
  Hidden = 1 << 1, // Don't display or print
  Print = 1 << 2, // Print when page is printed
  NoZoom = 1 << 3, // Don't scale with page zoom
  NoRotate = 1 << 4, // Don't rotate with page
  NoView = 1 << 5, // Don't display on screen
  ReadOnly = 1 << 6, // Don't allow interaction
  Locked = 1 << 7, // Don't allow deletion/modification
  ToggleNoView = 1 << 8, // Invert NoView for certain events
  LockedContents = 1 << 9, // Don't allow content modification
}
```

### QuadPoints and Rect Conversion

Text markup annotations (Highlight, Underline, StrikeOut, Squiggly) use QuadPoints internally to define regions. QuadPoints support rotated/skewed text, but most use cases involve horizontal text where a simple rect is sufficient.

**Why QuadPoints exist:**

- PDF spec requires them for text markup annotations
- They allow highlighting text at any angle (see PDF spec Figure 64)
- Each quad defines 4 corners of a region in counterclockwise order

**Our API approach - prioritize usability:**

```typescript
// User-friendly input options (choose one):
interface TextMarkupOptions {
  // Option 1: Single rect (most common - horizontal text)
  rect?: { x: number; y: number; width: number; height: number };

  // Option 2: Multiple rects (multi-line selection)
  rects?: { x: number; y: number; width: number; height: number }[];

  // Option 3: Raw quadPoints (advanced - rotated text)
  quadPoints?: number[][]; // Array of [x1,y1,x2,y2,x3,y3,x4,y4]
}
```

**Internal conversion (rect to quadPoints):**

```typescript
function rectToQuadPoints(rect: Rect): number[] {
  // PDF spec order: counterclockwise from bottom-left of text baseline
  const { x, y, width, height } = rect;
  return [
    x,
    y + height, // top-left
    x + width,
    y + height, // top-right
    x + width,
    y, // bottom-right
    x,
    y, // bottom-left
  ];
}

// Multiple rects become multiple quads
function rectsToQuadPoints(rects: Rect[]): number[][] {
  return rects.map(rectToQuadPoints);
}
```

**Reading quadPoints back:**
When reading annotations, we expose the raw quadPoints but also provide a convenience method:

```typescript
const highlight = annot as PDFHighlightAnnotation;
highlight.quadPoints; // Raw: number[][] (for advanced use)
highlight.getBounds(); // Convenience: { x, y, width, height } bounding box
```

### Highlight Transparency Implementation

Highlights require proper transparency to not obscure underlying text:

```typescript
// Appearance stream structure for Highlight
// Uses transparency group with Multiply blend mode
function generateHighlightAppearance(quads: number[][], color: Color): PdfStream {
  const stream = new PdfStream();

  // Set up transparency group
  stream.set("Type", PdfName.of("XObject"));
  stream.set("Subtype", PdfName.of("Form"));
  stream.set(
    "Group",
    new PdfDict({
      S: PdfName.of("Transparency"),
      CS: PdfName.of("DeviceRGB"),
      I: true, // Isolated
      K: false, // Non-knockout
    }),
  );

  // Content with blend mode
  const content = `
    /GS0 gs                    % Graphics state with BM /Multiply
    ${color.r} ${color.g} ${color.b} rg
    ${quads.map(q => quadToPath(q)).join("\n")}
  `;

  // Resources with ExtGState
  stream.set(
    "Resources",
    new PdfDict({
      ExtGState: new PdfDict({
        GS0: new PdfDict({
          Type: PdfName.of("ExtGState"),
          BM: PdfName.of("Multiply"),
          CA: 1, // Stroke opacity
          ca: 1, // Fill opacity (annotation CA handles overall)
        }),
      }),
    }),
  );

  return stream;
}
```

### Appearance Stream Generation

Follow PDFBox's approach with pluggable handlers:

```typescript
interface AppearanceHandler {
  generateNormalAppearance(): PdfStream;
  generateRolloverAppearance?(): PdfStream;
  generateDownAppearance?(): PdfStream;
}

// Lazy generation - called on save or flatten
class PDFAnnotation {
  async ensureAppearance(): Promise<void> {
    if (this.hasNormalAppearance()) return;

    const handler = getAppearanceHandler(this.type);
    if (!handler) {
      // No handler available - annotation will be removed on flatten
      return;
    }

    const appearance = handler.generateNormalAppearance();
    this.setNormalAppearance(appearance);
  }
}
```

### Color Handling

```typescript
// Colors can be grayscale, RGB, or CMYK based on array length
function parseAnnotationColor(arr: number[]): Color | null {
  if (arr.length === 0) return null; // Transparent
  if (arr.length === 1) return grayscale(arr[0]);
  if (arr.length === 3) return rgb(arr[0], arr[1], arr[2]);
  if (arr.length === 4) return cmyk(arr[0], arr[1], arr[2], arr[3]);
  return null;
}
```

### Safe Link Action Parsing

```typescript
function parseLinkAction(actionDict: PdfDict): LinkAction | null {
  const actionType = actionDict.getName("S")?.value;

  switch (actionType) {
    case "URI":
      return { type: "uri", uri: actionDict.getString("URI")?.asString() };

    case "GoTo":
      return { type: "goto", destination: parseDestination(actionDict.get("D")) };

    case "GoToR":
      // Remote GoTo - safe, just references another file
      return { type: "gotoRemote", file: actionDict.getString("F")?.asString(), destination: ... };

    // Dangerous actions - ignore
    case "JavaScript":
    case "Launch":
    case "ImportData":
    case "ResetForm":
    case "SubmitForm":
      // Log warning, return null
      console.warn(`Ignoring potentially dangerous action type: ${actionType}`);
      return null;

    default:
      return null;
  }
}
```

### Change Tracking

```typescript
class PDFAnnotation {
  private _modified = false;

  protected markModified(): void {
    if (!this._modified) {
      this._modified = true;
      this.registry.markDirty(this.ref);
    }
  }

  setColor(color: Color): void {
    this.dict.set("C", colorToArray(color));
    this.markModified();
  }

  setContents(contents: string): void {
    this.dict.set("Contents", PdfString.fromString(contents));
    this.markModified();
  }

  // ... all setters call markModified()
}
```

## Reference Implementation Notes

### From pdf.js

- Factory pattern with switch on `/Subtype`
- QuadPoints normalization for various PDF generators
- Comprehensive flag handling
- Rich appearance stream parsing

### From pdf-lib

- TypeScript API patterns
- Appearance provider callbacks
- Widget-centric (limited annotation support)

### From PDFBox

- Complete annotation type coverage
- Appearance handler architecture
- Flattening via content stream injection
- Transform matrix calculation for positioning

## Test Plan

### Unit Tests

- Parse each annotation type from fixtures
- Create annotations and verify dictionary structure
- Appearance generation correctness (especially highlight transparency)
- QuadPoints normalization and rect conversion
- Flag handling
- Color parsing
- Safe action parsing (verify dangerous actions are filtered)

### Integration Tests

- Add annotations, save, reload, verify
- Flatten annotations, verify visual appearance
- Flatten with missing appearances, verify annotations removed
- Remove annotations, verify Popup cascade
- Incremental saves with annotation changes
- Page copy with/without annotations

### Edge Case Tests

- Malformed annotations (missing Rect, invalid QuadPoints)
- Annotations with corrupt appearance streams
- Custom stamp names (verify removal on flatten)
- Links with dangerous actions (verify filtered)

### Fixtures Needed

- PDFs with various annotation types
- PDFs with annotations lacking appearances
- PDFs with rotated pages and annotations
- PDFs from different generators (Adobe, Preview, etc.)
- PDFs with malformed annotations

## Built-in Assets

### Text Annotation Icons

Pre-built appearance streams for standard icon names:

- Comment (speech bubble)
- Note (lined paper)
- Help (question mark)
- Paragraph (pilcrow)
- Insert (caret)
- Key (key icon)
- NewParagraph (paragraph symbol with arrow)

### Stamp Appearances

Pre-built for standard stamp names (English):

- Approved (green)
- Rejected / NotApproved (red)
- Draft (blue)
- Final (green)
- Confidential / TopSecret (red)
- Experimental (blue)
- Expired (red)
- ForPublicRelease / NotForPublicRelease
- ForComment (blue)
- Departmental
- AsIs
- Sold

## Risks

1. **Appearance generation complexity**: Some annotations (FreeText, Stamp) require significant drawing code.
   - Mitigation: Ship pre-built appearances for standard cases

2. **Cross-viewer compatibility**: Different viewers handle missing appearances differently.
   - Mitigation: Always generate appearances on save/flatten

3. **Quadpoint variations**: Many PDF generators use different quadpoint orderings.
   - Mitigation: Normalize on read (following pdf.js patterns)

4. **Performance**: PDFs with thousands of annotations need efficient handling.
   - Mitigation: Lazy parsing, caching, batch operations

5. **Bundle size**: Built-in icons and stamps add to package size.
   - Mitigation: Keep appearances minimal, consider tree-shaking

## Dependencies

- Drawing layer (for appearance generation)
- Content stream builder
- Font embedding (for FreeText)
- Existing incremental save infrastructure
- ObjectCopier (for page copy with annotations)
