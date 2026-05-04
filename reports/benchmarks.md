# Benchmark Report

> Generated on 2026-05-04 at 08:28:42 UTC
>
> System: linux | AMD EPYC 7763 64-Core Processor (4 cores) | 16GB RAM | Bun 1.3.13

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
| libpdf          |   449.2 |  2.23ms |  3.98ms | ±1.77% |     225 |
| pdf-lib         |    25.2 | 39.67ms | 51.31ms | ±6.35% |      13 |
| @cantoo/pdf-lib |    24.5 | 40.86ms | 50.16ms | ±5.51% |      13 |

- **libpdf** is 17.82x faster than pdf-lib
- **libpdf** is 18.36x faster than @cantoo/pdf-lib

### Create blank PDF

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |   16.8K |  60us |  133us | ±1.31% |   8,379 |
| pdf-lib         |    2.1K | 475us | 1.55ms | ±2.55% |   1,053 |
| @cantoo/pdf-lib |    2.0K | 491us | 1.81ms | ±2.86% |   1,019 |

- **libpdf** is 7.96x faster than pdf-lib
- **libpdf** is 8.22x faster than @cantoo/pdf-lib

### Add 10 pages

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |   10.3K |  97us |  155us | ±0.89% |   5,145 |
| @cantoo/pdf-lib |    2.2K | 464us | 2.00ms | ±2.77% |   1,077 |
| pdf-lib         |    1.9K | 515us | 1.76ms | ±2.51% |     972 |

- **libpdf** is 4.78x faster than @cantoo/pdf-lib
- **libpdf** is 5.30x faster than pdf-lib

### Draw 50 rectangles

| Benchmark       | ops/sec |   Mean |    p99 |    RME | Samples |
| :-------------- | ------: | -----: | -----: | -----: | ------: |
| libpdf          |    3.2K |  309us |  801us | ±1.31% |   1,616 |
| pdf-lib         |   619.5 | 1.61ms | 5.96ms | ±6.18% |     310 |
| @cantoo/pdf-lib |   529.1 | 1.89ms | 4.50ms | ±4.55% |     265 |

- **libpdf** is 5.22x faster than pdf-lib
- **libpdf** is 6.11x faster than @cantoo/pdf-lib

### Load and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |   449.7 |   2.22ms |   2.85ms | ±0.81% |     225 |
| pdf-lib         |    11.5 |  87.32ms | 101.32ms | ±6.03% |      10 |
| @cantoo/pdf-lib |     6.6 | 152.55ms | 155.56ms | ±0.92% |      10 |

- **libpdf** is 39.27x faster than pdf-lib
- **libpdf** is 68.61x faster than @cantoo/pdf-lib

### Load, modify, and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |    24.7 |  40.47ms |  54.37ms | ±6.38% |      13 |
| pdf-lib         |    11.2 |  89.30ms | 101.73ms | ±5.56% |      10 |
| @cantoo/pdf-lib |     6.4 | 155.69ms | 163.76ms | ±1.78% |      10 |

- **libpdf** is 2.21x faster than pdf-lib
- **libpdf** is 3.85x faster than @cantoo/pdf-lib

### Extract single page from 100-page PDF

| Benchmark       | ops/sec |   Mean |     p99 |    RME | Samples |
| :-------------- | ------: | -----: | ------: | -----: | ------: |
| libpdf          |   275.6 | 3.63ms |  4.37ms | ±1.28% |     138 |
| pdf-lib         |   108.8 | 9.19ms | 13.09ms | ±2.23% |      55 |
| @cantoo/pdf-lib |   103.8 | 9.64ms | 11.07ms | ±1.86% |      52 |

- **libpdf** is 2.53x faster than pdf-lib
- **libpdf** is 2.66x faster than @cantoo/pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark       | ops/sec |    Mean |      p99 |    RME | Samples |
| :-------------- | ------: | ------: | -------: | -----: | ------: |
| libpdf          |    30.9 | 32.33ms |  35.43ms | ±2.26% |      16 |
| pdf-lib         |    11.6 | 85.85ms |  88.81ms | ±2.20% |       6 |
| @cantoo/pdf-lib |    10.3 | 96.76ms | 112.33ms | ±9.46% |       6 |

