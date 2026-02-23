# Benchmark Report

> Generated on 2026-02-23 at 22:30:04 UTC
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
| libpdf    |   432.4 |  2.31ms |  3.21ms | ±1.41% |     217 |
| pdf-lib   |    26.7 | 37.41ms | 42.25ms | ±3.56% |      14 |

- **libpdf** is 16.17x faster than pdf-lib

### Create blank PDF

| Benchmark | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------- | ------: | ----: | -----: | -----: | ------: |
| libpdf    |   17.6K |  57us |  125us | ±2.63% |   8,817 |
| pdf-lib   |    2.4K | 410us | 1.26ms | ±2.20% |   1,219 |

- **libpdf** is 7.23x faster than pdf-lib

### Add 10 pages

| Benchmark | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------- | ------: | ----: | -----: | -----: | ------: |
| libpdf    |   10.5K |  96us |  149us | ±0.83% |   5,228 |
| pdf-lib   |    2.0K | 499us | 1.65ms | ±2.52% |   1,003 |

- **libpdf** is 5.21x faster than pdf-lib

### Draw 50 rectangles

| Benchmark | ops/sec |   Mean |    p99 |    RME | Samples |
| :-------- | ------: | -----: | -----: | -----: | ------: |
| libpdf    |    3.3K |  307us |  755us | ±1.26% |   1,632 |
| pdf-lib   |   569.7 | 1.76ms | 7.25ms | ±6.85% |     285 |

- **libpdf** is 5.73x faster than pdf-lib

### Load and save PDF

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |   406.5 |  2.46ms |  4.26ms | ±2.28% |     204 |
| pdf-lib   |    11.5 | 86.80ms | 94.86ms | ±4.33% |      10 |

- **libpdf** is 35.28x faster than pdf-lib

### Load, modify, and save PDF

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |    23.6 | 42.40ms | 45.95ms | ±3.71% |      12 |
| pdf-lib   |    11.6 | 86.33ms | 90.84ms | ±2.78% |      10 |

- **libpdf** is 2.04x faster than pdf-lib

### Extract single page from 100-page PDF

| Benchmark | ops/sec |   Mean |     p99 |    RME | Samples |
| :-------- | ------: | -----: | ------: | -----: | ------: |
| libpdf    |   276.6 | 3.62ms |  6.35ms | ±2.01% |     139 |
| pdf-lib   |   112.4 | 8.90ms | 11.73ms | ±1.66% |      57 |

- **libpdf** is 2.46x faster than pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |    31.5 | 31.77ms | 34.01ms | ±1.81% |      16 |
| pdf-lib   |    11.2 | 89.29ms | 99.64ms | ±6.63% |       6 |

- **libpdf** is 2.81x faster than pdf-lib

### Split 2000-page PDF into single-page PDFs (0.9MB)

| Benchmark | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------- | ------: | -------: | -------: | -----: | ------: |
| libpdf    |     1.7 | 600.72ms | 600.72ms | ±0.00% |       1 |
| pdf-lib   |   0.622 |    1.61s |    1.61s | ±0.00% |       1 |

- **libpdf** is 2.68x faster than pdf-lib

### Copy 10 pages between documents

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |   223.5 |  4.47ms |  5.06ms | ±0.82% |     112 |
| pdf-lib   |    86.0 | 11.63ms | 13.78ms | ±1.40% |      43 |

- **libpdf** is 2.60x faster than pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |    73.4 | 13.63ms | 15.68ms | ±1.31% |      37 |
| pdf-lib   |    19.2 | 52.05ms | 52.75ms | ±0.68% |      10 |

- **libpdf** is 3.82x faster than pdf-lib

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |   Mean |    p99 |    RME | Samples |
| :------------------------------ | ------: | -----: | -----: | -----: | ------: |
| copy 1 page                     |    1.0K |  988us | 1.95ms | ±2.30% |     506 |
| copy 10 pages from 100-page PDF |   222.5 | 4.49ms | 6.52ms | ±1.94% |     112 |
| copy all 100 pages              |   137.4 | 7.28ms | 8.10ms | ±0.84% |      69 |

- **copy 1 page** is 4.55x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 7.37x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |  Mean |    p99 |    RME | Samples |
| :---------------------------------------- | ------: | ----: | -----: | -----: | ------: |
| duplicate all pages (double the document) |    1.2K | 867us | 1.59ms | ±0.98% |     577 |
| duplicate page 0                          |    1.1K | 876us | 1.62ms | ±1.06% |     571 |

- **duplicate all pages (double the document)** is 1.01x faster than duplicate page 0

### Merge PDFs

| Benchmark               | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------- | ------: | ------: | ------: | -----: | ------: |
| merge 2 small PDFs      |   701.3 |  1.43ms |  2.05ms | ±1.07% |     351 |
| merge 10 small PDFs     |   135.2 |  7.40ms |  8.10ms | ±0.77% |      68 |
| merge 2 x 100-page PDFs |    73.9 | 13.54ms | 15.99ms | ±1.29% |      37 |

