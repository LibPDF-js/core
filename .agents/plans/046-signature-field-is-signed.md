---
date: 2026-05-21
title: Signature Field Is Signed
---

## Problem

`SignatureField.isSigned()` is `return this.dict.has("V")`. Wrong in normal cases:

- `/V` present but `PdfNull` → reports signed.
- `/V` resolves to non-dict (number, string, array) → reports signed.
- `/V` inherited from parent field → reports unsigned (only own dict checked).
- `/V` dict missing `/Contents` or `/ByteRange` (corrupt / leftover placeholder) → reports signed.
- DocTimeStamp signatures (`/Type /DocTimeStamp` on `/V`) silently lumped with regular sigs; no way to tell them apart.

`getSignatureDict()` shares the same naivety: no shape validation, no inheritance.

No way for callers to ask "real signature vs timestamp vs empty vs malformed" short of instanceof + dict-poking.

## Goals

- Correct `isSigned()` semantics regardless of construction path.
- Distinguish signed / timestamp / unsigned / invalid.
- Honor field-value inheritance (`/V` walked via parent chain).
- Keep `getSignatureDict()` as low-level escape hatch.

## Non-goals

- Cryptographic verification (separate Tier-2 goal).
- Parsed `SignatureInfo` (signer, signing time, reason) — follow-up.
- Changes to AcroForm traversal, widget model, or sign flow.

## Desired API

Low-level on `SignatureField` (`src/document/forms/fields/other-fields.ts`):

```ts
class SignatureField extends TerminalField {
  /** /V resolves to a Sig or DocTimeStamp dict with Contents + ByteRange. */
  isSigned(): boolean;

  /** Classification of what sits in /V. */
  getSignatureStatus(): "unsigned" | "signed" | "timestamp" | "invalid";

  /** True iff /V resolves to /Type /DocTimeStamp. */
  isDocumentTimestamp(): boolean;

  /** Raw COS dict for /V (resolved + inheritable). null if absent. */
  getSignatureDict(): PdfDict | null;
}
```

Status rules:

- `unsigned`: no `/V` in own dict or any ancestor, or `/V` is `PdfNull`.
- `signed`: `/V` → `PdfDict`, `/Type` missing or `/Sig`, `/Contents` is non-empty `PdfString`, `/ByteRange` is `PdfArray` of 4 numbers.
- `timestamp`: same shape, `/Type /DocTimeStamp`.
- `invalid`: `/V` present, anything above fails.

`isSigned()` ⇔ status ∈ {signed, timestamp}.

High-level on `PDFForm` (`src/api/pdf-form.ts`):

```ts
form.getSignedFields(): SignatureField[];   // filter where isSigned()
```

Existing `getSignatureFields()` unchanged.

## Architecture

- Single change site for low-level: `other-fields.ts`. Use `this.getInheritable("V")` (already on `FormField`) instead of `this.dict.get`; resolve refs via `this.registry.resolve`.
- Shape checks inline in `getSignatureStatus`; other methods delegate.
- Internal callers in `src/api/pdf-signature.ts` (`findOrCreateSignatureField`, `checkMdpViolation`) keep using `isSigned()`; behavior strictly tighter — no false positives on null/invalid `/V`, no false negatives in real sign flow (sign() always patches a Contents-bearing dict before reload).
- `getSignedFields()` is a one-liner filter alongside `getSignatureFields()`.

## Test plan

New: `src/document/forms/fields/other-fields.test.ts`. Build in-memory `ObjectRegistry` + `AcroFormLike` per existing field-test patterns.

Cases:

- No `/V` → unsigned.
- `/V = PdfNull` → unsigned.
- `/V` inherited from parent /Sig dict with Contents+ByteRange → signed.
- `/V` → /Sig dict with Contents+ByteRange → signed, not timestamp.
- `/V` → no `/Type`, Contents+ByteRange → signed (default).
- `/V` → /DocTimeStamp dict → timestamp; `isSigned` true; `isDocumentTimestamp` true.
- `/V` → /Sig dict, no /Contents → invalid.
- `/V` → /Sig dict, Contents present, no /ByteRange → invalid.
- `/V` → non-dict (number / string / array) → invalid.
- `getSignatureDict()` returns the resolved dict for signed, timestamp, invalid; null for unsigned.

Extend `src/api/pdf-form.test.ts`: `getSignedFields` partitions signed vs empty signature fields in a multi-sig fixture.

Re-run `src/api/pdf-form.test.ts`, `src/signatures/**`, `examples/07-signatures/*` smoke; no regressions.

## Risks

- Tightening could flip a downstream branch that relied on "any /V counts." Audited: only callers are `pdf-signature.ts` (intent matches new semantics) and example scripts (display-only).
- `getInheritable("V")` walks parent chain on each call; bounded constant, cheap.
- New `"invalid"` status is additive; inert until callers opt in.

## Unresolved questions

1. Should `"invalid"` count as `isSigned()` true (preserves today's permissive behavior) or false (proposed)? Proposed false — invalid ≠ signed.
2. `getSignedFields()` — include DocTimeStamp fields (proposed yes) or split into `getTimestampFields()`?
3. Keep `getSignatureDict()` raw, or also add a typed `SignatureInfo` view now vs later? Proposed: raw now, typed accessor in follow-up.
