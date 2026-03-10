# Performance Test Fixtures

This directory contains fixtures for performance testing, particularly for virtual scrolling with large documents.

## Fixtures

### multi-page-100.pdf

A simple 100-page PDF for testing virtual scrolling performance. Each page is US Letter size (612x792 points) with page numbers.

### multi-page-1000.pdf

A 1000-page PDF for testing memory usage with very large documents.

## Generating Fixtures

These fixtures can be generated using the library itself:

```typescript
import { PDF } from "@libpdf/core";

async function generateMultiPagePdf(pageCount: number): Promise<Uint8Array> {
  const pdf = await PDF.create();

  for (let i = 0; i < pageCount; i++) {
    const page = pdf.addPage();
    page.drawText(`Page ${i + 1}`, {
      x: 50,
      y: 742,
      size: 24,
    });
  }

  return pdf.save();
}
```

## Note

The virtual scrolling tests in `src/virtual-scroller.test.ts` use mock page dimensions and don't require actual PDF files for most scenarios. This directory is intended for integration testing and manual performance verification.
