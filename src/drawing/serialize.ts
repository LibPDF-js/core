/**
 * Operator serialization utilities for content streams.
 */

import type { Operator } from "#src/content/operators";
import { concatBytes } from "#src/helpers/buffer";

/**
 * Serialize operators to bytes for content streams.
 *
 * Uses Operator.toBytes() directly to avoid UTF-8 round-trip corruption
 * of non-ASCII bytes in PdfString operands (e.g., WinAnsi-encoded text).
 */
export function serializeOperators(ops: Operator[]): Uint8Array {
  if (ops.length === 0) {
    return new Uint8Array(0);
  }

  const newline = new Uint8Array([0x0a]);
  const parts: Uint8Array[] = [];

  for (let i = 0; i < ops.length; i++) {
    if (i > 0) {
      parts.push(newline);
    }

    parts.push(ops[i].toBytes());
  }

  return concatBytes(parts);
}
