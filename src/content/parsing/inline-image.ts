/**
 * Inline image EI (end inline image) detection.
 *
 * Ported from pdf.js's battle-tested implementation.
 * Handles filter-specific detection and heuristic fallback.
 */

import {
  CHAR_MINUS,
  CHAR_PERIOD,
  CHAR_PLUS,
  CR,
  DIGIT_0,
  DIGIT_9,
  isDelimiter,
  isWhitespace,
  LF,
  NUL,
  SPACE,
} from "#src/helpers/chars";
import type { Scanner } from "#src/io/scanner";

import { KNOWN_OPERATORS } from "./operators";
import type { ContentToken } from "./types";

const E = 0x45; // 'E'
const I = 0x49; // 'I'
const TILDE = 0x7e; // '~'
const GT = 0x3e; // '>'

/**
 * Result of inline image data extraction.
 */
export interface InlineImageData {
  data: Uint8Array;
  warnings: string[];
}

/**
 * Find the end of inline image data and extract it.
 *
 * Uses filter-specific detection when possible, falls back to heuristic.
 */
export function extractInlineImageData(
  scanner: Scanner,
  params: Map<string, ContentToken>,
): InlineImageData {
  const warnings: string[] = [];

  // Skip single whitespace after ID
  const firstByte = scanner.peek();

  if (firstByte === SPACE || firstByte === LF || firstByte === CR) {
    scanner.advance();

    // Handle CRLF
    if (firstByte === CR && scanner.peek() === LF) {
      scanner.advance();
    }
  }

  const startPos = scanner.position;

  // Try filter-specific detection
  const filter = params.get("F") ?? params.get("Filter");

  if (filter?.type === "name") {
    const filterName = filter.value;

    if (filterName === "DCT" || filterName === "DCTDecode") {
      const result = findDCTDecodeEnd(scanner, startPos);

      if (result !== null) {
        skipToEI(scanner);

        return { data: result, warnings };
      }

      warnings.push("DCT EOI marker not found, using heuristic detection");

      scanner.moveTo(startPos);
    }

    if (filterName === "A85" || filterName === "ASCII85Decode") {
      const result = findASCII85DecodeEnd(scanner, startPos);

      if (result !== null) {
        skipToEI(scanner);

        return { data: result, warnings };
      }

      warnings.push("ASCII85 EOD marker not found, using heuristic detection");

      scanner.moveTo(startPos);
    }

    if (filterName === "AHx" || filterName === "ASCIIHexDecode") {
      const result = findASCIIHexDecodeEnd(scanner, startPos);

      if (result !== null) {
        skipToEI(scanner);

        return { data: result, warnings };
      }

      warnings.push("ASCIIHex EOD marker not found, using heuristic detection");

      scanner.moveTo(startPos);
    }
  }

  // Fallback to heuristic detection
  const data = findDefaultInlineStreamEnd(scanner, startPos, warnings);

  return { data, warnings };
}

/**
 * Find the EOI (end-of-image) marker 0xFFD9 for DCT/JPEG.
 */
function findDCTDecodeEnd(scanner: Scanner, startPos: number): Uint8Array | null {
  let foundEOI = false;

  while (!scanner.isAtEnd) {
    const b = scanner.advance();

    if (b !== 0xff) {
      continue;
    }

    const marker = scanner.peek();

    switch (marker) {
      case 0x00: // Byte stuffing
        scanner.advance();
        break;

      case 0xff: // Fill byte - don't advance, might be start of real marker
        break;

      case 0xd9: // EOI
        scanner.advance();
        foundEOI = true;
        break;

      // Markers with length
      case 0xc0:
      case 0xc1:
      case 0xc2:
      case 0xc3: // SOF0-3
      case 0xc5:
      case 0xc6:
      case 0xc7: // SOF5-7
      case 0xc9:
      case 0xca:
      case 0xcb: // SOF9-11
      case 0xcd:
      case 0xce:
      case 0xcf: // SOF13-15
      case 0xc4: // DHT
      case 0xcc: // DAC
      case 0xda: // SOS
      case 0xdb: // DQT
      case 0xdc: // DNL
      case 0xdd: // DRI
      case 0xde: // DHP
      case 0xdf: // EXP
      case 0xe0:
      case 0xe1:
      case 0xe2:
      case 0xe3: // APP0-3
      case 0xe4:
      case 0xe5:
      case 0xe6:
      case 0xe7: // APP4-7
      case 0xe8:
      case 0xe9:
      case 0xea:
      case 0xeb: // APP8-11
      case 0xec:
      case 0xed:
      case 0xee:
      case 0xef: // APP12-15
      case 0xfe: {
        // COM
        scanner.advance(); // consume marker byte
        // Read length (big-endian 16-bit)
        const len1 = scanner.advance();
        const len2 = scanner.advance();

        if (len1 === -1 || len2 === -1) {
          break;
        }

        const markerLength = (len1 << 8) | len2;

        if (markerLength > 2) {
          // Skip segment content (length includes the 2 length bytes)
          for (let i = 0; i < markerLength - 2 && !scanner.isAtEnd; i++) {
            scanner.advance();
          }
        }

        break;
      }

      default:
        scanner.advance();
        break;
    }

    if (foundEOI) {
      break;
    }
  }

  if (!foundEOI) {
    return null;
  }

  return scanner.bytes.subarray(startPos, scanner.position);
}

