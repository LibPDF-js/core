# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**@libpdf/core** is a modern PDF library for TypeScript focused on both parsing and generation. It aims to combine the robust parsing of Mozilla's pdf.js with the clean generation API of pdf-lib, while supporting features like incremental updates that pdf-lib lacks.

**Priority**: Parsing and modification first, generation second.

## Commands

```bash
bun install                    # Install dependencies
bun test                       # Run tests in watch mode
bun test:run                   # Run tests once
bun test -- --grep "pattern"   # Run specific tests
bun run typecheck              # Type check with tsc
bun run lint                   # Check with Biome
bun run lint:fix               # Fix lint issues
```

## Project Structure

```
src/                  # Source code
  index.ts            # Main entry point
  test-utils.ts       # Shared test utilities (loadFixture, byte helpers)
fixtures/             # PDF test files organized by feature
  basic/              # Simple PDFs for core parsing
  xref/               # XRef table/stream tests
  filter/             # Stream compression tests
  encryption/         # Encrypted PDF tests
  malformed/          # Error recovery tests
  text/               # Text extraction tests
checkouts/            # Reference library submodules (read-only)
  pdfjs/              # Mozilla pdf.js - parsing reference
  pdf-lib/            # pdf-lib - generation API reference
  pdfbox/             # Apache PDFBox - architecture reference
.agents/              # AI agent working documents (see below)
```

## Agent Working Documents (.agents/)

The `.agents/` directory contains documents for AI agent planning and decision-making. **Always reference these when working on this project.**

| File/Folder | Purpose | When to use |
|-------------|---------|-------------|
| `GOALS.md` | High-level library goals and priorities | Check before starting new features; ensure work aligns with goals |
| `ARCHITECTURE.md` | Current architecture documentation | Review before architectural changes; update after significant changes |
| `plans/` | Implementation plans for features | Write plans here when asked to "write a plan" |
| `justifications/` | Decision rationale documents | Write here when asked to "justify" or explain a decision |
| `scratch/` | Temporary notes and drafts | Use for work-in-progress that doesn't need to persist |

**Key workflows:**
- "Write a plan" → Create in `.agents/plans/`
- "Write a justification" → Create in `.agents/justifications/`
- "Check/update goals" → Read/edit `.agents/GOALS.md`
- "Review/update architecture" → Read/edit `.agents/ARCHITECTURE.md`

## Design Principles

### Error Handling
Be **super lenient** with malformed PDFs. Like PDFBox, fall back to brute-force parsing when standard parsing fails. Prioritize opening files over strict spec compliance.

### API Layers
- **Low-level**: Use PDF spec terminology (COS objects, xref, trailer, catalog)
- **High-level**: Use simple terms (document, page, metadata) that map to spec internally

### Runtime
Universal — equal priority for Node.js, Bun, and browsers.

### Async
Async-first. All I/O operations return Promises.

### State Management
Mutable or copy-on-write internally — PDF modification requires reasoning about xrefs and object references.

### Binary Data
Prefer streaming for large files, but don't over-complicate the API. Use `Uint8Array` throughout (not Buffer).

## Reference Libraries

Cross-reference these, but avoid their baggage:

| Library | Use for | Avoid |
|---------|---------|-------|
| **pdf.js** (`checkouts/pdfjs/src/core/`) | Parsing strategies, malformed PDF handling | Global state, worker-centric assumptions |
| **pdf-lib** (`checkouts/pdf-lib/src/`) | TypeScript API patterns, generation | Limited parsing, no incremental save |
| **PDFBox** (`checkouts/pdfbox/pdfbox/src/main/java/org/apache/pdfbox/`) | Feature coverage, edge cases, brute-force recovery | Java-isms, excessive inheritance, mutable state patterns |

Initialize submodules: `git submodule update --init --recursive`

## Development Workflow

### TDD
Write tests first, then implement. Use fixtures from `fixtures/` directory.

### Commits
Prefer small, focused commits over large ones.

### Code Style

See [CODE_STYLE.md](./CODE_STYLE.md) for detailed formatting and naming conventions.

## Test Fixtures

Load fixtures with the typed helper:
```typescript
import { loadFixture } from "./test-utils.ts";
const bytes = await loadFixture("basic", "rot0.pdf");
```
