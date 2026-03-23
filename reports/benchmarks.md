# Benchmark Report

> Generated on 2026-03-23 at 07:09:28 UTC
>
> System: linux | Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz (4 cores) | 16GB RAM | Bun 1.3.11

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
| libpdf          |   478.5 |  2.09ms |  3.82ms | ±1.67% |     240 |
| @cantoo/pdf-lib |    25.4 | 39.42ms | 43.13ms | ±2.47% |      13 |
| pdf-lib         |    24.7 | 40.50ms | 48.60ms | ±6.00% |      13 |

- **libpdf** is 18.86x faster than @cantoo/pdf-lib
- **libpdf** is 19.38x faster than pdf-lib

### Create blank PDF

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |   18.3K |  55us |  100us | ±2.01% |   9,167 |
| pdf-lib         |    2.5K | 397us | 1.49ms | ±2.86% |   1,258 |
| @cantoo/pdf-lib |    2.5K | 406us | 1.56ms | ±2.76% |   1,232 |

- **libpdf** is 7.29x faster than pdf-lib
- **libpdf** is 7.44x faster than @cantoo/pdf-lib

### Add 10 pages

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |   10.4K |  96us |  187us | ±1.32% |   5,193 |
| @cantoo/pdf-lib |    2.1K | 474us | 2.35ms | ±3.90% |   1,055 |
| pdf-lib         |    2.1K | 488us | 1.94ms | ±2.95% |   1,026 |

- **libpdf** is 4.93x faster than @cantoo/pdf-lib
- **libpdf** is 5.06x faster than pdf-lib

### Draw 50 rectangles

| Benchmark       | ops/sec |   Mean |    p99 |    RME | Samples |
| :-------------- | ------: | -----: | -----: | -----: | ------: |
| libpdf          |    3.0K |  329us |  900us | ±1.57% |   1,522 |
| pdf-lib         |   607.1 | 1.65ms | 5.73ms | ±6.40% |     304 |
| @cantoo/pdf-lib |   537.8 | 1.86ms | 5.09ms | ±5.51% |     269 |

- **libpdf** is 5.01x faster than pdf-lib
- **libpdf** is 5.66x faster than @cantoo/pdf-lib

### Load and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |   465.7 |   2.15ms |   3.17ms | ±1.55% |     233 |
| pdf-lib         |    11.5 |  86.92ms | 105.06ms | ±8.04% |      10 |
| @cantoo/pdf-lib |     6.7 | 150.03ms | 157.96ms | ±1.79% |      10 |

- **libpdf** is 40.48x faster than pdf-lib
- **libpdf** is 69.88x faster than @cantoo/pdf-lib

### Load, modify, and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |    25.5 |  39.25ms |  41.15ms | ±2.10% |      13 |
| pdf-lib         |    11.7 |  85.18ms | 101.21ms | ±6.59% |      10 |
| @cantoo/pdf-lib |     6.6 | 151.85ms | 165.85ms | ±2.72% |      10 |

- **libpdf** is 2.17x faster than pdf-lib
- **libpdf** is 3.87x faster than @cantoo/pdf-lib

### Extract single page from 100-page PDF

| Benchmark       | ops/sec |   Mean |     p99 |    RME | Samples |
| :-------------- | ------: | -----: | ------: | -----: | ------: |
| libpdf          |   295.4 | 3.39ms |  4.07ms | ±1.03% |     148 |
| pdf-lib         |   107.3 | 9.32ms | 13.79ms | ±2.98% |      54 |
| @cantoo/pdf-lib |   105.0 | 9.53ms | 11.62ms | ±2.25% |      53 |

- **libpdf** is 2.75x faster than pdf-lib
- **libpdf** is 2.81x faster than @cantoo/pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark       | ops/sec |    Mean |      p99 |    RME | Samples |
| :-------------- | ------: | ------: | -------: | -----: | ------: |
| libpdf          |    31.2 | 32.06ms |  41.76ms | ±5.48% |      16 |
| pdf-lib         |    11.0 | 90.55ms | 106.08ms | ±9.37% |       6 |
| @cantoo/pdf-lib |    10.7 | 93.61ms | 107.23ms | ±8.07% |       6 |

