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
import type { PdfRef } from "#src/objects/pdf-ref";
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
  type DigestAlgorithm,
  type PAdESLevel,
  type RevocationProvider,
  SignatureError,
  type SignOptions,
  type SignResult,
  type SignWarning,
  type SubFilter,
  type TimestampAuthority,
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
    const mdpWarning = await this.checkMdpViolation();

    if (mdpWarning) {
      warnings.push(mdpWarning);
    }

    // Get first page reference (for widget annotation placement)
    const firstPageRef = this.pdf.context.pages.getPage(0);

    if (!firstPageRef) {
      throw new Error("Document has no pages - cannot create signature field");
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
    await this.findOrCreateSignatureField({
      fieldName: resolved.fieldName,
      pageRef: firstPageRef,
      signatureRef,
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
    const documentHash = hashData(signedBytes, resolved.digestAlgorithm);

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
      const signatureHash = hashData(signatureValue, resolved.digestAlgorithm);

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
        const docTsToken = await this.addDocumentTimestamp(
          resolved.timestampAuthority,
          resolved.digestAlgorithm,
        );

        // Add DSS for the document timestamp's certificate chain.
        // This is more proactive than EU DSS (which waits for future LTA extensions),
        // but ensures the timestamp is fully LTV-enabled from the start.
        if (docTsToken) {
          const docTsLtvData = await this.gatherTimestampLtvData(
            docTsToken,
            resolved.revocationProvider,
            warnings,
          );

          if (docTsLtvData) {
            await this.addDss(docTsLtvData);
          }
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
   * Find or create a signature field.
   */
  private async findOrCreateSignatureField(options: {
    fieldName?: string;
    pageRef: PdfRef;
    signatureRef: PdfRef;
  }): Promise<void> {
    const { fieldName, pageRef, signatureRef } = options;

    const form = await this.pdf.getOrCreateForm();

    const existingNames = new Set<string>();

    let fieldDict: PdfDict | undefined;

    const fields = form.getFields();

    for (const field of fields) {
      existingNames.add(field.name);

      // If requested name matches an existing field
      if (fieldName && field.name === fieldName) {
        if (field instanceof SignatureField) {
          if (field.isSigned()) {
            throw new Error(`Signature field "${fieldName}" is already signed`);
          }

          fieldDict = field.getDict(); // Use existing unsigned field
          break;
        }

        throw new Error(`Field "${fieldName}" exists but is not a signature field`);
      }

      // If no name requested, look for first empty signature field
      if (!fieldName && field instanceof SignatureField && !field.isSigned()) {
        fieldDict = field.getDict();
        break;
      }
    }

    if (!fieldDict) {
      fieldDict = form
        .createSignatureField(fieldName ?? generateUniqueName(existingNames, "Signature_"))
        .getDict();
    }

    // Set signature value
    fieldDict.set("V", signatureRef);

    // Convert to merged field+widget model (common for invisible signatures)
    // Remove /Kids if present (we're merging into a single object)
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
   * Check for MDP (certification signature) violations.
   */
  private async checkMdpViolation(): Promise<SignWarning | null> {
    const form = await this.pdf.getForm();

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

    // Get catalog
    const catalogDict = await this.pdf.getCatalog();

    if (!catalogDict) {
      throw new Error("Document has no catalog");
    }

    // Load existing DSS for merging, or create new builder
    const dssBuilder = await DSSBuilder.fromCatalog(catalogDict, registry);

    // Add the LTV data (handles deduplication and VRI entries)
    await dssBuilder.addLtvData(ltvData);

    // Build and register DSS
    const dssRef = await dssBuilder.build();
    catalogDict.set("DSS", dssRef);

    // Save and reload
    const savedBytes = await this.pdf.save({ incremental: true });
    await this.pdf.reload(savedBytes);
  }

  /**
   * Add a document timestamp for archival (B-LTA).
   *
   * Creates a document timestamp signature that covers the entire document
   * including previous signatures and DSS data.
   *
   * After adding the timestamp, the PDF is reloaded with the updated bytes.
   *
   * @param timestampAuthority The timestamp authority to use
   * @param digestAlgorithm Digest algorithm (defaults to SHA-256)
   * @returns The timestamp token bytes (for gathering LTV data)
   */
  async addDocumentTimestamp(
    timestampAuthority: TimestampAuthority,
    digestAlgorithm: DigestAlgorithm = "SHA-256",
  ): Promise<Uint8Array> {
    const estimatedSize = DEFAULT_PLACEHOLDER_SIZE;
    const registry = this.pdf.context.registry;

    // Get first page for widget
    const firstPageRef = this.pdf.context.pages.getPage(0);

    if (!firstPageRef) {
      throw new Error("Document has no pages");
    }

    // Create document timestamp dictionary with placeholders
    const timestampDict = PdfDict.of({
      Type: PdfName.of("DocTimeStamp"),
      Filter: PdfName.of("Adobe.PPKLite"),
      SubFilter: PdfName.of("ETSI.RFC3161"),
      ByteRange: createByteRangePlaceholderObject(),
      Contents: createContentsPlaceholderObject(estimatedSize),
    });

    const timestampRef = registry.register(timestampDict);

    // Create signature field for timestamp
    const fieldName = `DocTimeStamp_${Date.now()}`;
    const fieldDict = PdfDict.of({
      Type: PdfName.of("Annot"),
      Subtype: PdfName.of("Widget"),
      FT: PdfName.of("Sig"),
      T: PdfString.fromString(fieldName),
      V: timestampRef,
      F: PdfNumber.of(132),
      P: firstPageRef,
      Rect: new PdfArray([PdfNumber.of(0), PdfNumber.of(0), PdfNumber.of(0), PdfNumber.of(0)]),
    });

    registry.register(fieldDict);

    // Save to get bytes with placeholders
    const savedBytes = await this.pdf.save({ incremental: true });

    // Find placeholders and calculate ByteRange
    const placeholders = findPlaceholders(savedBytes);
    const byteRange = calculateByteRange(savedBytes, placeholders);

    // Patch ByteRange
    patchByteRange(savedBytes, placeholders, byteRange);

    // Hash and get timestamp
    const signedBytes = extractSignedBytes(savedBytes, byteRange);
    const documentHash = hashData(signedBytes, digestAlgorithm);
    const timestampToken = await timestampAuthority.timestamp(documentHash, digestAlgorithm);

    // Patch Contents
    patchContents(savedBytes, placeholders, timestampToken);

    // Reload
    await this.pdf.reload(savedBytes);

    // Return padded timestamp bytes for correct VRI hash computation.
    // The VRI key is the SHA-1 hash of the FULL /Contents value as stored
    // in the PDF, including zero padding - not just the raw timestamp token.
    const contentsSize = placeholders.contentsLength / 2; // Hex chars -> bytes
    const paddedTimestampBytes = new Uint8Array(contentsSize);
    paddedTimestampBytes.set(timestampToken); // Remaining bytes are zeros

    return paddedTimestampBytes;
  }

  /**
   * Gather LTV data for a timestamp token.
   *
   * Used for B-LTA to add validation data for the document timestamp.
   */
  private async gatherTimestampLtvData(
    timestampToken: Uint8Array,
    revocationProvider: RevocationProvider | undefined,
    warnings: SignWarning[],
  ): Promise<LtvData | null> {
    // Use LtvDataGatherer - timestamp tokens are just CMS structures
    const gatherer = new LtvDataGatherer({
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
