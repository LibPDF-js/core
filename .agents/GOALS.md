# Goals

This document captures the high-level goals for @libpdf/core. Use this to steer development priorities and architectural decisions.

## Core Capabilities

### 1. Encryption & Security

- [x] **Load encrypted PDFs** — Support password-protected documents (user password, owner password)
- [x] **Decrypt on load** — Handle all standard encryption handlers (RC4, AES-128, AES-256)
- [ ] **Encrypt on save** — Apply encryption when writing PDFs (encryption logic done, needs writer)

### 2. Digital Signatures

- [x] **Add digital signatures** — Sign PDFs with certificates (P12, CryptoKey signers)
- [ ] **Verify signatures** — Validate existing signatures
- [x] **LTV (Long-Term Validation)** — Embed CRLs, OCSP responses for long-term validity
- [x] **DSS (Document Security Store)** — Full DSS support for archival signatures
- [x] **PAdES compliance** — Support PAdES B-B, B-T, B-LT, B-LTA profiles

### 3. Modification

- [x] **Add/remove pages** — Insert, delete, reorder pages
- [x] **Add/remove content** — Draw text, images, graphics on pages
- [ ] **Add/remove annotations** — Comments, highlights, stamps, etc.
- [x] **Add/remove form fields** — Text fields, checkboxes, dropdowns, etc.
- [x] **Incremental updates** — Append changes without rewriting (critical for signatures)

### 4. Forms

- [x] **Complete form filling** — Fill all field types (text, checkbox, radio, dropdown, etc.)
- [x] **Read form data** — Extract current field values
- [x] **Flatten forms** — Convert form fields to static content
- [ ] **Calculate fields** — Support JavaScript calculations (stretch)

### 5. Flattening

- [x] **Flatten forms** — Bake form field appearances into page content
- [ ] **Flatten annotations** — Bake annotation appearances into page content
- [x] **Flatten layers** — Merge optional content groups (required before signing to prevent hidden content attacks)

### 6. Attachments

- [x] **Extract attachments** — Get embedded files from PDF
- [x] **Embed attachments** — Add files to PDF
- [x] **File specifications** — Proper /EmbeddedFiles handling

### 7. Merging & Splitting

- [x] **Merge PDFs** — Combine pages from multiple documents
- [x] **Split PDFs** — Extract page ranges into new documents
- [x] **Page embedding** — Embed pages as Form XObjects for overlays/watermarks
- [ ] **Page imposition** — N-up, booklet layouts (stretch)

### 8. Text Extraction _(stretch)_

- [ ] **Extract text** — Get text content from pages
- [ ] **Preserve reading order** — Handle multi-column layouts
- [ ] **Extract from annotations** — Include comment text, form values

### 9. Creation

- [x] **Create from scratch** — Build PDFs programmatically
- [x] **Add pages** — Create blank or content-filled pages
- [x] **Draw content** — Text, images, paths, shapes
- [x] **Embed fonts** — Subset and embed TrueType/OpenType fonts
- [ ] **Add annotations** — Links, comments, stamps
- [x] **Add form fields** — Interactive forms

---

## Priority Tiers

### Tier 1: Foundation

These enable most other features:

1. **Encryption/Decryption** — Many real-world PDFs are encrypted ✓
2. **Incremental Updates** — Required for signature preservation ✓
3. **Object Modification** — Infrastructure for all write operations ✓

### Tier 2: High Value

Most commonly requested features:

1. **Form Filling** — Very common use case ✓
2. **Digital Signatures** — Enterprise requirement ✓ (signing done, verification pending)
3. **Merge/Split** — Common document workflows ✓
4. **Attachments** — Common for invoices, contracts ✓
5. **Layer Flattening** — Required before signing (security)

### Tier 3: Complete Solution

Full-featured library:

1. **Flattening** — Print-ready documents ✓ (forms and layers done, annotations pending)
2. **Annotation Modification** — Review workflows
3. **Text Extraction** — Search, indexing, accessibility

### Tier 4: Stretch

Nice to have:

1. **JavaScript Support** — Complex form calculations
2. **Page Imposition** — Print production

---

## Architectural Implications

### Encryption

- Must integrate early in parsing pipeline
- Affects object reading and stream decoding
- Need to track encryption state throughout document

### Incremental Updates

- Object graph must track modifications
- Writer needs to serialize only changed objects
- XRef must support appending new sections

### Digital Signatures

- Depends on incremental updates (can't rewrite signed content)
- Need access to raw byte ranges for signature computation
- Must preserve exact bytes of signed regions

### Form Filling

- Need appearance stream generation or AP dictionary handling
- Font subsetting for text fields
- Widget annotation management

### Merging

- Object renumbering to avoid conflicts
- Resource dictionary merging
- Page tree restructuring

---

## Non-Goals

Things we explicitly won't do (at least initially):

- **PDF/A validation** — Complex, better left to dedicated tools
- **OCR** — Out of scope, use external libraries
- **Rasterization** — Use pdf.js or other renderers
- **JavaScript execution** — Security concerns, limited use cases
- **3D content** — Rarely used, complex
- **Multimedia** — Video/audio embedding is niche

---

## Success Metrics

The library is successful when you can:

1. Open any PDF (encrypted or not) without errors
2. Fill and sign a form, preserving the signature on re-save
3. Merge documents from different sources reliably
4. Extract attachments from invoices/contracts
5. Flatten a form for printing

These represent the "80% use case" that most users need.
