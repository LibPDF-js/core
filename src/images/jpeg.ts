/**
 * JPEG image parsing.
 *
 * Parses JPEG headers to extract dimensions and color space.
 * The actual image data is passed through directly to PDF (DCTDecode filter).
 */

/**
 * Information extracted from a JPEG header.
 */
export interface JpegInfo {
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** PDF color space name */
  colorSpace: "DeviceGray" | "DeviceRGB" | "DeviceCMYK";
  /** Bits per color component (typically 8) */
  bitsPerComponent: number;
}

// JPEG markers
const MARKER_SOI = 0xd8; // Start of image
const MARKER_SOF0 = 0xc0; // Baseline DCT
const MARKER_SOF1 = 0xc1; // Extended sequential DCT
const MARKER_SOF2 = 0xc2; // Progressive DCT
const MARKER_SOF3 = 0xc3; // Lossless
const MARKER_SOF5 = 0xc5; // Differential sequential DCT
const MARKER_SOF6 = 0xc6; // Differential progressive DCT
const MARKER_SOF7 = 0xc7; // Differential lossless
const MARKER_SOF9 = 0xc9; // Extended sequential DCT, arithmetic coding
const MARKER_SOF10 = 0xca; // Progressive DCT, arithmetic coding
const MARKER_SOF11 = 0xcb; // Lossless, arithmetic coding
const MARKER_SOF13 = 0xcd; // Differential sequential DCT, arithmetic coding
const MARKER_SOF14 = 0xce; // Differential progressive DCT, arithmetic coding
const MARKER_SOF15 = 0xcf; // Differential lossless, arithmetic coding

/**
 * Check if a byte is a Start of Frame (SOF) marker.
 */
function isSOFMarker(marker: number): boolean {
  return (
    marker === MARKER_SOF0 ||
    marker === MARKER_SOF1 ||
    marker === MARKER_SOF2 ||
    marker === MARKER_SOF3 ||
    marker === MARKER_SOF5 ||
    marker === MARKER_SOF6 ||
    marker === MARKER_SOF7 ||
    marker === MARKER_SOF9 ||
    marker === MARKER_SOF10 ||
    marker === MARKER_SOF11 ||
    marker === MARKER_SOF13 ||
    marker === MARKER_SOF14 ||
    marker === MARKER_SOF15
  );
}

/**
 * Parse JPEG header to extract image information.
 *
 * @param bytes - JPEG file data
 * @returns Image information (dimensions, color space, bits)
 * @throws {Error} If not a valid JPEG or header is malformed
 */
export function parseJpegHeader(bytes: Uint8Array): JpegInfo {
  if (bytes.length < 2) {
    throw new Error("Invalid JPEG: too short");
  }

  // Check for JPEG magic bytes
  if (bytes[0] !== 0xff || bytes[1] !== MARKER_SOI) {
    throw new Error("Invalid JPEG: missing SOI marker");
  }

  let offset = 2;

  while (offset < bytes.length - 1) {
    // Find next marker
    if (bytes[offset] !== 0xff) {
      throw new Error(`Invalid JPEG: expected marker at offset ${offset}`);
    }

    // Skip padding bytes (0xff 0xff ...)
    while (offset < bytes.length && bytes[offset] === 0xff) {
      offset++;
    }

    if (offset >= bytes.length) {
      throw new Error("Invalid JPEG: unexpected end of file");
    }

    const marker = bytes[offset];
    offset++;

    // Check for SOF marker
    if (isSOFMarker(marker)) {
      if (offset + 7 > bytes.length) {
        throw new Error("Invalid JPEG: SOF segment too short");
      }

      // Skip segment length (2 bytes)
      // const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];

      const bitsPerComponent = bytes[offset + 2];
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const numComponents = bytes[offset + 7];

      // Determine color space from number of components
      let colorSpace: "DeviceGray" | "DeviceRGB" | "DeviceCMYK";

      switch (numComponents) {
        case 1:
          colorSpace = "DeviceGray";
          break;
        case 3:
          colorSpace = "DeviceRGB";
          break;
        case 4:
          colorSpace = "DeviceCMYK";
          break;
        default:
          throw new Error(`Unsupported JPEG color components: ${numComponents}`);
      }

      return {
        width,
        height,
        colorSpace,
        bitsPerComponent,
      };
    }

    // Skip other markers
    // Markers 0xD0-0xD9 (RST, SOI, EOI) have no length
    if (marker >= 0xd0 && marker <= 0xd9) {
      continue;
    }

    // Read segment length and skip
    if (offset + 1 >= bytes.length) {
      throw new Error("Invalid JPEG: unexpected end of file");
    }

    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];

    // Segment length includes the 2-byte length field itself, so must be >= 2
    // A value of 0 or 1 would cause an infinite loop or go backwards
    if (segmentLength < 2) {
      throw new Error(
        `Invalid JPEG: segment length ${segmentLength} is too small at offset ${offset}`,
      );
    }

    offset += segmentLength;
  }

  throw new Error("Invalid JPEG: no SOF marker found");
}

/**
 * Check if data appears to be a JPEG image.
 *
 * @param bytes - Data to check
 * @returns true if data starts with JPEG magic bytes
 */
export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === MARKER_SOI;
}
