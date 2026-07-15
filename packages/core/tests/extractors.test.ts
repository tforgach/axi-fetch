import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { extractLinks, extractProse } from "../src/extractors/shared.js";

describe("extractProse", () => {
  it("separates block boundaries instead of gluing words", () => {
    const $ = cheerio.load("<div><h2>Title</h2><p>First para.</p><p>Second.</p></div>");
    const prose = extractProse($);
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
    const prose = extractProse($);
    expect(prose).not.toContain("Reign");
    expect(prose).not.toContain("[1]");
    expect(prose).not.toContain("[b]");
    expect(prose).toBe("Napoleon was Emperor.");
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
