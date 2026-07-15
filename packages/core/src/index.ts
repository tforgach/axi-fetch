import { fetchUrl } from "./fetcher.js";
import { detectType } from "./typeDetector.js";
import { extractArticle } from "./extractors/article.js";
import { extractGeneric } from "./extractors/generic.js";
import { toStructured, toToon } from "./output.js";
import type {
  AxiFetchOptions,
  AxiResponse,
  Content,
  FetchResult,
} from "./types.js";

const DEFAULT_MAX_CONTENT_LENGTH = 1500;

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
  const includeLinks = options.includeLinks ?? true;
  const maxContentLength = options.maxContentLength ?? DEFAULT_MAX_CONTENT_LENGTH;

  const page = await fetchUrl(url, {
    timeout: options.timeout,
    userAgent: options.userAgent,
  });

  const detection = detectType(page.html, page.finalUrl);

  let title: string;
  let content: Content;
  if (detection.type === "article") {
    const article = extractArticle(page.html, page.finalUrl, includeLinks);
    title = article.title;
    content = article.content;
  } else {
    content = extractGeneric(page.html, page.finalUrl, includeLinks);
    title = deriveTitle(page.html) || page.finalUrl;
  }

  const fullLength = content.main.length;
  if (!options.full && fullLength > maxContentLength) {
    content = {
      ...content,
      main: `${content.main.slice(0, maxContentLength)}…`,
      truncated: true,
    };
  }

  const axiResponse: AxiResponse = {
    metadata: {
      url: page.finalUrl,
      title,
      type: detection.type,
      confidence: detection.confidence,
      fetchedAt: new Date().toISOString(),
      contentLength: fullLength,
    },
    content,
    nextSteps: buildNextSteps(content, includeLinks),
  };

  return { axiResponse, toonOutput: toToon(axiResponse) };
}

function deriveTitle(html: string): string {
  const match = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  return match?.[1]?.trim() ?? "";
}

function buildNextSteps(content: Content, includeLinks: boolean): string[] {
  const steps: string[] = [];
  if (content.truncated) {
    steps.push("Re-run with `--full` to get the complete content");
  }
  if (!includeLinks) {
    steps.push("Re-run without `--no-links` to include outbound links");
  } else if (content.links.length > 0) {
    steps.push("Follow a link above with `axi-fetch <url>` to go deeper");
  }
  return steps;
}

export { toStructured, toToon } from "./output.js";
export { fetchUrl, normalizeUrl } from "./fetcher.js";
export { detectType } from "./typeDetector.js";
export * from "./types.js";
