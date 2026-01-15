---
description: Generate markdown documentation for a module or feature
argument-hint: <module-path-or-feature>
---

You are creating proper markdown documentation for a module or feature in the library.

## Your Task

1. **Identify the scope** - What does `$ARGUMENTS` refer to? (file, directory, or feature name)
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

import { Callout } from "fumadocs-ui/components/callout";

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
import { Callout } from "fumadocs-ui/components/callout";

<Callout type="info">Informational note</Callout>
<Callout type="warn">Warning message</Callout>
<Callout type="error">Error/danger message</Callout>
```

## Guidelines

### Content Quality

- **Be accurate** - Verify behavior by reading the code
- **Be complete** - Document all public API surface
- **Be practical** - Include real, working examples
- **Be concise** - Don't over-explain obvious things

### Code Examples

- All examples must be valid TypeScript
- Show imports when not obvious
- Include expected output in comments where helpful
- Progress from simple to complex

### Formatting

- Use `---` horizontal rules between major sections
- Use code fences with `typescript` language tag
- Use tables for parameter/option documentation
- Use Fumadocs `<Callout>` components sparingly

### Cross-References

- Link to related docs: `[PDFPage](/docs/api/pdf-page)`
- Add "See Also" sections when helpful
- Update `meta.json` when adding new pages

### Maintenance

- Include types inline so docs don't get stale
- Reference source file locations for complex behavior
- Use `<Callout type="warn">` for beta/unstable features

## Process

1. **Explore the code** - Read source files to understand the API
2. **Check existing docs** - Look in `content/docs/` for related pages
3. **Identify the audience** - Who will read this? What do they need?
4. **Draft the structure** - Outline sections before writing
5. **Write content** - Fill in each section with examples
6. **Update navigation** - Add to relevant `meta.json` if new page
7. **Add cross-references** - Link from related docs

## Begin

Analyze `$ARGUMENTS`, read the relevant source code, and create comprehensive MDX documentation in `content/docs/`.
