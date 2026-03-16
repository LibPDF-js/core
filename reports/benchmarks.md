# Benchmark Report

> Generated on 2026-03-16 at 07:16:32 UTC
>
> System: linux | AMD EPYC 7763 64-Core Processor (4 cores) | 16GB RAM | Bun 1.3.10

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
| libpdf          |   434.5 |  2.30ms |  4.12ms | ±1.77% |     218 |
| pdf-lib         |    25.8 | 38.79ms | 45.32ms | ±5.58% |      13 |
| @cantoo/pdf-lib |    25.6 | 39.00ms | 41.86ms | ±1.94% |      13 |

- **libpdf** is 16.86x faster than pdf-lib
- **libpdf** is 16.95x faster than @cantoo/pdf-lib

### Create blank PDF

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |   17.0K |  59us |  139us | ±1.65% |   8,516 |
| pdf-lib         |    2.3K | 430us | 1.39ms | ±2.46% |   1,164 |
| @cantoo/pdf-lib |    2.3K | 437us | 1.70ms | ±2.62% |   1,145 |

- **libpdf** is 7.32x faster than pdf-lib
- **libpdf** is 7.44x faster than @cantoo/pdf-lib

### Add 10 pages

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |   10.3K |  97us |  156us | ±0.87% |   5,156 |
| @cantoo/pdf-lib |    2.0K | 488us | 2.45ms | ±3.49% |   1,025 |
| pdf-lib         |    1.9K | 518us | 1.90ms | ±2.86% |     966 |

- **libpdf** is 5.03x faster than @cantoo/pdf-lib
- **libpdf** is 5.34x faster than pdf-lib

### Draw 50 rectangles

| Benchmark       | ops/sec |   Mean |    p99 |    RME | Samples |
| :-------------- | ------: | -----: | -----: | -----: | ------: |
| libpdf          |    3.0K |  329us | 1.03ms | ±1.83% |   1,519 |
| pdf-lib         |   491.6 | 2.03ms | 7.88ms | ±8.38% |     246 |
| @cantoo/pdf-lib |   478.5 | 2.09ms | 5.53ms | ±5.97% |     240 |

- **libpdf** is 6.18x faster than pdf-lib
- **libpdf** is 6.35x faster than @cantoo/pdf-lib

### Load and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |   425.6 |   2.35ms |   3.60ms | ±1.62% |     213 |
| pdf-lib         |    11.5 |  86.73ms |  94.62ms | ±3.97% |      10 |
| @cantoo/pdf-lib |     6.5 | 154.18ms | 158.78ms | ±1.42% |      10 |

- **libpdf** is 36.92x faster than pdf-lib
- **libpdf** is 65.63x faster than @cantoo/pdf-lib

### Load, modify, and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |    23.8 |  42.08ms |  55.81ms | ±6.19% |      13 |
| pdf-lib         |    11.4 |  87.57ms | 102.28ms | ±5.96% |      10 |
| @cantoo/pdf-lib |     6.4 | 156.70ms | 168.29ms | ±1.98% |      10 |

- **libpdf** is 2.08x faster than pdf-lib
- **libpdf** is 3.72x faster than @cantoo/pdf-lib

### Extract single page from 100-page PDF

| Benchmark       | ops/sec |   Mean |     p99 |    RME | Samples |
| :-------------- | ------: | -----: | ------: | -----: | ------: |
| libpdf          |   274.7 | 3.64ms |  4.38ms | ±1.04% |     138 |
| pdf-lib         |   108.3 | 9.24ms | 16.01ms | ±3.91% |      55 |
| @cantoo/pdf-lib |   103.6 | 9.65ms | 12.18ms | ±2.41% |      52 |

- **libpdf** is 2.54x faster than pdf-lib
- **libpdf** is 2.65x faster than @cantoo/pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark       | ops/sec |    Mean |      p99 |    RME | Samples |
| :-------------- | ------: | ------: | -------: | -----: | ------: |
| libpdf          |    29.0 | 34.48ms |  43.32ms | ±5.19% |      15 |
| pdf-lib         |    11.4 | 87.40ms |  91.39ms | ±2.76% |       6 |
| @cantoo/pdf-lib |    10.5 | 95.48ms | 102.79ms | ±6.56% |       6 |

