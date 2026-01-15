import {
  BS,
  CHAR_ANGLE_BRACKET_CLOSE,
  CHAR_ANGLE_BRACKET_OPEN,
  CHAR_BACKSLASH,
  CHAR_HASH,
  CHAR_MINUS,
  CHAR_PARENTHESIS_CLOSE,
  CHAR_PARENTHESIS_OPEN,
  CHAR_PERCENT,
  CHAR_PERIOD,
  CHAR_PLUS,
  CHAR_SLASH,
  CHAR_SQUARE_BRACKET_CLOSE,
  CHAR_SQUARE_BRACKET_OPEN,
  CR,
  DIGIT_0,
  DIGIT_9,
  FF,
  hexValue,
  isDigit,
  isHexDigit,
  isRegularChar,
  LF,
  SINGLE_BYTE_MASK,
  TAB,
  WHITESPACE,
} from "#src/helpers/chars";
import type { Scanner } from "#src/io/scanner";

import type {
  DelimiterToken,
  KeywordToken,
  NameToken,
  NumberToken,
  StringToken,
  Token,
} from "./token";

/**
 * Shared TextDecoder instance to avoid creating new ones in hot paths.
 * TextDecoder is stateless when not using streaming mode, so it's safe to share.
 */
const sharedTextDecoder = new TextDecoder();

/**
 * On-demand tokenizer for PDF syntax.
 *
 * Reads tokens one at a time from a Scanner, handling whitespace,
 * comments, and lenient parsing of malformed input.
 */
export class TokenReader {
  private cachedToken: Token | null = null;

  constructor(private scanner: Scanner) {}

  get position(): number {
    return this.scanner.position;
  }

  /**
   * Peek at the next token without consuming it.
   */
  peekToken(): Token {
    if (this.cachedToken === null) {
      this.cachedToken = this.readToken();
    }

    return this.cachedToken;
  }

  /**
   * Read and consume the next token.
   */
  nextToken(): Token {
    if (this.cachedToken !== null) {
      const token = this.cachedToken;

      this.cachedToken = null;

      return token;
    }

    return this.readToken();
  }

  /**
   * Skip whitespace and comments.
   */
  skipWhitespaceAndComments(): void {
    while (true) {
      const byte = this.scanner.peek();

      if (byte === -1) {
        return;
      }

      if (WHITESPACE.has(byte)) {
        this.scanner.advance();
        continue;
      }

      // Comment: % to end of line
      if (byte === CHAR_PERCENT) {
        this.scanner.advance();
        this.skipToEndOfLine();
        continue;
      }

      return;
    }
  }

  /**
   * Peek at the next raw byte (after skipping whitespace/comments).
   */
  peekByte(): number {
    this.skipWhitespaceAndComments();

    return this.scanner.peek();
  }

  private skipToEndOfLine(): void {
    while (true) {
      const byte = this.scanner.peek();

      if (byte === -1 || byte === LF || byte === CR) {
        return;
      }

      this.scanner.advance();
    }
  }

  private readToken(): Token {
    this.skipWhitespaceAndComments();

    const position = this.scanner.position;
    const byte = this.scanner.peek();

    if (byte === -1) {
      return { type: "eof", position };
    }

    // Name: /...
    if (byte === CHAR_SLASH) {
      return this.readName(position);
    }

    // Literal string: (...)
    if (byte === CHAR_PARENTHESIS_OPEN) {
      return this.readLiteralString(position);
    }

    // Hex string or dict delimiter: < or <<
    if (byte === CHAR_ANGLE_BRACKET_OPEN) {
      return this.readAngleBracket(position);
    }

    // Dict end or unexpected >
    if (byte === CHAR_ANGLE_BRACKET_CLOSE) {
      return this.readClosingAngle(position);
    }

    // Array delimiters
    if (byte === CHAR_SQUARE_BRACKET_OPEN) {
      this.scanner.advance();

      return { type: "delimiter", value: "[", position };
    }

    if (byte === CHAR_SQUARE_BRACKET_CLOSE) {
      this.scanner.advance();

      return { type: "delimiter", value: "]", position };
    }

    // Number: digit, +, -, or .
    if (this.isNumberStart(byte)) {
      return this.readNumber(position);
    }

    // Keyword or unknown
    return this.readKeyword(position);
  }

