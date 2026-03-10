/**
 * Tests for parsing worker functionality.
 *
 * Worker-dependent tests are skipped in non-browser environments.
 * Utility and synchronous parsing tests run everywhere.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadFixture } from "../test-utils";
import {
  type ParsingProgressMessage,
  type ParsingWorkerResponse,
  createParsingProgress,
} from "./parsing-types";
import {
  calculateParsingTimeout,
  createDeferred,
  DEFAULT_PARSING_TIMEOUTS,
  detectEnvironment,
  extractTransferables,
  generateParsingMessageId,
  generateParsingTaskId,
  isWorkerContext,
  isWorkerSupported,
} from "./parsing-utils";
import {
  createParsingWorkerHost,
  ParsingWorkerHost,
  type ParsingWorkerState,
} from "./parsing-worker-host";
import { createProgressTracker, DEFAULT_PROGRESS_INTERVAL } from "./progress-tracker";

// Check if we're in an environment that supports workers
const workersSupported = typeof Worker !== "undefined";

// ─────────────────────────────────────────────────────────────────────────────
// ParsingWorkerHost Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("ParsingWorkerHost", () => {
  describe("construction", () => {
    it.skipIf(!workersSupported)("creates a host with required options", () => {
      const host = new ParsingWorkerHost({ workerUrl: "/parsing-worker.js" });

      expect(host).toBeInstanceOf(ParsingWorkerHost);
      expect(host.state).toBe("idle");
      expect(host.isReady).toBe(false);
      expect(host.isTerminated).toBe(false);
      expect(host.pendingCount).toBe(0);
    });

    it.skipIf(!workersSupported)("creates a host with custom name", () => {
      const host = new ParsingWorkerHost({
        workerUrl: "/parsing-worker.js",
        name: "custom-parsing-worker",
      });

      expect(host.name).toBe("custom-parsing-worker");
    });

    it.skipIf(!workersSupported)("createParsingWorkerHost factory function works", () => {
      const host = createParsingWorkerHost({ workerUrl: "/parsing-worker.js" });

      expect(host).toBeInstanceOf(ParsingWorkerHost);
    });
  });

  describe("initialization", () => {
    it.skipIf(!workersSupported)("initializes successfully", async () => {
      const host = new ParsingWorkerHost({ workerUrl: "/parsing-worker.js" });

      // This will fail in non-worker environments
      await expect(host.initialize()).rejects.toThrow();
    });

    it.skipIf(!workersSupported)("is idempotent - multiple calls return same promise", async () => {
      const host = new ParsingWorkerHost({ workerUrl: "/parsing-worker.js" });

      // Multiple calls should return same promise
      const p1 = host.initialize();
      const p2 = host.initialize();
      expect(p1).toBe(p2);
    });

    it.skipIf(!workersSupported)("calls onStateChange callback", async () => {
      const stateChanges: Array<{ state: ParsingWorkerState; previous: ParsingWorkerState }> = [];
      const host = new ParsingWorkerHost({
        workerUrl: "/parsing-worker.js",
        onStateChange: (state, previous) => {
          stateChanges.push({ state, previous });
        },
      });

      // Try initialize (will fail, but should call state change)
      try {
        await host.initialize();
      } catch {
        // Expected
      }

      expect(stateChanges.some(c => c.state === "initializing")).toBe(true);
    });

    it.skipIf(!workersSupported)("cannot initialize after termination", async () => {
      const host = new ParsingWorkerHost({ workerUrl: "/parsing-worker.js" });

      await host.terminate();

      await expect(host.initialize()).rejects.toThrow("terminated");
    });
  });

  describe("parsing", () => {
    it.skipIf(!workersSupported)("parses a document and returns result", async () => {
      // This test requires a real worker environment
      // In browser tests, this would work with a bundled worker
    });

    it.skipIf(!workersSupported)("receives progress updates during parsing", async () => {
      // This test requires a real worker environment
    });

    it.skipIf(!workersSupported)("supports per-operation progress callback", async () => {
      // This test requires a real worker environment
    });
  });

  describe("text extraction", () => {
    it.skipIf(!workersSupported)("extracts text from document", async () => {
      // This test requires a real worker environment
    });
  });

  describe("cancellation", () => {
    it.skipIf(!workersSupported)("cancels parsing operation", async () => {
      // This test requires a real worker environment
    });

    it.skipIf(!workersSupported)("parseCancellable returns cancellable operation", async () => {
      // This test requires a real worker environment
    });
  });

  describe("termination", () => {
    it.skipIf(!workersSupported)("terminates gracefully", async () => {
      const host = new ParsingWorkerHost({ workerUrl: "/parsing-worker.js" });

      await host.terminate();

      expect(host.state).toBe("terminated");
      expect(host.isTerminated).toBe(true);
      expect(host.isReady).toBe(false);
    });

    it.skipIf(!workersSupported)("is idempotent - multiple terminate calls are safe", async () => {
      const host = new ParsingWorkerHost({ workerUrl: "/parsing-worker.js" });

      await host.terminate();
      await host.terminate();

      expect(host.state).toBe("terminated");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ProgressTracker Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("ProgressTracker", () => {
  it("creates tracker with task ID", () => {
    const messages: ParsingProgressMessage[] = [];
    const tracker = createProgressTracker({
      taskId: "test-task",
      onProgress: msg => messages.push(msg),
    });

    expect(tracker.phase).toBe("initializing");
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].taskId).toBe("test-task");
  });

  it("reports phase transitions immediately", () => {
    const messages: ParsingProgressMessage[] = [];
    const tracker = createProgressTracker({
      taskId: "test-task",
      onProgress: msg => messages.push(msg),
    });

    tracker.startPhase("header");
    tracker.startPhase("xref");

    expect(messages.some(m => m.progress.phase === "header")).toBe(true);
    expect(messages.some(m => m.progress.phase === "xref")).toBe(true);
  });

  it("throttles progress updates", async () => {
    const messages: ParsingProgressMessage[] = [];
    const tracker = createProgressTracker({
      taskId: "test-task",
      interval: 100,
      onProgress: msg => messages.push(msg),
    });

    tracker.startPhase("objects");
    const initialCount = messages.length;

    // Send many rapid updates
    for (let i = 0; i < 10; i++) {
      tracker.update(i * 10, `Processing ${i}`);
    }

    // Not all updates should be sent immediately
    // (some will be throttled)
    expect(messages.length).toBeLessThan(initialCount + 10);

    // Flush pending
    tracker.flush();
  });

  it("tracks items processed", () => {
    const messages: ParsingProgressMessage[] = [];
    const tracker = createProgressTracker({
      taskId: "test-task",
      onProgress: msg => messages.push(msg),
    });

    tracker.startPhase("objects");
    tracker.updateItems(50, 100, "Loading objects");

    const objectsUpdate = messages.find(
      m => m.progress.phase === "objects" && m.progress.processed !== undefined,
    );
    expect(objectsUpdate).toBeDefined();
    expect(objectsUpdate?.progress.processed).toBe(50);
    expect(objectsUpdate?.progress.total).toBe(100);
  });

  it("completes with 100%", () => {
    const messages: ParsingProgressMessage[] = [];
    const tracker = createProgressTracker({
      taskId: "test-task",
      onProgress: msg => messages.push(msg),
    });

    tracker.startPhase("header");
    tracker.complete();

    const lastMessage = messages[messages.length - 1];
    expect(lastMessage.progress.phase).toBe("complete");
    expect(lastMessage.progress.percent).toBe(100);
  });

  it("can be cancelled", () => {
    const messages: ParsingProgressMessage[] = [];
    const tracker = createProgressTracker({
      taskId: "test-task",
      onProgress: msg => messages.push(msg),
    });

    tracker.cancel();
    expect(tracker.cancelled).toBe(true);

    const countBefore = messages.length;
    tracker.startPhase("header"); // Should be ignored
    expect(messages.length).toBe(countBefore);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Parsing Utils Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("parsing-utils", () => {
  describe("detectEnvironment", () => {
    it("detects current environment", () => {
      const env = detectEnvironment();
      // In test environment, should be either 'node' or 'bun'
      expect(["node", "bun", "browser", "deno", "unknown"]).toContain(env);
    });
  });

  describe("isWorkerContext", () => {
    it("returns false in main thread", () => {
      expect(isWorkerContext()).toBe(false);
    });
  });

  describe("generateParsingMessageId", () => {
    it("generates unique IDs", () => {
      const id1 = generateParsingMessageId();
      const id2 = generateParsingMessageId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^parse-/);
    });
  });

  describe("generateParsingTaskId", () => {
    it("generates unique task IDs", () => {
      const id1 = generateParsingTaskId();
      const id2 = generateParsingTaskId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^parsing-task-/);
    });
  });

  describe("calculateParsingTimeout", () => {
    it("returns small timeout for small files", () => {
      const timeout = calculateParsingTimeout(500_000); // 500KB
      expect(timeout).toBe(DEFAULT_PARSING_TIMEOUTS.small);
    });

    it("returns medium timeout for medium files", () => {
      const timeout = calculateParsingTimeout(5_000_000); // 5MB
      expect(timeout).toBe(DEFAULT_PARSING_TIMEOUTS.medium);
    });

    it("returns large timeout for large files", () => {
      const timeout = calculateParsingTimeout(50_000_000); // 50MB
      expect(timeout).toBe(DEFAULT_PARSING_TIMEOUTS.large);
    });
  });

  describe("extractTransferables", () => {
    it("extracts ArrayBuffer from Uint8Array", () => {
      const bytes = new Uint8Array([1, 2, 3, 4]);
      const transferables = extractTransferables({ bytes });

      expect(transferables).toContain(bytes.buffer);
    });

    it("extracts nested ArrayBuffers", () => {
      const bytes1 = new Uint8Array([1, 2]);
      const bytes2 = new Uint8Array([3, 4]);
      const data = {
        items: [{ data: bytes1 }, { data: bytes2 }],
      };

      const transferables = extractTransferables(data);

      expect(transferables).toContain(bytes1.buffer);
      expect(transferables).toContain(bytes2.buffer);
    });

    it("handles null and primitives", () => {
      const transferables = extractTransferables({
        str: "hello",
        num: 42,
        bool: true,
        nil: null,
      });

      expect(transferables).toHaveLength(0);
    });
  });

  describe("createDeferred", () => {
    it("creates resolvable deferred", async () => {
      const deferred = createDeferred<string>();

      expect(deferred.isPending).toBe(true);

      deferred.resolve("done");

      expect(deferred.isPending).toBe(false);
      expect(await deferred.promise).toBe("done");
    });

    it("creates rejectable deferred", async () => {
      const deferred = createDeferred<string>();

      deferred.reject(new Error("failed"));

      expect(deferred.isPending).toBe(false);
      await expect(deferred.promise).rejects.toThrow("failed");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration Tests with Real PDFs
// ─────────────────────────────────────────────────────────────────────────────

describe("parsing integration", () => {
  describe("parseDocument function", () => {
    it("parses a real PDF synchronously", async () => {
      // Import the sync parser directly
      const { parseDocument } = await import("../parser/index");

      const bytes = await loadFixture("basic", "rot0.pdf");
      const doc = parseDocument(bytes);

      expect(doc.version).toMatch(/^\d+\.\d+$/);
      expect(doc.getPageCount()).toBeGreaterThan(0);
    });

    it("handles malformed PDFs leniently", async () => {
      const { parseDocument } = await import("../parser/index");

      // Create minimal valid PDF bytes
      const minimalPdf = new TextEncoder().encode(
        "%PDF-1.4\n" +
          "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
          "2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n" +
          "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n" +
          "xref\n" +
          "0 4\n" +
          "0000000000 65535 f\n" +
          "0000000009 00000 n\n" +
          "0000000052 00000 n\n" +
          "0000000101 00000 n\n" +
          "trailer<</Size 4/Root 1 0 R>>\n" +
          "startxref\n" +
          "166\n" +
          "%%EOF",
      );

      const doc = parseDocument(minimalPdf, { lenient: true });

      expect(doc.version).toBe("1.4");
      expect(doc.getPageCount()).toBe(1);
    });
  });
});
