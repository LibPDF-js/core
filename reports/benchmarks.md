# Benchmark Report

> Generated on 2026-02-19 at 04:14:23 UTC
>
> System: linux | AMD EPYC 7763 64-Core Processor (4 cores) | 16GB RAM | Bun 1.3.9

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

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |   420.6 |  2.38ms |  3.66ms | ±1.57% |     211 |
| pdf-lib   |    24.8 | 40.36ms | 44.62ms | ±3.24% |      13 |

- **libpdf** is 16.98x faster than pdf-lib

### Create blank PDF

| Benchmark | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------- | ------: | ----: | -----: | -----: | ------: |
| libpdf    |   17.5K |  57us |  127us | ±1.52% |   8,765 |
| pdf-lib   |    2.5K | 408us | 1.37ms | ±2.44% |   1,227 |

- **libpdf** is 7.15x faster than pdf-lib

### Add 10 pages

| Benchmark | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------- | ------: | ----: | -----: | -----: | ------: |
| libpdf    |   10.2K |  98us |  183us | ±0.99% |   5,112 |
| pdf-lib   |    2.0K | 512us | 1.76ms | ±2.60% |     977 |

- **libpdf** is 5.23x faster than pdf-lib

### Draw 50 rectangles

| Benchmark | ops/sec |   Mean |    p99 |    RME | Samples |
| :-------- | ------: | -----: | -----: | -----: | ------: |
| libpdf    |    1.3K |  749us | 2.11ms | ±2.97% |     668 |
| pdf-lib   |   619.3 | 1.61ms | 5.58ms | ±6.17% |     310 |

- **libpdf** is 2.16x faster than pdf-lib

### Load and save PDF

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |   422.2 |  2.37ms |  4.52ms | ±1.86% |     212 |
| pdf-lib   |    11.7 | 85.56ms | 91.96ms | ±2.94% |      10 |

- **libpdf** is 36.12x faster than pdf-lib

### Load, modify, and save PDF

| Benchmark | ops/sec |    Mean |      p99 |    RME | Samples |
| :-------- | ------: | ------: | -------: | -----: | ------: |
| libpdf    |    16.3 | 61.34ms |  78.45ms | ±9.78% |      10 |
| pdf-lib   |    11.2 | 89.02ms | 100.00ms | ±5.04% |      10 |

- **libpdf** is 1.45x faster than pdf-lib

### Extract single page from 100-page PDF

| Benchmark | ops/sec |   Mean |     p99 |    RME | Samples |
| :-------- | ------: | -----: | ------: | -----: | ------: |
| libpdf    |   259.7 | 3.85ms |  6.38ms | ±2.07% |     130 |
| pdf-lib   |   108.4 | 9.22ms | 12.50ms | ±2.29% |      55 |

- **libpdf** is 2.40x faster than pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |    29.0 | 34.44ms | 45.91ms | ±5.82% |      15 |
| pdf-lib   |    11.5 | 86.92ms | 91.08ms | ±4.15% |       6 |

- **libpdf** is 2.52x faster than pdf-lib

### Split 2000-page PDF into single-page PDFs (0.9MB)

| Benchmark | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------- | ------: | -------: | -------: | -----: | ------: |
| libpdf    |     1.6 | 615.63ms | 615.63ms | ±0.00% |       1 |
| pdf-lib   |   0.620 |    1.61s |    1.61s | ±0.00% |       1 |

- **libpdf** is 2.62x faster than pdf-lib

### Copy 10 pages between documents

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |   214.3 |  4.67ms |  5.47ms | ±0.99% |     108 |
| pdf-lib   |    84.7 | 11.80ms | 12.76ms | ±1.20% |      43 |

- **libpdf** is 2.53x faster than pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |    67.6 | 14.78ms | 18.29ms | ±1.64% |      34 |
| pdf-lib   |    18.3 | 54.66ms | 59.81ms | ±3.73% |      10 |

- **libpdf** is 3.70x faster than pdf-lib

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |   Mean |     p99 |    RME | Samples |
| :------------------------------ | ------: | -----: | ------: | -----: | ------: |
| copy 1 page                     |   960.7 | 1.04ms |  2.38ms | ±2.63% |     481 |
| copy 10 pages from 100-page PDF |   204.6 | 4.89ms |  7.66ms | ±2.64% |     103 |
| copy all 100 pages              |   129.7 | 7.71ms | 10.00ms | ±1.29% |      65 |

- **copy 1 page** is 4.70x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 7.41x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |  Mean |    p99 |    RME | Samples |
| :---------------------------------------- | ------: | ----: | -----: | -----: | ------: |
| duplicate all pages (double the document) |    1.1K | 899us | 1.28ms | ±0.62% |     557 |
| duplicate page 0                          |    1.1K | 918us | 1.46ms | ±0.97% |     545 |

- **duplicate all pages (double the document)** is 1.02x faster than duplicate page 0

### Merge PDFs

