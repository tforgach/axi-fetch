# @tforgach/axi-fetch

Token-efficient web fetching for AI agents. `axi-fetch` fetches a URL, extracts
the meaningful content, and returns a compact **TOON** (Token-Oriented Object
Notation) response following **AXI** (Agent eXperience Interface) principles —
instead of raw HTML or even clean markdown.

On real content pages it delivers a large token reduction vs a readable-markdown
reader tool (median ~80% in-repo benchmark), by combining aggressive extraction,
structured code/table lifting, sensible truncation, and TOON encoding.

Built as an AXI CLI on top of
[`axi-sdk-js`](https://www.npmjs.com/package/axi-sdk-js) (TOON output, structured
errors, exit codes, self-update).

## Install

```sh
npm install -g @tforgach/axi-fetch   # CLI
# or as a library:
npm install @tforgach/axi-fetch
```

Requires Node 20+.

## CLI

```sh
axi-fetch <url> [flags]

--full            Return full content (skip truncation)
--no-links        Omit outbound links
--no-cache        Bypass the on-disk response cache
--timeout <ms>    Network timeout (default 10000)
--max <chars>     Truncate content to N chars (default 1500)
```

Example:

```sh
axi-fetch https://en.wikipedia.org/wiki/Token_bucket
```

```
url: "https://en.wikipedia.org/wiki/Token_bucket"
title: Token bucket
type: article
confidence: 0.8
contentLength: 7800
truncated: true
content: The token bucket is an algorithm used in packet-switched networks...
sections[2]{heading,level}:
  Comparison to leaky bucket,2
  Hierarchical token bucket,2
help[1]: Re-run with `--full` to get the complete content
```

Failures print a structured error and use a non-zero exit code (2 for bad
input/flags, 1 otherwise).

## Library

```ts
import { axiFetch, extractFromHtml } from "@tforgach/axi-fetch";

const { axiResponse, toonOutput } = await axiFetch("https://example.com/article");
console.log(toonOutput);        // TOON string (agent-facing)
console.log(axiResponse.type);  // "article" | "documentation" | "generic"

// Or run the pipeline on HTML you already have (no network):
const result = extractFromHtml(html, "https://example.com/article");
```

## How it works

```
URL → fetch (native, redirects + meta-refresh + charset) → detect type (rules)
    → extract (Readability / cheerio) → lift sections/code/tables/links
    → truncate + next-steps → TOON encode
```

## License

MIT
