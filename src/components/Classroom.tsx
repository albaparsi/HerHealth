"use client";

import { useAction, useQuery } from "convex/react";
import dynamic from "next/dynamic";
import { useRef, useState, type ReactNode } from "react";
import { api } from "../../convex/_generated/api";
import type { AvatarHandle } from "./Avatar";
import BodyMap, { type Region, type Symptom } from "./BodyMap";
import { convexEnabled } from "./ConvexClientProvider";

const Avatar = dynamic(() => import("./Avatar"), { ssr: false });

const STEPS = ["The case", "Your call", "What's happening", "Sources"] as const;

export type Lesson = {
  person?: { name: string; age: number };
  scenario: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  bodyRegions: Region[];
  symptoms?: Symptom[];
  expected?: string;
  takeaway?: string;
  facts: { text: string; sourceUrl: string; sourceOrg: string }[];
  urgent: boolean;
};

export default function Classroom({ condition, title }: { condition: string; title: string }) {
  const avatar = useRef<AvatarHandle>(null);
  const [caption, setCaption] = useState(`Welcome. Today's lesson: ${title.toLowerCase()} in women.`);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="overflow-hidden rounded-lg bg-stage bg-[radial-gradient(ellipse_at_50%_35%,#3a4552_0%,#1c232c_70%)]">
          <Avatar ref={avatar} className="aspect-[4/3] w-full lg:aspect-[4/5]" />
          <div className="border-t border-white/10 px-5 py-4" aria-live="polite">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Your teacher</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-white/90">{caption}</p>
          </div>
        </div>
      </aside>

      {convexEnabled ? (
        <Board condition={condition} onSay={setCaption} />
      ) : (
        <Panel>
          <p className="text-muted">Lessons are coming soon. The lesson service isn&apos;t connected yet.</p>
        </Panel>
      )}
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-6 sm:p-8">
      {children}
      <p className="mt-8 border-t border-line pt-4 text-xs text-muted">
        This is education, not medical advice. Only a clinician can tell you what is happening in your body.
      </p>
    </section>
  );
}

