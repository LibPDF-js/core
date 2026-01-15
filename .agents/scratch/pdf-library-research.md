# PDF Library Feature Research

Research compiled from pdf-lib, pdf.js, PDFBox, PDFKit, jsPDF, MuPDF, Poppler, pikepdf, pypdf, and commercial SDK documentation.

---

## Feature Categories

### 1. Document Operations

| Feature                 | pdf-lib | pdf.js | PDFBox | PDFKit | jsPDF | MuPDF | pikepdf |
| ----------------------- | ------- | ------ | ------ | ------ | ----- | ----- | ------- |
| Create new PDF          | Yes     | -      | Yes    | Yes    | Yes   | Yes   | Yes     |
| Load/parse existing     | Yes     | Yes    | Yes    | -      | -     | Yes   | Yes     |
| Save (full rewrite)     | Yes     | Yes    | Yes    | Yes    | Yes   | Yes   | Yes     |
| Save (incremental)      | -       | Yes    | Yes    | -      | -     | Yes   | Yes     |
| Merge PDFs              | Yes     | -      | Yes    | -      | -     | Yes   | Yes     |
| Split PDFs              | Yes     | -      | Yes    | -      | -     | Yes   | Yes     |
| Copy pages between docs | Yes     | -      | Yes    | -      | -     | Yes   | Yes     |
| Linearization           | -       | Yes    | -      | -      | -     | Yes   | Yes     |
| Repair damaged PDFs     | -       | Yes    | Yes    | -      | -     | Yes   | Yes     |

### 2. Page Operations

| Feature          | Description                                    |
| ---------------- | ---------------------------------------------- |
| Add/insert pages | Add blank or sized pages at any position       |
| Remove pages     | Delete pages by index                          |
| Reorder pages    | Move pages within document                     |
| Rotate pages     | 0, 90, 180, 270 degrees                        |
| Scale pages      | Resize page dimensions and content             |
| Crop pages       | Modify CropBox, TrimBox, BleedBox, ArtBox      |
| Extract pages    | Copy pages to new document                     |
| Page labels      | Custom page numbering (i, ii, 1, 2, A-1, etc.) |

### 3. Drawing & Graphics

| Feature                | Description                                     |
| ---------------------- | ----------------------------------------------- |
| **Text**               |                                                 |
| Draw text              | Position, font, size, color                     |
| Text wrapping          | Automatic line breaks, max width                |
| Text alignment         | Left, center, right, justify                    |
| Rich text              | Inline style changes (bold/italic mid-sentence) |
| Character/word spacing | Fine-grained text layout control                |
| Text rotation          | Arbitrary angle rotation                        |
| **Shapes**             |                                                 |
| Lines                  | With thickness, dash pattern, line cap/join     |
| Rectangles             | Fill, stroke, rounded corners                   |
| Circles/Ellipses       | Fill and stroke                                 |
| Polygons               | Arbitrary closed shapes                         |
| Bezier curves          | Quadratic and cubic                             |
| SVG paths              | Parse and render SVG path data                  |
| **Transforms**         |                                                 |
| Translate              | Move origin                                     |
| Scale                  | Resize content                                  |
| Rotate                 | Rotate around point                             |
| Matrix                 | Arbitrary affine transform                      |
| **State**              |                                                 |
| Graphics state stack   | Save/restore (q/Q)                              |
| Clipping paths         | Restrict drawing area                           |
| Blend modes            | Multiply, screen, overlay, etc.                 |
| Opacity                | Fill and stroke alpha                           |

### 4. Colors & Color Spaces

| Color Space    | Description                 |
| -------------- | --------------------------- |
| DeviceRGB      | Standard RGB                |
| DeviceCMYK     | Print-ready CMYK            |
| DeviceGray     | Grayscale                   |
| CalRGB/CalGray | Calibrated color            |
| Lab            | CIE Lab color               |
| ICCBased       | ICC profile-based           |
| Indexed        | Palette-based               |
| Separation     | Spot colors                 |
| DeviceN        | Multi-channel               |
| Pattern        | Tiling and shading patterns |

### 5. Fonts

| Feature            | Description                                     |
| ------------------ | ----------------------------------------------- |
| Standard 14 fonts  | Helvetica, Times, Courier, Symbol, ZapfDingbats |
| TrueType embedding | .ttf files with subsetting                      |
| OpenType embedding | .otf files (CFF outlines) with subsetting       |
| WOFF/WOFF2         | Web font formats                                |
| Font subsetting    | Include only used glyphs                        |
| Font metrics       | Width, height, ascent, descent                  |
| Text measurement   | Calculate rendered dimensions                   |
| OpenType features  | Ligatures, alternates, etc.                     |
| CMap support       | Character code to CID mapping                   |
| ToUnicode          | Enable text extraction                          |

