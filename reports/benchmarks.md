# Benchmark Report

> Generated on 2026-04-13 at 08:02:38 UTC
>
> System: linux | AMD EPYC 9V74 80-Core Processor (4 cores) | 16GB RAM | Bun 1.3.12

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
| libpdf          |   399.0 |  2.51ms |  4.25ms | ±2.07% |     200 |
| @cantoo/pdf-lib |    26.5 | 37.80ms | 40.30ms | ±2.00% |      14 |
| pdf-lib         |    25.6 | 39.06ms | 44.03ms | ±5.12% |      13 |

- **libpdf** is 15.08x faster than @cantoo/pdf-lib
- **libpdf** is 15.58x faster than pdf-lib

### Create blank PDF

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |   22.3K |  45us |   97us | ±1.58% |  11,156 |
| pdf-lib         |    2.9K | 344us | 1.39ms | ±2.75% |   1,455 |
| @cantoo/pdf-lib |    2.6K | 381us | 1.68ms | ±3.04% |   1,313 |

- **libpdf** is 7.67x faster than pdf-lib
- **libpdf** is 8.50x faster than @cantoo/pdf-lib

### Add 10 pages

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |   12.2K |  82us |  127us | ±1.30% |   6,089 |
| @cantoo/pdf-lib |    2.4K | 412us | 1.96ms | ±3.76% |   1,215 |
| pdf-lib         |    2.3K | 442us | 1.85ms | ±3.00% |   1,132 |

- **libpdf** is 5.01x faster than @cantoo/pdf-lib
- **libpdf** is 5.38x faster than pdf-lib

### Draw 50 rectangles

| Benchmark       | ops/sec |   Mean |    p99 |    RME | Samples |
| :-------------- | ------: | -----: | -----: | -----: | ------: |
| libpdf          |    3.4K |  297us |  802us | ±1.46% |   1,685 |
| pdf-lib         |   689.7 | 1.45ms | 5.36ms | ±5.74% |     345 |
| @cantoo/pdf-lib |   568.5 | 1.76ms | 5.20ms | ±5.73% |     285 |

- **libpdf** is 4.88x faster than pdf-lib
- **libpdf** is 5.92x faster than @cantoo/pdf-lib

### Load and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |   401.5 |   2.49ms |   4.09ms | ±1.68% |     201 |
| pdf-lib         |    11.3 |  88.15ms | 100.92ms | ±6.66% |      10 |
| @cantoo/pdf-lib |     6.6 | 151.78ms | 158.34ms | ±1.41% |      10 |

- **libpdf** is 35.40x faster than pdf-lib
- **libpdf** is 60.95x faster than @cantoo/pdf-lib

### Load, modify, and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |     RME | Samples |
| :-------------- | ------: | -------: | -------: | ------: | ------: |
| libpdf          |    21.9 |  45.57ms |  57.40ms | ±10.07% |      11 |
| pdf-lib         |    11.7 |  85.83ms |  94.29ms |  ±3.68% |      10 |
| @cantoo/pdf-lib |     6.5 | 154.36ms | 170.56ms |  ±3.02% |      10 |

- **libpdf** is 1.88x faster than pdf-lib
- **libpdf** is 3.39x faster than @cantoo/pdf-lib

### Extract single page from 100-page PDF

| Benchmark       | ops/sec |   Mean |     p99 |    RME | Samples |
| :-------------- | ------: | -----: | ------: | -----: | ------: |
| libpdf          |   281.9 | 3.55ms |  4.21ms | ±0.88% |     141 |
| pdf-lib         |   106.5 | 9.39ms | 17.59ms | ±3.86% |      54 |
| @cantoo/pdf-lib |   106.3 | 9.41ms | 10.97ms | ±2.01% |      54 |

- **libpdf** is 2.65x faster than pdf-lib
- **libpdf** is 2.65x faster than @cantoo/pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark       | ops/sec |    Mean |      p99 |     RME | Samples |
| :-------------- | ------: | ------: | -------: | ------: | ------: |
| libpdf          |    33.8 | 29.62ms |  40.65ms |  ±5.02% |      17 |
| pdf-lib         |    12.5 | 79.80ms |  83.52ms |  ±2.49% |       7 |
| @cantoo/pdf-lib |    11.2 | 88.95ms | 114.39ms | ±15.81% |       6 |

