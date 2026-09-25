/**
 * CMap (character code to CID) for Type0 fonts.
 *
 * Thin wrapper over the fontbox CMap that adds the Identity-H/V predefined
 * CMaps and the encode-side helpers CompositeFont needs.
 */

import {
  CMap as FontboxCMap,
  CodespaceRange,
  parseCMap as parseFontboxCMap,
} from "#src/fontbox/cmap";

const IDENTITY_NAMES = new Set(["Identity-H", "Identity-V"]);

export class CMap {
  readonly name: string;
  readonly vertical: boolean;
  readonly isIdentity: boolean;

  private readonly inner: FontboxCMap;

  constructor(inner: FontboxCMap, name?: string) {
    this.inner = inner;
    this.name = inner.name ?? name ?? "";
    this.vertical = inner.wmode === 1;
    this.isIdentity = IDENTITY_NAMES.has(this.name);
  }

  /**
   * Look up the CID for a character code. Returns 0 (.notdef) if unmapped.
   */
  lookup(code: number, length?: number): number {
    return length === undefined ? this.inner.toCID(code) : this.inner.toCIDWithLength(code, length);
  }

  /**
   * Encode text to character codes.
   * Only Identity CMaps are supported, where codes are Unicode code points.
   */
  encode(text: string): number[] {
    if (!this.isIdentity) {
      throw new Error(`Encoding not supported for CMap: ${this.name}`);
    }

    return Array.from(text, char => char.codePointAt(0) ?? 0);
  }

  /**
   * Check if text can be encoded with this CMap.
   */
  canEncode(text: string): boolean {
    if (this.isIdentity) {
      return true;
    }

    for (let i = 0; i < text.length; i++) {
      if (this.inner.toCID(text.charCodeAt(i)) === 0) {
        return false;
      }
    }

    return true;
  }

  /**
   * Read one character code from a byte string, following the CMap's
   * codespace ranges.
   */
  readCharCode(bytes: Uint8Array, offset: number): { code: number; length: number } {
    const [code, length] = this.inner.readCode(bytes, offset);

    return { code, length };
  }

  /**
   * Get a predefined CMap by name.
   *
   * Only Identity-H and Identity-V are available. The Adobe CJK CMaps
   * (UniGB-UCS2-H, 90ms-RKSJ-H, ...) are not bundled and return null.
   */
  static getPredefined(name: string): CMap | null {
    if (name === "Identity-H") {
      return CMap.identityH();
    }

    if (name === "Identity-V") {
      return CMap.identityV();
    }

    return null;
  }

  static identityH(): CMap {
    return identity("Identity-H", 0);
  }

  static identityV(): CMap {
    return identity("Identity-V", 1);
  }
}

function identity(name: string, wmode: number): CMap {
  const inner = new FontboxCMap();
  const low = new Uint8Array([0x00, 0x00]);
  const high = new Uint8Array([0xff, 0xff]);

  inner.name = name;
  inner.wmode = wmode;
  inner.addCodespaceRange(new CodespaceRange(low, high));
  inner.addCIDRange(low, high, 0);

  return new CMap(inner);
}

/**
 * Parse an embedded CMap stream.
 *
 * @param data - Decoded stream content
 * @param name - Fallback name if the stream has no /CMapName
 */
export function parseCMap(data: Uint8Array, name?: string): CMap {
  return new CMap(parseFontboxCMap(data), name);
}