### 6. Images

| Feature          | Description                       |
| ---------------- | --------------------------------- |
| JPEG embedding   | Direct embedding (no re-encoding) |
| PNG embedding    | With alpha channel support        |
| TIFF embedding   | Multi-page, various compressions  |
| Image extraction | Get images from existing PDFs     |
| Image masks      | Soft masks, stencil masks         |
| Inline images    | Small images in content stream    |
| SVG (rasterized) | Convert to image first            |

### 7. Forms (AcroForms)

| Feature             | Description                                        |
| ------------------- | -------------------------------------------------- |
| **Field Types**     |                                                    |
| Text field          | Single/multi-line, password, rich text             |
| Checkbox            | Check/uncheck with custom appearance               |
| Radio button        | Grouped exclusive selection                        |
| Dropdown (ComboBox) | Single selection, optionally editable              |
| List box            | Single or multi-select                             |
| Push button         | With image or text                                 |
| Signature field     | Placeholder for digital signatures                 |
| **Operations**      |                                                    |
| Read field values   | Get current values                                 |
| Set field values    | Programmatic filling                               |
| Create fields       | Add new interactive fields                         |
| Remove fields       | Delete fields from form                            |
| Flatten forms       | Convert to static content                          |
| Update appearances  | Regenerate visual representation                   |
| Field validation    | Required, format constraints                       |
| Calculation order   | Dependent field chains                             |
| **Data Exchange**   |                                                    |
| FDF import/export   | Forms Data Format                                  |
| XFDF import/export  | XML Forms Data Format                              |
| XFA forms           | XML Forms Architecture (read-only support typical) |

### 8. Annotations

| Type                | Subtype                  | Description                 |
| ------------------- | ------------------------ | --------------------------- |
| **Markup**          | Text                     | Sticky note icon            |
|                     | FreeText                 | Text directly on page       |
|                     | Highlight                | Yellow highlight            |
|                     | Underline                | Underline text              |
|                     | StrikeOut                | Strikethrough text          |
|                     | Squiggly                 | Wavy underline              |
|                     | Caret                    | Insertion mark              |
| **Shape**           | Line                     | Line with optional arrows   |
|                     | Square                   | Rectangle outline/fill      |
|                     | Circle                   | Ellipse outline/fill        |
|                     | Polygon                  | Closed multi-point shape    |
|                     | PolyLine                 | Open multi-point line       |
|                     | Ink                      | Freehand drawing            |
| **Other**           | Link                     | URL or internal destination |
|                     | Stamp                    | Rubber stamp images         |
|                     | FileAttachment           | Embedded file icon          |
|                     | Sound                    | Audio clip                  |
|                     | Movie                    | Video content               |
|                     | Popup                    | Associated popup note       |
|                     | Redact                   | Content removal marking     |
|                     | 3D                       | 3D model (PDF 1.6+)         |
|                     | RichMedia                | Flash, video (PDF 1.7+)     |
| **Operations**      |                          |
| Create annotations  | Add new annotations      |
| Read annotations    | List and inspect         |
| Modify annotations  | Update properties        |
| Delete annotations  | Remove from page         |
| Flatten annotations | Burn into page content   |
| Appearance streams  | Custom visual appearance |

### 9. Digital Signatures

| Feature                | Description                        |
| ---------------------- | ---------------------------------- |
| **Signing**            |                                    |
| PKCS#7 signatures      | Standard CMS signatures            |
| PAdES compliance       | PDF Advanced Electronic Signatures |
| Visible signatures     | Signature appearance on page       |
| Invisible signatures   | No visual representation           |
| Multiple signatures    | Sign already-signed documents      |
| Timestamp signatures   | RFC 3161 timestamp tokens          |
| LTV signatures         | Long-term validation data          |
| External signing       | HSM, smart card integration        |
| **Verification**       |                                    |
| Signature validation   | Check cryptographic integrity      |
| Certificate validation | Chain verification, revocation     |
| Modification detection | Detect post-signing changes        |
| Timestamp validation   | Verify timestamp authority         |

### 10. Security & Encryption

| Feature                   | Description                       |
| ------------------------- | --------------------------------- |
| **Encryption Algorithms** |                                   |
| RC4 40-bit                | Legacy (PDF 1.1)                  |
| RC4 128-bit               | PDF 1.4                           |
| AES-128                   | PDF 1.5                           |
| AES-256                   | PDF 1.7 / 2.0                     |
| **Security Handlers**     |                                   |
| Standard handler          | Password-based                    |
| Public key                | Certificate-based                 |
| **Permissions**           |                                   |
| Print                     | Allow/disallow printing           |
| Copy                      | Allow/disallow text copy          |
| Modify                    | Allow/disallow changes            |
| Annotate                  | Allow/disallow annotations        |
| Fill forms                | Allow/disallow form filling       |
| Extract                   | Allow/disallow content extraction |
| Assemble                  | Allow/disallow page manipulation  |