/**
 * Find the EOD marker '~>' for ASCII85.
 */
function findASCII85DecodeEnd(scanner: Scanner, startPos: number): Uint8Array | null {
  while (!scanner.isAtEnd) {
    const ch = scanner.advance();

    if (ch === TILDE) {
      const tildePos = scanner.position;

      // Skip whitespace between ~ and >
      while (isWhitespace(scanner.peek())) {
        scanner.advance();
      }

      if (scanner.peek() === GT) {
        scanner.advance();

        return scanner.bytes.subarray(startPos, scanner.position);
      }

      // Handle truncated EOD (missing >) - check if next is EI
      if (scanner.position > tildePos) {
        const b1 = scanner.peek();
        const b2 = scanner.peekAt(scanner.position + 1);

        if (b1 === E && b2 === I) {
          return scanner.bytes.subarray(startPos, tildePos);
        }
      }
    }
  }

  return null;
}

/**
 * Find the EOD marker '>' for ASCIIHex.
 */
function findASCIIHexDecodeEnd(scanner: Scanner, startPos: number): Uint8Array | null {
  while (!scanner.isAtEnd) {
    const ch = scanner.advance();

    if (ch === GT) {
      return scanner.bytes.subarray(startPos, scanner.position);
    }
  }

  return null;
}

/**
 * Default heuristic detection for finding EI.
 *
 * Scans for "EI" followed by whitespace, then validates:
 * 1. Next bytes are ASCII (not binary)
 * 2. A valid PDF operator follows
 */
function findDefaultInlineStreamEnd(
  scanner: Scanner,
  startPos: number,
  warnings: string[],
): Uint8Array {
  const n = 15; // Number of bytes to check for ASCII
  let state = 0;
  let maybeEIPos: number | null = null;

  while (!scanner.isAtEnd) {
    const ch = scanner.advance();

    if (state === 0) {
      state = ch === E ? 1 : 0;
    } else if (state === 1) {
      state = ch === I ? 2 : 0;
    } else {
      // state === 2: Found "EI", check if followed by whitespace
      if (ch === SPACE || ch === LF || ch === CR) {
        maybeEIPos = scanner.position;

        // Check next n bytes are ASCII
        if (!checkFollowingBytesAreAscii(scanner, n)) {
          state = 0;

          continue;
        }

        // Validate a known operator follows
        if (!validateFollowingOperator(scanner)) {
          state = 0;

          continue;
        }

        // Found valid EI marker
        // Calculate data length: position after whitespace - 3 (for "EI" + whitespace)
        const dataEnd = scanner.position - 3;

        return scanner.bytes.subarray(startPos, dataEnd);
      }

      state = 0;
    }
  }

  // Reached EOF without finding valid EI
  warnings.push("Reached end of stream without finding valid EI marker");

  if (maybeEIPos !== null) {
    warnings.push("Recovering using last potential EI position");
    const dataEnd = maybeEIPos - 3;

    return scanner.bytes.subarray(startPos, Math.max(startPos, dataEnd));
  }

  // Return everything as data
  return scanner.bytes.subarray(startPos, scanner.position);
}

/**
 * Check that the next n bytes are ASCII (printable or line breaks).
 */
