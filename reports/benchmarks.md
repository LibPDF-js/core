# Benchmark Report

> Generated on 2026-11-02 at 14:48:29 UTC
>
> System: linux | INTEL(R) XEON(R) PLATINUM 8573C (4 cores) | 16GB RAM | Bun 1.4.4
>
> Libraries: @libpdf/core 0.5.3 (this repo), pdf-lib 1.17.1, @cantoo/pdf-lib 2.9.1

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

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |    59.9 |  16.70ms |  25.01ms | ±5.24% |      30 |
| @cantoo/pdf-lib |     5.0 | 200.93ms | 211.72ms | ±1.90% |      10 |
| pdf-lib         |     4.8 | 206.42ms | 213.04ms | ±1.29% |      10 |

- **libpdf** is 12.03x faster than @cantoo/pdf-lib
- **libpdf** is 12.36x faster than pdf-lib

### Create blank PDF

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |   16.6K |  60us |  226us | ±5.38% |   8,291 |
| pdf-lib         |    2.7K | 374us | 1.76ms | ±5.82% |   1,338 |
| @cantoo/pdf-lib |    2.7K | 377us | 1.97ms | ±5.79% |   1,328 |

- **libpdf** is 6.20x faster than pdf-lib
- **libpdf** is 6.25x faster than @cantoo/pdf-lib

### Add 10 pages

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |   10.1K |  99us |  190us | ±1.03% |   5,035 |
| @cantoo/pdf-lib |    2.0K | 507us | 2.09ms | ±5.79% |     987 |
| pdf-lib         |    1.9K | 520us | 2.05ms | ±5.99% |     962 |

- **libpdf** is 5.10x faster than @cantoo/pdf-lib
- **libpdf** is 5.23x faster than pdf-lib

### Draw 50 rectangles

| Benchmark       | ops/sec |   Mean |    p99 |    RME | Samples |
| :-------------- | ------: | -----: | -----: | -----: | ------: |
| libpdf          |    3.5K |  283us |  637us | ±0.98% |   1,766 |
| pdf-lib         |   776.9 | 1.29ms | 5.75ms | ±6.04% |     389 |
| @cantoo/pdf-lib |   688.4 | 1.45ms | 7.83ms | ±7.08% |     345 |

- **libpdf** is 4.54x faster than pdf-lib
- **libpdf** is 5.13x faster than @cantoo/pdf-lib

### Load and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |    65.7 |  15.23ms |  16.67ms | ±1.53% |      33 |
| pdf-lib         |     3.3 | 301.45ms | 317.93ms | ±2.54% |      10 |
| @cantoo/pdf-lib |     1.4 | 717.16ms | 731.50ms | ±0.69% |      10 |

- **libpdf** is 19.80x faster than pdf-lib
- **libpdf** is 47.10x faster than @cantoo/pdf-lib

### Load, modify, and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| pdf-lib         |     3.4 | 294.93ms | 302.72ms | ±1.71% |      10 |
| libpdf          |     3.3 | 300.36ms | 313.57ms | ±1.78% |      10 |
| @cantoo/pdf-lib |     1.4 | 718.38ms | 731.27ms | ±0.96% |      10 |

- **pdf-lib** is 1.02x faster than libpdf
- **pdf-lib** is 2.44x faster than @cantoo/pdf-lib

### Extract single page from 100-page PDF

| Benchmark       | ops/sec |   Mean |     p99 |    RME | Samples |
| :-------------- | ------: | -----: | ------: | -----: | ------: |
| libpdf          |   326.3 | 3.06ms |  5.09ms | ±1.92% |     164 |
| pdf-lib         |   120.5 | 8.30ms | 12.83ms | ±3.06% |      61 |
| @cantoo/pdf-lib |   115.0 | 8.70ms | 13.50ms | ±3.80% |      58 |

- **libpdf** is 2.71x faster than pdf-lib
- **libpdf** is 2.84x faster than @cantoo/pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |     RME | Samples |
| :-------------- | ------: | ------: | ------: | ------: | ------: |
| libpdf          |    33.9 | 29.48ms | 32.52ms |  ±2.01% |      17 |
| pdf-lib         |    13.3 | 74.98ms | 91.42ms | ±16.24% |       7 |
| @cantoo/pdf-lib |    11.9 | 84.27ms | 98.42ms | ±12.91% |       6 |

