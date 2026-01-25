/**
 * SVG Path Parser
 *
 * Parses SVG path `d` attribute strings into command objects.
 * Handles all SVG path commands: M, L, H, V, C, S, Q, T, A, Z
 * in both absolute (uppercase) and relative (lowercase) forms.
 */

/**
 * SVG path command types.
 */
export type SvgPathCommandType =
  | "M"
  | "m"
  | "L"
  | "l"
  | "H"
  | "h"
  | "V"
  | "v"
  | "C"
  | "c"
  | "S"
  | "s"
  | "Q"
  | "q"
  | "T"
  | "t"
  | "A"
  | "a"
  | "Z"
  | "z";

/**
 * Base interface for all path commands.
 */
interface SvgPathCommandBase {
  type: SvgPathCommandType;
}

/**
 * Move to command (M/m).
 */
export interface MoveToCommand extends SvgPathCommandBase {
  type: "M" | "m";
  x: number;
  y: number;
}

/**
 * Line to command (L/l).
 */
export interface LineToCommand extends SvgPathCommandBase {
  type: "L" | "l";
  x: number;
  y: number;
}

/**
 * Horizontal line command (H/h).
 */
export interface HorizontalLineCommand extends SvgPathCommandBase {
  type: "H" | "h";
  x: number;
}

/**
 * Vertical line command (V/v).
 */
export interface VerticalLineCommand extends SvgPathCommandBase {
  type: "V" | "v";
  y: number;
}

/**
 * Cubic bezier curve command (C/c).
 */
export interface CubicCurveCommand extends SvgPathCommandBase {
  type: "C" | "c";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x: number;
  y: number;
}

/**
 * Smooth cubic bezier curve command (S/s).
 */
export interface SmoothCubicCurveCommand extends SvgPathCommandBase {
  type: "S" | "s";
  x2: number;
  y2: number;
  x: number;
  y: number;
}

/**
 * Quadratic bezier curve command (Q/q).
 */
export interface QuadraticCurveCommand extends SvgPathCommandBase {
  type: "Q" | "q";
  x1: number;
  y1: number;
  x: number;
  y: number;
}

/**
 * Smooth quadratic bezier curve command (T/t).
 */
export interface SmoothQuadraticCurveCommand extends SvgPathCommandBase {
  type: "T" | "t";
  x: number;
  y: number;
}

/**
 * Elliptical arc command (A/a).
 */
export interface ArcCommand extends SvgPathCommandBase {
  type: "A" | "a";
  rx: number;
  ry: number;
  xAxisRotation: number;
  largeArcFlag: boolean;
  sweepFlag: boolean;
  x: number;
  y: number;
}

/**
 * Close path command (Z/z).
 */
export interface ClosePathCommand extends SvgPathCommandBase {
  type: "Z" | "z";
}

/**
 * Union type for all SVG path commands.
 */
export type SvgPathCommand =
  | MoveToCommand
  | LineToCommand
  | HorizontalLineCommand
  | VerticalLineCommand
  | CubicCurveCommand
  | SmoothCubicCurveCommand
  | QuadraticCurveCommand
  | SmoothQuadraticCurveCommand
  | ArcCommand
  | ClosePathCommand;

/**
 * Number of parameters required for each command type.
 */
const COMMAND_PARAMS: Record<SvgPathCommandType, number> = {
  M: 2,
  m: 2,
  L: 2,
  l: 2,
  H: 1,
  h: 1,
  V: 1,
  v: 1,
  C: 6,
  c: 6,
  S: 4,
  s: 4,
  Q: 4,
  q: 4,
  T: 2,
  t: 2,
  A: 7,
  a: 7,
  Z: 0,
  z: 0,
};

/**
 * Check if a character is a command letter.
 */
function isCommandLetter(char: string): char is SvgPathCommandType {
  return /^[MmLlHhVvCcSsQqTtAaZz]$/.test(char);
}

