/**
 * PNG image parsing.
 *
 * Parses PNG to extract image data for embedding in PDF.
 * PNG uses zlib compression and may have alpha channels which need
 * to be converted to PDF soft masks.
 */

import { inflate } from "pako";

/**
 * Information extracted from a PNG image.
 */
export interface PngInfo {
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** PNG color type (0=gray, 2=RGB, 3=indexed, 4=gray+alpha, 6=RGBA) */
  colorType: number;
  /** Bit depth per channel */
  bitDepth: number;
  /** Whether the image has an alpha channel */
  hasAlpha: boolean;
  /** PDF color space name */
  colorSpace: "DeviceGray" | "DeviceRGB";
  /** Number of color components (excluding alpha) */
  components: number;
}

/**
 * Decoded PNG data ready for PDF embedding.
 */
export interface PngData {
  /** Image information */
  info: PngInfo;
  /** Decoded RGB/Gray pixels (deflated for efficiency) */
  pixels: Uint8Array;
  /** Alpha channel data (if present) */
  alpha?: Uint8Array;
}

// PNG signature
const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Chunk types
const IHDR = 0x49484452;
const PLTE = 0x504c5445;
const tRNS = 0x74524e53;
const IDAT = 0x49444154;
const IEND = 0x49454e44;

// Maximum allowed image dimensions to prevent memory bombs
// 100 megapixels is generous but prevents absurd allocations
const MAX_PIXELS = 100_000_000;

/**
 * Parse a PNG file and extract image data.
 *
 * @param bytes - PNG file data
 * @returns Parsed image data
 * @throws {Error} If not a valid PNG or unsupported format
 */
export function parsePng(bytes: Uint8Array): PngData {
  if (!isPng(bytes)) {
    throw new Error("Invalid PNG: missing signature");
  }

  let offset = 8; // Skip signature
  let info: PngInfo | null = null;
  let palette: Uint8Array | null = null;
  let transparency: Uint8Array | null = null;
  const idatChunks: Uint8Array[] = [];

  // Read chunks
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) {
      throw new Error("Invalid PNG: unexpected end of file");
    }

    const length = readUint32BE(bytes, offset);
    const type = readUint32BE(bytes, offset + 4);

    if (offset + 12 + length > bytes.length) {
      throw new Error("Invalid PNG: chunk extends beyond file");
    }

    const data = bytes.subarray(offset + 8, offset + 8 + length);

    if (type === IHDR) {
      info = parseIHDR(data);
    } else if (type === PLTE) {
      palette = data;
    } else if (type === tRNS) {
      transparency = data;
    } else if (type === IDAT) {
      idatChunks.push(data);
    } else if (type === IEND) {
      break;
    }

    offset += 12 + length; // 4 length + 4 type + length + 4 CRC
  }

  if (!info) {
    throw new Error("Invalid PNG: missing IHDR chunk");
  }

  // Concatenate IDAT chunks
  const compressedData = concatenateChunks(idatChunks);

  // Decompress with pako
  const rawData = inflate(compressedData);

  // Unfilter and extract pixel data
  const { pixels, alpha } = unfilterAndExtract(rawData, info, palette, transparency);

  return { info, pixels, alpha };
}

/**
 * Parse IHDR chunk to get image info.
 */
function parseIHDR(data: Uint8Array): PngInfo {
  if (data.length < 13) {
    throw new Error("Invalid PNG: IHDR chunk too short");
  }

  const width = readUint32BE(data, 0);
  const height = readUint32BE(data, 4);
  const bitDepth = data[8];
  const colorType = data[9];
  const compressionMethod = data[10];
  const filterMethod = data[11];
  const interlaceMethod = data[12];

  // Validate dimensions to prevent memory bombs
  if (width === 0 || height === 0) {
    throw new Error("Invalid PNG: zero dimension");
  }

  const totalPixels = width * height;
  if (totalPixels > MAX_PIXELS) {
    throw new Error(
      `PNG image too large: ${width}x${height} (${totalPixels} pixels) exceeds limit of ${MAX_PIXELS} pixels`,
    );
  }

  if (compressionMethod !== 0) {
    throw new Error(`Unsupported PNG compression method: ${compressionMethod}`);
  }

  if (filterMethod !== 0) {
    throw new Error(`Unsupported PNG filter method: ${filterMethod}`);
  }

  if (interlaceMethod !== 0) {
    throw new Error("Interlaced PNG images are not supported");
  }

  // Determine if has alpha and components
  let hasAlpha = false;
  let components = 1;
  let colorSpace: "DeviceGray" | "DeviceRGB" = "DeviceGray";

  switch (colorType) {
    case 0: // Grayscale
      components = 1;
      colorSpace = "DeviceGray";
      break;
    case 2: // RGB
      components = 3;
      colorSpace = "DeviceRGB";
      break;
    case 3: // Indexed
      components = 3; // Will be expanded to RGB
      colorSpace = "DeviceRGB";
      break;
    case 4: // Grayscale + Alpha
      components = 1;
      colorSpace = "DeviceGray";
      hasAlpha = true;
      break;
    case 6: // RGBA
      components = 3;
      colorSpace = "DeviceRGB";
      hasAlpha = true;
      break;
    default:
      throw new Error(`Unsupported PNG color type: ${colorType}`);
  }

  return {
    width,
    height,
    colorType,
    bitDepth,
    hasAlpha,
    colorSpace,
    components,
  };
}

