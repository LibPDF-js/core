import { Scanner } from "#src/io/scanner";
import { describe, expect, it } from "vitest";

import { TokenReader } from "./token-reader";

/**
 * Helper to create a TokenReader from a string.
 */
function reader(input: string): TokenReader {
  const bytes = new TextEncoder().encode(input);

  return new TokenReader(new Scanner(bytes));
}

describe("TokenReader", () => {
  describe("whitespace and comments", () => {
    it("skips space characters", () => {
      const r = reader("   42");
      const token = r.nextToken();

      expect(token.type).toBe("number");
      expect(token).toMatchObject({ value: 42 });
    });

    it("skips tab characters", () => {
      const r = reader("\t\t42");
      const token = r.nextToken();

      expect(token.type).toBe("number");
      expect(token).toMatchObject({ value: 42 });
    });

    it("skips newlines (LF)", () => {
      const r = reader("\n\n42");
      const token = r.nextToken();

      expect(token.type).toBe("number");
      expect(token).toMatchObject({ value: 42 });
    });

    it("skips carriage returns (CR)", () => {
      const r = reader("\r\r42");
      const token = r.nextToken();

      expect(token.type).toBe("number");
      expect(token).toMatchObject({ value: 42 });
    });

    it("skips form feed (FF)", () => {
      const r = reader("\x0c42");
      const token = r.nextToken();

      expect(token.type).toBe("number");
      expect(token).toMatchObject({ value: 42 });
    });

    it("skips NUL characters", () => {
      const r = reader("\x00\x0042");
      const token = r.nextToken();

      expect(token.type).toBe("number");
      expect(token).toMatchObject({ value: 42 });
    });

    it("skips mixed whitespace", () => {
      const r = reader(" \t\n\r\x0c\x00 42");
      const token = r.nextToken();

      expect(token.type).toBe("number");
      expect(token).toMatchObject({ value: 42 });
    });

    it("skips single-line comments", () => {
      const r = reader("% this is a comment\n42");
      const token = r.nextToken();

      expect(token.type).toBe("number");
      expect(token).toMatchObject({ value: 42 });
    });

    it("skips comments ending with CR", () => {
      const r = reader("% comment\r42");
      const token = r.nextToken();

      expect(token.type).toBe("number");
      expect(token).toMatchObject({ value: 42 });
    });

    it("skips multiple comments", () => {
      const r = reader("% first\n% second\n42");
      const token = r.nextToken();

      expect(token.type).toBe("number");
      expect(token).toMatchObject({ value: 42 });
    });

    it("returns EOF for empty input", () => {
      const r = reader("");
      const token = r.nextToken();

      expect(token.type).toBe("eof");
    });

    it("returns EOF for whitespace-only input", () => {
      const r = reader("   \t\n  ");
      const token = r.nextToken();

      expect(token.type).toBe("eof");
    });

    it("returns EOF for comment-only input", () => {
      const r = reader("% just a comment");
      const token = r.nextToken();

      expect(token.type).toBe("eof");
    });
  });

  describe("number parsing", () => {
    it("parses positive integer", () => {
      const r = reader("42");
      const token = r.nextToken();

      expect(token.type).toBe("number");
      expect(token).toMatchObject({ value: 42, isInteger: true });
    });

    it("parses zero", () => {
      const r = reader("0");
      const token = r.nextToken();

      expect(token.type).toBe("number");
      expect(token).toMatchObject({ value: 0, isInteger: true });
    });

    it("parses negative integer", () => {
      const r = reader("-17");
      const token = r.nextToken();

      expect(token.type).toBe("number");
      expect(token).toMatchObject({ value: -17, isInteger: true });
    });

    it("parses positive integer with explicit plus", () => {
      const r = reader("+123");
      const token = r.nextToken();

      expect(token.type).toBe("number");
      expect(token).toMatchObject({ value: 123, isInteger: true });
    });

    it("parses decimal number", () => {
      const r = reader("3.14");
      const token = r.nextToken();

      expect(token.type).toBe("number");
      expect(token).toMatchObject({ value: 3.14, isInteger: false });
    });

    it("parses negative decimal", () => {
      const r = reader("-2.5");
      const token = r.nextToken();

      expect(token.type).toBe("number");
      expect(token).toMatchObject({ value: -2.5, isInteger: false });
    });

    it("parses leading decimal (.5)", () => {
      const r = reader(".5");
      const token = r.nextToken();

      expect(token.type).toBe("number");
      expect(token).toMatchObject({ value: 0.5, isInteger: false });
    });

    it("parses trailing decimal (5.)", () => {
      const r = reader("5.");
      const token = r.nextToken();

      expect(token.type).toBe("number");
      expect(token).toMatchObject({ value: 5, isInteger: false });
    });

    it("handles double negative leniently (--5 → 5)", () => {
      const r = reader("--5");
      const token = r.nextToken();

      expect(token.type).toBe("number");
      expect(token).toMatchObject({ value: 5, isInteger: true });
    });

    it("handles multiple negatives leniently (---5 → 5)", () => {
      const r = reader("---5");
      const token = r.nextToken();

      expect(token.type).toBe("number");
      expect(token).toMatchObject({ value: 5, isInteger: true });
    });

    it("stops at non-digit character", () => {
      const r = reader("123abc");
      const token = r.nextToken();

      expect(token.type).toBe("number");
      expect(token).toMatchObject({ value: 123 });
    });

    it("parses large number", () => {
      const r = reader("12345678901234");
      const token = r.nextToken();

      expect(token.type).toBe("number");
      expect(token).toMatchObject({ value: 12345678901234 });
    });

    it("records position", () => {
      const r = reader("   42");
      const token = r.nextToken();

      expect(token.position).toBe(3);
    });

    it("parses multiple numbers", () => {
      const r = reader("1 2 3");

      expect(r.nextToken()).toMatchObject({ type: "number", value: 1 });
      expect(r.nextToken()).toMatchObject({ type: "number", value: 2 });
      expect(r.nextToken()).toMatchObject({ type: "number", value: 3 });
    });

    it("returns keyword for lone minus", () => {
      const r = reader("- ");
      const token = r.nextToken();

      expect(token.type).toBe("keyword");
    });

    it("returns keyword for lone plus", () => {
      const r = reader("+ ");
      const token = r.nextToken();

      expect(token.type).toBe("keyword");
    });

    it("returns keyword for lone dot", () => {
      const r = reader(". ");
      const token = r.nextToken();

      expect(token.type).toBe("keyword");
    });
  });

  describe("name parsing", () => {
    it("parses simple name", () => {
      const r = reader("/Type");
      const token = r.nextToken();

      expect(token.type).toBe("name");
      expect(token).toMatchObject({ value: "Type" });
    });

    it("parses name without leading slash in value", () => {
      const r = reader("/Name");
      const token = r.nextToken();

      expect(token).toMatchObject({ type: "name", value: "Name" });
    });

    it("parses empty name", () => {
      const r = reader("/ ");
      const token = r.nextToken();

      expect(token.type).toBe("name");
      expect(token).toMatchObject({ value: "" });
    });

    it("parses name with digits", () => {
      const r = reader("/Font1");
      const token = r.nextToken();

      expect(token).toMatchObject({ type: "name", value: "Font1" });
    });

    it("parses name with mixed case", () => {
      const r = reader("/MediaBox");
      const token = r.nextToken();

      expect(token).toMatchObject({ type: "name", value: "MediaBox" });
    });

    it("parses name with underscore", () => {
      const r = reader("/My_Name");
      const token = r.nextToken();

      expect(token).toMatchObject({ type: "name", value: "My_Name" });
    });

    it("decodes #XX hex escape", () => {
      const r = reader("/F#6Fo"); // #6F = 'o'
      const token = r.nextToken();

      expect(token).toMatchObject({ type: "name", value: "Foo" });
    });

    it("decodes multiple hex escapes", () => {
      const r = reader("/#48#65#6C#6C#6F"); // Hello
      const token = r.nextToken();

      expect(token).toMatchObject({ type: "name", value: "Hello" });
    });

    it("treats lone # literally", () => {
      const r = reader("/Test# ");
      const token = r.nextToken();

      expect(token).toMatchObject({ type: "name", value: "Test#" });
    });

    it("treats # followed by one hex digit literally", () => {
      const r = reader("/Test#5 ");
      const token = r.nextToken();

      expect(token).toMatchObject({ type: "name", value: "Test#5" });
    });

    it("stops at whitespace", () => {
      const r = reader("/Type /Page");

      expect(r.nextToken()).toMatchObject({ type: "name", value: "Type" });
      expect(r.nextToken()).toMatchObject({ type: "name", value: "Page" });
    });

    it("stops at delimiter", () => {
      const r = reader("/Type[");
      const token = r.nextToken();

      expect(token).toMatchObject({ type: "name", value: "Type" });
    });

    it("records position", () => {
      const r = reader("  /Name");
      const token = r.nextToken();

      expect(token.position).toBe(2);
    });
  });

  describe("literal string parsing", () => {
    it("parses simple string", () => {
      const r = reader("(Hello)");
      const token = r.nextToken();

      expect(token.type).toBe("string");
      expect(token).toMatchObject({ format: "literal" });

      const value = (token as { value: Uint8Array }).value;

      expect(new TextDecoder().decode(value)).toBe("Hello");
    });

    it("parses empty string", () => {
      const r = reader("()");
      const token = r.nextToken();

      expect(token.type).toBe("string");

      const value = (token as { value: Uint8Array }).value;

      expect(value.length).toBe(0);
    });

    it("parses string with spaces", () => {
      const r = reader("(Hello World)");
      const token = r.nextToken();

      const value = (token as { value: Uint8Array }).value;

      expect(new TextDecoder().decode(value)).toBe("Hello World");
    });

    it("handles balanced nested parentheses", () => {
      const r = reader("(a(b)c)");
      const token = r.nextToken();

      const value = (token as { value: Uint8Array }).value;

      expect(new TextDecoder().decode(value)).toBe("a(b)c");
    });

    it("handles deeply nested parentheses", () => {
      const r = reader("(a(b(c)d)e)");
      const token = r.nextToken();

      const value = (token as { value: Uint8Array }).value;

      expect(new TextDecoder().decode(value)).toBe("a(b(c)d)e");
    });

    it("parses escape \\n as LF", () => {
      const r = reader("(line1\\nline2)");
      const token = r.nextToken();

      const value = (token as { value: Uint8Array }).value;

      expect(new TextDecoder().decode(value)).toBe("line1\nline2");
    });

    it("parses escape \\r as CR", () => {
      const r = reader("(a\\rb)");
      const token = r.nextToken();

      const value = (token as { value: Uint8Array }).value;

      expect(new TextDecoder().decode(value)).toBe("a\rb");
    });

    it("parses escape \\t as TAB", () => {
      const r = reader("(a\\tb)");
      const token = r.nextToken();

      const value = (token as { value: Uint8Array }).value;

      expect(new TextDecoder().decode(value)).toBe("a\tb");
    });

    it("parses escape \\b as backspace", () => {
      const r = reader("(a\\bb)");
      const token = r.nextToken();

      const value = (token as { value: Uint8Array }).value;

      expect(value).toEqual(new Uint8Array([97, 8, 98]));
    });

    it("parses escape \\f as form feed", () => {
      const r = reader("(a\\fb)");
      const token = r.nextToken();

      const value = (token as { value: Uint8Array }).value;

      expect(value).toEqual(new Uint8Array([97, 12, 98]));
    });

    it("parses escaped parentheses", () => {
      const r = reader("(\\(hello\\))");
      const token = r.nextToken();

      const value = (token as { value: Uint8Array }).value;

      expect(new TextDecoder().decode(value)).toBe("(hello)");
    });

    it("parses escaped backslash", () => {
      const r = reader("(a\\\\b)");
      const token = r.nextToken();

      const value = (token as { value: Uint8Array }).value;

      expect(new TextDecoder().decode(value)).toBe("a\\b");
    });

    it("parses octal escape \\ddd", () => {
      const r = reader("(\\101)"); // 101 octal = 65 = 'A'
      const token = r.nextToken();

      const value = (token as { value: Uint8Array }).value;

      expect(new TextDecoder().decode(value)).toBe("A");
    });

    it("parses octal escape with 1 digit", () => {
      const r = reader("(\\7)"); // 7 octal = 7
      const token = r.nextToken();

      const value = (token as { value: Uint8Array }).value;

      expect(value).toEqual(new Uint8Array([7]));
    });

    it("parses octal escape with 2 digits", () => {
      const r = reader("(\\77)"); // 77 octal = 63 = '?'
      const token = r.nextToken();

      const value = (token as { value: Uint8Array }).value;

      expect(new TextDecoder().decode(value)).toBe("?");
    });

    it("handles line continuation with backslash-LF", () => {
      const r = reader("(line\\\nstill)");
      const token = r.nextToken();

      const value = (token as { value: Uint8Array }).value;

      expect(new TextDecoder().decode(value)).toBe("linestill");
    });

    it("handles line continuation with backslash-CR", () => {
      const r = reader("(line\\\rstill)");
      const token = r.nextToken();

      const value = (token as { value: Uint8Array }).value;

      expect(new TextDecoder().decode(value)).toBe("linestill");
    });

    it("handles line continuation with backslash-CRLF", () => {
      const r = reader("(line\\\r\nstill)");
      const token = r.nextToken();

      const value = (token as { value: Uint8Array }).value;

      expect(new TextDecoder().decode(value)).toBe("linestill");
    });

    it("normalizes raw CR to LF", () => {
      const r = reader("(line1\rline2)");
      const token = r.nextToken();

      const value = (token as { value: Uint8Array }).value;

      expect(new TextDecoder().decode(value)).toBe("line1\nline2");
    });

    it("normalizes raw CRLF to LF", () => {
      const r = reader("(line1\r\nline2)");
      const token = r.nextToken();

      const value = (token as { value: Uint8Array }).value;

      expect(new TextDecoder().decode(value)).toBe("line1\nline2");
    });

    it("treats unknown escape literally", () => {
      const r = reader("(\\x)"); // \x is not a valid escape
      const token = r.nextToken();

      const value = (token as { value: Uint8Array }).value;

      expect(new TextDecoder().decode(value)).toBe("x");
    });

    it("records position", () => {
      const r = reader("  (test)");
      const token = r.nextToken();

      expect(token.position).toBe(2);
    });

    it("handles unterminated string at EOF", () => {
      const r = reader("(unterminated");
      const token = r.nextToken();

      expect(token.type).toBe("string");

      const value = (token as { value: Uint8Array }).value;

      expect(new TextDecoder().decode(value)).toBe("unterminated");
    });

    it("handles unbalanced nested parens at EOF", () => {
      const r = reader("(a(b)");
      const token = r.nextToken();

      expect(token.type).toBe("string");

      const value = (token as { value: Uint8Array }).value;

      expect(new TextDecoder().decode(value)).toBe("a(b)");
    });

    it("handles deeply unbalanced parens at EOF", () => {
      const r = reader("(a(b(c)");
      const token = r.nextToken();

      expect(token.type).toBe("string");

      const value = (token as { value: Uint8Array }).value;

      expect(new TextDecoder().decode(value)).toBe("a(b(c)");
    });

    it("handles trailing open paren at EOF", () => {
      const r = reader("(test(");
      const token = r.nextToken();

      expect(token.type).toBe("string");

      const value = (token as { value: Uint8Array }).value;

      expect(new TextDecoder().decode(value)).toBe("test(");
    });
  });

  describe("hex string parsing", () => {
    it("parses simple hex string", () => {
      const r = reader("<48656C6C6F>"); // "Hello"
      const token = r.nextToken();

      expect(token.type).toBe("string");
      expect(token).toMatchObject({ format: "hex" });

      const value = (token as { value: Uint8Array }).value;

      expect(new TextDecoder().decode(value)).toBe("Hello");
    });

    it("parses empty hex string", () => {
      const r = reader("<>");
      const token = r.nextToken();

      expect(token.type).toBe("string");

      const value = (token as { value: Uint8Array }).value;

      expect(value.length).toBe(0);
    });

    it("handles lowercase hex digits", () => {
      const r = reader("<4a4b>"); // "JK"
      const token = r.nextToken();

      const value = (token as { value: Uint8Array }).value;

      expect(value).toEqual(new Uint8Array([0x4a, 0x4b]));
    });

    it("handles mixed case hex digits", () => {
      const r = reader("<4A4b4C>"); // "JKL"
      const token = r.nextToken();

      const value = (token as { value: Uint8Array }).value;

      expect(value).toEqual(new Uint8Array([0x4a, 0x4b, 0x4c]));
    });

    it("ignores whitespace inside hex string", () => {
      const r = reader("< 48 65 6C 6C 6F >"); // "Hello"
      const token = r.nextToken();

      const value = (token as { value: Uint8Array }).value;

      expect(new TextDecoder().decode(value)).toBe("Hello");
    });

    it("ignores newlines inside hex string", () => {
      const r = reader("<48\n65\r\n6C>"); // "Hel"
      const token = r.nextToken();

      const value = (token as { value: Uint8Array }).value;

      expect(new TextDecoder().decode(value)).toBe("Hel");
    });

    it("pads odd-length hex with trailing 0", () => {
      const r = reader("<F>"); // F0 = 240
      const token = r.nextToken();

      const value = (token as { value: Uint8Array }).value;

      expect(value).toEqual(new Uint8Array([0xf0]));
    });

    it("pads longer odd-length hex", () => {
      const r = reader("<ABC>"); // AB C0
      const token = r.nextToken();

      const value = (token as { value: Uint8Array }).value;

      expect(value).toEqual(new Uint8Array([0xab, 0xc0]));
    });

    it("records position", () => {
      const r = reader("  <4142>");
      const token = r.nextToken();

      expect(token.position).toBe(2);
    });

    it("handles unterminated hex string at EOF", () => {
      const r = reader("<4142");
      const token = r.nextToken();

      expect(token.type).toBe("string");

      const value = (token as { value: Uint8Array }).value;

      expect(value).toEqual(new Uint8Array([0x41, 0x42]));
    });
  });

  describe("keyword parsing", () => {
    it("parses true", () => {
      const r = reader("true");
      const token = r.nextToken();

      expect(token).toMatchObject({ type: "keyword", value: "true" });
    });

    it("parses false", () => {
      const r = reader("false");
      const token = r.nextToken();

      expect(token).toMatchObject({ type: "keyword", value: "false" });
    });

    it("parses null", () => {
      const r = reader("null");
      const token = r.nextToken();

      expect(token).toMatchObject({ type: "keyword", value: "null" });
    });

    it("parses obj", () => {
      const r = reader("obj");
      const token = r.nextToken();

      expect(token).toMatchObject({ type: "keyword", value: "obj" });
    });

    it("parses endobj", () => {
      const r = reader("endobj");
      const token = r.nextToken();

      expect(token).toMatchObject({ type: "keyword", value: "endobj" });
    });

    it("parses stream", () => {
      const r = reader("stream");
      const token = r.nextToken();

      expect(token).toMatchObject({ type: "keyword", value: "stream" });
    });

    it("parses endstream", () => {
      const r = reader("endstream");
      const token = r.nextToken();

      expect(token).toMatchObject({ type: "keyword", value: "endstream" });
    });

    it("parses R (for indirect reference)", () => {
      const r = reader("R");
      const token = r.nextToken();

      expect(token).toMatchObject({ type: "keyword", value: "R" });
    });

    it("parses xref", () => {
      const r = reader("xref");
      const token = r.nextToken();

      expect(token).toMatchObject({ type: "keyword", value: "xref" });
    });

    it("parses trailer", () => {
      const r = reader("trailer");
      const token = r.nextToken();

      expect(token).toMatchObject({ type: "keyword", value: "trailer" });
    });

    it("parses startxref", () => {
      const r = reader("startxref");
      const token = r.nextToken();

      expect(token).toMatchObject({ type: "keyword", value: "startxref" });
    });

    it("keywords are case sensitive", () => {
      const r = reader("TRUE");
      const token = r.nextToken();

      expect(token).toMatchObject({ type: "keyword", value: "TRUE" });
    });

    it("stops at whitespace", () => {
      const r = reader("true false");

      expect(r.nextToken()).toMatchObject({ type: "keyword", value: "true" });
      expect(r.nextToken()).toMatchObject({ type: "keyword", value: "false" });
    });

    it("stops at delimiter", () => {
      const r = reader("true]");
      const token = r.nextToken();

      expect(token).toMatchObject({ type: "keyword", value: "true" });
    });

    it("records position", () => {
      const r = reader("   null");
      const token = r.nextToken();

      expect(token.position).toBe(3);
    });
  });

  describe("delimiter parsing", () => {
    it("parses array start [", () => {
      const r = reader("[");
      const token = r.nextToken();

      expect(token).toMatchObject({ type: "delimiter", value: "[" });
    });

    it("parses array end ]", () => {
      const r = reader("]");
      const token = r.nextToken();

      expect(token).toMatchObject({ type: "delimiter", value: "]" });
    });

    it("parses dict start <<", () => {
      const r = reader("<<");
      const token = r.nextToken();

      expect(token).toMatchObject({ type: "delimiter", value: "<<" });
    });

    it("parses dict end >>", () => {
      const r = reader(">>");
      const token = r.nextToken();

      expect(token).toMatchObject({ type: "delimiter", value: ">>" });
    });

    it("distinguishes < (hex string) from << (dict)", () => {
      const r = reader("<<4142>>");

      expect(r.nextToken()).toMatchObject({ type: "delimiter", value: "<<" });
      expect(r.nextToken()).toMatchObject({ type: "number", value: 4142 });
      expect(r.nextToken()).toMatchObject({ type: "delimiter", value: ">>" });
    });

    it("parses hex string starting with <", () => {
      const r = reader("<4142>");
      const token = r.nextToken();

      expect(token.type).toBe("string");
      expect(token).toMatchObject({ format: "hex" });
    });

    it("handles lone > as >> (lenient)", () => {
      const r = reader(">");
      const token = r.nextToken();

      expect(token).toMatchObject({ type: "delimiter", value: ">>" });
    });

    it("records position for delimiters", () => {
      const r = reader("  [");
      const token = r.nextToken();

      expect(token.position).toBe(2);
    });

    it("parses adjacent delimiters", () => {
      const r = reader("[]");

      expect(r.nextToken()).toMatchObject({ type: "delimiter", value: "[" });
      expect(r.nextToken()).toMatchObject({ type: "delimiter", value: "]" });
    });
  });

  describe("peek token caching", () => {
    it("peekToken returns same token as nextToken", () => {
      const r = reader("42");

      const peeked = r.peekToken();
      const next = r.nextToken();

      expect(peeked).toEqual(next);
    });

    it("peekToken does not consume token", () => {
      const r = reader("42");

      r.peekToken();
      r.peekToken();
      r.peekToken();

      expect(r.nextToken()).toMatchObject({ type: "number", value: 42 });
    });

    it("peekToken returns cached value on repeated calls", () => {
      const r = reader("42");

      const first = r.peekToken();
      const second = r.peekToken();

      expect(first).toBe(second);
    });

    it("nextToken clears cache", () => {
      const r = reader("42 43");

      r.peekToken();
      r.nextToken();

      expect(r.peekToken()).toMatchObject({ type: "number", value: 43 });
    });

    it("position reflects cached state correctly", () => {
      const r = reader("  42");

      expect(r.position).toBe(0);

      r.peekToken();

      expect(r.position).toBe(4); // After reading "42"

      r.nextToken();

      expect(r.position).toBe(4);
    });
  });

  describe("position tracking", () => {
    it("tracks position through multiple tokens", () => {
      const r = reader("1 2 3");

      const t1 = r.nextToken();
      const t2 = r.nextToken();
      const t3 = r.nextToken();

      expect(t1.position).toBe(0);
      expect(t2.position).toBe(2);
      expect(t3.position).toBe(4);
    });

    it("exposes current scanner position", () => {
      const r = reader("1234 5678");

      expect(r.position).toBe(0);

      r.nextToken();

      expect(r.position).toBe(4);

      r.nextToken();

      expect(r.position).toBe(9);
    });
  });

  describe("peekByte", () => {
    it("returns next non-whitespace byte", () => {
      const r = reader("   x");

      expect(r.peekByte()).toBe(0x78); // 'x'
    });

    it("skips comments before peeking", () => {
      const r = reader("% comment\nx");

      expect(r.peekByte()).toBe(0x78); // 'x'
    });

    it("returns -1 at EOF", () => {
      const r = reader("   ");

      expect(r.peekByte()).toBe(-1);
    });
  });

  describe("complex sequences", () => {
    it("parses dictionary structure", () => {
      const r = reader("<< /Type /Page /Count 5 >>");
      const tokens = [];

      while (true) {
        const token = r.nextToken();

        tokens.push(token);

        if (token.type === "eof") {
          break;
        }
      }

      expect(tokens.map(t => t.type)).toEqual([
        "delimiter",
        "name",
        "name",
        "name",
        "number",
        "delimiter",
        "eof",
      ]);
    });

    it("parses array structure", () => {
      const r = reader("[1 2 (text) /Name]");
      const tokens = [];

      while (true) {
        const token = r.nextToken();

        tokens.push(token);

        if (token.type === "eof") {
          break;
        }
      }

      expect(tokens.map(t => t.type)).toEqual([
        "delimiter",
        "number",
        "number",
        "string",
        "name",
        "delimiter",
        "eof",
      ]);
    });

    it("parses indirect reference pattern", () => {
      const r = reader("10 0 R");

      expect(r.nextToken()).toMatchObject({ type: "number", value: 10 });
      expect(r.nextToken()).toMatchObject({ type: "number", value: 0 });
      expect(r.nextToken()).toMatchObject({ type: "keyword", value: "R" });
    });

    it("parses object definition pattern", () => {
      const r = reader("1 0 obj\n<< /Type /Page >>\nendobj");
      const tokens = [];

      while (true) {
        const token = r.nextToken();

        tokens.push(token);

        if (token.type === "eof") {
          break;
        }
      }

      expect(tokens.map(t => t.type)).toEqual([
        "number",
        "number",
        "keyword",
        "delimiter",
        "name",
        "name",
        "delimiter",
        "keyword",
        "eof",
      ]);
    });
  });
});
