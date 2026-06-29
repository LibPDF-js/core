# Benchmark Report

> Generated on 2026-06-29 at 10:56:27 UTC
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
| libpdf          |   419.2 |  2.39ms |  3.21ms | ±1.48% |     210 |
| pdf-lib         |    26.9 | 37.21ms | 42.65ms | ±3.46% |      14 |
| @cantoo/pdf-lib |    25.5 | 39.17ms | 43.71ms | ±2.44% |      13 |

- **libpdf** is 15.60x faster than pdf-lib
- **libpdf** is 16.42x faster than @cantoo/pdf-lib

### Create blank PDF

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |   20.9K |  48us |  108us | ±1.38% |  10,428 |
| pdf-lib         |    3.2K | 314us | 1.26ms | ±2.47% |   1,595 |
| @cantoo/pdf-lib |    2.9K | 347us | 1.59ms | ±3.08% |   1,440 |

- **libpdf** is 6.54x faster than pdf-lib
- **libpdf** is 7.24x faster than @cantoo/pdf-lib

### Add 10 pages

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |    9.4K | 106us |  200us | ±0.93% |   4,724 |
| @cantoo/pdf-lib |    2.5K | 396us | 2.16ms | ±5.02% |   1,264 |
| pdf-lib         |    2.3K | 433us | 1.89ms | ±3.52% |   1,155 |

- **libpdf** is 3.74x faster than @cantoo/pdf-lib
- **libpdf** is 4.09x faster than pdf-lib

### Draw 50 rectangles

| Benchmark       | ops/sec |   Mean |    p99 |    RME | Samples |
| :-------------- | ------: | -----: | -----: | -----: | ------: |
| libpdf          |    3.1K |  327us |  834us | ±1.33% |   1,528 |
| pdf-lib         |   721.2 | 1.39ms | 5.56ms | ±6.50% |     361 |
| @cantoo/pdf-lib |   601.2 | 1.66ms | 5.00ms | ±6.75% |     302 |

- **libpdf** is 4.24x faster than pdf-lib
- **libpdf** is 5.08x faster than @cantoo/pdf-lib

### Load and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |   411.3 |   2.43ms |   4.27ms | ±1.79% |     206 |
| pdf-lib         |    13.0 |  76.95ms |  85.76ms | ±5.32% |      10 |
| @cantoo/pdf-lib |     6.9 | 145.03ms | 153.14ms | ±1.67% |      10 |

- **libpdf** is 31.65x faster than pdf-lib
- **libpdf** is 59.65x faster than @cantoo/pdf-lib

### Load, modify, and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |    20.1 |  49.78ms |  53.47ms | ±5.08% |      11 |
| pdf-lib         |    13.6 |  73.54ms |  79.69ms | ±2.83% |      10 |
| @cantoo/pdf-lib |     6.7 | 148.42ms | 175.36ms | ±4.81% |      10 |

- **libpdf** is 1.48x faster than pdf-lib
- **libpdf** is 2.98x faster than @cantoo/pdf-lib

### Extract single page from 100-page PDF

| Benchmark       | ops/sec |   Mean |     p99 |    RME | Samples |
| :-------------- | ------: | -----: | ------: | -----: | ------: |
| libpdf          |   300.9 | 3.32ms |  3.88ms | ±0.75% |     151 |
| pdf-lib         |   114.4 | 8.74ms | 11.21ms | ±1.60% |      58 |
| @cantoo/pdf-lib |   107.4 | 9.31ms | 12.51ms | ±2.44% |      54 |

- **libpdf** is 2.63x faster than pdf-lib
- **libpdf** is 2.80x faster than @cantoo/pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    27.6 | 36.18ms | 39.48ms | ±1.98% |      14 |
| pdf-lib         |    14.2 | 70.65ms | 81.09ms | ±6.77% |       8 |
| @cantoo/pdf-lib |    12.9 | 77.47ms | 91.74ms | ±8.66% |       7 |

- **libpdf** is 1.95x faster than pdf-lib
- **libpdf** is 2.14x faster than @cantoo/pdf-lib

