/**
 * PDF file writer.
 *
 * Supports both full save (rewrite everything) and incremental save
 * (append only changed objects).
 *
 * Uses a single ByteWriter for the entire PDF to minimize allocations.
 */

import { clearAllDirtyFlags, collectChanges } from "#src/document/change-collector";
import type { ObjectRegistry } from "#src/document/object-registry";
import { FilterPipeline } from "#src/filters/filter-pipeline";
import { CR, LF } from "#src/helpers/chars";
import { ByteWriter } from "#src/io/byte-writer";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import type { PdfObject } from "#src/objects/pdf-object";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfStream } from "#src/objects/pdf-stream";
import { PdfString } from "#src/objects/pdf-string";
import type { StandardSecurityHandler } from "#src/security/standard-handler";

import { writeXRefStream, writeXRefTable, type XRefWriteEntry } from "./xref-writer";

/**
 * Options for PDF writing.
 */
export interface WriteOptions {
  /** PDF version string (default: "1.7") */
  version?: string;

  /** Root catalog reference */
  root: PdfRef;

  /** Info dictionary reference (optional) */
  info?: PdfRef;

  /** Encrypt dictionary reference (optional) */
  encrypt?: PdfRef;

  /** Document ID (optional, two 16-byte arrays) */
  id?: [Uint8Array, Uint8Array];

  /** Use XRef stream instead of table (PDF 1.5+) */
  useXRefStream?: boolean;

  /**
   * Compress uncompressed streams with FlateDecode (default: true).
   *
   * When enabled, streams without a /Filter entry will be compressed
   * before writing. Streams that already have filters (including image
   * formats like DCTDecode/JPXDecode) are left unchanged.
   */
  compressStreams?: boolean;

  /**
   * Minimum stream size in bytes to attempt compression (default: 512).
   *
   * Streams smaller than this threshold are written uncompressed.
   * Deflate initialization has a fixed cost (~0.023ms for pako's 64KB
   * hash table) that dominates for small payloads, and tiny streams
   * rarely achieve meaningful compression.
   *
   * Set to 0 to compress all streams regardless of size.
   */
  compressionThreshold?: number;

  /**
   * Security handler for encrypting content.
   *
   * When provided, strings and streams will be encrypted before writing.
   * The encrypt dictionary reference must also be provided.
   */
  securityHandler?: StandardSecurityHandler;
}

/**
 * Options for incremental save.
 */
export interface IncrementalWriteOptions extends WriteOptions {
  /** Original PDF bytes */
  originalBytes: Uint8Array;

  /** Offset of the original xref */
  originalXRefOffset: number;
}

/**
 * Result of a write operation.
 */
export interface WriteResult {
  /** The written PDF bytes */
  bytes: Uint8Array;

  /** Byte offset where the xref section starts */
  xrefOffset: number;
}

/**
 * Write an indirect object to the ByteWriter.
 *
 * Format: "N G obj\n[object]\nendobj\n"
 */
function writeIndirectObject(writer: ByteWriter, ref: PdfRef, obj: PdfObject): void {
  writer.writeAscii(`${ref.objectNumber} ${ref.generation} obj\n`);
  obj.toBytes(writer);
  writer.writeAscii("\nendobj\n");
}

/**
 * Prepare an object for writing, applying compression if needed.
 *
 * For PdfStream objects without a /Filter entry, compresses the data
 * with FlateDecode and returns a new stream with the compressed data.
 * The original stream is not modified.
 *
 * Streams that already have filters are returned unchanged - this includes
 * image formats (DCTDecode, JPXDecode, etc.) that are already compressed.
 */
const DEFAULT_COMPRESSION_THRESHOLD = 512;

function prepareObjectForWrite(
  obj: PdfObject,
  compress: boolean,
  compressionThreshold: number,
): PdfObject {
  // Only process streams
  if (!(obj instanceof PdfStream)) {
    return obj;
  }

  // Already has a filter - leave it alone
  if (obj.has("Filter")) {
    return obj;
  }

  // Compression disabled
  if (!compress) {
    return obj;
  }

  // Pako's deflate initialization zeros a 64KB hash table on every call
  // (~0.023ms). For streams below the threshold the compression savings
  // are negligible relative to the init cost, especially when writing
  // many PDFs (e.g. splitting 2000 pages).
  if (obj.data.length < compressionThreshold) {
    return obj;
  }

  // Compress with FlateDecode
  const compressed = FilterPipeline.encode(obj.data, { name: "FlateDecode" });

  // Only use compression if it actually reduces size
  if (compressed.length >= obj.data.length) {
    return obj;
  }

  // Create a new stream with compressed data
  // Copy all existing entries from the original stream
  const compressedStream = new PdfStream(obj, compressed);
  compressedStream.set("Filter", PdfName.of("FlateDecode"));

  return compressedStream;
}

