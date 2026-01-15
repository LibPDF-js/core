# PDF Encryption Specification

This document specifies how @libpdf/core handles encrypted PDFs, including decryption during parsing, encryption during writing, and permission management.

---

## Usage Examples

### Opening an Encrypted PDF

```typescript
import { DocumentParser } from "@libpdf/core/parser/document-parser";
import { Scanner } from "@libpdf/core/io/scanner";

const scanner = new Scanner(pdfBytes);
const parser = new DocumentParser(scanner);

// With password (string shorthand)
const doc = await parser.parse({ credentials: "secret" });

// With explicit credential type
const doc = await parser.parse({
  credentials: { type: "password", password: "secret" },
});

// Check if we have full access
if (doc.encryption?.isOwnerAuth) {
  console.log("Opened with owner password - full access");
}
```

### Checking Encryption Before Opening

```typescript
// Attempt without credentials first
try {
  const doc = await parser.parse();
  // Document wasn't encrypted, or opened with empty password
} catch (error) {
  if (error instanceof EncryptionError && error.code === "NEED_CREDENTIALS") {
    // Prompt user for password, then retry
    const password = await promptPassword();
    const doc = await parser.parse({ credentials: password });
  }
}
```

### Checking Permissions

```typescript
const doc = await parser.parse({ credentials: "..." });

// All permission flags are available
if (doc.permissions.print) {
  console.log("Printing allowed");
}

if (doc.permissions.copy) {
  console.log("Copy/paste allowed");
}

if (!doc.permissions.modify && !doc.encryption?.isOwnerAuth) {
  console.log("Document is read-only");
}
```

### Handling Wrong Password

```typescript
try {
  const doc = await parser.parse({ credentials: "wrong" });
} catch (error) {
  if (error instanceof EncryptionError) {
    switch (error.code) {
      case "NEED_CREDENTIALS":
        console.log("Document is encrypted, password required");
        break;
      case "INVALID_CREDENTIALS":
        console.log("Wrong password");
        break;
      case "UNSUPPORTED_ENCRYPTION":
        console.log("Encryption method not supported");
        break;
    }
  }
}
```

### Future: High-Level API

```typescript
import { PDF } from "@libpdf/core";

// Load with password
const pdf = await PDF.load(bytes, { credentials: "secret" });

// Check encryption
console.log(pdf.isEncrypted); // true
console.log(pdf.encryption?.revision); // 6
console.log(pdf.permissions.print); // true

// Remove encryption (requires owner access)
pdf.removeProtection();
await pdf.save();

// Add encryption to unprotected PDF
pdf.setProtection({
  userPassword: "user123",
  ownerPassword: "owner456",
  permissions: {
    print: true,
    copy: false,
    modify: false,
    annotate: true,
    fillForms: true,
  },
});
await pdf.save();
```

---

## Overview

PDF encryption protects document content using symmetric encryption (RC4 or AES) with keys derived from passwords or public key certificates. The encryption system has evolved through 6 revisions:

| Revision | PDF Version | Algorithm      | Key Length | Notes               |
| -------- | ----------- | -------------- | ---------- | ------------------- |
| 2        | 1.3         | RC4            | 40-bit     | Legacy, weak        |
| 3        | 1.4         | RC4            | 40-128 bit | Variable key length |
| 4        | 1.5         | RC4 or AES-128 | 128-bit    | Crypt filters       |
| 5        | 1.7 ext 3   | AES-256        | 256-bit    | PDF 2.0 draft       |
| 6        | 2.0         | AES-256        | 256-bit    | PDF 2.0 final       |

---

## Security Handlers

### Standard Security Handler (`/Filter /Standard`)

Password-based encryption with two password tiers:

| Password           | Purpose       | Grants                                     |
| ------------------ | ------------- | ------------------------------------------ |
| **User Password**  | Open document | Limited by permission flags                |
| **Owner Password** | Full access   | All permissions, can recover user password |

