/**
 * Encryption dictionary parsing for PDF standard security handler.
 *
 * The /Encrypt dictionary in the PDF trailer contains all parameters
 * needed for decryption. This module parses and validates that dictionary.
 *
 * @see PDF 2.0 Specification, Section 7.6.2 (Standard encryption dictionary)
 */

import { PdfDict } from "../objects/pdf-dict";
import { EncryptionDictError } from "./errors";
import { parsePermissions, type Permissions } from "./permissions";
import {
  type CryptFilter,
  type EncryptionAlgorithm,
  type EncryptionRevision,
  type EncryptionVersion,
  isAuthEvent,
  isCryptFilterMethod,
  isEncryptionRevision,
  isEncryptionVersion,
} from "./schemas";

export { EncryptionDictError } from "./errors";
// Re-export types for convenience
export type {
  AuthEvent,
  CryptFilter,
  CryptFilterMethod,
  EncryptionAlgorithm,
  EncryptionRevision,
  EncryptionVersion,
} from "./schemas";

/**
 * Parsed encryption dictionary.
 *
 * Contains all parameters needed to decrypt the document.
 */
export interface EncryptionDict {
  /** Security handler filter (always "Standard" for this implementation) */
  filter: "Standard";

  /** Algorithm version: 1, 2, 3, 4, or 5 */
  version: EncryptionVersion;

  /** Standard security handler revision: 2, 3, 4, 5, or 6 */
  revision: EncryptionRevision;

  /** Key length in bits (40-256) */
  keyLengthBits: number;

  /** Owner password verification value (32 bytes for R2-R4, 48 bytes for R5-R6) */
  ownerHash: Uint8Array;

  /** User password verification value (32 bytes for R2-R4, 48 bytes for R5-R6) */
  userHash: Uint8Array;

  /** Permission flags */
  permissions: Permissions;

  /** Raw permission value for verification */
  permissionsRaw: number;

  /** Whether metadata streams are encrypted (R4+) */
  encryptMetadata: boolean;

  // R5-R6 only fields
  /** Owner encryption key (32 bytes) - R5-R6 only */
  ownerEncryptionKey?: Uint8Array;

  /** User encryption key (32 bytes) - R5-R6 only */
  userEncryptionKey?: Uint8Array;

  /** Permission verification value (16 bytes) - R5-R6 only */
  permsValue?: Uint8Array;

  // V4+ crypt filter fields
  /** Crypt filters dictionary */
  cryptFilters?: Map<string, CryptFilter>;

  /** Name of stream filter (default: "Identity") */
  streamFilter?: string;

  /** Name of string filter (default: "Identity") */
  stringFilter?: string;

  /** Name of embedded file filter (default: value of streamFilter) */
  embeddedFileFilter?: string;

