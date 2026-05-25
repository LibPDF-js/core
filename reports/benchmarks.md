# Benchmark Report

> Generated on 2026-05-25 at 10:03:17 UTC
>
> System: linux | AMD EPYC 9V74 80-Core Processor (4 cores) | 16GB RAM | Bun 1.3.14

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
| libpdf          |   434.8 |  2.30ms |  3.23ms | ±3.39% |     218 |
| @cantoo/pdf-lib |    27.2 | 36.82ms | 40.36ms | ±1.97% |      14 |
| pdf-lib         |    26.8 | 37.34ms | 40.34ms | ±3.16% |      14 |

- **libpdf** is 16.01x faster than @cantoo/pdf-lib
- **libpdf** is 16.24x faster than pdf-lib

### Create blank PDF

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |   20.9K |  48us |  110us | ±1.38% |  10,475 |
| pdf-lib         |    3.1K | 327us | 1.36ms | ±2.68% |   1,530 |
| @cantoo/pdf-lib |    2.7K | 369us | 1.75ms | ±3.79% |   1,357 |

- **libpdf** is 6.85x faster than pdf-lib
- **libpdf** is 7.72x faster than @cantoo/pdf-lib

### Add 10 pages

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |    9.2K | 109us |  218us | ±1.08% |   4,594 |
| @cantoo/pdf-lib |    2.4K | 415us | 2.50ms | ±4.33% |   1,205 |
| pdf-lib         |    2.3K | 444us | 2.05ms | ±3.56% |   1,127 |

- **libpdf** is 3.82x faster than @cantoo/pdf-lib
- **libpdf** is 4.08x faster than pdf-lib

### Draw 50 rectangles

| Benchmark       | ops/sec |   Mean |    p99 |    RME | Samples |
| :-------------- | ------: | -----: | -----: | -----: | ------: |
| libpdf          |    2.9K |  340us |  908us | ±1.50% |   1,471 |
| pdf-lib         |   687.6 | 1.45ms | 6.41ms | ±8.11% |     344 |
| @cantoo/pdf-lib |   545.7 | 1.83ms | 5.45ms | ±6.80% |     273 |

- **libpdf** is 4.28x faster than pdf-lib
- **libpdf** is 5.39x faster than @cantoo/pdf-lib

### Load and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |   418.9 |   2.39ms |   4.11ms | ±2.01% |     210 |
| pdf-lib         |    13.5 |  74.19ms |  77.86ms | ±2.89% |      10 |
| @cantoo/pdf-lib |     7.0 | 141.90ms | 145.94ms | ±1.02% |      10 |

- **libpdf** is 31.08x faster than pdf-lib
- **libpdf** is 59.44x faster than @cantoo/pdf-lib

### Load, modify, and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |    20.9 |  47.96ms |  62.09ms | ±8.67% |      11 |
| pdf-lib         |    13.3 |  75.11ms |  90.49ms | ±6.94% |      10 |
| @cantoo/pdf-lib |     7.1 | 140.89ms | 147.99ms | ±1.65% |      10 |

- **libpdf** is 1.57x faster than pdf-lib
- **libpdf** is 2.94x faster than @cantoo/pdf-lib

### Extract single page from 100-page PDF

| Benchmark       | ops/sec |   Mean |     p99 |    RME | Samples |
| :-------------- | ------: | -----: | ------: | -----: | ------: |
| libpdf          |   292.3 | 3.42ms |  5.44ms | ±1.56% |     147 |
| pdf-lib         |   112.7 | 8.87ms | 15.97ms | ±3.24% |      57 |
| @cantoo/pdf-lib |   110.2 | 9.07ms | 11.21ms | ±1.80% |      56 |

- **libpdf** is 2.59x faster than pdf-lib
- **libpdf** is 2.65x faster than @cantoo/pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |     RME | Samples |
| :-------------- | ------: | ------: | ------: | ------: | ------: |
| libpdf          |    27.8 | 35.93ms | 37.27ms |  ±0.98% |      14 |
| pdf-lib         |    13.8 | 72.69ms | 78.10ms |  ±5.61% |       7 |
| @cantoo/pdf-lib |    12.3 | 81.09ms | 93.91ms | ±11.83% |       7 |

