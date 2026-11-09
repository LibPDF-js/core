# Benchmark Report

> Generated on 2026-11-09 at 15:13:51 UTC
>
> System: linux | AMD EPYC 9V74 80-Core Processor (4 cores) | 16GB RAM | Bun 1.4.4
>
> Libraries: @libpdf/core 0.5.3 (this repo), pdf-lib 1.17.1, @cantoo/pdf-lib 2.9.1

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
| libpdf          |    50.6 |  19.77ms |  28.61ms | ±6.10% |      26 |
| @cantoo/pdf-lib |     4.8 | 207.31ms | 212.82ms | ±0.92% |      10 |
| pdf-lib         |     4.6 | 215.94ms | 221.45ms | ±1.12% |      10 |

- **libpdf** is 10.49x faster than @cantoo/pdf-lib
- **libpdf** is 10.92x faster than pdf-lib

### Create blank PDF

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |   15.3K |  65us |  253us | ±6.55% |   7,640 |
| @cantoo/pdf-lib |    2.5K | 398us | 1.92ms | ±5.74% |   1,260 |
| pdf-lib         |    2.5K | 406us | 3.35ms | ±7.80% |   1,232 |

- **libpdf** is 6.08x faster than @cantoo/pdf-lib
- **libpdf** is 6.21x faster than pdf-lib

### Add 10 pages

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |    9.4K | 106us |  209us | ±1.09% |   4,725 |
| pdf-lib         |    1.8K | 546us | 2.37ms | ±8.24% |     916 |
| @cantoo/pdf-lib |    1.8K | 570us | 2.41ms | ±6.24% |     878 |

- **libpdf** is 5.16x faster than pdf-lib
- **libpdf** is 5.39x faster than @cantoo/pdf-lib

### Draw 50 rectangles

| Benchmark       | ops/sec |   Mean |     p99 |     RME | Samples |
| :-------------- | ------: | -----: | ------: | ------: | ------: |
| libpdf          |    3.0K |  331us |   701us |  ±1.40% |   1,513 |
| pdf-lib         |   659.3 | 1.52ms |  8.42ms |  ±8.45% |     330 |
| @cantoo/pdf-lib |   531.0 | 1.88ms | 13.87ms | ±11.20% |     266 |

- **libpdf** is 4.59x faster than pdf-lib
- **libpdf** is 5.70x faster than @cantoo/pdf-lib

### Load and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |    53.5 |  18.68ms |  23.38ms | ±3.53% |      27 |
| pdf-lib         |     3.1 | 321.13ms | 338.57ms | ±3.26% |      10 |
| @cantoo/pdf-lib |     1.6 | 625.05ms | 638.91ms | ±0.72% |      10 |

- **libpdf** is 17.20x faster than pdf-lib
- **libpdf** is 33.47x faster than @cantoo/pdf-lib

### Load, modify, and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| pdf-lib         |     3.1 | 323.06ms | 334.82ms | ±2.13% |      10 |
| libpdf          |     3.0 | 329.41ms | 349.12ms | ±1.65% |      10 |
| @cantoo/pdf-lib |     1.6 | 633.32ms | 659.28ms | ±1.14% |      10 |

- **pdf-lib** is 1.02x faster than libpdf
- **pdf-lib** is 1.96x faster than @cantoo/pdf-lib

### Extract single page from 100-page PDF

| Benchmark       | ops/sec |   Mean |     p99 |    RME | Samples |
| :-------------- | ------: | -----: | ------: | -----: | ------: |
| libpdf          |   292.7 | 3.42ms |  5.99ms | ±2.03% |     147 |
| pdf-lib         |   114.3 | 8.75ms | 13.20ms | ±3.50% |      58 |
| @cantoo/pdf-lib |   111.1 | 9.00ms | 16.20ms | ±4.86% |      56 |

- **libpdf** is 2.56x faster than pdf-lib
- **libpdf** is 2.64x faster than @cantoo/pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |     RME | Samples |
| :-------------- | ------: | ------: | ------: | ------: | ------: |
| libpdf          |    27.2 | 36.79ms | 52.33ms |  ±8.61% |      15 |
| pdf-lib         |    13.0 | 76.93ms | 93.60ms | ±17.46% |       7 |
| @cantoo/pdf-lib |    12.4 | 80.78ms | 99.53ms | ±12.71% |       7 |

