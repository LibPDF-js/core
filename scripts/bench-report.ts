/**
 * Benchmark report generator.
 *
 * Runs vitest bench with JSON output, then transforms the results
 * into a markdown report saved to reports/benchmarks.md.
 *
 * Usage:
 *   bun run scripts/bench-report.ts
 *   bun run scripts/bench-report.ts --json-only    # Just dump JSON, skip markdown
 *   bun run scripts/bench-report.ts --from-json results.json  # Generate from existing JSON
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cpus, platform, totalmem } from "node:os";

// ─────────────────────────────────────────────────────────────────────────────
// Types for vitest bench JSON output
// ─────────────────────────────────────────────────────────────────────────────

interface BenchmarkResult {
  name: string;
  rank: number;
  rme: number;
  hz: number;
  min: number;
  max: number;
  mean: number;
  p75: number;
  p99: number;
  p995: number;
  p999: number;
  sampleCount: number;
  median: number;
}

interface BenchmarkGroup {
  fullName: string;
  benchmarks: BenchmarkResult[];
}

interface BenchmarkFile {
  filepath: string;
  groups: BenchmarkGroup[];
}

interface BenchmarkOutput {
  files: BenchmarkFile[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatHz(hz: number): string {
  if (hz >= 1000) {
    return `${(hz / 1000).toFixed(1)}K`;
  }

  if (hz >= 1) {
    return hz.toFixed(1);
  }

  return hz.toFixed(3);
}

function formatTime(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }

  if (ms >= 1) {
    return `${ms.toFixed(2)}ms`;
  }

  return `${(ms * 1000).toFixed(0)}us`;
}

function formatRme(rme: number): string {
  return `\u00b1${rme.toFixed(2)}%`;
}

function getSystemInfo(): string {
  const cpu = cpus()[0];
  const cpuModel = cpu?.model ?? "Unknown CPU";
  const cpuCount = cpus().length;
  const mem = (totalmem() / 1024 / 1024 / 1024).toFixed(0);
  const os = platform();
  const runtime = `Bun ${process.versions.bun ?? "unknown"}`;

  return `${os} | ${cpuModel} (${cpuCount} cores) | ${mem}GB RAM | ${runtime}`;
}

/**
 * Extract a short file label from a benchmark filepath.
 * e.g. "/Users/.../benchmarks/loading.bench.ts" -> "Loading"
 */
function fileLabel(filepath: string): string {
  const match = filepath.match(/([^/]+)\.bench\.ts$/);

  if (!match) {
    return filepath;
  }

  const name = match[1];

  return name.charAt(0).toUpperCase() + name.slice(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Markdown generation
// ─────────────────────────────────────────────────────────────────────────────

function generateMarkdown(data: BenchmarkOutput): string {
  const lines: string[] = [];
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toISOString().split("T")[1].split(".")[0];

  lines.push("# Benchmark Report");
  lines.push("");
  lines.push(`> Generated on ${dateStr} at ${timeStr} UTC`);
  lines.push(`>`);
  lines.push(`> System: ${getSystemInfo()}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Table of contents
  lines.push("## Contents");
  lines.push("");

  for (const file of data.files) {
    const label = fileLabel(file.filepath);
    const anchor = label.toLowerCase().replace(/\s+/g, "-");
    lines.push(`- [${label}](#${anchor})`);
  }

  lines.push("");

  // Each file becomes a section
  for (const file of data.files) {
    const label = fileLabel(file.filepath);
    lines.push(`## ${label}`);
    lines.push("");

    for (const group of file.groups) {
      // If the group name differs from the file-level name, add a subheading
      const groupName = group.fullName.replace(/^benchmarks\/[^>]+> /, "").trim();
      const isTopLevel = group.benchmarks.length > 0 && !groupName.includes(" > ");

      // Check if this group has a describe() wrapper (indicated by " > " in fullName)
      const describeName = group.fullName.includes(" > ")
        ? group.fullName.split(" > ").slice(1).join(" > ")
        : null;

      if (describeName) {
        lines.push(`### ${describeName}`);
        lines.push("");
      }

      // Build the results table
      lines.push("| Benchmark | ops/sec | Mean | p99 | RME | Samples |");
      lines.push("|:---|---:|---:|---:|---:|---:|");

      // Sort by rank
      const sorted = [...group.benchmarks].sort((a, b) => a.rank - b.rank);

      for (const bench of sorted) {
        const name = bench.name;
        const hz = formatHz(bench.hz);
        const mean = formatTime(bench.mean);
        const p99 = formatTime(bench.p99);
        const rme = formatRme(bench.rme);
        const samples = bench.sampleCount.toLocaleString();

        lines.push(`| ${name} | ${hz} | ${mean} | ${p99} | ${rme} | ${samples} |`);
      }

      lines.push("");

      // Add comparison summary for groups with multiple benchmarks
      if (sorted.length >= 2) {
        const fastest = sorted[0];
        const rest = sorted.slice(1);

        for (const slower of rest) {
          const ratio = (fastest.hz / slower.hz).toFixed(2);
          lines.push(`- **${fastest.name}** is ${ratio}x faster than ${slower.name}`);
        }

        lines.push("");
      }
    }
  }

  // Footer
  lines.push("---");
  lines.push("");
  lines.push("*Results are machine-dependent. Use for relative comparison only.*");
  lines.push("");

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const jsonOnly = args.includes("--json-only");
const fromJsonIdx = args.indexOf("--from-json");

const jsonPath = "reports/bench-results.json";
const mdPath = "reports/benchmarks.md";

mkdirSync("reports", { recursive: true });

let data: BenchmarkOutput;

if (fromJsonIdx !== -1 && args[fromJsonIdx + 1]) {
  // Generate markdown from an existing JSON file
  const inputPath = args[fromJsonIdx + 1];

  if (!existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  data = JSON.parse(readFileSync(inputPath, "utf-8")) as BenchmarkOutput;
  console.log(`Loaded benchmark results from ${inputPath}`);
} else {
  // Run benchmarks and capture JSON
  console.log("Running benchmarks...\n");

  try {
    execSync(`bun run bench -- --outputJson ${jsonPath}`, {
      stdio: "inherit",
      timeout: 600_000, // 10 minute timeout
    });
  } catch (error) {
    console.error("Benchmark run failed");
    process.exit(1);
  }

  if (!existsSync(jsonPath)) {
    console.error(`Expected JSON output at ${jsonPath} but file not found`);
    process.exit(1);
  }

  data = JSON.parse(readFileSync(jsonPath, "utf-8")) as BenchmarkOutput;
  console.log(`\nBenchmark JSON saved to ${jsonPath}`);
}

if (jsonOnly) {
  process.exit(0);
}

// Generate and write markdown report
const md = generateMarkdown(data);
writeFileSync(mdPath, md);
console.log(`Benchmark report saved to ${mdPath}`);
