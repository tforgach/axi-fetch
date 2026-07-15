import * as cheerio from "cheerio";
import type { PageType } from "./types.js";

export interface TypeDetection {
  type: PageType;
  /** 0-1 confidence in the detected type. */
  confidence: number;
  /** Human-readable signals that drove the decision (for debugging). */
  hints: string[];
}

const ARTICLE_PATH = /\/(blog|article|articles|news|post|posts|story|p)\//i;
const ARTICLE_SCHEMA = /(News|Blog|Tech|Scholarly)?Article|BlogPosting/i;

/**
 * Rules-based (no LLM) detection of whether a page is an article or generic.
 * Signals are additive; confidence reflects how many fired.
 */
export function detectType(html: string, url: string): TypeDetection {
  const $ = cheerio.load(html);
  const hints: string[] = [];
  let score = 0;

  // URL path signal.
  try {
    if (ARTICLE_PATH.test(new URL(url).pathname)) {
      score += 2;
      hints.push("url-path");
    }
  } catch {
    // ignore malformed url, other signals still apply
  }

  // Open Graph type.
  if (
    $('meta[property="og:type"]').attr("content")?.toLowerCase() === "article"
  ) {
    score += 3;
    hints.push("og:type=article");
  }

  // Semantic <article> element.
  if ($("article").length > 0) {
    score += 2;
    hints.push("article-tag");
  }

  // schema.org markup (JSON-LD @type or microdata itemtype).
  const ldTypes = $('script[type="application/ld+json"]')
    .map((_, el) => $(el).text())
    .get()
    .join(" ");
  if (
    ARTICLE_SCHEMA.test(ldTypes) ||
    $('[itemtype*="Article" i], [itemtype*="BlogPosting" i]').length > 0
  ) {
    score += 3;
    hints.push("schema.org-article");
  }

  // Published-date signals.
  if (
    $("time[datetime]").length > 0 ||
    $('meta[property="article:published_time"]').length > 0
  ) {
    score += 1;
    hints.push("published-date");
  }

  // Map the additive score to a type + confidence.
  if (score >= 3) {
    return { type: "article", confidence: Math.min(0.5 + score * 0.1, 0.98), hints };
  }
  if (score > 0) {
    return { type: "article", confidence: 0.4 + score * 0.05, hints };
  }
  return { type: "generic", confidence: 0.6, hints: ["no-article-signals"] };
}
