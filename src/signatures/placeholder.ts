/**
 * Signature placeholder mechanism.
 *
 * Handles the creation and patching of ByteRange and Contents placeholders
 * for PDF digital signatures. This solves the chicken-and-egg problem where
 * the signature must be embedded in the PDF, but computed over the PDF bytes.
 *
 * PDF Reference: Section 12.8.1 "Signature Dictionary"
 */

import { bytesToHex } from "#src/helpers/buffer.ts";
import { PdfRaw } from "#src/objects/pdf-raw";

import { PlaceholderError } from "./types";

/** Default placeholder size in bytes (12KB) */
export const DEFAULT_PLACEHOLDER_SIZE = 12288;

/**
 * ByteRange array value placeholder.
 *
 * Format: `[0 <10chars> <10chars> <10chars>]`
 * - `[` = 1 char
 * - `0 ` = 2 chars
 * - 10 chars for length1
 * - ` ` = 1 char separator
 * - 10 chars for offset2
 * - ` ` = 1 char separator
 * - 10 chars for length2
 * - `]` = 1 char
 * - Total = 36 chars
 */
const BYTE_RANGE_VALUE_PLACEHOLDER = "[0 ********** ********** **********]";

/**
 * Full ByteRange placeholder including the key (for raw string writing).
 */
const BYTE_RANGE_PLACEHOLDER = `/ByteRange ${BYTE_RANGE_VALUE_PLACEHOLDER}`;

/**
 * Information about placeholder positions in the PDF buffer.
 */
export interface PlaceholderInfo {
  /** Start position of ByteRange value in buffer */
  byteRangeStart: number;
  /** Length of ByteRange value string */
  byteRangeLength: number;
  /** Start position of Contents hex string (after the '<') */
  contentsStart: number;
  /** Length of Contents hex string (not including '<' and '>') */
  contentsLength: number;
}

/**
 * The actual ByteRange values after calculation.
 */
export interface ByteRangeValues {
  /** Offset of first signed section (always 0) */
  offset1: number;
  /** Length of first signed section (bytes before Contents value) */
  length1: number;
  /** Offset of second signed section (after Contents value) */
  offset2: number;
  /** Length of second signed section (bytes after Contents value to end) */
  length2: number;
}

/**
 * Create a ByteRange placeholder string.
 *
 * The placeholder uses `*` characters padded to fixed width so we can
 * replace them in-place without changing byte positions.
 *
 * @returns The ByteRange placeholder string
 */
export function createByteRangePlaceholder(): string {
  return BYTE_RANGE_PLACEHOLDER;
}

/**
 * Create a ByteRange placeholder as a PdfRaw object.
 *
 * This can be used directly in a PdfDict and will serialize correctly.
 * Note: Returns only the array value, not the /ByteRange key.
 *
 * @returns PdfRaw object containing the ByteRange array placeholder
 */
export function createByteRangePlaceholderObject(): PdfRaw {
  return PdfRaw.fromString(BYTE_RANGE_VALUE_PLACEHOLDER);
}

/**
 * Create a Contents placeholder string.
 *
 * The placeholder is a hex string of zeros that will be replaced with
 * the actual signature.
 *
 * @param size - Size in bytes for the signature (will be 2x in hex)
 * @returns The Contents placeholder string (e.g., "<0000...0000>")
 */
export function createContentsPlaceholder(size: number = DEFAULT_PLACEHOLDER_SIZE): string {
  // Each byte becomes 2 hex chars
  const hexLength = size * 2;
  return `<${"0".repeat(hexLength)}>`;
}

/**
 * Create a Contents placeholder as a PdfRaw object.
 *
 * This can be used directly in a PdfDict and will serialize correctly.
 *
 * @param size - Size in bytes for the signature (will be 2x in hex)
 * @returns PdfRaw object containing the Contents placeholder
 */
export function createContentsPlaceholderObject(size: number = DEFAULT_PLACEHOLDER_SIZE): PdfRaw {
  return PdfRaw.fromString(createContentsPlaceholder(size));
}

/**
 * Find a byte sequence in a buffer (forward search).
 */
