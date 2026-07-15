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
│   ├── core/     @travis/axi-fetch — the CLI + extraction library
│   └── skill/    Claude Code skill (SKILL.md) that shells out to the CLI
```

## Quick start

```sh
# Requires Node 20+
corepack enable pnpm
pnpm install
pnpm --filter @travis/axi-fetch build

# Run the CLI
node packages/core/dist/cli.js https://en.wikipedia.org/wiki/Token_bucket
```

## CLI

```
axi-fetch <url> [flags]

--full            Return full content (skip truncation)
--no-links        Omit outbound links
--timeout <ms>    Network timeout (default 10000)
--max <chars>     Truncate content to N chars (default 1500)
```

## Library

```ts
import { axiFetch } from "@travis/axi-fetch";

const { axiResponse, toonOutput } = await axiFetch("https://example.com/article");
console.log(toonOutput);      // TOON string (agent-facing)
console.log(axiResponse.type); // "article" | "generic"
```

## Pipeline

```
URL → fetch (native) → detect type (rules) → extract (Readability / cheerio)
    → truncate + next-steps → TOON encode
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
| MVP page types | `article` + `generic` fallback |
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
shows up on structured data (code blocks, tables) more than prose — which is why
lifting those out into structured fields raised the format-only win. See
[ROADMAP.md](./ROADMAP.md). On trivially small pages the fixed metadata overhead
can make output net-larger — a documented tradeoff (addressed on the roadmap).

## Status

MVP core is working end-to-end (fetch → detect → extract → TOON), with a
benchmark harness. Not yet published to npm. See [ROADMAP.md](./ROADMAP.md) for
prioritized next steps.