function Board({ condition, onSay }: { condition: string; onSay: (text: string) => void }) {
  const lesson = useQuery(api.lessons.get, { condition }) as Lesson | null | undefined;
  const generate = useAction(api.lessons.generateLesson);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const newCase = async () => {
    setBusy(true);
    setError(null);
    try {
      await generate({ condition });
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (lesson === undefined) return <Panel><p className="text-muted">Loading the lesson…</p></Panel>;

  if (lesson === null) {
    return (
      <Panel>
        <h2 className="font-serif text-2xl">No case prepared yet</h2>
        <p className="mt-2 text-muted">The teacher will write a case from trusted medical sources.</p>
        <button
          onClick={newCase}
          disabled={busy}
          className="mt-5 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Preparing the case…" : "Prepare a case"}
        </button>
        {error && <p className="mt-3 text-sm text-alert">{error}</p>}
      </Panel>
    );
  }

  return <LessonView lesson={lesson} onSay={onSay} onNewCase={newCase} busy={busy} error={error} />;
}

export function LessonView({
  lesson,
  onSay,
  onNewCase,
  busy,
  error,
}: {
  lesson: Lesson;
  onSay: (text: string) => void;
  onNewCase: () => Promise<boolean>;
  busy: boolean;
  error: string | null;
}) {
  const [step, setStep] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);

  const symptoms: Symptom[] =
    lesson.symptoms ?? lesson.bodyRegions.map((r) => ({ label: r.replace("_", " "), region: r }));
  const who = lesson.person ? `${lesson.person.name}, ${lesson.person.age}` : "The patient";
  const firstName = lesson.person?.name ?? "she";
  const correct = chosen === lesson.correctIndex;

  function goTo(next: number) {
    setStep(next);
    const lines = [
      lesson.scenario,
      lesson.question,
      lesson.explanation,
      lesson.takeaway ?? "Here is where every fact in this lesson comes from.",
    ];
    onSay(lines[next]);
  }

  const answer = (i: number) => {
    setChosen(i);
    goTo(2);
  };

  return (
    <Panel>
      <ol className="flex gap-1.5" aria-label="Lesson steps">
        {STEPS.map((label, i) => (
          <li key={label} className="flex-1">
            <button
              onClick={() => (i < 2 || chosen !== null) && goTo(i)}
              className="w-full text-left"
              aria-current={step === i ? "step" : undefined}
            >
              <span className={`block h-1 rounded-full ${i <= step ? "bg-accent" : "bg-line"}`} />
              <span className={`mt-2 hidden text-xs sm:block ${i === step ? "font-semibold text-ink" : "text-muted"}`}>
                {i + 1}. {label}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {lesson.urgent && step >= 2 && (
        <p role="alert" className="mt-6 rounded-md bg-alert px-4 py-3 text-sm font-semibold text-white">
          If this is happening now, call 911. Do not drive yourself.
        </p>
      )}

      <div className="mt-6">
        {step === 0 && (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Case</p>
            <h2 className="mt-1 font-serif text-3xl">{who}</h2>
            <p className="mt-4 leading-relaxed">{lesson.scenario}</p>
            <h3 className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-muted">What she notices</h3>
            <div className="mt-3">
              <BodyMap symptoms={symptoms} />
            </div>
            <Next onClick={() => goTo(1)}>What should {firstName} do?</Next>
          </>
        )}

        {step === 1 && (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Your call</p>
            <h2 className="mt-1 font-serif text-2xl leading-snug">{lesson.question}</h2>
            <ul className="mt-6 grid gap-2.5">
              {lesson.options.map((option, i) => (
                <li key={i}>
                  <button
                    onClick={() => answer(i)}
                    className={`flex w-full items-start gap-3 rounded-md border px-4 py-3.5 text-left transition hover:border-accent hover:bg-accent-soft ${
                      chosen === i ? "border-accent bg-accent-soft" : "border-line"
                    }`}
                  >
                    <span className="font-serif text-lg leading-none text-muted">{"ABCD"[i]}</span>
                    <span>{option}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {step === 2 && (
          <>
            {chosen !== null && (
              <p className={`text-sm font-semibold ${correct ? "text-ok" : "text-alert"}`}>
                {correct ? "Correct." : `Not quite. The answer is ${"ABCD"[lesson.correctIndex]}: ${lesson.options[lesson.correctIndex]}`}
              </p>
            )}
            <h2 className="mt-2 font-serif text-2xl">What&apos;s happening</h2>
            <p className="mt-3 leading-relaxed">{lesson.explanation}</p>

            {lesson.expected && (
              <div className="mt-8 grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2">
                <div className="bg-paper p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">What most people expect</p>
                  <p className="mt-2 text-sm">{lesson.expected}</p>
                </div>
                <div className="bg-surface p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-alert">What {firstName} felt</p>
                  <p className="mt-2 text-sm">{symptoms.map((s) => s.label).join(", ")}</p>
                </div>
              </div>
            )}

            {lesson.takeaway && (
              <p className="mt-8 border-l-2 border-accent pl-4 font-serif text-lg leading-snug">{lesson.takeaway}</p>
            )}
            <Next onClick={() => goTo(3)}>See the sources</Next>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="font-serif text-2xl">Sources</h2>
            <p className="mt-2 text-sm text-muted">Every fact in this lesson, and where it comes from.</p>
            <ol className="mt-6 grid gap-4">
              {lesson.facts.map((f, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="font-serif text-muted">{i + 1}.</span>
                  <span>
                    {f.text}{" "}
                    <a href={f.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-accent underline underline-offset-2">
                      {f.sourceOrg}
                    </a>
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={() => goTo(0)} className="rounded-md border border-line px-4 py-2 text-sm">
                Review the case
              </button>
              <button
                onClick={async () => {
                  if (await onNewCase()) {
                    setChosen(null);
                    goTo(0);
                  }
                }}
                disabled={busy}
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? "Preparing a new case…" : "Try another case"}
              </button>
            </div>
            {error && <p className="mt-3 text-sm text-alert">{error}</p>}
          </>
        )}
      </div>
    </Panel>
  );
}

function Next({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="mt-8 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-white"
    >
      {children} →
    </button>
  );
}
