import { describe, expect, it } from "vitest";
import { detectType } from "../src/typeDetector.js";

describe("detectType", () => {
  it("flags og:type=article with high confidence", () => {
    const html = `<html><head><meta property="og:type" content="article"></head>
      <body><article><h1>Hi</h1><time datetime="2024-01-01">Jan</time></article></body></html>`;
    const result = detectType(html, "https://site.com/blog/hi");
    expect(result.type).toBe("article");
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.hints).toContain("og:type=article");
  });

  it("detects schema.org BlogPosting via JSON-LD", () => {
    const html = `<html><head>
      <script type="application/ld+json">{"@type":"BlogPosting"}</script>
      </head><body><p>text</p></body></html>`;
    const result = detectType(html, "https://site.com/x");
    expect(result.type).toBe("article");
    expect(result.hints).toContain("schema.org-article");
  });

  it("detects documentation from a docs URL + code blocks", () => {
    const html = `<html><body><pre>a</pre><pre>b</pre><pre>c</pre></body></html>`;
    const result = detectType(html, "https://docs.python.org/3/tutorial/");
    expect(result.type).toBe("documentation");
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.hints).toContain("docs-host");
  });

  it("detects documentation from a /docs/ path", () => {
    const html = `<html><body><pre>x</pre></body></html>`;
    const result = detectType(html, "https://example.com/docs/api/reference");
    expect(result.type).toBe("documentation");
  });

  it("falls back to generic with no article signals", () => {
    const html = `<html><body><div><p>Just a page.</p></div></body></html>`;
    const result = detectType(html, "https://site.com/random");
    expect(result.type).toBe("generic");
    expect(result.confidence).toBe(0.6);
  });
});
