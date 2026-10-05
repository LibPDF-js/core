# Benchmark Report

> Generated on 2026-10-05 at 13:39:32 UTC
>
> System: linux | AMD EPYC 7763 64-Core Processor (4 cores) | 16GB RAM | Bun 1.4.2
>
> Libraries: @libpdf/core 0.5.1 (this repo), pdf-lib 1.17.1, @cantoo/pdf-lib 2.9.1

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
| libpdf          |    52.8 |  18.93ms |  23.16ms | ±2.57% |      27 |
| pdf-lib         |     4.3 | 232.54ms | 243.79ms | ±1.89% |      10 |
| @cantoo/pdf-lib |     4.3 | 233.47ms | 249.72ms | ±2.45% |      10 |

- **libpdf** is 12.29x faster than pdf-lib
- **libpdf** is 12.34x faster than @cantoo/pdf-lib

### Create blank PDF

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |   14.2K |  71us |  168us | ±2.15% |   7,091 |
| pdf-lib         |    2.7K | 365us | 1.52ms | ±2.81% |   1,372 |
| @cantoo/pdf-lib |    2.5K | 392us | 1.81ms | ±3.43% |   1,276 |

- **libpdf** is 5.17x faster than pdf-lib
- **libpdf** is 5.56x faster than @cantoo/pdf-lib

### Add 10 pages

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |    7.8K | 129us |  241us | ±1.52% |   3,883 |
| @cantoo/pdf-lib |    2.3K | 441us | 2.56ms | ±4.01% |   1,135 |
| pdf-lib         |    2.1K | 467us | 2.21ms | ±4.01% |   1,071 |

- **libpdf** is 3.42x faster than @cantoo/pdf-lib
- **libpdf** is 3.62x faster than pdf-lib

### Draw 50 rectangles

| Benchmark       | ops/sec |   Mean |    p99 |    RME | Samples |
| :-------------- | ------: | -----: | -----: | -----: | ------: |
| libpdf          |    2.6K |  387us | 1.13ms | ±1.92% |   1,293 |
| pdf-lib         |   638.8 | 1.57ms | 7.15ms | ±8.66% |     320 |
| @cantoo/pdf-lib |   544.7 | 1.84ms | 7.65ms | ±7.57% |     273 |

- **libpdf** is 4.05x faster than pdf-lib
- **libpdf** is 4.75x faster than @cantoo/pdf-lib

### Load and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |    51.4 |  19.46ms |  22.86ms | ±2.69% |      26 |
| pdf-lib         |     2.9 | 344.77ms | 363.44ms | ±1.93% |      10 |
| @cantoo/pdf-lib |     1.7 | 587.78ms | 613.58ms | ±3.14% |      10 |

- **libpdf** is 17.71x faster than pdf-lib
- **libpdf** is 30.20x faster than @cantoo/pdf-lib

### Load, modify, and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| pdf-lib         |     3.0 | 331.23ms | 344.93ms | ±1.61% |      10 |
| libpdf          |     2.7 | 369.21ms | 381.41ms | ±1.42% |      10 |
| @cantoo/pdf-lib |     1.8 | 555.28ms | 600.15ms | ±2.83% |      10 |

- **pdf-lib** is 1.11x faster than libpdf
- **pdf-lib** is 1.68x faster than @cantoo/pdf-lib

### Extract single page from 100-page PDF

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |   259.4 |  3.86ms |  4.93ms | ±1.32% |     130 |
| pdf-lib         |   103.8 |  9.64ms | 15.93ms | ±3.31% |      52 |
| @cantoo/pdf-lib |    95.0 | 10.53ms | 15.18ms | ±3.47% |      48 |

- **libpdf** is 2.50x faster than pdf-lib
- **libpdf** is 2.73x faster than @cantoo/pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    24.1 | 41.49ms | 44.16ms | ±1.36% |      13 |
| pdf-lib         |    13.9 | 72.18ms | 77.56ms | ±3.75% |       7 |
| @cantoo/pdf-lib |    12.8 | 77.95ms | 87.32ms | ±5.39% |       7 |

