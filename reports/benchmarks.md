# Benchmark Report

> Generated on 2026-06-22 at 11:51:40 UTC
>
> System: linux | AMD EPYC 7763 64-Core Processor (4 cores) | 16GB RAM | Bun 1.3.14

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
| libpdf          |   409.3 |  2.44ms |  4.27ms | ±2.35% |     205 |
| pdf-lib         |    25.7 | 38.92ms | 44.90ms | ±4.72% |      13 |
| @cantoo/pdf-lib |    24.6 | 40.59ms | 45.01ms | ±3.01% |      13 |

- **libpdf** is 15.93x faster than pdf-lib
- **libpdf** is 16.62x faster than @cantoo/pdf-lib

### Create blank PDF

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |   15.6K |  64us |  146us | ±1.39% |   7,816 |
| pdf-lib         |    2.7K | 364us | 1.25ms | ±2.29% |   1,375 |
| @cantoo/pdf-lib |    2.5K | 406us | 1.66ms | ±2.55% |   1,231 |

- **libpdf** is 5.69x faster than pdf-lib
- **libpdf** is 6.35x faster than @cantoo/pdf-lib

### Add 10 pages

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |    7.2K | 140us |  249us | ±2.40% |   3,579 |
| @cantoo/pdf-lib |    2.2K | 450us | 2.64ms | ±4.60% |   1,115 |
| pdf-lib         |    2.0K | 494us | 2.23ms | ±4.37% |   1,016 |

- **libpdf** is 3.22x faster than @cantoo/pdf-lib
- **libpdf** is 3.53x faster than pdf-lib

### Draw 50 rectangles

| Benchmark       | ops/sec |   Mean |    p99 |    RME | Samples |
| :-------------- | ------: | -----: | -----: | -----: | ------: |
| libpdf          |    2.7K |  372us | 1.01ms | ±1.70% |   1,345 |
| pdf-lib         |   563.5 | 1.77ms | 8.17ms | ±9.00% |     282 |
| @cantoo/pdf-lib |   537.9 | 1.86ms | 5.03ms | ±5.93% |     271 |

- **libpdf** is 4.77x faster than pdf-lib
- **libpdf** is 5.00x faster than @cantoo/pdf-lib

### Load and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |   414.8 |   2.41ms |   4.50ms | ±2.50% |     208 |
| pdf-lib         |    13.4 |  74.88ms |  83.98ms | ±5.36% |      10 |
| @cantoo/pdf-lib |     6.9 | 144.24ms | 147.81ms | ±1.36% |      10 |

- **libpdf** is 31.06x faster than pdf-lib
- **libpdf** is 59.83x faster than @cantoo/pdf-lib

### Load, modify, and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |    18.2 |  55.08ms |  67.04ms | ±6.79% |      10 |
| pdf-lib         |    13.1 |  76.09ms |  85.73ms | ±5.67% |      10 |
| @cantoo/pdf-lib |     7.0 | 143.69ms | 147.03ms | ±1.23% |      10 |

- **libpdf** is 1.38x faster than pdf-lib
- **libpdf** is 2.61x faster than @cantoo/pdf-lib

### Extract single page from 100-page PDF

| Benchmark       | ops/sec |   Mean |     p99 |    RME | Samples |
| :-------------- | ------: | -----: | ------: | -----: | ------: |
| libpdf          |   251.1 | 3.98ms |  7.19ms | ±3.32% |     126 |
| pdf-lib         |   111.7 | 8.96ms | 11.54ms | ±1.94% |      56 |
| @cantoo/pdf-lib |   103.6 | 9.65ms | 14.61ms | ±2.75% |      52 |

- **libpdf** is 2.25x faster than pdf-lib
- **libpdf** is 2.42x faster than @cantoo/pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    24.2 | 41.36ms | 44.19ms | ±1.87% |      13 |
| pdf-lib         |    12.9 | 77.70ms | 90.17ms | ±7.84% |       7 |
| @cantoo/pdf-lib |    12.7 | 78.43ms | 82.02ms | ±2.93% |       7 |

