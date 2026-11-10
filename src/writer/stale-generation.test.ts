import { PDF } from "#src/api/pdf";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfRef } from "#src/objects/pdf-ref";
import { describe, expect, it } from "vitest";

/**
 * Stale generation refs (ISO 32000-1 §7.3.10, §7.5.4, §7.5.7).
 *
 * A ref "N G R" whose generation matches neither the xref entry nor the object
 * header does not refer to object N. It must resolve to null; it must not
 * register a second copy of the live body under (N, G), and a full save must
 * never write two bodies with the same output object number.
 */

interface RawObject {
  num: number;
  gen: number;
  body: string;
}

function header(): string {
  return "%PDF-1.7\n%\xe2\xe3\xcf\xd3\n";
}

function indirect(o: RawObject): string {
  return `${o.num} ${o.gen} obj\n${o.body}\nendobj\n`;
}

/** Classic xref table. `xrefGen` overrides the generation written in the xref. */
function buildClassic(
  objects: RawObject[],
  options: { xrefGen?: Record<number, number>; free?: number[] } = {},
): Uint8Array {
  let body = header();
  const offsets = new Map<number, number>();

  for (const o of objects) {
    offsets.set(o.num, body.length);
    body += indirect(o);
  }

  const size = Math.max(...objects.map(o => o.num), ...(options.free ?? [0])) + 1;
  let xref = `xref\n0 ${size}\n0000000000 65535 f \n`;

  for (let n = 1; n < size; n++) {
    const off = offsets.get(n);
    const obj = objects.find(o => o.num === n);

    if (off === undefined || obj === undefined) {
      xref += "0000000000 00001 f \n";
      continue;
    }

    const gen = options.xrefGen?.[n] ?? obj.gen;
    xref += `${String(off).padStart(10, "0")} ${String(gen).padStart(5, "0")} n \n`;
  }

  const trailer = `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${body.length}\n%%EOF\n`;

  return Uint8Array.from(Buffer.from(body + xref + trailer, "latin1"));
}

/**
 * Cross-reference stream file. Objects listed in `compressed` are stored in a
 * single object stream (generation 0, per §7.5.7); the rest are top-level.
 */
function buildXRefStream(objects: RawObject[], compressed: number[] = []): Uint8Array {
  let body = header();
  const rows = new Map<number, [number, number, number]>();
  const top = objects.filter(o => !compressed.includes(o.num));
  const inStream = objects.filter(o => compressed.includes(o.num));

  for (const o of top) {
    rows.set(o.num, [1, body.length, o.gen]);
    body += indirect(o);
  }

  const maxNum = Math.max(...objects.map(o => o.num));
  let next = maxNum + 1;

  if (inStream.length > 0) {
    const objStmNum = next++;
    let pairs = "";
    let data = "";

    inStream.forEach((o, index) => {
      pairs += `${o.num} ${data.length} `;
      data += `${o.body}\n`;
      rows.set(o.num, [2, objStmNum, index]);
    });

    const content = pairs + data;
    rows.set(objStmNum, [1, body.length, 0]);
    body += `${objStmNum} 0 obj\n<< /Type /ObjStm /N ${inStream.length} /First ${pairs.length} /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`;
  }

  const xrefNum = next++;
  const size = next;
  const xrefOffset = body.length;
  rows.set(xrefNum, [1, xrefOffset, 0]);

  const bytes: number[] = [];

  for (let n = 0; n < size; n++) {
    const [type, f2, f3] = rows.get(n) ?? (n === 0 ? [0, 0, 65535] : [0, 0, 1]);
    bytes.push(
      type,
      (f2 >>> 24) & 0xff,
      (f2 >>> 16) & 0xff,
      (f2 >>> 8) & 0xff,
      f2 & 0xff,
      (f3 >>> 8) & 0xff,
      f3 & 0xff,
    );
  }

  const data = String.fromCharCode(...bytes);
  body += `${xrefNum} 0 obj\n<< /Type /XRef /Size ${size} /W [1 4 2] /Root 1 0 R /Length ${data.length} >>\nstream\n${data}\nendstream\nendobj\n`;
  body += `startxref\n${xrefOffset}\n%%EOF\n`;

  return Uint8Array.from(Buffer.from(body, "latin1"));
}

const XOBJECT_BODY =
  "<< /Type /XObject /Subtype /Form /BBox [0 0 100 100] /Length 15 >>\nstream\n0 0 50 50 re f\nendstream";