function checkFollowingBytesAreAscii(scanner: Scanner, n: number): boolean {
  const pos = scanner.position;

  for (let i = 0; i < n; i++) {
    const ch = scanner.peekAt(pos + i);

    if (ch === -1) {
      break; // EOF, that's fine
    }

    // Allow single NUL bytes (some PDFs have these)
    if (ch === NUL) {
      const nextCh = scanner.peekAt(pos + i + 1);

      if (nextCh !== NUL) {
        continue;
      }

      // Sequence of NULs = binary data
      return false;
    }

    // Must be LF, CR, or printable ASCII (0x20-0x7F)
    if (ch !== LF && ch !== CR && (ch < SPACE || ch > 0x7f)) {
      return false;
    }
  }

  return true;
}

/**
 * Validate that a known PDF operator follows.
 *
 * Parses ahead to find an operator and checks argument count.
 */
function validateFollowingOperator(scanner: Scanner): boolean {
  const pos = scanner.position;
  const lookahead = 75; // Check up to 75 bytes ahead

  let numArgs = 0;
  let i = 0;

  while (i < lookahead) {
    // Skip whitespace
    while (i < lookahead) {
      const ch = scanner.peekAt(pos + i);

      if (ch === -1) {
        return false;
      }

      if (!isWhitespace(ch)) {
        break;
      }

      i++;
    }

    if (i >= lookahead) {
      return false;
    }

    // Try to identify the next token
    const tokenStart = pos + i;
    const firstCh = scanner.peekAt(tokenStart);

    if (firstCh === -1) {
      return false;
    }

    // Check if it's a number (operand)
    if (isNumberStart(firstCh)) {
      // Skip the number
      i++;

      while (i < lookahead) {
        const ch = scanner.peekAt(pos + i);

        if (ch === -1 || isWhitespace(ch) || isDelimiter(ch)) {
          break;
        }

        i++;
      }

      numArgs++;

      continue;
    }

    // Check if it's a name (operand, starts with /)
    if (firstCh === 0x2f) {
      // Skip the name
      i++;

      while (i < lookahead) {
        const ch = scanner.peekAt(pos + i);

        if (ch === -1 || isWhitespace(ch) || isDelimiter(ch)) {
          break;
        }

        i++;
      }

      numArgs++;

      continue;
    }

    // Check if it's a string (operand, starts with ( or <)
    if (firstCh === 0x28 || firstCh === 0x3c) {
      // Skip past the string (simplified - just count as operand)
      i++;
      numArgs++;

      continue;
    }

    // Check if it's an array or dict (operand)
    if (firstCh === 0x5b || (firstCh === 0x3c && scanner.peekAt(pos + i + 1) === 0x3c)) {
      i++;
      numArgs++;

      continue;
    }

    // Must be a keyword/operator
    const wordStart = i;

    while (i < lookahead) {
      const ch = scanner.peekAt(pos + i);

      if (ch === -1 || isWhitespace(ch) || isDelimiter(ch)) {
        break;
      }

      i++;
    }

    // Extract the word
    const wordBytes: number[] = [];

    for (let j = wordStart; j < i; j++) {
      const ch = scanner.peekAt(pos + j);

      if (ch !== -1) {
        wordBytes.push(ch);
      }
    }

    const word = String.fromCharCode(...wordBytes);

    // Check if it's a keyword (true, false, null) - these are operands
    if (word === "true" || word === "false" || word === "null") {
      numArgs++;

      continue;
    }

    // It's an operator - validate it
    const opInfo = KNOWN_OPERATORS[word];

    if (!opInfo) {
      // Unknown operator - not valid
      return false;
    }

    // Check argument count
    if (opInfo.variableArgs) {
      if (numArgs <= opInfo.numArgs) {
        return true;
      }
    } else {
      if (numArgs === opInfo.numArgs) {
        return true;
      }
    }

    // Wrong arg count, but found an operator - try next one
    numArgs = 0;
  }

  return false;
}

function isNumberStart(ch: number): boolean {
  return (
    (ch >= DIGIT_0 && ch <= DIGIT_9) || // 0-9
    ch === CHAR_PLUS || // +
    ch === CHAR_MINUS || // -
    ch === CHAR_PERIOD // .
  );
}

/**
 * Skip past the EI operator after filter-specific detection.
 */
function skipToEI(scanner: Scanner): void {
  let state = 0;

  while (!scanner.isAtEnd) {
    const ch = scanner.advance();

    if (state === 0) {
      state = ch === E ? 1 : 0;

      continue;
    }

    if (state === 1) {
      state = ch === I ? 2 : 0;

      continue;
    }

    break;
  }
}
