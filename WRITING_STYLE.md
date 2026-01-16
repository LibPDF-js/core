# Documentation Writing Style Guide

This document defines the writing conventions for @libpdf/core documentation.

Documentation lives in `content/docs/` as MDX files and uses [Fumadocs](https://fumadocs.dev).

## Core Principles

1. **Task-based navigation** - Organize by what users want to do, not by class hierarchy
2. **Progressive examples** - Start simple, build to complex
3. **Explicit limitations** - List what's NOT supported clearly
4. **Real-world analogies** - Explain PDF concepts with familiar comparisons

## Tone

- Direct and action-oriented
- Second person ("you") with imperative voice
- Technical but accessible
- Acknowledge complexity without condescension
- No emojis or excessive personality

## Anti-Patterns to Avoid

- Assuming PDF domain knowledge
- Hiding default values
- Separate "TypeScript" sections (types integrated throughout)
- Monolithic single-page references
- Examples that don't work with current API

## File Structure

```
content/docs/
├── index.mdx              # Landing page with feature matrix
├── getting-started/       # Installation and first steps
├── guides/                # Task-based how-to guides
├── api/                   # Class and method reference
├── concepts/              # PDF internals explanations
├── advanced/              # Power user topics
└── migration/             # Migration guides
```

Each directory has a `meta.json` controlling navigation order:

```json
{
  "title": "Section Title",
  "pages": ["index", "page-one", "page-two"]
}
```

Use `---Label---` for section dividers in `meta.json`.

## MDX Frontmatter

Every page needs frontmatter for search and SEO:

```yaml
---
title: Working with Pages
description: Add, remove, reorder, copy, and merge PDF pages.
---
```

## Page Structure

```mdx
---
title: Feature Name
description: Brief description for SEO and previews.
---

# Feature Name

Brief description of what this does and when to use it.

## Quick Start

\`\`\`typescript
// Minimal working example
\`\`\`

---

## Section Name

Content organized by task or concept.

---

## See Also

- [Related Guide](/docs/guides/related)
```

## Parameter Tables

Use Sharp-style nested parameter tables for API documentation:

```markdown
### methodName(param, options?)

Description of what the method does.

| Param               | Type      | Default  | Description           |
| ------------------- | --------- | -------- | --------------------- |
| `param`             | `string`  | required | What it does          |
| `[options]`         | `Options` |          |                       |
| `[options.setting]` | `boolean` | `false`  | Nested option         |
| `[options.timeout]` | `number`  | `5000`   | Another nested option |

**Returns**: `Promise<Result>`

**Throws**:

- `SpecificError` - When something goes wrong
```

Key conventions:

- Square brackets `[param]` indicate optional parameters
- Nested options indented with `[options.name]` pattern
- Always show default values
- Group related options under their parent

## Code Examples

### Progressive Complexity

Start simple, then show advanced usage:

```typescript
// Basic usage
const pdf = await PDF.load(bytes);

// With options
const pdf = await PDF.load(bytes, {
  credentials: "password",
});

// Full example with error handling
try {
  const pdf = await PDF.load(bytes, {
    credentials: "password",
    lenient: false,
  });
} catch (error) {
  if (error instanceof PasswordError) {
    // Handle wrong password
  }
}
```

### Example Guidelines

- All examples must be valid TypeScript
- Show imports when not obvious
- Include expected output in comments where helpful
- Use realistic values, not `foo`/`bar`

## Callouts

Use Fumadocs callouts sparingly for important information:

```mdx
<Callout type="info">Informational note about behavior.</Callout>

<Callout type="warn">Warning about potential issues or breaking changes.</Callout>

<Callout type="error">Critical warning about data loss or security.</Callout>
```

Reserve callouts for:

- Beta/unstable features
- Security considerations
- Common mistakes
- Breaking changes

## Tables

Use tables for:

- Feature matrices
- Parameter documentation
- Comparison charts
- Error catalogs

```markdown
| Feature     | Status | Notes          |
| ----------- | ------ | -------------- |
| PDF 1.0-1.7 | Full   | Read and write |
| PDF 2.0     | Read   | Write planned  |
```

## Linking

- Link to related docs: `[PDFPage](/docs/api/pdf-page)`
- Use relative paths within docs
- Add "See Also" sections for discoverability

## Error Documentation

Categorize errors by when they occur:

```markdown
## Parse Errors

Thrown when loading a PDF.

### InvalidHeaderError

PDF header is missing or malformed.

**Common causes:**

- File is not a PDF
- File truncated during transfer

**Solution:** Verify the file is a valid PDF.
```

## Concept Explanations

Use analogies for PDF internals:

```markdown
Think of a PDF as a **book with an index at the back**.

In a regular book, you read front-to-back. But PDF readers start at the
_end_ of the file, reading the **cross-reference table** (xref) that
tells them where every object lives.
```

## Maintenance

- Include types inline so docs don't get stale
- Reference source file locations for complex behavior
- Update examples when API changes
- Test all code examples work
