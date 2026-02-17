/**
 * Cross-document object copying.
 *
 * ObjectCopier deep-copies PDF objects from a source document to a destination,
 * remapping all references to maintain valid object relationships.
 *
 * Key features:
 * - Deep copies all object types (dicts, arrays, streams, primitives)
 * - Remaps references to destination document's object space
 * - Flattens inherited page attributes during page copy
 * - Smart stream handling: raw bytes if unencrypted, re-encode if encrypted
 * - Circular reference detection
 *
 * All operations are synchronous — there is no I/O involved in object copying.
 */

import type { PDF } from "#src/api/pdf";
import type { FilterSpec } from "#src/filters/filter";
import { FilterPipeline } from "#src/filters/filter-pipeline";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import type { PdfObject } from "#src/objects/pdf-object";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfStream } from "#src/objects/pdf-stream";

/**
 * Options for ObjectCopier.
 */
export interface ObjectCopierOptions {
  /** Include annotation dictionaries (default: true) */
  includeAnnotations?: boolean;
  /** Include article thread beads (default: false) */
  includeBeads?: boolean;
  /** Include thumbnail images (default: false) */
  includeThumbnails?: boolean;
  /** Include structure tree references (default: false) */
  includeStructure?: boolean;
}

/** Inheritable page attributes per PDF spec */
const INHERITABLE_PAGE_ATTRS = ["Resources", "MediaBox", "CropBox", "Rotate"] as const;

/**
 * Copies objects from one PDF document to another.
 *
 * @example
 * ```typescript
 * const copier = new ObjectCopier(sourcePdf, destPdf);
 * const copiedPageRef = copier.copyPage(sourcePageRef);
 * destPdf.insertPage(0, copiedPageRef);
 * ```
 */
export class ObjectCopier {
  private readonly source: PDF;
  private readonly dest: PDF;
  private readonly options: Required<ObjectCopierOptions>;

  /** Maps source ref string -> dest ref */
  private readonly refMap = new Map<string, PdfRef>();

  constructor(source: PDF, dest: PDF, options: ObjectCopierOptions = {}) {
    this.source = source;
    this.dest = dest;
    this.options = {
      includeAnnotations: options.includeAnnotations ?? true,
      includeBeads: options.includeBeads ?? false,
      includeThumbnails: options.includeThumbnails ?? false,
      includeStructure: options.includeStructure ?? false,
    };
  }

  /**
   * Copy a page and all its resources from source to destination.
   *
   * Flattens inherited attributes into the page dict.
   * The copied page is registered in the destination but NOT inserted
   * into the page tree - caller must do that.
   *
   * @param srcPageRef Reference to the page in source document
   * @returns Reference to the copied page in destination document
   */
  copyPage(srcPageRef: PdfRef): PdfRef {
    const srcPage = this.source.getObject(srcPageRef);

    if (!(srcPage instanceof PdfDict)) {
      throw new Error(
        `Page object not found or not a dictionary: ${srcPageRef.objectNumber} ${srcPageRef.generation} R`,
      );
    }

    // Clone the page dict (shallow)
    const cloned = srcPage.clone();

    // Flatten inherited attributes
    for (const key of INHERITABLE_PAGE_ATTRS) {
      if (!cloned.has(key)) {
        const inherited = this.getInheritedAttribute(srcPage, key);

        if (inherited) {
          // Deep copy the inherited value
          const copied = this.copyObject(inherited);
          cloned.set(key, copied);
        }
      }
    }

    // Handle optional page-associated objects based on options
    if (!this.options.includeAnnotations) {
      cloned.delete("Annots");
    }

    if (!this.options.includeBeads) {
      cloned.delete("B");
    }

    if (!this.options.includeThumbnails) {
      cloned.delete("Thumb");
    }

    if (!this.options.includeStructure) {
      cloned.delete("StructParents");
    }

    // Remove Parent - will be set when inserted into dest page tree
    cloned.delete("Parent");

    // Deep copy all values in the cloned dict, remapping refs
    const copiedPage = this.copyDictValues(cloned);

    // Register in destination and return ref
    return this.dest.register(copiedPage);
  }

  /**
   * Deep copy any PDF object, remapping references to destination.
   */
  copyObject<T extends PdfObject>(obj: T): T {
    if (obj instanceof PdfRef) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return this.copyRef(obj) as unknown as T;
    }

