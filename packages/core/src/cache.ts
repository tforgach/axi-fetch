import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { FetchedPage } from "./fetcher.js";

/** Default freshness window: repeated fetches within 15 min skip the network. */
export const DEFAULT_CACHE_TTL = 15 * 60_000;

interface CacheEntry extends FetchedPage {
  cachedAt: number;
}

/** Cache directory, resolved lazily so AXI_FETCH_CACHE_DIR / XDG can override it. */
function cacheDir(): string {
  if (process.env.AXI_FETCH_CACHE_DIR) return process.env.AXI_FETCH_CACHE_DIR;
  const base = process.env.XDG_CACHE_HOME || join(homedir(), ".cache");
  return join(base, "axi-fetch");
}

function keyPath(url: string): string {
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 32);
  return join(cacheDir(), `${hash}.json`);
}

/** Return a cached page if present and newer than `ttl`; otherwise null. */
export async function readCache(
  url: string,
  ttl: number = DEFAULT_CACHE_TTL,
): Promise<FetchedPage | null> {
  try {
    const entry = JSON.parse(await readFile(keyPath(url), "utf8")) as CacheEntry;
    if (Date.now() - entry.cachedAt > ttl) return null;
    return {
      html: entry.html,
      finalUrl: entry.finalUrl,
      status: entry.status,
      contentType: entry.contentType,
    };
  } catch {
    // Missing/corrupt cache is a normal miss.
    return null;
  }
}

/** Persist a fetched page. Best-effort — write failures are swallowed. */
export async function writeCache(url: string, page: FetchedPage): Promise<void> {
  try {
    await mkdir(cacheDir(), { recursive: true });
    const entry: CacheEntry = { ...page, cachedAt: Date.now() };
    await writeFile(keyPath(url), JSON.stringify(entry));
  } catch {
    // Caching is an optimization, never a hard dependency.
  }
}
