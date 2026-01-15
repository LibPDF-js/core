/**
 * PDFFreeTextAnnotation - Text box annotations.
 *
 * FreeText annotations display text directly on the page,
 * without the need for a popup window.
 *
 * PDF Reference: Section 12.5.6.6 "Free Text Annotations"
 */

import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfString } from "#src/objects/pdf-string";

import { PDFMarkupAnnotation } from "./markup";

/**
 * Text justification for FreeText annotations.
 */
export type FreeTextJustification = "left" | "center" | "right";

/**
 * FreeText annotation - text box displayed on page.
 */
export class PDFFreeTextAnnotation extends PDFMarkupAnnotation {
  /**
   * Default appearance string (DA).
   * Contains font and color operators.
   */
  get defaultAppearance(): string | null {
    const da = this.dict.getString("DA");

    return da?.asString() ?? null;
  }

  /**
   * Set the default appearance.
   */
  setDefaultAppearance(da: string): void {
    this.dict.set("DA", PdfString.fromString(da));
    this.markModified();
  }

  /**
   * Text justification: 0=left, 1=center, 2=right.
   */
  get justification(): FreeTextJustification {
    const q = this.dict.getNumber("Q");
    const val = q?.value ?? 0;

    switch (val) {
      case 1:
        return "center";
      case 2:
        return "right";
      default:
        return "left";
    }
  }

  /**
   * Set the text justification.
   */
  setJustification(justification: FreeTextJustification): void {
    let val = 0;

    if (justification === "center") {
      val = 1;
    } else if (justification === "right") {
      val = 2;
    }

    this.dict.set("Q", PdfNumber.of(val));
    this.markModified();
  }

  /**
   * Default style string (DS).
   * Contains CSS-style formatting.
   */
  get defaultStyle(): string | null {
    const ds = this.dict.getString("DS");

    return ds?.asString() ?? null;
  }

  /**
   * Set the default style.
   */
  setDefaultStyle(ds: string): void {
    this.dict.set("DS", PdfString.fromString(ds));
    this.markModified();
  }

  /**
   * Intent (IT) - specific to FreeText annotations.
   * Can be "FreeText", "FreeTextCallout", or "FreeTextTypeWriter".
   */
  get freeTextIntent(): string | null {
    const it = this.dict.getName("IT");

    return it?.value ?? null;
  }

  /**
   * Set the intent.
   */
  setFreeTextIntent(intent: "FreeText" | "FreeTextCallout" | "FreeTextTypeWriter"): void {
    this.dict.set("IT", PdfName.of(intent));
    this.markModified();
  }
}
