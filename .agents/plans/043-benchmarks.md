# Plan: Basic Benchmarks

## Problem Statement

Users evaluating @libpdf/core need confidence that the library performs reasonably well. Currently there are no benchmarks, making it impossible to:

1. Demonstrate performance characteristics to potential users
2. Compare against alternatives like pdf-lib
3. Detect performance regressions during development

## Goals

- Provide basic benchmarks for common operations
- Compare performance against pdf-lib where APIs overlap
- Give users a rough sense of expected performance
- Keep the benchmark suite minimal and maintainable

## Non-Goals

- Comprehensive micro-benchmarks for every operation
- Benchmarking against pdf.js (different focus: rendering)
- Achieving "fastest" status (correctness > speed)
- CI integration (can add later if needed)

## Scope

### In Scope

- Loading PDFs (small, medium, large)
- Saving PDFs (full write, incremental)
- Drawing operations (shapes, text)
- Form filling
- Comparison with pdf-lib for overlapping operations

### Out of Scope

- Encryption/decryption benchmarks (security-sensitive)
- Digital signature benchmarks (involves crypto)
- Text extraction benchmarks (can add later)
- Memory usage profiling

## Technical Approach

### Framework: Vitest Bench

Vitest 4.x (already installed) has built-in benchmarking support via `vitest bench`. This provides:

- Same configuration as existing tests
- Warmup iterations, iteration counts, time limits
- JSON output for potential CI integration
- Familiar API for contributors

### Directory Structure

```
benchmarks/
  loading.bench.ts       # PDF.load() performance
  saving.bench.ts        # PDF.save() performance
  drawing.bench.ts       # Shape/text drawing
  forms.bench.ts         # Form field operations
  comparison.bench.ts    # libpdf vs pdf-lib head-to-head
```

### Benchmark Categories

#### 1. Loading Performance

| Benchmark       | Fixture                                    | Description              |
| --------------- | ------------------------------------------ | ------------------------ |
| Load small PDF  | `basic/rot0.pdf` (888B)                    | Minimal parsing overhead |
| Load medium PDF | `basic/sample.pdf` (19KB)                  | Typical document         |
| Load large PDF  | `text/variety/us_constitution.pdf` (380KB) | Multi-page document      |
| Load with forms | `forms/sample_form.pdf` (116KB)            | Form parsing             |

#### 2. Saving Performance

| Benchmark               | Description               |
| ----------------------- | ------------------------- |
| Save unmodified         | Serialize without changes |
| Save with modifications | After adding content      |
| Incremental save        | Append-only save          |

#### 3. Drawing Performance

| Benchmark              | Description             |
| ---------------------- | ----------------------- |
| Draw rectangles (100x) | Many simple shapes      |
| Draw circles (100x)    | Curved shapes           |
| Draw lines (100x)      | Path operations         |
| Draw text (100 lines)  | Text with standard font |

#### 4. Form Operations

| Benchmark        | Description               |
| ---------------- | ------------------------- |
| Fill text fields | Set values on text fields |
| Get field values | Read form data            |
| Flatten form     | Convert to static content |

#### 5. Library Comparison

Compare pdf-lib and libpdf on operations both support:

| Operation        | Description              |
| ---------------- | ------------------------ |
| Load PDF         | Parse the same document  |
| Create blank PDF | New document creation    |
| Add pages        | Insert blank pages       |
| Draw shapes      | Rectangle/circle drawing |
| Save PDF         | Serialize to bytes       |

### Fixture Selection

Use existing fixtures for small/medium, download a large public domain PDF:

- **Small**: `fixtures/basic/rot0.pdf` (888 bytes, minimal)
- **Medium**: `fixtures/basic/sample.pdf` (19KB, typical)
- **Large**: Download from Internet Archive or similar (~5-10MB, real-world document)
- **Forms**: `fixtures/forms/sample_form.pdf` (116KB, interactive)

#### Large PDF Strategy

For "large" benchmarks, we need a multi-MB PDF to test real-world performance. Options:

1. **Internet Archive** — Public domain books/documents (e.g., government reports, old technical manuals)
2. **NASA Technical Reports** — All public domain, many are 5-20MB
3. **Project Gutenberg** — Public domain books with images

The benchmark will download the large PDF on first run and cache it in `fixtures/benchmarks/`. This keeps the repo size small while allowing real-world performance testing.

```typescript
// benchmarks/fixtures.ts
const LARGE_PDF_URL = "https://archive.org/download/..."; // TBD: specific URL
const LARGE_PDF_PATH = "fixtures/benchmarks/large-document.pdf";

export async function getLargePdf(): Promise<Uint8Array> {
  if (await Bun.file(LARGE_PDF_PATH).exists()) {
    return Bun.file(LARGE_PDF_PATH).bytes();
  }
  // Download and cache
  const response = await fetch(LARGE_PDF_URL);
  const bytes = new Uint8Array(await response.arrayBuffer());
  await Bun.write(LARGE_PDF_PATH, bytes);
  return bytes;
}
```

The `fixtures/benchmarks/` directory will be gitignored.

### Example Usage

```typescript
// benchmarks/loading.bench.ts
import { bench, describe } from "vitest";
import { PDF } from "../src";

const smallPdf = await Bun.file("fixtures/basic/rot0.pdf").bytes();
const largePdf = await Bun.file("fixtures/text/variety/us_constitution.pdf").bytes();

describe("PDF Loading", () => {
  bench("load small PDF (888B)", async () => {
    await PDF.load(smallPdf);
  });

  bench("load large PDF (380KB)", async () => {
    await PDF.load(largePdf);
  });
});
```

```typescript
// benchmarks/comparison.bench.ts
import { bench, describe } from "vitest";
import { PDF } from "../src";
import { PDFDocument } from "pdf-lib";

const pdfBytes = await Bun.file("fixtures/basic/sample.pdf").bytes();

describe("Load PDF", () => {
  bench("libpdf", async () => {
    await PDF.load(pdfBytes);
  });

  bench("pdf-lib", async () => {
    await PDFDocument.load(pdfBytes);
  });
});
```

### Configuration

Add benchmark configuration to `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    // existing config...
  },
  bench: {
    include: ["benchmarks/**/*.bench.ts"],
    reporters: ["default"],
  },
});
```

Add npm script to `package.json`:

```json
{
  "scripts": {
    "bench": "vitest bench"
  }
}
```

### Dependencies

pdf-lib will be added as a dev dependency for comparison benchmarks:

```bash
bun add -d pdf-lib
```

## Test Plan

- Run `bun run bench` successfully
- All benchmarks complete without errors
- Results display in readable format
- Comparison benchmarks show both libraries

## Open Questions

1. **Should we include pdf-lib comparisons?**
   - Pro: Useful for users evaluating alternatives
   - Con: Adds maintenance burden, results vary by machine
   - **Decision**: Yes, include them — they're useful for users and we can note results are machine-dependent

2. **Should we set up CI benchmarking?**
   - Can be added later with CodSpeed or similar
   - For now, local benchmarks are sufficient

3. **How many iterations/warmup?**
   - Default Vitest settings should be fine
   - Can tune if results are noisy

## Risks

- **Performance may not be competitive**: That's okay — correctness and features matter more. Benchmarks help identify obvious issues.
- **Results vary by machine**: Document that benchmarks are relative, not absolute.
- **pdf-lib API differences**: Some operations may not be directly comparable; note differences in comments.
