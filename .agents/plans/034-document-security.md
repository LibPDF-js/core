# 034: Document Security API

## Problem Statement

PDF documents can be protected with encryption to control access and permissions. Currently, @libpdf/core can **load** encrypted documents (with password authentication), but lacks a high-level API for:

1. **Removing encryption** - Decrypting a document to create an unencrypted copy
2. **Adding encryption** - Protecting an unencrypted document with passwords
3. **Changing encryption** - Modifying passwords or permissions on an encrypted document
4. **Querying security state** - Accessing detailed encryption info and permissions

This plan defines a unified security API on the `PDF` class that mirrors the pattern of other high-level APIs (metadata, attachments, forms).

## Goals

1. Provide intuitive methods for adding, removing, and modifying document encryption
2. Expose encryption details and permissions through a clean, type-safe API
3. Support all standard encryption algorithms (RC4-40, RC4-128, AES-128, AES-256)
4. Enable permission-aware workflows (check before modify)
5. Maintain consistency with existing API patterns (metadata, attachments, etc.)

## Non-Goals

- Public key encryption (/Adobe.PubSec) - future enhancement
- JavaScript-based protection
- DRM integration
- Custom security handlers

## Dependencies

- Existing `StandardSecurityHandler` for key derivation and cipher operations
- Existing `EncryptionDict` parsing infrastructure
- Serializer must be enhanced to support encryption on write

---

## API Design

### Desired Usage

```typescript
import { PDF } from "@libpdf/core";

// ─────────────────────────────────────────────────────────────────────────────
// Loading encrypted documents (existing API)
// ─────────────────────────────────────────────────────────────────────────────

const pdf = await PDF.load(bytes, { credentials: "password" });

// ─────────────────────────────────────────────────────────────────────────────
// Querying security state
// ─────────────────────────────────────────────────────────────────────────────

// Basic checks (existing)
pdf.isEncrypted; // true
pdf.isAuthenticated; // true

// Detailed security info
const security = pdf.getSecurity();
// Returns: {
//   isEncrypted: true,
//   algorithm: "AES-256",
//   keyLength: 256,
//   revision: 6,
//   hasUserPassword: true,
//   hasOwnerPassword: true,
//   authenticatedAs: "owner",  // "user" | "owner" | null
//   permissions: { ... }
// }

// Permissions shorthand
const perms = pdf.getPermissions();
if (!perms.modify) {
  console.log("Document modifications restricted");
}

// Check if we have owner access (full permissions regardless of flags)
if (pdf.hasOwnerAccess()) {
  console.log("Full access - can do anything");
}

// ─────────────────────────────────────────────────────────────────────────────
// Removing encryption
// ─────────────────────────────────────────────────────────────────────────────

// Remove all protection (requires owner access or user access with modify permission)
pdf.removeProtection();

// Save unencrypted document
const unprotectedBytes = await pdf.save();

// ─────────────────────────────────────────────────────────────────────────────
// Adding encryption
// ─────────────────────────────────────────────────────────────────────────────

// Encrypt with defaults (AES-256, empty user password, random owner password)
pdf.setProtection({
  userPassword: "user123",
  ownerPassword: "owner456",
});

// With custom permissions
pdf.setProtection({
  userPassword: "secret",
  ownerPassword: "admin",
  permissions: {
    print: true,
    copy: false,
    modify: false,
    annotate: true,
    fillForms: true,
  },
});

// With specific algorithm (for compatibility)
pdf.setProtection({
  userPassword: "secret",
  algorithm: "AES-128", // "RC4-40" | "RC4-128" | "AES-128" | "AES-256"
});

// Owner-only protection (document opens without password but has restrictions)
pdf.setProtection({
  ownerPassword: "admin",
  permissions: {
    print: true,
    copy: false,
    modify: false,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Changing encryption
// ─────────────────────────────────────────────────────────────────────────────

// Change passwords (requires current owner password authentication)
pdf.setProtection({
  userPassword: "newUser",
  ownerPassword: "newOwner",
});

// Change permissions only (keeps current passwords)
pdf.setProtection({
  permissions: {
    print: false,
    copy: false,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Re-authentication
// ─────────────────────────────────────────────────────────────────────────────

// Try to authenticate with a different password (e.g., upgrade to owner access)
const result = pdf.authenticate("ownerPassword");
if (result.authenticated && result.isOwner) {
  console.log("Now have owner access");
}
```

---

## Types

