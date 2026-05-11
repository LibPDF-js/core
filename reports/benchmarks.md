# Benchmark Report

> Generated on 2026-05-11 at 09:37:44 UTC
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
| libpdf          |   406.5 |  2.46ms |  4.32ms | ±2.37% |     204 |
| @cantoo/pdf-lib |    24.1 | 41.41ms | 46.92ms | ±3.40% |      13 |
| pdf-lib         |    23.2 | 43.02ms | 49.78ms | ±4.44% |      12 |

- **libpdf** is 16.83x faster than @cantoo/pdf-lib
- **libpdf** is 17.49x faster than pdf-lib

### Create blank PDF

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |   16.4K |  61us |  136us | ±1.66% |   8,199 |
| pdf-lib         |    2.3K | 437us | 1.69ms | ±2.59% |   1,144 |
| @cantoo/pdf-lib |    2.1K | 473us | 2.02ms | ±3.05% |   1,058 |

- **libpdf** is 7.17x faster than pdf-lib
- **libpdf** is 7.75x faster than @cantoo/pdf-lib

### Add 10 pages

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |    9.5K | 106us |  190us | ±1.70% |   4,730 |
| @cantoo/pdf-lib |    2.0K | 497us | 2.45ms | ±3.47% |   1,006 |
| pdf-lib         |    1.8K | 546us | 2.16ms | ±3.11% |     916 |

- **libpdf** is 4.70x faster than @cantoo/pdf-lib
- **libpdf** is 5.17x faster than pdf-lib

### Draw 50 rectangles

| Benchmark       | ops/sec |   Mean |    p99 |    RME | Samples |
| :-------------- | ------: | -----: | -----: | -----: | ------: |
| libpdf          |    2.9K |  350us | 1.01ms | ±1.81% |   1,430 |
| pdf-lib         |   570.7 | 1.75ms | 7.18ms | ±7.13% |     286 |
| @cantoo/pdf-lib |   470.8 | 2.12ms | 5.46ms | ±5.60% |     236 |

- **libpdf** is 5.01x faster than pdf-lib
- **libpdf** is 6.07x faster than @cantoo/pdf-lib

### Load and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |   416.7 |   2.40ms |   3.77ms | ±1.94% |     209 |
| pdf-lib         |    11.2 |  89.62ms |  95.62ms | ±2.93% |      10 |
| @cantoo/pdf-lib |     6.4 | 156.22ms | 163.40ms | ±1.52% |      10 |

- **libpdf** is 37.34x faster than pdf-lib
- **libpdf** is 65.09x faster than @cantoo/pdf-lib

### Load, modify, and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |    21.5 |  46.57ms |  52.40ms | ±4.09% |      11 |
| pdf-lib         |    10.9 |  92.16ms |  99.65ms | ±4.29% |      10 |
| @cantoo/pdf-lib |     6.3 | 157.89ms | 168.17ms | ±1.96% |      10 |

- **libpdf** is 1.98x faster than pdf-lib
- **libpdf** is 3.39x faster than @cantoo/pdf-lib

### Extract single page from 100-page PDF

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |   246.3 |  4.06ms |  4.84ms | ±1.68% |     124 |
| pdf-lib         |   100.7 |  9.93ms | 14.84ms | ±3.09% |      51 |
| @cantoo/pdf-lib |    95.3 | 10.50ms | 14.84ms | ±3.10% |      48 |

- **libpdf** is 2.45x faster than pdf-lib
- **libpdf** is 2.58x faster than @cantoo/pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark       | ops/sec |    Mean |      p99 |    RME | Samples |
| :-------------- | ------: | ------: | -------: | -----: | ------: |
| libpdf          |    26.9 | 37.24ms |  48.05ms | ±5.99% |      14 |
| pdf-lib         |    10.8 | 92.82ms | 105.96ms | ±7.85% |       6 |
| @cantoo/pdf-lib |    10.1 | 98.82ms | 104.66ms | ±5.23% |       6 |

- **libpdf** is 2.49x faster than pdf-lib
- **libpdf** is 2.65x faster than @cantoo/pdf-lib