  private isNumberStart(byte: number): boolean {
    return (
      (byte >= DIGIT_0 && byte <= DIGIT_9) || // 0-9
      byte === CHAR_PLUS || // +
      byte === CHAR_MINUS || // -
      byte === CHAR_PERIOD // .
    );
  }

  private readNumber(position: number): NumberToken | KeywordToken {
    const start = this.scanner.position;
    let hasDecimal = false;
    let hasDigit = false;
    let isNegative = false;

    // Handle leading sign
    const firstByte = this.scanner.peek();

    if (firstByte === CHAR_PLUS || firstByte === CHAR_MINUS) {
      isNegative = firstByte === CHAR_MINUS;
      this.scanner.advance();

      // Handle double negative (lenient) - if multiple negatives, ignore all
      // This matches PDFBox behavior: --5 → 5, ---5 → 5
      if (this.scanner.peek() === CHAR_MINUS) {
        isNegative = false;

        while (this.scanner.peek() === CHAR_MINUS) {
          this.scanner.advance();
        }
      }
    }

    // Track where digits start (after signs)
    const digitsStart = this.scanner.position;

    // Handle leading decimal
    if (this.scanner.peek() === CHAR_PERIOD) {
      hasDecimal = true;
      this.scanner.advance();
    }

    // Read digits
    while (true) {
      const byte = this.scanner.peek();

      if (isDigit(byte)) {
        hasDigit = true;
        this.scanner.advance();
        continue;
      }

      if (byte === CHAR_PERIOD && !hasDecimal) {
        hasDecimal = true;
        this.scanner.advance();
        continue;
      }

      break;
    }

    // Read any trailing digits after decimal
    if (hasDecimal) {
      while (isDigit(this.scanner.peek())) {
        hasDigit = true;
        this.scanner.advance();
      }
    }

    const end = this.scanner.position;

    // If we didn't get any digits, this might be a keyword starting with +/-/.
    if (!hasDigit) {
      // Read rest as keyword
      while (isRegularChar(this.scanner.peek())) {
        this.scanner.advance();
      }

      const fullText = this.extractText(start, this.scanner.position);

      return { type: "keyword", value: fullText, position };
    }

    // Extract just the numeric part (without multiple signs)
    const numericText = this.extractText(digitsStart, end);
    let value = parseFloat(numericText);

    if (isNegative) {
      value = -value;
    }

    const isInteger = !hasDecimal && Number.isInteger(value);

    return { type: "number", value, isInteger, position };
  }

  private readName(position: number): NameToken {
    // Skip the leading /
    this.scanner.advance();

    const bytes: number[] = [];

    while (true) {
      const byte = this.scanner.peek();

      if (!isRegularChar(byte)) {
        break;
      }

      this.scanner.advance();

      // Handle # hex escape
      if (byte === CHAR_HASH) {
        const hex1 = this.scanner.peek();

        if (isHexDigit(hex1)) {
          this.scanner.advance();

          const hex2 = this.scanner.peek();

          if (isHexDigit(hex2)) {
            this.scanner.advance();

            const value = (hexValue(hex1) << 4) | hexValue(hex2);

            bytes.push(value);
            continue;
          }

          // Lone hex digit after # - treat literally
          bytes.push(CHAR_HASH);
          bytes.push(hex1);
          continue;
        }

        // Lone # - treat literally
        bytes.push(CHAR_HASH);
        continue;
      }

      bytes.push(byte);
    }

    const value = sharedTextDecoder.decode(new Uint8Array(bytes));

    return { type: "name", value, position };
  }

  private readLiteralString(position: number): StringToken {
    // Skip opening (
    this.scanner.advance();

    const bytes: number[] = [];
    let parenDepth = 1;

    while (parenDepth > 0) {
      const byte = this.scanner.peek();

      if (byte === -1) {
        // Unterminated string - return what we have
        break;
      }

      this.scanner.advance();

      if (byte === CHAR_PARENTHESIS_OPEN) {
        // Nested (
        parenDepth++;
        bytes.push(byte);
        continue;
      }

      if (byte === CHAR_PARENTHESIS_CLOSE) {
        // Closing )
        parenDepth--;

        if (parenDepth > 0) {
          bytes.push(byte);
        }

        continue;
      }

      if (byte === CHAR_BACKSLASH) {
        // Escape sequence
        const escaped = this.readEscapeSequence();

        if (escaped !== null) {
          if (Array.isArray(escaped)) {
            bytes.push(...escaped);
          } else {
            bytes.push(escaped);
          }
        }

        continue;
      }

      // Normalize line endings to LF
      if (byte === CR) {
        // Check for CRLF
        if (this.scanner.peek() === LF) {
          this.scanner.advance();
        }

        bytes.push(LF);
        continue;
      }

      bytes.push(byte);
    }

    return {
      type: "string",
      value: new Uint8Array(bytes),
      format: "literal",
      position,
    };
  }