- **libpdf** is 1.88x faster than pdf-lib
- **libpdf** is 1.90x faster than @cantoo/pdf-lib

### Split 2000-page PDF into single-page PDFs (0.9MB)

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |     1.3 | 776.74ms | 776.74ms | ±0.00% |       1 |
| pdf-lib         |   0.733 |    1.36s |    1.36s | ±0.00% |       1 |
| @cantoo/pdf-lib |   0.662 |    1.51s |    1.51s | ±0.00% |       1 |

- **libpdf** is 1.76x faster than pdf-lib
- **libpdf** is 1.95x faster than @cantoo/pdf-lib

### Copy 10 pages between documents

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |   203.7 |  4.91ms |  6.72ms | ±2.52% |     102 |
| pdf-lib         |    85.3 | 11.72ms | 14.29ms | ±1.88% |      43 |
| @cantoo/pdf-lib |    76.3 | 13.11ms | 14.17ms | ±1.26% |      39 |

- **libpdf** is 2.39x faster than pdf-lib
- **libpdf** is 2.67x faster than @cantoo/pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    59.4 | 16.82ms | 19.75ms | ±2.18% |      30 |
| pdf-lib         |    18.9 | 52.84ms | 54.65ms | ±1.19% |      10 |
| @cantoo/pdf-lib |    16.0 | 62.62ms | 64.30ms | ±1.51% |       8 |

- **libpdf** is 3.14x faster than pdf-lib
- **libpdf** is 3.72x faster than @cantoo/pdf-lib

### Fill FINTRAC form fields

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    44.8 | 22.33ms | 24.96ms | ±3.01% |      23 |
| pdf-lib         |    34.6 | 28.91ms | 35.08ms | ±4.25% |      18 |
| @cantoo/pdf-lib |    33.2 | 30.15ms | 38.38ms | ±5.50% |      17 |

- **libpdf** is 1.29x faster than pdf-lib
- **libpdf** is 1.35x faster than @cantoo/pdf-lib

### Fill and flatten FINTRAC form

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    54.0 | 18.53ms | 23.24ms | ±3.42% |      27 |
| pdf-lib         |  FAILED |       - |       - |      - |       0 |
| @cantoo/pdf-lib |    29.9 | 33.45ms | 42.95ms | ±4.58% |      16 |

- **libpdf** is 1.81x faster than @cantoo/pdf-lib

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |   Mean |     p99 |    RME | Samples |
| :------------------------------ | ------: | -----: | ------: | -----: | ------: |
| copy 1 page                     |   911.5 | 1.10ms |  2.05ms | ±2.19% |     456 |
| copy 10 pages from 100-page PDF |   215.8 | 4.63ms |  5.15ms | ±0.84% |     108 |
| copy all 100 pages              |   125.2 | 7.99ms | 12.09ms | ±1.93% |      63 |

- **copy 1 page** is 4.22x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 7.28x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------------- | ------: | -----: | -----: | -----: | ------: |
| duplicate all pages (double the document) |   961.0 | 1.04ms | 1.42ms | ±0.66% |     481 |
| duplicate page 0                          |   955.2 | 1.05ms | 1.52ms | ±0.89% |     478 |

- **duplicate all pages (double the document)** is 1.01x faster than duplicate page 0

### Merge PDFs

| Benchmark               | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------- | ------: | ------: | ------: | -----: | ------: |
| merge 2 small PDFs      |   624.8 |  1.60ms |  2.03ms | ±0.98% |     313 |
| merge 10 small PDFs     |   120.7 |  8.29ms | 12.29ms | ±2.43% |      61 |
| merge 2 x 100-page PDFs |    67.4 | 14.84ms | 15.57ms | ±0.86% |      34 |

- **merge 2 small PDFs** is 5.18x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 9.27x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------- | ------: | -----: | -----: | -----: | ------: |
| draw 100 lines                      |    1.8K |  567us | 1.12ms | ±1.15% |     882 |
| draw 100 rectangles                 |    1.6K |  640us | 1.89ms | ±2.80% |     781 |
| draw 100 circles                    |    1.0K |  954us | 1.83ms | ±1.59% |     525 |
| create 10 pages with mixed content  |   675.0 | 1.48ms | 2.88ms | ±2.06% |     338 |
| draw 100 text lines (standard font) |   599.1 | 1.67ms | 2.94ms | ±1.97% |     300 |

