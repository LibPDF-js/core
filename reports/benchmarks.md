# Benchmark Report

> Generated on 2026-02-16 at 21:19:11 UTC
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
| libpdf    |   362.6 |  2.76ms |  3.88ms | ±1.62% |     182 |
| pdf-lib   |    25.0 | 39.95ms | 44.72ms | ±3.76% |      13 |

- **libpdf** is 14.48x faster than pdf-lib

### Create blank PDF

| Benchmark | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------- | ------: | ----: | -----: | -----: | ------: |
| libpdf    |   10.7K |  94us |  184us | ±2.96% |   5,333 |
| pdf-lib   |    2.3K | 437us | 1.65ms | ±2.65% |   1,143 |

- **libpdf** is 4.67x faster than pdf-lib

### Add 10 pages

| Benchmark | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------- | ------: | ----: | -----: | -----: | ------: |
| libpdf    |    5.7K | 174us |  653us | ±1.83% |   2,867 |
| pdf-lib   |    1.9K | 540us | 2.13ms | ±3.10% |     926 |

- **libpdf** is 3.10x faster than pdf-lib

### Draw 50 rectangles

| Benchmark | ops/sec |   Mean |    p99 |    RME | Samples |
| :-------- | ------: | -----: | -----: | -----: | ------: |
| pdf-lib   |   474.2 | 2.11ms | 7.63ms | ±9.71% |     238 |
| libpdf    |   156.7 | 6.38ms | 8.63ms | ±2.56% |      79 |

- **pdf-lib** is 3.03x faster than libpdf

### Load and save PDF

| Benchmark | ops/sec |    Mean |      p99 |    RME | Samples |
| :-------- | ------: | ------: | -------: | -----: | ------: |
| libpdf    |   339.6 |  2.94ms |   5.18ms | ±3.06% |     171 |
| pdf-lib   |    10.8 | 92.96ms | 109.93ms | ±5.74% |      10 |

- **libpdf** is 31.57x faster than pdf-lib

### Load, modify, and save PDF

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |    13.5 | 73.86ms | 88.68ms | ±8.49% |      10 |
| pdf-lib   |    11.5 | 87.10ms | 93.25ms | ±3.21% |      10 |

- **libpdf** is 1.18x faster than pdf-lib

### Extract single page from 100-page PDF

| Benchmark | ops/sec |   Mean |     p99 |    RME | Samples |
| :-------- | ------: | -----: | ------: | -----: | ------: |
| libpdf    |   183.8 | 5.44ms |  8.10ms | ±2.45% |      92 |
| pdf-lib   |   104.3 | 9.58ms | 11.64ms | ±1.78% |      53 |

- **libpdf** is 1.76x faster than pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark | ops/sec |    Mean |      p99 |    RME | Samples |
| :-------- | ------: | ------: | -------: | -----: | ------: |
| pdf-lib   |    11.1 | 90.04ms |  95.21ms | ±5.07% |       6 |
| libpdf    |    10.7 | 93.65ms | 104.73ms | ±9.17% |       6 |

- **pdf-lib** is 1.04x faster than libpdf

### Split 2000-page PDF into single-page PDFs (0.9MB)

| Benchmark | ops/sec |  Mean |   p99 |    RME | Samples |
| :-------- | ------: | ----: | ----: | -----: | ------: |
| libpdf    |   0.627 | 1.60s | 1.60s | ±0.00% |       1 |
| pdf-lib   |   0.585 | 1.71s | 1.71s | ±0.00% |       1 |

- **libpdf** is 1.07x faster than pdf-lib

### Copy 10 pages between documents

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |   103.7 |  9.64ms | 14.56ms | ±3.04% |      52 |
| pdf-lib   |    78.9 | 12.67ms | 14.16ms | ±1.65% |      40 |

- **libpdf** is 1.31x faster than pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| pdf-lib   |    17.9 | 55.88ms | 58.47ms | ±1.91% |       9 |
| libpdf    |    12.6 | 79.05ms | 79.54ms | ±0.45% |       7 |

- **pdf-lib** is 1.41x faster than libpdf

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |    Mean |     p99 |    RME | Samples |
| :------------------------------ | ------: | ------: | ------: | -----: | ------: |
| copy 1 page                     |   731.3 |  1.37ms |  2.63ms | ±3.01% |     366 |
| copy 10 pages from 100-page PDF |   113.0 |  8.85ms | 12.36ms | ±2.59% |      57 |
| copy all 100 pages              |    25.7 | 38.97ms | 41.36ms | ±1.41% |      13 |

- **copy 1 page** is 6.47x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 28.50x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------------- | ------: | -----: | -----: | -----: | ------: |
| duplicate page 0                          |   779.3 | 1.28ms | 2.49ms | ±2.00% |     390 |
| duplicate all pages (double the document) |   778.8 | 1.28ms | 2.48ms | ±2.14% |     390 |

- **duplicate page 0** is 1.00x faster than duplicate all pages (double the document)

### Merge PDFs

