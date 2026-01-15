import { describe, expect, it } from "vitest";

import { BinaryScanner } from "./binary-scanner";
import { BinaryWriter } from "./binary-writer";

describe("BinaryWriter", () => {
  describe("integer writing", () => {
    it("should write uint8", () => {
      const writer = new BinaryWriter();
      writer.writeUint8(0);
      writer.writeUint8(127);
      writer.writeUint8(255);

      const bytes = writer.toBytes();
      expect(bytes).toEqual(new Uint8Array([0, 127, 255]));
    });

    it("should write int8", () => {
      const writer = new BinaryWriter();
      writer.writeInt8(0);
      writer.writeInt8(-1);
      writer.writeInt8(-128);

      const bytes = writer.toBytes();
      expect(bytes).toEqual(new Uint8Array([0, 255, 128]));
    });

    it("should write uint16 big-endian", () => {
      const writer = new BinaryWriter();
      writer.writeUint16(0x1234);
      writer.writeUint16(0xabcd);

      const bytes = writer.toBytes();
      expect(bytes).toEqual(new Uint8Array([0x12, 0x34, 0xab, 0xcd]));
    });

    it("should write int16 big-endian", () => {
      const writer = new BinaryWriter();
      writer.writeInt16(-1);
      writer.writeInt16(-32768);

      const bytes = writer.toBytes();
      expect(bytes).toEqual(new Uint8Array([0xff, 0xff, 0x80, 0x00]));
    });

    it("should write uint24 big-endian", () => {
      const writer = new BinaryWriter();
      writer.writeUint24(0x123456);

      const bytes = writer.toBytes();
      expect(bytes).toEqual(new Uint8Array([0x12, 0x34, 0x56]));
    });

    it("should write uint32 big-endian", () => {
      const writer = new BinaryWriter();
      writer.writeUint32(0x12345678);
      writer.writeUint32(0xdeadbeef);

      const bytes = writer.toBytes();
      expect(bytes).toEqual(new Uint8Array([0x12, 0x34, 0x56, 0x78, 0xde, 0xad, 0xbe, 0xef]));
    });

    it("should write int32 big-endian", () => {
      const writer = new BinaryWriter();
      writer.writeInt32(-1);
      writer.writeInt32(-2147483648);

      const bytes = writer.toBytes();
      expect(bytes).toEqual(new Uint8Array([0xff, 0xff, 0xff, 0xff, 0x80, 0x00, 0x00, 0x00]));
    });
  });

  describe("fixed-point numbers", () => {
    it("should write 16.16 fixed-point", () => {
      const writer = new BinaryWriter();
      writer.writeFixed(1.0);
      writer.writeFixed(0.5);
      writer.writeFixed(-1.0);

      const bytes = writer.toBytes();
      const scanner = new BinaryScanner(bytes);

      expect(scanner.readFixed()).toBeCloseTo(1.0, 4);
      expect(scanner.readFixed()).toBeCloseTo(0.5, 4);
      expect(scanner.readFixed()).toBeCloseTo(-1.0, 4);
    });

    it("should write 2.14 fixed-point", () => {
      const writer = new BinaryWriter();
      writer.writeF2Dot14(1.0);
      writer.writeF2Dot14(0.5);
      writer.writeF2Dot14(-1.0);

      const bytes = writer.toBytes();
      const scanner = new BinaryScanner(bytes);

      expect(scanner.readF2Dot14()).toBeCloseTo(1.0, 3);
      expect(scanner.readF2Dot14()).toBeCloseTo(0.5, 3);
      expect(scanner.readF2Dot14()).toBeCloseTo(-1.0, 3);
    });
  });

  describe("date/time", () => {
    it("should write LONGDATETIME", () => {
      const writer = new BinaryWriter();
      const date = new Date("2024-01-15T12:00:00Z");
      writer.writeLongDateTime(date);

      const bytes = writer.toBytes();
      const scanner = new BinaryScanner(bytes);
      const readDate = scanner.readLongDateTime();

      // Should be within a second of the original
      expect(Math.abs(readDate.getTime() - date.getTime())).toBeLessThan(1000);
    });

    it("should handle epoch date", () => {
      const writer = new BinaryWriter();
      const date = new Date("1904-01-01T00:00:00Z");
      writer.writeLongDateTime(date);

      const bytes = writer.toBytes();
      const scanner = new BinaryScanner(bytes);
      const readDate = scanner.readLongDateTime();

      expect(Math.abs(readDate.getTime() - date.getTime())).toBeLessThan(1000);
    });
  });

  describe("strings and tags", () => {
    it("should write 4-byte tag", () => {
      const writer = new BinaryWriter();
      writer.writeTag("head");
      writer.writeTag("OS/2");

      const bytes = writer.toBytes();
      const scanner = new BinaryScanner(bytes);

      expect(scanner.readTag()).toBe("head");
      expect(scanner.readTag()).toBe("OS/2");
    });

    it("should pad short tags with spaces", () => {
      const writer = new BinaryWriter();
      writer.writeTag("CFF");

      const bytes = writer.toBytes();
      expect(bytes).toEqual(new Uint8Array([0x43, 0x46, 0x46, 0x20])); // "CFF "
    });

    it("should write UTF-16BE string", () => {
      const writer = new BinaryWriter();
      writer.writeUtf16BE("ABC");

      const bytes = writer.toBytes();
      const scanner = new BinaryScanner(bytes);

      expect(scanner.readUtf16BE(6)).toBe("ABC");
    });

    it("should write null-terminated ASCII string", () => {
      const writer = new BinaryWriter();
      writer.writeNullTerminatedAscii("test");

      const bytes = writer.toBytes();
      expect(bytes).toEqual(new Uint8Array([0x74, 0x65, 0x73, 0x74, 0x00]));
    });
  });

  describe("padding and alignment", () => {
    it("should write padding bytes", () => {
      const writer = new BinaryWriter();
      writer.writeUint8(1);
      writer.writePadding(3);
      writer.writeUint8(2);

      const bytes = writer.toBytes();
      expect(bytes).toEqual(new Uint8Array([1, 0, 0, 0, 2]));
    });

    it("should write alignment padding", () => {
      const writer = new BinaryWriter();
      writer.writeUint8(1);
      writer.writeAlignmentPadding(4);
      writer.writeUint8(2);

      const bytes = writer.toBytes();
      expect(bytes.length).toBe(5);
      expect(bytes[0]).toBe(1);
      expect(bytes[4]).toBe(2);
    });

    it("should not add padding if already aligned", () => {
      const writer = new BinaryWriter();
      writer.writeUint32(1);
      writer.writeAlignmentPadding(4);
      writer.writeUint8(2);

      const bytes = writer.toBytes();
      expect(bytes.length).toBe(5);
    });
  });

  describe("offset writing", () => {
    it("should write 1-byte offset", () => {
      const writer = new BinaryWriter();
      writer.writeOffset(0x12, 1);

      expect(writer.toBytes()).toEqual(new Uint8Array([0x12]));
    });

    it("should write 2-byte offset", () => {
      const writer = new BinaryWriter();
      writer.writeOffset(0x1234, 2);

      expect(writer.toBytes()).toEqual(new Uint8Array([0x12, 0x34]));
    });

    it("should write 3-byte offset", () => {
      const writer = new BinaryWriter();
      writer.writeOffset(0x123456, 3);

      expect(writer.toBytes()).toEqual(new Uint8Array([0x12, 0x34, 0x56]));
    });

    it("should write 4-byte offset", () => {
      const writer = new BinaryWriter();
      writer.writeOffset(0x12345678, 4);

      expect(writer.toBytes()).toEqual(new Uint8Array([0x12, 0x34, 0x56, 0x78]));
    });

    it("should throw for invalid offset size", () => {
      const writer = new BinaryWriter();
      expect(() => writer.writeOffset(1, 5)).toThrow("Invalid offset size");
    });
  });

  describe("offsetSize static method", () => {
    it("should return 1 for values <= 0xff", () => {
      expect(BinaryWriter.offsetSize(0)).toBe(1);
      expect(BinaryWriter.offsetSize(255)).toBe(1);
    });

    it("should return 2 for values <= 0xffff", () => {
      expect(BinaryWriter.offsetSize(256)).toBe(2);
      expect(BinaryWriter.offsetSize(65535)).toBe(2);
    });

    it("should return 3 for values <= 0xffffff", () => {
      expect(BinaryWriter.offsetSize(65536)).toBe(3);
      expect(BinaryWriter.offsetSize(16777215)).toBe(3);
    });

    it("should return 4 for larger values", () => {
      expect(BinaryWriter.offsetSize(16777216)).toBe(4);
      expect(BinaryWriter.offsetSize(0xffffffff)).toBe(4);
    });
  });

  describe("round-trip with BinaryScanner", () => {
    it("should round-trip mixed data", () => {
      const writer = new BinaryWriter();
      writer.writeTag("test");
      writer.writeUint16(1234);
      writer.writeInt32(-5678);
      writer.writeFixed(3.14159);
      writer.writeUtf16BE("Hello");

      const bytes = writer.toBytes();
      const scanner = new BinaryScanner(bytes);

      expect(scanner.readTag()).toBe("test");
      expect(scanner.readUint16()).toBe(1234);
      expect(scanner.readInt32()).toBe(-5678);
      expect(scanner.readFixed()).toBeCloseTo(3.14159, 4);
      expect(scanner.readUtf16BE(10)).toBe("Hello");
    });
  });
});
