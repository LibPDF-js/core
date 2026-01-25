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
  type DocumentMetadata,
  type ExtractPagesOptions,
  type FlattenAllOptions,
  type FlattenAllResult,
  type LoadOptions,
  type MergeOptions,
  PDF,
  type SaveOptions,
  type SetTitleOptions,
  type TrappedStatus,
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
  type TextAlignment,
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
// Security
// ─────────────────────────────────────────────────────────────────────────────

export type {
  AuthenticationResult,
  EncryptionAlgorithmOption,
  PermissionOptions,
  Permissions,
  ProtectionOptions,
  SecurityInfo,
} from "./api/pdf-security";
export { PermissionDeniedError, SecurityError } from "./security/errors";

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
  GoogleKmsSigner,
  HttpTimestampAuthority,
  KmsSignerError,
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
export { Standard14Font } from "./fonts/standard-14-font";

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
  type DrawSvgPathOptions,
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
  type RotationOrigin,
  type RotationOriginName,
  type TextLine,
} from "./api/drawing";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export { parsePem, type PemBlock } from "./helpers/pem";

// ─────────────────────────────────────────────────────────────────────────────
// Annotations
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Types
  AnnotationFlags,
  type AnnotationSubtype,
  type BorderStyle,
  type BorderStyleType,
  type CaretAnnotationOptions,
  type CaretSymbol,
  type CircleAnnotationOptions,
  // Helpers
  createAnnotation,
  type DestinationType,
  type FileAttachmentIcon,
  type FlattenAnnotationsOptions,
  type FreeTextAnnotationOptions,
  type FreeTextJustification,
  type HighlightMode,
  type InkAnnotationOptions,
  isPopupAnnotation,
  isWidgetAnnotation,
  type LineAnnotationOptions,
  type LineEndingStyle,
  type LinkAction,
  type LinkAnnotationOptions,
  type LinkDestination,
  // Base classes
  PDFAnnotation,
  // Annotation types
  PDFCaretAnnotation,
  PDFCircleAnnotation,
  PDFFileAttachmentAnnotation,
  PDFFreeTextAnnotation,
  PDFHighlightAnnotation,
  PDFInkAnnotation,
  PDFLineAnnotation,
  PDFLinkAnnotation,
  PDFMarkupAnnotation,
  PDFPolygonAnnotation,
  PDFPolylineAnnotation,
  PDFPopupAnnotation,
  PDFSquareAnnotation,
  PDFSquigglyAnnotation,
  PDFStampAnnotation,
  PDFStrikeOutAnnotation,
  PDFTextAnnotation,
  PDFTextMarkupAnnotation,
  PDFUnderlineAnnotation,
  PDFUnknownAnnotation,
  type Point,
  type PolygonAnnotationOptions,
  type PolylineAnnotationOptions,
  type PopupOptions,
  type Rect,
  type RemoveAnnotationsOptions,
  rectsToQuadPoints,
  rectToQuadPoints,
  type SquareAnnotationOptions,
  STANDARD_STAMPS,
  type StampAnnotationOptions,
  type StampName,
  type TextAnnotationIcon,
  type TextAnnotationOptions,
  type TextAnnotationState,
  type TextAnnotationStateModel,
  type TextMarkupAnnotationOptions,
} from "./annotations";