/**
 * Encryption context for writing.
 */
interface EncryptionContext {
  handler: StandardSecurityHandler;
  objectNumber: number;
  generation: number;
}

/**
 * Recursively encrypt an object for writing.
 *
 * Creates a new object tree with all strings and stream data encrypted.
 * References, names, numbers, and booleans are returned unchanged.
 *
 * @param obj - The object to encrypt
 * @param ctx - Encryption context with handler and object reference
 * @returns Encrypted copy of the object
 */
function encryptObject(obj: PdfObject, ctx: EncryptionContext): PdfObject {
  if (obj instanceof PdfString) {
    // Encrypt string bytes
    const encrypted = ctx.handler.encryptString(obj.bytes, ctx.objectNumber, ctx.generation);
    // Always use hex format for encrypted strings (cleaner, no escaping issues)
    return new PdfString(encrypted, "hex");
  }

  if (obj instanceof PdfStream) {
    // Check if this stream type should be encrypted
    const streamType = obj.getName("Type")?.value;

    if (!ctx.handler.shouldEncryptStream(streamType)) {
      // Recursively encrypt dictionary entries but not stream data
      return encryptStreamDict(obj, ctx);
    }

    // Encrypt stream data
    const encryptedData = ctx.handler.encryptStream(obj.data, ctx.objectNumber, ctx.generation);

    // Create new stream with encrypted data and encrypted dict entries
    const encryptedStream = new PdfStream([], encryptedData);

    // Copy and encrypt dictionary entries
    for (const [key, value] of obj) {
      if (key.value === "Length") {
        continue; // Skip Length, will be recalculated
      }

      encryptedStream.set(key.value, encryptObject(value, ctx));
    }

    return encryptedStream;
  }

  if (obj instanceof PdfDict) {
    // Recursively encrypt dictionary values
    const encrypted = new PdfDict();

    for (const [key, value] of obj) {
      encrypted.set(key.value, encryptObject(value, ctx));
    }

    return encrypted;
  }

  if (obj instanceof PdfArray) {
    // Recursively encrypt array elements
    const encrypted = new PdfArray();

    for (const item of obj) {
      encrypted.push(encryptObject(item, ctx));
    }

    return encrypted;
  }

  // Other types (PdfRef, PdfName, PdfNumber, PdfBool, PdfNull) pass through unchanged
  return obj;
}

/**
 * Encrypt dictionary entries of a stream without encrypting stream data.
 * Used for streams that should not be encrypted (XRef, unencrypted metadata).
 */
function encryptStreamDict(stream: PdfStream, ctx: EncryptionContext): PdfStream {
  const encrypted = new PdfStream([], stream.data);

  for (const [key, value] of stream) {
    if (key.value === "Length") {
      continue;
    }

    encrypted.set(key.value, encryptObject(value, ctx));
  }

  return encrypted;
}

/**
 * Collect all refs reachable from the document root and trailer entries.
 *
 * Walks the object graph starting from Root, Info, and Encrypt (if present),
 * returning the set of all object keys (as "objNum gen" strings) that are reachable.
 * This is used for garbage collection during full saves.
 */
function collectReachableRefs(
  registry: ObjectRegistry,
  root: PdfRef,
  info?: PdfRef,
  encrypt?: PdfRef,
): Set<string> {
  const visited = new Set<string>();

  const walk = (obj: PdfObject | null): void => {
    if (obj === null) {
      return;
    }

    if (obj instanceof PdfRef) {
      const key = `${obj.objectNumber} ${obj.generation}`;

      if (visited.has(key)) {
        return;
      }

      visited.add(key);

      const resolved = registry.resolve(obj);

      walk(resolved);
    } else if (obj instanceof PdfDict) {
      // PdfStream extends PdfDict, so this handles both
      for (const [, value] of obj) {
        walk(value);
      }
    } else if (obj instanceof PdfArray) {
      for (const item of obj) {
        walk(item);
      }
    }
  };

  walk(root);

  if (info) {
    walk(info);
  }

  if (encrypt) {
    walk(encrypt);
  }

  return visited;
}

