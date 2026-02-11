import { describe, expect, it } from "vitest";

import { searchPage } from "./text-search";
import type { ExtractedChar, PageText, TextLine, TextSpan } from "./types";

// Helper to create a simple PageText for testing
function createPageText(text: string, pageIndex = 0): PageText {
  // Create characters for each character in the text
  const chars: ExtractedChar[] = [];
  let x = 0;

  for (const char of text) {
    if (char === "\n") {
      continue; // Newlines are handled at line level
    }

    chars.push({
      char,
      bbox: { x, y: 0, width: 10, height: 12 },
      fontSize: 12,
      fontName: "Helvetica",
      baseline: 10,
      sequenceIndex: chars.length,
    });
    x += 10;
  }

  // Split into lines
  const lineTexts = text.split("\n");
  const lines: TextLine[] = [];
  let charIndex = 0;

  for (let lineIdx = 0; lineIdx < lineTexts.length; lineIdx++) {
    const lineText = lineTexts[lineIdx];
    const lineChars = chars.slice(charIndex, charIndex + lineText.length);
    charIndex += lineText.length;

    const span: TextSpan = {
      text: lineText,
      bbox: { x: 0, y: 0, width: lineText.length * 10, height: 12 },
      chars: lineChars,
      fontSize: 12,
      fontName: "Helvetica",
    };

    lines.push({
      text: lineText,
      bbox: { x: 0, y: 100 - lineIdx * 20, width: lineText.length * 10, height: 12 },
      spans: [span],
      baseline: 100 - lineIdx * 20,
    });
  }

  return {
    pageIndex,
    width: 612,
    height: 792,
    lines,
    text,
  };
}

describe("TextSearch", () => {
  describe("searchPage", () => {
    it("finds simple string match", () => {
      const pageText = createPageText("Hello World");
      const matches = searchPage(pageText, "World");

      expect(matches).toHaveLength(1);
      expect(matches[0].text).toBe("World");
      expect(matches[0].pageIndex).toBe(0);
    });

    it("finds multiple occurrences", () => {
      const pageText = createPageText("cat cat cat");
      const matches = searchPage(pageText, "cat");

      expect(matches).toHaveLength(3);
    });

    it("returns empty array for no match", () => {
      const pageText = createPageText("Hello World");
      const matches = searchPage(pageText, "xyz");

      expect(matches).toHaveLength(0);
    });

    it("finds regex matches", () => {
      const pageText = createPageText("The price is $10.99");
      const matches = searchPage(pageText, /\$[\d.]+/);

      expect(matches).toHaveLength(1);
      expect(matches[0].text).toBe("$10.99");
    });

    it("finds regex matches with global flag", () => {
      const pageText = createPageText("Values: 123, 456, 789");
      const matches = searchPage(pageText, /\d+/g);

      expect(matches).toHaveLength(3);
      expect(matches[0].text).toBe("123");
      expect(matches[1].text).toBe("456");
      expect(matches[2].text).toBe("789");
    });

    it("finds template placeholders", () => {
      const pageText = createPageText("Hello {{ name }}, your order is {{ order_id }}");
      const matches = searchPage(pageText, /\{\{\s*\w+\s*\}\}/g);

      expect(matches).toHaveLength(2);
      expect(matches[0].text).toBe("{{ name }}");
      expect(matches[1].text).toBe("{{ order_id }}");
    });

    describe("case sensitivity", () => {
      it("is case-sensitive by default", () => {
        const pageText = createPageText("Hello hello HELLO");
        const matches = searchPage(pageText, "Hello");

        expect(matches).toHaveLength(1);
      });

      it("can be case-insensitive", () => {
        const pageText = createPageText("Hello hello HELLO");
        const matches = searchPage(pageText, "hello", { caseSensitive: false });

        expect(matches).toHaveLength(3);
      });
    });

    describe("whole word matching", () => {
      it("finds partial matches by default", () => {
        const pageText = createPageText("cat category catch");
        const matches = searchPage(pageText, "cat");

        expect(matches).toHaveLength(3);
      });

      it("can match whole words only", () => {
        const pageText = createPageText("cat category catch");
        const matches = searchPage(pageText, "cat", { wholeWord: true });

        expect(matches).toHaveLength(1);
        expect(matches[0].text).toBe("cat");
      });

      it("handles punctuation as word boundary", () => {
        const pageText = createPageText("word, another-word word.");
        const matches = searchPage(pageText, "word", { wholeWord: true });

        expect(matches).toHaveLength(3);
      });
    });

    describe("bounding boxes", () => {
      it("returns bounding box for match", () => {
        const pageText = createPageText("Hello World");
        const matches = searchPage(pageText, "World");

        expect(matches[0].bbox).toBeDefined();
        expect(matches[0].bbox.x).toBeGreaterThan(0);
        expect(matches[0].bbox.width).toBeGreaterThan(0);
      });

      it("returns character boxes for highlighting", () => {
        const pageText = createPageText("Hello World");
        const matches = searchPage(pageText, "World");

        expect(matches[0].charBoxes).toHaveLength(5); // W-o-r-l-d
      });
    });
  });
});
