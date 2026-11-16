# Benchmark Report

> Generated on 2026-11-16 at 14:50:38 UTC
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
| libpdf          |    56.8 |  17.62ms |  34.22ms | ±9.54% |      29 |
| @cantoo/pdf-lib |     4.9 | 202.58ms | 207.86ms | ±0.99% |      10 |
| pdf-lib         |     4.9 | 203.28ms | 206.21ms | ±0.60% |      10 |

- **libpdf** is 11.50x faster than @cantoo/pdf-lib
- **libpdf** is 11.54x faster than pdf-lib

### Create blank PDF

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |   15.7K |  64us |  238us | ±6.22% |   7,861 |
| pdf-lib         |    2.5K | 400us | 1.85ms | ±5.78% |   1,250 |
| @cantoo/pdf-lib |    2.2K | 458us | 2.08ms | ±6.94% |   1,093 |

- **libpdf** is 6.29x faster than pdf-lib
- **libpdf** is 7.19x faster than @cantoo/pdf-lib

### Add 10 pages

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |    9.5K | 105us |  208us | ±1.50% |   4,750 |
| @cantoo/pdf-lib |    1.8K | 562us | 3.45ms | ±7.53% |     890 |
| pdf-lib         |    1.7K | 593us | 2.45ms | ±7.12% |     843 |

- **libpdf** is 5.34x faster than @cantoo/pdf-lib
- **libpdf** is 5.63x faster than pdf-lib

### Draw 50 rectangles

| Benchmark       | ops/sec |   Mean |    p99 |    RME | Samples |
| :-------------- | ------: | -----: | -----: | -----: | ------: |
| libpdf          |    3.4K |  294us |  681us | ±1.20% |   1,702 |
| @cantoo/pdf-lib |   676.7 | 1.48ms | 8.52ms | ±8.01% |     339 |
| pdf-lib         |   661.5 | 1.51ms | 6.57ms | ±7.98% |     332 |

- **libpdf** is 5.03x faster than @cantoo/pdf-lib
- **libpdf** is 5.14x faster than pdf-lib

### Load and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |    64.6 |  15.49ms |  19.87ms | ±2.74% |      33 |
| pdf-lib         |     3.3 | 306.43ms | 318.95ms | ±2.55% |      10 |
| @cantoo/pdf-lib |     1.4 | 729.87ms | 736.94ms | ±0.50% |      10 |

- **libpdf** is 19.78x faster than pdf-lib
- **libpdf** is 47.12x faster than @cantoo/pdf-lib

### Load, modify, and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| pdf-lib         |     3.3 | 303.74ms | 312.81ms | ±1.80% |      10 |
| libpdf          |     3.3 | 304.76ms | 321.07ms | ±1.65% |      10 |
| @cantoo/pdf-lib |     1.4 | 732.59ms | 750.54ms | ±0.75% |      10 |

- **pdf-lib** is 1.00x faster than libpdf
- **pdf-lib** is 2.41x faster than @cantoo/pdf-lib

### Extract single page from 100-page PDF

| Benchmark       | ops/sec |   Mean |     p99 |    RME | Samples |
| :-------------- | ------: | -----: | ------: | -----: | ------: |
| libpdf          |   319.9 | 3.13ms |  5.46ms | ±1.74% |     160 |
| pdf-lib         |   120.7 | 8.29ms | 14.21ms | ±3.32% |      61 |
| @cantoo/pdf-lib |   114.1 | 8.76ms | 14.82ms | ±3.74% |      58 |

- **libpdf** is 2.65x faster than pdf-lib
- **libpdf** is 2.80x faster than @cantoo/pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark       | ops/sec |    Mean |      p99 |     RME | Samples |
| :-------------- | ------: | ------: | -------: | ------: | ------: |
| libpdf          |    32.6 | 30.64ms |  34.14ms |  ±2.24% |      17 |
| pdf-lib         |    12.8 | 77.85ms |  96.33ms | ±15.55% |       7 |
| @cantoo/pdf-lib |    11.6 | 85.85ms | 101.80ms | ±18.88% |       6 |

- **libpdf** is 2.54x faster than pdf-lib
- **libpdf** is 2.80x faster than @cantoo/pdf-lib