/**
 * Check if a character can start a number.
 */
function isNumberStart(char: string): boolean {
  return /^[0-9.+-]$/.test(char);
}

/**
 * Tokenizer for SVG path strings.
 * Extracts command letters and numbers from the path string.
 */
class PathTokenizer {
  private readonly path: string;
  private pos = 0;

  constructor(path: string) {
    this.path = path;
  }

  /**
   * Skip whitespace and commas.
   */
  private skipWhitespaceAndCommas(): void {
    while (this.pos < this.path.length) {
      const char = this.path[this.pos];

      if (char === " " || char === "\t" || char === "\n" || char === "\r" || char === ",") {
        this.pos++;
      } else {
        break;
      }
    }
  }

  /**
   * Read a number from the current position.
   * Handles integers, decimals, negative numbers, and scientific notation.
   */
  readNumber(): number | null {
    this.skipWhitespaceAndCommas();

    if (this.pos >= this.path.length) {
      return null;
    }

    const char = this.path[this.pos];

    // Check if this is a command letter (not a number)
    if (isCommandLetter(char)) {
      return null;
    }

    if (!isNumberStart(char)) {
      this.pos++;

      return null;
    }

    // Start building the number string
    let numStr = "";
    let hasDecimal = false;
    let hasExponent = false;

    // Handle leading sign
    if (char === "+" || char === "-") {
      numStr += char;
      this.pos++;
    }

    // Read digits and decimal point
    while (this.pos < this.path.length) {
      const c = this.path[this.pos];

      if (c >= "0" && c <= "9") {
        numStr += c;
        this.pos++;
      } else if (c === "." && !hasDecimal && !hasExponent) {
        // Allow decimal point
        numStr += c;
        hasDecimal = true;
        this.pos++;
      } else if ((c === "e" || c === "E") && !hasExponent && numStr.length > 0) {
        // Scientific notation
        numStr += c;
        hasExponent = true;
        this.pos++;

        // Handle optional sign after exponent
        if (this.pos < this.path.length) {
          const signChar = this.path[this.pos];

          if (signChar === "+" || signChar === "-") {
            numStr += signChar;
            this.pos++;
          }
        }
      } else {
        break;
      }
    }

    if (numStr === "" || numStr === "+" || numStr === "-" || numStr === ".") {
      return null;
    }

    const value = Number.parseFloat(numStr);

    return Number.isNaN(value) ? null : value;
  }

  /**
   * Read a command letter from the current position.
   */
  readCommand(): SvgPathCommandType | null {
    this.skipWhitespaceAndCommas();

    if (this.pos >= this.path.length) {
      return null;
    }

    const char = this.path[this.pos];

    if (isCommandLetter(char)) {
      this.pos++;

      return char;
    }

    return null;
  }

  /**
   * Peek at the next character without consuming it.
   */
  peek(): string | null {
    this.skipWhitespaceAndCommas();

    if (this.pos >= this.path.length) {
      return null;
    }

    return this.path[this.pos];
  }

  /**
   * Check if there's more content to parse.
   */
  hasMore(): boolean {
    this.skipWhitespaceAndCommas();

    return this.pos < this.path.length;
  }

  /**
   * Read a single flag digit (0 or 1) for arc commands.
   * SVG arc flags are special - they're single digits that can be
   * concatenated without separators: "00" means two flags, both 0.
   */
  readFlag(): number | null {
    this.skipWhitespaceAndCommas();

    if (this.pos >= this.path.length) {
      return null;
    }

    const char = this.path[this.pos];

    if (char === "0" || char === "1") {
      this.pos++;
      return char === "1" ? 1 : 0;
    }

    return null;
  }
}

/**
 * Parse an SVG path string into an array of commands.
 *
 * @param pathData - The SVG path `d` attribute string
 * @returns Array of parsed path commands
 *
 * @example
 * ```typescript
 * const commands = parseSvgPath("M 10 10 L 100 10 L 100 100 Z");
 * // [
 * //   { type: "M", x: 10, y: 10 },
 * //   { type: "L", x: 100, y: 10 },
 * //   { type: "L", x: 100, y: 100 },
 * //   { type: "Z" },
 * // ]
 * ```
 */
