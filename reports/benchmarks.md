# Benchmark Report

> Generated on 2026-04-20 at 08:05:56 UTC
>
> System: linux | AMD EPYC 7763 64-Core Processor (4 cores) | 16GB RAM | Bun 1.3.12

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
| libpdf          |   423.6 |  2.36ms |  3.62ms | ±1.72% |     212 |
| @cantoo/pdf-lib |    25.1 | 39.81ms | 45.77ms | ±3.39% |      13 |
| pdf-lib         |    24.8 | 40.35ms | 46.92ms | ±4.53% |      13 |

- **libpdf** is 16.86x faster than @cantoo/pdf-lib
- **libpdf** is 17.09x faster than pdf-lib

### Create blank PDF

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |   17.2K |  58us |  121us | ±1.41% |   8,600 |
| pdf-lib         |    2.3K | 439us | 1.50ms | ±3.67% |   1,138 |
| @cantoo/pdf-lib |    2.2K | 453us | 1.68ms | ±2.79% |   1,103 |

- **libpdf** is 7.56x faster than pdf-lib
- **libpdf** is 7.80x faster than @cantoo/pdf-lib

### Add 10 pages

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |   10.2K |  98us |  161us | ±1.00% |   5,080 |
| @cantoo/pdf-lib |    2.0K | 513us | 2.36ms | ±3.40% |     976 |
| pdf-lib         |    1.9K | 531us | 1.98ms | ±2.94% |     943 |

- **libpdf** is 5.21x faster than @cantoo/pdf-lib
- **libpdf** is 5.40x faster than pdf-lib

### Draw 50 rectangles

| Benchmark       | ops/sec |   Mean |    p99 |    RME | Samples |
| :-------------- | ------: | -----: | -----: | -----: | ------: |
| libpdf          |    3.2K |  316us |  910us | ±1.51% |   1,582 |
| pdf-lib         |   545.7 | 1.83ms | 6.77ms | ±6.87% |     273 |
| @cantoo/pdf-lib |   453.1 | 2.21ms | 8.23ms | ±7.65% |     228 |

- **libpdf** is 5.80x faster than pdf-lib
- **libpdf** is 6.98x faster than @cantoo/pdf-lib

### Load and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |   423.3 |   2.36ms |   3.31ms | ±1.38% |     212 |
| pdf-lib         |    11.2 |  88.95ms |  97.68ms | ±4.73% |      10 |
| @cantoo/pdf-lib |     6.4 | 157.41ms | 168.28ms | ±2.33% |      10 |

- **libpdf** is 37.65x faster than pdf-lib
- **libpdf** is 66.63x faster than @cantoo/pdf-lib

### Load, modify, and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |    23.7 |  42.22ms |  55.66ms | ±6.42% |      12 |
| pdf-lib         |    11.3 |  88.44ms | 100.22ms | ±5.13% |      10 |
| @cantoo/pdf-lib |     6.5 | 155.01ms | 165.25ms | ±1.80% |      10 |

- **libpdf** is 2.09x faster than pdf-lib
- **libpdf** is 3.67x faster than @cantoo/pdf-lib

### Extract single page from 100-page PDF

| Benchmark       | ops/sec |   Mean |     p99 |    RME | Samples |
| :-------------- | ------: | -----: | ------: | -----: | ------: |
| libpdf          |   268.4 | 3.73ms |  7.67ms | ±2.53% |     135 |
| pdf-lib         |   104.9 | 9.53ms | 12.94ms | ±2.80% |      53 |
| @cantoo/pdf-lib |   100.1 | 9.99ms | 12.55ms | ±2.90% |      51 |

- **libpdf** is 2.56x faster than pdf-lib
- **libpdf** is 2.68x faster than @cantoo/pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark       | ops/sec |    Mean |      p99 |    RME | Samples |
| :-------------- | ------: | ------: | -------: | -----: | ------: |
| libpdf          |    29.9 | 33.41ms |  39.00ms | ±2.92% |      15 |
| pdf-lib         |    11.2 | 89.16ms |  92.44ms | ±2.91% |       6 |
| @cantoo/pdf-lib |    10.2 | 97.94ms | 110.69ms | ±7.52% |       6 |

