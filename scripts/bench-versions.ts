/**
 * Resolves installed versions of the libraries used in benchmark comparisons.
 *
 * Versions are read from node_modules at generation time, so reports always
 * reflect the packages that actually ran, not the semver ranges in
 * package.json.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Competitor libraries used in benchmarks/comparison.bench.ts. */
export const COMPARISON_LIBRARIES = ["pdf-lib", "@cantoo/pdf-lib"] as const;

function readPackageMetadata(path: string): { name?: string; version?: string } {
  const value: unknown = JSON.parse(readFileSync(path, "utf-8"));

  if (typeof value !== "object" || value === null) {
    return {};
  }

  const name = "name" in value && typeof value.name === "string" ? value.name : undefined;
  const version =
    "version" in value && typeof value.version === "string" ? value.version : undefined;

  return { name, version };
}

/**
 * Read the installed version of a package from node_modules.
 * Returns "unknown" if the package cannot be resolved.
 */
export function getInstalledVersion(name: string, root = process.cwd()): string {
  try {
    const pkgPath = join(root, "node_modules", name, "package.json");
    const pkg = readPackageMetadata(pkgPath);

    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Format a one-line summary of all benchmarked library versions,
 * e.g. "@libpdf/core 0.1.0 (this repo), pdf-lib 1.17.1, @cantoo/pdf-lib 2.9.1".
 */
export function getLibraryVersions(root = process.cwd()): string {
  let ownLabel = "@libpdf/core";

  try {
    const pkg = readPackageMetadata(join(root, "package.json"));

    ownLabel = `${pkg.name ?? "@libpdf/core"} ${pkg.version ?? "unknown"} (this repo)`;
  } catch {
    ownLabel = "@libpdf/core unknown (this repo)";
  }

  const competitors = COMPARISON_LIBRARIES.map(
    name => `${name} ${getInstalledVersion(name, root)}`,
  );

  return [ownLabel, ...competitors].join(", ");
}
