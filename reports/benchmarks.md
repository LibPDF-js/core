# Benchmark Report

> Generated on 2026-02-28 at 10:28:05 UTC
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

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |   428.7 |  2.33ms |  4.17ms | ±1.83% |     215 |
| pdf-lib   |    26.3 | 38.03ms | 44.94ms | ±3.54% |      14 |

- **libpdf** is 16.30x faster than pdf-lib

### Create blank PDF

| Benchmark | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------- | ------: | ----: | -----: | -----: | ------: |
| libpdf    |   18.2K |  55us |  112us | ±1.45% |   9,113 |
| pdf-lib   |    2.3K | 439us | 1.49ms | ±2.27% |   1,139 |

- **libpdf** is 8.01x faster than pdf-lib

### Add 10 pages

| Benchmark | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------- | ------: | ----: | -----: | -----: | ------: |
| libpdf    |    9.9K | 101us |  188us | ±1.24% |   4,968 |
| pdf-lib   |    1.9K | 513us | 1.86ms | ±2.81% |     974 |

- **libpdf** is 5.10x faster than pdf-lib

### Draw 50 rectangles

| Benchmark | ops/sec |   Mean |    p99 |    RME | Samples |
| :-------- | ------: | -----: | -----: | -----: | ------: |
| libpdf    |    3.2K |  309us |  717us | ±1.25% |   1,619 |
| pdf-lib   |   593.1 | 1.69ms | 6.64ms | ±6.54% |     297 |

- **libpdf** is 5.46x faster than pdf-lib

### Load and save PDF

| Benchmark | ops/sec |    Mean |      p99 |    RME | Samples |
| :-------- | ------: | ------: | -------: | -----: | ------: |
| libpdf    |   426.5 |  2.34ms |   3.04ms | ±1.34% |     214 |
| pdf-lib   |    11.4 | 87.87ms | 100.64ms | ±5.53% |      10 |

- **libpdf** is 37.48x faster than pdf-lib

### Load, modify, and save PDF

| Benchmark | ops/sec |    Mean |      p99 |    RME | Samples |
| :-------- | ------: | ------: | -------: | -----: | ------: |
| libpdf    |    24.2 | 41.26ms |  48.26ms | ±3.34% |      13 |
| pdf-lib   |    11.1 | 90.09ms | 107.48ms | ±6.55% |      10 |

- **libpdf** is 2.18x faster than pdf-lib

### Extract single page from 100-page PDF

| Benchmark | ops/sec |   Mean |     p99 |    RME | Samples |
| :-------- | ------: | -----: | ------: | -----: | ------: |
| libpdf    |   269.4 | 3.71ms |  6.30ms | ±1.85% |     135 |
| pdf-lib   |   109.1 | 9.17ms | 10.99ms | ±1.59% |      55 |

- **libpdf** is 2.47x faster than pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |    30.4 | 32.87ms | 38.58ms | ±2.86% |      16 |
| pdf-lib   |    11.5 | 87.05ms | 92.25ms | ±4.07% |       6 |

- **libpdf** is 2.65x faster than pdf-lib

### Split 2000-page PDF into single-page PDFs (0.9MB)

| Benchmark | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------- | ------: | -------: | -------: | -----: | ------: |
| libpdf    |     1.7 | 599.88ms | 599.88ms | ±0.00% |       1 |
| pdf-lib   |   0.610 |    1.64s |    1.64s | ±0.00% |       1 |

- **libpdf** is 2.73x faster than pdf-lib

### Copy 10 pages between documents

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |   219.4 |  4.56ms |  5.30ms | ±0.97% |     110 |
| pdf-lib   |    84.5 | 11.83ms | 13.07ms | ±1.23% |      43 |

- **libpdf** is 2.60x faster than pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |    71.1 | 14.07ms | 19.31ms | ±2.33% |      36 |
| pdf-lib   |    18.8 | 53.26ms | 54.75ms | ±0.81% |      10 |

- **libpdf** is 3.79x faster than pdf-lib

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |   Mean |    p99 |    RME | Samples |
| :------------------------------ | ------: | -----: | -----: | -----: | ------: |
| copy 1 page                     |   999.6 | 1.00ms | 2.07ms | ±2.57% |     500 |
| copy 10 pages from 100-page PDF |   221.9 | 4.51ms | 5.39ms | ±1.34% |     111 |
| copy all 100 pages              |   135.0 | 7.41ms | 7.81ms | ±0.58% |      68 |

- **copy 1 page** is 4.50x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 7.40x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |  Mean |    p99 |    RME | Samples |
| :---------------------------------------- | ------: | ----: | -----: | -----: | ------: |
| duplicate all pages (double the document) |    1.1K | 879us | 1.39ms | ±0.90% |     569 |
| duplicate page 0                          |    1.1K | 893us | 1.39ms | ±0.99% |     560 |

- **duplicate all pages (double the document)** is 1.02x faster than duplicate page 0

### Merge PDFs