- **libpdf** is 2.67x faster than pdf-lib
- **libpdf** is 2.93x faster than @cantoo/pdf-lib

### Split 2000-page PDF into single-page PDFs (0.9MB)

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |     1.6 | 616.58ms | 616.58ms | ±0.00% |       1 |
| pdf-lib         |   0.610 |    1.64s |    1.64s | ±0.00% |       1 |
| @cantoo/pdf-lib |   0.591 |    1.69s |    1.69s | ±0.00% |       1 |

- **libpdf** is 2.66x faster than pdf-lib
- **libpdf** is 2.75x faster than @cantoo/pdf-lib

### Copy 10 pages between documents

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |   221.2 |  4.52ms |  5.35ms | ±1.08% |     111 |
| pdf-lib         |    78.4 | 12.76ms | 15.27ms | ±2.85% |      40 |
| @cantoo/pdf-lib |    72.0 | 13.88ms | 15.64ms | ±2.07% |      37 |

- **libpdf** is 2.82x faster than pdf-lib
- **libpdf** is 3.07x faster than @cantoo/pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    69.5 | 14.38ms | 20.63ms | ±2.81% |      35 |
| pdf-lib         |    17.6 | 56.67ms | 73.82ms | ±8.84% |       9 |
| @cantoo/pdf-lib |    15.5 | 64.41ms | 67.49ms | ±2.56% |       8 |

- **libpdf** is 3.94x faster than pdf-lib
- **libpdf** is 4.48x faster than @cantoo/pdf-lib

### Fill FINTRAC form fields

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    45.8 | 21.83ms | 37.25ms | ±8.42% |      23 |
| @cantoo/pdf-lib |    28.5 | 35.05ms | 46.77ms | ±5.77% |      15 |
| pdf-lib         |    28.3 | 35.32ms | 51.36ms | ±7.63% |      15 |

- **libpdf** is 1.61x faster than @cantoo/pdf-lib
- **libpdf** is 1.62x faster than pdf-lib

### Fill and flatten FINTRAC form

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    49.3 | 20.30ms | 34.08ms | ±7.34% |      25 |
| pdf-lib         |  FAILED |       - |       - |      - |       0 |
| @cantoo/pdf-lib |    24.3 | 41.18ms | 54.47ms | ±7.10% |      13 |

- **libpdf** is 2.03x faster than @cantoo/pdf-lib

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |   Mean |     p99 |    RME | Samples |
| :------------------------------ | ------: | -----: | ------: | -----: | ------: |
| copy 1 page                     |   980.8 | 1.02ms |  2.50ms | ±4.02% |     491 |
| copy 10 pages from 100-page PDF |   228.9 | 4.37ms |  5.14ms | ±0.96% |     115 |
| copy all 100 pages              |   134.4 | 7.44ms | 10.35ms | ±1.93% |      68 |

- **copy 1 page** is 4.28x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 7.30x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |  Mean |    p99 |    RME | Samples |
| :---------------------------------------- | ------: | ----: | -----: | -----: | ------: |
| duplicate all pages (double the document) |    1.2K | 866us | 1.44ms | ±1.03% |     578 |
| duplicate page 0                          |    1.1K | 883us | 1.61ms | ±1.33% |     567 |

- **duplicate all pages (double the document)** is 1.02x faster than duplicate page 0

### Merge PDFs

| Benchmark               | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------- | ------: | ------: | ------: | -----: | ------: |
| merge 2 small PDFs      |   700.4 |  1.43ms |  2.64ms | ±1.34% |     351 |
| merge 10 small PDFs     |   132.5 |  7.55ms |  9.45ms | ±1.20% |      67 |
| merge 2 x 100-page PDFs |    74.2 | 13.48ms | 16.33ms | ±1.42% |      38 |

- **merge 2 small PDFs** is 5.29x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 9.44x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------- | ------: | -----: | -----: | -----: | ------: |
| draw 100 lines                      |    1.9K |  528us | 1.33ms | ±1.72% |     948 |
| draw 100 rectangles                 |    1.7K |  586us | 1.54ms | ±2.65% |     854 |
| draw 100 circles                    |   746.2 | 1.34ms | 3.24ms | ±2.96% |     374 |
| create 10 pages with mixed content  |   731.7 | 1.37ms | 2.51ms | ±1.93% |     366 |
| draw 100 text lines (standard font) |   628.8 | 1.59ms | 2.61ms | ±1.66% |     315 |

