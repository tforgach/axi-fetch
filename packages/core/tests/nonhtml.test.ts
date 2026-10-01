import { describe, expect, it } from "vitest";
import { extractFromJsonText, extractFromPlainText } from "../src/index.js";
import { isJsonType, isTextType } from "../src/extractors/nonhtml.js";

const rfc = `RFC 9999                    Example Protocol                   June 2026


1.  Introduction

   This document defines things.

5.  Field Definitions

5.1.  Age

   The "Age" response header field conveys the sender's estimate
   of the time since the response was generated.

Fielding, et al.             Standards Track                   [Page 12]

5.2.  Cache-Control

   The "Cache-Control" header field is used to list directives.
`;

describe("content types", () => {
  it("recognizes JSON (incl. vendor +json) and text, not HTML", () => {
    expect(isJsonType("application/vnd.github+json; charset=utf-8")).toBe(true);
    expect(isJsonType("application/json")).toBe(true);
    expect(isTextType("text/plain;charset=utf-8")).toBe(true);
    expect(isTextType("text/markdown")).toBe(true);
    expect(isTextType("text/html")).toBe(false);
  });
});

describe("plain text", () => {
  it("detects RFC-style headings, strips page furniture, and supports --find / --section", () => {
    const r = extractFromPlainText(rfc, "https://x.test/rfc9999.txt");
    expect(r.axiResponse.metadata.type).toBe("text");
    expect(r.axiResponse.content.main).not.toContain("[Page 12]");
    expect(r.axiResponse.content.main).not.toContain("June 2026");
    const find = extractFromPlainText(rfc, "https://x.test/rfc9999.txt", { find: "Age header field" });
    expect(find.axiResponse.content.passages?.[0]?.section).toBe("5.1. Age");
    const sec = extractFromPlainText(rfc, "https://x.test/rfc9999.txt", { section: "5.2" });
    expect(sec.axiResponse.content.main).toBe('The "Cache-Control" header field is used to list directives.');
  });

  it("uses Markdown headings and the first H1 as title", () => {
    const r = extractFromPlainText("# Tool\n\nIntro.\n\n## Install\n\nRun it.\n", "https://x.test/README.md", { section: "install" });
    expect(r.axiResponse.metadata.title).toBe("Tool");
    expect(r.axiResponse.content.main).toBe("Run it.");
  });
});

describe("JSON", () => {
  const body = JSON.stringify({
    full_name: "python/cpython", html_url: "https://github.com/python/cpython", forks_url: "https://api.github.com/x",
    default_branch: "main", language: "Python", owner: { login: "python", id: 1 }, topics: ["a", "b"],
  });
  it("default view: scalars first, nested summarized, URL fields collapsed", () => {
    const r = extractFromJsonText(body, "https://api.github.com/repos/python/cpython");
    expect(r.axiResponse.metadata.title).toBe("python/cpython");
    expect(r.axiResponse.content.main.split("\n")).toEqual([
      "full_name: python/cpython", "default_branch: main", "language: Python", "owner: {2 keys}", "topics: [2 items]",
      "(2 URL fields omitted: html_url, forks_url; use --find or --full)",
    ]);
  });
  it("--find searches flattened paths; --section returns a subtree", () => {
    const find = extractFromJsonText(body, "u", { find: "owner login" });
    expect(find.axiResponse.content.passages?.[0]).toEqual({ section: "owner", text: "owner.login: python" });
    expect(extractFromJsonText(body, "u", { section: "owner" }).axiResponse.content.main).toBe("owner.login: python\nowner.id: 1");
  });
  it("falls back to text for invalid JSON", () => {
    expect(extractFromJsonText("not json", "u").axiResponse.content.main).toBe("not json");
  });
});
