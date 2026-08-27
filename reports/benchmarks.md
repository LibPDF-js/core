# Benchmark Report

> Generated on 2026-08-17 at 06:52:09 UTC
>
> System: linux | AMD EPYC 7763 64-Core Processor (4 cores) | 16GB RAM | Bun 1.3.14

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
| libpdf          |    55.1 |  18.15ms |  19.44ms | ±1.31% |      28 |
| @cantoo/pdf-lib |     4.6 | 218.96ms | 231.60ms | ±1.67% |      10 |
| pdf-lib         |     4.5 | 220.20ms | 228.05ms | ±1.23% |      10 |

- **libpdf** is 12.07x faster than @cantoo/pdf-lib
- **libpdf** is 12.13x faster than pdf-lib

### Create blank PDF

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |   12.2K |  82us |  170us | ±3.09% |   6,113 |
| pdf-lib         |    3.0K | 330us | 1.45ms | ±2.78% |   1,515 |
| @cantoo/pdf-lib |    2.6K | 380us | 1.57ms | ±3.37% |   1,317 |

- **libpdf** is 4.04x faster than pdf-lib
- **libpdf** is 4.64x faster than @cantoo/pdf-lib

### Add 10 pages

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |    8.0K | 126us |  268us | ±0.94% |   3,980 |
| @cantoo/pdf-lib |    2.3K | 435us | 2.03ms | ±3.27% |   1,151 |
| pdf-lib         |    2.2K | 445us | 1.68ms | ±2.83% |   1,123 |

- **libpdf** is 3.46x faster than @cantoo/pdf-lib
- **libpdf** is 3.55x faster than pdf-lib

### Draw 50 rectangles

| Benchmark       | ops/sec |   Mean |    p99 |    RME | Samples |
| :-------------- | ------: | -----: | -----: | -----: | ------: |
| libpdf          |    2.8K |  355us |  888us | ±1.45% |   1,410 |
| pdf-lib         |   647.2 | 1.55ms | 6.60ms | ±9.02% |     324 |
| @cantoo/pdf-lib |   506.8 | 1.97ms | 7.12ms | ±7.97% |     255 |

- **libpdf** is 4.35x faster than pdf-lib
- **libpdf** is 5.56x faster than @cantoo/pdf-lib

### Load and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |    51.9 |  19.26ms |  30.66ms | ±5.62% |      26 |
| pdf-lib         |     3.2 | 312.48ms | 328.07ms | ±1.29% |      10 |
| @cantoo/pdf-lib |     1.7 | 602.35ms | 678.42ms | ±3.38% |      10 |

- **libpdf** is 16.22x faster than pdf-lib
- **libpdf** is 31.27x faster than @cantoo/pdf-lib

### Load, modify, and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| pdf-lib         |     3.2 | 311.96ms | 324.91ms | ±1.22% |      10 |
| libpdf          |     3.0 | 335.92ms | 352.02ms | ±1.35% |      10 |
| @cantoo/pdf-lib |     1.7 | 592.93ms | 622.90ms | ±1.49% |      10 |

- **pdf-lib** is 1.08x faster than libpdf
- **pdf-lib** is 1.90x faster than @cantoo/pdf-lib

### Extract single page from 100-page PDF

| Benchmark       | ops/sec |   Mean |     p99 |    RME | Samples |
| :-------------- | ------: | -----: | ------: | -----: | ------: |
| libpdf          |   273.1 | 3.66ms |  4.22ms | ±0.91% |     137 |
| pdf-lib         |   112.0 | 8.93ms | 10.97ms | ±1.95% |      56 |
| @cantoo/pdf-lib |   104.8 | 9.54ms | 15.18ms | ±3.03% |      53 |

- **libpdf** is 2.44x faster than pdf-lib
- **libpdf** is 2.61x faster than @cantoo/pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    24.6 | 40.69ms | 44.31ms | ±2.13% |      13 |
| pdf-lib         |    13.9 | 71.78ms | 79.07ms | ±5.19% |       7 |
| @cantoo/pdf-lib |    13.2 | 76.00ms | 84.91ms | ±5.84% |       7 |