- **libpdf** is 2.02x faster than pdf-lib
- **libpdf** is 2.26x faster than @cantoo/pdf-lib

### Split 2000-page PDF into single-page PDFs (0.9MB)

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |     1.4 | 697.16ms | 697.16ms | ±0.00% |       1 |
| pdf-lib         |   0.745 |    1.34s |    1.34s | ±0.00% |       1 |
| @cantoo/pdf-lib |   0.724 |    1.38s |    1.38s | ±0.00% |       1 |

- **libpdf** is 1.93x faster than pdf-lib
- **libpdf** is 1.98x faster than @cantoo/pdf-lib

### Copy 10 pages between documents

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |   232.1 |  4.31ms |  5.06ms | ±0.97% |     117 |
| pdf-lib         |    87.0 | 11.50ms | 17.93ms | ±2.89% |      44 |
| @cantoo/pdf-lib |    77.5 | 12.90ms | 15.98ms | ±2.12% |      39 |

- **libpdf** is 2.67x faster than pdf-lib
- **libpdf** is 2.99x faster than @cantoo/pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    68.4 | 14.62ms | 15.95ms | ±1.06% |      35 |
| pdf-lib         |    19.5 | 51.31ms | 52.26ms | ±0.78% |      10 |
| @cantoo/pdf-lib |    16.4 | 60.90ms | 61.80ms | ±0.83% |       9 |

- **libpdf** is 3.51x faster than pdf-lib
- **libpdf** is 4.17x faster than @cantoo/pdf-lib

### Fill FINTRAC form fields

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    52.6 | 19.01ms | 22.61ms | ±2.76% |      27 |
| @cantoo/pdf-lib |    35.2 | 28.45ms | 34.16ms | ±4.10% |      18 |
| pdf-lib         |    34.3 | 29.12ms | 41.47ms | ±5.92% |      18 |

- **libpdf** is 1.50x faster than @cantoo/pdf-lib
- **libpdf** is 1.53x faster than pdf-lib

### Fill and flatten FINTRAC form

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    63.2 | 15.83ms | 18.58ms | ±1.85% |      32 |
| pdf-lib         |  FAILED |       - |       - |      - |       0 |
| @cantoo/pdf-lib |    31.1 | 32.19ms | 39.36ms | ±5.17% |      16 |

- **libpdf** is 2.03x faster than @cantoo/pdf-lib

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |   Mean |    p99 |    RME | Samples |
| :------------------------------ | ------: | -----: | -----: | -----: | ------: |
| copy 1 page                     |   971.6 | 1.03ms | 2.21ms | ±2.86% |     486 |
| copy 10 pages from 100-page PDF |   232.3 | 4.30ms | 7.49ms | ±2.01% |     117 |
| copy all 100 pages              |   135.6 | 7.38ms | 7.99ms | ±0.70% |      68 |

- **copy 1 page** is 4.18x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 7.17x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |  Mean |    p99 |    RME | Samples |
| :---------------------------------------- | ------: | ----: | -----: | -----: | ------: |
| duplicate all pages (double the document) |    1.1K | 924us | 1.40ms | ±0.89% |     542 |
| duplicate page 0                          |    1.1K | 927us | 1.31ms | ±0.80% |     540 |

- **duplicate all pages (double the document)** is 1.00x faster than duplicate page 0

### Merge PDFs

| Benchmark               | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------- | ------: | ------: | ------: | -----: | ------: |
| merge 2 small PDFs      |   703.0 |  1.42ms |  1.86ms | ±0.99% |     352 |
| merge 10 small PDFs     |   137.9 |  7.25ms |  8.62ms | ±0.97% |      69 |
| merge 2 x 100-page PDFs |    71.4 | 14.01ms | 19.26ms | ±2.37% |      36 |

- **merge 2 small PDFs** is 5.10x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 9.85x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------- | ------: | -----: | -----: | -----: | ------: |
| draw 100 lines                      |    1.8K |  545us | 1.10ms | ±1.22% |     919 |
| draw 100 rectangles                 |    1.7K |  582us | 1.14ms | ±1.47% |     859 |
| draw 100 circles                    |    1.1K |  878us | 1.64ms | ±1.43% |     570 |
| create 10 pages with mixed content  |   697.8 | 1.43ms | 2.56ms | ±2.06% |     349 |
| draw 100 text lines (standard font) |   623.2 | 1.60ms | 2.70ms | ±1.86% |     312 |

