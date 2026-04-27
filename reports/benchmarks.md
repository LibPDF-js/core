# Benchmark Report

> Generated on 2026-04-27 at 08:23:31 UTC
>
> System: linux | AMD EPYC 9V74 80-Core Processor (4 cores) | 16GB RAM | Bun 1.3.13

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
| libpdf          |   445.8 |  2.24ms |  3.95ms | ±2.46% |     223 |
| @cantoo/pdf-lib |    25.7 | 38.98ms | 46.32ms | ±4.79% |      13 |
| pdf-lib         |    23.6 | 42.36ms | 50.04ms | ±5.30% |      12 |

- **libpdf** is 17.38x faster than @cantoo/pdf-lib
- **libpdf** is 18.89x faster than pdf-lib

### Create blank PDF

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |   22.2K |  45us |  104us | ±1.62% |  11,114 |
| pdf-lib         |    2.8K | 353us | 1.29ms | ±2.63% |   1,418 |
| @cantoo/pdf-lib |    2.6K | 387us | 1.67ms | ±2.91% |   1,291 |

- **libpdf** is 7.84x faster than pdf-lib
- **libpdf** is 8.61x faster than @cantoo/pdf-lib

### Add 10 pages

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |   11.8K |  85us |  165us | ±1.37% |   5,884 |
| @cantoo/pdf-lib |    2.5K | 404us | 2.05ms | ±3.35% |   1,238 |
| pdf-lib         |    2.2K | 446us | 1.81ms | ±3.00% |   1,123 |

- **libpdf** is 4.75x faster than @cantoo/pdf-lib
- **libpdf** is 5.24x faster than pdf-lib

### Draw 50 rectangles

| Benchmark       | ops/sec |   Mean |    p99 |    RME | Samples |
| :-------------- | ------: | -----: | -----: | -----: | ------: |
| libpdf          |    3.3K |  303us |  911us | ±1.56% |   1,651 |
| pdf-lib         |   689.5 | 1.45ms | 5.16ms | ±5.99% |     345 |
| @cantoo/pdf-lib |   588.5 | 1.70ms | 4.93ms | ±5.44% |     296 |

- **libpdf** is 4.79x faster than pdf-lib
- **libpdf** is 5.61x faster than @cantoo/pdf-lib

### Load and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |   459.2 |   2.18ms |   3.26ms | ±1.39% |     230 |
| pdf-lib         |    11.9 |  83.70ms |  92.28ms | ±3.67% |      10 |
| @cantoo/pdf-lib |     6.7 | 149.95ms | 155.04ms | ±1.25% |      10 |

- **libpdf** is 38.43x faster than pdf-lib
- **libpdf** is 68.85x faster than @cantoo/pdf-lib

### Load, modify, and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |    25.9 |  38.63ms |  49.74ms | ±5.54% |      13 |
| pdf-lib         |    11.5 |  87.22ms | 100.96ms | ±5.89% |      10 |
| @cantoo/pdf-lib |     6.5 | 153.65ms | 161.04ms | ±2.04% |      10 |

- **libpdf** is 2.26x faster than pdf-lib
- **libpdf** is 3.98x faster than @cantoo/pdf-lib

### Extract single page from 100-page PDF

| Benchmark       | ops/sec |   Mean |     p99 |    RME | Samples |
| :-------------- | ------: | -----: | ------: | -----: | ------: |
| libpdf          |   297.4 | 3.36ms |  4.10ms | ±1.18% |     149 |
| pdf-lib         |   107.9 | 9.27ms | 13.49ms | ±2.89% |      54 |
| @cantoo/pdf-lib |   105.6 | 9.47ms | 11.58ms | ±2.05% |      53 |

- **libpdf** is 2.76x faster than pdf-lib
- **libpdf** is 2.82x faster than @cantoo/pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    31.9 | 31.39ms | 45.31ms | ±7.44% |      16 |
| pdf-lib         |    12.4 | 80.94ms | 93.44ms | ±6.53% |       7 |
| @cantoo/pdf-lib |    11.4 | 88.03ms | 94.32ms | ±6.64% |       6 |