- **libpdf** is 1.76x faster than pdf-lib
- **libpdf** is 1.87x faster than @cantoo/pdf-lib

### Split 2000-page PDF into single-page PDFs (0.9MB)

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |     1.3 | 775.20ms | 775.20ms | ±0.00% |       1 |
| pdf-lib         |   0.746 |    1.34s |    1.34s | ±0.00% |       1 |
| @cantoo/pdf-lib |   0.698 |    1.43s |    1.43s | ±0.00% |       1 |

- **libpdf** is 1.73x faster than pdf-lib
- **libpdf** is 1.85x faster than @cantoo/pdf-lib

### Copy 10 pages between documents

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |   213.4 |  4.69ms |  5.53ms | ±1.09% |     107 |
| pdf-lib         |    87.3 | 11.46ms | 13.09ms | ±1.27% |      44 |
| @cantoo/pdf-lib |    76.9 | 13.01ms | 14.06ms | ±1.65% |      39 |

- **libpdf** is 2.45x faster than pdf-lib
- **libpdf** is 2.78x faster than @cantoo/pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    64.7 | 15.46ms | 19.28ms | ±1.91% |      33 |
| pdf-lib         |    19.2 | 51.99ms | 53.22ms | ±0.70% |      10 |
| @cantoo/pdf-lib |    16.1 | 62.15ms | 62.87ms | ±0.72% |       9 |

- **libpdf** is 3.36x faster than pdf-lib
- **libpdf** is 4.02x faster than @cantoo/pdf-lib

### Fill FINTRAC form fields

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    45.7 | 21.90ms | 28.15ms | ±4.26% |      23 |
| pdf-lib         |    35.8 | 27.93ms | 40.97ms | ±6.27% |      18 |
| @cantoo/pdf-lib |    35.5 | 28.17ms | 36.45ms | ±5.73% |      18 |

- **libpdf** is 1.28x faster than pdf-lib
- **libpdf** is 1.29x faster than @cantoo/pdf-lib

### Fill and flatten FINTRAC form

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    57.2 | 17.49ms | 21.06ms | ±2.37% |      29 |
| pdf-lib         |  FAILED |       - |       - |      - |       0 |
| @cantoo/pdf-lib |    30.9 | 32.34ms | 48.77ms | ±7.63% |      16 |

- **libpdf** is 1.85x faster than @cantoo/pdf-lib

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |   Mean |     p99 |    RME | Samples |
| :------------------------------ | ------: | -----: | ------: | -----: | ------: |
| copy 1 page                     |   879.5 | 1.14ms |  2.42ms | ±2.60% |     440 |
| copy 10 pages from 100-page PDF |   203.5 | 4.91ms |  8.59ms | ±2.89% |     102 |
| copy all 100 pages              |   122.6 | 8.15ms | 13.21ms | ±2.89% |      62 |

- **copy 1 page** is 4.32x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 7.17x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------------- | ------: | -----: | -----: | -----: | ------: |
| duplicate page 0                          |   964.8 | 1.04ms | 1.51ms | ±0.82% |     483 |
| duplicate all pages (double the document) |   960.8 | 1.04ms | 1.68ms | ±1.07% |     481 |

- **duplicate page 0** is 1.00x faster than duplicate all pages (double the document)

### Merge PDFs

| Benchmark               | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------- | ------: | ------: | ------: | -----: | ------: |
| merge 2 small PDFs      |   625.9 |  1.60ms |  2.07ms | ±1.04% |     314 |
| merge 10 small PDFs     |   122.4 |  8.17ms | 11.80ms | ±1.72% |      62 |
| merge 2 x 100-page PDFs |    66.9 | 14.96ms | 20.68ms | ±2.50% |      34 |

- **merge 2 small PDFs** is 5.11x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 9.36x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------- | ------: | -----: | -----: | -----: | ------: |
| draw 100 lines                      |    1.7K |  572us | 1.18ms | ±1.24% |     874 |
| draw 100 rectangles                 |    1.6K |  641us | 1.35ms | ±1.88% |     781 |
| draw 100 circles                    |    1.1K |  937us | 1.78ms | ±1.67% |     534 |
| create 10 pages with mixed content  |   661.1 | 1.51ms | 2.66ms | ±2.12% |     331 |
| draw 100 text lines (standard font) |   601.6 | 1.66ms | 2.96ms | ±2.10% |     301 |

