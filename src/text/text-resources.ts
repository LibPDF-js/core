/**
 * TextResources - Fonts and form XObjects reachable from a /Resources dict.
 *
 * Fonts are parsed on first use and cached by dictionary identity across a
 * page and its forms. A form without its own /Resources inherits those of the
 * invoking stream (deprecated by the spec, relied on by producers).
 */

import { parseFont } from "#src/fonts/font-factory";
import type { PdfFont } from "#src/fonts/pdf-font";
import { parseToUnicode, type ToUnicodeMap } from "#src/fonts/to-unicode";
import { Matrix } from "#src/helpers/matrix";
import type { RefResolver } from "#src/helpers/types";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfStream } from "#src/objects/pdf-stream";

export interface FormXObject {
  /** Identity is used to detect recursion */
  stream: PdfStream;
  content: Uint8Array;
  matrix: Matrix;
  resources: TextResources;
}

export class TextResources {
  private readonly forms = new Map<string, FormXObject | null>();

  constructor(
    private readonly dict: PdfDict | null,
    private readonly resolve: RefResolver,
    private readonly fontCache: Map<PdfDict, PdfFont> = new Map(),
  ) {}

  getFont(name: string): PdfFont | null {
    const entry = this.lookup("Font", name);

    if (!(entry instanceof PdfDict)) {
      return null;
    }

    let font = this.fontCache.get(entry);

    if (!font) {
      font = parseFont(entry, {
        resolver: this.resolve,
        toUnicodeMap: this.parseToUnicode(entry),
      });
      this.fontCache.set(entry, font);
    }

    return font;
  }

  /** Null for image XObjects and unknown names. */
  getForm(name: string): FormXObject | null {
    let form = this.forms.get(name);

    if (form === undefined) {
      form = this.loadForm(name);
      this.forms.set(name, form);
    }

    return form;
  }

  private loadForm(name: string): FormXObject | null {
    const stream = this.lookup("XObject", name);

    if (!(stream instanceof PdfStream)) {
      return null;
    }

    if (stream.getName("Subtype", this.resolve)?.value !== "Form") {
      return null;
    }

    const ownResources = stream.getDict("Resources", this.resolve);

    return {
      stream,
      content: stream.getDecodedData(),
      matrix: readMatrix(stream.getArray("Matrix", this.resolve), this.resolve),
      resources: ownResources
        ? new TextResources(ownResources, this.resolve, this.fontCache)
        : this,
    };
  }

  private lookup(category: string, name: string) {
    return this.dict?.getDict(category, this.resolve)?.get(name, this.resolve);
  }

  private parseToUnicode(fontDict: PdfDict): ToUnicodeMap | null {
    const stream = fontDict.get("ToUnicode", this.resolve);

    if (!(stream instanceof PdfStream)) {
      return null;
    }

    try {
      return parseToUnicode(stream.getDecodedData());
    } catch {
      return null;
    }
  }
}

function readMatrix(array: PdfArray | undefined, resolve: RefResolver): Matrix {
  if (!(array instanceof PdfArray) || array.length !== 6) {
    return Matrix.identity();
  }

  const values: number[] = [];

  for (let i = 0; i < 6; i++) {
    const item = array.at(i, resolve);

    if (!(item instanceof PdfNumber)) {
      return Matrix.identity();
    }

    values.push(item.value);
  }

  return Matrix.fromArray(values);
}
