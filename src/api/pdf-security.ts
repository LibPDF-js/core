/**
 * Security API types for the PDF class.
 *
 * Provides types for querying and modifying document encryption,
 * permissions, and authentication state.
 */

import type { Permissions } from "#src/security/permissions";

// Re-export Permissions for convenience
export type { Permissions };

/**
 * Encryption algorithm options.
 *
 * - RC4-40: Legacy 40-bit RC4 (PDF 1.1+, weak, avoid)
 * - RC4-128: 128-bit RC4 (PDF 1.4+, deprecated)
 * - AES-128: 128-bit AES-CBC (PDF 1.5+, recommended minimum)
 * - AES-256: 256-bit AES-CBC (PDF 2.0, strongest, default)
 */
export type EncryptionAlgorithmOption = "RC4-40" | "RC4-128" | "AES-128" | "AES-256";

/**
 * Partial permissions for setProtection().
 * Omitted permissions default to true.
 */
export type PermissionOptions = Partial<Permissions>;

/**
 * Options for adding or changing document protection.
 */
export interface ProtectionOptions {
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
  algorithm?: EncryptionAlgorithmOption;

  /**
   * Whether to encrypt the document metadata stream.
   * @default true
   */
  encryptMetadata?: boolean;
}

/**
 * Options for removing document protection.
 */
export interface RemoveProtectionOptions {
  /**
   * Skip the owner access / modify permission check.
   *
   * Any successfully decrypted document (including one opened with only
   * the user password) can then be saved without encryption.
   * @default false
   */
  ignorePermissions?: boolean;
}

/**
 * Detailed security information about a document.
 */
export interface SecurityInfo {
  /** Whether the document is encrypted */
  isEncrypted: boolean;

  /** Encryption algorithm in use (if encrypted) */
  algorithm?: EncryptionAlgorithmOption;

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
export interface AuthenticationResult {
  /** Whether authentication succeeded */
  authenticated: boolean;
  /** Type of password that worked */
  passwordType?: "user" | "owner";
  /** Whether this grants owner-level access */
  isOwner: boolean;
  /** Current permissions (owner has all) */
  permissions: Permissions;
}

/**
 * Pending security state tracked by PDF class.
 */
export interface PendingSecurityState {
  /** What action to take on save */
  action: "none" | "remove" | "encrypt";
  /** Options for encryption (when action is "encrypt") */
  options?: ProtectionOptions;
}
