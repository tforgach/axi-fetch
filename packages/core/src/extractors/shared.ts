import type { CheerioAPI } from "cheerio";
import type { Link, Section } from "../types.js";

const MAX_LINKS = 5;
const MAX_SECTIONS = 25;

/** Collapse runs of whitespace and trim; readable text for agents. */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// Noise stripped before reading prose: citation markers, edit links, tables
// (infoboxes/data grids concatenate into unreadable blobs), and raw styles.
const PROSE_NOISE = "sup.reference, .mw-editsection, .reference, table, style";

// Block-level elements that carry article prose, read in document order.
const PROSE_BLOCKS = "p, li, blockquote, h2, h3, h4, h5, h6, dd";

/** Detect footnote/citation anchor text like "[1]" or "[a]". */
const FOOTNOTE_TEXT = /^\[[0-9a-z]+\]$/i;

/**
 * Extract readable prose from a loaded content fragment, one block at a time so
 * block boundaries become newlines (avoids "wordAnother" gluing from raw
 * textContent). Nested blocks are de-duplicated by skipping any block that lives
 * inside another prose block, since the ancestor already covers its text.
 */
export function extractProse($: CheerioAPI): string {
  $(PROSE_NOISE).remove();

  const parts: string[] = [];
  $(PROSE_BLOCKS).each((_, el) => {
    if ($(el).parents(PROSE_BLOCKS).length > 0) return;
    const text = stripCitationMarkers(normalizeText($(el).text()));
    if (text) parts.push(text);
  });
  return parts.join("\n");
}

/** Remove inline citation/footnote markers like "[1]" or "[b]" left in prose. */
function stripCitationMarkers(text: string): string {
  return text.replace(/\[(?:\d+|[a-z])\]/gi, "").replace(/\s+/g, " ").trim();
}

/** Build a heading outline (h1-h6) from a cheerio document/fragment. */
export function extractSections($: CheerioAPI, root = "body"): Section[] {
  const sections: Section[] = [];
  $(`${root} h1, ${root} h2, ${root} h3, ${root} h4, ${root} h5, ${root} h6`).each(
    (_, el) => {
      if (sections.length >= MAX_SECTIONS) return;
      const heading = normalizeText($(el).text());
      if (!heading) return;
      const tagName = $(el).prop("tagName") ?? "";
      const level = Number(tagName.slice(1)) || 1;
      sections.push({ heading, level });
    },
  );
  return sections;
}

/**
 * Collect up to MAX_LINKS meaningful outbound links, classified internal vs
 * external relative to `baseUrl` (AXI principle 2: keep the list small).
 */
export function extractLinks(
  $: CheerioAPI,
  baseUrl: string,
  root = "body",
): Link[] {
  const links: Link[] = [];
  const seen = new Set<string>();
  let base: URL | undefined;
  try {
    base = new URL(baseUrl);
  } catch {
    base = undefined;
  }

  $(`${root} a[href]`).each((_, el) => {
    if (links.length >= MAX_LINKS) return;
    const href = $(el).attr("href");
    const text = normalizeText($(el).text());
    if (!href || !text) return;
    // Drop footnote/citation markers like "[1]" or "[a]".
    if (FOOTNOTE_TEXT.test(text)) return;

    let resolved: URL;
    try {
      resolved = new URL(href, base);
    } catch {
      return;
    }
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return;
    // Drop in-page anchors (e.g. #cite_note) — same page, not an outbound link.
    if (base && resolved.hash && resolved.origin + resolved.pathname === base.origin + base.pathname) {
      return;
    }
    if (seen.has(resolved.href)) return;
    seen.add(resolved.href);

    const kind =
      base && resolved.hostname === base.hostname ? "internal" : "external";
    links.push({ text, url: resolved.href, kind });
  });

  return links;
}
