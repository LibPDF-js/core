/**
 * Operator serialization utilities for content streams.
 */

import type { Operator } from "#src/content/operators";
import { ByteWriter } from "#src/io/byte-writer";

const NEWLINE = 0x0a;

/**
 * Serialize operators to bytes for content streams.
 *
 * Uses Operator.writeTo() to write directly into a shared ByteWriter,
 * avoiding per-operator intermediate allocations.
 */
export function serializeOperators(ops: Operator[]): Uint8Array {
  if (ops.length === 0) {
    return new Uint8Array(0);
  }

  const writer = new ByteWriter(undefined, { initialSize: ops.length * 24 });

  for (let i = 0; i < ops.length; i++) {
    if (i > 0) {
      writer.writeByte(NEWLINE);
    }

    ops[i].writeTo(writer);
  }

  return writer.toBytes();
}