A document can have:

- Both passwords (common)
- Only owner password (document opens without password but has restrictions)
- Only user password (rare, non-standard)

### Public Key Security Handler (`/Filter /Adobe.PubSec`)

Certificate-based encryption for enterprise use:

- Recipients specified by X.509 certificates
- Per-recipient permissions possible
- Uses PKCS#7 enveloped data

**Scope**: We'll implement Standard handler first. Public key handler is a future enhancement.

---

## Encryption Dictionary

Located in trailer at `/Encrypt`. Key entries:

```
<<
  /Filter /Standard           % Security handler
  /V 4                        % Algorithm version (1-5)
  /R 4                        % Revision (2-6)
  /Length 128                 % Key length in bits
  /O <hex string>             % Owner password hash
  /U <hex string>             % User password hash
  /P -3904                    % Permission flags (signed 32-bit)
  /EncryptMetadata true       % Whether metadata is encrypted

  % Crypt Filters (V4+)
  /CF <<
    /StdCF << /CFM /AESV2 /Length 16 >>
  >>
  /StmF /StdCF                % Stream filter
  /StrF /StdCF                % String filter
  /EFF /StdCF                 % Embedded file filter
>>
```

For R6 (AES-256), additional entries:

```
  /OE <32 bytes>              % Owner encryption key
  /UE <32 bytes>              % User encryption key
  /Perms <16 bytes>           % Encrypted permissions
```

---

## Permission Flags

Stored in `/P` as a signed 32-bit integer. Bits 1-2 must be 0, bits 7-8 must be 1.

| Bit | Flag                 | Description                   |
| --- | -------------------- | ----------------------------- |
| 3   | `PRINT`              | Print the document            |
| 4   | `MODIFY`             | Modify document contents      |
| 5   | `COPY`               | Copy or extract text/graphics |
| 6   | `ANNOTATE`           | Add or modify annotations     |
| 9   | `FILL_FORMS`         | Fill in form fields           |
| 10  | `ACCESSIBILITY`      | Extract for accessibility     |
| 11  | `ASSEMBLE`           | Insert, delete, rotate pages  |
| 12  | `PRINT_HIGH_QUALITY` | Print at full resolution      |

**Default behavior**: If encrypted with only owner password (empty user password), document opens but respects permission flags.

---

## Algorithms

### Key Derivation

**R2-R4 (MD5-based)**:

```
1. Pad password to 32 bytes using standard padding
2. Concatenate: padded_password + O + P + file_id[0]
3. MD5 hash the result
4. For R3+: Repeat MD5 hash 50 times
5. Truncate to key length
```

**R5-R6 (SHA-based)**:

```
1. UTF-8 encode password (truncate to 127 bytes)
2. Hash: SHA-256(password + validation_salt + user_key)
3. For R6: Use iterative algorithm 2.B with SHA-256/384/512
4. Key is stored encrypted in /UE or /OE
```

### Object Encryption

Each object gets a unique key derived from the document key:

**R2-R4**:

```
object_key = MD5(doc_key + object_number + generation + "sAlT")
truncate to min(doc_key_length + 5, 16) bytes
```

**R5-R6**:

```
object_key = doc_key (no per-object derivation)
```

### Ciphers

**RC4** (R2-R4):

- Stream cipher, XOR-based
- Same key encrypts and decrypts
- No IV needed

**AES-CBC** (R4-R6):

- 16-byte IV prepended to ciphertext
- PKCS#5 padding
- Separate encrypt/decrypt operations

---

## API Design

### Types