- **libpdf** is 2.82x faster than pdf-lib
- **libpdf** is 2.92x faster than @cantoo/pdf-lib

### Split 2000-page PDF into single-page PDFs (0.9MB)

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |     1.8 | 568.70ms | 568.70ms | ±0.00% |       1 |
| pdf-lib         |   0.635 |    1.57s |    1.57s | ±0.00% |       1 |
| @cantoo/pdf-lib |   0.604 |    1.66s |    1.66s | ±0.00% |       1 |

- **libpdf** is 2.77x faster than pdf-lib
- **libpdf** is 2.91x faster than @cantoo/pdf-lib

### Copy 10 pages between documents

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |   234.9 |  4.26ms |  5.40ms | ±1.23% |     118 |
| pdf-lib         |    83.4 | 12.00ms | 13.89ms | ±1.65% |      42 |
| @cantoo/pdf-lib |    74.0 | 13.52ms | 15.39ms | ±1.93% |      37 |

- **libpdf** is 2.82x faster than pdf-lib
- **libpdf** is 3.18x faster than @cantoo/pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    75.1 | 13.31ms | 14.11ms | ±1.09% |      38 |
| pdf-lib         |    18.1 | 55.16ms | 57.91ms | ±2.32% |      10 |
| @cantoo/pdf-lib |    15.8 | 63.16ms | 64.06ms | ±0.91% |       8 |

- **libpdf** is 4.15x faster than pdf-lib
- **libpdf** is 4.75x faster than @cantoo/pdf-lib

### Fill FINTRAC form fields

| Benchmark       | ops/sec |    Mean |     p99 |     RME | Samples |
| :-------------- | ------: | ------: | ------: | ------: | ------: |
| libpdf          |    45.8 | 21.84ms | 53.91ms | ±14.94% |      23 |
| @cantoo/pdf-lib |    30.0 | 33.36ms | 41.37ms |  ±5.47% |      15 |
| pdf-lib         |    29.7 | 33.70ms | 50.88ms |  ±8.30% |      15 |

- **libpdf** is 1.53x faster than @cantoo/pdf-lib
- **libpdf** is 1.54x faster than pdf-lib

### Fill and flatten FINTRAC form

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    54.3 | 18.43ms | 25.15ms | ±4.55% |      28 |
| pdf-lib         |  FAILED |       - |       - |      - |       0 |
| @cantoo/pdf-lib |    26.9 | 37.22ms | 49.45ms | ±6.41% |      14 |

- **libpdf** is 2.02x faster than @cantoo/pdf-lib

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |   Mean |     p99 |    RME | Samples |
| :------------------------------ | ------: | -----: | ------: | -----: | ------: |
| copy 1 page                     |    1.1K |  930us |  2.31ms | ±3.88% |     538 |
| copy 10 pages from 100-page PDF |   242.4 | 4.13ms |  6.62ms | ±2.11% |     122 |
| copy all 100 pages              |   148.2 | 6.75ms | 10.18ms | ±1.71% |      75 |

- **copy 1 page** is 4.43x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 7.25x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |  Mean |    p99 |    RME | Samples |
| :---------------------------------------- | ------: | ----: | -----: | -----: | ------: |
| duplicate all pages (double the document) |    1.3K | 780us | 1.15ms | ±0.72% |     641 |
| duplicate page 0                          |    1.2K | 802us | 1.53ms | ±1.35% |     624 |

- **duplicate all pages (double the document)** is 1.03x faster than duplicate page 0

### Merge PDFs

| Benchmark               | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------- | ------: | ------: | ------: | -----: | ------: |
| merge 2 small PDFs      |   765.2 |  1.31ms |  2.50ms | ±1.27% |     383 |
| merge 10 small PDFs     |   146.3 |  6.84ms |  9.17ms | ±1.20% |      74 |
| merge 2 x 100-page PDFs |    81.4 | 12.28ms | 12.94ms | ±0.81% |      41 |

