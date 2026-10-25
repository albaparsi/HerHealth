"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { api } from "../../convex/_generated/api";
import { CONDITIONS } from "@/lib/conditions";
import { existingLearnerId } from "@/lib/learner";
import { convexEnabled } from "./ConvexClientProvider";

const noSubscribe = () => () => {};

/** The lessons this browser has taken, with before and after scores. Shows nothing until there are some. */
export default function MyProgress() {
  return convexEnabled ? <Progress /> : null;
}

function Progress() {
  // Read on the client only; the server render has no learner.
  const id = useSyncExternalStore(noSubscribe, existingLearnerId, () => null);
  const rows = useQuery(api.attempts.mine, id ? { learnerId: id } : "skip");
  if (!rows || rows.length === 0) return null;

  const finished = rows.filter((r) => r.after !== null).length;
  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Your progress</h2>
        <p className="text-xs text-muted">
          {finished} of {rows.length} finished · saved in this browser, no account needed
        </p>
      </div>
      <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {rows.map((r) => {
          const custom = r.key.startsWith("custom:");
          const name = custom ? r.topic : CONDITIONS.find((c) => c.slug === r.key)?.name;
          if (!name) return null;
          const href = custom ? `/lesson/${r.key.slice("custom:".length)}` : `/learn/${r.key}`;
          const done = r.after !== null;
          return (
            <li key={r.key}>
              <Link href={href} className="chip flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{name}</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {done
                      ? r.before !== null
                        ? `Before ${r.before}/${r.total} → after ${r.after}/${r.total}`
                        : `Scored ${r.after}/${r.total}`
                      : `Started · before ${r.before}/${r.total}`}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-accent">{done ? "Review →" : "Finish →"}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
