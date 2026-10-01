import { describe, expect, it } from "vitest";
import { toStructured, toToon } from "../src/output.js";
import type { AxiResponse } from "../src/types.js";

const sample: AxiResponse = {
  metadata: {
    url: "https://site.com/post",
    title: "A Post",
    type: "article",
    confidence: 0.842,
    fetchedAt: "2024-01-01T00:00:00.000Z",
    contentLength: 4200,
  },
  content: {
    main: "Body text.",
    truncated: true,
    sections: [{ heading: "Intro", level: 2 }],
    codeBlocks: [{ language: "ts", code: "const x = 1;" }],
    tables: [{ headers: ["a", "b"], rows: [["1", "2"]] }],
    links: [{ text: "More", url: "https://site.com/more", kind: "internal" }],
  },
  nextSteps: ["Re-run with `--full` to get the complete content"],
};

describe("toStructured", () => {
  it("keeps the envelope minimal: no confidence, no type, url only after a redirect", () => {
    const out = toStructured(sample);
    expect(out.confidence).toBeUndefined();
    expect(out.type).toBeUndefined();
    expect(Object.keys(out)[0]).toBe("title");
    const redirected = toStructured({ ...sample, metadata: { ...sample.metadata, redirected: true } });
    expect(Object.keys(redirected).slice(0, 2)).toEqual(["url", "title"]);
  });

  it("omits empty collections to save tokens", () => {
    const bare = {
      ...sample,
      content: {
        ...sample.content,
        sections: [],
        codeBlocks: [],
        tables: [],
        links: [],
      },
      nextSteps: [],
    };
    const out = toStructured(bare);
    expect(out).not.toHaveProperty("sections");
    expect(out).not.toHaveProperty("codeBlocks");
    expect(out).not.toHaveProperty("tables");
    expect(out).not.toHaveProperty("links");
    expect(out).not.toHaveProperty("help");
  });
});

describe("toToon", () => {
  it("produces TOON smaller than the equivalent JSON", () => {
    const toon = toToon(sample);
    const json = JSON.stringify(toStructured(sample), null, 2);
    expect(toon).toContain(`title: ${sample.metadata.title}`);
    expect(toon.length).toBeLessThan(json.length);
  });
});
