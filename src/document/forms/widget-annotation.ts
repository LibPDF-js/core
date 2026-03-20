/**
 * Widget annotation for form fields.
 *
 * Widget annotations are the visual representation of form fields on a page.
 * A field can have one widget (merged) or multiple widgets (separate).
 *
 * PDF Reference: Section 12.5.6.19 "Widget Annotations"
 */

import type { PdfArray } from "#src/objects/pdf-array.ts";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfStream } from "#src/objects/pdf-stream";

import type { ObjectRegistry } from "../object-registry";

/**
 * Appearance characteristics from /MK dictionary.
 */
export interface AppearanceCharacteristics {
  /** Rotation in degrees (0, 90, 180, 270) */
  rotation: number;
  /** Border color (grayscale, RGB, or CMYK) */
  borderColor?: number[];
  /** Background color */
  backgroundColor?: number[];
  /** Caption text */
  caption?: string;
  /** Rollover caption */
  rolloverCaption?: string;
  /** Alternate (down) caption */
  alternateCaption?: string;
}

/**
 * Border style from /BS dictionary.
 */
export interface BorderStyle {
  /** Border width in points */
  width: number;
  /** Border style: S=solid, D=dashed, B=beveled, I=inset, U=underline */
  style: string;
  /** Dash array for dashed style */
  dashArray?: number[];
}

/**
 * Widget annotation - visual representation of a form field.
 */
export class WidgetAnnotation {
  readonly dict: PdfDict;
  readonly ref: PdfRef | null;
  private readonly registry: ObjectRegistry;

  constructor(dict: PdfDict, ref: PdfRef | null, registry: ObjectRegistry) {
    this.dict = dict;
    this.ref = ref;
    this.registry = registry;
  }

  /**
   * Annotation rectangle [x1, y1, x2, y2] in default user space.
   */
  get rect(): [number, number, number, number] {
    const arr = this.dict.getArray("Rect");

    if (!arr || arr.length < 4) {
      return [0, 0, 0, 0];
    }

    const [x1, y1, x2, y2] = arr
      .toArray()
      .map(item => (item instanceof PdfNumber ? item.value : 0));

    return [x1 ?? 0, y1 ?? 0, x2 ?? 0, y2 ?? 0];
  }

  /**
   * Widget width in points.
   */
  get width(): number {
    const [x1, , x2] = this.rect;

    return Math.abs(x2 - x1);
  }

  /**
   * Widget height in points.
   */
  get height(): number {
    const [, y1, , y2] = this.rect;

    return Math.abs(y2 - y1);
  }

  /**
   * Reference to the page containing this widget.
   */
  get pageRef(): PdfRef | null {
    const p = this.dict.get("P");

    return p?.type === "ref" ? p : null;
  }

  /**
   * Current appearance state name (e.g., "Yes", "Off").
   * Used for checkboxes/radios to select which appearance to show.
   */
  get appearanceState(): string | null {
    const as = this.dict.get("AS");

    return as instanceof PdfName ? as.value : null;
  }

  /**
   * Set the appearance state (/AS).
   */
  setAppearanceState(state: string): void {
    this.dict.set("AS", PdfName.of(state));
  }

  /**
   * Set the normal appearance stream.
   * For stateful widgets (checkbox/radio), use state parameter.
   *
   * @param stream The appearance stream
   * @param state Optional state name for stateful widgets
   */
  setNormalAppearance(stream: PdfStream, state?: string): void {
    const resolve = this.registry.resolve.bind(this.registry);
    let ap = this.dict.getDict("AP", resolve);

    if (!ap) {
      ap = new PdfDict();
      this.dict.set("AP", ap);
    }

    if (state) {
      // Stateful: AP.N is a dict of state -> stream
      const nEntry = ap.get("N", resolve);
      let nDict: PdfDict;

      if (nEntry instanceof PdfDict && !(nEntry instanceof PdfStream)) {
        nDict = nEntry;
      } else {
        nDict = new PdfDict();
        ap.set("N", nDict);
      }

      const streamRef = this.registry.register(stream);
      nDict.set(state, streamRef);
    } else {
      // Stateless: AP.N is the stream directly
      const streamRef = this.registry.register(stream);
      ap.set("N", streamRef);
    }
  }

  /**
   * Annotation flags.
   */
  get flags(): number {
    return this.dict.getNumber("F")?.value ?? 0;
  }

  /**
   * Check if widget is hidden.
   */
  isHidden(): boolean {
    return (this.flags & (1 << 1)) !== 0; // Bit 2
  }

  /**
   * Check if widget is printable.
   */
  isPrintable(): boolean {
    return (this.flags & (1 << 2)) !== 0; // Bit 3
  }

  /**
   * Get the "on" value for this widget (from AP.N keys).
   * For checkboxes/radios, this is the value when checked.
   */
  getOnValue(): string | null {
    const ap = this.dict.getDict("AP", this.registry.resolve.bind(this.registry));

    if (!ap) {
      return null;
    }

    const resolve = this.registry.resolve.bind(this.registry);
    const n = ap.get("N", resolve);

    if (!n) {
      return null;
    }

    // If N is a dict (not a stream), find the non-"Off" key
    if (n instanceof PdfDict && !(n instanceof PdfStream)) {
      for (const key of n.keys()) {
        if (key.value !== "Off") {
          return key.value;
        }
      }
    }

    return null;
  }

