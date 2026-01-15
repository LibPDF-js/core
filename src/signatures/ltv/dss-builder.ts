/**
 * Document Security Store (DSS) builder for Long-Term Validation (LTV).
 *
 * The DSS dictionary contains validation data (certificates, OCSP responses, CRLs)
 * that allows verifying signatures even after certificates expire.
 *
 * PDF 2.0: Section 12.8.4.3 - Document Security Store dictionary
 * ETSI EN 319 142-1: PAdES digital signatures
 */

import type { ObjectRegistry } from "#src/document/object-registry.ts";
import { formatPdfDate } from "#src/helpers/format.ts";
import { PdfArray } from "#src/objects/pdf-array.ts";
import { PdfDict } from "#src/objects/pdf-dict.ts";
import { PdfName } from "#src/objects/pdf-name.ts";
import { PdfRef } from "#src/objects/pdf-ref.ts";
import { PdfStream } from "#src/objects/pdf-stream.ts";
import { PdfString } from "#src/objects/pdf-string.ts";

import type { LtvData } from "./gatherer";
import { computeSha1Hex, computeVriKey } from "./vri";

/**
 * Options for DSSBuilder.
 */
export interface DSSBuilderOptions {
  /** Include VRI dictionary (default: true) */
  includeVri?: boolean;
}

/**
 * Internal structure for tracking data with refs.
 */
interface DataWithRef {
  data: Uint8Array;
  ref?: PdfRef;
}

/**
 * DSS dictionary builder.
 *
 * Creates and updates the Document Security Store dictionary in a PDF
 * to embed long-term validation data.
 *
 * @example
 * ```typescript
 * const dssBuilder = await DSSBuilder.fromCatalog(catalog, registry);
 * await dssBuilder.addLtvData(ltvData);
 * const dssRef = await dssBuilder.build();
 * catalog.set("DSS", dssRef);
 * ```
 */
export class DSSBuilder {
  private readonly registry: ObjectRegistry;
  private readonly includeVri: boolean;

  /** Certificates keyed by SHA-1 hash */
  private readonly certMap = new Map<string, DataWithRef>();

  /** OCSP responses keyed by SHA-1 hash */
  private readonly ocspMap = new Map<string, DataWithRef>();

  /** CRLs keyed by SHA-1 hash */
  private readonly crlMap = new Map<string, DataWithRef>();

  /** VRI entries keyed by signature hash (uppercase) */
  private readonly vriEntries = new Map<
    string,
    {
      certHashes: string[];
      ocspHashes: string[];
      crlHashes: string[];
      timestamp?: Date;
    }
  >();

  /** Existing refs from loaded DSS (for reuse) */
  private readonly existingCertRefs = new Map<string, PdfRef>();
  private readonly existingOcspRefs = new Map<string, PdfRef>();
  private readonly existingCrlRefs = new Map<string, PdfRef>();

  private constructor(registry: ObjectRegistry, options: DSSBuilderOptions = {}) {
    this.registry = registry;
    this.includeVri = options.includeVri ?? true;
  }

  /**
   * Create a new DSSBuilder.
   */
  static create(registry: ObjectRegistry, options?: DSSBuilderOptions): DSSBuilder {
    return new DSSBuilder(registry, options);
  }

