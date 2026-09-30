import type { Block, Content, Section } from "../types.js";

export const isJsonType = (ct: string) => /application\/(?:[\w.-]+\+)?json/i.test(ct);
export const isTextType = (ct: string) => /^text\//i.test(ct.trim()) && !/html/i.test(ct);

const empty = (): Omit<Content, "main" | "blocks" | "sections"> => ({ truncated: false, codeBlocks: [], tables: [], links: [] });

// RFC-style numbered headings at column 0 ("15.5.13.  412 Precondition Failed", "Appendix A.")
const NUMBERED = /^((?:\d+|[A-Z])(?:\.\d+)*\.?|Appendix [A-Z]\.?)\s{1,4}(\S.*)$/;
const MARKDOWN = /^(#{1,6})\s+(.*)$/;
// Page furniture in paginated text (RFC headers/footers).
const FURNITURE = /(\[Page \d+\]\s*$)|(^RFC \d+\s{2,}.*\s{2,}\w+ \d{4}\s*$)/;

/** Plain text / Markdown: paragraphs become section-tagged blocks; headings drive --section. */
export function extractText(body: string, url: string): { title: string; content: Content } {
  const lines = body.replace(/\f/g, "\n").split(/\r?\n/).filter((l) => !FURNITURE.test(l));
  const blocks: Block[] = [];
  const sections: Section[] = [];
  const mainParts: string[] = [];
  let section: string | null = null;
  let level = 1;
  let title: string | null = null;
  let para: string[] = [];
  const flush = () => {
    const text = para.join(" ").replace(/\s+/g, " ").trim();
    para = [];
    if (!text) return;
    blocks.push({ section, level, text });
    mainParts.push(text);
  };
  for (const line of lines) {
    const md = MARKDOWN.exec(line);
    const num = !md && !/^\s/.test(line) ? NUMBERED.exec(line.trimEnd()) : null;
    if (md || num) {
      flush();
      const heading = md ? md[2]!.trim() : line.trim().replace(/\s+/g, " ");
      level = md ? md[1]!.length : Math.min(6, (num![1]!.match(/\./g)?.length ?? 0) + 1);
      section = heading;
      if (md && level === 1 && !title) title = heading;
      if (sections.length < 25 && level <= 2) sections.push({ heading, level });
      mainParts.push(heading);
      continue;
    }
    if (!line.trim()) flush();
    else para.push(line.trim());
  }
  flush();
  return {
    title: title ?? decodeURIComponent(new URL(url).pathname.split("/").pop() || url),
    content: { ...empty(), main: mainParts.join("\n"), blocks, sections },
  };
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** JSON: default view is top-level scalars (nested values summarized); --find/--section search flattened paths. */
export function extractJson(body: string, url: string): { title: string; content: Content } {
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    return extractText(body, url);
  }
  const blocks: Block[] = [];
  const walk = (v: unknown, path: string, top: string) => {
    if (v !== null && typeof v === "object") {
      for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
        const p = Array.isArray(v) ? `${path}[${k}]` : path ? `${path}.${k}` : k;
        walk(child, p, top || (Array.isArray(v) ? `[${k}]` : k));
      }
    } else {
      blocks.push({ section: top || null, level: 2, text: `${path}: ${String(v)}` });
    }
  };
  walk(data, "", "");
  const summary: string[] = [];
  const entries = data !== null && typeof data === "object" ? Object.entries(data as Record<string, unknown>) : [["value", data] as const];
  for (const [k, v] of entries) {
    if (v !== null && typeof v === "object") summary.push(`${k}: ${Array.isArray(v) ? `[${v.length} items]` : `{${Object.keys(v).length} keys}`}`);
    else summary.push(`${k}: ${clip(String(v), 200)}`);
  }
  const obj = data as Record<string, unknown> | null;
  const title = String((obj && typeof obj === "object" && (obj.full_name ?? obj.name ?? obj.title)) || url);
  const sections: Section[] = entries.filter(([, v]) => v !== null && typeof v === "object").slice(0, 25).map(([k]) => ({ heading: String(k), level: 2 }));
  return { title, content: { ...empty(), main: summary.join("\n"), blocks, sections } };
}
