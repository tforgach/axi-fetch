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

```
axi-fetch <url> [flags]

--find <terms>    Only the passages matching these keywords (fastest way to a specific fact)
--section <name>  One section by heading (see the sections list)
--full            Everything, in pages of 16k chars
--page <n>        Page of --full / --section output
--max <chars>     Opening content length (default 3000)
--links           Include outbound links
--code            Include code blocks (a count is shown otherwise)
--no-cache        Bypass the on-disk response cache
--timeout <ms>    Network timeout (default 10000)
```

Looking for a specific fact? Pass `--find` on the first call and get only the matching
passages, each with its section:

```sh
axi-fetch https://en.wikipedia.org/wiki/Token_bucket --find "leaky bucket meter"
```

```
url: "https://en.wikipedia.org/wiki/Token_bucket"
title: Token bucket
type: article
contentLength: 7799
passages[8]{section,text}:
  "","The token bucket is an algorithm used in packet-switched and telecommunications networks. …"
  …
  Comparison to leaky bucket,"… the leaky bucket algorithm as a meter. This is a mirror image of the token bucket, …"
  …
```

Without `--find` you get the opening content (3000 chars), the sections list, and next-step
hints (`--find`, `--section`, `--full`, `--page`).

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