- **draw 100 lines** is 1.12x faster than draw 100 rectangles
- **draw 100 lines** is 1.64x faster than draw 100 circles
- **draw 100 lines** is 2.64x faster than create 10 pages with mixed content
- **draw 100 lines** is 2.90x faster than draw 100 text lines (standard font)

## Forms

| Benchmark         | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------- | ------: | ------: | ------: | -----: | ------: |
| read field values |   342.2 |  2.92ms |  5.33ms | ±2.63% |     172 |
| get form fields   |   314.9 |  3.18ms |  5.87ms | ±3.14% |     158 |
| flatten form      |   124.4 |  8.04ms | 10.66ms | ±1.62% |      63 |
| fill text fields  |    80.5 | 12.42ms | 16.09ms | ±3.50% |      41 |

- **read field values** is 1.09x faster than get form fields
- **read field values** is 2.75x faster than flatten form
- **read field values** is 4.25x faster than fill text fields

## Loading

| Benchmark              | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------- | ------: | ------: | ------: | -----: | ------: |
| load small PDF (888B)  |   15.7K |    64us |   188us | ±1.41% |   7,827 |
| load medium PDF (19KB) |   11.1K |    90us |   128us | ±0.64% |   5,547 |
| load form PDF (116KB)  |   704.4 |  1.42ms |  2.61ms | ±2.05% |     353 |
| load heavy PDF (2.0MB) |    55.4 | 18.04ms | 20.34ms | ±1.76% |      28 |

- **load small PDF (888B)** is 1.41x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 22.22x faster than load form PDF (116KB)
- **load small PDF (888B)** is 282.32x faster than load heavy PDF (2.0MB)

## Saving

| Benchmark                          | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------- | ------: | ------: | ------: | -----: | ------: |
| save unmodified (19KB)             |    8.5K |   117us |   310us | ±1.59% |   4,262 |
| incremental save (19KB)            |    5.7K |   177us |   409us | ±1.21% |   2,831 |
| save with modifications (19KB)     |    1.2K |   865us |  1.64ms | ±1.96% |     578 |
| save heavy PDF (2.0MB)             |    54.0 | 18.52ms | 19.37ms | ±1.12% |      28 |
| incremental save heavy PDF (2.0MB) |    49.7 | 20.11ms | 22.82ms | ±1.71% |      25 |

- **save unmodified (19KB)** is 1.51x faster than incremental save (19KB)
- **save unmodified (19KB)** is 7.37x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 157.83x faster than save heavy PDF (2.0MB)
- **save unmodified (19KB)** is 171.42x faster than incremental save heavy PDF (2.0MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |   894.5 |  1.12ms |  2.17ms | ±2.68% |     448 |
| extractPages (1 page from 100-page PDF)  |   278.1 |  3.60ms |  4.20ms | ±0.85% |     140 |
| extractPages (1 page from 2000-page PDF) |    17.7 | 56.49ms | 66.21ms | ±4.38% |      10 |

- **extractPages (1 page from small PDF)** is 3.22x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 50.53x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------------------- | ------: | -------: | -------: | -----: | ------: |
| split 100-page PDF (0.1MB)  |    23.9 |  41.87ms |  45.60ms | ±2.39% |      12 |
| split 2000-page PDF (0.9MB) |     1.3 | 757.55ms | 757.55ms | ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 18.09x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |    Mean |     p99 |    RME | Samples |
| :----------------------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extract first 10 pages from 2000-page PDF              |    16.9 | 59.28ms | 65.80ms | ±4.52% |       9 |
| extract first 100 pages from 2000-page PDF             |    16.5 | 60.43ms | 62.13ms | ±1.68% |       9 |
| extract every 10th page from 2000-page PDF (200 pages) |    15.0 | 66.78ms | 69.86ms | ±2.08% |       8 |

- **extract first 10 pages from 2000-page PDF** is 1.02x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.13x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