### Split 2000-page PDF into single-page PDFs (0.9MB)

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |     1.5 | 669.63ms | 669.63ms | ±0.00% |       1 |
| pdf-lib         |   0.585 |    1.71s |    1.71s | ±0.00% |       1 |
| @cantoo/pdf-lib |   0.551 |    1.81s |    1.81s | ±0.00% |       1 |

- **libpdf** is 2.55x faster than pdf-lib
- **libpdf** is 2.71x faster than @cantoo/pdf-lib

### Copy 10 pages between documents

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |   198.1 |  5.05ms |  6.13ms | ±1.27% |     100 |
| pdf-lib         |    73.5 | 13.61ms | 16.91ms | ±3.57% |      37 |
| @cantoo/pdf-lib |    66.9 | 14.95ms | 18.99ms | ±2.70% |      34 |

- **libpdf** is 2.70x faster than pdf-lib
- **libpdf** is 2.96x faster than @cantoo/pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    60.1 | 16.64ms | 19.05ms | ±1.70% |      31 |
| pdf-lib         |    17.8 | 56.09ms | 57.85ms | ±1.47% |       9 |
| @cantoo/pdf-lib |    15.1 | 66.40ms | 67.24ms | ±1.10% |       8 |

- **libpdf** is 3.37x faster than pdf-lib
- **libpdf** is 3.99x faster than @cantoo/pdf-lib

### Fill FINTRAC form fields

| Benchmark       | ops/sec |    Mean |     p99 |     RME | Samples |
| :-------------- | ------: | ------: | ------: | ------: | ------: |
| libpdf          |    39.0 | 25.66ms | 43.38ms | ±10.36% |      20 |
| @cantoo/pdf-lib |    26.6 | 37.66ms | 57.18ms |  ±9.81% |      14 |
| pdf-lib         |    26.3 | 38.04ms | 57.98ms |  ±9.28% |      14 |

- **libpdf** is 1.47x faster than @cantoo/pdf-lib
- **libpdf** is 1.48x faster than pdf-lib

### Fill and flatten FINTRAC form

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    47.1 | 21.23ms | 36.39ms | ±7.46% |      24 |
| pdf-lib         |  FAILED |       - |       - |      - |       0 |
| @cantoo/pdf-lib |    22.8 | 43.89ms | 50.76ms | ±5.36% |      12 |

- **libpdf** is 2.07x faster than @cantoo/pdf-lib

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |   Mean |    p99 |    RME | Samples |
| :------------------------------ | ------: | -----: | -----: | -----: | ------: |
| copy 1 page                     |   943.3 | 1.06ms | 2.29ms | ±2.62% |     472 |
| copy 10 pages from 100-page PDF |   192.3 | 5.20ms | 9.82ms | ±4.06% |      97 |
| copy all 100 pages              |   123.7 | 8.09ms | 9.87ms | ±1.22% |      62 |

- **copy 1 page** is 4.91x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 7.63x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |  Mean |    p99 |    RME | Samples |
| :---------------------------------------- | ------: | ----: | -----: | -----: | ------: |
| duplicate all pages (double the document) |    1.1K | 910us | 1.46ms | ±1.00% |     550 |
| duplicate page 0                          |    1.1K | 922us | 1.46ms | ±0.99% |     543 |

- **duplicate all pages (double the document)** is 1.01x faster than duplicate page 0

### Merge PDFs

| Benchmark               | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------- | ------: | ------: | ------: | -----: | ------: |
| merge 2 small PDFs      |   667.6 |  1.50ms |  2.15ms | ±1.14% |     334 |
| merge 10 small PDFs     |   122.6 |  8.16ms | 11.09ms | ±1.63% |      62 |
| merge 2 x 100-page PDFs |    65.0 | 15.38ms | 20.07ms | ±2.60% |      33 |

- **merge 2 small PDFs** is 5.45x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 10.27x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------- | ------: | -----: | -----: | -----: | ------: |
| draw 100 lines                      |    1.9K |  527us | 1.18ms | ±1.72% |     949 |
| draw 100 rectangles                 |    1.7K |  588us | 1.63ms | ±2.23% |     851 |
| draw 100 circles                    |   722.6 | 1.38ms | 3.51ms | ±3.41% |     362 |
| create 10 pages with mixed content  |   720.7 | 1.39ms | 2.57ms | ±2.05% |     361 |
| draw 100 text lines (standard font) |   590.5 | 1.69ms | 3.27ms | ±2.33% |     296 |

