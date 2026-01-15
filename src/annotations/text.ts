/**
 * PDFTextAnnotation - Sticky note annotations.
 *
 * Text annotations display a small icon that, when clicked,
 * shows a popup window containing the annotation text.
 *
 * PDF Reference: Section 12.5.6.4 "Text Annotations"
 */

import { colorToArray, rgb } from "#src/helpers/colors";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfBool } from "#src/objects/pdf-bool";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfString } from "#src/objects/pdf-string";

import { rectToArray } from "./base";
import { PDFMarkupAnnotation } from "./markup";
import type { TextAnnotationIcon, TextAnnotationOptions } from "./types";

/**
 * Text annotation state (for review workflows).
 */
export type TextAnnotationState =
  | "Marked"
  | "Unmarked"
  | "Accepted"
  | "Rejected"
  | "Cancelled"
  | "Completed"
  | "None";

/**
 * Text annotation state model.
 */
export type TextAnnotationStateModel = "Marked" | "Review";

/**
 * Text annotation - sticky note/comment.
 */
export class PDFTextAnnotation extends PDFMarkupAnnotation {
  /**
   * Create a new text annotation dictionary.
   */
  static create(options: TextAnnotationOptions): PdfDict {
    const { rect } = options;
    const color = options.color ?? rgb(1, 1, 0); // Default yellow
    const colorComponents = colorToArray(color);

    const annotDict = PdfDict.of({
      Type: PdfName.of("Annot"),
      Subtype: PdfName.of("Text"),
      Rect: new PdfArray(rectToArray(rect)),
      C: new PdfArray(colorComponents.map(PdfNumber.of)),
      F: PdfNumber.of(4), // Print flag
    });

    if (options.contents) {
      annotDict.set("Contents", PdfString.fromString(options.contents));
    }

    if (options.title) {
      annotDict.set("T", PdfString.fromString(options.title));
    }

    if (options.icon) {
      annotDict.set("Name", PdfName.of(options.icon));
    }

    if (options.open) {
      annotDict.set("Open", PdfBool.of(true));
    }

    return annotDict;
  }

  /**
   * Whether the annotation popup is initially open.
   */
  get isOpen(): boolean {
    const open = this.dict.getBool("Open");

    return open?.value ?? false;
  }

  /**
   * Set whether the popup is initially open.
   */
  setOpen(open: boolean): void {
    this.dict.set("Open", PdfBool.of(open));
    this.markModified();
  }

  /**
   * Icon name to display.
   */
  get icon(): TextAnnotationIcon {
    const name = this.dict.getName("Name");

    if (!name) {
      return "Note";
    }

    // Validate against known icons
    const validIcons: TextAnnotationIcon[] = [
      "Comment",
      "Key",
      "Note",
      "Help",
      "NewParagraph",
      "Paragraph",
      "Insert",
    ];

    if (validIcons.includes(name.value as TextAnnotationIcon)) {
      return name.value as TextAnnotationIcon;
    }

    return "Note";
  }

  /**
   * Set the icon to display.
   */
  setIcon(icon: TextAnnotationIcon): void {
    this.dict.set("Name", PdfName.of(icon));
    this.markModified();
  }

  /**
   * State of the annotation (for review workflows).
   */
  get state(): TextAnnotationState | null {
    const state = this.dict.getName("State");

    return (state?.value as TextAnnotationState) ?? null;
  }

  /**
   * Set the annotation state.
   */
  setState(state: TextAnnotationState): void {
    this.dict.set("State", PdfName.of(state));
    this.markModified();
  }

  /**
   * State model for the annotation.
   */
  get stateModel(): TextAnnotationStateModel | null {
    const model = this.dict.getName("StateModel");

    return (model?.value as TextAnnotationStateModel) ?? null;
  }

  /**
   * Set the state model.
   */
  setStateModel(model: TextAnnotationStateModel): void {
    this.dict.set("StateModel", PdfName.of(model));
    this.markModified();
  }
}
