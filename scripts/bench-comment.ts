/**
 * Format benchmark JSON results as a markdown comment for PRs.
 *
 * Each benchmark file gets its own collapsible section.
 *
 * Usage:
 *   bun run scripts/bench-comment.ts <results.json> <output.md>
 */

import { readFileSync } from "node:fs";

interface Bench {
  name: string;
  mean: number;
  hz: number;
  p99: number;
  rme: number;
  sampleCount: number;
}

interface Group {
  fullName: string;
  benchmarks: Bench[];
}

interface File {
  filepath: string;
  groups: Group[];
}

interface Output {
  files: File[];
}

function formatMs(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }

  if (ms >= 1) {
    return `${ms.toFixed(2)}ms`;
  }

  return `${(ms * 1000).toFixed(0)}μs`;
}

function formatRme(rme: number): string {
  return `±${rme.toFixed(1)}%`;
}

function fileLabel(filepath: string): string {
  const match = filepath.match(/([^/]+)\.bench\.ts$/);

  if (!match) {
    return filepath;
  }

  const name = match[1];

  return name.charAt(0).toUpperCase() + name.slice(1);
}

// ─────────────────────────────────────────────────────────────────────────────

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  console.error("Usage: bun run scripts/bench-comment.ts <results.json> <output.md>");
  process.exit(1);
}

const data: Output = JSON.parse(readFileSync(inputPath, "utf-8"));

const lines: string[] = [];
lines.push("## Benchmark Results");
lines.push("");

for (const file of data.files) {
  const label = fileLabel(file.filepath);

  lines.push(`<details>`);
  lines.push(`<summary><strong>${label}</strong></summary>`);
  lines.push("");

  for (const group of file.groups) {
    const groupName = group.fullName.includes(" > ")
      ? group.fullName.split(" > ").slice(1).join(" > ")
      : group.fullName;

    lines.push(`**${groupName}**`);
    lines.push("");
    lines.push("| Benchmark | Mean | p99 | RME | Samples |");
    lines.push("|:---|---:|---:|---:|---:|");

    for (const b of group.benchmarks) {
      lines.push(
        `| ${b.name} | ${formatMs(b.mean)} | ${formatMs(b.p99)} | ${formatRme(b.rme)} | ${b.sampleCount} |`,
      );
    }

    lines.push("");
  }

  lines.push(`</details>`);
  lines.push("");
}

const runner = process.env.BENCH_RUNNER ?? "local";

lines.push(
  `<details><summary>Environment</summary>\n\n` +
    `- Runner: \`${runner}\`\n` +
    `- Runtime: Bun ${process.versions.bun}\n\n` +
    `*Results are machine-dependent.*\n` +
    `</details>`,
);

const body = lines.join("\n");
await Bun.write(outputPath, body);
console.log(body);
