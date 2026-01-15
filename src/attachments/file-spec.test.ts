import { formatPdfDate, parsePdfDate } from "#src/helpers/format.ts";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import type { PdfObject } from "#src/objects/pdf-object";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfStream } from "#src/objects/pdf-stream";
import { PdfString } from "#src/objects/pdf-string";
import { describe, expect, it } from "vitest";

import {
  createEmbeddedFileStream,
  createFileSpec,
  getEmbeddedFileStream,
  getFilename,
  getMimeType,
  parseFileSpec,
} from "./file-spec";

describe("getMimeType", () => {
  it("detects common MIME types", () => {
    expect(getMimeType("document.pdf")).toBe("application/pdf");
    expect(getMimeType("image.png")).toBe("image/png");
    expect(getMimeType("photo.jpg")).toBe("image/jpeg");
    expect(getMimeType("photo.JPEG")).toBe("image/jpeg");
    expect(getMimeType("data.json")).toBe("application/json");
    expect(getMimeType("page.html")).toBe("text/html");
    expect(getMimeType("archive.zip")).toBe("application/zip");
  });

  it("returns undefined for unknown extensions", () => {
    expect(getMimeType("file.xyz")).toBeUndefined();
    expect(getMimeType("noextension")).toBeUndefined();
  });

  it("handles case insensitivity", () => {
    expect(getMimeType("FILE.PDF")).toBe("application/pdf");
    expect(getMimeType("FILE.Pdf")).toBe("application/pdf");
  });
});

describe("getFilename", () => {
  it("prefers /UF over /F", () => {
    const fileSpec = PdfDict.of({
      UF: PdfString.fromString("unicode-name.pdf"),
      F: PdfString.fromString("ascii-name.pdf"),
    });

    expect(getFilename(fileSpec)).toBe("unicode-name.pdf");
  });

  it("falls back to /F when /UF missing", () => {
    const fileSpec = PdfDict.of({
      F: PdfString.fromString("ascii-name.pdf"),
    });

    expect(getFilename(fileSpec)).toBe("ascii-name.pdf");
  });

  it("falls back to platform-specific keys", () => {
    const unixSpec = PdfDict.of({
      Unix: PdfString.fromString("unix-file.txt"),
    });
    expect(getFilename(unixSpec)).toBe("unix-file.txt");

    const macSpec = PdfDict.of({
      Mac: PdfString.fromString("mac-file.txt"),
    });
    expect(getFilename(macSpec)).toBe("mac-file.txt");

    const dosSpec = PdfDict.of({
      DOS: PdfString.fromString("dos-file.txt"),
    });
    expect(getFilename(dosSpec)).toBe("dos-file.txt");
  });

  it("strips path from filename", () => {
    const fileSpec = PdfDict.of({
      UF: PdfString.fromString("/path/to/document.pdf"),
    });

    expect(getFilename(fileSpec)).toBe("document.pdf");
  });

  it("returns 'unnamed' when no filename found", () => {
    const fileSpec = new PdfDict();
    expect(getFilename(fileSpec)).toBe("unnamed");
  });
});

describe("parsePdfDate", () => {
  it("parses full date with timezone", () => {
    const date = parsePdfDate("D:20240115123045Z");
    expect(date?.toISOString()).toBe("2024-01-15T12:30:45.000Z");
  });

  it("parses date without D: prefix", () => {
    const date = parsePdfDate("20240115123045Z");
    expect(date?.toISOString()).toBe("2024-01-15T12:30:45.000Z");
  });

  it("parses date with positive timezone offset", () => {
    const date = parsePdfDate("D:20240115123045+05'30'");
    // +05:30 means subtract 5:30 from local to get UTC
    expect(date?.getUTCHours()).toBe(7);
    expect(date?.getUTCMinutes()).toBe(0);
  });

  it("parses date with negative timezone offset", () => {
    const date = parsePdfDate("D:20240115123045-08'00'");
    // -08:00 means add 8:00 to local to get UTC
    expect(date?.getUTCHours()).toBe(20);
    expect(date?.getUTCMinutes()).toBe(30);
  });

  it("parses minimal date (year only)", () => {
    const date = parsePdfDate("D:2024");
    expect(date?.getUTCFullYear()).toBe(2024);
    expect(date?.getUTCMonth()).toBe(0); // January
    expect(date?.getUTCDate()).toBe(1);
  });

  it("returns undefined for invalid dates", () => {
    expect(parsePdfDate("invalid")).toBeUndefined();
    expect(parsePdfDate("D:")).toBeUndefined();
    expect(parsePdfDate("")).toBeUndefined();
  });
});

