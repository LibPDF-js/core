/**
 * PDF formatting utilities.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Date Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a JavaScript Date as a PDF date string.
 *
 * PDF date format: D:YYYYMMDDHHmmssZ
 * Always outputs in UTC with Z suffix.
 *
 * @param date - Date to format
 * @returns PDF date string in UTC
 */
export function formatPdfDate(date: Date): string {
  const pad = (n: number, len = 2) => n.toString().padStart(len, "0");

  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());

  return `D:${year}${month}${day}${hours}${minutes}${seconds}Z`;
}

/**
 * Parse a PDF date string into a JavaScript Date.
 *
 * Supports the full PDF date format: D:YYYYMMDDHHmmSSOHH'mm'
 * Where O is the timezone offset indicator (+, -, or Z).
 *
 * @example
 * parsePdfDate("D:20240115123045Z")      // UTC
 * parsePdfDate("D:20240115123045+05'30'") // With timezone
 * parsePdfDate("D:2024")                  // Partial (year only)
 *
 * @param str - PDF date string to parse
 * @returns Parsed Date, or undefined if invalid
 */
export function parsePdfDate(str: string): Date | undefined {
  // Remove D: prefix if present
  let s = str;

  if (s.startsWith("D:")) {
    s = s.slice(2);
  }

  // Minimum: YYYY (4 chars) and must start with digits
  if (s.length < 4 || !/^\d{4}/.test(s)) {
    return undefined;
  }

  try {
    const year = parseInt(s.slice(0, 4), 10);
    const month = s.length >= 6 ? parseInt(s.slice(4, 6), 10) - 1 : 0;
    const day = s.length >= 8 ? parseInt(s.slice(6, 8), 10) : 1;
    const hour = s.length >= 10 ? parseInt(s.slice(8, 10), 10) : 0;
    const minute = s.length >= 12 ? parseInt(s.slice(10, 12), 10) : 0;
    const second = s.length >= 14 ? parseInt(s.slice(12, 14), 10) : 0;

    // Validate parsed values
    if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
      return undefined;
    }

    // Parse timezone if present
    let tzOffset = 0;

    if (s.length >= 15) {
      const tzChar = s.charAt(14);

      if (tzChar === "Z") {
        tzOffset = 0;
      } else if (tzChar === "+" || tzChar === "-") {
        const tzHour = parseInt(s.slice(15, 17), 10) || 0;
        const tzMin = parseInt(s.slice(18, 20), 10) || 0;
        tzOffset = (tzHour * 60 + tzMin) * (tzChar === "-" ? 1 : -1);
      }
    }

    const date = new Date(Date.UTC(year, month, day, hour, minute, second));
    date.setUTCMinutes(date.getUTCMinutes() + tzOffset);

    return date;
  } catch {
    return undefined;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Number Formatting
// ─────────────────────────────────────────────────────────────────────────────

const TRAILING_ZERO_REGEX = /\.?0+$/;

/**
 * Format a number for PDF output.
 *
 * - Integers are written without decimal point
 * - Reals use minimal precision (no trailing zeros)
 * - PDF spec recommends up to 5 decimal places
 */
export function formatPdfNumber(value: number): string {
  if (Number.isInteger(value)) {
    return value.toString();
  }

  // Use fixed precision, then strip trailing zeros
  let str = value.toFixed(5);

  // Remove trailing zeros and unnecessary decimal point
  str = str.replace(TRAILING_ZERO_REGEX, "");

  // Handle edge case where we stripped everything after decimal
  if (str === "" || str === "-") {
    return "0";
  }

  return str;
}
