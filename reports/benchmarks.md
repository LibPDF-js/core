# Benchmark Report

> Generated on 2026-02-18 at 03:10:44 UTC
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
| libpdf    |   411.5 |  2.43ms |  3.35ms | ±1.12% |     206 |
| pdf-lib   |    26.2 | 38.17ms | 43.03ms | ±3.52% |      14 |

- **libpdf** is 15.71x faster than pdf-lib

### Create blank PDF

| Benchmark | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------- | ------: | ----: | -----: | -----: | ------: |
| libpdf    |   17.4K |  57us |  128us | ±1.54% |   8,701 |
| pdf-lib   |    2.4K | 414us | 1.36ms | ±2.26% |   1,207 |

- **libpdf** is 7.21x faster than pdf-lib

### Add 10 pages

| Benchmark | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------- | ------: | ----: | -----: | -----: | ------: |
| libpdf    |   10.4K |  96us |  148us | ±0.93% |   5,208 |
| pdf-lib   |    2.0K | 500us | 1.74ms | ±2.51% |   1,000 |

- **libpdf** is 5.21x faster than pdf-lib

### Draw 50 rectangles

| Benchmark | ops/sec |   Mean |    p99 |    RME | Samples |
| :-------- | ------: | -----: | -----: | -----: | ------: |
| libpdf    |    1.3K |  755us | 2.17ms | ±3.05% |     663 |
| pdf-lib   |   611.8 | 1.63ms | 5.57ms | ±5.70% |     306 |

- **libpdf** is 2.17x faster than pdf-lib

### Load and save PDF

| Benchmark | ops/sec |    Mean |      p99 |    RME | Samples |
| :-------- | ------: | ------: | -------: | -----: | ------: |
| libpdf    |   403.6 |  2.48ms |   3.91ms | ±1.59% |     202 |
| pdf-lib   |    11.1 | 90.12ms | 102.16ms | ±5.69% |      10 |

- **libpdf** is 36.37x faster than pdf-lib

### Load, modify, and save PDF

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |    16.0 | 62.33ms | 68.33ms | ±5.52% |      10 |
| pdf-lib   |    11.6 | 86.08ms | 91.16ms | ±2.69% |      10 |

- **libpdf** is 1.38x faster than pdf-lib

### Extract single page from 100-page PDF

| Benchmark | ops/sec |   Mean |     p99 |    RME | Samples |
| :-------- | ------: | -----: | ------: | -----: | ------: |
| libpdf    |   262.5 | 3.81ms |  4.60ms | ±1.23% |     132 |
| pdf-lib   |   111.6 | 8.96ms | 10.31ms | ±1.20% |      56 |

- **libpdf** is 2.35x faster than pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark | ops/sec |    Mean |      p99 |    RME | Samples |
| :-------- | ------: | ------: | -------: | -----: | ------: |
| libpdf    |    29.8 | 33.54ms |  39.85ms | ±3.44% |      15 |
| pdf-lib   |    11.1 | 89.90ms | 104.64ms | ±8.74% |       6 |

- **libpdf** is 2.68x faster than pdf-lib

### Split 2000-page PDF into single-page PDFs (0.9MB)

| Benchmark | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------- | ------: | -------: | -------: | -----: | ------: |
| libpdf    |     1.6 | 608.02ms | 608.02ms | ±0.00% |       1 |
| pdf-lib   |   0.615 |    1.63s |    1.63s | ±0.00% |       1 |

- **libpdf** is 2.67x faster than pdf-lib

### Copy 10 pages between documents

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |   208.8 |  4.79ms |  5.64ms | ±1.01% |     105 |
| pdf-lib   |    85.5 | 11.69ms | 12.54ms | ±1.23% |      43 |

- **libpdf** is 2.44x faster than pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |    66.1 | 15.13ms | 16.94ms | ±1.11% |      34 |
| pdf-lib   |    18.2 | 54.87ms | 64.18ms | ±4.43% |      10 |

- **libpdf** is 3.63x faster than pdf-lib

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |   Mean |    p99 |    RME | Samples |
| :------------------------------ | ------: | -----: | -----: | -----: | ------: |
| copy 1 page                     |   943.3 | 1.06ms | 2.57ms | ±3.23% |     472 |
| copy 10 pages from 100-page PDF |   215.5 | 4.64ms | 5.59ms | ±1.87% |     108 |
| copy all 100 pages              |   133.1 | 7.51ms | 8.26ms | ±0.88% |      67 |

- **copy 1 page** is 4.38x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 7.09x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |  Mean |    p99 |    RME | Samples |
| :---------------------------------------- | ------: | ----: | -----: | -----: | ------: |
| duplicate page 0                          |    1.0K | 983us | 1.72ms | ±1.32% |     509 |
| duplicate all pages (double the document) |    1.0K | 983us | 1.66ms | ±1.21% |     509 |

- **duplicate page 0** is 1.00x faster than duplicate all pages (double the document)

### Merge PDFs

