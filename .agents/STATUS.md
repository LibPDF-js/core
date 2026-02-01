# Implementation Status

Current implementation status of @libpdf/core features.

## Complete

- [x] I/O Layer (Scanner, BinaryWriter)
- [x] Objects Layer (PdfDict, PdfArray, PdfStream, etc.)
- [x] Filters (Flate, LZW, ASCII85, ASCIIHex, RunLength)
- [x] Parser Layer (TokenReader, ObjectParser, XRefParser, BruteForceParser)
- [x] DocumentParser with lazy loading and recovery
- [x] Encryption/decryption (R2-R6, RC4, AES-128, AES-256)
- [x] Writer (complete rewrite and incremental update)
- [x] High-level API (PDF, PDFPage, PDFForm, PDFImage)
- [x] Form filling, reading, and flattening
- [x] Form field creation (text, checkbox, radio, dropdown, listbox, signature)
- [x] Font parsing (SimpleFont, CompositeFont, CIDFont)
- [x] Font embedding with subsetting (TTF, OpenType/CFF)
- [x] Fontbox (TTF, CFF, Type1, AFM parsing)
- [x] Attachments (add, get, list, remove)
- [x] Page manipulation (add, insert, remove, move, copy)
- [x] PDF merge and split
- [x] Page embedding (Form XObjects for overlays/watermarks)
- [x] Content stream parsing
- [x] Digital signature creation (PAdES B-B, B-T, B-LT, B-LTA)
- [x] Signature signers (P12/PKCS#12, CryptoKey)
- [x] Timestamp authority support (RFC 3161)
- [x] Long-term validation (DSS, OCSP, CRL)
- [x] Image embedding (JPEG, PNG with alpha)
- [x] Drawing API (drawText, drawImage, drawRectangle, drawLine, drawCircle, drawEllipse, drawPath)
- [x] Text layout (word wrapping, alignment, multiline)
- [x] Layer (OCG) detection and flattening
- [x] Document encryption/protection API (setProtection, removeProtection)
- [x] Text extraction with position tracking and search
- [x] Annotation support (beta) - text markup, links, shapes, stamps, etc.
- [x] Annotation flattening

## Partial / In Progress

- [ ] Linearized PDF fast-open (detection only, no optimization)

## Not Yet Built

- [ ] Digital signature verification
- [ ] Certificate-based decryption (/Adobe.PubSec handler)
- [ ] Outline/bookmark support
- [ ] Metadata (XMP) editing
- [ ] PDF/A compliance
