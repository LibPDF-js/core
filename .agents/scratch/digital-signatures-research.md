# Digital Signatures Research

This document captures research and design considerations for implementing digital signatures in @libpdf/core.

## Overview

Digital signatures in PDF are complex because they require:

1. **Full document knowledge** before signing - you need to know the exact byte positions
2. **Cryptographic operations** that may happen externally (HSM, cloud, smart cards)
3. **Incremental updates** to preserve existing signatures
4. **Long-term validation** data for archival purposes

---

## The Signature Process

### The Chicken-and-Egg Problem

PDF signatures sign specific byte ranges, but the signature itself must be embedded in the PDF at a known position. This creates a circular dependency:

```
PDF Document:
[Header + Objects + ...]  [Signature Dictionary]  [More Objects + XRef + Trailer]
        ^                         ^                         ^
        |                         |                         |
    Signed bytes           NOT signed              Signed bytes
                    (contains signature value)
```

The signature dictionary looks like:

```
<<
  /Type /Sig
  /Filter /Adobe.PPKLite
  /SubFilter /adbe.pkcs7.detached
  /ByteRange [0 10000 12000 5000]   % Signed ranges
  /Contents <...hex signature...>    % PKCS#7/CMS signature
  /Name (John Doe)
  /M (D:20250104120000Z)
  /Reason (I approve this document)
>>
```

The `/ByteRange` array `[0 10000 12000 5000]` means:

- Sign bytes 0-9999 (before /Contents)
- Sign bytes 12000-16999 (after /Contents)
- Skip bytes 10000-11999 (the /Contents value itself)

### The Placeholder Solution

Every library uses the same approach:

1. **Reserve space** with placeholder values:

   ```
   /ByteRange [0 /********** /********** /**********]
   /Contents <0000...0000>  % e.g., 10KB of zeros
   ```

2. **Write the complete PDF** including placeholders

3. **Calculate actual ByteRange** now that we know exact byte positions

4. **Overwrite placeholders** in-place:
   - Replace `/ByteRange` placeholder with actual numbers (padded with spaces)
   - Leave `/Contents` as zeros for now

5. **Hash the signed byte ranges** (everything except /Contents value)

6. **Create CMS/PKCS#7 signature** from the hash

7. **Inject signature** into the `/Contents` placeholder (hex-encoded)

**Critical**: The placeholder must be large enough! PDFBox defaults to ~9.5KB. If the CMS signature (with certificate chain, timestamps, etc.) exceeds this, signing fails.

---

## External Signing Architecture

### The Problem

Modern signing often happens externally:

- **HSM (Hardware Security Module)**: Keys never leave secure hardware
- **Cloud signing services**: Azure Key Vault, AWS KMS, Google Cloud HSM
- **Smart cards**: User's key is on a smart card/USB token
- **Remote signing services**: Third-party signing APIs

These services typically:

1. Receive a **hash/digest** of the data to sign
2. Return the **raw signature bytes** (not a complete CMS envelope)

### PDFBox's Two-Level Abstraction

PDFBox provides two interfaces:

#### Level 1: `SignatureInterface` (Synchronous, In-Process)

```java
public interface SignatureInterface {
    byte[] sign(InputStream content) throws IOException;
}
```

- Called synchronously during save
- Receives the complete byte range data as a stream
- Must return complete CMS signature bytes
- Good for: local keystores, PKCS#11 providers

```java
// Example implementation
class MySignature implements SignatureInterface {
    @Override
    public byte[] sign(InputStream content) {
        byte[] hash = hash(content);
        CMSSignedData cms = createCMS(hash, privateKey, certificate);
        return cms.getEncoded();
    }
}

doc.addSignature(signature, new MySignature(), options);
doc.saveIncremental(output);
```

#### Level 2: `ExternalSigningSupport` (Async, Out-of-Process)

```java
public interface ExternalSigningSupport {
    InputStream getContent() throws IOException;
    void setSignature(byte[] signature) throws IOException;
}
```

- Decouples PDF preparation from signing
- PDF is written first with zeros in /Contents
- Caller can hash, send to external service, wait
- Signature is then injected at exact byte offset

```java
doc.addSignature(signature);  // No signer interface
ExternalSigningSupport ess = doc.saveIncrementalForExternalSigning(output);

// Get bytes to sign
InputStream toSign = ess.getContent();
byte[] hash = hash(toSign);

// Send to external service (could be async, could take time)
byte[] signature = externalService.sign(hash);

// Inject signature
ess.setSignature(signature);
```

