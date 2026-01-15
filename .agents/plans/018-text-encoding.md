# Plan 018: Text Encoding

## Overview

Implement proper PDF text string encoding/decoding. PDF uses two encodings for text strings:

- **PDFDocEncoding** - Single-byte encoding (similar to Latin-1 with differences)
- **UTF-16BE with BOM** - For Unicode text outside PDFDocEncoding range

This is required before forms (field values) and fonts (ToUnicode maps).

## Current State

`PdfString` currently uses UTF-8, which is **incorrect** for PDF:

```typescript
// Current (wrong)
asString(): string {
  return new TextDecoder("utf-8").decode(this.bytes);
}
static fromString(str: string): PdfString {
  return new PdfString(new TextEncoder().encode(str), "literal");
}
```

## PDF Text String Encoding Rules

From PDF spec 7.9.2.2:

1. **Detection**: If bytes start with `FE FF` (UTF-16BE BOM), decode as UTF-16BE
2. **Otherwise**: Decode as PDFDocEncoding
3. **Writing**: Use PDFDocEncoding if all chars fit, otherwise UTF-16BE with BOM

## PDFDocEncoding

PDFDocEncoding is identical to Latin-1 (ISO-8859-1) except for bytes 0x80-0x9F and a few others:

| Range     | PDFDocEncoding                | Latin-1       |
| --------- | ----------------------------- | ------------- |
| 0x00-0x17 | Undefined                     | Control chars |
| 0x18-0x1F | Special chars (˘, ˇ, etc.)    | Control chars |
| 0x80-0x9F | Special chars (•, †, ‡, etc.) | Control chars |
| 0xAD      | Undefined                     | Soft hyphen   |

## Implementation

### Encoding Table

```typescript
// src/helpers/encoding.ts

/**
 * PDFDocEncoding to Unicode mapping for bytes 0x80-0xFF.
 * Bytes 0x00-0x7F map directly to Unicode (except some control chars).
 * Based on PDF spec Table D.2.
 */
const PDF_DOC_ENCODING_HIGH: Record<number, number> = {
  0x80: 0x2022, // BULLET
  0x81: 0x2020, // DAGGER
  0x82: 0x2021, // DOUBLE DAGGER
  0x83: 0x2026, // HORIZONTAL ELLIPSIS
  0x84: 0x2014, // EM DASH
  0x85: 0x2013, // EN DASH
  0x86: 0x0192, // LATIN SMALL LETTER F WITH HOOK
  0x87: 0x2044, // FRACTION SLASH
  0x88: 0x2039, // SINGLE LEFT-POINTING ANGLE QUOTATION MARK
  0x89: 0x203a, // SINGLE RIGHT-POINTING ANGLE QUOTATION MARK
  0x8a: 0x2212, // MINUS SIGN
  0x8b: 0x2030, // PER MILLE SIGN
  0x8c: 0x201e, // DOUBLE LOW-9 QUOTATION MARK
  0x8d: 0x201c, // LEFT DOUBLE QUOTATION MARK
  0x8e: 0x201d, // RIGHT DOUBLE QUOTATION MARK
  0x8f: 0x2018, // LEFT SINGLE QUOTATION MARK
  0x90: 0x2019, // RIGHT SINGLE QUOTATION MARK
  0x91: 0x201a, // SINGLE LOW-9 QUOTATION MARK
  0x92: 0x2122, // TRADE MARK SIGN
  0x93: 0xfb01, // LATIN SMALL LIGATURE FI
  0x94: 0xfb02, // LATIN SMALL LIGATURE FL
  0x95: 0x0141, // LATIN CAPITAL LETTER L WITH STROKE
  0x96: 0x0152, // LATIN CAPITAL LIGATURE OE
  0x97: 0x0160, // LATIN CAPITAL LETTER S WITH CARON
  0x98: 0x0178, // LATIN CAPITAL LETTER Y WITH DIAERESIS
  0x99: 0x017d, // LATIN CAPITAL LETTER Z WITH CARON
  0x9a: 0x0131, // LATIN SMALL LETTER DOTLESS I
  0x9b: 0x0142, // LATIN SMALL LETTER L WITH STROKE
  0x9c: 0x0153, // LATIN SMALL LIGATURE OE
  0x9d: 0x0161, // LATIN SMALL LETTER S WITH CARON
  0x9e: 0x017e, // LATIN SMALL LETTER Z WITH CARON
  0x9f: undefined, // UNDEFINED
  0xa0: 0x20ac, // EURO SIGN (replaces NBSP in some versions)
  // 0xA1-0xFF map to Unicode 0xA1-0xFF (same as Latin-1)
};

// Bytes 0x18-0x1F have special mappings
const PDF_DOC_ENCODING_LOW: Record<number, number> = {
  0x18: 0x02d8, // BREVE
  0x19: 0x02c7, // CARON
  0x1a: 0x02c6, // MODIFIER LETTER CIRCUMFLEX ACCENT
  0x1b: 0x02d9, // DOT ABOVE
  0x1c: 0x02dd, // DOUBLE ACUTE ACCENT
  0x1d: 0x02db, // OGONEK
  0x1e: 0x02da, // RING ABOVE
  0x1f: 0x02dc, // SMALL TILDE
};

/** Reverse mapping: Unicode to PDFDocEncoding byte */
const UNICODE_TO_PDF_DOC: Map<number, number>;
```