```typescript
/**
 * Credentials for decrypting a document.
 */
type DecryptionCredential =
  | { type: "password"; password: string }
  | { type: "certificate"; certificate: Uint8Array; privateKey: Uint8Array }; // Future

interface ParseOptions {
  lenient?: boolean;

  /**
   * Credentials for encrypted documents.
   *
   * Shorthand: A plain string is treated as { type: "password", password: string }
   */
  credentials?: DecryptionCredential | string;
}

interface ParsedDocument {
  // ... existing members ...

  /** Whether the document is encrypted */
  isEncrypted: boolean;

  /** Encryption details (if encrypted) */
  encryption?: EncryptionInfo;

  /** Document permissions (defaults to all-true if not encrypted) */
  permissions: Permissions;
}

interface EncryptionInfo {
  /** Security handler type */
  handler: "standard" | "publicKey";

  /** Security handler filter name (e.g., "Standard", "Adobe.PubSec") */
  filter: string;

  /** Algorithm version (1-5) */
  version: number;

  /** Revision (2-6) */
  revision: number;

  /** Key length in bits */
  keyLength: number;

  /** Whether opened with owner-level access (full permissions) */
  isOwnerAuth: boolean;

  /** Whether metadata is encrypted */
  encryptMetadata: boolean;
}

interface Permissions {
  print: boolean;
  printHighQuality: boolean;
  modify: boolean;
  copy: boolean;
  annotate: boolean;
  fillForms: boolean;
  accessibility: boolean;
  assemble: boolean;
}
```

### Errors

```typescript
class EncryptionError extends Error {
  code: "NEED_CREDENTIALS" | "INVALID_CREDENTIALS" | "UNSUPPORTED_ENCRYPTION";
}
```

| Code                     | When                                        |
| ------------------------ | ------------------------------------------- |
| `NEED_CREDENTIALS`       | Encrypted document, no credentials provided |
| `INVALID_CREDENTIALS`    | Wrong password or invalid certificate       |
| `UNSUPPORTED_ENCRYPTION` | Unknown handler or unsupported algorithm    |

---

## Architecture

### File Structure

```
src/security/
├── security-factory.ts       # createSecurityHandler factory
├── security-handler.ts       # Abstract base class
├── standard-handler.ts       # Password-based (R2-R6)
├── encryption-dict.ts        # Parse /Encrypt dictionary
├── permissions.ts            # Permission flags parsing
├── ciphers/
│   ├── rc4.ts                # RC4 stream cipher
│   └── aes.ts                # AES-CBC (128 and 256)
└── key-derivation/
    ├── md5-based.ts          # R2-R4 key derivation
    └── sha-based.ts          # R5-R6 key derivation
```

No barrel files — import directly from each module:

```typescript
import { createSecurityHandler } from "#src/security/security-factory";
import { RC4Cipher } from "#src/security/ciphers/rc4";
import { deriveKeyMD5 } from "#src/security/key-derivation/md5-based";
```

### Integration Points

**1. DocumentParser** — Detect encryption, create handler

After parsing the trailer:

```typescript
import { createSecurityHandler } from "#src/security/security-factory";

const encryptRef = trailer.getRef("Encrypt");
if (encryptRef) {
  const encryptDict = await getObject(encryptRef);
  this.securityHandler = createSecurityHandler(encryptDict, fileId, credentials);
}
```

**2. getObject()** — Pass handler for decryption

The security handler is captured in the closure and passed to IndirectObjectParser:

```typescript
const getObject = async (ref: PdfRef): Promise<PdfObject | null> => {
  const parser = new IndirectObjectParser(scanner, lengthResolver, securityHandler);
  // ...
};
```

**3. IndirectObjectParser** — Decrypt strings and streams

During parsing:

```typescript
// For strings
if (securityHandler && !securityHandler.isIdentity) {
  decryptedBytes = securityHandler.decryptString(rawBytes, objNum, genNum);
}

// For streams (before filter pipeline)
if (securityHandler && !securityHandler.isIdentity) {
  rawStreamData = securityHandler.decryptStream(rawStreamData, objNum, genNum);
}
```

**4. Special cases** — Things NOT to decrypt

- The `/Encrypt` dictionary itself (marked with `suppressEncryption`)
- XRef streams (their dictionary is the trailer)
- Signature `/Contents` (byte ranges must be preserved)
- Metadata when `/EncryptMetadata false`

