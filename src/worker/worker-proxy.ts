/**
 * WorkerProxy provides a high-level Promise-based API for worker operations.
 *
 * This class wraps PDFWorker to provide a more user-friendly interface with:
 * - Document-oriented methods (load, save, extractText, etc.)
 * - Automatic worker initialization
 * - Progress callback support
 * - Transferable array handling for efficient memory usage
 */

import {
  type ExtractTextResponseData,
  type FindTextResponseData,
  type LoadResponseData,
  type ProgressMessage,
  type SaveResponseData,
  type TaskId,
  type TextMatch,
  type WorkerError,
} from "./messages";
import { type PDFWorkerOptions, PDFWorker, type WorkerState } from "./pdf-worker";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for loading a PDF document.
 */
export interface ProxyLoadOptions {
  /**
   * Password for encrypted PDFs.
   */
  password?: string;

  /**
   * Progress callback.
   */
  onProgress?: (percent: number, operation?: string) => void;

  /**
   * Timeout in milliseconds.
   * @default 60000
   */
  timeout?: number;
}

/**
 * Options for saving a PDF document.
 */
export interface ProxySaveOptions {
  /**
   * Whether to use incremental save.
   * @default false
   */
  incremental?: boolean;

  /**
   * Encryption options.
   */
  encrypt?: {
    userPassword?: string;
    ownerPassword?: string;
    permissions?: number;
  };

  /**
   * Progress callback.
   */
  onProgress?: (percent: number, operation?: string) => void;

  /**
   * Timeout in milliseconds.
   * @default 120000
   */
  timeout?: number;
}

/**
 * Options for text extraction.
 */
export interface ExtractTextOptions {
  /**
   * Page indices to extract (0-based). If not specified, extracts all pages.
   */
  pages?: number[];

  /**
   * Progress callback.
   */
  onProgress?: (percent: number, operation?: string) => void;

  /**
   * Timeout in milliseconds.
   * @default 60000
   */
  timeout?: number;
}

/**
 * Options for text search.
 */
export interface FindTextOptions {
  /**
   * Whether the pattern is a regular expression.
   * @default false
   */
  regex?: boolean;

  /**
   * Case-sensitive search.
   * @default false
   */
  caseSensitive?: boolean;

  /**
   * Page indices to search (0-based). If not specified, searches all pages.
   */
  pages?: number[];

  /**
   * Progress callback.
   */
  onProgress?: (percent: number, operation?: string) => void;

  /**
   * Timeout in milliseconds.
   * @default 60000
   */
  timeout?: number;
}

/**
 * Loaded document information.
 */
export interface LoadedDocument {
  /**
   * Unique document identifier.
   */
  readonly documentId: string;

  /**
   * Number of pages.
   */
  readonly pageCount: number;

  /**
   * Document metadata.
   */
  readonly metadata: {
    readonly title?: string;
    readonly author?: string;
    readonly subject?: string;
    readonly keywords?: string;
    readonly creator?: string;
    readonly producer?: string;
    readonly creationDate?: string;
    readonly modificationDate?: string;
  };

  /**
   * Whether the document is encrypted.
   */
  readonly isEncrypted: boolean;

  /**
   * Whether the document has forms.
   */
  readonly hasForms: boolean;

  /**
   * Whether the document has digital signatures.
   */
  readonly hasSignatures: boolean;
}

/**
 * Options for WorkerProxy.
 */
export interface WorkerProxyOptions extends PDFWorkerOptions {
  /**
   * Whether to automatically initialize the worker on first use.
   * @default true
   */
  autoInit?: boolean;
}

/**
 * Active operation that can be cancelled.
 */
export interface CancellableOperation<T> {
  /**
   * Promise that resolves when the operation completes.
   */
  readonly promise: Promise<T>;

  /**
   * Cancel the operation.
   */
  cancel(): Promise<boolean>;

  /**
   * Task ID for the operation.
   */
  readonly taskId: TaskId;
}

