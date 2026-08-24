# Benchmark Report

> Generated on 2026-08-24 at 06:06:56 UTC
>
> System: darwin | Apple M4 Pro (12 cores) | 24GB RAM | Bun 1.3.14
>
> Libraries: @libpdf/core 0.4.1 (this repo), pdf-lib 1.17.1, @cantoo/pdf-lib 2.9.1

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
| libpdf          |   600.6 |  1.67ms |  2.10ms | ±0.70% |     301 |
| pdf-lib         |    32.5 | 30.81ms | 32.37ms | ±1.76% |      17 |
| @cantoo/pdf-lib |    31.9 | 31.35ms | 33.24ms | ±1.51% |      16 |

- **libpdf** is 18.50x faster than pdf-lib
- **libpdf** is 18.83x faster than @cantoo/pdf-lib

### Create blank PDF

| Benchmark       | ops/sec |  Mean |   p99 |    RME | Samples |
| :-------------- | ------: | ----: | ----: | -----: | ------: |
| libpdf          |   29.0K |  35us |  48us | ±0.78% |  14,484 |
| @cantoo/pdf-lib |    6.6K | 151us | 793us | ±2.20% |   3,321 |
| pdf-lib         |    6.1K | 165us | 739us | ±4.06% |   3,035 |

- **libpdf** is 4.36x faster than @cantoo/pdf-lib
- **libpdf** is 4.77x faster than pdf-lib

### Add 10 pages

| Benchmark       | ops/sec |  Mean |   p99 |    RME | Samples |
| :-------------- | ------: | ----: | ----: | -----: | ------: |
| libpdf          |   13.5K |  74us | 104us | ±1.01% |   6,753 |
| @cantoo/pdf-lib |    4.9K | 204us | 932us | ±2.07% |   2,457 |
| pdf-lib         |    4.5K | 224us | 931us | ±2.65% |   2,231 |

- **libpdf** is 2.75x faster than @cantoo/pdf-lib
- **libpdf** is 3.03x faster than pdf-lib

### Draw 50 rectangles

| Benchmark       | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------------- | ------: | ----: | -----: | -----: | ------: |
| libpdf          |    5.1K | 196us |  564us | ±1.09% |   2,545 |
| pdf-lib         |    1.5K | 665us | 2.31ms | ±4.29% |     752 |
| @cantoo/pdf-lib |    1.2K | 816us | 2.12ms | ±3.25% |     614 |

- **libpdf** is 3.39x faster than pdf-lib
- **libpdf** is 4.15x faster than @cantoo/pdf-lib

### Load and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |   587.3 |   1.70ms |   2.19ms | ±0.88% |     294 |
| pdf-lib         |    17.7 |  56.37ms |  59.79ms | ±2.40% |      10 |
| @cantoo/pdf-lib |     7.7 | 129.73ms | 132.91ms | ±1.06% |      10 |

- **libpdf** is 33.11x faster than pdf-lib
- **libpdf** is 76.20x faster than @cantoo/pdf-lib

### Load, modify, and save PDF

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |    33.2 |  30.14ms |  32.37ms | ±2.10% |      17 |
| pdf-lib         |    18.8 |  53.31ms |  58.30ms | ±2.85% |      10 |
| @cantoo/pdf-lib |     7.7 | 129.42ms | 131.52ms | ±0.82% |      10 |

- **libpdf** is 1.77x faster than pdf-lib
- **libpdf** is 4.29x faster than @cantoo/pdf-lib

### Extract single page from 100-page PDF

| Benchmark       | ops/sec |   Mean |    p99 |    RME | Samples |
| :-------------- | ------: | -----: | -----: | -----: | ------: |
| libpdf          |   405.7 | 2.47ms | 2.92ms | ±0.88% |     203 |
| pdf-lib         |   138.5 | 7.22ms | 8.24ms | ±1.63% |      70 |
| @cantoo/pdf-lib |   135.3 | 7.39ms | 9.13ms | ±1.23% |      68 |

- **libpdf** is 2.93x faster than pdf-lib
- **libpdf** is 3.00x faster than @cantoo/pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    39.1 | 25.55ms | 26.49ms | ±0.97% |      20 |
| @cantoo/pdf-lib |    23.8 | 41.93ms | 43.63ms | ±1.75% |      12 |
| pdf-lib         |    23.8 | 41.97ms | 44.67ms | ±2.63% |      12 |

