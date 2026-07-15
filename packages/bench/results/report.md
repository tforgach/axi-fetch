# axi-fetch token-savings benchmark

Token counts via tiktoken (a standard proxy; Claude's tokenizer differs but format *ratios* track closely). 6 pages.

- **vs raw**: default TOON output vs the raw fetched HTML (the naive baseline).
- **vs md**: default TOON (truncated to 1500 chars) vs Readability→markdown (a strong reader-tool baseline). End-to-end product win: extraction + truncation + format.
- **full vs md**: `--full` TOON (no truncation) vs markdown — extraction + format win, truncation removed.

| URL | type | raw HTML | readable md | TOON | TOON --full | vs raw | vs md | format-only vs md |
|---|---|--:|--:|--:|--:|--:|--:|--:|
| en.wikipedia.org/wiki/Napoleon | article | 608034 | 100444 | 765 | 33297 | 99.9% | 99.2% | 66.9% |
| en.wikipedia.org/wiki/Token_bucket | article | 30955 | 3331 | 517 | 1865 | 98.3% | 84.5% | 44% |
| en.wikipedia.org/wiki/Rate_limiting | article | 25722 | 2383 | 525 | 1217 | 98% | 78% | 48.9% |
| docs.python.org/3/tutorial/introduction.html | generic | 21776 | 5192 | 658 | 4785 | 97% | 87.3% | 7.8% |
| docs.python.org/3/library/asyncio-task.html | generic | 49916 | 14019 | 726 | 9478 | 98.5% | 94.8% | 32.4% |
| example.com | generic | 162 | 29 | 138 | 138 | 14.8% | -375.9% | -375.9% |

## Aggregate

Median leads (robust to outliers like trivially small pages where fixed metadata overhead dominates).

| Metric | Median | Mean | Range |
|---|--:|--:|--:|
| TOON vs raw HTML | **98.2%** | 84.4% | 14.8% → 99.9% |
| TOON (default) vs readable markdown | **85.9%** | 11.3% | -375.9% → 99.2% |
| TOON (--full) vs readable markdown | **38.2%** | -29.3% | -375.9% → 66.9% |

