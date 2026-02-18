/**
 * Buffer utilities for working with ArrayBuffer and Uint8Array.
 */

/**
 * Ensure we have a proper ArrayBuffer (not SharedArrayBuffer or slice).
 *
 * Web Crypto APIs require a true ArrayBuffer, not a view into one.
 *
 * @param data - Uint8Array to convert
 * @returns ArrayBuffer containing the data
 */
export function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  if (
    data.buffer instanceof ArrayBuffer &&
    data.byteOffset === 0 &&
    data.byteLength === data.buffer.byteLength
  ) {
    return data.buffer;
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

/**
 * Concatenate multiple Uint8Arrays into a single Uint8Array.
 *
 * @param arrays - Arrays to concatenate
 * @returns Single Uint8Array containing all data
 */
export function concatBytes(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);

  let offset = 0;

  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }

  return result;
}

/** Pre-computed hex lookup: byte value → "XX" uppercase string. */
export const HEX_TABLE: string[] = new Array(256);

for (let i = 0; i < 256; i++) {
  HEX_TABLE[i] = i.toString(16).toUpperCase().padStart(2, "0");
}

/**
 * Convert bytes to uppercase hex string.
 *
 * @param bytes - Raw bytes
 * @returns Hex string (e.g., "48656C6C6F")
 *
 * @example
 * ```ts
 * bytesToHex(new Uint8Array([72, 101, 108, 108, 111])) // "48656C6C6F"
 * ```
 */
export function bytesToHex(bytes: Uint8Array): string {
  let hex = "";

  for (const byte of bytes) {
    hex += HEX_TABLE[byte];
  }

  return hex;
}

/**
 * Convert a hex string to bytes.
 *
 * Whitespace is ignored. Odd-length strings are padded with trailing 0.
 *
 * @param hex - Hex string (e.g., "48656C6C6F" or "48 65 6C 6C 6F")
 * @returns Decoded bytes
 *
 * @example
 * ```ts
 * hexToBytes("48656C6C6F") // Uint8Array([72, 101, 108, 108, 111])
 * hexToBytes("ABC") // Uint8Array([171, 192]) - padded to "ABC0"
 * ```
 */
export function hexToBytes(hex: string): Uint8Array {
  // Remove whitespace
  const clean = hex.replace(/\s/g, "");

  // Pad odd-length with trailing 0
  const padded = clean.length % 2 === 1 ? `${clean}0` : clean;

  const bytes = new Uint8Array(padded.length / 2);

  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(padded.slice(i * 2, i * 2 + 2), 16);
  }

  return bytes;
}
