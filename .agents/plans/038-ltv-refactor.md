# Plan 038: LTV Subsystem Refactor

## Problem Statement

The current signing implementation in `pdf-signature.ts` has grown to handle too many responsibilities:

- PDF structure manipulation (fields, annotations, catalog)
- CMS signature orchestration
- DSS dictionary building (duplicating the existing `DSSBuilder` class)
- LTV data gathering with two near-identical methods (`gatherLtvData`, `gatherTimestampLtvData`)
- Certificate chain building
- Revocation data fetching

This makes the code hard to maintain, test, and extend. Additionally:

- `DSSBuilder` exists but isn't used by `PDFSignature`
- Debug `console.log` statements are scattered throughout
- Production code imports from `test-utils.ts`
- VRI deduplication logic is repeated in multiple places

## Goals

1. **Single responsibility**: Each class does one thing well
2. **Unified LTV gathering**: One class handles all CMS-based LTV data extraction
3. **Use existing `DSSBuilder`**: Enhance it rather than duplicate it
4. **Testable**: Can unit test LTV gathering and DSS building independently
5. **Maintain API**: `pdf.sign()` continues to work unchanged

## Non-Goals

- Changing the public signing API
- Refactoring CMS/CAdES building (already clean)
- Refactoring placeholder handling (already clean)
- Refactoring signers (already clean)

## Design

### New File Structure

```
src/signatures/
├── index.ts                    # Public exports
├── types.ts                    # Shared types
│
├── ltv/
│   ├── index.ts                # Exports LtvDataGatherer, enhanced DSSBuilder
│   ├── gatherer.ts             # LtvDataGatherer class
│   ├── dss-builder.ts          # Enhanced DSSBuilder (moved from ../dss.ts)
│   └── vri.ts                  # VRI key computation
│
├── revocation.ts               # RevocationProvider + OCSP helpers (unchanged location)
├── aia.ts                      # AIA chain building (unchanged)
├── placeholder.ts              # ByteRange/Contents handling (unchanged)
├── crypto.ts                   # Crypto engine setup (unchanged)
├── oids.ts                     # OID constants (unchanged)
├── utils.ts                    # General utilities (unchanged)
│
├── formats/                    # CMS format builders (unchanged)
│   ├── cades-detached.ts
│   └── ...
│
└── signers/                    # Signer implementations (unchanged)
    ├── p12.ts
    └── ...
```

### Core Classes

#### `LtvDataGatherer`

Single class for gathering all LTV data from any CMS structure (signatures or timestamps).

```typescript
// src/signatures/ltv/gatherer.ts

export interface LtvData {
  /** The original CMS bytes (padded, for VRI key computation) */
  cmsBytes: Uint8Array;

  /** All certificates needed for validation (deduplicated) */
  certificates: Uint8Array[];

  /** OCSP responses for certificate validation */
  ocspResponses: Uint8Array[];

  /** CRLs for certificate validation */
  crls: Uint8Array[];

  /** Embedded timestamp tokens that need their own VRI entries */
  embeddedTimestamps: Uint8Array[];

  /** When the LTV data was gathered */
  timestamp: Date;

  /** Warnings encountered during gathering */
  warnings: LtvWarning[];
}

export interface LtvWarning {
  code: string;
  message: string;
}

export interface LtvGathererOptions {
  /** Custom revocation provider (defaults to DefaultRevocationProvider) */
  revocationProvider?: RevocationProvider;

  /** Timeout for network requests in ms (default: 10000) */
  timeout?: number;

  /** Whether to recursively gather LTV for embedded timestamps (default: true) */
  gatherTimestampLtv?: boolean;
}

export class LtvDataGatherer {
  constructor(private options: LtvGathererOptions = {}) {}

  /**
   * Gather LTV data from CMS SignedData bytes.
   *
   * Works for both signatures and timestamp tokens since both are CMS.
   * Extracts signer certificate, builds chain via AIA, gathers revocation
   * data, and handles embedded timestamps.
   *
   * @param cmsBytes - DER-encoded CMS SignedData (may be zero-padded)
   * @returns LTV data ready for DSS embedding
   */
  async gather(cmsBytes: Uint8Array): Promise<LtvData>;
}
```

