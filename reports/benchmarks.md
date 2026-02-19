# Benchmark Report

> Generated on 2026-02-19 at 04:10:10 UTC
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
| libpdf    |   367.5 |  2.72ms |  3.61ms | ±1.43% |     184 |
| pdf-lib   |    24.1 | 41.49ms | 46.30ms | ±4.08% |      13 |

- **libpdf** is 15.25x faster than pdf-lib

### Create blank PDF

| Benchmark | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------- | ------: | ----: | -----: | -----: | ------: |
| libpdf    |   15.6K |  64us |  141us | ±2.73% |   7,787 |
| pdf-lib   |    2.2K | 450us | 1.70ms | ±2.73% |   1,110 |

- **libpdf** is 7.01x faster than pdf-lib

### Add 10 pages

| Benchmark | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------- | ------: | ----: | -----: | -----: | ------: |
| libpdf    |    9.5K | 105us |  190us | ±1.90% |   4,767 |
| pdf-lib   |    1.8K | 552us | 2.36ms | ±3.40% |     906 |

- **libpdf** is 5.26x faster than pdf-lib

### Draw 50 rectangles

| Benchmark | ops/sec |   Mean |    p99 |    RME | Samples |
| :-------- | ------: | -----: | -----: | -----: | ------: |
| libpdf    |    1.2K |  846us | 2.19ms | ±3.27% |     591 |
| pdf-lib   |   560.7 | 1.78ms | 6.77ms | ±7.15% |     281 |

- **libpdf** is 2.11x faster than pdf-lib

### Load and save PDF

| Benchmark | ops/sec |    Mean |      p99 |    RME | Samples |
| :-------- | ------: | ------: | -------: | -----: | ------: |
| libpdf    |   363.6 |  2.75ms |   4.22ms | ±1.83% |     182 |
| pdf-lib   |    10.5 | 95.13ms | 115.00ms | ±6.54% |      10 |

- **libpdf** is 34.59x faster than pdf-lib

### Load, modify, and save PDF

| Benchmark | ops/sec |    Mean |      p99 |    RME | Samples |
| :-------- | ------: | ------: | -------: | -----: | ------: |
| libpdf    |    14.7 | 68.09ms |  80.54ms | ±7.33% |      10 |
| pdf-lib   |    10.6 | 94.48ms | 105.89ms | ±4.61% |      10 |

- **libpdf** is 1.39x faster than pdf-lib

### Extract single page from 100-page PDF

| Benchmark | ops/sec |   Mean |     p99 |    RME | Samples |
| :-------- | ------: | -----: | ------: | -----: | ------: |
| libpdf    |   243.2 | 4.11ms |  5.00ms | ±1.14% |     122 |
| pdf-lib   |   100.8 | 9.92ms | 12.30ms | ±2.98% |      51 |

- **libpdf** is 2.41x faster than pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark | ops/sec |    Mean |      p99 |    RME | Samples |
| :-------- | ------: | ------: | -------: | -----: | ------: |
| libpdf    |    26.8 | 37.29ms |  41.60ms | ±2.66% |      14 |
| pdf-lib   |    10.6 | 94.76ms | 100.33ms | ±3.69% |       6 |

- **libpdf** is 2.54x faster than pdf-lib

### Split 2000-page PDF into single-page PDFs (0.9MB)

| Benchmark | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------- | ------: | -------: | -------: | -----: | ------: |
| libpdf    |     1.4 | 705.67ms | 705.67ms | ±0.00% |       1 |
| pdf-lib   |   0.565 |    1.77s |    1.77s | ±0.00% |       1 |

- **libpdf** is 2.51x faster than pdf-lib

### Copy 10 pages between documents

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |   189.4 |  5.28ms |  7.08ms | ±1.68% |      95 |
| pdf-lib   |    73.9 | 13.54ms | 16.38ms | ±2.21% |      37 |

- **libpdf** is 2.56x faster than pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |    56.2 | 17.79ms | 19.26ms | ±1.78% |      29 |
| pdf-lib   |    16.9 | 59.17ms | 60.49ms | ±0.75% |       9 |

- **libpdf** is 3.33x faster than pdf-lib

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |   Mean |     p99 |    RME | Samples |
| :------------------------------ | ------: | -----: | ------: | -----: | ------: |
| copy 1 page                     |   894.6 | 1.12ms |  2.26ms | ±2.78% |     448 |
| copy 10 pages from 100-page PDF |   196.8 | 5.08ms |  9.52ms | ±2.89% |      99 |
| copy all 100 pages              |   123.0 | 8.13ms | 10.04ms | ±1.34% |      62 |

- **copy 1 page** is 4.55x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 7.27x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |  Mean |    p99 |    RME | Samples |
| :---------------------------------------- | ------: | ----: | -----: | -----: | ------: |
| duplicate all pages (double the document) |    1.1K | 928us | 1.74ms | ±1.23% |     539 |
| duplicate page 0                          |    1.1K | 937us | 1.60ms | ±1.26% |     534 |

- **duplicate all pages (double the document)** is 1.01x faster than duplicate page 0

