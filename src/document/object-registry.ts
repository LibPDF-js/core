/**
 * Object registry for tracking PDF objects and their references.
 *
 * Manages the bidirectional mapping between PdfRef and PdfObject,
 * tracks new objects, and assigns object numbers.
 */

import type { PdfObject } from "#src/objects/pdf-object";
import { PdfRef } from "#src/objects/pdf-ref";
import type { XRefEntry } from "#src/parser/xref-parser";

/**
 * Function to resolve objects not yet in the registry.
 * Called when resolve() encounters an unknown reference.
 */
export type ObjectResolver = (ref: PdfRef) => Promise<PdfObject | null>;

/**
 * Registry for managing PDF objects and their references.
 *
 * Responsibilities:
 * - Map refs to objects (loaded and new)
 * - Map objects back to refs
 * - Track new objects separately from loaded
 * - Assign sequential object numbers to new objects
 * - Resolve unknown refs via resolver callback
 * - Collect warnings
 */
export class ObjectRegistry {
  /** Objects loaded from the PDF (ref key → object) */
  private loaded = new Map<PdfRef, PdfObject>();

  /** New objects created by the user (ref → object) */
  private newObjects = new Map<PdfRef, PdfObject>();

  /** Reverse mapping: object → ref (uses WeakMap for GC) */
  private objectToRef = new WeakMap<object, PdfRef>();

  /** Next object number to assign */
  private _nextObjNum: number;

  /** Resolver for objects not in registry */
  private resolver: ObjectResolver | null = null;

  /** Warnings collected during operations */
  readonly warnings: string[] = [];

  /**
   * Create a new registry.
   *
   * @param xref - The xref table from parsing (used to determine next object number)
   */
  constructor(xref?: Map<number, XRefEntry>) {
    if (xref && xref.size > 0) {
      // Find max object number from xref
      const maxObjNum = Math.max(...xref.keys());
      this._nextObjNum = maxObjNum + 1;
    } else {
      // Start from 1 (0 is reserved for free list head)
      this._nextObjNum = 1;
    }
  }

  /**
   * Set the resolver for fetching objects not yet in the registry.
   */
  setResolver(resolver: ObjectResolver): void {
    this.resolver = resolver;
  }

  /**
   * Get the next object number that will be assigned.
   */
  get nextObjectNumber(): number {
    return this._nextObjNum;
  }

  /**
   * Register a loaded object (from parsing).
   *
   * @param ref - The object's reference
   * @param obj - The parsed object
   */
  addLoaded(ref: PdfRef, obj: PdfObject): void {
    this.loaded.set(ref, obj);

    // Only add to reverse map if it's an object type (not primitives)
    if (obj !== null && typeof obj === "object") {
      this.objectToRef.set(obj, ref);
    }
  }

  /**
   * Register a new object, assigning it a fresh object number.
   *
   * @param obj - The new object
   * @returns The assigned reference
   */
  register(obj: PdfObject): PdfRef {
    // Assign new object number, generation 0
    const ref = PdfRef.of(this._nextObjNum++, 0);

    this.newObjects.set(ref, obj);

    // Add to reverse map if it's an object type
    if (obj !== null && typeof obj === "object") {
      this.objectToRef.set(obj, ref);
    }

    return ref;
  }

  /**
   * Allocate a reference without assigning an object.
   *
   * Used to pre-allocate refs for objects that will be created later
   * (e.g., embedded fonts whose objects are created at save time).
   *
   * @returns The allocated reference
   */
  allocateRef(): PdfRef {
    return PdfRef.of(this._nextObjNum++, 0);
  }

  /**
   * Register an object at a pre-allocated reference.
   *
   * @param ref - The pre-allocated reference (from allocateRef)
   * @param obj - The object to register
   */
  registerAt(ref: PdfRef, obj: PdfObject): void {
    this.newObjects.set(ref, obj);

    // Add to reverse map if it's an object type
    if (obj !== null && typeof obj === "object") {
      this.objectToRef.set(obj, ref);
    }
  }

  /**
   * Get the reference for an object.
   *
   * @param obj - The object to look up
   * @returns The reference, or null if not registered
   */
  getRef(obj: PdfObject): PdfRef | null {
    if (obj === null || typeof obj !== "object") {
      return null;
    }

    return this.objectToRef.get(obj) ?? null;
  }

  /**
   * Get an object by reference (sync version).
   *
   * Only returns objects already in the registry.
   * Use `resolve()` to fetch objects via the resolver.
   *
   * @param ref - The reference to look up
   * @returns The object, or null if not found
   */
  getObject(ref: PdfRef): PdfObject | null {
    return this.loaded.get(ref) ?? this.newObjects.get(ref) ?? null;
  }

  /**
   * Resolve an object by reference.
   *
   * Checks the registry first, then uses the resolver callback
   * if the object isn't found. Resolved objects are cached.
   *
   * @param ref - The reference to resolve
   * @returns The object, or null if not found
   */
  async resolve(ref: PdfRef): Promise<PdfObject | null> {
    // Check registry first
    const existing = this.getObject(ref);

    if (existing !== null) {
      return existing;
    }

    // Use resolver if available
    if (this.resolver) {
      const obj = await this.resolver(ref);

      if (obj !== null) {
        this.addLoaded(ref, obj);
      }

      return obj;
    }

    return null;
  }

  /**
   * Add a warning message.
   */
  addWarning(message: string): void {
    this.warnings.push(message);
  }

  /**
   * Check if an object is registered (loaded or new).
   */
  isRegistered(obj: PdfObject): boolean {
    return this.getRef(obj) !== null;
  }

  /**
   * Check if an object is new (not loaded from the PDF).
   */
  isNew(ref: PdfRef): boolean {
    return this.newObjects.has(ref);
  }

  /**
   * Get all new objects for serialization.
   */
  getNewObjects(): Map<PdfRef, PdfObject> {
    return new Map(this.newObjects);
  }

  /**
   * Get all loaded objects.
   */
  getLoadedObjects(): Map<PdfRef, PdfObject> {
    return new Map(this.loaded);
  }

  /**
   * Move new objects to loaded (called after successful save).
   *
   * This transitions new objects to "loaded" state so subsequent
   * modifications are tracked via dirty flags.
   */
  commitNewObjects(): void {
    for (const [ref, obj] of this.newObjects) {
      this.loaded.set(ref, obj);
    }

    this.newObjects.clear();
  }

  /**
   * Check if there are any new objects.
   */
  hasNewObjects(): boolean {
    return this.newObjects.size > 0;
  }

  /**
   * Iterate over all objects (loaded + new).
   */
  *entries(): IterableIterator<[PdfRef, PdfObject]> {
    yield* this.loaded;
    yield* this.newObjects;
  }
}
