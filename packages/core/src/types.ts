/**
 * Page categories the MVP can extract. Kept intentionally small (AXI principle 2:
 * minimal schemas). More types (documentation, pricing, product) are Phase 2.
 */
export type PageType = "article" | "generic";

export interface AxiFetchOptions {
  /** Include outbound links in the response. Default: true. */
  includeLinks?: boolean;
  /** Network timeout in milliseconds. Default: 10000. */
  timeout?: number;
  /**
   * Max characters of main content before truncation (AXI principle 3).
   * Default: 1500. Ignored when `full` is true.
   */
  maxContentLength?: number;
  /** Bypass truncation and return full content (the `--full` escape hatch). */
  full?: boolean;
  /** Override the User-Agent header. */
  userAgent?: string;
}

export interface Metadata {
  url: string;
  title: string;
  type: PageType;
  /** Type-detection confidence, 0-1. */
  confidence: number;
  /** ISO timestamp of when the fetch completed. */
  fetchedAt: string;
  /** Length (chars) of the full extracted main content, before truncation. */
  contentLength: number;
}

export interface Link {
  text: string;
  url: string;
  kind: "internal" | "external";
}

/** A heading in the content outline. Text lives in `Content.main`, not here. */
export interface Section {
  heading: string;
  level: number;
}

export interface Content {
  /** Primary extracted text, possibly truncated (see `truncated`). */
  main: string;
  /** True when `main` was truncated to `maxContentLength`. */
  truncated: boolean;
  /** Heading outline of the page, if any. */
  sections: Section[];
  /** Relevant outbound links, if `includeLinks` was set. */
  links: Link[];
}

export interface AxiResponse {
  metadata: Metadata;
  content: Content;
  /** Contextual next-step suggestions for the agent (AXI principle 9). */
  nextSteps: string[];
}

export interface FetchResult {
  /** Structured response object (keep internal logic on plain objects). */
  axiResponse: AxiResponse;
  /** TOON-encoded rendering of the response (the agent-facing payload). */
  toonOutput: string;
}
