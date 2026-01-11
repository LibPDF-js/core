import { describe, expect, it } from "vitest";

import { ContentTokenizer } from "./content-tokenizer";

const encode = (s: string) => new TextEncoder().encode(s);

describe("ContentTokenizer", () => {
  describe("basic tokens", () => {
    it("parses numbers", () => {
      const tokenizer = new ContentTokenizer(encode("42 -3.14 0 .5"));

      const t1 = tokenizer.nextToken();
      expect(t1).toEqual({ type: "number", value: 42 });

      const t2 = tokenizer.nextToken();
      expect(t2).toEqual({ type: "number", value: -3.14 });

      const t3 = tokenizer.nextToken();
      expect(t3).toEqual({ type: "number", value: 0 });

      const t4 = tokenizer.nextToken();
      expect(t4).toEqual({ type: "number", value: 0.5 });

      expect(tokenizer.nextToken()).toBeNull();
    });

    it("parses names", () => {
      const tokenizer = new ContentTokenizer(encode("/Type /Font /F1"));

      const t1 = tokenizer.nextToken();
      expect(t1).toEqual({ type: "name", value: "Type" });

      const t2 = tokenizer.nextToken();
      expect(t2).toEqual({ type: "name", value: "Font" });

      const t3 = tokenizer.nextToken();
      expect(t3).toEqual({ type: "name", value: "F1" });
    });

    it("parses literal strings", () => {
      const tokenizer = new ContentTokenizer(encode("(Hello World)"));

      const t1 = tokenizer.nextToken();
      expect(t1?.type).toBe("string");

      if (t1?.type === "string") {
        expect(new TextDecoder().decode(t1.value)).toBe("Hello World");
        expect(t1.hex).toBe(false);
      }
    });

    it("parses hex strings", () => {
      const tokenizer = new ContentTokenizer(encode("<48656C6C6F>"));

      const t1 = tokenizer.nextToken();
      expect(t1?.type).toBe("string");

      if (t1?.type === "string") {
        expect(new TextDecoder().decode(t1.value)).toBe("Hello");
        expect(t1.hex).toBe(true);
      }
    });

    it("parses booleans", () => {
      const tokenizer = new ContentTokenizer(encode("true false"));

      expect(tokenizer.nextToken()).toEqual({ type: "bool", value: true });
      expect(tokenizer.nextToken()).toEqual({ type: "bool", value: false });
    });

    it("parses null", () => {
      const tokenizer = new ContentTokenizer(encode("null"));

      expect(tokenizer.nextToken()).toEqual({ type: "null" });
    });
  });

  describe("operators", () => {
    it("parses single-char operators", () => {
      const tokenizer = new ContentTokenizer(encode("q Q f S n"));

      expect(tokenizer.nextToken()).toEqual({ type: "operator", name: "q" });
      expect(tokenizer.nextToken()).toEqual({ type: "operator", name: "Q" });
      expect(tokenizer.nextToken()).toEqual({ type: "operator", name: "f" });
      expect(tokenizer.nextToken()).toEqual({ type: "operator", name: "S" });
      expect(tokenizer.nextToken()).toEqual({ type: "operator", name: "n" });
    });

    it("parses multi-char operators", () => {
      const tokenizer = new ContentTokenizer(encode("BT ET cm Tf Tj TJ"));

      expect(tokenizer.nextToken()).toEqual({ type: "operator", name: "BT" });
      expect(tokenizer.nextToken()).toEqual({ type: "operator", name: "ET" });
      expect(tokenizer.nextToken()).toEqual({ type: "operator", name: "cm" });
      expect(tokenizer.nextToken()).toEqual({ type: "operator", name: "Tf" });
      expect(tokenizer.nextToken()).toEqual({ type: "operator", name: "Tj" });
      expect(tokenizer.nextToken()).toEqual({ type: "operator", name: "TJ" });
    });

    it("parses star operators", () => {
      const tokenizer = new ContentTokenizer(encode("f* B* b* W* T*"));

      expect(tokenizer.nextToken()).toEqual({ type: "operator", name: "f*" });
      expect(tokenizer.nextToken()).toEqual({ type: "operator", name: "B*" });
      expect(tokenizer.nextToken()).toEqual({ type: "operator", name: "b*" });
      expect(tokenizer.nextToken()).toEqual({ type: "operator", name: "W*" });
      expect(tokenizer.nextToken()).toEqual({ type: "operator", name: "T*" });
    });

    it("parses quote operators", () => {
      const tokenizer = new ContentTokenizer(encode(`' "`));

      expect(tokenizer.nextToken()).toEqual({ type: "operator", name: "'" });
      expect(tokenizer.nextToken()).toEqual({ type: "operator", name: '"' });
    });
  });

  describe("arrays", () => {
    it("parses simple arrays", () => {
      const tokenizer = new ContentTokenizer(encode("[1 2 3]"));

      const arr = tokenizer.nextToken();
      expect(arr?.type).toBe("array");

      if (arr?.type === "array") {
        expect(arr.items).toHaveLength(3);
        expect(arr.items[0]).toEqual({ type: "number", value: 1 });
        expect(arr.items[1]).toEqual({ type: "number", value: 2 });
        expect(arr.items[2]).toEqual({ type: "number", value: 3 });
      }
    });

    it("parses mixed arrays", () => {
      const tokenizer = new ContentTokenizer(encode("[/Name 42 (text)]"));

      const arr = tokenizer.nextToken();
      expect(arr?.type).toBe("array");

      if (arr?.type === "array") {
        expect(arr.items).toHaveLength(3);
        expect(arr.items[0]).toEqual({ type: "name", value: "Name" });
        expect(arr.items[1]).toEqual({ type: "number", value: 42 });
        expect(arr.items[2]?.type).toBe("string");
      }
    });

    it("parses nested arrays", () => {
      const tokenizer = new ContentTokenizer(encode("[[1 2] [3 4]]"));

      const arr = tokenizer.nextToken();
      expect(arr?.type).toBe("array");

      if (arr?.type === "array") {
        expect(arr.items).toHaveLength(2);
        expect(arr.items[0]?.type).toBe("array");
        expect(arr.items[1]?.type).toBe("array");
      }
    });
  });

  describe("dictionaries", () => {
    it("parses simple dicts", () => {
      const tokenizer = new ContentTokenizer(encode("<</Type /XObject>>"));

      const dict = tokenizer.nextToken();
      expect(dict?.type).toBe("dict");

      if (dict?.type === "dict") {
        expect(dict.entries.size).toBe(1);
        expect(dict.entries.get("Type")).toEqual({ type: "name", value: "XObject" });
      }
    });

    it("parses dicts with multiple entries", () => {
      const tokenizer = new ContentTokenizer(encode("<</W 10 /H 20 /CS /G>>"));

      const dict = tokenizer.nextToken();
      expect(dict?.type).toBe("dict");

      if (dict?.type === "dict") {
        expect(dict.entries.size).toBe(3);
        expect(dict.entries.get("W")).toEqual({ type: "number", value: 10 });
        expect(dict.entries.get("H")).toEqual({ type: "number", value: 20 });
        expect(dict.entries.get("CS")).toEqual({ type: "name", value: "G" });
      }
    });
  });

  describe("content stream sequences", () => {
    it("parses graphics state operations", () => {
      const tokenizer = new ContentTokenizer(encode("q 1 0 0 1 50 700 cm"));

      expect(tokenizer.nextToken()).toEqual({ type: "operator", name: "q" });
      expect(tokenizer.nextToken()).toEqual({ type: "number", value: 1 });
      expect(tokenizer.nextToken()).toEqual({ type: "number", value: 0 });
      expect(tokenizer.nextToken()).toEqual({ type: "number", value: 0 });
      expect(tokenizer.nextToken()).toEqual({ type: "number", value: 1 });
      expect(tokenizer.nextToken()).toEqual({ type: "number", value: 50 });
      expect(tokenizer.nextToken()).toEqual({ type: "number", value: 700 });
      expect(tokenizer.nextToken()).toEqual({ type: "operator", name: "cm" });
    });

    it("parses text operations", () => {
      const tokenizer = new ContentTokenizer(encode("BT /F1 12 Tf (Hello) Tj ET"));

      expect(tokenizer.nextToken()).toEqual({ type: "operator", name: "BT" });
      expect(tokenizer.nextToken()).toEqual({ type: "name", value: "F1" });
      expect(tokenizer.nextToken()).toEqual({ type: "number", value: 12 });
      expect(tokenizer.nextToken()).toEqual({ type: "operator", name: "Tf" });

      const str = tokenizer.nextToken();
      expect(str?.type).toBe("string");

      expect(tokenizer.nextToken()).toEqual({ type: "operator", name: "Tj" });
      expect(tokenizer.nextToken()).toEqual({ type: "operator", name: "ET" });
    });
  });

  describe("lenient parsing", () => {
    it("skips unexpected closing bracket and continues", () => {
      const tokenizer = new ContentTokenizer(encode("] q Q"));

      // Should skip the ] and return q
      expect(tokenizer.nextToken()).toEqual({ type: "operator", name: "q" });
      expect(tokenizer.nextToken()).toEqual({ type: "operator", name: "Q" });
    });

    it("skips unexpected >> and continues", () => {
      const tokenizer = new ContentTokenizer(encode(">> 42 m"));

      // Should skip the >> and return 42
      expect(tokenizer.nextToken()).toEqual({ type: "number", value: 42 });
      expect(tokenizer.nextToken()).toEqual({ type: "operator", name: "m" });
    });
  });

  describe("peek and eof", () => {
    it("peek returns same token until consumed", () => {
      const tokenizer = new ContentTokenizer(encode("q Q"));

      expect(tokenizer.peek()).toEqual({ type: "operator", name: "q" });
      expect(tokenizer.peek()).toEqual({ type: "operator", name: "q" });
      expect(tokenizer.nextToken()).toEqual({ type: "operator", name: "q" });
      expect(tokenizer.peek()).toEqual({ type: "operator", name: "Q" });
    });

    it("eof returns true when exhausted", () => {
      const tokenizer = new ContentTokenizer(encode("q"));

      expect(tokenizer.eof()).toBe(false);
      tokenizer.nextToken();
      expect(tokenizer.eof()).toBe(true);
    });

    it("handles empty input", () => {
      const tokenizer = new ContentTokenizer(encode(""));

      expect(tokenizer.eof()).toBe(true);
      expect(tokenizer.nextToken()).toBeNull();
    });
  });
});
