/**
 * PDFSignature - High-level API for signing PDF documents.
 *
 * Handles the complete signing ceremony including:
 * - Finding or creating signature fields
 * - Creating signature dictionaries with placeholders
 * - Building CMS signatures (PKCS7 or CAdES)
 * - Patching ByteRange and Contents after save
 * - Adding DSS for long-term validation (B-LT)
 * - Adding document timestamps for archival (B-LTA)
 */

import { SignatureField } from "#src/document/forms/fields";
import { hexToBytes } from "#src/helpers/buffer.ts";
import { formatPdfDate } from "#src/helpers/format.ts";
import { generateUniqueName } from "#src/helpers/strings";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfString } from "#src/objects/pdf-string";
import { CAdESDetachedBuilder } from "#src/signatures/formats/cades-detached";
import { PKCS7DetachedBuilder } from "#src/signatures/formats/pkcs7-detached";
import type { CMSFormatBuilder } from "#src/signatures/formats/types";
import { DSSBuilder, type LtvData, LtvDataGatherer } from "#src/signatures/ltv";
import {
  calculateByteRange,
  createByteRangePlaceholderObject,
  createContentsPlaceholderObject,
  DEFAULT_PLACEHOLDER_SIZE,
  extractSignedBytes,
  findPlaceholders,
  patchByteRange,
  patchContents,
} from "#src/signatures/placeholder";
import { DefaultRevocationProvider } from "#src/signatures/revocation";
import {
  type ArchivalDataOptions,
  type ArchivalDataResult,
  type DigestAlgorithm,
  type PAdESLevel,
  type RevocationProvider,
  SignatureError,
  type SignOptions,
  type SignResult,
  type SignWarning,
  type SubFilter,
  type TimestampAuthority,
  type TimestampOptions,
  type TimestampResult,
  type ValidationDataOptions,
  type ValidationDataResult,
} from "#src/signatures/types";
import { escapePdfString, hashData } from "#src/signatures/utils";

