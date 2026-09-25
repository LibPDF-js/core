/**
 * CMap Parser - parses CMap stream data.
 *
 * CMap streams are PostScript-like programs that define character mappings.
 * They contain operators like:
 * - begincodespacerange / endcodespacerange
 * - beginbfchar / endbfchar (Unicode mappings)
 * - beginbfrange / endbfrange (Unicode range mappings)
 * - begincidchar / endcidchar (CID mappings)
 * - begincidrange / endcidrange (CID range mappings)
 */

import { CMap } from "./cmap.ts";
import { CodespaceRange } from "./codespace-range.ts";
import { createStringFromBytes, incrementBytes } from "./utils.ts";

// Token types
type LiteralName = { type: "name"; name: string };
type Operator = { type: "operator"; op: string };
type Token =
  | LiteralName
  | Operator
  | Uint8Array // hex string
  | number
  | string // literal string
  | Token[] // array
  | Map<string, unknown> // dictionary
  | null;

/**
 * Parse a CMap from bytes.
 * @param data CMap data
 * @param strictMode Use strict mode for inline CMaps
 * @returns Parsed CMap
 */
export function parseCMap(data: Uint8Array, strictMode = false): CMap {
  return new CMapParser(data, strictMode).parse();
}

/**
 * CMap parser implementation.
 */
class CMapParser {
  private readonly data: Uint8Array;
  private readonly strictMode: boolean;
  private position = 0;

  constructor(data: Uint8Array, strictMode: boolean) {
    this.data = data;
    this.strictMode = strictMode;
  }

  parse(): CMap {
    const result = new CMap();
    let previousToken: Token = null;
    let token = this.parseNextToken();

    while (token !== null) {
      if (isOperator(token)) {
        if (token.op === "endcmap") {
          break;
        }

        if (token.op === "usecmap" && isName(previousToken)) {
          // usecmap not supported (would need external CMap lookup)
          // In PDF context, the PDF reader handles this
        } else if (typeof previousToken === "number") {
          switch (token.op) {
            case "begincodespacerange":
              this.parseCodespaceRange(previousToken, result);
              break;
            case "beginbfchar":
              this.parseBfChar(previousToken, result);
              break;
            case "beginbfrange":
              this.parseBfRange(previousToken, result);
              break;
            case "begincidchar":
              this.parseCidChar(previousToken, result);
              break;
            case "begincidrange":
              this.parseCidRange(previousToken, result);
              break;
          }
        }
      } else if (isName(token)) {
        this.parseLiteralName(token, result);
      }

      previousToken = token;
      token = this.parseNextToken();
    }

    return result;
  }

  private parseLiteralName(literal: LiteralName, result: CMap): void {
    switch (literal.name) {
      case "WMode": {
        const next = this.parseNextToken();

        if (typeof next === "number") {
          result.wmode = next;
        }

        break;
      }
      case "CMapName": {
        const next = this.parseNextToken();

        if (isName(next)) {
          result.name = next.name;
        }

        break;
      }
      case "CMapVersion": {
        const next = this.parseNextToken();

        if (typeof next === "number" || typeof next === "string") {
          result.version = String(next);
        }

        break;
      }
      case "CMapType": {
        const next = this.parseNextToken();

        if (typeof next === "number") {
          result.type = next;
        }

        break;
      }
      case "CIDSystemInfo": {
        // CIDSystemInfo is followed by a dictionary with Registry, Ordering, Supplement
        const next = this.parseNextToken();

        if (next instanceof Map) {
          const registry = next.get("Registry");

          if (typeof registry === "string") {
            result.registry = registry;
          }

          const ordering = next.get("Ordering");

          if (typeof ordering === "string") {
            result.ordering = ordering;
          }

          const supplement = next.get("Supplement");

          if (typeof supplement === "number") {
            result.supplement = supplement;
          }
        }

        break;
      }
      case "Registry": {
        const next = this.parseNextToken();

        if (typeof next === "string") {
          result.registry = next;
        }

        break;
      }
      case "Ordering": {
        const next = this.parseNextToken();

        if (typeof next === "string") {
          result.ordering = next;
        }

        break;
      }
      case "Supplement": {
        const next = this.parseNextToken();

        if (typeof next === "number") {
          result.supplement = next;
        }

        break;
      }
    }
  }

