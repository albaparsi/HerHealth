import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { ConvexError, v } from "convex/values";
import { z } from "zod";
import { internal } from "./_generated/api";
import { action, internalMutation, internalQuery, query, type ActionCtx } from "./_generated/server";
import { checkLesson, LessonSchema, LESSON_RULES, type Passage } from "./lessons";

// Sites whose pages count as reviewed medical sources. Lessons never teach from any other site.
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
const stripTags = (html: string) =>
  decode(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

/** MedlinePlus health-topic summaries for a typed topic. */
async function searchMedlinePlus(topic: string): Promise<Passage[]> {
  const res = await fetch(
    `https://wsearch.nlm.nih.gov/ws/query?db=healthTopics&retmax=6&term=${encodeURIComponent(topic)}`,
  );
  if (!res.ok) throw new ConvexError(`MedlinePlus search failed: ${res.status}`);
  const xml = await res.text();
  return xml
    .split("<document ")
    .slice(1)
    .map((doc) => {
      const url = doc.match(/url="([^"]+)"/)?.[1] ?? "https://medlineplus.gov";
      const field = (name: string) =>
        stripTags(decode(doc.match(new RegExp(`<content name="${name}">([\\s\\S]*?)</content>`))?.[1] ?? ""));
      return {
        title: field("title"),
        url,
        org: "MedlinePlus",
        passage: field("FullSummary").slice(0, 3000),
      };
    })
    .filter((p) => p.passage.length > 100);
}

// Some sites refuse requests that don't look like a browser.
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

class PageError extends Error {
  constructor(public status: number) {
    super(`That page couldn't be opened (${status}).`);
  }
}

/** A page title without the site name, e.g. "Endometriosis - Wikipedia" becomes "Endometriosis". */
const cleanTitle = (title: string) =>
  title
    .split(/\s[|\-–—:]\s/)[0]
    .trim()
    .slice(0, 80);

const STOP_WORDS =
  /\b(what|is|are|the|a|an|of|in|on|for|and|to|your|you|how|why|when|signs?|symptoms?|causes?|treatments?|about|everything|need|know|guide|overview|should|can|may|could|every|things|\d+)\b/gi;

