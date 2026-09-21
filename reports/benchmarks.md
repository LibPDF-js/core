# Benchmark Report

> Generated on 2026-09-21 at 12:03:00 UTC
>
> System: linux | INTEL(R) XEON(R) PLATINUM 8573C (4 cores) | 16GB RAM | Bun 1.4.2
>
> Libraries: @libpdf/core 0.4.2 (this repo), pdf-lib 1.17.1, @cantoo/pdf-lib 2.9.1

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

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |    68.5 |  14.60ms |  17.11ms | ±1.88% |      35 |
| @cantoo/pdf-lib |     5.3 | 189.06ms | 192.58ms | ±0.91% |      10 |
| pdf-lib         |     5.1 | 195.58ms | 202.26ms | ±1.34% |      10 |

- **libpdf** is 12.95x faster than @cantoo/pdf-lib
- **libpdf** is 13.39x faster than pdf-lib

### Create blank PDF

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |   19.7K |  51us |  101us | ±2.29% |   9,851 |
| pdf-lib         |    4.6K | 219us | 1.12ms | ±3.20% |   2,283 |
| @cantoo/pdf-lib |    4.4K | 227us | 1.08ms | ±2.76% |   2,206 |

- **libpdf** is 4.32x faster than pdf-lib
- **libpdf** is 4.47x faster than @cantoo/pdf-lib

### Add 10 pages

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |   11.9K |  84us |  158us | ±0.87% |   5,947 |
| @cantoo/pdf-lib |    3.4K | 295us | 1.77ms | ±3.73% |   1,694 |
| pdf-lib         |    3.1K | 318us | 1.41ms | ±2.90% |   1,571 |

- **libpdf** is 3.51x faster than @cantoo/pdf-lib
- **libpdf** is 3.79x faster than pdf-lib

### Draw 50 rectangles

| Benchmark       | ops/sec |   Mean |    p99 |    RME | Samples |
| :-------------- | ------: | -----: | -----: | -----: | ------: |
| libpdf          |    3.9K |  257us |  643us | ±1.36% |   1,948 |
| pdf-lib         |   870.6 | 1.15ms | 5.74ms | ±7.16% |     437 |
| @cantoo/pdf-lib |   729.2 | 1.37ms | 4.60ms | ±5.99% |     365 |

- **libpdf** is 4.47x faster than pdf-lib
- **libpdf** is 5.34x faster than @cantoo/pdf-lib

### Load and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |    68.2 |  14.66ms |  20.64ms | ±3.27% |      35 |
| pdf-lib         |     3.6 | 280.01ms | 301.38ms | ±2.07% |      10 |
| @cantoo/pdf-lib |     2.2 | 458.03ms | 478.95ms | ±2.20% |      10 |

- **libpdf** is 19.10x faster than pdf-lib
- **libpdf** is 31.25x faster than @cantoo/pdf-lib

### Load, modify, and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |     3.7 | 267.22ms | 281.62ms | ±1.85% |      10 |
| pdf-lib         |     3.7 | 271.82ms | 290.14ms | ±2.06% |      10 |
| @cantoo/pdf-lib |     2.2 | 458.90ms | 477.05ms | ±2.10% |      10 |

- **libpdf** is 1.02x faster than pdf-lib
- **libpdf** is 1.72x faster than @cantoo/pdf-lib

### Extract single page from 100-page PDF

| Benchmark       | ops/sec |   Mean |     p99 |    RME | Samples |
| :-------------- | ------: | -----: | ------: | -----: | ------: |
| libpdf          |   373.6 | 2.68ms |  3.36ms | ±0.95% |     187 |
| pdf-lib         |   126.6 | 7.90ms | 10.18ms | ±1.88% |      64 |
| @cantoo/pdf-lib |   123.4 | 8.10ms | 10.54ms | ±1.80% |      62 |

- **libpdf** is 2.95x faster than pdf-lib
- **libpdf** is 3.03x faster than @cantoo/pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    35.8 | 27.97ms | 33.59ms | ±3.55% |      18 |
| pdf-lib         |    17.3 | 57.88ms | 72.94ms | ±7.76% |       9 |
| @cantoo/pdf-lib |    17.0 | 58.75ms | 68.49ms | ±5.67% |       9 |

