// Creates (or updates) the Elastic Agent Builder tutor and its source-search tool. Usage: npm run agent [-- "test question"]
import { AGENT_ID, TOOL_ID, kibanaHeaders, kibanaUrl } from "../convex/agent";
import { INDEX } from "./elastic";

const TOOL = {
  type: "esql",
  description:
    "Searches HerHealth's index of trusted medical sources (CDC, NIH, MedlinePlus, womenshealth.gov, ACOG and others) for passages about one condition. Returns the title, url, org and passage text.",
  configuration: {
    query: `FROM ${INDEX} METADATA _score | WHERE condition == ?condition AND MATCH(passage, ?question) | SORT _score DESC | LIMIT 5 | KEEP title, url, org, passage`,
    params: {
      condition: {
        type: "keyword",
        description: "The lesson's condition id: heart-attack, endometriosis or adhd",
      },
      question: { type: "text", description: "What to search for, in plain words" },
    },
  },
  tags: ["herhealth"],
};

const INSTRUCTIONS = `You are the teacher in HerHealth, an app that teaches how health conditions can show up differently in women. Learners ask you questions out loud during a lesson, and your answer is spoken in your voice.

Every message starts with the lesson's condition id in brackets, for example [condition: heart-attack], sometimes followed by the case the learner is looking at, then the question.

Rules:
- Always call ${TOOL_ID} first with that condition id and the question, and answer only from the passages it returns. If they don't cover the question, say you can only speak to what your sources cover and suggest asking a clinician.
- Never diagnose anyone or say what someone "has". You teach warning signs; a clinician decides.
- If the learner describes symptoms happening right now that could be an emergency, start by telling them to call 911 right away.
- Answer directly in one or two short spoken sentences. No greeting, lists, markdown, links or source names; the app shows the sources.
- Respectful, person-first language, no stereotypes about any group. Write 911 as "911".`;

const AGENT = {
  name: "HerHealth tutor",
  description: "Answers learners' questions during a HerHealth lesson, only from trusted medical sources.",
  labels: ["herhealth", "health-education"],
  avatar_color: "#F4C7C3",
  avatar_symbol: "HH",
  configuration: { instructions: INSTRUCTIONS, tools: [{ tool_ids: [TOOL_ID] }] },
};

async function upsert(kind: "tools" | "agents", id: string, body: Record<string, unknown>) {
  const base = `${kibanaUrl()}/api/agent_builder/${kind}`;
  const exists = (await fetch(`${base}/${id}`, { headers: kibanaHeaders() })).ok;
  const { type, ...updatable } = body;
  const res = exists
    ? await fetch(`${base}/${id}`, { method: "PUT", headers: kibanaHeaders(), body: JSON.stringify(updatable) })
    : await fetch(base, { method: "POST", headers: kibanaHeaders(), body: JSON.stringify({ id, type, ...updatable }) });
  if (!res.ok)
    throw new Error(`${exists ? "Updating" : "Creating"} ${kind}/${id} failed: ${res.status} ${await res.text()}`);
  console.log(`${exists ? "Updated" : "Created"} ${kind}/${id}`);
}

async function main() {
  if (!kibanaUrl()) throw new Error("Set KIBANA_URL (or ELASTIC_URL) in .env.local.");
  console.log(`Kibana: ${kibanaUrl()}`);
  await upsert("tools", TOOL_ID, TOOL);
  await upsert("agents", AGENT_ID, AGENT);

  const question = process.argv[2] ?? "Can a heart attack feel like indigestion?";
  const res = await fetch(`${kibanaUrl()}/api/agent_builder/converse`, {
    method: "POST",
    headers: kibanaHeaders(),
    body: JSON.stringify({ agent_id: AGENT_ID, input: `[condition: heart-attack]\n${question}` }),
  });
  const data = await res.json();
  console.log(`\nQ: ${question}\nA: ${data?.response?.message ?? JSON.stringify(data).slice(0, 500)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