### 11. Text Extraction

| Feature             | Description                    |
| ------------------- | ------------------------------ |
| Plain text          | Raw text without formatting    |
| Positioned text     | Character/word bounding boxes  |
| Structured text     | Blocks, lines, words hierarchy |
| Reading order       | Logical vs. physical order     |
| Layout preservation | Maintain columns, tables       |
| Unicode mapping     | Proper character decoding      |
| Search              | Find text in document          |
| OCR integration     | Extract from scanned pages     |

### 12. Document Structure

| Feature              | Description                      |
| -------------------- | -------------------------------- |
| **Navigation**       |                                  |
| Outlines/Bookmarks   | Table of contents tree           |
| Named destinations   | Jump targets by name             |
| Page destinations    | XYZ, Fit, FitH, FitV, FitR, FitB |
| Article threads      | Reading flow for multi-column    |
| **Metadata**         |                                  |
| Document info        | Title, author, subject, keywords |
| XMP metadata         | Extensible metadata platform     |
| Custom metadata      | Application-specific data        |
| **Optional Content** |                                  |
| Layers (OCG)         | Show/hide content groups         |
| Layer visibility     | Default state, UI control        |
| Layer locking        | Prevent user changes             |
| **Attachments**      |                                  |
| Embedded files       | Attach any file type             |
| File specifications  | Metadata for attachments         |
| Portfolios           | PDF packages with multiple files |

### 13. Accessibility (PDF/UA)

| Feature         | Description                  |
| --------------- | ---------------------------- |
| Tagged PDF      | Semantic structure tags      |
| Structure tree  | Logical document hierarchy   |
| Alt text        | Image descriptions           |
| Reading order   | Assistive technology order   |
| Language        | Document and span language   |
| Artifacts       | Decorative content marking   |
| Table structure | Headers, cells relationships |
| List structure  | Ordered/unordered lists      |

### 14. Archival (PDF/A)

| Standard | Based On | Key Requirements               |
| -------- | -------- | ------------------------------ |
| PDF/A-1a | PDF 1.4  | Tagged, Unicode, no encryption |
| PDF/A-1b | PDF 1.4  | Visual preservation only       |
| PDF/A-2a | PDF 1.7  | Tagged, JPEG2000, layers       |
| PDF/A-2b | PDF 1.7  | Visual preservation            |
| PDF/A-2u | PDF 1.7  | Unicode text                   |
| PDF/A-3  | PDF 1.7  | Embedded files allowed         |
| PDF/A-4  | PDF 2.0  | Latest features                |

| Requirement      | Description                  |
| ---------------- | ---------------------------- |
| Embedded fonts   | All fonts must be embedded   |
| No encryption    | Document must be unencrypted |
| No JavaScript    | No executable content        |
| No audio/video   | No multimedia                |
| Color management | Device-independent color     |
| Metadata         | XMP metadata required        |

### 15. Rendering

| Feature            | Description            |
| ------------------ | ---------------------- |
| Page to image      | PNG, JPEG, TIFF output |
| Resolution control | Configurable DPI       |
| Color modes        | RGB, CMYK, grayscale   |
| Transparency       | Alpha channel support  |
| Anti-aliasing      | Smooth edges           |
| Canvas rendering   | HTML5 Canvas (browser) |
| SVG output         | Vector format export   |

### 16. Actions & JavaScript

| Action Type | Description                           |
| ----------- | ------------------------------------- |
| GoTo        | Jump to destination in document       |
| GoToR       | Jump to destination in another PDF    |
| GoToE       | Jump to embedded document             |
| Launch      | Open external application             |
| URI         | Open URL                              |
| Named       | Execute named action (NextPage, etc.) |
| JavaScript  | Run JavaScript code                   |
| SubmitForm  | Submit form data                      |
| ResetForm   | Reset form fields                     |
| ImportData  | Import FDF/XFDF                       |
| Hide        | Show/hide annotations                 |

### 17. Viewer Preferences

| Preference        | Description                       |
| ----------------- | --------------------------------- |
| Page mode         | Thumbnails, outlines, attachments |
| Page layout       | Single, continuous, two-up        |
| Hide UI           | Toolbar, menubar, window controls |
| Fit window        | Resize to first page              |
| Center window     | Center on screen                  |
| Display title     | Show document title in title bar  |
| Reading direction | Left-to-right, right-to-left      |
| Print scaling     | None, fit, shrink                 |
| Duplex            | Simplex, duplex flip              |

---

## Library Comparison Summary

### Generation-focused Libraries