- **libpdf** is 2.65x faster than pdf-lib
- **libpdf** is 2.99x faster than @cantoo/pdf-lib

### Split 2000-page PDF into single-page PDFs (0.9MB)

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |     1.7 | 602.26ms | 602.26ms | ±0.00% |       1 |
| pdf-lib         |   0.616 |    1.62s |    1.62s | ±0.00% |       1 |
| @cantoo/pdf-lib |   0.592 |    1.69s |    1.69s | ±0.00% |       1 |

- **libpdf** is 2.70x faster than pdf-lib
- **libpdf** is 2.80x faster than @cantoo/pdf-lib

### Copy 10 pages between documents

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |   223.3 |  4.48ms |  5.07ms | ±0.79% |     112 |
| pdf-lib         |    83.6 | 11.97ms | 13.92ms | ±1.58% |      42 |
| @cantoo/pdf-lib |    72.1 | 13.87ms | 23.64ms | ±4.39% |      37 |

- **libpdf** is 2.67x faster than pdf-lib
- **libpdf** is 3.10x faster than @cantoo/pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    71.6 | 13.97ms | 19.84ms | ±2.80% |      36 |
| pdf-lib         |    18.2 | 54.86ms | 58.38ms | ±2.48% |      10 |
| @cantoo/pdf-lib |    16.0 | 62.52ms | 66.31ms | ±2.24% |       9 |

- **libpdf** is 3.93x faster than pdf-lib
- **libpdf** is 4.48x faster than @cantoo/pdf-lib

### Fill FINTRAC form fields

| Benchmark       | ops/sec |    Mean |     p99 |     RME | Samples |
| :-------------- | ------: | ------: | ------: | ------: | ------: |
| libpdf          |    48.7 | 20.54ms | 26.90ms |  ±4.21% |      25 |
| pdf-lib         |    29.2 | 34.25ms | 41.89ms |  ±5.11% |      15 |
| @cantoo/pdf-lib |    27.4 | 36.49ms | 53.43ms | ±10.75% |      14 |

- **libpdf** is 1.67x faster than pdf-lib
- **libpdf** is 1.78x faster than @cantoo/pdf-lib

### Fill and flatten FINTRAC form

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    53.7 | 18.61ms | 21.71ms | ±3.67% |      27 |
| pdf-lib         |  FAILED |       - |       - |      - |       0 |
| @cantoo/pdf-lib |    25.2 | 39.72ms | 47.46ms | ±6.22% |      13 |

- **libpdf** is 2.13x faster than @cantoo/pdf-lib

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |   Mean |    p99 |    RME | Samples |
| :------------------------------ | ------: | -----: | -----: | -----: | ------: |
| copy 1 page                     |   972.8 | 1.03ms | 2.55ms | ±3.69% |     487 |
| copy 10 pages from 100-page PDF |   222.4 | 4.50ms | 8.30ms | ±2.71% |     112 |
| copy all 100 pages              |   139.2 | 7.19ms | 8.80ms | ±0.97% |      70 |

- **copy 1 page** is 4.37x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 6.99x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |  Mean |    p99 |    RME | Samples |
| :---------------------------------------- | ------: | ----: | -----: | -----: | ------: |
| duplicate all pages (double the document) |    1.2K | 861us | 1.24ms | ±0.81% |     581 |
| duplicate page 0                          |    1.1K | 882us | 1.59ms | ±1.12% |     567 |

- **duplicate all pages (double the document)** is 1.02x faster than duplicate page 0

### Merge PDFs

| Benchmark               | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------- | ------: | ------: | ------: | -----: | ------: |
| merge 2 small PDFs      |   701.3 |  1.43ms |  2.36ms | ±1.11% |     351 |
| merge 10 small PDFs     |   131.9 |  7.58ms |  9.55ms | ±1.17% |      66 |
| merge 2 x 100-page PDFs |    75.1 | 13.32ms | 14.69ms | ±1.02% |      38 |

- **merge 2 small PDFs** is 5.32x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 9.34x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------- | ------: | -----: | -----: | -----: | ------: |
| draw 100 lines                      |    2.0K |  494us | 1.11ms | ±1.32% |   1,013 |
| draw 100 rectangles                 |    1.8K |  553us | 1.23ms | ±1.82% |     904 |
| draw 100 circles                    |   775.0 | 1.29ms | 2.80ms | ±2.66% |     389 |
| create 10 pages with mixed content  |   767.8 | 1.30ms | 2.16ms | ±1.50% |     384 |
| draw 100 text lines (standard font) |   652.1 | 1.53ms | 2.22ms | ±1.05% |     327 |

