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
  type CheckboxOptions,
  type CheckboxSymbol,
  type DropdownOptions,
  type FieldOptions,
  type FieldValue,
  type FormProperties,
  type ListboxOptions,
  PDFForm,
  type RadioGroupOptions,
  type RadioSymbol,
  type SignatureFieldOptions,
  TextAlignment,
  type TextFieldOptions,
} from "./api/pdf-form";
export {
  type DrawFieldOptions,
  type DrawPageOptions,
  PDFPage,
  type Rectangle,
} from "./api/pdf-page";

// ─────────────────────────────────────────────────────────────────────────────
// Color and Rotation Helpers
// ─────────────────────────────────────────────────────────────────────────────

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
export {
  // Color presets
  black,
  blue,
  type CMYK,
  type Color,
  cmyk,
  type Grayscale,
  grayscale,
  green,
  type RGB,
  red,
  rgb,
  white,
} from "./helpers/colors";
export { type Degrees, degrees } from "./helpers/rotations";

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

// ─────────────────────────────────────────────────────────────────────────────
// Fonts
// ─────────────────────────────────────────────────────────────────────────────

export type { EmbeddedFont, EmbedFontOptions } from "./fonts/embedded-font";
export { type Standard14FontName, StandardFonts } from "./fonts/standard-14";

// ─────────────────────────────────────────────────────────────────────────────
// Images
// ─────────────────────────────────────────────────────────────────────────────

export { PDFImage } from "./images/pdf-image";

// ─────────────────────────────────────────────────────────────────────────────
// Drawing API
// ─────────────────────────────────────────────────────────────────────────────

export {
  type DrawCircleOptions,
  type DrawEllipseOptions,
  type DrawImageOptions,
  type DrawLineOptions,
  type DrawRectangleOptions,
  type DrawTextOptions,
  type FontInput,
  type LayoutResult,
  // Types
  type LineCap,
  type LineJoin,
  layoutJustifiedLine,
  layoutText,
  // Utilities
  lineCapToNumber,
  lineJoinToNumber,
  // Text layout
  measureText,
  // Path builder
  PathBuilder,
  type PathOptions,
  type PositionedWord,
  type Rotation,
  type TextLine,
} from "./api/drawing";