- **libpdf** is 2.58x faster than pdf-lib
- **libpdf** is 2.80x faster than @cantoo/pdf-lib

### Split 2000-page PDF into single-page PDFs (0.9MB)

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |     1.8 | 561.22ms | 561.22ms | ±0.00% |       1 |
| pdf-lib         |   0.669 |    1.49s |    1.49s | ±0.00% |       1 |
| @cantoo/pdf-lib |   0.646 |    1.55s |    1.55s | ±0.00% |       1 |

- **libpdf** is 2.66x faster than pdf-lib
- **libpdf** is 2.76x faster than @cantoo/pdf-lib

### Copy 10 pages between documents

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |   238.0 |  4.20ms |  5.51ms | ±1.27% |     119 |
| pdf-lib         |    85.1 | 11.75ms | 12.75ms | ±1.28% |      43 |
| @cantoo/pdf-lib |    75.5 | 13.24ms | 14.48ms | ±1.70% |      38 |

- **libpdf** is 2.80x faster than pdf-lib
- **libpdf** is 3.15x faster than @cantoo/pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    74.5 | 13.43ms | 14.71ms | ±1.12% |      38 |
| pdf-lib         |    18.7 | 53.44ms | 54.93ms | ±0.97% |      10 |
| @cantoo/pdf-lib |    16.2 | 61.89ms | 63.73ms | ±1.36% |       9 |

- **libpdf** is 3.98x faster than pdf-lib
- **libpdf** is 4.61x faster than @cantoo/pdf-lib

### Fill FINTRAC form fields

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    51.7 | 19.33ms | 24.59ms | ±5.82% |      26 |
| pdf-lib         |    30.8 | 32.45ms | 38.29ms | ±4.41% |      16 |
| @cantoo/pdf-lib |    30.5 | 32.74ms | 40.57ms | ±4.63% |      16 |

- **libpdf** is 1.68x faster than pdf-lib
- **libpdf** is 1.69x faster than @cantoo/pdf-lib

### Fill and flatten FINTRAC form

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    55.2 | 18.11ms | 26.02ms | ±6.30% |      28 |
| pdf-lib         |  FAILED |       - |       - |      - |       0 |
| @cantoo/pdf-lib |    26.8 | 37.35ms | 42.56ms | ±4.05% |      14 |

- **libpdf** is 2.06x faster than @cantoo/pdf-lib

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |   Mean |    p99 |    RME | Samples |
| :------------------------------ | ------: | -----: | -----: | -----: | ------: |
| copy 1 page                     |    1.0K |  964us | 2.12ms | ±3.04% |     519 |
| copy 10 pages from 100-page PDF |   235.1 | 4.25ms | 7.63ms | ±2.45% |     118 |
| copy all 100 pages              |   143.1 | 6.99ms | 7.62ms | ±0.84% |      72 |

- **copy 1 page** is 4.41x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 7.25x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |  Mean |    p99 |    RME | Samples |
| :---------------------------------------- | ------: | ----: | -----: | -----: | ------: |
| duplicate page 0                          |    1.3K | 798us | 1.24ms | ±0.93% |     627 |
| duplicate all pages (double the document) |    1.2K | 805us | 1.48ms | ±1.23% |     622 |

- **duplicate page 0** is 1.01x faster than duplicate all pages (double the document)

### Merge PDFs

| Benchmark               | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------- | ------: | ------: | ------: | -----: | ------: |
| merge 2 small PDFs      |   771.3 |  1.30ms |  1.67ms | ±0.61% |     386 |
| merge 10 small PDFs     |   141.7 |  7.05ms |  9.72ms | ±1.57% |      71 |
| merge 2 x 100-page PDFs |    78.4 | 12.76ms | 13.61ms | ±0.73% |      40 |

- **merge 2 small PDFs** is 5.44x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 9.84x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------- | ------: | -----: | -----: | -----: | ------: |
| draw 100 lines                      |    2.0K |  496us | 1.09ms | ±1.48% |   1,008 |
| draw 100 rectangles                 |    1.8K |  568us | 1.32ms | ±2.49% |     880 |
| draw 100 circles                    |   835.3 | 1.20ms | 2.72ms | ±2.83% |     418 |
| create 10 pages with mixed content  |   784.4 | 1.27ms | 2.19ms | ±1.60% |     393 |
| draw 100 text lines (standard font) |   662.5 | 1.51ms | 2.23ms | ±1.16% |     332 |