- **libpdf** is 1.74x faster than pdf-lib
- **libpdf** is 1.88x faster than @cantoo/pdf-lib

### Split 2000-page PDF into single-page PDFs (0.9MB)

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |     1.2 | 827.08ms | 827.08ms | ±0.00% |       1 |
| pdf-lib         |   0.723 |    1.38s |    1.38s | ±0.00% |       1 |
| @cantoo/pdf-lib |   0.676 |    1.48s |    1.48s | ±0.00% |       1 |

- **libpdf** is 1.67x faster than pdf-lib
- **libpdf** is 1.79x faster than @cantoo/pdf-lib

### Copy 10 pages between documents

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |   201.2 |  4.97ms |  6.65ms | ±1.67% |     101 |
| pdf-lib         |    83.3 | 12.01ms | 14.66ms | ±1.83% |      42 |
| @cantoo/pdf-lib |    73.4 | 13.63ms | 15.18ms | ±1.77% |      37 |

- **libpdf** is 2.42x faster than pdf-lib
- **libpdf** is 2.74x faster than @cantoo/pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    60.7 | 16.48ms | 18.94ms | ±1.93% |      31 |
| pdf-lib         |    18.2 | 55.02ms | 57.77ms | ±1.88% |      10 |
| @cantoo/pdf-lib |    15.2 | 65.91ms | 66.86ms | ±0.73% |       8 |

- **libpdf** is 3.34x faster than pdf-lib
- **libpdf** is 4.00x faster than @cantoo/pdf-lib

### Fill FINTRAC form fields

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    46.2 | 21.66ms | 25.21ms | ±2.90% |      24 |
| @cantoo/pdf-lib |    35.7 | 28.05ms | 36.00ms | ±3.78% |      18 |
| pdf-lib         |    34.7 | 28.84ms | 37.59ms | ±5.13% |      18 |

- **libpdf** is 1.29x faster than @cantoo/pdf-lib
- **libpdf** is 1.33x faster than pdf-lib

### Fill and flatten FINTRAC form

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    56.5 | 17.69ms | 21.81ms | ±3.19% |      29 |
| pdf-lib         |  FAILED |       - |       - |      - |       0 |
| @cantoo/pdf-lib |    30.9 | 32.31ms | 50.00ms | ±8.13% |      16 |

- **libpdf** is 1.83x faster than @cantoo/pdf-lib

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |   Mean |     p99 |    RME | Samples |
| :------------------------------ | ------: | -----: | ------: | -----: | ------: |
| copy 1 page                     |   837.0 | 1.19ms |  2.31ms | ±2.75% |     419 |
| copy 10 pages from 100-page PDF |   197.5 | 5.06ms |  8.96ms | ±2.35% |      99 |
| copy all 100 pages              |   113.7 | 8.80ms | 11.32ms | ±1.43% |      57 |

- **copy 1 page** is 4.24x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 7.36x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------------- | ------: | -----: | -----: | -----: | ------: |
| duplicate all pages (double the document) |   949.7 | 1.05ms | 1.57ms | ±0.79% |     475 |
| duplicate page 0                          |   945.5 | 1.06ms | 1.53ms | ±0.92% |     473 |

- **duplicate all pages (double the document)** is 1.00x faster than duplicate page 0

### Merge PDFs

| Benchmark               | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------- | ------: | ------: | ------: | -----: | ------: |
| merge 2 small PDFs      |   608.7 |  1.64ms |  2.16ms | ±1.09% |     305 |
| merge 10 small PDFs     |   110.4 |  9.05ms | 14.56ms | ±2.67% |      56 |
| merge 2 x 100-page PDFs |    61.5 | 16.26ms | 18.43ms | ±1.79% |      31 |

- **merge 2 small PDFs** is 5.51x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 9.90x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------- | ------: | -----: | -----: | -----: | ------: |
| draw 100 lines                      |    1.7K |  598us | 1.28ms | ±1.47% |     837 |
| draw 100 rectangles                 |    1.5K |  656us | 1.40ms | ±1.97% |     763 |
| draw 100 circles                    |   998.0 | 1.00ms | 2.07ms | ±1.96% |     500 |
| create 10 pages with mixed content  |   645.3 | 1.55ms | 2.72ms | ±2.24% |     323 |
| draw 100 text lines (standard font) |   589.1 | 1.70ms | 2.98ms | ±1.93% |     296 |

