# Signature Refactor Design

## Status

**In Progress**

### Completed

- [x] `PDF.reload(bytes)` - Added to pdf.ts
- [ ] `PDFForm.createSignatureField()` - In progress
- [ ] `PDFSignature` class
- [ ] Refactor `PDF.sign()`

## Problem

The current signature implementation is a mess:

- String building for signature dictionaries
- Custom placeholder patching logic
- Confused byte offset calculations
- Doesn't integrate cleanly with the existing save infrastructure

## Solution

Use the existing patterns we already have:

### 1. PDFForm Field Factories

`PDFForm` already handles AcroForm. Add factory methods for creating fields:

```typescript
class PDFForm {
  // Existing
  async getFields(): Promise<FormField[]>;

  // New factory methods
  createTextField(name: string, options?: TextFieldOptions): TextField;
  createCheckbox(name: string, options?: CheckboxOptions): Checkbox;
  createSignatureField(name: string, options?: SignatureFieldOptions): SignatureField;
}
```

The `SignatureField` returned is an empty unsigned field. It gets serialized normally via `save()`.

### 2. PDFSignature High-Level API

New class that handles the signing ceremony:

```typescript
class PDFSignature {
  constructor(
    private ctx: PDFContext,
    private pdf: PDF,
  ) {}

  /**
   * Sign an existing signature field.
   */
  async sign(field: SignatureField, signer: Signer, options?: SignOptions): Promise<void> {
    // 1. Create signature value dict with placeholders (PdfRaw for ByteRange/Contents)
    // 2. Set field.V to the signature dict ref
    // 3. Save incrementally
    // 4. Find placeholders, calculate ByteRange, patch
    // 5. Hash, sign, patch Contents
    // 6. Reload PDF with new bytes
  }
}
```

### 3. PDF.reload(bytes)

Add method to reload PDF state after incremental save:

```typescript
class PDF {
  /**
   * Reload the PDF from new bytes.
   * Used after signing to update internal state.
   */
  async reload(bytes: Uint8Array): Promise<void> {
    // Re-parse the PDF
    // Update originalBytes, originalXRefOffset
    // Rebuild registry, pages, etc.
  }
}
```

This lets users safely continue using the PDF instance after signing.

### 4. Simplified Sign Flow

```typescript
// User code
const pdf = await PDF.load(bytes);
const form = await pdf.getForm();

// Create or get signature field
let sigField = form.getSignatureField("Signature1");
if (!sigField) {
  sigField = form.createSignatureField("Signature1", { page: 0 });
}

// Sign it
const signature = new PDFSignature(pdf.ctx, pdf);
await signature.sign(sigField, signer, { reason: "Approved" });

// PDF is now signed and reloaded - safe to continue using
const signedBytes = await pdf.save();
```

Or simpler convenience method:

```typescript
const pdf = await PDF.load(bytes);
await pdf.sign({ signer, reason: "Approved" });
const signedBytes = await pdf.save();
```

### 5. DSS and Document Timestamps

Same pattern - they're just more incremental updates:

```typescript
class PDFSignature {
  async addDss(ltvData: LtvValidationData): Promise<void> {
    // Create DSS dict with streams for certs/OCSP/CRLs
    // Update catalog.DSS
    // Save incrementally
    // Reload
  }

  async addDocumentTimestamp(tsa: TimestampAuthority): Promise<void> {
    // Create DocTimeStamp signature field
    // Same flow as sign() but with RFC3161 token
    // Reload
  }
}
```

### 6. Key Insight: No String Building

Everything uses proper PDF objects:

- `PdfDict` for dictionaries
- `PdfStream` for binary data
- `PdfRaw` ONLY for the ByteRange/Contents placeholders that need patching
- Normal `save({ incremental: true })` for serialization

The placeholder patching happens on the raw bytes AFTER save, not during object construction.

## Files to Change

1. `src/api/pdf.ts` - Add `reload()`, simplify `sign()`
2. `src/api/pdf-form.ts` - Add field factory methods
3. `src/api/pdf-signature.ts` - NEW: High-level signing API
4. `src/document/forms/fields/signature-field.ts` - Enhance for signing
5. `src/signatures/sign.ts` - Simplify, remove string building
6. `src/signatures/placeholder.ts` - Keep, but audit byte calculations

## Files to Delete

- `src/signatures/utils.ts` - Most of it unused now
- Any remaining custom writer code

## Test Strategy

1. Unit test `PDFForm.createSignatureField()`
2. Unit test `PDFSignature.sign()` byte range calculations
3. Integration test full signing flow
4. Integration test DSS addition
5. Integration test document timestamp
6. Verify with Adobe Reader
