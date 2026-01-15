/**
 * PDFLinkAnnotation - Hyperlink annotations.
 *
 * Link annotations can have URI actions (external links) or
 * destination actions (internal navigation).
 *
 * For security, we only support safe action types (URI, GoTo, GoToR).
 * Dangerous actions like JavaScript are ignored.
 *
 * PDF Reference: Section 12.5.6.5 "Link Annotations"
 */

import { PDFPage } from "#src/api/pdf-page.ts";
import { colorToArray } from "#src/helpers/colors";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNull } from "#src/objects/pdf-null";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfString } from "#src/objects/pdf-string";

import { PDFAnnotation, rectToArray } from "./base";
import type { DestinationType, LinkAnnotationOptions, LinkDestination } from "./types";

function destinationPageToRef(page: unknown): PdfRef {
  if (page instanceof PdfRef) {
    return page;
  }

  if (page instanceof PDFPage) {
    return page.ref;
  }

  throw new Error("Link destination page must be a PDFPage or PdfRef (internal GoTo)");
}

/**
 * Parsed link action.
 */
export type LinkAction =
  | { type: "uri"; uri: string }
  | { type: "goto"; destination: LinkDestination }
  | { type: "gotoRemote"; file: string; destination: LinkDestination | null }
  | null;

/**
 * Highlight mode for link annotations.
 */
export type HighlightMode = "None" | "Invert" | "Outline" | "Push";

/**
 * Link annotation - hyperlinks and internal navigation.
 */
export class PDFLinkAnnotation extends PDFAnnotation {
  /**
   * Create a new link annotation dictionary.
   */
  static create(options: LinkAnnotationOptions): PdfDict {
    const { rect } = options;

    const annotDict = PdfDict.of({
      Type: PdfName.of("Annot"),
      Subtype: PdfName.of("Link"),
      Rect: new PdfArray(rectToArray(rect)),
      F: PdfNumber.of(4), // Print flag
    });

    // Border style
    if (options.borderWidth !== undefined || options.borderColor) {
      const bs = new PdfDict();
      bs.set("W", PdfNumber.of(options.borderWidth ?? 0));
      bs.set("S", PdfName.of("S"));
      annotDict.set("BS", bs);
    }

    if (options.borderColor) {
      const components = colorToArray(options.borderColor);
      annotDict.set("C", new PdfArray(components.map(PdfNumber.of)));
    }

    // Set action or destination
    if (options.uri) {
      const action = PdfDict.of({
        S: PdfName.of("URI"),
        URI: PdfString.fromString(options.uri),
      });
      annotDict.set("A", action);
    } else if (options.destination) {
      const dest = options.destination;
      // Build destination array
      const destArray = new PdfArray([destinationPageToRef(dest.page), PdfName.of(dest.type)]);

      // Add type-specific parameters
      if (dest.type === "XYZ") {
        destArray.push(dest.left !== undefined ? PdfNumber.of(dest.left) : PdfNull.instance);
        destArray.push(dest.top !== undefined ? PdfNumber.of(dest.top) : PdfNull.instance);
        destArray.push(
          dest.zoom !== undefined && dest.zoom !== null
            ? PdfNumber.of(dest.zoom)
            : PdfNull.instance,
        );
      } else if (dest.type === "FitH" || dest.type === "FitBH") {
        destArray.push(dest.top !== undefined ? PdfNumber.of(dest.top) : PdfNull.instance);
      } else if (dest.type === "FitV" || dest.type === "FitBV") {
        destArray.push(dest.left !== undefined ? PdfNumber.of(dest.left) : PdfNull.instance);
      } else if (dest.type === "FitR" && dest.rect) {
        destArray.push(PdfNumber.of(dest.rect[0]));
        destArray.push(PdfNumber.of(dest.rect[1]));
        destArray.push(PdfNumber.of(dest.rect[2]));
        destArray.push(PdfNumber.of(dest.rect[3]));
      }

      annotDict.set("Dest", destArray);
    }

    return annotDict;
  }
  /**
   * Get the URI if this is an external link.
   */
  get uri(): string | null {
    // First check for direct /A action
    const action = this.dict.getDict("A");

    if (action) {
      const actionType = action.getName("S")?.value;

      if (actionType === "URI") {
        const uriStr = action.getString("URI");

        return uriStr?.asString() ?? null;
      }
    }

    return null;
  }

