# Benchmark Report

> Generated on 2026-09-28 at 12:57:52 UTC
>
> System: linux | AMD EPYC 9V74 80-Core Processor (4 cores) | 16GB RAM | Bun 1.4.2
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
| libpdf          |    50.2 |  19.91ms |  26.76ms | ±3.54% |      26 |
| @cantoo/pdf-lib |     4.7 | 213.71ms | 216.66ms | ±0.72% |      10 |
| pdf-lib         |     4.3 | 230.69ms | 238.32ms | ±1.61% |      10 |

- **libpdf** is 10.73x faster than @cantoo/pdf-lib
- **libpdf** is 11.59x faster than pdf-lib

### Create blank PDF

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |   15.1K |  66us |  146us | ±3.50% |   7,574 |
| pdf-lib         |    3.1K | 318us | 1.64ms | ±3.15% |   1,574 |
| @cantoo/pdf-lib |    2.6K | 382us | 1.87ms | ±4.38% |   1,308 |

- **libpdf** is 4.81x faster than pdf-lib
- **libpdf** is 5.79x faster than @cantoo/pdf-lib

### Add 10 pages

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |    9.1K | 109us |  207us | ±1.55% |   4,570 |
| @cantoo/pdf-lib |    2.6K | 389us | 2.56ms | ±4.93% |   1,287 |
| pdf-lib         |    2.3K | 439us | 2.18ms | ±4.60% |   1,141 |

- **libpdf** is 3.56x faster than @cantoo/pdf-lib
- **libpdf** is 4.01x faster than pdf-lib

### Draw 50 rectangles

| Benchmark       | ops/sec |   Mean |     p99 |    RME | Samples |
| :-------------- | ------: | -----: | ------: | -----: | ------: |
| libpdf          |    2.9K |  346us |  1.10ms | ±2.01% |   1,444 |
| pdf-lib         |   701.7 | 1.43ms |  7.38ms | ±9.83% |     351 |
| @cantoo/pdf-lib |   469.0 | 2.13ms | 10.37ms | ±9.97% |     235 |

- **libpdf** is 4.11x faster than pdf-lib
- **libpdf** is 6.16x faster than @cantoo/pdf-lib

### Load and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |    48.7 |  20.55ms |  34.33ms | ±6.08% |      25 |
| pdf-lib         |     3.1 | 322.28ms | 338.01ms | ±1.51% |      10 |
| @cantoo/pdf-lib |     1.8 | 547.52ms | 556.88ms | ±0.96% |      10 |

- **libpdf** is 15.69x faster than pdf-lib
- **libpdf** is 26.65x faster than @cantoo/pdf-lib

### Load, modify, and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| pdf-lib         |     3.1 | 324.31ms | 332.50ms | ±0.90% |      10 |
| libpdf          |     2.9 | 350.05ms | 363.65ms | ±1.48% |      10 |
| @cantoo/pdf-lib |     1.8 | 542.72ms | 559.47ms | ±1.09% |      10 |

- **pdf-lib** is 1.08x faster than libpdf
- **pdf-lib** is 1.67x faster than @cantoo/pdf-lib

### Extract single page from 100-page PDF

| Benchmark       | ops/sec |   Mean |     p99 |    RME | Samples |
| :-------------- | ------: | -----: | ------: | -----: | ------: |
| libpdf          |   295.2 | 3.39ms |  4.18ms | ±1.15% |     148 |
| pdf-lib         |   113.9 | 8.78ms | 10.34ms | ±1.59% |      57 |
| @cantoo/pdf-lib |   108.5 | 9.21ms | 12.63ms | ±2.48% |      55 |

- **libpdf** is 2.59x faster than pdf-lib
- **libpdf** is 2.72x faster than @cantoo/pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    26.3 | 38.08ms | 44.62ms | ±3.37% |      14 |
| pdf-lib         |    14.5 | 69.01ms | 76.30ms | ±5.53% |       8 |
| @cantoo/pdf-lib |    13.6 | 73.30ms | 78.66ms | ±4.84% |       7 |

- **libpdf** is 1.81x faster than pdf-lib
- **libpdf** is 1.93x faster than @cantoo/pdf-lib

