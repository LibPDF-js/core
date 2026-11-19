/**
 * XRef offsets that point at whitespace before the xref keyword or stream
 * object must still parse — several producers emit a startxref that lands on
 * padding. Previously this only survived via the slow brute-force fallback
 * (or failed outright with `lenient: false`).
 *
 * @see https://github.com/LibPDF-js/core/issues/111
 */

import { PDF } from "#src/api/pdf";
import { isWhitespace } from "#src/helpers/chars";
import { describe, expect, it } from "vitest";

const latin1 = (bytes: Uint8Array) => {
  let result = "";

  for (const byte of bytes) {
    result += String.fromCharCode(byte);
  }

  return result;
};

const unlatin1 = (text: string) => Uint8Array.from(text, char => char.charCodeAt(0) & 0xff);

/**
 * Rewrite the startxref value to `offset - 1`, landing it on the byte
 * immediately before the xref data.
 */
const shiftStartXRefBack = (bytes: Uint8Array): Uint8Array => {
  const text = latin1(bytes);
  const match = /startxref\s+(\d+)\s+%%EOF\s*$/.exec(text);

  if (!match || match.index === undefined) {
    throw new Error("startxref not found");
  }

  const rewritten =
    text.slice(0, match.index) + match[0].replace(match[1], String(Number(match[1]) - 1));

  // The rewritten offset must land on whitespace padding, otherwise the test
  // would exercise a different failure mode than the reported issue.
  const targetOffset = Number(match[1]) - 1;

  if (bytes[targetOffset] === undefined || !isWhitespace(bytes[targetOffset])) {
    throw new Error(`expected whitespace at shifted offset ${targetOffset}`);
  }

  return unlatin1(rewritten);
};

describe("Issue #111: whitespace at the xref offset", () => {
  it("loads a document whose startxref points at whitespace, in strict mode", async () => {
    const pdf = PDF.create();
    pdf.addPage({ size: "a4" });

    const bytes = await pdf.save({ useXRefStream: true });
    const modified = shiftStartXRefBack(bytes);

    const loaded = await PDF.load(modified, { lenient: false });

    expect(loaded.getPageCount()).toBe(1);
    expect(loaded.recoveredViaBruteForce).toBe(false);
  });
});