  private readEscapeSequence(): number | number[] | null {
    const byte = this.scanner.peek();

    if (byte === -1) {
      return null;
    }

    this.scanner.advance();

    switch (byte) {
      case 0x6e:
        return LF; // \n -> LF
      case 0x72:
        return CR; // \r -> CR
      case 0x74:
        return TAB; // \t -> TAB
      case 0x62:
        return BS; // \b -> BS
      case 0x66:
        return FF; // \f -> FF
      case CHAR_PARENTHESIS_OPEN:
        return CHAR_PARENTHESIS_OPEN; // \( -> (
      case CHAR_PARENTHESIS_CLOSE:
        return CHAR_PARENTHESIS_CLOSE; // \) -> )
      case CHAR_BACKSLASH:
        return CHAR_BACKSLASH; // \\ -> \
      case CR:
        // Line continuation: \ at end of line
        if (this.scanner.peek() === LF) {
          this.scanner.advance();
        }

        return null;
      case LF:
        // Line continuation
        return null;
      default:
        // Check for octal
        if (byte >= DIGIT_0 && byte <= 0x37) {
          return this.readOctalEscape(byte);
        }

        // Unknown escape - return literal character
        return byte;
    }
  }

  private readOctalEscape(firstDigit: number): number {
    let value = firstDigit - DIGIT_0;
    let digits = 1;

    while (digits < 3) {
      const byte = this.scanner.peek();

      if (byte < DIGIT_0 || byte > 0x37) {
        break;
      }

      this.scanner.advance();

      value = (value << 3) | (byte - DIGIT_0);
      digits++;
    }

    return value & SINGLE_BYTE_MASK;
  }

  private readAngleBracket(position: number): StringToken | DelimiterToken {
    this.scanner.advance(); // Skip first <

    // Check for <<
    if (this.scanner.peek() === CHAR_ANGLE_BRACKET_OPEN) {
      this.scanner.advance();

      return { type: "delimiter", value: "<<", position };
    }

    // Hex string
    return this.readHexString(position);
  }

  private readHexString(position: number): StringToken {
    const bytes: number[] = [];
    let pendingNibble: number | null = null;

    while (true) {
      const byte = this.scanner.peek();

      if (byte === -1 || byte === CHAR_ANGLE_BRACKET_CLOSE) {
        // EOF or >
        if (byte === CHAR_ANGLE_BRACKET_CLOSE) {
          this.scanner.advance();
        }

        break;
      }

      this.scanner.advance();

      // Skip whitespace inside hex string
      if (WHITESPACE.has(byte)) {
        continue;
      }

      if (isHexDigit(byte)) {
        const nibble = hexValue(byte);

        if (pendingNibble === null) {
          pendingNibble = nibble;
        } else {
          bytes.push((pendingNibble << 4) | nibble);
          pendingNibble = null;
        }
      }

      // Invalid character - skip with warning (lenient)
      // TODO: Add warning callback
    }

    // Odd number of hex digits - pad with 0
    if (pendingNibble !== null) {
      bytes.push(pendingNibble << 4);
    }

    return {
      type: "string",
      value: new Uint8Array(bytes),
      format: "hex",
      position,
    };
  }

  private readClosingAngle(position: number): DelimiterToken {
    this.scanner.advance(); // Skip first >

    // Check for >>
    if (this.scanner.peek() === CHAR_ANGLE_BRACKET_CLOSE) {
      this.scanner.advance();

      return { type: "delimiter", value: ">>", position };
    }

    // Lone > - shouldn't happen in valid PDF, but handle it
    // Return as >> anyway since > alone isn't valid
    return { type: "delimiter", value: ">>", position };
  }

  private readKeyword(position: number): KeywordToken {
    const start = this.scanner.position;

    while (isRegularChar(this.scanner.peek())) {
      this.scanner.advance();
    }

    const value = this.extractText(start, this.scanner.position);

    return { type: "keyword", value, position };
  }

  private extractText(start: number, end: number): string {
    const bytes = this.scanner.bytes.subarray(start, end);

    return sharedTextDecoder.decode(bytes);
  }
}