function findBytes(buffer: Uint8Array, pattern: Uint8Array, startFrom = 0): number {
  outer: for (let i = startFrom; i <= buffer.length - pattern.length; i++) {
    for (let j = 0; j < pattern.length; j++) {
      if (buffer[i + j] !== pattern[j]) {
        continue outer;
      }
    }

    return i;
  }

  return -1;
}

/**
 * Find a byte sequence in a buffer, searching backwards from the end.
 * Returns the LAST occurrence of the pattern.
 */
function findBytesReverse(buffer: Uint8Array, pattern: Uint8Array): number {
  outer: for (let i = buffer.length - pattern.length; i >= 0; i--) {
    for (let j = 0; j < pattern.length; j++) {
      if (buffer[i + j] !== pattern[j]) {
        continue outer;
      }
    }

    return i;
  }

  return -1;
}

/**
 * Find placeholder positions in a PDF buffer.
 *
 * Searches for the ByteRange and Contents placeholders and returns their positions.
 * The search is performed backwards from the end of the buffer to find the LAST
 * (newest) signature dictionary, which is important for PDFs with existing signatures.
 *
 * @param buffer - The PDF buffer to search
 * @returns Placeholder position information
 * @throws {Error} if placeholders cannot be found
 */
export function findPlaceholders(buffer: Uint8Array): PlaceholderInfo {
  const encoder = new TextEncoder();

  // Find ByteRange placeholder by searching backwards (find LAST occurrence)
  // This is critical for PDFs that already have signatures - we need to find
  // the placeholder in our newly appended incremental update, not existing signatures
  const byteRangeKey = encoder.encode("/ByteRange");

  const byteRangeKeyPos = findBytesReverse(buffer, byteRangeKey);

  if (byteRangeKeyPos === -1) {
    throw new Error("ByteRange placeholder not found in PDF");
  }

  // Find the '[' after /ByteRange
  let byteRangeStart = byteRangeKeyPos + byteRangeKey.length;

  while (byteRangeStart < buffer.length && buffer[byteRangeStart] !== 0x5b) {
    // '[' = 0x5B
    byteRangeStart++;
  }

  if (byteRangeStart >= buffer.length) {
    throw new Error("ByteRange '[' not found in PDF");
  }

  // Find the ']' to get the end
  let byteRangeEnd = byteRangeStart + 1;

  while (byteRangeEnd < buffer.length && buffer[byteRangeEnd] !== 0x5d) {
    // ']' = 0x5D
    byteRangeEnd++;
  }

  if (byteRangeEnd >= buffer.length) {
    throw new Error("ByteRange ']' not found in PDF");
  }

  const byteRangeLength = byteRangeEnd - byteRangeStart + 1;

  // Find Contents placeholder - look for /Contents followed by <
  const contentsKey = encoder.encode("/Contents");
  const contentsKeyPos = findBytes(buffer, contentsKey, byteRangeKeyPos);

  if (contentsKeyPos === -1) {
    throw new Error("Contents placeholder not found in PDF");
  }

  // Find the '<' after /Contents
  let contentsStart = contentsKeyPos + contentsKey.length;
  while (contentsStart < buffer.length && buffer[contentsStart] !== 0x3c) {
    // '<' = 0x3C
    contentsStart++;
  }

  if (contentsStart >= buffer.length) {
    throw new Error("Contents '<' not found in PDF");
  }

  // Move past the '<'
  contentsStart++;

  // Find the '>' to get the length
  let contentsEnd = contentsStart;

  while (contentsEnd < buffer.length && buffer[contentsEnd] !== 0x3e) {
    // '>' = 0x3E
    contentsEnd++;
  }

  if (contentsEnd >= buffer.length) {
    throw new Error("Contents '>' not found in PDF");
  }

  const contentsLength = contentsEnd - contentsStart;

  return {
    byteRangeStart,
    byteRangeLength,
    contentsStart,
    contentsLength,
  };
}