### Split 2000-page PDF into single-page PDFs (0.9MB)

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |     1.4 | 689.80ms | 689.80ms | ±0.00% |       1 |
| pdf-lib         |   0.746 |    1.34s |    1.34s | ±0.00% |       1 |
| @cantoo/pdf-lib |   0.727 |    1.38s |    1.38s | ±0.00% |       1 |

- **libpdf** is 1.94x faster than pdf-lib
- **libpdf** is 1.99x faster than @cantoo/pdf-lib

### Copy 10 pages between documents

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |   235.2 |  4.25ms |  4.89ms | ±0.91% |     118 |
| pdf-lib         |    87.5 | 11.43ms | 14.13ms | ±1.80% |      44 |
| @cantoo/pdf-lib |    77.9 | 12.83ms | 13.69ms | ±1.21% |      39 |

- **libpdf** is 2.69x faster than pdf-lib
- **libpdf** is 3.02x faster than @cantoo/pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    69.8 | 14.33ms | 15.29ms | ±0.97% |      35 |
| pdf-lib         |    19.4 | 51.55ms | 52.84ms | ±0.98% |      10 |
| @cantoo/pdf-lib |    16.1 | 62.06ms | 64.00ms | ±1.65% |       9 |

- **libpdf** is 3.60x faster than pdf-lib
- **libpdf** is 4.33x faster than @cantoo/pdf-lib

### Fill FINTRAC form fields

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    52.6 | 19.01ms | 26.53ms | ±4.39% |      27 |
| pdf-lib         |    34.7 | 28.81ms | 33.46ms | ±3.76% |      18 |
| @cantoo/pdf-lib |    33.5 | 29.82ms | 38.33ms | ±5.97% |      17 |

- **libpdf** is 1.52x faster than pdf-lib
- **libpdf** is 1.57x faster than @cantoo/pdf-lib

### Fill and flatten FINTRAC form

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    62.7 | 15.96ms | 20.41ms | ±2.66% |      32 |
| pdf-lib         |  FAILED |       - |       - |      - |       0 |
| @cantoo/pdf-lib |    31.0 | 32.25ms | 42.02ms | ±4.66% |      16 |

- **libpdf** is 2.02x faster than @cantoo/pdf-lib

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |   Mean |     p99 |    RME | Samples |
| :------------------------------ | ------: | -----: | ------: | -----: | ------: |
| copy 1 page                     |   996.6 | 1.00ms |  1.93ms | ±2.21% |     499 |
| copy 10 pages from 100-page PDF |   229.5 | 4.36ms |  6.41ms | ±1.82% |     115 |
| copy all 100 pages              |   134.2 | 7.45ms | 10.70ms | ±1.68% |      68 |

- **copy 1 page** is 4.34x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 7.43x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |  Mean |    p99 |    RME | Samples |
| :---------------------------------------- | ------: | ----: | -----: | -----: | ------: |
| duplicate page 0                          |    1.1K | 932us | 1.29ms | ±0.70% |     537 |
| duplicate all pages (double the document) |    1.1K | 936us | 1.31ms | ±0.73% |     535 |

- **duplicate page 0** is 1.00x faster than duplicate all pages (double the document)

### Merge PDFs

| Benchmark               | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------- | ------: | ------: | ------: | -----: | ------: |
| merge 2 small PDFs      |   690.0 |  1.45ms |  1.90ms | ±1.01% |     345 |
| merge 10 small PDFs     |   135.7 |  7.37ms | 11.38ms | ±1.87% |      68 |
| merge 2 x 100-page PDFs |    68.7 | 14.56ms | 23.60ms | ±5.05% |      35 |

- **merge 2 small PDFs** is 5.09x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 10.05x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------- | ------: | -----: | -----: | -----: | ------: |
| draw 100 lines                      |    1.8K |  547us | 1.12ms | ±1.29% |     915 |
| draw 100 rectangles                 |    1.7K |  601us | 1.23ms | ±1.70% |     832 |
| draw 100 circles                    |    1.1K |  880us | 1.77ms | ±1.58% |     569 |
| create 10 pages with mixed content  |   589.1 | 1.70ms | 3.19ms | ±2.76% |     295 |
| draw 100 text lines (standard font) |   493.2 | 2.03ms | 4.89ms | ±4.55% |     248 |

