import { PdfDict } from "#src/objects/pdf-dict";
import { PdfNumber } from "#src/objects/pdf-number";
import pako from "pako";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ASCII85Filter } from "./ascii85-filter";
import { CCITTFaxFilter } from "./ccitt-fax-filter";
import { DecodeLimitError, resetDecodedBytes, setDecodeLimit } from "./decode-limit";
import { FlateFilter } from "./flate-filter";
import { LZWFilter } from "./lzw-filter";
import { RunLengthFilter } from "./run-length-filter";

describe("decode limits", () => {
  const flate = new FlateFilter();
  const lzw = new LZWFilter();
  const runLength = new RunLengthFilter();
  const ascii85 = new ASCII85Filter();
  const ccitt = new CCITTFaxFilter();

  // 1 MiB of zeros deflates to about a kilobyte
  const bomb = pako.deflate(new Uint8Array(1024 * 1024));

  // 100 runs of 128 bytes each = 12,800 bytes
  const runLengthData = new Uint8Array([...Array(100).fill([129, 0]).flat(), 128]);

  // 2000 zero bytes as literal LZW codes
  const lzwData = encodeLzw(new Uint8Array(2000));

  beforeEach(() => {
    resetDecodedBytes();
  });

  afterEach(() => {
    setDecodeLimit({});
    resetDecodedBytes();
  });

  describe("per-stream limit", () => {
    it("stops FlateDecode and throws DecodeLimitError", () => {
      setDecodeLimit({ maxStreamBytes: 64 * 1024 });

      expect(() => flate.decode(bomb)).toThrow(DecodeLimitError);
    });

    it("reports the limit on the error", () => {
      setDecodeLimit({ maxStreamBytes: 64 * 1024 });

      try {
        flate.decode(bomb);
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(DecodeLimitError);
        expect((error as DecodeLimitError).limit).toBe(64 * 1024);
        expect((error as DecodeLimitError).message).toBe(
          "Decoded data exceeds the limit of 65536 bytes",
        );
      }
    });

    it("stops LZWDecode and throws DecodeLimitError", () => {
      setDecodeLimit({ maxStreamBytes: 100 });

      expect(() => lzw.decode(lzwData)).toThrow(DecodeLimitError);
    });

    it("stops RunLengthDecode and throws DecodeLimitError", () => {
      setDecodeLimit({ maxStreamBytes: 1000 });

      expect(() => runLength.decode(runLengthData)).toThrow(DecodeLimitError);
    });

    it("stops CCITTFaxDecode before allocating row buffers sized by /Columns", () => {
      setDecodeLimit({ maxStreamBytes: 1024 });

      const params = PdfDict.of({ K: PdfNumber.of(-1), Columns: PdfNumber.of(2_000_000_000) });

      expect(() => ccitt.decode(new Uint8Array([0, 0]), params)).toThrow(DecodeLimitError);
    });

    it("stops ASCII85Decode on a run of z shortcuts", () => {
      setDecodeLimit({ maxStreamBytes: 100 });

      const data = new TextEncoder().encode("z".repeat(1000));

      expect(() => ascii85.decode(data)).toThrow(DecodeLimitError);
    });

    it("stops ASCII85Decode on complete groups", () => {
      setDecodeLimit({ maxStreamBytes: 10 });

      const data = new TextEncoder().encode("87cURD]j7BEbo80");

      expect(() => ascii85.decode(data)).toThrow(DecodeLimitError);
    });

    it("allows a stream that is within the limit", () => {
      setDecodeLimit({ maxStreamBytes: 2 * 1024 * 1024 });

      expect(flate.decode(bomb).length).toBe(1024 * 1024);
    });
  });

  describe("total limit", () => {
    it("counts every stream decoded since the last reset", () => {
      setDecodeLimit({ maxTotalBytes: 2500 });

      const data = pako.deflate(new Uint8Array(1000));

      expect(flate.decode(data).length).toBe(1000);
      expect(flate.decode(data).length).toBe(1000);
      expect(() => flate.decode(data)).toThrow(DecodeLimitError);
    });

    it("is not lowered by a CCITT stream with negative /Columns", () => {
      setDecodeLimit({ maxTotalBytes: 2500 });

      const data = pako.deflate(new Uint8Array(1000));
      const params = PdfDict.of({ K: PdfNumber.of(-1), Columns: PdfNumber.of(-1_000_000) });

      expect(flate.decode(data).length).toBe(1000);
      expect(() => ccitt.decode(new Uint8Array([0, 0]), params)).toThrow(
        "/Columns must be a positive integer",
      );
      expect(flate.decode(data).length).toBe(1000);
      expect(() => flate.decode(data)).toThrow(DecodeLimitError);
    });

    it("starts a new count after resetDecodedBytes", () => {
      setDecodeLimit({ maxTotalBytes: 1500 });

      const data = pako.deflate(new Uint8Array(1000));

      expect(flate.decode(data).length).toBe(1000);

      resetDecodedBytes();

      expect(flate.decode(data).length).toBe(1000);
    });

    it("is shared across filter types", () => {
      setDecodeLimit({ maxTotalBytes: 13_000 });

      expect(runLength.decode(runLengthData).length).toBe(12_800);
      expect(() => flate.decode(pako.deflate(new Uint8Array(1000)))).toThrow(DecodeLimitError);
    });
  });

  describe("onExceeded", () => {
    it("fires when the per-stream limit is hit", () => {
      const onExceeded = vi.fn();

      setDecodeLimit({ maxStreamBytes: 1000, onExceeded });

      expect(() => runLength.decode(runLengthData)).toThrow(DecodeLimitError);
      expect(onExceeded).toHaveBeenCalledTimes(1);
    });

    it("fires when the total limit is hit", () => {
      const onExceeded = vi.fn();

      setDecodeLimit({ maxTotalBytes: 1000, onExceeded });

      expect(() => flate.decode(bomb)).toThrow(DecodeLimitError);
      expect(onExceeded).toHaveBeenCalledTimes(1);
    });

    it("fires even when the caller swallows the error", () => {
      const onExceeded = vi.fn();

      setDecodeLimit({ maxStreamBytes: 64 * 1024, onExceeded });

      try {
        flate.decode(bomb);
      } catch {
        // callers such as font and ToUnicode parsing continue with empty data
      }

      expect(onExceeded).toHaveBeenCalledTimes(1);
    });

    it("does not fire when nothing is exceeded", () => {
      const onExceeded = vi.fn();

      setDecodeLimit({ maxStreamBytes: 2 * 1024 * 1024, onExceeded });

      flate.decode(bomb);

      expect(onExceeded).not.toHaveBeenCalled();
    });
  });

  describe("without a limit", () => {
    it("decodes everything", () => {
      expect(flate.decode(bomb).length).toBe(1024 * 1024);
      expect(runLength.decode(runLengthData).length).toBe(12_800);
      expect(lzw.decode(lzwData).length).toBe(2000);
      expect(ascii85.decode(new TextEncoder().encode("z".repeat(1000))).length).toBe(4000);

      const params = PdfDict.of({ K: PdfNumber.of(-1), Columns: PdfNumber.of(8) });

      expect(ccitt.decode(new Uint8Array([0, 0]), params)).toBeInstanceOf(Uint8Array);
    });

    it("keeps partial output of a corrupt stream", () => {
      const original = new TextEncoder().encode("partial output ".repeat(2000));
      const compressed = pako.deflate(original);
      const corrupt = compressed.slice(0, compressed.length - 40);

      const result = flate.decode(corrupt);

      expect(result.length).toBeGreaterThan(0);
      expect(result).toEqual(original.slice(0, result.length));
    });
  });
});

/**
 * Minimal LZW encoder (9-bit codes only) for a run of identical bytes, so the
 * tests do not need a fixture. Emits a clear code, literal codes, and EOD.
 */
function encodeLzw(input: Uint8Array): Uint8Array {
  const codes: number[] = [256];

  // Literal codes only: the dictionary grows on the decoder side, and
  // clearing every 200 codes keeps the code width at 9 bits.
  for (let i = 0; i < input.length; i++) {
    if (i > 0 && i % 200 === 0) {
      codes.push(256);
    }

    codes.push(input[i]);
  }

  codes.push(257);

  const out: number[] = [];
  let acc = 0;
  let bits = 0;

  for (const code of codes) {
    acc = (acc << 9) | code;
    bits += 9;

    while (bits >= 8) {
      out.push((acc >> (bits - 8)) & 0xff);
      bits -= 8;
    }

    acc &= (1 << bits) - 1;
  }

  if (bits > 0) {
    out.push((acc << (8 - bits)) & 0xff);
  }

  return new Uint8Array(out);
}
