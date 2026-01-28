# 044: Fix Latin-1 / Accented Character Rendering with Standard 14 Fonts

## Problem

Drawing text with accented characters (á, é, ñ, ö, etc.) using Standard 14 fonts like Helvetica produces corrupted output. Characters render as mojibake because the content stream pipeline round-trips bytes through UTF-8, which destroys single-byte Latin-1 values.

**Root cause**: Three compounding issues in the content generation pipeline, plus a related width measurement bug:

1. **Wrong text encoding**: `encodeTextForFont()` (`pdf-page.ts:2433`) uses `PdfString.fromString()` which encodes via PDFDocEncoding (a metadata encoding), not WinAnsiEncoding (the font encoding Standard 14 fonts actually use). While the byte values happen to match for U+00A0–U+00FF, they diverge in the 0x80–0x9F range (€ is 0x80 in WinAnsi but 0xA0 in PDFDocEncoding; curly quotes, em dash, etc. all differ).

2. **UTF-8 round-trip corruption**: The pipeline converts `Operator` → `toString()` (UTF-8 decode via `TextDecoder`) → `appendContent(string)` → `TextEncoder.encode()` (UTF-8 encode). When a `PdfString` literal contains raw byte 0xE9 (WinAnsi `é`), the UTF-8 decode treats it as an invalid sequence and produces `U+FFFD`, destroying the original byte.

3. **Missing `/Encoding` in font dict**: The Standard 14 font dictionary (`pdf-page.ts:2392-2397`) is emitted without an `/Encoding` entry, so viewers fall back to the font's built-in encoding (typically StandardEncoding for Type1), not WinAnsiEncoding. Even if bytes were correct, the wrong encoding means wrong glyphs.

4. **Wrong width measurement**: `getGlyphName()` (`standard-14.ts:262`) only maps ASCII code points to glyph names. Any non-ASCII character (é, ñ, ü, etc.) falls through to return `"space"`, meaning `widthOfTextAtSize()` returns incorrect widths for accented text. This breaks text layout, line wrapping, and centering.

## Goals

- Accented Latin characters (á, é, ñ, ü, ß, €, etc.) render correctly with all Standard 14 fonts
- Symbol and ZapfDingbats fonts work correctly with their built-in encodings
- Text width measurement is correct for all WinAnsi characters
- Embedded fonts (Identity-H with GIDs) continue to work unchanged
- The content stream pipeline works with `Uint8Array` throughout, eliminating the UTF-8 round-trip
- Unencodable characters (CJK, emoji) produce `.notdef` by default with an option to throw

## Scope

### In scope

- Fix all four issues above
- Broad bytes-first refactor of the content stream pipeline (all callers move to bytes)
- Wire up WinAnsiEncoding for Standard 14 fonts (except Symbol/ZapfDingbats)
- Wire up SymbolEncoding and ZapfDingbatsEncoding for those two fonts
- Fix `getGlyphName()` to cover all WinAnsi non-ASCII glyph names
- Add tests for accented character rendering, width measurement, and all encoding paths

### Out of scope

- Custom encoding differences arrays
- Text extraction / parsing (already works correctly)

## Design

### The core insight

The content stream pipeline currently uses strings as an intermediate representation between operators and bytes. This is the fundamental problem — PDF content streams are binary, and shuttling them through JavaScript strings (which are UTF-16 internally) and then through UTF-8 TextEncoder/TextDecoder corrupts any non-ASCII bytes.

The fix makes the pipeline work with `Uint8Array` throughout, avoiding the string round-trip entirely. At the same time, we use `WinAnsiEncoding` (which already exists in the codebase but is only used for parsing) to properly encode text for Standard 14 fonts.

### Approach: bytes-first pipeline

The reporter's fix (converting string char-by-char via `charCodeAt & 0xFF`) works but is a band-aid that relies on JavaScript strings preserving Latin-1 byte values. Our approach is cleaner:

**1. `encodeTextForFont()` — use proper font encoding for all Standard 14 fonts**

Instead of `PdfString.fromString(text)` (PDFDocEncoding), select the correct encoding based on font name:

- **Helvetica, Times, Courier families** → `WinAnsiEncoding.instance`
- **Symbol** → `SymbolEncoding.instance`
- **ZapfDingbats** → `ZapfDingbatsEncoding.instance`

Call `encoding.encode(text)` to produce the correct byte values, then wrap in a hex-format `PdfString`. This properly handles the 0x80–0x9F range where PDFDocEncoding and WinAnsiEncoding differ.

