"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import Classroom, { type Lesson } from "./Classroom";
import { convexEnabled } from "./ConvexClientProvider";

export default function CustomLessonPage({ id }: { id: string }) {
  if (!convexEnabled) return <p className="mt-10 text-muted">The lesson service isn&apos;t connected yet.</p>;
  return <Loaded id={id as Id<"customLessons">} />;
}

function Loaded({ id }: { id: Id<"customLessons"> }) {
  const row = useQuery(api.custom.get, { id });
  if (row === undefined) return <p className="mt-10 text-muted">Loading the lesson…</p>;
  if (row === null) return <p className="mt-10 text-muted">This lesson doesn&apos;t exist.</p>;

  return (
    <>
      <header className="mt-2 mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-5">
        <h1 className="font-serif text-3xl sm:text-4xl">{row.topic}</h1>
        <div className="flex flex-wrap gap-2 text-xs">
          {row.level === "med" && <span className="rounded-full bg-accent px-3 py-1 font-semibold text-white">Med student</span>}
          <span className="rounded-full bg-accent-soft px-3 py-1 text-accent">Reviewed medical sources, fact-checked</span>
        </div>
      </header>
      {row.note && <p className="-mt-3 mb-5 text-sm text-muted">{row.note}</p>}
      {(row.lesson as Lesson).urgent && <p className="mb-4 text-sm font-semibold text-alert">Emergency? Call 911.</p>}
      <Classroom
        key={id}
        custom={{ id, topic: row.topic, lesson: row.lesson as Lesson, checks: (row.lesson as Lesson).quickCheck }}
        title={row.topic}
      />
    </>
  );
}
