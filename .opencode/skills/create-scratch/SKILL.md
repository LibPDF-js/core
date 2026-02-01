---
name: create-scratch
description: Create a new scratch file in .agents/scratches/
---

You are creating a new scratch file in the `.agents/scratches/` directory.

## Your Task

1. **Determine the slug** - Based on the conversation context and intent, determine an appropriate file slug (kebab-case recommended). Ask the user if unclear.
2. **Gather content** - Collect or generate the scratch content from the discussion
3. **Create the file** - Use the create-scratch script to generate the file

## Usage

The script will automatically:

- Generate a unique three-word ID (e.g., `calm-teal-cloud`)
- Create frontmatter with current date and formatted title
- Save the file as `{id}-{slug}.md` in `.agents/scratches/`

## Creating the File

### Option 1: Direct Content

If you have the content ready, run:

```bash
bun scripts/create-scratch.ts "<slug>" "Your scratch content here"
```

### Option 2: Multi-line Content (Heredoc)

For multi-line content, use heredoc:

```bash
bun scripts/create-scratch.ts "<slug>" << HEREDOC
Your multi-line
scratch content
goes here
HEREDOC
```

### Option 3: Pipe Content

You can also pipe content:

```bash
echo "Your content" | bun scripts/create-scratch.ts "<slug>"
```

## File Format

The created file will have:

```markdown
---
date: 2026-01-21
title: Scratch Title
---

Your content here
```

The title is automatically formatted from the slug (e.g., `quick-notes` → `Quick Notes`).

## Guidelines

- Use descriptive slugs in kebab-case (e.g., `exploration-ideas`, `temporary-notes`)
- Scratch files are for temporary notes, explorations, or ideas
- The unique ID ensures no filename conflicts
- Files are automatically dated for organization

## Begin

Create a scratch file using an appropriate slug based on the conversation context and content for notes or exploration.