- **libpdf** is 2.54x faster than pdf-lib
- **libpdf** is 2.86x faster than @cantoo/pdf-lib

### Split 2000-page PDF into single-page PDFs (0.9MB)

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |     1.7 | 582.32ms | 582.32ms | ±0.00% |       1 |
| pdf-lib         |   0.707 |    1.42s |    1.42s | ±0.00% |       1 |
| @cantoo/pdf-lib |   0.654 |    1.53s |    1.53s | ±0.00% |       1 |

- **libpdf** is 2.43x faster than pdf-lib
- **libpdf** is 2.63x faster than @cantoo/pdf-lib

### Copy 10 pages between documents

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |   250.9 |  3.99ms |  6.71ms | ±2.26% |     126 |
| pdf-lib         |    91.5 | 10.93ms | 15.43ms | ±3.04% |      46 |
| @cantoo/pdf-lib |    80.4 | 12.44ms | 17.08ms | ±3.36% |      41 |

- **libpdf** is 2.74x faster than pdf-lib
- **libpdf** is 3.12x faster than @cantoo/pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    77.1 | 12.98ms | 15.58ms | ±1.73% |      39 |
| pdf-lib         |    19.9 | 50.13ms | 53.28ms | ±2.18% |      11 |
| @cantoo/pdf-lib |    16.7 | 59.76ms | 64.38ms | ±2.87% |       9 |

- **libpdf** is 3.86x faster than pdf-lib
- **libpdf** is 4.60x faster than @cantoo/pdf-lib

### Fill FINTRAC form fields

| Benchmark       | ops/sec |    Mean |     p99 |     RME | Samples |
| :-------------- | ------: | ------: | ------: | ------: | ------: |
| libpdf          |    49.8 | 20.08ms | 36.66ms | ±12.02% |      25 |
| pdf-lib         |    37.3 | 26.82ms | 39.70ms |  ±8.40% |      19 |
| @cantoo/pdf-lib |    36.8 | 27.20ms | 43.09ms |  ±8.10% |      19 |

- **libpdf** is 1.34x faster than pdf-lib
- **libpdf** is 1.35x faster than @cantoo/pdf-lib

### Fill and flatten FINTRAC form

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    68.3 | 14.65ms | 17.32ms | ±2.31% |      35 |
| pdf-lib         |  FAILED |       - |       - |      - |       0 |
| @cantoo/pdf-lib |    36.0 | 27.79ms | 37.17ms | ±5.53% |      18 |

- **libpdf** is 1.90x faster than @cantoo/pdf-lib

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |   Mean |    p99 |    RME | Samples |
| :------------------------------ | ------: | -----: | -----: | -----: | ------: |
| copy 1 page                     |    1.2K |  868us | 1.79ms | ±2.35% |     576 |
| copy 10 pages from 100-page PDF |   265.5 | 3.77ms | 6.43ms | ±2.07% |     133 |
| copy all 100 pages              |   154.2 | 6.48ms | 7.42ms | ±0.80% |      78 |

- **copy 1 page** is 4.34x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 7.47x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |  Mean |    p99 |    RME | Samples |
| :---------------------------------------- | ------: | ----: | -----: | -----: | ------: |
| duplicate all pages (double the document) |    1.3K | 798us | 1.34ms | ±0.87% |     627 |
| duplicate page 0                          |    1.2K | 812us | 1.35ms | ±1.01% |     616 |

- **duplicate all pages (double the document)** is 1.02x faster than duplicate page 0

### Merge PDFs

| Benchmark               | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------- | ------: | ------: | ------: | -----: | ------: |
| merge 2 small PDFs      |   802.7 |  1.25ms |  1.65ms | ±0.70% |     402 |
| merge 10 small PDFs     |   154.0 |  6.49ms |  7.22ms | ±0.72% |      78 |
| merge 2 x 100-page PDFs |    82.4 | 12.14ms | 12.71ms | ±0.60% |      42 |

