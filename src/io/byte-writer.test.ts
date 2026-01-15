/**
 * Tests for ByteWriter - efficient byte buffer writer.
 */

import { stringToBytes } from "#src/test-utils";
import { describe, expect, it } from "vitest";

import { ByteWriter } from "./byte-writer";

describe("ByteWriter", () => {
  describe("construction", () => {
    it("creates empty writer with default options", () => {
      const writer = new ByteWriter();

      expect(writer.position).toBe(0);
    });

    it("creates writer with custom initial size", () => {
      const writer = new ByteWriter(undefined, { initialSize: 1024 });

      expect(writer.position).toBe(0);
    });

    it("initializes with existing bytes", () => {
      const existing = stringToBytes("Hello");
      const writer = new ByteWriter(existing);

      expect(writer.position).toBe(5);
    });

    it("initializes with existing bytes and continues writing", () => {
      const existing = stringToBytes("Hello");
      const writer = new ByteWriter(existing);

      writer.writeAscii(" World");
      const result = writer.toBytes();

      expect(result).toEqual(stringToBytes("Hello World"));
    });
  });

  describe("writeByte()", () => {
    it("writes single byte", () => {
      const writer = new ByteWriter();

      writer.writeByte(0x41);
      expect(writer.position).toBe(1);

      const result = writer.toBytes();
      expect(result).toEqual(new Uint8Array([0x41]));
    });

    it("writes multiple bytes sequentially", () => {
      const writer = new ByteWriter();

      writer.writeByte(0x50);
      writer.writeByte(0x44);
      writer.writeByte(0x46);

      const result = writer.toBytes();
      expect(result).toEqual(stringToBytes("PDF"));
    });
  });

  describe("writeBytes()", () => {
    it("writes byte array", () => {
      const writer = new ByteWriter();
      const data = new Uint8Array([0x01, 0x02, 0x03, 0x04]);

      writer.writeBytes(data);

      expect(writer.position).toBe(4);
      expect(writer.toBytes()).toEqual(data);
    });

    it("writes empty array", () => {
      const writer = new ByteWriter();

      writer.writeBytes(new Uint8Array(0));

      expect(writer.position).toBe(0);
      expect(writer.toBytes()).toEqual(new Uint8Array(0));
    });

    it("writes large byte array", () => {
      const writer = new ByteWriter(undefined, { initialSize: 16 });
      const data = new Uint8Array(1000).fill(0xaa);

      writer.writeBytes(data);

      expect(writer.position).toBe(1000);
      expect(writer.toBytes()).toEqual(data);
    });
  });

  describe("writeAscii()", () => {
    it("writes ASCII string", () => {
      const writer = new ByteWriter();

      writer.writeAscii("Hello");

      expect(writer.position).toBe(5);
      expect(writer.toBytes()).toEqual(stringToBytes("Hello"));
    });

    it("writes empty string", () => {
      const writer = new ByteWriter();

      writer.writeAscii("");

      expect(writer.position).toBe(0);
    });

    it("writes PDF keywords", () => {
      const writer = new ByteWriter();

      writer.writeAscii("null");
      writer.writeAscii(" ");
      writer.writeAscii("true");
      writer.writeAscii(" ");
      writer.writeAscii("false");

      expect(writer.toBytes()).toEqual(stringToBytes("null true false"));
    });
  });

  describe("writeUtf8()", () => {
    it("writes UTF-8 encoded string", () => {
      const writer = new ByteWriter();

      writer.writeUtf8("Hello");

      expect(writer.toBytes()).toEqual(stringToBytes("Hello"));
    });

    it("writes multi-byte UTF-8 characters", () => {
      const writer = new ByteWriter();

      // Euro sign is 3 bytes in UTF-8: 0xE2 0x82 0xAC
      writer.writeUtf8("€");

      const result = writer.toBytes();
      expect(result).toEqual(new Uint8Array([0xe2, 0x82, 0xac]));
    });

    it("writes emoji (4-byte UTF-8)", () => {
      const writer = new ByteWriter();

      // 😀 is 4 bytes in UTF-8
      writer.writeUtf8("😀");

      const result = writer.toBytes();
      expect(result.length).toBe(4);
    });
  });

  describe("position", () => {
    it("tracks position accurately", () => {
      const writer = new ByteWriter();

      expect(writer.position).toBe(0);

      writer.writeByte(0x41);
      expect(writer.position).toBe(1);

      writer.writeBytes(new Uint8Array([0x42, 0x43, 0x44]));
      expect(writer.position).toBe(4);

      writer.writeAscii("EFG");
      expect(writer.position).toBe(7);
    });

    it("includes existing bytes in position", () => {
      const existing = new Uint8Array(100);
      const writer = new ByteWriter(existing);

      expect(writer.position).toBe(100);

      writer.writeByte(0x41);
      expect(writer.position).toBe(101);
    });
  });

  describe("buffer growth", () => {
    it("grows buffer automatically", () => {
      const writer = new ByteWriter(undefined, { initialSize: 8 });

      // Write 100 bytes, should grow buffer multiple times
      for (let i = 0; i < 100; i++) {
        writer.writeByte(i);
      }

      const result = writer.toBytes();
      expect(result.length).toBe(100);

      expect(result.every((b, i) => b === i)).toBe(true);
    });

    it("grows when writing large chunk", () => {
      const writer = new ByteWriter(undefined, { initialSize: 16 });
      const data = new Uint8Array(1000).fill(0x55);

      writer.writeBytes(data);

      expect(writer.toBytes()).toEqual(data);
    });

    it("handles writing more than 64KB", () => {
      const writer = new ByteWriter();
      const data = new Uint8Array(100000).fill(0xab);

      writer.writeBytes(data);

      expect(writer.position).toBe(100000);
      const result = writer.toBytes();
      expect(result.length).toBe(100000);
      expect(result.every(b => b === 0xab)).toBe(true);
    });
  });

  describe("toBytes()", () => {
    it("returns correct slice", () => {
      const writer = new ByteWriter(undefined, { initialSize: 1024 });

      writer.writeAscii("PDF");

      const result = writer.toBytes();
      expect(result.length).toBe(3);
      expect(result).toEqual(stringToBytes("PDF"));
    });

    it("returns copy, not internal buffer", () => {
      const writer = new ByteWriter();
      writer.writeAscii("test");

      const result1 = writer.toBytes();
      const result2 = writer.toBytes();

      expect(result1).not.toBe(result2);
      expect(result1).toEqual(result2);
    });

    it("returns empty array for empty writer", () => {
      const writer = new ByteWriter();

      expect(writer.toBytes()).toEqual(new Uint8Array(0));
    });
  });

  describe("maxSize limit", () => {
    it("throws when exceeding maxSize", () => {
      const writer = new ByteWriter(undefined, { maxSize: 100 });

      // Write within limit
      writer.writeBytes(new Uint8Array(50));

      // Try to exceed limit
      expect(() => writer.writeBytes(new Uint8Array(60))).toThrow(
        "ByteWriter exceeded maximum size of 100 bytes",
      );
    });

    it("allows writing exactly at maxSize", () => {
      const writer = new ByteWriter(undefined, { maxSize: 100, initialSize: 100 });

      // Should not throw
      writer.writeBytes(new Uint8Array(100));

      expect(writer.position).toBe(100);
    });

    it("includes existing bytes in limit calculation", () => {
      const existing = new Uint8Array(50);
      const writer = new ByteWriter(existing, { maxSize: 100 });

      // Should allow 50 more bytes
      writer.writeBytes(new Uint8Array(40));

      // But not 60 more
      expect(() => writer.writeBytes(new Uint8Array(20))).toThrow(
        "ByteWriter exceeded maximum size of 100 bytes",
      );
    });
  });

  describe("incremental save support", () => {
    it("preserves existing bytes and appends", () => {
      // Simulate loading an existing PDF
      const originalPdf = stringToBytes("%PDF-1.7\noriginal content");
      const writer = new ByteWriter(originalPdf);

      // Append new content
      writer.writeAscii("\n%%EOF");

      const result = writer.toBytes();
      expect(result).toEqual(stringToBytes("%PDF-1.7\noriginal content\n%%EOF"));
    });

    it("handles large existing bytes", () => {
      const large = new Uint8Array(1000000).fill(0x42); // 1MB
      const writer = new ByteWriter(large);

      writer.writeAscii("end");

      const result = writer.toBytes();
      expect(result.length).toBe(1000003);
      expect(result.slice(-3)).toEqual(stringToBytes("end"));
    });
  });

  describe("large writes (performance)", () => {
    it("handles 1MB+ writes efficiently", () => {
      const writer = new ByteWriter();
      const oneMB = new Uint8Array(1024 * 1024);

      // Fill with pattern for verification
      for (let i = 0; i < oneMB.length; i++) {
        oneMB[i] = i % 256;
      }

      writer.writeBytes(oneMB);

      const result = writer.toBytes();
      expect(result.length).toBe(1024 * 1024);

      // Verify pattern
      expect(result.every((b, i) => b === i % 256)).toBe(true);
    });

    it("handles many small writes", () => {
      const writer = new ByteWriter();

      // 100,000 small writes
      for (let i = 0; i < 100000; i++) {
        writer.writeByte(i % 256);
      }

      expect(writer.position).toBe(100000);
    });
  });
});
