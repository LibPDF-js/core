# Benchmark Report

> Generated on 2026-03-02 at 06:57:18 UTC
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
| libpdf    |   413.9 |  2.42ms |  4.01ms | ±1.59% |     207 |
| pdf-lib   |    25.1 | 39.88ms | 45.29ms | ±4.58% |      13 |

- **libpdf** is 16.50x faster than pdf-lib

### Create blank PDF

| Benchmark | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------- | ------: | ----: | -----: | -----: | ------: |
| libpdf    |   17.7K |  56us |  115us | ±1.37% |   8,859 |
| pdf-lib   |    2.5K | 402us | 1.49ms | ±2.46% |   1,243 |

- **libpdf** is 7.13x faster than pdf-lib

### Add 10 pages

| Benchmark | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------- | ------: | ----: | -----: | -----: | ------: |
| libpdf    |   10.1K |  99us |  153us | ±0.95% |   5,037 |
| pdf-lib   |    2.0K | 508us | 1.83ms | ±2.72% |     985 |

- **libpdf** is 5.11x faster than pdf-lib

### Draw 50 rectangles

| Benchmark | ops/sec |   Mean |    p99 |    RME | Samples |
| :-------- | ------: | -----: | -----: | -----: | ------: |
| libpdf    |    3.2K |  311us |  751us | ±1.31% |   1,607 |
| pdf-lib   |   615.6 | 1.62ms | 5.93ms | ±6.74% |     308 |

- **libpdf** is 5.22x faster than pdf-lib

### Load and save PDF

| Benchmark | ops/sec |    Mean |      p99 |    RME | Samples |
| :-------- | ------: | ------: | -------: | -----: | ------: |
| libpdf    |   405.7 |  2.46ms |   4.11ms | ±1.74% |     203 |
| pdf-lib   |    11.4 | 87.60ms | 102.76ms | ±5.70% |      10 |

- **libpdf** is 35.54x faster than pdf-lib

### Load, modify, and save PDF

| Benchmark | ops/sec |    Mean |      p99 |    RME | Samples |
| :-------- | ------: | ------: | -------: | -----: | ------: |
| libpdf    |    23.0 | 43.47ms |  50.36ms | ±5.12% |      12 |
| pdf-lib   |    10.9 | 91.34ms | 101.21ms | ±4.86% |      10 |

- **libpdf** is 2.10x faster than pdf-lib

### Extract single page from 100-page PDF

| Benchmark | ops/sec |   Mean |     p99 |    RME | Samples |
| :-------- | ------: | -----: | ------: | -----: | ------: |
| libpdf    |   260.3 | 3.84ms |  6.47ms | ±2.57% |     131 |
| pdf-lib   |   103.7 | 9.64ms | 12.16ms | ±3.08% |      52 |

- **libpdf** is 2.51x faster than pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark | ops/sec |    Mean |      p99 |     RME | Samples |
| :-------- | ------: | ------: | -------: | ------: | ------: |
| libpdf    |    29.9 | 33.44ms |  42.53ms |  ±4.41% |      15 |
| pdf-lib   |    11.2 | 88.91ms | 106.48ms | ±10.30% |       6 |

- **libpdf** is 2.66x faster than pdf-lib

### Split 2000-page PDF into single-page PDFs (0.9MB)

| Benchmark | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------- | ------: | -------: | -------: | -----: | ------: |
| libpdf    |     1.6 | 613.62ms | 613.62ms | ±0.00% |       1 |
| pdf-lib   |   0.604 |    1.66s |    1.66s | ±0.00% |       1 |

- **libpdf** is 2.70x faster than pdf-lib

### Copy 10 pages between documents

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |   212.9 |  4.70ms |  5.58ms | ±1.22% |     107 |
| pdf-lib   |    84.6 | 11.82ms | 12.62ms | ±0.96% |      43 |

- **libpdf** is 2.52x faster than pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |    71.3 | 14.03ms | 15.09ms | ±0.93% |      36 |
| pdf-lib   |    18.6 | 53.76ms | 54.85ms | ±0.70% |      10 |

- **libpdf** is 3.83x faster than pdf-lib

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |   Mean |    p99 |    RME | Samples |
| :------------------------------ | ------: | -----: | -----: | -----: | ------: |
| copy 1 page                     |   944.6 | 1.06ms | 2.26ms | ±2.94% |     473 |
| copy 10 pages from 100-page PDF |   217.9 | 4.59ms | 7.69ms | ±2.98% |     109 |
| copy all 100 pages              |   137.3 | 7.29ms | 7.99ms | ±0.86% |      69 |

- **copy 1 page** is 4.33x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 6.88x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |  Mean |    p99 |    RME | Samples |
| :---------------------------------------- | ------: | ----: | -----: | -----: | ------: |
| duplicate all pages (double the document) |    1.2K | 837us | 1.22ms | ±0.64% |     598 |
| duplicate page 0                          |    1.2K | 856us | 1.51ms | ±1.06% |     584 |

- **duplicate all pages (double the document)** is 1.02x faster than duplicate page 0

