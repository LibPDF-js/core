/**
 * Other field types: Signature, Button, and Unknown.
 *
 * PDF Reference: Section 12.7.4.5 "Signature Fields"
 * PDF Reference: Section 12.7.4.2 "Button Fields"
 */

import { PdfDict } from "#src/objects/pdf-dict";

import { TerminalField } from "./base";

/**
 * Classification of what sits in a signature field's /V entry.
 *
 * - `unsigned`: /V is absent (in own dict and ancestors) or explicitly null.
 * - `signed`: /V resolves to a /Type /Sig (or untyped) dict with Contents + ByteRange.
 * - `timestamp`: /V resolves to a /Type /DocTimeStamp dict with Contents + ByteRange.
 * - `invalid`: /V is present but fails any structural check above.
 */
export type SignatureStatus = "unsigned" | "signed" | "timestamp" | "invalid";

/**
 * Signature field.
 */
export class SignatureField extends TerminalField {
  readonly type = "signature" as const;

  /**
   * Classify the state of /V on this field.
   *
   * Walks the parent chain (signature /V may be inherited) and validates
   * the signature dictionary shape: /Type must be missing, /Sig, or
   * /DocTimeStamp, and both /Contents and /ByteRange must be present and
   * well-formed.
   */
  getSignatureStatus(): SignatureStatus {
    const value = this.getInheritable("V");

    if (value === null || value.type === "null") {
      return "unsigned";
    }

    if (!(value instanceof PdfDict)) {
      return "invalid";
    }

    const type = value.getName("Type");
    const isTimestamp = type?.value === "DocTimeStamp";
    const isSig = type === undefined || type.value === "Sig";

    if (!isSig && !isTimestamp) {
      return "invalid";
    }

    const contents = value.getString("Contents");

    if (!contents || contents.bytes.length === 0) {
      return "invalid";
    }

    const byteRange = value.getArray("ByteRange");

    if (!byteRange || byteRange.length !== 4) {
      return "invalid";
    }

    for (let i = 0; i < 4; i++) {
      const item = byteRange.at(i);

      if (!item || item.type !== "number") {
        return "invalid";
      }
    }

    return isTimestamp ? "timestamp" : "signed";
  }

  /**
   * True iff the field carries a valid signature or document timestamp.
   *
   * Equivalent to `getSignatureStatus() === "signed" || === "timestamp"`.
   * Returns false for empty placeholder fields, null /V, non-dict /V,
   * and malformed signature dicts (missing /Contents or /ByteRange).
   */
  isSigned(): boolean {
    const status = this.getSignatureStatus();

    return status === "signed" || status === "timestamp";
  }

  /**
   * True iff /V resolves to a /Type /DocTimeStamp dict (PAdES B-LTA).
   */
  isDocumentTimestamp(): boolean {
    return this.getSignatureStatus() === "timestamp";
  }

  /**
   * Resolved /V dictionary, walking the parent chain.
   *
   * Returns the raw PdfDict regardless of whether it passes shape
   * validation (use `getSignatureStatus()` for that), so callers can
   * inspect malformed signatures for forensic / repair purposes.
   * Returns null when /V is absent or not a dictionary.
   */
  getSignatureDict(): PdfDict | null {
    const value = this.getInheritable("V");

    return value instanceof PdfDict ? value : null;
  }

  /**
   * Signature fields don't have simple values.
   */
  getValue(): null {
    return null;
  }
}

/**
 * Push button field.
 */
export class ButtonField extends TerminalField {
  readonly type = "button" as const;

  /**
   * Push buttons don't have values.
   */
  getValue(): null {
    return null;
  }
}

/**
 * Unknown field type.
 */
export class UnknownField extends TerminalField {
  readonly type = "unknown" as const;

  getValue(): unknown {
    return this.getInheritable("V") ?? null;
  }
}
