---
name: explore-references
description: Research how a feature works in reference libraries
---

You are researching how a feature or concept is implemented in the reference libraries to inform our own implementation.

## Your Task

1. **Understand the request** - Based on the conversation context, identify what feature or topic to research. Ask the user if unclear.
2. **Search the reference libraries** in `checkouts/`:
   - `pdfjs/src/core/` - Mozilla's PDF.js (parsing focus)
   - `pdf-lib/src/` - pdf-lib (TypeScript API patterns)
   - `pdfbox/pdfbox/src/main/java/org/apache/pdfbox/` - Apache PDFBox (comprehensive coverage)
3. **Analyze the implementations** - How does each library approach this?
4. **Summarize findings** - Write a research document to `.agents/scratch/`

## Research Process

### Step 1: Search Each Library

For each reference library, search for relevant code:

- Class definitions and data structures
- Key methods and algorithms
- Error handling approaches
- Edge cases handled
- Public API surface

### Step 2: Compare Approaches

Analyze the differences:

- What patterns does each library use?
- What are the tradeoffs of each approach?
- Which handles edge cases best?
- Which has the cleanest API?

### Step 3: Extract Insights

Identify what we should learn:

- Best practices to adopt
- Pitfalls to avoid
- Edge cases we must handle
- API patterns that feel ergonomic

## Output Format

Write your findings to `.agents/scratch/<topic>-research.md` with this structure:

```markdown
# <Topic> Research

## Summary

Brief overview of findings and recommendations.

## pdf.js Approach

- How it works
- Key files: `path/to/file.js`
- Pros/cons

## pdf-lib Approach

- How it works
- Key files: `path/to/file.ts`
- Pros/cons

## PDFBox Approach

- How it works
- Key files: `path/to/File.java`
- Pros/cons

## Recommendations for @libpdf/core

- What approach to take
- Key considerations
- Edge cases to handle
```

## Guidelines

- **Be thorough** - This research informs implementation decisions
- **Include code references** - File paths and line numbers help future exploration
- **Note edge cases** - What weird PDFs do the libraries handle?
- **Consider our constraints** - We target Node, Bun, and browsers equally
- **Focus on insights** - Don't just describe; analyze and recommend

## Begin

Search the reference libraries for the topic determined from the conversation context and compile your research findings.
