/**
 * Test utilities for @libpdf/core
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Base path for test fixtures.
 */
const FIXTURES_PATH = join(import.meta.dirname, "..", "fixtures");

/**
 * Base path for test output (gitignored).
 */
const TEST_OUTPUT_PATH = join(import.meta.dirname, "..", "test-output");

/**
 * Fixture categories matching the fixtures directory structure.
 */
export type FixtureCategory =
  | "afm"
  | "attachments"
  | "basic"
  | "certificates"
  | "cmap"
  | "encryption"
  | "filter"
  | "fonts"
  | "forms"
  | "layers"
  | "malformed"
  | "text"
  | "xref";

/**
 * Load a PDF fixture file as a Uint8Array.
 *
 * @param category - The fixture category (subdirectory)
 * @param filename - The PDF filename (can include subdirectories, e.g., "pdfbox/PDFBOX-3208.pdf")
 * @returns The file contents as Uint8Array
 *
 * @example
 * ```ts
 * const bytes = await loadFixture("basic", "rot0.pdf");
 * const pdfboxBytes = await loadFixture("malformed", "pdfbox/PDFBOX-3208.pdf");
 * ```
 */
export async function loadFixture(category: FixtureCategory, filename: string) {
  const path = join(FIXTURES_PATH, category, filename);

  const buffer = await readFile(path);

  return new Uint8Array(buffer);
}

/**
 * Load a PDF fixture file as a raw Buffer.
 * Useful when you need Node.js Buffer methods.
 *
 * @param category - The fixture category (subdirectory)
 * @param filename - The PDF filename
 * @returns The file contents as Buffer
 */
export async function loadFixtureBuffer(category: FixtureCategory, filename: string) {
  const path = join(FIXTURES_PATH, category, filename);

  return readFile(path);
}

/**
 * Convert a Uint8Array to a hex string for debugging.
 *
 * @param bytes - The bytes to convert
 * @param maxLength - Maximum number of bytes to show (default: 100)
 * @returns Hex string representation
 *
 * @example
 * ```ts
 * console.log(toHexString(bytes)); // "25 50 44 46 2d 31 2e 34..."
 * ```
 */
export function toHexString(bytes: Uint8Array, maxLength = 100) {
  const slice = bytes.slice(0, maxLength);

  const hex = Array.from(slice)
    .map(b => b.toString(16).padStart(2, "0"))
    .join(" ");

  return bytes.length > maxLength ? `${hex}...` : hex;
}

/**
 * Convert a Uint8Array to an ASCII string (for debugging PDF structure).
 * Non-printable characters are replaced with dots.
 *
 * @param bytes - The bytes to convert
 * @param maxLength - Maximum number of bytes to show (default: 200)
 * @returns ASCII string representation
 */
export function toAsciiString(bytes: Uint8Array, maxLength = 200) {
  const slice = bytes.slice(0, maxLength);

  const ascii = Array.from(slice)
    .map(b => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : "."))
    .join("");

  return bytes.length > maxLength ? `${ascii}...` : ascii;
}

/**
 * Assert that two Uint8Arrays are equal.
 * Throws a detailed error message if they differ.
 *
 * @param actual - The actual bytes
 * @param expected - The expected bytes
 * @param message - Optional message prefix
 */
export function assertBytesEqual(actual: Uint8Array, expected: Uint8Array, message?: string) {
  const prefix = message ? `${message}: ` : "";

  if (actual.length !== expected.length) {
    throw new Error(`${prefix}Length mismatch: got ${actual.length}, expected ${expected.length}`);
  }

  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== expected[i]) {
      throw new Error(
        `${prefix}Byte mismatch at index ${i}: got 0x${actual[i]
          ?.toString(16)
          .padStart(2, "0")}, ` + `expected 0x${expected[i]?.toString(16).padStart(2, "0")}`,
      );
    }
  }
}

/**
 * Create a Uint8Array from a string (for creating test data).
 *
 * @param str - The ASCII string to convert
 * @returns Uint8Array of the string's bytes
 */
export function stringToBytes(str: string) {
  return new Uint8Array(str.split("").map(c => c.charCodeAt(0)));
}

/**
 * Create a Uint8Array from hex string (for creating test data).
 *
 * @param hex - The hex string (spaces optional)
 * @returns Uint8Array of the bytes
 *
 * @example
 * ```ts
 * const bytes = hexToBytes("25 50 44 46"); // %PDF
 * ```
 */
export function hexToBytes(hex: string) {
  const cleaned = hex.replace(/\s/g, "");
  const bytes = new Uint8Array(cleaned.length / 2);

  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  }

  return bytes;
}

/**
 * Check if bytes start with the PDF header signature.
 *
 * @param bytes - The bytes to check
 * @returns True if bytes start with "%PDF-"
 */
export function isPdfHeader(bytes: Uint8Array) {
  // %PDF- = 0x25 0x50 0x44 0x46 0x2D

  return (
    // Fix: String.fromCharCode(...bytes) expects numbers, and map returns string[]
    String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-"
  );
}

/**
 * Find the PDF version from the header.
 *
 * @param bytes - The PDF bytes
 * @returns The version string (e.g., "1.4") or null if not found
 */
export function getPdfVersion(bytes: Uint8Array) {
  if (!isPdfHeader(bytes)) {
    return null;
  }

  // Find the newline after the header
  let end = 5;

  while (end < bytes.length && end < 20) {
    const b = bytes[end];
    if (b === 0x0a || b === 0x0d) {
      break;
    }
    end++;
  }

  // Extract version (e.g., "1.4" from "%PDF-1.4")
  const header = String.fromCharCode(...bytes.slice(0, end));

  const match = header.match(/%PDF-(\d+\.\d+)/);

  return match?.[1] ?? null;
}

/**
 * Save test output to the test-output directory for manual inspection.
 *
 * The test-output directory is gitignored, so these files won't be committed.
 * Useful for visually verifying PDF output in Preview.app or other viewers.
 *
 * @param filename - Output filename (can include subdirectories, e.g., "copy/page-copy.pdf")
 * @param data - The data to write
 *
 * @example
 * ```ts
 * const savedBytes = await pdf.save();
 * await saveTestOutput("copy-pages-test.pdf", savedBytes);
 * // Then open test-output/copy-pages-test.pdf in Preview.app
 * ```
 */
export async function saveTestOutput(filename: string, data: Uint8Array): Promise<string> {
  const fullPath = join(TEST_OUTPUT_PATH, filename);
  const dir = join(fullPath, "..");

  // Ensure directory exists
  await mkdir(dir, { recursive: true });

  // Write the file
  await writeFile(fullPath, data);

  return fullPath;
}
