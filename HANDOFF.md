# axi-fetch — owner handoff

Snapshot of where the project stands, what was built, and what's next. Read this
first when you come back.

## TL;DR

- **Working, committed, all green.** 17 unit tests pass; MVP core runs end-to-end.
- **Not published** (by request). Publishing is designed but deferred — see below.
- **Repo:** `github.com/tforgach/axi-fetch` (private), branch `main`, 6 commits.
- Latest benchmark (o200k / GPT-4o tokenizer, 6 pages): **median 97% fewer
  tokens vs raw HTML, 81.2% vs a readable-markdown reader tool, 45.1%
  format-only** (no truncation). Details in `packages/bench/results/report.md`.
- **One loose end:** the working tree has your local edit to `README.md`
  (benchmark section still shows the earlier cl100k numbers). `ROADMAP.md` and
  `packages/bench/results/` carry the current o200k numbers — reconcile whenever
  you finalize the writeup.

## What it is

A token-efficient web fetcher for AI agents. Instead of feeding an agent raw
HTML (or even clean markdown), `axi-fetch <url>` returns a compact, structured
**TOON** response following **AXI** (Agent eXperience Interface) principles. It's
a CLI (agents call it via shell) built on the published `axi-sdk-js`, which gives
us TOON encoding, structured errors, exit codes, and a self-update command for
free.

## Codebase map

```
axi-fetch/                     pnpm monorepo (Node 20+)
├── packages/core/             @travis/axi-fetch — the CLI + extraction library
│   └── src/
│       ├── cli.ts             runAxiCli() wiring; arg/flag parsing; URL→fetch dispatch
│       ├── index.ts           axiFetch(url) and extractFromHtml(html,url) — the pipeline
│       ├── fetcher.ts         native fetch: URL validation, timeout, structured errors
│       ├── typeDetector.ts    rules-based article vs generic (no LLM)
│       ├── extractors/
│       │   ├── shared.ts      prose/sections/links/codeBlocks/tables helpers (the core logic)
│       │   ├── article.ts     Mozilla Readability (on jsdom) → structured content
│       │   └── generic.ts     de-noise + same structured pipeline (fallback)
│       ├── output.ts          AxiResponse → TOON structure (envelope shaping)
│       └── types.ts           the AXI schema (Content, Metadata, CodeBlock, Table, …)
├── packages/bench/            @travis/axi-fetch-bench — token-savings benchmark
│   ├── src/{tokens,baselines,runner,reporter,cli}.ts
│   ├── config/urls.json       the URL set
│   └── results/               report.md / report.csv / results.jsonl (committed)
├── packages/skill/            Claude Code skill (SKILL.md) that shells out to the CLI
├── ROADMAP.md                 prioritized next steps (data-informed)
└── HANDOFF.md                 this file
```

Core is ~1,340 lines of TS. **`extractors/shared.ts` is the heart** — if you
touch extraction quality, start there.

## The pipeline

```
URL → fetcher (native fetch, timeout, redirects) → typeDetector (rules)
    → extract (Readability for articles / cheerio for generic)
    → lift structured blocks (sections, codeBlocks, tables, links)
    → truncate prose to maxContentLength → build next-steps → TOON encode
```

`extractFromHtml(html, url, options)` runs everything after the fetch, so you can
feed it saved HTML (used by the benchmark and handy for tests/offline work).

## Optimizations & improvements added this session

Each was verified against live pages and, where relevant, the benchmark.

1. **AXI CLI on `axi-sdk-js`** — chose CLI-first (agents invoke via shell) over a
   plain library, matching the reference AXI project (`kunchenguid/axi`). Free
   TOON output, structured errors, exit codes (2 = bad input, 1 = other), and an
   `update` command.
2. **Extraction-quality fixes** (from real Wikipedia output):
   - **De-glued prose** — read block-by-block instead of Readability's
     separator-less `textContent` (killed `"NapoleonThe Emperor"` bugs).
   - **Stripped infoboxes, data tables, citation markers** (`[1]`, `[b]`) and
     edit links from the prose.
   - **Filtered junk links** — footnote markers and same-page `#cite` anchors
     no longer crowd out real body links.
3. **`extractFromHtml` refactor** — split fetch from extraction so the same HTML
   can be run through every code path (deterministic benchmarking).
