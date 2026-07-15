import { Readability } from "@mozilla/readability";
import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";
import type { Content } from "../types.js";
import {
  extractLinks,
  extractProse,
  extractSections,
  normalizeText,
} from "./shared.js";
import { extractGeneric } from "./generic.js";

export interface ArticleExtraction {
  title: string;
  content: Content;
}

/**
 * Article extraction via Mozilla Readability (the same engine as Firefox Reader
 * View). Readability needs a real DOM, so we back it with jsdom; the readable
 * HTML fragment is then parsed with cheerio for the outline and links.
 */
export function extractArticle(
  html: string,
  url: string,
  includeLinks: boolean,
): ArticleExtraction {
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const parsed = reader.parse();

  // Readability bails on pages without a clear article body; fall back cleanly.
  if (!parsed || !parsed.textContent?.trim()) {
    return {
      title: dom.window.document.title || url,
      content: extractGeneric(html, url, includeLinks),
    };
  }

  const $ = cheerio.load(parsed.content ?? "");
  // Outline before extractProse strips noise; prose reads block-by-block and
  // removes tables/citations (also cleaning up infobox/footnote links).
  const sections = extractSections($);
  const main = extractProse($);

  return {
    title: normalizeText(parsed.title || dom.window.document.title || url),
    content: {
      main,
      truncated: false,
      sections,
      links: includeLinks ? extractLinks($, url) : [],
    },
  };
}