/**
 * Unfilter PNG data and extract pixels/alpha.
 */
function unfilterAndExtract(
  data: Uint8Array,
  info: PngInfo,
  palette: Uint8Array | null,
  transparency: Uint8Array | null,
): { pixels: Uint8Array; alpha?: Uint8Array } {
  const { width, height, colorType, bitDepth } = info;

  // Calculate bytes per pixel and row
  let bytesPerPixel: number;

  switch (colorType) {
    case 0: // Grayscale
      bytesPerPixel = Math.ceil(bitDepth / 8);
      break;
    case 2: // RGB
      bytesPerPixel = 3 * Math.ceil(bitDepth / 8);
      break;
    case 3: // Indexed
      bytesPerPixel = 1;
      break;
    case 4: // Grayscale + Alpha
      bytesPerPixel = 2 * Math.ceil(bitDepth / 8);
      break;
    case 6: // RGBA
      bytesPerPixel = 4 * Math.ceil(bitDepth / 8);
      break;
    default:
      throw new Error(`Unsupported color type: ${colorType}`);
  }

  const rowBytes = 1 + Math.ceil((width * bytesPerPixel * 8) / 8); // +1 for filter byte
  const stride = rowBytes - 1; // Bytes per row excluding filter byte

  // Unfilter
  const unfiltered = new Uint8Array(height * stride);
  let prevRow = new Uint8Array(stride);

  for (let y = 0; y < height; y++) {
    const rowStart = y * rowBytes;
    const filterType = data[rowStart];
    const currentRow = data.subarray(rowStart + 1, rowStart + rowBytes);
    const outputRow = unfiltered.subarray(y * stride, (y + 1) * stride);

    unfilterRow(filterType, currentRow, prevRow, outputRow, bytesPerPixel);
    prevRow = outputRow.slice();
  }

  // Extract pixels and alpha based on color type
  if (colorType === 3) {
    // Indexed - expand to RGB
    if (!palette) {
      throw new Error("Invalid PNG: missing palette for indexed image");
    }

    return expandIndexed(unfiltered, width, height, palette, transparency);
  }

  if (colorType === 4) {
    // Grayscale + Alpha - separate alpha channel
    return separateGrayAlpha(unfiltered, width, height);
  }

  if (colorType === 6) {
    // RGBA - separate alpha channel
    return separateRgbAlpha(unfiltered, width, height);
  }

  // Grayscale or RGB without alpha
  // Handle transparency chunk for simple transparency
  if (transparency) {
    if (colorType === 0) {
      // Grayscale transparency
      const transparentGray = (transparency[0] << 8) | transparency[1];

      return applyGrayTransparency(unfiltered, width, height, transparentGray, bitDepth);
    }

    if (colorType === 2) {
      // RGB transparency
      const tr = (transparency[0] << 8) | transparency[1];
      const tg = (transparency[2] << 8) | transparency[3];
      const tb = (transparency[4] << 8) | transparency[5];

      return applyRgbTransparency(unfiltered, width, height, tr, tg, tb, bitDepth);
    }
  }

  return { pixels: unfiltered };
}

/**
 * Apply PNG filter to a row.
 */
function unfilterRow(
  filterType: number,
  current: Uint8Array,
  prev: Uint8Array,
  output: Uint8Array,
  bpp: number,
): void {
  const len = current.length;

  switch (filterType) {
    case 0: // None
      output.set(current);
      break;

    case 1: // Sub
      for (let i = 0; i < len; i++) {
        const left = i >= bpp ? output[i - bpp] : 0;
        output[i] = (current[i] + left) & 0xff;
      }
      break;

    case 2: // Up
      for (let i = 0; i < len; i++) {
        output[i] = (current[i] + prev[i]) & 0xff;
      }
      break;

    case 3: // Average
      for (let i = 0; i < len; i++) {
        const left = i >= bpp ? output[i - bpp] : 0;
        const up = prev[i];
        output[i] = (current[i] + Math.floor((left + up) / 2)) & 0xff;
      }
      break;

    case 4: // Paeth
      for (let i = 0; i < len; i++) {
        const left = i >= bpp ? output[i - bpp] : 0;
        const up = prev[i];
        const upLeft = i >= bpp ? prev[i - bpp] : 0;
        output[i] = (current[i] + paethPredictor(left, up, upLeft)) & 0xff;
      }
      break;

    default:
      throw new Error(`Unknown PNG filter type: ${filterType}`);
  }
}