    if (obj instanceof PdfStream) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return this.copyStream(obj) as unknown as T;
    }

    if (obj instanceof PdfDict) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return this.copyDict(obj) as unknown as T;
    }

    if (obj instanceof PdfArray) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return this.copyArray(obj) as unknown as T;
    }

    // Primitives (PdfName, PdfNumber, PdfString, PdfBool, PdfNull)
    // are immutable and can be reused directly
    return obj;
  }

  /**
   * Copy a reference, creating the referenced object in dest if needed.
   *
   * Handles circular references by registering a placeholder before
   * recursively copying the referenced object's contents.
   */
  private copyRef(ref: PdfRef): PdfRef {
    const key = `${ref.objectNumber}:${ref.generation}`;

    // Already copied (or being copied)?
    const existing = this.refMap.get(key);

    if (existing) {
      return existing;
    }

    // Resolve the source object
    const srcObj = this.source.getObject(ref);

    if (srcObj === null) {
      // Referenced object doesn't exist - this shouldn't happen in valid PDFs
      // but we handle it gracefully by returning a ref to a null object
      const nullRef = this.dest.register(new PdfDict());
      this.refMap.set(key, nullRef);

      return nullRef;
    }

    // For dicts and streams, we can handle circular references by:
    // 1. Create a clone/placeholder in dest and register it first
    // 2. Then copy contents (which may reference back to us)
    // This way, any back-references will find our ref in the map

    if (srcObj instanceof PdfStream) {
      return this.copyStreamRef(key, srcObj);
    }

    if (srcObj instanceof PdfDict) {
      return this.copyDictRef(key, srcObj);
    }

    if (srcObj instanceof PdfArray) {
      // Arrays can contain circular refs too
      const items: PdfObject[] = [];

      for (const item of srcObj) {
        items.push(this.copyObject(item));
      }

      const copiedArr = new PdfArray(items);
      const destRef = this.dest.register(copiedArr);
      this.refMap.set(key, destRef);

      return destRef;
    }

    // Primitives - just register them
    const destRef = this.dest.register(srcObj);
    this.refMap.set(key, destRef);

    return destRef;
  }

  /**
   * Copy a dict reference, handling circular references.
   */
  private copyDictRef(key: string, srcDict: PdfDict): PdfRef {
    // Clone the dict shell first
    const cloned = srcDict.clone();

    // Register immediately so back-references work
    const destRef = this.dest.register(cloned);
    this.refMap.set(key, destRef);

    // Now copy all values (which may reference back to us)
    this.copyDictValues(cloned);

    return destRef;
  }

  /**
   * Copy a stream reference, handling circular references and encryption.
   */
  private copyStreamRef(key: string, srcStream: PdfStream): PdfRef {
    const sourceWasEncrypted = this.source.isEncrypted;

    // Clone the stream's dictionary
    const clonedDict = srcStream.clone();

    // Get stream data based on encryption state
    let streamData: Uint8Array;

    if (!sourceWasEncrypted) {
      // Source wasn't encrypted - copy raw encoded bytes directly
      streamData = srcStream.data;
    } else {
      // Source was encrypted - decode and re-encode
      // Wrap in try/catch since decoding may fail for corrupt streams
      try {
        const decodedData = srcStream.getDecodedData();
        const filterEntry = srcStream.get("Filter");

        if (filterEntry) {
          try {
            const filterSpecs = this.buildFilterSpecs(srcStream);

            streamData = FilterPipeline.encode(decodedData, filterSpecs);

            clonedDict.set("Length", PdfNumber.of(streamData.length));
          } catch (error) {
            console.warn(`Could not re-encode stream ${key}, will use uncompressed data`);
            console.warn(error);

            // If re-encoding fails, store uncompressed
            clonedDict.delete("Filter");
            clonedDict.delete("DecodeParms");

            streamData = decodedData;

            clonedDict.set("Length", PdfNumber.of(streamData.length));
          }
        } else {
          streamData = decodedData;
          clonedDict.set("Length", PdfNumber.of(streamData.length));
        }
      } catch (error) {
        console.warn(`Could not decode stream ${key}, will use raw data`);
        console.warn(error);

        // If decoding fails entirely, try to copy raw bytes as fallback
        // Clear filters since we can't guarantee the data is properly encoded
        clonedDict.delete("Filter");
        clonedDict.delete("DecodeParms");

        streamData = srcStream.data;

        clonedDict.set("Length", PdfNumber.of(streamData.length));
      }
    }

    // Create the stream with data
    const copiedStream = new PdfStream(clonedDict, streamData);

    // Register immediately so back-references work
    const destRef = this.dest.register(copiedStream);
    this.refMap.set(key, destRef);

    // Now copy dict values (which may reference back to us)
    // Note: we modify the already-registered stream's dict entries
    for (const [entryKey, value] of clonedDict) {
      const copied = this.copyObject(value);

      copiedStream.set(entryKey.value, copied);
    }

    return destRef;
  }

  /**
   * Copy a dictionary, remapping all reference values.
   */
  private copyDict(dict: PdfDict): PdfDict {
    const cloned = dict.clone();

    return this.copyDictValues(cloned);
  }

  /**
   * Copy all values in a dictionary, remapping references.
   * Modifies the dict in place and returns it.
   */
  private copyDictValues(dict: PdfDict): PdfDict {
    for (const [key, value] of dict) {
      const copied = this.copyObject(value);

      dict.set(key.value, copied);
    }

    return dict;
  }

  /**
   * Copy an array, remapping all reference elements.
   */
  private copyArray(arr: PdfArray): PdfArray {
    const items: PdfObject[] = [];

    for (const item of arr) {
      items.push(this.copyObject(item));
    }

    return new PdfArray(items);
  }

  /**
   * Copy a stream, handling encryption state.
   *
   * If source wasn't encrypted, copies raw encoded bytes (fastest).
   * If source was encrypted, decodes and re-encodes with same filters.
   */
  private copyStream(stream: PdfStream): PdfStream {
    const sourceWasEncrypted = this.source.isEncrypted;

    // Clone the stream's dictionary
    const clonedDict = stream.clone();

    // Copy dict values (remapping refs, but not stream data yet)
    this.copyDictValues(clonedDict);

    if (!sourceWasEncrypted) {
      // Source wasn't encrypted - copy raw encoded bytes directly
      // This preserves exact encoding and is fastest
      return new PdfStream(clonedDict, stream.data);
    }

    // Source was encrypted - we have decrypted data in memory
    // Must decode and re-encode. Wrap in try/catch for robustness.
    try {
      const decodedData = stream.getDecodedData();
      const filterEntry = stream.get("Filter");

      if (filterEntry) {
        // Re-encode with same filters
        try {
          const filterSpecs = this.buildFilterSpecs(stream);
          const encodedData = FilterPipeline.encode(decodedData, filterSpecs);

          // Update length
          clonedDict.set("Length", PdfNumber.of(encodedData.length));

          return new PdfStream(clonedDict, encodedData);
        } catch (error) {
          console.warn(`Could not re-encode stream, will use uncompressed data`);
          console.warn(error);

          // If re-encoding fails, store uncompressed
          clonedDict.delete("Filter");
          clonedDict.delete("DecodeParms");
          clonedDict.set("Length", PdfNumber.of(decodedData.length));

          return new PdfStream(clonedDict, decodedData);
        }
      }

      // No filters - store uncompressed
      clonedDict.set("Length", PdfNumber.of(decodedData.length));

      return new PdfStream(clonedDict, decodedData);
    } catch (error) {
      console.warn(`Could not decode stream, will use raw data`);
      console.warn(error);

      // If decoding fails entirely, copy raw bytes as fallback
      clonedDict.delete("Filter");
      clonedDict.delete("DecodeParms");
      clonedDict.set("Length", PdfNumber.of(stream.data.length));

      return new PdfStream(clonedDict, stream.data);
    }
  }

  /**
   * Build filter specs from a stream's /Filter and /DecodeParms entries.
   */
  private buildFilterSpecs(stream: PdfStream): FilterSpec[] {
    const filterEntry = stream.get("Filter");
    const filters: string[] = [];
    const params: (PdfDict | undefined)[] = [];

    // Collect filter names
    if (filterEntry instanceof PdfName) {
      filters.push(filterEntry.value);
    } else if (filterEntry instanceof PdfArray) {
      for (const item of filterEntry) {
        if (item instanceof PdfName) {
          filters.push(item.value);
        }
      }
    }

    // Collect decode parameters
    const parmsEntry = stream.get("DecodeParms");

    if (parmsEntry instanceof PdfDict) {
      params.push(parmsEntry);
    } else if (parmsEntry instanceof PdfArray) {
      for (const item of parmsEntry) {
        if (item instanceof PdfDict) {
          params.push(item);
        } else {
          params.push(undefined);
        }
      }
    }

    // Build specs
    return filters.map((name, i) => ({
      name,
      params: params[i],
    }));
  }

  /**
   * Walk up the page tree to find an inherited attribute.
   */
  private getInheritedAttribute(page: PdfDict, key: string): PdfObject | null {
    let current: PdfDict | null = page;

    while (current) {
      const value = current.get(key);

      if (value) {
        return value;
      }

      const parentRef = current.getRef("Parent");

      if (!parentRef) {
        break;
      }

      const parent = this.source.getObject(parentRef);
      current = parent instanceof PdfDict ? parent : null;
    }

    return null;
  }
}