- **merge 2 small PDFs** is 5.21x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 9.75x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------- | ------: | -----: | -----: | -----: | ------: |
| draw 100 lines                      |    2.2K |  463us |  929us | ±1.31% |   1,081 |
| draw 100 rectangles                 |    1.9K |  525us | 1.08ms | ±1.70% |     953 |
| draw 100 circles                    |    1.3K |  769us | 1.63ms | ±1.85% |     650 |
| create 10 pages with mixed content  |   819.0 | 1.22ms | 2.23ms | ±1.86% |     410 |
| draw 100 text lines (standard font) |   737.4 | 1.36ms | 2.27ms | ±1.53% |     369 |

- **draw 100 lines** is 1.13x faster than draw 100 rectangles
- **draw 100 lines** is 1.66x faster than draw 100 circles
- **draw 100 lines** is 2.64x faster than create 10 pages with mixed content
- **draw 100 lines** is 2.93x faster than draw 100 text lines (standard font)

## Forms

| Benchmark         | ops/sec |   Mean |     p99 |    RME | Samples |
| :---------------- | ------: | -----: | ------: | -----: | ------: |
| read field values |   414.4 | 2.41ms |  4.19ms | ±2.14% |     208 |
| get form fields   |   402.8 | 2.48ms |  3.58ms | ±1.73% |     202 |
| flatten form      |   140.5 | 7.12ms | 14.36ms | ±3.09% |      71 |
| fill text fields  |   100.7 | 9.93ms | 13.69ms | ±2.83% |      51 |

- **read field values** is 1.03x faster than get form fields
- **read field values** is 2.95x faster than flatten form
- **read field values** is 4.11x faster than fill text fields

## Loading

| Benchmark              | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------- | ------: | ------: | ------: | -----: | ------: |
| load small PDF (888B)  |   21.0K |    48us |    94us | ±0.83% |  10,512 |
| load medium PDF (19KB) |   13.6K |    73us |   109us | ±0.36% |   6,804 |
| load form PDF (116KB)  |   885.0 |  1.13ms |  2.14ms | ±3.37% |     443 |
| load heavy PDF (2.0MB) |    59.8 | 16.73ms | 25.49ms | ±4.78% |      30 |

- **load small PDF (888B)** is 1.54x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 23.76x faster than load form PDF (116KB)
- **load small PDF (888B)** is 351.77x faster than load heavy PDF (2.0MB)

## Saving

| Benchmark                          | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------- | ------: | ------: | ------: | -----: | ------: |
| save unmodified (19KB)             |   11.9K |    84us |   195us | ±1.03% |   5,953 |
| incremental save (19KB)            |    8.2K |   122us |   253us | ±1.59% |   4,110 |
| save with modifications (19KB)     |    1.5K |   655us |  1.22ms | ±1.19% |     763 |
| incremental save heavy PDF (2.0MB) |    56.8 | 17.60ms | 18.03ms | ±0.36% |      29 |
| save heavy PDF (2.0MB)             |    56.8 | 17.60ms | 26.76ms | ±5.36% |      29 |

- **save unmodified (19KB)** is 1.45x faster than incremental save (19KB)
- **save unmodified (19KB)** is 7.80x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 209.50x faster than incremental save heavy PDF (2.0MB)
- **save unmodified (19KB)** is 209.53x faster than save heavy PDF (2.0MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |    1.2K |   839us |  1.68ms | ±2.01% |     596 |
| extractPages (1 page from 100-page PDF)  |   340.8 |  2.93ms |  5.06ms | ±2.00% |     171 |
| extractPages (1 page from 2000-page PDF) |    22.3 | 44.85ms | 46.81ms | ±1.17% |      12 |

- **extractPages (1 page from small PDF)** is 3.50x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 53.42x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------------------- | ------: | -------: | -------: | -----: | ------: |
| split 100-page PDF (0.1MB)  |    32.6 |  30.69ms |  37.59ms | ±5.25% |      17 |
| split 2000-page PDF (0.9MB) |     1.7 | 582.88ms | 582.88ms | ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 18.99x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |    Mean |     p99 |    RME | Samples |
| :----------------------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extract first 10 pages from 2000-page PDF              |    21.9 | 45.58ms | 46.78ms | ±1.05% |      11 |
| extract first 100 pages from 2000-page PDF             |    20.4 | 49.07ms | 50.97ms | ±1.44% |      11 |
| extract every 10th page from 2000-page PDF (200 pages) |    19.2 | 52.07ms | 53.67ms | ±1.26% |      10 |

- **extract first 10 pages from 2000-page PDF** is 1.08x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.14x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
