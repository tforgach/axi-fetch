import { AxiError } from "axi-sdk-js";

const DEFAULT_TIMEOUT = 10_000;
const DEFAULT_USER_AGENT =
  "axi-fetch/0.1 (+https://github.com/travisforgach/axi-fetch)";

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
 * Fetch a URL as HTML using native fetch. Follows redirects, enforces a timeout,
 * and fails loud with structured errors (never returns partial/garbage HTML).
 */
export async function fetchUrl(
  input: string,
  options: FetchUrlOptions = {},
): Promise<FetchedPage> {
  const url = normalizeUrl(input);
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": options.userAgent ?? DEFAULT_USER_AGENT,
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

  const html = await response.text();
  return {
    html,
    finalUrl: response.url || url.href,
    status: response.status,
    contentType,
  };
}