  private parseCodespaceRange(count: number, result: CMap): void {
    for (let i = 0; i < count; i++) {
      const startToken = this.parseNextToken();

      if (isOperator(startToken)) {
        break;
      }

      if (!(startToken instanceof Uint8Array)) {
        throw new Error("Expected hex string for codespace range start");
      }

      const endToken = this.parseNextToken();

      if (!(endToken instanceof Uint8Array)) {
        throw new Error("Expected hex string for codespace range end");
      }

      result.addCodespaceRange(new CodespaceRange(startToken, endToken));
    }
  }

  private parseBfChar(count: number, result: CMap): void {
    for (let i = 0; i < count; i++) {
      const inputToken = this.parseNextToken();

      if (isOperator(inputToken)) {
        break;
      }

      if (!(inputToken instanceof Uint8Array)) {
        throw new Error("Expected hex string for bfchar input code");
      }

      const outputToken = this.parseNextToken();

      if (outputToken instanceof Uint8Array) {
        result.addCharMapping(inputToken, createStringFromBytes(outputToken));
      } else if (isName(outputToken)) {
        result.addCharMapping(inputToken, outputToken.name);
      } else {
        throw new Error("Expected hex string or name for bfchar output");
      }
    }
  }

  private parseBfRange(count: number, result: CMap): void {
    for (let i = 0; i < count; i++) {
      const startToken = this.parseNextToken();

      if (isOperator(startToken)) {
        break;
      }

      if (!(startToken instanceof Uint8Array)) {
        throw new Error("Expected hex string for bfrange start");
      }

      const endToken = this.parseNextToken();

      if (isOperator(endToken)) {
        break;
      }

      if (!(endToken instanceof Uint8Array)) {
        throw new Error("Expected hex string for bfrange end");
      }

      const start = bytesToInt(startToken);
      const end = bytesToInt(endToken);

      if (end < start) {
        // Corrupt range - skip
        break;
      }

      const mappingToken = this.parseNextToken();

      if (Array.isArray(mappingToken)) {
        // Array of mappings
        this.addBfRangeFromArray(result, startToken, mappingToken);
      } else if (mappingToken instanceof Uint8Array) {
        if (mappingToken.length > 0) {
          // Special case: identity mapping <0000> <ffff> <0000>
          // Handle this by breaking into 256 chunks of 256 to avoid strict mode overflow
          if (
            mappingToken.length === 2 &&
            start === 0 &&
            end === 0xffff &&
            mappingToken[0] === 0 &&
            mappingToken[1] === 0
          ) {
            this.addIdentityBfRange(result, startToken);
          } else {
            this.addBfRangeFromBytes(result, startToken, end - start + 1, mappingToken);
          }
        }
      }
    }
  }

  /**
   * Handle identity bfrange <0000> <ffff> <0000> by breaking into 256 chunks.
   * This avoids the strict mode overflow issue when incrementing across byte boundaries.
   */
  private addIdentityBfRange(result: CMap, startCode: Uint8Array): void {
    const code = startCode.slice();
    const mapping = new Uint8Array(2);

    for (let highByte = 0; highByte < 256; highByte++) {
      code[0] = highByte;
      code[1] = 0;
      mapping[0] = highByte;
      mapping[1] = 0;

      this.addBfRangeFromBytes(result, code, 256, mapping);
    }
  }

  private addBfRangeFromArray(result: CMap, startCode: Uint8Array, mappings: Token[]): void {
    const code = startCode.slice();

    for (const mapping of mappings) {
      if (mapping instanceof Uint8Array) {
        result.addCharMapping(code, createStringFromBytes(mapping));

        incrementBytes(code, code.length - 1, false);
      }
    }
  }