export function parseSvgPath(pathData: string): SvgPathCommand[] {
  const commands: SvgPathCommand[] = [];
  const tokenizer = new PathTokenizer(pathData);

  let currentCommand: SvgPathCommandType | null = null;
  let isFirstInSequence = true;

  while (tokenizer.hasMore()) {
    // Try to read a command letter
    const nextChar = tokenizer.peek();

    if (nextChar && isCommandLetter(nextChar)) {
      currentCommand = tokenizer.readCommand();
      isFirstInSequence = true;
    }

    if (!currentCommand) {
      // Skip invalid character
      break;
    }

    // Get the number of parameters for this command
    const paramCount = COMMAND_PARAMS[currentCommand];

    // Handle close path (no parameters)
    if (currentCommand === "Z" || currentCommand === "z") {
      commands.push({ type: currentCommand });
      currentCommand = null;

      continue;
    }

    // Read the required number of parameters
    const params: number[] = [];

    // Arc commands need special handling for the flag parameters
    const isArc = currentCommand === "A" || currentCommand === "a";

    for (let i = 0; i < paramCount; i++) {
      let num: number | null;

      // For arc commands, parameters 3 and 4 are single-digit flags (0 or 1)
      // They can be packed together without separators: "00" means flag=0, flag=0
      if (isArc && (i === 3 || i === 4)) {
        num = tokenizer.readFlag();
      } else {
        num = tokenizer.readNumber();
      }

      if (num === null) {
        // Not enough parameters - stop parsing this command
        break;
      }

      params.push(num);
    }

    if (params.length !== paramCount) {
      // Not enough parameters for this command - skip it
      continue;
    }

    // Create the command based on type
    const command = createCommand(currentCommand, params);

    if (command) {
      commands.push(command);
    }

    // Handle implicit command repetition
    // After M, implicit commands become L; after m, they become l
    if (isFirstInSequence) {
      isFirstInSequence = false;

      if (currentCommand === "M") {
        currentCommand = "L";
      } else if (currentCommand === "m") {
        currentCommand = "l";
      }
    }

    // Check if there are more numbers (implicit repetition)
    const nextPeek = tokenizer.peek();

    if (!nextPeek || isCommandLetter(nextPeek)) {
      // No more numbers for this command, reset for next command
      if (!nextPeek) {
        break;
      }
    }
  }

  return commands;
}

/**
 * Create a command object from type and parameters.
 */
function createCommand(type: SvgPathCommandType, params: number[]): SvgPathCommand | null {
  switch (type) {
    case "M":
    case "m":
      return { type, x: params[0], y: params[1] };

    case "L":
    case "l":
      return { type, x: params[0], y: params[1] };

    case "H":
    case "h":
      return { type, x: params[0] };

    case "V":
    case "v":
      return { type, y: params[0] };

    case "C":
    case "c":
      return {
        type,
        x1: params[0],
        y1: params[1],
        x2: params[2],
        y2: params[3],
        x: params[4],
        y: params[5],
      };

    case "S":
    case "s":
      return { type, x2: params[0], y2: params[1], x: params[2], y: params[3] };

    case "Q":
    case "q":
      return { type, x1: params[0], y1: params[1], x: params[2], y: params[3] };

    case "T":
    case "t":
      return { type, x: params[0], y: params[1] };

    case "A":
    case "a":
      return {
        type,
        rx: params[0],
        ry: params[1],
        xAxisRotation: params[2],
        largeArcFlag: params[3] !== 0,
        sweepFlag: params[4] !== 0,
        x: params[5],
        y: params[6],
      };

    case "Z":
    case "z":
      return { type };

    default:
      return null;
  }
}
