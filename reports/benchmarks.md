# Benchmark Report

> Generated on 2026-03-09 at 07:01:17 UTC
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
| libpdf    |   419.2 |  2.39ms |  3.29ms | ±1.38% |     210 |
| pdf-lib   |    24.9 | 40.22ms | 43.64ms | ±3.28% |      13 |

- **libpdf** is 16.86x faster than pdf-lib

### Create blank PDF

| Benchmark | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------- | ------: | ----: | -----: | -----: | ------: |
| libpdf    |   18.6K |  54us |  112us | ±1.15% |   9,324 |
| pdf-lib   |    2.4K | 415us | 1.47ms | ±2.47% |   1,204 |

- **libpdf** is 7.74x faster than pdf-lib

### Add 10 pages

| Benchmark | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------- | ------: | ----: | -----: | -----: | ------: |
| libpdf    |   10.3K |  97us |  177us | ±1.08% |   5,153 |
| pdf-lib   |    1.9K | 539us | 2.11ms | ±3.02% |     928 |

- **libpdf** is 5.56x faster than pdf-lib

### Draw 50 rectangles

| Benchmark | ops/sec |   Mean |    p99 |    RME | Samples |
| :-------- | ------: | -----: | -----: | -----: | ------: |
| libpdf    |    3.1K |  321us |  826us | ±1.42% |   1,556 |
| pdf-lib   |   541.2 | 1.85ms | 7.61ms | ±7.60% |     271 |

- **libpdf** is 5.75x faster than pdf-lib

### Load and save PDF

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |   386.2 |  2.59ms |  4.67ms | ±2.74% |     194 |
| pdf-lib   |    11.6 | 86.39ms | 98.76ms | ±5.31% |      10 |

- **libpdf** is 33.37x faster than pdf-lib

### Load, modify, and save PDF

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |    24.7 | 40.47ms | 43.98ms | ±2.43% |      13 |
| pdf-lib   |    11.6 | 86.04ms | 97.95ms | ±4.25% |      10 |

- **libpdf** is 2.13x faster than pdf-lib

### Extract single page from 100-page PDF

| Benchmark | ops/sec |   Mean |     p99 |    RME | Samples |
| :-------- | ------: | -----: | ------: | -----: | ------: |
| libpdf    |   275.1 | 3.64ms |  4.40ms | ±1.50% |     138 |
| pdf-lib   |   110.2 | 9.07ms | 10.72ms | ±1.48% |      56 |

- **libpdf** is 2.50x faster than pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark | ops/sec |    Mean |      p99 |     RME | Samples |
| :-------- | ------: | ------: | -------: | ------: | ------: |
| libpdf    |    30.6 | 32.66ms |  38.71ms |  ±3.68% |      16 |
| pdf-lib   |    10.5 | 94.92ms | 121.47ms | ±17.00% |       6 |

- **libpdf** is 2.91x faster than pdf-lib

### Split 2000-page PDF into single-page PDFs (0.9MB)

| Benchmark | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------- | ------: | -------: | -------: | -----: | ------: |
| libpdf    |     1.7 | 604.70ms | 604.70ms | ±0.00% |       1 |
| pdf-lib   |   0.620 |    1.61s |    1.61s | ±0.00% |       1 |

- **libpdf** is 2.67x faster than pdf-lib

### Copy 10 pages between documents

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |   219.1 |  4.56ms |  6.46ms | ±1.43% |     110 |
| pdf-lib   |    83.6 | 11.96ms | 13.07ms | ±1.44% |      42 |

- **libpdf** is 2.62x faster than pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |    69.3 | 14.43ms | 19.63ms | ±2.53% |      35 |
| pdf-lib   |    18.3 | 54.77ms | 56.93ms | ±1.26% |      10 |

- **libpdf** is 3.79x faster than pdf-lib

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |   Mean |    p99 |    RME | Samples |
| :------------------------------ | ------: | -----: | -----: | -----: | ------: |
| copy 1 page                     |   987.4 | 1.01ms | 2.28ms | ±3.14% |     494 |
| copy 10 pages from 100-page PDF |   223.7 | 4.47ms | 7.20ms | ±2.04% |     112 |
| copy all 100 pages              |   137.0 | 7.30ms | 7.87ms | ±0.74% |      69 |

- **copy 1 page** is 4.41x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 7.21x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |  Mean |    p99 |    RME | Samples |
| :---------------------------------------- | ------: | ----: | -----: | -----: | ------: |
| duplicate all pages (double the document) |    1.2K | 862us | 1.57ms | ±0.95% |     580 |
| duplicate page 0                          |    1.1K | 873us | 1.33ms | ±0.83% |     573 |

- **duplicate all pages (double the document)** is 1.01x faster than duplicate page 0

### Merge PDFs

