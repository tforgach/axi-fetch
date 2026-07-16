import { AxiError } from "axi-sdk-js";

const DEFAULT_TIMEOUT = 10_000;
const DEFAULT_USER_AGENT =
  "axi-fetch/0.1 (+https://github.com/travisforgach/axi-fetch)";
// How many HTML meta-refresh hops to follow (native fetch handles HTTP 3xx).
const MAX_META_HOPS = 3;

export interface FetchedPage {
  html: string;
  /** URL after any redirects. */
  finalUrl: string;
  status: number;
  contentType: string;
}

export interface FetchUrlOptions {
  timeout?: number;
  userAgent?: string;
}

/** Validate and normalize a user-supplied URL, defaulting the scheme to https. */
export function normalizeUrl(input: string): URL {
  const trimmed = input.trim();
  // Only default the scheme when none is present; an explicit non-http(s)
  // scheme must fall through to the protocol check below and be rejected.
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
  const withScheme = hasScheme ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new AxiError(`Invalid URL: ${input}`, "VALIDATION_ERROR", [
      "Pass a valid http(s) URL, e.g. `axi-fetch https://example.com/article`",
    ]);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AxiError(
      `Unsupported URL scheme: ${url.protocol}`,
      "VALIDATION_ERROR",
      ["Only http and https URLs are supported"],
    );
  }

  return url;
}

/**
 * Decode a response body honoring its charset. Native `Response.text()` assumes
 * UTF-8; real-world pages are sometimes windows-1252, iso-8859-1, shift_jis, etc.
 * Charset comes from the content-type header, or a `<meta charset>` in the head.
 */
function decodeBody(buffer: ArrayBuffer, contentType: string): string {
  let charset = /charset=([^;]+)/i.exec(contentType)?.[1]?.trim().toLowerCase();
  if (!charset) {
    // Peek at the head bytes (ASCII-safe) for a <meta charset>.
    const head = new TextDecoder("latin1").decode(buffer.slice(0, 2048));
    charset =
      /<meta[^>]+charset=["']?\s*([\w-]+)/i.exec(head)?.[1]?.toLowerCase() ??
      undefined;
  }
  if (!charset || charset === "utf-8" || charset === "utf8") {
    return new TextDecoder("utf-8").decode(buffer);
  }
  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    // Unknown label (TextDecoder throws on unsupported encodings) — fall back.
    return new TextDecoder("utf-8").decode(buffer);
  }
}

/** Find an HTML `<meta http-equiv="refresh">` target, resolved against `base`. */
export function metaRefreshTarget(html: string, base: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (!/http-equiv\s*=\s*["']?\s*refresh/i.test(tag)) continue;
    // Backreference so inner quotes (e.g. content="0; url='...'") don't truncate.
    const content = /content\s*=\s*(["'])(.*?)\1/is.exec(tag)?.[2] ?? "";
    const urlPart = /url\s*=\s*(.+)$/i.exec(content.trim())?.[1];
    if (!urlPart) continue;
    try {
      return new URL(urlPart.trim().replace(/^['"]|['"]$/g, ""), base).href;
    } catch {
      return null;
    }
  }
  return null;
}

/** Perform a single fetch, validate it, and decode the body by charset. */
async function fetchOnce(
  input: string,
  timeout: number,
  userAgent: string,
): Promise<FetchedPage> {
  const url = normalizeUrl(input);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": userAgent,
        Accept: "text/html,application/xhtml+xml",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new AxiError(
        `Request timed out after ${timeout}ms: ${url.href}`,
        "TIMEOUT",
        ["Increase the timeout with `--timeout <ms>`"],
      );
    }
    const reason = error instanceof Error ? error.message : String(error);
    throw new AxiError(`Failed to fetch ${url.href}: ${reason}`, "FETCH_FAILED");
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new AxiError(
      `HTTP ${response.status} ${response.statusText} for ${url.href}`,
      "HTTP_ERROR",
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
    throw new AxiError(
      `Unsupported content type "${contentType}" for ${url.href}`,
      "NOT_HTML",
      ["axi-fetch only handles HTML pages in the MVP"],
    );
  }

  const html = decodeBody(await response.arrayBuffer(), contentType);
  return { html, finalUrl: response.url || url.href, status: response.status, contentType };
}

/**
 * Fetch a URL as HTML. Follows HTTP redirects (native) and HTML meta-refresh
 * redirects (manually, up to MAX_META_HOPS), decodes by charset, enforces a
 * timeout, and fails loud with structured errors.
 */
export async function fetchUrl(
  input: string,
  options: FetchUrlOptions = {},
): Promise<FetchedPage> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;

  let current = input;
  for (let hop = 0; ; hop++) {
    const page = await fetchOnce(current, timeout, userAgent);
    const refresh = metaRefreshTarget(page.html, page.finalUrl);
    if (refresh && refresh !== page.finalUrl && hop < MAX_META_HOPS) {
      current = refresh;
      continue;
    }
    return page;
  }
}