### Split 2000-page PDF into single-page PDFs (0.9MB)

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |     1.6 | 610.86ms | 610.86ms | ±0.00% |       1 |
| pdf-lib         |   0.695 |    1.44s |    1.44s | ±0.00% |       1 |
| @cantoo/pdf-lib |   0.645 |    1.55s |    1.55s | ±0.00% |       1 |

- **libpdf** is 2.35x faster than pdf-lib
- **libpdf** is 2.54x faster than @cantoo/pdf-lib

### Copy 10 pages between documents

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |   251.1 |  3.98ms |  5.78ms | ±1.77% |     126 |
| pdf-lib         |    90.3 | 11.07ms | 15.04ms | ±2.95% |      46 |
| @cantoo/pdf-lib |    80.0 | 12.50ms | 17.00ms | ±3.30% |      40 |

- **libpdf** is 2.78x faster than pdf-lib
- **libpdf** is 3.14x faster than @cantoo/pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    75.5 | 13.25ms | 16.02ms | ±1.49% |      38 |
| pdf-lib         |    20.1 | 49.83ms | 53.08ms | ±2.16% |      11 |
| @cantoo/pdf-lib |    16.6 | 60.37ms | 64.15ms | ±2.47% |       9 |

- **libpdf** is 3.76x faster than pdf-lib
- **libpdf** is 4.56x faster than @cantoo/pdf-lib

### Fill FINTRAC form fields

| Benchmark       | ops/sec |    Mean |     p99 |     RME | Samples |
| :-------------- | ------: | ------: | ------: | ------: | ------: |
| libpdf          |    44.6 | 22.44ms | 49.17ms | ±14.87% |      23 |
| pdf-lib         |    37.2 | 26.90ms | 40.64ms |  ±8.85% |      19 |
| @cantoo/pdf-lib |    36.3 | 27.55ms | 38.17ms |  ±6.13% |      19 |

- **libpdf** is 1.20x faster than pdf-lib
- **libpdf** is 1.23x faster than @cantoo/pdf-lib

### Fill and flatten FINTRAC form

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    67.9 | 14.72ms | 17.54ms | ±2.11% |      34 |
| pdf-lib         |  FAILED |       - |       - |      - |       0 |
| @cantoo/pdf-lib |    33.8 | 29.61ms | 44.09ms | ±8.76% |      17 |

- **libpdf** is 2.01x faster than @cantoo/pdf-lib

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |   Mean |    p99 |    RME | Samples |
| :------------------------------ | ------: | -----: | -----: | -----: | ------: |
| copy 1 page                     |    1.1K |  870us | 1.72ms | ±2.34% |     575 |
| copy 10 pages from 100-page PDF |   252.4 | 3.96ms | 6.58ms | ±2.73% |     127 |
| copy all 100 pages              |   150.8 | 6.63ms | 7.71ms | ±0.92% |      76 |

- **copy 1 page** is 4.56x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 7.63x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |  Mean |    p99 |    RME | Samples |
| :---------------------------------------- | ------: | ----: | -----: | -----: | ------: |
| duplicate all pages (double the document) |    1.2K | 804us | 1.17ms | ±0.69% |     622 |
| duplicate page 0                          |    1.2K | 833us | 1.52ms | ±1.38% |     601 |

- **duplicate all pages (double the document)** is 1.04x faster than duplicate page 0

### Merge PDFs

| Benchmark               | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------- | ------: | ------: | ------: | -----: | ------: |
| merge 2 small PDFs      |   796.8 |  1.25ms |  1.75ms | ±0.65% |     399 |
| merge 10 small PDFs     |   151.5 |  6.60ms |  7.44ms | ±0.88% |      76 |
| merge 2 x 100-page PDFs |    79.4 | 12.59ms | 13.61ms | ±0.90% |      40 |

- **merge 2 small PDFs** is 5.26x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 10.03x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------- | ------: | -----: | -----: | -----: | ------: |
| draw 100 lines                      |    2.1K |  467us |  910us | ±1.19% |   1,070 |
| draw 100 rectangles                 |    1.9K |  533us | 1.11ms | ±1.81% |     938 |
| draw 100 circles                    |    1.3K |  772us | 1.66ms | ±1.99% |     648 |
| create 10 pages with mixed content  |   829.9 | 1.21ms | 2.11ms | ±1.59% |     415 |
| draw 100 text lines (standard font) |   706.6 | 1.42ms | 2.38ms | ±1.81% |     354 |

