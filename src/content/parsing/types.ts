/**
 * Types for content stream parsing.
 *
 * ContentToken represents parsed tokens from a content stream.
 * ParsedOperation bundles an operator with its operands.
 */

/**
 * A token from a content stream.
 */
export type ContentToken =
  | NumberToken
  | NameToken
  | StringToken
  | ArrayToken
  | DictToken
  | BoolToken
  | NullToken;

export interface NumberToken {
  type: "number";
  value: number;
}

export interface NameToken {
  type: "name";
  value: string;
}

export interface StringToken {
  type: "string";
  value: Uint8Array;
  hex: boolean;
}

export interface ArrayToken {
  type: "array";
  items: ContentToken[];
}

export interface DictToken {
  type: "dict";
  entries: Map<string, ContentToken>;
}

export interface BoolToken {
  type: "bool";
  value: boolean;
}

export interface NullToken {
  type: "null";
}

/**
 * An operator token (internal use during parsing).
 */
export interface OperatorToken {
  type: "operator";
  name: string;
}

/**
 * A parsed operation: operator with its preceding operands.
 */
export interface ParsedOperation {
  operator: string;
  operands: ContentToken[];
}

/**
 * An inline image operation (special case).
 * BI ... ID <data> EI
 */
export interface InlineImageOperation {
  operator: "BI";
  params: Map<string, ContentToken>;
  data: Uint8Array;
}

/**
 * Any operation in a content stream.
 */
export type AnyOperation = ParsedOperation | InlineImageOperation;

/**
 * Result from parsing a content stream.
 */
export interface ParseResult {
  operations: AnyOperation[];
  warnings: string[];
}

/**
 * Type guard for inline image operations.
 */
export function isInlineImageOperation(op: AnyOperation): op is InlineImageOperation {
  return op.operator === "BI" && "data" in op;
}

/**
 * Type guard for regular parsed operations.
 */
export function isParsedOperation(op: AnyOperation): op is ParsedOperation {
  return "operands" in op;
}