- **libpdf** is 2.07x faster than pdf-lib
- **libpdf** is 2.10x faster than @cantoo/pdf-lib

### Split 2000-page PDF into single-page PDFs (0.9MB)

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |     1.9 | 518.96ms | 518.96ms | ±0.00% |       1 |
| pdf-lib         |   0.949 |    1.05s |    1.05s | ±0.00% |       1 |
| @cantoo/pdf-lib |   0.908 |    1.10s |    1.10s | ±0.00% |       1 |

- **libpdf** is 2.03x faster than pdf-lib
- **libpdf** is 2.12x faster than @cantoo/pdf-lib

### Copy 10 pages between documents

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |   294.5 |  3.40ms |  4.29ms | ±1.30% |     148 |
| pdf-lib         |    96.4 | 10.37ms | 12.68ms | ±1.48% |      49 |
| @cantoo/pdf-lib |    83.9 | 11.91ms | 15.18ms | ±2.19% |      42 |

- **libpdf** is 3.05x faster than pdf-lib
- **libpdf** is 3.51x faster than @cantoo/pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    90.8 | 11.02ms | 11.77ms | ±1.06% |      46 |
| pdf-lib         |    21.5 | 46.50ms | 47.45ms | ±0.68% |      11 |
| @cantoo/pdf-lib |    17.5 | 57.01ms | 58.03ms | ±1.05% |       9 |

- **libpdf** is 4.22x faster than pdf-lib
- **libpdf** is 5.18x faster than @cantoo/pdf-lib

### Fill FINTRAC form fields

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    67.0 | 14.94ms | 18.27ms | ±2.75% |      34 |
| pdf-lib         |    43.6 | 22.95ms | 32.13ms | ±4.74% |      22 |
| @cantoo/pdf-lib |    41.9 | 23.85ms | 30.98ms | ±3.96% |      21 |

- **libpdf** is 1.54x faster than pdf-lib
- **libpdf** is 1.60x faster than @cantoo/pdf-lib

### Fill and flatten FINTRAC form

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    73.9 | 13.53ms | 17.08ms | ±3.16% |      37 |
| pdf-lib         |  FAILED |       - |       - |      - |       0 |
| @cantoo/pdf-lib |    38.8 | 25.77ms | 42.76ms | ±7.77% |      20 |

- **libpdf** is 1.90x faster than @cantoo/pdf-lib

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |   Mean |    p99 |    RME | Samples |
| :------------------------------ | ------: | -----: | -----: | -----: | ------: |
| copy 1 page                     |    1.4K |  736us | 1.44ms | ±1.90% |     680 |
| copy 10 pages from 100-page PDF |   314.6 | 3.18ms | 5.05ms | ±1.63% |     158 |
| copy all 100 pages              |   182.1 | 5.49ms | 6.48ms | ±1.21% |      92 |

- **copy 1 page** is 4.32x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 7.46x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |  Mean |    p99 |    RME | Samples |
| :---------------------------------------- | ------: | ----: | -----: | -----: | ------: |
| duplicate page 0                          |    1.5K | 682us | 1.04ms | ±0.90% |     733 |
| duplicate all pages (double the document) |    1.4K | 691us | 1.10ms | ±0.89% |     724 |

- **duplicate page 0** is 1.01x faster than duplicate all pages (double the document)

### Merge PDFs

| Benchmark               | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------- | ------: | ------: | ------: | -----: | ------: |
| merge 2 small PDFs      |   930.6 |  1.07ms |  2.02ms | ±1.43% |     466 |
| merge 10 small PDFs     |   182.2 |  5.49ms |  6.35ms | ±1.20% |      92 |
| merge 2 x 100-page PDFs |    95.5 | 10.47ms | 11.94ms | ±1.59% |      48 |

- **merge 2 small PDFs** is 5.11x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 9.75x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------- | ------: | -----: | -----: | -----: | ------: |
| draw 100 lines                      |    2.5K |  396us |  857us | ±1.41% |   1,264 |
| draw 100 rectangles                 |    2.2K |  449us | 1.03ms | ±1.83% |   1,114 |
| draw 100 circles                    |    1.4K |  705us | 1.48ms | ±1.76% |     709 |
| create 10 pages with mixed content  |   907.4 | 1.10ms | 1.92ms | ±1.66% |     454 |
| draw 100 text lines (standard font) |   791.7 | 1.26ms | 2.21ms | ±1.68% |     396 |

