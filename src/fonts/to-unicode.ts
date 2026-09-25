/**
 * ToUnicode CMap for text extraction.
 *
 * Thin wrapper over the fontbox CMap exposing the code-to-Unicode side.
 */

import { bytesToInt, CMap, intToBytes, parseCMap } from "#src/fontbox/cmap";

export class ToUnicodeMap {
  private readonly cmap: CMap;

  constructor(cmap: CMap = new CMap()) {
    this.cmap = cmap;
  }

  static fromEntries(entries: Iterable<[number, string]>): ToUnicodeMap {
    const map = new ToUnicodeMap();

    for (const [code, unicode] of entries) {
      map.set(code, unicode);
    }

    return map;
  }

  /**
   * Get the Unicode string for a character code.
   */
  get(code: number): string | undefined {
    return this.cmap.toUnicode(code);
  }

  has(code: number): boolean {
    return this.get(code) !== undefined;
  }

  get isEmpty(): boolean {
    return !this.cmap.hasUnicodeMappings();
  }

  /**
   * Add a mapping. The code is stored at its minimal byte width.
   */
  set(code: number, unicode: string): void {
    this.cmap.addCharMapping(intToBytes(code, byteWidth(code)), unicode);
  }

  /**
   * Reverse lookup: the character code that maps to a Unicode string.
   */
  getCodeForUnicode(unicode: string): number | undefined {
    const bytes = this.cmap.getCodesFromUnicode(unicode);

    return bytes ? bytesToInt(bytes) : undefined;
  }
}

function byteWidth(code: number): number {
  if (code <= 0xff) {
    return 1;
  }

  if (code <= 0xffff) {
    return 2;
  }

  return code <= 0xffffff ? 3 : 4;
}

/**
 * Parse a ToUnicode CMap stream.
 *
 * @param data - Decoded stream content
 */
export function parseToUnicode(data: Uint8Array): ToUnicodeMap {
  return new ToUnicodeMap(parseCMap(data));
}
