#!/usr/bin/env node
import { AxiError, runAxiCli } from "axi-sdk-js";
import { axiFetch } from "./index.js";
import { toStructured, type AxiStructuredOutput } from "./output.js";
import type { AxiFetchOptions } from "./types.js";

const VERSION = "0.1.0";
const DESCRIPTION =
  "Fetch a URL and get a token-efficient, agent-ready TOON response";

// Commands the SDK dispatches directly. Anything else in first position that
// isn't a flag is treated as a URL for the implicit `fetch` command.
const KNOWN_COMMANDS = new Set(["fetch", "update", "help"]);

const TOP_LEVEL_HELP = [
  `axi-fetch — ${DESCRIPTION}`,
  "",
  "Usage:",
  "  axi-fetch <url> [flags]",
  "  axi-fetch fetch <url> [flags]",
  "",
  "Flags:",
  "  --full            Return full content (skip truncation)",
  "  --no-links        Omit outbound links",
  "  --timeout <ms>    Network timeout in milliseconds (default 10000)",
  "  --max <chars>     Truncate content to N chars (default 1500)",
  "",
  "Examples:",
  "  axi-fetch https://example.com/article",
  "  axi-fetch example.com --full --no-links",
].join("\n");

const FETCH_HELP = [
  "axi-fetch <url> — fetch and extract a page as TOON",
  "",
  "Flags: --full, --no-links, --timeout <ms>, --max <chars>",
].join("\n");

interface ParsedFetchArgs {
  url: string;
  options: AxiFetchOptions;
}

function readNumber(flag: string, value: string | undefined): number {
  const parsed = Number(value);
  if (value === undefined || Number.isNaN(parsed) || parsed <= 0) {
    throw new AxiError(
      `Flag ${flag} requires a positive number`,
      "VALIDATION_ERROR",
    );
  }
  return parsed;
}

function parseFetchArgs(args: string[]): ParsedFetchArgs {
  let url: string | undefined;
  const options: AxiFetchOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;

    if (!arg.startsWith("-")) {
      if (url !== undefined) {
        throw new AxiError(`Unexpected argument: ${arg}`, "VALIDATION_ERROR");
      }
      url = arg;
      continue;
    }

    const eq = arg.indexOf("=");
    const flag = eq === -1 ? arg : arg.slice(0, eq);
    const inlineValue = eq === -1 ? undefined : arg.slice(eq + 1);
    const takeValue = () => inlineValue ?? args[++i];

    switch (flag) {
      case "--full":
        options.full = true;
        break;
      case "--no-links":
        options.includeLinks = false;
        break;
      case "--timeout":
        options.timeout = readNumber(flag, takeValue());
        break;
      case "--max":
        options.maxContentLength = readNumber(flag, takeValue());
        break;
      default:
        throw new AxiError(`Unknown flag: ${flag}`, "VALIDATION_ERROR", [
          "Run `axi-fetch --help` to see supported flags",
        ]);
    }
  }

  if (!url) {
    throw new AxiError("Missing URL argument", "VALIDATION_ERROR", [
      "Usage: axi-fetch <url> [--full] [--no-links] [--timeout <ms>] [--max <chars>]",
    ]);
  }

  return { url, options };
}

async function fetchCommand(args: string[]): Promise<AxiStructuredOutput> {
  const { url, options } = parseFetchArgs(args);
  const { axiResponse } = await axiFetch(url, options);
  return toStructured(axiResponse);
}

/** Treat a leading positional (a URL) as an implicit `fetch` command. */
function normalizeArgv(argv: string[]): string[] {
  const first = argv[0];
  if (first && !first.startsWith("-") && !KNOWN_COMMANDS.has(first)) {
    return ["fetch", ...argv];
  }
  return argv;
}

await runAxiCli({
  description: DESCRIPTION,
  version: VERSION,
  argv: normalizeArgv(process.argv.slice(2)),
  topLevelHelp: TOP_LEVEL_HELP,
  commands: { fetch: fetchCommand },
  home: () => ({
    description: DESCRIPTION,
    usage: "axi-fetch <url> [--full] [--no-links] [--timeout <ms>] [--max <chars>]",
    example: "axi-fetch https://example.com/article",
    help: ["Run `axi-fetch --help` for the full reference"],
  }),
  getCommandHelp: (command) => (command === "fetch" ? FETCH_HELP : null),
});
