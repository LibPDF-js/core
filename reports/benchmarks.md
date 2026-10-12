# Benchmark Report

> Generated on 2026-10-12 at 14:28:47 UTC
>
> System: linux | AMD EPYC 7763 64-Core Processor (4 cores) | 16GB RAM | Bun 1.4.3
>
> Libraries: @libpdf/core 0.5.2 (this repo), pdf-lib 1.17.1, @cantoo/pdf-lib 2.9.1

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

| Benchmark       | ops/sec |     Mean |      p99 |     RME | Samples |
| :-------------- | ------: | -------: | -------: | ------: | ------: |
| libpdf          |    53.2 |  18.81ms |  21.48ms |  ±1.55% |      27 |
| @cantoo/pdf-lib |     4.7 | 214.46ms | 222.36ms |  ±1.16% |      10 |
| pdf-lib         |     4.1 | 242.74ms | 446.52ms | ±21.11% |      10 |

- **libpdf** is 11.40x faster than @cantoo/pdf-lib
- **libpdf** is 12.91x faster than pdf-lib

### Create blank PDF

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |   14.5K |  69us |  168us | ±1.95% |   7,262 |
| pdf-lib         |    2.7K | 373us | 1.33ms | ±2.57% |   1,341 |
| @cantoo/pdf-lib |    2.6K | 390us | 1.49ms | ±2.70% |   1,281 |

- **libpdf** is 5.42x faster than pdf-lib
- **libpdf** is 5.67x faster than @cantoo/pdf-lib

### Add 10 pages

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |    7.9K | 127us |  246us | ±1.08% |   3,936 |
| pdf-lib         |    2.2K | 447us | 2.09ms | ±3.62% |   1,119 |
| @cantoo/pdf-lib |    2.1K | 481us | 2.65ms | ±5.16% |   1,040 |

- **libpdf** is 3.52x faster than pdf-lib
- **libpdf** is 3.79x faster than @cantoo/pdf-lib

### Draw 50 rectangles

| Benchmark       | ops/sec |   Mean |    p99 |    RME | Samples |
| :-------------- | ------: | -----: | -----: | -----: | ------: |
| libpdf          |    2.8K |  359us |  993us | ±1.53% |   1,395 |
| pdf-lib         |   645.8 | 1.55ms | 6.17ms | ±7.77% |     323 |
| @cantoo/pdf-lib |   578.9 | 1.73ms | 6.75ms | ±6.69% |     290 |

- **libpdf** is 4.32x faster than pdf-lib
- **libpdf** is 4.82x faster than @cantoo/pdf-lib

### Load and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |    49.0 |  20.42ms |  32.87ms | ±7.09% |      25 |
| pdf-lib         |     3.1 | 321.70ms | 334.77ms | ±1.20% |      10 |
| @cantoo/pdf-lib |     1.7 | 582.71ms | 614.50ms | ±1.71% |      10 |

- **libpdf** is 15.75x faster than pdf-lib
- **libpdf** is 28.53x faster than @cantoo/pdf-lib

### Load, modify, and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| pdf-lib         |     3.2 | 314.62ms | 324.74ms | ±1.29% |      10 |
| libpdf          |     2.9 | 339.98ms | 360.15ms | ±1.81% |      10 |
| @cantoo/pdf-lib |     1.8 | 558.71ms | 589.71ms | ±3.53% |      10 |

- **pdf-lib** is 1.08x faster than libpdf
- **pdf-lib** is 1.78x faster than @cantoo/pdf-lib

### Extract single page from 100-page PDF

| Benchmark       | ops/sec |   Mean |     p99 |    RME | Samples |
| :-------------- | ------: | -----: | ------: | -----: | ------: |
| libpdf          |   276.7 | 3.61ms |  4.26ms | ±0.86% |     139 |
| pdf-lib         |   112.5 | 8.89ms | 11.96ms | ±1.80% |      57 |
| @cantoo/pdf-lib |   104.4 | 9.58ms | 15.05ms | ±3.36% |      53 |

- **libpdf** is 2.46x faster than pdf-lib
- **libpdf** is 2.65x faster than @cantoo/pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    24.6 | 40.69ms | 48.30ms | ±3.76% |      13 |
| pdf-lib         |    13.1 | 76.08ms | 81.24ms | ±5.16% |       7 |
| @cantoo/pdf-lib |    13.0 | 76.69ms | 79.50ms | ±1.76% |       7 |

