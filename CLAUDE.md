# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Agent-Assisted Development

This project uses AI agent-assisted development. This means:

- **Complete all work fully** - Don't leave work partially done. Finish implementations, tests, and documentation before moving on.
- **No stubbing or skipping** - Stubbed features and skipped tests are not acceptable solutions. If something is complex, implement it completely.
- **Complexity is fine** - Don't shy away from complex changes. If a feature requires touching many files or significant refactoring, do it properly.
- **Tests are required** - All new functionality must have tests. "I'll add tests later" is not acceptable.

## Project Overview

**@libpdf/core** is a modern PDF library for TypeScript focused on both parsing and generation. It aims to combine the robust parsing of Mozilla's pdf.js with the clean generation API of pdf-lib, while supporting features like incremental updates that pdf-lib lacks.

**Priority**: Parsing and modification first, generation second.

## Commands

```bash
bun install                         # Install dependencies
bun run test                        # Run tests in watch mode
bun run test:run                    # Run tests once
bun run test -- --grep "pattern"    # Run specific tests
bun run typecheck                   # Type check with tsc
bun run lint                        # Check with Biome
bun run lint:fix                    # Fix lint issues
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
.docs/                # Local documentation (not committed, see below)
```

## Agent Working Documents (.agents/)

The `.agents/` directory contains documents for AI agent planning and decision-making. **Always reference these when working on this project.**

| File/Folder       | Purpose                                 | When to use                                                              |
| ----------------- | --------------------------------------- | ------------------------------------------------------------------------ |
| `GOALS.md`        | High-level library goals and priorities | Check before starting new features; ensure work aligns with goals        |
| `ARCHITECTURE.md` | Current architecture documentation      | Review before architectural changes; update after significant changes    |
| `plans/`          | Implementation plans for features       | Write plans here when asked to "write a plan" (use `NNN-name.md` format) |
| `justifications/` | Decision rationale documents            | Write here when asked to "justify" or explain a decision                 |
| `scratch/`        | Temporary notes and drafts              | Use for work-in-progress that doesn't need to persist                    |

**Key workflows:**

- "Write a plan" → Create in `.agents/plans/`
- "Write a justification" → Create in `.agents/justifications/`
- "Check/update goals" → Read/edit `.agents/GOALS.md`
- "Review/update architecture" → Read/edit `.agents/ARCHITECTURE.md`

### Writing Plans

Plans should focus on **what** and **why**, not **how**. The implementation details are discovered during coding, not during planning.

**Good plan content:**

- Problem statement and goals
- Scope (in/out)
- External dependencies and tradeoffs
- Desired usage (API examples showing how users will call the code)
- High-level architecture (components and data flow)
- Test plan (what to test, not how)
- Open questions and risks

**Avoid in plans:**

- Prescriptive class implementations with full method bodies
- Detailed algorithms (discover these during implementation)
- Line-by-line code that will just be copied during implementation

**Code samples in plans should be usage-focused:**

```typescript
// GOOD: Shows desired API from user's perspective
const font = await pdf.embedFont(fontBytes);
field.setFont(font);
field.setValue("Hello 世界");

// BAD: Prescribes internal implementation
export class TTFParser {
  private parseTables(data: Uint8Array): Map<string, Uint8Array> {
    const view = new DataView(data.buffer, data.byteOffset);
    const numTables = view.getUint16(4);
    // ... 50 more lines of implementation
  }
}
```

The goal is to align on the destination, not prescribe the journey.

## PDF Specification (.docs/)

The `.docs/` directory contains local documentation that is **not committed** (gitignored for copyright reasons). When available:

| Path                               | Contents                                 |
| ---------------------------------- | ---------------------------------------- |
| `.docs/pdf-specification/pages.md` | PDF 1.7 specification in Markdown format |
| `.docs/pdf-specification/images/`  | Figures from the specification           |

**Usage**: When implementing PDF features, reference this spec for authoritative details on:

- Object syntax (Chapter 7)
- Document structure (Chapter 7.7)
- Encryption (Chapter 7.6)
- Content streams (Chapter 9)
- Fonts (Chapter 9.6-9.10)
- Annotations (Chapter 12.5)

**Note**: This folder may not exist on all machines. If unavailable, fall back to the reference implementations in `checkouts/`.

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

| Library                                                                 | Use for                                            | Avoid                                                    |
| ----------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------- |
| **pdf.js** (`checkouts/pdfjs/src/core/`)                                | Parsing strategies, malformed PDF handling         | Global state, worker-centric assumptions                 |
| **pdf-lib** (`checkouts/pdf-lib/src/`)                                  | TypeScript API patterns, generation                | Limited parsing, no incremental save                     |
| **PDFBox** (`checkouts/pdfbox/pdfbox/src/main/java/org/apache/pdfbox/`) | Feature coverage, edge cases, brute-force recovery | Java-isms, excessive inheritance, mutable state patterns |

Initialize submodules: `git submodule update --init --recursive`

## Development Workflow

### TDD

Write tests first, then implement. Use fixtures from `fixtures/` directory.

### Commits

Prefer small, focused commits over large ones.

### Code Style

See [CODE_STYLE.md](./CODE_STYLE.md) for detailed formatting and naming conventions.

### Documentation Style

See [WRITING_STYLE.md](./WRITING_STYLE.md) for documentation writing conventions.

## Test Fixtures

Load fixtures with the typed helper:

```typescript
import { loadFixture } from "./test-utils.ts";
const bytes = await loadFixture("basic", "rot0.pdf");
```
