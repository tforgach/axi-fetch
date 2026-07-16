# axi-fetch roadmap

Optimizations and improvements, prioritized and grounded in the first benchmark
run (`packages/bench/results/report.md`). MVP core (fetch → detect → extract →
truncate → TOON) is working; this is what comes next and why.

## What the benchmark told us

Median savings across 6 pages (o200k / GPT-4o tokenizer):

| Comparison | Median | What it isolates |
|---|--:|---|
| TOON vs raw HTML | **97%** | naive baseline — nobody feeds raw HTML, so this is a ceiling, not a claim |
| TOON (default) vs readable markdown | **81.2%** | end-to-end product win: extraction + truncation + format |
| TOON (--full) vs readable markdown | **45.1%** | extraction + format, truncation removed |

> Update: structured content (code blocks + tables) has since shipped, raising
> the format-only median from 38.2% → 45.1% (biggest gains on code-heavy docs
> pages). The remaining findings below still stand.

Three findings drive the priorities below:

1. **Most of the win is extraction + truncation, not TOON itself.** On prose-heavy
   pages the `--full` format-only win is modest (7.8% on the Python tutorial),
   because our payload is essentially *one big text string* — and TOON's ~40%
   advantage comes from *tabular/repeated* data, not prose blobs. To actually
   cash in TOON's structural advantage we need to emit more structure (sections
   with text, code blocks, tables) instead of a single `content` string.
2. **Fixed metadata overhead hurts small pages.** `example.com` (29 md tokens)
   came out **−376%** — the envelope (`url,title,type,confidence,fetchedAt,
   contentLength,help…`) dwarfs the content. There's a floor below which the AXI
   envelope isn't worth it.
3. **Generic detection is coarse.** The Python docs pages fell back to `generic`
   (no `og:type`); a `documentation` type with code/section awareness would both
   improve output and raise the format win.

---

## P0 — Quick wins (low effort, directly from findings)

- **Trim the envelope.** Drop or gate low-value fields: `fetchedAt` is rarely
  actionable for an agent; `confidence` could move behind a `--debug`/`--verbose`
  flag. Every field is paid per response (AXI principle 2). *(addresses finding 2)*
- **Small-page floor.** When extracted content is below a threshold (e.g. < ~200
  chars), skip truncation hints and emit a leaner envelope so tiny pages never go
  net-negative. *(finding 2)*
- **Fix the mean→median story in reporting** ✅ done, but add **min/max/median**
  to CSV too and a per-run timestamp for tracking regressions over time.

## P1 — Extraction quality & structure (the real lever)

- ✅ **Emit structured content, not one blob.** `codeBlocks[]{language,code}` and
  `tables[]{headers,rows[]}` now lifted out of the prose. *(finding 1 — shipped)*
- ✅ **Code-block extraction** (`<pre>`, fenced), indentation preserved,
  language inferred from class hints. *(shipped)*
- ✅ **Apply prose cleanup to the generic path** — generic now shares the
  article path's structured extraction (no more raw `.text()` gluing). *(shipped)*
- **Sectioned prose**: attach text to each `Section` (`{heading,level,text}`) so
  the outline carries content, not just labels. Enables per-section truncation.
- ✅ **`documentation` page type + extractor** — detected via docs.*/developer.*
  hosts, `/docs//reference//api/` paths, and code-heavy content. *(finding 3 — shipped)*
- **Better link selection**: rank by prominence/position instead of first-N;
  dedupe near-identical anchors.

## P1 — Correctness & robustness

- ✅ **Follow HTML `<meta http-equiv="refresh">` redirects** (up to 3 hops). *(shipped)*
- ✅ **Charset/encoding handling** — decode by `content-type` / `<meta charset>`
  instead of assuming UTF-8. *(shipped)*
- ✅ **Retry/backoff** on transient network errors and 429/5xx. *(shipped)*
- ✅ **Bot-block awareness** — 401/403 surface a distinct `FORBIDDEN` error with
  an actionable message. *(shipped)*

## P2 — Bigger features

- ✅ **Caching layer** — on-disk cache (`~/.cache/axi-fetch`) keyed by URL with a
  15-min TTL and `--no-cache`. *(shipped)* Follow-up: conditional requests
  (ETag/Last-Modified) to revalidate instead of hard-expiring.
- **JS rendering** (Playwright) behind an opt-in `--render` flag for SPA/dynamic
  pages — Phase-2 in the plan. *(deferred — heavy dep + browser install)*
- **More page types**: `pricing`, `product` (tables/lists — strong TOON fit).
- **Sitemap / multi-page** fetch for docs sets.

## Testing, CI & benchmarking

- ✅ **CI workflow** — build + typecheck + `vitest run` on push/PR under Node 20. *(shipped)*
- **Fixture-based extractor tests** using saved HTML snapshots (deterministic,
  offline) alongside the current unit tests.
- **Opt-in live integration suite** (network-gated, not in default `test`).
- **Expand the benchmark set** (news, product, pricing, blog) and add a
  **regression gate** that fails if median savings drop.
- **Real agent-task benchmark** (à la the reference `bench-github`/`bench-browser`):
  measure end-to-end *agent* token usage on tasks, not just payload size — the
  most credible number for the write-up.

## Publishing & polish

- **Publish via GitHub Packages** — no separate npm account needed initially.
  Scope the package to the GitHub owner (`@tforgach/axi-fetch`), set
  `publishConfig.registry = https://npm.pkg.github.com`, and publish straight
  from CI with the built-in `GITHUB_TOKEN` (a release workflow on tag/release).
  Consumers add an `.npmrc` line pointing `@tforgach:registry` at GitHub Packages.
  Can still cross-publish to the public npm registry later.
- README badges, versioning (consider `release-please`), CHANGELOG.
- Package and document the Claude Code skill end-to-end.
- Write-up: "How I cut agent token usage by ~80% vs a reader tool" using the
  benchmark data (lead with median, show the small-page caveat honestly).

---

## Suggested next sprint

1. P0 envelope trim + small-page floor (fast, removes the embarrassing −376%).
2. P1 structured content + code blocks (unlocks TOON's real advantage; re-benchmark).
3. CI workflow so the above stays green.