### Split 2000-page PDF into single-page PDFs (0.9MB)

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |     1.4 | 705.33ms | 705.33ms | ±0.00% |       1 |
| pdf-lib         |   0.789 |    1.27s |    1.27s | ±0.00% |       1 |
| @cantoo/pdf-lib |   0.733 |    1.36s |    1.36s | ±0.00% |       1 |

- **libpdf** is 1.80x faster than pdf-lib
- **libpdf** is 1.93x faster than @cantoo/pdf-lib

### Copy 10 pages between documents

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |   229.4 |  4.36ms |  5.39ms | ±1.39% |     115 |
| pdf-lib         |    86.4 | 11.57ms | 13.62ms | ±1.89% |      44 |
| @cantoo/pdf-lib |    75.8 | 13.20ms | 20.67ms | ±3.79% |      38 |

- **libpdf** is 2.66x faster than pdf-lib
- **libpdf** is 3.03x faster than @cantoo/pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    67.6 | 14.80ms | 18.21ms | ±2.14% |      34 |
| pdf-lib         |    19.2 | 52.15ms | 52.92ms | ±0.58% |      10 |
| @cantoo/pdf-lib |    16.0 | 62.60ms | 63.82ms | ±0.91% |       8 |

- **libpdf** is 3.52x faster than pdf-lib
- **libpdf** is 4.23x faster than @cantoo/pdf-lib

### Fill FINTRAC form fields

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    51.1 | 19.57ms | 24.50ms | ±3.25% |      26 |
| pdf-lib         |    36.7 | 27.27ms | 35.32ms | ±5.00% |      19 |
| @cantoo/pdf-lib |    35.5 | 28.18ms | 42.54ms | ±8.53% |      18 |

- **libpdf** is 1.39x faster than pdf-lib
- **libpdf** is 1.44x faster than @cantoo/pdf-lib

### Fill and flatten FINTRAC form

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    62.3 | 16.04ms | 19.55ms | ±2.75% |      32 |
| pdf-lib         |  FAILED |       - |       - |      - |       0 |
| @cantoo/pdf-lib |    33.4 | 29.94ms | 40.13ms | ±4.97% |      17 |

- **libpdf** is 1.87x faster than @cantoo/pdf-lib

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |   Mean |    p99 |    RME | Samples |
| :------------------------------ | ------: | -----: | -----: | -----: | ------: |
| copy 1 page                     |   990.4 | 1.01ms | 1.92ms | ±2.19% |     496 |
| copy 10 pages from 100-page PDF |   228.7 | 4.37ms | 6.64ms | ±1.64% |     115 |
| copy all 100 pages              |   130.3 | 7.68ms | 8.28ms | ±0.84% |      66 |

- **copy 1 page** is 4.33x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 7.60x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |  Mean |    p99 |    RME | Samples |
| :---------------------------------------- | ------: | ----: | -----: | -----: | ------: |
| duplicate page 0                          |    1.1K | 943us | 1.41ms | ±0.94% |     531 |
| duplicate all pages (double the document) |    1.1K | 952us | 1.37ms | ±0.98% |     526 |

- **duplicate page 0** is 1.01x faster than duplicate all pages (double the document)

### Merge PDFs

| Benchmark               | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------- | ------: | ------: | ------: | -----: | ------: |
| merge 2 small PDFs      |   684.9 |  1.46ms |  2.00ms | ±1.15% |     343 |
| merge 10 small PDFs     |   129.2 |  7.74ms | 12.95ms | ±2.78% |      65 |
| merge 2 x 100-page PDFs |    69.4 | 14.41ms | 15.20ms | ±1.08% |      35 |

- **merge 2 small PDFs** is 5.30x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 9.87x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------- | ------: | -----: | -----: | -----: | ------: |
| draw 100 lines                      |    1.8K |  550us | 1.19ms | ±1.33% |     910 |
| draw 100 rectangles                 |    1.6K |  612us | 1.29ms | ±1.85% |     817 |
| draw 100 circles                    |    1.1K |  911us | 1.75ms | ±1.61% |     550 |
| create 10 pages with mixed content  |   706.9 | 1.41ms | 2.24ms | ±1.55% |     354 |
| draw 100 text lines (standard font) |   635.4 | 1.57ms | 2.31ms | ±1.27% |     318 |