- **draw 100 lines** is 1.07x faster than draw 100 rectangles
- **draw 100 lines** is 1.61x faster than draw 100 circles
- **draw 100 lines** is 2.63x faster than create 10 pages with mixed content
- **draw 100 lines** is 2.94x faster than draw 100 text lines (standard font)

## Forms

| Benchmark         | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------- | ------: | ------: | ------: | -----: | ------: |
| read field values |   364.6 |  2.74ms |  5.06ms | ±2.63% |     183 |
| get form fields   |   348.5 |  2.87ms |  4.95ms | ±2.41% |     175 |
| flatten form      |   128.2 |  7.80ms | 13.84ms | ±2.78% |      65 |
| fill text fields  |    86.6 | 11.55ms | 15.82ms | ±3.96% |      44 |

- **read field values** is 1.05x faster than get form fields
- **read field values** is 2.84x faster than flatten form
- **read field values** is 4.21x faster than fill text fields

## Loading

| Benchmark              | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------- | ------: | -----: | -----: | -----: | ------: |
| load small PDF (888B)  |   20.0K |   50us |  121us | ±1.36% |  10,002 |
| load medium PDF (19KB) |   12.4K |   81us |  140us | ±0.54% |   6,177 |
| load form PDF (116KB)  |   827.7 | 1.21ms | 2.10ms | ±1.36% |     414 |
| load heavy PDF (9.9MB) |   490.4 | 2.04ms | 2.51ms | ±0.62% |     246 |

- **load small PDF (888B)** is 1.62x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 24.17x faster than load form PDF (116KB)
- **load small PDF (888B)** is 40.79x faster than load heavy PDF (9.9MB)

## Saving

| Benchmark                          | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------------------- | ------: | -----: | -----: | -----: | ------: |
| save unmodified (19KB)             |   10.7K |   93us |  236us | ±1.69% |   5,368 |
| incremental save (19KB)            |    7.7K |  130us |  299us | ±1.00% |   3,856 |
| save with modifications (19KB)     |    1.4K |  738us | 1.41ms | ±1.42% |     678 |
| save heavy PDF (9.9MB)             |   477.7 | 2.09ms | 2.53ms | ±0.64% |     239 |
| incremental save heavy PDF (9.9MB) |   128.0 | 7.81ms | 8.99ms | ±2.72% |      65 |

- **save unmodified (19KB)** is 1.39x faster than incremental save (19KB)
- **save unmodified (19KB)** is 7.92x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 22.47x faster than save heavy PDF (9.9MB)
- **save unmodified (19KB)** is 83.84x faster than incremental save heavy PDF (9.9MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |    1.0K |   972us |  1.88ms | ±1.90% |     515 |
| extractPages (1 page from 100-page PDF)  |   304.5 |  3.28ms |  3.90ms | ±1.19% |     153 |
| extractPages (1 page from 2000-page PDF) |    19.5 | 51.18ms | 58.59ms | ±3.66% |      10 |

- **extractPages (1 page from small PDF)** is 3.38x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 52.66x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------------------- | ------: | -------: | -------: | -----: | ------: |
| split 100-page PDF (0.1MB)  |    27.0 |  37.00ms |  40.90ms | ±2.29% |      14 |
| split 2000-page PDF (0.9MB) |     1.5 | 666.83ms | 666.83ms | ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 18.02x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |    Mean |     p99 |    RME | Samples |
| :----------------------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extract first 10 pages from 2000-page PDF              |    18.9 | 52.82ms | 55.78ms | ±1.93% |      10 |
| extract first 100 pages from 2000-page PDF             |    17.9 | 55.94ms | 56.97ms | ±0.78% |       9 |
| extract every 10th page from 2000-page PDF (200 pages) |    16.6 | 60.14ms | 61.23ms | ±0.88% |       9 |

- **extract first 10 pages from 2000-page PDF** is 1.06x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.14x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