  /**
   * Load existing DSS from catalog for merging.
   *
   * Preserves existing VRI entries, certs, OCSPs, CRLs.
   * New data will be merged with existing data.
   */
  static async fromCatalog(
    catalog: PdfDict,
    registry: ObjectRegistry,
    options?: DSSBuilderOptions,
  ): Promise<DSSBuilder> {
    const builder = new DSSBuilder(registry, options);

    const dssVal = catalog.get("DSS");

    if (!dssVal) {
      return builder;
    }

    // Resolve DSS if it's a reference
    let dss: PdfDict;

    if (dssVal instanceof PdfDict) {
      dss = dssVal;
    } else if (dssVal instanceof PdfRef) {
      const resolved = await registry.resolve(dssVal);

      if (!(resolved instanceof PdfDict)) {
        return builder;
      }

      dss = resolved;
    } else {
      return builder;
    }

    // Load existing certificates and track their refs
    await builder.loadExistingData(dss, "Certs", builder.certMap, builder.existingCertRefs);
    await builder.loadExistingData(dss, "OCSPs", builder.ocspMap, builder.existingOcspRefs);
    await builder.loadExistingData(dss, "CRLs", builder.crlMap, builder.existingCrlRefs);

    // Load existing VRI entries
    const vriVal = dss.get("VRI");

    if (vriVal) {
      // Resolve VRI if it's a reference
      let vri: PdfDict;

      if (vriVal instanceof PdfDict) {
        vri = vriVal;
      } else if (vriVal instanceof PdfRef) {
        const resolved = await registry.resolve(vriVal);

        if (!(resolved instanceof PdfDict)) {
          return builder;
        }

        vri = resolved;
      } else {
        return builder;
      }

      for (const key of vri.keys()) {
        const entryVal = vri.get(key);

        if (entryVal) {
          // Resolve VRI entry if it's a reference
          let entry: PdfDict;

          if (entryVal instanceof PdfDict) {
            entry = entryVal;
          } else if (entryVal instanceof PdfRef) {
            const resolved = await registry.resolve(entryVal);

            if (!(resolved instanceof PdfDict)) {
              continue;
            }

            entry = resolved;
          } else {
            continue;
          }

          // Extract cert/ocsp/crl hashes from the VRI entry
          const certHashes = await builder.extractRefHashes(entry, "Cert", builder.certMap);
          const ocspHashes = await builder.extractRefHashes(entry, "OCSP", builder.ocspMap);
          const crlHashes = await builder.extractRefHashes(entry, "CRL", builder.crlMap);

          // Get timestamp if present
          let timestamp: Date | undefined;
          const tuVal = entry.get("TU");

          if (tuVal instanceof PdfString) {
            // Parse PDF date format - simplified
            timestamp = new Date();
          }

          // VRI keys are PdfName, need to get the value string
          builder.vriEntries.set(key.value.toUpperCase(), {
            certHashes,
            ocspHashes,
            crlHashes,
            timestamp,
          });
        }
      }
    }

    return builder;
  }

  /**
   * Add LTV data for a signature or timestamp.
   *
   * Creates VRI entry keyed by SHA-1 hash of cmsBytes.
   */
  async addLtvData(ltvData: LtvData): Promise<void> {
    const vriKey = await computeVriKey(ltvData.cmsBytes);

    // Collect cert hashes
    const certHashes: string[] = [];

    for (const cert of ltvData.certificates) {
      const hash = await computeSha1Hex(cert);

      if (!this.certMap.has(hash)) {
        this.certMap.set(hash, { data: cert });
      }

      certHashes.push(hash);
    }

    // Collect OCSP hashes
    const ocspHashes: string[] = [];

    for (const ocsp of ltvData.ocspResponses) {
      const hash = await computeSha1Hex(ocsp);

      if (!this.ocspMap.has(hash)) {
        this.ocspMap.set(hash, { data: ocsp });
      }

      ocspHashes.push(hash);
    }

    // Collect CRL hashes
    const crlHashes: string[] = [];

    for (const crl of ltvData.crls) {
      const hash = await computeSha1Hex(crl);

      if (!this.crlMap.has(hash)) {
        this.crlMap.set(hash, { data: crl });
      }

      crlHashes.push(hash);
    }

    // Don't overwrite existing VRI entries
    if (!this.vriEntries.has(vriKey)) {
      this.vriEntries.set(vriKey, {
        certHashes,
        ocspHashes,
        crlHashes,
        timestamp: ltvData.timestamp,
      });
    }

    // Add VRI entries for embedded timestamps
    for (const tsToken of ltvData.embeddedTimestamps) {
      const tsVriKey = await computeVriKey(tsToken);

      if (!this.vriEntries.has(tsVriKey)) {
        this.vriEntries.set(tsVriKey, {
          certHashes: [],
          ocspHashes: [],
          crlHashes: [],
          timestamp: ltvData.timestamp,
        });
      }
    }
  }

