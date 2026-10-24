import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { v } from "convex/values";
import { z } from "zod";
import { internal } from "./_generated/api";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { LessonSchema, LESSON_RULES, type Passage } from "./lessons";

// Sites whose pages count as reviewed medical sources. Anything else is labeled as unreviewed.
const TRUSTED = [
  "nih.gov",
  "cdc.gov",
  "medlineplus.gov",
  "womenshealth.gov",
  "acog.org",
  "who.int",
  "fda.gov",
  "heart.org",
  "mayoclinic.org",
  "clevelandclinic.org",
  "nhs.uk",
];
const isTrusted = (host: string) => TRUSTED.some((d) => host === d || host.endsWith(`.${d}`));

const CustomSchema = LessonSchema.extend({
  onTopic: z.boolean().describe("False if the material is not about health or medicine"),
  redFlags: z.array(z.string()).describe("Med student level only: warning signs from the passages; otherwise empty"),
  differential: z
    .array(z.string())
    .describe("Med student level only: conditions to rule out, named in the passages; otherwise empty"),
});

const LEVELS = {
  everyday: `The learner is a member of the public. Follow the rules above as written.`,
  med: `The learner is a medical student. Write the scenario as a short clinical vignette about a woman (age, presenting complaint, relevant history, and findings only if the passages give them). The question is board-style: the most likely explanation or the best next step. The explanation covers how the presentation can differ in women and the reasoning, using clinical terms. Fill redFlags and differential only with items the passages support.`,
};

function decode(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}
const stripTags = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** MedlinePlus health-topic summaries for a typed topic. */
async function searchMedlinePlus(topic: string): Promise<Passage[]> {
  const res = await fetch(
    `https://wsearch.nlm.nih.gov/ws/query?db=healthTopics&retmax=4&term=${encodeURIComponent(topic)}`,
  );
  if (!res.ok) throw new Error(`MedlinePlus search failed: ${res.status}`);
  const xml = await res.text();
  return xml
    .split("<document ")
    .slice(1)
    .map((doc) => {
      const url = doc.match(/url="([^"]+)"/)?.[1] ?? "https://medlineplus.gov";
      const field = (name: string) =>
        stripTags(decode(doc.match(new RegExp(`<content name="${name}">([\\s\\S]*?)</content>`))?.[1] ?? ""));
      return { title: field("title"), url, org: "MedlinePlus", passage: field("FullSummary").slice(0, 3000) };
    })
    .filter((p) => p.passage.length > 100);
}

/** Readable text from a web page, split into a few passages. */
async function readPage(link: string): Promise<{ passages: Passage[]; trusted: boolean; title: string }> {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    throw new Error("That doesn't look like a link.");
  }
  if (!/^https?:$/.test(url.protocol)) throw new Error("Only web links work here.");
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (HerSigns lesson maker)" } });
  if (!res.ok) throw new Error(`That page couldn't be opened (${res.status}).`);
  const html = (await res.text()).slice(0, 1_500_000);
  const title = stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? url.hostname);
  const body = html
    .replace(/<(script|style|noscript|svg|nav|header|footer|form)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const main = body.match(/<(main|article)[\s\S]*?<\/\1>/i)?.[0] ?? body;
  const text = stripTags(main).slice(0, 12000);
  if (text.length < 300) throw new Error("There wasn't enough readable text on that page.");
  const host = url.hostname.replace(/^www\./, "");
  const passages: Passage[] = [];
  for (let i = 0; i < text.length; i += 3000) {
    passages.push({ title, url: url.toString(), org: host, passage: text.slice(i, i + 3000) });
  }
  return { passages, trusted: isTrusted(host), title };
}

export const save = internalMutation({
  args: {
    topic: v.string(),
    level: v.union(v.literal("everyday"), v.literal("med")),
    link: v.optional(v.string()),
    trusted: v.boolean(),
    lesson: v.any(),
    passages: v.any(),
  },
  handler: async (ctx, args) => ctx.db.insert("customLessons", { ...args, createdAt: Date.now() }),
});

export const passages = internalQuery({
  args: { id: v.id("customLessons") },
  handler: async (ctx, { id }) => ((await ctx.db.get(id))?.passages ?? []) as Passage[],
});

export const get = query({
  args: { id: v.id("customLessons") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    return row && { topic: row.topic, level: row.level, link: row.link, trusted: row.trusted, lesson: row.lesson };
  },
});

export const recent = query({
  args: {},
  handler: async (ctx) =>
    (await ctx.db.query("customLessons").order("desc").take(8)).map((r) => ({
      id: r._id,
      topic: r.topic,
      level: r.level,
      trusted: r.trusted,
    })),
});

/** Builds a lesson on any health topic (from MedlinePlus) or from a page the learner links. */
export const makeLesson = action({
  args: {
    topic: v.optional(v.string()),
    link: v.optional(v.string()),
    level: v.union(v.literal("everyday"), v.literal("med")),
  },
  handler: async (ctx, { topic, link, level }): Promise<string> => {
    const typed = topic?.trim().slice(0, 120);
    let passages: Passage[];
    let trusted = true;
    let name = typed ?? "";
    if (link?.trim()) {
      const page = await readPage(link.trim());
      passages = page.passages;
      trusted = page.trusted;
      name = typed || page.title;
    } else if (typed) {
      passages = await searchMedlinePlus(typed);
      if (passages.length === 0) throw new Error(`MedlinePlus has nothing on "${typed}". Try another wording.`);
    } else {
      throw new Error("Type a topic or paste a link.");
    }

    const sources = passages
      .map((p, i) => `<passage index="${i + 1}" org="${p.org}" url="${p.url}" title="${p.title}">\n${p.passage}\n</passage>`)
      .join("\n\n");
    const caution = trusted
      ? ""
      : "\nThe passages come from a site that is not a reviewed medical source. Only use statements that are consistent with mainstream medical guidance, and leave out anything doubtful.";

    const client = new Anthropic();
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "medium", format: betaZodOutputFormat(CustomSchema) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: `${LESSON_RULES}\n\nLevel: ${LEVELS[level]}${caution}\nIf the material is not about health or medicine, set onTopic to false.`,
      messages: [{ role: "user", content: `Topic: ${name}\n\n${sources}\n\nWrite the lesson.` }],
    });
    if (response.stop_reason === "refusal") throw new Error("The teacher couldn't make a lesson from that.");
    const lesson = response.parsed_output;
    if (!lesson) throw new Error("The lesson came out incomplete. Please try again.");
    if (!lesson.onTopic) throw new Error("That doesn't look like health material, so there's no lesson to make.");

    const known = new Set(passages.map((p) => p.url));
    lesson.facts = lesson.facts.filter((f) => known.has(f.sourceUrl));
    if (lesson.facts.length === 0) throw new Error("The lesson had no facts tied to the sources. Please try again.");

    return await ctx.runMutation(internal.custom.save, {
      topic: name.slice(0, 160),
      level,
      link: link?.trim() || undefined,
      trusted,
      lesson,
      passages,
    });
  },
});