- **draw 100 lines** is 1.13x faster than draw 100 rectangles
- **draw 100 lines** is 1.78x faster than draw 100 circles
- **draw 100 lines** is 2.78x faster than create 10 pages with mixed content
- **draw 100 lines** is 3.19x faster than draw 100 text lines (standard font)

## Forms

| Benchmark         | ops/sec |   Mean |     p99 |    RME | Samples |
| :---------------- | ------: | -----: | ------: | -----: | ------: |
| read field values |   453.2 | 2.21ms |  3.70ms | ±1.66% |     227 |
| get form fields   |   422.3 | 2.37ms |  4.29ms | ±2.29% |     212 |
| flatten form      |   156.1 | 6.41ms | 15.30ms | ±4.06% |      79 |
| fill text fields  |   100.6 | 9.94ms | 15.02ms | ±4.16% |      51 |

- **read field values** is 1.07x faster than get form fields
- **read field values** is 2.90x faster than flatten form
- **read field values** is 4.50x faster than fill text fields

## Loading

| Benchmark              | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------- | ------: | ------: | ------: | -----: | ------: |
| load small PDF (888B)  |   25.5K |    39us |    97us | ±1.46% |  12,752 |
| load medium PDF (19KB) |   16.0K |    63us |    88us | ±0.41% |   7,980 |
| load form PDF (116KB)  |    1.0K |   991us |  1.52ms | ±1.11% |     505 |
| load heavy PDF (2.0MB) |    69.5 | 14.39ms | 20.37ms | ±3.14% |      35 |

- **load small PDF (888B)** is 1.60x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 25.28x faster than load form PDF (116KB)
- **load small PDF (888B)** is 367.11x faster than load heavy PDF (2.0MB)

## Saving

| Benchmark                          | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------- | ------: | ------: | ------: | -----: | ------: |
| save unmodified (19KB)             |   14.2K |    70us |   160us | ±2.57% |   7,114 |
| incremental save (19KB)            |    9.7K |   103us |   245us | ±0.91% |   4,860 |
| save with modifications (19KB)     |    1.8K |   554us |  1.12ms | ±1.36% |     903 |
| save heavy PDF (2.0MB)             |    76.7 | 13.04ms | 14.73ms | ±1.74% |      39 |
| incremental save heavy PDF (2.0MB) |    69.4 | 14.42ms | 16.91ms | ±2.54% |      35 |

- **save unmodified (19KB)** is 1.46x faster than incremental save (19KB)
- **save unmodified (19KB)** is 7.88x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 185.48x faster than save heavy PDF (2.0MB)
- **save unmodified (19KB)** is 205.10x faster than incremental save heavy PDF (2.0MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |    1.3K |   756us |  1.44ms | ±1.81% |     662 |
| extractPages (1 page from 100-page PDF)  |   390.5 |  2.56ms |  3.28ms | ±1.24% |     196 |
| extractPages (1 page from 2000-page PDF) |    25.6 | 39.09ms | 46.29ms | ±3.41% |      13 |

- **extractPages (1 page from small PDF)** is 3.39x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 51.73x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------------------- | ------: | -------: | -------: | -----: | ------: |
| split 100-page PDF (0.1MB)  |    35.9 |  27.83ms |  40.63ms | ±6.41% |      18 |
| split 2000-page PDF (0.9MB) |     2.0 | 503.02ms | 503.02ms | ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 18.08x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |    Mean |     p99 |    RME | Samples |
| :----------------------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extract first 10 pages from 2000-page PDF              |    24.8 | 40.28ms | 43.12ms | ±1.92% |      13 |
| extract first 100 pages from 2000-page PDF             |    23.0 | 43.38ms | 46.61ms | ±2.24% |      12 |
| extract every 10th page from 2000-page PDF (200 pages) |    21.4 | 46.84ms | 55.40ms | ±4.19% |      11 |

- **extract first 10 pages from 2000-page PDF** is 1.08x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.16x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