- **libpdf** is 1.87x faster than pdf-lib
- **libpdf** is 1.88x faster than @cantoo/pdf-lib

### Split 2000-page PDF into single-page PDFs (0.9MB)

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |     1.3 | 760.62ms | 760.62ms | ±0.00% |       1 |
| pdf-lib         |   0.758 |    1.32s |    1.32s | ±0.00% |       1 |
| @cantoo/pdf-lib |   0.695 |    1.44s |    1.44s | ±0.00% |       1 |

- **libpdf** is 1.74x faster than pdf-lib
- **libpdf** is 1.89x faster than @cantoo/pdf-lib

### Copy 10 pages between documents

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |   219.1 |  4.56ms |  5.42ms | ±1.05% |     110 |
| pdf-lib         |    87.1 | 11.48ms | 13.09ms | ±1.33% |      44 |
| @cantoo/pdf-lib |    74.9 | 13.34ms | 19.00ms | ±3.12% |      38 |

- **libpdf** is 2.51x faster than pdf-lib
- **libpdf** is 2.92x faster than @cantoo/pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    64.8 | 15.44ms | 18.69ms | ±1.92% |      33 |
| pdf-lib         |    19.0 | 52.70ms | 54.00ms | ±1.06% |      10 |
| @cantoo/pdf-lib |    15.7 | 63.75ms | 67.52ms | ±2.25% |       8 |

- **libpdf** is 3.41x faster than pdf-lib
- **libpdf** is 4.13x faster than @cantoo/pdf-lib

### Fill FINTRAC form fields

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    49.9 | 20.06ms | 22.58ms | ±1.88% |      25 |
| pdf-lib         |    36.6 | 27.34ms | 37.33ms | ±5.23% |      19 |
| @cantoo/pdf-lib |    36.2 | 27.60ms | 36.59ms | ±4.65% |      19 |

- **libpdf** is 1.36x faster than pdf-lib
- **libpdf** is 1.38x faster than @cantoo/pdf-lib

### Fill and flatten FINTRAC form

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    58.3 | 17.17ms | 22.49ms | ±3.19% |      30 |
| pdf-lib         |  FAILED |       - |       - |      - |       0 |
| @cantoo/pdf-lib |    32.9 | 30.43ms | 46.78ms | ±7.32% |      17 |

- **libpdf** is 1.77x faster than @cantoo/pdf-lib

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |   Mean |     p99 |    RME | Samples |
| :------------------------------ | ------: | -----: | ------: | -----: | ------: |
| copy 1 page                     |   837.7 | 1.19ms |  2.91ms | ±3.89% |     419 |
| copy 10 pages from 100-page PDF |   212.6 | 4.70ms |  7.39ms | ±2.07% |     107 |
| copy all 100 pages              |   126.9 | 7.88ms | 10.26ms | ±1.44% |      64 |

- **copy 1 page** is 3.94x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 6.60x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------------- | ------: | -----: | -----: | -----: | ------: |
| duplicate page 0                          |   978.4 | 1.02ms | 1.40ms | ±0.66% |     490 |
| duplicate all pages (double the document) |   970.4 | 1.03ms | 1.43ms | ±0.80% |     486 |

- **duplicate page 0** is 1.01x faster than duplicate all pages (double the document)

### Merge PDFs

| Benchmark               | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------- | ------: | ------: | ------: | -----: | ------: |
| merge 2 small PDFs      |   630.4 |  1.59ms |  2.04ms | ±1.11% |     316 |
| merge 10 small PDFs     |   119.3 |  8.38ms | 14.66ms | ±3.25% |      60 |
| merge 2 x 100-page PDFs |    67.2 | 14.89ms | 20.54ms | ±2.46% |      34 |