| Library     | Language   | Strengths                            | Weaknesses                                   |
| ----------- | ---------- | ------------------------------------ | -------------------------------------------- |
| **pdf-lib** | TypeScript | Pure JS, browser+Node, good API      | No text extraction, no edit existing content |
| **PDFKit**  | Node.js    | Excellent drawing API, accessibility | Generation only                              |
| **jsPDF**   | JavaScript | Client-side, plugin ecosystem        | Basic features, no parsing                   |
| **pdfmake** | JavaScript | Declarative document definition      | Limited customization                        |

### Parsing-focused Libraries

| Library     | Language   | Strengths                        | Weaknesses            |
| ----------- | ---------- | -------------------------------- | --------------------- |
| **pdf.js**  | JavaScript | Mozilla-backed, rendering, forms | Complex, worker-based |
| **MuPDF**   | C/WASM     | Fast, comprehensive, annotations | AGPL license          |
| **Poppler** | C++        | Linux standard, good CLI tools   | GPL license, no JS    |
| **pikepdf** | Python     | qpdf-backed, robust repair       | Python only           |
| **pypdf**   | Python     | Pure Python, easy to use         | Slower than native    |

### Full-featured Libraries

| Library               | Language  | Strengths                  | Weaknesses              |
| --------------------- | --------- | -------------------------- | ----------------------- |
| **PDFBox**            | Java      | Comprehensive, open source | Java only, complex API  |
| **iText**             | Java/.NET | Enterprise features, PDF/A | AGPL/commercial license |
| **PSPDFKit/Nutrient** | Multi     | Best-in-class features     | Commercial only         |
| **Foxit SDK**         | Multi     | Fast rendering             | Commercial only         |

---

## Feature Priorities for @libpdf/core

### Already Implemented

- Document load/save (full + incremental)
- Merge/split/copy pages
- Page manipulation (add, remove, rotate)
- Form reading/filling/flattening
- Font embedding with subsetting
- Attachments
- Encryption/decryption (all revisions)
- Content stream parsing

### High Priority (Common Use Cases)

- [ ] Drawing API (text, shapes, images)
- [ ] Image embedding (JPEG, PNG)
- [ ] Text extraction with positions
- [ ] Annotations (create, read, modify)
- [ ] Digital signatures (sign + verify)

### Medium Priority (Advanced Use Cases)

- [ ] Optional content (layers) - must flatten before signing to prevent hidden content attacks
- [ ] Outlines/bookmarks
- [ ] Named destinations
- [ ] Viewer preferences
- [ ] JavaScript actions (read/write, not execute)
- [ ] XMP metadata

### Lower Priority (Specialized)

- [ ] PDF/A compliance
- [ ] PDF/UA accessibility
- [ ] Rendering to image
- [ ] Redaction (destructive)
- [ ] 3D content
- [ ] Portfolios

---

## Annotation Types Reference

From PDF specification, for implementation planning:

```
Text (sticky note)
Link (URL or goto)
FreeText (text box)
Line
Square
Circle
Polygon
PolyLine
Highlight
Underline
Squiggly
StrikeOut
Stamp
Caret
Ink (freehand)
Popup
FileAttachment
Sound
Movie
Widget (forms)
Screen
PrinterMark
TrapNet
Watermark
3D
Redact
Projection
RichMedia
```

---

## Digital Signature Standards

### PAdES Levels

| Level     | Name              | Description                                    |
| --------- | ----------------- | ---------------------------------------------- |
| PAdES-B   | Basic             | Basic signature with signer certificate        |
| PAdES-T   | Timestamp         | Adds trusted timestamp                         |
| PAdES-LT  | Long-Term         | Adds validation data (OCSP, CRL)               |
| PAdES-LTA | Long-Term Archive | Adds archive timestamp for indefinite validity |

### Signature Types

| Type          | Location        | Description                       |
| ------------- | --------------- | --------------------------------- |
| Approval      | Signature field | User approval signature           |
| Certification | Document-level  | Author signature with permissions |
| Timestamp     | Document-level  | Time attestation only             |
| Usage Rights  | Document-level  | Adobe Reader extensions           |

---

## Sources

- pdf-lib: checkouts/pdf-lib, https://pdf-lib.js.org
- pdf.js: checkouts/pdfjs, https://mozilla.github.io/pdf.js
- PDFBox: checkouts/pdfbox, https://pdfbox.apache.org
- PDFKit: https://pdfkit.org
- jsPDF: https://github.com/parallax/jsPDF
- MuPDF: https://mupdf.com, https://mupdf.readthedocs.io
- Poppler: https://poppler.freedesktop.org
- pikepdf: https://pikepdf.readthedocs.io
- pypdf: https://pypdf.readthedocs.io
- PSPDFKit/Nutrient: https://pspdfkit.com
- PDF Association: https://pdfa.org
- ISO 32000-2 (PDF 2.0 specification)