- **draw 100 lines** is 1.12x faster than draw 100 rectangles
- **draw 100 lines** is 2.63x faster than draw 100 circles
- **draw 100 lines** is 2.63x faster than create 10 pages with mixed content
- **draw 100 lines** is 3.21x faster than draw 100 text lines (standard font)

## Forms

| Benchmark         | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------- | ------: | ------: | ------: | -----: | ------: |
| read field values |   312.2 |  3.20ms |  4.38ms | ±1.46% |     157 |
| get form fields   |   274.8 |  3.64ms |  6.10ms | ±3.48% |     138 |
| flatten form      |   112.4 |  8.90ms | 13.33ms | ±2.69% |      57 |
| fill text fields  |    77.2 | 12.96ms | 18.67ms | ±5.24% |      39 |

- **read field values** is 1.14x faster than get form fields
- **read field values** is 2.78x faster than flatten form
- **read field values** is 4.05x faster than fill text fields

## Loading

| Benchmark              | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------- | ------: | -----: | -----: | -----: | ------: |
| load small PDF (888B)  |   16.1K |   62us |  160us | ±0.93% |   8,070 |
| load medium PDF (19KB) |   10.8K |   93us |  128us | ±0.70% |   5,396 |
| load form PDF (116KB)  |   736.2 | 1.36ms | 2.69ms | ±1.82% |     369 |
| load heavy PDF (9.9MB) |   439.9 | 2.27ms | 4.18ms | ±2.12% |     220 |

- **load small PDF (888B)** is 1.50x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 21.92x faster than load form PDF (116KB)
- **load small PDF (888B)** is 36.68x faster than load heavy PDF (9.9MB)

## Saving

| Benchmark                          | ops/sec |   Mean |     p99 |    RME | Samples |
| :--------------------------------- | ------: | -----: | ------: | -----: | ------: |
| save unmodified (19KB)             |    9.3K |  108us |   257us | ±0.95% |   4,637 |
| incremental save (19KB)            |    5.8K |  172us |   364us | ±1.15% |   2,914 |
| save with modifications (19KB)     |    1.3K |  760us |  1.43ms | ±1.36% |     658 |
| save heavy PDF (9.9MB)             |   458.3 | 2.18ms |  2.70ms | ±0.78% |     230 |
| incremental save heavy PDF (9.9MB) |   162.0 | 6.17ms | 14.48ms | ±7.15% |      81 |

- **save unmodified (19KB)** is 1.59x faster than incremental save (19KB)
- **save unmodified (19KB)** is 7.05x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 20.24x faster than save heavy PDF (9.9MB)
- **save unmodified (19KB)** is 57.25x faster than incremental save heavy PDF (9.9MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |   943.5 |  1.06ms |  2.07ms | ±2.59% |     472 |
| extractPages (1 page from 100-page PDF)  |   262.5 |  3.81ms |  4.58ms | ±0.96% |     132 |
| extractPages (1 page from 2000-page PDF) |    15.8 | 63.22ms | 72.59ms | ±4.27% |      10 |

- **extractPages (1 page from small PDF)** is 3.59x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 59.65x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------------------- | ------: | -------: | -------: | -----: | ------: |
| split 100-page PDF (0.1MB)  |    29.5 |  33.93ms |  38.96ms | ±3.33% |      15 |
| split 2000-page PDF (0.9MB) |     1.6 | 629.62ms | 629.62ms | ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 18.56x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |    Mean |     p99 |    RME | Samples |
| :----------------------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extract first 10 pages from 2000-page PDF              |    15.7 | 63.57ms | 64.73ms | ±1.06% |       8 |
| extract first 100 pages from 2000-page PDF             |    14.8 | 67.40ms | 69.06ms | ±1.42% |       8 |
| extract every 10th page from 2000-page PDF (200 pages) |    13.6 | 73.31ms | 74.36ms | ±1.23% |       7 |

- **extract first 10 pages from 2000-page PDF** is 1.06x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.15x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