// ─────────────────────────────────────────────────────────────────────────────
// WorkerProxy Class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * WorkerProxy provides a high-level API for PDF processing in a Web Worker.
 *
 * @example
 * ```typescript
 * const proxy = new WorkerProxy({ workerUrl: '/pdf-worker.js' });
 *
 * // Load a document
 * const doc = await proxy.load(pdfBytes);
 * console.log(`Loaded ${doc.pageCount} pages`);
 *
 * // Extract text
 * const text = await proxy.extractText(doc.documentId);
 *
 * // Save changes
 * const savedBytes = await proxy.save(doc.documentId);
 *
 * // Clean up
 * await proxy.destroy();
 * ```
 */
export class WorkerProxy {
  private _worker: PDFWorker;
  private _options: WorkerProxyOptions;
  private _loadedDocuments: Map<string, LoadedDocument> = new Map();
  private _progressHandlers: Map<TaskId, (percent: number, operation?: string) => void> = new Map();
  private _documentCounter = 0;

  constructor(options?: WorkerProxyOptions) {
    this._options = {
      autoInit: true,
      ...options,
    };

    this._worker = new PDFWorker({
      ...options,
      onProgress: this._handleProgress.bind(this),
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public Properties
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Worker state.
   */
  get state(): WorkerState {
    return this._worker.state;
  }

  /**
   * Whether the worker is ready.
   */
  get isReady(): boolean {
    return this._worker.isReady;
  }

  /**
   * Number of loaded documents.
   */
  get documentCount(): number {
    return this._loadedDocuments.size;
  }

  /**
   * Get a loaded document by ID.
   */
  getDocument(documentId: string): LoadedDocument | undefined {
    return this._loadedDocuments.get(documentId);
  }

  /**
   * Get all loaded document IDs.
   */
  getDocumentIds(): string[] {
    return Array.from(this._loadedDocuments.keys());
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Lifecycle Methods
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Initialize the worker.
   *
   * Called automatically on first operation if autoInit is true.
   */
  async initialize(): Promise<void> {
    await this._worker.initialize();
  }

  /**
   * Ensure the worker is initialized.
   */
  private async _ensureInitialized(): Promise<void> {
    if (!this._worker.isReady && this._options.autoInit) {
      await this.initialize();
    }

    if (!this._worker.isReady) {
      throw new Error("Worker not initialized. Call initialize() first.");
    }
  }

  /**
   * Destroy the proxy and terminate the worker.
   */
  async destroy(): Promise<void> {
    this._loadedDocuments.clear();
    this._progressHandlers.clear();
    await this._worker.terminate();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Document Operations
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Load a PDF document.
   *
   * @param bytes - PDF file bytes
   * @param options - Load options
   * @returns Loaded document information
   */
  async load(bytes: Uint8Array, options?: ProxyLoadOptions): Promise<LoadedDocument> {
    await this._ensureInitialized();

    const documentId = this._generateDocumentId();

    const response = await this._worker.send(
      "load",
      {
        bytes,
        documentId,
        password: options?.password,
      },
      options?.timeout ?? 60_000,
      // Transfer the bytes array for efficiency
      [bytes.buffer],
    );

    if (response.status !== "success" || !response.data) {
      throw new Error(response.error?.message ?? "Failed to load document");
    }

    const doc = this._createLoadedDocument(response.data);
    this._loadedDocuments.set(documentId, doc);

    return doc;
  }

  /**
   * Load a PDF document with cancellation support.
   */
  loadCancellable(
    bytes: Uint8Array,
    options?: ProxyLoadOptions,
  ): CancellableOperation<LoadedDocument> {
    let taskId: TaskId = "";
    let cancelled = false;

    const promise = (async () => {
      await this._ensureInitialized();

      const documentId = this._generateDocumentId();
      taskId = `load-${documentId}`;

      if (options?.onProgress) {
        this._progressHandlers.set(taskId, options.onProgress);
      }

      try {
        const response = await this._worker.send(
          "load",
          {
            bytes,
            documentId,
            password: options?.password,
          },
          options?.timeout ?? 60_000,
          [bytes.buffer],
        );

        if (cancelled) {
          throw new Error("Operation cancelled");
        }

        if (response.status !== "success" || !response.data) {
          throw new Error(response.error?.message ?? "Failed to load document");
        }

        const doc = this._createLoadedDocument(response.data);
        this._loadedDocuments.set(documentId, doc);

        return doc;
      } finally {
        this._progressHandlers.delete(taskId);
      }
    })();

    return {
      promise,
      taskId,
      cancel: async () => {
        cancelled = true;
        if (taskId) {
          return this._worker.cancel(taskId);
        }
        return false;
      },
    };
  }

  /**
   * Save a PDF document.
   *
   * @param documentId - Document to save
   * @param options - Save options
   * @returns Saved PDF bytes
   */
  async save(documentId: string, options?: ProxySaveOptions): Promise<Uint8Array> {
    await this._ensureInitialized();

    if (!this._loadedDocuments.has(documentId)) {
      throw new Error(`Document not found: ${documentId}`);
    }

    const response = await this._worker.send(
      "save",
      {
        documentId,
        incremental: options?.incremental,
        encrypt: options?.encrypt,
      },
      options?.timeout ?? 120_000,
    );

    if (response.status !== "success" || !response.data) {
      throw new Error(response.error?.message ?? "Failed to save document");
    }

    return response.data.bytes;
  }

  /**
   * Unload a document from the worker.
   */
  unload(documentId: string): boolean {
    return this._loadedDocuments.delete(documentId);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Text Operations
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Extract text from a document.
   *
   * @param documentId - Document to extract from
   * @param options - Extraction options
   * @returns Extracted text per page
   */
  async extractText(
    documentId: string,
    options?: ExtractTextOptions,
  ): Promise<ExtractTextResponseData["pages"]> {
    await this._ensureInitialized();

    if (!this._loadedDocuments.has(documentId)) {
      throw new Error(`Document not found: ${documentId}`);
    }

    const response = await this._worker.send(
      "extractText",
      {
        documentId,
        pageIndices: options?.pages,
      },
      options?.timeout ?? 60_000,
    );

    if (response.status !== "success" || !response.data) {
      throw new Error(response.error?.message ?? "Failed to extract text");
    }

    return response.data.pages;
  }

  /**
   * Find text in a document.
   *
   * @param documentId - Document to search
   * @param pattern - Search pattern
   * @param options - Search options
   * @returns Search results
   */
  async findText(
    documentId: string,
    pattern: string,
    options?: FindTextOptions,
  ): Promise<{ matches: readonly TextMatch[]; totalCount: number }> {
    await this._ensureInitialized();

    if (!this._loadedDocuments.has(documentId)) {
      throw new Error(`Document not found: ${documentId}`);
    }

    const response = await this._worker.send(
      "findText",
      {
        documentId,
        pattern,
        isRegex: options?.regex,
        caseSensitive: options?.caseSensitive,
        pageIndices: options?.pages,
      },
      options?.timeout ?? 60_000,
    );

    if (response.status !== "success" || !response.data) {
      throw new Error(response.error?.message ?? "Failed to find text");
    }

    return {
      matches: response.data.matches,
      totalCount: response.data.totalCount,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Internal Methods
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Generate a unique document ID.
   */
  private _generateDocumentId(): string {
    return `doc-${++this._documentCounter}-${Date.now()}`;
  }

  /**
   * Create a LoadedDocument from response data.
   */
  private _createLoadedDocument(data: LoadResponseData): LoadedDocument {
    return {
      documentId: data.documentId,
      pageCount: data.pageCount,
      metadata: data.metadata ?? {},
      isEncrypted: data.isEncrypted,
      hasForms: data.hasForms,
      hasSignatures: data.hasSignatures,
    };
  }

  /**
   * Handle progress messages from the worker.
   */
  private _handleProgress(progress: ProgressMessage): void {
    const handler = this._progressHandlers.get(progress.taskId);
    if (handler) {
      handler(progress.percent, progress.operation);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new WorkerProxy instance.
 */
export function createWorkerProxy(options?: WorkerProxyOptions): WorkerProxy {
  return new WorkerProxy(options);
}
