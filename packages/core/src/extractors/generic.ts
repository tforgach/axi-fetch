import * as cheerio from "cheerio";
import type { Content } from "../types.js";
import { extractLinks, extractSections, normalizeText } from "./shared.js";

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

const CONTENT_CONTAINERS = ["main", "article", "#content", ".content", "#main"];

/**
 * Aggressive readability-style fallback: strip chrome/noise, then pull text from
 * the densest content container (falling back to <body>). Outline and links are
 * taken from the whole (de-noised) document.
 */
export function extractGeneric(
  html: string,
  url: string,
  includeLinks: boolean,
): Content {
  const $ = cheerio.load(html);
  $(NOISE_SELECTORS).remove();

  // Prefer a semantic container with substantial text; else use the body.
  let main = "";
  for (const selector of CONTENT_CONTAINERS) {
    const text = normalizeText($(selector).first().text());
    if (text.length > 200) {
      main = text;
      break;
    }
  }
  if (!main) {
    main = normalizeText($("body").text());
  }

  return {
    main,
    truncated: false,
    sections: extractSections($),
    links: includeLinks ? extractLinks($, url) : [],
  };
}
