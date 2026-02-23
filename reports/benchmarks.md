# Benchmark Report

> Generated on 2026-02-23 at 07:03:45 UTC
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
| libpdf    |   419.9 |  2.38ms |  4.12ms | ±1.87% |     210 |
| pdf-lib   |    25.1 | 39.83ms | 46.97ms | ±4.89% |      13 |

- **libpdf** is 16.72x faster than pdf-lib

### Create blank PDF

| Benchmark | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------- | ------: | ----: | -----: | -----: | ------: |
| libpdf    |   17.0K |  59us |  124us | ±1.35% |   8,500 |
| pdf-lib   |    2.2K | 450us | 1.56ms | ±3.09% |   1,113 |

- **libpdf** is 7.65x faster than pdf-lib

### Add 10 pages

| Benchmark | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------- | ------: | ----: | -----: | -----: | ------: |
| libpdf    |   10.2K |  98us |  142us | ±0.85% |   5,116 |
| pdf-lib   |    2.0K | 510us | 1.67ms | ±2.42% |     980 |

- **libpdf** is 5.22x faster than pdf-lib

### Draw 50 rectangles

| Benchmark | ops/sec |   Mean |    p99 |    RME | Samples |
| :-------- | ------: | -----: | -----: | -----: | ------: |
| libpdf    |    3.3K |  306us |  786us | ±1.27% |   1,633 |
| pdf-lib   |   584.9 | 1.71ms | 6.43ms | ±6.62% |     293 |

- **libpdf** is 5.58x faster than pdf-lib

### Load and save PDF

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |   410.3 |  2.44ms |  4.86ms | ±2.35% |     206 |
| pdf-lib   |    11.6 | 86.50ms | 92.88ms | ±3.28% |      10 |

- **libpdf** is 35.50x faster than pdf-lib

### Load, modify, and save PDF

| Benchmark | ops/sec |    Mean |      p99 |    RME | Samples |
| :-------- | ------: | ------: | -------: | -----: | ------: |
| libpdf    |    23.2 | 43.03ms |  56.37ms | ±7.38% |      12 |
| pdf-lib   |    11.4 | 87.44ms | 102.08ms | ±5.32% |      10 |

- **libpdf** is 2.03x faster than pdf-lib

### Extract single page from 100-page PDF

| Benchmark | ops/sec |   Mean |     p99 |    RME | Samples |
| :-------- | ------: | -----: | ------: | -----: | ------: |
| libpdf    |   279.2 | 3.58ms |  4.13ms | ±0.64% |     140 |
| pdf-lib   |   111.1 | 9.00ms | 12.25ms | ±1.89% |      56 |

- **libpdf** is 2.51x faster than pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark | ops/sec |    Mean |      p99 |    RME | Samples |
| :-------- | ------: | ------: | -------: | -----: | ------: |
| libpdf    |    30.6 | 32.70ms |  35.43ms | ±1.66% |      16 |
| pdf-lib   |    11.0 | 91.32ms | 106.74ms | ±9.49% |       6 |

- **libpdf** is 2.79x faster than pdf-lib

### Split 2000-page PDF into single-page PDFs (0.9MB)

| Benchmark | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------- | ------: | -------: | -------: | -----: | ------: |
| libpdf    |     1.6 | 610.54ms | 610.54ms | ±0.00% |       1 |
| pdf-lib   |   0.618 |    1.62s |    1.62s | ±0.00% |       1 |

- **libpdf** is 2.65x faster than pdf-lib

### Copy 10 pages between documents

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |   221.4 |  4.52ms |  5.12ms | ±0.81% |     111 |
| pdf-lib   |    86.2 | 11.60ms | 12.24ms | ±0.76% |      44 |

- **libpdf** is 2.57x faster than pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |    70.3 | 14.21ms | 20.05ms | ±2.58% |      36 |
| pdf-lib   |    18.9 | 52.83ms | 55.55ms | ±1.47% |      10 |

- **libpdf** is 3.72x faster than pdf-lib

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |   Mean |    p99 |    RME | Samples |
| :------------------------------ | ------: | -----: | -----: | -----: | ------: |
| copy 1 page                     |    1.1K |  948us | 2.14ms | ±2.33% |     528 |
| copy 10 pages from 100-page PDF |   229.6 | 4.35ms | 5.36ms | ±0.96% |     115 |
| copy all 100 pages              |   141.0 | 7.09ms | 8.10ms | ±0.90% |      71 |

- **copy 1 page** is 4.59x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 7.48x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |  Mean |    p99 |    RME | Samples |
| :---------------------------------------- | ------: | ----: | -----: | -----: | ------: |
| duplicate page 0                          |    1.2K | 854us | 1.59ms | ±1.00% |     586 |
| duplicate all pages (double the document) |    1.2K | 861us | 1.63ms | ±1.29% |     581 |

- **duplicate page 0** is 1.01x faster than duplicate all pages (double the document)

### Merge PDFs

