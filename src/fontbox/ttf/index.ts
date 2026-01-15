/**
 * TrueType Font parsing module.
 *
 * Provides parsing for TrueType (.ttf) and OpenType (.otf) fonts.
 */

/** biome-ignore-all assist/source/organizeImports: api file */

// Parser
export { parseTTF, isTTF, type ParseOptions } from "./parser.ts";

// Font class
export { TrueTypeFont } from "./truetype-font.ts";

// Subsetter
export { TTFSubsetter, type SubsetOptions } from "./subsetter.ts";

// Types
export {
  type TableRecord,
  type TTFTable,
  type TableParseContext,
  type TrueTypeFontAccess,
  type TableParser,
  type TableTagValue,
  TableTag,
} from "./types.ts";

// Tables
export { parseHeadTable, type HeadTable, MAC_STYLE_BOLD, MAC_STYLE_ITALIC } from "./tables/head.ts";

export { parseHheaTable, type HheaTable } from "./tables/hhea.ts";

export { parseMaxpTable, type MaxpTable } from "./tables/maxp.ts";

export { parseHmtxTable, type HmtxTable } from "./tables/hmtx.ts";

export { parseLocaTable, type LocaTable } from "./tables/loca.ts";

export {
  parseGlyfTable,
  type GlyfTable,
  type GlyphData,
  type GlyphDescription,
  type GlyphBounds,
  type CompositeComponent,
  ON_CURVE,
  X_SHORT_VECTOR,
  Y_SHORT_VECTOR,
  REPEAT,
  X_DUAL,
  Y_DUAL,
  ARG_1_AND_2_ARE_WORDS,
  ARGS_ARE_XY_VALUES,
  ROUND_XY_TO_GRID,
  WE_HAVE_A_SCALE,
  MORE_COMPONENTS,
  WE_HAVE_AN_X_AND_Y_SCALE,
  WE_HAVE_A_TWO_BY_TWO,
  WE_HAVE_INSTRUCTIONS,
  USE_MY_METRICS,
} from "./tables/glyf.ts";

export {
  parseNameTable,
  type NameTable,
  type NameRecord,
  PLATFORM_UNICODE as NAME_PLATFORM_UNICODE,
  PLATFORM_MACINTOSH as NAME_PLATFORM_MACINTOSH,
  PLATFORM_ISO as NAME_PLATFORM_ISO,
  PLATFORM_WINDOWS as NAME_PLATFORM_WINDOWS,
  NAME_COPYRIGHT,
  NAME_FONT_FAMILY,
  NAME_FONT_SUBFAMILY,
  NAME_UNIQUE_ID,
  NAME_FULL_NAME,
  NAME_VERSION,
  NAME_POSTSCRIPT_NAME,
  NAME_TRADEMARK,
  NAME_MANUFACTURER,
  NAME_DESIGNER,
  NAME_DESCRIPTION,
  NAME_VENDOR_URL,
  NAME_DESIGNER_URL,
  NAME_LICENSE,
  NAME_LICENSE_URL,
  NAME_TYPOGRAPHIC_FAMILY,
  NAME_TYPOGRAPHIC_SUBFAMILY,
  NAME_SAMPLE_TEXT,
  NAME_WWS_FAMILY,
  NAME_WWS_SUBFAMILY,
  LANGUAGE_WINDOWS_EN_US,
  LANGUAGE_MACINTOSH_ENGLISH,
  LANGUAGE_UNICODE,
} from "./tables/name.ts";

export {
  parsePostTable,
  type PostTable,
  NUMBER_OF_MAC_GLYPHS,
  getMacGlyphIndex,
  getMacGlyphName,
  getAllMacGlyphNames,
} from "./tables/post.ts";

export {
  parseOS2Table,
  type OS2Table,
  WEIGHT_CLASS_THIN,
  WEIGHT_CLASS_EXTRA_LIGHT,
  WEIGHT_CLASS_LIGHT,
  WEIGHT_CLASS_NORMAL,
  WEIGHT_CLASS_MEDIUM,
  WEIGHT_CLASS_SEMI_BOLD,
  WEIGHT_CLASS_BOLD,
  WEIGHT_CLASS_EXTRA_BOLD,
  WEIGHT_CLASS_BLACK,
  WIDTH_CLASS_ULTRA_CONDENSED,
  WIDTH_CLASS_EXTRA_CONDENSED,
  WIDTH_CLASS_CONDENSED,
  WIDTH_CLASS_SEMI_CONDENSED,
  WIDTH_CLASS_MEDIUM,
  WIDTH_CLASS_SEMI_EXPANDED,
  WIDTH_CLASS_EXPANDED,
  WIDTH_CLASS_EXTRA_EXPANDED,
  WIDTH_CLASS_ULTRA_EXPANDED,
  FSTYPE_RESTRICTED,
  FSTYPE_PREVIEW_AND_PRINT,
  FSTYPE_EDITABLE,
  FSTYPE_NO_SUBSETTING,
  FSTYPE_BITMAP_ONLY,
  FSSELECTION_ITALIC,
  FSSELECTION_BOLD,
  FSSELECTION_REGULAR,
  FSSELECTION_USE_TYPO_METRICS,
} from "./tables/os2.ts";

export {
  parseCmapTable,
  type CmapTable,
  type CmapSubtable,
  PLATFORM_UNICODE,
  PLATFORM_MACINTOSH,
  PLATFORM_WINDOWS,
  ENCODING_WIN_SYMBOL,
  ENCODING_WIN_UNICODE_BMP,
  ENCODING_WIN_UNICODE_FULL,
  ENCODING_UNICODE_1_0,
  ENCODING_UNICODE_1_1,
  ENCODING_UNICODE_2_0_BMP,
  ENCODING_UNICODE_2_0_FULL,
} from "./tables/cmap.ts";

// Variable font tables
export {
  parseFvarTable,
  type FvarTable,
  type VariationAxis,
  type NamedInstance,
  AxisTag,
  AXIS_FLAG_HIDDEN,
  isAxisHidden,
  findAxis,
  getWeightAxis,
  getWidthAxis,
  normalizeAxisValue,
  denormalizeAxisValue,
} from "./tables/fvar.ts";

export {
  parseStatTable,
  type StatTable,
  type DesignAxisRecord,
  type AxisValue,
  type AxisValueFormat1,
  type AxisValueFormat2,
  type AxisValueFormat3,
  type AxisValueFormat4,
  type AxisValueRecord,
  AXIS_VALUE_FLAG_ELIDABLE,
  AXIS_VALUE_FLAG_OLDER_SIBLING_FONT_ATTRIBUTE,
  isAxisValueElidable,
  isOlderSiblingFontAttribute,
  findDesignAxis,
  getAxisValuesForAxis,
} from "./tables/stat.ts";

export {
  parseAvarTable,
  type AvarTable,
  type SegmentMap,
  type AxisValueMap,
  applyAvarMapping,
  isValidSegmentMap,
} from "./tables/avar.ts";
