---
name: axi-fetch
description: >
  Fetch a web page and get a compact, token-efficient TOON response instead of raw
  HTML. Use whenever the user asks to look something up, read, check, or fetch a URL
  or web page — prefer this over a raw web fetch to save tokens.
---

# axi-fetch

`axi-fetch` fetches a URL, extracts the meaningful content (article body or a
readability fallback), and prints it as [TOON](https://toonformat.dev/) — a
token-oriented format ~40% smaller than JSON. Use it in place of a raw web fetch
when you need the *content* of a page, not a full DOM.

## Usage

`axi-fetch` is already installed and on your PATH. Run it directly in Bash (not via `npx` or a path):

```sh
axi-fetch <url>                                   # title, opening content (3000 chars), sections
axi-fetch <url> --find "<keywords>"               # only the passages matching the keywords
axi-fetch <url> --section "<heading>"             # one section from the sections list
axi-fetch <url> --full [--page 2]                 # everything, in 16k-char pages
```

**Looking for a specific fact? Pass `--find` on the first call.** It returns just the matching
passages (with their section), so you rarely need a second call. Other flags: `--links` (outbound
links), `--code` (code blocks), `--max <chars>`, `--timeout <ms>`, `--no-cache`.

## Output

TOON on stdout, e.g. for `axi-fetch https://en.wikipedia.org/wiki/Token_bucket --find "leaky bucket meter"`:

```
url: "https://en.wikipedia.org/wiki/Token_bucket"
title: Token bucket
type: article
contentLength: 7799
passages[2]{section,text}:
  Comparison to leaky bucket,"The leaky bucket algorithm … used as a meter, is exactly equivalent to (a mirror image of) the token bucket …"
  …
```

- Without `--find`, `truncated: true` means the opening content was cut: use `--find` or `--section`.
- `help` lists next steps (e.g. `--page 2`, omitted code blocks).

## Errors

Failures print a structured error and use a non-zero exit code (2 for bad
input/flags, 1 otherwise):

```
error: "HTTP 404 Not Found for https://example.com/missing"
code: HTTP_ERROR
```