```typescript
/**
 * Encryption algorithm options.
 *
 * - RC4-40: Legacy 40-bit RC4 (PDF 1.1+, weak, avoid)
 * - RC4-128: 128-bit RC4 (PDF 1.4+, deprecated)
 * - AES-128: 128-bit AES-CBC (PDF 1.5+, recommended minimum)
 * - AES-256: 256-bit AES-CBC (PDF 2.0, strongest, default)
 */
type EncryptionAlgorithm = "RC4-40" | "RC4-128" | "AES-128" | "AES-256";

/**
 * Document permissions that can be granted or restricted.
 *
 * All permissions default to true for unencrypted documents.
 * When encrypted, the owner password grants all permissions regardless of flags.
 */
interface Permissions {
  /** Print the document */
  print: boolean;
  /** Print at full resolution (if false, only degraded printing allowed) */
  printHighQuality: boolean;
  /** Modify document contents */
  modify: boolean;
  /** Copy or extract text and graphics */
  copy: boolean;
  /** Add or modify annotations */
  annotate: boolean;
  /** Fill in existing form fields */
  fillForms: boolean;
  /** Extract text/graphics for accessibility */
  accessibility: boolean;
  /** Assemble: insert, rotate, delete pages */
  assemble: boolean;
}

/**
 * Partial permissions for setProtection().
 * Omitted permissions default to true.
 */
type PermissionOptions = Partial<Permissions>;

/**
 * Options for adding or changing document protection.
 */
interface ProtectionOptions {
  /**
   * User password (required to open the document).
   * Empty string or undefined means no password required to open.
   */
  userPassword?: string;

  /**
   * Owner password (grants full access, required to change security).
   * If omitted when adding protection, a random password is generated
   * (document can still be unprotected with user password + modify permission).
   */
  ownerPassword?: string;

  /**
   * Permission flags.
   * Omitted permissions default to true (allowed).
   */
  permissions?: PermissionOptions;

  /**
   * Encryption algorithm.
   * @default "AES-256"
   */
  algorithm?: EncryptionAlgorithm;

  /**
   * Whether to encrypt the document metadata stream.
   * @default true
   */
  encryptMetadata?: boolean;
}

/**
 * Detailed security information about a document.
 */
interface SecurityInfo {
  /** Whether the document is encrypted */
  isEncrypted: boolean;

  /** Encryption algorithm in use (if encrypted) */
  algorithm?: EncryptionAlgorithm;

  /** Key length in bits (40, 128, or 256) */
  keyLength?: number;

  /** Security handler revision (2-6) */
  revision?: number;

  /** Whether a user password is set (non-empty) */
  hasUserPassword?: boolean;

  /** Whether an owner password is set (different from user password) */
  hasOwnerPassword?: boolean;

  /** How the document was authenticated */
  authenticatedAs?: "user" | "owner" | null;

  /** Current permission flags */
  permissions: Permissions;

  /** Whether metadata is encrypted */
  encryptMetadata?: boolean;
}

/**
 * Result of an authentication attempt.
 */
interface AuthenticationResult {
  /** Whether authentication succeeded */
  authenticated: boolean;
  /** Type of password that worked */
  passwordType?: "user" | "owner";
  /** Whether this grants owner-level access */
  isOwner: boolean;
  /** Current permissions (owner has all) */
  permissions: Permissions;
}
```

---

## API Methods

### On `PDF` class

````typescript
class PDF {
  // ─────────────────────────────────────────────────────────────────────────
  // Existing properties (unchanged)
  // ─────────────────────────────────────────────────────────────────────────

  /** Whether the document is encrypted */
  get isEncrypted(): boolean;

  /** Whether authentication succeeded (for encrypted docs) */
  get isAuthenticated(): boolean;

  // ─────────────────────────────────────────────────────────────────────────
  // New security methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get detailed security information about the document.
   *
   * @returns Security information including encryption details and permissions
   *
   * @example
   * ```typescript
   * const security = pdf.getSecurity();
   * console.log(`Algorithm: ${security.algorithm}`);
   * console.log(`Can copy: ${security.permissions.copy}`);
   * ```
   */
  getSecurity(): SecurityInfo;

  /**
   * Get the current permission flags.
   *
   * Returns all permissions as true for unencrypted documents.
   * For encrypted documents authenticated with owner password, all are true.
   *
   * @returns Current permission flags
   *
   * @example
   * ```typescript
   * const perms = pdf.getPermissions();
   * if (!perms.copy) {
   *   console.log("Copy/paste is restricted");
   * }
   * ```
   */
  getPermissions(): Permissions;