| Benchmark               | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------- | ------: | ------: | ------: | -----: | ------: |
| merge 2 small PDFs      |   511.1 |  1.96ms |  3.22ms | ±1.91% |     256 |
| merge 10 small PDFs     |    93.4 | 10.71ms | 14.59ms | ±2.26% |      47 |
| merge 2 x 100-page PDFs |    13.0 | 77.00ms | 82.43ms | ±3.35% |       7 |

- **merge 2 small PDFs** is 5.47x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 39.35x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------------------- | ------: | ------: | ------: | -----: | ------: |
| draw 100 lines                      |    91.8 | 10.89ms | 13.01ms | ±1.41% |      46 |
| draw 100 rectangles                 |    79.3 | 12.61ms | 16.38ms | ±3.74% |      40 |
| draw 100 circles                    |    69.0 | 14.50ms | 18.01ms | ±2.25% |      35 |
| draw 100 text lines (standard font) |    64.9 | 15.41ms | 20.87ms | ±3.54% |      33 |
| create 10 pages with mixed content  |    46.8 | 21.39ms | 22.42ms | ±1.20% |      24 |

- **draw 100 lines** is 1.16x faster than draw 100 rectangles
- **draw 100 lines** is 1.33x faster than draw 100 circles
- **draw 100 lines** is 1.41x faster than draw 100 text lines (standard font)
- **draw 100 lines** is 1.96x faster than create 10 pages with mixed content

## Forms

| Benchmark         | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------- | ------: | ------: | ------: | -----: | ------: |
| read field values |   286.0 |  3.50ms |  6.12ms | ±2.24% |     143 |
| get form fields   |   247.2 |  4.05ms |  9.66ms | ±5.08% |     124 |
| flatten form      |    74.3 | 13.46ms | 17.19ms | ±2.79% |      38 |
| fill text fields  |    55.3 | 18.07ms | 24.87ms | ±3.84% |      28 |

- **read field values** is 1.16x faster than get form fields
- **read field values** is 3.85x faster than flatten form
- **read field values** is 5.17x faster than fill text fields

## Loading

| Benchmark              | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------- | ------: | -----: | -----: | -----: | ------: |
| load small PDF (888B)  |   14.7K |   68us |  139us | ±1.61% |   7,359 |
| load medium PDF (19KB) |    9.7K |  103us |  197us | ±1.32% |   4,852 |
| load form PDF (116KB)  |   661.3 | 1.51ms | 2.71ms | ±2.06% |     331 |
| load heavy PDF (9.9MB) |   417.6 | 2.39ms | 3.61ms | ±1.55% |     209 |

- **load small PDF (888B)** is 1.52x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 22.25x faster than load form PDF (116KB)
- **load small PDF (888B)** is 35.24x faster than load heavy PDF (9.9MB)

## Saving

| Benchmark                          | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------------------- | ------: | -----: | -----: | -----: | ------: |
| save unmodified (19KB)             |    7.9K |  126us |  321us | ±1.64% |   3,956 |
| incremental save (19KB)            |    1.9K |  527us | 1.06ms | ±1.51% |     948 |
| save with modifications (19KB)     |   762.8 | 1.31ms | 2.72ms | ±2.37% |     382 |
| save heavy PDF (9.9MB)             |   413.5 | 2.42ms | 3.13ms | ±1.12% |     207 |
| incremental save heavy PDF (9.9MB) |   137.6 | 7.26ms | 7.58ms | ±0.44% |      69 |

- **save unmodified (19KB)** is 4.17x faster than incremental save (19KB)
- **save unmodified (19KB)** is 10.37x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 19.13x faster than save heavy PDF (9.9MB)
- **save unmodified (19KB)** is 57.48x faster than incremental save heavy PDF (9.9MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |   753.5 |  1.33ms |  2.47ms | ±2.83% |     377 |
| extractPages (1 page from 100-page PDF)  |   197.6 |  5.06ms |  9.10ms | ±3.08% |      99 |
| extractPages (1 page from 2000-page PDF) |    13.1 | 76.08ms | 78.10ms | ±1.22% |      10 |

- **extractPages (1 page from small PDF)** is 3.81x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 57.32x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |    Mean |      p99 |    RME | Samples |
| :-------------------------- | ------: | ------: | -------: | -----: | ------: |
| split 100-page PDF (0.1MB)  |    10.9 | 91.83ms | 102.50ms | ±6.62% |       6 |
| split 2000-page PDF (0.9MB) |   0.650 |   1.54s |    1.54s | ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 16.76x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |     Mean |      p99 |    RME | Samples |
| :----------------------------------------------------- | ------: | -------: | -------: | -----: | ------: |
| extract first 10 pages from 2000-page PDF              |    12.2 |  81.95ms |  91.73ms | ±4.95% |       7 |
| extract first 100 pages from 2000-page PDF             |     9.2 | 109.19ms | 110.20ms | ±1.20% |       5 |
| extract every 10th page from 2000-page PDF (200 pages) |     8.0 | 125.67ms | 127.43ms | ±1.82% |       4 |

- **extract first 10 pages from 2000-page PDF** is 1.33x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.53x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
