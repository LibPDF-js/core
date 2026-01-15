/**
 * Encryption generator for creating encryption dictionaries.
 *
 * This module generates all components needed to encrypt a PDF document
 * using the Standard security handler with AES-256 (V5/R6).
 *
 * @see PDF 2.0 Specification, Section 7.6.4 (Standard Security Handler)
 */

import type { ProtectionOptions } from "#src/api/pdf-security";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfString } from "#src/objects/pdf-string";
import { randomBytes } from "@noble/ciphers/utils.js";

import type { EncryptionDict } from "./encryption-dict";
import {
  generateOwnerEntries,
  generatePermsEntry,
  generateUserEntries,
} from "./key-derivation/sha-based";
import { DEFAULT_PERMISSIONS, encodePermissions, type Permissions } from "./permissions";
import { StandardSecurityHandler } from "./standard-handler";

/**
 * Generated encryption data for writing to PDF.
 */
export interface GeneratedEncryption {
  /** The /Encrypt dictionary to write */
  encryptDict: PdfDict;

  /** The file ID array (two 16-byte values) */
  fileId: [Uint8Array, Uint8Array];

  /** Security handler for encrypting strings and streams */
  securityHandler: StandardSecurityHandler;
}

/**
 * Generate encryption data for a new PDF encryption.
 *
 * Creates all the necessary encryption dictionary entries and
 * returns a security handler that can encrypt content.
 *
 * @param options - Protection options (passwords, permissions, algorithm)
 * @returns Generated encryption data
 */
export function generateEncryption(options: ProtectionOptions): GeneratedEncryption {
  // Only support AES-256 for new encryption
  const algorithm = options.algorithm ?? "AES-256";

  if (algorithm !== "AES-256") {
    throw new Error(`Only AES-256 encryption is supported for new documents. Got: ${algorithm}`);
  }

  // Encode passwords to UTF-8
  const userPassword = new TextEncoder().encode(options.userPassword ?? "");
  const ownerPassword = new TextEncoder().encode(options.ownerPassword ?? generateRandomPassword());

  // Merge permissions with defaults (omitted = true)
  const permissions: Permissions = {
    ...DEFAULT_PERMISSIONS,
    ...options.permissions,
  };

  // Encode permissions as /P value
  const permissionsRaw = encodePermissions(permissions);

  const encryptMetadata = options.encryptMetadata ?? true;

  // Generate random 32-byte file encryption key
  const fileEncryptionKey = randomBytes(32);

  // Generate user entries (/U and /UE)
  const { u, ue } = generateUserEntries(userPassword, fileEncryptionKey, 6);

  // Generate owner entries (/O and /OE) - needs /U for hash
  const { o, oe } = generateOwnerEntries(ownerPassword, fileEncryptionKey, u, 6);

  // Generate /Perms entry
  const perms = generatePermsEntry(fileEncryptionKey, permissionsRaw, encryptMetadata);

  // Generate file ID (two random 16-byte values)
  const id1 = randomBytes(16);
  const id2 = randomBytes(16);
  const fileId: [Uint8Array, Uint8Array] = [id1, id2];

  // Build encryption dictionary
  const encryptDict = PdfDict.of({
    Filter: PdfName.of("Standard"),
    V: PdfNumber.of(5),
    R: PdfNumber.of(6),
    Length: PdfNumber.of(256),
    O: PdfString.fromBytes(o),
    U: PdfString.fromBytes(u),
    OE: PdfString.fromBytes(oe),
    UE: PdfString.fromBytes(ue),
    P: PdfNumber.of(permissionsRaw),
    Perms: PdfString.fromBytes(perms),
    // Crypt filters for AES-256
    CF: PdfDict.of({
      StdCF: PdfDict.of({
        CFM: PdfName.of("AESV3"),
        AuthEvent: PdfName.of("DocOpen"),
        Length: PdfNumber.of(32),
      }),
    }),
    StmF: PdfName.of("StdCF"),
    StrF: PdfName.of("StdCF"),
  });

  // Only add EncryptMetadata if false (true is the default)
  if (!encryptMetadata) {
    encryptDict.set("EncryptMetadata", PdfName.of("false"));
  }

  // Create an EncryptionDict object for the security handler
  const encryptionDictData: EncryptionDict = {
    filter: "Standard",
    version: 5,
    revision: 6,
    keyLengthBits: 256,
    ownerHash: o,
    userHash: u,
    permissions,
    permissionsRaw,
    encryptMetadata,
    ownerEncryptionKey: oe,
    userEncryptionKey: ue,
    permsValue: perms,
    algorithm: "AES-256",
    cryptFilters: new Map([
      [
        "StdCF",
        {
          cfm: "AESV3",
          authEvent: "DocOpen",
          length: 32,
        },
      ],
    ]),
    streamFilter: "StdCF",
    stringFilter: "StdCF",
  };

  // Create and authenticate the security handler
  const securityHandler = new StandardSecurityHandler(encryptionDictData, id1);

  // Authenticate with user password (empty or provided)
  const authResult = securityHandler.authenticate(userPassword);

  if (!authResult.authenticated) {
    // This shouldn't happen since we just generated the encryption
    throw new Error("Failed to authenticate with generated encryption keys");
  }

  return {
    encryptDict,
    fileId,
    securityHandler,
  };
}

