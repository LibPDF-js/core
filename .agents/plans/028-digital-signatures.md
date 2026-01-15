# 028: Digital Signatures

## Problem Statement

PDF documents need cryptographic signatures for legal validity, authenticity, and tamper detection. Digital signatures in PDF are complex because:

1. The signature must be embedded in the PDF, but computed over the PDF's bytes (chicken-and-egg)
2. Signing may happen externally (HSM, cloud KMS, smart cards)
3. Multiple signatures require incremental updates to preserve earlier signatures
4. Long-term validation requires embedding certificates and revocation data

## Goals

- Sign PDFs with PAdES compliance (B-B through B-LTA levels)
- Support local keys (P12/PKCS#12) and external signers (HSM, cloud)
- Support multiple sequential signatures
- Enable long-term validation and archival
- Verify existing signatures

## Non-Goals (This Plan)

- Visible signature rendering (stamp/image appearances) - separate plan
- Certificate management UI/workflows
- Smart card/PKCS#11 direct integration (users implement `Signer` interface)

## Dependencies

- **pkijs** - CMS/PKCS#7 generation and parsing (also handles X.509 via asn1js)
- Existing: incremental updates, form fields (for signature fields)

Note: Web Crypto can import/use X.509 certificates but cannot parse their structure (extract issuer, subject, extensions, etc.). pkijs already includes full X.509 parsing via asn1js, so no separate dependency needed.

Bundle size: pkijs adds ~200KB minified. This is acceptable for a signing library - correctness matters more than size for cryptographic operations.

---

## High-Level API

### Core Interfaces

```typescript
type DigestAlgorithm = "SHA-256" | "SHA-384" | "SHA-512";
type KeyType = "RSA" | "EC";
type SignatureAlgorithm = "RSASSA-PKCS1-v1_5" | "RSA-PSS" | "ECDSA";

/**
 * A signer provides cryptographic signing capabilities.
 * Implementations can wrap local keys, HSM, cloud KMS, etc.
 */
interface Signer {
  /** DER-encoded X.509 signing certificate */
  readonly certificate: Uint8Array;

  /** Optional certificate chain [intermediate, ..., root] */
  readonly certificateChain?: Uint8Array[];

  /** Key type (RSA or EC) - required for CMS construction */
  readonly keyType: KeyType;

  /** Signature algorithm - required for CMS construction */
  readonly signatureAlgorithm: SignatureAlgorithm;

  /** Sign a digest, return raw signature bytes */
  sign(digest: Uint8Array, algorithm: DigestAlgorithm): Promise<Uint8Array>;
}

/**
 * RFC 3161 timestamp authority
 */
interface TimestampAuthority {
  /** Get timestamp token for digest */
  timestamp(digest: Uint8Array, algorithm: DigestAlgorithm): Promise<Uint8Array>;
}

/**
 * Provides OCSP/CRL data for long-term validation
 */
interface RevocationProvider {
  getOCSP?(cert: Uint8Array, issuer: Uint8Array): Promise<Uint8Array | null>;
  getCRL?(cert: Uint8Array): Promise<Uint8Array | null>;
}
```

### Signing Options

```typescript
type SubFilter = "adbe.pkcs7.detached" | "ETSI.CAdES.detached";

interface SignOptions {
  signer: Signer;

  // Metadata
  reason?: string;
  location?: string;
  contactInfo?: string;

  /**
   * Signing time to embed in the signature.
   * Defaults to current system time.
   *
   * NOTE: This is NOT cryptographically verified - it's just a claim.
   * The signer's local clock provides this value. For proven time,
   * use a TimestampAuthority (B-T level or higher).
   */
  signingTime?: Date;

  // Field configuration
  fieldName?: string; // Use existing or create new (auto-generated if omitted)

  // Signature format
  subFilter?: SubFilter; // default: "ETSI.CAdES.detached"

  // PAdES level (convenience shorthand, requires CAdES subFilter)
  level?: "B-B" | "B-T" | "B-LT" | "B-LTA";

  // Or configure individually:
  timestampAuthority?: TimestampAuthority;
  longTermValidation?: boolean;
  revocationProvider?: RevocationProvider;
  archivalTimestamp?: boolean;

  // Advanced
  digestAlgorithm?: DigestAlgorithm; // default: SHA-256
  estimatedSize?: number; // placeholder size, default: 12KB
}
```

### Usage Examples

```typescript
// Basic signing (B-B)
const signedBytes = await pdf.sign({
  signer: new P12Signer(p12Bytes, "password"),
  reason: "I approve this document",
});

// With timestamp (B-T)
const signedBytes = await pdf.sign({
  signer,
  reason: "Approved",
  timestampAuthority: new HttpTimestampAuthority("http://timestamp.example.com"),
});

// Long-term archival (B-LTA)
const signedBytes = await pdf.sign({
  signer,
  level: "B-LTA",
  timestampAuthority,
});

// Multiple signatures - each returns new bytes
let bytes = await pdf.sign({ signer: signer1, fieldName: "Author" });
bytes = await (await PDF.load(bytes)).sign({ signer: signer2, fieldName: "Reviewer" });

// Explicit signing time (for testing or compliance)
const signedBytes = await pdf.sign({
  signer,
  signingTime: new Date("2025-01-15T10:00:00Z"),
});
```

### Key Design Decisions

1. **`sign()` returns bytes and seals the document** - Prevents accidental post-signature modification

2. **Single unified API** - No separate "external signing" API. The `Signer.sign()` is async, so remote calls work naturally

3. **PAdES `level` shorthand** - `level: "B-LTA"` expands to the right combination of options

4. **Signer declares key type and algorithm** - Required properties `keyType` and `signatureAlgorithm` allow CMS construction without parsing the certificate on every sign

5. **Fail fast on errors** - All errors throw. No graceful degradation. Users get predictable behavior.

---

## Signature Formats (SubFilter)

Two signature formats are supported:

| SubFilter             | Use Case                                             |
| --------------------- | ---------------------------------------------------- |
| `adbe.pkcs7.detached` | Legacy/broad compatibility, simple PKCS#7            |
| `ETSI.CAdES.detached` | PAdES compliance, EU regulations, long-term archival |

**Default**: `ETSI.CAdES.detached` - it's the modern standard and required for PAdES levels.

**Difference**: CAdES adds mandatory signed attributes (signing certificate reference, ESS signing-certificate-v2) that bind the certificate to the signature, preventing substitution attacks. PKCS#7 is simpler but less secure.

```typescript
// Legacy format for maximum compatibility
await pdf.sign({ signer, subFilter: "adbe.pkcs7.detached" });

// Modern PAdES-compliant (default)
await pdf.sign({ signer, subFilter: "ETSI.CAdES.detached" });
await pdf.sign({ signer, level: "B-LTA" }); // implies CAdES
```

If `level` is specified with `subFilter: "adbe.pkcs7.detached"`, an error is thrown - PAdES levels require CAdES format.

---

## Architecture

### New Modules

```
src/
  signatures/
    signers/
      types.ts             # Signer interface, DigestAlgorithm, KeyType
      p12-signer.ts        # PKCS#12 file signer
      crypto-key-signer.ts # Web Crypto CryptoKey signer
    formats/
      types.ts             # SubFilter enum, shared format types
      pkcs7-detached.ts    # adbe.pkcs7.detached format
      cades-detached.ts    # ETSI.CAdES.detached format (PAdES)
    timestamp.ts           # TimestampAuthority, HttpTimestampAuthority
    revocation.ts          # RevocationProvider, DefaultRevocationProvider
    placeholder.ts         # ByteRange/Contents placeholder handling
    dss.ts                 # Document Security Store (LTV data)
    aia.ts                 # Authority Information Access chain building
    sign.ts                # Main signing orchestration
    verify.ts              # Signature verification
    types.ts               # Shared types, SignOptions
```

### Integration Points

- **PDFDocument** - `pdf.sign(options)` method
- **Form fields** - Signature fields are a form field type
- **Incremental updates** - Each signature is an incremental update
- **Catalog** - DSS dictionary lives in catalog

---

## Implementation Phases

### Phase 1: Basic Signing (B-B)

Core infrastructure for creating valid signed PDFs.

**Components:**

- `Signer` interface and `P12Signer` implementation
- Placeholder mechanism (reserve ByteRange/Contents space)
- CMS SignedData generation (using pkijs)
- Signature dictionary creation (`/Type /Sig`)
- Signature field and widget annotation
- `pdf.sign()` API integration

**Internal Flow:**

1. Create signature field + widget (or use existing)
2. Create signature dictionary with placeholders
3. Write incremental update to buffer
4. Calculate actual ByteRange values
5. Patch ByteRange in buffer
6. Hash signed byte ranges
7. Call `signer.sign(digest)`
8. Build CMS SignedData with signature + certificate
9. Hex-encode CMS and patch into Contents
10. Return final bytes, mark PDF sealed

### Phase 2: Timestamps (B-T)

Add RFC 3161 timestamp support.

**Components:**

- `TimestampAuthority` interface
- `HttpTimestampAuthority` - HTTP TSA client
- Timestamp token embedding in CMS SignerInfo

**Flow addition:**

- After creating signature, hash the signature value
- Request timestamp from TSA
- Embed timestamp token as unsigned attribute in SignerInfo

### Phase 3: Long-Term Validation (B-LT)

Embed validation data for offline verification.

**Components:**

- `RevocationProvider` interface
- `DefaultRevocationProvider` - fetches from certificate URLs
- DSS dictionary builder
- VRI (Validation Related Information) entries
- OCSP client (fetch OCSP responses)
- CRL fetching
- AIA chain building (fetch missing intermediates)

**Flow addition:**

- After signature, collect all certificates in chain
- If chain incomplete, attempt AIA chain building (throw if fails)
- Fetch OCSP/CRL for each certificate
- Build DSS dictionary with Certs, OCSPs, CRLs arrays
- Add VRI entry keyed by signature hash
- Write DSS as second incremental update

### Phase 4: Archival (B-LTA)

Document timestamps for long-term archival.

**Components:**

- Document timestamp signature (`/SubFilter /ETSI.RFC3161`)
- Re-timestamping support (experimental)

**Flow addition:**

- After DSS update, create document timestamp
- Document timestamp covers entire PDF including DSS
- Written as third incremental update

### Phase 5: Verification

Verify existing signatures.

**Components:**

- Signature dictionary parsing
- ByteRange extraction and hash computation
- CMS signature verification
- Certificate chain validation
- Timestamp verification
- Revocation checking (OCSP/CRL)
- Modification detection and categorization

**API:**

```typescript
const results = await pdf.verifySignatures();
// Returns array of SignatureVerificationResult
```

---

## Error Handling

All errors throw. No graceful degradation or fallback behavior.

| Scenario                     | Behavior                                                                |
| ---------------------------- | ----------------------------------------------------------------------- |
| Placeholder too small        | Throw `SignatureError` with details on required vs available size       |
| TSA unavailable              | Throw `TimestampError` - signing fails entirely                         |
| OCSP/CRL fetch fails         | Throw `RevocationError` - B-LT/B-LTA signing fails                      |
| Certificate chain incomplete | Attempt AIA chain building; throw `CertificateChainError` if that fails |
| AIA fetch fails              | Throw `CertificateChainError`                                           |
| Invalid P12 password         | Throw `SignerError`                                                     |
| MDP violation                | Warn but proceed (see Certification Signatures section)                 |

Error types inherit from base `SignatureError`:

```typescript
class SignatureError extends Error {
  code: string;
}

class TimestampError extends SignatureError {}
class RevocationError extends SignatureError {}
class CertificateChainError extends SignatureError {}
class SignerError extends SignatureError {}
class PlaceholderError extends SignatureError {}
```

---

## Signature Field Handling

### Field Selection Logic

When `pdf.sign()` is called:

1. If `fieldName` provided:
   - If field exists and is unsigned → use it
   - If field exists and is signed → throw error
   - If field doesn't exist → create it with that name

2. If `fieldName` not provided:
   - Look for first empty (unsigned) signature field in document
   - If found → use it
   - If none found → create new field with auto-generated name

### Auto-generated Field Names

Pattern: `Signature_{n}` where `n` is the next available number.

Examples: `Signature_1`, `Signature_2`, etc.

### Widget Annotation Placement

For new signature fields without explicit `appearance`:

- Create widget with `Rect [0 0 0 0]` on page 1
- This creates an invisible signature (no visual representation)
- For visible signatures, user must provide `appearance` option (separate plan)

---

## Certificate Chain Handling

### Chain Building

For B-LT and B-LTA, the complete certificate chain is required to fetch revocation data for each certificate.

If `signer.certificateChain` is incomplete or missing:

1. Parse the signing certificate's Authority Information Access (AIA) extension
2. Download missing intermediate certificates from AIA URLs
3. Repeat for each intermediate until root or self-signed cert is found
4. If any AIA fetch fails → throw `CertificateChainError`

### Chain Embedding

All certificates (signer + chain) are embedded in:

- The CMS SignedData structure
- The DSS dictionary (for B-LT+)

---

## Verification API

### Result Structure

```typescript
type VerificationStatus = "valid" | "invalid" | "indeterminate";

interface CheckResult {
  status: VerificationStatus;
  message?: string; // Human-readable explanation
  details?: unknown; // Additional structured data
}

interface SignatureVerificationResult {
  /** Signature field name */
  fieldName: string;

  /** Overall status */
  overallStatus: VerificationStatus;

  /** Individual check results */
  checks: {
    /** Does the hash match the signed bytes? */
    integrityCheck: CheckResult;

    /** Is the certificate valid and trusted? */
    certificateCheck: CheckResult;

    /** Is the timestamp valid (if present)? */
    timestampCheck: CheckResult;

    /** Is revocation data available and certificate not revoked? */
    revocationCheck: CheckResult;
  };

  /** Signing time (from timestamp if available, otherwise claimed time) */
  signingTime?: Date;

  /** Signer's common name from certificate */
  signerName?: string;

  /** Reason stated in signature */
  reason?: string;
}
```

### Overall Status Logic

- `valid`: All checks pass
- `invalid`: Integrity check fails (hash mismatch) OR certificate is revoked
- `indeterminate`: Integrity OK but certificate not trusted, expired, or revocation unknown

### Modification Detection

Modifications after signing are categorized:

```typescript
type ModificationCategory =
  | "none" // No changes after this signature
  | "allowed_only" // Only allowed changes (new signatures, DSS, permitted annotations)
  | "disallowed_detected"; // Page content, form values, or other disallowed changes

interface SignatureVerificationResult {
  // ... other fields ...

  /** What was modified after this signature */
  modificationsAfterSigning: ModificationCategory;
}
```

Categorization logic:

- Parse incremental updates after the signature
- "Allowed" changes: new signature fields, DSS dictionary, annotations (if permitted by DocMDP)
- "Disallowed" changes: page content streams, form field values, document structure

---

## Certification Signatures (DocMDP)

### Background

PDF supports two signature types:

- **Approval signatures**: Multiple allowed, just attest to document
- **Certification signature**: First signature, sets modification permissions

Certification signatures include a DocMDP transform with permission level:

- P=1: No changes allowed
- P=2: Form fill-in and signing allowed
- P=3: Form fill-in, signing, and annotations allowed

### Behavior

When signing a document with an existing certification signature:

1. Check certification signature's DocMDP permission level
2. If our signature would violate it (e.g., P=1 means no changes at all):
   - Emit a warning
   - Proceed with signing anyway
3. Return warnings to caller

```typescript
interface SignResult {
  bytes: Uint8Array;
  warnings: SignWarning[];
}

interface SignWarning {
  code: "MDP_VIOLATION" | string;
  message: string;
}

// Usage
const { bytes, warnings } = await pdf.sign({ signer, ... });
if (warnings.length > 0) {
  console.warn("Signing warnings:", warnings);
}
```

**Rationale**: User may legitimately need to add signatures to locked documents (e.g., compliance requirements). The existing certification signature's validation will show "disallowed modifications" but our approval signature is still cryptographically valid. User takes responsibility for understanding implications.

---

## Existing Signatures Compatibility

When loading a PDF with existing signatures and adding a new one:

- **Preserve bytes exactly** - Incremental update appends after existing content
- **Don't parse or validate existing signatures** - Not our responsibility during signing
- **Don't modify existing bytes** - Ensures prior signatures remain valid

This means:

- We can sign documents with signatures in unknown/legacy formats
- We don't guarantee existing signatures are valid
- Users should verify existing signatures separately if needed

---

## Placeholder Mechanism

The core challenge: signature bytes must be in the PDF, but we sign the PDF bytes.

### Solution

1. **Reserve space** with padded placeholders:

   ```
   /ByteRange [0 /********** /********** /**********]
   /Contents <0000...0000>  % 12KB of zeros
   ```

2. **Write complete PDF** to buffer

3. **Locate placeholders** - scan for byte positions

4. **Patch ByteRange** with actual values (space-padded):

   ```
   /ByteRange [0 1234       5678       9012      ]
   ```

5. **Hash signed ranges** - bytes 0-1233 and 5678-14689

6. **Create CMS** - sign the hash, build SignedData

7. **Patch Contents** - hex-encode CMS, write to placeholder

### Placeholder Size

Default 12KB. Must accommodate:

- CMS structure overhead (~100 bytes)
- Signing certificate (~1-2KB)
- Certificate chain (~2-6KB)
- Signature value (~256-512 bytes)
- Timestamp token (~3-5KB for B-T)

If CMS exceeds placeholder, throw `PlaceholderError` with details on required size.

---

## CMS Structure

Using pkijs for CMS generation:

```typescript
// Simplified - actual implementation uses pkijs classes
const signedData = new SignedData({
  version: 1,
  digestAlgorithms: [{ algorithm: "SHA-256" }],
  encapContentInfo: { eContentType: "1.2.840.113549.1.7.1" }, // empty for detached
  certificates: [signerCert, ...chain],
  signerInfos: [{
    version: 1,
    sid: { issuerAndSerialNumber: { ... } },
    digestAlgorithm: { algorithm: "SHA-256" },
    signedAttrs: [
      { type: "contentType", value: "1.2.840.113549.1.7.1" },
      { type: "messageDigest", value: documentHash },
      { type: "signingTime", value: signingTime },
      // For CAdES: ESS signing-certificate-v2 attribute
    ],
    signatureAlgorithm: { algorithm: "rsaEncryption" }, // or ecdsaWithSHA256
    signature: signatureBytes,
    unsignedAttrs: [
      // Timestamp token goes here for B-T
    ],
  }],
});
```

---

## DSS Dictionary Structure

For B-LT and B-LTA, added as incremental update:

```
Catalog
  /DSS <<
    /Type /DSS
    /Certs [1 0 R 2 0 R ...]     % All certificates as streams
    /OCSPs [3 0 R 4 0 R ...]     % OCSP responses as streams
    /CRLs [5 0 R ...]            % CRLs as streams
    /VRI <<
      /ABC123... <<              % SHA-1 hash of /Contents value (uppercase hex)
        /Cert [1 0 R]            % Certs for this signature
        /OCSP [3 0 R]            % OCSP for this signature
        /TU (D:20250104...)      % Timestamp of validation data
      >>
    >>
  >>
```

---

## Built-in Signers

### P12Signer

Signs using PKCS#12 file (contains private key + certificate):

```typescript
class P12Signer implements Signer {
  /**
   * Create a signer from a PKCS#12 file.
   * @param p12Bytes - The .p12/.pfx file contents
   * @param password - Password to decrypt the file
   */
  static async create(p12Bytes: Uint8Array, password?: string = ""): Promise<P12Signer>;

  readonly certificate: Uint8Array;
  readonly certificateChain: Uint8Array[];
  readonly keyType: KeyType;
  readonly signatureAlgorithm: SignatureAlgorithm;

  sign(digest: Uint8Array, algorithm: DigestAlgorithm): Promise<Uint8Array>;
}
```

Password is kept in memory as a string. Users should clear references to the P12Signer when done if password security is a concern.

Uses pkijs for PKCS#12 parsing, Web Crypto API for signing.

### CryptoKeySigner

Signs using Web Crypto CryptoKey:

```typescript
class CryptoKeySigner implements Signer {
  constructor(
    privateKey: CryptoKey,
    certificate: Uint8Array,
    keyType: KeyType,
    signatureAlgorithm: SignatureAlgorithm,
    certificateChain?: Uint8Array[],
  );
}
```

---

## Built-in Timestamp Authority

### HttpTimestampAuthority

```typescript
class HttpTimestampAuthority implements TimestampAuthority {
  /**
   * Create a TSA client.
   * @param url - TSA endpoint URL
   * @param options - Optional configuration
   */
  constructor(
    url: string,
    options?: {
      /** Custom headers (e.g., Authorization) */
      headers?: Record<string, string>;
      /** Request timeout in ms (default: 30000) */
      timeout?: number;
      /** Custom fetch implementation for advanced auth/middleware */
      fetch?: typeof fetch;
    },
  );

  timestamp(digest: Uint8Array, algorithm: DigestAlgorithm): Promise<Uint8Array>;
}
```

**Authentication**: For TSAs requiring authentication, either:

1. Pass headers directly: `{ headers: { "Authorization": "Bearer token" } }`
2. Provide custom fetch with auth middleware: `{ fetch: myAuthenticatedFetch }`

---

## Re-timestamping (Experimental)

For maintaining B-LTA signatures over time, documents need periodic re-timestamping before algorithms weaken.

```typescript
/**
 * Add a document timestamp to an existing signed PDF.
 * This extends the archival lifetime of existing signatures.
 *
 * @experimental This API may change in future versions.
 */
async addDocumentTimestamp(options: {
  timestampAuthority: TimestampAuthority;
  digestAlgorithm?: DigestAlgorithm;
}): Promise<{ bytes: Uint8Array; warnings: SignWarning[] }>;
```

Usage:

```typescript
const pdf = await PDF.load(existingSignedBytes);
const { bytes } = await pdf.addDocumentTimestamp({
  timestampAuthority: new HttpTimestampAuthority("http://tsa.example.com"),
});
```

This creates a new incremental update with a document timestamp signature (`/SubFilter /ETSI.RFC3161`) that covers the entire document including all previous signatures and DSS data.

---

## Test Strategy

### Unit Tests

- Placeholder byte position calculation
- ByteRange patching
- CMS structure generation
- DSS dictionary construction
- AIA URL extraction from certificates
- Modification categorization logic

### Integration Tests

- Sign PDF and verify with external tool (pdfsig, Adobe)
- Round-trip: sign, verify, check ByteRange correctness
- Multiple signatures preservation
- B-B through B-LTA level compliance
- AIA chain building with mock server
- TSA integration with mock server

### Test Fixtures

- Self-signed test certificate (for unit tests)
- Test certificate with AIA extension
- Test TSA endpoint (mock)
- PDFs with existing signatures (for verification tests)
- PDFs with certification signatures (DocMDP tests)

---

## Open Questions (Resolved)

| Question                 | Decision                                                         |
| ------------------------ | ---------------------------------------------------------------- |
| pkijs vs minimal custom  | Use pkijs. CMS is complex, correctness matters.                  |
| Algorithm support        | SHA-256, SHA-384, SHA-512. Default SHA-256.                      |
| Key types                | RSA and ECDSA. Both common.                                      |
| Visible signatures       | Separate plan. This plan is cryptographic only.                  |
| Default subFilter        | CAdES. Modern standard, required for PAdES.                      |
| Key type discovery       | Signer interface has `keyType` and `signatureAlgorithm` getters. |
| Error handling           | Fail fast, throw on all errors.                                  |
| Certificate chain        | AIA chain building, throw if fetch fails.                        |
| Field creation           | Smart handling with auto-generated names.                        |
| Modification detection   | Categorize as none/allowed/disallowed.                           |
| TSA authentication       | Headers option + custom fetch option.                            |
| P12 password             | Simple string, document security implications.                   |
| Bundle size              | Accept ~200KB, no code splitting.                                |
| Signing time             | Configurable via option, defaults to system clock.               |
| Existing signatures      | Preserve bytes exactly, don't parse/validate.                    |
| Widget placement         | Zero-size on page 1 for invisible signatures.                    |
| Certification signatures | Warn but proceed on MDP violation.                               |
| Re-timestamping          | Include as experimental API.                                     |

---

## References

- PDF 1.7 Specification, Chapter 12.8 (Digital Signatures)
- PDF 2.0 Specification (DocMDP updates)
- ETSI EN 319 142-1 (PAdES)
- RFC 5652 (CMS)
- RFC 3161 (TSP)
- RFC 6960 (OCSP)
- PDFBox: `pdfbox/src/main/java/org/apache/pdfbox/pdmodel/interactive/digitalsignature/`
- node-signpdf source
