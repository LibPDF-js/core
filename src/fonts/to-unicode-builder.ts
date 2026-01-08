/**
 * ToUnicode CMap Builder - Generates ToUnicode CMaps for embedded fonts.
 *
 * The ToUnicode CMap allows PDF readers to extract searchable/copyable text
 * from PDFs. It maps character codes (CIDs) to Unicode strings.
 *
 * Format:
 * ```
 * /CIDInit /ProcSet findresource begin
 * 12 dict begin
 * begincmap
 * /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def
 * /CMapName /Adobe-Identity-UCS def
 * /CMapType 2 def
 * 1 begincodespacerange
 * <0000> <FFFF>
 * endcodespacerange
 * n beginbfchar
 * <XXXX> <YYYY>
 * ...
 * endbfchar
 * endcmap
 * CMapName currentdict /CMap defineresource pop
 * end
 * end
 * ```
 */

/**
 * Build a ToUnicode CMap stream from a GID to code point mapping.
 *
 * With CIDToGIDMap /Identity, the content stream contains GIDs.
 * The ToUnicode CMap maps these GIDs back to Unicode code points
 * for text extraction (copy/paste, search).
 *
 * @param gidToCodePoint - Map from GID to Unicode code point
 * @returns The ToUnicode CMap as a Uint8Array
 */
export function buildToUnicodeCMapFromGids(gidToCodePoint: Map<number, number>): Uint8Array {
  const lines: string[] = [];

  // CMap header
  lines.push("/CIDInit /ProcSet findresource begin");
  lines.push("12 dict begin");
  lines.push("begincmap");
  lines.push("/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def");
  lines.push("/CMapName /Adobe-Identity-UCS def");
  lines.push("/CMapType 2 def");

  // Codespace range - cover all 2-byte codes
  lines.push("1 begincodespacerange");
  lines.push("<0000> <FFFF>");
  lines.push("endcodespacerange");

  // Build bfchar entries
  // Group into chunks of 100 (PDF limit per section)
  const entries = [...gidToCodePoint.entries()].sort((a, b) => a[0] - b[0]);

  let i = 0;

  while (i < entries.length) {
    const chunk = entries.slice(i, i + 100);
    lines.push(`${chunk.length} beginbfchar`);

    for (const [gid, codePoint] of chunk) {
      // Map GID (what's in content stream) → Unicode code point
      const gidHex = toHex4(gid);
      const unicodeHex = toUnicodeHex(codePoint);
      lines.push(`<${gidHex}> <${unicodeHex}>`);
    }

    lines.push("endbfchar");
    i += 100;
  }

  // CMap footer
  lines.push("endcmap");
  lines.push("CMapName currentdict /CMap defineresource pop");
  lines.push("end");
  lines.push("end");

  return new TextEncoder().encode(lines.join("\n"));
}

/**
 * @deprecated Use buildToUnicodeCMapFromGids instead.
 * Build a ToUnicode CMap stream from a code point to Unicode mapping.
 *
 * @param codePointToUnicode - Map from character codes (code points for Identity-H)
 *                            to Unicode strings
 * @returns The ToUnicode CMap as a Uint8Array
 */
export function buildToUnicodeCMap(codePointToUnicode: Map<number, number>): Uint8Array {
  const lines: string[] = [];

  // CMap header
  lines.push("/CIDInit /ProcSet findresource begin");
  lines.push("12 dict begin");
  lines.push("begincmap");
  lines.push("/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def");
  lines.push("/CMapName /Adobe-Identity-UCS def");
  lines.push("/CMapType 2 def");

  // Codespace range - cover all 2-byte codes
  lines.push("1 begincodespacerange");
  lines.push("<0000> <FFFF>");
  lines.push("endcodespacerange");

  // Build bfchar entries
  // Group into chunks of 100 (PDF limit per section)
  const entries = [...codePointToUnicode.entries()].sort((a, b) => a[0] - b[0]);

  let i = 0;

  while (i < entries.length) {
    const chunk = entries.slice(i, i + 100);
    lines.push(`${chunk.length} beginbfchar`);

    for (const [code, _gid] of chunk) {
      // For Identity-H, the code is the Unicode code point
      // The "destination" in ToUnicode is what the code should map to (also the code point)
      const codeHex = toHex4(code);
      const unicodeHex = toUnicodeHex(code);
      lines.push(`<${codeHex}> <${unicodeHex}>`);
    }

    lines.push("endbfchar");
    i += 100;
  }

  // CMap footer
  lines.push("endcmap");
  lines.push("CMapName currentdict /CMap defineresource pop");
  lines.push("end");
  lines.push("end");

  return new TextEncoder().encode(lines.join("\n"));
}