  /**
   * Check if this widget has appearance streams for all specified states.
   *
   * @param states States to check (e.g., ["Yes", "Off"] for checkbox)
   * @returns True if all states have appearance streams
   */
  hasAppearancesForStates(states: string[]): boolean {
    const ap = this.dict.getDict("AP", this.registry.resolve.bind(this.registry));

    if (!ap) {
      return false;
    }

    const resolve = this.registry.resolve.bind(this.registry);
    const n = ap.get("N", resolve);

    if (!n) {
      return false;
    }

    // If N is a dict (not a stream), check for each state
    if (n instanceof PdfDict && !(n instanceof PdfStream)) {
      for (const state of states) {
        if (!n.has(state)) {
          return false;
        }
      }

      return true;
    }

    // If N is a stream directly (not a dict), only valid for single state
    return states.length === 0;
  }

  /**
   * Check if this widget has any normal appearance stream.
   */
  hasNormalAppearance(): boolean {
    const resolve = this.registry.resolve.bind(this.registry);
    const ap = this.dict.getDict("AP", resolve);

    if (!ap) {
      return false;
    }

    const n = ap.get("N", resolve);

    return n !== null && n !== undefined;
  }

  /**
   * Get normal appearance stream.
   * For stateful widgets (checkbox/radio), pass the state name.
   */
  getNormalAppearance(state?: string): PdfStream | null {
    const ap = this.dict.getDict("AP", this.registry.resolve.bind(this.registry));

    if (!ap) {
      return null;
    }

    const resolve = this.registry.resolve.bind(this.registry);
    const n = ap.get("N", resolve);

    if (!n) {
      return null;
    }

    if (n instanceof PdfStream) {
      return n;
    }

    if (n instanceof PdfDict) {
      const stateKey = state ?? this.appearanceState ?? "Off";
      const stateEntry = n.get(stateKey, resolve);

      if (stateEntry instanceof PdfStream) {
        return stateEntry;
      }

      return null;
    }

    return null;
  }

  /**
   * Get rollover appearance stream (shown on mouse hover).
   */
  getRolloverAppearance(state?: string): PdfStream | null {
    const ap = this.dict.getDict("AP", this.registry.resolve.bind(this.registry));

    if (!ap) {
      return null;
    }

    const resolve = this.registry.resolve.bind(this.registry);
    const r = ap.get("R", resolve);

    if (!r) {
      return null;
    }

    if (r instanceof PdfStream) {
      return r;
    }

    if (r instanceof PdfDict) {
      const stateKey = state ?? this.appearanceState ?? "Off";
      const stateEntry = r.get(stateKey, resolve);

      if (stateEntry instanceof PdfStream) {
        return stateEntry;
      }

      return null;
    }

    return null;
  }

  /**
   * Get down appearance stream (shown when clicked).
   */
  getDownAppearance(state?: string): PdfStream | null {
    const ap = this.dict.getDict("AP", this.registry.resolve.bind(this.registry));

    if (!ap) {
      return null;
    }

    const resolve = this.registry.resolve.bind(this.registry);
    const d = ap.get("D", resolve);

    if (!d) {
      return null;
    }

    if (d instanceof PdfStream) {
      return d;
    }

    if (d instanceof PdfDict) {
      const stateKey = state ?? this.appearanceState ?? "Off";
      const stateEntry = d.get(stateKey, resolve);

      if (stateEntry instanceof PdfStream) {
        return stateEntry;
      }

      return null;
    }

    return null;
  }

  /**
   * Get border style.
   */
  getBorderStyle(): BorderStyle | null {
    const bs = this.dict.getDict("BS", this.registry.resolve.bind(this.registry));

    if (!bs) {
      return null;
    }

    const result: BorderStyle = {
      width: bs.getNumber("W")?.value ?? 1,
      style: bs.getName("S")?.value ?? "S",
    };

    const d = bs.getArray("D");

    if (d) {
      result.dashArray = [];

      for (let i = 0; i < d.length; i++) {
        const val = d.at(i);

        if (val?.type === "number") {
          result.dashArray.push(val.value);
        }
      }
    }

    return result;
  }

  /**
   * Get appearance characteristics (/MK dictionary).
   */
  getAppearanceCharacteristics(): AppearanceCharacteristics | null {
    const resolve = this.registry.resolve.bind(this.registry);
    const mk = this.dict.getDict("MK", resolve);

    if (!mk) {
      return null;
    }

    return {
      rotation: mk.getNumber("R")?.value ?? 0,
      borderColor: this.parseColorArray(mk.getArray("BC")),
      backgroundColor: this.parseColorArray(mk.getArray("BG")),
      caption: mk.getString("CA")?.asString(),
      rolloverCaption: mk.getString("RC")?.asString(),
      alternateCaption: mk.getString("AC")?.asString(),
    };
  }

  /**
   * Parse a color array (grayscale, RGB, or CMYK).
   */
  private parseColorArray(arr: PdfArray | undefined): number[] | undefined {
    if (!arr || arr.length === 0) {
      return undefined;
    }

    const colors: number[] = [];

    for (let i = 0; i < arr.length; i++) {
      const val = arr.at(i);

      if (val?.type === "number") {
        colors.push(val.value);
      }
    }

    return colors.length > 0 ? colors : undefined;
  }
}
