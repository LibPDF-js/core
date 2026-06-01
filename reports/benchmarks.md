# Benchmark Report

> Generated on 2026-06-01 at 11:31:24 UTC
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
| libpdf          |   442.4 |  2.26ms |  3.98ms | ±2.02% |     222 |
| pdf-lib         |    26.2 | 38.10ms | 40.98ms | ±3.13% |      14 |
| @cantoo/pdf-lib |    26.1 | 38.35ms | 43.57ms | ±3.98% |      14 |

- **libpdf** is 16.85x faster than pdf-lib
- **libpdf** is 16.97x faster than @cantoo/pdf-lib

### Create blank PDF

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |   19.2K |  52us |  156us | ±1.58% |   9,595 |
| pdf-lib         |    3.2K | 309us | 1.33ms | ±2.58% |   1,620 |
| @cantoo/pdf-lib |    2.9K | 343us | 1.61ms | ±3.10% |   1,457 |

- **libpdf** is 5.92x faster than pdf-lib
- **libpdf** is 6.59x faster than @cantoo/pdf-lib

### Add 10 pages

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |    9.5K | 106us |  173us | ±0.96% |   4,732 |
| @cantoo/pdf-lib |    2.6K | 392us | 2.23ms | ±3.89% |   1,277 |
| pdf-lib         |    2.4K | 419us | 1.77ms | ±3.26% |   1,195 |

- **libpdf** is 3.71x faster than @cantoo/pdf-lib
- **libpdf** is 3.96x faster than pdf-lib

### Draw 50 rectangles

| Benchmark       | ops/sec |   Mean |    p99 |    RME | Samples |
| :-------------- | ------: | -----: | -----: | -----: | ------: |
| libpdf          |    3.0K |  338us |  907us | ±1.58% |   1,481 |
| pdf-lib         |   719.7 | 1.39ms | 6.21ms | ±7.57% |     364 |
| @cantoo/pdf-lib |   652.5 | 1.53ms | 4.34ms | ±6.29% |     327 |

- **libpdf** is 4.11x faster than pdf-lib
- **libpdf** is 4.54x faster than @cantoo/pdf-lib

### Load and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |   447.5 |   2.23ms |   3.96ms | ±1.86% |     224 |
| pdf-lib         |    13.5 |  74.16ms |  80.85ms | ±3.86% |      10 |
| @cantoo/pdf-lib |     6.9 | 145.18ms | 156.58ms | ±2.41% |      10 |

- **libpdf** is 33.18x faster than pdf-lib
- **libpdf** is 64.96x faster than @cantoo/pdf-lib

### Load, modify, and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |    19.2 |  52.10ms |  61.17ms | ±8.90% |      10 |
| pdf-lib         |    13.0 |  76.66ms |  92.98ms | ±5.99% |      10 |
| @cantoo/pdf-lib |     7.0 | 141.90ms | 144.95ms | ±1.06% |      10 |

- **libpdf** is 1.47x faster than pdf-lib
- **libpdf** is 2.72x faster than @cantoo/pdf-lib

### Extract single page from 100-page PDF

| Benchmark       | ops/sec |   Mean |     p99 |    RME | Samples |
| :-------------- | ------: | -----: | ------: | -----: | ------: |
| libpdf          |   290.5 | 3.44ms |  4.53ms | ±1.58% |     146 |
| pdf-lib         |   116.2 | 8.60ms |  9.97ms | ±1.19% |      59 |
| @cantoo/pdf-lib |   110.7 | 9.03ms | 11.13ms | ±2.17% |      56 |

- **libpdf** is 2.50x faster than pdf-lib
- **libpdf** is 2.62x faster than @cantoo/pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    27.3 | 36.62ms | 43.65ms | ±3.33% |      14 |
| pdf-lib         |    13.8 | 72.62ms | 76.92ms | ±5.24% |       7 |
| @cantoo/pdf-lib |    12.9 | 77.26ms | 86.07ms | ±8.99% |       7 |

- **libpdf** is 1.98x faster than pdf-lib
- **libpdf** is 2.11x faster than @cantoo/pdf-lib