### node-signpdf Approach

The node-signpdf library takes a simpler approach:

1. **Placeholder addition** is a separate step using pdf-lib or pdfkit
2. **Signing** is synchronous with a P12/PKCS#12 signer

```javascript
// Step 1: Add placeholder using pdf-lib
pdflibAddPlaceholder({ pdfDoc, reason, name, location });
const pdfWithPlaceholder = await pdfDoc.save();

// Step 2: Sign (synchronous)
const signer = new P12Signer(certificateBuffer);
const signedPdf = await signPdf.sign(pdfWithPlaceholder, signer);
```

The signing step:

1. Finds the placeholder in the PDF bytes
2. Calculates and updates ByteRange
3. Hashes the signed ranges
4. Creates CMS signature
5. Injects hex-encoded signature into placeholder

---

## CMS/PKCS#7 Signature Structure

The `/Contents` value is a CMS (Cryptographic Message Syntax) signed data structure:

```
SignedData ::= SEQUENCE {
  version INTEGER,
  digestAlgorithms SET OF DigestAlgorithmIdentifier,
  encapContentInfo EncapsulatedContentInfo,  -- empty for detached
  certificates [0] IMPLICIT CertificateSet OPTIONAL,  -- signer cert + chain
  crls [1] IMPLICIT RevocationInfoChoices OPTIONAL,
  signerInfos SET OF SignerInfo
}
```

For PDF:

- `encapContentInfo` is empty (detached signature)
- `certificates` contains the signing certificate and chain
- `signerInfos` contains the actual signature

Typical size: 3-8KB depending on:

- Certificate chain length
- Signature algorithm (RSA 2048 vs 4096)
- Whether timestamp is embedded

---

## SubFilter Types

The `/SubFilter` entry specifies the signature format:

| SubFilter             | Description                          | PAdES Level  |
| --------------------- | ------------------------------------ | ------------ |
| `adbe.x509.rsa_sha1`  | Legacy, SHA-1 (deprecated)           | -            |
| `adbe.pkcs7.detached` | Standard PKCS#7, any hash            | B-B          |
| `adbe.pkcs7.sha1`     | PKCS#7 with SHA-1 only (deprecated)  | -            |
| `ETSI.CAdES.detached` | CAdES format for PAdES               | B-B to B-LTA |
| `ETSI.RFC3161`        | Document timestamp (not a signature) | B-LTA        |

**Recommendation**: Use `ETSI.CAdES.detached` for PAdES compliance.

---

## PAdES Signature Levels

PAdES (PDF Advanced Electronic Signature) defines progressive levels:

### B-B (Basic)

- Base signature with signing certificate
- Valid only while certificate is valid
- Minimal implementation

### B-T (Timestamp)

- B-B + cryptographic timestamp from TSA
- Proves document existed at specific time
- Timestamp is embedded in CMS SignerInfo

### B-LT (Long-Term)

- B-T + validation data embedded in PDF
- DSS dictionary with certificates, OCSP, CRLs
- Can be validated offline, years later

### B-LTA (Long-Term Archival)

- B-LT + document timestamp
- Timestamp covers entire document including DSS
- Periodic re-timestamping for algorithm migration

```
Document Revision 1:
  └── Signature (B-B or B-T)

Document Revision 2 (incremental update):
  └── DSS dictionary (LT upgrade)
      ├── /Certs [all certificates]
      ├── /OCSPs [OCSP responses]
      ├── /CRLs [revocation lists]
      └── /VRI { <sigHash>: { ... per-signature data } }

Document Revision 3 (incremental update):
  └── Document Timestamp (LTA upgrade)
      └── /Type /DocTimeStamp
      └── /SubFilter /ETSI.RFC3161
```

---

## Document Security Store (DSS)

The DSS is a dictionary in the catalog for long-term validation:

```
Catalog
  └── /DSS <<
        /Type /DSS
        /Certs [stream stream stream ...]   % All certificates
        /OCSPs [stream stream stream ...]   % OCSP responses
        /CRLs [stream stream stream ...]    % Revocation lists
        /VRI <<
          /SHA1HASHOFCONTENTS <<            % Per-signature data
            /Cert [stream ...]
            /OCSP [stream ...]
            /CRL [stream ...]
            /TU (D:timestamp)
          >>
        >>
      >>
```

