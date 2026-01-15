# Plan 036: @libpdf/core Documentation

A phased documentation plan for @libpdf/core, informed by patterns from Stripe, Zod, Sharp, Three.js, date-fns, and Axios documentation.

**Goal**: Create documentation that serves both quick-start users and advanced integrators, with clear task-based navigation and excellent API reference.

**Notice**: The dev server is already running on localhost:3000, you can use WebFetch to verify individual pages work as expected.

---

## Content Principles

These principles guide all documentation writing. Reference them when creating or reviewing content.

### Core Patterns

1. **Task-based navigation**: Organize by what users want to do, not by class hierarchy
2. **Progressive examples**: Start simple, build to complex
3. **Nested parameter tables**: Sharp's format for options objects (see Phase 3)
4. **Explicit limitations**: List what's NOT supported clearly
5. **Real-world analogies**: Explain PDF concepts with familiar comparisons
6. **Error categorization**: Group errors by when they occur

### Tone

- Direct and action-oriented
- Second person ("you") with imperative voice
- Technical but accessible
- Acknowledge complexity without condescension
- No emojis or excessive personality

### Anti-Patterns to Avoid

- Assuming PDF domain knowledge
- Hiding default values
- Separate "TypeScript" sections (types integrated throughout)
- Monolithic single-page references
- Examples that don't work with current API

---

## Content Structure

```
/docs
├── index                     # Landing page with feature matrix
├── getting-started/
│   ├── installation          # All runtimes (Node, Bun, Browser)
│   ├── parse-pdf             # Quick start: load and inspect
│   └── create-pdf            # Quick start: create from scratch
├── concepts/
│   ├── pdf-structure         # How PDFs work (xref, objects, trailer)
│   ├── object-model          # PdfDict, PdfArray, PdfRef, etc.
│   ├── incremental-saves     # Why and how incremental updates work
│   └── security-model        # Encryption, passwords, permissions
├── guides/
│   ├── pages                 # Add, remove, reorder, copy, merge, split
│   ├── text-extraction       # Extract text, search, bounding boxes
│   ├── drawing               # Text, shapes, images, colors
│   ├── forms                 # Read, fill, flatten form fields
│   ├── fonts                 # Embed, subset, Standard 14
│   ├── images                # JPEG, PNG, embedding
│   ├── metadata              # Title, author, dates, custom properties
│   ├── attachments           # Embed and extract files
│   ├── encryption            # Encrypt, decrypt, passwords, permissions
│   └── signatures            # Sign with P12/CryptoKey, PAdES levels, LTV
├── api/
│   ├── pdf                   # PDF class (load, create, merge, save)
│   ├── pdf-page              # PDFPage class
│   ├── pdf-form              # PDFForm and field types
│   ├── pdf-security          # Encryption options
│   ├── pdf-signature         # Signature options and signers
│   ├── pdf-attachments       # Attachment handling
│   ├── drawing-context       # Drawing operations
│   └── errors                # Error types and codes
├── advanced/
│   ├── malformed-pdfs        # Lenient parsing, recovery strategies
│   ├── streaming             # Large file handling
│   ├── library-authors       # Building on @libpdf/core
│   └── low-level-access      # ObjectRegistry, raw COS objects
├── migration/
│   └── from-pdf-lib          # Side-by-side comparison
└── changelog                 # Version history
```

---

## Phase 1: Foundation (Essential)

**Goal**: Users can install, load a PDF, and create a simple PDF.

### 1.1 Landing Page (`/docs`)

Feature matrix showing capabilities at a glance:

```markdown
| Feature            | Status  | Notes                     |
| ------------------ | ------- | ------------------------- |
| PDF 1.0-1.7        | ✅ Full | Read and write            |
| PDF 2.0            | ✅ Read | Write planned             |
| Encrypted PDFs     | ✅ Full | RC4, AES-128, AES-256     |
| AcroForms          | ✅ Full | Read, fill, flatten       |
| Digital Signatures | ✅ Sign | PAdES B-B through B-LTA   |
| Text Extraction    | ✅ Full | With positions and search |
| Font Embedding     | ✅ Full | TTF/OTF with subsetting   |
| Incremental Saves  | ✅ Full | Preserves signatures      |
```

Hero example (5-7 lines):

```typescript
import { PDF } from "@libpdf/core";

const pdf = await PDF.load(bytes);
console.log(`${pdf.pageCount} pages`);

const page = pdf.getPage(0);
const text = await page.extractText();
```

### 1.2 Installation (`/docs/getting-started/installation`)

Cover all runtimes with specific notes:

