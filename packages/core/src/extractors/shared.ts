import type { CheerioAPI } from "cheerio";
import type { Block, CodeBlock, Link, Section, Table } from "../types.js";

const MAX_LINKS = 5;
const MAX_SECTIONS = 25;
const MAX_CODE_BLOCKS = 15;
const MAX_CODE_CHARS = 1500;
const MAX_TABLES = 5;
const MAX_TABLE_ROWS = 30;
const MAX_TABLE_COLS = 10;

/** Collapse runs of whitespace and trim; readable text for agents. */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// Noise stripped before reading prose: citation markers, edit links, heading anchors
// ("¶"), tables and code blocks (extracted separately as structured data), and raw
// styles. Only `sup.reference` is a citation marker: Sphinx docs put the `reference`
// class on every cross-reference link, and removing those deleted identifiers like
// `asyncio.timeout()` from the prose.
const PROSE_NOISE = "sup.reference, .mw-editsection, .headerlink, table, pre, style";

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
export function extractProse($: CheerioAPI): { main: string; blocks: Block[] } {
  $(PROSE_NOISE).remove();

  const parts: string[] = [];
  const blocks: Block[] = [];
  let section: string | null = null;
  let level = 1;
  $(PROSE_BLOCKS).each((_, el) => {
    if ($(el).parents(PROSE_BLOCKS).length > 0) return;
    let text = stripCitationMarkers(normalizeText($(el).text()));
    if (!text) return;
    // A definition's body is meaningless without its term (e.g. an API signature in <dt>).
    if (($(el).prop("tagName") ?? "").toLowerCase() === "dd") {
      const term = stripCitationMarkers(normalizeText($(el).prevAll("dt").first().text()));
      if (term) text = `${term} — ${text}`;
    }
    parts.push(text);
    // Headings open a section; everything until the next heading belongs to it.
    const tag = ($(el).prop("tagName") ?? "").toLowerCase();
    if (/^h[2-6]$/.test(tag)) {
      section = text;
      level = Number(tag[1]);
    } else {
      blocks.push({ section, level, text });
    }
  });
  return { main: parts.join("\n"), blocks };
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

// Language hint from a class token like `language-python`, `lang-js`,
// `highlight-source-ts`, or `brush: python`.
const LANG_CLASS = /(?:language|lang|highlight-source|brush)[-:\s]+([a-z0-9+#]+)/i;

/** Trim leading/trailing blank lines while preserving indentation. */
function trimCode(code: string): string {
  return code.replace(/^\s*\n/, "").replace(/\s+$/, "");
}

/**
 * Pull `<pre>` code blocks out as structured data. Whitespace is preserved (no
 * normalizeText) so indentation survives; language is inferred from class hints.
 */
export function extractCodeBlocks($: CheerioAPI): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  $("pre").each((_, el) => {
    if (blocks.length >= MAX_CODE_BLOCKS) return;
    const $el = $(el);
    const code = trimCode($el.text());
    if (!code.trim()) return;

    const classes = `${$el.attr("class") ?? ""} ${$el.find("code").first().attr("class") ?? ""}`;
    const language = LANG_CLASS.exec(classes)?.[1]?.toLowerCase();
    const clipped =
      code.length > MAX_CODE_CHARS ? `${code.slice(0, MAX_CODE_CHARS)}…` : code;

    blocks.push(language ? { language, code: clipped } : { code: clipped });
  });
  return blocks;
}

// Layout/navigation tables that aren't real tabular content.
const TABLE_NOISE = ".infobox, .navbox, .metadata, .sidebar, .vertical-navbox, .ambox, [role='presentation']";

/** Pull real data tables out as `{ headers, rows }` (a strong TOON fit). */
export function extractTables($: CheerioAPI): Table[] {
  const tables: Table[] = [];
  $("table").each((_, el) => {
    if (tables.length >= MAX_TABLES) return;
    const $t = $(el);
    if ($t.is(TABLE_NOISE) || $t.parents(TABLE_NOISE).length > 0) return;

    const cellText = (i: number, cell: unknown) =>
      normalizeText($(cell as never).text());
    let headers = $t.find("thead th").map(cellText).get();
    if (headers.length === 0) {
      headers = $t.find("tr").first().find("th").map(cellText).get();
    }

    const rowScope = $t.find("tbody tr").length ? $t.find("tbody tr") : $t.find("tr");
    const rows: string[][] = [];
    rowScope.each((_, tr) => {
      if (rows.length >= MAX_TABLE_ROWS) return;
      const cells = $(tr).find("td");
      if (cells.length === 0) return; // header-only row
      const row = cells.slice(0, MAX_TABLE_COLS).map(cellText).get();
      if (row.some((c) => c.length > 0)) rows.push(row);
    });

    // Keep only tables that are actually tabular (>=2 rows, >=2 columns).
    const width = Math.max(headers.length, rows[0]?.length ?? 0);
    if (rows.length >= 2 && width >= 2) {
      tables.push({ headers: headers.slice(0, MAX_TABLE_COLS), rows });
    }
  });
  return tables;
}