Key points:

- VRI keys are uppercase hex SHA-1 of the signature's /Contents value
- All streams are typically Flate-encoded
- Added as **incremental update** after the signature
- Must NOT modify the signed content

---

## Multiple Signatures

PDFs support multiple signatures, each in a separate incremental update:

```
Original PDF (unsigned)
%%EOF

Incremental Update 1 (Signature 1)
  - New signature field + widget
  - Signature dictionary with ByteRange covering original + update 1
%%EOF

Incremental Update 2 (Signature 2)
  - New signature field + widget
  - Signature dictionary with ByteRange covering original + update 1 + update 2
%%EOF

Incremental Update 3 (DSS for LTV)
  - DSS dictionary with validation data
%%EOF
```

**Critical rule**: Each signature must be in its own incremental update. Never add two signatures in the same update.

---

## Design Considerations for @libpdf/core

### 1. Signer Abstraction

We need an interface for signing that supports both sync and async use cases:

```typescript
interface PDFSigner {
  // Return complete CMS signature bytes
  sign(digest: Uint8Array, algorithm: string): Promise<Uint8Array>;

  // Return the signing certificate (for embedding in CMS)
  getCertificate(): Promise<Uint8Array>;

  // Return certificate chain (optional)
  getCertificateChain?(): Promise<Uint8Array[]>;
}
```

Or following PDFBox's two-level approach:

```typescript
// Level 1: In-process signer
interface SignatureProvider {
  sign(dataToSign: ReadableStream<Uint8Array>): Promise<Uint8Array>;
}

// Level 2: External signing
interface ExternalSigningSupport {
  getDataToSign(): ReadableStream<Uint8Array>;
  setSignature(cmsBytes: Uint8Array): Promise<void>;
}
```

### 2. Placeholder Size

- Default: 10KB (recommended minimum)
- Configurable per-signature
- Auto-sizing based on certificate chain would be nice but complex

### 3. Signing Workflow

Single unified approach - `sign()` returns bytes and seals the document:

```typescript
const signedBytes = await pdf.sign({
  signer: mySigner, // Any Signer implementation (local, HSM, cloud)
  reason: "I approve",
  level: "B-LTA", // Optional PAdES level shorthand
  timestampAuthority, // Required for B-T and above
});

// pdf is now sealed - cannot be modified
```

External signers (HSM, cloud, smart cards) just implement the `Signer` interface.
The `sign()` method is async, so remote calls are naturally supported.

### 4. CMS Generation

We need CMS/PKCS#7 generation. Options:

1. **Use existing library**: `pkijs`, `asn1js`
2. **Port from reference**: PDFBox uses BouncyCastle
3. **Build minimal**: Only what PDF needs (SignedData structure)

**Recommendation**: Use `pkijs` for CMS. It's well-maintained and handles ASN.1 complexity.

### 6. Timestamp Integration

For B-T and above:

- Need to call a TSA (Time Stamping Authority)
- TSP protocol is HTTP-based (RFC 3161)
- Timestamp token is embedded in CMS SignerInfo

```typescript
interface TimestampProvider {
  getTimestamp(digest: Uint8Array, algorithm: string): Promise<Uint8Array>;
}
```

### 7. LTV/DSS Support

For B-LT and B-LTA:

- OCSP client for fetching certificate status
- CRL fetching and parsing
- DSS dictionary construction
- Document timestamp application

This is significant additional work but critical for enterprise use cases.

### 8. Signature Verification

Separate but related to creation:

1. Parse signature dictionary
2. Extract ByteRange and Contents
3. Hash the signed byte ranges
4. Parse CMS structure
5. Verify signature against hash
6. Validate certificate chain
7. Check revocation status (OCSP/CRL)
8. Verify timestamps

---

## Implementation Phases

### Phase 1: Basic Signing (B-B)

- Placeholder mechanism (ByteRange, Contents)
- `SignatureProvider` interface
- CMS generation (using pkijs)
- P12/PKCS#12 signer (for testing)
- Basic signature field/widget creation

### Phase 2: Timestamps (B-T)

- TSA client implementation
- Timestamp embedding in CMS
- `TimestampProvider` interface

### Phase 3: Long-Term Validation (B-LT)

- DSS dictionary construction
- VRI entries for per-signature data
- OCSP client
- CRL fetching
- Certificate chain embedding

### Phase 4: Archival (B-LTA)

- Document timestamp signatures
- Re-timestamping workflow

