---
name: create-documentation
description: Generate markdown documentation for a module or feature
---

You are creating proper markdown documentation for a module or feature in the library.

**Read [WRITING_STYLE.md](../../WRITING_STYLE.md) first** for tone, formatting conventions, and anti-patterns to avoid.

## Your Task

1. **Identify the scope** - Based on the conversation context, determine what module, feature, or file needs documentation. Ask the user if unclear.
2. **Read the source code** - Understand the public API, types, and behavior
3. **Read existing docs** - Check `content/docs/` for documentation to update
4. **Write comprehensive documentation** - Create or update MDX docs

## Documentation Structure

This project uses [Fumadocs](https://fumadocs.dev) for documentation. All docs live in `content/docs/` as MDX files.

```
content/docs/
├── index.mdx              # Landing page
├── meta.json              # Root navigation order
├── getting-started/       # Quickstart guides
│   ├── installation.mdx
│   ├── create-pdf.mdx
│   └── parse-pdf.mdx
├── guides/                # Feature guides
│   ├── drawing.mdx
│   ├── encryption.mdx
|   |-- ...
├── api/                   # API reference
│   ├── pdf.mdx
│   ├── pdf-page.mdx
│   ├── pdf-form.mdx
│   ├── ...
├── concepts/              # Conceptual docs
│   ├── pdf-structure.mdx
│   ├── object-model.mdx
│   └── incremental-saves.mdx
├── advanced/              # Advanced topics
│   └── library-authors.mdx
└── migration/             # Migration guides
    └── from-pdf-lib.mdx
```

### Where to Put Documentation

| Type                | Location                            | When to use                                          |
| ------------------- | ----------------------------------- | ---------------------------------------------------- |
| **API Reference**   | `content/docs/api/<class>.mdx`      | Documenting a class like `PDF`, `PDFPage`, `PDFForm` |
| **Feature Guide**   | `content/docs/guides/<feature>.mdx` | How-to guides for features (forms, signatures, etc.) |
| **Concept**         | `content/docs/concepts/<topic>.mdx` | Explaining PDF concepts (structure, objects, etc.)   |
| **Getting Started** | `content/docs/getting-started/`     | Installation and first steps                         |

### Navigation (meta.json)

Each directory has a `meta.json` that controls navigation order:

```json
{
  "title": "API Reference",
  "pages": [
    "index",
    "---Classes---",
    "pdf",
    "pdf-page",
    "pdf-form",
    "annotations",
    "---Other---",
    "errors"
  ]
}
```

- Use `---Label---` for section dividers
- Order determines sidebar appearance

### MDX File Format

```mdx
---
title: ModuleName
description: Brief description for SEO and previews.
---

# ModuleName

Brief description of what this module does and when to use it.

<Callout type="warn" title="my title">
  Use callouts sparingly for important warnings or beta features.
</Callout>

## Quick Start

\`\`\`typescript
import { PDF } from "@libpdf/core";
// Minimal working example
\`\`\`

---

## methodName(options)

Description of what the method does.

| Param        | Type     | Default  | Description    |
| ------------ | -------- | -------- | -------------- |
| `param`      | `string` | required | What it does   |
| `[optional]` | `number` | `10`     | Optional param |

**Returns**: `ReturnType`

\`\`\`typescript
// Usage example
\`\`\`

---

## Types

### TypeName

\`\`\`typescript
interface TypeName {
property: string;
}
\`\`\`
```

### Fumadocs Components

```mdx
<Callout type="info">Informational note</Callout>
<Callout type="warn">Warning message</Callout>
<Callout type="error">Error/danger message</Callout>
```

## Guidelines

See [WRITING_STYLE.md](../../WRITING_STYLE.md) for complete guidelines. Key points:

- **Tone**: Direct, second-person, no emojis
- **Examples**: Progressive complexity, all must be valid TypeScript
- **Tables**: Use Sharp-style nested parameter tables (see WRITING_STYLE.md)
- **Callouts**: Use sparingly for warnings, beta features, security
- **Cross-references**: Link related docs, add "See Also" sections
- **Navigation**: Update `meta.json` when adding new pages

## Process

1. **Explore the code** - Read source files to understand the API
2. **Check existing docs** - Look in `content/docs/` for related pages
3. **Identify the audience** - Who will read this? What do they need?
4. **Draft the structure** - Outline sections before writing
5. **Write content** - Fill in each section with examples
6. **Update navigation** - Add to relevant `meta.json` if new page
7. **Add cross-references** - Link from related docs

## Begin

Analyze the conversation context to determine the documentation scope, read the relevant source code, and create comprehensive MDX documentation in `content/docs/`.
