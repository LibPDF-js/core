# LibPDF

A modern PDF library for TypeScript. Parse, modify, and generate PDFs with a clean, intuitive API.

> **Beta Software**: LibPDF is under active development. APIs may change between minor versions. Not yet recommended for production use.

## Why LibPDF?

LibPDF was born from frustration. At [Documenso](https://documenso.com), we found ourselves wrestling with the JavaScript PDF ecosystem:

- **PDF.js** is excellent for rendering, but it's read-only
- **pdf-lib** has a great API, but chokes on slightly malformed documents
- **pdfkit** only generates, no parsing at all

We kept adding workarounds. A patch here for a malformed xref table. A hack there for an encrypted document. Eventually, we decided to build what we actually needed:

- **Lenient like PDFBox and PDF.js**: opens documents other libraries reject
- **Intuitive like pdf-lib**: clean, TypeScript-first API
- **Complete**: encryption, digital signatures, incremental saves, form filling

## Features

| Feature            | Status | Notes                                      |
| ------------------ | ------ | ------------------------------------------ |
| Parse any PDF      | Yes    | Graceful fallback for malformed documents  |
| Create PDFs        | Yes    | From scratch or modify existing            |
| Encryption         | Yes    | RC4, AES-128, AES-256 (R2-R6)              |
| Digital Signatures | Yes    | PAdES B-B, B-T, B-LT, B-LTA                |
| Form Filling       | Yes    | Text, checkbox, radio, dropdown, signature |
| Form Flattening    | Yes    | Bake fields into page content              |
| Merge & Split      | Yes    | Combine or extract pages                   |
| Attachments        | Yes    | Embed and extract files                    |
| Text Extraction    | Yes    | With position information                  |
| Font Embedding     | Yes    | TTF/OpenType with subsetting               |
| Images             | Yes    | JPEG, PNG (with alpha)                     |
| Incremental Saves  | Yes    | Append changes, preserve signatures        |

## Installation

```bash
npm install @libpdf/core
# or
bun add @libpdf/core
```

## Quick Start

### Parse an existing PDF

```typescript
import { PDF } from "@libpdf/core";

const pdf = await PDF.load(bytes);
const pages = await pdf.getPages();

console.log(`${pages.length} pages`);
```

### Open an encrypted PDF

```typescript
const pdf = await PDF.load(bytes, { credentials: "password" });
```

### Fill a form

```typescript
const pdf = await PDF.load(bytes);
const form = await pdf.getForm();

form.fill({
  name: "Jane Doe",
  email: "jane@example.com",
  agreed: true,
});

const filled = await pdf.save();
```

### Sign a document

```typescript
import { PDF, P12Signer } from "@libpdf/core";

const pdf = await PDF.load(bytes);
const signer = await P12Signer.create(p12Bytes, "password");

const signed = await pdf.sign({
  signer,
  reason: "I approve this document",
});
```

### Merge PDFs

```typescript
const merged = await PDF.merge([pdf1Bytes, pdf2Bytes, pdf3Bytes]);
```

### Draw on a page

```typescript
import { PDF, rgb } from "@libpdf/core";

const pdf = PDF.create();
const page = pdf.addPage({ size: "letter" });

page.drawText("Hello, World!", {
  x: 50,
  y: 700,
  fontSize: 24,
  color: rgb(0, 0, 0),
});

page.drawRectangle({
  x: 50,
  y: 600,
  width: 200,
  height: 100,
  color: rgb(0.9, 0.9, 0.9),
  borderColor: rgb(0, 0, 0),
  borderWidth: 1,
});

const output = await pdf.save();
```

## Runtime Support

LibPDF runs everywhere:

- **Node.js** 18+
- **Bun**
- **Browsers** (modern, with Web Crypto)

## Philosophy

### Be lenient

Real-world PDFs are messy. Export a document through three different tools and you'll get three slightly different interpretations of the spec. LibPDF prioritizes _opening your document_ over strict compliance. When standard parsing fails, we fall back to brute-force recovery, scanning the entire file to rebuild the structure.

### Two API layers

- **High-level**: `PDF`, `PDFPage`, `PDFForm` for common tasks
- **Low-level**: `PdfDict`, `PdfArray`, `PdfStream` for full control

## Documentation

Full documentation at [libpdf.dev](https://libpdf.dev)

## Sponsors

LibPDF is developed by [Documenso](https://documenso.com), the open-source DocuSign alternative.

<a href="https://documenso.com">
  <img src="apps/docs/public/sponsors/documenso.png" alt="Documenso" height="24">
</a>

## Contributing

We welcome contributions! See our [contributing guide](CONTRIBUTING.md) for details.

```bash
# Clone the repo
git clone https://github.com/libpdf/core.git
cd libpdf

# Install dependencies
bun install

# Run tests
bun run test

# Type check
bun run typecheck
```

## License

[MIT](LICENSE)

The `src/fontbox/` directory is licensed under [Apache-2.0](src/fontbox/LICENSE) as it is derived from [Apache PDFBox](https://pdfbox.apache.org/).