```markdown
## Node.js / Bun

npm install @libpdf/core
bun add @libpdf/core

## Browser

Works with any bundler (Vite, webpack, esbuild).
No Node.js polyfills required.

## Requirements

- Node.js 18+ or Bun 1.0+
- TypeScript 5+ (recommended)
- ESM only (no CommonJS)
```

### 1.3 Quick Start: Parse a PDF (`/docs/getting-started/parse-pdf`)

Progressive example from basic to practical:

```typescript
// Basic: Load and inspect
const pdf = await PDF.load(bytes);
console.log(pdf.pageCount);
console.log(pdf.getTitle());

// With password
const encrypted = await PDF.load(bytes, {
  password: "secret",
});

// Extract text
const page = pdf.getPage(0);
const text = await page.extractText();

// Get page dimensions
const { width, height } = page.getSize();
```

### 1.4 Quick Start: Create a PDF (`/docs/getting-started/create-pdf`)

```typescript
import { PDF, PageSizes } from "@libpdf/core";

const pdf = PDF.create();
const page = pdf.addPage({ size: PageSizes.A4 });

page.drawText("Hello, World!", {
  x: 50,
  y: 750,
  size: 24,
});

const bytes = await pdf.save();
```

---

## Phase 2: Core Guides

**Goal**: Users can accomplish common PDF tasks with confidence.

### 2.1 Working with Pages (`/docs/guides/pages`)

Cover the full page lifecycle:

- Get pages: `pdf.getPages()`, `pdf.getPage(index)`
- Add pages: `pdf.addPage()`, `pdf.addPage({ size, index })`
- Remove pages: `pdf.removePage(index)`
- Reorder: `pdf.movePages()`
- Copy between documents: `pdf.copyPages(sourcePdf, indices)`
- Merge PDFs: `PDF.merge([pdf1Bytes, pdf2Bytes])`
- Split/extract: `pdf.extractPages(indices)`

Include gotcha table:

| Issue                         | Solution                                                       |
| ----------------------------- | -------------------------------------------------------------- |
| Pages appear blank after copy | Resources (fonts, images) must be copied too—use `copyPages()` |
| Page order wrong after merge  | Check source document page indices                             |

### 2.2 Text Extraction (`/docs/guides/text-extraction`)

```typescript
// Simple extraction
const text = await page.extractText();

// With position info
const items = await page.extractTextItems();
for (const item of items) {
  console.log(item.text, item.x, item.y);
}

// Search with regex
const results = await page.searchText(/invoice #\d+/i);
for (const match of results) {
  console.log(match.text, match.bounds);
}
```

### 2.3 Forms (`/docs/guides/forms`)

Cover the full form workflow:

```typescript
// Read form structure
const form = await pdf.getForm();
const fields = form.getFields();

// Fill form
form.fill({
  "First Name": "John",
  "Last Name": "Doe",
  "Agree to Terms": true,
  Country: "United States",
});

// Or fill individual fields
const nameField = form.getTextField("First Name");
nameField.setText("John");

// Flatten to static content
form.flatten();
```

Field type reference table:

| Type      | Read | Write | Methods                                     |
| --------- | ---- | ----- | ------------------------------------------- |
| Text      | ✅   | ✅    | `getText()`, `setText()`                    |
| Checkbox  | ✅   | ✅    | `isChecked()`, `check()`, `uncheck()`       |
| Radio     | ✅   | ✅    | `getSelected()`, `select()`                 |
| Dropdown  | ✅   | ✅    | `getSelected()`, `select()`, `getOptions()` |
| Listbox   | ✅   | ✅    | `getSelected()`, `select()` (multi)         |
| Signature | ✅   | ✅    | See Signatures guide                        |

### 2.4 Drawing (`/docs/guides/drawing`)

```typescript
// Text with options
page.drawText("Hello", {
  x: 50,
  y: 700,
  size: 16,
  font: await pdf.embedFont(fontBytes),
  color: rgb(0, 0, 0),
});

// Shapes
page.drawRectangle({
  x: 50,
  y: 500,
  width: 200,
  height: 100,
  color: rgb(0.9, 0.9, 0.9),
  borderColor: rgb(0, 0, 0),
  borderWidth: 1,
});

// Images
const image = await pdf.embedImage(pngBytes);
page.drawImage(image, {
  x: 50,
  y: 300,
  width: 200,
  height: 150,
});
```

### 2.5 Encryption (`/docs/guides/encryption`)

```typescript
// Encrypt on save
await pdf.save({
  password: "user-password",
  ownerPassword: "owner-password",
  permissions: {
    printing: true,
    copying: false,
    modifying: false,
  },
});

// Remove encryption
pdf.security.removeEncryption();
await pdf.save();
```

Encryption support matrix:

