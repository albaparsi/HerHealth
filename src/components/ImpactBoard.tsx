"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { CONDITIONS } from "@/lib/conditions";
import { convexEnabled } from "./ConvexClientProvider";

const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)}%`);

export default function ImpactBoard() {
  if (!convexEnabled) return <p className="mt-10 text-muted">Results will appear here once lessons are live.</p>;
  return <Results />;
}

function Results() {
  const rows = useQuery(api.attempts.impact);
  if (rows === undefined) return <p className="mt-10 text-muted">Loading results…</p>;
  if (rows.length === 0) return <p className="mt-10 text-muted">No one has finished a lesson yet.</p>;

  return (
    <ul className="mt-10 grid gap-6">
      {rows.map((r) => {
        const name = CONDITIONS.find((c) => c.slug === r.condition)?.name ?? r.condition;
        return (
          <li key={r.condition} className="rounded-lg border border-line bg-surface p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-serif text-2xl">{name}</h2>
              <p className="text-sm text-muted">
                {r.learners} {r.learners === 1 ? "learner" : "learners"}, {r.completed} finished both checks
              </p>
            </div>
            <div className="mt-6 grid gap-4">
              <Bar label="Before the lesson" value={r.before} tone="bg-muted/50" />
              <Bar label="After the lesson" value={r.after} tone="bg-accent" />
            </div>
            {r.completed > 0 && (
              <p className="mt-6 text-sm">
                <span className="font-semibold">{pct(r.improved / r.completed)}</span> of learners who finished
                scored higher after the lesson.
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Bar({ label, value, tone }: { label: string; value: number | null; tone: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-semibold">{pct(value)} correct</span>
      </div>
      <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-line">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${(value ?? 0) * 100}%` }} />
      </div>
    </div>
  );
}