/**
 * Write a complete PDF from scratch.
 *
 * Structure:
 * ```
 * %PDF-X.Y
 * %[binary comment]
 * 1 0 obj
 * ...
 * endobj
 * 2 0 obj
 * ...
 * xref
 * ...
 * trailer
 * ...
 * startxref
 * ...
 * %%EOF
 * ```
 */
export function writeComplete(registry: ObjectRegistry, options: WriteOptions): WriteResult {
  const writer = new ByteWriter();
  const compress = options.compressStreams ?? true;
  const threshold = options.compressionThreshold ?? DEFAULT_COMPRESSION_THRESHOLD;

  // Version
  const version = options.version ?? "1.7";
  writer.writeAscii(`%PDF-${version}\n`);

  // Binary comment (signals binary file to text tools)
  // Use high-byte characters as recommended by PDF spec
  writer.writeBytes(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // %âãÏÓ\n

  // Track offsets for xref
  const offsets = new Map<number, { offset: number; generation: number }>();

  // Collect only reachable objects (garbage collection)
  // This ensures orphan objects are not written to the output
  const reachableKeys = collectReachableRefs(registry, options.root, options.info, options.encrypt);

  // Write only reachable objects and record offsets
  for (const [ref, obj] of registry.entries()) {
    const key = `${ref.objectNumber} ${ref.generation}`;

    if (!reachableKeys.has(key)) {
      continue; // Skip orphan objects
    }
    // Prepare object (compress streams if needed)
    let prepared = prepareObjectForWrite(obj, compress, threshold);

    // Apply encryption if security handler is provided
    // Skip encrypting the /Encrypt dictionary itself
    if (options.securityHandler && options.encrypt && ref !== options.encrypt) {
      prepared = encryptObject(prepared, {
        handler: options.securityHandler,
        objectNumber: ref.objectNumber,
        generation: ref.generation,
      });
    }

    offsets.set(ref.objectNumber, {
      offset: writer.position,
      generation: ref.generation,
    });

    writeIndirectObject(writer, ref, prepared);
  }

  // Record xref offset before writing it
  const xrefOffset = writer.position;

  // Build xref entries
  const entries: XRefWriteEntry[] = [
    // Object 0 is always the free list head
    { objectNumber: 0, generation: 65535, type: "free", offset: 0 },
  ];

  for (const [objNum, info] of offsets) {
    entries.push({
      objectNumber: objNum,
      generation: info.generation,
      type: "inuse",
      offset: info.offset,
    });
  }

  // Write xref section
  if (options.useXRefStream) {
    const xrefObjNum = registry.nextObjectNumber;

    // Add entry for the xref stream itself
    entries.push({
      objectNumber: xrefObjNum,
      generation: 0,
      type: "inuse",
      offset: xrefOffset,
    });

    // Size is max object number + 1
    const size = Math.max(0, ...entries.map(e => e.objectNumber)) + 1;

    writeXRefStream(writer, {
      entries,
      size,
      xrefOffset,
      root: options.root,
      info: options.info,
      encrypt: options.encrypt,
      id: options.id,
      streamObjectNumber: xrefObjNum,
    });
  } else {
    // Size is max object number + 1
    const size = Math.max(0, ...entries.map(e => e.objectNumber)) + 1;

    writeXRefTable(writer, {
      entries,
      size,
      xrefOffset,
      root: options.root,
      info: options.info,
      encrypt: options.encrypt,
      id: options.id,
    });
  }

  return {
    bytes: writer.toBytes(),
    xrefOffset,
  };
}

/**
 * Write an incremental update to a PDF.
 *
 * Appends only the changed/new objects to the original PDF bytes,
 * preserving the original content exactly.
 *
 * Structure:
 * ```
 * [original PDF bytes]
 * [modified object 1]
 * [modified object 2]
 * ...
 * xref
 * ...
 * trailer
 * << ... /Prev [originalXRefOffset] >>
 * startxref
 * ...
 * %%EOF
 * ```
 */
export function writeIncremental(
  registry: ObjectRegistry,
  options: IncrementalWriteOptions,
): WriteResult {
  // Collect changes
  const changes = collectChanges(registry);

  // If no changes, return original (should caller handle this?)
  if (changes.modified.size === 0 && changes.created.size === 0) {
    return {
      bytes: options.originalBytes,
      xrefOffset: options.originalXRefOffset,
    };
  }

  const compress = options.compressStreams ?? true;
  const threshold = options.compressionThreshold ?? DEFAULT_COMPRESSION_THRESHOLD;

  // Initialize ByteWriter with original bytes
  const writer = new ByteWriter(options.originalBytes);

  // Ensure there's a newline before appended content
  const lastByte = options.originalBytes[options.originalBytes.length - 1];

  if (lastByte !== LF && lastByte !== CR) {
    writer.writeByte(0x0a); // newline
  }

  // Track offsets for new xref
  const offsets = new Map<number, { offset: number; generation: number }>();

  // Write modified objects
  for (const [ref, obj] of changes.modified) {
    let prepared = prepareObjectForWrite(obj, compress, threshold);

    // Apply encryption if security handler is provided
    // Skip encrypting the /Encrypt dictionary itself
    if (options.securityHandler && options.encrypt && ref !== options.encrypt) {
      prepared = encryptObject(prepared, {
        handler: options.securityHandler,
        objectNumber: ref.objectNumber,
        generation: ref.generation,
      });
    }

    offsets.set(ref.objectNumber, {
      offset: writer.position,
      generation: ref.generation,
    });

    writeIndirectObject(writer, ref, prepared);
  }

  // Write new objects
  for (const [ref, obj] of changes.created) {
    let prepared = prepareObjectForWrite(obj, compress, threshold);

    // Apply encryption if security handler is provided
    // Skip encrypting the /Encrypt dictionary itself
    if (options.securityHandler && options.encrypt && ref !== options.encrypt) {
      prepared = encryptObject(prepared, {
        handler: options.securityHandler,
        objectNumber: ref.objectNumber,
        generation: ref.generation,
      });
    }

    offsets.set(ref.objectNumber, {
      offset: writer.position,
      generation: ref.generation,
    });

    writeIndirectObject(writer, ref, prepared);
  }

  // Record xref offset
  const xrefOffset = writer.position;

  // Build xref entries (only for changed objects)
  const entries: XRefWriteEntry[] = [];

  for (const [objNum, info] of offsets) {
    entries.push({
      objectNumber: objNum,
      generation: info.generation,
      type: "inuse",
      offset: info.offset,
    });
  }

  // Write xref section with /Prev pointer
  if (options.useXRefStream) {
    const xrefObjNum = registry.nextObjectNumber;

    // Add entry for the xref stream itself
    entries.push({
      objectNumber: xrefObjNum,
      generation: 0,
      type: "inuse",
      offset: xrefOffset,
    });

    // Size must cover all objects (original + new), including xref stream
    const size = Math.max(changes.maxObjectNumber + 1, xrefObjNum + 1);

    writeXRefStream(writer, {
      entries,
      size,
      xrefOffset,
      prev: options.originalXRefOffset,
      root: options.root,
      info: options.info,
      encrypt: options.encrypt,
      id: options.id,
      streamObjectNumber: xrefObjNum,
    });
  } else {
    // Size must cover all objects (original + new)
    const size = Math.max(changes.maxObjectNumber + 1, registry.nextObjectNumber);

    writeXRefTable(writer, {
      entries,
      size,
      xrefOffset,
      prev: options.originalXRefOffset,
      root: options.root,
      info: options.info,
      encrypt: options.encrypt,
      id: options.id,
    });
  }

  // Clear dirty flags and commit new objects
  clearAllDirtyFlags(registry);
  registry.commitNewObjects();

  return {
    bytes: writer.toBytes(),
    xrefOffset,
  };
}

/**
 * Utility to check if incremental save produced valid output.
 *
 * Verifies that:
 * 1. Original bytes are preserved exactly
 * 2. New content starts after original
 * 3. Basic structure is valid
 */
export function verifyIncrementalSave(
  original: Uint8Array,
  result: Uint8Array,
): { valid: boolean; error?: string } {
  // Result must be at least as long as original
  if (result.length < original.length) {
    return { valid: false, error: "Result shorter than original" };
  }

  // Original bytes must be preserved exactly
  for (let i = 0; i < original.length; i++) {
    if (result[i] !== original[i]) {
      return {
        valid: false,
        error: `Byte mismatch at offset ${i}: expected ${original[i]}, got ${result[i]}`,
      };
    }
  }

  // Check for %%EOF at end
  const tail = new TextDecoder().decode(result.slice(-10));

  if (!tail.includes("%%EOF")) {
    return { valid: false, error: "Missing %%EOF at end" };
  }

  return { valid: true };
}
