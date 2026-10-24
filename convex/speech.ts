import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation, internalQuery } from "./_generated/server";

const CARTESIA_URL = "https://api.cartesia.ai";
const CARTESIA_VERSION = "2026-08-14";
const MODEL = "sonic-3";

async function sha256(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function cartesiaHeaders() {
  const apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey) throw new Error("Set CARTESIA_API_KEY in Convex env vars.");
  return {
    Authorization: `Bearer ${apiKey}`,
    "Cartesia-Version": CARTESIA_VERSION,
    "Content-Type": "application/json",
  };
}

/** CARTESIA_VOICE_ID if set, otherwise the first calm English feminine voice in Cartesia's library. */
async function voiceId() {
  if (process.env.CARTESIA_VOICE_ID) return process.env.CARTESIA_VOICE_ID;
  const res = await fetch(`${CARTESIA_URL}/voices?gender=feminine&q=calm&limit=20`, {
    headers: cartesiaHeaders(),
  });
  if (!res.ok) throw new Error(`Cartesia voices failed: ${res.status} ${await res.text()}`);
  const { data } = (await res.json()) as { data: { id: string; language: string }[] };
  const voice = data.find((d) => d.language === "en") ?? data[0];
  if (!voice) throw new Error("No Cartesia voice found; set CARTESIA_VOICE_ID.");
  return voice.id;
}

export const cached = internalQuery({
  args: { hash: v.string() },
  handler: async (ctx, { hash }) => {
    const row = await ctx.db
      .query("speech")
      .withIndex("by_hash", (q) => q.eq("hash", hash))
      .first();
    return row ? await ctx.storage.getUrl(row.storageId) : null;
  },
});

export const save = internalMutation({
  args: { hash: v.string(), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await ctx.db.insert("speech", args);
  },
});

/** Returns a URL to an MP3 of the teacher saying `text`. Audio is cached so each line is generated once. */
export const speak = action({
  args: { text: v.string() },
  handler: async (ctx, { text }): Promise<string> => {
    const voice = await voiceId();
    const hash = await sha256(`${MODEL}|${voice}|${text}`);
    const hit = await ctx.runQuery(internal.speech.cached, { hash });
    if (hit) return hit;

    const res = await fetch(`${CARTESIA_URL}/tts/bytes`, {
      method: "POST",
      headers: cartesiaHeaders(),
      body: JSON.stringify({
        model_id: MODEL,
        transcript: text,
        voice: { mode: "id", id: voice },
        language: "en",
        output_format: { container: "mp3", bit_rate: 128000, sample_rate: 44100 },
      }),
    });
    if (!res.ok) throw new Error(`Cartesia TTS failed: ${res.status} ${await res.text()}`);

    const storageId = await ctx.storage.store(new Blob([await res.arrayBuffer()], { type: "audio/mpeg" }));
    await ctx.runMutation(internal.speech.save, { hash, storageId });
    return (await ctx.storage.getUrl(storageId))!;
  },
});
