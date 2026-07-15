import * as cheerio from "cheerio";
import type { Content } from "../types.js";
import {
  extractCodeBlocks,
  extractLinks,
  extractProse,
  extractSections,
  extractTables,
} from "./shared.js";

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
): Content {
  const $ = cheerio.load(html);
  $(NOISE_SELECTORS).remove();

  // Pull structured blocks before extractProse strips them from the prose.
  const sections = extractSections($);
  const codeBlocks = extractCodeBlocks($);
  const tables = extractTables($);
  const main = extractProse($);

  return {
    main,
    truncated: false,
    sections,
    codeBlocks,
    tables,
    links: includeLinks ? extractLinks($, url) : [],
  };
}