/**
 * Generate a random password for owner password when not specified.
 *
 * Uses 32 random bytes encoded as hex (64 characters).
 */
function generateRandomPassword(): string {
  const bytes = randomBytes(32);

  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Reconstruct a PdfDict from an existing EncryptionDict.
 *
 * This is used when re-saving an encrypted PDF - we need to write
 * the encrypt dictionary to the output, and we reconstruct it from
 * the parsed encryption parameters.
 *
 * @param encryption The parsed encryption dictionary
 * @returns A PdfDict that can be written to the PDF
 */
export function reconstructEncryptDict(encryption: EncryptionDict): PdfDict {
  const dict = PdfDict.of({
    Filter: PdfName.of(encryption.filter),
    V: PdfNumber.of(encryption.version),
    R: PdfNumber.of(encryption.revision),
    Length: PdfNumber.of(encryption.keyLengthBits),
    O: PdfString.fromBytes(encryption.ownerHash),
    U: PdfString.fromBytes(encryption.userHash),
    P: PdfNumber.of(encryption.permissionsRaw),
  });

  // R5-R6 specific entries
  if (encryption.ownerEncryptionKey) {
    dict.set("OE", PdfString.fromBytes(encryption.ownerEncryptionKey));
  }

  if (encryption.userEncryptionKey) {
    dict.set("UE", PdfString.fromBytes(encryption.userEncryptionKey));
  }

  if (encryption.permsValue) {
    dict.set("Perms", PdfString.fromBytes(encryption.permsValue));
  }

  // Crypt filters (V4+)
  if (encryption.cryptFilters && encryption.cryptFilters.size > 0) {
    const cfDict = new PdfDict();

    for (const [name, filter] of encryption.cryptFilters) {
      const filterDict = PdfDict.of({
        CFM: PdfName.of(filter.cfm),
      });

      if (filter.authEvent) {
        filterDict.set("AuthEvent", PdfName.of(filter.authEvent));
      }

      if (filter.length !== undefined) {
        filterDict.set("Length", PdfNumber.of(filter.length));
      }

      cfDict.set(name, filterDict);
    }

    dict.set("CF", cfDict);
  }

  // Stream and string filters
  if (encryption.streamFilter) {
    dict.set("StmF", PdfName.of(encryption.streamFilter));
  }

  if (encryption.stringFilter) {
    dict.set("StrF", PdfName.of(encryption.stringFilter));
  }

  // EncryptMetadata (only if false, true is default)
  if (!encryption.encryptMetadata) {
    dict.set("EncryptMetadata", PdfName.of("false"));
  }

  return dict;
}
