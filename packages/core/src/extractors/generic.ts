import * as cheerio from "cheerio";
import type { Content } from "../types.js";
import {
  extractCodeBlocks,
  extractLinks,
  extractProse,
  extractSections,
  extractTables,
  normalizeText,
} from "./shared.js";

export interface GenericExtraction {
  title: string;
  content: Content;
}

const NOISE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "nav",
  "header",
  "footer",
  "aside",
  "form",
  "template",
  "svg",
  "[aria-hidden='true']",
  "[role='navigation']",
].join(", ");

/**
 * Aggressive readability-style fallback. Strips page chrome (nav/header/footer),
 * then runs the same structured extraction as the article path: code blocks and
 * tables come out as structured data, and prose is read block-by-block (no more
 * word-gluing from raw `.text()`).
 */
export function extractGeneric(
  html: string,
  url: string,
  includeLinks: boolean,
): GenericExtraction {
  const $ = cheerio.load(html);
  // Read the title before de-noising; cheerio decodes HTML entities for us.
  const title =
    normalizeText($("title").first().text()) ||
    normalizeText($("h1").first().text()) ||
    url;
  $(NOISE_SELECTORS).remove();

  // Pull structured blocks before extractProse strips them from the prose.
  const sections = extractSections($);
  const codeBlocks = extractCodeBlocks($);
  const tables = extractTables($);
  const { main, blocks } = extractProse($);

  return {
    title,
    content: {
      main,
      truncated: false,
      sections,
      codeBlocks,
      tables,
      links: includeLinks ? extractLinks($, url) : [],
      blocks,
    },
  };
}