### Phase 5: Verification

- Signature verification
- Certificate chain validation
- Revocation checking
- Timestamp verification

---

## Open Questions

1. **CMS library**: Use pkijs or build custom?
2. **Certificate handling**: Separate cert management API?
3. **OCSP/CRL caching**: How to handle for validation?
4. **Visible signatures**: How to handle signature appearance rendering?
5. **Multiple signatures**: How to handle signature field creation vs. reuse?
6. **Algorithm selection**: SHA-256 only or support SHA-384/512?
7. **Key types**: RSA only or also ECDSA?

---

## References

- PDF 1.7 Specification, Chapter 12.8 (Digital Signatures)
- ETSI EN 319 142-1 (PAdES)
- RFC 5652 (CMS)
- RFC 3161 (TSP)
- PDFBox source code (signing examples and implementation)
- node-signpdf source code

---

## Dependencies to Consider

| Library        | Purpose           | Size   | Notes                     |
| -------------- | ----------------- | ------ | ------------------------- |
| pkijs          | CMS/PKCS#7        | ~200KB | Full PKI support          |
| asn1js         | ASN.1 parsing     | ~100KB | Required by pkijs         |
| @peculiar/x509 | X.509 parsing     | ~150KB | Certificate handling      |
| node-forge     | Crypto primitives | ~500KB | Alternative to Web Crypto |

For minimal bundle size, consider:

- Web Crypto API for hashing and basic crypto
- pkijs/asn1js for CMS structure
- Custom minimal OCSP/TSP clients

---

## High-Level API Design

### Core Principle: Sign Returns Bytes

Signing **must** produce the final PDF bytes because:

1. Any modification after signing invalidates the signature
2. The signature covers specific byte ranges
3. Users shouldn't be able to accidentally break signatures

```typescript
// WRONG - allows post-signature modification
await pdf.sign(signer);
pdf.addPage(); // Oops! Signature is now invalid
await pdf.save();

// RIGHT - sign() returns final bytes, PDF instance is "sealed"
const signedBytes = await pdf.sign(signer);
// pdf is now read-only or discarded
```

### Signer Interface

```typescript
/**
 * A signer provides cryptographic signing capabilities.
 * Can be backed by local keys, PKCS#11, HSM, cloud services, etc.
 */
interface Signer {
  /**
   * The signing certificate (DER-encoded X.509)
   */
  certificate: Uint8Array;

  /**
   * Certificate chain (optional, for embedding in CMS)
   * Should be ordered: [intermediate1, intermediate2, ..., root]
   */
  certificateChain?: Uint8Array[];

  /**
   * Sign a digest and return raw signature bytes.
   * For RSA: PKCS#1 v1.5 or PSS signature
   * For ECDSA: DER-encoded (r, s) pair
   */
  sign(digest: Uint8Array, algorithm: DigestAlgorithm): Promise<Uint8Array>;
}

type DigestAlgorithm = "SHA-256" | "SHA-384" | "SHA-512";
```

### Timestamp Authority Interface

```typescript
/**
 * A timestamp authority provides RFC 3161 timestamps.
 */
interface TimestampAuthority {
  /**
   * Get a timestamp token for the given digest.
   * Returns the DER-encoded TimeStampToken.
   */
  timestamp(digest: Uint8Array, algorithm: DigestAlgorithm): Promise<Uint8Array>;
}

// Built-in HTTP TSA client
class HttpTimestampAuthority implements TimestampAuthority {
  constructor(
    url: string,
    options?: {
      timeout?: number;
      headers?: Record<string, string>;
    },
  );
}
```

### Revocation Data Provider Interface

```typescript
/**
 * Provides certificate revocation information for LTV.
 */
interface RevocationProvider {
  /**
   * Get OCSP response for a certificate.
   * Returns DER-encoded OCSPResponse or null if unavailable.
   */
  getOCSP?(cert: Uint8Array, issuer: Uint8Array): Promise<Uint8Array | null>;

  /**
   * Get CRL for a certificate.
   * Returns DER-encoded CRL or null if unavailable.
   */
  getCRL?(cert: Uint8Array): Promise<Uint8Array | null>;
}

// Built-in provider that fetches from URLs in certificates
class DefaultRevocationProvider implements RevocationProvider {
  constructor(options?: {
    preferOCSP?: boolean; // Try OCSP before CRL (default: true)
    timeout?: number;
  });
}
```

