---
name: create-plan
description: Create a new plan file in .agents/plans/
---

You are creating a new plan file in the `.agents/plans/` directory.

**First, read `.agents/ARCHITECTURE.md`** to understand the project's layered architecture and design principles. This is crucial for planning features that fit into the high-level/low-level API structure.

## Your Task

1. **Read ARCHITECTURE.md** - Understand the layer structure and design principles
2. **Determine the slug** - Based on the conversation context and intent, determine an appropriate file slug (kebab-case recommended). Ask the user if unclear.
3. **Gather content** - Collect or generate the plan content from the discussion
4. **Create the file** - Use the create-plan script to generate the file

## Architecture Considerations

When planning features, consider the two API layers:

- **High-level API**: Simple, task-focused interfaces (`PDF`, `PDFPage`, `PDFForm`)
- **Low-level API**: Full control via COS objects (`PdfDict`, `PdfArray`, `PdfStream`)

Most features should follow this pattern:

1. Implement low-level functionality first (direct PDF object manipulation)
2. Build high-level adapters that provide ergonomic APIs
3. Ensure the high-level API is what most users interact with

Example: A gradient feature might have:

- Low-level: `createAxialShading()`, `registerShading()` - direct PDF object creation
- High-level: `page.drawGradient()` - user-friendly method on PDFPage

## Usage

The script will automatically:

- Generate a unique three-word ID (e.g., `happy-blue-moon`)
- Create frontmatter with current date and formatted title
- Save the file as `{id}-{slug}.md` in `.agents/plans/`

## Creating the File

### Option 1: Direct Content

If you have the content ready, run:

```bash
bun scripts/create-plan.ts "<slug>" "Your plan content here"
```

### Option 2: Multi-line Content (Heredoc)

For multi-line content, use heredoc:

```bash
bun scripts/create-plan.ts "<slug>" << HEREDOC
Your multi-line
plan content
goes here
HEREDOC
```

### Option 3: Pipe Content

You can also pipe content:

```bash
echo "Your content" | bun scripts/create-plan.ts "<slug>"
```

## File Format

The created file will have:

```markdown
---
date: 2026-01-21
title: Plan Title
---

Your content here
```

The title is automatically formatted from the slug (e.g., `my-feature` → `My Feature`).

## Guidelines

- Use descriptive slugs in kebab-case (e.g., `user-authentication`, `api-integration`)
- Include clear, actionable plan content
- The unique ID ensures no filename conflicts
- Files are automatically dated for organization

## Begin

Create a plan file using an appropriate slug based on the conversation context and content for the planning task.
