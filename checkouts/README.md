# Reference Libraries

This directory contains git submodules of PDF libraries used as references during development.

## Libraries

### pdfbox (Apache PDFBox)

- **Language:** Java
- **Focus:** Comprehensive PDF manipulation
- **Strengths:** Battle-tested, feature-complete, excellent architecture
- **URL:** https://github.com/apache/pdfbox

### pdfjs (Mozilla pdf.js)

- **Language:** JavaScript
- **Focus:** PDF parsing and rendering for browsers
- **Strengths:** Robust parsing, handles malformed PDFs well
- **URL:** https://github.com/mozilla/pdf.js

### pdf-lib

- **Language:** TypeScript
- **Focus:** PDF creation and modification
- **Strengths:** Clean API, TypeScript-first, good for generation
- **URL:** https://github.com/Hopding/pdf-lib

## Usage

```bash
# Initialize submodules after cloning
git submodule update --init --recursive

# Update to latest
git submodule update --remote
```