  private addBfRangeFromBytes(
    result: CMap,
    startCode: Uint8Array,
    count: number,
    tokenBytes: Uint8Array,
  ): void {
    const code = startCode.slice();
    const mapping = tokenBytes.slice();

    for (let i = 0; i < count; i++) {
      result.addCharMapping(code, createStringFromBytes(mapping));

      if (!incrementBytes(mapping, mapping.length - 1, this.strictMode)) {
        // Overflow in strict mode - stop
        break;
      }

      incrementBytes(code, code.length - 1, false);
    }
  }

  private parseCidChar(count: number, result: CMap): void {
    for (let i = 0; i < count; i++) {
      const inputToken = this.parseNextToken();

      if (isOperator(inputToken)) {
        break;
      }

      if (!(inputToken instanceof Uint8Array)) {
        throw new Error("Expected hex string for cidchar input code");
      }

      const cidToken = this.parseNextToken();

      if (typeof cidToken !== "number") {
        throw new Error("Expected integer for cidchar CID");
      }

      result.addCIDMapping(inputToken, cidToken);
    }
  }

  private parseCidRange(count: number, result: CMap): void {
    for (let i = 0; i < count; i++) {
      const startToken = this.parseNextToken();

      if (isOperator(startToken)) {
        break;
      }

      if (!(startToken instanceof Uint8Array)) {
        throw new Error("Expected hex string for cidrange start");
      }

      const endToken = this.parseNextToken();

      if (!(endToken instanceof Uint8Array)) {
        throw new Error("Expected hex string for cidrange end");
      }

      const cidToken = this.parseNextToken();

      if (typeof cidToken !== "number") {
        throw new Error("Expected integer for cidrange CID");
      }

      if (startToken.length !== endToken.length) {
        throw new Error("cidrange start and end must have same length");
      }

      // Check if it's a single value (some CMaps use ranges for single values)
      if (arraysEqual(startToken, endToken)) {
        result.addCIDMapping(startToken, cidToken);
      } else {
        result.addCIDRange(startToken, endToken, cidToken);
      }
    }
  }

  // =========================================================================
  // Tokenizer
  // =========================================================================

  private parseNextToken(): Token {
    this.skipWhitespace();

    if (this.position >= this.data.length) {
      return null;
    }

    const byte = this.data[this.position];

    switch (byte) {
      case 0x25: // %
        return this.readComment();
      case 0x28: // (
        return this.readString();
      case 0x3e: // >
        return this.readEndDictOrHex();
      case 0x5d: // ]
        this.position++;
        return { type: "operator", op: "]" };
      case 0x5b: // [
        return this.readArray();
      case 0x3c: // <
        return this.readHexOrDict();
      case 0x2f: // /
        return this.readLiteralName();
      default:
        if (isDigit(byte)) {
          return this.readNumber();
        }

        return this.readOperator();
    }
  }

  private skipWhitespace(): void {
    while (this.position < this.data.length) {
      const byte = this.data[this.position];

      if (byte === 0x09 || byte === 0x0a || byte === 0x0d || byte === 0x20) {
        this.position++;
      } else {
        break;
      }
    }
  }

  private readComment(): Token {
    // Skip comment line
    const start = this.position;

    while (
      this.position < this.data.length &&
      this.data[this.position] !== 0x0a &&
      this.data[this.position] !== 0x0d
    ) {
      this.position++;
    }

    return String.fromCharCode(...this.data.subarray(start, this.position));
  }

  private readString(): string {
    this.position++; // skip (
    let result = "";

    while (this.position < this.data.length && this.data[this.position] !== 0x29) {
      result += String.fromCharCode(this.data[this.position]);
      this.position++;
    }

    this.position++; // skip )

    return result;
  }

  private readEndDictOrHex(): Token {
    if (this.position + 1 < this.data.length && this.data[this.position + 1] === 0x3e) {
      this.position += 2;

      return { type: "operator", op: ">>" };
    }

    throw new Error("Expected >> for end of dictionary");
  }

  private readArray(): Token[] {
    this.position++; // skip [
    const list: Token[] = [];
    let token = this.parseNextToken();

    while (token !== null && !(isOperator(token) && token.op === "]")) {
      list.push(token);
      token = this.parseNextToken();
    }

    return list;
  }