| Benchmark               | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------- | ------: | ------: | ------: | -----: | ------: |
| merge 2 small PDFs      |   669.9 |  1.49ms |  2.12ms | ±1.03% |     335 |
| merge 10 small PDFs     |   128.2 |  7.80ms |  8.54ms | ±0.74% |      65 |
| merge 2 x 100-page PDFs |    69.4 | 14.41ms | 16.97ms | ±1.43% |      35 |

- **merge 2 small PDFs** is 5.23x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 9.65x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------- | ------: | -----: | -----: | -----: | ------: |
| draw 100 lines                      |   798.8 | 1.25ms | 2.77ms | ±3.16% |     400 |
| draw 100 rectangles                 |   686.7 | 1.46ms | 3.19ms | ±3.58% |     344 |
| draw 100 text lines (standard font) |   293.3 | 3.41ms | 6.39ms | ±3.23% |     147 |
| draw 100 circles                    |   285.4 | 3.50ms | 6.71ms | ±5.05% |     143 |
| create 10 pages with mixed content  |   172.7 | 5.79ms | 9.58ms | ±4.95% |      87 |

- **draw 100 lines** is 1.16x faster than draw 100 rectangles
- **draw 100 lines** is 2.72x faster than draw 100 text lines (standard font)
- **draw 100 lines** is 2.80x faster than draw 100 circles
- **draw 100 lines** is 4.63x faster than create 10 pages with mixed content

## Forms

| Benchmark         | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------- | ------: | ------: | ------: | -----: | ------: |
| read field values |   315.7 |  3.17ms |  3.80ms | ±1.02% |     158 |
| get form fields   |   280.0 |  3.57ms |  8.04ms | ±3.70% |     140 |
| flatten form      |   110.9 |  9.01ms | 12.36ms | ±2.57% |      56 |
| fill text fields  |    82.4 | 12.13ms | 18.74ms | ±4.21% |      42 |

- **read field values** is 1.13x faster than get form fields
- **read field values** is 2.85x faster than flatten form
- **read field values** is 3.83x faster than fill text fields

## Loading

| Benchmark              | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------- | ------: | -----: | -----: | -----: | ------: |
| load small PDF (888B)  |   15.1K |   66us |  162us | ±0.75% |   7,536 |
| load medium PDF (19KB) |   10.0K |  100us |  198us | ±0.54% |   4,980 |
| load form PDF (116KB)  |   677.5 | 1.48ms | 2.10ms | ±1.00% |     339 |
| load heavy PDF (9.9MB) |   416.6 | 2.40ms | 3.01ms | ±0.86% |     209 |

- **load small PDF (888B)** is 1.51x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 22.24x faster than load form PDF (116KB)
- **load small PDF (888B)** is 36.17x faster than load heavy PDF (9.9MB)

## Saving

| Benchmark                          | ops/sec |   Mean |     p99 |    RME | Samples |
| :--------------------------------- | ------: | -----: | ------: | -----: | ------: |
| save unmodified (19KB)             |    9.1K |  110us |   242us | ±0.86% |   4,534 |
| incremental save (19KB)            |    5.2K |  191us |   396us | ±1.20% |   2,624 |
| save with modifications (19KB)     |    1.3K |  784us |  1.51ms | ±1.47% |     638 |
| save heavy PDF (9.9MB)             |   447.7 | 2.23ms |  2.59ms | ±0.51% |     224 |
| incremental save heavy PDF (9.9MB) |   177.9 | 5.62ms | 12.45ms | ±3.99% |      89 |

- **save unmodified (19KB)** is 1.73x faster than incremental save (19KB)
- **save unmodified (19KB)** is 7.11x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 20.25x faster than save heavy PDF (9.9MB)
- **save unmodified (19KB)** is 50.96x faster than incremental save heavy PDF (9.9MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |   955.5 |  1.05ms |  2.12ms | ±2.53% |     478 |
| extractPages (1 page from 100-page PDF)  |   271.5 |  3.68ms |  4.45ms | ±0.82% |     136 |
| extractPages (1 page from 2000-page PDF) |    16.8 | 59.65ms | 61.71ms | ±1.21% |      10 |

- **extractPages (1 page from small PDF)** is 3.52x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 56.99x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------------------- | ------: | -------: | -------: | -----: | ------: |
| split 100-page PDF (0.1MB)  |    30.7 |  32.55ms |  43.44ms | ±5.65% |      16 |
| split 2000-page PDF (0.9MB) |     1.7 | 592.85ms | 592.85ms | ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 18.21x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |    Mean |     p99 |    RME | Samples |
| :----------------------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extract first 10 pages from 2000-page PDF              |    16.2 | 61.77ms | 69.71ms | ±3.89% |       9 |
| extract first 100 pages from 2000-page PDF             |    15.6 | 64.25ms | 65.09ms | ±0.55% |       8 |
| extract every 10th page from 2000-page PDF (200 pages) |    14.6 | 68.53ms | 72.12ms | ±1.96% |       8 |

- **extract first 10 pages from 2000-page PDF** is 1.04x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.11x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