---

### Signing API

#### Basic Signing (B-B)

```typescript
import { PDF, P12Signer } from "@libpdf/core";

const pdf = await PDF.load(existingBytes);

// Fill form, add content, etc.
const form = await pdf.getForm();
form.fill({ name: "John Doe" });

// Sign and get final bytes
const signedBytes = await pdf.sign({
  signer: new P12Signer(p12Bytes, "password"),

  // Signature metadata
  reason: "I approve this document",
  location: "New York, NY",
  contactInfo: "john@example.com",

  // Optional: use existing signature field
  fieldName: "SignatureField1",

  // Optional: create visible signature
  appearance: {
    page: 0,
    rect: { x: 50, y: 50, width: 200, height: 50 },
    // Could include image, text template, etc.
  },
});

// signedBytes is the complete, signed PDF
await writeFile("signed.pdf", signedBytes);

// pdf is now "sealed" - further modifications throw
pdf.addPage(); // Error: Cannot modify signed document
```

#### With Timestamp (B-T)

```typescript
const signedBytes = await pdf.sign({
  signer: new P12Signer(p12Bytes, "password"),
  reason: "I approve this document",

  // Add timestamp
  timestampAuthority: new HttpTimestampAuthority("http://timestamp.digicert.com"),
});
```

#### Long-Term Validation (B-LT)

```typescript
const signedBytes = await pdf.sign({
  signer: new P12Signer(p12Bytes, "password"),
  reason: "I approve this document",

  timestampAuthority: new HttpTimestampAuthority("http://timestamp.digicert.com"),

  // Embed validation data (OCSP/CRL)
  longTermValidation: true,
  // Or provide custom revocation provider
  revocationProvider: new DefaultRevocationProvider(),
});
```

#### Long-Term Archival (B-LTA)

```typescript
const signedBytes = await pdf.sign({
  signer: new P12Signer(p12Bytes, "password"),
  reason: "I approve this document",

  timestampAuthority: new HttpTimestampAuthority("http://timestamp.digicert.com"),

  longTermValidation: true,

  // Add document timestamp for archival
  archivalTimestamp: true,
});
```

#### Convenience: PAdES Levels

```typescript
// Shorthand for common configurations
const signedBytes = await pdf.sign({
  signer: mySigner,
  level: "B-LTA", // Implies timestamp + LTV + doc timestamp
  timestampAuthority: myTSA,
});

// Equivalent to:
const signedBytes = await pdf.sign({
  signer: mySigner,
  timestampAuthority: myTSA,
  longTermValidation: true,
  archivalTimestamp: true,
});
```

---

### External/HSM/Cloud Signing

The `Signer` interface is async, so external services are just another implementation:

```typescript
class AzureKeyVaultSigner implements Signer {
  readonly certificate: Uint8Array;
  readonly certificateChain: Uint8Array[];

  private client: KeyVaultClient;
  private keyName: string;

  private constructor(
    client: KeyVaultClient,
    keyName: string,
    certificate: Uint8Array,
    certificateChain: Uint8Array[],
  ) {
    this.client = client;
    this.keyName = keyName;
    this.certificate = certificate;
    this.certificateChain = certificateChain;
  }

  static async create(vaultUrl: string, keyName: string): Promise<AzureKeyVaultSigner> {
    const client = new KeyVaultClient(vaultUrl, new DefaultAzureCredential());
    const cert = await client.getCertificate(keyName);
    const chain = await client.getCertificateChain(keyName);
    return new AzureKeyVaultSigner(client, keyName, cert, chain);
  }

  async sign(digest: Uint8Array, algorithm: DigestAlgorithm): Promise<Uint8Array> {
    // Call Azure Key Vault to sign the digest
    const result = await this.client.sign(this.keyName, algorithm, digest);
    return result.signature;
  }
}

// Usage is identical to local signing
const signer = await AzureKeyVaultSigner.create(
  "https://my-vault.vault.azure.net",
  "my-signing-key",
);

const signedBytes = await pdf.sign({
  signer,
  reason: "Approved",
  level: "B-LTA",
  timestampAuthority: myTSA,
});
```

No special "external signing" API needed - the same `pdf.sign()` works for everything.

---

### Multiple Signatures

Each signature requires a separate incremental update:

