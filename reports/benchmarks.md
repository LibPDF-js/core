# Benchmark Report

> Generated on 2026-06-15 at 12:10:54 UTC
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
| libpdf          |   423.7 |  2.36ms |  4.23ms | ±2.75% |     213 |
| pdf-lib         |    26.3 | 38.06ms | 44.15ms | ±4.06% |      14 |
| @cantoo/pdf-lib |    25.0 | 40.00ms | 45.24ms | ±3.18% |      13 |

- **libpdf** is 16.13x faster than pdf-lib
- **libpdf** is 16.95x faster than @cantoo/pdf-lib

### Create blank PDF

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |   15.8K |  63us |  144us | ±1.18% |   7,923 |
| pdf-lib         |    2.8K | 352us | 1.23ms | ±2.21% |   1,422 |
| @cantoo/pdf-lib |    2.7K | 371us | 1.54ms | ±2.53% |   1,348 |

- **libpdf** is 5.57x faster than pdf-lib
- **libpdf** is 5.88x faster than @cantoo/pdf-lib

### Add 10 pages

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |    7.9K | 127us |  251us | ±2.25% |   3,950 |
| @cantoo/pdf-lib |    2.4K | 423us | 2.17ms | ±3.60% |   1,182 |
| pdf-lib         |    2.3K | 441us | 1.78ms | ±2.96% |   1,133 |

- **libpdf** is 3.34x faster than @cantoo/pdf-lib
- **libpdf** is 3.49x faster than pdf-lib

### Draw 50 rectangles

| Benchmark       | ops/sec |   Mean |    p99 |    RME | Samples |
| :-------------- | ------: | -----: | -----: | -----: | ------: |
| libpdf          |    2.7K |  376us |  966us | ±1.45% |   1,330 |
| pdf-lib         |   625.8 | 1.60ms | 5.36ms | ±6.87% |     314 |
| @cantoo/pdf-lib |   541.1 | 1.85ms | 6.00ms | ±7.28% |     272 |

- **libpdf** is 4.25x faster than pdf-lib
- **libpdf** is 4.91x faster than @cantoo/pdf-lib

### Load and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |   448.1 |   2.23ms |   4.27ms | ±2.68% |     225 |
| pdf-lib         |    13.7 |  72.88ms |  78.34ms | ±3.20% |      10 |
| @cantoo/pdf-lib |     7.0 | 143.84ms | 149.49ms | ±1.54% |      10 |

- **libpdf** is 32.66x faster than pdf-lib
- **libpdf** is 64.46x faster than @cantoo/pdf-lib

### Load, modify, and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |    20.6 |  48.53ms |  55.33ms | ±4.71% |      11 |
| pdf-lib         |    13.8 |  72.23ms |  80.18ms | ±3.55% |      10 |
| @cantoo/pdf-lib |     7.0 | 142.24ms | 147.95ms | ±1.59% |      10 |

- **libpdf** is 1.49x faster than pdf-lib
- **libpdf** is 2.93x faster than @cantoo/pdf-lib

### Extract single page from 100-page PDF

| Benchmark       | ops/sec |   Mean |     p99 |    RME | Samples |
| :-------------- | ------: | -----: | ------: | -----: | ------: |
| libpdf          |   276.4 | 3.62ms |  6.63ms | ±2.14% |     139 |
| pdf-lib         |   110.2 | 9.08ms | 12.77ms | ±2.69% |      56 |
| @cantoo/pdf-lib |   102.3 | 9.77ms | 13.00ms | ±3.30% |      52 |

- **libpdf** is 2.51x faster than pdf-lib
- **libpdf** is 2.70x faster than @cantoo/pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    25.1 | 39.81ms | 41.08ms | ±0.94% |      13 |
| pdf-lib         |    13.4 | 74.47ms | 78.28ms | ±4.84% |       7 |
| @cantoo/pdf-lib |    12.4 | 80.40ms | 97.06ms | ±9.28% |       7 |

- **libpdf** is 1.87x faster than pdf-lib
- **libpdf** is 2.02x faster than @cantoo/pdf-lib

