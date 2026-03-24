import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";

/**
 * Parse a PDF version string into a sortable numeric form.
 *
 * Examples:
 * - "1.4" -> 14
 * - "1.7" -> 17
 * - "2.0" -> 20
 */
export function parsePdfVersion(version: string): number {
  const [majorRaw, minorRaw = "0"] = version.split(".");

  const major = Number(majorRaw);
  const minor = Number(minorRaw);

  if (!Number.isFinite(major) || !Number.isFinite(minor)) {
    return 0;
  }

  return major * 10 + minor;
}

/**
 * Ensure the catalog /Version is at least the target version.
 *
 * Returns the resulting effective version string.
 */
export function ensureCatalogMinVersion(
  catalog: PdfDict,
  currentVersion: string,
  targetVersion: string,
): string {
  const current = parsePdfVersion(currentVersion);
  const target = parsePdfVersion(targetVersion);

  if (target <= current) {
    return currentVersion;
  }

  catalog.set("Version", PdfName.of(targetVersion));

  return targetVersion;
}
