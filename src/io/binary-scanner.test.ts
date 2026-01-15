import { describe, expect, it } from "vitest";

import { BinaryScanner } from "./binary-scanner.ts";

describe("BinaryScanner", () => {
  describe("inherits Scanner behavior", () => {
    it("has position, length, isAtEnd", () => {
      const scanner = new BinaryScanner(new Uint8Array([0x01, 0x02, 0x03]));

      expect(scanner.position).toBe(0);
      expect(scanner.length).toBe(3);
      expect(scanner.isAtEnd).toBe(false);
    });

    it("peek and advance work", () => {
      const scanner = new BinaryScanner(new Uint8Array([0x41, 0x42]));

      expect(scanner.peek()).toBe(0x41);
      expect(scanner.advance()).toBe(0x41);
      expect(scanner.peek()).toBe(0x42);
    });

    it("moveTo works", () => {
      const scanner = new BinaryScanner(new Uint8Array([0x01, 0x02, 0x03, 0x04]));

      scanner.moveTo(2);

      expect(scanner.position).toBe(2);
      expect(scanner.peek()).toBe(0x03);
    });
  });

  describe("basic reads", () => {
    it("reads uint8", () => {
      const scanner = new BinaryScanner(new Uint8Array([0x00, 0x7f, 0x80, 0xff]));
      expect(scanner.readUint8()).toBe(0);
      expect(scanner.readUint8()).toBe(127);
      expect(scanner.readUint8()).toBe(128);
      expect(scanner.readUint8()).toBe(255);
    });

    it("reads int8", () => {
      const scanner = new BinaryScanner(new Uint8Array([0x00, 0x7f, 0x80, 0xff]));
      expect(scanner.readInt8()).toBe(0);
      expect(scanner.readInt8()).toBe(127);
      expect(scanner.readInt8()).toBe(-128);
      expect(scanner.readInt8()).toBe(-1);
    });

    it("reads uint16 big-endian", () => {
      const scanner = new BinaryScanner(new Uint8Array([0x01, 0x02, 0xff, 0xff]));
      expect(scanner.readUint16()).toBe(0x0102);
      expect(scanner.readUint16()).toBe(0xffff);
    });

    it("reads int16 big-endian", () => {
      const scanner = new BinaryScanner(new Uint8Array([0x00, 0x01, 0xff, 0xff, 0x80, 0x00]));
      expect(scanner.readInt16()).toBe(1);
      expect(scanner.readInt16()).toBe(-1);
      expect(scanner.readInt16()).toBe(-32768);
    });

    it("reads uint32 big-endian", () => {
      const scanner = new BinaryScanner(new Uint8Array([0x01, 0x02, 0x03, 0x04]));
      expect(scanner.readUint32()).toBe(0x01020304);
    });

    it("reads int32 big-endian", () => {
      const scanner = new BinaryScanner(new Uint8Array([0xff, 0xff, 0xff, 0xff]));
      expect(scanner.readInt32()).toBe(-1);
    });

    it("reads uint24 big-endian", () => {
      const scanner = new BinaryScanner(new Uint8Array([0x01, 0x02, 0x03]));
      expect(scanner.readUint24()).toBe(0x010203);
    });
  });

  describe("fixed-point reads", () => {
    it("reads 16.16 fixed-point", () => {
      // 1.5 = 0x00018000
      const scanner = new BinaryScanner(new Uint8Array([0x00, 0x01, 0x80, 0x00]));
      expect(scanner.readFixed()).toBe(1.5);
    });

    it("reads 2.14 fixed-point (F2Dot14)", () => {
      // 1.0 = 0x4000
      const scanner = new BinaryScanner(new Uint8Array([0x40, 0x00]));
      expect(scanner.readF2Dot14()).toBe(1.0);

      // -1.0 = 0xC000
      const scanner2 = new BinaryScanner(new Uint8Array([0xc0, 0x00]));
      expect(scanner2.readF2Dot14()).toBe(-1.0);
    });
  });

  describe("tag and string reads", () => {
    it("reads 4-byte tag", () => {
      const scanner = new BinaryScanner(new Uint8Array([0x68, 0x65, 0x61, 0x64])); // "head"
      expect(scanner.readTag()).toBe("head");
    });

    it("reads ASCII string", () => {
      const scanner = new BinaryScanner(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]));
      expect(scanner.readAscii(5)).toBe("Hello");
    });

    it("reads UTF-16BE string", () => {
      // "Hi" in UTF-16BE
      const scanner = new BinaryScanner(new Uint8Array([0x00, 0x48, 0x00, 0x69]));
      expect(scanner.readUtf16BE(4)).toBe("Hi");
    });

    it("reads null-terminated ASCII string", () => {
      const scanner = new BinaryScanner(new Uint8Array([0x48, 0x69, 0x00, 0x58]));
      expect(scanner.readNullTerminatedAscii()).toBe("Hi");
      expect(scanner.position).toBe(3); // Positioned after null
    });
  });

  describe("position management", () => {
    it("tracks position correctly", () => {
      const scanner = new BinaryScanner(new Uint8Array([0x01, 0x02, 0x03, 0x04]));
      expect(scanner.position).toBe(0);
      scanner.readUint8();
      expect(scanner.position).toBe(1);
      scanner.readUint16();
      expect(scanner.position).toBe(3);
    });

    it("skip advances position", () => {
      const scanner = new BinaryScanner(new Uint8Array([0x01, 0x02, 0x03, 0x04]));
      scanner.skip(2);
      expect(scanner.readUint8()).toBe(0x03);
    });

    it("reports remaining bytes", () => {
      const scanner = new BinaryScanner(new Uint8Array([0x01, 0x02, 0x03, 0x04]));
      expect(scanner.remaining).toBe(4);
      scanner.readUint16();
      expect(scanner.remaining).toBe(2);
    });
  });

  describe("byte array reads", () => {
    it("reads bytes as view", () => {
      const data = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      const scanner = new BinaryScanner(data);
      const bytes = scanner.readBytes(2);
      expect(bytes).toEqual(new Uint8Array([0x01, 0x02]));
      expect(bytes.buffer).toBe(data.buffer); // Same underlying buffer
    });

    it("reads bytes as copy", () => {
      const data = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      const scanner = new BinaryScanner(data);
      const bytes = scanner.readBytesCopy(2);
      expect(bytes).toEqual(new Uint8Array([0x01, 0x02]));
      expect(bytes.buffer).not.toBe(data.buffer); // Different buffer
    });

    it("throws when reading past end", () => {
      const scanner = new BinaryScanner(new Uint8Array([0x01, 0x02]));
      expect(() => scanner.readBytes(3)).toThrow(RangeError);
    });
  });

  describe("slicing", () => {
    it("creates sub-scanner", () => {
      const scanner = new BinaryScanner(new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]));
      const sub = scanner.slice(1, 3);
      expect(sub.length).toBe(3);
      expect(sub.readUint8()).toBe(0x02);
      expect(sub.readUint8()).toBe(0x03);
      expect(sub.readUint8()).toBe(0x04);
    });

    it("throws on invalid slice", () => {
      const scanner = new BinaryScanner(new Uint8Array([0x01, 0x02]));
      expect(() => scanner.slice(-1, 1)).toThrow(RangeError);
      expect(() => scanner.slice(0, 5)).toThrow(RangeError);
    });
  });

  describe("peeking", () => {
    it("peeks without advancing", () => {
      const scanner = new BinaryScanner(new Uint8Array([0x01, 0x02, 0x03, 0x04]));
      expect(scanner.peek()).toBe(0x01); // Inherited from Scanner
      expect(scanner.peekUint16()).toBe(0x0102);
      expect(scanner.peekUint16(1)).toBe(0x0203);
      expect(scanner.position).toBe(0); // Unchanged
    });
  });

  describe("works with ArrayBuffer offset", () => {
    it("handles Uint8Array with byteOffset", () => {
      const buffer = new ArrayBuffer(10);
      const view = new Uint8Array(buffer);
      view.set([0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]);

      // Create a subarray with offset
      const subarray = view.subarray(2, 6);
      const scanner = new BinaryScanner(subarray);

      expect(scanner.readUint8()).toBe(0x01);
      expect(scanner.readUint8()).toBe(0x02);
      expect(scanner.readUint16()).toBe(0x0304);
    });
  });

  describe("error handling", () => {
    it("throws on read past end", () => {
      const scanner = new BinaryScanner(new Uint8Array([0x01]));
      expect(() => scanner.readUint16()).toThrow(RangeError);
    });

    it("throws on peek past end", () => {
      const scanner = new BinaryScanner(new Uint8Array([0x01]));
      expect(() => scanner.peekUint16()).toThrow(RangeError);
    });
  });
});
