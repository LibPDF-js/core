/**
 * Compare two benchmark JSON files and produce a markdown summary.
 *
 * Usage:
 *   bun run scripts/bench-compare.ts <base.json> <pr.json> <output.md>
 *
 * If <base.json> does not exist, outputs PR-only results.
 */

import { existsSync, readFileSync } from "node:fs";

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

function buildMap(data: Output): Map<string, Bench> {
  const map = new Map<string, Bench>();

  for (const file of data.files) {
    for (const group of file.groups) {
      for (const b of group.benchmarks) {
        map.set(b.name, b);
      }
    }
  }

  return map;
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

// ─────────────────────────────────────────────────────────────────────────────

const [basePath, prPath, outputPath] = process.argv.slice(2);

if (!prPath || !outputPath) {
  console.error("Usage: bun run scripts/bench-compare.ts <base.json> <pr.json> <output.md>");
  process.exit(1);
}

const pr: Output = JSON.parse(readFileSync(prPath, "utf-8"));
const prMap = buildMap(pr);
const hasBase = existsSync(basePath);

const lines: string[] = [];
lines.push("## Benchmark Results");
lines.push("");

if (hasBase) {
  const base: Output = JSON.parse(readFileSync(basePath, "utf-8"));
  const baseMap = buildMap(base);

  lines.push("| Benchmark | Base | PR | Change |");
  lines.push("|:---|---:|---:|---:|");

  let hasRegression = false;

  for (const [name, b] of baseMap) {
    const p = prMap.get(name);

    if (!p) {
      continue;
    }

    const ratio = b.mean / p.mean;
    let change: string;
    let indicator = "";

    if (ratio > 1.05) {
      change = `${ratio.toFixed(2)}x faster`;
      indicator = " 🟢";
    } else if (ratio < 0.95) {
      change = `${(1 / ratio).toFixed(2)}x slower`;
      indicator = " 🔴";
      hasRegression = true;
    } else {
      change = "~same";
    }

    lines.push(`| ${name} | ${formatMs(b.mean)} | ${formatMs(p.mean)} | ${change}${indicator} |`);
  }

  // Show benchmarks only in PR (new benchmarks)
  for (const [name, p] of prMap) {
    if (!baseMap.has(name)) {
      lines.push(`| ${name} | — | ${formatMs(p.mean)} | *new* |`);
    }
  }

  lines.push("");

  if (hasRegression) {
    lines.push("> ⚠️ **Performance regression detected.** Please review the changes above.");
  } else {
    lines.push("> ✅ No performance regressions detected.");
  }
} else {
  // No base results — just show PR numbers
  lines.push("*No base benchmarks available for comparison (new benchmark suite?).*");
  lines.push("");
  lines.push("| Benchmark | Mean | p99 | Samples |");
  lines.push("|:---|---:|---:|---:|");

  for (const [name, p] of prMap) {
    lines.push(`| ${name} | ${formatMs(p.mean)} | ${formatMs(p.p99)} | ${p.sampleCount} |`);
  }
}

lines.push("");
lines.push(
  `<details><summary>Environment</summary>\n\n` +
    `- Runner: \`ubuntu-latest\`\n` +
    `- Runtime: Bun ${process.versions.bun}\n` +
    `- Benchmark: \`benchmarks/splitting.bench.ts\`\n\n` +
    `*Results are machine-dependent. Thresholds: >5% faster 🟢, >5% slower 🔴.*\n` +
    `</details>`,
);

const body = lines.join("\n");
await Bun.write(outputPath, body);
console.log(body);