- **draw 100 lines** is 1.11x faster than draw 100 rectangles
- **draw 100 lines** is 1.66x faster than draw 100 circles
- **draw 100 lines** is 2.57x faster than create 10 pages with mixed content
- **draw 100 lines** is 2.86x faster than draw 100 text lines (standard font)

## Forms

| Benchmark         | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------- | ------: | ------: | ------: | -----: | ------: |
| read field values |   365.0 |  2.74ms |  4.65ms | ±2.31% |     183 |
| get form fields   |   343.1 |  2.91ms |  4.87ms | ±2.42% |     172 |
| flatten form      |   125.0 |  8.00ms | 17.84ms | ±4.42% |      63 |
| fill text fields  |    83.5 | 11.97ms | 16.56ms | ±4.48% |      42 |

- **read field values** is 1.06x faster than get form fields
- **read field values** is 2.92x faster than flatten form
- **read field values** is 4.37x faster than fill text fields

## Loading

| Benchmark              | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------- | ------: | ------: | ------: | -----: | ------: |
| load small PDF (888B)  |   18.4K |    54us |   151us | ±2.85% |   9,220 |
| load medium PDF (19KB) |   12.2K |    82us |   113us | ±0.70% |   6,110 |
| load form PDF (116KB)  |   810.5 |  1.23ms |  2.16ms | ±1.35% |     406 |
| load heavy PDF (2.0MB) |    54.4 | 18.37ms | 19.24ms | ±1.61% |      28 |

- **load small PDF (888B)** is 1.51x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 22.75x faster than load form PDF (116KB)
- **load small PDF (888B)** is 338.75x faster than load heavy PDF (2.0MB)

## Saving

| Benchmark                          | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------- | ------: | ------: | ------: | -----: | ------: |
| save unmodified (19KB)             |   10.2K |    98us |   289us | ±3.14% |   5,125 |
| incremental save (19KB)            |    7.0K |   142us |   331us | ±1.19% |   3,511 |
| save with modifications (19KB)     |    1.4K |   739us |  1.42ms | ±1.55% |     677 |
| save heavy PDF (2.0MB)             |    52.6 | 19.00ms | 20.78ms | ±1.16% |      27 |
| incremental save heavy PDF (2.0MB) |    50.7 | 19.72ms | 21.11ms | ±1.40% |      26 |

- **save unmodified (19KB)** is 1.46x faster than incremental save (19KB)
- **save unmodified (19KB)** is 7.58x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 194.67x faster than save heavy PDF (2.0MB)
- **save unmodified (19KB)** is 202.15x faster than incremental save heavy PDF (2.0MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |   944.5 |  1.06ms |  2.51ms | ±3.48% |     473 |
| extractPages (1 page from 100-page PDF)  |   293.3 |  3.41ms |  5.66ms | ±1.77% |     147 |
| extractPages (1 page from 2000-page PDF) |    18.7 | 53.35ms | 54.39ms | ±0.79% |      10 |

- **extractPages (1 page from small PDF)** is 3.22x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 50.39x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------------------- | ------: | -------: | -------: | -----: | ------: |
| split 100-page PDF (0.1MB)  |    26.4 |  37.93ms |  41.16ms | ±2.44% |      14 |
| split 2000-page PDF (0.9MB) |     1.5 | 684.96ms | 684.96ms | ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 18.06x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |    Mean |     p99 |    RME | Samples |
| :----------------------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extract first 10 pages from 2000-page PDF              |    18.6 | 53.86ms | 55.79ms | ±1.21% |      10 |
| extract first 100 pages from 2000-page PDF             |    17.3 | 57.70ms | 59.07ms | ±1.27% |       9 |
| extract every 10th page from 2000-page PDF (200 pages) |    14.7 | 68.07ms | 77.64ms | ±6.86% |       8 |

- **extract first 10 pages from 2000-page PDF** is 1.07x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.26x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
