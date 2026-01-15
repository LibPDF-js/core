# Test Fixtures

PDF test files sourced from Apache PDFBox test suite for integration testing.

## Directory Structure

### `basic/`

Minimal PDFs for basic parsing tests.

| File                            | Size | Description                                   |
| ------------------------------- | ---- | --------------------------------------------- |
| `rot0.pdf`                      | 888B | Simple 1-page PDF with text and standard xref |
| `document.pdf`                  | 1KB  | Minimal PDF with FlateDecode stream           |
| `SimpleForm2Fields.pdf`         | 1KB  | PDF with AcroForm (2 text fields)             |
| `page_tree_multiple_levels.pdf` | 2KB  | PDF with nested page tree structure           |
| `sample.pdf`                    | 19KB | General purpose PDF                           |

**Use for**: Phase 1-4 (io, cos, pdfparser, pdmodel core)

### `xref/`

XRef table and XRef stream parsing tests.

| File                    | Size | Description                                                          |
| ----------------------- | ---- | -------------------------------------------------------------------- |
| `simple-openoffice.pdf` | 15KB | Traditional xref table                                               |
| `hello3.pdf`            | 30KB | Hybrid PDF with both xref table and XRef stream, plus Object Streams |
| `sampleForSpec.pdf`     | 9KB  | XRef stream with Object Streams                                      |

**Use for**: Phase 3 (pdfparser - XrefParser, PDFXrefStreamParser)

### `filter/`

Stream compression/decompression tests.

| File              | Size | Description                       |
| ----------------- | ---- | --------------------------------- |
| `unencrypted.pdf` | 71KB | FlateDecode streams               |
| `lzw-sample.pdf`  | 44KB | LZWDecode + ASCII85Decode streams |

**Use for**: Phase 6 (filter package)

### `encryption/`

Encrypted PDF tests.

| File                        | Size | Encryption            |
| --------------------------- | ---- | --------------------- |
| `PasswordSample-40bit.pdf`  | 8KB  | RC4 40-bit (PDF 1.1)  |
| `PasswordSample-128bit.pdf` | 8KB  | RC4 128-bit (PDF 1.4) |
| `PasswordSample-256bit.pdf` | 8KB  | AES-256 (PDF 2.0)     |
| `AESkeylength128.pdf`       | 12KB | AES-128               |
| `AESkeylength256.pdf`       | 11KB | AES-256               |

**Use for**: Phase 11 (encryption)

### `malformed/`

Malformed/edge-case PDFs for error handling and recovery.

| File                       | Size | Issue                                     |
| -------------------------- | ---- | ----------------------------------------- |
| `MissingCatalog.pdf`       | 433B | Missing /Type /Catalog in root dictionary |
| `PDFBOX-3068.pdf`          | 801B | Edge case from JIRA                       |
| `PDFBOX-6040-nodeloop.pdf` | 398B | Node loop detection test                  |

**Use for**: BruteForceParser, error recovery testing

### `text/`

Text extraction tests.

| File                           | Size | Content                                 |
| ------------------------------ | ---- | --------------------------------------- |
| `rot0.pdf`                     | 888B | Simple text "Page rotation: 0"          |
| `yaddatest.pdf`                | 5KB  | Text content for extraction             |
| `openoffice-test-document.pdf` | 12KB | OpenOffice generated document with text |

**Use for**: Phase 8 (text extraction)

## Feature Coverage Matrix

| Feature                 | Test File(s)                                   |
| ----------------------- | ---------------------------------------------- |
| Traditional xref table  | `basic/rot0.pdf`, `xref/simple-openoffice.pdf` |
| XRef streams            | `xref/hello3.pdf`, `xref/sampleForSpec.pdf`    |
| Object streams (ObjStm) | `xref/hello3.pdf`, `xref/sampleForSpec.pdf`    |
| FlateDecode             | `basic/document.pdf`, `filter/unencrypted.pdf` |
| LZWDecode               | `filter/lzw-sample.pdf`                        |
| ASCII85Decode           | `filter/lzw-sample.pdf`                        |
| Page tree               | `basic/page_tree_multiple_levels.pdf`          |
| AcroForm                | `basic/SimpleForm2Fields.pdf`                  |
| Encryption (RC4)        | `encryption/PasswordSample-*.pdf`              |
| Encryption (AES)        | `encryption/AESkeylength*.pdf`                 |

## Source

All fixtures are from the Apache PDFBox test suite:

- `checkouts/pdfbox/pdfbox/src/test/resources/`
- `checkouts/pdfbox/examples/src/test/resources/`

## Adding New Fixtures

When adding fixtures:

1. Prefer small files (<50KB) for unit tests
2. Document the feature being tested
3. Note the source path from PDFBox
4. Update this README