  /**
   * Build DSS dictionary and return reference.
   *
   * Merges with any existing data loaded via fromCatalog().
   */
  async build(): Promise<PdfRef> {
    const dss = new PdfDict();
    dss.set("Type", PdfName.of("DSS"));

    // Create streams for new data and collect all refs
    const certRefs = await this.buildStreamRefs(this.certMap, this.existingCertRefs);
    const ocspRefs = await this.buildStreamRefs(this.ocspMap, this.existingOcspRefs);
    const crlRefs = await this.buildStreamRefs(this.crlMap, this.existingCrlRefs);

    if (certRefs.length > 0) {
      dss.set("Certs", new PdfArray(certRefs));
    }

    if (ocspRefs.length > 0) {
      dss.set("OCSPs", new PdfArray(ocspRefs));
    }

    if (crlRefs.length > 0) {
      dss.set("CRLs", new PdfArray(crlRefs));
    }

    // Build VRI dictionary
    if (this.includeVri && this.vriEntries.size > 0) {
      const vri = new PdfDict();

      for (const [vriKey, entry] of this.vriEntries) {
        const vriEntry = new PdfDict();

        // Add cert refs for this VRI
        const certRefsForVri = this.collectRefs(entry.certHashes, this.certMap);

        if (certRefsForVri.length > 0) {
          vriEntry.set("Cert", new PdfArray(certRefsForVri));
        }

        // Add OCSP refs for this VRI
        const ocspRefsForVri = this.collectRefs(entry.ocspHashes, this.ocspMap);

        if (ocspRefsForVri.length > 0) {
          vriEntry.set("OCSP", new PdfArray(ocspRefsForVri));
        }

        // Add CRL refs for this VRI
        const crlRefsForVri = this.collectRefs(entry.crlHashes, this.crlMap);

        if (crlRefsForVri.length > 0) {
          vriEntry.set("CRL", new PdfArray(crlRefsForVri));
        }

        // Add timestamp
        if (entry.timestamp) {
          vriEntry.set("TU", PdfString.fromString(formatPdfDate(entry.timestamp)));
        }

        vri.set(vriKey, vriEntry);
      }

      dss.set("VRI", vri);
    }

    return this.registry.register(dss);
  }

  /**
   * Load existing data from DSS array.
   */
  private async loadExistingData(
    dss: PdfDict,
    key: string,
    dataMap: Map<string, DataWithRef>,
    refMap: Map<string, PdfRef>,
  ): Promise<void> {
    let arrayVal = dss.get(key);

    if (!arrayVal) {
      return;
    }

    // Resolve array if it's a reference
    let array: PdfArray | undefined;

    if (arrayVal instanceof PdfRef) {
      arrayVal = (await this.registry.resolve(arrayVal)) ?? undefined;
    }

    if (arrayVal instanceof PdfArray) {
      array = arrayVal;
    }

    if (!array) {
      return;
    }

    for (const item of array) {
      if (item instanceof PdfRef) {
        const stream = await this.registry.resolve(item);

        if (stream instanceof PdfStream) {
          const data = await stream.getDecodedData();
          const hash = await computeSha1Hex(data);

          // Store data and existing ref
          dataMap.set(hash, { data, ref: item });
          refMap.set(hash, item);
        }
      }
    }
  }

  /**
   * Extract ref hashes from VRI entry array.
   */
  private async extractRefHashes(
    entry: PdfDict,
    key: string,
    dataMap: Map<string, DataWithRef>,
  ): Promise<string[]> {
    const hashes: string[] = [];

    let arrayVal = entry.get(key);

    if (!arrayVal) {
      return hashes;
    }

    if (arrayVal instanceof PdfRef) {
      arrayVal = (await this.registry.resolve(arrayVal)) ?? undefined;
    }

    const array = arrayVal instanceof PdfArray ? arrayVal : null;

    if (!array) {
      return hashes;
    }

    for (const item of array) {
      if (item instanceof PdfRef) {
        const stream = await this.registry.resolve(item);

        if (stream instanceof PdfStream) {
          const data = await stream.getDecodedData();
          const hash = await computeSha1Hex(data);
          hashes.push(hash);

          // Ensure data is in map
          if (!dataMap.has(hash)) {
            dataMap.set(hash, { data, ref: item });
          }
        }
      }
    }

    return hashes;
  }

  /**
   * Build stream refs, reusing existing refs where possible.
   */
  private async buildStreamRefs(
    dataMap: Map<string, DataWithRef>,
    existingRefs: Map<string, PdfRef>,
  ): Promise<PdfRef[]> {
    const refs: PdfRef[] = [];

    for (const [hash, entry] of dataMap) {
      // Reuse existing ref if available
      let ref = entry.ref ?? existingRefs.get(hash);

      if (!ref) {
        // Create new stream
        const stream = new PdfStream(new PdfDict(), entry.data);
        ref = this.registry.register(stream);
        entry.ref = ref;
      }

      refs.push(ref);
    }

    return refs;
  }

  /**
   * Collect refs for hashes from data map.
   */
  private collectRefs(hashes: string[], dataMap: Map<string, DataWithRef>): PdfRef[] {
    const refs: PdfRef[] = [];
    const seen = new Set<string>();

    for (const hash of hashes) {
      if (seen.has(hash)) {
        continue;
      }

      seen.add(hash);

      const entry = dataMap.get(hash);

      if (entry?.ref) {
        refs.push(entry.ref);
      }
    }

    return refs;
  }
}