| Benchmark               | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------- | ------: | ------: | ------: | -----: | ------: |
| merge 2 small PDFs      |   706.1 |  1.42ms |  1.83ms | ±0.95% |     354 |
| merge 10 small PDFs     |   133.3 |  7.50ms |  8.17ms | ±0.85% |      67 |
| merge 2 x 100-page PDFs |    75.3 | 13.27ms | 13.95ms | ±0.86% |      38 |

- **merge 2 small PDFs** is 5.30x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 9.37x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------- | ------: | -----: | -----: | -----: | ------: |
| draw 100 lines                      |    2.0K |  495us | 1.16ms | ±1.41% |   1,011 |
| draw 100 rectangles                 |    1.8K |  571us | 1.43ms | ±3.25% |     876 |
| draw 100 circles                    |   781.1 | 1.28ms | 2.87ms | ±2.82% |     391 |
| create 10 pages with mixed content  |   744.7 | 1.34ms | 2.32ms | ±1.75% |     373 |
| draw 100 text lines (standard font) |   631.4 | 1.58ms | 2.41ms | ±1.27% |     316 |

- **draw 100 lines** is 1.15x faster than draw 100 rectangles
- **draw 100 lines** is 2.59x faster than draw 100 circles
- **draw 100 lines** is 2.71x faster than create 10 pages with mixed content
- **draw 100 lines** is 3.20x faster than draw 100 text lines (standard font)

## Forms

| Benchmark         | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------- | ------: | ------: | ------: | -----: | ------: |
| read field values |   333.9 |  2.99ms |  4.70ms | ±1.50% |     168 |
| get form fields   |   295.4 |  3.38ms |  5.80ms | ±3.18% |     149 |
| flatten form      |   121.5 |  8.23ms | 11.57ms | ±2.22% |      61 |
| fill text fields  |    89.9 | 11.12ms | 18.39ms | ±4.84% |      45 |

- **read field values** is 1.13x faster than get form fields
- **read field values** is 2.75x faster than flatten form
- **read field values** is 3.71x faster than fill text fields

## Loading

| Benchmark              | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------- | ------: | -----: | -----: | -----: | ------: |
| load small PDF (888B)  |   16.7K |   60us |  155us | ±0.76% |   8,341 |
| load medium PDF (19KB) |   10.7K |   93us |  193us | ±0.59% |   5,349 |
| load form PDF (116KB)  |   761.0 | 1.31ms | 2.26ms | ±1.25% |     381 |
| load heavy PDF (9.9MB) |   439.9 | 2.27ms | 2.74ms | ±0.57% |     221 |

- **load small PDF (888B)** is 1.56x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 21.92x faster than load form PDF (116KB)
- **load small PDF (888B)** is 37.92x faster than load heavy PDF (9.9MB)

## Saving

| Benchmark                          | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------------------- | ------: | -----: | -----: | -----: | ------: |
| save unmodified (19KB)             |    9.5K |  105us |  245us | ±0.89% |   4,741 |
| incremental save (19KB)            |    6.2K |  160us |  345us | ±0.96% |   3,116 |
| save with modifications (19KB)     |    1.3K |  799us | 1.73ms | ±2.21% |     626 |
| save heavy PDF (9.9MB)             |   439.4 | 2.28ms | 2.74ms | ±1.13% |     220 |
| incremental save heavy PDF (9.9MB) |   120.2 | 8.32ms | 9.62ms | ±2.59% |      61 |

- **save unmodified (19KB)** is 1.52x faster than incremental save (19KB)
- **save unmodified (19KB)** is 7.58x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 21.58x faster than save heavy PDF (9.9MB)
- **save unmodified (19KB)** is 78.87x faster than incremental save heavy PDF (9.9MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |   957.6 |  1.04ms |  2.52ms | ±2.92% |     479 |
| extractPages (1 page from 100-page PDF)  |   273.0 |  3.66ms |  4.23ms | ±0.77% |     137 |
| extractPages (1 page from 2000-page PDF) |    17.4 | 57.48ms | 58.61ms | ±0.59% |      10 |

- **extractPages (1 page from small PDF)** is 3.51x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 55.05x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------------------- | ------: | -------: | -------: | -----: | ------: |
| split 100-page PDF (0.1MB)  |    31.6 |  31.69ms |  35.60ms | ±3.53% |      16 |
| split 2000-page PDF (0.9MB) |     1.7 | 577.20ms | 577.20ms | ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 18.21x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |    Mean |     p99 |    RME | Samples |
| :----------------------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extract first 10 pages from 2000-page PDF              |    16.6 | 60.14ms | 69.45ms | ±4.69% |       9 |
| extract first 100 pages from 2000-page PDF             |    15.6 | 63.94ms | 69.21ms | ±3.60% |       8 |
| extract every 10th page from 2000-page PDF (200 pages) |    15.1 | 66.35ms | 67.75ms | ±1.10% |       8 |

- **extract first 10 pages from 2000-page PDF** is 1.06x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.10x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