| Benchmark               | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------- | ------: | ------: | ------: | -----: | ------: |
| merge 2 small PDFs      |   671.5 |  1.49ms |  1.85ms | ±0.57% |     336 |
| merge 10 small PDFs     |   124.0 |  8.07ms |  8.79ms | ±0.67% |      62 |
| merge 2 x 100-page PDFs |    70.2 | 14.25ms | 15.09ms | ±0.78% |      36 |

- **merge 2 small PDFs** is 5.42x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 9.57x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------- | ------: | -----: | -----: | -----: | ------: |
| draw 100 lines                      |   808.5 | 1.24ms | 2.77ms | ±3.08% |     406 |
| draw 100 rectangles                 |   660.8 | 1.51ms | 3.58ms | ±4.40% |     331 |
| draw 100 text lines (standard font) |   298.7 | 3.35ms | 7.24ms | ±4.47% |     150 |
| draw 100 circles                    |   285.0 | 3.51ms | 6.89ms | ±5.03% |     143 |
| create 10 pages with mixed content  |   247.6 | 4.04ms | 8.41ms | ±6.35% |     125 |

- **draw 100 lines** is 1.22x faster than draw 100 rectangles
- **draw 100 lines** is 2.71x faster than draw 100 text lines (standard font)
- **draw 100 lines** is 2.84x faster than draw 100 circles
- **draw 100 lines** is 3.27x faster than create 10 pages with mixed content

## Forms

| Benchmark         | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------- | ------: | ------: | ------: | -----: | ------: |
| read field values |   318.4 |  3.14ms |  3.95ms | ±1.49% |     160 |
| get form fields   |   277.2 |  3.61ms |  8.41ms | ±4.30% |     139 |
| flatten form      |   114.3 |  8.75ms | 10.98ms | ±2.13% |      58 |
| fill text fields  |    84.9 | 11.78ms | 16.83ms | ±3.91% |      43 |

- **read field values** is 1.15x faster than get form fields
- **read field values** is 2.79x faster than flatten form
- **read field values** is 3.75x faster than fill text fields

## Loading

| Benchmark              | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------- | ------: | -----: | -----: | -----: | ------: |
| load small PDF (888B)  |   15.8K |   63us |  143us | ±0.83% |   7,919 |
| load medium PDF (19KB) |   10.1K |   99us |  127us | ±0.44% |   5,052 |
| load form PDF (116KB)  |   743.6 | 1.34ms | 2.45ms | ±1.34% |     372 |
| load heavy PDF (9.9MB) |   400.4 | 2.50ms | 2.91ms | ±0.62% |     201 |

- **load small PDF (888B)** is 1.57x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 21.30x faster than load form PDF (116KB)
- **load small PDF (888B)** is 39.56x faster than load heavy PDF (9.9MB)

## Saving

| Benchmark                          | ops/sec |   Mean |     p99 |     RME | Samples |
| :--------------------------------- | ------: | -----: | ------: | ------: | ------: |
| save unmodified (19KB)             |    8.9K |  112us |   276us |  ±0.99% |   4,474 |
| incremental save (19KB)            |    5.5K |  183us |   379us |  ±0.99% |   2,734 |
| save with modifications (19KB)     |    1.3K |  785us |  1.48ms |  ±1.50% |     638 |
| save heavy PDF (9.9MB)             |   449.8 | 2.22ms |  2.87ms |  ±1.08% |     225 |
| incremental save heavy PDF (9.9MB) |   134.9 | 7.41ms | 20.74ms | ±11.74% |      68 |

- **save unmodified (19KB)** is 1.64x faster than incremental save (19KB)
- **save unmodified (19KB)** is 7.02x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 19.89x faster than save heavy PDF (9.9MB)
- **save unmodified (19KB)** is 66.30x faster than incremental save heavy PDF (9.9MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |   959.0 |  1.04ms |  2.53ms | ±2.98% |     480 |
| extractPages (1 page from 100-page PDF)  |   267.3 |  3.74ms |  4.41ms | ±0.81% |     134 |
| extractPages (1 page from 2000-page PDF) |    16.8 | 59.59ms | 60.99ms | ±0.99% |      10 |

- **extractPages (1 page from small PDF)** is 3.59x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 57.14x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------------------- | ------: | -------: | -------: | -----: | ------: |
| split 100-page PDF (0.1MB)  |    30.9 |  32.33ms |  41.27ms | ±4.47% |      16 |
| split 2000-page PDF (0.9MB) |     1.7 | 587.14ms | 587.14ms | ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 18.16x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |    Mean |     p99 |     RME | Samples |
| :----------------------------------------------------- | ------: | ------: | ------: | ------: | ------: |
| extract first 10 pages from 2000-page PDF              |    16.4 | 61.01ms | 62.55ms |  ±1.12% |       9 |
| extract first 100 pages from 2000-page PDF             |    15.6 | 64.07ms | 65.38ms |  ±0.92% |       8 |
| extract every 10th page from 2000-page PDF (200 pages) |    13.9 | 71.87ms | 93.23ms | ±12.25% |       7 |

- **extract first 10 pages from 2000-page PDF** is 1.05x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.18x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
