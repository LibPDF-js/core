/**
 * Tests for worker message protocol.
 */

import { describe, expect, it } from "vitest";

import {
  createCancelledResponse,
  createErrorResponse,
  createProgress,
  createRequest,
  createSuccessResponse,
  createWorkerError,
  generateMessageId,
  generateTaskId,
  isProgress,
  isRequest,
  isResponse,
  type ProgressMessage,
  type WorkerRequest,
  type WorkerResponse,
} from "./messages";

describe("messages", () => {
  describe("ID generation", () => {
    it("generateMessageId creates unique IDs", () => {
      const id1 = generateMessageId();
      const id2 = generateMessageId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^msg-\d+-[a-z0-9]+$/);
      expect(id2).toMatch(/^msg-\d+-[a-z0-9]+$/);
    });

    it("generateTaskId creates unique IDs", () => {
      const id1 = generateTaskId();
      const id2 = generateTaskId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^task-\d+-[a-z0-9]+$/);
      expect(id2).toMatch(/^task-\d+-[a-z0-9]+$/);
    });
  });

  describe("type guards", () => {
    describe("isRequest", () => {
      it("returns true for valid request objects", () => {
        const request: WorkerRequest = {
          type: "request",
          id: "msg-1",
          requestType: "init",
          data: { verbose: true },
        };

        expect(isRequest(request)).toBe(true);
      });

      it("returns false for response objects", () => {
        const response: WorkerResponse = {
          type: "response",
          id: "msg-1",
          requestType: "init",
          status: "success",
          data: { ready: true, version: "1.0.0" },
        };

        expect(isRequest(response)).toBe(false);
      });

      it("returns false for progress messages", () => {
        const progress: ProgressMessage = {
          type: "progress",
          taskId: "task-1",
          requestType: "load",
          percent: 50,
        };

        expect(isRequest(progress)).toBe(false);
      });

      it("returns false for null", () => {
        expect(isRequest(null)).toBe(false);
      });

      it("returns false for undefined", () => {
        expect(isRequest(undefined)).toBe(false);
      });

      it("returns false for non-objects", () => {
        expect(isRequest("string")).toBe(false);
        expect(isRequest(123)).toBe(false);
        expect(isRequest(true)).toBe(false);
      });

      it("returns false for objects without type property", () => {
        expect(isRequest({ id: "msg-1" })).toBe(false);
      });
    });

    describe("isResponse", () => {
      it("returns true for valid response objects", () => {
        const response: WorkerResponse = {
          type: "response",
          id: "msg-1",
          requestType: "init",
          status: "success",
          data: { ready: true, version: "1.0.0" },
        };

        expect(isResponse(response)).toBe(true);
      });

      it("returns true for error responses", () => {
        const response: WorkerResponse = {
          type: "response",
          id: "msg-1",
          requestType: "load",
          status: "error",
          error: { code: "ERROR", message: "Something went wrong" },
        };

        expect(isResponse(response)).toBe(true);
      });

      it("returns false for request objects", () => {
        const request: WorkerRequest = {
          type: "request",
          id: "msg-1",
          requestType: "init",
          data: {},
        };

        expect(isResponse(request)).toBe(false);
      });

      it("returns false for progress messages", () => {
        const progress: ProgressMessage = {
          type: "progress",
          taskId: "task-1",
          requestType: "load",
          percent: 50,
        };

        expect(isResponse(progress)).toBe(false);
      });

      it("returns false for null and undefined", () => {
        expect(isResponse(null)).toBe(false);
        expect(isResponse(undefined)).toBe(false);
      });
    });

    describe("isProgress", () => {
      it("returns true for progress messages", () => {
        const progress: ProgressMessage = {
          type: "progress",
          taskId: "task-1",
          requestType: "load",
          percent: 50,
        };

        expect(isProgress(progress)).toBe(true);
      });

      it("returns true for progress with optional fields", () => {
        const progress: ProgressMessage = {
          type: "progress",
          taskId: "task-1",
          requestType: "extractText",
          percent: 75,
          operation: "Extracting page 5",
          processed: 5,
          total: 10,
        };

        expect(isProgress(progress)).toBe(true);
      });

      it("returns false for request objects", () => {
        const request: WorkerRequest = {
          type: "request",
          id: "msg-1",
          requestType: "init",
          data: {},
        };

        expect(isProgress(request)).toBe(false);
      });

      it("returns false for response objects", () => {
        const response: WorkerResponse = {
          type: "response",
          id: "msg-1",
          requestType: "init",
          status: "success",
          data: { ready: true, version: "1.0.0" },
        };

        expect(isProgress(response)).toBe(false);
      });
    });
  });

  describe("message factories", () => {
    describe("createRequest", () => {
      it("creates init request", () => {
        const request = createRequest("init", { verbose: true, name: "test-worker" });

        expect(request.type).toBe("request");
        expect(request.requestType).toBe("init");
        expect(request.data.verbose).toBe(true);
        expect(request.data.name).toBe("test-worker");
        expect(request.id).toMatch(/^msg-/);
      });

      it("creates load request", () => {
        const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
        const request = createRequest("load", {
          bytes,
          documentId: "doc-1",
          password: "secret",
        });

        expect(request.type).toBe("request");
        expect(request.requestType).toBe("load");
        expect(request.data.bytes).toBe(bytes);
        expect(request.data.documentId).toBe("doc-1");
        expect(request.data.password).toBe("secret");
      });

      it("creates save request", () => {
        const request = createRequest("save", {
          documentId: "doc-1",
          incremental: true,
        });

        expect(request.requestType).toBe("save");
        expect(request.data.documentId).toBe("doc-1");
        expect(request.data.incremental).toBe(true);
      });

      it("creates extractText request", () => {
        const request = createRequest("extractText", {
          documentId: "doc-1",
          pageIndices: [0, 1, 2],
        });

        expect(request.requestType).toBe("extractText");
        expect(request.data.pageIndices).toEqual([0, 1, 2]);
      });

      it("creates findText request", () => {
        const request = createRequest("findText", {
          documentId: "doc-1",
          pattern: "hello.*world",
          isRegex: true,
          caseSensitive: false,
        });

        expect(request.requestType).toBe("findText");
        expect(request.data.pattern).toBe("hello.*world");
        expect(request.data.isRegex).toBe(true);
        expect(request.data.caseSensitive).toBe(false);
      });

      it("creates cancel request", () => {
        const request = createRequest("cancel", { taskId: "task-123" });

        expect(request.requestType).toBe("cancel");
        expect(request.data.taskId).toBe("task-123");
      });

      it("creates terminate request", () => {
        const request = createRequest("terminate", undefined);

        expect(request.requestType).toBe("terminate");
        expect(request.data).toBeUndefined();
      });
    });

    describe("createSuccessResponse", () => {
      it("creates success response for init", () => {
        const response = createSuccessResponse("msg-1", "init", {
          ready: true,
          version: "1.0.0",
        });

        expect(response.type).toBe("response");
        expect(response.id).toBe("msg-1");
        expect(response.requestType).toBe("init");
        expect(response.status).toBe("success");
        expect(response.data?.ready).toBe(true);
        expect(response.data?.version).toBe("1.0.0");
      });

      it("creates success response for load", () => {
        const response = createSuccessResponse("msg-2", "load", {
          documentId: "doc-1",
          pageCount: 10,
          isEncrypted: false,
          hasForms: true,
          hasSignatures: false,
        });

        expect(response.status).toBe("success");
        expect(response.data?.pageCount).toBe(10);
        expect(response.data?.hasForms).toBe(true);
      });

      it("creates success response for save", () => {
        const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
        const response = createSuccessResponse("msg-3", "save", {
          bytes,
          size: 4,
        });

        expect(response.data?.bytes).toBe(bytes);
        expect(response.data?.size).toBe(4);
      });

      it("creates success response for extractText", () => {
        const response = createSuccessResponse("msg-4", "extractText", {
          pages: [
            { pageIndex: 0, text: "Hello" },
            { pageIndex: 1, text: "World" },
          ],
        });

        expect(response.data?.pages).toHaveLength(2);
        expect(response.data?.pages[0].text).toBe("Hello");
      });

      it("creates success response for findText", () => {
        const response = createSuccessResponse("msg-5", "findText", {
          matches: [{ pageIndex: 0, text: "test", offset: 10 }],
          totalCount: 1,
        });

        expect(response.data?.matches).toHaveLength(1);
        expect(response.data?.totalCount).toBe(1);
      });
    });

    describe("createErrorResponse", () => {
      it("creates error response", () => {
        const error = { code: "LOAD_ERROR", message: "Failed to parse PDF" };
        const response = createErrorResponse("msg-1", "load", error);

        expect(response.type).toBe("response");
        expect(response.id).toBe("msg-1");
        expect(response.requestType).toBe("load");
        expect(response.status).toBe("error");
        expect(response.error).toEqual(error);
      });

      it("creates error response with stack trace", () => {
        const error = {
          code: "PARSE_ERROR",
          message: "Invalid xref",
          stack: "Error: Invalid xref\n    at parse (parser.js:10)",
        };
        const response = createErrorResponse("msg-2", "parse", error);

        expect(response.error?.stack).toContain("Invalid xref");
      });
    });

    describe("createCancelledResponse", () => {
      it("creates cancelled response", () => {
        const response = createCancelledResponse("msg-1", "load");

        expect(response.type).toBe("response");
        expect(response.id).toBe("msg-1");
        expect(response.requestType).toBe("load");
        expect(response.status).toBe("cancelled");
      });
    });

    describe("createProgress", () => {
      it("creates basic progress message", () => {
        const progress = createProgress("task-1", "load", 50);

        expect(progress.type).toBe("progress");
        expect(progress.taskId).toBe("task-1");
        expect(progress.requestType).toBe("load");
        expect(progress.percent).toBe(50);
      });

      it("creates progress with optional fields", () => {
        const progress = createProgress("task-1", "extractText", 75, {
          operation: "Extracting page 5",
          processed: 5,
          total: 10,
        });

        expect(progress.percent).toBe(75);
        expect(progress.operation).toBe("Extracting page 5");
        expect(progress.processed).toBe(5);
        expect(progress.total).toBe(10);
      });

      it("creates progress at 0%", () => {
        const progress = createProgress("task-1", "save", 0, {
          operation: "Preparing save",
        });

        expect(progress.percent).toBe(0);
      });

      it("creates progress at 100%", () => {
        const progress = createProgress("task-1", "save", 100, {
          operation: "Complete",
        });

        expect(progress.percent).toBe(100);
      });
    });

    describe("createWorkerError", () => {
      it("creates error from Error object", () => {
        const error = new Error("Something went wrong");
        const workerError = createWorkerError(error);

        expect(workerError.code).toBe("Error");
        expect(workerError.message).toBe("Something went wrong");
        expect(workerError.stack).toBeDefined();
      });

      it("creates error with custom code", () => {
        const error = new Error("Invalid password");
        const workerError = createWorkerError(error, "AUTH_ERROR");

        expect(workerError.code).toBe("AUTH_ERROR");
        expect(workerError.message).toBe("Invalid password");
      });

      it("uses error name as default code", () => {
        const error = new TypeError("Invalid argument");
        const workerError = createWorkerError(error);

        expect(workerError.code).toBe("TypeError");
      });
    });
  });

  describe("request type coverage", () => {
    it("supports all request types", () => {
      const requestTypes = [
        "init",
        "load",
        "save",
        "parse",
        "extractText",
        "findText",
        "cancel",
        "terminate",
      ] as const;

      for (const type of requestTypes) {
        const request = createRequest(type, type === "terminate" ? undefined : {});
        expect(request.requestType).toBe(type);
      }
    });
  });

  describe("response type coverage", () => {
    it("supports all response types", () => {
      const responseTypes = [
        { type: "init", data: { ready: true, version: "1.0.0" } },
        {
          type: "load",
          data: {
            documentId: "doc-1",
            pageCount: 1,
            isEncrypted: false,
            hasForms: false,
            hasSignatures: false,
          },
        },
        { type: "save", data: { bytes: new Uint8Array(), size: 0 } },
        { type: "parse", data: { version: "1.4", objectCount: 10, usedBruteForce: false } },
        { type: "extractText", data: { pages: [] } },
        { type: "findText", data: { matches: [], totalCount: 0 } },
        { type: "cancel", data: { taskId: "task-1", wasCancelled: true } },
        { type: "terminate", data: undefined },
      ] as const;

      for (const { type, data } of responseTypes) {
        const response = createSuccessResponse("msg-1", type, data);
        expect(response.requestType).toBe(type);
        expect(response.status).toBe("success");
      }
    });
  });
});