| Algorithm | Key Length | Read | Write |
| --------- | ---------- | ---- | ----- |
| RC4       | 40-bit     | ✅   | ✅    |
| RC4       | 128-bit    | ✅   | ✅    |
| AES       | 128-bit    | ✅   | ✅    |
| AES       | 256-bit    | ✅   | ✅    |

### 2.6 Digital Signatures (`/docs/guides/signatures`)

```typescript
// Sign with PKCS#12 file
await pdf.sign({
  signer: await P12Signer.create(p12Bytes, "password"),
  level: "B-LTA", // Long-term archival
  timestampServer: "http://timestamp.example.com",
});

// Sign with Web Crypto API
await pdf.sign({
  signer: await CryptoKeySigner.create(privateKey, certificate),
  level: "B-T",
});

// Incremental save preserves existing signatures
await pdf.save({ incremental: true });
```

PAdES conformance levels:

| Level | Description          | Timestamp | LTV           |
| ----- | -------------------- | --------- | ------------- |
| B-B   | Basic signature      | ❌        | ❌            |
| B-T   | With timestamp       | ✅        | ❌            |
| B-LT  | Long-term validation | ✅        | ✅            |
| B-LTA | Long-term archival   | ✅        | ✅ + archived |

---

## Phase 3: API Reference

**Goal**: Complete, searchable reference for all public APIs.

### 3.1 API Reference Format

Use Sharp's nested parameter table pattern:

````markdown
### PDF.load(bytes, options?)

Load an existing PDF document.

| Param                        | Type          | Default  | Description             |
| ---------------------------- | ------------- | -------- | ----------------------- |
| `bytes`                      | `Uint8Array`  | required | PDF file bytes          |
| `[options]`                  | `LoadOptions` |          |                         |
| `[options.password]`         | `string`      |          | User or owner password  |
| `[options.ignoreEncryption]` | `boolean`     | `false`  | Load without decrypting |
| `[options.updateMetadata]`   | `boolean`     | `true`   | Update ModDate on save  |

**Returns**: `Promise<PDF>`

**Throws**:

- `PasswordError` — Wrong password or password required
- `ParseError` — Malformed PDF structure

**Example**:

```ts
const pdf = await PDF.load(bytes, { password: "secret" });
```
````

````

### 3.2 Error Reference (`/docs/api/errors`)

Categorize errors by phase (Axios pattern):

```markdown
## Parse Errors

Thrown when loading a PDF.

### InvalidHeaderError
PDF header is missing or malformed.

**Common causes:**
- File is not a PDF
- File truncated during transfer

### MissingXRefError
Cross-reference table not found.

**Common causes:**
- Severely corrupted file
- Non-PDF file

## Encryption Errors

### PasswordRequiredError
Document is encrypted and no password provided.

### InvalidPasswordError
Provided password is incorrect.

## Content Errors

### InvalidObjectError
Referenced object is malformed or missing.
````

---

## Phase 4: Concepts

**Goal**: Users understand PDF internals when needed.

### 4.1 PDF Structure Overview (`/docs/concepts/pdf-structure`)

Use Three.js-style analogies:

```markdown
## How PDFs Work

Think of a PDF as a **book with an index at the back**.

In a regular book, you read front-to-back. But PDF readers start at the
_end_ of the file, reading the **cross-reference table** (xref) that
tells them where every object lives.

### The Four Parts of a PDF

1. **Header**: Version declaration (`%PDF-1.7`)
2. **Body**: All the objects (pages, fonts, images, text)
3. **Cross-Reference Table**: Index of object locations
4. **Trailer**: Points to the root object and xref

### Why This Matters

This backwards design enables **incremental updates**. When you modify
a PDF, you don't rewrite the whole file—you append changes at the end
and add a new xref table. The original content stays untouched.

This is why `pdf.save({ incremental: true })` preserves existing
signatures and keeps file history intact.
```

### 4.2 Object Model (`/docs/concepts/object-model`)

```markdown
## The Object Model

Every piece of data in a PDF is an object. @libpdf/core represents
these as TypeScript classes:

| PDF Type   | Class       | Example             |
| ---------- | ----------- | ------------------- |
| Boolean    | `boolean`   | `true`              |
| Integer    | `number`    | `42`                |
| Real       | `number`    | `3.14`              |
| String     | `PdfString` | `(Hello)`           |
| Name       | `PdfName`   | `/Type`             |
| Array      | `PdfArray`  | `[1 2 3]`           |
| Dictionary | `PdfDict`   | `<< /Type /Page >>` |
| Stream     | `PdfStream` | Content streams     |
| Null       | `null`      | `null`              |
| Reference  | `PdfRef`    | `1 0 R`             |