/**
 * Calculate the actual ByteRange values based on placeholder positions.
 *
 * The ByteRange is [offset1, length1, offset2, length2] where:
 * - offset1 = 0 (start of file)
 * - length1 = position just before Contents hex value
 * - offset2 = position just after Contents hex value
 * - length2 = remaining bytes to end of file
 *
 * @param buffer - The PDF buffer
 * @param placeholders - Placeholder position info
 * @returns The calculated ByteRange values
 */
export function calculateByteRange(
  buffer: Uint8Array,
  placeholders: PlaceholderInfo,
): ByteRangeValues {
  // First section: from start to just before Contents value (the '<' is excluded from signing)
  const offset1 = 0;
  const length1 = placeholders.contentsStart - 1; // -1 to exclude '<'

  // Second section: from just after Contents value to end (the '>' is excluded from signing)
  const offset2 = placeholders.contentsStart + placeholders.contentsLength + 1; // +1 to skip '>'
  const length2 = buffer.length - offset2;

  return {
    offset1,
    length1,
    offset2,
    length2,
  };
}

/**
 * Patch the ByteRange value in the buffer.
 *
 * Replaces the placeholder with actual values, padded with spaces to maintain
 * the exact same byte length.
 *
 * @param buffer - The PDF buffer to patch (modified in place)
 * @param placeholders - Placeholder position info
 * @param byteRange - The calculated ByteRange values
 */
export function patchByteRange(
  buffer: Uint8Array,
  placeholders: PlaceholderInfo,
  byteRange: ByteRangeValues,
): void {
  // Format: [0 length1 offset2 length2]
  // Each number field is 10 characters, space-padded on the right
  // Separators are single spaces
  const formatNumber = (n: number): string => {
    const str = n.toString();

    return str.padEnd(10, " ");
  };

  const newValue = `[0 ${formatNumber(byteRange.length1)} ${formatNumber(byteRange.offset2)} ${formatNumber(byteRange.length2)}]`;

  // Verify length matches
  if (newValue.length !== placeholders.byteRangeLength) {
    throw new Error(
      `ByteRange replacement length mismatch: expected ${placeholders.byteRangeLength}, got ${newValue.length}`,
    );
  }

  // Write the new value
  const encoder = new TextEncoder();
  const newBytes = encoder.encode(newValue);

  buffer.set(newBytes, placeholders.byteRangeStart);
}

/**
 * Patch the Contents value in the buffer.
 *
 * Replaces the placeholder zeros with the actual signature hex string.
 *
 * @param buffer - The PDF buffer to patch (modified in place)
 * @param placeholders - Placeholder position info
 * @param signature - The signature bytes to embed
 * @throws {PlaceholderError} if signature is too large for placeholder
 */
export function patchContents(
  buffer: Uint8Array,
  placeholders: PlaceholderInfo,
  signature: Uint8Array,
): { paddedHex: string } {
  // Convert signature to uppercase hex
  const hexSignature = bytesToHex(signature);

  // Check if it fits
  if (hexSignature.length > placeholders.contentsLength) {
    throw new PlaceholderError(signature.length, placeholders.contentsLength / 2);
  }

  // Pad with zeros on the right to fill the placeholder
  const paddedHex = hexSignature.padEnd(placeholders.contentsLength, "0");

  // Write the hex string
  const encoder = new TextEncoder();
  const hexBytes = encoder.encode(paddedHex);

  buffer.set(hexBytes, placeholders.contentsStart);

  return { paddedHex };
}

/**
 * Extract the byte ranges to be signed from the buffer.
 *
 * Returns the concatenated bytes that should be hashed for signing.
 *
 * @param buffer - The PDF buffer
 * @param byteRange - The ByteRange values
 * @returns Concatenated bytes to sign
 */
export function extractSignedBytes(buffer: Uint8Array, byteRange: ByteRangeValues): Uint8Array {
  const totalLength = byteRange.length1 + byteRange.length2;
  const result = new Uint8Array(totalLength);

  // Copy first section
  result.set(buffer.subarray(byteRange.offset1, byteRange.offset1 + byteRange.length1), 0);

  // Copy second section
  result.set(
    buffer.subarray(byteRange.offset2, byteRange.offset2 + byteRange.length2),
    byteRange.length1,
  );

  return result;
}
