# axi-fetch

Token-efficient web fetching for AI agents. `axi-fetch` combines **AXI** (Agent
eXperience Interface) design principles with **TOON** (Token-Oriented Object
Notation) output: instead of parsing bloated HTML or JSON, an agent gets a
compact, structured, agent-ready response — targeting a 40–60% token reduction.

Built as an [AXI](https://github.com/kunchenguid/axi) CLI on top of
[`axi-sdk-js`](https://www.npmjs.com/package/axi-sdk-js) (TOON output, structured
errors, exit codes, self-update).

## Monorepo layout

```
axi-fetch/
├── packages/
│   ├── core/     @tforgach/axi-fetch — the CLI + extraction library
│   └── skill/    Claude Code skill (SKILL.md) that shells out to the CLI
```

## Install

Published on npm (requires Node 20+):

```sh
# CLI
npm install -g @tforgach/axi-fetch
axi-fetch https://en.wikipedia.org/wiki/Napoleon

# or as a library
npm install @tforgach/axi-fetch
```

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

## Library

```ts
import { axiFetch } from "@tforgach/axi-fetch";

const { axiResponse, toonOutput } = await axiFetch("https://example.com/article");
console.log(toonOutput);      // TOON string (agent-facing)
console.log(axiResponse.type); // "article" | "documentation" | "generic"
```

## Pipeline

```
URL → fetch (native; HTTP + meta-refresh redirects, charset, disk cache)
    → detect type (rules) → extract (Readability / cheerio)
    → lift sections/code/tables/links → truncate + next-steps → TOON encode
```

## Design decisions

| Area | Choice |
|---|---|
| Monorepo | pnpm workspaces |
| HTTP | native `fetch` (Node 20+) |
| HTML parsing | `cheerio` (detection, generic) |
| Article extraction | `@mozilla/readability` on `jsdom` |
| TOON | official `@toon-format/toon` (via `axi-sdk-js`) |
| Type detection | rules-based (URL, meta, schema.org — no LLM) |
| Page types | `article`, `documentation`, `generic` fallback; `json` (APIs) and `text` (plain/Markdown/RFCs) |
| Errors | structured TOON + exit codes, never interactive |

## Benchmark

`packages/bench` measures token savings vs a raw-HTML baseline and a strong
readable-markdown (Readability→markdown) baseline. Run it with `pnpm bench`;
results land in `packages/bench/results/`.

Median across the initial 6-page set (o200k / GPT-4o tokenizer):

| Comparison | Median savings |
|---|--:|
| TOON vs raw HTML | **97%** |
| TOON (default) vs readable markdown | **81.2%** |
| TOON (--full) vs readable markdown | **45.1%** |

Most of the win comes from extraction + truncation; TOON's format advantage
shows up on structured data more than prose. On trivially small pages the fixed
metadata overhead can make output net-larger — a documented tradeoff.

### Agent benchmark (axi-arena)

Output size is only half the story: what matters is what an agent spends to get the right
answer. [axi-arena](https://github.com/tforgach/axi-arena) runs the same tasks with axi-fetch
and with Claude Code's built-in `WebFetch` (or raw `curl`) and scores correctness, tool tokens,
turns and time. v0.3.0 was hill-climbed against it: changes were kept only when the train-task
score improved without losing correctness, and checked on held-out tasks never used for choosing.
Claude Haiku 4.5, 3 trials per arm, ambient (hook) context charged to axi-fetch:

| Tasks | v0.2.0 | **v0.3.0** | v0.3.0 vs WebFetch | v0.3.0 vs curl | Correct |
|---|--:|--:|--:|--:|--:|
| Train (8: docs, articles, canaries, 404, JSON API, RFC text) | +11.6 | **+33.8** | +26.2 | +41.4 | 100% |
| Held-out (6: MDN, Wikipedia tables, Python docs, GitHub API, RFC 9110, Effective Go) | −13.9 | **+38.7** | +44.2 | +33.2 | 100% |

Content-heavy pages need 81–97% fewer tool tokens than WebFetch. v0.2.0 failed every JSON API
and most plain-text tasks (it rejected non-HTML). v0.1.x scored −49 against WebFetch, because the
skill-loading turn and the `--full` round-trips cost more than the smaller output saved.

## Development

The repo is a pnpm monorepo — this is for contributing, not installing:

```sh
corepack enable pnpm
pnpm install
pnpm build        # build all packages
pnpm test         # run the test suite
pnpm bench        # run the token-savings benchmark
```

Publishing a new version is tag-driven — see [`RELEASING.md`](RELEASING.md).

## Status

Published: [`@tforgach/axi-fetch`](https://www.npmjs.com/package/@tforgach/axi-fetch)
(v0.3.0, MIT). Core is working end-to-end (fetch → detect → extract → TOON) with a
benchmark harness and CI.