- **draw 100 lines** is 1.15x faster than draw 100 rectangles
- **draw 100 lines** is 2.41x faster than draw 100 circles
- **draw 100 lines** is 2.57x faster than create 10 pages with mixed content
- **draw 100 lines** is 3.04x faster than draw 100 text lines (standard font)

## Forms

| Benchmark         | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------- | ------: | ------: | ------: | -----: | ------: |
| read field values |   367.6 |  2.72ms |  4.62ms | ±1.74% |     184 |
| get form fields   |   322.4 |  3.10ms |  6.85ms | ±5.10% |     162 |
| flatten form      |   130.4 |  7.67ms | 10.64ms | ±2.47% |      66 |
| fill text fields  |    92.5 | 10.81ms | 17.96ms | ±4.97% |      47 |

- **read field values** is 1.14x faster than get form fields
- **read field values** is 2.82x faster than flatten form
- **read field values** is 3.98x faster than fill text fields

## Loading

| Benchmark              | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------- | ------: | -----: | -----: | -----: | ------: |
| load small PDF (888B)  |   19.2K |   52us |  115us | ±0.68% |   9,601 |
| load medium PDF (19KB) |   11.9K |   84us |  154us | ±0.63% |   5,951 |
| load form PDF (116KB)  |   814.4 | 1.23ms | 1.84ms | ±1.26% |     408 |
| load heavy PDF (9.9MB) |   472.8 | 2.12ms | 2.68ms | ±0.82% |     237 |

- **load small PDF (888B)** is 1.61x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 23.58x faster than load form PDF (116KB)
- **load small PDF (888B)** is 40.61x faster than load heavy PDF (9.9MB)

## Saving

| Benchmark                          | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------------------- | ------: | -----: | -----: | -----: | ------: |
| save unmodified (19KB)             |    9.2K |  109us |  224us | ±3.51% |   4,580 |
| incremental save (19KB)            |    5.8K |  171us |  615us | ±4.22% |   2,918 |
| save with modifications (19KB)     |    1.3K |  767us | 3.04ms | ±3.79% |     652 |
| save heavy PDF (9.9MB)             |   421.2 | 2.37ms | 4.29ms | ±2.24% |     211 |
| incremental save heavy PDF (9.9MB) |   127.5 | 7.84ms | 9.58ms | ±3.27% |      64 |

- **save unmodified (19KB)** is 1.57x faster than incremental save (19KB)
- **save unmodified (19KB)** is 7.02x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 21.74x faster than save heavy PDF (9.9MB)
- **save unmodified (19KB)** is 71.82x faster than incremental save heavy PDF (9.9MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |    1.1K |   873us |  1.64ms | ±1.93% |     573 |
| extractPages (1 page from 100-page PDF)  |   307.1 |  3.26ms |  3.94ms | ±0.77% |     154 |
| extractPages (1 page from 2000-page PDF) |    19.0 | 52.51ms | 53.35ms | ±0.65% |      10 |

- **extractPages (1 page from small PDF)** is 3.73x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 60.15x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------------------- | ------: | -------: | -------: | -----: | ------: |
| split 100-page PDF (0.1MB)  |    34.9 |  28.64ms |  32.17ms | ±2.89% |      18 |
| split 2000-page PDF (0.9MB) |     1.9 | 529.36ms | 529.36ms | ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 18.48x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |    Mean |     p99 |    RME | Samples |
| :----------------------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extract first 10 pages from 2000-page PDF              |    18.5 | 54.03ms | 55.73ms | ±1.18% |      10 |
| extract first 100 pages from 2000-page PDF             |    17.5 | 56.99ms | 58.68ms | ±1.52% |       9 |
| extract every 10th page from 2000-page PDF (200 pages) |    15.9 | 62.98ms | 73.03ms | ±5.56% |       8 |

- **extract first 10 pages from 2000-page PDF** is 1.05x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.17x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
