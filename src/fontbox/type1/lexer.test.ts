/**
 * Type1 Lexer tests.
 * Based on PDFBox Type1LexerTest.java
 */

import { describe, expect, it } from "vitest";

import { DamagedFontError, Type1Lexer } from "./lexer.ts";
import { type Token, TokenKind } from "./token.ts";

/**
 * Helper to read all tokens from a lexer.
 */
function readTokens(lexer: Type1Lexer): Token[] {
  const tokens: Token[] = [];
  let token = lexer.nextToken();
  while (token !== null) {
    tokens.push(token);
    token = lexer.nextToken();
  }
  return tokens;
}

/**
 * Helper to create a lexer from a string.
 */
function lexerFromString(s: string): Type1Lexer {
  return new Type1Lexer(new TextEncoder().encode(s));
}

describe("Type1Lexer", () => {
  describe("testRealNumbers", () => {
    it("parses real numbers with exponents", () => {
      const s = "/FontMatrix [1e-3 0e-3 0e-3 -1E-03 0 0 1.23 -1.23 ] readonly def";
      const lexer = lexerFromString(s);
      const tokens = readTokens(lexer);

      expect(tokens[0].kind).toBe(TokenKind.LITERAL);
      expect(tokens[0].text).toBe("FontMatrix");

      expect(tokens[1].kind).toBe(TokenKind.START_ARRAY);

      expect(tokens[2].kind).toBe(TokenKind.REAL);
      expect(tokens[3].kind).toBe(TokenKind.REAL);
      expect(tokens[4].kind).toBe(TokenKind.REAL);
      expect(tokens[5].kind).toBe(TokenKind.REAL);
      expect(tokens[6].kind).toBe(TokenKind.INTEGER);
      expect(tokens[7].kind).toBe(TokenKind.INTEGER);
      expect(tokens[8].kind).toBe(TokenKind.REAL);
      expect(tokens[9].kind).toBe(TokenKind.REAL);

      expect(tokens[2].text).toBe("1e-3");
      expect(tokens[3].text).toBe("0e-3");
      expect(tokens[4].text).toBe("0e-3");
      expect(tokens[5].text).toBe("-1E-03");
      expect(tokens[5].floatValue()).toBeCloseTo(-1e-3);
      expect(tokens[6].text).toBe("0");
      expect(tokens[7].text).toBe("0");
      expect(tokens[8].text).toBe("1.23");
      expect(tokens[9].text).toBe("-1.23");

      expect(tokens[10].kind).toBe(TokenKind.END_ARRAY);
      expect(tokens[11].kind).toBe(TokenKind.NAME);
      expect(tokens[12].kind).toBe(TokenKind.NAME);
    });
  });

  describe("testEmptyName", () => {
    it("throws DamagedFontError for empty literal name", () => {
      const s = "dup 127 / put";
      const lexer = lexerFromString(s);

      expect(() => readTokens(lexer)).toThrow(DamagedFontError);
    });
  });

  describe("testProcAndNameAndDictAndString", () => {
    it("parses procedures, names, dicts, and strings", () => {
      const s =
        "/ND {noaccess def} executeonly def \n 8#173 +2#110 \n%comment \n<< (string \\n \\r \\t \\b \\f \\\\ \\( \\) \\123) >>";
      const lexer = lexerFromString(s);
      const tokens = readTokens(lexer);

      expect(tokens[0].kind).toBe(TokenKind.LITERAL);
      expect(tokens[0].text).toBe("ND");

      expect(tokens[1].kind).toBe(TokenKind.START_PROC);

      expect(tokens[2].kind).toBe(TokenKind.NAME);
      expect(tokens[2].text).toBe("noaccess");

      expect(tokens[3].kind).toBe(TokenKind.NAME);
      expect(tokens[3].text).toBe("def");

      expect(tokens[4].kind).toBe(TokenKind.END_PROC);

      expect(tokens[5].kind).toBe(TokenKind.NAME);
      expect(tokens[5].text).toBe("executeonly");

      expect(tokens[6].kind).toBe(TokenKind.NAME);
      expect(tokens[6].text).toBe("def");

      // 8#173 = octal 173 = decimal 123
      expect(tokens[7].kind).toBe(TokenKind.INTEGER);
      expect(tokens[7].text).toBe("123");

      // 2#110 = binary 110 = decimal 6
      expect(tokens[8].kind).toBe(TokenKind.INTEGER);
      expect(tokens[8].text).toBe("6");

      expect(tokens[9].kind).toBe(TokenKind.START_DICT);

      expect(tokens[10].kind).toBe(TokenKind.STRING);
      // String with escapes: \n \r \t \b \f \\ \( \) \123 (octal 123 = 'S')
      expect(tokens[10].text).toBe("string \n \n \t \b \f \\ ( ) S");

      expect(tokens[11].kind).toBe(TokenKind.END_DICT);
    });
  });

  describe("TestData", () => {
    it("parses RD charstring data", () => {
      const s = "3 RD 123 ND";
      const lexer = lexerFromString(s);
      const tokens = readTokens(lexer);

      expect(tokens[0].kind).toBe(TokenKind.INTEGER);
      expect(tokens[0].intValue()).toBe(3);

      expect(tokens[1].kind).toBe(TokenKind.CHARSTRING);
      expect(tokens[1].data).toEqual(new Uint8Array([0x31, 0x32, 0x33])); // "123"

      expect(tokens[2].kind).toBe(TokenKind.NAME);
      expect(tokens[2].text).toBe("ND");
    });
  });

  describe("TestPDFBOX6043", () => {
    it("throws error for illegal string length", () => {
      const s = "999 RD";
      const lexer = lexerFromString(s);

      expect(() => readTokens(lexer)).toThrow("String length 999 is larger than input");
    });
  });

  describe("additional tests", () => {
    it("parses simple integers", () => {
      const lexer = lexerFromString("123 -456 +789");
      const tokens = readTokens(lexer);

      expect(tokens.length).toBe(3);
      expect(tokens[0].kind).toBe(TokenKind.INTEGER);
      expect(tokens[0].intValue()).toBe(123);
      expect(tokens[1].kind).toBe(TokenKind.INTEGER);
      expect(tokens[1].intValue()).toBe(-456);
      expect(tokens[2].kind).toBe(TokenKind.INTEGER);
      expect(tokens[2].intValue()).toBe(789);
    });

    it("parses simple reals", () => {
      const lexer = lexerFromString("1.5 -2.5 .5");
      const tokens = readTokens(lexer);

      expect(tokens.length).toBe(3);
      expect(tokens[0].kind).toBe(TokenKind.REAL);
      expect(tokens[0].floatValue()).toBe(1.5);
      expect(tokens[1].kind).toBe(TokenKind.REAL);
      expect(tokens[1].floatValue()).toBe(-2.5);
      expect(tokens[2].kind).toBe(TokenKind.REAL);
      expect(tokens[2].floatValue()).toBe(0.5);
    });

    it("parses literal names", () => {
      const lexer = lexerFromString("/FontName /Times-Roman /.notdef");
      const tokens = readTokens(lexer);

      expect(tokens.length).toBe(3);
      expect(tokens[0].kind).toBe(TokenKind.LITERAL);
      expect(tokens[0].text).toBe("FontName");
      expect(tokens[1].kind).toBe(TokenKind.LITERAL);
      expect(tokens[1].text).toBe("Times-Roman");
      expect(tokens[2].kind).toBe(TokenKind.LITERAL);
      expect(tokens[2].text).toBe(".notdef");
    });

    it("parses arrays", () => {
      const lexer = lexerFromString("[1 2 3]");
      const tokens = readTokens(lexer);

      expect(tokens.length).toBe(5);
      expect(tokens[0].kind).toBe(TokenKind.START_ARRAY);
      expect(tokens[1].intValue()).toBe(1);
      expect(tokens[2].intValue()).toBe(2);
      expect(tokens[3].intValue()).toBe(3);
      expect(tokens[4].kind).toBe(TokenKind.END_ARRAY);
    });

    it("parses procedures", () => {
      const lexer = lexerFromString("{pop dup}");
      const tokens = readTokens(lexer);

      expect(tokens.length).toBe(4);
      expect(tokens[0].kind).toBe(TokenKind.START_PROC);
      expect(tokens[1].text).toBe("pop");
      expect(tokens[2].text).toBe("dup");
      expect(tokens[3].kind).toBe(TokenKind.END_PROC);
    });

    it("skips comments", () => {
      const lexer = lexerFromString("123 % this is a comment\n456");
      const tokens = readTokens(lexer);

      expect(tokens.length).toBe(2);
      expect(tokens[0].intValue()).toBe(123);
      expect(tokens[1].intValue()).toBe(456);
    });

    it("handles nested parentheses in strings", () => {
      const lexer = lexerFromString("(hello (world) test)");
      const tokens = readTokens(lexer);

      expect(tokens.length).toBe(1);
      expect(tokens[0].kind).toBe(TokenKind.STRING);
      expect(tokens[0].text).toBe("hello (world) test");
    });

    it("peekToken does not consume", () => {
      const lexer = lexerFromString("123 456");

      expect(lexer.peekToken()?.intValue()).toBe(123);
      expect(lexer.peekToken()?.intValue()).toBe(123);
      expect(lexer.nextToken()?.intValue()).toBe(123);
      expect(lexer.peekToken()?.intValue()).toBe(456);
    });

    it("peekKind checks token kind", () => {
      const lexer = lexerFromString("/Name 123");

      expect(lexer.peekKind(TokenKind.LITERAL)).toBe(true);
      expect(lexer.peekKind(TokenKind.INTEGER)).toBe(false);
      lexer.nextToken();
      expect(lexer.peekKind(TokenKind.INTEGER)).toBe(true);
    });
  });
});
