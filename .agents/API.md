# API Reference

User-facing API documentation for @libpdf/core.

## PDF Class

Main entry point for loading, creating, and manipulating PDF documents.

### Loading and Creating

```typescript
import { PDF } from "@libpdf/core";

// Loading
const pdf = await PDF.load(bytes);
const pdf = await PDF.load(bytes, { credentials: "password" });

// Creating
const pdf = PDF.create();

// Merging
const merged = await PDF.merge([bytes1, bytes2, bytes3]);
```

### Page Operations

```typescript
// Pages
const pages = await pdf.getPages();
const page = await pdf.getPage(0);
const count = pdf.getPageCount();

// Modification
pdf.addPage({ size: "letter" });
pdf.addPage({ width: 400, height: 600 });
pdf.insertPage(0, pageDict);
pdf.removePage(0);
pdf.movePage(0, 2);

// Extract and copy pages
const extracted = await pdf.extractPages([0, 2, 4]);
await pdf.copyPagesFrom(otherPdf, [0, 1]);

// Page embedding (for overlays, watermarks)
const embedded = await pdf.embedPage(otherPdf, 0);
page.drawPage(embedded, { x: 50, y: 100, scale: 0.5, opacity: 0.3 });
```

### Forms

```typescript
const form = await pdf.getForm();
form?.fill({ name: "John", agreed: true });
await form?.flatten();
```

### Fonts

```typescript
const font = pdf.embedFont(fontBytes);
const fontRef = pdf.getFontRef(font);
```

### Attachments

```typescript
await pdf.addAttachment("doc.pdf", data, { description: "Attached PDF" });
const attachment = await pdf.getAttachment("doc.pdf");
```

### Saving

```typescript
const bytes = await pdf.save(); // Full rewrite
const bytes = await pdf.save({ incremental: true }); // Append only
```

## PDFPage Class

Wrapper for individual pages with dimension and drawing methods.

### Dimensions and Boxes

```typescript
// Dimensions
page.width; // Points, rotation-aware
page.height;
page.rotation; // 0, 90, 180, 270

// Box accessors
page.getMediaBox();
page.getCropBox();
page.getTrimBox();
page.getBleedBox();
page.getArtBox();

// Modification
page.setRotation(90);
```

### Drawing Methods

```typescript
// Shapes
page.drawRectangle({ x, y, width, height, color, borderColor, borderWidth, opacity, rotate });
page.drawLine({ start: { x, y }, end: { x, y }, color, thickness, dashArray, opacity });
page.drawCircle({ x, y, radius, color, borderColor, borderWidth, opacity });
page.drawEllipse({ x, y, xScale, yScale, color, borderColor, borderWidth, opacity });

// Text
page.drawText("Hello World", { x, y, font, fontSize, color, opacity, rotate });
page.drawText(longText, { x, y, font, fontSize, maxWidth, lineHeight, align });

// Images
const image = await pdf.embedImage(bytes);
page.drawImage(image, { x, y, width, height, opacity, rotate });

// Embedded pages (for overlays, watermarks)
const embedded = await pdf.embedPage(sourcePdf, 0);
page.drawPage(embedded, { x, y, scale, opacity, background });

// Custom paths
page
  .drawPath()
  .moveTo(100, 100)
  .lineTo(200, 150)
  .curveTo(250, 200, 300, 150, 350, 100)
  .close()
  .fill({ color: rgb(1, 0, 0) });
```

### Text Features

| Feature      | Description                                          |
| ------------ | ---------------------------------------------------- |
| `maxWidth`   | Automatic word wrapping at specified width           |
| `lineHeight` | Line spacing multiplier                              |
| `align`      | Text alignment: "left", "center", "right", "justify" |
| `rotate`     | Rotation in degrees around origin                    |

## Color Helpers

```typescript
import { rgb, cmyk, grayscale } from "@libpdf/core";

rgb(1, 0, 0); // Red in RGB
cmyk(0, 1, 1, 0); // Red in CMYK
grayscale(0.5); // 50% gray
```

## PDFForm Class

Form filling, reading, and flattening.

```typescript
const form = await pdf.getForm();

// Field access
const fields = form.getFields();
const textField = form.getTextField("name");
const checkbox = form.getCheckbox("agree");
const radio = form.getRadioGroup("options");
const dropdown = form.getDropdown("country");

// Bulk fill
form.fill({
  name: "John Doe",
  agree: true,
  options: "option1",
});

// Read values
textField.getValue();
checkbox.isChecked();

// Write values
textField.setValue("New value");
checkbox.check();

// Appearance and flattening
await form.updateAppearances();
await form.flatten();
```

## PDFAttachments Class

Embedded file management.

```typescript
const attachments = pdf.attachments;
await attachments.add("file.pdf", data, { description: "..." });
await attachments.get("file.pdf");
await attachments.remove("file.pdf");
await attachments.list(); // Map<string, AttachmentInfo>
```

