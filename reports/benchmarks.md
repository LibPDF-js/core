# Benchmark Report

> Generated on 2026-03-11 at 02:42:34 UTC
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

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |   402.2 |  2.49ms |  4.62ms | ±2.04% |     202 |
| pdf-lib         |    25.5 | 39.27ms | 42.08ms | ±3.03% |      13 |
| @cantoo/pdf-lib |    25.0 | 39.96ms | 47.07ms | ±4.23% |      13 |

- **libpdf** is 15.80x faster than pdf-lib
- **libpdf** is 16.07x faster than @cantoo/pdf-lib

### Create blank PDF

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |   16.9K |  59us |  122us | ±1.72% |   8,449 |
| pdf-lib         |    2.1K | 478us | 2.07ms | ±3.60% |   1,046 |
| @cantoo/pdf-lib |    2.0K | 491us | 2.00ms | ±3.02% |   1,019 |

- **libpdf** is 8.08x faster than pdf-lib
- **libpdf** is 8.29x faster than @cantoo/pdf-lib

### Add 10 pages

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |    9.3K | 107us |  184us | ±1.59% |   4,662 |
| @cantoo/pdf-lib |    2.1K | 486us | 2.30ms | ±3.61% |   1,030 |
| pdf-lib         |    1.8K | 560us | 2.26ms | ±3.40% |     893 |

- **libpdf** is 4.53x faster than @cantoo/pdf-lib
- **libpdf** is 5.22x faster than pdf-lib

### Draw 50 rectangles

| Benchmark       | ops/sec |   Mean |    p99 |    RME | Samples |
| :-------------- | ------: | -----: | -----: | -----: | ------: |
| libpdf          |    3.1K |  320us |  906us | ±1.60% |   1,561 |
| pdf-lib         |   586.9 | 1.70ms | 6.19ms | ±6.22% |     294 |
| @cantoo/pdf-lib |   528.4 | 1.89ms | 5.12ms | ±5.61% |     265 |

- **libpdf** is 5.32x faster than pdf-lib
- **libpdf** is 5.91x faster than @cantoo/pdf-lib

### Load and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |   409.6 |   2.44ms |   3.25ms | ±1.42% |     205 |
| pdf-lib         |    11.4 |  87.75ms |  96.00ms | ±4.45% |      10 |
| @cantoo/pdf-lib |     6.3 | 158.07ms | 163.73ms | ±1.62% |      10 |

- **libpdf** is 35.94x faster than pdf-lib
- **libpdf** is 64.74x faster than @cantoo/pdf-lib

### Load, modify, and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |    23.4 |  42.73ms |  52.95ms | ±6.60% |      12 |
| pdf-lib         |    11.5 |  87.00ms |  98.97ms | ±5.25% |      10 |
| @cantoo/pdf-lib |     6.5 | 154.92ms | 162.28ms | ±1.91% |      10 |

- **libpdf** is 2.04x faster than pdf-lib
- **libpdf** is 3.63x faster than @cantoo/pdf-lib

### Extract single page from 100-page PDF

| Benchmark       | ops/sec |   Mean |     p99 |    RME | Samples |
| :-------------- | ------: | -----: | ------: | -----: | ------: |
| libpdf          |   273.2 | 3.66ms |  4.39ms | ±1.49% |     137 |
| pdf-lib         |   109.1 | 9.17ms | 13.94ms | ±2.51% |      55 |
| @cantoo/pdf-lib |   102.5 | 9.75ms | 12.23ms | ±2.55% |      52 |

- **libpdf** is 2.50x faster than pdf-lib
- **libpdf** is 2.67x faster than @cantoo/pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark       | ops/sec |    Mean |      p99 |     RME | Samples |
| :-------------- | ------: | ------: | -------: | ------: | ------: |
| libpdf          |    29.8 | 33.60ms |  40.91ms |  ±4.02% |      15 |
| pdf-lib         |    11.2 | 89.06ms | 111.56ms | ±13.09% |       6 |
| @cantoo/pdf-lib |    10.5 | 95.32ms | 100.27ms |  ±4.76% |       6 |

