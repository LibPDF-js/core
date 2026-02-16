# Benchmark Report

> Generated on 2026-02-16 at 12:50:00 UTC
>
> System: darwin | Apple M4 Pro (12 cores) | 24GB RAM | Bun 1.3.5

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

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |   895.0 |  1.12ms |  1.59ms | ±1.07% |     448 |
| pdf-lib   |    36.7 | 27.21ms | 29.03ms | ±1.90% |      19 |

- **libpdf** is 24.35x faster than pdf-lib

### Create blank PDF

| Benchmark | ops/sec | Mean |   p99 |    RME | Samples |
| :-------- | ------: | ---: | ----: | -----: | ------: |
| libpdf    |   38.6K | 26us |  45us | ±0.84% |  19,283 |
| pdf-lib   |   10.3K | 97us | 461us | ±1.82% |   5,172 |

- **libpdf** is 3.73x faster than pdf-lib

### Add 10 pages

| Benchmark | ops/sec |  Mean |   p99 |    RME | Samples |
| :-------- | ------: | ----: | ----: | -----: | ------: |
| libpdf    |   19.1K |  52us |  87us | ±0.91% |   9,562 |
| pdf-lib   |    6.3K | 158us | 770us | ±2.55% |   3,173 |

- **libpdf** is 3.01x faster than pdf-lib

### Draw 50 rectangles

| Benchmark | ops/sec |   Mean |    p99 |    RME | Samples |
| :-------- | ------: | -----: | -----: | -----: | ------: |
| pdf-lib   |    2.2K |  458us | 1.80ms | ±3.80% |   1,093 |
| libpdf    |   627.4 | 1.59ms | 2.30ms | ±1.44% |     314 |

- **pdf-lib** is 3.48x faster than libpdf

### Load and save PDF

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |   909.3 |  1.10ms |  1.48ms | ±0.88% |     456 |
| pdf-lib   |    22.0 | 45.45ms | 58.21ms | ±6.77% |      11 |

- **libpdf** is 41.33x faster than pdf-lib

### Load, modify, and save PDF

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |    37.9 | 26.38ms | 33.50ms | ±5.76% |      20 |
| pdf-lib   |    23.1 | 43.25ms | 44.89ms | ±1.52% |      12 |

- **libpdf** is 1.64x faster than pdf-lib

### Extract single page from 100-page PDF

| Benchmark | ops/sec |   Mean |    p99 |    RME | Samples |
| :-------- | ------: | -----: | -----: | -----: | ------: |
| libpdf    |   503.4 | 1.99ms | 3.10ms | ±1.55% |     252 |
| pdf-lib   |   155.9 | 6.41ms | 7.44ms | ±1.53% |      79 |

- **libpdf** is 3.23x faster than pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |    35.3 | 28.29ms | 29.79ms | ±1.35% |      18 |
| pdf-lib   |    35.0 | 28.58ms | 32.30ms | ±3.07% |      18 |

- **libpdf** is 1.01x faster than pdf-lib

### Copy 10 pages between documents

| Benchmark | ops/sec |   Mean |     p99 |    RME | Samples |
| :-------- | ------: | -----: | ------: | -----: | ------: |
| libpdf    |   334.0 | 2.99ms |  3.55ms | ±1.12% |     168 |
| pdf-lib   |   103.7 | 9.64ms | 14.95ms | ±3.70% |      52 |

- **libpdf** is 3.22x faster than pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |    47.1 | 21.23ms | 24.31ms | ±2.08% |      24 |
| pdf-lib   |    22.9 | 43.64ms | 47.48ms | ±2.23% |      12 |

- **libpdf** is 2.06x faster than pdf-lib

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |    Mean |     p99 |    RME | Samples |
| :------------------------------ | ------: | ------: | ------: | -----: | ------: |
| copy 1 page                     |    2.3K |   429us |   735us | ±1.26% |   1,166 |
| copy 10 pages from 100-page PDF |   344.1 |  2.91ms |  3.57ms | ±1.12% |     173 |
| copy all 100 pages              |    92.3 | 10.84ms | 13.86ms | ±1.96% |      47 |

- **copy 1 page** is 6.78x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 25.27x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |  Mean |   p99 |    RME | Samples |
| :---------------------------------------- | ------: | ----: | ----: | -----: | ------: |
| duplicate all pages (double the document) |    2.2K | 461us | 798us | ±0.89% |   1,086 |
| duplicate page 0                          |    2.2K | 464us | 758us | ±0.77% |   1,078 |

- **duplicate all pages (double the document)** is 1.01x faster than duplicate page 0

### Merge PDFs