- **draw 100 lines** is 1.10x faster than draw 100 rectangles
- **draw 100 lines** is 1.68x faster than draw 100 circles
- **draw 100 lines** is 2.59x faster than create 10 pages with mixed content
- **draw 100 lines** is 2.84x faster than draw 100 text lines (standard font)

## Forms

| Benchmark         | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------- | ------: | ------: | ------: | -----: | ------: |
| read field values |   333.3 |  3.00ms |  5.57ms | ±2.84% |     167 |
| get form fields   |   302.4 |  3.31ms |  5.51ms | ±2.85% |     152 |
| flatten form      |   118.5 |  8.44ms | 11.84ms | ±2.37% |      60 |
| fill text fields  |    70.9 | 14.11ms | 26.23ms | ±6.39% |      36 |

- **read field values** is 1.10x faster than get form fields
- **read field values** is 2.81x faster than flatten form
- **read field values** is 4.70x faster than fill text fields

## Loading

| Benchmark              | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------- | ------: | ------: | ------: | -----: | ------: |
| load small PDF (888B)  |   15.2K |    66us |   189us | ±1.49% |   7,594 |
| load medium PDF (19KB) |   10.6K |    95us |   123us | ±0.67% |   5,279 |
| load form PDF (116KB)  |   780.8 |  1.28ms |  2.45ms | ±1.54% |     391 |
| load heavy PDF (2.0MB) |    49.9 | 20.02ms | 21.50ms | ±1.61% |      25 |

- **load small PDF (888B)** is 1.44x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 19.45x faster than load form PDF (116KB)
- **load small PDF (888B)** is 304.05x faster than load heavy PDF (2.0MB)

## Saving

| Benchmark                          | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------- | ------: | ------: | ------: | -----: | ------: |
| save unmodified (19KB)             |    8.2K |   122us |   343us | ±3.52% |   4,098 |
| incremental save (19KB)            |    5.5K |   181us |   402us | ±1.30% |   2,758 |
| save with modifications (19KB)     |    1.1K |   873us |  1.66ms | ±1.76% |     573 |
| save heavy PDF (2.0MB)             |    52.2 | 19.15ms | 20.16ms | ±1.54% |      27 |
| incremental save heavy PDF (2.0MB) |    50.5 | 19.79ms | 20.95ms | ±1.50% |      26 |

- **save unmodified (19KB)** is 1.49x faster than incremental save (19KB)
- **save unmodified (19KB)** is 7.15x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 156.91x faster than save heavy PDF (2.0MB)
- **save unmodified (19KB)** is 162.20x faster than incremental save heavy PDF (2.0MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |   902.8 |  1.11ms |  2.06ms | ±2.42% |     452 |
| extractPages (1 page from 100-page PDF)  |   282.8 |  3.54ms |  4.74ms | ±1.41% |     142 |
| extractPages (1 page from 2000-page PDF) |    17.6 | 56.80ms | 62.89ms | ±2.88% |      10 |

- **extractPages (1 page from small PDF)** is 3.19x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 51.28x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------------------- | ------: | -------: | -------: | -----: | ------: |
| split 100-page PDF (0.1MB)  |    24.4 |  40.93ms |  43.28ms | ±1.36% |      13 |
| split 2000-page PDF (0.9MB) |     1.3 | 745.08ms | 745.08ms | ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 18.20x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |    Mean |     p99 |    RME | Samples |
| :----------------------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extract first 10 pages from 2000-page PDF              |    16.8 | 59.47ms | 62.87ms | ±2.10% |       9 |
| extract first 100 pages from 2000-page PDF             |    16.0 | 62.69ms | 66.23ms | ±2.40% |       8 |
| extract every 10th page from 2000-page PDF (200 pages) |    14.7 | 67.92ms | 72.28ms | ±2.48% |       8 |

- **extract first 10 pages from 2000-page PDF** is 1.05x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.14x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