- **libpdf** is 2.65x faster than pdf-lib
- **libpdf** is 2.84x faster than @cantoo/pdf-lib

### Split 2000-page PDF into single-page PDFs (0.9MB)

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |     1.6 | 606.65ms | 606.65ms | ±0.00% |       1 |
| pdf-lib         |   0.616 |    1.62s |    1.62s | ±0.00% |       1 |
| @cantoo/pdf-lib |   0.589 |    1.70s |    1.70s | ±0.00% |       1 |

- **libpdf** is 2.68x faster than pdf-lib
- **libpdf** is 2.80x faster than @cantoo/pdf-lib

### Copy 10 pages between documents

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |   216.5 |  4.62ms |  5.40ms | ±1.06% |     109 |
| pdf-lib         |    84.9 | 11.78ms | 13.20ms | ±1.46% |      43 |
| @cantoo/pdf-lib |    74.3 | 13.46ms | 14.98ms | ±1.88% |      38 |

- **libpdf** is 2.55x faster than pdf-lib
- **libpdf** is 2.91x faster than @cantoo/pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    70.0 | 14.29ms | 18.89ms | ±2.16% |      35 |
| pdf-lib         |    18.8 | 53.21ms | 55.31ms | ±1.91% |      10 |
| @cantoo/pdf-lib |    15.8 | 63.11ms | 64.87ms | ±1.89% |       8 |

- **libpdf** is 3.72x faster than pdf-lib
- **libpdf** is 4.42x faster than @cantoo/pdf-lib

### Fill FINTRAC form fields

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    45.6 | 21.95ms | 39.87ms | ±9.50% |      23 |
| @cantoo/pdf-lib |    29.1 | 34.31ms | 40.31ms | ±4.47% |      15 |
| pdf-lib         |    29.0 | 34.53ms | 40.36ms | ±4.28% |      15 |

- **libpdf** is 1.56x faster than @cantoo/pdf-lib
- **libpdf** is 1.57x faster than pdf-lib

### Fill and flatten FINTRAC form

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    51.4 | 19.46ms | 24.65ms | ±3.48% |      26 |
| pdf-lib         |  FAILED |       - |       - |      - |       0 |
| @cantoo/pdf-lib |    25.1 | 39.79ms | 46.10ms | ±5.59% |      13 |

- **libpdf** is 2.05x faster than @cantoo/pdf-lib

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |   Mean |    p99 |    RME | Samples |
| :------------------------------ | ------: | -----: | -----: | -----: | ------: |
| copy 1 page                     |   999.4 | 1.00ms | 1.88ms | ±2.21% |     500 |
| copy 10 pages from 100-page PDF |   223.1 | 4.48ms | 7.04ms | ±2.00% |     112 |
| copy all 100 pages              |   139.2 | 7.18ms | 7.87ms | ±0.85% |      70 |

- **copy 1 page** is 4.48x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 7.18x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |  Mean |    p99 |    RME | Samples |
| :---------------------------------------- | ------: | ----: | -----: | -----: | ------: |
| duplicate page 0                          |    1.2K | 868us | 1.54ms | ±1.05% |     576 |
| duplicate all pages (double the document) |    1.1K | 870us | 1.60ms | ±1.20% |     575 |

- **duplicate page 0** is 1.00x faster than duplicate all pages (double the document)

### Merge PDFs

| Benchmark               | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------- | ------: | ------: | ------: | -----: | ------: |
| merge 2 small PDFs      |   719.0 |  1.39ms |  1.85ms | ±0.69% |     360 |
| merge 10 small PDFs     |   136.4 |  7.33ms |  8.43ms | ±1.07% |      69 |
| merge 2 x 100-page PDFs |    74.7 | 13.39ms | 16.25ms | ±1.34% |      38 |

- **merge 2 small PDFs** is 5.27x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 9.62x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------- | ------: | -----: | -----: | -----: | ------: |
| draw 100 lines                      |    2.0K |  497us | 1.21ms | ±1.49% |   1,006 |
| draw 100 rectangles                 |    1.7K |  588us | 1.46ms | ±3.07% |     851 |
| draw 100 circles                    |   780.6 | 1.28ms | 3.05ms | ±2.83% |     391 |
| create 10 pages with mixed content  |   752.8 | 1.33ms | 2.32ms | ±1.71% |     377 |
| draw 100 text lines (standard font) |   643.4 | 1.55ms | 2.44ms | ±1.37% |     322 |