- **draw 100 lines** is 1.11x faster than draw 100 rectangles
- **draw 100 lines** is 2.54x faster than draw 100 circles
- **draw 100 lines** is 2.59x faster than create 10 pages with mixed content
- **draw 100 lines** is 3.01x faster than draw 100 text lines (standard font)

## Forms

| Benchmark         | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------- | ------: | ------: | ------: | -----: | ------: |
| read field values |   332.8 |  3.00ms |  3.61ms | ±1.02% |     167 |
| get form fields   |   295.7 |  3.38ms |  5.67ms | ±3.09% |     148 |
| flatten form      |   115.1 |  8.69ms | 12.76ms | ±3.52% |      58 |
| fill text fields  |    80.6 | 12.41ms | 16.93ms | ±4.66% |      41 |

- **read field values** is 1.13x faster than get form fields
- **read field values** is 2.89x faster than flatten form
- **read field values** is 4.13x faster than fill text fields

## Loading

| Benchmark              | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------- | ------: | -----: | -----: | -----: | ------: |
| load small PDF (888B)  |   16.9K |   59us |  145us | ±0.81% |   8,429 |
| load medium PDF (19KB) |   11.1K |   90us |  125us | ±0.60% |   5,527 |
| load form PDF (116KB)  |   721.2 | 1.39ms | 2.05ms | ±1.15% |     361 |
| load heavy PDF (9.9MB) |   445.5 | 2.24ms | 2.73ms | ±0.64% |     223 |

- **load small PDF (888B)** is 1.53x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 23.37x faster than load form PDF (116KB)
- **load small PDF (888B)** is 37.84x faster than load heavy PDF (9.9MB)

## Saving

| Benchmark                          | ops/sec |   Mean |     p99 |    RME | Samples |
| :--------------------------------- | ------: | -----: | ------: | -----: | ------: |
| save unmodified (19KB)             |    9.5K |  106us |   230us | ±1.04% |   4,739 |
| incremental save (19KB)            |    6.2K |  162us |   349us | ±1.08% |   3,084 |
| save with modifications (19KB)     |    1.3K |  748us |  1.47ms | ±1.30% |     669 |
| save heavy PDF (9.9MB)             |   442.9 | 2.26ms |  2.81ms | ±1.11% |     222 |
| incremental save heavy PDF (9.9MB) |   193.8 | 5.16ms | 13.79ms | ±6.85% |      97 |

- **save unmodified (19KB)** is 1.54x faster than incremental save (19KB)
- **save unmodified (19KB)** is 7.08x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 21.40x faster than save heavy PDF (9.9MB)
- **save unmodified (19KB)** is 48.89x faster than incremental save heavy PDF (9.9MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |    1.0K |   992us |  2.05ms | ±2.82% |     505 |
| extractPages (1 page from 100-page PDF)  |   281.0 |  3.56ms |  5.04ms | ±1.49% |     141 |
| extractPages (1 page from 2000-page PDF) |    17.6 | 56.72ms | 58.30ms | ±0.89% |      10 |

- **extractPages (1 page from small PDF)** is 3.59x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 57.21x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------------------- | ------: | -------: | -------: | -----: | ------: |
| split 100-page PDF (0.1MB)  |    31.0 |  32.30ms |  37.41ms | ±3.67% |      16 |
| split 2000-page PDF (0.9MB) |     1.7 | 599.11ms | 599.11ms | ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 18.55x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |    Mean |     p99 |    RME | Samples |
| :----------------------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extract first 10 pages from 2000-page PDF              |    17.3 | 57.74ms | 59.38ms | ±1.14% |       9 |
| extract first 100 pages from 2000-page PDF             |    16.4 | 61.02ms | 62.44ms | ±1.33% |       9 |
| extract every 10th page from 2000-page PDF (200 pages) |    15.2 | 65.66ms | 66.84ms | ±1.05% |       8 |

- **extract first 10 pages from 2000-page PDF** is 1.06x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.14x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