- **libpdf** is 1.64x faster than @cantoo/pdf-lib
- **libpdf** is 1.64x faster than pdf-lib

### Split 2000-page PDF into single-page PDFs (0.9MB)

| Benchmark       | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------- | ------: | -------: | -------: | -----: | ------: |
| libpdf          |     2.0 | 494.73ms | 494.73ms | ±0.00% |       1 |
| pdf-lib         |     1.3 | 791.22ms | 791.22ms | ±0.00% |       1 |
| @cantoo/pdf-lib |     1.2 | 813.65ms | 813.65ms | ±0.00% |       1 |

- **libpdf** is 1.60x faster than pdf-lib
- **libpdf** is 1.64x faster than @cantoo/pdf-lib

### Copy 10 pages between documents

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |   323.5 |  3.09ms |  3.78ms | ±1.01% |     162 |
| pdf-lib         |   101.9 |  9.81ms | 10.87ms | ±1.34% |      51 |
| @cantoo/pdf-lib |    89.5 | 11.18ms | 12.49ms | ±1.64% |      45 |

- **libpdf** is 3.17x faster than pdf-lib
- **libpdf** is 3.62x faster than @cantoo/pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    93.0 | 10.76ms | 15.01ms | ±2.09% |      47 |
| pdf-lib         |    20.8 | 47.97ms | 50.44ms | ±1.84% |      11 |
| @cantoo/pdf-lib |    17.3 | 57.71ms | 59.50ms | ±1.32% |       9 |

- **libpdf** is 4.46x faster than pdf-lib
- **libpdf** is 5.37x faster than @cantoo/pdf-lib

### Fill FINTRAC form fields

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    75.2 | 13.30ms | 15.84ms | ±2.27% |      38 |
| pdf-lib         |    50.0 | 20.01ms | 22.70ms | ±1.83% |      25 |
| @cantoo/pdf-lib |    48.2 | 20.76ms | 22.46ms | ±1.77% |      25 |

- **libpdf** is 1.50x faster than pdf-lib
- **libpdf** is 1.56x faster than @cantoo/pdf-lib

### Fill and flatten FINTRAC form

| Benchmark       | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------------- | ------: | ------: | ------: | -----: | ------: |
| libpdf          |    86.6 | 11.55ms | 15.85ms | ±2.38% |      44 |
| pdf-lib         |  FAILED |       - |       - |      - |       0 |
| @cantoo/pdf-lib |    45.7 | 21.88ms | 24.74ms | ±2.53% |      23 |

- **libpdf** is 1.90x faster than @cantoo/pdf-lib

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |   Mean |    p99 |    RME | Samples |
| :------------------------------ | ------: | -----: | -----: | -----: | ------: |
| copy 1 page                     |    1.7K |  592us |  936us | ±0.84% |     845 |
| copy 10 pages from 100-page PDF |   327.7 | 3.05ms | 3.83ms | ±1.10% |     164 |
| copy all 100 pages              |   181.0 | 5.52ms | 7.38ms | ±1.61% |      91 |

- **copy 1 page** is 5.15x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 9.33x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |  Mean |    p99 |    RME | Samples |
| :---------------------------------------- | ------: | ----: | -----: | -----: | ------: |
| duplicate page 0                          |    1.5K | 671us | 1.06ms | ±1.06% |     745 |
| duplicate all pages (double the document) |    1.4K | 716us | 1.84ms | ±4.67% |     699 |

- **duplicate page 0** is 1.07x faster than duplicate all pages (double the document)

### Merge PDFs

| Benchmark               | ops/sec |    Mean |      p99 |     RME | Samples |
| :---------------------- | ------: | ------: | -------: | ------: | ------: |
| merge 2 small PDFs      |    1.0K |   989us |   1.33ms |  ±0.75% |     506 |
| merge 10 small PDFs     |   179.2 |  5.58ms |   6.47ms |  ±1.11% |      90 |
| merge 2 x 100-page PDFs |    69.3 | 14.44ms | 123.94ms | ±45.58% |      35 |

