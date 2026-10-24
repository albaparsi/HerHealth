// Semantic search check. Usage: npm run search -- "heart attack symptoms women jaw" [condition]
import { INDEX, elasticClient } from "./elastic";

type Doc = { condition: string; title: string; url: string; org: string; passage: string };

async function main() {
  const [query = "heart attack symptoms women jaw", condition] = process.argv.slice(2);
  const es = elasticClient();
  const res = await es.search<Doc>({
    index: INDEX,
    size: 5,
    query: {
      bool: {
        must: { semantic: { field: "passage", query } },
        ...(condition ? { filter: { term: { condition } } } : {}),
      },
    },
  });
  for (const hit of res.hits.hits) {
    const d = hit._source!;
    console.log(`\n[${hit._score?.toFixed(2)}] ${d.org}: ${d.title}\n${d.url}`);
    console.log(typeof d.passage === "string" ? d.passage.slice(0, 400) : d.passage);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
