/**
 * CFF (Compact Font Format) parsing module.
 *
 * Provides parsing for CFF fonts, both standalone and embedded in OpenType (.otf) files.
 */

/** biome-ignore-all assist/source/organizeImports: api file */

// Parser
export { parseCFF, isCFF } from "./parser.ts";

// Subsetter
export { CFFSubsetter } from "./subsetter.ts";

// Types
export type {
  CFFHeader,
  DictEntry,
  DictData,
  FDSelect,
  PrivateDict,
  CFFFont,
  CFFType1Font,
  CFFCIDFont,
} from "./parser.ts";

// Charset
export type { CFFCharset } from "./charset.ts";
export {
  CFFCharsetType1,
  CFFCharsetCID,
  RangeMappedCharset,
  getPredefinedCharset,
  createType1Charset,
  createCIDCharset,
} from "./charset.ts";

// Encoding
export type { CFFEncoding } from "./encoding.ts";
export { CFFEncodingBase, getPredefinedEncoding, createEncoding } from "./encoding.ts";

// Operators
export { getOperator, getOperator2, isTwoByteOperator } from "./operators.ts";

// Standard strings
export { getStandardString, STANDARD_STRINGS_COUNT } from "./standard-strings.ts";
