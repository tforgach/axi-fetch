# axi-fetch roadmap

Optimizations and improvements, prioritized and grounded in the first benchmark
run (`packages/bench/results/report.md`). MVP core (fetch → detect → extract →
truncate → TOON) is working; this is what comes next and why.

## What the benchmark told us

Median savings across 6 pages (tiktoken proxy):

| Comparison | Median | What it isolates |
|---|--:|---|
| TOON vs raw HTML | **98.2%** | naive baseline — nobody feeds raw HTML, so this is a ceiling, not a claim |
| TOON (default) vs readable markdown | **85.9%** | end-to-end product win: extraction + truncation + format |
| TOON (--full) vs readable markdown | **38.2%** | extraction + format, truncation removed |

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

- **Emit structured content, not one blob.** Return `sections[]` *with text*,
  `codeBlocks[]{language,code}`, and `tables[]{headers,rows[]}`. This is where
  TOON's token advantage actually materializes, and it's more useful to agents.
  *(finding 1 — highest-leverage item on this list)*
- **Code-block extraction** (`<pre>`/`<code>`, fenced): critical for docs pages
  like the asyncio reference; currently flattened into prose.
- **`documentation` page type + extractor**: heading hierarchy + code + tables,
  detected via URL (`/docs/`, `docs.*`), nav structure, and content signals.
  *(finding 3)*
- **Apply prose cleanup to the generic path.** The article path strips
  infoboxes/citations/tables via `extractProse`; generic still uses raw
  `.text()` and can glue words / keep boilerplate. Unify carefully (generic
  tables are sometimes the content).
- **Better link selection**: rank by prominence/position instead of first-N;
  dedupe near-identical anchors.

## P1 — Correctness & robustness

- **Follow HTML `<meta http-equiv="refresh">` redirects** (native `fetch` only
  follows HTTP 3xx — the Rust blog stub exposed this).
- **Charset/encoding handling** for non-UTF-8 pages (respect `content-type`
  charset / `<meta charset>`).
- **Retry/backoff** on transient network errors; clearer `HTTP_ERROR` bodies.
- **Bot-block awareness**: detect 403/challenge pages and surface an actionable
  structured error (some sites, e.g. LeetCode, block automated fetches).

## P2 — Bigger features

- **Caching layer** (LRU + conditional requests via ETag/Last-Modified) to avoid
  refetching within a session.
- **JS rendering** (Playwright) behind an opt-in `--render` flag for SPA/dynamic
  pages — Phase-2 in the plan.
- **More page types**: `pricing`, `product` (tables/lists — strong TOON fit).
- **Sitemap / multi-page** fetch for docs sets.

## Testing, CI & benchmarking

- **Fixture-based extractor tests** using saved HTML snapshots (deterministic,
  offline) alongside the current unit tests.
- **Opt-in live integration suite** (network-gated, not in default `test`).
- **CI workflow**: build + `vitest run` on push/PR (adapt the reference repo's
  `axi-sdk-js-ci.yml`).
- **Expand the benchmark set** (news, product, pricing, blog) and add a
  **regression gate** that fails if median savings drop.
- **Real agent-task benchmark** (à la the reference `bench-github`/`bench-browser`):
  measure end-to-end *agent* token usage on tasks, not just payload size — the
  most credible number for the write-up.

## Publishing & polish

- Create the npm org/account; publish `@travis/axi-fetch` + the skill package.
- README badges, versioning (consider `release-please`), CHANGELOG.
- Package and document the Claude Code skill end-to-end.
- Write-up: "How I cut agent token usage by ~85% vs a reader tool" using the
  benchmark data (lead with median, show the small-page caveat honestly).

---

## Suggested next sprint

1. P0 envelope trim + small-page floor (fast, removes the embarrassing −376%).
2. P1 structured content + code blocks (unlocks TOON's real advantage; re-benchmark).
3. CI workflow so the above stays green.