### Split 2000-page PDF into single-page PDFs (0.9MB)

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |     1.4 | 703.53ms | 703.53ms | ±0.00% |       1 |
| pdf-lib         |   0.781 |    1.28s |    1.28s | ±0.00% |       1 |
| @cantoo/pdf-lib |   0.733 |    1.37s |    1.37s | ±0.00% |       1 |

- **libpdf** is 1.82x faster than pdf-lib
- **libpdf** is 1.94x faster than @cantoo/pdf-lib

### Copy 10 pages between documents

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |   228.4 |  4.38ms |  5.14ms | ±1.09% |     115 |
| pdf-lib         |    87.3 | 11.46ms | 12.94ms | ±1.44% |      44 |
| @cantoo/pdf-lib |    78.9 | 12.67ms | 14.74ms | ±1.87% |      40 |

- **libpdf** is 2.62x faster than pdf-lib
- **libpdf** is 2.89x faster than @cantoo/pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    67.0 | 14.93ms | 15.72ms | ±1.17% |      34 |
| pdf-lib         |    18.4 | 54.35ms | 62.87ms | ±5.57% |      10 |
| @cantoo/pdf-lib |    15.8 | 63.11ms | 64.87ms | ±1.40% |       8 |

- **libpdf** is 3.64x faster than pdf-lib
- **libpdf** is 4.23x faster than @cantoo/pdf-lib

### Fill FINTRAC form fields

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    51.0 | 19.62ms | 25.66ms | ±4.43% |      26 |
| @cantoo/pdf-lib |    34.1 | 29.35ms | 40.00ms | ±6.05% |      18 |
| pdf-lib         |    33.5 | 29.83ms | 36.47ms | ±4.37% |      17 |

- **libpdf** is 1.50x faster than @cantoo/pdf-lib
- **libpdf** is 1.52x faster than pdf-lib

### Fill and flatten FINTRAC form

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    63.0 | 15.88ms | 19.56ms | ±2.73% |      32 |
| pdf-lib         |  FAILED |       - |       - |      - |       0 |
| @cantoo/pdf-lib |    30.5 | 32.78ms | 44.91ms | ±5.99% |      16 |

- **libpdf** is 2.06x faster than @cantoo/pdf-lib

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |   Mean |    p99 |    RME | Samples |
| :------------------------------ | ------: | -----: | -----: | -----: | ------: |
| copy 1 page                     |   962.0 | 1.04ms | 2.15ms | ±2.46% |     481 |
| copy 10 pages from 100-page PDF |   225.2 | 4.44ms | 5.18ms | ±1.43% |     113 |
| copy all 100 pages              |   127.1 | 7.87ms | 8.77ms | ±0.92% |      64 |

- **copy 1 page** is 4.27x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 7.57x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |  Mean |    p99 |    RME | Samples |
| :---------------------------------------- | ------: | ----: | -----: | -----: | ------: |
| duplicate all pages (double the document) |    1.1K | 950us | 1.35ms | ±0.72% |     527 |
| duplicate page 0                          |    1.1K | 952us | 1.36ms | ±0.84% |     526 |

- **duplicate all pages (double the document)** is 1.00x faster than duplicate page 0

### Merge PDFs

| Benchmark               | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------- | ------: | ------: | ------: | -----: | ------: |
| merge 2 small PDFs      |   677.7 |  1.48ms |  2.01ms | ±1.10% |     339 |
| merge 10 small PDFs     |   131.5 |  7.61ms | 10.86ms | ±1.57% |      66 |
| merge 2 x 100-page PDFs |    70.1 | 14.26ms | 15.10ms | ±0.82% |      36 |

- **merge 2 small PDFs** is 5.15x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 9.66x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------- | ------: | -----: | -----: | -----: | ------: |
| draw 100 lines                      |    1.8K |  548us | 1.15ms | ±1.21% |     913 |
| draw 100 rectangles                 |    1.6K |  608us | 1.26ms | ±1.78% |     823 |
| draw 100 circles                    |    1.1K |  884us | 1.67ms | ±1.55% |     566 |
| create 10 pages with mixed content  |   713.4 | 1.40ms | 2.26ms | ±1.53% |     357 |
| draw 100 text lines (standard font) |   635.9 | 1.57ms | 2.30ms | ±1.27% |     318 |