  /**
   * Get the destination if this is an internal link.
   */
  get destination(): LinkDestination | null {
    // First check for /Dest entry
    const dest = this.dict.get("Dest");

    if (dest) {
      return this.parseDestination(dest);
    }

    // Then check for GoTo action
    const action = this.dict.getDict("A");

    if (action) {
      const actionType = action.getName("S")?.value;

      if (actionType === "GoTo") {
        const d = action.get("D");

        if (d) {
          return this.parseDestination(d);
        }
      }
    }

    return null;
  }

  /**
   * Get the parsed link action.
   */
  async getAction(): Promise<LinkAction> {
    // Check URI
    const uri = this.uri;

    if (uri) {
      return { type: "uri", uri };
    }

    // Check internal destination
    const dest = this.destination;

    if (dest) {
      return { type: "goto", destination: dest };
    }

    // Check for remote GoTo
    const action = this.dict.getDict("A");

    if (action) {
      const actionType = action.getName("S")?.value;

      if (actionType === "GoToR") {
        const file = action.getString("F")?.asString() ?? "";
        const d = action.get("D");

        return {
          type: "gotoRemote",
          file,
          destination: d ? this.parseDestination(d) : null,
        };
      }

      // Log warning for dangerous actions
      if (actionType === "JavaScript" || actionType === "Launch" || actionType === "ImportData") {
        console.warn(`Ignoring potentially dangerous action type: ${actionType}`);
      }
    }

    return null;
  }

  /**
   * Highlight mode when the link is clicked.
   */
  get highlightMode(): HighlightMode {
    const h = this.dict.getName("H");

    switch (h?.value) {
      case "N":
        return "None";
      case "I":
        return "Invert";
      case "O":
        return "Outline";
      case "P":
        return "Push";
      default:
        return "Invert"; // Default per PDF spec
    }
  }

  /**
   * Parse a destination value.
   */
  private parseDestination(dest: unknown): LinkDestination | null {
    // Can be an array [page, type, ...params] or a name (named destination)
    if (Array.isArray(dest) || (dest && (dest as { type: string }).type === "array")) {
      const arr = dest as PdfArray;

      if (arr.length < 2) {
        return null;
      }

      // First element is page reference or number
      const pageEntry = arr.at(0);
      let pageNum = 0;
      let pageRef: PdfRef | undefined;

      if (pageEntry instanceof PdfNumber) {
        pageNum = pageEntry.value;
      } else if (pageEntry instanceof PdfRef) {
        pageRef = pageEntry;
      }

      // Second element is destination type
      const typeEntry = arr.at(1);
      const typeName = typeEntry instanceof PdfName ? typeEntry.value : "Fit";

      const page = pageRef ?? pageNum;

      const result: LinkDestination = {
        page,
        type: typeName as DestinationType,
      };

      // Parse additional parameters based on type
      switch (typeName) {
        case "XYZ": {
          const left = arr.at(2);
          const top = arr.at(3);
          const zoom = arr.at(4);

          if (left instanceof PdfNumber) {
            result.left = left.value;
          }

          if (top instanceof PdfNumber) {
            result.top = top.value;
          }

          if (zoom instanceof PdfNumber) {
            result.zoom = zoom.value;
          } else {
            result.zoom = null;
          }
          break;
        }
        case "FitH":
        case "FitBH": {
          const top = arr.at(2);

          if (top instanceof PdfNumber) {
            result.top = top.value;
          }
          break;
        }
        case "FitV":
        case "FitBV": {
          const left = arr.at(2);

          if (left instanceof PdfNumber) {
            result.left = left.value;
          }
          break;
        }
        case "FitR": {
          const left = arr.at(2);
          const bottom = arr.at(3);
          const right = arr.at(4);
          const top = arr.at(5);

          if (
            left instanceof PdfNumber &&
            bottom instanceof PdfNumber &&
            right instanceof PdfNumber &&
            top instanceof PdfNumber
          ) {
            result.rect = [left.value, bottom.value, right.value, top.value];
          }
          break;
        }
      }

      return result;
    }

    // Named destination - not yet supported
    return null;
  }
}
