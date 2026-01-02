# @libpdf/core

A modern PDF library for TypeScript — parsing and generation.

## Why?

The JavaScript ecosystem's PDF landscape is fragmented:
- **pdf.js** (Mozilla) - excellent parsing/rendering, but focused on browser viewing, not manipulation
- **pdf-lib** - great for generation and basic manipulation, but parsing is limited
- **pdfkit** - generation only, no parsing

There's no single, comprehensive library that handles both robust parsing *and* generation with a clean, modern API.

**@libpdf/core** aims to fill that gap.

## Goals

- **Full PDF parsing** - extract text, images, metadata, structure
- **Full PDF generation** - create documents from scratch
- **PDF manipulation** - modify existing documents
- **Modern TypeScript** - strong typing, tree-shakeable, no legacy baggage
- **Runtime flexible** - Node.js, Bun, and browsers

## Known Limitations

- **Predefined CJK CMaps**: Only Identity-H and Identity-V CMaps are supported. Legacy CJK PDFs using predefined CMaps (UniGB-UCS2-H, UniJIS-UCS2-H, etc.) without ToUnicode maps may not extract text correctly. Modern PDFs include ToUnicode maps which work correctly.

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Type check
bun run typecheck

# Lint and format
bun run lint:fix
```

## Reference Libraries

This project cross-references these excellent PDF libraries:

- [Mozilla pdf.js](https://github.com/mozilla/pdf.js) - `checkouts/pdfjs`
- [pdf-lib](https://github.com/Hopding/pdf-lib) - `checkouts/pdf-lib`
- [Apache PDFBox](https://github.com/apache/pdfbox) - `checkouts/pdfbox`

## License

MIT
