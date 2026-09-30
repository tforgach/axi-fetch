import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import {
  extractCodeBlocks,
  extractLinks,
  extractProse,
  extractTables,
} from "../src/extractors/shared.js";

describe("extractProse", () => {
  it("separates block boundaries instead of gluing words", () => {
    const $ = cheerio.load("<div><h2>Title</h2><p>First para.</p><p>Second.</p></div>");
    const prose = extractProse($).main;
    expect(prose).not.toContain("TitleFirst");
    expect(prose).toContain("First para.");
    expect(prose).toContain("Second.");
  });

  it("drops infobox tables and citation markers", () => {
    const $ = cheerio.load(
      `<div>
        <table class="infobox"><tr><td>Reign</td><td>1804</td></tr></table>
        <p>Napoleon<sup class="reference">[1]</sup> was Emperor[b].</p>
      </div>`,
    );
    const prose = extractProse($).main;
    expect(prose).not.toContain("Reign");
    expect(prose).not.toContain("[1]");
    expect(prose).not.toContain("[b]");
    expect(prose).toBe("Napoleon was Emperor.");
  });
});

describe("extractCodeBlocks", () => {
  it("preserves indentation and detects language from class", () => {
    const $ = cheerio.load(
      `<div><pre class="language-python"><code>def f():\n    return 1</code></pre></div>`,
    );
    const blocks = extractCodeBlocks($);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.language).toBe("python");
    expect(blocks[0]!.code).toBe("def f():\n    return 1");
  });

  it("omits language when there is no class hint", () => {
    const $ = cheerio.load("<pre>plain code</pre>");
    expect(extractCodeBlocks($)[0]).toEqual({ code: "plain code" });
  });
});

describe("extractTables", () => {
  it("extracts headers and rows from a real data table", () => {
    const $ = cheerio.load(
      `<table>
        <thead><tr><th>Plan</th><th>Price</th></tr></thead>
        <tbody>
          <tr><td>Free</td><td>$0</td></tr>
          <tr><td>Pro</td><td>$20</td></tr>
        </tbody>
      </table>`,
    );
    const tables = extractTables($);
    expect(tables).toHaveLength(1);
    expect(tables[0]!.headers).toEqual(["Plan", "Price"]);
    expect(tables[0]!.rows).toEqual([
      ["Free", "$0"],
      ["Pro", "$20"],
    ]);
  });

  it("skips infobox/layout tables", () => {
    const $ = cheerio.load(
      `<table class="infobox"><tr><td>Born</td><td>1769</td></tr><tr><td>Died</td><td>1821</td></tr></table>`,
    );
    expect(extractTables($)).toHaveLength(0);
  });
});

describe("extractLinks", () => {
  const base = "https://en.wikipedia.org/wiki/Napoleon";

  it("skips footnote markers and same-page anchors", () => {
    const $ = cheerio.load(
      `<p>
        <a href="/wiki/France">France</a>
        <a href="#cite_note-1">[a]</a>
        <a href="https://en.wikipedia.org/wiki/Napoleon#Death">Death section</a>
        <a href="https://other.com/x">External</a>
      </p>`,
    );
    const links = extractLinks($, base);
    const urls = links.map((l) => l.url);
    expect(urls).toContain("https://en.wikipedia.org/wiki/France");
    expect(urls).toContain("https://other.com/x");
    expect(urls.some((u) => u.includes("#cite_note"))).toBe(false);
    expect(urls.some((u) => u.includes("Napoleon#Death"))).toBe(false);
    expect(links.find((l) => l.url.includes("other.com"))?.kind).toBe("external");
  });
});

describe("docs-site prose (Sphinx)", () => {
  it("keeps cross-reference identifiers, joins <dt> terms to their <dd>, drops ¶ anchors", async () => {
    const cheerio = await import("cheerio");
    const $ = cheerio.load(`<h2>Timeouts<a class="headerlink" href="#t">¶</a></h2>
      <dl><dt>asyncio.timeout(delay)</dt><dd><p>Return an <a class="reference internal" href="#x"><code>asynchronous context manager</code></a>.</p></dd></dl>`);
    const { blocks } = extractProse($);
    expect(blocks).toEqual([{ section: "Timeouts", level: 2, text: "asyncio.timeout(delay) — Return an asynchronous context manager." }]);
  });
});