- **libpdf** is 2.53x faster than pdf-lib
- **libpdf** is 2.77x faster than @cantoo/pdf-lib

### Split 2000-page PDF into single-page PDFs (0.9MB)

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |     1.7 | 603.35ms | 603.35ms | ±0.00% |       1 |
| pdf-lib         |   0.601 |    1.66s |    1.66s | ±0.00% |       1 |
| @cantoo/pdf-lib |   0.591 |    1.69s |    1.69s | ±0.00% |       1 |

- **libpdf** is 2.76x faster than pdf-lib
- **libpdf** is 2.81x faster than @cantoo/pdf-lib

### Copy 10 pages between documents

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |   219.9 |  4.55ms |  5.29ms | ±1.01% |     110 |
| pdf-lib         |    83.6 | 11.97ms | 13.24ms | ±1.50% |      42 |
| @cantoo/pdf-lib |    72.9 | 13.72ms | 24.48ms | ±4.86% |      37 |

- **libpdf** is 2.63x faster than pdf-lib
- **libpdf** is 3.02x faster than @cantoo/pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    66.1 | 15.13ms | 21.29ms | ±3.43% |      34 |
| pdf-lib         |    18.7 | 53.48ms | 56.78ms | ±1.94% |      10 |
| @cantoo/pdf-lib |    16.0 | 62.66ms | 64.41ms | ±1.56% |       8 |

- **libpdf** is 3.53x faster than pdf-lib
- **libpdf** is 4.14x faster than @cantoo/pdf-lib

### Fill FINTRAC form fields

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    46.6 | 21.44ms | 27.75ms | ±4.47% |      24 |
| pdf-lib         |    28.8 | 34.70ms | 42.26ms | ±5.22% |      15 |
| @cantoo/pdf-lib |    27.7 | 36.06ms | 51.31ms | ±8.94% |      14 |

- **libpdf** is 1.62x faster than pdf-lib
- **libpdf** is 1.68x faster than @cantoo/pdf-lib

### Fill and flatten FINTRAC form

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    50.5 | 19.81ms | 34.30ms | ±7.14% |      26 |
| pdf-lib         |  FAILED |       - |       - |      - |       0 |
| @cantoo/pdf-lib |    25.0 | 39.95ms | 50.54ms | ±7.04% |      13 |

- **libpdf** is 2.02x faster than @cantoo/pdf-lib

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |   Mean |    p99 |    RME | Samples |
| :------------------------------ | ------: | -----: | -----: | -----: | ------: |
| copy 1 page                     |    1.0K |  974us | 2.05ms | ±2.45% |     514 |
| copy 10 pages from 100-page PDF |   219.4 | 4.56ms | 7.95ms | ±2.64% |     110 |
| copy all 100 pages              |   137.8 | 7.26ms | 7.97ms | ±0.86% |      69 |

- **copy 1 page** is 4.68x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 7.45x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |  Mean |    p99 |    RME | Samples |
| :---------------------------------------- | ------: | ----: | -----: | -----: | ------: |
| duplicate all pages (double the document) |    1.1K | 875us | 1.58ms | ±1.09% |     572 |
| duplicate page 0                          |    1.1K | 882us | 1.63ms | ±1.22% |     567 |

- **duplicate all pages (double the document)** is 1.01x faster than duplicate page 0

### Merge PDFs

| Benchmark               | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------- | ------: | ------: | ------: | -----: | ------: |
| merge 2 small PDFs      |   695.9 |  1.44ms |  2.64ms | ±1.28% |     348 |
| merge 10 small PDFs     |   136.5 |  7.33ms |  8.08ms | ±0.90% |      69 |
| merge 2 x 100-page PDFs |    74.4 | 13.43ms | 14.54ms | ±0.87% |      38 |

- **merge 2 small PDFs** is 5.10x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 9.35x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------- | ------: | -----: | -----: | -----: | ------: |
| draw 100 lines                      |    2.0K |  499us | 1.15ms | ±1.52% |   1,002 |
| draw 100 rectangles                 |    1.8K |  555us | 1.24ms | ±1.70% |     901 |
| draw 100 circles                    |   775.6 | 1.29ms | 2.93ms | ±2.88% |     388 |
| create 10 pages with mixed content  |   749.1 | 1.33ms | 2.25ms | ±1.57% |     375 |
| draw 100 text lines (standard font) |   621.7 | 1.61ms | 2.62ms | ±1.77% |     311 |

