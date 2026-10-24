import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { v } from "convex/values";
import { z } from "zod";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { CONDITION_NAMES, searchElastic, type Passage } from "./lessons";

const AnswerSchema = z.object({
  answer: z.string().describe("What the teacher says aloud: one or two short spoken sentences that directly answer the question, no lists or markdown"),
  sources: z.array(z.number().int()).describe("Indexes of the passages the answer relies on"),
  emergency: z.boolean().describe("True if the learner describes symptoms happening to someone right now"),
});

const SYSTEM = `You are the teacher in HerHealth, an app that teaches women how health conditions can show up differently in women. A learner has asked you a question out loud, and your answer will be spoken in your voice.

Rules:
- Answer only from the passages provided. If they don't cover the question, say you can only speak to what your sources cover, and suggest asking a clinician.
- Never diagnose the learner or anyone else, and never say what someone "has". You teach warning signs; a clinician decides what is happening.
- If the learner describes symptoms happening now that could be a heart attack or another emergency, set emergency to true and start the answer by telling her to call 911 right away. This is the one case where you may add a sentence.
- If the question is off topic, say in one sentence that you can only help with this lesson.
- Answer the question directly and stop. One or two short sentences. No greeting, no restating the question, no extra tips, and no reminder to see a clinician unless the question is about what to do.
- Speak plainly and calmly, with respectful, person-first language and no stereotypes about any group. Write 911 as "911".`;

/** Answers a learner's spoken question from the lesson's sources. */
export const ask = action({
  args: {
    condition: v.optional(v.string()),
    customId: v.optional(v.id("customLessons")),
    question: v.string(),
    lessonContext: v.optional(v.string()),
  },
  handler: async (ctx, { condition, customId, question, lessonContext }) => {
    const q = question.trim().slice(0, 500);
    if (!q) throw new Error("Ask a question first.");

    // A made-to-order lesson answers from its own sources; the built-in lessons search Elastic.
    let name: string;
    let passages: Passage[];
    if (customId) {
      name = "this lesson's topic";
      passages = await ctx.runQuery(internal.custom.passages, { id: customId });
    } else {
      name = CONDITION_NAMES[condition ?? ""];
      if (!name) throw new Error(`Unknown condition: ${condition}`);
      passages = await searchElastic(condition!, `${name} in women: ${q}`);
    }
    const sources = passages
      .map((p, i) => `<passage index="${i + 1}" org="${p.org}">\n${p.passage}\n</passage>`)
      .join("\n\n");

    const client = new Anthropic();
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 2000,
      output_config: { effort: "low", format: betaZodOutputFormat(AnswerSchema) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Topic: ${name}\n${lessonContext ? `The learner is looking at this case: ${lessonContext.slice(0, 1500)}\n` : ""}\n${sources}\n\n<question>${q}</question>`,
        },
      ],
    });
    const out = response.parsed_output;
    if (response.stop_reason === "refusal" || !out) {
      return {
        answer: "I can't answer that one. Please ask a clinician, and if this is an emergency, call 911.",
        sources: [],
        emergency: false,
      };
    }
    const cited = [...new Set(out.sources)]
      .map((i) => passages[i - 1])
      .filter(Boolean)
      .map((p) => ({ org: p.org, url: p.url, title: p.title }));
    return { answer: out.answer, sources: cited, emergency: out.emergency };
  },
});
