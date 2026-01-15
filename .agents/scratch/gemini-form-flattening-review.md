# Form Flattening Comparison: PDFBox vs. @libpdf/core

This document reviews the form flattening implementation in PDFBox and compares it to our implementation in `@libpdf/core`.

## PDFBox Implementation Overview

In PDFBox, form flattening is primarily handled in `PDAcroForm.java` within the `flatten()` method (line 217). The process involves:

1.  **Iterating through pages**: It processes widgets page by page.
2.  **Handling Widget Annotations**:
    - It identifies widget annotations that need to be flattened.
    - It checks if the annotation is visible (`isVisibleAnnotation`).
    - It preserves non-widget annotations.
3.  **Drawing Appearance to Content Stream**:
    - It creates a `PDPageContentStream` in `AppendMode.APPEND` to avoid overwriting existing content.
    - It wraps the content stream if it hasn't been wrapped already (`isContentStreamWrapped`).
    - It retrieves the **Normal Appearance Stream** (`getNormalAppearanceStream`) of the annotation.
    - It creates a `PDFormXObject` from the appearance stream.
    - It resolves the **Transformation Matrix** (`resolveTransformationMatrix`) to map the appearance stream's coordinate system to the page's coordinate system, taking the annotation's bounding box (`BBox`) into account.
    - It draws the form XObject onto the page using `contentStream.drawForm(fieldObject)`.
4.  **Cleanup**:
    - It removes the flattened widgets from the page's annotation list.
    - It removes the fields from the AcroForm's field tree (`removeFields`).
    - It cleans up XFA data (`dictionary.removeItem(COSName.XFA)`).
    - It manages signature flags (`SIG_FLAGS`).

## @libpdf/core Implementation Overview

Our implementation in `@libpdf/core` (specifically `src/document/acro-form.ts`) follows a similar high-level approach but has some key differences:

1.  **Structure**: We iterate through the field tree to find all terminal fields, then for each widget of those fields, we find the page it belongs to and perform the flattening.
2.  **Appearance Generation**: We rely heavily on `AppearanceGenerator` to ensure the appearance stream is up-to-date before flattening.
3.  **Drawing**: We use `pdf-lib`'s drawing capabilities (or our own `ContentStreamBuilder`) to draw the XObject.

## Key Differences & Gaps

### 1. Page-Centric vs. Field-Centric Iteration

- **PDFBox**: Iterates **pages first**, then finds widgets on that page. This allows it to efficiently handle the content stream of the page once (wrapping it in `q...Q` if needed) and append all flattened widgets for that page in one go.
- **Us**: We iterate **fields**, then find the page for each widget. This might lead to opening/modifying the page content stream multiple times if a page has multiple fields.
- **Impact**: Performance and potentially correct content stream management (save/restore graphics state). PDFBox's approach is likely safer for preserving page state.

### 2. Transformation Matrix Resolution

- **PDFBox**: Has a `resolveTransformationMatrix` method that carefully calculates the matrix based on the annotation's rectangle (`Rect`) and the appearance stream's bounding box (`BBox`). It handles rotation and scaling to ensure the appearance fits exactly into the annotation's defined area.
- **Us**: We generally assume the appearance stream is generated with the correct dimensions matching the widget's rect. If `AppearanceGenerator` does its job perfectly, this is fine. However, PDFBox's approach is more robust against mismatched appearance streams (e.g., from existing PDFs we didn't generate).

### 3. Annotation Visibility Check

- **PDFBox**: Explicitly checks `isVisibleAnnotation` (not hidden, not invisible, has a valid BBox with width/height > 0).
- **Us**: We should verify if we have robust checks for `F` (flags) entry in the annotation dictionary (Hidden, Invisible, NoView bits).

### 4. Content Stream Wrapping

- **PDFBox**: Wraps the existing page content in `q...Q` (save/restore graphics state) _before_ appending new content. This isolates the page's original graphics state from the flattened form fields.
- **Us**: We need to ensure we don't bleed graphics state changes from our flattened fields into subsequent page content (though usually we append to the end, so it's less of an issue, but standard practice is to isolate).

