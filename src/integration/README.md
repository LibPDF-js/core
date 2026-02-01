# Integration Tests

This directory contains integration tests that verify complete document workflows and end-to-end functionality.

## What's Here

Unlike unit tests (which test individual modules in isolation), these tests exercise the full stack:

- **Document lifecycle** - Creating, modifying, and saving PDFs
- **Cross-module interactions** - How drawing, fonts, annotations, and forms work together
- **Visual output** - Tests that generate actual PDF files for manual inspection
- **Real-world scenarios** - Complex workflows that mirror actual usage patterns

## Directory Structure

```
integration/
├── annotations/        # Annotation creation and rendering tests
├── drawing/           # Drawing API visual output tests
├── signatures/        # Digital signing workflow tests
└── text/              # Text extraction and layout tests
```

## Running Integration Tests

```bash
# Run all integration tests
bun test src/integration

# Run specific integration test suite
bun test src/integration/drawing

# Run with output for visual inspection
bun test src/integration/drawing --reporter=verbose
```

## Test Output

Many integration tests generate PDF files in `test-output/` for visual verification:

- `test-output/drawing/` - Shapes, paths, colors
- `test-output/annotations/` - Annotation appearances
- `test-output/signatures/` - Signed documents
- `test-output/text/` - Text extraction examples

These files are gitignored but useful for:

- Debugging rendering issues
- Manual verification of visual output
- Comparing results across changes

## Adding New Integration Tests

1. Create test file in appropriate subdirectory: `feature.test.ts`
2. Import from `#src/...` paths, not relative paths
3. Generate visual output when testing rendering
4. Use `saveTestOutput()` helper to save PDFs for inspection

Example:

```typescript
import { PDF } from "#src/api/pdf";
import { saveTestOutput } from "#src/test-utils";

describe("Feature Integration", () => {
  it("creates PDF with feature", () => {
    const pdf = PDF.create();
    const page = pdf.addPage();

    // ... test code ...

    const bytes = pdf.save();
    saveTestOutput("feature/result.pdf", bytes);
  });
});
```
