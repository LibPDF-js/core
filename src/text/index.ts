/**
 * Text extraction module for PDF documents.
 *
 * Provides functionality to extract text content with position information
 * from PDF pages, and search for text patterns.
 */

export { getPlainText, groupCharsIntoLines, type LineGrouperOptions } from "./line-grouper";
export { TextExtractor } from "./text-extractor";
export { type FormXObject, TextResources } from "./text-resources";
export { searchPage, searchPages } from "./text-search";
export { TextState } from "./text-state";
export * from "./types";