### Merge PDFs

| Benchmark               | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------- | ------: | ------: | ------: | -----: | ------: |
| merge 2 small PDFs      |   718.4 |  1.39ms |  1.99ms | ±0.98% |     360 |
| merge 10 small PDFs     |   135.9 |  7.36ms |  8.17ms | ±0.80% |      68 |
| merge 2 x 100-page PDFs |    75.0 | 13.33ms | 18.83ms | ±2.37% |      38 |

- **merge 2 small PDFs** is 5.29x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 9.57x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------- | ------: | -----: | -----: | -----: | ------: |
| draw 100 lines                      |    2.0K |  501us | 1.08ms | ±1.44% |     998 |
| draw 100 rectangles                 |    1.8K |  567us | 1.30ms | ±2.25% |     883 |
| draw 100 circles                    |   775.5 | 1.29ms | 2.87ms | ±2.91% |     388 |
| create 10 pages with mixed content  |   758.2 | 1.32ms | 2.30ms | ±1.56% |     380 |
| draw 100 text lines (standard font) |   627.2 | 1.59ms | 3.06ms | ±1.82% |     315 |

- **draw 100 lines** is 1.13x faster than draw 100 rectangles
- **draw 100 lines** is 2.57x faster than draw 100 circles
- **draw 100 lines** is 2.63x faster than create 10 pages with mixed content
- **draw 100 lines** is 3.18x faster than draw 100 text lines (standard font)

## Forms

| Benchmark         | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------- | ------: | ------: | ------: | -----: | ------: |
| read field values |   338.7 |  2.95ms |  4.95ms | ±1.60% |     170 |
| get form fields   |   301.2 |  3.32ms |  7.04ms | ±3.84% |     151 |
| flatten form      |   120.0 |  8.34ms | 13.61ms | ±3.57% |      60 |
| fill text fields  |    91.6 | 10.91ms | 15.19ms | ±3.81% |      46 |

- **read field values** is 1.12x faster than get form fields
- **read field values** is 2.82x faster than flatten form
- **read field values** is 3.70x faster than fill text fields

## Loading

| Benchmark              | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------- | ------: | -----: | -----: | -----: | ------: |
| load small PDF (888B)  |   14.2K |   70us |  170us | ±3.89% |   7,100 |
| load medium PDF (19KB) |    9.1K |  110us |  163us | ±4.62% |   4,542 |
| load form PDF (116KB)  |   701.7 | 1.43ms | 2.89ms | ±2.42% |     351 |
| load heavy PDF (9.9MB) |   396.1 | 2.52ms | 3.77ms | ±1.65% |     199 |

- **load small PDF (888B)** is 1.56x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 20.24x faster than load form PDF (116KB)
- **load small PDF (888B)** is 35.85x faster than load heavy PDF (9.9MB)

## Saving

| Benchmark                          | ops/sec |   Mean |     p99 |    RME | Samples |
| :--------------------------------- | ------: | -----: | ------: | -----: | ------: |
| save unmodified (19KB)             |    9.1K |  110us |   275us | ±0.97% |   4,559 |
| incremental save (19KB)            |    5.8K |  171us |   361us | ±1.13% |   2,923 |
| save with modifications (19KB)     |    1.3K |  749us |  1.43ms | ±1.37% |     668 |
| save heavy PDF (9.9MB)             |   394.4 | 2.54ms |  3.87ms | ±1.66% |     198 |
| incremental save heavy PDF (9.9MB) |   167.2 | 5.98ms | 15.47ms | ±8.02% |      84 |

- **save unmodified (19KB)** is 1.56x faster than incremental save (19KB)
- **save unmodified (19KB)** is 6.83x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 23.12x faster than save heavy PDF (9.9MB)
- **save unmodified (19KB)** is 54.52x faster than incremental save heavy PDF (9.9MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |    1.0K |   992us |  2.31ms | ±2.76% |     505 |
| extractPages (1 page from 100-page PDF)  |   275.9 |  3.63ms |  6.00ms | ±2.14% |     138 |
| extractPages (1 page from 2000-page PDF) |    16.9 | 59.24ms | 76.25ms | ±7.25% |      10 |

- **extractPages (1 page from small PDF)** is 3.66x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 59.74x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------------------- | ------: | -------: | -------: | -----: | ------: |
| split 100-page PDF (0.1MB)  |    31.5 |  31.74ms |  37.11ms | ±4.27% |      16 |
| split 2000-page PDF (0.9MB) |     1.7 | 575.07ms | 575.07ms | ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 18.12x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |    Mean |     p99 |    RME | Samples |
| :----------------------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extract first 10 pages from 2000-page PDF              |    17.3 | 57.94ms | 59.39ms | ±1.29% |       9 |
| extract first 100 pages from 2000-page PDF             |    16.2 | 61.88ms | 63.44ms | ±1.09% |       9 |
| extract every 10th page from 2000-page PDF (200 pages) |    14.2 | 70.33ms | 83.08ms | ±7.34% |       8 |

- **extract first 10 pages from 2000-page PDF** is 1.07x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.21x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