**Unencodable characters**: By default, substitute with the `.notdef` glyph (byte 0x00). This matches PDF convention — the font's `.notdef` glyph typically renders as an empty box or blank space. Users who prefer a hard failure can pass an option to throw instead (see API below). The rationale: leniency by default matches the project's design principle of being tolerant, while the option gives strict users control.

**2. `appendContent()` / `appendOperators()` — broad bytes-first refactor**

Refactor the entire content pipeline to work with `Uint8Array`:

- `appendContent()` accepts `string | Uint8Array`. String inputs get `TextEncoder`'d (safe for ASCII-only callers like `drawPage` and `drawImage`). `Uint8Array` inputs pass through directly.
- `appendOperators()` uses `Operator.toBytes()` directly, concatenates into a `Uint8Array`, and passes bytes to `appendContent()`.
- `createContentStream()` gains a `Uint8Array` overload that skips the `TextEncoder` step.
- `prependContent()` gets the same `string | Uint8Array` treatment for consistency.
- `ContentAppender` type in `path-builder.ts` changes to `(content: string | Uint8Array) => void`.
- `PathBuilder.emitOps()` can migrate to bytes at its own pace — it only produces ASCII content (path operators, numbers), so the string path remains safe for it.

This is the principled fix: content streams are binary data, and the pipeline treats them as such. The `toString()` method on `Operator` remains for debugging/logging, but the serialization path uses `toBytes()`.

**3. `addFontResource()` — add `/Encoding` where appropriate**

| Font             | `/Encoding` value | Reason                                                                           |
| ---------------- | ----------------- | -------------------------------------------------------------------------------- |
| Helvetica family | `WinAnsiEncoding` | Explicit encoding ensures correct glyph mapping                                  |
| Times family     | `WinAnsiEncoding` | Same                                                                             |
| Courier family   | `WinAnsiEncoding` | Same                                                                             |
| Symbol           | _(omitted)_       | Uses built-in encoding; no valid `/Encoding` name exists per PDF spec Table 5.15 |
| ZapfDingbats     | _(omitted)_       | Same as Symbol                                                                   |

For Symbol and ZapfDingbats, `SymbolEncoding` / `ZapfDingbatsEncoding` are used only for Unicode → byte mapping in `encodeTextForFont()`. The font dict has no `/Encoding` entry because the PDF spec doesn't define named encodings for these fonts — their built-in encoding is implicit.

**4. Fix `getGlyphName()` for non-ASCII characters**

Extend the `CHAR_TO_GLYPH` map in `standard-14.ts` to cover all WinAnsi non-ASCII code points. The WinAnsiEncoding table maps Unicode code points to byte values, and the glyph width tables already have entries for all these glyphs (e.g., `eacute`, `ntilde`, `Euro`, `endash`, `Adieresis`). We need to bridge the gap: given a Unicode character, look up its glyph name so we can look up its width.

The approach: use `WinAnsiEncoding` to map Unicode → byte code, then use the Adobe Glyph List (already in `glyph-list.ts`) or a direct Unicode → glyph name mapping to find the glyph name. Alternatively, extend `CHAR_TO_GLYPH` with all the Latin-1 supplement and WinAnsi 0x80-0x9F entries directly.

### Why hex format for Standard 14 text?

Using hex format (`<E9>` instead of `(é)`) for Standard 14 font text strings is the most robust approach:

- **Defense-in-depth**: Even though the bytes pipeline is correct, hex format is immune to any future string-based manipulation of content streams
- **Precedent**: pdf-lib uses hex strings for all Standard 14 font text (see `StandardFontEmbedder.encodeText()`)
- **Simpler code**: No need to worry about escaping parentheses, backslashes, or non-ASCII bytes in literal strings
- **Trade-off**: Slightly larger output (2 hex chars per byte vs 1 byte in literal), but content streams are typically compressed anyway

### Changes summary

