import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { ConvexError, v } from "convex/values";
import { z } from "zod";
import { internal } from "./_generated/api";
import { action, internalMutation, query } from "./_generated/server";

const INDEX = "women-health-sources";
// Each lesson draws from its own names, so cases across lessons don't share a person.
const PERSON_NAMES: Record<string, string[]> = {
  "heart-attack": ["Denise", "Carmen", "Gloria", "Linda", "Yvonne"],
  endometriosis: ["Jasmine", "Aisha", "Hannah", "Sofia", "Elena"],
  adhd: ["Rachel", "Mei", "Olivia", "Leah", "Tanya"],
};

export const CONDITION_NAMES: Record<string, string> = {
  "heart-attack": "heart attack",
  endometriosis: "endometriosis",
  adhd: "ADHD",
};
const BODY_REGIONS = [
  "head",
  "jaw",
  "chest",
  "left_arm",
  "back",
  "lower_back",
  "stomach",
  "pelvis",
  "whole_body",
] as const;

export const LessonSchema = z.object({
  person: z.object({ name: z.string(), age: z.number().int() }),
  scenario: z.string().describe("3-4 sentence story about a named woman noticing symptoms"),
  question: z.string(),
  options: z.array(z.string()).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().describe("Spoken aloud by the teacher: warm, plain words, under 120 words"),
  bodyRegions: z.array(z.enum(BODY_REGIONS)),
  symptoms: z
    .array(z.object({ label: z.string().describe("2-4 words, e.g. 'jaw ache'"), region: z.enum(BODY_REGIONS) }))
    .describe("Each symptom the woman in the scenario has, in the order she notices them"),
  expected: z.string().describe("What most people picture for this condition, in under 12 words"),
  takeaway: z.string().describe("One sentence the learner should remember"),
  facts: z
    .array(
      z.object({
        text: z.string(),
        quote: z.string().describe("One sentence copied word for word from the cited passage that supports this fact"),
        sourceUrl: z.string(),
        sourceOrg: z.string(),
      }),
    )
    .min(2),
  urgent: z.boolean(),
});
export type Lesson = z.infer<typeof LessonSchema>;

const pick = (xs: string[]) => xs[Math.floor(Math.random() * xs.length)];

export type Passage = { title: string; url: string; org: string; passage: string };

export const LESSON_RULES = `You are the teacher in Her Signs, an app that teaches women how health conditions can show up differently in women.

Write one short lesson from the passages the user gives you. Rules:
- Use only facts stated in the passages. Every fact in "facts" must cite the url and org of the passage it came from, copied exactly, and include a quote: one sentence copied word for word from that passage that supports the fact.
- The scenario is about a named woman in everyday life whose symptoms are easy to dismiss. The question asks what the learner thinks is going on or what she should do; exactly one option is right and the others are common misconceptions. All four options must be similar in length, detail and tone (one short sentence each), so the right one does not stand out by being longer or more specific.
- Never diagnose the learner or tell her what she has. Encourage seeing a clinician.
- If the condition can be an emergency (heart attack), set urgent to true and say in the explanation to call 911 right away.
- bodyRegions lists only the regions the scenario's symptoms involve; use whole_body for things like fatigue or cold sweat. Use back for upper back or between the shoulder blades, and lower_back for the lower back.
- The lesson is shown visually: symptoms appear as labeled points on a body diagram, and "expected" is contrasted with what she actually felt.
- Tone: calm, clear and serious, like a good clinician teaching. No exclamation marks or cutesy language.
- Language: respectful, neutral and person-first. No stereotypes or caricatures of any group (by gender, age, race, body, disability or anything else), no comparisons to boys or men as a type of person, and nothing that mocks or blames. "expected" names the common assumption about the symptoms themselves (for example "Mainly hyperactivity" or "Sudden crushing chest pain"), never a picture of a kind of person.`;