- **libpdf** is 2.09x faster than pdf-lib
- **libpdf** is 2.20x faster than @cantoo/pdf-lib

### Split 2000-page PDF into single-page PDFs (0.9MB)

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |     1.5 | 668.87ms | 668.87ms | ±0.00% |       1 |
| pdf-lib         |   0.702 |    1.42s |    1.42s | ±0.00% |       1 |
| @cantoo/pdf-lib |   0.657 |    1.52s |    1.52s | ±0.00% |       1 |

- **libpdf** is 2.13x faster than pdf-lib
- **libpdf** is 2.28x faster than @cantoo/pdf-lib

### Copy 10 pages between documents

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |   237.7 |  4.21ms |  6.70ms | ±2.34% |     119 |
| pdf-lib         |    89.2 | 11.21ms | 15.33ms | ±2.90% |      45 |
| @cantoo/pdf-lib |    78.6 | 12.72ms | 18.43ms | ±3.44% |      40 |

- **libpdf** is 2.67x faster than pdf-lib
- **libpdf** is 3.02x faster than @cantoo/pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    69.3 | 14.43ms | 19.88ms | ±2.60% |      35 |
| pdf-lib         |    18.9 | 52.86ms | 57.79ms | ±3.25% |      10 |
| @cantoo/pdf-lib |    15.6 | 64.25ms | 69.45ms | ±3.92% |       8 |

- **libpdf** is 3.66x faster than pdf-lib
- **libpdf** is 4.45x faster than @cantoo/pdf-lib

### Fill FINTRAC form fields

| Benchmark       | ops/sec |    Mean |     p99 |     RME | Samples |
| :-------------- | ------: | ------: | ------: | ------: | ------: |
| libpdf          |    50.5 | 19.80ms | 37.32ms | ±10.84% |      26 |
| pdf-lib         |    36.6 | 27.32ms | 41.74ms |  ±7.83% |      19 |
| @cantoo/pdf-lib |    34.9 | 28.61ms | 38.78ms |  ±5.59% |      18 |

- **libpdf** is 1.38x faster than pdf-lib
- **libpdf** is 1.45x faster than @cantoo/pdf-lib

### Fill and flatten FINTRAC form

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    70.5 | 14.19ms | 19.56ms | ±3.17% |      36 |
| pdf-lib         |  FAILED |       - |       - |      - |       0 |
| @cantoo/pdf-lib |    33.6 | 29.77ms | 46.75ms | ±8.80% |      17 |

- **libpdf** is 2.10x faster than @cantoo/pdf-lib

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |   Mean |    p99 |    RME | Samples |
| :------------------------------ | ------: | -----: | -----: | -----: | ------: |
| copy 1 page                     |    1.0K |  995us | 2.03ms | ±2.59% |     503 |
| copy 10 pages from 100-page PDF |   238.3 | 4.20ms | 5.28ms | ±1.53% |     120 |
| copy all 100 pages              |   138.5 | 7.22ms | 8.31ms | ±0.90% |      70 |

- **copy 1 page** is 4.22x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 7.25x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |  Mean |    p99 |    RME | Samples |
| :---------------------------------------- | ------: | ----: | -----: | -----: | ------: |
| duplicate all pages (double the document) |    1.1K | 908us | 1.31ms | ±0.69% |     551 |
| duplicate page 0                          |    1.1K | 934us | 1.69ms | ±1.16% |     536 |

- **duplicate all pages (double the document)** is 1.03x faster than duplicate page 0

### Merge PDFs

| Benchmark               | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------- | ------: | ------: | ------: | -----: | ------: |
| merge 2 small PDFs      |   723.5 |  1.38ms |  1.76ms | ±0.62% |     362 |
| merge 10 small PDFs     |   136.8 |  7.31ms |  8.29ms | ±0.88% |      69 |
| merge 2 x 100-page PDFs |    74.3 | 13.46ms | 14.02ms | ±0.64% |      38 |

