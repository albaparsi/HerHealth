import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** Saves a quick-check score. "before" starts a new attempt; "after" completes the learner's latest one. */
export const record = mutation({
  args: {
    learnerId: v.string(),
    condition: v.string(),
    phase: v.union(v.literal("before"), v.literal("after")),
    score: v.number(),
    total: v.number(),
  },
  handler: async (ctx, { learnerId, condition, phase, score, total }) => {
    if (total < 1 || total > 20 || score < 0 || score > total) throw new Error("Invalid score.");
    if (phase === "before") {
      await ctx.db.insert("attempts", { learnerId, condition, preScore: score, total });
      return;
    }
    const latest = await ctx.db
      .query("attempts")
      .withIndex("by_learner", (q) => q.eq("learnerId", learnerId).eq("condition", condition))
      .order("desc")
      .first();
    if (latest && latest.postScore === undefined) await ctx.db.patch(latest._id, { postScore: score });
    else await ctx.db.insert("attempts", { learnerId, condition, postScore: score, total });
  },
});

/** Average before and after scores per condition, for the impact page. */
export const impact = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("attempts").collect();
    const byCondition = new Map<string, { learners: Set<string>; pre: number[]; post: number[]; improved: number; completed: number }>();
    for (const r of rows) {
      if (!r.total) continue;
      const c = byCondition.get(r.condition) ?? { learners: new Set(), pre: [], post: [], improved: 0, completed: 0 };
      c.learners.add(r.learnerId);
      if (r.preScore !== undefined) c.pre.push(r.preScore / r.total);
      if (r.postScore !== undefined) c.post.push(r.postScore / r.total);
      if (r.preScore !== undefined && r.postScore !== undefined) {
        c.completed++;
        if (r.postScore > r.preScore) c.improved++;
      }
      byCondition.set(r.condition, c);
    }
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
    return [...byCondition].map(([condition, c]) => ({
      condition,
      learners: c.learners.size,
      completed: c.completed,
      improved: c.improved,
      before: avg(c.pre),
      after: avg(c.post),
    }));
  },
});