### Decoding Functions

```typescript
// src/helpers/encoding.ts

/**
 * Check if bytes start with UTF-16BE BOM (0xFE 0xFF).
 */
export function hasUtf16BOM(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff;
}

/**
 * Decode UTF-16BE bytes to string (skips BOM if present).
 */
export function decodeUtf16BE(bytes: Uint8Array): string {
  const start = hasUtf16BOM(bytes) ? 2 : 0;
  const chars: string[] = [];

  for (let i = start; i < bytes.length - 1; i += 2) {
    const code = (bytes[i] << 8) | bytes[i + 1];

    // Handle surrogate pairs
    if (code >= 0xd800 && code <= 0xdbff && i + 2 < bytes.length) {
      const low = (bytes[i + 2] << 8) | bytes[i + 3];
      if (low >= 0xdc00 && low <= 0xdfff) {
        const codePoint = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
        chars.push(String.fromCodePoint(codePoint));
        i += 2;
        continue;
      }
    }

    chars.push(String.fromCharCode(code));
  }

  return chars.join("");
}

/**
 * Decode PDFDocEncoding bytes to string.
 */
export function decodePdfDocEncoding(bytes: Uint8Array): string {
  const chars: string[] = [];

  for (const byte of bytes) {
    if (byte < 0x18) {
      // Control chars - skip or replace with space
      chars.push(byte === 0x09 || byte === 0x0a || byte === 0x0d ? String.fromCharCode(byte) : "");
    } else if (byte <= 0x1f) {
      // Special low bytes
      const code = PDF_DOC_ENCODING_LOW[byte];
      chars.push(code ? String.fromCharCode(code) : "");
    } else if (byte < 0x80) {
      // ASCII range - direct mapping
      chars.push(String.fromCharCode(byte));
    } else {
      // High bytes - use mapping table
      const code = PDF_DOC_ENCODING_HIGH[byte] ?? byte;
      chars.push(code ? String.fromCharCode(code) : "");
    }
  }

  return chars.join("");
}

/**
 * Decode PDF text string bytes (auto-detects encoding).
 */
export function decodeTextString(bytes: Uint8Array): string {
  if (hasUtf16BOM(bytes)) {
    return decodeUtf16BE(bytes);
  }
  return decodePdfDocEncoding(bytes);
}
```

### Encoding Functions

```typescript
// src/helpers/encoding.ts

/**
 * Check if a string can be encoded in PDFDocEncoding.
 */
export function canEncodePdfDoc(text: string): boolean {
  for (const char of text) {
    const code = char.codePointAt(0)!;
    if (!UNICODE_TO_PDF_DOC.has(code) && (code < 0x20 || code > 0xff)) {
      return false;
    }
  }
  return true;
}

/**
 * Encode string as PDFDocEncoding.
 * Throws if string contains characters not in PDFDocEncoding.
 */
export function encodePdfDocEncoding(text: string): Uint8Array {
  const bytes: number[] = [];

  for (const char of text) {
    const code = char.codePointAt(0)!;

    // Check reverse mapping first (for special chars)
    if (UNICODE_TO_PDF_DOC.has(code)) {
      bytes.push(UNICODE_TO_PDF_DOC.get(code)!);
    } else if (code >= 0x20 && code <= 0x7f) {
      // ASCII
      bytes.push(code);
    } else if (code >= 0xa1 && code <= 0xff) {
      // Latin-1 supplement (mostly direct)
      bytes.push(code);
    } else {
      throw new Error(`Cannot encode U+${code.toString(16).toUpperCase()} in PDFDocEncoding`);
    }
  }

  return new Uint8Array(bytes);
}

/**
 * Encode string as UTF-16BE with BOM.
 */
export function encodeUtf16BE(text: string): Uint8Array {
  const bytes: number[] = [0xfe, 0xff]; // BOM

  for (const char of text) {
    const code = char.codePointAt(0)!;

    if (code > 0xffff) {
      // Surrogate pair needed
      const adjusted = code - 0x10000;
      const high = 0xd800 + (adjusted >> 10);
      const low = 0xdc00 + (adjusted & 0x3ff);
      bytes.push(high >> 8, high & 0xff);
      bytes.push(low >> 8, low & 0xff);
    } else {
      bytes.push(code >> 8, code & 0xff);
    }
  }

  return new Uint8Array(bytes);
}

/**
 * Encode string for PDF text string.
 * Uses PDFDocEncoding if possible, otherwise UTF-16BE.
 */
export function encodeTextString(text: string): Uint8Array {
  if (canEncodePdfDoc(text)) {
    return encodePdfDocEncoding(text);
  }
  return encodeUtf16BE(text);
}
```

