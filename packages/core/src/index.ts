import { fetchUrl } from "./fetcher.js";
import { detectType } from "./typeDetector.js";
import { extractArticle } from "./extractors/article.js";
import { extractGeneric } from "./extractors/generic.js";
import { toStructured, toToon } from "./output.js";
import { findPassages, paginate, sectionText } from "./retrieve.js";
import type {
  AxiFetchOptions,
  AxiResponse,
  Content,
  FetchResult,
} from "./types.js";

// One more agent turn costs far more than 1.5k extra characters, so the default aims to
// answer in the first call; `--find` / `--section` cover pages where it won't.
const DEFAULT_MAX_CONTENT_LENGTH = 3000;
// Pages of `--full` / `--section` output stay well under agent harnesses' inline-output
// limits (Claude Code spills ~30k+ chars to a file, costing the agent another turn to read).
export const PAGE_CHARS = 16000;

/**
 * Fetch a URL and return an agent-ready AXI response plus its TOON encoding.
 *
 * Pipeline: fetch -> detect type -> extract -> truncate -> build next steps.
 * Never throws for expected failures upstream throw structured `AxiError`s.
 */
export async function axiFetch(
  url: string,
  options: AxiFetchOptions = {},
): Promise<FetchResult> {
  const page = await fetchUrl(url, {
    timeout: options.timeout,
    userAgent: options.userAgent,
    cache: options.cache,
    cacheTtl: options.cacheTtl,
  });
  return extractFromHtml(page.html, page.finalUrl, options);
}

/**
 * Build an AXI response from already-fetched HTML (no network). Useful for
 * offline processing, fixtures, and benchmarking the same HTML across formats.
 */
export function extractFromHtml(
  html: string,
  url: string,
  options: AxiFetchOptions = {},
): FetchResult {
  const includeLinks = options.includeLinks ?? false;
  const includeCode = options.includeCode ?? false;
  const maxContentLength = options.maxContentLength ?? DEFAULT_MAX_CONTENT_LENGTH;

  const detection = detectType(html, url);

  let title: string;
  let content: Content;
  if (detection.type === "article") {
    const article = extractArticle(html, url, includeLinks);
    title = article.title;
    content = article.content;
  } else {
    const generic = extractGeneric(html, url, includeLinks);
    title = generic.title;
    content = generic.content;
  }

  const fullLength = content.main.length;
  if (!includeCode && content.codeBlocks.length > 0) {
    content = { ...content, codeBlocks: [], omittedCodeBlocks: content.codeBlocks.length };
  }

  let sectionMiss = false;
  if (options.find) {
    // Only the matching passages; the opening content isn't repeated.
    const { passages } = findPassages(content.blocks, options.find);
    const tables = content.tables.filter((t) => tableMatches(t, options.find!));
    // With hits, the outline is noise; on a miss it helps the agent pick a `--section`.
    const sections = passages.length || tables.length ? [] : content.sections;
    content = { ...content, main: "", passages, tables, sections };
  } else if (options.section) {
    const hit = sectionText(content.blocks, options.section);
    if (hit) content = { ...content, ...pageOf(hit.text, options.page), sections: [], tables: [] };
    else sectionMiss = true;
  } else if (options.full) {
    content = { ...content, ...pageOf(content.main, options.page) };
  } else if (fullLength > maxContentLength) {
    content = {
      ...content,
      main: `${content.main.slice(0, maxContentLength)}…`,
      truncated: true,
    };
  }

  const axiResponse: AxiResponse = {
    metadata: {
      url,
      title,
      type: detection.type,
      confidence: detection.confidence,
      fetchedAt: new Date().toISOString(),
      contentLength: fullLength,
    },
    content,
    nextSteps: buildNextSteps(content, options, sectionMiss),
  };

  return { axiResponse, toonOutput: toToon(axiResponse) };
}

function pageOf(text: string, page = 1): Pick<Content, "main" | "page"> {
  const pages = paginate(text, PAGE_CHARS);
  const n = Math.min(Math.max(1, page), pages.length);
  return { main: pages[n - 1] ?? "", page: pages.length > 1 ? { number: n, of: pages.length } : undefined };
}

function tableMatches(t: { headers: string[]; rows: string[][] }, query: string): boolean {
  const hay = [...t.headers, ...t.rows.flat()].join(" ").toLowerCase();
  return query.toLowerCase().split(/\s+/).some((w) => w.length > 2 && hay.includes(w));
}

function buildNextSteps(content: Content, options: AxiFetchOptions, sectionMiss: boolean): string[] {
  const steps: string[] = [];
  if (options.find && (content.passages?.length ?? 0) === 0) {
    steps.push("No passages matched; try other keywords, or `--section \"<heading>\"` from the sections list");
  }
  if (sectionMiss) {
    steps.push("No section matched that heading; pick one from the sections list, or use `--find \"<keywords>\"`");
  }
  if (content.truncated) {
    steps.push('Answer not shown? Re-run with `--find "<keywords>"` for matching passages or `--section "<heading>"`; `--full` pages through everything');
  }
  if (content.page && content.page.number < content.page.of) {
    steps.push(`Page ${content.page.number} of ${content.page.of}; add \`--page ${content.page.number + 1}\` for more (or narrow with \`--find\`)`);
  }
  if (content.omittedCodeBlocks) {
    steps.push(`${content.omittedCodeBlocks} code block(s) omitted; add \`--code\` to include them`);
  }
  if (options.includeLinks && content.links.length > 0) {
    steps.push("Follow a link above with `axi-fetch <url>` to go deeper");
  }
  return steps;
}

export { toStructured, toToon } from "./output.js";
export { fetchUrl, normalizeUrl } from "./fetcher.js";
export { detectType } from "./typeDetector.js";
export * from "./types.js";