- **draw 100 lines** is 1.11x faster than draw 100 rectangles
- **draw 100 lines** is 1.61x faster than draw 100 circles
- **draw 100 lines** is 2.56x faster than create 10 pages with mixed content
- **draw 100 lines** is 2.87x faster than draw 100 text lines (standard font)

## Forms

| Benchmark         | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------- | ------: | ------: | ------: | -----: | ------: |
| read field values |   373.0 |  2.68ms |  3.98ms | ±1.41% |     187 |
| get form fields   |   342.9 |  2.92ms |  5.16ms | ±2.90% |     172 |
| flatten form      |   125.2 |  7.99ms | 16.03ms | ±3.62% |      63 |
| fill text fields  |    83.0 | 12.05ms | 17.20ms | ±4.49% |      42 |

- **read field values** is 1.09x faster than get form fields
- **read field values** is 2.98x faster than flatten form
- **read field values** is 4.49x faster than fill text fields

## Loading

| Benchmark              | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------- | ------: | -----: | -----: | -----: | ------: |
| load small PDF (888B)  |   19.4K |   52us |  122us | ±0.73% |   9,696 |
| load medium PDF (19KB) |   12.0K |   83us |  147us | ±0.68% |   5,997 |
| load form PDF (116KB)  |   764.0 | 1.31ms | 2.40ms | ±2.12% |     382 |
| load heavy PDF (9.9MB) |   500.7 | 2.00ms | 2.46ms | ±0.61% |     251 |

- **load small PDF (888B)** is 1.62x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 25.38x faster than load form PDF (116KB)
- **load small PDF (888B)** is 38.73x faster than load heavy PDF (9.9MB)

## Saving

| Benchmark                          | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------------------- | ------: | -----: | -----: | -----: | ------: |
| save unmodified (19KB)             |    9.9K |  101us |  261us | ±1.66% |   4,938 |
| incremental save (19KB)            |    7.1K |  141us |  339us | ±1.24% |   3,544 |
| save with modifications (19KB)     |    1.3K |  777us | 1.47ms | ±1.79% |     645 |
| save heavy PDF (9.9MB)             |   408.3 | 2.45ms | 2.95ms | ±0.62% |     205 |
| incremental save heavy PDF (9.9MB) |   125.7 | 7.96ms | 9.14ms | ±2.59% |      63 |

- **save unmodified (19KB)** is 1.39x faster than incremental save (19KB)
- **save unmodified (19KB)** is 7.67x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 24.19x faster than save heavy PDF (9.9MB)
- **save unmodified (19KB)** is 78.57x faster than incremental save heavy PDF (9.9MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |    1.0K |   999us |  1.87ms | ±2.01% |     501 |
| extractPages (1 page from 100-page PDF)  |   298.9 |  3.35ms |  5.08ms | ±1.58% |     150 |
| extractPages (1 page from 2000-page PDF) |    18.9 | 52.90ms | 59.05ms | ±2.97% |      10 |

- **extractPages (1 page from small PDF)** is 3.35x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 52.97x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------------------- | ------: | -------: | -------: | -----: | ------: |
| split 100-page PDF (0.1MB)  |    26.7 |  37.52ms |  39.99ms | ±1.70% |      14 |
| split 2000-page PDF (0.9MB) |     1.5 | 687.31ms | 687.31ms | ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 18.32x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |    Mean |     p99 |    RME | Samples |
| :----------------------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extract first 10 pages from 2000-page PDF              |    18.4 | 54.24ms | 55.94ms | ±1.29% |      10 |
| extract first 100 pages from 2000-page PDF             |    17.1 | 58.64ms | 60.32ms | ±1.26% |       9 |
| extract every 10th page from 2000-page PDF (200 pages) |    15.4 | 65.02ms | 67.83ms | ±2.16% |       8 |

- **extract first 10 pages from 2000-page PDF** is 1.08x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.20x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
