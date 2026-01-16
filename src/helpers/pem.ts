/**
 * PEM encoding/decoding utilities.
 *
 * PEM (Privacy-Enhanced Mail) is a Base64 encoding format with header/footer
 * lines used for certificates, keys, and other cryptographic data.
 */

import { base64 } from "@scure/base";

/**
 * A single PEM block parsed from a PEM file.
 */
export interface PemBlock {
  /** The label from the BEGIN statement (e.g., "CERTIFICATE", "PRIVATE KEY") */
  label: string;
  /** The DER-encoded binary data */
  der: Uint8Array;
}

/**
 * Parse a PEM file into a series of DER blocks with their types.
 *
 * PEM files can contain multiple blocks (e.g., certificate chains). This function
 * extracts each block along with its label from the BEGIN statement.
 *
 * @param pem - The PEM-encoded string (may contain multiple blocks)
 * @returns Array of PEM blocks, each containing a label and DER data
 * @throws {Error} if the PEM format is invalid (mismatched labels or missing markers)
 *
 * @example
 * ```typescript
 * const blocks = parsePem(pemString);
 * // [
 * //   { label: "CERTIFICATE", der: Uint8Array(...) },
 * //   { label: "CERTIFICATE", der: Uint8Array(...) },
 * //   { label: "PRIVATE KEY", der: Uint8Array(...) }
 * // ]
 * ```
 */
export function parsePem(pem: string): PemBlock[] {
  const blocks: PemBlock[] = [];

  // Match all BEGIN...END blocks with their content
  // The regex captures: (1) label from BEGIN, (2) base64 content, (3) label from END
  const blockRegex = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END ([A-Z0-9 ]+)-----/g;

  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(pem)) !== null) {
    const beginLabel = match[1];
    const content = match[2];
    const endLabel = match[3];

    // Validate that BEGIN and END labels match
    if (beginLabel !== endLabel) {
      throw new Error(`PEM label mismatch: BEGIN ${beginLabel} but END ${endLabel}`);
    }

    // Remove all whitespace from base64 content
    const b64 = content.replace(/\s/g, "");

    // Skip empty blocks
    if (b64.length === 0) {
      blocks.push({ label: beginLabel, der: new Uint8Array(0) });
      continue;
    }

    const der = base64.decode(b64);
    blocks.push({ label: beginLabel, der });
  }

  return blocks;
}

/**
 * Convert DER (binary) bytes to PEM format.
 *
 * @param der - The DER-encoded binary data
 * @param label - The PEM label (e.g., "CERTIFICATE", "PUBLIC KEY", "PRIVATE KEY")
 * @returns PEM-encoded string with header, base64 content (64-char lines), and footer
 *
 * @example
 * ```typescript
 * const pem = derToPem(certificateDer, "CERTIFICATE");
 * // -----BEGIN CERTIFICATE-----
 * // MIIBkTCB+wIJAKHBfpegPjMCMA0GCSqGSIb3DQEBCwUAMBExDzANBgNVBAMMBnRl
 * // ...
 * // -----END CERTIFICATE-----
 * ```
 */
export function derToPem(der: Uint8Array, label: string): string {
  const b64 = base64.encode(der);
  const lines = b64.match(/.{1,64}/g) ?? [];

  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}

/**
 * Convert PEM format to DER (binary) bytes.
 *
 * @param pem - The PEM-encoded string
 * @returns DER-encoded binary data
 * @throws {Error} if the PEM format is invalid
 *
 * @example
 * ```typescript
 * const der = pemToDer(pemString);
 * ```
 */
export function pemToDer(pem: string): Uint8Array {
  // Remove header, footer, and all whitespace
  const b64 = pem
    .replace(/-----BEGIN [A-Z0-9 ]+-----/g, "")
    .replace(/-----END [A-Z0-9 ]+-----/g, "")
    .replace(/\s/g, "");

  return base64.decode(b64);
}

/**
 * Extract the label from a PEM string.
 *
 * @param pem - The PEM-encoded string
 * @returns The label (e.g., "CERTIFICATE", "PUBLIC KEY") or null if not found
 *
 * @example
 * ```typescript
 * const label = getPemLabel(pemString);
 * // "CERTIFICATE"
 * ```
 */
export function getPemLabel(pem: string): string | null {
  const match = pem.match(/-----BEGIN ([A-Z0-9 ]+)-----/);

  return match ? match[1] : null;
}

/**
 * Check if a string is in PEM format.
 *
 * @param data - The string to check
 * @returns True if the string appears to be PEM-encoded
 */
export function isPem(data: string): boolean {
  return /-----BEGIN [A-Z0-9 ]+-----/.test(data) && /-----END [A-Z0-9 ]+-----/.test(data);
}

/**
 * Normalize a PEM string for comparison by removing headers, footers, and whitespace.
 *
 * @param pem - The PEM-encoded string
 * @returns The base64 content without any formatting
 *
 * @example
 * ```typescript
 * const normalized1 = normalizePem(pem1);
 * const normalized2 = normalizePem(pem2);
 * const areEqual = normalized1 === normalized2;
 * ```
 */
export function normalizePem(pem: string): string {
  return pem
    .replace(/-----BEGIN [A-Z0-9 ]+-----/g, "")
    .replace(/-----END [A-Z0-9 ]+-----/g, "")
    .replace(/\s/g, "");
}