/**
 * Paeth predictor function.
 */
function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);

  if (pa <= pb && pa <= pc) {
    return a;
  }

  if (pb <= pc) {
    return b;
  }

  return c;
}

/**
 * Expand indexed color to RGB.
 */
function expandIndexed(
  data: Uint8Array,
  width: number,
  height: number,
  palette: Uint8Array,
  transparency: Uint8Array | null,
): { pixels: Uint8Array; alpha?: Uint8Array } {
  const pixels = new Uint8Array(width * height * 3);
  let alpha: Uint8Array | undefined;

  if (transparency) {
    alpha = new Uint8Array(width * height);
    alpha.fill(255); // Default to fully opaque
  }

  for (let i = 0; i < width * height; i++) {
    const idx = data[i];
    pixels[i * 3] = palette[idx * 3];
    pixels[i * 3 + 1] = palette[idx * 3 + 1];
    pixels[i * 3 + 2] = palette[idx * 3 + 2];

    if (alpha && transparency && idx < transparency.length) {
      alpha[i] = transparency[idx];
    }
  }

  // Check if alpha is all 255 (fully opaque)
  if (alpha?.every(v => v === 255)) {
    alpha = undefined;
  }

  return { pixels, alpha };
}

/**
 * Separate grayscale + alpha into gray and alpha.
 */
function separateGrayAlpha(
  data: Uint8Array,
  width: number,
  height: number,
): { pixels: Uint8Array; alpha: Uint8Array } {
  const pixels = new Uint8Array(width * height);
  const alpha = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i++) {
    pixels[i] = data[i * 2];
    alpha[i] = data[i * 2 + 1];
  }

  return { pixels, alpha };
}

/**
 * Separate RGBA into RGB and alpha.
 */
function separateRgbAlpha(
  data: Uint8Array,
  width: number,
  height: number,
): { pixels: Uint8Array; alpha: Uint8Array } {
  const pixels = new Uint8Array(width * height * 3);
  const alpha = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i++) {
    pixels[i * 3] = data[i * 4];
    pixels[i * 3 + 1] = data[i * 4 + 1];
    pixels[i * 3 + 2] = data[i * 4 + 2];
    alpha[i] = data[i * 4 + 3];
  }

  return { pixels, alpha };
}

/**
 * Apply grayscale transparency.
 */
function applyGrayTransparency(
  data: Uint8Array,
  width: number,
  height: number,
  transparentValue: number,
  bitDepth: number,
): { pixels: Uint8Array; alpha: Uint8Array } {
  const alpha = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const value = bitDepth === 16 ? (data[i * 2] << 8) | data[i * 2 + 1] : data[i];
    alpha[i] = value === transparentValue ? 0 : 255;
  }

  // For 16-bit, reduce to 8-bit
  let pixels: Uint8Array;

  if (bitDepth === 16) {
    pixels = new Uint8Array(width * height);

    for (let i = 0; i < width * height; i++) {
      pixels[i] = data[i * 2];
    }
  } else {
    pixels = data;
  }

  return { pixels, alpha };
}

/**
 * Apply RGB transparency.
 */
function applyRgbTransparency(
  data: Uint8Array,
  width: number,
  height: number,
  tr: number,
  tg: number,
  tb: number,
  bitDepth: number,
): { pixels: Uint8Array; alpha: Uint8Array } {
  const alpha = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i++) {
    let r: number;
    let g: number;
    let b: number;

    if (bitDepth === 16) {
      r = (data[i * 6] << 8) | data[i * 6 + 1];
      g = (data[i * 6 + 2] << 8) | data[i * 6 + 3];
      b = (data[i * 6 + 4] << 8) | data[i * 6 + 5];
    } else {
      r = data[i * 3];
      g = data[i * 3 + 1];
      b = data[i * 3 + 2];
    }

    alpha[i] = r === tr && g === tg && b === tb ? 0 : 255;
  }

  // For 16-bit, reduce to 8-bit
  let pixels: Uint8Array;

  if (bitDepth === 16) {
    pixels = new Uint8Array(width * height * 3);

    for (let i = 0; i < width * height; i++) {
      pixels[i * 3] = data[i * 6];
      pixels[i * 3 + 1] = data[i * 6 + 2];
      pixels[i * 3 + 2] = data[i * 6 + 4];
    }
  } else {
    pixels = data;
  }

  return { pixels, alpha };
}

/**
 * Read big-endian uint32.
 */
function readUint32BE(data: Uint8Array, offset: number): number {
  return (
    (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]
  );
}

/**
 * Concatenate multiple Uint8Arrays.
 */
function concatenateChunks(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * Check if data appears to be a PNG image.
 *
 * @param bytes - Data to check
 * @returns true if data starts with PNG signature
 */
export function isPng(bytes: Uint8Array): boolean {
  if (bytes.length < 8) {
    return false;
  }

  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      return false;
    }
  }

  return true;
}