- **merge 2 small PDFs** is 5.64x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 14.59x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------- | ------: | -----: | -----: | -----: | ------: |
| draw 100 lines                      |    3.0K |  334us |  640us | ±0.93% |   1,496 |
| draw 100 rectangles                 |    2.9K |  347us |  613us | ±0.83% |   1,443 |
| draw 100 circles                    |    1.7K |  573us |  957us | ±0.96% |     873 |
| create 10 pages with mixed content  |    1.1K |  881us | 1.31ms | ±1.05% |     568 |
| draw 100 text lines (standard font) |   945.1 | 1.06ms | 1.46ms | ±0.95% |     473 |

- **draw 100 lines** is 1.04x faster than draw 100 rectangles
- **draw 100 lines** is 1.71x faster than draw 100 circles
- **draw 100 lines** is 2.63x faster than create 10 pages with mixed content
- **draw 100 lines** is 3.16x faster than draw 100 text lines (standard font)

## Forms

| Benchmark         | ops/sec |   Mean |     p99 |    RME | Samples |
| :---------------- | ------: | -----: | ------: | -----: | ------: |
| read field values |   542.3 | 1.84ms |  2.26ms | ±0.73% |     272 |
| get form fields   |   518.0 | 1.93ms |  2.52ms | ±1.05% |     259 |
| flatten form      |   176.2 | 5.68ms | 10.87ms | ±3.48% |      89 |
| fill text fields  |   134.7 | 7.42ms |  8.44ms | ±1.31% |      68 |

- **read field values** is 1.05x faster than get form fields
- **read field values** is 3.08x faster than flatten form
- **read field values** is 4.03x faster than fill text fields

## Loading

| Benchmark              | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------- | ------: | -----: | -----: | -----: | ------: |
| load small PDF (888B)  |   27.8K |   36us |   73us | ±0.64% |  13,897 |
| load medium PDF (19KB) |   16.1K |   62us |  120us | ±0.70% |   8,066 |
| load form PDF (116KB)  |    1.0K |  981us | 1.35ms | ±0.84% |     510 |
| load heavy PDF (9.9MB) |   614.0 | 1.63ms | 2.05ms | ±0.82% |     308 |

- **load small PDF (888B)** is 1.72x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 27.26x faster than load form PDF (116KB)
- **load small PDF (888B)** is 45.26x faster than load heavy PDF (9.9MB)

## Saving

| Benchmark                          | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------------------- | ------: | -----: | -----: | -----: | ------: |
| save unmodified (19KB)             |   14.2K |   70us |  173us | ±1.24% |   7,106 |
| incremental save (19KB)            |   10.6K |   94us |  169us | ±0.67% |   5,322 |
| save with modifications (19KB)     |    2.0K |  509us |  819us | ±0.69% |     983 |
| save heavy PDF (9.9MB)             |   585.1 | 1.71ms | 2.12ms | ±0.75% |     293 |
| incremental save heavy PDF (9.9MB) |   438.4 | 2.28ms | 2.65ms | ±0.98% |     220 |

- **save unmodified (19KB)** is 1.34x faster than incremental save (19KB)
- **save unmodified (19KB)** is 7.24x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 24.29x faster than save heavy PDF (9.9MB)
- **save unmodified (19KB)** is 32.42x faster than incremental save heavy PDF (9.9MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |    1.7K |   598us |   995us | ±0.93% |     836 |
| extractPages (1 page from 100-page PDF)  |   423.5 |  2.36ms |  2.75ms | ±0.71% |     212 |
| extractPages (1 page from 2000-page PDF) |    26.3 | 38.01ms | 39.35ms | ±0.86% |      14 |

- **extractPages (1 page from small PDF)** is 3.95x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 63.51x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------------------- | ------: | -------: | -------: | -----: | ------: |
| split 100-page PDF (0.1MB)  |    39.0 |  25.65ms |  26.87ms | ±1.14% |      20 |
| split 2000-page PDF (0.9MB) |     2.0 | 494.59ms | 494.59ms | ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 19.28x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |    Mean |     p99 |    RME | Samples |
| :----------------------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extract first 10 pages from 2000-page PDF              |    25.9 | 38.63ms | 41.22ms | ±1.42% |      14 |
| extract first 100 pages from 2000-page PDF             |    24.6 | 40.69ms | 41.49ms | ±1.09% |      13 |
| extract every 10th page from 2000-page PDF (200 pages) |    22.4 | 44.62ms | 45.13ms | ±0.59% |      12 |

- **extract first 10 pages from 2000-page PDF** is 1.05x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.15x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