- **draw 100 lines** is 1.14x faster than draw 100 rectangles
- **draw 100 lines** is 1.65x faster than draw 100 circles
- **draw 100 lines** is 2.58x faster than create 10 pages with mixed content
- **draw 100 lines** is 3.03x faster than draw 100 text lines (standard font)

## Forms

| Benchmark         | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------- | ------: | ------: | ------: | -----: | ------: |
| read field values |   418.1 |  2.39ms |  4.35ms | ±2.42% |     210 |
| get form fields   |   404.5 |  2.47ms |  3.74ms | ±1.91% |     203 |
| flatten form      |   144.0 |  6.95ms |  9.23ms | ±1.55% |      72 |
| fill text fields  |    94.7 | 10.56ms | 15.15ms | ±4.68% |      48 |

- **read field values** is 1.03x faster than get form fields
- **read field values** is 2.90x faster than flatten form
- **read field values** is 4.41x faster than fill text fields

## Loading

| Benchmark              | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------- | ------: | ------: | ------: | -----: | ------: |
| load small PDF (888B)  |   20.8K |    48us |    97us | ±1.07% |  10,403 |
| load medium PDF (19KB) |   13.8K |    72us |   114us | ±0.47% |   6,899 |
| load form PDF (116KB)  |   882.9 |  1.13ms |  2.04ms | ±3.30% |     442 |
| load heavy PDF (2.0MB) |    65.1 | 15.35ms | 21.97ms | ±2.95% |      33 |

- **load small PDF (888B)** is 1.51x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 23.56x faster than load form PDF (116KB)
- **load small PDF (888B)** is 319.42x faster than load heavy PDF (2.0MB)

## Saving

| Benchmark                          | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------- | ------: | ------: | ------: | -----: | ------: |
| save unmodified (19KB)             |   11.9K |    84us |   192us | ±1.08% |   5,927 |
| incremental save (19KB)            |    8.5K |   118us |   249us | ±1.55% |   4,228 |
| save with modifications (19KB)     |    1.5K |   646us |  1.15ms | ±0.97% |     775 |
| save heavy PDF (2.0MB)             |    66.3 | 15.09ms | 18.60ms | ±2.15% |      34 |
| incremental save heavy PDF (2.0MB) |    58.1 | 17.22ms | 24.30ms | ±4.39% |      30 |

- **save unmodified (19KB)** is 1.40x faster than incremental save (19KB)
- **save unmodified (19KB)** is 7.66x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 178.82x faster than save heavy PDF (2.0MB)
- **save unmodified (19KB)** is 204.09x faster than incremental save heavy PDF (2.0MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |    1.1K |   933us |  1.77ms | ±2.34% |     537 |
| extractPages (1 page from 100-page PDF)  |   332.8 |  3.00ms |  3.62ms | ±0.92% |     167 |
| extractPages (1 page from 2000-page PDF) |    21.3 | 47.01ms | 47.99ms | ±0.96% |      11 |

- **extractPages (1 page from small PDF)** is 3.22x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 50.40x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |     Mean |      p99 |     RME | Samples |
| :-------------------------- | ------: | -------: | -------: | ------: | ------: |
| split 100-page PDF (0.1MB)  |    29.7 |  33.64ms |  47.39ms | ±10.03% |      15 |
| split 2000-page PDF (0.9MB) |     1.7 | 596.03ms | 596.03ms |  ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 17.72x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |    Mean |     p99 |    RME | Samples |
| :----------------------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extract first 10 pages from 2000-page PDF              |    21.0 | 47.55ms | 48.93ms | ±1.28% |      11 |
| extract first 100 pages from 2000-page PDF             |    19.0 | 52.64ms | 59.96ms | ±3.85% |      10 |
| extract every 10th page from 2000-page PDF (200 pages) |    18.3 | 54.79ms | 56.42ms | ±1.16% |      10 |

- **extract first 10 pages from 2000-page PDF** is 1.11x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.15x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
