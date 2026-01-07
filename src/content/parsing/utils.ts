/**
 * Utility functions for content stream operations.
 */

import type { AnyOperation, ContentToken } from "./types";

/**
 * Filter out marked content blocks matching a predicate.
 *
 * Removes both the BDC/EMC wrappers AND the content inside.
 * Use `stripMarkedContent` to keep the content but remove wrappers.
 *
 * Handles BMC/BDC/EMC nesting correctly.
 *
 * @param ops - Operations to filter
 * @param shouldRemove - Predicate: return true to remove block with given tag
 * @returns Filtered operations
 */
export function filterMarkedContent(
  ops: AnyOperation[],
  shouldRemove: (tag: string, props?: ContentToken) => boolean,
): AnyOperation[] {
  const result: AnyOperation[] = [];
  let removeDepth = 0; // Depth inside blocks we're removing
  let nestedDepth = 0; // Depth of nested blocks inside removal zone

  for (const op of ops) {
    // Check for marked content start
    if (op.operator === "BMC" || op.operator === "BDC") {
      if (removeDepth > 0) {
        // Already inside a removed block - track nested depth
        nestedDepth++;

        continue;
      }

      const operands = "operands" in op ? op.operands : [];
      const tag = operands[0];
      const props = op.operator === "BDC" ? operands[1] : undefined;

      if (tag?.type === "name" && shouldRemove(tag.value, props)) {
        removeDepth++;

        continue;
      }

      // Not removing this block
      result.push(op);

      continue;
    }

    // Check for marked content end
    if (op.operator === "EMC") {
      if (nestedDepth > 0) {
        // End of nested block inside removal zone
        nestedDepth--;

        continue;
      }

      if (removeDepth > 0) {
        // End of a removed block
        removeDepth--;

        continue;
      }

      // Normal EMC outside removal
      result.push(op);

      continue;
    }

    // Keep operation if not inside removed block
    if (removeDepth === 0) {
      result.push(op);
    }
  }

  return result;
}

/**
 * Strip marked content wrappers matching a predicate, but keep the content inside.
 *
 * Removes BDC/EMC (or BMC/EMC) wrappers but preserves the operations inside.
 * Use `filterMarkedContent` to remove both wrappers AND content.
 *
 * Handles BMC/BDC/EMC nesting correctly.
 *
 * @param ops - Operations to process
 * @param shouldStrip - Predicate: return true to strip wrapper for given tag
 * @returns Operations with matching wrappers removed but content preserved
 */
export function stripMarkedContent(
  ops: AnyOperation[],
  shouldStrip: (tag: string, props?: ContentToken) => boolean,
): AnyOperation[] {
  const result: AnyOperation[] = [];
  let stripDepth = 0; // Depth inside blocks we're stripping

  for (const op of ops) {
    // Check for marked content start
    if (op.operator === "BMC" || op.operator === "BDC") {
      const operands = "operands" in op ? op.operands : [];
      const tag = operands[0];
      const props = op.operator === "BDC" ? operands[1] : undefined;

      if (tag?.type === "name" && shouldStrip(tag.value, props)) {
        // Strip this wrapper - don't add BDC/BMC to result
        stripDepth++;

        continue;
      }

      // Keep this wrapper
      result.push(op);

      continue;
    }

    // Check for marked content end
    if (op.operator === "EMC") {
      if (stripDepth > 0) {
        // This EMC matches a stripped BDC/BMC - don't add it
        stripDepth--;

        continue;
      }

      // Normal EMC - keep it
      result.push(op);

      continue;
    }

    // Always keep content operations
    result.push(op);
  }

  return result;
}

/**
 * Extract all text-showing operations.
 *
 * Returns operations with operators: Tj, TJ, ', "
 */
export function extractTextOperations(ops: AnyOperation[]): AnyOperation[] {
  const textOps = new Set(["Tj", "TJ", "'", '"']);

  return ops.filter(op => textOps.has(op.operator));
}

/**
 * Find operations by operator name.
 */
export function findOperations(ops: AnyOperation[], operator: string): AnyOperation[] {
  return ops.filter(op => op.operator === operator);
}

/**
 * Check if an operation is inside a marked content block with given tag.
 *
 * This requires tracking state through the operations array.
 */
export function isInsideMarkedContent(ops: AnyOperation[], index: number, tag: string): boolean {
  // Track all BMC/BDC and their corresponding EMCs
  const stack: string[] = [];

  for (let i = 0; i < index; i++) {
    const op = ops[i];

    if (op.operator === "BMC" || op.operator === "BDC") {
      const operands = "operands" in op ? op.operands : [];
      const opTag = operands[0];
      const tagValue = opTag?.type === "name" ? opTag.value : "";

      stack.push(tagValue);
    }

    if (op.operator === "EMC" && stack.length > 0) {
      stack.pop();
    }
  }

  return stack.includes(tag);
}
