# Benchmark Comparison: Sync ObjectCopier

## Change

Removed async/await from all ObjectCopier methods. The copier does zero I/O —
every method was async but never awaited anything asynchronous. Removing the
async overhead eliminates microtask scheduling on every recursive call in the
deep-copy graph walk.

## Results

| Benchmark                                              | Baseline (ms) | Sync (ms) | Speedup |
| :----------------------------------------------------- | ------------: | --------: | ------: |
| extractPages (1 page from small PDF)                   |          0.45 |      0.40 |   1.14x |
| extractPages (1 page from 100-page PDF)                |          1.78 |      1.74 |   1.03x |
| extractPages (1 page from 2000-page PDF)               |         40.86 |     41.04 |   1.00x |
| split 100-page PDF (0.1MB)                             |         31.64 |     27.35 |   1.16x |
| split 2000-page PDF (0.9MB)                            |        582.50 |    506.61 |   1.15x |
| extract first 10 pages from 2000-page PDF              |         42.87 |     43.21 |   0.99x |
| extract first 100 pages from 2000-page PDF             |         50.92 |     53.87 |   0.95x |
| extract every 10th page from 2000-page PDF (200 pages) |         58.78 |     56.65 |   1.04x |

## Key Takeaways

- **100-page split**: 31.6ms -> 27.3ms (1.16x faster)
- **2000-page split**: 582.5ms -> 506.6ms (1.15x faster)
- Single-page extraction from small PDFs: ~14% faster (0.45ms -> 0.40ms)
- Batch extraction noise is within margin of error for single runs