### PdfString Updates

```typescript
// src/objects/pdf-string.ts

import { decodeTextString, encodeTextString, canEncodePdfDoc } from "#src/helpers/encoding";

export class PdfString implements PdfPrimitive {
  // ... existing ...

  /**
   * Decode as PDF text string (auto-detects encoding).
   * Use this for field values, names, and other text content.
   */
  decodeText(): string {
    return decodeTextString(this.bytes);
  }

  /**
   * Create a PdfString from text (auto-selects encoding).
   * Uses PDFDocEncoding if possible, UTF-16BE otherwise.
   */
  static fromText(text: string): PdfString {
    const bytes = encodeTextString(text);
    // Use hex format for UTF-16 (cleaner), literal for PDFDoc
    const format = canEncodePdfDoc(text) ? "literal" : "hex";
    return new PdfString(bytes, format);
  }

  /**
   * @deprecated Use decodeText() for PDF text strings
   */
  asString(): string {
    return new TextDecoder("utf-8").decode(this.bytes);
  }

  /**
   * @deprecated Use fromText() for PDF text strings
   */
  static fromString(str: string): PdfString {
    const bytes = new TextEncoder().encode(str);
    return new PdfString(bytes, "literal");
  }
}
```

## File Structure

```
src/helpers/
├── encoding.ts           # NEW: PDFDocEncoding + UTF-16 functions
├── encoding.test.ts      # NEW: Encoding tests
└── ...

src/objects/
├── pdf-string.ts         # Updated with decodeText/fromText
└── ...
```

## Test Plan

### PDFDocEncoding

1. Decode ASCII range (0x20-0x7E)
2. Decode Latin-1 supplement (0xA1-0xFF)
3. Decode special bytes 0x80-0x9F (bullets, dashes, quotes)
4. Decode special bytes 0x18-0x1F (accents)
5. Skip/handle undefined bytes (0x00-0x17, 0x9F, 0xAD)
6. Encode ASCII string
7. Encode string with special chars (€, •, —)
8. Fail to encode CJK characters

### UTF-16BE

1. Detect BOM (0xFE 0xFF)
2. Decode simple UTF-16BE with BOM
3. Decode surrogate pairs (emoji, CJK extensions)
4. Handle odd-length bytes gracefully
5. Encode ASCII as UTF-16BE
6. Encode CJK characters
7. Encode emoji (surrogate pairs)

### Auto-Detection

1. `decodeTextString` with BOM → UTF-16BE
2. `decodeTextString` without BOM → PDFDocEncoding
3. `encodeTextString` ASCII → PDFDocEncoding
4. `encodeTextString` with € → PDFDocEncoding (0xA0)
5. `encodeTextString` with CJK → UTF-16BE

### PdfString Integration

1. `PdfString.fromText("Hello")` → literal format
2. `PdfString.fromText("你好")` → hex format, UTF-16BE
3. `PdfString.decodeText()` on PDFDoc bytes
4. `PdfString.decodeText()` on UTF-16BE bytes
5. Round-trip: `fromText(str).decodeText() === str`

### Edge Cases

1. Empty string
2. Single character
3. Mixed ASCII and special chars
4. String at PDFDocEncoding boundary (char that just fits)
5. Very long string
6. Null bytes in string

## Dependencies

None - this is a foundational module.

## References

- PDF 1.7 Spec: 7.9.2.2 (Text String Type)
- PDF 1.7 Spec: Appendix D (Character Sets and Encodings)
- pdf-lib: `src/utils/pdfDocEncoding.ts`, `src/utils/unicode.ts`