**Internal flow of `gather()`:**

1. Parse CMS SignedData, extract signer certificate
2. Extract certificates embedded in CMS
3. Build complete chain via AIA (using existing `buildCertificateChain`)
4. Extract embedded timestamp tokens from unsigned attributes
5. For each embedded timestamp (if `gatherTimestampLtv` is true):
   - Recursively extract TSA certificates and chain
6. Gather revocation data (OCSP preferred, CRL fallback) for all certs
7. Extract OCSP responder certificates from OCSP responses
8. Deduplicate all certificates
9. Return unified `LtvData`

#### Enhanced `DSSBuilder`

Move existing `DSSBuilder` to `ltv/` and enhance with merge capability.

```typescript
// src/signatures/ltv/dss-builder.ts

export interface DSSBuilderOptions {
  /** Include VRI dictionary (default: true) */
  includeVri?: boolean;
}

export class DSSBuilder {
  constructor(
    private registry: ObjectRegistry,
    private options: DSSBuilderOptions = {},
  ) {}

  /**
   * Load existing DSS from catalog for merging.
   * Preserves existing VRI entries, certs, OCSPs, CRLs.
   */
  static async fromCatalog(
    catalog: PdfDict,
    registry: ObjectRegistry,
    options?: DSSBuilderOptions,
  ): Promise<DSSBuilder>;

  /**
   * Add LTV data for a signature or timestamp.
   * Creates VRI entry keyed by SHA-1 hash of cmsBytes.
   */
  async addLtvData(ltvData: LtvData): Promise<void>;

  /**
   * Build DSS dictionary and return reference.
   * Merges with any existing data loaded via fromCatalog().
   */
  async build(): Promise<PdfRef>;
}
```

**Merge behavior:**

- Existing VRI entries are preserved (not overwritten)
- New certs/OCSPs/CRLs are deduplicated against existing
- References to existing streams are reused

#### VRI Helpers

```typescript
// src/signatures/ltv/vri.ts

/**
 * Compute VRI key from CMS bytes.
 *
 * The VRI key is uppercase hex SHA-1 of the signature's /Contents value,
 * including any zero-padding. This matches how the bytes appear in the PDF.
 */
export async function computeVriKey(cmsBytes: Uint8Array): Promise<string>;

/**
 * Compute SHA-1 hash of data (for deduplication).
 */
export async function computeSha1Hex(data: Uint8Array): Promise<string>;
```

#### Revocation Module

