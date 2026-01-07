/**
 * Builder for constructing PDF content streams from operators.
 */

import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfStream } from "#src/objects/pdf-stream";
import type { Operator } from "./operators";
import { ContentStreamSerializer } from "./parsing/content-stream-serializer";

/**
 * Builder for constructing content streams from operators.
 */
export class ContentStreamBuilder {
  private readonly operators: Operator[] = [];

  /**
   * Create a builder from an array of operators.
   * Convenient for building content streams declaratively.
   *
   * @example
   * ```ts
   * const content = ContentStreamBuilder.from([
   *   pushGraphicsState(),
   *   setLineWidth(2),
   *   moveTo(0, 0),
   *   lineTo(100, 100),
   *   stroke(),
   *   popGraphicsState(),
   * ]);
   * ```
   */
  static from(operators: Operator[]): ContentStreamBuilder {
    const builder = new ContentStreamBuilder();
    builder.operators.push(...operators);

    return builder;
  }

  /**
   * Add one or more operators.
   */
  add(...ops: Operator[]): this {
    this.operators.push(...ops);

    return this;
  }

  /**
   * Add operators conditionally.
   */
  addIf(condition: boolean, ...ops: Operator[]): this {
    if (condition) {
      this.operators.push(...ops);
    }

    return this;
  }

  /**
   * Get the number of operators.
   */
  get length(): number {
    return this.operators.length;
  }

  /**
   * Check if builder is empty.
   */
  isEmpty(): boolean {
    return this.operators.length === 0;
  }

  /**
   * Get a copy of the operators array.
   */
  getOperators(): Operator[] {
    return [...this.operators];
  }

  /**
   * Serialize to content stream string.
   * Each operator on its own line.
   */
  toString(): string {
    return new TextDecoder().decode(this.toBytes());
  }

  /**
   * Serialize to bytes.
   */
  toBytes(): Uint8Array {
    return ContentStreamSerializer.serialize(this.operators);
  }

  /**
   * Create a PdfStream with this content.
   * Optionally provide a dict to merge (e.g., for Form XObjects).
   */
  toStream(baseDict?: PdfDict): PdfStream {
    const bytes = this.toBytes();
    const dict = baseDict?.clone() ?? new PdfDict();

    dict.set("Length", PdfNumber.of(bytes.length));

    return new PdfStream(dict, bytes);
  }

  /**
   * Create a Form XObject stream.
   *
   * @param bbox Bounding box [llx, lly, urx, ury]
   * @param resources Optional resources dictionary
   * @param matrix Optional transformation matrix [a, b, c, d, e, f]
   */
  toFormXObject(
    bbox: [number, number, number, number],
    resources?: PdfDict,
    matrix?: [number, number, number, number, number, number],
  ): PdfStream {
    const dict = PdfDict.of({
      Type: PdfName.of("XObject"),
      Subtype: PdfName.of("Form"),
      BBox: PdfArray.of(
        PdfNumber.of(bbox[0]),
        PdfNumber.of(bbox[1]),
        PdfNumber.of(bbox[2]),
        PdfNumber.of(bbox[3]),
      ),
    });

    if (resources) {
      dict.set("Resources", resources);
    }

    if (matrix) {
      dict.set(
        "Matrix",
        PdfArray.of(
          PdfNumber.of(matrix[0]),
          PdfNumber.of(matrix[1]),
          PdfNumber.of(matrix[2]),
          PdfNumber.of(matrix[3]),
          PdfNumber.of(matrix[4]),
          PdfNumber.of(matrix[5]),
        ),
      );
    }

    return this.toStream(dict);
  }
}