- **libpdf** is 2.69x faster than pdf-lib
- **libpdf** is 3.00x faster than @cantoo/pdf-lib

### Split 2000-page PDF into single-page PDFs (0.9MB)

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |     1.8 | 556.62ms | 556.62ms | ±0.00% |       1 |
| pdf-lib         |   0.679 |    1.47s |    1.47s | ±0.00% |       1 |
| @cantoo/pdf-lib |   0.645 |    1.55s |    1.55s | ±0.00% |       1 |

- **libpdf** is 2.65x faster than pdf-lib
- **libpdf** is 2.79x faster than @cantoo/pdf-lib

### Copy 10 pages between documents

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |   226.2 |  4.42ms |  5.20ms | ±1.05% |     114 |
| pdf-lib         |    84.2 | 11.88ms | 12.73ms | ±1.17% |      43 |
| @cantoo/pdf-lib |    73.1 | 13.68ms | 22.01ms | ±4.38% |      37 |

- **libpdf** is 2.69x faster than pdf-lib
- **libpdf** is 3.09x faster than @cantoo/pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    72.0 | 13.89ms | 15.70ms | ±1.22% |      36 |
| pdf-lib         |    18.9 | 52.85ms | 54.40ms | ±0.99% |      10 |
| @cantoo/pdf-lib |    16.0 | 62.55ms | 64.36ms | ±1.87% |       8 |

- **libpdf** is 3.80x faster than pdf-lib
- **libpdf** is 4.50x faster than @cantoo/pdf-lib

### Fill FINTRAC form fields

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    51.6 | 19.37ms | 24.86ms | ±4.80% |      26 |
| pdf-lib         |    30.9 | 32.32ms | 43.78ms | ±5.97% |      16 |
| @cantoo/pdf-lib |    30.2 | 33.07ms | 42.08ms | ±6.02% |      16 |

- **libpdf** is 1.67x faster than pdf-lib
- **libpdf** is 1.71x faster than @cantoo/pdf-lib

### Fill and flatten FINTRAC form

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    61.3 | 16.31ms | 23.15ms | ±4.21% |      31 |
| pdf-lib         |  FAILED |       - |       - |      - |       0 |
| @cantoo/pdf-lib |    26.0 | 38.51ms | 50.94ms | ±7.27% |      13 |

- **libpdf** is 2.36x faster than @cantoo/pdf-lib

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |   Mean |    p99 |    RME | Samples |
| :------------------------------ | ------: | -----: | -----: | -----: | ------: |
| copy 1 page                     |    1.1K |  949us | 2.14ms | ±3.12% |     527 |
| copy 10 pages from 100-page PDF |   240.1 | 4.17ms | 7.59ms | ±2.17% |     121 |
| copy all 100 pages              |   141.3 | 7.08ms | 8.59ms | ±1.14% |      71 |

- **copy 1 page** is 4.39x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 7.45x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |  Mean |    p99 |    RME | Samples |
| :---------------------------------------- | ------: | ----: | -----: | -----: | ------: |
| duplicate all pages (double the document) |    1.3K | 786us | 1.22ms | ±0.86% |     636 |
| duplicate page 0                          |    1.3K | 795us | 1.34ms | ±0.99% |     629 |

- **duplicate all pages (double the document)** is 1.01x faster than duplicate page 0

### Merge PDFs

| Benchmark               | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------- | ------: | ------: | ------: | -----: | ------: |
| merge 2 small PDFs      |   763.6 |  1.31ms |  1.72ms | ±0.73% |     382 |
| merge 10 small PDFs     |   142.7 |  7.01ms | 11.11ms | ±2.14% |      72 |
| merge 2 x 100-page PDFs |    75.2 | 13.29ms | 26.01ms | ±5.63% |      39 |

- **merge 2 small PDFs** is 5.35x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 10.15x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------- | ------: | -----: | -----: | -----: | ------: |
| draw 100 lines                      |    2.0K |  492us | 1.16ms | ±1.64% |   1,016 |
| draw 100 rectangles                 |    1.8K |  558us | 1.32ms | ±2.87% |     896 |
| draw 100 circles                    |   822.4 | 1.22ms | 2.74ms | ±2.91% |     412 |
| create 10 pages with mixed content  |   771.7 | 1.30ms | 2.27ms | ±2.04% |     386 |
| draw 100 text lines (standard font) |   659.5 | 1.52ms | 2.35ms | ±1.39% |     330 |