- **draw 100 lines** is 1.12x faster than draw 100 rectangles
- **draw 100 lines** is 2.61x faster than draw 100 circles
- **draw 100 lines** is 2.64x faster than create 10 pages with mixed content
- **draw 100 lines** is 3.11x faster than draw 100 text lines (standard font)

## Forms

| Benchmark         | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------- | ------: | ------: | ------: | -----: | ------: |
| read field values |   344.1 |  2.91ms |  4.17ms | ±1.30% |     173 |
| get form fields   |   298.7 |  3.35ms |  8.54ms | ±4.40% |     150 |
| flatten form      |   120.5 |  8.30ms | 12.17ms | ±2.74% |      61 |
| fill text fields  |    85.2 | 11.74ms | 16.14ms | ±4.23% |      43 |

- **read field values** is 1.15x faster than get form fields
- **read field values** is 2.86x faster than flatten form
- **read field values** is 4.04x faster than fill text fields

## Loading

| Benchmark              | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------- | ------: | -----: | -----: | -----: | ------: |
| load small PDF (888B)  |   17.3K |   58us |  139us | ±0.59% |   8,657 |
| load medium PDF (19KB) |   10.8K |   92us |  177us | ±0.45% |   5,419 |
| load form PDF (116KB)  |   732.3 | 1.37ms | 2.40ms | ±1.22% |     367 |
| load heavy PDF (9.9MB) |   436.3 | 2.29ms | 2.65ms | ±0.43% |     219 |

- **load small PDF (888B)** is 1.60x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 23.64x faster than load form PDF (116KB)
- **load small PDF (888B)** is 39.68x faster than load heavy PDF (9.9MB)

## Saving

| Benchmark                          | ops/sec |   Mean |     p99 |    RME | Samples |
| :--------------------------------- | ------: | -----: | ------: | -----: | ------: |
| save unmodified (19KB)             |    9.1K |  109us |   258us | ±0.94% |   4,572 |
| incremental save (19KB)            |    6.1K |  163us |   351us | ±0.97% |   3,067 |
| save with modifications (19KB)     |    1.3K |  760us |  1.45ms | ±1.50% |     658 |
| save heavy PDF (9.9MB)             |   427.8 | 2.34ms |  2.71ms | ±1.10% |     214 |
| incremental save heavy PDF (9.9MB) |   131.7 | 7.59ms | 10.56ms | ±2.99% |      66 |

- **save unmodified (19KB)** is 1.49x faster than incremental save (19KB)
- **save unmodified (19KB)** is 6.95x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 21.37x faster than save heavy PDF (9.9MB)
- **save unmodified (19KB)** is 69.42x faster than incremental save heavy PDF (9.9MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |   935.5 |  1.07ms |  2.59ms | ±3.96% |     468 |
| extractPages (1 page from 100-page PDF)  |   281.4 |  3.55ms |  6.17ms | ±1.87% |     141 |
| extractPages (1 page from 2000-page PDF) |    17.9 | 55.76ms | 56.06ms | ±0.35% |      10 |

- **extractPages (1 page from small PDF)** is 3.32x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 52.16x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------------------- | ------: | -------: | -------: | -----: | ------: |
| split 100-page PDF (0.1MB)  |    31.2 |  32.09ms |  39.25ms | ±4.76% |      16 |
| split 2000-page PDF (0.9MB) |     1.7 | 572.50ms | 572.50ms | ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 17.84x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |    Mean |     p99 |    RME | Samples |
| :----------------------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extract first 10 pages from 2000-page PDF              |    17.6 | 56.68ms | 58.37ms | ±1.02% |       9 |
| extract first 100 pages from 2000-page PDF             |    16.6 | 60.32ms | 61.36ms | ±1.04% |       9 |
| extract every 10th page from 2000-page PDF (200 pages) |    15.1 | 66.32ms | 73.94ms | ±4.64% |       8 |

- **extract first 10 pages from 2000-page PDF** is 1.06x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.17x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
