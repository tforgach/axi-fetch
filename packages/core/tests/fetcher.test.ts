import { describe, expect, it } from "vitest";
import { AxiError } from "axi-sdk-js";
import { metaRefreshTarget, normalizeUrl } from "../src/fetcher.js";

describe("normalizeUrl", () => {
  it("defaults a bare host to https", () => {
    expect(normalizeUrl("example.com").href).toBe("https://example.com/");
  });

  it("preserves an explicit http scheme", () => {
    expect(normalizeUrl("http://example.com/x").protocol).toBe("http:");
  });

  it("rejects non-http schemes with a validation error", () => {
    expect(() => normalizeUrl("ftp://example.com")).toThrowError(AxiError);
  });

  it("rejects unparseable input", () => {
    try {
      normalizeUrl("http://");
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AxiError);
      expect((error as AxiError).code).toBe("VALIDATION_ERROR");
    }
  });
});

describe("metaRefreshTarget", () => {
  const base = "https://blog.example.com/post.html";

  it("resolves a relative meta-refresh target against the base", () => {
    const html = `<meta http-equiv="refresh" content="0; url=/post/">`;
    expect(metaRefreshTarget(html, base)).toBe("https://blog.example.com/post/");
  });

  it("handles attribute order and an absolute url", () => {
    const html = `<meta content="5; URL='https://other.com/x'" http-equiv="Refresh">`;
    expect(metaRefreshTarget(html, base)).toBe("https://other.com/x");
  });

  it("returns null when there is no refresh meta", () => {
    expect(metaRefreshTarget("<meta charset=utf-8>", base)).toBeNull();
  });
});