- **draw 100 lines** is 1.13x faster than draw 100 rectangles
- **draw 100 lines** is 2.47x faster than draw 100 circles
- **draw 100 lines** is 2.63x faster than create 10 pages with mixed content
- **draw 100 lines** is 3.08x faster than draw 100 text lines (standard font)

## Forms

| Benchmark         | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------- | ------: | ------: | ------: | -----: | ------: |
| read field values |   368.9 |  2.71ms |  4.66ms | ±1.58% |     185 |
| get form fields   |   330.6 |  3.02ms |  7.07ms | ±3.89% |     166 |
| flatten form      |   127.5 |  7.84ms | 10.71ms | ±2.08% |      64 |
| fill text fields  |    87.8 | 11.39ms | 14.47ms | ±4.21% |      44 |

- **read field values** is 1.12x faster than get form fields
- **read field values** is 2.89x faster than flatten form
- **read field values** is 4.20x faster than fill text fields

## Loading

| Benchmark              | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------- | ------: | -----: | -----: | -----: | ------: |
| load small PDF (888B)  |   18.9K |   53us |  116us | ±0.60% |   9,455 |
| load medium PDF (19KB) |   11.2K |   90us |  166us | ±0.52% |   5,576 |
| load form PDF (116KB)  |   808.6 | 1.24ms | 1.79ms | ±0.96% |     405 |
| load heavy PDF (9.9MB) |   424.6 | 2.35ms | 3.27ms | ±0.99% |     213 |

- **load small PDF (888B)** is 1.70x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 23.39x faster than load form PDF (116KB)
- **load small PDF (888B)** is 44.53x faster than load heavy PDF (9.9MB)

## Saving

| Benchmark                          | ops/sec |   Mean |     p99 |    RME | Samples |
| :--------------------------------- | ------: | -----: | ------: | -----: | ------: |
| save unmodified (19KB)             |   10.9K |   92us |   199us | ±0.85% |   5,464 |
| incremental save (19KB)            |    7.5K |  132us |   288us | ±0.85% |   3,774 |
| save with modifications (19KB)     |    1.5K |  654us |  1.25ms | ±1.22% |     765 |
| save heavy PDF (9.9MB)             |   468.9 | 2.13ms |  2.58ms | ±0.59% |     235 |
| incremental save heavy PDF (9.9MB) |   236.7 | 4.22ms | 11.94ms | ±7.93% |     119 |

- **save unmodified (19KB)** is 1.45x faster than incremental save (19KB)
- **save unmodified (19KB)** is 7.15x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 23.30x faster than save heavy PDF (9.9MB)
- **save unmodified (19KB)** is 46.17x faster than incremental save heavy PDF (9.9MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |    1.1K |   895us |  1.75ms | ±2.37% |     559 |
| extractPages (1 page from 100-page PDF)  |   296.0 |  3.38ms |  5.01ms | ±1.43% |     149 |
| extractPages (1 page from 2000-page PDF) |    18.6 | 53.66ms | 55.23ms | ±1.13% |      10 |

- **extractPages (1 page from small PDF)** is 3.78x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 59.97x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------------------- | ------: | -------: | -------: | -----: | ------: |
| split 100-page PDF (0.1MB)  |    35.7 |  28.02ms |  35.46ms | ±3.84% |      18 |
| split 2000-page PDF (0.9MB) |     1.9 | 522.23ms | 522.23ms | ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 18.64x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |    Mean |     p99 |    RME | Samples |
| :----------------------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extract first 10 pages from 2000-page PDF              |    18.2 | 55.07ms | 56.25ms | ±0.83% |      10 |
| extract first 100 pages from 2000-page PDF             |    17.2 | 58.21ms | 60.09ms | ±1.33% |       9 |
| extract every 10th page from 2000-page PDF (200 pages) |    15.8 | 63.39ms | 64.24ms | ±0.98% |       8 |

- **extract first 10 pages from 2000-page PDF** is 1.06x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.15x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