const normalizeWords = (text: string) => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** The key words of a title, e.g. "10 signs of thyroid disease you should know" becomes "thyroid disease". */
const shorten = (title: string) =>
  title.replace(STOP_WORDS, " ").replace(/[^\w\s'-]/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 4).join(" ");

/** Words from the last part of a link's path, e.g. ".../women-and-heart-disease.html" becomes "women and heart disease". */
const slugWords = (url: URL) =>
  url.pathname
    .split("/")
    // Drop file extensions and trailing ids ("lupus-overview-4013911" becomes "lupus-overview").
    .map((part) => part.replace(/\.\w+$/, "").replace(/[-_]?\d+$/, ""))
    // Skip leftover codes ("syc") and section names ("diseases-conditions", "symptoms-causes").
    .filter((part) => part.length >= 4 && !/\d/.test(part))
    .filter(
      (part) =>
        !/^(index|about|health|topics?|en|a-z-topics|diseases?-conditions|conditions?|diseases?|symptoms?-causes|symptoms?|causes?|diagnosis-treatment|treatment|overview|article|articles|news|blog)$/i.test(
          part,
        ),
    )
    .slice(-1)
    .join(" ")
    .replace(/[-_]+/g, " ")
    .trim();

/** Readable text from a web page, split into a few passages. */
async function readPage(link: string): Promise<{ passages: Passage[]; trusted: boolean; title: string }> {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    throw new ConvexError("That doesn't look like a link.");
  }
  if (!/^https?:$/.test(url.protocol)) throw new ConvexError("Only web links work here.");
  const res = await fetch(url, { headers: BROWSER_HEADERS });
  if (!res.ok) throw new PageError(res.status);
  const html = (await res.text()).slice(0, 1_500_000);
  const title = stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? url.hostname);
  const body = html
    .replace(/<(script|style|noscript|svg|nav|header|footer|form)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const main = body.match(/<(main|article)[\s\S]*?<\/\1>/i)?.[0] ?? body;
  const text = stripTags(main).slice(0, 12000);
  if (text.length < 300) throw new ConvexError("There wasn't enough readable text on that page.");
  const host = url.hostname.replace(/^www\./, "");
  const passages: Passage[] = [];
  for (let i = 0; i < text.length; i += 3000) {
    passages.push({
      title,
      url: url.toString(),
      org: host,
      passage: text.slice(i, i + 3000),
    });
  }
  return { passages, trusted: isTrusted(host), title };
}

export const save = internalMutation({
  args: {
    topic: v.string(),
    level: v.union(v.literal("everyday"), v.literal("med")),
    link: v.optional(v.string()),
    trusted: v.boolean(),
    note: v.optional(v.string()),
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
    return (
      row && {
        topic: row.topic,
        level: row.level,
        link: row.link,
        note: row.note,
        lesson: row.lesson,
      }
    );
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
  handler: async (ctx, args): Promise<string> => {
    // Production hides ordinary error messages, so learner-facing problems are ConvexErrors with readable text.
    try {
      return await make(ctx, args);
    } catch (e) {
      if (e instanceof ConvexError) throw e;
      console.error("makeLesson failed", e);
      throw new ConvexError("Something went wrong making that lesson. Please try again.");
    }
  },
});

async function make(
  ctx: ActionCtx,
  { topic, link, level }: { topic?: string; link?: string; level: "everyday" | "med" },
): Promise<string> {
  const typed = topic?.trim().slice(0, 120);
  let passages: Passage[] = [];
  let name = typed ?? "";
  let note: string | undefined;
  if (link?.trim()) {
    let url: URL;
    try {
      url = new URL(link.trim());
    } catch {
      throw new ConvexError("That doesn't look like a link.");
    }
    const host = url.hostname.replace(/^www\./, "");
    // Lessons only ever teach from reviewed medical sources. For any other page, the teacher works out
    // its topic and teaches that topic from MedlinePlus instead, so nothing comes from the page itself.
    const page = await readPage(url.toString()).catch(() => null);
    if (page && isTrusted(host)) {
      passages = page.passages;
      name = typed || page.title;
    } else {
      // Try the most specific wording first, then looser ones, until MedlinePlus has a match.
      const title = page ? cleanTitle(page.title) : "";
      // The link's path is more reliable than the title, which may come from a "you look like a bot" page.
      const slug = slugWords(url);
      const candidates = [typed, slug, shorten(slug), title, shorten(title)].filter(
        (c, i, all): c is string => !!c && all.indexOf(c) === i,
      );
      passages = [];
      for (const candidate of candidates) {
        passages = await searchMedlinePlus(candidate);
        // Only accept a match that actually mentions the topic, so a loose search can't swap in another subject.
        const words = normalizeWords(candidate).filter((w) => w.length >= 4);
        const top = passages[0] ? normalizeWords(`${passages[0].title} ${passages[0].passage}`) : [];
        const relevant = words.length > 0 && words.some((w) => top.includes(w));
        console.log(`makeLesson: MedlinePlus "${candidate}" -> ${passages.length} passages, relevant: ${relevant}`);
        if (passages.length > 0 && relevant) {
          name = passages[0].title || candidate;
          break;
        }
        passages = [];
      }
      if (passages.length === 0)
        throw new ConvexError("I couldn't find this topic in my trusted sources, so I won't make a lesson from it.");
      note = isTrusted(host)
        ? `${host} couldn't be read, so this lesson teaches the same topic from MedlinePlus.`
        : `${host} isn't one of our reviewed medical sources, so this lesson teaches the same topic from MedlinePlus instead.`;
    }
  } else if (typed) {
    passages = await searchMedlinePlus(typed);
    if (passages.length === 0) throw new ConvexError(`MedlinePlus has nothing on "${typed}". Try another wording.`);
  } else {
    throw new ConvexError("Type a topic or paste a link.");
  }

  const sources = passages
    .map(
      (p, i) => `<passage index="${i + 1}" org="${p.org}" url="${p.url}" title="${p.title}">\n${p.passage}\n</passage>`,
    )
    .join("\n\n");

  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    output_config: {
      effort: "medium",
      format: betaZodOutputFormat(CustomSchema),
    },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: `${LESSON_RULES}\n\nLevel: ${LEVELS[level]}\nIf the requested topic or the material is not about health or medicine (for example a food, a place or a product on its own), set onTopic to false.`,
    messages: [
      {
        role: "user",
        content: `Topic: ${name}\n\n${sources}\n\nWrite the lesson.`,
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new ConvexError("The teacher couldn't make a lesson from that.");
  const lesson = response.parsed_output;
  if (!lesson) throw new ConvexError("The lesson came out incomplete. Please try again.");
  if (!lesson.onTopic) throw new ConvexError("That doesn't look like health material, so there's no lesson to make.");

  await checkLesson(client, lesson, passages, sources);

  return await ctx.runMutation(internal.custom.save, {
    topic: (name.charAt(0).toUpperCase() + name.slice(1)).slice(0, 160),
    level,
    link: link?.trim() || undefined,
    trusted: true,
    note,
    lesson,
    passages,
  });
}