- **draw 100 lines** is 1.18x faster than draw 100 rectangles
- **draw 100 lines** is 2.58x faster than draw 100 circles
- **draw 100 lines** is 2.67x faster than create 10 pages with mixed content
- **draw 100 lines** is 3.12x faster than draw 100 text lines (standard font)

## Forms

| Benchmark         | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------- | ------: | ------: | ------: | -----: | ------: |
| read field values |   345.1 |  2.90ms |  5.25ms | ±1.90% |     173 |
| get form fields   |   301.6 |  3.32ms |  5.64ms | ±3.36% |     151 |
| flatten form      |   121.3 |  8.24ms | 12.71ms | ±3.60% |      61 |
| fill text fields  |    83.2 | 12.02ms | 16.65ms | ±5.07% |      42 |

- **read field values** is 1.14x faster than get form fields
- **read field values** is 2.85x faster than flatten form
- **read field values** is 4.15x faster than fill text fields

## Loading

| Benchmark              | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------- | ------: | -----: | -----: | -----: | ------: |
| load small PDF (888B)  |   14.3K |   70us |  162us | ±4.28% |   7,129 |
| load medium PDF (19KB) |    9.2K |  109us |  197us | ±4.88% |   4,582 |
| load form PDF (116KB)  |   643.2 | 1.55ms | 3.05ms | ±2.55% |     323 |
| load heavy PDF (9.9MB) |   420.9 | 2.38ms | 4.05ms | ±2.15% |     211 |

- **load small PDF (888B)** is 1.56x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 22.17x faster than load form PDF (116KB)
- **load small PDF (888B)** is 33.88x faster than load heavy PDF (9.9MB)

## Saving

| Benchmark                          | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------------------- | ------: | -----: | -----: | -----: | ------: |
| save unmodified (19KB)             |    9.3K |  107us |  261us | ±1.02% |   4,652 |
| incremental save (19KB)            |    6.2K |  161us |  339us | ±0.99% |   3,105 |
| save with modifications (19KB)     |    1.3K |  755us | 1.40ms | ±1.55% |     662 |
| save heavy PDF (9.9MB)             |   455.6 | 2.19ms | 2.71ms | ±0.67% |     228 |
| incremental save heavy PDF (9.9MB) |   116.5 | 8.58ms | 9.93ms | ±2.97% |      59 |

- **save unmodified (19KB)** is 1.50x faster than incremental save (19KB)
- **save unmodified (19KB)** is 7.03x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 20.42x faster than save heavy PDF (9.9MB)
- **save unmodified (19KB)** is 79.84x faster than incremental save heavy PDF (9.9MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |   994.9 |  1.01ms |  2.22ms | ±3.18% |     498 |
| extractPages (1 page from 100-page PDF)  |   284.1 |  3.52ms |  6.12ms | ±1.64% |     143 |
| extractPages (1 page from 2000-page PDF) |    17.7 | 56.37ms | 57.28ms | ±0.81% |      10 |

- **extractPages (1 page from small PDF)** is 3.50x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 56.08x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------------------- | ------: | -------: | -------: | -----: | ------: |
| split 100-page PDF (0.1MB)  |    31.4 |  31.81ms |  35.29ms | ±3.06% |      16 |
| split 2000-page PDF (0.9MB) |     1.8 | 566.91ms | 566.91ms | ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 17.82x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |    Mean |     p99 |    RME | Samples |
| :----------------------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extract first 10 pages from 2000-page PDF              |    17.1 | 58.59ms | 60.07ms | ±1.61% |       9 |
| extract first 100 pages from 2000-page PDF             |    16.1 | 62.12ms | 64.41ms | ±1.83% |       9 |
| extract every 10th page from 2000-page PDF (200 pages) |    15.2 | 65.93ms | 67.75ms | ±1.72% |       8 |

- **extract first 10 pages from 2000-page PDF** is 1.06x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.13x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
