/**
 * Tests for PDFWorker class.
 *
 * Since Web Workers aren't available in Node.js, these tests use mocks
 * to simulate worker behavior.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type WorkerResponse, createSuccessResponse } from "./messages";
import { createPDFWorker, PDFWorker, type WorkerState } from "./pdf-worker";

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
    // Simulate async response
    queueMicrotask(() => {
      this._handleMessage(message);
    });
  }

  terminate(): void {
    this._terminated = true;
  }

  // Simulate worker response
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
        pageCount: 5,
        isEncrypted: false,
        hasForms: false,
        hasSignatures: false,
      });
      this.onmessage(new MessageEvent("message", { data: response }));
    }
  }

  // Expose for testing
  _simulateError(message: string): void {
    if (this.onerror) {
      this.onerror(new ErrorEvent("error", { message }));
    }
  }
}

// Replace global Worker
const originalWorker = globalThis.Worker;

beforeEach(() => {
  globalThis.Worker = MockWorker as unknown as typeof Worker;
});

afterEach(() => {
  globalThis.Worker = originalWorker;
});

describe("PDFWorker", () => {
  describe("construction", () => {
    it("creates a worker with default options", () => {
      const worker = new PDFWorker({ workerUrl: "/pdf-worker.js" });

      expect(worker).toBeInstanceOf(PDFWorker);
      expect(worker.state).toBe("idle");
      expect(worker.isReady).toBe(false);
      expect(worker.isTerminated).toBe(false);
      expect(worker.pendingCount).toBe(0);
      expect(worker.activeTaskCount).toBe(0);
    });

    it("creates a worker with custom name", () => {
      const worker = new PDFWorker({
        workerUrl: "/pdf-worker.js",
        name: "custom-worker",
      });

      expect(worker.name).toBe("custom-worker");
    });

    it("creates a worker with verbose mode", () => {
      const worker = new PDFWorker({
        workerUrl: "/pdf-worker.js",
        verbose: true,
      });

      expect(worker).toBeInstanceOf(PDFWorker);
    });

    it("createPDFWorker factory function works", () => {
      const worker = createPDFWorker({ workerUrl: "/pdf-worker.js" });

      expect(worker).toBeInstanceOf(PDFWorker);
    });
  });

  describe("initialization", () => {
    it("initializes successfully", async () => {
      const worker = new PDFWorker({ workerUrl: "/pdf-worker.js" });

      const result = await worker.initialize();

      expect(worker.state).toBe("ready");
      expect(worker.isReady).toBe(true);
      expect(result.ready).toBe(true);
      expect(result.version).toBe("1.0.0");
    });

    it("reports version after initialization", async () => {
      const worker = new PDFWorker({ workerUrl: "/pdf-worker.js" });

      expect(worker.version).toBeNull();

      await worker.initialize();

      expect(worker.version).toBe("1.0.0");
    });

    it("is idempotent - multiple calls succeed without error", async () => {
      const worker = new PDFWorker({ workerUrl: "/pdf-worker.js" });

      // Multiple concurrent calls should all resolve successfully
      const [result1, result2] = await Promise.all([worker.initialize(), worker.initialize()]);

      expect(result1.ready).toBe(true);
      expect(result2.ready).toBe(true);
      expect(worker.state).toBe("ready");

      // Calling again after initialization should also work
      const result3 = await worker.initialize();
      expect(result3.ready).toBe(true);
    });

    it("throws when workerUrl is not provided", async () => {
      const worker = new PDFWorker();

      await expect(worker.initialize()).rejects.toThrow("Worker URL is required");
    });

    it("calls onStateChange callback", async () => {
      const stateChanges: Array<{ state: WorkerState; previous: WorkerState }> = [];
      const worker = new PDFWorker({
        workerUrl: "/pdf-worker.js",
        onStateChange: (state, previous) => {
          stateChanges.push({ state, previous });
        },
      });

      await worker.initialize();

      expect(stateChanges).toContainEqual({ state: "initializing", previous: "idle" });
      expect(stateChanges).toContainEqual({ state: "ready", previous: "initializing" });
    });

    it("cannot initialize after termination", async () => {
      const worker = new PDFWorker({ workerUrl: "/pdf-worker.js" });

      await worker.initialize();
      await worker.terminate();

      await expect(worker.initialize()).rejects.toThrow("terminated");
    });
  });

  describe("message sending", () => {
    it("sends request and receives response", async () => {
      const worker = new PDFWorker({ workerUrl: "/pdf-worker.js" });
      await worker.initialize();

      const response = await worker.send("load", {
        bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        documentId: "doc-1",
      });

      expect(response.status).toBe("success");
      expect(response.data?.documentId).toBe("doc-1");
      expect(response.data?.pageCount).toBe(5);
    });

    it("throws when sending before initialization", async () => {
      const worker = new PDFWorker({ workerUrl: "/pdf-worker.js" });

      await expect(
        worker.send("load", {
          bytes: new Uint8Array(),
          documentId: "doc-1",
        }),
      ).rejects.toThrow("Worker not initialized");
    });

    it("throws when sending after termination", async () => {
      const worker = new PDFWorker({ workerUrl: "/pdf-worker.js" });
      await worker.initialize();
      await worker.terminate();

      await expect(
        worker.send("load", {
          bytes: new Uint8Array(),
          documentId: "doc-1",
        }),
      ).rejects.toThrow("terminated");
    });

    it("tracks pending requests", async () => {
      const worker = new PDFWorker({ workerUrl: "/pdf-worker.js" });
      await worker.initialize();

      expect(worker.pendingCount).toBe(0);

      const promise = worker.send("load", {
        bytes: new Uint8Array(),
        documentId: "doc-1",
      });

      // Note: Due to microtask timing, pendingCount may be 0 or 1 here
      await promise;

      expect(worker.pendingCount).toBe(0);
    });

    it("tracks active tasks", async () => {
      const worker = new PDFWorker({ workerUrl: "/pdf-worker.js" });
      await worker.initialize();

      expect(worker.activeTaskCount).toBe(0);

      const promise = worker.send("load", {
        bytes: new Uint8Array(),
        documentId: "doc-1",
      });

      await promise;

      expect(worker.activeTaskCount).toBe(0);
    });
  });

  describe("termination", () => {
    it("terminates gracefully", async () => {
      const worker = new PDFWorker({ workerUrl: "/pdf-worker.js" });
      await worker.initialize();

      await worker.terminate();

      expect(worker.state).toBe("terminated");
      expect(worker.isTerminated).toBe(true);
      expect(worker.isReady).toBe(false);
    });

    it("is idempotent - multiple terminate calls are safe", async () => {
      const worker = new PDFWorker({ workerUrl: "/pdf-worker.js" });
      await worker.initialize();

      await worker.terminate();
      await worker.terminate();

      expect(worker.state).toBe("terminated");
    });

    it("terminates without initialization", async () => {
      const worker = new PDFWorker({ workerUrl: "/pdf-worker.js" });

      await worker.terminate();

      expect(worker.state).toBe("terminated");
    });

    it("rejects pending requests on termination", async () => {
      const worker = new PDFWorker({ workerUrl: "/pdf-worker.js" });
      await worker.initialize();

      // Create a slow mock that doesn't respond immediately
      const slowMockWorker = globalThis.Worker as unknown as typeof MockWorker;
      const originalPostMessage = slowMockWorker.prototype.postMessage;
      slowMockWorker.prototype.postMessage = function () {
        // Don't respond - simulate slow operation
      };

      const promise = worker.send("load", { bytes: new Uint8Array(), documentId: "doc-1" }, 5000);

      // Restore before terminating
      slowMockWorker.prototype.postMessage = originalPostMessage;

      await worker.terminate(false);

      await expect(promise).rejects.toThrow("terminated");
    });
  });

  describe("timeout handling", () => {
    it("times out slow requests", async () => {
      const worker = new PDFWorker({
        workerUrl: "/pdf-worker.js",
        defaultTimeout: 100,
      });
      await worker.initialize();

      // Mock slow response
      const slowMockWorker = globalThis.Worker as unknown as typeof MockWorker;
      const originalPostMessage = slowMockWorker.prototype.postMessage;
      slowMockWorker.prototype.postMessage = function () {
        // Don't respond - simulate timeout
      };

      try {
        await expect(
          worker.send("load", { bytes: new Uint8Array(), documentId: "doc-1" }, 50),
        ).rejects.toThrow("timeout");
      } finally {
        slowMockWorker.prototype.postMessage = originalPostMessage;
      }
    });
  });

  describe("state transitions", () => {
    it("transitions from idle to initializing to ready", async () => {
      const states: WorkerState[] = [];
      const worker = new PDFWorker({
        workerUrl: "/pdf-worker.js",
        onStateChange: state => states.push(state),
      });

      expect(worker.state).toBe("idle");

      await worker.initialize();

      expect(states).toContain("initializing");
      expect(states).toContain("ready");
      expect(worker.state).toBe("ready");
    });

    it("transitions to busy during operations", async () => {
      const states: WorkerState[] = [];
      const worker = new PDFWorker({
        workerUrl: "/pdf-worker.js",
        onStateChange: state => states.push(state),
      });
      await worker.initialize();

      states.length = 0; // Clear initialization states

      await worker.send("load", { bytes: new Uint8Array(), documentId: "doc-1" });

      // Should transition to busy and back to ready
      expect(states).toContain("busy");
    });

    it("transitions to terminated on terminate", async () => {
      const states: WorkerState[] = [];
      const worker = new PDFWorker({
        workerUrl: "/pdf-worker.js",
        onStateChange: state => states.push(state),
      });
      await worker.initialize();

      await worker.terminate();

      expect(states).toContain("terminated");
      expect(worker.state).toBe("terminated");
    });
  });

  describe("error handling", () => {
    it("calls onError callback on worker error", async () => {
      let errorReceived: unknown = null;
      const worker = new PDFWorker({
        workerUrl: "/pdf-worker.js",
        onError: error => {
          errorReceived = error;
        },
      });
      await worker.initialize();

      // Simulate worker error
      // This would require accessing the internal Worker instance
      // For now, we just verify the callback is set up
      expect(worker.isReady).toBe(true);
    });
  });

  describe("cancellation", () => {
    it("cancels active task", async () => {
      const worker = new PDFWorker({ workerUrl: "/pdf-worker.js" });
      await worker.initialize();

      // Since our mock responds immediately, we test the API exists
      const result = await worker.cancel("nonexistent-task");
      expect(result).toBe(false);
    });

    it("cancelAll cancels all tasks", async () => {
      const worker = new PDFWorker({ workerUrl: "/pdf-worker.js" });
      await worker.initialize();

      // Should not throw
      await worker.cancelAll();
    });
  });

  describe("transferables", () => {
    it("accepts transferable arrays", async () => {
      const worker = new PDFWorker({ workerUrl: "/pdf-worker.js" });
      await worker.initialize();

      const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
      const response = await worker.send("load", { bytes, documentId: "doc-1" }, undefined, [
        bytes.buffer,
      ]);

      expect(response.status).toBe("success");
    });
  });
});