```typescript
// First signer
let pdfBytes = await pdf.sign({
  signer: signer1,
  reason: "Author approval",
  fieldName: "AuthorSignature",
});

// Second signer (load the signed PDF, add another signature)
const pdf2 = await PDF.load(pdfBytes);
pdfBytes = await pdf2.sign({
  signer: signer2,
  reason: "Manager approval",
  fieldName: "ManagerSignature",
});

// Third signer
const pdf3 = await PDF.load(pdfBytes);
pdfBytes = await pdf3.sign({
  signer: signer3,
  reason: "Final approval",
  fieldName: "FinalSignature",
});
```

---

### Upgrading Existing Signatures

Upgrade a B-B or B-T signature to B-LT or B-LTA:

```typescript
const pdf = await PDF.load(signedBytes);

// Add LTV data for existing signatures
const upgradedBytes = await pdf.addValidationData({
  revocationProvider: new DefaultRevocationProvider(),
});

// Or add archival timestamp
const archivedBytes = await pdf.addDocumentTimestamp({
  timestampAuthority: myTSA,
});
```

---

### Complete Type Definitions

```typescript
interface SignOptions {
  /** The signer providing certificate and signing capability */
  signer: Signer;

  /** Reason for signing */
  reason?: string;

  /** Location where signing occurred */
  location?: string;

  /** Contact information */
  contactInfo?: string;

  /** Name of existing signature field, or name for new field */
  fieldName?: string;

  /** Visible signature appearance */
  appearance?: SignatureAppearance;

  /** PAdES conformance level (convenience) */
  level?: "B-B" | "B-T" | "B-LT" | "B-LTA";

  /** Timestamp authority for B-T and above */
  timestampAuthority?: TimestampAuthority;

  /** Enable long-term validation data embedding */
  longTermValidation?: boolean;

  /** Provider for OCSP/CRL data */
  revocationProvider?: RevocationProvider;

  /** Add document timestamp for archival (B-LTA) */
  archivalTimestamp?: boolean;

  /** Digest algorithm (default: SHA-256) */
  digestAlgorithm?: DigestAlgorithm;

  /** Size to reserve for signature (default: 12KB) */
  estimatedSize?: number;
}

interface SignatureAppearance {
  /** Page index (0-based) */
  page: number;

  /** Rectangle for signature widget */
  rect: { x: number; y: number; width: number; height: number };

  /** Optional background image */
  image?: Uint8Array;

  /** Text to display (can include placeholders like {name}, {date}) */
  text?: string;
}
```

---

### Built-in Signers

```typescript
/** Signs using a PKCS#12 (.p12/.pfx) file */
class P12Signer implements Signer {
  constructor(p12Bytes: Uint8Array, password: string);

  readonly certificate: Uint8Array;
  readonly certificateChain: Uint8Array[];

  sign(digest: Uint8Array, algorithm: DigestAlgorithm): Promise<Uint8Array>;
}

/** Signs using Web Crypto API with provided key/cert */
class CryptoKeySigner implements Signer {
  constructor(privateKey: CryptoKey, certificate: Uint8Array, certificateChain?: Uint8Array[]);
}
```

---

### What Happens Internally

When you call `pdf.sign()`:

```
1. Validate options, resolve PAdES level
2. Create/find signature field and widget annotation
3. Create signature dictionary with placeholders:
   /ByteRange [0 /********** /********** /**********]
   /Contents <0000...0000>
4. Write incremental update to buffer
5. Calculate actual ByteRange values
6. Patch ByteRange in buffer
7. Hash the signed byte ranges
8. Create CMS structure:
   - If B-T+: get timestamp for signature
   - If B-LT+: fetch OCSP/CRL data
   - Build SignedData with certs, signature, timestamps
9. Patch Contents in buffer with hex-encoded CMS
10. If B-LT+: add DSS dictionary (another incremental update)
11. If B-LTA: add document timestamp (another incremental update)
12. Return final bytes
13. Mark PDF instance as sealed
```

### Incremental Updates Structure

For B-LTA, the final PDF looks like:

```
[Original PDF content]
%%EOF

[Incremental Update 1: Signature]
  - Signature field
  - Widget annotation
  - Signature dictionary (with CMS containing timestamp)
%%EOF

[Incremental Update 2: DSS/LTV data]
  - DSS dictionary in catalog
  - Certificate streams
  - OCSP response streams
  - VRI entries
%%EOF

[Incremental Update 3: Document Timestamp]
  - DocTimeStamp signature dictionary
  - Widget annotation (invisible)
%%EOF
```
