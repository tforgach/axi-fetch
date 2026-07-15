import { Readability } from "@mozilla/readability";
import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";
import type { Content } from "../types.js";
import {
  extractCodeBlocks,
  extractLinks,
  extractProse,
  extractSections,
  extractTables,
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
  // keepClasses so language hints on code blocks survive into the readable HTML.
  const reader = new Readability(dom.window.document, { keepClasses: true });
  const parsed = reader.parse();

  // Readability bails on pages without a clear article body; fall back cleanly.
  if (!parsed || !parsed.textContent?.trim()) {
    return {
      title: dom.window.document.title || url,
      content: extractGeneric(html, url, includeLinks),
    };
  }

  const $ = cheerio.load(parsed.content ?? "");
  // Pull structured blocks (outline, code, tables) BEFORE extractProse strips
  // them from the prose. extractProse then reads block-by-block, removing
  // tables/code/citations (also cleaning up infobox/footnote links).
  const sections = extractSections($);
  const codeBlocks = extractCodeBlocks($);
  const tables = extractTables($);
  const main = extractProse($);

  return {
    title: normalizeText(parsed.title || dom.window.document.title || url),
    content: {
      main,
      truncated: false,
      sections,
      codeBlocks,
      tables,
      links: includeLinks ? extractLinks($, url) : [],
    },
  };
}
