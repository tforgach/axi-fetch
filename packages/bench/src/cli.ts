import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { aggregate, toCsv, toMarkdown } from "./reporter.js";
import { benchUrls } from "./runner.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

async function main(): Promise<void> {
  const configPath = join(packageRoot, "config", "urls.json");
  const urls = JSON.parse(await readFile(configPath, "utf8")) as string[];

  process.stderr.write(`Benchmarking ${urls.length} URLs...\n`);
  const rows = await benchUrls(urls);
  const agg = aggregate(rows);

  const resultsDir = join(packageRoot, "results");
  await mkdir(resultsDir, { recursive: true });
  await writeFile(join(resultsDir, "report.csv"), toCsv(rows));
  await writeFile(
    join(resultsDir, "results.jsonl"),
    rows.map((r) => JSON.stringify(r)).join("\n") + "\n",
  );
  const markdown = toMarkdown(rows, agg);
  await writeFile(join(resultsDir, "report.md"), markdown);

  process.stdout.write("\n" + markdown + "\n");
}

main().catch((error) => {
  process.stderr.write(`Benchmark failed: ${error}\n`);
  process.exit(1);
});