### Indirect Objects

Most objects are stored as **indirect objects** with an ID:
```

1 0 obj
<< /Type /Page /MediaBox [0 0 612 792] >>
endobj

```

This `1 0` is the object number and generation. References like
`1 0 R` point to this object. @libpdf/core handles this automatically.
```

---

## Phase 5: Advanced Topics

**Goal**: Power users and library authors have the guidance they need.

### 5.1 For Library Authors (`/docs/advanced/library-authors`)

Follow Zod's pattern:

````markdown
## For Library Authors

Building a library on top of @libpdf/core? This guide covers
integration patterns and best practices.

### Dependency Strategy

**Peer dependency** (recommended for wrappers):

```json
{
  "peerDependencies": {
    "@libpdf/core": "^1.0.0"
  }
}
```
````

**Direct dependency** (for internal use):

```json
{
  "dependencies": {
    "@libpdf/core": "^1.0.0"
  }
}
```

### Type Preservation

Preserve type specificity when wrapping:

```typescript
// ✅ Correct—preserves type information
function processPDF<T extends PDF>(pdf: T): T { ... }

// ❌ Incorrect—loses subclass information
function processPDF(pdf: PDF): PDF { ... }
```

### Low-Level Access

For advanced manipulation, access the object registry:

```typescript
import { PDF } from "@libpdf/core";

const pdf = await PDF.load(bytes);
const registry = pdf.context.registry;

// Get raw dictionary for a page
const pageDict = registry.resolve(pageRef);
```

⚠️ **Warning**: Low-level APIs may change between minor versions.

````

### 5.2 Migration from pdf-lib (`/docs/migration/from-pdf-lib`)

```markdown
## Migrating from pdf-lib

@libpdf/core aims for API familiarity while adding new capabilities.

### Equivalent APIs

| Task | pdf-lib | @libpdf/core |
|------|---------|--------------|
| Load PDF | `PDFDocument.load(bytes)` | `PDF.load(bytes)` |
| Create PDF | `PDFDocument.create()` | `PDF.create()` |
| Add page | `pdfDoc.addPage()` | `pdf.addPage()` |
| Draw text | `page.drawText()` | `page.drawText()` |
| Embed font | `pdfDoc.embedFont()` | `pdf.embedFont()` |
| Save | `pdfDoc.save()` | `pdf.save()` |

### New Capabilities

Features @libpdf/core adds:

| Feature | pdf-lib | @libpdf/core |
|---------|---------|--------------|
| Text extraction | ❌ | `page.extractText()` |
| Incremental saves | ❌ | `pdf.save({ incremental: true })` |
| Digital signatures | ❌ | `pdf.sign({ ... })` |
| Malformed PDF handling | Strict | Lenient by default |
| Encrypted PDF support | Limited | Full (R2-R6) |
````

---

## Implementation Phases

### Phase 1: Foundation (Week 1)

- [ ] Landing page with feature matrix
- [ ] Installation guide
- [ ] Quick start: Parse a PDF
- [ ] Quick start: Create a PDF

### Phase 2: Core Guides (Weeks 2-3)

- [ ] Pages guide (add, remove, copy, merge, split)
- [ ] Text extraction guide
- [ ] Forms guide
- [ ] Drawing guide
- [ ] Fonts guide
- [ ] Images guide

### Phase 3: Security Guides (Week 4)

- [ ] Encryption guide
- [ ] Digital signatures guide
- [ ] Metadata and attachments guides

### Phase 4: API Reference (Weeks 5-6)

- [ ] PDF class reference
- [ ] PDFPage class reference
- [ ] PDFForm and field references
- [ ] Drawing operations reference
- [ ] Error reference

### Phase 5: Concepts & Advanced (Weeks 7-8)

- [ ] PDF structure concept guide
- [ ] Object model concept guide
- [ ] Incremental saves concept guide
- [ ] For Library Authors section
- [ ] Migration from pdf-lib
- [ ] Malformed PDF handling guide

---

## Technical Notes

### Fumadocs Setup

Content lives in `/content/docs/` at repo root. Fumadocs app in `/apps/docs/`.

```bash
bun run docs:dev   # Development
bun run docs:build # Production build
```

### MDX Components Needed

- `FeatureMatrix` — Capability comparison table
- `ParameterTable` — Sharp-style nested params
- `CodeTabs` — Language/runtime switcher
- `Callout` — Warnings, tips, notes
- `ApiSignature` — Consistent method signatures

### Search

Fumadocs includes Orama search. Ensure all pages have proper frontmatter:

```yaml
---
title: Working with Pages
description: Add, remove, reorder, copy, and merge PDF pages.
---
```