### Data Flow

```
Encrypted PDF bytes
        │
        ▼
DocumentParser.parse({ credentials })
        │
        ├─► Parse trailer, find /Encrypt
        │
        ├─► createSecurityHandler(encryptDict, fileId, credentials)
        │       │
        │       ├─► Determine handler type from /Filter
        │       ├─► Validate credentials against /U or /O
        │       └─► Derive document encryption key
        │
        ▼
getObject(ref) with securityHandler in scope
        │
        ▼
IndirectObjectParser.parseObjectAt(offset)
        │
        ├─► Parse object structure (dict keys, arrays, etc.)
        │
        ├─► For each PdfString value:
        │       └─► handler.decryptString(bytes, objNum, genNum)
        │
        └─► For streams:
                ├─► handler.decryptStream(rawData, objNum, genNum)
                └─► FilterPipeline.decode(decryptedData, filters)
```

---

## Implementation Plan

### Phase 1: Detection & Permissions (read-only)

- [ ] Parse `/Encrypt` dictionary
- [ ] Parse permission flags from `/P`
- [ ] Add `isEncrypted`, `encryption`, `permissions` to ParsedDocument
- [ ] Throw `EncryptionError('NEED_CREDENTIALS')` for encrypted documents

### Phase 2: Standard Handler R2-R4 (RC4, AES-128)

- [ ] RC4 cipher implementation
- [ ] AES-128 CBC implementation
- [ ] MD5-based key derivation (Algorithm 2)
- [ ] Password validation against /U and /O
- [ ] Object-specific key derivation (Algorithm 1)
- [ ] Integrate decryption into IndirectObjectParser
- [ ] Handle `/EncryptMetadata` flag

### Phase 3: Standard Handler R5-R6 (AES-256)

- [ ] SHA-256/384/512 for key derivation
- [ ] R6 iterative algorithm (Algorithm 2.B)
- [ ] AES-256 CBC implementation
- [ ] `/Perms` validation

### Phase 4: Writing Encrypted Documents

- [ ] Encrypt strings during serialization
- [ ] Encrypt streams during serialization
- [ ] Generate `/Encrypt` dictionary
- [ ] Generate /O, /U, /OE, /UE, /Perms

### Phase 5: Public Key Handler (Future)

- [ ] PKCS#7 parsing
- [ ] Certificate/recipient handling
- [ ] Per-recipient permissions

---

## Test Fixtures Needed

```
fixtures/encryption/
├── rc4-40bit.pdf             # R2, 40-bit RC4
├── rc4-128bit.pdf            # R3, 128-bit RC4
├── aes-128.pdf               # R4, AES-128
├── aes-256-r5.pdf            # R5, AES-256
├── aes-256-r6.pdf            # R6, AES-256
├── owner-only.pdf            # Opens without password, has restrictions
├── user-only.pdf             # Requires password, no owner password
├── metadata-unencrypted.pdf  # /EncryptMetadata false
└── public-key.pdf            # Certificate-based (future)
```

Each fixture should have a known password documented (e.g., "test" or "password").

---

## Security Considerations

1. **Passwords in memory**: Clear password bytes after key derivation
2. **Timing attacks**: Use constant-time comparison for password validation
3. **Key storage**: Never serialize or log encryption keys
4. **RC4 weakness**: RC4 is cryptographically weak; we support it for compatibility only
5. **Empty password**: An empty string is a valid password (common for owner-only protection)

---

## References

- PDF 2.0 Specification (ISO 32000-2:2020), Chapter 7.6
- PDF 1.7 Specification, Section 7.6 (in `.docs/pdf-specification/pages.md` if available)
- pdf.js: `checkouts/pdfjs/src/core/crypto.js`
- PDFBox: `checkouts/pdfbox/pdfbox/src/main/java/org/apache/pdfbox/pdmodel/encryption/`
