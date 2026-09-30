import type { Block, Passage } from "./types.js";

/**
 * Query-focused retrieval without an LLM (AXI: pre-filter with a query flag instead of
 * making the agent read everything). BM25 over prose blocks, with a bonus for matches in
 * the block's section heading and for the exact phrase.
 */

const STOPWORDS = new Set(
  ("a an and are as at be by did do does for from how in into is it its of on or that the this to " +
    "was were what when where which who why with will would can could should about page says said " +
    "tell me give list find show")
    .split(" "),
);

/** Lowercase terms; dotted identifiers (asyncio.timeout) are kept whole and split into parts. */
export function terms(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.toLowerCase().match(/[a-z0-9][a-z0-9._-]*/g) ?? []) {
    const t = stem(raw.replace(/[._-]+$/, ""));
    if (!t || STOPWORDS.has(t)) continue;
    out.push(t);
    if (/[._-]/.test(t)) for (const part of t.split(/[._-]+/)) if (part && !STOPWORDS.has(part)) out.push(stem(part));
  }
  return out;
}

/** Light plural folding so "timeout" matches "Timeouts" (no full stemmer needed). */
function stem(t: string): string {
  if (t.length > 4 && /[^s]s$/.test(t) && !/(ss|us|is)$/.test(t)) return t.slice(0, -1);
  return t;
}

const K1 = 1.2;
const B = 0.75;

export interface FindOptions {
  /** Character budget for all returned passages. */
  budget?: number;
  maxPassages?: number;
  /** Long blocks are cut to a window around their best match. */
  windowChars?: number;
}

export function findPassages(blocks: Block[], query: string, opts: FindOptions = {}): { passages: Passage[]; matched: number } {
  const budget = opts.budget ?? 2500;
  const maxPassages = opts.maxPassages ?? 8;
  const windowChars = opts.windowChars ?? 700;
  const q = [...new Set(terms(query))];
  if (q.length === 0 || blocks.length === 0) return { passages: [], matched: 0 };

  const docs = blocks.map((b) => terms(b.text));
  const avgLen = docs.reduce((n, d) => n + d.length, 0) / docs.length || 1;
  const df = new Map(q.map((t) => [t, docs.filter((d) => d.includes(t)).length]));
  const idf = (t: string) => Math.log(1 + (blocks.length - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
  const phrase = query.toLowerCase().replace(/\s+/g, " ").trim();

  const scored = blocks.map((b, i) => {
    const d = docs[i] ?? [];
    const heading = b.section ? terms(b.section) : [];
    let score = 0;
    for (const t of q) {
      const tf = d.filter((x) => x === t).length;
      if (tf) score += idf(t) * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * d.length) / avgLen)));
      if (heading.includes(t)) score += 0.6 * idf(t);
    }
    if (phrase.length > 3 && b.text.toLowerCase().includes(phrase)) score += 2;
    return { i, score };
  });

  const ranked = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  const picked: { i: number; text: string }[] = [];
  let used = 0;
  for (const { i } of ranked) {
    if (picked.length >= maxPassages || used >= budget) break;
    const text = windowAround(blocks[i]!.text, q, windowChars);
    if (used + text.length > budget && picked.length > 0) continue;
    picked.push({ i, text });
    used += text.length;
  }
  picked.sort((a, b) => a.i - b.i); // document order reads better than score order
  return { passages: picked.map((p) => ({ section: blocks[p.i]!.section, text: p.text })), matched: ranked.length };
}

/**
 * Cut a long block to fit `size`: its head (definitions name their subject first), plus a
 * second window covering the query terms the head didn't reach (e.g. an "Added in version"
 * note at the end of an API entry).
 */
function windowAround(text: string, q: string[], size: number): string {
  if (text.length <= size) return text;
  const lower = text.toLowerCase();
  const half = Math.floor(size / 2);
  const head = text.slice(0, half).trim();
  const missing = q.filter((t) => !head.toLowerCase().includes(t) && lower.includes(t, half));
  if (missing.length === 0) return `${text.slice(0, size).trim()}…`;
  let best = half;
  let bestHits = -1;
  for (let start = half; start < text.length; start += Math.max(1, Math.floor(half / 4))) {
    const slice = lower.slice(start, start + half);
    const hits = missing.reduce((n, t) => n + (slice.includes(t) ? 1 : 0), 0);
    if (hits > bestHits) { bestHits = hits; best = start; }
  }
  const from = Math.max(half, Math.min(best, text.length - half));
  const tail = text.slice(from, from + half).trim();
  return `${head} … ${tail}${from + half < text.length ? "…" : ""}`;
}

/**
 * One section's text by heading (exact, then prefix, then substring match; case-insensitive),
 * including its subsections, up to the next heading at the same or a higher level.
 */
export function sectionText(blocks: Block[], name: string): { heading: string; text: string } | null {
  const want = name.toLowerCase().trim();
  const headings = [...new Set(blocks.map((b) => b.section).filter((s): s is string => s != null))];
  const match =
    headings.find((h) => h.toLowerCase() === want) ??
    headings.find((h) => h.toLowerCase().startsWith(want)) ??
    headings.find((h) => h.toLowerCase().includes(want));
  if (!match) return null;
  const start = blocks.findIndex((b) => b.section === match);
  const level = blocks[start]!.level;
  const out: string[] = [];
  for (let i = start; i < blocks.length; i++) {
    const b = blocks[i]!;
    if (i > start && b.section !== blocks[i - 1]!.section && b.section !== match && b.level <= level) break;
    out.push(b.text);
  }
  return { heading: match, text: out.join("\n") };
}

/**
 * Split text into pages of at most `size` chars. Each page ends at the last paragraph break
 * in its window, unless that would leave the page under half full (then it's a hard cut).
 */
export function paginate(text: string, size: number): string[] {
  const pages: string[] = [];
  let rest = text;
  while (rest.length > size) {
    let cut = rest.lastIndexOf("\n", size);
    if (cut < size / 2) cut = size;
    pages.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n/, "");
  }
  if (rest || pages.length === 0) pages.push(rest);
  return pages;
}
