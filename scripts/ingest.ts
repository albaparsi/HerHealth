// Fetches every page in data/sources.json, splits it into ~150-word passages and indexes
// them into Elastic. Usage: npm run ingest  (add --reset to drop and recreate the index)
import { readFile } from "node:fs/promises";
import * as cheerio from "cheerio";
import { INDEX, elasticClient } from "./elastic";

type Source = { condition: string; title: string; url: string; org: string };

const WORDS_PER_PASSAGE = 150;

function extractText(html: string) {
  const $ = cheerio.load(html);
  $("script, style, noscript, nav, header, footer, aside, form, iframe, svg").remove();
  $("[role=navigation], [aria-hidden=true], .breadcrumb, .sidebar").remove();
  const root = $("main").first().length ? $("main").first() : $("article").first().length ? $("article").first() : $("body");
  // Keep paragraph boundaries so passages split on sentences, not mid-list.
  const blocks = root
    .find("p, li, h1, h2, h3, h4, td")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter((t) => t.split(" ").length >= 4);
  return [...new Set(blocks)];
}

function toPassages(blocks: string[]) {
  const passages: string[] = [];
  let current: string[] = [];
  let count = 0;
  for (const block of blocks) {
    const n = block.split(" ").length;
    if (count + n > WORDS_PER_PASSAGE && count > 0) {
      passages.push(current.join("\n"));
      current = [];
      count = 0;
    }
    current.push(block);
    count += n;
  }
  if (count > 20) passages.push(current.join("\n"));
  return passages;
}

async function main() {
  const es = elasticClient();
  const sources: Source[] = JSON.parse(await readFile("data/sources.json", "utf8"));

  if (process.argv.includes("--reset") && (await es.indices.exists({ index: INDEX }))) {
    await es.indices.delete({ index: INDEX });
    console.log(`Deleted index ${INDEX}`);
  }
  if (!(await es.indices.exists({ index: INDEX }))) {
    await es.indices.create({
      index: INDEX,
      mappings: {
        properties: {
          condition: { type: "keyword" },
          title: { type: "text" },
          url: { type: "keyword" },
          org: { type: "keyword" },
          passage: { type: "semantic_text" },
        },
      },
    });
    console.log(`Created index ${INDEX}`);
  }

  const counts: Record<string, number> = {};
  const failed: string[] = [];

  for (const src of sources) {
    try {
      const res = await fetch(src.url, {
        // Browser-like headers: some sources (heart.org) reject non-browser user agents.
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const passages = toPassages(extractText(await res.text()));
      if (passages.length === 0) throw new Error("no text extracted");

      // Stable ids so re-running replaces passages instead of duplicating them.
      const operations = passages.flatMap((passage, i) => [
        { index: { _index: INDEX, _id: `${src.url}#${i}` } },
        { ...src, passage },
      ]);
      const result = await es.bulk({ operations, refresh: true });
      if (result.errors) {
        const first = result.items.find((it) => it.index?.error)?.index?.error;
        throw new Error(`bulk errors: ${JSON.stringify(first)}`);
      }
      counts[src.condition] = (counts[src.condition] ?? 0) + passages.length;
      console.log(`  ✓ ${passages.length} passages  ${src.org}: ${src.title}`);
    } catch (err) {
      failed.push(`${src.url} (${(err as Error).message})`);
      console.log(`  ✗ ${src.org}: ${src.title}: ${(err as Error).message}`);
    }
  }

  console.log("\nPassages indexed per condition:");
  for (const [condition, n] of Object.entries(counts)) console.log(`  ${condition}: ${n}`);
  if (failed.length) {
    console.log(`\n${failed.length} source(s) failed; fix or replace them in data/sources.json:`);
    for (const f of failed) console.log(`  ${f}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