## PDFEmbeddedPage Class

Represents a page embedded as a Form XObject (for overlays/watermarks).

```typescript
const embedded = await pdf.embedPage(sourcePdf, 0);
embedded.ref; // PdfRef to the XObject
embedded.width; // Original page width
embedded.height; // Original page height
embedded.box; // Bounding box
```

## PDFImage Class

Represents an embedded image that can be drawn on pages.

```typescript
const image = await pdf.embedImage(bytes); // Auto-detect format
const image = await pdf.embedJpeg(bytes); // Force JPEG
const image = await pdf.embedPng(bytes); // Force PNG

image.ref; // PdfRef to the XObject
image.width; // Original image width
image.height; // Original image height
```

## Digital Signatures

```typescript
import { PDF } from "@libpdf/core";

const pdf = await PDF.load(bytes);

// Basic signing (B-B level)
const signed = await pdf.sign({
  signer: await P12Signer.create(p12Bytes, "password"),
  reason: "I approve this document",
});

// With timestamp (B-T level)
const signed = await pdf.sign({
  signer,
  timestampAuthority: new HttpTimestampAuthority("http://tsa.example.com"),
});

// Long-term archival (B-LTA level)
const signed = await pdf.sign({
  signer,
  level: "B-LTA",
  timestampAuthority,
});

// Multiple signatures (each returns new bytes)
let bytes = await pdf.sign({ signer: signer1, fieldName: "Author" });
bytes = await (await PDF.load(bytes)).sign({ signer: signer2, fieldName: "Reviewer" });
```

## Annotations

```typescript
// Get annotations from a page
const annotations = await page.getAnnotations();

// Add annotations
page.addHighlightAnnotation({ rects: [...], color: rgb(1, 1, 0) });
page.addLinkAnnotation({ rect: [...], uri: "https://example.com" });
page.addTextAnnotation({ rect: [...], contents: "Note text" });
page.addStampAnnotation({ rect: [...], stampName: "Approved" });

// Remove annotations
await page.removeAnnotation(annotation);
await page.removeAnnotations({ subtypes: ["Highlight", "Underline"] });

// Flatten annotations
await page.flattenAnnotations();
```

### Supported Annotation Types

| Type                    | Class                         | Features                              |
| ----------------------- | ----------------------------- | ------------------------------------- |
| Text markup (highlight) | `PDFHighlightAnnotation`      | QuadPoints, color, opacity            |
| Text markup (underline) | `PDFUnderlineAnnotation`      | QuadPoints with appearance generation |
| Text markup (strikeout) | `PDFStrikeOutAnnotation`      | QuadPoints with appearance generation |
| Text markup (squiggly)  | `PDFSquigglyAnnotation`       | QuadPoints with wavy line appearance  |
| Link                    | `PDFLinkAnnotation`           | URI, GoTo, Named destinations         |
| Text (sticky note)      | `PDFTextAnnotation`           | Icons, open/closed state              |
| FreeText                | `PDFFreeTextAnnotation`       | Direct text on page                   |
| Line                    | `PDFLineAnnotation`           | Start/end points, line endings        |
| Square                  | `PDFSquareAnnotation`         | Rectangle with border/fill            |
| Circle                  | `PDFCircleAnnotation`         | Ellipse with border/fill              |
| Polygon                 | `PDFPolygonAnnotation`        | Closed path with vertices             |
| Polyline                | `PDFPolylineAnnotation`       | Open path with vertices               |
| Ink                     | `PDFInkAnnotation`            | Freehand drawing paths                |
| Stamp                   | `PDFStampAnnotation`          | Standard and custom stamps            |
| Caret                   | `PDFCaretAnnotation`          | Text insertion point                  |
| FileAttachment          | `PDFFileAttachmentAnnotation` | Embedded file with icon               |
| Popup                   | `PDFPopupAnnotation`          | Associated popup for markup annots    |

## Text Extraction

```typescript
// Extract text from a page
const text = await page.extractText();
// Returns: "Hello World\nSecond line..."

// Extract with position information
const result = await page.extractText({ includePositions: true });
// Returns: { text: "...", lines: [{ text, chars: [{ char, x, y, width, height }] }] }

// Search for text
const matches = await page.findText("search term");
// Returns: [{ text, rect: { x, y, width, height }, pageIndex }]

// Search with regex
const matches = await page.findText(/pattern/gi);

// Document-level search
const allMatches = await pdf.findText("term");
```

## Layers (OCG)

Optional Content Groups (layers) detection and flattening.

```typescript
// Check for layers
if (pdf.hasLayers()) {
  const layers = await pdf.getLayers();
  // Returns: [{ name, visible, locked, intent }, ...]

  // Flatten to make all content visible and remove OCG
  await pdf.flattenLayers();
}
```

**Use case**: Required before signing to prevent hidden content attacks.