  /**
   * Check if the document was authenticated with owner-level access.
   *
   * Owner access grants all permissions regardless of permission flags.
   * Returns true for unencrypted documents.
   *
   * @returns true if owner access is available
   */
  hasOwnerAccess(): boolean;

  /**
   * Attempt to authenticate with a password.
   *
   * Use this to upgrade access (e.g., from user to owner) or to
   * try a different password without reloading the document.
   *
   * @param password - Password to try
   * @returns Authentication result
   *
   * @example
   * ```typescript
   * // Try to get owner access
   * const result = pdf.authenticate("ownerPassword");
   * if (result.isOwner) {
   *   pdf.removeProtection();
   * }
   * ```
   */
  authenticate(password: string): AuthenticationResult;

  /**
   * Remove all encryption from the document.
   *
   * After calling this, the document will be saved without encryption.
   * Requires owner access, or user access with modify permission.
   *
   * @throws {SecurityError} If insufficient permissions to remove protection
   *
   * @example
   * ```typescript
   * // Remove encryption from a document
   * const pdf = await PDF.load(bytes, { credentials: "ownerPassword" });
   * pdf.removeProtection();
   * const unprotectedBytes = await pdf.save();
   * ```
   */
  removeProtection(): void;

  /**
   * Add or change document encryption.
   *
   * If the document is already encrypted, requires owner access to change.
   * If unencrypted, can be called without restrictions.
   *
   * @param options - Protection options (passwords, permissions, algorithm)
   * @throws {SecurityError} If insufficient permissions to change protection
   *
   * @example
   * ```typescript
   * // Add protection to unencrypted document
   * pdf.setProtection({
   *   userPassword: "secret",
   *   ownerPassword: "admin",
   *   permissions: { copy: false, print: true },
   * });
   *
   * // Change to stronger algorithm
   * pdf.setProtection({
   *   algorithm: "AES-256",
   * });
   * ```
   */
  setProtection(options: ProtectionOptions): void;
}
````

---

## Implementation Architecture

### State Tracking

The PDF class needs to track pending security changes:

```typescript
class PDF {
  // Existing
  private ctx: PDFContext;

  // New: pending security state
  private _pendingSecurity: {
    action: "none" | "remove" | "encrypt";
    options?: ProtectionOptions;
  } = { action: "none" };
}
```

### Writer Integration

The serializer needs to apply encryption during write:

1. **Remove protection**: Write without encryption dictionary
2. **Add protection**:
   - Generate encryption key
   - Create /Encrypt dictionary
   - Encrypt strings and streams during serialization
   - Add /Encrypt to trailer

### Incremental Save Considerations

Encryption changes **cannot** be saved incrementally:

- Removing encryption requires re-encrypting all objects (with no encryption)
- Adding encryption requires encrypting all existing objects
- Changing algorithm requires re-encryption

When `setProtection()` or `removeProtection()` is called:

- Mark that incremental save is blocked
- `canSaveIncrementally()` returns `"encryptionChanged"`

---

## Error Handling

```typescript
/**
 * Base class for security-related errors.
 */
class SecurityError extends Error {
  code: SecurityErrorCode;
}

type SecurityErrorCode =
  | "PERMISSION_DENIED" // Insufficient permissions for operation
  | "NOT_AUTHENTICATED" // Document encrypted but not authenticated
  | "INVALID_PASSWORD" // Wrong password
  | "UNSUPPORTED_ENCRYPTION"; // Unsupported algorithm/handler

/**
 * Thrown when an operation requires permissions the user doesn't have.
 */
class PermissionDeniedError extends SecurityError {
  code = "PERMISSION_DENIED";
  requiredPermission?: keyof Permissions;
}
```

### Error Scenarios

| Operation            | Condition                                | Error                                |
| -------------------- | ---------------------------------------- | ------------------------------------ |
| `removeProtection()` | No owner access and no modify permission | `PermissionDeniedError`              |
| `setProtection()`    | Encrypted without owner access           | `PermissionDeniedError`              |
| Any modification     | Encrypted, not authenticated             | `SecurityError("NOT_AUTHENTICATED")` |

---

## Interaction with Other Features

### Digital Signatures

Encrypted documents can be signed. The signature covers the encrypted bytes.

Removing encryption after signing **invalidates** the signature (bytes change).

### Form Filling

Form field values are encrypted strings. When filling:

- The handler encrypts new values during write
- No special handling needed in the form API

### Attachments

Embedded file streams are encrypted. The attachment API is unaffected —
encryption is handled transparently during read/write.

### Incremental Updates

As noted, encryption changes require full rewrite. This is enforced:

```typescript
canSaveIncrementally(): IncrementalSaveBlocker | null {
  if (this._pendingSecurity.action !== "none") {
    return "encryptionChanged";
  }
  // ... other checks
}
```

---

## Default Behaviors

| Scenario                   | Default                            |
| -------------------------- | ---------------------------------- |
| Algorithm (new encryption) | `"AES-256"`                        |
| User password (omitted)    | Empty string (no password to open) |
| Owner password (omitted)   | Random 32-byte value               |
| Permissions (omitted)      | All `true` (no restrictions)       |
| `encryptMetadata`          | `true`                             |

---

## Test Plan

### Unit Tests

1. **Permission parsing**: Verify all permission bits are correctly read/written
2. **Algorithm detection**: Correctly identify RC4-40, RC4-128, AES-128, AES-256
3. **Password verification**: Test user vs owner password authentication
4. **Key derivation**: Test R2-R6 key derivation produces correct keys

### Integration Tests

1. **Remove protection**:
   - Load encrypted PDF with owner password
   - Call `removeProtection()`
   - Save and reload
   - Verify `isEncrypted` is false
   - Verify content is readable

2. **Add protection**:
   - Create or load unencrypted PDF
   - Call `setProtection()` with various options
   - Save and reload with password
   - Verify `isEncrypted` is true
   - Verify permissions match

3. **Change protection**:
   - Load encrypted PDF with owner password
   - Change password and permissions
   - Save and reload with new password
   - Verify new settings

4. **Permission enforcement**:
   - Load with user password (limited permissions)
   - Attempt `removeProtection()` without modify permission
   - Verify `PermissionDeniedError`

5. **Round-trip content**:
   - Load PDF, add encryption, save
   - Reload with password
   - Verify all content (text, images, forms) intact

6. **Algorithm compatibility**:
   - Test each algorithm variant
   - Verify files open in Adobe Reader

### Fixtures Needed

```
fixtures/encryption/
├── unencrypted.pdf           # No encryption
├── user-only.pdf             # User password only
├── owner-only.pdf            # Owner password, empty user
├── both-passwords.pdf        # Both passwords set
├── restricted-*.pdf          # Various permission combinations
├── aes-128.pdf               # AES-128 encryption
├── aes-256-r5.pdf            # AES-256 R5
├── aes-256-r6.pdf            # AES-256 R6
└── rc4-128.pdf               # RC4-128 (legacy)
```

---

## Open Questions

| Question                        | Proposed Answer                                          |
| ------------------------------- | -------------------------------------------------------- |
| Warn on weak algorithms?        | Yes, emit warning for RC4-\* but allow for compatibility |
| Allow empty owner password?     | No, always generate random if not provided               |
| Validate password strength?     | No, not our responsibility                               |
| Auto-upgrade algorithm on save? | No, preserve original unless explicitly changed          |

---

## Implementation Phases

### Phase 1: Security Querying

- [ ] `getSecurity()` method
- [ ] `getPermissions()` method
- [ ] `hasOwnerAccess()` method
- [ ] `authenticate()` method for re-authentication
- [ ] Tests for querying encrypted document state

### Phase 2: Remove Protection

- [ ] `removeProtection()` method
- [ ] Permission checking (owner access or modify permission)
- [ ] Writer support for unencrypted output
- [ ] Block incremental save when encryption removed
- [ ] Tests for decryption round-trip

### Phase 3: Add Protection

- [ ] `setProtection()` method
- [ ] Encryption key generation (R6 algorithm)
- [ ] Writer integration for encrypting objects
- [ ] Encryption dictionary generation
- [ ] Tests for encryption round-trip

### Phase 4: Change Protection

- [ ] Handle encrypted → encrypted case
- [ ] Preserve content during re-encryption
- [ ] Algorithm upgrade/downgrade support
- [ ] Tests for password/permission changes

---

## References

- PDF 2.0 Specification (ISO 32000-2:2020), Section 7.6
- Existing implementation: `src/security/standard-handler.ts`
- Existing plan: `.agents/plans/011-encryption.md` (parsing/decryption)
- PDFBox: `pdfbox/src/main/java/org/apache/pdfbox/pdmodel/encryption/`
