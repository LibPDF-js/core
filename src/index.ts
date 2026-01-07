/**
 * @libpdf/core
 *
 * A modern PDF library for TypeScript — parsing and generation.
 */

export { version } from "../package.json";

// ─────────────────────────────────────────────────────────────────────────────
// High-level API
// ─────────────────────────────────────────────────────────────────────────────

export {
  type CopyPagesOptions,
  type ExtractPagesOptions,
  type LoadOptions,
  type MergeOptions,
  PDF,
  type SaveOptions,
} from "./api/pdf";
export { PDFEmbeddedPage } from "./api/pdf-embedded-page";
export {
  type FieldValue,
  type FormProperties,
  PDFForm,
  TextAlignment,
} from "./api/pdf-form";
export { type DrawPageOptions, PDFPage, type Rectangle } from "./api/pdf-page";
export type {
  ButtonField,
  CheckboxField,
  DropdownField,
  FieldType,
  FormField,
  ListBoxField,
  RadioField,
  SignatureField,
  TextField,
} from "./document/forms/fields";
export type { FlattenOptions } from "./document/forms/form-flattener";

// ─────────────────────────────────────────────────────────────────────────────
// Layers (Optional Content Groups)
// ─────────────────────────────────────────────────────────────────────────────

export type { FlattenLayersResult, LayerInfo } from "./layers/types";

// ─────────────────────────────────────────────────────────────────────────────
// Digital Signatures
// ─────────────────────────────────────────────────────────────────────────────

export type {
  DigestAlgorithm,
  HttpTimestampAuthorityOptions,
  KeyType,
  PAdESLevel,
  RevocationProvider,
  SignatureAlgorithm,
  Signer,
  SignOptions,
  SignResult,
  SignWarning,
  SubFilter,
  TimestampAuthority,
} from "./signatures";
export {
  CertificateChainError,
  CryptoKeySigner,
  HttpTimestampAuthority,
  P12Signer,
  PlaceholderError,
  RevocationError,
  SignatureError,
  SignerError,
  TimestampError,
} from "./signatures";

// ─────────────────────────────────────────────────────────────────────────────
// PDF Objects
// ─────────────────────────────────────────────────────────────────────────────

export { PdfArray } from "./objects/pdf-array";
export { PdfBool } from "./objects/pdf-bool";
export { PdfDict } from "./objects/pdf-dict";
export { PdfName } from "./objects/pdf-name";
export { PdfNull } from "./objects/pdf-null";
export { PdfNumber } from "./objects/pdf-number";
export type { PdfObject } from "./objects/pdf-object";
export { PdfRef } from "./objects/pdf-ref";
export { PdfStream } from "./objects/pdf-stream";
export { PdfString } from "./objects/pdf-string";