### 5. XFA Cleanup

- **PDFBox**: Explicitly removes XFA data (`COSName.XFA`) after flattening.
- **Us**: We should check if we are cleaning up XFA. If we flatten a hybrid PDF but leave the XFA, viewers might still try to render the XFA (which would now be invalid/disconnected from the flattened fields) or show confusing data.

## Recommendations for Improvement (Flattening)

1.  **Adopt Page-Centric Flattening**: Refactor `flatten()` to iterate pages and process all widgets on a page at once. This reduces I/O and simplifies content stream management.
2.  **Robust Matrix Calculation**: Implement a `resolveTransformationMatrix` equivalent to handle cases where the appearance stream BBox doesn't perfectly match the Annotation Rect (scaling/centering).
3.  **Visibility Flags**: Ensure we respect the `Hidden` and `NoView` annotation flags.
4.  **XFA Removal**: Add a step to remove the `XFA` entry from the AcroForm dictionary if it exists, to prevent hybrid file issues.

---

## Appearance Generator Comparison: PDFBox vs. @libpdf/core

This section compares `AppearanceGeneratorHelper.java` (PDFBox) with our `src/document/appearance-generator.ts`.

### 1. Highlight Color Support (List Boxes)

- **PDFBox**: Explicitly supports highlighting selected list box items with a specific color (`HIGHLIGHT_COLOR = {153/255f, 193/255f, 215/255f}`).
  - See `insertGeneratedListboxSelectionHighlight` method.
  - It iterates through selected options and draws a filled rectangle behind the text using this highlight color.
- **Us**: We currently iterate through options but might not be drawing this "selection highlight" background for list boxes, only drawing the text.
- **Recommendation**: Check if we draw selection backgrounds for list boxes. If not, add support for it using the standard highlight color.

### 2. Comb Field Character Positioning

- **PDFBox**: Has sophisticated logic for positioning characters in comb fields (lines 750-776).
  - It centers characters within their comb cells (`Math.floorDiv(maxLen - numChars, 2) * combWidth` for center alignment).
  - It calculates specific `xOffset` for each character.
- **Us**: We implemented basic cell-based positioning.
- **Recommendation**: Our implementation seems consistent with this, but we should verify we handle alignment within comb fields (left/center/right of the _set_ of characters, not just individual characters centered in cells).

### 3. Font Scaling & Metrics

- **PDFBox**: Uses a `FONTSCALE = 1000` constant and carefully scales font metrics (e.g., `font.getStringWidth(combString) / FONTSCALE * fontSize`).
- **Us**: We use `font.widthOfTextAtSize`. This is effectively the same, but we should ensure our font metric calculations match PDF specification precision.

### 4. Multiline Auto-Sizing Limits

- **PDFBox**: Defines explicit min/max font sizes for multiline auto-sizing (`DEFAULT_FONT_SIZE = 12`).
- **Us**: We implemented auto-sizing, but should verify our min/max constraints match industry standards (often min 4pt, max 12pt or auto-calculated).

### 5. Padding Handling

- **PDFBox**: Uses `applyPadding` utility method heavily.
  - `padding = Math.max(1f, borderWidth)`
  - It pads the BBox to create the clip rect.
  - It pads the clip rect again to create the content rect.
- **Us**: We just adopted this logic (`padding + extraPadding`) which aligns us well with PDFBox.

### 6. Resource Management

- **PDFBox**: Validates font availability and warns about subsetted fonts (`font.getName().contains("+")`) which might cause issues during flattening/refreshing.
- **Us**: We don't explicit warn about subsetted fonts. We might want to add validation or logging if we detect subsetted fonts that we can't properly use for new text.

### Summary of Appearance Generator Gaps

- **Selection Highlights**: Verify list box selection highlighting.
- **Subsetted Fonts**: Add checks/warnings for subsetted fonts if they limit our ability to regenerate appearances.
- **Comb Alignment**: Ensure comb fields respect alignment flags for the entire string group, not just per-character centering.