Keep `revocation.ts` as a single file (it's small enough):

```typescript
// src/signatures/revocation.ts

export interface RevocationProvider {
  getOcspResponse(cert: Uint8Array, issuer: Uint8Array): Promise<Uint8Array | null>;
  getCrl(cert: Uint8Array): Promise<Uint8Array | null>;
}

export class DefaultRevocationProvider implements RevocationProvider {
  // Existing implementation (unchanged)
}

// OCSP helpers (already in this file)
export function extractOcspResponderCerts(ocspResponse: Uint8Array): Uint8Array[];
export function isOcspResponseSuccessful(response: Uint8Array): boolean;
```

### Simplified `PDFSignature`

After refactor, `PDFSignature.sign()` becomes a thin orchestrator:

```typescript
async sign(options: SignOptions): Promise<SignResult> {
  const warnings: SignWarning[] = [];

  // 1. Resolve options (PAdES level -> individual flags)
  const resolved = this.resolveOptions(options);

  // 2. Create signature field and placeholder
  const { pdfBytes, placeholders } = await this.createSignaturePlaceholder(resolved);

  // 3. Build and embed CMS signature
  const signatureDer = await this.buildCmsSignature(pdfBytes, placeholders, resolved);
  const paddedSignature = patchContents(pdfBytes, placeholders, signatureDer);

  // 4. Reload PDF
  await this.pdf.reload(pdfBytes);

  // 5. Add LTV data if requested
  if (resolved.longTermValidation) {
    const gatherer = new LtvDataGatherer({
      revocationProvider: resolved.revocationProvider,
    });

    const ltvData = await gatherer.gather(paddedSignature);
    warnings.push(...ltvData.warnings.map(w => ({ code: w.code, message: w.message })));

    const dssBuilder = await DSSBuilder.fromCatalog(
      await this.pdf.getCatalog(),
      this.pdf.context.registry
    );
    await dssBuilder.addLtvData(ltvData);

    const dssRef = await dssBuilder.build();
    (await this.pdf.getCatalog()).set("DSS", dssRef);

    // Save DSS revision
    const dssBytes = await this.pdf.save({ incremental: true });
    await this.pdf.reload(dssBytes);

    // 6. Add document timestamp if B-LTA
    if (resolved.archivalTimestamp && resolved.timestampAuthority) {
      const docTsBytes = await this.addDocumentTimestamp(
        resolved.timestampAuthority,
        resolved.digestAlgorithm
      );

      // Gather LTV for document timestamp
      const docTsLtvData = await gatherer.gather(docTsBytes);
      warnings.push(...docTsLtvData.warnings.map(w => ({ code: w.code, message: w.message })));

      // Merge into DSS
      const dssBuilder2 = await DSSBuilder.fromCatalog(
        await this.pdf.getCatalog(),
        this.pdf.context.registry
      );
      await dssBuilder2.addLtvData(docTsLtvData);

      const dssRef2 = await dssBuilder2.build();
      (await this.pdf.getCatalog()).set("DSS", dssRef2);

      // Save final revision
      const finalBytes = await this.pdf.save({ incremental: true });
      await this.pdf.reload(finalBytes);
    }
  }

  return {
    bytes: await this.pdf.save({ incremental: true }),
    warnings,
  };
}
```

### Helper Migrations

| Current Location                      | New Location         | Notes                                   |
| ------------------------------------- | -------------------- | --------------------------------------- |
| `test-utils.ts` → `hexToBytes`        | `helpers/bytes.ts`   | Production helper                       |
| `pdf-signature.ts` → `computeVriKey`  | `ltv/vri.ts`         | VRI-specific                            |
| `pdf-signature.ts` → `computeSha1Hex` | `ltv/vri.ts`         | Deduplication helper                    |
| `dss.ts`                              | `ltv/dss-builder.ts` | Enhanced, moved                         |
| `revocation.ts`                       | `revocation.ts`      | Unchanged location, keep as single file |

## Implementation Steps

### Phase 1: Prepare Helpers & Add AIA/Revocation Tests

1. Move `hexToBytes` from `test-utils.ts` to `helpers/bytes.ts`
2. Create `ltv/vri.ts` with `computeVriKey`, `computeSha1Hex`
3. Add unit tests for `aia.ts`:
   - `getCaIssuersUrl()` parsing with real certificates
   - `isSelfSigned()` detection
   - Chain building with mocked fetch
4. Add unit tests for `revocation.ts`:
   - `getOcspUrl()` parsing with real certificates
   - `getCrlUrls()` parsing with real certificates (the manual ASN.1 parsing)
   - `extractOcspResponderCerts()` with real OCSP responses

### Phase 2: Create LtvDataGatherer

1. Create `ltv/gatherer.ts` with `LtvDataGatherer` class
2. Extract CMS parsing logic from `gatherLtvData`
3. Implement unified gathering for signatures and timestamps
4. Add tests for gatherer in isolation

### Phase 3: Enhance DSSBuilder

1. Move `dss.ts` to `ltv/dss-builder.ts`
2. Add `fromCatalog()` static method for loading existing DSS
3. Add `addLtvData()` method that accepts `LtvData`
4. Implement merge logic (preserve existing VRI, dedupe refs)
5. Add tests for merge scenarios

### Phase 4: Refactor PDFSignature

1. Remove `gatherLtvData`, `gatherTimestampLtvData`, `gatherRevocationData`
2. Remove inline DSS building in `addDss`
3. Use `LtvDataGatherer` and `DSSBuilder` instead
4. Remove debug console.logs
5. Verify all existing tests pass

### Phase 5: Cleanup

1. Update exports in `signatures/index.ts`
2. Remove old `dss.ts` (now at `ltv/dss-builder.ts`)
3. Update any imports across codebase
4. Run full test suite

## Test Plan

### Unit Tests

**AIA (`aia.ts`):**

Test fixtures needed: Real certificates with AIA extensions. Can be obtained from:

- Any public website's certificate chain (e.g., `openssl s_client -connect example.com:443`)
- Saved as DER-encoded fixtures in `fixtures/certificates/`

Test cases:

- Extracts CA Issuers URL from certificate with AIA extension
- Returns null for certificate without AIA (use self-signed test cert)
- Handles malformed AIA extension gracefully
- Correctly identifies self-signed certificates
- Correctly identifies non-self-signed certificates
- Builds chain with mocked fetch (returns issuer cert)
- Stops at self-signed root
- Handles circular references (same cert twice)
- Respects maxChainLength limit
- Continues from existing chain's last cert

**Revocation (`revocation.ts`):**

Test fixtures needed: Same real certificates, plus OCSP responses.
OCSP responses can be captured via: `openssl ocsp -issuer issuer.pem -cert cert.pem -url <ocsp-url> -respout ocsp.der`

Test cases:

- Extracts OCSP URL from certificate AIA extension
- Returns null for certificate without OCSP URL
- Extracts CRL URLs from CRL Distribution Points extension
- Handles various CRL DP formats (the manual ASN.1 parsing covers edge cases)
- Returns empty array for certificate without CRL DP
- `extractOcspResponderCerts()` extracts certs from BasicOCSPResponse
- `isOcspResponseSuccessful()` validates response status (0=success, others=failure)

**LtvDataGatherer:**

- Parses CMS and extracts signer cert
- Builds chain via AIA (mock network)
- Extracts embedded timestamps
- Gathers OCSP/CRL (mock provider)
- Extracts OCSP responder certs
- Handles missing/invalid data gracefully
- Deduplicates certificates

**DSSBuilder:**

- Creates DSS with certs/OCSPs/CRLs
- Creates VRI entries with correct keys
- Loads existing DSS from catalog
- Merges new data with existing
- Preserves existing VRI entries
- Deduplicates stream references

### Integration Tests

- `pdf.sign()` with B-B level (no LTV)
- `pdf.sign()` with B-T level (timestamp, no DSS)
- `pdf.sign()` with B-LT level (DSS, no doc timestamp)
- `pdf.sign()` with B-LTA level (DSS + doc timestamp + DSS for timestamp)
- Signing already-signed PDF (DSS merge)
- Signature with embedded timestamp in CMS

All existing tests in `signing.integration.test.ts` must continue to pass.

## Open Questions

1. **Should `LtvDataGatherer` cache results?** For example, if the same TSA cert appears in multiple timestamps, avoid re-fetching revocation data.
   - _Tentative_: Yes, use internal Maps keyed by cert hash.

2. **Should we support partial LTV?** Currently if chain building fails, we continue with partial data. Keep this behavior?
   - _Tentative_: Yes, with warnings. Better to have partial LTV than none.

3. **What about existing DSS with different stream objects?** If existing DSS has a cert as stream X, and we add the same cert, should we reuse X or create new stream?
   - _Tentative_: Reuse existing refs when data matches (compare by hash).

## Technical Notes

### Why Manual ASN.1 Parsing?

Both `aia.ts` and `revocation.ts` use manual ASN.1 parsing (via raw `asn1js` Sequence/ObjectIdentifier) instead of pkijs classes for:

1. **AIA extension parsing** - `getCaIssuersUrl()` and `getOcspUrl()`
2. **CRL Distribution Points parsing** - `getCrlUrls()`

This is because pkijs's `AuthorityInfoAccess` and `CRLDistributionPoints` classes had issues parsing certain certificate formats encountered in the wild. The manual parsing is more tolerant of edge cases.

**Goal**: The unit tests should capture the specific formats that caused pkijs to fail, ensuring our manual parsing continues to work and providing regression protection if we ever try to switch back to pkijs classes.