### Split 2000-page PDF into single-page PDFs (0.9MB)

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |     1.3 | 754.07ms | 754.07ms | ±0.00% |       1 |
| pdf-lib         |   0.740 |    1.35s |    1.35s | ±0.00% |       1 |
| @cantoo/pdf-lib |   0.701 |    1.43s |    1.43s | ±0.00% |       1 |

- **libpdf** is 1.79x faster than pdf-lib
- **libpdf** is 1.89x faster than @cantoo/pdf-lib

### Copy 10 pages between documents

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |   222.6 |  4.49ms |  5.08ms | ±0.87% |     112 |
| pdf-lib         |    87.3 | 11.46ms | 14.33ms | ±1.32% |      44 |
| @cantoo/pdf-lib |    76.4 | 13.08ms | 14.49ms | ±1.35% |      39 |

- **libpdf** is 2.55x faster than pdf-lib
- **libpdf** is 2.91x faster than @cantoo/pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    66.9 | 14.95ms | 15.67ms | ±0.95% |      34 |
| pdf-lib         |    18.7 | 53.51ms | 60.03ms | ±3.88% |      10 |
| @cantoo/pdf-lib |    16.1 | 61.95ms | 63.30ms | ±1.66% |       9 |

- **libpdf** is 3.58x faster than pdf-lib
- **libpdf** is 4.14x faster than @cantoo/pdf-lib

### Fill FINTRAC form fields

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    45.0 | 22.22ms | 26.56ms | ±3.41% |      23 |
| pdf-lib         |    34.9 | 28.66ms | 34.32ms | ±3.73% |      18 |
| @cantoo/pdf-lib |    33.3 | 29.99ms | 37.57ms | ±4.86% |      17 |

- **libpdf** is 1.29x faster than pdf-lib
- **libpdf** is 1.35x faster than @cantoo/pdf-lib

### Fill and flatten FINTRAC form

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    54.4 | 18.38ms | 22.85ms | ±3.16% |      28 |
| pdf-lib         |  FAILED |       - |       - |      - |       0 |
| @cantoo/pdf-lib |    29.2 | 34.20ms | 48.35ms | ±7.48% |      15 |

- **libpdf** is 1.86x faster than @cantoo/pdf-lib

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |   Mean |    p99 |    RME | Samples |
| :------------------------------ | ------: | -----: | -----: | -----: | ------: |
| copy 1 page                     |   877.2 | 1.14ms | 2.77ms | ±3.12% |     439 |
| copy 10 pages from 100-page PDF |   218.5 | 4.58ms | 5.65ms | ±1.49% |     110 |
| copy all 100 pages              |   128.9 | 7.76ms | 8.47ms | ±0.93% |      65 |

- **copy 1 page** is 4.02x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 6.80x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |  Mean |    p99 |    RME | Samples |
| :---------------------------------------- | ------: | ----: | -----: | -----: | ------: |
| duplicate all pages (double the document) |    1.0K | 994us | 1.40ms | ±0.72% |     504 |
| duplicate page 0                          |    1.0K | 995us | 1.37ms | ±0.75% |     503 |

- **duplicate all pages (double the document)** is 1.00x faster than duplicate page 0

### Merge PDFs

| Benchmark               | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------- | ------: | ------: | ------: | -----: | ------: |
| merge 2 small PDFs      |   644.2 |  1.55ms |  2.08ms | ±1.04% |     323 |
| merge 10 small PDFs     |   122.6 |  8.16ms | 12.07ms | ±1.91% |      62 |
| merge 2 x 100-page PDFs |    66.9 | 14.94ms | 22.33ms | ±3.22% |      34 |

- **merge 2 small PDFs** is 5.25x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 9.62x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------- | ------: | -----: | -----: | -----: | ------: |
| draw 100 lines                      |    1.7K |  572us | 1.20ms | ±1.30% |     874 |
| draw 100 rectangles                 |    1.6K |  632us | 1.48ms | ±2.17% |     791 |
| draw 100 circles                    |    1.0K |  954us | 1.72ms | ±1.56% |     525 |
| create 10 pages with mixed content  |   670.0 | 1.49ms | 2.95ms | ±2.24% |     335 |
| draw 100 text lines (standard font) |   610.4 | 1.64ms | 2.46ms | ±1.30% |     306 |

