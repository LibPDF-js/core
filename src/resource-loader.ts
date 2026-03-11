/**
 * ResourceLoader - Universal resource loading utility for PDF files
 *
 * Abstracts resource loading from multiple sources (URLs, File objects, Uint8Array)
 * with authentication support. Works across all runtimes (Node.js, Bun, browsers).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base error class for all ResourceLoader errors.
 */
export class ResourceLoaderError extends Error {
  override name = "ResourceLoaderError";
}

/**
 * Error thrown when a network request fails.
 */
export class NetworkError extends ResourceLoaderError {
  override name = "NetworkError";

  /** HTTP status code, if available */
  readonly status?: number;

  /** HTTP status text, if available */
  readonly statusText?: string;

  constructor(message: string, options?: ErrorOptions & { status?: number; statusText?: string }) {
    super(message, options);
    this.status = options?.status;
    this.statusText = options?.statusText;
  }
}

/**
 * Error thrown when authentication fails (401/403 responses).
 */
export class AuthenticationError extends ResourceLoaderError {
  override name = "AuthenticationError";

  /** HTTP status code (401 or 403) */
  readonly status: number;

  /** WWW-Authenticate header value, if present */
  readonly wwwAuthenticate?: string;

  constructor(
    message: string,
    options: ErrorOptions & { status: number; wwwAuthenticate?: string },
  ) {
    super(message, options);
    this.status = options.status;
    this.wwwAuthenticate = options.wwwAuthenticate;
  }
}

/**
 * Error thrown when the loaded resource is not a valid PDF file.
 */
export class InvalidFileTypeError extends ResourceLoaderError {
  override name = "InvalidFileTypeError";

  /** The detected file type or content, if available */
  readonly detectedType?: string;

  constructor(message: string, options?: ErrorOptions & { detectedType?: string }) {
    super(message, options);
    this.detectedType = options?.detectedType;
  }
}

/**
 * Error thrown when a File object cannot be read.
 */
export class FileReadError extends ResourceLoaderError {
  override name = "FileReadError";

  /** The filename that failed to read */
  readonly filename?: string;