import type { PDF } from "./pdf";

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions (moved from sign.ts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolved and validated sign options.
 */
interface ResolvedSignOptions {
  digestAlgorithm: DigestAlgorithm;
  subFilter: SubFilter;
  estimatedSize: number;
  signingTime: Date;
  signer: SignOptions["signer"];
  reason?: string;
  location?: string;
  contactInfo?: string;
  fieldName?: string;
  timestampAuthority?: SignOptions["timestampAuthority"];
  longTermValidation: boolean;
  revocationProvider?: RevocationProvider;
  archivalTimestamp: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// PDFSignature class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PDFSignature handles the signing process for a PDF document.
 *
 * This class uses the reload pattern: after each signing operation,
 * the PDF is saved incrementally and reloaded to update internal state.
 *
 * @example
 * ```typescript
 * const pdf = await PDF.load(bytes);
 * const signature = new PDFSignature(pdf);
 *
 * // Sign with full options
 * const result = await signature.sign({
 *   signer,
 *   reason: "Approved",
 *   level: "B-LT",
 *   timestampAuthority,
 * });
 *
 * // PDF is now updated, get final bytes
 * const signedBytes = await pdf.save();
 * ```
 */
export class PDFSignature {
  constructor(private pdf: PDF) {}

  /**
   * Sign the PDF document.
   *
   * Creates a digital signature using PAdES (PDF Advanced Electronic Signatures)
   * format. The signature is embedded as an incremental update, preserving any
   * existing signatures.
   *
   * After signing, the PDF instance is automatically reloaded with the signed
   * bytes, so you can continue using it or call save() to get the final bytes.
   *
   * @param options Signing options including signer, reason, location, etc.
   * @returns Sign result with warnings (bytes are in the PDF instance)
   */
  async sign(options: SignOptions): Promise<SignResult> {
    const warnings: SignWarning[] = [];

    // Resolve and validate options
    const resolved = this.resolveOptions(options);

    // Check for MDP violations
    const mdpWarning = this.checkMdpViolation();

    if (mdpWarning) {
      warnings.push(mdpWarning);
    }

    // Get first page reference (for widget annotation placement)
    const firstPageRef = this.pdf.context.pages.getPage(0);

    if (!firstPageRef) {
      throw new SignatureError("NO_PAGES", "Document has no pages - cannot create signature field");
    }

    // Create signature dictionary with placeholders
    const signatureDict = PdfDict.of({
      Type: PdfName.of("Sig"),
      Filter: PdfName.of("Adobe.PPKLite"),
      SubFilter: PdfName.of(resolved.subFilter),
      ByteRange: createByteRangePlaceholderObject(),
      Contents: createContentsPlaceholderObject(resolved.estimatedSize),
    });

    // Include /M (signing time) - the timestamp provides authoritative proof,
    // but /M is still useful as a fallback display time.
    signatureDict.set("M", PdfString.fromString(formatPdfDate(resolved.signingTime)));

    if (resolved.reason) {
      signatureDict.set("Reason", PdfString.fromString(escapePdfString(resolved.reason)));
    }

    if (resolved.location) {
      signatureDict.set("Location", PdfString.fromString(escapePdfString(resolved.location)));
    }

    if (resolved.contactInfo) {
      signatureDict.set("ContactInfo", PdfString.fromString(escapePdfString(resolved.contactInfo)));
    }

    const signatureRef = this.pdf.context.registry.register(signatureDict);

    // Find or create signature field
    this.prepareSignatureField({
      fieldName: resolved.fieldName,
      pageRef: firstPageRef,
      valueRef: signatureRef,
      namePrefix: "Signature_",
      reuseFirstEmpty: true,
    });

    // Save incrementally to get bytes with placeholders
    const pdfBytes = await this.pdf.save({ incremental: true });

    // Find placeholders and calculate ByteRange
    const placeholders = findPlaceholders(pdfBytes);
    const byteRange = calculateByteRange(pdfBytes, placeholders);

    // Patch ByteRange
    patchByteRange(pdfBytes, placeholders, byteRange);

    // Extract bytes to sign and hash them
    const signedBytes = extractSignedBytes(pdfBytes, byteRange);
    const documentHash = await hashData(signedBytes, resolved.digestAlgorithm);

    // Build CMS signature
    const formatBuilder = this.getFormatBuilder(resolved.subFilter);

    // Create the CMS structure (signs the document)
    // Note: PDFBox includes signingTime even when using a timestamp.
    // The timestamp provides the authoritative time, but signingTime
    // may be needed for Adobe to recognize the timestamp token.
    const signedData = await formatBuilder.create({
      signer: resolved.signer,
      documentHash,
      digestAlgorithm: resolved.digestAlgorithm,
      signingTime: resolved.signingTime,
    });

    // If timestamp authority is configured, add timestamp token
    if (resolved.timestampAuthority) {
      // Hash the signature value for timestamping
      const signatureValue = signedData.getSignatureValue();
      const signatureHash = await hashData(signatureValue, resolved.digestAlgorithm);

      // Request timestamp from TSA
      const timestampToken = await resolved.timestampAuthority.timestamp(
        signatureHash,
        resolved.digestAlgorithm,
      );

      // Add timestamp token as unsigned attribute
      signedData.addTimestampToken(timestampToken);
    }

    // Serialize to DER
    const signatureDer = signedData.toDER();

    // Patch Contents with signature
    const { paddedHex } = patchContents(pdfBytes, placeholders, signatureDer);

    // Reload PDF with signed bytes
    await this.pdf.reload(pdfBytes);

    // Gather LTV data if requested
    let ltvData: LtvData | undefined;

    if (resolved.longTermValidation) {
      // Create padded signature bytes (for correct VRI hash computation).
      // The VRI key is the SHA-1 hash of the FULL /Contents value as stored
      // in the PDF, including zero padding - not just the raw CMS bytes.
      // See ETSI EN 319 142-2 and PDF 2.0 spec section 12.8.4.3.
      const gatherer = new LtvDataGatherer({
        revocationProvider: resolved.revocationProvider ?? new DefaultRevocationProvider(),
      });
      ltvData = await gatherer.gather(hexToBytes(paddedHex));

      // Convert gatherer warnings to sign warnings
      for (const warning of ltvData.warnings) {
        warnings.push({ code: warning.code, message: warning.message });
      }
    }

    // If LTV data is present, add DSS as second incremental update
    if (ltvData) {
      await this.addDss(ltvData);

      // For B-LTA, add document timestamp after DSS, then add DSS for the timestamp
      if (resolved.archivalTimestamp && resolved.timestampAuthority) {
        const paddedTimestampBytes = await this.placeDocumentTimestamp({
          timestampAuthority: resolved.timestampAuthority,
          digestAlgorithm: resolved.digestAlgorithm,
          estimatedSize: DEFAULT_PLACEHOLDER_SIZE,
        });

        // Add DSS for the document timestamp's certificate chain.
        // This is more proactive than EU DSS (which waits for future LTA extensions),
        // but ensures the timestamp is fully LTV-enabled from the start.
        const docTsLtvData = await this.gatherTimestampLtvData(
          paddedTimestampBytes,
          resolved.revocationProvider,
          warnings,
        );

        if (docTsLtvData) {
          await this.addDss(docTsLtvData);
        }
      }
    }

    // Get final bytes from the reloaded PDF
    const finalBytes = await this.pdf.save({ incremental: true });

    return {
      bytes: finalBytes,
      warnings,
    };
  }

  /**
   * Find or create the /FT /Sig field that will hold a signature or document
   * timestamp value, then convert it to the merged field+widget model
   * (the invisible widget pattern used for all signatures in this library).
   *
   * Lookup behavior:
   * - `fieldName` provided + matches an unsigned signature field -> reuse
   * - `fieldName` provided + matches a signed signature field    -> throw
   * - `fieldName` provided + matches a non-signature field       -> throw
   * - `fieldName` provided + no match                            -> create
   * - `fieldName` omitted + `reuseFirstEmpty`                    -> reuse first
   *   empty signature field, or create with `<namePrefix>N`
   * - `fieldName` omitted otherwise                              -> create with
   *   `<namePrefix>N`
   */
  private prepareSignatureField(options: {
    fieldName?: string;
    pageRef: PdfRef;
    valueRef: PdfRef;
    namePrefix: string;
    reuseFirstEmpty: boolean;
  }): void {
    const { fieldName, pageRef, valueRef, namePrefix, reuseFirstEmpty } = options;

    const form = this.pdf.getOrCreateForm();

    // Collect existing field names so we can both look up a named field
    // and generate a unique fallback name when none is supplied.
    const existingNames = new Set<string>();

    let fieldDict: PdfDict | undefined;

    for (const field of form.getFields()) {
      existingNames.add(field.name);

      // If requested name matches an existing field
      if (fieldName && field.name === fieldName) {
        if (!(field instanceof SignatureField)) {
          throw new SignatureError(
            "FIELD_NOT_SIGNATURE",
            `Field "${fieldName}" exists but is not a signature field`,
          );
        }

        if (field.isSigned()) {
          throw new SignatureError(
            "FIELD_ALREADY_SIGNED",
            `Signature field "${fieldName}" is already signed`,
          );
        }

        fieldDict = field.getDict(); // Use existing unsigned field
        break;
      }

      // If no name requested, optionally reuse the first empty signature field
      if (!fieldName && reuseFirstEmpty && field instanceof SignatureField && !field.isSigned()) {
        fieldDict = field.getDict();
        break;
      }
    }

    if (!fieldDict) {
      // PDFForm handles registry registration, /Fields, and /SigFlags 3.
      fieldDict = form
        .createSignatureField(fieldName ?? generateUniqueName(existingNames, namePrefix))
        .getDict();
    }

    // Set signature value
    fieldDict.set("V", valueRef);

    // Convert to merged field+widget model (common for invisible signatures).
    // If the field carried widget kids (e.g. pre-allocated by an external
    // tool), detach them from their pages first so no dangling /Annots
    // references remain after we drop /Kids.
    this.removeWidgetKidsFromPages(fieldDict);
    fieldDict.delete("Kids");

    // Add widget annotation properties
    fieldDict.set("Type", PdfName.of("Annot"));
    fieldDict.set("Subtype", PdfName.of("Widget"));
    fieldDict.set("F", PdfNumber.of(132)); // Print + Locked (4 + 128)
    fieldDict.set("P", pageRef);
    fieldDict.set(
      "Rect",
      new PdfArray([PdfNumber.of(0), PdfNumber.of(0), PdfNumber.of(0), PdfNumber.of(0)]),
    );
  }

  /**
   * Remove a field's widget kids from every page's /Annots array.
   *
   * Merging a field with widget kids into a single field+widget object would
   * otherwise leave those widgets referenced from page /Annots while no
   * longer being listed in the field's /Kids - an inconsistent structure
   * that confuses viewers.
   */
  private removeWidgetKidsFromPages(fieldDict: PdfDict): void {
    const registry = this.pdf.context.registry;
    const resolve = registry.resolve.bind(registry);
    const kids = fieldDict.getArray("Kids", resolve);

    if (!kids || kids.length === 0) {
      return;
    }

    const kidKeys = new Set<string>();

    for (const kid of kids) {
      if (kid instanceof PdfRef) {
        kidKeys.add(`${kid.objectNumber} ${kid.generation}`);
      }
    }

    if (kidKeys.size === 0) {
      return;
    }

    for (const page of this.pdf.getPages()) {
      const annots = page.dict.getArray("Annots", resolve);

      if (!annots) {
        continue;
      }

      for (let i = annots.length - 1; i >= 0; i--) {
        const item = annots.at(i);

        if (item instanceof PdfRef && kidKeys.has(`${item.objectNumber} ${item.generation}`)) {
          annots.remove(i);
        }
      }
    }
  }

  /**
   * Check for MDP (certification signature) violations.
   */
  private checkMdpViolation(): SignWarning | null {
    const form = this.pdf.getForm();

    if (!form) {
      return null;
    }

    const fields = form.getFields();

    for (const field of fields) {
      if (field instanceof SignatureField && field.isSigned()) {
        const sigDict = field.getSignatureDict();

        if (sigDict) {
          const reference = sigDict.getArray("Reference");

          if (reference) {
            return {
              code: "MDP_VIOLATION",
              message: "Document has a certification signature that may restrict modifications",
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Add DSS (Document Security Store) for long-term validation.
   *
   * Embeds certificates, OCSP responses, and CRLs so signatures can be
   * validated even after certificates expire.
   *
   * After adding DSS, the PDF is reloaded with the updated bytes.
   *
   * @param ltvData The validation data to embed
   */
  async addDss(ltvData: LtvData): Promise<void> {
    const registry = this.pdf.context.registry;
    const catalogDict = this.pdf.getCatalog();

    // Load existing DSS for merging, or create new builder
    const dssBuilder = await DSSBuilder.fromCatalog(catalogDict, registry);

    // Add the LTV data (handles deduplication and VRI entries)
    await dssBuilder.addLtvData(ltvData);

    // Build and register DSS
    const dssRef = dssBuilder.build();
    catalogDict.set("DSS", dssRef);

    await this.saveAndReload();
  }

  /**
   * Save incrementally and reload the PDF instance so it reflects the saved
   * bytes. Skips the reload (a full re-parse) when nothing was written -
   * `save()` short-circuits and returns the current bytes in that case.
   */
  private async saveAndReload(): Promise<Uint8Array> {
    const hadChanges = this.pdf.hasChanges();
    const bytes = await this.pdf.save({ incremental: true });

    if (hadChanges) {
      await this.pdf.reload(bytes);
    }

    return bytes;
  }

  /**
   * Throw when the document cannot be saved incrementally.
   *
   * Timestamping and validation-data updates exist to extend documents that
   * already carry signatures. A silent fall back to a full rewrite would
   * change every byte offset and invalidate all existing signatures, so we
   * refuse up front instead.
   */
  private ensureIncrementalSave(operation: string): void {
    const blocker = this.pdf.canSaveIncrementally();

    if (blocker) {
      throw new SignatureError(
        "INCREMENTAL_SAVE_BLOCKED",
        `${operation} requires an incremental save to preserve existing signatures, ` +
          `but incremental save is not possible (${blocker}). ` +
          `Save the document with a full rewrite first, reload it, and retry.`,
      );
    }
  }

  /**
   * Add an archival document timestamp to the PDF.
   *
   * Creates a `/Type /DocTimeStamp` signature whose ByteRange covers the
   * entire current document, extending the validity of any prior signatures.
   * This is the timestamping step used at the end of a PAdES B-LTA flow
   * when signatures have been appended.
   *
   * Does **not** gather validation data for pre-existing signatures - use
   * `addValidationData()` for that, or `addArchivalData()` to do both in
   * one call.
   *
   * The PDF instance is reloaded with the updated bytes, so subsequent
   * calls (e.g. another `addTimestamp()`) operate on the timestamped state.
   *
   * If this method throws after partial progress (e.g. the TSA request
   * fails), the in-memory PDF instance may be out of sync with its bytes.
   * Discard the instance and reload from the last known-good bytes.
   *
   * @param options Timestamping options including the TSA
   * @returns The PDF bytes with the timestamp embedded, plus any warnings
   *
   * @example
   * ```typescript
   * // Append an archival timestamp to an already-signed PDF.
   * const tsa = new HttpTimestampAuthority("https://freetsa.org/tsr");
   * const { bytes } = await pdf.addTimestamp({
   *   timestampAuthority: tsa,
   *   longTermValidation: true,
   * });
   * ```
   */
  async addTimestamp(options: TimestampOptions): Promise<TimestampResult> {
    if (!options.timestampAuthority) {
      throw new SignatureError("INVALID_OPTIONS", "addTimestamp() requires a timestampAuthority");
    }

    this.ensureIncrementalSave("addTimestamp()");

    return this.addTimestampInternal(options);
  }

  /**
   * Implementation of `addTimestamp()`, with an optional shared gatherer so
   * `addArchivalData()` can reuse OCSP/CRL/AIA results fetched while
   * gathering validation data for existing signatures.
   */
  private async addTimestampInternal(
    options: TimestampOptions,
    gatherer?: LtvDataGatherer,
  ): Promise<TimestampResult> {
    const warnings: SignWarning[] = [];
    const digestAlgorithm = options.digestAlgorithm ?? "SHA-256";
    const estimatedSize = options.estimatedSize ?? DEFAULT_PLACEHOLDER_SIZE;
    const longTermValidation = options.longTermValidation ?? false;

    // Place the document timestamp (writes /DocTimeStamp dict, registers the
    // field with AcroForm, saves incrementally, requests the TSA token, and
    // patches the placeholders). Returns the padded /Contents bytes that
    // viewers use as the VRI key for the next DSS update.
    const paddedTimestampBytes = await this.placeDocumentTimestamp({
      timestampAuthority: options.timestampAuthority,
      digestAlgorithm,
      estimatedSize,
      fieldName: options.fieldName,
    });

    // Optionally embed LTV data for the timestamp's certificate chain so the
    // timestamp itself remains verifiable after the TSA certificate expires.
    if (longTermValidation) {
      const ltvData = await this.gatherTimestampLtvData(
        paddedTimestampBytes,
        options.revocationProvider,
        warnings,
        gatherer,
      );

      if (ltvData) {
        await this.addDss(ltvData);
      }
    }

    const bytes = await this.saveAndReload();

    return { bytes, warnings };
  }

  /**
   * Gather LTV (Long-Term Validation) data for every signed signature
   * field currently in the document and write it as a single DSS
   * incremental update.
   *
   * This upgrades the validation grade of every existing signature in the
   * document — turning B-T signatures into B-LT and ensuring document
   * timestamps have their TSA chain embedded for offline validation.
   * Validation data is fetched once per issuer (shared OCSP/CRL cache)
   * and merged with any existing DSS, deduplicating certs/OCSP/CRL.
   *
   * Does **not** add a timestamp - use `addTimestamp()` for that, or
   * `addArchivalData()` to do both in one call.
   *
   * Safe to call on a document with no signatures (returns
   * `signatureCount: 0`, no DSS update written).
   *
   * If this method throws after partial progress, the in-memory PDF
   * instance may be out of sync with its bytes. Discard the instance and
   * reload from the last known-good bytes.
   *
   * @example
   * ```typescript
   * // After every recipient has signed (B-T), upgrade all sigs to B-LT.
   * await pdf.addValidationData();
   * ```
   */
  async addValidationData(options: ValidationDataOptions = {}): Promise<ValidationDataResult> {
    this.ensureIncrementalSave("addValidationData()");

    // A single LtvDataGatherer so its OCSP / CRL cache is shared across
    // every signature we process.
    const gatherer = new LtvDataGatherer({
      revocationProvider: options.revocationProvider ?? new DefaultRevocationProvider(),
    });

    return this.addValidationDataInternal(gatherer);
  }

  /**
   * Implementation of `addValidationData()`, with the gatherer injected so
   * `addArchivalData()` can share one OCSP/CRL cache across both its
   * validation-data and timestamp steps.
   */
  private async addValidationDataInternal(
    gatherer: LtvDataGatherer,
  ): Promise<ValidationDataResult> {
    const warnings: SignWarning[] = [];

    // Collect signed signature fields - both regular signatures and
    // /Type /DocTimeStamp use a /FT /Sig field with a /V signature dict,
    // so SignatureField + isSigned() finds both. Without an AcroForm there
    // are no signature fields at all.
    const form = this.pdf.getForm();
    const signedFields = form?.getSignatureFields().filter(field => field.isSigned()) ?? [];

    if (signedFields.length === 0) {
      const bytes = await this.saveAndReload();

      return { bytes, warnings, signatureCount: 0 };
    }

    // Build a single DSSBuilder that merges with whatever DSS already
    // exists in the catalog.
    const catalogDict = this.pdf.getCatalog();
    const builder = await DSSBuilder.fromCatalog(catalogDict, this.pdf.context.registry);

    let processed = 0;

    for (const field of signedFields) {
      const sigDict = field.getSignatureDict();

      if (!sigDict) {
        warnings.push({
          code: "LTV_GATHER_FAILED",
          message: `Signature field "${field.name}" has no /V dictionary`,
        });
        continue;
      }

      // The padded /Contents bytes are exactly what viewers SHA-1 to
      // compute the VRI key, so we must pass the raw bytes including
      // zero padding (PdfString.bytes preserves that).
      const contents = sigDict.get("Contents");

      if (!(contents instanceof PdfString)) {
        warnings.push({
          code: "LTV_GATHER_FAILED",
          message: `Signature field "${field.name}" has no /Contents string`,
        });
        continue;
      }

      try {
        const ltvData = await gatherer.gather(contents.bytes);

        // Prefix gatherer warnings with the field name so callers can
        // tell which signature each warning is about.
        for (const w of ltvData.warnings) {
          warnings.push({
            code: w.code,
            message: `${field.name}: ${w.message}`,
          });
        }

        await builder.addLtvData(ltvData);
        processed += 1;
      } catch (error) {
        warnings.push({
          code: "LTV_GATHER_FAILED",
          message: `Could not gather LTV for "${field.name}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
      }
    }

    // If nothing could be gathered, don't write an empty DSS revision.
    if (processed === 0) {
      const bytes = await this.saveAndReload();

      return { bytes, warnings, signatureCount: 0 };
    }

    // Write a single incremental update for the DSS, even if some
    // signatures failed - partial data is still useful for verifiers.
    const dssRef = builder.build();

    catalogDict.set("DSS", dssRef);

    const bytes = await this.saveAndReload();

    return { bytes, warnings, signatureCount: processed };
  }

  /**
   * Finalize the document with full PAdES B-LTA semantics in a single
   * call: gather LTV for every existing signature, write a DSS update,
   * add an archival `/DocTimeStamp`, then add a second DSS update for
   * the timestamp's own certificate chain.
   *
   * Equivalent to:
   *
   * ```typescript
   * await pdf.addValidationData({ revocationProvider });
   * await pdf.addTimestamp({
   *   timestampAuthority,
   *   longTermValidation: true,
   *   revocationProvider,
   *   ...
   * });
   * ```
   *
   * Use this as the last step of a multi-signer flow once every signer
   * has appended their signature and you want to seal the document.
   *
   * If this method throws after partial progress (e.g. the TSA request
   * fails after the DSS update was written), the in-memory PDF instance
   * may be out of sync with its bytes. Discard the instance and reload
   * from the last known-good bytes.
   *
   * @example
   * ```typescript
   * const tsa = new HttpTimestampAuthority("https://freetsa.org/tsr");
   * const { bytes, warnings } = await pdf.addArchivalData({
   *   timestampAuthority: tsa,
   * });
   * ```
   */
  async addArchivalData(options: ArchivalDataOptions): Promise<ArchivalDataResult> {
    if (!options.timestampAuthority) {
      throw new SignatureError(
        "INVALID_OPTIONS",
        "addArchivalData() requires a timestampAuthority",
      );
    }

    this.ensureIncrementalSave("addArchivalData()");

    const warnings: SignWarning[] = [];

    // One gatherer for both steps so OCSP/CRL responses fetched for the
    // existing signatures (typically including the same TSA chain the
    // archival timestamp will use) are not re-fetched in step 2.
    const gatherer = new LtvDataGatherer({
      revocationProvider: options.revocationProvider ?? new DefaultRevocationProvider(),
    });

    // Step 1: gather LTV for all existing signatures and write one DSS.
    const validation = await this.addValidationDataInternal(gatherer);

    warnings.push(...validation.warnings);

    // Step 2: add the archival timestamp and let addTimestamp handle the
    // timestamp's own LTV / second DSS write.
    const timestamp = await this.addTimestampInternal(
      {
        timestampAuthority: options.timestampAuthority,
        digestAlgorithm: options.digestAlgorithm,
        estimatedSize: options.estimatedSize,
        fieldName: options.fieldName,
        longTermValidation: true,
        revocationProvider: options.revocationProvider,
      },
      gatherer,
    );

    warnings.push(...timestamp.warnings);

    return {
      bytes: timestamp.bytes,
      warnings,
      signatureCount: validation.signatureCount,
    };
  }

  /**
   * Place a document timestamp in the PDF (shared by `addTimestamp()` and the
   * B-LTA path of `sign()`).
   *
   * Returns the padded timestamp bytes (raw token + zero padding to fill the
   * placeholder) so callers can compute the SHA-1 VRI key per ETSI EN 319
   * 142-2 / PDF 2.0 § 12.8.4.3.
   */
  private async placeDocumentTimestamp(options: {
    timestampAuthority: TimestampAuthority;
    digestAlgorithm: DigestAlgorithm;
    estimatedSize: number;
    fieldName?: string;
  }): Promise<Uint8Array> {
    const { timestampAuthority, digestAlgorithm, estimatedSize, fieldName } = options;

    const firstPageRef = this.pdf.context.pages.getPage(0);

    if (!firstPageRef) {
      throw new SignatureError("NO_PAGES", "Document has no pages - cannot create timestamp field");
    }

    // Build the /Type /DocTimeStamp dictionary with placeholders.
    const timestampDict = PdfDict.of({
      Type: PdfName.of("DocTimeStamp"),
      Filter: PdfName.of("Adobe.PPKLite"),
      SubFilter: PdfName.of("ETSI.RFC3161"),
      ByteRange: createByteRangePlaceholderObject(),
      Contents: createContentsPlaceholderObject(estimatedSize),
    });

    const timestampRef = this.pdf.context.registry.register(timestampDict);

    // Create a /FT /Sig field for the timestamp and register it with the
    // AcroForm so /SigFlags is set and the field is reachable from /Fields.
    //
    // Reusing a pre-allocated field (via fieldName) is the recommended
    // pattern for multi-signer AdES / DocMDP flows where the author locks
    // down the /AcroForm /Fields structure before the certification
    // signature is applied. Unlike signing, we never auto-reuse the first
    // empty signature field when no name is given - users typically reserve
    // those for actual signers, not timestamps.
    this.prepareSignatureField({
      fieldName,
      pageRef: firstPageRef,
      valueRef: timestampRef,
      namePrefix: "Timestamp_",
      reuseFirstEmpty: false,
    });

    // Save incrementally so the file contains the new dict with placeholders.
    const pdfBytes = await this.pdf.save({ incremental: true });

    // Locate the placeholders, compute the ByteRange, and patch it in place.
    const placeholders = findPlaceholders(pdfBytes);
    const byteRange = calculateByteRange(pdfBytes, placeholders);

    patchByteRange(pdfBytes, placeholders, byteRange);

    // Hash everything outside the /Contents placeholder and request a token.
    const signedBytes = extractSignedBytes(pdfBytes, byteRange);
    const documentHash = await hashData(signedBytes, digestAlgorithm);
    const timestampToken = await timestampAuthority.timestamp(documentHash, digestAlgorithm);

    // Write the token into the /Contents placeholder.
    patchContents(pdfBytes, placeholders, timestampToken);

    // Reload so the PDF instance reflects the on-disk state.
    await this.pdf.reload(pdfBytes);

    // Return the padded /Contents bytes (raw token + trailing zeros) for VRI
    // hash computation. The VRI key is SHA-1 over the full /Contents value
    // as stored, including the zero padding - not just the raw token.
    const contentsSize = placeholders.contentsLength / 2; // hex chars -> bytes
    const paddedTimestampBytes = new Uint8Array(contentsSize);
    paddedTimestampBytes.set(timestampToken);

    return paddedTimestampBytes;
  }

  /**
   * Gather LTV data for a timestamp token.
   *
   * Used for B-LTA to add validation data for the document timestamp.
   *
   * When a shared gatherer is provided (by `addArchivalData()`), it is
   * reused so cached OCSP/CRL responses carry over. Timestamp tokens carry
   * no embedded signature timestamps, so the shared gatherer's
   * `gatherTimestampLtv: true` default has no effect here.
   */
  private async gatherTimestampLtvData(
    timestampToken: Uint8Array,
    revocationProvider: RevocationProvider | undefined,
    warnings: SignWarning[],
    sharedGatherer?: LtvDataGatherer,
  ): Promise<LtvData | null> {
    // Use LtvDataGatherer - timestamp tokens are just CMS structures
    const gatherer =
      sharedGatherer ??
      new LtvDataGatherer({
        revocationProvider: revocationProvider ?? new DefaultRevocationProvider(),
        gatherTimestampLtv: false, // Don't recurse for doc timestamps
      });

    try {
      const ltvData = await gatherer.gather(timestampToken);

      // Convert gatherer warnings to sign warnings
      for (const warning of ltvData.warnings) {
        warnings.push({ code: warning.code, message: warning.message });
      }

      // Check if we got any certificates
      if (ltvData.certificates.length === 0) {
        warnings.push({
          code: "DOC_TS_NO_CERTS",
          message: "No certificates found in document timestamp",
        });

        return null;
      }

      return ltvData;
    } catch (error) {
      warnings.push({
        code: "DOC_TS_LTV_FAILED",
        message: `Could not gather LTV data for document timestamp: ${error instanceof Error ? error.message : String(error)}`,
      });

      return null;
    }
  }

  /**
   * Validate and resolve sign options.
   */
  private resolveOptions(options: SignOptions): ResolvedSignOptions {
    // Apply PAdES level defaults
    if (options.level) {
      const levelDefaults = this.resolvePAdESLevel(options.level);

      options = { ...levelDefaults, ...options };
    }

    // Validate subFilter + level compatibility
    const subFilter = options.subFilter ?? "ETSI.CAdES.detached";

    if (options.level && subFilter === "adbe.pkcs7.detached") {
      throw new SignatureError(
        "INVALID_OPTIONS",
        "PAdES levels require ETSI.CAdES.detached subFilter",
      );
    }

    // Validate timestamp requirements
    if (
      (options.level === "B-T" || options.level === "B-LT" || options.level === "B-LTA") &&
      !options.timestampAuthority
    ) {
      throw new SignatureError(
        "INVALID_OPTIONS",
        `PAdES level ${options.level} requires a timestampAuthority`,
      );
    }

    return {
      signer: options.signer,
      digestAlgorithm: options.digestAlgorithm ?? "SHA-256",
      subFilter,
      estimatedSize: options.estimatedSize ?? DEFAULT_PLACEHOLDER_SIZE,
      signingTime: options.signingTime ?? new Date(),
      reason: options.reason,
      location: options.location,
      contactInfo: options.contactInfo,
      fieldName: options.fieldName,
      timestampAuthority: options.timestampAuthority,
      longTermValidation: options.longTermValidation ?? false,
      revocationProvider: options.revocationProvider,
      archivalTimestamp: options.archivalTimestamp ?? false,
    };
  }

  /**
   * Get the CMS format builder for the given subFilter.
   */
  private getFormatBuilder(subFilter: SubFilter): CMSFormatBuilder {
    switch (subFilter) {
      case "adbe.pkcs7.detached":
        return new PKCS7DetachedBuilder();
      case "ETSI.CAdES.detached":
        return new CAdESDetachedBuilder();
    }
  }

  /**
   * Resolve PAdES level to individual options.
   */
  private resolvePAdESLevel(level: PAdESLevel): Partial<SignOptions> {
    switch (level) {
      case "B-B":
        return {};
      case "B-T":
        return {}; // timestampAuthority must be provided separately
      case "B-LT":
        return { longTermValidation: true };
      case "B-LTA":
        return { longTermValidation: true, archivalTimestamp: true };
    }
  }
}
