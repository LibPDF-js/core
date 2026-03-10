/**
 * Tests for WorkerProxy class.
 *
 * Uses the same Mock Worker approach as pdf-worker.test.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type WorkerResponse, createSuccessResponse } from "./messages";
import { createWorkerProxy, WorkerProxy } from "./worker-proxy";

// Mock Worker class
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  private _terminated = false;

  constructor(
    public url: string | URL,
    public options?: WorkerOptions,
  ) {}

  postMessage(message: unknown, transfer?: Transferable[]): void {
    if (this._terminated) {
      throw new Error("Worker has been terminated");
    }
    queueMicrotask(() => {
      this._handleMessage(message);
    });
  }

  terminate(): void {
    this._terminated = true;
  }

  private _handleMessage(message: unknown): void {
    if (!this.onmessage) {
      return;
    }

    const request = message as { type: string; id: string; requestType: string; data?: unknown };

    if (request.requestType === "init") {
      const response: WorkerResponse = createSuccessResponse(request.id, "init", {
        ready: true,
        version: "1.0.0",
      });
      this.onmessage(new MessageEvent("message", { data: response }));
    } else if (request.requestType === "terminate") {
      const response: WorkerResponse = createSuccessResponse(request.id, "terminate", undefined);
      this.onmessage(new MessageEvent("message", { data: response }));
    } else if (request.requestType === "load") {
      const data = request.data as { documentId: string };
      const response: WorkerResponse = createSuccessResponse(request.id, "load", {
        documentId: data.documentId,
        pageCount: 10,
        metadata: {
          title: "Test Document",
          author: "Test Author",
        },
        isEncrypted: false,
        hasForms: true,
        hasSignatures: false,
      });
      this.onmessage(new MessageEvent("message", { data: response }));
    } else if (request.requestType === "save") {
      const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
      const response: WorkerResponse = createSuccessResponse(request.id, "save", {
        bytes,
        size: bytes.length,
      });
      this.onmessage(new MessageEvent("message", { data: response }));
    } else if (request.requestType === "extractText") {
      const data = request.data as { pageIndices?: number[] };
      const pages = (data.pageIndices ?? [0, 1, 2]).map(i => ({
        pageIndex: i,
        text: `Text content of page ${i + 1}`,
      }));
      const response: WorkerResponse = createSuccessResponse(request.id, "extractText", {
        pages,
      });
      this.onmessage(new MessageEvent("message", { data: response }));
    } else if (request.requestType === "findText") {
      const data = request.data as { pattern: string };
      const response: WorkerResponse = createSuccessResponse(request.id, "findText", {
        matches: [
          { pageIndex: 0, text: data.pattern, offset: 10, bounds: [100, 200, 50, 20] as const },
          { pageIndex: 2, text: data.pattern, offset: 5, bounds: [150, 300, 50, 20] as const },
        ],
        totalCount: 2,
      });
      this.onmessage(new MessageEvent("message", { data: response }));
    }
  }
}

const originalWorker = globalThis.Worker;

beforeEach(() => {
  globalThis.Worker = MockWorker as unknown as typeof Worker;
});

afterEach(() => {
  globalThis.Worker = originalWorker;
});

describe("WorkerProxy", () => {
  describe("construction", () => {
    it("creates a proxy with default options", () => {
      const proxy = new WorkerProxy({ workerUrl: "/pdf-worker.js" });

      expect(proxy).toBeInstanceOf(WorkerProxy);
      expect(proxy.state).toBe("idle");
      expect(proxy.isReady).toBe(false);
      expect(proxy.documentCount).toBe(0);
    });

    it("creates a proxy with autoInit enabled by default", () => {
      const proxy = new WorkerProxy({ workerUrl: "/pdf-worker.js" });

      // autoInit is true by default
      expect(proxy).toBeInstanceOf(WorkerProxy);
    });

    it("creates a proxy with autoInit disabled", () => {
      const proxy = new WorkerProxy({
        workerUrl: "/pdf-worker.js",
        autoInit: false,
      });

      expect(proxy.isReady).toBe(false);
    });

    it("createWorkerProxy factory function works", () => {
      const proxy = createWorkerProxy({ workerUrl: "/pdf-worker.js" });

      expect(proxy).toBeInstanceOf(WorkerProxy);
    });
  });

  describe("initialization", () => {
    it("initializes manually", async () => {
      const proxy = new WorkerProxy({
        workerUrl: "/pdf-worker.js",
        autoInit: false,
      });

      await proxy.initialize();

      expect(proxy.isReady).toBe(true);
    });

    it("auto-initializes on first operation", async () => {
      const proxy = new WorkerProxy({ workerUrl: "/pdf-worker.js" });

      expect(proxy.isReady).toBe(false);

      await proxy.load(new Uint8Array([0x25, 0x50, 0x44, 0x46]));

      expect(proxy.isReady).toBe(true);
    });

    it("throws when autoInit is disabled and not initialized", async () => {
      const proxy = new WorkerProxy({
        workerUrl: "/pdf-worker.js",
        autoInit: false,
      });

      await expect(proxy.load(new Uint8Array())).rejects.toThrow("not initialized");
    });
  });

  describe("document loading", () => {
    it("loads a document", async () => {
      const proxy = new WorkerProxy({ workerUrl: "/pdf-worker.js" });

      const doc = await proxy.load(new Uint8Array([0x25, 0x50, 0x44, 0x46]));

      expect(doc).toBeDefined();
      expect(doc.documentId).toMatch(/^doc-\d+-\d+$/);
      expect(doc.pageCount).toBe(10);
      expect(doc.metadata.title).toBe("Test Document");
      expect(doc.metadata.author).toBe("Test Author");
      expect(doc.isEncrypted).toBe(false);
      expect(doc.hasForms).toBe(true);
      expect(doc.hasSignatures).toBe(false);
    });

    it("loads multiple documents", async () => {
      const proxy = new WorkerProxy({ workerUrl: "/pdf-worker.js" });

      const doc1 = await proxy.load(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
      const doc2 = await proxy.load(new Uint8Array([0x25, 0x50, 0x44, 0x46]));

      expect(doc1.documentId).not.toBe(doc2.documentId);
      expect(proxy.documentCount).toBe(2);
    });

    it("tracks loaded documents", async () => {
      const proxy = new WorkerProxy({ workerUrl: "/pdf-worker.js" });

      const doc = await proxy.load(new Uint8Array([0x25, 0x50, 0x44, 0x46]));

      expect(proxy.getDocument(doc.documentId)).toBe(doc);
      expect(proxy.getDocumentIds()).toContain(doc.documentId);
    });

    it("loads with password", async () => {
      const proxy = new WorkerProxy({ workerUrl: "/pdf-worker.js" });

      const doc = await proxy.load(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
        password: "secret",
      });

      expect(doc).toBeDefined();
    });

    it("loads with timeout", async () => {
      const proxy = new WorkerProxy({ workerUrl: "/pdf-worker.js" });

      const doc = await proxy.load(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
        timeout: 30000,
      });

      expect(doc).toBeDefined();
    });

    it("loadCancellable returns cancellable operation", async () => {
      const proxy = new WorkerProxy({ workerUrl: "/pdf-worker.js" });
      await proxy.initialize();

      const operation = proxy.loadCancellable(new Uint8Array([0x25, 0x50, 0x44, 0x46]));

      expect(operation.promise).toBeInstanceOf(Promise);
      expect(typeof operation.cancel).toBe("function");
      expect(operation.taskId).toBeDefined();

      const doc = await operation.promise;
      expect(doc.pageCount).toBe(10);
    });
  });

  describe("document saving", () => {
    it("saves a document", async () => {
      const proxy = new WorkerProxy({ workerUrl: "/pdf-worker.js" });
      const doc = await proxy.load(new Uint8Array([0x25, 0x50, 0x44, 0x46]));

      const savedBytes = await proxy.save(doc.documentId);

      expect(savedBytes).toBeInstanceOf(Uint8Array);
      expect(savedBytes.length).toBeGreaterThan(0);
    });

    it("saves with incremental option", async () => {
      const proxy = new WorkerProxy({ workerUrl: "/pdf-worker.js" });
      const doc = await proxy.load(new Uint8Array([0x25, 0x50, 0x44, 0x46]));

      const savedBytes = await proxy.save(doc.documentId, { incremental: true });

      expect(savedBytes).toBeInstanceOf(Uint8Array);
    });

    it("saves with encryption options", async () => {
      const proxy = new WorkerProxy({ workerUrl: "/pdf-worker.js" });
      const doc = await proxy.load(new Uint8Array([0x25, 0x50, 0x44, 0x46]));

      const savedBytes = await proxy.save(doc.documentId, {
        encrypt: {
          userPassword: "user123",
          ownerPassword: "owner456",
          permissions: 0xf00,
        },
      });

      expect(savedBytes).toBeInstanceOf(Uint8Array);
    });

    it("throws when saving unknown document", async () => {
      const proxy = new WorkerProxy({ workerUrl: "/pdf-worker.js" });
      await proxy.initialize();

      await expect(proxy.save("unknown-doc")).rejects.toThrow("Document not found");
    });
  });

  describe("document unloading", () => {
    it("unloads a document", async () => {
      const proxy = new WorkerProxy({ workerUrl: "/pdf-worker.js" });
      const doc = await proxy.load(new Uint8Array([0x25, 0x50, 0x44, 0x46]));

      const result = proxy.unload(doc.documentId);

      expect(result).toBe(true);
      expect(proxy.documentCount).toBe(0);
      expect(proxy.getDocument(doc.documentId)).toBeUndefined();
    });

    it("returns false when unloading unknown document", async () => {
      const proxy = new WorkerProxy({ workerUrl: "/pdf-worker.js" });
      await proxy.initialize();

      const result = proxy.unload("unknown-doc");

      expect(result).toBe(false);
    });
  });

  describe("text extraction", () => {
    it("extracts text from all pages", async () => {
      const proxy = new WorkerProxy({ workerUrl: "/pdf-worker.js" });
      const doc = await proxy.load(new Uint8Array([0x25, 0x50, 0x44, 0x46]));

      const pages = await proxy.extractText(doc.documentId);

      expect(pages).toBeInstanceOf(Array);
      expect(pages.length).toBeGreaterThan(0);
      expect(pages[0]).toHaveProperty("pageIndex");
      expect(pages[0]).toHaveProperty("text");
    });

    it("extracts text from specific pages", async () => {
      const proxy = new WorkerProxy({ workerUrl: "/pdf-worker.js" });
      const doc = await proxy.load(new Uint8Array([0x25, 0x50, 0x44, 0x46]));

      const pages = await proxy.extractText(doc.documentId, { pages: [0, 2] });

      expect(pages).toHaveLength(2);
      expect(pages[0].pageIndex).toBe(0);
      expect(pages[1].pageIndex).toBe(2);
    });

    it("throws when extracting from unknown document", async () => {
      const proxy = new WorkerProxy({ workerUrl: "/pdf-worker.js" });
      await proxy.initialize();

      await expect(proxy.extractText("unknown-doc")).rejects.toThrow("Document not found");
    });
  });

  describe("text search", () => {
    it("finds text in document", async () => {
      const proxy = new WorkerProxy({ workerUrl: "/pdf-worker.js" });
      const doc = await proxy.load(new Uint8Array([0x25, 0x50, 0x44, 0x46]));

      const result = await proxy.findText(doc.documentId, "test");

      expect(result.matches).toBeInstanceOf(Array);
      expect(result.totalCount).toBe(2);
      expect(result.matches[0]).toHaveProperty("pageIndex");
      expect(result.matches[0]).toHaveProperty("text");
      expect(result.matches[0]).toHaveProperty("offset");
    });

    it("finds text with regex", async () => {
      const proxy = new WorkerProxy({ workerUrl: "/pdf-worker.js" });
      const doc = await proxy.load(new Uint8Array([0x25, 0x50, 0x44, 0x46]));

      const result = await proxy.findText(doc.documentId, "test.*pattern", {
        regex: true,
      });

      expect(result.matches).toBeInstanceOf(Array);
    });

    it("finds text case-sensitively", async () => {
      const proxy = new WorkerProxy({ workerUrl: "/pdf-worker.js" });
      const doc = await proxy.load(new Uint8Array([0x25, 0x50, 0x44, 0x46]));

      const result = await proxy.findText(doc.documentId, "Test", {
        caseSensitive: true,
      });

      expect(result).toBeDefined();
    });

    it("finds text in specific pages", async () => {
      const proxy = new WorkerProxy({ workerUrl: "/pdf-worker.js" });
      const doc = await proxy.load(new Uint8Array([0x25, 0x50, 0x44, 0x46]));

      const result = await proxy.findText(doc.documentId, "test", {
        pages: [0, 1],
      });

      expect(result).toBeDefined();
    });

    it("returns match bounds", async () => {
      const proxy = new WorkerProxy({ workerUrl: "/pdf-worker.js" });
      const doc = await proxy.load(new Uint8Array([0x25, 0x50, 0x44, 0x46]));

      const result = await proxy.findText(doc.documentId, "test");

      expect(result.matches[0].bounds).toBeDefined();
      expect(result.matches[0].bounds).toHaveLength(4);
    });

    it("throws when searching unknown document", async () => {
      const proxy = new WorkerProxy({ workerUrl: "/pdf-worker.js" });
      await proxy.initialize();

      await expect(proxy.findText("unknown-doc", "test")).rejects.toThrow("Document not found");
    });
  });

  describe("cleanup", () => {
    it("destroys the proxy", async () => {
      const proxy = new WorkerProxy({ workerUrl: "/pdf-worker.js" });
      const doc = await proxy.load(new Uint8Array([0x25, 0x50, 0x44, 0x46]));

      await proxy.destroy();

      expect(proxy.state).toBe("terminated");
      expect(proxy.documentCount).toBe(0);
    });

    it("can be destroyed without initialization", async () => {
      const proxy = new WorkerProxy({
        workerUrl: "/pdf-worker.js",
        autoInit: false,
      });

      await proxy.destroy();

      expect(proxy.state).toBe("terminated");
    });
  });

  describe("document ID generation", () => {
    it("generates unique document IDs", async () => {
      const proxy = new WorkerProxy({ workerUrl: "/pdf-worker.js" });

      const doc1 = await proxy.load(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
      const doc2 = await proxy.load(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
      const doc3 = await proxy.load(new Uint8Array([0x25, 0x50, 0x44, 0x46]));

      const ids = new Set([doc1.documentId, doc2.documentId, doc3.documentId]);
      expect(ids.size).toBe(3);
    });
  });
});