### Merge PDFs

| Benchmark               | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------- | ------: | ------: | ------: | -----: | ------: |
| merge 2 small PDFs      |   650.7 |  1.54ms |  2.36ms | ±1.34% |     326 |
| merge 10 small PDFs     |   117.5 |  8.51ms |  9.70ms | ±1.13% |      59 |
| merge 2 x 100-page PDFs |    62.7 | 15.96ms | 19.06ms | ±1.91% |      32 |

- **merge 2 small PDFs** is 5.54x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 10.39x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------- | ------: | -----: | -----: | -----: | ------: |
| draw 100 lines                      |   726.0 | 1.38ms | 3.16ms | ±3.55% |     364 |
| draw 100 rectangles                 |   557.2 | 1.79ms | 4.79ms | ±5.54% |     279 |
| create 10 pages with mixed content  |   251.9 | 3.97ms | 6.80ms | ±5.05% |     126 |
| draw 100 text lines (standard font) |   249.8 | 4.00ms | 7.11ms | ±5.45% |     125 |
| draw 100 circles                    |   228.0 | 4.39ms | 7.86ms | ±5.49% |     115 |

- **draw 100 lines** is 1.30x faster than draw 100 rectangles
- **draw 100 lines** is 2.88x faster than create 10 pages with mixed content
- **draw 100 lines** is 2.91x faster than draw 100 text lines (standard font)
- **draw 100 lines** is 3.18x faster than draw 100 circles

## Forms

| Benchmark         | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------- | ------: | ------: | ------: | -----: | ------: |
| read field values |   297.0 |  3.37ms |  5.98ms | ±2.08% |     149 |
| get form fields   |   249.0 |  4.02ms |  7.98ms | ±4.23% |     125 |
| flatten form      |   101.6 |  9.84ms | 13.56ms | ±2.44% |      52 |
| fill text fields  |    72.7 | 13.75ms | 24.47ms | ±5.55% |      37 |

- **read field values** is 1.19x faster than get form fields
- **read field values** is 2.92x faster than flatten form
- **read field values** is 4.08x faster than fill text fields

## Loading

| Benchmark              | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------- | ------: | -----: | -----: | -----: | ------: |
| load small PDF (888B)  |   12.0K |   83us |  191us | ±4.16% |   5,999 |
| load medium PDF (19KB) |    8.1K |  123us |  221us | ±5.18% |   4,079 |
| load form PDF (116KB)  |   607.5 | 1.65ms | 3.58ms | ±3.37% |     304 |
| load heavy PDF (9.9MB) |   386.3 | 2.59ms | 4.89ms | ±2.57% |     194 |

- **load small PDF (888B)** is 1.48x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 19.75x faster than load form PDF (116KB)
- **load small PDF (888B)** is 31.05x faster than load heavy PDF (9.9MB)

## Saving

| Benchmark                          | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------------------- | ------: | -----: | -----: | -----: | ------: |
| save unmodified (19KB)             |    8.0K |  124us |  296us | ±1.27% |   4,021 |
| incremental save (19KB)            |    4.8K |  207us |  451us | ±1.37% |   2,416 |
| save with modifications (19KB)     |    1.2K |  817us | 1.52ms | ±1.40% |     613 |
| save heavy PDF (9.9MB)             |   413.0 | 2.42ms | 3.05ms | ±1.07% |     207 |
| incremental save heavy PDF (9.9MB) |   122.1 | 8.19ms | 9.91ms | ±1.59% |      62 |

- **save unmodified (19KB)** is 1.66x faster than incremental save (19KB)
- **save unmodified (19KB)** is 6.57x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 19.47x faster than save heavy PDF (9.9MB)
- **save unmodified (19KB)** is 65.85x faster than incremental save heavy PDF (9.9MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |   886.7 |  1.13ms |  2.30ms | ±2.46% |     444 |
| extractPages (1 page from 100-page PDF)  |   236.3 |  4.23ms |  7.44ms | ±2.66% |     119 |
| extractPages (1 page from 2000-page PDF) |    13.8 | 72.48ms | 82.95ms | ±5.76% |      10 |

- **extractPages (1 page from small PDF)** is 3.75x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 64.27x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------------------- | ------: | -------: | -------: | -----: | ------: |
| split 100-page PDF (0.1MB)  |    27.4 |  36.52ms |  45.33ms | ±6.29% |      14 |
| split 2000-page PDF (0.9MB) |     1.5 | 673.39ms | 673.39ms | ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 18.44x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |    Mean |     p99 |    RME | Samples |
| :----------------------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extract first 10 pages from 2000-page PDF              |    14.7 | 67.81ms | 71.38ms | ±2.48% |       8 |
| extract first 100 pages from 2000-page PDF             |    13.4 | 74.52ms | 77.97ms | ±2.46% |       7 |
| extract every 10th page from 2000-page PDF (200 pages) |    12.2 | 81.80ms | 95.56ms | ±7.22% |       7 |

- **extract first 10 pages from 2000-page PDF** is 1.10x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.21x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