| Benchmark               | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------- | ------: | ------: | ------: | -----: | ------: |
| merge 2 small PDFs      |    1.4K |   712us |  1.12ms | ±1.00% |     702 |
| merge 10 small PDFs     |   254.5 |  3.93ms |  5.73ms | ±2.08% |     128 |
| merge 2 x 100-page PDFs |    48.6 | 20.58ms | 26.32ms | ±3.33% |      25 |

- **merge 2 small PDFs** is 5.51x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 28.89x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------- | ------: | -----: | -----: | -----: | ------: |
| draw 100 lines                      |   399.8 | 2.50ms | 2.74ms | ±0.51% |     200 |
| draw 100 rectangles                 |   360.3 | 2.78ms | 3.55ms | ±1.22% |     181 |
| draw 100 circles                    |   279.7 | 3.58ms | 4.42ms | ±1.33% |     140 |
| draw 100 text lines (standard font) |   259.5 | 3.85ms | 4.29ms | ±0.61% |     130 |
| create 10 pages with mixed content  |   193.0 | 5.18ms | 6.40ms | ±1.35% |      97 |

- **draw 100 lines** is 1.11x faster than draw 100 rectangles
- **draw 100 lines** is 1.43x faster than draw 100 circles
- **draw 100 lines** is 1.54x faster than draw 100 text lines (standard font)
- **draw 100 lines** is 2.07x faster than create 10 pages with mixed content

## Forms

| Benchmark         | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------- | ------: | -----: | -----: | -----: | ------: |
| read field values |   702.6 | 1.42ms | 1.85ms | ±0.97% |     352 |
| get form fields   |   677.3 | 1.48ms | 2.36ms | ±1.45% |     339 |
| flatten form      |   198.8 | 5.03ms | 5.84ms | ±1.28% |     100 |
| fill text fields  |   155.1 | 6.45ms | 7.36ms | ±1.25% |      78 |

- **read field values** is 1.04x faster than get form fields
- **read field values** is 3.53x faster than flatten form
- **read field values** is 4.53x faster than fill text fields

## Loading

| Benchmark              | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------- | ------: | -----: | -----: | -----: | ------: |
| load small PDF (888B)  |   38.7K |   26us |   37us | ±1.10% |  19,336 |
| load medium PDF (19KB) |   23.8K |   42us |   54us | ±0.84% |  11,904 |
| load form PDF (116KB)  |    1.6K |  639us | 1.07ms | ±0.96% |     782 |
| load heavy PDF (9.9MB) |   909.7 | 1.10ms | 1.46ms | ±0.81% |     455 |

- **load small PDF (888B)** is 1.62x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 24.73x faster than load form PDF (116KB)
- **load small PDF (888B)** is 42.51x faster than load heavy PDF (9.9MB)

## Saving

| Benchmark                          | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------------------- | ------: | -----: | -----: | -----: | ------: |
| save unmodified (19KB)             |   22.2K |   45us |   63us | ±0.78% |  11,103 |
| incremental save (19KB)            |    6.9K |  144us |  373us | ±1.14% |   3,461 |
| save with modifications (19KB)     |    2.4K |  422us |  799us | ±0.97% |   1,185 |
| save heavy PDF (9.9MB)             |   850.9 | 1.18ms | 1.58ms | ±0.91% |     426 |
| incremental save heavy PDF (9.9MB) |   494.7 | 2.02ms | 2.37ms | ±0.74% |     248 |

- **save unmodified (19KB)** is 3.21x faster than incremental save (19KB)
- **save unmodified (19KB)** is 9.37x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 26.10x faster than save heavy PDF (9.9MB)
- **save unmodified (19KB)** is 44.89x faster than incremental save heavy PDF (9.9MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |    2.2K |   452us |   931us | ±1.63% |   1,106 |
| extractPages (1 page from 100-page PDF)  |   536.3 |  1.86ms |  3.04ms | ±1.54% |     269 |
| extractPages (1 page from 2000-page PDF) |    24.7 | 40.43ms | 42.46ms | ±2.46% |      13 |

- **extractPages (1 page from small PDF)** is 4.12x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 89.36x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------------------- | ------: | -------: | -------: | -----: | ------: |
| split 100-page PDF (0.1MB)  |    32.2 |  31.02ms |  35.44ms | ±2.72% |      17 |
| split 2000-page PDF (0.9MB) |     1.8 | 550.66ms | 550.66ms | ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 17.75x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |    Mean |     p99 |    RME | Samples |
| :----------------------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extract first 10 pages from 2000-page PDF              |    23.3 | 42.90ms | 46.80ms | ±3.59% |      12 |
| extract first 100 pages from 2000-page PDF             |    20.1 | 49.79ms | 52.72ms | ±2.98% |      11 |
| extract every 10th page from 2000-page PDF (200 pages) |    18.6 | 53.74ms | 59.30ms | ±3.19% |      10 |

- **extract first 10 pages from 2000-page PDF** is 1.16x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.25x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