describe("formatPdfDate", () => {
  it("formats date as PDF date string", () => {
    const date = new Date("2024-01-15T12:30:45.000Z");
    expect(formatPdfDate(date)).toBe("D:20240115123045Z");
  });

  it("pads components with zeros", () => {
    const date = new Date("2024-01-05T08:05:03.000Z");
    expect(formatPdfDate(date)).toBe("D:20240105080503Z");
  });

  it("round-trips correctly", () => {
    const original = new Date("2024-06-15T14:25:35.000Z");
    const formatted = formatPdfDate(original);
    const parsed = parsePdfDate(formatted);
    expect(parsed?.toISOString()).toBe(original.toISOString());
  });
});

describe("getEmbeddedFileStream", () => {
  it("returns stream from direct /EF dict", async () => {
    const streamData = new Uint8Array([1, 2, 3]);
    const stream = new PdfStream([], streamData);
    const streamRef = PdfRef.of(10, 0);

    const ef = PdfDict.of({ F: streamRef });
    const fileSpec = PdfDict.of({ EF: ef });

    const resolver = async (ref: PdfRef) => {
      if (ref.objectNumber === 10) {
        return stream;
      }

      return null;
    };

    const result = await getEmbeddedFileStream(fileSpec, resolver);
    expect(result).toBe(stream);
  });

  it("returns null when /EF is missing", async () => {
    const fileSpec = PdfDict.of({
      F: PdfString.fromString("external.pdf"),
    });

    const result = await getEmbeddedFileStream(fileSpec, async () => null);
    expect(result).toBeNull();
  });

  it("resolves /EF reference", async () => {
    const streamData = new Uint8Array([1, 2, 3]);
    const stream = new PdfStream([], streamData);
    const streamRef = PdfRef.of(10, 0);
    const efRef = PdfRef.of(5, 0);

    const ef = PdfDict.of({ F: streamRef });
    const fileSpec = PdfDict.of({ EF: efRef });

    const objects = new Map<number, PdfObject>([
      [5, ef],
      [10, stream],
    ]);

    const resolver = async (ref: PdfRef) => objects.get(ref.objectNumber) ?? null;

    const result = await getEmbeddedFileStream(fileSpec, resolver);
    expect(result).toBe(stream);
  });
});

