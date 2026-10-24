"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../../convex/_generated/api";
import type { AvatarHandle } from "./Avatar";
import BodyMap, { type Region, type Symptom } from "./BodyMap";
import { convexEnabled } from "./ConvexClientProvider";
import QuickCheck from "./QuickCheck";
import { QUICK_CHECKS } from "@/lib/conditions";
import TeacherVoice from "./TeacherVoice";
import Tilt from "./Tilt";
import { at } from "@/lib/depth";
import AskTeacher from "./AskTeacher";

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
  const [caption, setCaption] = useState(`Welcome. Today's lesson: ${/^[A-Z]+$/.test(title) ? title : title.toLowerCase()} in women.`);
  const [lines, setLines] = useState<string[]>([]);
  const [interacted, setInteracted] = useState(false);

  return (
    <div
      className="grid gap-6 pb-32 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:pb-0"
      onPointerDown={() => setInteracted(true)}
    >
      <aside className="lg:sticky lg:top-6 lg:self-start">
        {/* No frame: she floats on the page like a presenter. On phones she sits in the corner while you scroll. */}
        <div className="pointer-events-none fixed right-0 bottom-0 z-30 h-36 w-28 opacity-95 [mask-image:linear-gradient(to_bottom,black_70%,transparent)] lg:static lg:h-auto lg:w-full">
          <Avatar ref={avatar} className="h-full w-full lg:aspect-[4/5] lg:h-auto" />
        </div>
        <div className="lg:-mt-6 lg:px-2" aria-live="polite">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Your teacher</p>
          {/* Lesson lines are already on the card, so only show what she says beyond it (welcome, answers). */}
          {!lines.includes(caption) && <p className="mt-1.5 font-serif text-lg leading-snug text-ink">{caption}</p>}
          {convexEnabled && (
            <>
              <TeacherVoice caption={caption} prefetch={lines} avatar={avatar} interacted={interacted} />
              <AskTeacher condition={condition} lessonContext={lines.join(" ")} onAnswer={setCaption} />
            </>
          )}
        </div>
      </aside>

      {convexEnabled ? (
        <Board condition={condition} onSay={setCaption} onLines={setLines} />
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
    <Tilt className="p-6 sm:p-8">
      {children}
      <p className="mt-8 border-t border-line/70 pt-4 text-xs text-muted">
        This is education, not medical advice. Only a clinician can tell you what is happening in your body.{" "}
        <Link href="/about" className="underline">How lessons are made</Link>
      </p>
    </Tilt>
  );
}

function Board({
  condition,
  onSay,
  onLines,
}: {
  condition: string;
  onSay: (text: string) => void;
  onLines: (lines: string[]) => void;
}) {
  const lesson = useQuery(api.lessons.get, { condition }) as Lesson | null | undefined;
  const generate = useAction(api.lessons.generateLesson);
  const record = useMutation(api.attempts.record);
  const checks = QUICK_CHECKS[condition];
  const [phase, setPhase] = useState<"before" | "lesson" | "after">(checks ? "before" : "lesson");
  const [beforeScore, setBeforeScore] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = (phase: "before" | "after", score: number) =>
    record({ learnerId: learnerId(), condition, phase, score, total: checks.length }).catch(() => {});

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

  if (phase === "before") {
    return (
      <Panel>
        <QuickCheck
          items={checks}
          phase="before"
          before={null}
          onSubmit={(score) => {
            setBeforeScore(score);
            save("before", score);
            setPhase("lesson");
            onSay(lesson ? lesson.scenario : "Thank you. Now let's look at a case.");
          }}
          onSkip={() => setPhase("lesson")}
        />
      </Panel>
    );
  }

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

  return (
    <>
      {phase === "after" && (
        <Panel>
          <QuickCheck
            items={checks}
            phase="after"
            before={beforeScore}
            onSubmit={(score) => {
              save("after", score);
              onSay(
                beforeScore !== null && score > beforeScore
                  ? `You went from ${beforeScore} to ${score} out of ${checks.length}. Well done.`
                  : "Here are the answers, and where each one comes from.",
              );
            }}
            onDone={() => setPhase("lesson")}
          />
        </Panel>
      )}
      {/* Kept mounted while the check is open, so the learner returns to the same step. */}
      <div className={phase === "after" ? "hidden" : undefined}>
        <LessonView
          lesson={lesson}
          onSay={onSay}
          onLines={onLines}
          onNewCase={newCase}
          onCheck={
            checks
              ? () => {
                  setPhase("after");
                  onSay("Let's see what you learned. Same questions as before.");
                }
              : undefined
          }
          busy={busy}
          error={error}
        />
      </div>
    </>
  );
}

/** What the teacher says at each step. */
function scriptFor(lesson: Lesson) {
  return [
    lesson.scenario,
    lesson.question,
    lesson.explanation,
    lesson.takeaway ?? "Here is where every fact in this lesson comes from.",
  ];
}

export function LessonView({
  lesson,
  onSay,
  onLines,
  onNewCase,
  onCheck,
  busy,
  error,
}: {
  lesson: Lesson;
  onSay: (text: string) => void;
  onLines?: (lines: string[]) => void;
  onNewCase: () => Promise<boolean>;
  onCheck?: () => void;
  busy: boolean;
  error: string | null;
}) {
  const [step, setStep] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);

  useEffect(() => {
    onLines?.(scriptFor(lesson));
  }, [lesson, onLines]);

  const symptoms: Symptom[] =
    lesson.symptoms ?? lesson.bodyRegions.map((r) => ({ label: r.replace("_", " "), region: r }));
  const who = lesson.person ? `${lesson.person.name}, ${lesson.person.age}` : "The patient";
  const firstName = lesson.person?.name ?? "she";
  const correct = chosen === lesson.correctIndex;

  function goTo(next: number) {
    setStep(next);
    onSay(scriptFor(lesson)[next]);
  }

  // The question locks once answered, so the learner can't change her answer after seeing the explanation.
  const canVisit = (i: number) => (i === 0 ? true : i === 1 ? chosen === null : chosen !== null);
  const back = [step - 1, step - 2].find((i) => i >= 0 && canVisit(i));

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
              onClick={() => canVisit(i) && goTo(i)}
              disabled={!canVisit(i) && step !== i}
              title={i === 1 && chosen !== null ? "Your answer is locked in" : undefined}
              className="w-full text-left disabled:cursor-not-allowed"
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

      {back !== undefined && (
        <button onClick={() => goTo(back)} className="mt-5 text-sm text-muted hover:text-accent">
          ← Back{back === 0 && step === 2 ? " to the case" : ""}
        </button>
      )}

      <div key={step} className="mt-6 [transform-style:preserve-3d]">
        {step === 0 && (
          <>
            <div className="rise" style={at(0, 10)}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Case</p>
              <h2 className="mt-1 font-serif text-3xl">{who}</h2>
            </div>
            <p className="rise mt-4 leading-relaxed" style={at(1)}>{lesson.scenario}</p>
            <h3 className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-muted">What she notices</h3>
            <div className="mt-3 [transform-style:preserve-3d]">
              <BodyMap symptoms={symptoms} />
            </div>
            {chosen === null ? (
              <Next onClick={() => goTo(1)}>What should {firstName} do?</Next>
            ) : (
              <Next onClick={() => goTo(2)}>Back to what&apos;s happening</Next>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <div className="rise" style={at(0, 10)}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Your call</p>
              <h2 className="mt-1 font-serif text-2xl leading-snug">{lesson.question}</h2>
            </div>
            <ul className="mt-6 grid gap-3 [transform-style:preserve-3d]">
              {lesson.options.map((option, i) => (
                <li key={i} className="rise" style={at(i + 1, 24)}>
                  <button
                    onClick={() => answer(i)}
                    className={`chip flex w-full items-start gap-3 px-4 py-3.5 text-left ${
                      chosen === i ? "ring-2 ring-accent" : ""
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
            <h2 className="rise mt-2 font-serif text-2xl" style={at(0, 10)}>What&apos;s happening</h2>
            <p className="rise mt-3 leading-relaxed" style={at(1)}>{lesson.explanation}</p>

            {lesson.expected && (
              <div className="mt-8 grid gap-4 sm:grid-cols-2 [transform-style:preserve-3d]">
                <div className="chip rise bg-paper/80 p-4 shadow-none" style={at(2, 8)}>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">What most people expect</p>
                  <p className="mt-2 text-sm">{lesson.expected}</p>
                </div>
                <div className="chip rise p-4" style={at(3, 30)}>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-alert">What {firstName} felt</p>
                  <p className="mt-2 text-sm">{symptoms.map((s) => s.label).join(", ")}</p>
                </div>
              </div>
            )}

            {lesson.takeaway && (
              <p className="rise mt-8 border-l-2 border-accent pl-4 font-serif text-lg leading-snug" style={at(4, 16)}>
                {lesson.takeaway}
              </p>
            )}
            <Next onClick={() => goTo(3)}>See the sources</Next>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="font-serif text-2xl">Sources</h2>
            <p className="mt-2 text-sm text-muted">Every fact in this lesson, and where it comes from.</p>
            <ol className="mt-6 grid gap-3 [transform-style:preserve-3d]">
              {lesson.facts.map((f, i) => (
                <li key={i} className="chip rise flex gap-3 p-4 text-sm" style={at(i, 18)}>
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
              {onCheck && (
                <button onClick={onCheck} className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white">
                  Check what you learned
                </button>
              )}
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

/** Anonymous id kept in this browser, so before and after scores pair up. */
function learnerId() {
  try {
    let id = localStorage.getItem("her-signs-learner");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("her-signs-learner", id);
    }
    return id;
  } catch {
    return "anonymous";
  }
}