- **draw 100 lines** is 1.11x faster than draw 100 rectangles
- **draw 100 lines** is 2.58x faster than draw 100 circles
- **draw 100 lines** is 2.67x faster than create 10 pages with mixed content
- **draw 100 lines** is 3.22x faster than draw 100 text lines (standard font)

## Forms

| Benchmark         | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------- | ------: | ------: | ------: | -----: | ------: |
| read field values |   343.9 |  2.91ms |  4.19ms | ±1.22% |     172 |
| get form fields   |   301.3 |  3.32ms |  6.90ms | ±3.67% |     151 |
| flatten form      |   121.2 |  8.25ms | 12.94ms | ±3.27% |      61 |
| fill text fields  |    85.6 | 11.68ms | 15.95ms | ±4.55% |      43 |

- **read field values** is 1.14x faster than get form fields
- **read field values** is 2.84x faster than flatten form
- **read field values** is 4.01x faster than fill text fields

## Loading

| Benchmark              | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------- | ------: | -----: | -----: | -----: | ------: |
| load small PDF (888B)  |   14.4K |   69us |  161us | ±4.02% |   7,204 |
| load medium PDF (19KB) |    9.3K |  107us |  185us | ±4.55% |   4,665 |
| load form PDF (116KB)  |   704.6 | 1.42ms | 2.68ms | ±2.61% |     353 |
| load heavy PDF (9.9MB) |   414.7 | 2.41ms | 3.85ms | ±1.73% |     208 |

- **load small PDF (888B)** is 1.54x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 20.44x faster than load form PDF (116KB)
- **load small PDF (888B)** is 34.74x faster than load heavy PDF (9.9MB)

## Saving

| Benchmark                          | ops/sec |   Mean |     p99 |    RME | Samples |
| :--------------------------------- | ------: | -----: | ------: | -----: | ------: |
| save unmodified (19KB)             |    9.3K |  108us |   267us | ±1.08% |   4,641 |
| incremental save (19KB)            |    6.4K |  156us |   335us | ±0.85% |   3,199 |
| save with modifications (19KB)     |    1.3K |  750us |  1.57ms | ±1.85% |     667 |
| save heavy PDF (9.9MB)             |   452.7 | 2.21ms |  2.61ms | ±0.57% |     227 |
| incremental save heavy PDF (9.9MB) |   199.3 | 5.02ms | 12.89ms | ±8.23% |     100 |

- **save unmodified (19KB)** is 1.45x faster than incremental save (19KB)
- **save unmodified (19KB)** is 6.97x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 20.50x faster than save heavy PDF (9.9MB)
- **save unmodified (19KB)** is 46.57x faster than incremental save heavy PDF (9.9MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |    1.0K |   991us |  1.95ms | ±2.34% |     505 |
| extractPages (1 page from 100-page PDF)  |   279.3 |  3.58ms |  5.47ms | ±1.93% |     140 |
| extractPages (1 page from 2000-page PDF) |    17.6 | 56.91ms | 57.75ms | ±0.52% |      10 |

- **extractPages (1 page from small PDF)** is 3.61x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 57.44x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------------------- | ------: | -------: | -------: | -----: | ------: |
| split 100-page PDF (0.1MB)  |    31.8 |  31.47ms |  38.73ms | ±4.63% |      16 |
| split 2000-page PDF (0.9MB) |     1.7 | 574.84ms | 574.84ms | ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 18.26x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |    Mean |     p99 |    RME | Samples |
| :----------------------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extract first 10 pages from 2000-page PDF              |    17.1 | 58.52ms | 61.23ms | ±1.54% |       9 |
| extract first 100 pages from 2000-page PDF             |    16.2 | 61.65ms | 63.01ms | ±1.37% |       9 |
| extract every 10th page from 2000-page PDF (200 pages) |    14.8 | 67.51ms | 80.79ms | ±6.68% |       8 |

- **extract first 10 pages from 2000-page PDF** is 1.05x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.15x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
