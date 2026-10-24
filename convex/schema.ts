import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Pre-generated lessons (Step 4) so the demo never waits on Claude or Elastic.
  lessons: defineTable({
    condition: v.string(),
    lesson: v.any(),
    createdAt: v.number(),
  }).index("by_condition", ["condition"]),

  // Lessons a learner asked for: any topic (from MedlinePlus) or a page they linked.
  customLessons: defineTable({
    topic: v.string(),
    level: v.union(v.literal("everyday"), v.literal("med")),
    link: v.optional(v.string()),
    trusted: v.boolean(),
    lesson: v.any(),
    passages: v.any(),
    createdAt: v.number(),
  }),

  // Cached teacher audio (Cartesia TTS), keyed by a hash of model, voice and text.
  speech: defineTable({
    hash: v.string(),
    storageId: v.id("_storage"),
  }).index("by_hash", ["hash"]),

  // Pre/post quiz scores per anonymous learner (Step 6).
  attempts: defineTable({
    learnerId: v.string(),
    condition: v.string(),
    preScore: v.optional(v.number()),
    postScore: v.optional(v.number()),
    total: v.optional(v.number()),
  })
    .index("by_condition", ["condition"])
    .index("by_learner", ["learnerId", "condition"]),
});