export async function searchElastic(condition: string, query: string): Promise<Passage[]> {
  const url = process.env.ELASTIC_URL;
  const apiKey = process.env.ELASTIC_API_KEY;
  if (!url || !apiKey) throw new Error("Set ELASTIC_URL and ELASTIC_API_KEY in Convex env vars.");
  const res = await fetch(`${url.replace(/\/$/, "")}/${INDEX}/_search`, {
    method: "POST",
    headers: { Authorization: `ApiKey ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      size: 6,
      _source: ["title", "url", "org", "passage"],
      query: {
        bool: {
          must: { semantic: { field: "passage", query } },
          filter: { term: { condition } },
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`Elastic search failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.hits.hits.map((h: { _source: Passage }) => h._source);
}

export const get = query({
  args: { condition: v.string() },
  handler: async (ctx, { condition }) => {
    const row = await ctx.db
      .query("lessons")
      .withIndex("by_condition", (q) => q.eq("condition", condition))
      .order("desc")
      .first();
    return row ? (row.lesson as Lesson) : null;
  },
});

export const save = internalMutation({
  args: { condition: v.string(), lesson: v.any() },
  handler: async (ctx, { condition, lesson }) => {
    await ctx.db.insert("lessons", { condition, lesson, createdAt: Date.now() });
  },
});

/** Retrieves cited passages from Elastic, asks Claude for a lesson, validates and caches it. */
export const generateLesson = action({
  args: { condition: v.string() },
  handler: async (ctx, { condition }): Promise<Lesson> => {
    const name = CONDITION_NAMES[condition];
    if (!name) throw new Error(`Unknown condition: ${condition}`);

    const passages = await searchElastic(condition, `${name} symptoms in women that are often missed`);
    if (passages.length === 0) throw new Error(`No passages indexed for ${condition}; run npm run ingest.`);

    const sources = passages
      .map((p, i) => `<passage index="${i + 1}" org="${p.org}" url="${p.url}" title="${p.title}">\n${p.passage}\n</passage>`)
      .join("\n\n");

    const client = new Anthropic();
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "medium", format: betaZodOutputFormat(LessonSchema) },
      // On a safety decline, the API reruns the request on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: LESSON_RULES,
      messages: [
        {
          role: "user",
          content: `Condition: ${name}\nName the woman in the case ${pick(PERSON_NAMES[condition])}.\n\n${sources}\n\nWrite the lesson.`,
        },
      ],
    });
    if (response.stop_reason === "refusal") throw new Error("Claude declined to write this lesson.");
    const lesson = response.parsed_output;
    if (!lesson) throw new Error(`Lesson did not match the schema (stop_reason: ${response.stop_reason}).`);

    await checkLesson(client, lesson, passages, sources);

    await ctx.runMutation(internal.lessons.save, { condition, lesson });
    return lesson;
  },
});

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const ReviewSchema = z.object({
  answerSupported: z.boolean().describe("The passages support the option marked correct, and not the others"),
  unsupportedClaims: z
    .array(z.string())
    .describe("Sentences from the explanation or takeaway that the passages don't support, copied exactly"),
  unsupportedRedFlags: z.array(z.string()).describe("Items from redFlags the passages don't support, copied exactly"),
  unsupportedDifferential: z
    .array(z.string())
    .describe("Items from differential the passages don't support, copied exactly"),
});

const REVIEWER = `You are a medical fact-checker. You get source passages and a lesson written from them. Check the lesson only against the passages, not your own knowledge. Report anything the passages don't support. Be strict: a claim is supported only if a passage states it or plainly implies it.`;

/**
 * Guards against the model getting things wrong:
 * 1. Every fact must quote its source, and the quote must really appear in the passage we retrieved.
 * 2. A second model call fact-checks the answer, explanation, red flags and differential against the passages,
 *    and anything unsupported is removed. If the answer itself isn't supported, the lesson is rejected.
 */
export async function checkLesson(
  client: Anthropic,
  lesson: {
    explanation: string;
    takeaway: string;
    options: string[];
    correctIndex: number;
    facts: { text: string; quote: string; sourceUrl: string }[];
    redFlags?: string[];
    differential?: string[];
  },
  passages: Passage[],
  sources: string,
) {
  lesson.facts = lesson.facts.filter((f) => {
    const quote = normalize(f.quote);
    return (
      quote.length >= 20 && passages.some((p) => p.url === f.sourceUrl && normalize(p.passage).includes(quote))
    );
  });
  if (lesson.facts.length === 0) throw new ConvexError("None of the lesson's facts could be matched to its sources.");

  const review = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 8000,
    output_config: { effort: "low", format: betaZodOutputFormat(ReviewSchema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: REVIEWER,
    messages: [
      {
        role: "user",
        content: `${sources}\n\n<lesson>\n${JSON.stringify({
          options: lesson.options,
          correct: lesson.options[lesson.correctIndex],
          explanation: lesson.explanation,
          takeaway: lesson.takeaway,
          redFlags: lesson.redFlags,
          differential: lesson.differential,
        })}\n</lesson>`,
      },
    ],
  });
  const verdict = review.parsed_output;
  if (!verdict) throw new ConvexError("The fact-check didn't finish. Please try again.");
  if (!verdict.answerSupported) throw new ConvexError("The fact-check couldn't confirm the answer from the sources.");
  for (const claim of verdict.unsupportedClaims) {
    lesson.explanation = lesson.explanation.replace(claim, "").replace(/\s{2,}/g, " ").trim();
    if (lesson.takeaway.includes(claim)) lesson.takeaway = "";
  }
  const unsupported = new Set([...verdict.unsupportedRedFlags, ...verdict.unsupportedDifferential]);
  lesson.redFlags = lesson.redFlags?.filter((x) => !unsupported.has(x));
  lesson.differential = lesson.differential?.filter((x) => !unsupported.has(x));
}