- **merge 2 small PDFs** is 5.28x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 9.39x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------- | ------: | -----: | -----: | -----: | ------: |
| draw 100 lines                      |    1.7K |  575us | 1.19ms | ±1.26% |     871 |
| draw 100 rectangles                 |    1.6K |  630us | 1.39ms | ±1.95% |     794 |
| draw 100 circles                    |    1.1K |  920us | 1.83ms | ±1.59% |     544 |
| create 10 pages with mixed content  |   670.6 | 1.49ms | 2.77ms | ±2.15% |     336 |
| draw 100 text lines (standard font) |   618.8 | 1.62ms | 2.90ms | ±1.70% |     310 |

- **draw 100 lines** is 1.10x faster than draw 100 rectangles
- **draw 100 lines** is 1.60x faster than draw 100 circles
- **draw 100 lines** is 2.59x faster than create 10 pages with mixed content
- **draw 100 lines** is 2.81x faster than draw 100 text lines (standard font)

## Forms

| Benchmark         | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------- | ------: | ------: | ------: | -----: | ------: |
| read field values |   336.9 |  2.97ms |  5.86ms | ±3.00% |     169 |
| get form fields   |   301.6 |  3.32ms |  6.24ms | ±3.84% |     151 |
| flatten form      |   123.4 |  8.10ms | 10.70ms | ±1.73% |      62 |
| fill text fields  |    78.5 | 12.73ms | 17.13ms | ±4.35% |      40 |

- **read field values** is 1.12x faster than get form fields
- **read field values** is 2.73x faster than flatten form
- **read field values** is 4.29x faster than fill text fields

## Loading

| Benchmark              | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------- | ------: | ------: | ------: | -----: | ------: |
| load small PDF (888B)  |   15.7K |    64us |   183us | ±2.85% |   7,831 |
| load medium PDF (19KB) |   11.1K |    90us |   115us | ±0.45% |   5,548 |
| load form PDF (116KB)  |   779.9 |  1.28ms |  2.57ms | ±1.72% |     390 |
| load heavy PDF (2.0MB) |    56.3 | 17.78ms | 18.85ms | ±1.35% |      29 |

- **load small PDF (888B)** is 1.41x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 20.08x faster than load form PDF (116KB)
- **load small PDF (888B)** is 278.41x faster than load heavy PDF (2.0MB)

## Saving

| Benchmark                          | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------- | ------: | ------: | ------: | -----: | ------: |
| save unmodified (19KB)             |    8.6K |   117us |   345us | ±1.77% |   4,283 |
| incremental save (19KB)            |    5.5K |   182us |   395us | ±1.17% |   2,749 |
| save with modifications (19KB)     |    1.2K |   858us |  1.65ms | ±1.56% |     583 |
| save heavy PDF (2.0MB)             |    54.8 | 18.24ms | 20.15ms | ±1.17% |      28 |
| incremental save heavy PDF (2.0MB) |    52.1 | 19.21ms | 22.52ms | ±1.90% |      27 |

- **save unmodified (19KB)** is 1.56x faster than incremental save (19KB)
- **save unmodified (19KB)** is 7.35x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 156.23x faster than save heavy PDF (2.0MB)
- **save unmodified (19KB)** is 164.54x faster than incremental save heavy PDF (2.0MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |   922.0 |  1.08ms |  2.14ms | ±2.48% |     461 |
| extractPages (1 page from 100-page PDF)  |   274.6 |  3.64ms |  6.68ms | ±2.48% |     138 |
| extractPages (1 page from 2000-page PDF) |    17.7 | 56.42ms | 62.72ms | ±2.84% |      10 |

- **extractPages (1 page from small PDF)** is 3.36x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 52.02x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------------------- | ------: | -------: | -------: | -----: | ------: |
| split 100-page PDF (0.1MB)  |    24.7 |  40.56ms |  43.79ms | ±1.60% |      13 |
| split 2000-page PDF (0.9MB) |     1.4 | 727.67ms | 727.67ms | ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 17.94x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |    Mean |     p99 |    RME | Samples |
| :----------------------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extract first 10 pages from 2000-page PDF              |    17.5 | 57.13ms | 58.80ms | ±0.95% |       9 |
| extract first 100 pages from 2000-page PDF             |    16.3 | 61.31ms | 62.23ms | ±1.22% |       9 |
| extract every 10th page from 2000-page PDF (200 pages) |    15.0 | 66.51ms | 68.08ms | ±1.06% |       8 |

- **extract first 10 pages from 2000-page PDF** is 1.07x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.16x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