- **merge 2 small PDFs** is 5.29x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 9.74x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------- | ------: | -----: | -----: | -----: | ------: |
| draw 100 lines                      |    1.8K |  560us | 1.97ms | ±3.27% |     893 |
| draw 100 rectangles                 |    1.7K |  591us | 1.11ms | ±1.64% |     847 |
| draw 100 circles                    |    1.3K |  782us | 1.55ms | ±1.45% |     640 |
| create 10 pages with mixed content  |   746.9 | 1.34ms | 2.19ms | ±1.33% |     374 |
| draw 100 text lines (standard font) |   655.7 | 1.53ms | 2.57ms | ±1.50% |     328 |

- **draw 100 lines** is 1.05x faster than draw 100 rectangles
- **draw 100 lines** is 1.40x faster than draw 100 circles
- **draw 100 lines** is 2.39x faster than create 10 pages with mixed content
- **draw 100 lines** is 2.72x faster than draw 100 text lines (standard font)

## Forms

| Benchmark         | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------- | ------: | ------: | ------: | -----: | ------: |
| read field values |   392.4 |  2.55ms |  3.33ms | ±0.78% |     197 |
| get form fields   |   350.7 |  2.85ms |  4.74ms | ±2.87% |     176 |
| flatten form      |   131.6 |  7.60ms | 14.78ms | ±3.40% |      66 |
| fill text fields  |    91.2 | 10.97ms | 15.47ms | ±3.08% |      46 |

- **read field values** is 1.12x faster than get form fields
- **read field values** is 2.98x faster than flatten form
- **read field values** is 4.30x faster than fill text fields

## Loading

| Benchmark              | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------- | ------: | ------: | ------: | -----: | ------: |
| load small PDF (888B)  |   19.2K |    52us |   110us | ±0.90% |   9,584 |
| load medium PDF (19KB) |   12.4K |    81us |   108us | ±0.46% |   6,208 |
| load form PDF (116KB)  |   813.8 |  1.23ms |  2.26ms | ±2.97% |     407 |
| load heavy PDF (2.0MB) |    53.3 | 18.76ms | 30.03ms | ±5.54% |      27 |

- **load small PDF (888B)** is 1.54x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 23.55x faster than load form PDF (116KB)
- **load small PDF (888B)** is 359.54x faster than load heavy PDF (2.0MB)

## Saving

| Benchmark                          | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------- | ------: | ------: | ------: | -----: | ------: |
| save unmodified (19KB)             |   10.3K |    97us |   202us | ±1.13% |   5,169 |
| incremental save (19KB)            |    7.2K |   138us |   322us | ±1.71% |   3,612 |
| save with modifications (19KB)     |    1.3K |   742us |  1.38ms | ±1.37% |     674 |
| save heavy PDF (2.0MB)             |    52.2 | 19.17ms | 26.03ms | ±3.52% |      27 |
| incremental save heavy PDF (2.0MB) |    47.7 | 20.98ms | 27.41ms | ±4.62% |      25 |

- **save unmodified (19KB)** is 1.43x faster than incremental save (19KB)
- **save unmodified (19KB)** is 7.67x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 198.14x faster than save heavy PDF (2.0MB)
- **save unmodified (19KB)** is 216.84x faster than incremental save heavy PDF (2.0MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |    1.0K |   970us |  1.99ms | ±2.35% |     516 |
| extractPages (1 page from 100-page PDF)  |   312.1 |  3.20ms |  5.88ms | ±1.89% |     157 |
| extractPages (1 page from 2000-page PDF) |    19.9 | 50.23ms | 51.45ms | ±1.08% |      10 |

- **extractPages (1 page from small PDF)** is 3.30x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 51.78x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |     Mean |      p99 |     RME | Samples |
| :-------------------------- | ------: | -------: | -------: | ------: | ------: |
| split 100-page PDF (0.1MB)  |    25.5 |  39.20ms |  65.80ms | ±16.18% |      13 |
| split 2000-page PDF (0.9MB) |     1.5 | 647.00ms | 647.00ms |  ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 16.51x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |    Mean |     p99 |    RME | Samples |
| :----------------------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extract first 10 pages from 2000-page PDF              |    19.9 | 50.27ms | 51.38ms | ±1.00% |      10 |
| extract first 100 pages from 2000-page PDF             |    18.5 | 54.17ms | 56.55ms | ±1.36% |      10 |
| extract every 10th page from 2000-page PDF (200 pages) |    17.0 | 58.76ms | 64.33ms | ±3.07% |       9 |

- **extract first 10 pages from 2000-page PDF** is 1.08x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.17x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