| Benchmark               | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------- | ------: | ------: | ------: | -----: | ------: |
| merge 2 small PDFs      |   686.7 |  1.46ms |  2.66ms | ±1.35% |     344 |
| merge 10 small PDFs     |   134.4 |  7.44ms |  7.95ms | ±0.75% |      68 |
| merge 2 x 100-page PDFs |    73.7 | 13.57ms | 13.95ms | ±0.69% |      37 |

- **merge 2 small PDFs** is 5.11x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 9.32x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------- | ------: | -----: | -----: | -----: | ------: |
| draw 100 lines                      |    2.0K |  492us | 1.11ms | ±1.34% |   1,017 |
| draw 100 rectangles                 |    1.8K |  565us | 1.32ms | ±2.13% |     885 |
| draw 100 circles                    |   785.6 | 1.27ms | 2.79ms | ±2.50% |     393 |
| create 10 pages with mixed content  |   751.7 | 1.33ms | 2.25ms | ±1.69% |     376 |
| draw 100 text lines (standard font) |   643.2 | 1.55ms | 2.28ms | ±1.34% |     322 |

- **draw 100 lines** is 1.15x faster than draw 100 rectangles
- **draw 100 lines** is 2.59x faster than draw 100 circles
- **draw 100 lines** is 2.71x faster than create 10 pages with mixed content
- **draw 100 lines** is 3.16x faster than draw 100 text lines (standard font)

## Forms

| Benchmark         | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------- | ------: | ------: | ------: | -----: | ------: |
| read field values |   341.0 |  2.93ms |  4.72ms | ±1.58% |     171 |
| get form fields   |   303.8 |  3.29ms |  5.96ms | ±3.15% |     152 |
| flatten form      |   124.8 |  8.01ms | 10.42ms | ±1.89% |      63 |
| fill text fields  |    91.5 | 10.93ms | 15.56ms | ±4.75% |      46 |

- **read field values** is 1.12x faster than get form fields
- **read field values** is 2.73x faster than flatten form
- **read field values** is 3.73x faster than fill text fields

## Loading

| Benchmark              | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------- | ------: | -----: | -----: | -----: | ------: |
| load small PDF (888B)  |   14.3K |   70us |  159us | ±3.70% |   7,152 |
| load medium PDF (19KB) |    9.2K |  108us |  151us | ±4.32% |   4,612 |
| load form PDF (116KB)  |   738.4 | 1.35ms | 2.77ms | ±2.30% |     370 |
| load heavy PDF (9.9MB) |   398.7 | 2.51ms | 3.61ms | ±1.48% |     200 |

- **load small PDF (888B)** is 1.55x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 19.37x faster than load form PDF (116KB)
- **load small PDF (888B)** is 35.87x faster than load heavy PDF (9.9MB)

## Saving

| Benchmark                          | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------------------- | ------: | -----: | -----: | -----: | ------: |
| save unmodified (19KB)             |    9.3K |  107us |  240us | ±0.82% |   4,660 |
| incremental save (19KB)            |    6.2K |  160us |  335us | ±0.87% |   3,125 |
| save with modifications (19KB)     |    1.3K |  743us | 1.40ms | ±1.37% |     673 |
| save heavy PDF (9.9MB)             |   424.2 | 2.36ms | 2.84ms | ±0.58% |     213 |
| incremental save heavy PDF (9.9MB) |   121.9 | 8.20ms | 9.99ms | ±2.71% |      61 |

- **save unmodified (19KB)** is 1.49x faster than incremental save (19KB)
- **save unmodified (19KB)** is 6.93x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 21.97x faster than save heavy PDF (9.9MB)
- **save unmodified (19KB)** is 76.44x faster than incremental save heavy PDF (9.9MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |   929.1 |  1.08ms |  2.45ms | ±3.81% |     465 |
| extractPages (1 page from 100-page PDF)  |   272.8 |  3.67ms |  4.66ms | ±0.98% |     137 |
| extractPages (1 page from 2000-page PDF) |    17.0 | 58.83ms | 59.82ms | ±0.67% |      10 |

- **extractPages (1 page from small PDF)** is 3.41x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 54.66x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------------------- | ------: | -------: | -------: | -----: | ------: |
| split 100-page PDF (0.1MB)  |    31.5 |  31.78ms |  36.59ms | ±3.34% |      16 |
| split 2000-page PDF (0.9MB) |     1.7 | 575.36ms | 575.36ms | ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 18.11x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |    Mean |     p99 |    RME | Samples |
| :----------------------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extract first 10 pages from 2000-page PDF              |    16.9 | 59.23ms | 60.71ms | ±1.10% |       9 |
| extract first 100 pages from 2000-page PDF             |    16.0 | 62.54ms | 63.94ms | ±1.38% |       8 |
| extract every 10th page from 2000-page PDF (200 pages) |    14.9 | 66.94ms | 70.84ms | ±2.12% |       8 |

- **extract first 10 pages from 2000-page PDF** is 1.06x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.13x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