/**
 * Build a ToUnicode CMap from a mapping where codes may differ from Unicode.
 *
 * @param codeToUnicode - Map from character codes to Unicode code points
 * @returns The ToUnicode CMap as a Uint8Array
 */
export function buildToUnicodeCMapFromMapping(codeToUnicode: Map<number, number>): Uint8Array {
  const lines: string[] = [];

  // CMap header
  lines.push("/CIDInit /ProcSet findresource begin");
  lines.push("12 dict begin");
  lines.push("begincmap");
  lines.push("/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def");
  lines.push("/CMapName /Adobe-Identity-UCS def");
  lines.push("/CMapType 2 def");

  // Codespace range
  lines.push("1 begincodespacerange");
  lines.push("<0000> <FFFF>");
  lines.push("endcodespacerange");

  // Build bfchar entries
  const entries = [...codeToUnicode.entries()].sort((a, b) => a[0] - b[0]);

  // Try to combine consecutive ranges
  const ranges: Array<{ startCode: number; endCode: number; startUnicode: number }> = [];
  const singles: Array<{ code: number; unicode: number }> = [];

  let rangeStart: { code: number; unicode: number } | null = null;
  let prev: { code: number; unicode: number } | null = null;

  for (const [code, unicode] of entries) {
    if (prev && code === prev.code + 1 && unicode === prev.unicode + 1) {
      // Continue range
      prev = { code, unicode };
    } else {
      // End previous range
      if (rangeStart && prev && prev.code > rangeStart.code) {
        ranges.push({
          startCode: rangeStart.code,
          endCode: prev.code,
          startUnicode: rangeStart.unicode,
        });
      } else if (prev) {
        singles.push(prev);
      }

      rangeStart = { code, unicode };
      prev = { code, unicode };
    }
  }

  // Handle last entry
  if (rangeStart && prev && prev.code > rangeStart.code) {
    ranges.push({
      startCode: rangeStart.code,
      endCode: prev.code,
      startUnicode: rangeStart.unicode,
    });
  } else if (prev) {
    singles.push(prev);
  }

  // Write bfrange sections
  if (ranges.length > 0) {
    let i = 0;

    while (i < ranges.length) {
      const chunk = ranges.slice(i, i + 100);
      lines.push(`${chunk.length} beginbfrange`);

      for (const range of chunk) {
        const startHex = toHex4(range.startCode);
        const endHex = toHex4(range.endCode);
        const unicodeHex = toUnicodeHex(range.startUnicode);
        lines.push(`<${startHex}> <${endHex}> <${unicodeHex}>`);
      }

      lines.push("endbfrange");
      i += 100;
    }
  }

  // Write bfchar sections for singles
  if (singles.length > 0) {
    let i = 0;

    while (i < singles.length) {
      const chunk = singles.slice(i, i + 100);
      lines.push(`${chunk.length} beginbfchar`);

      for (const single of chunk) {
        const codeHex = toHex4(single.code);
        const unicodeHex = toUnicodeHex(single.unicode);
        lines.push(`<${codeHex}> <${unicodeHex}>`);
      }

      lines.push("endbfchar");
      i += 100;
    }
  }

  // CMap footer
  lines.push("endcmap");
  lines.push("CMapName currentdict /CMap defineresource pop");
  lines.push("end");
  lines.push("end");

  return new TextEncoder().encode(lines.join("\n"));
}

/**
 * Convert a number to a 4-digit hex string (for 2-byte codes).
 */
function toHex4(n: number): string {
  return n.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Convert a Unicode code point to its hex representation.
 * For BMP characters, this is 4 hex digits.
 * For characters outside BMP, this is 8 hex digits (UTF-16 surrogate pair).
 */
function toUnicodeHex(codePoint: number): string {
  if (codePoint <= 0xffff) {
    return toHex4(codePoint);
  }

  // UTF-16 surrogate pair for characters outside BMP
  const high = Math.floor((codePoint - 0x10000) / 0x400) + 0xd800;
  const low = ((codePoint - 0x10000) % 0x400) + 0xdc00;

  return toHex4(high) + toHex4(low);
}
