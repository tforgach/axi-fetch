import { describe, expect, it } from "vitest";
import { extractFromHtml, PAGE_CHARS } from "../src/index.js";
import { findPassages, paginate, sectionText, terms } from "../src/retrieve.js";
import type { Block } from "../src/types.js";

const blocks: Block[] = [
  { section: null, level: 1, text: "Tidewright is a toolkit for tide tables." },
  { section: "Tidewright 4.8.0", level: 2, text: "Fixed a race in the scheduler." },
  { section: "Tidewright 4.7.0", level: 2, text: "Added the --strict-tides flag. It defaults to false." },
  { section: "Tidewright 4.7.0", level: 2, text: "Improved performance of the cache." },
  { section: "Installing", level: 2, text: "Run the installer." },
  { section: "On macOS", level: 3, text: "Use Homebrew." },
  { section: "Usage", level: 2, text: "Call tidewright check." },
];

describe("terms", () => {
  it("drops stopwords and keeps dotted identifiers whole and split", () => {
    expect(terms("What is asyncio.timeout for?")).toEqual(["asyncio.timeout", "asyncio", "timeout"]);
  });
  it("folds simple plurals", () => {
    expect(terms("Timeouts tasks status")).toEqual(["timeout", "task", "status"]);
  });
});

describe("findPassages", () => {
  it("ranks the passage with the fact first and returns it with its section", () => {
    const { passages } = findPassages(blocks, "strict-tides flag default", { maxPassages: 1 });
    expect(passages).toEqual([{ section: "Tidewright 4.7.0", text: "Added the --strict-tides flag. It defaults to false." }]);
  });

  it("returns nothing for terms that don't occur", () => {
    expect(findPassages(blocks, "kubernetes").passages).toEqual([]);
  });

  it("cuts long blocks to their head plus a window reaching the terms the head misses", () => {
    const long: Block[] = [{ section: "x", level: 2, text: `api.call(x) — does things. ${"filler ".repeat(300)}the needle is here ${"filler ".repeat(300)}` }];
    const [p] = findPassages(long, "api.call needle", { windowChars: 200 }).passages;
    expect(p!.text.length).toBeLessThan(215);
    expect(p!.text.startsWith("api.call(x)")).toBe(true);
    expect(p!.text).toContain("needle");
  });
});

describe("sectionText", () => {
  it("includes subsections and stops at the next same-level heading", () => {
    expect(sectionText(blocks, "install")).toEqual({ heading: "Installing", text: "Run the installer.\nUse Homebrew." });
  });
  it("returns null for unknown headings", () => {
    expect(sectionText(blocks, "changelog 9")).toBeNull();
  });
});

describe("paginate", () => {
  it("splits on paragraph boundaries under the page size", () => {
    const pages = paginate(["a".repeat(60), "b".repeat(60), "c".repeat(60)].join("\n"), 130);
    expect(pages).toHaveLength(2);
    expect(pages.every((p) => p.length <= 130)).toBe(true);
  });

  it("never leaves a short heading alone on its own page", () => {
    const pages = paginate(`Intro\n${"x".repeat(250)}`, 100);
    expect(pages[0]!.startsWith("Intro\nx")).toBe(true);
    expect(pages.every((p) => p.length <= 100)).toBe(true);
    expect(pages.join("").replace(/\n/g, "")).toBe(`Intro${"x".repeat(250)}`);
  });
});

const page = `<html><head><title>Docs</title></head><body><main>
<h2>Intro</h2><p>${"Intro text. ".repeat(400)}</p>
<h2>Timeouts</h2><p>asyncio.timeout() was added in Python 3.11.</p><pre class="language-python">async with timeout(1): pass</pre>
<h2>Other</h2><p>Unrelated.</p><a href="https://x.test/">link</a>
</main></body></html>`;

describe("extractFromHtml modes", () => {
  it("default: no links, code blocks counted not included, prose budget 3000", () => {
    const { axiResponse, toonOutput } = extractFromHtml(page, "https://docs.test/");
    expect(axiResponse.content.links).toEqual([]);
    expect(axiResponse.content.codeBlocks).toEqual([]);
    expect(axiResponse.content.omittedCodeBlocks).toBe(1);
    expect(axiResponse.content.main.length).toBeLessThanOrEqual(3001);
    expect(toonOutput).toContain("--find");
  });

  it("--find returns just the matching passage", () => {
    const { axiResponse, toonOutput } = extractFromHtml(page, "https://docs.test/", { find: "timeout added version" });
    expect(axiResponse.content.passages?.[0]).toEqual({ section: "Timeouts", text: "asyncio.timeout() was added in Python 3.11." });
    expect(toonOutput).not.toContain("Intro text.");
  });

  it("--section returns one section; --full pages long content", () => {
    expect(extractFromHtml(page, "https://docs.test/", { section: "timeouts" }).axiResponse.content.main).toBe(
      "asyncio.timeout() was added in Python 3.11.",
    );
    const big = page.replace("Intro text. ".repeat(400), "Intro text. ".repeat(3000));
    const full = extractFromHtml(big, "https://docs.test/", { full: true });
    expect(full.axiResponse.content.page).toEqual({ number: 1, of: 3 });
    expect(full.axiResponse.content.main.length).toBeLessThanOrEqual(PAGE_CHARS);
    expect(full.toonOutput).toContain("--page 2");
  });
});
