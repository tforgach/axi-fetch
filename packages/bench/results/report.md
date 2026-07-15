# axi-fetch token-savings benchmark

Token counts via tiktoken (a standard proxy; Claude's tokenizer differs but format *ratios* track closely). 6 pages.

- **vs raw**: default TOON output vs the raw fetched HTML (the naive baseline).
- **vs md**: default TOON (truncated to 1500 chars) vs Readability→markdown (a strong reader-tool baseline). End-to-end product win: extraction + truncation + format.
- **full vs md**: `--full` TOON (no truncation) vs markdown — extraction + format win, truncation removed.

| URL | type | raw HTML | readable md | TOON | TOON --full | vs raw | vs md | format-only vs md |
|---|---|--:|--:|--:|--:|--:|--:|--:|
| en.wikipedia.org/wiki/Napoleon | article | 609652 | 99969 | 758 | 33009 | 99.9% | 99.2% | 67% |
| en.wikipedia.org/wiki/Token_bucket | article | 30932 | 3327 | 517 | 1863 | 98.3% | 84.5% | 44% |
| en.wikipedia.org/wiki/Rate_limiting | article | 25798 | 2364 | 524 | 1208 | 98% | 77.8% | 48.9% |
| docs.python.org/3/tutorial/introduction.html | generic | 21924 | 5201 | 1489 | 3497 | 93.2% | 71.4% | 32.8% |
| docs.python.org/3/library/asyncio-task.html | generic | 50024 | 14264 | 2067 | 7674 | 95.9% | 85.5% | 46.2% |
| example.com | generic | 162 | 29 | 137 | 137 | 15.4% | -372.4% | -372.4% |

## Aggregate

Median leads (robust to outliers like trivially small pages where fixed metadata overhead dominates).

| Metric | Median | Mean | Range |
|---|--:|--:|--:|
| TOON vs raw HTML | **97%** | 83.4% | 15.4% → 99.9% |
| TOON (default) vs readable markdown | **81.2%** | 7.7% | -372.4% → 99.2% |
| TOON (--full) vs readable markdown | **45.1%** | -22.2% | -372.4% → 67% |