- **draw 100 lines** is 1.11x faster than draw 100 rectangles
- **draw 100 lines** is 1.67x faster than draw 100 circles
- **draw 100 lines** is 2.61x faster than create 10 pages with mixed content
- **draw 100 lines** is 2.86x faster than draw 100 text lines (standard font)

## Forms

| Benchmark         | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------- | ------: | ------: | ------: | -----: | ------: |
| read field values |   355.5 |  2.81ms |  4.45ms | ±1.49% |     178 |
| get form fields   |   312.4 |  3.20ms |  6.74ms | ±4.21% |     157 |
| flatten form      |   118.8 |  8.42ms | 10.66ms | ±1.67% |      60 |
| fill text fields  |    76.3 | 13.11ms | 17.83ms | ±4.59% |      39 |

- **read field values** is 1.14x faster than get form fields
- **read field values** is 2.99x faster than flatten form
- **read field values** is 4.66x faster than fill text fields

## Loading

| Benchmark              | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------- | ------: | -----: | -----: | -----: | ------: |
| load small PDF (888B)  |   16.9K |   59us |  161us | ±0.93% |   8,456 |
| load medium PDF (19KB) |   11.2K |   89us |  124us | ±0.63% |   5,602 |
| load form PDF (116KB)  |   793.5 | 1.26ms | 2.20ms | ±1.25% |     397 |
| load heavy PDF (9.9MB) |   469.0 | 2.13ms | 2.73ms | ±0.97% |     235 |

- **load small PDF (888B)** is 1.51x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 21.31x faster than load form PDF (116KB)
- **load small PDF (888B)** is 36.06x faster than load heavy PDF (9.9MB)

## Saving

| Benchmark                          | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------------------- | ------: | -----: | -----: | -----: | ------: |
| save unmodified (19KB)             |    9.3K |  108us |  295us | ±1.43% |   4,629 |
| incremental save (19KB)            |    6.1K |  163us |  339us | ±1.84% |   3,063 |
| save with modifications (19KB)     |    1.2K |  845us | 1.51ms | ±1.48% |     592 |
| save heavy PDF (9.9MB)             |   458.9 | 2.18ms | 2.70ms | ±0.70% |     230 |
| incremental save heavy PDF (9.9MB) |   129.9 | 7.70ms | 9.04ms | ±2.81% |      65 |

- **save unmodified (19KB)** is 1.51x faster than incremental save (19KB)
- **save unmodified (19KB)** is 7.82x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 20.18x faster than save heavy PDF (9.9MB)
- **save unmodified (19KB)** is 71.25x faster than incremental save heavy PDF (9.9MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |   882.5 |  1.13ms |  2.17ms | ±2.54% |     442 |
| extractPages (1 page from 100-page PDF)  |   271.5 |  3.68ms |  6.11ms | ±1.90% |     136 |
| extractPages (1 page from 2000-page PDF) |    17.2 | 58.18ms | 64.89ms | ±2.99% |      10 |

- **extractPages (1 page from small PDF)** is 3.25x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 51.35x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------------------- | ------: | -------: | -------: | -----: | ------: |
| split 100-page PDF (0.1MB)  |    24.3 |  41.21ms |  44.38ms | ±1.60% |      13 |
| split 2000-page PDF (0.9MB) |     1.3 | 745.07ms | 745.07ms | ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 18.08x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |    Mean |     p99 |    RME | Samples |
| :----------------------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extract first 10 pages from 2000-page PDF              |    17.3 | 57.80ms | 58.69ms | ±0.75% |       9 |
| extract first 100 pages from 2000-page PDF             |    16.4 | 61.14ms | 63.14ms | ±1.45% |       9 |
| extract every 10th page from 2000-page PDF (200 pages) |    14.9 | 66.92ms | 68.89ms | ±1.34% |       8 |

- **extract first 10 pages from 2000-page PDF** is 1.06x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.16x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
