import { describe, expect, it } from "vitest";
import { AxiError } from "axi-sdk-js";
import { normalizeUrl } from "../src/fetcher.js";

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