- **draw 100 lines** is 1.13x faster than draw 100 rectangles
- **draw 100 lines** is 1.68x faster than draw 100 circles
- **draw 100 lines** is 2.61x faster than create 10 pages with mixed content
- **draw 100 lines** is 2.94x faster than draw 100 text lines (standard font)

## Forms

| Benchmark         | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------- | ------: | ------: | ------: | -----: | ------: |
| read field values |   350.8 |  2.85ms |  5.01ms | ±2.05% |     176 |
| get form fields   |   312.6 |  3.20ms |  7.25ms | ±4.32% |     157 |
| flatten form      |   118.8 |  8.42ms | 15.59ms | ±4.63% |      60 |
| fill text fields  |    77.1 | 12.97ms | 17.60ms | ±4.68% |      39 |

- **read field values** is 1.12x faster than get form fields
- **read field values** is 2.95x faster than flatten form
- **read field values** is 4.55x faster than fill text fields

## Loading

| Benchmark              | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------- | ------: | -----: | -----: | -----: | ------: |
| load small PDF (888B)  |   16.3K |   61us |  172us | ±1.41% |   8,145 |
| load medium PDF (19KB) |   10.9K |   91us |  174us | ±0.57% |   5,470 |
| load form PDF (116KB)  |   780.8 | 1.28ms | 2.43ms | ±1.72% |     391 |
| load heavy PDF (9.9MB) |   462.8 | 2.16ms | 2.59ms | ±0.52% |     232 |

- **load small PDF (888B)** is 1.49x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 20.86x faster than load form PDF (116KB)
- **load small PDF (888B)** is 35.19x faster than load heavy PDF (9.9MB)

## Saving

| Benchmark                          | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------------------- | ------: | -----: | -----: | -----: | ------: |
| save unmodified (19KB)             |    8.9K |  112us |  324us | ±2.02% |   4,461 |
| incremental save (19KB)            |    6.3K |  159us |  330us | ±0.90% |   3,152 |
| save with modifications (19KB)     |    1.2K |  844us | 1.64ms | ±1.66% |     593 |
| save heavy PDF (9.9MB)             |   473.4 | 2.11ms | 2.65ms | ±1.02% |     237 |
| incremental save heavy PDF (9.9MB) |   132.9 | 7.52ms | 8.99ms | ±3.04% |      67 |

- **save unmodified (19KB)** is 1.42x faster than incremental save (19KB)
- **save unmodified (19KB)** is 7.53x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 18.85x faster than save heavy PDF (9.9MB)
- **save unmodified (19KB)** is 67.12x faster than incremental save heavy PDF (9.9MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |   887.0 |  1.13ms |  2.44ms | ±2.85% |     445 |
| extractPages (1 page from 100-page PDF)  |   278.6 |  3.59ms |  4.29ms | ±1.19% |     140 |
| extractPages (1 page from 2000-page PDF) |    17.8 | 56.30ms | 57.60ms | ±0.74% |      10 |

- **extractPages (1 page from small PDF)** is 3.18x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 49.94x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------------------- | ------: | -------: | -------: | -----: | ------: |
| split 100-page PDF (0.1MB)  |    25.0 |  40.08ms |  44.16ms | ±2.24% |      13 |
| split 2000-page PDF (0.9MB) |     1.4 | 730.40ms | 730.40ms | ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 18.22x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |    Mean |     p99 |    RME | Samples |
| :----------------------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extract first 10 pages from 2000-page PDF              |    17.4 | 57.60ms | 59.13ms | ±1.29% |       9 |
| extract first 100 pages from 2000-page PDF             |    16.3 | 61.36ms | 62.48ms | ±1.26% |       9 |
| extract every 10th page from 2000-page PDF (200 pages) |    15.2 | 65.68ms | 66.68ms | ±0.77% |       8 |

- **extract first 10 pages from 2000-page PDF** is 1.07x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.14x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
