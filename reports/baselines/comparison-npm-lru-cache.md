# Benchmark Comparison: npm lru-cache

## Change

Replaced internal LRU cache (Map delete+set on every get) with the npm `lru-cache`
package (v11, doubly-linked-list, O(1) get/set without Map rehashing).

## Results (vs original baseline)

| Benchmark                                              | Baseline (ms) | Sync Copier (ms) | + npm lru-cache (ms) | Total Speedup |
| :----------------------------------------------------- | ------------: | ---------------: | -------------------: | ------------: |
| extractPages (1 page from small PDF)                   |          0.45 |             0.40 |                 0.38 |         1.17x |
| extractPages (1 page from 100-page PDF)                |          1.78 |             1.74 |                 1.66 |         1.07x |
| extractPages (1 page from 2000-page PDF)               |         40.86 |            41.04 |                25.50 |         1.60x |
| split 100-page PDF (0.1MB)                             |         31.64 |            27.35 |                24.59 |         1.29x |
| split 2000-page PDF (0.9MB)                            |        582.50 |           506.61 |               432.27 |         1.35x |
| extract first 10 pages from 2000-page PDF              |         42.87 |            43.21 |                27.31 |         1.57x |
| extract first 100 pages from 2000-page PDF             |         50.92 |            53.87 |                35.21 |         1.45x |
| extract every 10th page from 2000-page PDF (200 pages) |         58.78 |            56.65 |                40.52 |         1.45x |

## Incremental improvement (sync copier -> + npm lru-cache)

| Benchmark                                              | Sync Copier (ms) | + npm lru-cache (ms) | Incremental Speedup |
| :----------------------------------------------------- | ---------------: | -------------------: | ------------------: |
| extractPages (1 page from small PDF)                   |             0.40 |                 0.38 |               1.03x |
| extractPages (1 page from 100-page PDF)                |             1.74 |                 1.66 |               1.05x |
| extractPages (1 page from 2000-page PDF)               |            41.04 |                25.50 |               1.61x |
| split 100-page PDF (0.1MB)                             |            27.35 |                24.59 |               1.11x |
| split 2000-page PDF (0.9MB)                            |           506.61 |               432.27 |               1.17x |
| extract first 10 pages from 2000-page PDF              |            43.21 |                27.31 |               1.58x |
| extract first 100 pages from 2000-page PDF             |            53.87 |                35.21 |               1.53x |
| extract every 10th page from 2000-page PDF (200 pages) |            56.65 |                40.52 |               1.40x |

## Key Takeaways

- **2000-page split**: 582.5ms -> 432.3ms (1.35x faster total)
- **100-page split**: 31.6ms -> 24.6ms (1.29x faster total)
- **Single page from 2000p**: 40.9ms -> 25.5ms (1.60x faster total)
- **npm lru-cache incremental gain on 2000-page split**: 506.6ms -> 432.3ms (1.17x)
