/**
 * Page categories the MVP can extract. Kept intentionally small (AXI principle 2:
 * minimal schemas). More types (pricing, product) are Phase 2.
 */
export type PageType = "article" | "documentation" | "generic" | "text" | "json";

export interface AxiFetchOptions {
  /** Include outbound links in the response. Default: false (`--links`). */
  includeLinks?: boolean;
  /** Include extracted code blocks. Default: false (`--code`); a count is shown instead. */
  includeCode?: boolean;
  /**
   * Return only the passages matching these terms (`--find`), ranked without an LLM,
   * instead of the page's opening content. The fast path to a specific fact.
   */
  find?: string;
  /** Return one section by heading (`--section`, case-insensitive substring match). */
  section?: string;
  /** Page number for long `--full` / `--section` output (`--page`, 1-based). */
  page?: number;
  /** Network timeout in milliseconds. Default: 10000. */
  timeout?: number;
  /**
   * Max characters of main content before truncation (AXI principle 3).
   * Default: 3000. Ignored when `full` is true.
   */
  maxContentLength?: number;
  /** Bypass truncation and return full content (the `--full` escape hatch). */
  full?: boolean;
  /** Override the User-Agent header. */
  userAgent?: string;
  /** Use the on-disk response cache. Default: true. */
  cache?: boolean;
  /** Cache freshness window in ms. Default: 15 minutes. */
  cacheTtl?: number;
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

/** A prose block (paragraph, list item, …) tagged with the section it sits under. */
export interface Block {
  /** Nearest preceding heading, or null before the first heading. */
  section: string | null;
  /** That heading's level (2–6), or 1 before the first heading. */
  level: number;
  text: string;
}

/** A passage returned by `--find`: matching text plus where it came from. */
export interface Passage {
  section: string | null;
  text: string;
}

/** A heading in the content outline. Text lives in `Content.main`, not here. */
export interface Section {
  heading: string;
  level: number;
}

/** A fenced/`<pre>` code block pulled out of the prose. */
export interface CodeBlock {
  /** Detected language (from class hints), if any. */
  language?: string;
  code: string;
}

/** A tabular block pulled out of the prose (strong TOON fit). */
export interface Table {
  headers: string[];
  rows: string[][];
}

export interface Content {
  /** Primary extracted prose, possibly truncated (see `truncated`). */
  main: string;
  /** True when `main` was truncated to `maxContentLength`. */
  truncated: boolean;
  /** Heading outline of the page, if any. */
  sections: Section[];
  /** Code blocks lifted out of the prose. */
  codeBlocks: CodeBlock[];
  /** Data tables lifted out of the prose. */
  tables: Table[];
  /** Relevant outbound links, if `includeLinks` was set. */
  links: Link[];
  /** Prose blocks with their section (internal; drives `--find` and `--section`). */
  blocks: Block[];
  /** Passages matching `--find`, in document order. */
  passages?: Passage[];
  /** Paging for long `--full` / `--section` output. */
  page?: { number: number; of: number };
  /** Code blocks present on the page but omitted (pass `--code`). */
  omittedCodeBlocks?: number;
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