  /** Derived encryption algorithm based on V/R and crypt filters */
  algorithm: EncryptionAlgorithm;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsing functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a crypt filter dictionary.
 */
function parseCryptFilter(dict: PdfDict): CryptFilter {
  const cfm = dict.getName("CFM")?.value ?? "None";
  const authEvent = dict.getName("AuthEvent")?.value;
  const length = dict.getNumber("Length")?.value;

  // Validate CFM
  if (!isCryptFilterMethod(cfm)) {
    throw new EncryptionDictError(`Invalid crypt filter method: ${cfm}`);
  }

  // Validate AuthEvent if present
  if (authEvent !== undefined && !isAuthEvent(authEvent)) {
    throw new EncryptionDictError(`Invalid auth event: ${authEvent}`);
  }

  return {
    cfm,
    authEvent,
    length,
  };
}

/**
 * Determine the encryption algorithm from version and revision.
 */
function determineAlgorithm(
  version: EncryptionVersion,
  revision: EncryptionRevision,
  cryptFilters?: Map<string, CryptFilter>,
  streamFilter?: string,
): EncryptionAlgorithm {
  // R5-R6 always use AES-256
  if (revision >= 5) {
    return "AES-256";
  }

  // V4 with crypt filters - check the stream filter
  if (version === 4 && cryptFilters && streamFilter) {
    const filter = cryptFilters.get(streamFilter);

    if (filter) {
      switch (filter.cfm) {
        case "AESV3":
          return "AES-256";
        case "AESV2":
          return "AES-128";
        case "V2":
          return "RC4";
        case "None":
          return "RC4"; // Identity, but we still need a default
      }
    }
  }

  // V4 without explicit filter typically means AES-128
  if (version === 4) {
    return "AES-128";
  }

  // V1-V3 use RC4
  return "RC4";
}

/**
 * Parse and validate the encryption version.
 */
function parseVersion(dict: PdfDict): EncryptionVersion {
  const version = dict.getNumber("V")?.value;

  if (version === undefined) {
    throw new EncryptionDictError("Missing /V (version) in encryption dictionary");
  }

  if (!isEncryptionVersion(version)) {
    throw new EncryptionDictError(`Unsupported encryption version: ${version}`);
  }

  return version;
}

/**
 * Parse and validate the encryption revision.
 */
function parseRevision(dict: PdfDict): EncryptionRevision {
  const revision = dict.getNumber("R")?.value;

  if (revision === undefined) {
    throw new EncryptionDictError("Missing /R (revision) in encryption dictionary");
  }

  if (!isEncryptionRevision(revision)) {
    throw new EncryptionDictError(`Unsupported encryption revision: ${revision}`);
  }

  return revision;
}

/**
 * Parse an encryption dictionary from a PDF dictionary.
 *
 * @param dict - The /Encrypt dictionary from the PDF trailer
 * @returns Parsed encryption parameters
 * @throws {EncryptionDictError} if the dictionary is invalid or unsupported
 */
export function parseEncryptionDict(dict: PdfDict): EncryptionDict {
  // Check filter - must be "Standard" (we don't support other handlers)
  const filter = dict.getName("Filter")?.value;

  if (filter !== "Standard") {
    throw new EncryptionDictError(
      filter
        ? `Unsupported security handler: ${filter}`
        : "Missing /Filter in encryption dictionary",
    );
  }

  // Parse and validate version and revision using Zod
  const version = parseVersion(dict);
  const revision = parseRevision(dict);

  // Validate V/R compatibility
  validateVersionRevision(version, revision);

  // Parse key length
  let keyLengthBits = dict.getNumber("Length")?.value ?? 40;

  // V1 is always 40-bit
  if (version === 1) {
    keyLengthBits = 40;
  }
  // V5 (R5-R6) is always 256-bit
  else if (version === 5) {
    keyLengthBits = 256;
  }

  // Validate key length
  if (keyLengthBits < 40 || keyLengthBits > 256 || keyLengthBits % 8 !== 0) {
    throw new EncryptionDictError(`Invalid key length: ${keyLengthBits} bits`);
  }

  // Parse owner hash (O)
  const ownerHash = dict.getString("O")?.bytes;

  if (!ownerHash) {
    throw new EncryptionDictError("Missing /O (owner hash) in encryption dictionary");
  }

  // Validate O length based on revision
  // R2-R4: exactly 32 bytes
  // R5-R6: at least 48 bytes (32 hash + 8 validation salt + 8 key salt), may be padded
  if (revision >= 5) {
    if (ownerHash.length < 48) {
      throw new EncryptionDictError(
        `Invalid /O length: expected at least 48 bytes, got ${ownerHash.length}`,
      );
    }
  } else {
    if (ownerHash.length !== 32) {
      throw new EncryptionDictError(
        `Invalid /O length: expected 32 bytes, got ${ownerHash.length}`,
      );
    }
  }

  // Parse user hash (U)
  const userHash = dict.getString("U")?.bytes;

  if (!userHash) {
    throw new EncryptionDictError("Missing /U (user hash) in encryption dictionary");
  }

  // Validate U length based on revision (same rules as /O)
  if (revision >= 5) {
    if (userHash.length < 48) {
      throw new EncryptionDictError(
        `Invalid /U length: expected at least 48 bytes, got ${userHash.length}`,
      );
    }
  } else {
    if (userHash.length !== 32) {
      throw new EncryptionDictError(`Invalid /U length: expected 32 bytes, got ${userHash.length}`);
    }
  }

  // Truncate hashes to expected length for R5-R6 (handles padded PDFs)
  // For R2-R4, we require exact length (32 bytes)
  const normalizedOwnerHash =
    revision >= 5 && ownerHash.length > 48 ? ownerHash.slice(0, 48) : ownerHash;
  const normalizedUserHash =
    revision >= 5 && userHash.length > 48 ? userHash.slice(0, 48) : userHash;

  // Parse permissions (P)
  const permissionsRaw = dict.getNumber("P")?.value;

  if (permissionsRaw === undefined) {
    throw new EncryptionDictError("Missing /P (permissions) in encryption dictionary");
  }

  const permissions = parsePermissions(permissionsRaw);

  // Parse EncryptMetadata (R4+)
  const encryptMetadata = parseEncryptMetadata(dict);

  // Parse R5-R6 specific fields
  let ownerEncryptionKey: Uint8Array | undefined;
  let userEncryptionKey: Uint8Array | undefined;
  let permsValue: Uint8Array | undefined;

  if (revision >= 5) {
    ownerEncryptionKey = dict.getString("OE")?.bytes;

    if (!ownerEncryptionKey || ownerEncryptionKey.length !== 32) {
      throw new EncryptionDictError("Missing or invalid /OE in R5+ encryption dictionary");
    }

    userEncryptionKey = dict.getString("UE")?.bytes;

    if (!userEncryptionKey || userEncryptionKey.length !== 32) {
      throw new EncryptionDictError("Missing or invalid /UE in R5+ encryption dictionary");
    }

    permsValue = dict.getString("Perms")?.bytes;

    if (!permsValue || permsValue.length !== 16) {
      throw new EncryptionDictError("Missing or invalid /Perms in R5+ encryption dictionary");
    }
  }

  // Parse V4+ crypt filters
  let cryptFilters: Map<string, CryptFilter> | undefined;
  let streamFilter: string | undefined;
  let stringFilter: string | undefined;
  let embeddedFileFilter: string | undefined;

  if (version >= 4) {
    const cfDict = dict.getDict("CF");

    if (cfDict) {
      cryptFilters = new Map();

      for (const [name, filterDict] of cfDict) {
        if (filterDict instanceof PdfDict) {
          cryptFilters.set(name.value, parseCryptFilter(filterDict));
        }
      }
    }

    streamFilter = dict.getName("StmF")?.value ?? "Identity";
    stringFilter = dict.getName("StrF")?.value ?? "Identity";
    embeddedFileFilter = dict.getName("EFF")?.value ?? streamFilter;
  }

  // Determine the algorithm
  const algorithm = determineAlgorithm(version, revision, cryptFilters, streamFilter);

  return {
    filter: "Standard",
    version,
    revision,
    keyLengthBits,
    ownerHash: normalizedOwnerHash,
    userHash: normalizedUserHash,
    permissions,
    permissionsRaw,
    encryptMetadata,
    ownerEncryptionKey,
    userEncryptionKey,
    permsValue,
    cryptFilters,
    streamFilter,
    stringFilter,
    embeddedFileFilter,
    algorithm,
  };
}

/**
 * Validate that V and R values are compatible.
 */
function validateVersionRevision(version: EncryptionVersion, revision: EncryptionRevision): void {
  // Valid combinations per PDF spec:
  // V=1 → R=2
  // V=2 → R=3
  // V=3 → R=3 (unpublished, rare)
  // V=4 → R=4
  // V=5 → R=5 or R=6

  const valid =
    (version === 1 && revision === 2) ||
    (version === 2 && revision === 3) ||
    (version === 3 && revision === 3) ||
    (version === 4 && revision === 4) ||
    (version === 5 && (revision === 5 || revision === 6));

  if (!valid) {
    // Be lenient - warn but allow (some PDFs have weird combinations)
    // In strict mode, we'd throw here
    console.warn(`Unusual V/R combination: V=${version}, R=${revision}`);
  }
}

/**
 * Parse /EncryptMetadata, defaulting to true.
 *
 * The spec defines this as a boolean, but earlier versions of this library
 * wrote it as the name /false. Those files were encrypted with
 * EncryptMetadata = false, so treat the name /false as the boolean false
 * to keep them readable.
 *
 * TODO(1.0): Remove the name fallback. See https://github.com/LibPDF-js/core/issues/97
 */
function parseEncryptMetadata(dict: PdfDict): boolean {
  const bool = dict.getBool("EncryptMetadata");

  if (bool) {
    return bool.value;
  }

  const name = dict.getName("EncryptMetadata");

  if (name?.value === "false") {
    return false;
  }

  return true;
}

/**
 * Check if a dictionary represents an encrypted document.
 *
 * @param trailerDict - The trailer dictionary
 * @returns True if the document is encrypted
 */
export function isEncryptedTrailer(trailerDict: PdfDict): boolean {
  return trailerDict.has("Encrypt");
}

/**
 * Get the key length in bytes.
 */
export function getKeyLengthBytes(dict: EncryptionDict): number {
  return dict.keyLengthBits / 8;
}