- **draw 100 lines** is 1.10x faster than draw 100 rectangles
- **draw 100 lines** is 1.61x faster than draw 100 circles
- **draw 100 lines** is 3.10x faster than create 10 pages with mixed content
- **draw 100 lines** is 3.71x faster than draw 100 text lines (standard font)

## Forms

| Benchmark         | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------- | ------: | ------: | ------: | -----: | ------: |
| read field values |   363.8 |  2.75ms |  4.91ms | ±2.72% |     182 |
| get form fields   |   345.3 |  2.90ms |  5.19ms | ±2.76% |     173 |
| flatten form      |   129.3 |  7.74ms | 10.25ms | ±1.64% |      65 |
| fill text fields  |    85.3 | 11.72ms | 17.04ms | ±4.46% |      43 |

- **read field values** is 1.05x faster than get form fields
- **read field values** is 2.81x faster than flatten form
- **read field values** is 4.26x faster than fill text fields

## Loading

| Benchmark              | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------- | ------: | -----: | -----: | -----: | ------: |
| load small PDF (888B)  |   19.1K |   52us |  137us | ±2.68% |   9,572 |
| load medium PDF (19KB) |   11.6K |   86us |  146us | ±0.56% |   5,790 |
| load form PDF (116KB)  |   840.0 | 1.19ms | 1.98ms | ±1.12% |     420 |
| load heavy PDF (9.9MB) |   396.8 | 2.52ms | 3.15ms | ±0.73% |     199 |

- **load small PDF (888B)** is 1.65x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 22.79x faster than load form PDF (116KB)
- **load small PDF (888B)** is 48.25x faster than load heavy PDF (9.9MB)

## Saving

| Benchmark                          | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------------------- | ------: | -----: | -----: | -----: | ------: |
| save unmodified (19KB)             |   10.7K |   94us |  231us | ±1.58% |   5,345 |
| incremental save (19KB)            |    7.5K |  133us |  294us | ±1.02% |   3,763 |
| save with modifications (19KB)     |    1.3K |  751us | 1.33ms | ±1.27% |     666 |
| save heavy PDF (9.9MB)             |   483.7 | 2.07ms | 2.52ms | ±0.66% |     242 |
| incremental save heavy PDF (9.9MB) |   128.2 | 7.80ms | 9.63ms | ±3.26% |      65 |

- **save unmodified (19KB)** is 1.42x faster than incremental save (19KB)
- **save unmodified (19KB)** is 8.03x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 22.10x faster than save heavy PDF (9.9MB)
- **save unmodified (19KB)** is 83.40x faster than incremental save heavy PDF (9.9MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |    1.0K |   998us |  1.92ms | ±2.24% |     502 |
| extractPages (1 page from 100-page PDF)  |   307.1 |  3.26ms |  3.82ms | ±1.11% |     154 |
| extractPages (1 page from 2000-page PDF) |    19.5 | 51.18ms | 58.08ms | ±3.41% |      10 |

- **extractPages (1 page from small PDF)** is 3.26x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 51.31x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------------------- | ------: | -------: | -------: | -----: | ------: |
| split 100-page PDF (0.1MB)  |    27.0 |  36.97ms |  40.68ms | ±2.11% |      14 |
| split 2000-page PDF (0.9MB) |     1.5 | 670.78ms | 670.78ms | ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 18.14x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |    Mean |     p99 |    RME | Samples |
| :----------------------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extract first 10 pages from 2000-page PDF              |    19.3 | 51.77ms | 53.61ms | ±1.09% |      10 |
| extract first 100 pages from 2000-page PDF             |    18.0 | 55.42ms | 56.51ms | ±1.05% |      10 |
| extract every 10th page from 2000-page PDF (200 pages) |    16.5 | 60.46ms | 62.04ms | ±0.89% |       9 |

- **extract first 10 pages from 2000-page PDF** is 1.07x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.17x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
