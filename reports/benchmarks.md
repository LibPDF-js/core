# Benchmark Report

> Generated on 2026-04-06 at 07:29:12 UTC
>
> System: linux | AMD EPYC 7763 64-Core Processor (4 cores) | 16GB RAM | Bun 1.3.11

---

## Contents

- [Comparison](#comparison)
- [Copying](#copying)
- [Drawing](#drawing)
- [Forms](#forms)
- [Loading](#loading)
- [Saving](#saving)
- [Splitting](#splitting)

## Comparison

### Load PDF

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |   391.8 |  2.55ms |  4.86ms | ±1.66% |     197 |
| pdf-lib         |    25.4 | 39.40ms | 44.75ms | ±3.85% |      13 |
| @cantoo/pdf-lib |    24.9 | 40.16ms | 46.29ms | ±3.88% |      13 |

- **libpdf** is 15.44x faster than pdf-lib
- **libpdf** is 15.74x faster than @cantoo/pdf-lib

### Create blank PDF

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |   15.8K |  63us |  137us | ±1.61% |   7,918 |
| pdf-lib         |    2.4K | 411us | 1.36ms | ±2.55% |   1,216 |
| @cantoo/pdf-lib |    2.2K | 446us | 1.67ms | ±2.57% |   1,122 |

- **libpdf** is 6.52x faster than pdf-lib
- **libpdf** is 7.06x faster than @cantoo/pdf-lib

### Add 10 pages

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |    9.9K | 101us |  184us | ±0.97% |   4,939 |
| @cantoo/pdf-lib |    2.0K | 497us | 2.16ms | ±3.12% |   1,008 |
| pdf-lib         |    2.0K | 510us | 1.76ms | ±2.64% |     981 |

- **libpdf** is 4.91x faster than @cantoo/pdf-lib
- **libpdf** is 5.03x faster than pdf-lib

### Draw 50 rectangles

| Benchmark       | ops/sec |   Mean |    p99 |    RME | Samples |
| :-------------- | ------: | -----: | -----: | -----: | ------: |
| libpdf          |    3.3K |  305us |  703us | ±1.06% |   1,638 |
| pdf-lib         |   601.4 | 1.66ms | 5.85ms | ±6.30% |     301 |
| @cantoo/pdf-lib |   505.6 | 1.98ms | 5.56ms | ±5.45% |     254 |

- **libpdf** is 5.45x faster than pdf-lib
- **libpdf** is 6.48x faster than @cantoo/pdf-lib

### Load and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |   370.9 |   2.70ms |   4.80ms | ±2.43% |     186 |
| pdf-lib         |    11.0 |  90.92ms | 102.13ms | ±5.43% |      10 |
| @cantoo/pdf-lib |     6.4 | 156.44ms | 161.83ms | ±1.08% |      10 |

- **libpdf** is 33.72x faster than pdf-lib
- **libpdf** is 58.02x faster than @cantoo/pdf-lib

### Load, modify, and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |    23.6 |  42.35ms |  45.45ms | ±3.02% |      12 |
| pdf-lib         |    11.2 |  89.00ms | 104.27ms | ±4.98% |      10 |
| @cantoo/pdf-lib |     6.4 | 155.05ms | 161.04ms | ±1.38% |      10 |

- **libpdf** is 2.10x faster than pdf-lib
- **libpdf** is 3.66x faster than @cantoo/pdf-lib

### Extract single page from 100-page PDF

| Benchmark       | ops/sec |   Mean |     p99 |    RME | Samples |
| :-------------- | ------: | -----: | ------: | -----: | ------: |
| libpdf          |   270.9 | 3.69ms |  4.70ms | ±1.04% |     136 |
| pdf-lib         |   107.3 | 9.32ms | 12.95ms | ±2.96% |      54 |
| @cantoo/pdf-lib |   102.5 | 9.76ms | 12.44ms | ±2.17% |      52 |

- **libpdf** is 2.53x faster than pdf-lib
- **libpdf** is 2.64x faster than @cantoo/pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark       | ops/sec |    Mean |      p99 |     RME | Samples |
| :-------------- | ------: | ------: | -------: | ------: | ------: |
| libpdf          |    29.2 | 34.30ms |  41.83ms |  ±5.26% |      15 |
| pdf-lib         |    11.5 | 86.67ms |  90.86ms |  ±3.57% |       6 |
| @cantoo/pdf-lib |    10.5 | 94.98ms | 112.98ms | ±10.06% |       6 |

- **libpdf** is 2.53x faster than pdf-lib
- **libpdf** is 2.77x faster than @cantoo/pdf-lib

### Split 2000-page PDF into single-page PDFs (0.9MB)

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |     1.6 | 625.69ms | 625.69ms | ±0.00% |       1 |
| pdf-lib         |   0.621 |    1.61s |    1.61s | ±0.00% |       1 |
| @cantoo/pdf-lib |   0.596 |    1.68s |    1.68s | ±0.00% |       1 |

- **libpdf** is 2.57x faster than pdf-lib
- **libpdf** is 2.68x faster than @cantoo/pdf-lib

### Copy 10 pages between documents

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |   217.4 |  4.60ms |  5.24ms | ±0.85% |     109 |
| pdf-lib         |    83.2 | 12.01ms | 13.94ms | ±1.77% |      42 |
| @cantoo/pdf-lib |    72.0 | 13.89ms | 21.67ms | ±3.83% |      36 |

- **libpdf** is 2.61x faster than pdf-lib
- **libpdf** is 3.02x faster than @cantoo/pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    70.7 | 14.15ms | 15.90ms | ±1.19% |      36 |
| pdf-lib         |    18.7 | 53.51ms | 55.01ms | ±1.18% |      10 |
| @cantoo/pdf-lib |    15.6 | 64.24ms | 66.25ms | ±1.72% |       8 |

- **libpdf** is 3.78x faster than pdf-lib
- **libpdf** is 4.54x faster than @cantoo/pdf-lib

### Fill FINTRAC form fields

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    47.0 | 21.28ms | 29.37ms | ±5.40% |      24 |
| pdf-lib         |    29.5 | 33.95ms | 38.72ms | ±3.90% |      15 |
| @cantoo/pdf-lib |    28.5 | 35.03ms | 47.89ms | ±7.91% |      15 |

- **libpdf** is 1.60x faster than pdf-lib
- **libpdf** is 1.65x faster than @cantoo/pdf-lib

### Fill and flatten FINTRAC form

| Benchmark       | ops/sec |    Mean |     p99 |     RME | Samples |
| :-------------- | ------: | ------: | ------: | ------: | ------: |
| libpdf          |    56.4 | 17.72ms | 21.40ms |  ±3.16% |      29 |
| pdf-lib         |  FAILED |       - |       - |       - |       0 |
| @cantoo/pdf-lib |    24.3 | 41.08ms | 62.65ms | ±11.31% |      13 |

- **libpdf** is 2.32x faster than @cantoo/pdf-lib

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |   Mean |    p99 |    RME | Samples |
| :------------------------------ | ------: | -----: | -----: | -----: | ------: |
| copy 1 page                     |   967.6 | 1.03ms | 2.41ms | ±3.16% |     484 |
| copy 10 pages from 100-page PDF |   219.6 | 4.55ms | 7.30ms | ±2.55% |     110 |
| copy all 100 pages              |   138.2 | 7.24ms | 7.90ms | ±0.79% |      70 |

- **copy 1 page** is 4.41x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 7.00x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |  Mean |    p99 |    RME | Samples |
| :---------------------------------------- | ------: | ----: | -----: | -----: | ------: |
| duplicate all pages (double the document) |    1.1K | 879us | 1.59ms | ±0.98% |     569 |
| duplicate page 0                          |    1.1K | 896us | 1.62ms | ±1.23% |     559 |

- **duplicate all pages (double the document)** is 1.02x faster than duplicate page 0

### Merge PDFs

| Benchmark               | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------- | ------: | ------: | ------: | -----: | ------: |
| merge 2 small PDFs      |   703.1 |  1.42ms |  1.83ms | ±0.62% |     352 |
| merge 10 small PDFs     |   132.5 |  7.54ms |  8.61ms | ±0.84% |      67 |
| merge 2 x 100-page PDFs |    74.2 | 13.49ms | 14.67ms | ±0.88% |      38 |

- **merge 2 small PDFs** is 5.30x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 9.48x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------- | ------: | -----: | -----: | -----: | ------: |
| draw 100 lines                      |    2.0K |  492us | 1.14ms | ±1.31% |   1,019 |
| draw 100 rectangles                 |    1.8K |  554us | 1.19ms | ±1.60% |     903 |
| draw 100 circles                    |   795.3 | 1.26ms | 2.74ms | ±2.64% |     398 |
| create 10 pages with mixed content  |   769.0 | 1.30ms | 2.15ms | ±1.59% |     385 |
| draw 100 text lines (standard font) |   641.8 | 1.56ms | 2.24ms | ±1.43% |     321 |

- **draw 100 lines** is 1.13x faster than draw 100 rectangles
- **draw 100 lines** is 2.56x faster than draw 100 circles
- **draw 100 lines** is 2.64x faster than create 10 pages with mixed content
- **draw 100 lines** is 3.17x faster than draw 100 text lines (standard font)

## Forms

| Benchmark         | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------- | ------: | ------: | ------: | -----: | ------: |
| read field values |   345.2 |  2.90ms |  5.13ms | ±1.50% |     173 |
| get form fields   |   303.9 |  3.29ms |  5.55ms | ±3.05% |     152 |
| flatten form      |   122.8 |  8.14ms | 11.45ms | ±2.78% |      62 |
| fill text fields  |    85.4 | 11.72ms | 16.30ms | ±4.41% |      43 |

- **read field values** is 1.14x faster than get form fields
- **read field values** is 2.81x faster than flatten form
- **read field values** is 4.04x faster than fill text fields

## Loading

| Benchmark              | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------- | ------: | -----: | -----: | -----: | ------: |
| load small PDF (888B)  |   16.7K |   60us |  147us | ±0.76% |   8,354 |
| load medium PDF (19KB) |   10.9K |   91us |  175us | ±0.45% |   5,467 |
| load form PDF (116KB)  |   750.7 | 1.33ms | 2.40ms | ±1.33% |     376 |
| load heavy PDF (9.9MB) |   438.9 | 2.28ms | 2.94ms | ±1.32% |     220 |

- **load small PDF (888B)** is 1.53x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 22.25x faster than load form PDF (116KB)
- **load small PDF (888B)** is 38.07x faster than load heavy PDF (9.9MB)

## Saving

| Benchmark                          | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------------------- | ------: | -----: | -----: | -----: | ------: |
| save unmodified (19KB)             |    8.2K |  121us |  294us | ±2.61% |   4,119 |
| incremental save (19KB)            |    5.8K |  172us |  329us | ±2.27% |   2,911 |
| save with modifications (19KB)     |    1.3K |  788us | 1.98ms | ±1.96% |     635 |
| save heavy PDF (9.9MB)             |   412.5 | 2.42ms | 4.59ms | ±2.80% |     207 |
| incremental save heavy PDF (9.9MB) |   132.8 | 7.53ms | 8.87ms | ±3.03% |      67 |

- **save unmodified (19KB)** is 1.42x faster than incremental save (19KB)
- **save unmodified (19KB)** is 6.49x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 19.96x faster than save heavy PDF (9.9MB)
- **save unmodified (19KB)** is 62.03x faster than incremental save heavy PDF (9.9MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |   993.7 |  1.01ms |  2.19ms | ±2.46% |     497 |
| extractPages (1 page from 100-page PDF)  |   276.7 |  3.61ms |  6.23ms | ±1.85% |     139 |
| extractPages (1 page from 2000-page PDF) |    18.0 | 55.54ms | 56.29ms | ±0.91% |      10 |

- **extractPages (1 page from small PDF)** is 3.59x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 55.19x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------------------- | ------: | -------: | -------: | -----: | ------: |
| split 100-page PDF (0.1MB)  |    31.5 |  31.73ms |  37.76ms | ±4.00% |      16 |
| split 2000-page PDF (0.9MB) |     1.7 | 597.77ms | 597.77ms | ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 18.84x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |    Mean |     p99 |    RME | Samples |
| :----------------------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extract first 10 pages from 2000-page PDF              |    17.4 | 57.38ms | 58.12ms | ±0.85% |       9 |
| extract first 100 pages from 2000-page PDF             |    16.6 | 60.19ms | 62.30ms | ±1.68% |       9 |
| extract every 10th page from 2000-page PDF (200 pages) |    15.4 | 64.80ms | 65.59ms | ±0.99% |       8 |

- **extract first 10 pages from 2000-page PDF** is 1.05x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.13x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