- **merge 2 small PDFs** is 5.23x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 9.40x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------- | ------: | -----: | -----: | -----: | ------: |
| draw 100 lines                      |    2.0K |  499us | 1.03ms | ±1.39% |   1,003 |
| draw 100 rectangles                 |    1.7K |  575us | 1.44ms | ±2.48% |     870 |
| draw 100 circles                    |   778.5 | 1.28ms | 2.79ms | ±2.70% |     390 |
| create 10 pages with mixed content  |   753.7 | 1.33ms | 2.26ms | ±1.70% |     377 |
| draw 100 text lines (standard font) |   642.9 | 1.56ms | 2.44ms | ±1.52% |     322 |

- **draw 100 lines** is 1.15x faster than draw 100 rectangles
- **draw 100 lines** is 2.58x faster than draw 100 circles
- **draw 100 lines** is 2.66x faster than create 10 pages with mixed content
- **draw 100 lines** is 3.12x faster than draw 100 text lines (standard font)

## Forms

| Benchmark         | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------- | ------: | ------: | ------: | -----: | ------: |
| read field values |   374.2 |  2.67ms |  3.34ms | ±1.03% |     188 |
| get form fields   |   339.8 |  2.94ms |  6.13ms | ±3.56% |     171 |
| flatten form      |   129.8 |  7.70ms | 11.29ms | ±2.64% |      65 |
| fill text fields  |    92.3 | 10.83ms | 15.85ms | ±5.34% |      47 |

- **read field values** is 1.10x faster than get form fields
- **read field values** is 2.88x faster than flatten form
- **read field values** is 4.05x faster than fill text fields

## Loading

| Benchmark              | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------- | ------: | -----: | -----: | -----: | ------: |
| load small PDF (888B)  |   18.8K |   53us |  110us | ±0.66% |   9,416 |
| load medium PDF (19KB) |   12.1K |   83us |  157us | ±0.58% |   6,037 |
| load form PDF (116KB)  |   834.5 | 1.20ms | 2.27ms | ±1.67% |     418 |
| load heavy PDF (9.9MB) |   515.6 | 1.94ms | 2.44ms | ±0.70% |     258 |

- **load small PDF (888B)** is 1.56x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 22.57x faster than load form PDF (116KB)
- **load small PDF (888B)** is 36.52x faster than load heavy PDF (9.9MB)

## Saving

| Benchmark                          | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------------------- | ------: | -----: | -----: | -----: | ------: |
| save unmodified (19KB)             |   10.2K |   98us |  209us | ±0.88% |   5,104 |
| incremental save (19KB)            |    6.9K |  146us |  293us | ±0.97% |   3,426 |
| save with modifications (19KB)     |    1.5K |  663us | 1.27ms | ±1.19% |     755 |
| save heavy PDF (9.9MB)             |   462.7 | 2.16ms | 2.88ms | ±1.14% |     232 |
| incremental save heavy PDF (9.9MB) |   140.0 | 7.14ms | 8.37ms | ±2.30% |      70 |

- **save unmodified (19KB)** is 1.49x faster than incremental save (19KB)
- **save unmodified (19KB)** is 6.77x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 22.06x faster than save heavy PDF (9.9MB)
- **save unmodified (19KB)** is 72.91x faster than incremental save heavy PDF (9.9MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |    1.2K |   869us |  1.71ms | ±2.07% |     576 |
| extractPages (1 page from 100-page PDF)  |   303.4 |  3.30ms |  3.91ms | ±0.88% |     152 |
| extractPages (1 page from 2000-page PDF) |    18.3 | 54.79ms | 57.64ms | ±1.53% |      10 |

- **extractPages (1 page from small PDF)** is 3.79x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 63.06x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------------------- | ------: | -------: | -------: | -----: | ------: |
| split 100-page PDF (0.1MB)  |    34.9 |  28.62ms |  33.62ms | ±3.04% |      18 |
| split 2000-page PDF (0.9MB) |     1.9 | 537.99ms | 537.99ms | ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 18.80x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |    Mean |     p99 |    RME | Samples |
| :----------------------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extract first 10 pages from 2000-page PDF              |    17.9 | 55.90ms | 57.27ms | ±0.87% |       9 |
| extract first 100 pages from 2000-page PDF             |    16.6 | 60.22ms | 70.41ms | ±5.29% |       9 |
| extract every 10th page from 2000-page PDF (200 pages) |    15.3 | 65.38ms | 76.92ms | ±6.53% |       8 |

- **extract first 10 pages from 2000-page PDF** is 1.08x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.17x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