- **merge 2 small PDFs** is 5.19x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 9.49x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------- | ------: | -----: | -----: | -----: | ------: |
| draw 100 lines                      |    2.0K |  488us | 1.11ms | ±1.28% |   1,025 |
| draw 100 rectangles                 |    1.8K |  566us | 1.44ms | ±3.15% |     884 |
| create 10 pages with mixed content  |   753.5 | 1.33ms | 2.21ms | ±1.57% |     377 |
| draw 100 circles                    |   738.8 | 1.35ms | 2.93ms | ±3.15% |     370 |
| draw 100 text lines (standard font) |   643.9 | 1.55ms | 2.23ms | ±1.27% |     322 |

- **draw 100 lines** is 1.16x faster than draw 100 rectangles
- **draw 100 lines** is 2.72x faster than create 10 pages with mixed content
- **draw 100 lines** is 2.77x faster than draw 100 circles
- **draw 100 lines** is 3.18x faster than draw 100 text lines (standard font)

## Forms

| Benchmark         | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------- | ------: | ------: | ------: | -----: | ------: |
| read field values |   329.7 |  3.03ms |  5.44ms | ±2.41% |     166 |
| get form fields   |   304.6 |  3.28ms |  5.79ms | ±3.05% |     153 |
| flatten form      |   117.2 |  8.53ms | 13.91ms | ±3.47% |      59 |
| fill text fields  |    89.2 | 11.21ms | 18.86ms | ±4.53% |      45 |

- **read field values** is 1.08x faster than get form fields
- **read field values** is 2.81x faster than flatten form
- **read field values** is 3.70x faster than fill text fields

## Loading

| Benchmark              | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------- | ------: | -----: | -----: | -----: | ------: |
| load small PDF (888B)  |   16.8K |   60us |  143us | ±0.73% |   8,383 |
| load medium PDF (19KB) |   10.9K |   91us |  199us | ±0.64% |   5,470 |
| load form PDF (116KB)  |   721.0 | 1.39ms | 2.61ms | ±1.69% |     361 |
| load heavy PDF (9.9MB) |   442.3 | 2.26ms | 2.88ms | ±0.88% |     222 |

- **load small PDF (888B)** is 1.53x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 23.25x faster than load form PDF (116KB)
- **load small PDF (888B)** is 37.90x faster than load heavy PDF (9.9MB)

## Saving

| Benchmark                          | ops/sec |   Mean |     p99 |    RME | Samples |
| :--------------------------------- | ------: | -----: | ------: | -----: | ------: |
| save unmodified (19KB)             |    9.0K |  112us |   251us | ±0.90% |   4,484 |
| incremental save (19KB)            |    6.2K |  162us |   342us | ±0.83% |   3,085 |
| save with modifications (19KB)     |    1.4K |  734us |  1.39ms | ±1.20% |     682 |
| save heavy PDF (9.9MB)             |   395.6 | 2.53ms |  2.94ms | ±0.40% |     198 |
| incremental save heavy PDF (9.9MB) |   166.9 | 5.99ms | 13.98ms | ±8.41% |      84 |

- **save unmodified (19KB)** is 1.45x faster than incremental save (19KB)
- **save unmodified (19KB)** is 6.58x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 22.67x faster than save heavy PDF (9.9MB)
- **save unmodified (19KB)** is 53.73x faster than incremental save heavy PDF (9.9MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |   983.6 |  1.02ms |  2.39ms | ±4.36% |     492 |
| extractPages (1 page from 100-page PDF)  |   280.5 |  3.57ms |  6.60ms | ±2.49% |     141 |
| extractPages (1 page from 2000-page PDF) |    17.8 | 56.12ms | 57.45ms | ±1.11% |      10 |

- **extractPages (1 page from small PDF)** is 3.51x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 55.19x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------------------- | ------: | -------: | -------: | -----: | ------: |
| split 100-page PDF (0.1MB)  |    32.0 |  31.27ms |  37.31ms | ±4.62% |      16 |
| split 2000-page PDF (0.9MB) |     1.8 | 568.70ms | 568.70ms | ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 18.19x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |    Mean |     p99 |    RME | Samples |
| :----------------------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extract first 10 pages from 2000-page PDF              |    17.3 | 57.83ms | 58.72ms | ±0.82% |       9 |
| extract first 100 pages from 2000-page PDF             |    16.5 | 60.59ms | 62.47ms | ±1.84% |       9 |
| extract every 10th page from 2000-page PDF (200 pages) |    15.2 | 65.69ms | 69.26ms | ±2.21% |       8 |

- **extract first 10 pages from 2000-page PDF** is 1.05x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.14x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
