import { extractFromHtml, fetchUrl } from "@tforgach/axi-fetch";
import { readableMarkdown } from "./baselines.js";
import { countTokens } from "./tokens.js";

export interface BenchRow {
  url: string;
  ok: boolean;
  error?: string;
  type?: string;
  rawHtmlTokens?: number;
  markdownTokens?: number;
  /** Default axi-fetch output (truncated). */
  toonTokens?: number;
  /** axi-fetch --full output (no truncation) — isolates format savings. */
  toonFullTokens?: number;
  /** % smaller: default TOON vs raw HTML. */
  savingsVsRaw?: number;
  /** % smaller: default TOON vs readable markdown (format + truncation). */
  savingsVsMarkdown?: number;
  /** % smaller: full TOON vs readable markdown (format only, same content). */
  formatSavingsVsMarkdown?: number;
}

function pct(base: number, value: number): number {
  if (base <= 0) return 0;
  return Math.round((1 - value / base) * 1000) / 10;
}

export async function benchUrl(url: string, timeout = 20_000): Promise<BenchRow> {
  try {
    const page = await fetchUrl(url, { timeout });
    const defaultResult = extractFromHtml(page.html, page.finalUrl);
    const fullResult = extractFromHtml(page.html, page.finalUrl, {
      full: true,
      maxContentLength: Number.MAX_SAFE_INTEGER,
    });

    const rawHtmlTokens = countTokens(page.html);
    const markdownTokens = countTokens(readableMarkdown(page.html, page.finalUrl));
    const toonTokens = countTokens(defaultResult.toonOutput);
    const toonFullTokens = countTokens(fullResult.toonOutput);

    return {
      url,
      ok: true,
      type: defaultResult.axiResponse.metadata.type,
      rawHtmlTokens,
      markdownTokens,
      toonTokens,
      toonFullTokens,
      savingsVsRaw: pct(rawHtmlTokens, toonTokens),
      savingsVsMarkdown: pct(markdownTokens, toonTokens),
      formatSavingsVsMarkdown: pct(markdownTokens, toonFullTokens),
    };
  } catch (error) {
    return {
      url,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function benchUrls(urls: string[]): Promise<BenchRow[]> {
  const rows: BenchRow[] = [];
  for (const url of urls) {
    process.stderr.write(`  fetching ${url} ... `);
    const row = await benchUrl(url);
    process.stderr.write(row.ok ? `ok (${row.type})\n` : `FAILED: ${row.error}\n`);
    rows.push(row);
  }
  return rows;
}