4. **Benchmark harness** — fetch each URL once, then token-count raw HTML,
   readable markdown (Readability→turndown), default TOON, and `--full` TOON.
   Median-led aggregates (robust to outliers). Switched to the **o200k** (GPT-4o)
   tokenizer.
5. **Structured content (code blocks + tables)** — the highest-leverage change.
   Lifted `codeBlocks[]{language,code}` and `tables[]{headers,rows}` out of the
   prose, where TOON's format advantage actually lands. Raised the format-only
   median **38.2% → 45.1%** (biggest gains on code-heavy docs pages, which now
   include their code instead of dropping it). Also unified the generic path onto
   this pipeline.
6. **P0 envelope trim** — dropped `fetchedAt` from output, omit `truncated` when
   false, and emit a bare envelope for trivially small pages. Cuts the fixed
   per-response overhead that made tiny pages go net-negative vs markdown.

## How to run it

**Node 20 is required** (the SDK needs ≥20; native fetch on Node 18 crashes).
Node 20 is installed via Homebrew and set as default in your `~/.zshrc`
(`/opt/homebrew/opt/node@20/bin`). New terminals get `node -v` = 20.

```sh
corepack enable pnpm          # pnpm 9.15.9 (pinned; pnpm 11 needs newer Node)
pnpm install
pnpm build                    # build all packages
pnpm test                     # 17 tests
pnpm bench                    # re-run the benchmark → packages/bench/results/

# CLI (globally linked via `npm link` earlier):
axi-fetch https://en.wikipedia.org/wiki/Napoleon
axi-fetch example.com --full --no-links --timeout 20000 --max 3000
```

After editing core source, rebuild so the global `axi-fetch` picks it up:
`pnpm --filter @travis/axi-fetch build`.

## Key decisions & rationale

- **CLI-first on `axi-sdk-js`** (vs library-first from the original plan) — the
  reference AXI project treats AXI as shell-invoked CLIs; reuses maintained
  plumbing. The `axiFetch()` library API still exists underneath.
- **jsdom** added (not in the plan) — Mozilla Readability needs a real DOM;
  cheerio isn't one. cheerio is still used for detection + generic extraction.
- **`@toon-format/toon` imported directly** — the SDK does not re-export its
  output helpers, so we encode ourselves.
- **Publish via GitHub Packages** — no separate npm account needed; scope
  `@tforgach`, registry `npm.pkg.github.com`, publish from CI with `GITHUB_TOKEN`.
  (Deferred — do NOT publish yet.)

## Known limitations / gotchas

- **Meta-refresh redirects not followed** — native fetch only follows HTTP 3xx,
  not `<meta http-equiv=refresh>` (e.g. the Rust blog served a redirect stub).
  On the roadmap.
- **UTF-8 assumed** — non-UTF-8 pages aren't decoded by charset yet.
- **Bot blocks** — sites like LeetCode return 403; surfaced as a clean structured
  error, but no bypass (nor should there be).
- **Small-page overhead** — sub-~30-token pages can still be net-larger than
  markdown; structure genuinely doesn't help there (documented tradeoff).
- **README vs ROADMAP numbers** — see the loose end in the TL;DR.

## What's next (paused here, ready to resume)

From `ROADMAP.md`, in priority order. P0 is done; these are queued:

| # | Item | Priority |
|---|---|---|
| 10 | `documentation` page type (docs.* / `/docs/` / code-heavy detection) | P1 |
| 11 | Follow meta-refresh redirects + honor charset | P1 |
| 12 | Retry transient errors + clearer bot-block error | P1 |
| 13 | Disk response cache with TTL + `--no-cache` | P2 |
| 14 | CI workflow (build + vitest on push/PR, Node 20) | infra |
| — | Sectioned prose (`{heading,level,text}`), pricing/product types | P1/P2 |
| — | JS rendering via Playwright (heavy; opt-in `--render`) | P2, deferred |
| — | Publish to GitHub Packages + writeup | when you're ready |

Say the word and I'll continue down this list, committing each as a unit.

## Commit history (this session)

```
92293e5 roadmap: publish via GitHub Packages
7fe1611 P0: trim the response envelope
7a71c0b Benchmark on o200k tokenizer + refresh results
2688c03 Extract code blocks and tables as structured content
1b366c0 Add token-savings benchmark harness + roadmap
112ad15 Initial commit: axi-fetch MVP core
```