/** Catalog + page tree; object 4 is the page's form XObject at `liveGen`. */
function fixture(catalogExtra: string, liveGen: number, extra: RawObject[] = []): RawObject[] {
  return [
    { num: 1, gen: 0, body: `<< /Type /Catalog /Pages 2 0 R ${catalogExtra} >>` },
    { num: 2, gen: 0, body: "<< /Type /Pages /Kids [3 0 R] /Count 1 >>" },
    {
      num: 3,
      gen: 0,
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << /XObject << /X 4 ${liveGen} R >> >> /Contents 5 0 R >>`,
    },
    { num: 4, gen: liveGen, body: XOBJECT_BODY },
    { num: 5, gen: 0, body: "<< /Length 5 >>\nstream\n/X Do\nendstream" },
    ...extra,
  ];
}

function objectHeaders(bytes: Uint8Array): string[] {
  const text = Buffer.from(bytes).toString("latin1");

  return [...text.matchAll(/(?:^|[\r\n])(\d+) \d+ obj\b/g)].map(m => m[1]);
}

function duplicates(values: string[]): string[] {
  return [...new Set(values.filter((v, i) => values.indexOf(v) !== i))];
}

function liveXObject(pdf: PDF): PdfDict {
  const resources = pdf.getPage(0)!.dict.get("Resources") as PdfDict;
  const xobjects = resources.get("XObject") as PdfDict;
  const resolved = pdf.context.resolve(xobjects.get("X") as PdfRef);

  expect(resolved).toBeInstanceOf(PdfDict);

  return resolved as PdfDict;
}

/** Edit the XObject through the live path, save, reload, and check the edit survived. */
async function editAndRoundTrip(raw: Uint8Array, useXRefStream: boolean): Promise<Uint8Array> {
  const pdf = await PDF.load(raw);

  liveXObject(pdf).set("Edited", PdfName.of("Yes"));

  const saved = await pdf.save({ useXRefStream });

  expect(duplicates(objectHeaders(saved))).toEqual([]);

  const reloaded = await PDF.load(saved);

  expect(liveXObject(reloaded).getName("Edited")?.value).toBe("Yes");

  return saved;
}

describe("stale generation references", () => {
  for (const useXRefStream of [false, true]) {
    describe(`useXRefStream: ${useXRefStream}`, () => {
      it("resolves a stale ref in /Dests to null and keeps the live edit", async () => {
        const saved = await editAndRoundTrip(
          buildClassic(fixture("/Dests << /stale [4 0 R] >>", 1)),
          useXRefStream,
        );

        expect(Buffer.from(saved).toString("latin1")).toMatch(/\/stale\s*\[\s*null\s*\]/);
      });

      it("handles a stale ref in an xref-stream file", async () => {
        await editAndRoundTrip(
          buildXRefStream(fixture("/Dests << /stale [4 0 R] >>", 1)),
          useXRefStream,
        );
      });

      it("treats a non-zero generation ref to an object-stream object as stale", async () => {
        // Object 4 is compressed (generation 0); /Dests holds "4 1 R".
        const objects = fixture("/Dests << /stale [4 1 R] >>", 0).map(o =>
          o.num === 4
            ? { ...o, body: "<< /Type /XObject /Subtype /Form /BBox [0 0 100 100] /Marker 4 >>" }
            : o,
        );
        const raw = buildXRefStream(objects, [4]);
        const pdf = await PDF.load(raw);

        liveXObject(pdf).set("Edited", PdfName.of("Yes"));

        const saved = await pdf.save({ useXRefStream });

        expect(duplicates(objectHeaders(saved))).toEqual([]);
        expect(liveXObject(await PDF.load(saved)).getName("Edited")?.value).toBe("Yes");
      });
    });
  }

  it("resolves a stale ref in /Outlines", async () => {
    const extra = [{ num: 6, gen: 0, body: "<< /Type /Outlines /Dest [4 0 R /Fit] >>" }];

    await editAndRoundTrip(buildClassic(fixture("/Outlines 6 0 R", 1, extra)), false);
  });

  it("resolves a stale ref in /OpenAction", async () => {
    await editAndRoundTrip(buildClassic(fixture("/OpenAction [4 0 R /Fit]", 1)), false);
  });

  it("resolves a stale ref in /AcroForm", async () => {
    await editAndRoundTrip(
      buildClassic(fixture("/AcroForm << /Fields [] /DR << /XObject << /S 4 0 R >> >> >>", 1)),
      false,
    );
  });

  it("resolves a stale ref when the live object is at generation 2", async () => {
    await editAndRoundTrip(buildClassic(fixture("/Dests << /a [4 0 R] /b [4 1 R] >>", 2)), false);
  });

  it("resolves a stale higher-generation ref to a live generation-0 object", async () => {
    // Reverse direction: live at generation 0, stale ref "4 1 R".
    await editAndRoundTrip(buildClassic(fixture("/Dests << /stale [4 1 R] >>", 0)), false);
  });

  it("keeps a generation-1 object that has no stale refs", async () => {
    const pdf = await PDF.load(buildClassic(fixture("", 1)));

    expect(pdf.context.resolve(PdfRef.of(4, 1))).toBeInstanceOf(PdfDict);

    await editAndRoundTrip(buildClassic(fixture("", 1)), false);
  });

  it("still resolves a free xref entry to null", async () => {
    const raw = buildClassic(fixture("/Dests << /gone [7 0 R] >>", 0), { free: [7] });

    const pdf = await PDF.load(raw);

    expect(pdf.context.resolve(PdfRef.of(7, 0))).toBeNull();

    await editAndRoundTrip(raw, false);
  });

  it("keeps the lenient path when only the xref generation is wrong", async () => {
    // Header and ref agree on generation 1; the xref entry says 0.
    const raw = buildClassic(fixture("", 1), { xrefGen: { 4: 0 } });
    const pdf = await PDF.load(raw);

    expect(pdf.context.resolve(PdfRef.of(4, 1))).toBeInstanceOf(PdfDict);

    await editAndRoundTrip(raw, false);
  });
});
