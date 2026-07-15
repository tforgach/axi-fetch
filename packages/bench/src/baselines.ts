import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

/**
 * The "good reader tool" baseline: what a sophisticated web-fetch (Readability →
 * markdown, à la reader-mode / Jina / Firecrawl) would hand an agent. This is
 * the fair comparison for axi-fetch — beating raw HTML is trivial; beating clean
 * readable markdown is the real test.
 */
export function readableMarkdown(html: string, url: string): string {
  const dom = new JSDOM(html, { url });
  const parsed = new Readability(dom.window.document).parse();
  const contentHtml = parsed?.content ?? dom.window.document.body?.innerHTML ?? "";
  return turndown.turndown(contentHtml).trim();
}
