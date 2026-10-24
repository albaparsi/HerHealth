// Elastic Agent Builder: the "HerHealth tutor" agent answers learners' questions from the indexed sources.
// scripts/agent.ts creates the agent and its search tool; this file talks to it.

export const AGENT_ID = "herhealth-tutor";
export const TOOL_ID = "herhealth.search_sources";

/** Kibana's URL: KIBANA_URL if set, otherwise derived from the Elasticsearch endpoint (".es." becomes ".kb."). */
export function kibanaUrl() {
  const explicit = process.env.KIBANA_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const es = process.env.ELASTIC_URL;
  if (!es || !es.includes(".es.")) return null;
  return es
    .replace(".es.", ".kb.")
    .replace(/:443\/?$/, "")
    .replace(/\/$/, "");
}

export function kibanaHeaders() {
  return {
    Authorization: `ApiKey ${process.env.KIBANA_API_KEY ?? process.env.ELASTIC_API_KEY}`,
    "kbn-xsrf": "true",
    "Content-Type": "application/json",
  };
}

type Source = { org: string; url: string; title: string };

/** Every {title, url, org} row in the agent's tool results, from either object rows or ES|QL columns/values. */
function sourcesIn(steps: unknown): Source[] {
  const found: Source[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(walk);
    const o = node as Record<string, unknown>;
    if (typeof o.url === "string" && typeof o.org === "string") {
      found.push({ org: o.org, url: o.url, title: typeof o.title === "string" ? o.title : o.org });
    }
    if (Array.isArray(o.columns) && Array.isArray(o.values)) {
      const names = (o.columns as { name: string }[]).map((c) => c.name);
      for (const row of o.values as unknown[][]) {
        const get = (n: string) => row[names.indexOf(n)];
        if (typeof get("url") === "string" && typeof get("org") === "string") {
          found.push({
            org: get("org") as string,
            url: get("url") as string,
            title: String(get("title") ?? get("org")),
          });
        }
      }
    }
    Object.values(o).forEach(walk);
  };
  walk(steps);
  return found.filter((s, i) => found.findIndex((t) => t.url === s.url) === i).slice(0, 3);
}

/** Asks the Agent Builder agent. Returns null if the agent isn't set up or fails, so the caller can fall back. */
export async function askAgent(input: string) {
  const kibana = kibanaUrl();
  if (!kibana || process.env.USE_AGENT_BUILDER === "false") return null;
  try {
    const res = await fetch(`${kibana}/api/agent_builder/converse`, {
      method: "POST",
      headers: kibanaHeaders(),
      body: JSON.stringify({ agent_id: AGENT_ID, input }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      console.log(`askAgent: ${res.status} ${(await res.text()).slice(0, 300)}`);
      return null;
    }
    const data = await res.json();
    const answer: string | undefined = data?.response?.message?.trim();
    if (!answer || data.status !== "completed") return null;
    return { answer, sources: sourcesIn(data.steps) };
  } catch (e) {
    console.log(`askAgent failed: ${e}`);
    return null;
  }
}
