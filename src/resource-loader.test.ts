/**
 * Tests for ResourceLoader
 */

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  AuthenticationError,
  createResourceLoader,
  FileReadError,
  InvalidFileTypeError,
  loadResource,
  NetworkError,
  ResourceLoader,
  ResourceLoaderError,
} from "./resource-loader";
import { loadFixture } from "./test-utils";

// ─────────────────────────────────────────────────────────────────────────────
// Mock Server Setup
// ─────────────────────────────────────────────────────────────────────────────

let server: Server;
let baseUrl: string;
let pdfBytes: Uint8Array;

beforeAll(async () => {
  // Load a real PDF fixture for testing
  pdfBytes = await loadFixture("basic", "rot0.pdf");

  // Create a mock HTTP server
  server = createServer((req, res) => {
    const url = req.url ?? "/";

    // Successful PDF response
    if (url === "/doc.pdf") {
      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Length": pdfBytes.length.toString(),
      });
      res.end(Buffer.from(pdfBytes));
      return;
    }

    // PDF with Content-Disposition header
    if (url === "/download") {
      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="downloaded.pdf"',
      });
      res.end(Buffer.from(pdfBytes));
      return;
    }

    // Protected resource requiring auth
    if (url === "/protected.pdf") {
      const auth = req.headers.authorization;
      if (auth === "Bearer valid-token") {
        res.writeHead(200, { "Content-Type": "application/pdf" });
        res.end(Buffer.from(pdfBytes));
      } else {
        res.writeHead(401, {
          "WWW-Authenticate": 'Bearer realm="test"',
        });
        res.end("Unauthorized");
      }
      return;
    }

    // Forbidden resource
    if (url === "/forbidden.pdf") {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    // Server error
    if (url === "/error") {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
      return;
    }

    // HTML response (not PDF)
    if (url === "/page.html") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><body>Not a PDF</body></html>");
      return;
    }

    // PNG image (not PDF)
    if (url === "/image.png") {
      // PNG magic bytes
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      res.writeHead(200, { "Content-Type": "image/png" });
      res.end(Buffer.from(pngBytes));
      return;
    }

    // 404
    res.writeHead(404);
    res.end("Not Found");
  });

  // Start server and get URL
  await new Promise<void>(resolve => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

afterAll(() => {
  server?.close();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("ResourceLoader", () => {
  describe("constructor and factory", () => {
    it("creates an instance with new", () => {
      const loader = new ResourceLoader();
      expect(loader).toBeInstanceOf(ResourceLoader);
    });

    it("creates an instance with factory function", () => {
      const loader = createResourceLoader();
      expect(loader).toBeInstanceOf(ResourceLoader);
    });
  });

  describe("loading from Uint8Array", () => {
    it("passes through Uint8Array data unchanged", async () => {
      const loader = new ResourceLoader();
      const input = new Uint8Array([1, 2, 3, 4, 5]);

      const result = await loader.load(input);

      expect(result.data).toBe(input); // Same reference
      expect(result.sourceType).toBe("bytes");
      expect(result.filename).toBeUndefined();
      expect(result.contentType).toBeUndefined();
    });

    it("validates PDF when validatePdf option is true", async () => {
      const loader = new ResourceLoader();

      const result = await loader.load(pdfBytes, { validatePdf: true });
      expect(result.data).toBe(pdfBytes);
    });

    it("throws InvalidFileTypeError for non-PDF when validatePdf is true", async () => {
      const loader = new ResourceLoader();
      const notPdf = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG header

      await expect(loader.load(notPdf, { validatePdf: true })).rejects.toThrow(
        InvalidFileTypeError,
      );
    });
  });

  describe("loading from URL", () => {
    it("loads PDF from URL string", async () => {
      const loader = new ResourceLoader();

      const result = await loader.load(`${baseUrl}/doc.pdf`);

      expect(result.data).toEqual(pdfBytes);
      expect(result.sourceType).toBe("url");
      expect(result.filename).toBe("doc.pdf");
      expect(result.contentType).toBe("application/pdf");
      expect(result.contentLength).toBe(pdfBytes.length);
    });

    it("loads PDF from URL object", async () => {
      const loader = new ResourceLoader();
      const url = new URL(`${baseUrl}/doc.pdf`);

      const result = await loader.load(url);

      expect(result.data).toEqual(pdfBytes);
      expect(result.sourceType).toBe("url");
    });

    it("extracts filename from Content-Disposition header", async () => {
      const loader = new ResourceLoader();

      const result = await loader.load(`${baseUrl}/download`);

      expect(result.filename).toBe("downloaded.pdf");
    });

    it("loads with authentication header", async () => {
      const loader = new ResourceLoader();

      const result = await loader.load(`${baseUrl}/protected.pdf`, {
        auth: { authorization: "Bearer valid-token" },
      });

      expect(result.data).toEqual(pdfBytes);
    });

    it("throws AuthenticationError for 401 response", async () => {
      const loader = new ResourceLoader();

      try {
        await loader.load(`${baseUrl}/protected.pdf`);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthenticationError);
        const authError = error as AuthenticationError;
        expect(authError.status).toBe(401);
        expect(authError.wwwAuthenticate).toBe('Bearer realm="test"');
      }
    });

    it("throws AuthenticationError for 403 response", async () => {
      const loader = new ResourceLoader();

      try {
        await loader.load(`${baseUrl}/forbidden.pdf`);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthenticationError);
        const authError = error as AuthenticationError;
        expect(authError.status).toBe(403);
      }
    });

    it("throws NetworkError for 500 response", async () => {
      const loader = new ResourceLoader();

      try {
        await loader.load(`${baseUrl}/error`);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(NetworkError);
        const netError = error as NetworkError;
        expect(netError.status).toBe(500);
      }
    });

    it("throws NetworkError for 404 response", async () => {
      const loader = new ResourceLoader();

      try {
        await loader.load(`${baseUrl}/nonexistent`);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(NetworkError);
        const netError = error as NetworkError;
        expect(netError.status).toBe(404);
      }
    });

    it("throws NetworkError for connection failures", async () => {
      const loader = new ResourceLoader();

      // Use a port that's unlikely to be in use
      await expect(loader.load("http://127.0.0.1:59999/doc.pdf")).rejects.toThrow(NetworkError);
    });

    it("supports custom headers via auth.headers", async () => {
      const loader = new ResourceLoader();

      const result = await loader.load(`${baseUrl}/protected.pdf`, {
        auth: {
          headers: { Authorization: "Bearer valid-token" },
        },
      });

      expect(result.data).toEqual(pdfBytes);
    });

    it("validates PDF content when requested", async () => {
      const loader = new ResourceLoader();

      await expect(loader.load(`${baseUrl}/image.png`, { validatePdf: true })).rejects.toThrow(
        InvalidFileTypeError,
      );
    });
  });

  describe("loading from File", () => {
    it("loads from File object", async () => {
      const loader = new ResourceLoader();
      const file = new File([pdfBytes], "test.pdf", { type: "application/pdf" });

      const result = await loader.load(file);

      expect(result.data).toEqual(pdfBytes);
      expect(result.sourceType).toBe("file");
      expect(result.filename).toBe("test.pdf");
      expect(result.contentType).toBe("application/pdf");
      expect(result.contentLength).toBe(pdfBytes.length);
    });

    it("handles File with empty type", async () => {
      const loader = new ResourceLoader();
      const file = new File([pdfBytes], "test.pdf");

      const result = await loader.load(file);

      expect(result.contentType).toBeUndefined();
    });
  });

  describe("loading from Blob", () => {
    it("loads from Blob object", async () => {
      const loader = new ResourceLoader();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });

      const result = await loader.load(blob);

      expect(result.data).toEqual(pdfBytes);
      expect(result.sourceType).toBe("blob");
      expect(result.filename).toBeUndefined();
      expect(result.contentType).toBe("application/pdf");
      expect(result.contentLength).toBe(pdfBytes.length);
    });
  });

  describe("PDF validation", () => {
    it("detects PNG images", async () => {
      const loader = new ResourceLoader();
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

      try {
        await loader.load(pngBytes, { validatePdf: true });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidFileTypeError);
        const typeError = error as InvalidFileTypeError;
        expect(typeError.detectedType).toBe("PNG image");
      }
    });

    it("detects JPEG images", async () => {
      const loader = new ResourceLoader();
      const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

      try {
        await loader.load(jpegBytes, { validatePdf: true });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidFileTypeError);
        const typeError = error as InvalidFileTypeError;
        expect(typeError.detectedType).toBe("JPEG image");
      }
    });

    it("detects GIF images", async () => {
      const loader = new ResourceLoader();
      const gifBytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);

      try {
        await loader.load(gifBytes, { validatePdf: true });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidFileTypeError);
        const typeError = error as InvalidFileTypeError;
        expect(typeError.detectedType).toBe("GIF image");
      }
    });

    it("detects ZIP archives", async () => {
      const loader = new ResourceLoader();
      const zipBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x0a, 0x00]);

      try {
        await loader.load(zipBytes, { validatePdf: true });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidFileTypeError);
        const typeError = error as InvalidFileTypeError;
        expect(typeError.detectedType).toContain("ZIP");
      }
    });

    it("reports text content for text files", async () => {
      const loader = new ResourceLoader();
      const textBytes = new Uint8Array("Hello, World!".split("").map(c => c.charCodeAt(0)));

      try {
        await loader.load(textBytes, { validatePdf: true });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidFileTypeError);
        const typeError = error as InvalidFileTypeError;
        expect(typeError.detectedType).toContain("Text content");
      }
    });

    it("rejects data that is too small", async () => {
      const loader = new ResourceLoader();
      const tinyBytes = new Uint8Array([0x25, 0x50]); // Just "%P"

      try {
        await loader.load(tinyBytes, { validatePdf: true });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidFileTypeError);
        expect((error as InvalidFileTypeError).message).toContain("too small");
      }
    });
  });

  describe("error types", () => {
    it("ResourceLoaderError is the base error class", () => {
      const error = new ResourceLoaderError("test");
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("ResourceLoaderError");
    });

    it("NetworkError includes status and statusText", () => {
      const error = new NetworkError("test", { status: 500, statusText: "Server Error" });
      expect(error).toBeInstanceOf(ResourceLoaderError);
      expect(error.name).toBe("NetworkError");
      expect(error.status).toBe(500);
      expect(error.statusText).toBe("Server Error");
    });

    it("AuthenticationError includes status and wwwAuthenticate", () => {
      const error = new AuthenticationError("test", {
        status: 401,
        wwwAuthenticate: 'Basic realm="test"',
      });
      expect(error).toBeInstanceOf(ResourceLoaderError);
      expect(error.name).toBe("AuthenticationError");
      expect(error.status).toBe(401);
      expect(error.wwwAuthenticate).toBe('Basic realm="test"');
    });

    it("InvalidFileTypeError includes detectedType", () => {
      const error = new InvalidFileTypeError("test", { detectedType: "PNG image" });
      expect(error).toBeInstanceOf(ResourceLoaderError);
      expect(error.name).toBe("InvalidFileTypeError");
      expect(error.detectedType).toBe("PNG image");
    });

    it("FileReadError includes filename", () => {
      const error = new FileReadError("test", { filename: "test.pdf" });
      expect(error).toBeInstanceOf(ResourceLoaderError);
      expect(error.name).toBe("FileReadError");
      expect(error.filename).toBe("test.pdf");
    });
  });

  describe("unsupported input types", () => {
    it("throws ResourceLoaderError for invalid input", async () => {
      const loader = new ResourceLoader();

      // @ts-expect-error Testing invalid input
      await expect(loader.load(123)).rejects.toThrow(ResourceLoaderError);
    });
  });

  describe("loadResource convenience function", () => {
    it("loads without creating an instance", async () => {
      const result = await loadResource(pdfBytes);

      expect(result.data).toBe(pdfBytes);
      expect(result.sourceType).toBe("bytes");
    });

    it("supports options", async () => {
      await expect(loadResource(new Uint8Array([1, 2, 3]), { validatePdf: true })).rejects.toThrow(
        InvalidFileTypeError,
      );
    });
  });

  describe("abort signal support", () => {
    it("supports AbortSignal for cancellation", async () => {
      const loader = new ResourceLoader();
      const controller = new AbortController();

      // Abort immediately
      controller.abort();

      await expect(
        loader.load(`${baseUrl}/doc.pdf`, { signal: controller.signal }),
      ).rejects.toThrow();
    });
  });
});
