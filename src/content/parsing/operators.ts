/**
 * Known PDF content stream operators with argument counts.
 *
 * Used for inline image EI detection validation.
 */

export interface OperatorInfo {
  numArgs: number;
  variableArgs: boolean;
}

/**
 * All known PDF content stream operators.
 *
 * Based on PDF 1.7 specification tables.
 */
export const KNOWN_OPERATORS: Record<string, OperatorInfo> = {
  // Graphics State (Table 57)
  q: { numArgs: 0, variableArgs: false },
  Q: { numArgs: 0, variableArgs: false },
  cm: { numArgs: 6, variableArgs: false },
  w: { numArgs: 1, variableArgs: false },
  J: { numArgs: 1, variableArgs: false },
  j: { numArgs: 1, variableArgs: false },
  M: { numArgs: 1, variableArgs: false },
  d: { numArgs: 2, variableArgs: false },
  ri: { numArgs: 1, variableArgs: false },
  i: { numArgs: 1, variableArgs: false },
  gs: { numArgs: 1, variableArgs: false },

  // Path Construction (Table 59)
  m: { numArgs: 2, variableArgs: false },
  l: { numArgs: 2, variableArgs: false },
  c: { numArgs: 6, variableArgs: false },
  v: { numArgs: 4, variableArgs: false },
  y: { numArgs: 4, variableArgs: false },
  h: { numArgs: 0, variableArgs: false },
  re: { numArgs: 4, variableArgs: false },

  // Path Painting (Table 60)
  S: { numArgs: 0, variableArgs: false },
  s: { numArgs: 0, variableArgs: false },
  f: { numArgs: 0, variableArgs: false },
  F: { numArgs: 0, variableArgs: false },
  "f*": { numArgs: 0, variableArgs: false },
  B: { numArgs: 0, variableArgs: false },
  "B*": { numArgs: 0, variableArgs: false },
  b: { numArgs: 0, variableArgs: false },
  "b*": { numArgs: 0, variableArgs: false },
  n: { numArgs: 0, variableArgs: false },

  // Clipping (Table 61)
  W: { numArgs: 0, variableArgs: false },
  "W*": { numArgs: 0, variableArgs: false },

  // Text State (Table 105)
  Tc: { numArgs: 1, variableArgs: false },
  Tw: { numArgs: 1, variableArgs: false },
  Tz: { numArgs: 1, variableArgs: false },
  TL: { numArgs: 1, variableArgs: false },
  Tf: { numArgs: 2, variableArgs: false },
  Tr: { numArgs: 1, variableArgs: false },
  Ts: { numArgs: 1, variableArgs: false },

  // Text Positioning (Table 106)
  BT: { numArgs: 0, variableArgs: false },
  ET: { numArgs: 0, variableArgs: false },
  Td: { numArgs: 2, variableArgs: false },
  TD: { numArgs: 2, variableArgs: false },
  Tm: { numArgs: 6, variableArgs: false },
  "T*": { numArgs: 0, variableArgs: false },

  // Text Showing (Table 107)
  Tj: { numArgs: 1, variableArgs: false },
  TJ: { numArgs: 1, variableArgs: false },
  "'": { numArgs: 1, variableArgs: false },
  '"': { numArgs: 3, variableArgs: false },

  // Color (Tables 74, 75)
  CS: { numArgs: 1, variableArgs: false },
  cs: { numArgs: 1, variableArgs: false },
  SC: { numArgs: 4, variableArgs: true }, // 1-4 args depending on color space
  SCN: { numArgs: 5, variableArgs: true }, // 1-5 args (may include pattern name)
  sc: { numArgs: 4, variableArgs: true },
  scn: { numArgs: 5, variableArgs: true },
  G: { numArgs: 1, variableArgs: false },
  g: { numArgs: 1, variableArgs: false },
  RG: { numArgs: 3, variableArgs: false },
  rg: { numArgs: 3, variableArgs: false },
  K: { numArgs: 4, variableArgs: false },
  k: { numArgs: 4, variableArgs: false },

  // XObjects (Table 87)
  Do: { numArgs: 1, variableArgs: false },

  // Marked Content (Table 320)
  MP: { numArgs: 1, variableArgs: false },
  DP: { numArgs: 2, variableArgs: false },
  BMC: { numArgs: 1, variableArgs: false },
  BDC: { numArgs: 2, variableArgs: false },
  EMC: { numArgs: 0, variableArgs: false },

  // Inline Images
  BI: { numArgs: 0, variableArgs: false },
  ID: { numArgs: 0, variableArgs: false },
  EI: { numArgs: 0, variableArgs: false },

  // Shading
  sh: { numArgs: 1, variableArgs: false },

  // Compatibility
  BX: { numArgs: 0, variableArgs: false },
  EX: { numArgs: 0, variableArgs: false },
};
