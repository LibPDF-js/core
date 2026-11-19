/**
 * Tests for indirect references in stream dictionaries.
 *
 * `/Filter` and `/DecodeParms` may be indirect objects (`N G R`) or arrays
 * containing indirect elements. Streams must resolve them through the
 * document's object registry or the raw (still compressed) bytes are used.
 *
 * @see https://github.com/LibPDF-js/core/issues/106
 */

import { PDF } from "#src/api/pdf";
import { ObjectRegistry } from "#src/document/object-registry";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfStream } from "#src/objects/pdf-stream";
import { loadFixture } from "#src/test-utils";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

const text = (value: string) => new TextEncoder().encode(value);

describe("Issue #106: indirect stream filters", () => {
  it("extracts text from a content stream with an indirect /Filter", async () => {
    const bytes = await loadFixture("issues", "indirect-filter.pdf");
    const pdf = await PDF.load(bytes);
    const page = pdf.getPage(0);

    expect(page?.extractText().text).toBe("Hello 11");
  });

  it("decodes a stream whose /Filter is a reference to a single name", () => {
    const registry = new ObjectRegistry();
    const filterRef = registry.register(PdfName.of("FlateDecode"));

    const stream = PdfStream.fromDict({ Filter: filterRef }, deflateSync(text("decoded")));
    registry.register(stream);

    expect(new TextDecoder().decode(stream.getDecodedData())).toBe("decoded");
  });

  it("decodes a stream whose /Filter array holds an indirect element", () => {
    const registry = new ObjectRegistry();
    const filterRef = registry.register(PdfName.of("FlateDecode"));

    const stream = PdfStream.fromDict(
      { Filter: new PdfArray([filterRef]) },
      deflateSync(text("decoded")),
    );
    registry.register(stream);

    expect(new TextDecoder().decode(stream.getDecodedData())).toBe("decoded");
  });

  it("applies an indirect /DecodeParms dictionary", () => {
    const registry = new ObjectRegistry();

    // TIFF predictor 2 with one byte per pixel stores each byte as the
    // difference from the previous one, so "HELLO" encodes as differences.
    const raw = text("HELLO");
    const differenced = Uint8Array.from(raw, (byte, i) => (i === 0 ? byte : byte - raw[i - 1]));

    const parms = new PdfDict();
    parms.set("Predictor", PdfNumber.of(2));
    parms.set("Colors", PdfNumber.of(1));
    parms.set("BitsPerComponent", PdfNumber.of(8));
    parms.set("Columns", PdfNumber.of(raw.length));

    const parmsRef = registry.register(parms);

    const stream = PdfStream.fromDict(
      {
        Filter: PdfName.of("FlateDecode"),
        DecodeParms: parmsRef,
      },
      deflateSync(differenced),
    );
    registry.register(stream);

    // Without the parms resolving, the differenced bytes come back raw.
    expect(new TextDecoder().decode(stream.getDecodedData())).toBe("HELLO");
  });
});
