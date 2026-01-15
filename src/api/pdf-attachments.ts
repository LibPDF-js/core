/**
 * PDFAttachments - High-level API for attachment operations on a PDF document.
 *
 * Provides functionality for reading, adding, and removing file attachments.
 * Accessed via `pdf.attachments` on a PDF instance.
 *
 * @example
 * ```typescript
 * const pdf = await PDF.load(bytes);
 *
 * // List all attachments
 * const attachments = await pdf.attachments.list();
 *
 * // Get attachment data
 * const data = await pdf.attachments.get("document.txt");
 *
 * // Add an attachment
 * await pdf.attachments.add("report.pdf", reportBytes, {
 *   description: "Annual report",
 *   mimeType: "application/pdf",
 * });
 *
 * // Remove an attachment
 * await pdf.attachments.remove("old-file.txt");
 * ```
 */

import {
  createEmbeddedFileStream,
  createFileSpec,
  getEmbeddedFileStream,
  parseFileSpec,
} from "#src/attachments/file-spec.ts";
import type { AddAttachmentOptions, AttachmentInfo } from "#src/attachments/types.ts";
import { buildNameTree } from "#src/document/name-tree.ts";
import { PdfDict } from "#src/objects/pdf-dict.ts";
import type { PdfRef } from "#src/objects/pdf-ref.ts";

import type { PDFContext } from "./pdf-context.ts";

/**
 * PDFAttachments manages file attachments for a PDF document.
 */
export class PDFAttachments {
  /** PDF context */
  private readonly ctx: PDFContext;

  constructor(ctx: PDFContext) {
    this.ctx = ctx;
  }

  /**
   * List all attachments in the document.
   *
   * @returns Map of attachment name to attachment info
   *
   * @example
   * ```typescript
   * const attachments = await pdf.attachments.list();
   * for (const [name, info] of attachments) {
   *   console.log(`${name}: ${info.size} bytes`);
   * }
   * ```
   */
  async list(): Promise<Map<string, AttachmentInfo>> {
    const result = new Map<string, AttachmentInfo>();
    const tree = await this.ctx.catalog.getEmbeddedFilesTree();

    if (!tree) {
      return result;
    }

    for await (const [name, value] of tree.entries()) {
      if (!(value instanceof PdfDict)) {
        continue;
      }

      const info = await parseFileSpec(value, name, ref => this.ctx.registry.resolve(ref));

      if (info) {
        result.set(name, info);
      } else {
        // External file reference - skip but warn
        this.ctx.registry.addWarning(
          `Attachment "${name}" is an external file reference (not embedded)`,
        );
      }
    }

    return result;
  }

  /**
   * Get the raw bytes of an attachment.
   *
   * @param name - The attachment name (key in the EmbeddedFiles tree)
   * @returns The attachment bytes, or null if not found
   *
   * @example
   * ```typescript
   * const data = await pdf.attachments.get("document.txt");
   * if (data) {
   *   const text = new TextDecoder().decode(data);
   *   console.log(text);
   * }
   * ```
   */
  async get(name: string): Promise<Uint8Array | null> {
    const tree = await this.ctx.catalog.getEmbeddedFilesTree();

    if (!tree) {
      return null;
    }

    const fileSpec = await tree.get(name);

    if (!(fileSpec instanceof PdfDict)) {
      return null;
    }

    const stream = await getEmbeddedFileStream(fileSpec, ref => this.ctx.registry.resolve(ref));

    if (!stream) {
      return null;
    }

    return stream.getDecodedData();
  }

  /**
   * Check if an attachment exists.
   *
   * @param name - The attachment name
   * @returns True if the attachment exists
   *
   * @example
   * ```typescript
   * if (await pdf.attachments.has("report.pdf")) {
   *   const data = await pdf.attachments.get("report.pdf");
   * }
   * ```
   */
  async has(name: string): Promise<boolean> {
    const tree = await this.ctx.catalog.getEmbeddedFilesTree();

    if (!tree) {
      return false;
    }

    return tree.has(name);
  }

  /**
   * Add a file attachment to the document.
   *
   * @param name - The attachment name (key in the EmbeddedFiles tree)
   * @param data - The file data
   * @param options - Attachment options (description, MIME type, dates)
   * @throws {Error} if name already exists and overwrite !== true
   *
   * @example
   * ```typescript
   * // Add with auto-detected MIME type
   * await pdf.attachments.add("report.pdf", pdfBytes);
   *
   * // Add with explicit options
   * await pdf.attachments.add("data.json", jsonBytes, {
   *   description: "Configuration data",
   *   mimeType: "application/json",
   * });
   *
   * // Replace existing attachment
   * await pdf.attachments.add("report.pdf", newBytes, { overwrite: true });
   * ```
   */
  async add(name: string, data: Uint8Array, options: AddAttachmentOptions = {}): Promise<void> {
    // Check if attachment already exists
    if (!options.overwrite && (await this.has(name))) {
      throw new Error(`Attachment "${name}" already exists. Use { overwrite: true } to replace.`);
    }

    // Create the embedded file stream
    const embeddedFileStream = createEmbeddedFileStream(data, name, options);
    const embeddedFileRef = this.ctx.registry.register(embeddedFileStream);

    // Create the file specification
    const fileSpec = createFileSpec(name, embeddedFileRef, options);
    const fileSpecRef = this.ctx.registry.register(fileSpec);

    // Collect all existing attachments
    const existingAttachments: Array<[string, PdfRef]> = [];
    const tree = await this.ctx.catalog.getEmbeddedFilesTree();

    if (tree) {
      for await (const [key, value] of tree.entries()) {
        if (key === name && options.overwrite) {
          // Skip the one we're replacing
          continue;
        }

        // Get the ref for this file spec
        const ref = this.ctx.registry.getRef(value);

        if (ref) {
          existingAttachments.push([key, ref]);
        }
      }
    }

    // Add the new attachment
    existingAttachments.push([name, fileSpecRef]);

    // Build new name tree and set it
    const newNameTree = buildNameTree(existingAttachments);
    await this.ctx.catalog.setEmbeddedFilesTree(newNameTree);
  }

  /**
   * Remove an attachment from the document.
   *
   * @param name - The attachment name
   * @returns True if the attachment was removed, false if not found
   *
   * @example
   * ```typescript
   * const removed = await pdf.attachments.remove("old-file.txt");
   * if (removed) {
   *   console.log("Attachment removed");
   * }
   * ```
   */
  async remove(name: string): Promise<boolean> {
    const tree = await this.ctx.catalog.getEmbeddedFilesTree();

    if (!tree) {
      return false;
    }

    // Check if it exists
    if (!(await tree.has(name))) {
      return false;
    }

    // Collect all attachments except the one to remove
    const remainingAttachments: Array<[string, PdfRef]> = [];

    for await (const [key, value] of tree.entries()) {
      if (key === name) {
        continue; // Skip the one we're removing
      }

      const ref = this.ctx.registry.getRef(value);

      if (ref) {
        remainingAttachments.push([key, ref]);
      }
    }

    if (remainingAttachments.length === 0) {
      // No attachments left - remove /EmbeddedFiles entry
      await this.ctx.catalog.removeEmbeddedFilesTree();
    } else {
      // Build new tree with remaining attachments
      const newNameTree = buildNameTree(remainingAttachments);
      await this.ctx.catalog.setEmbeddedFilesTree(newNameTree);
    }

    return true;
  }
}