  private readHexOrDict(): Token {
    this.position++; // skip <

    if (this.position < this.data.length && this.data[this.position] === 0x3c) {
      // Dictionary <<
      this.position++;
      const dict = new Map<string, unknown>();
      let key = this.parseNextToken();

      // As in PDFBox, stop at the first non-name key so an unterminated
      // dictionary doesn't swallow the rest of the CMap.
      while (isName(key)) {
        dict.set(key.name, this.parseNextToken());
        key = this.parseNextToken();
      }

      return dict;
    }

    // Hex string
    const bytes: number[] = [];
    let highNibble = true;
    let currentByte = 0;

    while (this.position < this.data.length) {
      const ch = this.data[this.position];

      if (ch === 0x3e) {
        // >
        this.position++;
        break;
      }

      if (isWhitespace(ch)) {
        this.position++;
        continue;
      }

      const nibble = hexDigitValue(ch);

      if (nibble < 0) {
        throw new Error(`Invalid hex character: ${String.fromCharCode(ch)}`);
      }

      if (highNibble) {
        currentByte = nibble << 4;
        highNibble = false;
      } else {
        currentByte |= nibble;
        bytes.push(currentByte);
        highNibble = true;
      }

      this.position++;
    }

    // Handle odd number of digits (treat trailing nibble as 0)
    if (!highNibble) {
      bytes.push(currentByte);
    }

    return new Uint8Array(bytes);
  }

  private readLiteralName(): LiteralName {
    this.position++; // skip /
    let name = "";

    while (this.position < this.data.length) {
      const ch = this.data[this.position];

      if (isWhitespace(ch) || isDelimiter(ch)) {
        break;
      }

      name += String.fromCharCode(ch);
      this.position++;
    }

    return { type: "name", name };
  }

  private readNumber(): number {
    let str = "";

    while (this.position < this.data.length) {
      const ch = this.data[this.position];

      if (!isDigit(ch) && ch !== 0x2e) {
        // not digit or .
        break;
      }

      str += String.fromCharCode(ch);

      this.position++;
    }

    if (str.includes(".")) {
      return parseFloat(str);
    }

    return parseInt(str, 10);
  }

  private readOperator(): Operator {
    let op = "";

    while (this.position < this.data.length) {
      const ch = this.data[this.position];

      if (isWhitespace(ch) || isDelimiter(ch) || isDigit(ch)) {
        break;
      }

      op += String.fromCharCode(ch);

      this.position++;
    }

    return { type: "operator", op };
  }
}

// =========================================================================
// Helper functions
// =========================================================================

function isOperator(token: Token): token is Operator {
  return (
    token !== null && typeof token === "object" && "type" in token && token.type === "operator"
  );
}

function isName(token: Token): token is LiteralName {
  return token !== null && typeof token === "object" && "type" in token && token.type === "name";
}

function isWhitespace(ch: number): boolean {
  return ch === 0x09 || ch === 0x0a || ch === 0x0d || ch === 0x20;
}

function isDigit(ch: number): boolean {
  return ch >= 0x30 && ch <= 0x39;
}

function isDelimiter(ch: number): boolean {
  switch (ch) {
    case 0x28: // (
    case 0x29: // )
    case 0x3c: // <
    case 0x3e: // >
    case 0x5b: // [
    case 0x5d: // ]
    case 0x7b: // {
    case 0x7d: // }
    case 0x2f: // /
    case 0x25: // %
      return true;
    default:
      return false;
  }
}

function hexDigitValue(ch: number): number {
  // 0-9
  if (ch >= 0x30 && ch <= 0x39) {
    return ch - 0x30;
  }
  // A-F
  if (ch >= 0x41 && ch <= 0x46) {
    return ch - 0x41 + 10;
  }
  // a-f
  if (ch >= 0x61 && ch <= 0x66) {
    return ch - 0x61 + 10;
  }

  return -1;
}

function bytesToInt(bytes: Uint8Array): number {
  let value = 0;

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
  }

  return value;
}

function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}