describe("parseFileSpec", () => {
  it("parses complete file spec", async () => {
    const streamData = new Uint8Array([1, 2, 3, 4, 5]);
    const params = PdfDict.of({
      Size: PdfNumber.of(5),
      CreationDate: PdfString.fromString("D:20240115120000Z"),
      ModDate: PdfString.fromString("D:20240116140000Z"),
    });

    const stream = new PdfStream(
      [
        ["Type", PdfName.of("EmbeddedFile")],
        ["Subtype", PdfName.of("application#2Fpdf")],
        ["Params", params],
      ],
      streamData,
    );
    const streamRef = PdfRef.of(10, 0);

    const ef = PdfDict.of({ F: streamRef });
    const fileSpec = PdfDict.of({
      Type: PdfName.of("Filespec"),
      UF: PdfString.fromString("document.pdf"),
      F: PdfString.fromString("document.pdf"),
      Desc: PdfString.fromString("A test document"),
      EF: ef,
    });

    const resolver = async (ref: PdfRef) => {
      if (ref.objectNumber === 10) {
        return stream;
      }

      return null;
    };

    const info = await parseFileSpec(fileSpec, "doc-key", resolver);

    expect(info).not.toBeNull();
    expect(info?.name).toBe("doc-key");
    expect(info?.filename).toBe("document.pdf");
    expect(info?.description).toBe("A test document");
    expect(info?.mimeType).toBe("application/pdf");
    expect(info?.size).toBe(5);
    expect(info?.createdAt?.toISOString()).toBe("2024-01-15T12:00:00.000Z");
    expect(info?.modifiedAt?.toISOString()).toBe("2024-01-16T14:00:00.000Z");
  });

  it("returns null for external file references", async () => {
    const fileSpec = PdfDict.of({
      F: PdfString.fromString("external.pdf"),
      // No /EF - this is an external reference
    });

    const info = await parseFileSpec(fileSpec, "ext", async () => null);
    expect(info).toBeNull();
  });

  it("handles minimal file spec", async () => {
    const stream = new PdfStream([], new Uint8Array([1, 2, 3]));
    const streamRef = PdfRef.of(10, 0);
    const ef = PdfDict.of({ F: streamRef });
    const fileSpec = PdfDict.of({ EF: ef });

    const resolver = async (ref: PdfRef) => {
      if (ref.objectNumber === 10) {
        return stream;
      }

      return null;
    };

    const info = await parseFileSpec(fileSpec, "minimal", resolver);

    expect(info).not.toBeNull();
    expect(info?.name).toBe("minimal");
    expect(info?.filename).toBe("unnamed");
    expect(info?.description).toBeUndefined();
    expect(info?.mimeType).toBeUndefined();
  });
});

describe("createEmbeddedFileStream", () => {
  it("creates stream with correct structure", () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const stream = createEmbeddedFileStream(data, "test.pdf", {
      createdAt: new Date("2024-01-15T12:00:00Z"),
      modifiedAt: new Date("2024-01-16T14:00:00Z"),
    });

    expect(stream.data).toBe(data);
    expect(stream.getName("Type")?.value).toBe("EmbeddedFile");
    expect(stream.getName("Subtype")?.value).toBe("application#2Fpdf");

    const params = stream.getDict("Params");
    expect(params?.getNumber("Size")?.value).toBe(5);
    expect(params?.getString("CreationDate")?.asString()).toBe("D:20240115120000Z");
    expect(params?.getString("ModDate")?.asString()).toBe("D:20240116140000Z");
  });

  it("auto-detects MIME type from filename", () => {
    const stream = createEmbeddedFileStream(new Uint8Array([1]), "image.png");
    expect(stream.getName("Subtype")?.value).toBe("image#2Fpng");
  });

  it("uses provided MIME type over auto-detected", () => {
    const stream = createEmbeddedFileStream(new Uint8Array([1]), "file.bin", {
      mimeType: "application/octet-stream",
    });
    expect(stream.getName("Subtype")?.value).toBe("application#2Foctet-stream");
  });

  it("omits Subtype for unknown file types", () => {
    const stream = createEmbeddedFileStream(new Uint8Array([1]), "file.xyz");
    expect(stream.has("Subtype")).toBe(false);
  });
});

describe("createFileSpec", () => {
  it("creates FileSpec with correct structure", () => {
    const ref = PdfRef.of(10, 0);
    const fileSpec = createFileSpec("document.pdf", ref, {
      description: "Test document",
    });

    expect(fileSpec.getName("Type")?.value).toBe("Filespec");
    expect(fileSpec.getString("F")?.asString()).toBe("document.pdf");
    expect(fileSpec.getString("UF")?.asString()).toBe("document.pdf");
    expect(fileSpec.getString("Desc")?.asString()).toBe("Test document");

    const ef = fileSpec.getDict("EF");
    expect(ef?.getRef("F")).toBe(ref);
  });

  it("omits description when not provided", () => {
    const ref = PdfRef.of(10, 0);
    const fileSpec = createFileSpec("doc.pdf", ref);

    expect(fileSpec.has("Desc")).toBe(false);
  });
});
