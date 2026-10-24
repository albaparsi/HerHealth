"use client";

import { useState } from "react";
import type { CheckItem } from "@/lib/conditions";

/**
 * True-or-false check run before and after a lesson. Answers are revealed only after the
 * second run, so the "before" score is a fair baseline.
 */
export default function QuickCheck({
  items,
  phase,
  before,
  onSubmit,
  onSkip,
  onDone,
}: {
  items: CheckItem[];
  phase: "before" | "after";
  before: number | null;
  onSubmit: (score: number) => void;
  onSkip?: () => void;
  onDone?: () => void;
}) {
  const [answers, setAnswers] = useState<(boolean | null)[]>(() => items.map(() => null));
  const [submitted, setSubmitted] = useState(false);
  const score = answers.filter((a, i) => a === items[i].answer).length;
  const ready = answers.every((a) => a !== null);

  const submit = () => {
    setSubmitted(true);
    onSubmit(score);
  };

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        {phase === "before" ? "Before we start" : "What you learned"}
      </p>
      <h2 className="mt-1 font-serif text-2xl leading-snug">
        {phase === "before" ? "True or false? Answer what you think now." : "Same questions, one more time."}
      </h2>
      {phase === "before" && (
        <p className="mt-2 text-sm text-muted">There is no penalty for being wrong. You will see the answers at the end.</p>
      )}

      {submitted && phase === "after" && (
        <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line text-center">
          <div className="bg-paper p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Before</p>
            <p className="mt-1 font-serif text-3xl">{before ?? "–"}<span className="text-lg text-muted">/{items.length}</span></p>
          </div>
          <div className="bg-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">After</p>
            <p className="mt-1 font-serif text-3xl">{score}<span className="text-lg text-muted">/{items.length}</span></p>
          </div>
        </div>
      )}

      <ol className="mt-6 grid gap-3">
        {items.map((item, i) => {
          const right = answers[i] === item.answer;
          const reveal = submitted && phase === "after";
          return (
            <li key={i} className="rounded-md border border-line p-4">
              <p className="flex gap-3">
                <span className="font-serif text-muted">{i + 1}.</span>
                <span>{item.statement}</span>
              </p>
              <div className="mt-3 flex gap-2 pl-6">
                {[true, false].map((value) => (
                  <button
                    key={String(value)}
                    disabled={submitted}
                    onClick={() => setAnswers((a) => a.map((x, j) => (j === i ? value : x)))}
                    aria-pressed={answers[i] === value}
                    className={`rounded-md border px-4 py-1.5 text-sm transition disabled:cursor-default ${
                      answers[i] === value ? "border-accent bg-accent-soft font-semibold" : "border-line hover:border-accent"
                    }`}
                  >
                    {value ? "True" : "False"}
                  </button>
                ))}
              </div>
              {reveal && (
                <p className="mt-3 pl-6 text-sm">
                  <span className={`font-semibold ${right ? "text-ok" : "text-alert"}`}>
                    {right ? "Correct." : `It's ${item.answer ? "true" : "false"}.`}
                  </span>{" "}
                  {item.why}{" "}
                  <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-accent underline underline-offset-2">
                    {item.sourceOrg}
                  </a>
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        {!submitted ? (
          <button
            onClick={submit}
            disabled={!ready}
            className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {phase === "before" ? "Start the lesson →" : "See my answers"}
          </button>
        ) : (
          phase === "after" && (
            <button onClick={onDone} className="rounded-md border border-line px-4 py-2 text-sm">
              Back to the lesson
            </button>
          )
        )}
        {onSkip && !submitted && (
          <button onClick={onSkip} className="text-sm text-muted underline-offset-2 hover:underline">
            Skip
          </button>
        )}
      </div>
    </div>
  );
}
