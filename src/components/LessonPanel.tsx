"use client";

import { useAction, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { convexEnabled } from "./ConvexClientProvider";

export default function LessonPanel({ condition }: { condition: string }) {
  if (!convexEnabled) {
    return <Card>Lessons are coming soon. The backend isn&apos;t connected yet.</Card>;
  }
  return <Lesson condition={condition} />;
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-rose/15 bg-white p-6">
      {children}
      <p className="mt-6 text-xs text-plum/60">This is education, not medical advice.</p>
    </section>
  );
}

function Lesson({ condition }: { condition: string }) {
  const lesson = useQuery(api.lessons.get, { condition });
  const generate = useAction(api.lessons.generateLesson);
  const [chosen, setChosen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const regenerate = async () => {
    setBusy(true);
    setError(null);
    try {
      await generate({ condition });
      setChosen(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (lesson === undefined) return <Card>Loading your lesson…</Card>;

  if (lesson === null) {
    return (
      <Card>
        <h2 className="text-lg font-semibold">Today&apos;s scenario</h2>
        <p className="mt-2 text-plum/75">No lesson yet for this topic.</p>
        <button
          onClick={regenerate}
          disabled={busy}
          className="mt-4 rounded-full bg-rose px-5 py-2 font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Writing a lesson from trusted sources…" : "Create lesson"}
        </button>
        {error && <p className="mt-3 text-sm text-alert">{error}</p>}
      </Card>
    );
  }

  const answered = chosen !== null;
  const correct = chosen === lesson.correctIndex;

  return (
    <Card>
      <h2 className="text-lg font-semibold">Today&apos;s scenario</h2>
      <p className="mt-2 leading-relaxed">{lesson.scenario}</p>
      <p className="mt-5 font-semibold">{lesson.question}</p>
      <ul className="mt-3 grid gap-2">
        {lesson.options.map((option, i) => {
          const state = !answered
            ? "border-rose/20 hover:border-rose"
            : i === lesson.correctIndex
              ? "border-green-600 bg-green-50"
              : i === chosen
                ? "border-alert bg-red-50"
                : "border-rose/10 opacity-60";
          return (
            <li key={i}>
              <button
                onClick={() => setChosen(i)}
                disabled={answered}
                className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${state}`}
              >
                {option}
              </button>
            </li>
          );
        })}
      </ul>

      {answered && (
        <div className="mt-6">
          <p className={`font-semibold ${correct ? "text-green-700" : "text-alert"}`}>
            {correct ? "That's right." : "Not quite."}
          </p>
          <p className="mt-2 leading-relaxed">{lesson.explanation}</p>
          {lesson.urgent && (
            <p role="alert" className="mt-4 rounded-xl bg-alert px-4 py-3 text-sm font-semibold text-white">
              If this is happening now, call 911.
            </p>
          )}
          <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-plum/60">Sources</h3>
          <ul className="mt-2 grid gap-2 text-sm">
            {lesson.facts.map((f, i) => (
              <li key={i}>
                {f.text}{" "}
                <a href={f.sourceUrl} target="_blank" rel="noreferrer" className="text-rose underline">
                  {f.sourceOrg}
                </a>
              </li>
            ))}
          </ul>
          <button onClick={regenerate} disabled={busy} className="mt-6 text-sm text-rose underline disabled:opacity-60">
            {busy ? "Writing a new scenario…" : "Try a different scenario"}
          </button>
          {error && <p className="mt-3 text-sm text-alert">{error}</p>}
        </div>
      )}
    </Card>
  );
}
