import type { BenchRow } from "./runner.js";

/** Robust summary of one savings metric. Median leads; mean is outlier-sensitive. */
export interface MetricSummary {
  median: number;
  mean: number;
  min: number;
  max: number;
}

export interface Aggregate {
  count: number;
  vsRaw: MetricSummary;
  vsMarkdown: MetricSummary;
  fullVsMarkdown: MetricSummary;
}

const round = (n: number) => Math.round(n * 10) / 10;

function summarize(values: number[]): MetricSummary {
  if (values.length === 0) return { median: 0, mean: 0, min: 0, max: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
  return {
    median: round(median),
    mean: round(values.reduce((a, b) => a + b, 0) / values.length),
    min: round(sorted[0]!),
    max: round(sorted[sorted.length - 1]!),
  };
}

function pick(rows: BenchRow[], sel: (r: BenchRow) => number | undefined): number[] {
  return rows.map(sel).filter((v): v is number => typeof v === "number");
}

export function aggregate(rows: BenchRow[]): Aggregate {
  const ok = rows.filter((r) => r.ok);
  return {
    count: ok.length,
    vsRaw: summarize(pick(ok, (r) => r.savingsVsRaw)),
    vsMarkdown: summarize(pick(ok, (r) => r.savingsVsMarkdown)),
    fullVsMarkdown: summarize(pick(ok, (r) => r.formatSavingsVsMarkdown)),
  };
}

const CSV_COLUMNS = [
  "url",
  "ok",
  "type",
  "rawHtmlTokens",
  "markdownTokens",
  "toonTokens",
  "toonFullTokens",
  "savingsVsRaw",
  "savingsVsMarkdown",
  "formatSavingsVsMarkdown",
  "error",
] as const;

export function toCsv(rows: BenchRow[]): string {
  const escape = (v: unknown) => {
    const s = v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [CSV_COLUMNS.join(",")];
  for (const row of rows) {
    const record = row as unknown as Record<string, unknown>;
    lines.push(CSV_COLUMNS.map((c) => escape(record[c])).join(","));
  }
  return lines.join("\n") + "\n";
}

export function toMarkdown(rows: BenchRow[], agg: Aggregate): string {
  const ok = rows.filter((r) => r.ok);
  const header =
    "| URL | type | raw HTML | readable md | TOON | TOON --full | vs raw | vs md | format-only vs md |\n" +
    "|---|---|--:|--:|--:|--:|--:|--:|--:|";
  const body = ok
    .map((r) => {
      const short = r.url.replace(/^https?:\/\//, "");
      return `| ${short} | ${r.type} | ${r.rawHtmlTokens} | ${r.markdownTokens} | ${r.toonTokens} | ${r.toonFullTokens} | ${r.savingsVsRaw}% | ${r.savingsVsMarkdown}% | ${r.formatSavingsVsMarkdown}% |`;
    })
    .join("\n");

  const failed = rows.filter((r) => !r.ok);
  const failures = failed.length
    ? `\n\n**Failed (${failed.length}):** ${failed.map((r) => `${r.url} (${r.error})`).join("; ")}`
    : "";

  const summaryRow = (label: string, m: { median: number; mean: number; min: number; max: number }) =>
    `| ${label} | **${m.median}%** | ${m.mean}% | ${m.min}% → ${m.max}% |`;

  return [
    "# axi-fetch token-savings benchmark",
    "",
    `Token counts via tiktoken (a standard proxy; Claude's tokenizer differs but format *ratios* track closely). ${agg.count} pages.`,
    "",
    "- **vs raw**: default TOON output vs the raw fetched HTML (the naive baseline).",
    "- **vs md**: default TOON (truncated to 1500 chars) vs Readability→markdown (a strong reader-tool baseline). End-to-end product win: extraction + truncation + format.",
    "- **full vs md**: `--full` TOON (no truncation) vs markdown — extraction + format win, truncation removed.",
    "",
    header,
    body,
    "",
    "## Aggregate",
    "",
    "Median leads (robust to outliers like trivially small pages where fixed metadata overhead dominates).",
    "",
    `| Metric | Median | Mean | Range |`,
    `|---|--:|--:|--:|`,
    summaryRow("TOON vs raw HTML", agg.vsRaw),
    summaryRow("TOON (default) vs readable markdown", agg.vsMarkdown),
    summaryRow("TOON (--full) vs readable markdown", agg.fullVsMarkdown),
    failures,
    "",
  ].join("\n");
}