| Benchmark               | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------- | ------: | ------: | ------: | -----: | ------: |
| merge 2 small PDFs      |   719.1 |  1.39ms |  2.06ms | ±1.05% |     360 |
| merge 10 small PDFs     |   141.8 |  7.05ms |  7.62ms | ±0.70% |      71 |
| merge 2 x 100-page PDFs |    76.4 | 13.09ms | 13.59ms | ±0.71% |      39 |

- **merge 2 small PDFs** is 5.07x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 9.42x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------- | ------: | -----: | -----: | -----: | ------: |
| draw 100 lines                      |    2.0K |  492us | 1.09ms | ±1.47% |   1,017 |
| draw 100 rectangles                 |    1.8K |  560us | 1.44ms | ±3.04% |     893 |
| draw 100 circles                    |   797.0 | 1.25ms | 2.86ms | ±2.94% |     399 |
| create 10 pages with mixed content  |   761.7 | 1.31ms | 2.23ms | ±1.58% |     381 |
| draw 100 text lines (standard font) |   640.3 | 1.56ms | 2.31ms | ±1.24% |     321 |

- **draw 100 lines** is 1.14x faster than draw 100 rectangles
- **draw 100 lines** is 2.55x faster than draw 100 circles
- **draw 100 lines** is 2.67x faster than create 10 pages with mixed content
- **draw 100 lines** is 3.17x faster than draw 100 text lines (standard font)

## Forms

| Benchmark         | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------- | ------: | ------: | ------: | -----: | ------: |
| read field values |   351.3 |  2.85ms |  5.20ms | ±1.55% |     176 |
| get form fields   |   302.5 |  3.31ms |  6.99ms | ±5.51% |     152 |
| flatten form      |   125.9 |  7.95ms | 11.26ms | ±2.54% |      63 |
| fill text fields  |    94.8 | 10.54ms | 13.69ms | ±3.35% |      48 |

- **read field values** is 1.16x faster than get form fields
- **read field values** is 2.79x faster than flatten form
- **read field values** is 3.70x faster than fill text fields

## Loading

| Benchmark              | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------- | ------: | -----: | -----: | -----: | ------: |
| load small PDF (888B)  |   16.7K |   60us |  140us | ±0.70% |   8,329 |
| load medium PDF (19KB) |   10.4K |   96us |  142us | ±0.47% |   5,193 |
| load form PDF (116KB)  |   759.2 | 1.32ms | 2.47ms | ±1.69% |     380 |
| load heavy PDF (9.9MB) |   378.9 | 2.64ms | 3.09ms | ±0.60% |     190 |

- **load small PDF (888B)** is 1.60x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 21.94x faster than load form PDF (116KB)
- **load small PDF (888B)** is 43.96x faster than load heavy PDF (9.9MB)

## Saving

| Benchmark                          | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------------------- | ------: | -----: | -----: | -----: | ------: |
| save unmodified (19KB)             |    8.3K |  121us |  301us | ±2.46% |   4,145 |
| incremental save (19KB)            |    5.6K |  179us |  346us | ±2.21% |   2,796 |
| save with modifications (19KB)     |    1.3K |  783us | 2.00ms | ±2.22% |     639 |
| save heavy PDF (9.9MB)             |   405.4 | 2.47ms | 4.66ms | ±2.88% |     203 |
| incremental save heavy PDF (9.9MB) |   129.7 | 7.71ms | 9.22ms | ±3.18% |      65 |

- **save unmodified (19KB)** is 1.48x faster than incremental save (19KB)
- **save unmodified (19KB)** is 6.49x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 20.44x faster than save heavy PDF (9.9MB)
- **save unmodified (19KB)** is 63.91x faster than incremental save heavy PDF (9.9MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |    1.0K |   985us |  2.24ms | ±3.15% |     508 |
| extractPages (1 page from 100-page PDF)  |   284.2 |  3.52ms |  6.13ms | ±1.77% |     143 |
| extractPages (1 page from 2000-page PDF) |    17.9 | 55.95ms | 58.00ms | ±1.06% |      10 |

- **extractPages (1 page from small PDF)** is 3.57x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 56.78x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------------------- | ------: | -------: | -------: | -----: | ------: |
| split 100-page PDF (0.1MB)  |    31.5 |  31.72ms |  36.42ms | ±3.82% |      16 |
| split 2000-page PDF (0.9MB) |     1.8 | 567.80ms | 567.80ms | ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 17.90x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |    Mean |     p99 |    RME | Samples |
| :----------------------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extract first 10 pages from 2000-page PDF              |    17.6 | 56.70ms | 57.66ms | ±0.78% |       9 |
| extract first 100 pages from 2000-page PDF             |    16.6 | 60.09ms | 61.87ms | ±1.42% |       9 |
| extract every 10th page from 2000-page PDF (200 pages) |    15.6 | 64.24ms | 65.26ms | ±0.66% |       8 |

- **extract first 10 pages from 2000-page PDF** is 1.06x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.13x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