| File                              | Method/Area                        | Change                                                                                                   |
| --------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/api/pdf-page.ts`             | `encodeTextForFont()`              | Use WinAnsi/Symbol/ZapfDingbats encoding + hex `PdfString`; `.notdef` substitution for unencodable chars |
| `src/api/pdf-page.ts`             | `appendContent()`                  | Accept `string \| Uint8Array`; bytes pass through, strings get TextEncoder'd                             |
| `src/api/pdf-page.ts`             | `prependContent()`                 | Same dual-type support                                                                                   |
| `src/api/pdf-page.ts`             | `createContentStream()`            | Accept `string \| Uint8Array`; skip TextEncoder for bytes                                                |
| `src/api/pdf-page.ts`             | `appendOperators()`                | Use `Operator.toBytes()` directly, pass `Uint8Array`                                                     |
| `src/api/pdf-page.ts`             | `addFontResource()`                | Add `/Encoding WinAnsiEncoding` for non-Symbol/ZapfDingbats Standard 14 fonts                            |
| `src/api/drawing/path-builder.ts` | `ContentAppender` type             | Change to `(content: string \| Uint8Array) => void`                                                      |
| `src/fonts/standard-14.ts`        | `getGlyphName()` / `CHAR_TO_GLYPH` | Extend to cover all WinAnsi non-ASCII characters                                                         |

### Desired usage

From the user's perspective, nothing changes — the existing API just works:

```typescript
const page = pdf.addPage();

// Latin-1 accented characters work with Standard 14 fonts
page.drawText("Héllo café naïve résumé", {
  font: "Helvetica",
  x: 50,
  y: 700,
  size: 14,
});

// Characters in the 0x80-0x9F WinAnsi range also work
page.drawText("Price: €42 — "special" edition", {
  font: "Times-Roman",
  x: 50,
  y: 650,
  size: 14,
});

// Symbol and ZapfDingbats work with their own encodings
page.drawText("αβγδ", { font: "Symbol", x: 50, y: 600, size: 14 });

// Unencodable characters silently become .notdef (empty box) by default
page.drawText("Hello 世界", { font: "Helvetica", x: 50, y: 550, size: 14 });
// Renders: "Hello " followed by two empty boxes

// Width measurement is correct for accented text
const width = page.widthOfTextAtSize("café", "Helvetica", 12);
// Returns correct width using eacute glyph width, not space
```

## Test plan

### Rendering correctness

- Round-trip test: draw accented text ("café résumé naïve") with Helvetica, save, re-parse, extract text, verify it matches input
- Verify hex string encoding in content stream: `é` → byte `0xE9`, not UTF-8 `0xC3 0xA1`
- Test the full WinAnsi range including 0x80–0x9F characters (€, †, ‡, curly quotes, em dash, ellipsis)
- Test all Standard 14 font families (Helvetica, Times, Courier) with accented text

### Font dictionary

- Verify Helvetica/Times/Courier font dicts contain `/Encoding /WinAnsiEncoding`
- Verify Symbol font dict does **not** contain `/Encoding`
- Verify ZapfDingbats font dict does **not** contain `/Encoding`

### Symbol and ZapfDingbats

- Verify Symbol font correctly encodes Greek letters (α → correct Symbol byte)
- Verify ZapfDingbats correctly encodes decorative symbols

### Encoding edge cases

- Unencodable characters (CJK, emoji) produce `.notdef` byte (0x00) by default
- Embedded fonts continue to work unchanged (Identity-H path with GIDs)

### Width measurement

- `widthOfTextAtSize("é", "Helvetica", 1000)` returns `eacute` width (556), not `space` width (278)
- Width of "café" equals width of "caf" + width of "eacute" glyph
- Width correct for 0x80-0x9F characters (€ = Euro glyph width)

### Bytes pipeline

- Verify `appendContent(Uint8Array)` passes bytes through without TextEncoder transformation
- Verify `appendContent(string)` still works for ASCII content (drawImage, drawPage)
- PathBuilder operations still produce correct output

## Decisions made

1. **Bytes pipeline scope**: Broad — all content-producing paths move to `Uint8Array`, not just `appendOperators()`. The `ContentAppender` type becomes `string | Uint8Array` to allow gradual migration of callers.

2. **Hex vs literal format**: Always hex for Standard 14 text, as defense-in-depth. Even with the bytes pipeline fix, hex format provides immunity against any future string-based manipulation.

3. **Unencodable characters**: Default to `.notdef` glyph substitution (byte 0x00). The font's `.notdef` glyph typically renders as an empty box or blank. This is lenient-by-default per the project's design principles.

4. **Symbol and ZapfDingbats**: Wire up their proper encodings now. Use `SymbolEncoding.instance` and `ZapfDingbatsEncoding.instance` for Unicode → byte mapping. Omit `/Encoding` from the font dict (no valid named encoding exists per PDF spec Table 5.15 — the fonts use their built-in encoding implicitly).

5. **Width measurement**: Fix in this plan. Extend `CHAR_TO_GLYPH` in `standard-14.ts` to cover all WinAnsi non-ASCII characters. Without this, text layout (line wrapping, centering) would be broken for accented text even if rendering is fixed.
