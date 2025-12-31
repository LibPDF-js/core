/**
 * Tests for Scanner - the lowest-level byte reader.
 *
 * Scanner wraps a Uint8Array and provides:
 * - Position tracking with save/restore for backtracking
 * - Peeking and advancing through bytes
 * - Minimal API for the lexer to build on
 */

import { describe, expect, it } from "vitest";
import { stringToBytes } from "#src/test-utils";
import { Scanner } from "./scanner";

describe("Scanner", () => {
  describe("construction", () => {
    it("creates scanner from empty Uint8Array", () => {
      const scanner = new Scanner(new Uint8Array(0));

      expect(scanner.length).toBe(0);
      expect(scanner.position).toBe(0);
      expect(scanner.isAtEnd).toBe(true);
    });

    it("creates scanner from non-empty Uint8Array", () => {
      const bytes = stringToBytes("hello");
      const scanner = new Scanner(bytes);

      expect(scanner.length).toBe(5);
      expect(scanner.position).toBe(0);
      expect(scanner.isAtEnd).toBe(false);
    });

    it("exposes bytes as readonly property", () => {
      const bytes = stringToBytes("PDF");
      const scanner = new Scanner(bytes);

      expect(scanner.bytes).toBe(bytes);
      expect(scanner.bytes[0]).toBe(0x50); // 'P'
    });
  });

  describe("peek()", () => {
    it("returns current byte without advancing", () => {
      const scanner = new Scanner(stringToBytes("AB"));

      expect(scanner.peek()).toBe(0x41); // 'A'
      expect(scanner.peek()).toBe(0x41); // still 'A'
      expect(scanner.position).toBe(0);
    });

    it("returns -1 at end of input", () => {
      const scanner = new Scanner(new Uint8Array(0));

      expect(scanner.peek()).toBe(-1);
    });

    it("returns -1 after advancing past all bytes", () => {
      const scanner = new Scanner(stringToBytes("X"));

      scanner.advance();
      expect(scanner.peek()).toBe(-1);
    });
  });

  describe("peekAt()", () => {
    it("returns byte at absolute offset", () => {
      const scanner = new Scanner(stringToBytes("ABCD"));

      expect(scanner.peekAt(0)).toBe(0x41); // 'A'
      expect(scanner.peekAt(1)).toBe(0x42); // 'B'
      expect(scanner.peekAt(2)).toBe(0x43); // 'C'
      expect(scanner.peekAt(3)).toBe(0x44); // 'D'

      expect(scanner.peekAt(4)).toBe(-1);
      expect(scanner.position).toBe(0);
    });

    it("does not affect current position", () => {
      const scanner = new Scanner(stringToBytes("ABC"));

      scanner.peekAt(2);
      expect(scanner.position).toBe(0);

      scanner.advance();
      scanner.peekAt(0);
      expect(scanner.position).toBe(1);
    });

    it("returns -1 for negative offset", () => {
      const scanner = new Scanner(stringToBytes("ABC"));

      expect(scanner.peekAt(-1)).toBe(-1);
      expect(scanner.peekAt(-100)).toBe(-1);
    });

    it("returns -1 for offset beyond length", () => {
      const scanner = new Scanner(stringToBytes("AB"));

      expect(scanner.peekAt(2)).toBe(-1);
      expect(scanner.peekAt(100)).toBe(-1);
    });

    it("returns -1 for empty scanner at any offset", () => {
      const scanner = new Scanner(new Uint8Array(0));

      expect(scanner.peekAt(0)).toBe(-1);
      expect(scanner.peekAt(1)).toBe(-1);
    });
  });

  describe("advance()", () => {
    it("returns current byte and advances position", () => {
      const scanner = new Scanner(stringToBytes("ABC"));

      expect(scanner.advance()).toBe(0x41); // 'A'
      expect(scanner.position).toBe(1);

      expect(scanner.advance()).toBe(0x42); // 'B'
      expect(scanner.position).toBe(2);

      expect(scanner.advance()).toBe(0x43); // 'C'
      expect(scanner.position).toBe(3);
    });

    it("returns -1 at end without advancing", () => {
      const scanner = new Scanner(stringToBytes("X"));

      scanner.advance(); // consume 'X'
      expect(scanner.position).toBe(1);

      expect(scanner.advance()).toBe(-1);
      expect(scanner.position).toBe(1); // didn't advance
    });

    it("returns -1 for empty scanner", () => {
      const scanner = new Scanner(new Uint8Array(0));

      expect(scanner.advance()).toBe(-1);
      expect(scanner.position).toBe(0);
    });
  });

  describe("match()", () => {
    it("advances and returns true when byte matches", () => {
      const scanner = new Scanner(stringToBytes("ABC"));

      expect(scanner.match(0x41)).toBe(true); // 'A'
      expect(scanner.position).toBe(1);
    });

    it("does not advance and returns false when byte differs", () => {
      const scanner = new Scanner(stringToBytes("ABC"));

      expect(scanner.match(0x58)).toBe(false); // 'X' doesn't match 'A'
      expect(scanner.position).toBe(0);
    });

    it("returns false at end of input", () => {
      const scanner = new Scanner(new Uint8Array(0));

      expect(scanner.match(0x41)).toBe(false);
      expect(scanner.position).toBe(0);
    });

    it("can match consecutive bytes", () => {
      const scanner = new Scanner(stringToBytes("PDF"));

      expect(scanner.match(0x50)).toBe(true); // 'P'
      expect(scanner.match(0x44)).toBe(true); // 'D'
      expect(scanner.match(0x46)).toBe(true); // 'F'
      expect(scanner.position).toBe(3);
    });

    it("stops matching on first mismatch", () => {
      const scanner = new Scanner(stringToBytes("PDF"));

      expect(scanner.match(0x50)).toBe(true); // 'P'
      expect(scanner.match(0x58)).toBe(false); // 'X' doesn't match 'D'
      expect(scanner.position).toBe(1);
    });
  });

  describe("position", () => {
    it("starts at 0", () => {
      const scanner = new Scanner(stringToBytes("test"));

      expect(scanner.position).toBe(0);
    });

    it("is writable for backtracking", () => {
      const scanner = new Scanner(stringToBytes("test"));

      scanner.advance();
      scanner.advance();
      expect(scanner.position).toBe(2);

      scanner.moveTo(0);
      expect(scanner.position).toBe(0);
      expect(scanner.peek()).toBe(0x74); // 't'
    });

    it("clamps to valid range when set directly", () => {
      const scanner = new Scanner(stringToBytes("ABC"));

      scanner.moveTo(-5);
      expect(scanner.position).toBe(0);

      scanner.moveTo(100);
      expect(scanner.position).toBe(3); // clamped to length
    });
  });

  describe("moveTo()", () => {
    it("sets position to given offset", () => {
      const scanner = new Scanner(stringToBytes("ABCD"));

      scanner.moveTo(2);
      expect(scanner.position).toBe(2);
      expect(scanner.peek()).toBe(0x43); // 'C'
    });

    it("clamps negative offset to 0", () => {
      const scanner = new Scanner(stringToBytes("ABC"));

      scanner.moveTo(-10);
      expect(scanner.position).toBe(0);
    });

    it("clamps offset beyond length to length", () => {
      const scanner = new Scanner(stringToBytes("ABC"));

      scanner.moveTo(100);
      expect(scanner.position).toBe(3);
      expect(scanner.isAtEnd).toBe(true);
    });

    it("allows moving to exact length (at end)", () => {
      const scanner = new Scanner(stringToBytes("AB"));

      scanner.moveTo(2);
      expect(scanner.position).toBe(2);
      expect(scanner.isAtEnd).toBe(true);
      expect(scanner.peek()).toBe(-1);
    });
  });

  describe("isAtEnd", () => {
    it("is true when position equals length", () => {
      const scanner = new Scanner(stringToBytes("X"));

      expect(scanner.isAtEnd).toBe(false);
      scanner.advance();
      expect(scanner.isAtEnd).toBe(true);
    });

    it("is true for empty scanner", () => {
      const scanner = new Scanner(new Uint8Array(0));

      expect(scanner.isAtEnd).toBe(true);
    });

    it("becomes false after moving back", () => {
      const scanner = new Scanner(stringToBytes("AB"));

      scanner.advance();
      scanner.advance();
      expect(scanner.isAtEnd).toBe(true);

      scanner.moveTo(0);
      expect(scanner.isAtEnd).toBe(false);
    });
  });

  describe("backtracking pattern", () => {
    it("supports save/restore position pattern", () => {
      const scanner = new Scanner(stringToBytes("%PDF-1.4"));

      // Try to match "%PDF"
      const mark = scanner.position;

      expect(scanner.match(0x25)).toBe(true); // '%'
      expect(scanner.match(0x50)).toBe(true); // 'P'
      expect(scanner.match(0x44)).toBe(true); // 'D'
      expect(scanner.match(0x46)).toBe(true); // 'F'
      expect(scanner.position).toBe(4);

      // Restore to beginning
      scanner.moveTo(mark);
      expect(scanner.position).toBe(0);
      expect(scanner.peek()).toBe(0x25); // '%'
    });

    it("supports multiple levels of backtracking", () => {
      const scanner = new Scanner(stringToBytes("ABCDEF"));

      const mark1 = scanner.position;
      scanner.advance(); // A
      scanner.advance(); // B

      const mark2 = scanner.position;
      scanner.advance(); // C
      scanner.advance(); // D

      expect(scanner.peek()).toBe(0x45); // 'E'

      scanner.moveTo(mark2);
      expect(scanner.peek()).toBe(0x43); // 'C'

      scanner.moveTo(mark1);
      expect(scanner.peek()).toBe(0x41); // 'A'
    });
  });

  describe("bytes access", () => {
    it("allows direct subarray access", () => {
      const scanner = new Scanner(stringToBytes("%PDF-1.4"));

      // Common pattern: read header directly
      const header = scanner.bytes.subarray(0, 4);
      expect(String.fromCharCode(...header)).toBe("%PDF");
    });

    it("bytes reference is same as constructor input", () => {
      const original = stringToBytes("test");
      const scanner = new Scanner(original);

      expect(scanner.bytes).toBe(original);
    });
  });

  describe("real-world patterns", () => {
    it("parses PDF header pattern", () => {
      const scanner = new Scanner(stringToBytes("%PDF-1.4\n"));

      // Check for PDF signature
      if (
        scanner.match(0x25) && // %
        scanner.match(0x50) && // P
        scanner.match(0x44) && // D
        scanner.match(0x46) && // F
        scanner.match(0x2d) // -
      ) {
        // Read version number
        const versionStart = scanner.position;
        while (scanner.peek() !== 0x0a && scanner.peek() !== -1) {
          scanner.advance();
        }
        const version = scanner.bytes.subarray(versionStart, scanner.position);
        expect(String.fromCharCode(...version)).toBe("1.4");
      }
    });

    it("scans for keyword pattern", () => {
      const scanner = new Scanner(stringToBytes("blah stream\ndata"));

      // Scan for "stream" keyword
      while (!scanner.isAtEnd) {
        if (
          scanner.match(0x73) && // s
          scanner.match(0x74) && // t
          scanner.match(0x72) && // r
          scanner.match(0x65) && // e
          scanner.match(0x61) && // a
          scanner.match(0x6d) // m
        ) {
          // Found "stream" - position is right after it
          expect(scanner.position).toBe(11);
          expect(scanner.peek()).toBe(0x0a); // newline after "stream"
          break;
        }
        scanner.advance();
      }
    });

    it("handles binary data", () => {
      // PDF often contains binary data after stream keyword
      const binary = new Uint8Array([0x00, 0xff, 0x89, 0x50, 0x4e, 0x47]);
      const scanner = new Scanner(binary);

      expect(scanner.advance()).toBe(0x00);
      expect(scanner.advance()).toBe(0xff);
      expect(scanner.advance()).toBe(0x89);
      expect(scanner.peek()).toBe(0x50);
    });
  });
});