  constructor(message: string, options?: ErrorOptions & { filename?: string }) {
    super(message, options);
    this.filename = options?.filename;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valid input sources for the ResourceLoader.
 */
export type ResourceInput = string | URL | Uint8Array | File | Blob;

/**
 * Authentication configuration for URL fetching.
 */
export interface AuthConfig {
  /** Authorization header value (e.g., "Bearer <token>" or "Basic <credentials>") */
  authorization?: string;

  /** Custom headers to include with the request */
  headers?: Record<string, string>;
}

/**
 * Options for loading a resource.
 */
export interface LoadResourceOptions {
  /** Authentication configuration for URL requests */
  auth?: AuthConfig;

  /** Custom fetch options (merged with defaults) */
  fetchOptions?: RequestInit;

  /** Whether to validate that the loaded data is a PDF (default: false) */
  validatePdf?: boolean;

  /** AbortSignal for cancellation support */
  signal?: AbortSignal;
}

/**
 * Result of loading a resource.
 */
export interface LoadResourceResult {
  /** The loaded data as Uint8Array */
  data: Uint8Array;

  /** The source type that was loaded */
  sourceType: "url" | "file" | "blob" | "bytes";

  /** Original filename, if available (from File or URL) */
  filename?: string;

  /** Content-Type header from URL response, if available */
  contentType?: string;

  /** Content-Length from URL response, if available */
  contentLength?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// ResourceLoader Class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Universal resource loader that normalizes PDF loading from various sources.
 *
 * @example
 * ```ts
 * const loader = new ResourceLoader();
 *
 * // Load from URL with authentication
 * const result = await loader.load("https://example.com/doc.pdf", {
 *   auth: { authorization: "Bearer token123" }
 * });
 *
 * // Load from File object (browser)
 * const fileResult = await loader.load(file);
 *
 * // Load from Uint8Array (passthrough)
 * const bytesResult = await loader.load(pdfBytes);
 * ```
 */
export class ResourceLoader {
  /**
   * Load a resource from various input types and normalize to Uint8Array.
   *
   * @param input - The resource to load (URL string, URL object, Uint8Array, File, or Blob)
   * @param options - Loading options including authentication and validation
   * @returns Promise resolving to the loaded resource data and metadata
   * @throws {NetworkError} When a network request fails
   * @throws {AuthenticationError} When authentication fails (401/403)
   * @throws {InvalidFileTypeError} When validatePdf is true and data is not a PDF
   * @throws {FileReadError} When a File/Blob cannot be read
   */
  async load(input: ResourceInput, options: LoadResourceOptions = {}): Promise<LoadResourceResult> {
    let result: LoadResourceResult;

    if (input instanceof Uint8Array) {
      result = this.loadFromBytes(input);
    } else if (typeof input === "string" || input instanceof URL) {
      result = await this.loadFromUrl(input, options);
    } else if (typeof File !== "undefined" && input instanceof File) {
      result = await this.loadFromFile(input);
    } else if (typeof Blob !== "undefined" && input instanceof Blob) {
      result = await this.loadFromBlob(input);
    } else {
      throw new ResourceLoaderError(
        `Unsupported input type: ${typeof input}. Expected URL string, URL object, Uint8Array, File, or Blob.`,
      );
    }

    // Validate PDF if requested
    if (options.validatePdf) {
      this.validatePdfData(result.data);
    }

    return result;
  }

  /**
   * Load from a Uint8Array (passthrough).
   */
  private loadFromBytes(data: Uint8Array): LoadResourceResult {
    return {
      data,
      sourceType: "bytes",
    };
  }

  /**
   * Load from a URL string or URL object.
   */
  private async loadFromUrl(
    input: string | URL,
    options: LoadResourceOptions,
  ): Promise<LoadResourceResult> {
    const url = typeof input === "string" ? input : input.href;

    // Build headers
    const headers = new Headers(options.fetchOptions?.headers);

    if (options.auth?.authorization) {
      headers.set("Authorization", options.auth.authorization);
    }

    if (options.auth?.headers) {
      for (const [key, value] of Object.entries(options.auth.headers)) {
        headers.set(key, value);
      }
    }

    // Build fetch options
    const fetchOptions: RequestInit = {
      ...options.fetchOptions,
      headers,
      signal: options.signal,
    };

    let response: Response;

    try {
      response = await fetch(url, fetchOptions);
    } catch (error) {
      // Handle network-level errors (DNS, connection refused, etc.)
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw error; // Re-throw abort errors as-is
        }
        throw new NetworkError(`Failed to fetch ${url}: ${error.message}`, { cause: error });
      }
      throw new NetworkError(`Failed to fetch ${url}: Unknown error`, { cause: error });
    }

    // Handle authentication errors
    if (response.status === 401 || response.status === 403) {
      throw new AuthenticationError(
        `Authentication failed for ${url}: ${response.status} ${response.statusText}`,
        {
          status: response.status,
          wwwAuthenticate: response.headers.get("WWW-Authenticate") ?? undefined,
        },
      );
    }

    // Handle other HTTP errors
    if (!response.ok) {
      throw new NetworkError(
        `HTTP error fetching ${url}: ${response.status} ${response.statusText}`,
        {
          status: response.status,
          statusText: response.statusText,
        },
      );
    }

    // Read response body
    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    // Extract filename from URL or Content-Disposition
    const filename = this.extractFilenameFromResponse(url, response);

    return {
      data,
      sourceType: "url",
      filename,
      contentType: response.headers.get("Content-Type") ?? undefined,
      contentLength: data.length,
    };
  }

  /**
   * Load from a File object.
   */
  private async loadFromFile(file: File): Promise<LoadResourceResult> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      return {
        data,
        sourceType: "file",
        filename: file.name,
        contentType: file.type || undefined,
        contentLength: data.length,
      };
    } catch (error) {
      throw new FileReadError(`Failed to read file "${file.name}"`, {
        cause: error,
        filename: file.name,
      });
    }
  }

  /**
   * Load from a Blob object.
   */
  private async loadFromBlob(blob: Blob): Promise<LoadResourceResult> {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      return {
        data,
        sourceType: "blob",
        contentType: blob.type || undefined,
        contentLength: data.length,
      };
    } catch (error) {
      throw new FileReadError("Failed to read Blob", { cause: error });
    }
  }

  /**
   * Extract filename from URL or Content-Disposition header.
   */
  private extractFilenameFromResponse(url: string, response: Response): string | undefined {
    // Try Content-Disposition header first
    const contentDisposition = response.headers.get("Content-Disposition");
    if (contentDisposition) {
      // Parse filename from header: attachment; filename="doc.pdf"
      const filenameMatch = contentDisposition.match(/filename[*]?=['"]?([^'";]+)['"]?/i);
      if (filenameMatch?.[1]) {
        return filenameMatch[1];
      }
    }

    // Fall back to extracting from URL path
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const segments = pathname.split("/");
      const lastSegment = segments[segments.length - 1];

      // Only use if it looks like a filename (has extension)
      if (lastSegment && lastSegment.includes(".")) {
        return decodeURIComponent(lastSegment);
      }
    } catch {
      // Invalid URL, ignore
    }

    return undefined;
  }

  /**
   * Validate that the data starts with a PDF header.
   */
  private validatePdfData(data: Uint8Array): void {
    // PDF files start with "%PDF-" (0x25 0x50 0x44 0x46 0x2D)
    if (data.length < 5) {
      throw new InvalidFileTypeError("Data is too small to be a valid PDF file", {
        detectedType: `${data.length} bytes`,
      });
    }

    const header = String.fromCharCode(data[0], data[1], data[2], data[3], data[4]);
    if (header !== "%PDF-") {
      // Try to detect what type of file it might be
      const detectedType = this.detectFileType(data);
      throw new InvalidFileTypeError(
        `Data does not appear to be a PDF file (expected "%PDF-" header)`,
        { detectedType },
      );
    }
  }

  /**
   * Attempt to detect the file type from magic bytes.
   */
  private detectFileType(data: Uint8Array): string | undefined {
    if (data.length < 4) {
      return undefined;
    }

    // Common file signatures
    const sig = Array.from(data.slice(0, 8));

    // PNG: 89 50 4E 47
    if (sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4e && sig[3] === 0x47) {
      return "PNG image";
    }

    // JPEG: FF D8 FF
    if (sig[0] === 0xff && sig[1] === 0xd8 && sig[2] === 0xff) {
      return "JPEG image";
    }

    // GIF: 47 49 46 38
    if (sig[0] === 0x47 && sig[1] === 0x49 && sig[2] === 0x46 && sig[3] === 0x38) {
      return "GIF image";
    }

    // ZIP/DOCX/XLSX: 50 4B 03 04
    if (sig[0] === 0x50 && sig[1] === 0x4b && sig[2] === 0x03 && sig[3] === 0x04) {
      return "ZIP archive (possibly DOCX/XLSX)";
    }

    // Try to interpret as text
    const isText = sig.slice(0, 4).every(b => b >= 0x09 && b <= 0x7e);
    if (isText) {
      const preview = String.fromCharCode.apply(null, Array.from(data.slice(0, 20)));
      return `Text content: "${preview.trim()}..."`;
    }

    return `Unknown (starts with ${sig
      .slice(0, 4)
      .map(b => b.toString(16).padStart(2, "0"))
      .join(" ")})`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new ResourceLoader instance.
 */
export function createResourceLoader(): ResourceLoader {
  return new ResourceLoader();
}

/**
 * Convenience function to load a resource without creating a loader instance.
 *
 * @example
 * ```ts
 * const { data } = await loadResource("https://example.com/doc.pdf");
 * const pdf = await PDF.load(data);
 * ```
 */
export async function loadResource(
  input: ResourceInput,
  options?: LoadResourceOptions,
): Promise<LoadResourceResult> {
  const loader = new ResourceLoader();
  return loader.load(input, options);
}
