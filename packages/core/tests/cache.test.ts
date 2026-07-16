import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readCache, writeCache } from "../src/cache.js";

const page = {
  html: "<html><body>hi</body></html>",
  finalUrl: "https://example.com/",
  status: 200,
  contentType: "text/html",
};

describe("disk cache", () => {
  beforeAll(() => {
    process.env.AXI_FETCH_CACHE_DIR = mkdtempSync(join(tmpdir(), "axi-cache-"));
  });
  afterAll(() => {
    delete process.env.AXI_FETCH_CACHE_DIR;
  });

  it("round-trips a fetched page", async () => {
    await writeCache("https://example.com/", page);
    expect(await readCache("https://example.com/")).toEqual(page);
  });

  it("misses on a different url", async () => {
    expect(await readCache("https://other.com/")).toBeNull();
  });

  it("treats an entry older than the ttl as a miss", async () => {
    await writeCache("https://ttl.com/", page);
    expect(await readCache("https://ttl.com/", -1)).toBeNull();
  });
});
