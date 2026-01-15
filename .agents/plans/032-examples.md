# Examples Spec for @libpdf/core

This document specifies the examples to be created for `@libpdf/core`. Each example should be a self-contained, runnable script demonstrating a common PDF workflow.

## Directory Structure

```
examples/
  01-basic/
  02-pages/
  03-forms/
  04-drawing/
  05-images-and-fonts/
  06-metadata/
  07-signatures/
  08-attachments/
  09-merging-and-splitting/
  10-security/
  11-advanced/
```

---

## 01-basic/

### `load-and-inspect.ts`

Load a PDF file, inspect basic metadata (page count, page sizes, whether it's encrypted), and print a summary to the console.

### `create-empty-pdf.ts`

Create a new empty PDF document with a single blank page and save it to disk.

### `load-encrypted.ts`

Load a password-protected PDF by providing credentials, then save an unencrypted copy.

### `save-incremental.ts`

Load a PDF, make a minor modification, and save it using incremental update mode to preserve the original structure.

---

## 02-pages/

### `add-pages.ts`

Create a PDF and add multiple pages with different sizes (letter, A4, custom dimensions).

### `remove-pages.ts`

Load a PDF, remove specific pages by index, and save the result.

### `reorder-pages.ts`

Load a PDF and reorder pages (e.g., reverse order, move first page to end).

### `extract-pages.ts`

Extract a subset of pages from a large PDF into a new, smaller PDF document.

### `copy-pages-between-documents.ts`

Copy pages from one PDF document into another at a specific position.

### `get-page-dimensions.ts`

Load a PDF and iterate through pages, printing each page's dimensions, rotation, and orientation (portrait/landscape).

---

## 03-forms/

### `read-form-fields.ts`

Load a PDF with form fields, iterate through all fields, and print their names, types, and current values.

### `fill-text-fields.ts`

Load a PDF form and fill text fields with values, then save the filled form.

### `fill-checkboxes-and-radios.ts`

Load a PDF form and programmatically check/uncheck checkboxes and select radio button options.

### `fill-dropdowns-and-listboxes.ts`

Load a PDF form with dropdown and listbox fields, select options, and save.

### `bulk-fill-form.ts`

Demonstrate the `form.fill()` method to populate multiple fields at once from a dictionary/object.

### `flatten-form.ts`

Load a filled PDF form and flatten it, converting all fields to static content that can't be edited.

### `create-form-fields.ts`

Create a new PDF with various form fields (text input, checkbox, radio group, dropdown) from scratch.

---

## 04-drawing/

### `draw-text.ts`

Draw text on a page with various options: position, font size, color, rotation, and alignment.

### `draw-shapes.ts`

Draw geometric shapes: rectangles (filled and stroked, with rounded corners), lines, circles, and ellipses.

### `draw-paths.ts`

Use the PathBuilder API to draw custom paths with moveTo, lineTo, curveTo, and closePath operations.

### `add-watermark.ts`

Embed a page from another PDF and draw it as a semi-transparent watermark on all pages of a document.

### `add-page-numbers.ts`

Iterate through all pages of a PDF and add page numbers at the bottom of each page.

### `draw-on-existing-page.ts`

Load an existing PDF and add new content (text, shapes) on top of the existing page content.

---

## 05-images-and-fonts/

### `embed-jpeg.ts`

Embed a JPEG image into a PDF and draw it on a page at a specific position and size.

### `embed-png.ts`

Embed a PNG image (with transparency) into a PDF and draw it on a page.

### `embed-multiple-images.ts`

Create a photo gallery page by embedding and arranging multiple images in a grid layout.

### `embed-truetype-font.ts`

Embed a custom TrueType font, then draw text using that font.

### `embed-opentype-font.ts`

Embed an OpenType font (with CFF outlines) and use it for text drawing.

### `font-subsetting.ts`

Demonstrate that embedded fonts are automatically subsetted to include only the glyphs actually used, keeping file size small.

### `unicode-text.ts`

Embed a font that supports Unicode and draw text containing non-ASCII characters (CJK, emoji, accented characters).

---

## 06-metadata/

### `read-metadata.ts`

Load a PDF and read all document metadata fields (title, author, subject, keywords, creator, producer, dates, trapped status, language) using the high-level getters.

### `set-metadata.ts`

Create a new PDF and set document metadata fields individually using `setTitle()`, `setAuthor()`, `setSubject()`, etc.

### `bulk-metadata.ts`

Demonstrate using `getMetadata()` to read all metadata at once as an object, and `setMetadata()` to update multiple fields in a single call.

### `document-dates.ts`

Work with creation and modification dates — set dates using JavaScript `Date` objects, read them back, and demonstrate how the library handles PDF date format parsing.

### `keywords.ts`

Set and retrieve document keywords as an array, demonstrating the automatic conversion between the array API and PDF's space-separated string storage.

### `display-title-in-viewer.ts`

Set a document title with the `showInWindowTitleBar` option so PDF viewers display the title instead of the filename in the window title bar.

### `document-language.ts`

Set the document language using RFC 3066 tags (e.g., "en-US", "de-DE", "ja") for accessibility and text-to-speech applications.

### `trapped-status.ts`

Read and set the document's trapped status for prepress workflows, demonstrating the "True", "False", and "Unknown" values.

---

## 07-signatures/

### `sign-with-p12.ts`

Sign a PDF using a PKCS#12 (.p12/.pfx) certificate file with the P12Signer.

### `sign-with-cryptokey.ts`

Sign a PDF using a Web Crypto CryptoKey (useful for browser environments or HSM integration).

### `sign-with-timestamp.ts`

Sign a PDF and include an RFC 3161 timestamp from a timestamp authority (PAdES B-T level).

### `sign-with-long-term-validation.ts`

Sign a PDF with full long-term validation data including OCSP responses and CRLs (PAdES B-LT level).

### `sign-archival.ts`

Create an archival signature with document timestamp for maximum longevity (PAdES B-LTA level).

### `add-signature-field.ts`

Create a signature field on a page without signing it, preparing a document for later signing.

### `multiple-signatures.ts`

Demonstrate adding multiple signatures to a document, preserving previous signatures with incremental saves.

---

## 08-attachments/

### `list-attachments.ts`

Load a PDF and list all embedded file attachments with their names, sizes, and MIME types.

### `extract-attachment.ts`

Extract an embedded file attachment from a PDF and save it to disk.

### `add-attachment.ts`

Embed a file (e.g., a spreadsheet, JSON data, or source document) as an attachment in a PDF.

### `remove-attachment.ts`

Remove a specific attachment from a PDF by name.

---

## 09-merging-and-splitting/

### `merge-pdfs.ts`

Merge multiple PDF files into a single combined document using `PDF.merge()`.

### `merge-with-options.ts`

Merge PDFs with specific options like preserving form fields or handling conflicting field names.

### `split-by-page-count.ts`

Split a large PDF into multiple smaller PDFs, each containing a fixed number of pages.

### `split-by-page-ranges.ts`

Split a PDF into multiple documents based on specified page ranges (e.g., pages 1-5, 6-10, 11-end).

### `concatenate-with-cover.ts`

Create a cover page from scratch, then concatenate it with an existing PDF document.

---

## 10-security/

### `check-encryption.ts`

Load a PDF and check whether it's encrypted, and if so, what encryption method is used.

### `decrypt-pdf.ts`

Load an encrypted PDF with the correct password and save a decrypted copy.

### `permissions-info.ts`

Load a PDF and display its permission flags (printing allowed, copying allowed, etc.).

---

## 11-advanced/

### `low-level-object-access.ts`

Demonstrate accessing and modifying low-level PDF objects (PdfDict, PdfArray, PdfStream) directly for custom operations.

### `read-document-catalog.ts`

Access the document catalog and traverse the page tree manually using low-level APIs.

### `detect-linearization.ts`

Check if a PDF is linearized (optimized for web viewing) and display linearization parameters.

### `handle-malformed-pdf.ts`

Demonstrate loading a malformed/corrupted PDF and how the library's lenient parsing recovers from errors.

### `flatten-layers.ts`

Load a PDF with optional content groups (layers) and flatten them to make all content permanently visible.

### `embed-page-as-xobject.ts`

Embed a page from another PDF as a Form XObject for use as a stamp, template, or overlay that can be drawn multiple times.

### `content-stream-inspection.ts`

Parse and inspect a page's content stream operators for debugging or analysis purposes.

---

## Implementation Notes

1. **Self-contained**: Each example should be runnable standalone with minimal setup.

2. **Comments**: Include clear comments explaining each step of the workflow.

3. **Error handling**: Show proper error handling patterns (try/catch, checking for null fields).

4. **Real fixtures**: Use actual PDF files from `fixtures/` where appropriate, or create simple PDFs within the example.

5. **Output**: Examples should either save a file to demonstrate the result or print meaningful output to the console.

6. **TypeScript**: All examples should be in TypeScript with proper type annotations.

7. **No external dependencies**: Examples should only depend on `@libpdf/core` and standard APIs (fs, fetch).
