"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { AvatarHandle } from "./Avatar";
import BodyMap, { type Region, type Symptom } from "./BodyMap";
import { convexEnabled } from "./ConvexClientProvider";
import QuickCheck from "./QuickCheck";
import { QUICK_CHECKS, getCondition, type CheckItem } from "@/lib/conditions";
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
  facts: { text: string; quote?: string; sourceUrl: string; sourceOrg: string }[];
  urgent: boolean;
  /** Lessons a learner made carry their own quick check. */
  quickCheck?: CheckItem[];
  /** Med student lessons only. */
  redFlags?: string[];
  differential?: string[];
};

/** A lesson the learner asked for, made from a typed topic or a linked page. */
export type CustomLesson = { id: Id<"customLessons">; topic: string; lesson: Lesson; checks?: CheckItem[] };

/** The teacher plus a lesson: one of the built-in conditions, or a made-to-order lesson. */
export default function Classroom({
  condition,
  custom,
  title,
}: {
  condition?: string;
  custom?: CustomLesson;
  title: string;
}) {
  const avatar = useRef<AvatarHandle>(null);
  const info = condition ? getCondition(condition) : undefined;
  const topic = /^[A-Z]+$/.test(title) ? title : title.toLowerCase();
  const [welcomed, setWelcomed] = useState(false);
  const [caption, setCaption] = useState(
    custom
      ? `Hi, I'm your teacher. Today's lesson is about ${custom.topic.replace(/\b[A-Z][a-z]+\b/g, (w) => w.toLowerCase())}. Press begin when you're ready.`
      : `Hi, I'm your teacher. Today we'll look at how ${topic} can show up in women. Press begin when you're ready.`,
  );
  const [lines, setLines] = useState<string[]>([]);
  // Lines already shown on the card aren't repeated under the teacher.
  const onCard = lines.includes(caption) || caption === info?.intro.text;

  return (
    <div
      className={
        welcomed
          ? "grid gap-6 pb-32 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:pb-0"
          : "mx-auto flex max-w-md flex-col items-center text-center"
      }
    >
      <aside className={welcomed ? "lg:sticky lg:top-6 lg:self-start" : "w-full"}>
        {/* No frame: she floats on the page like a presenter. Once the lesson starts, on phones she sits in the corner. */}
        <div
          className={
            welcomed
              ? "pointer-events-none fixed right-0 bottom-0 z-30 h-36 w-28 opacity-95 [mask-image:linear-gradient(to_bottom,black_70%,transparent)] lg:static lg:h-auto lg:w-full"
              : "mx-auto w-full max-w-sm [mask-image:linear-gradient(to_bottom,black_75%,transparent)]"
          }
        >
          <Avatar ref={avatar} className={welcomed ? "h-full w-full lg:aspect-[4/5] lg:h-auto" : "aspect-[4/5] w-full"} />
        </div>
        <div className={welcomed ? "lg:-mt-6 lg:px-2" : "-mt-6"} aria-live="polite">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Your teacher</p>
          {!onCard && (
            <p className={`mt-1.5 font-serif leading-snug text-ink ${welcomed ? "text-lg" : "text-2xl"}`}>{caption}</p>
          )}
          {!welcomed && (
            <button
              onClick={() => {
                setWelcomed(true);
                setCaption(
                  !custom
                    ? info!.intro.text
                    : custom.checks?.length
                      ? "First, a few quick true or false questions. Answer what you think now. There is no penalty for being wrong."
                      : custom.lesson.scenario,
                );
              }}
              className="mt-6 rounded-md bg-accent px-6 py-3 font-semibold text-white"
            >
              Begin the lesson →
            </button>
          )}
          {convexEnabled && (
            <div className={welcomed ? "" : "flex justify-center"}>
              <TeacherVoice caption={caption} prefetch={lines} avatar={avatar} />
            </div>
          )}
          {convexEnabled && welcomed && (
            <AskTeacher
              condition={condition}
              customId={custom?.id}
              lessonContext={lines.join(" ")}
              onAnswer={setCaption}
            />
          )}
        </div>
      </aside>

      {!welcomed ? null : convexEnabled ? (
        <Board condition={condition} custom={custom} onSay={setCaption} onLines={setLines} />
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

/** The lesson flow: about (built-in lessons only), quick check, the four steps, and the check again. */
function Board({
  condition,
  custom,
  onSay,
  onLines,
}: {
  condition?: string;
  custom?: CustomLesson;
  onSay: (text: string) => void;
  onLines: (lines: string[]) => void;
}) {
  const stored = useQuery(api.lessons.get, custom ? "skip" : { condition: condition! }) as Lesson | null | undefined;
  const lesson = custom ? custom.lesson : stored;
  const generate = useAction(api.lessons.generateLesson);
  const record = useMutation(api.attempts.record);
  const checks = custom ? (custom.checks?.length ? custom.checks : undefined) : QUICK_CHECKS[condition!];
  const [phase, setPhase] = useState<"intro" | "before" | "lesson" | "after">(
    !custom ? "intro" : checks ? "before" : "lesson",
  );
  const [beforeScore, setBeforeScore] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Impact scores are kept for the built-in lessons only.
  const save = (phase: "before" | "after", score: number) =>
    !custom &&
    condition &&
    checks &&
    record({ learnerId: learnerId(), condition, phase, score, total: checks.length }).catch(() => {});

  const newCase = async () => {
    setBusy(true);
    setError(null);
    try {
      await generate({ condition: condition! });
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (phase === "intro") {
    const info = getCondition(condition!)!;
    const plan = [
      ...(checks ? ["Four quick true-or-false questions, so you can see what you learn."] : []),
      "A real-life case, and your call on what she should do.",
      "What's happening, with a trusted source behind every fact.",
      ...(checks ? ["The same questions again at the end."] : []),
    ];
    return (
      <Panel>
        <p className="rise text-xs font-semibold uppercase tracking-[0.18em] text-muted" style={at(0)}>
          About this lesson
        </p>
        <h2 className="rise mt-1 font-serif text-3xl" style={at(0, 10)}>
          {info.name} in women
        </h2>
        <p className="rise mt-4 leading-relaxed" style={at(1)}>
          {info.intro.text}{" "}
          <a href={info.intro.sourceUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-accent underline underline-offset-2">
            {info.intro.sourceOrg}
          </a>
        </p>
        <h3 className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-muted">What you&apos;ll do</h3>
        <ol className="mt-3 grid gap-2.5 [transform-style:preserve-3d]">
          {plan.map((item, i) => (
            <li key={item} className="chip rise flex items-start gap-3 px-4 py-3 text-sm" style={at(i + 2, 20)}>
              <span className="font-serif text-muted">{i + 1}.</span>
              {item}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-muted">About 5 minutes. You can ask your teacher questions at any time.</p>
        {info.urgent && (
          <p className="mt-6 rounded-md border border-alert/40 px-4 py-3 text-sm">
            <strong className="text-alert">If you have symptoms right now, stop and call 911.</strong> This lesson can wait.
          </p>
        )}
        <button
          onClick={() => {
            setPhase(checks ? "before" : "lesson");
            onSay(
              checks
                ? "First, a few quick true or false questions. Answer what you think now. There is no penalty for being wrong."
                : lesson?.scenario ?? "Let's look at a case.",
            );
          }}
          className="mt-8 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-white"
        >
          Continue →
        </button>
      </Panel>
    );
  }

  if (phase === "before") {
    return (
      <Panel>
        <QuickCheck
          items={checks!}
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
            items={checks!}
            phase="after"
            before={beforeScore}
            onSubmit={(score) => {
              save("after", score);
              onSay(
                beforeScore !== null && score > beforeScore
                  ? `You went from ${beforeScore} to ${score} out of ${checks!.length}. Well done.`
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
          onNewCase={custom ? undefined : newCase}
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
    lesson.takeaway || "Here is where every fact in this lesson comes from.",
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
  onNewCase?: () => Promise<boolean>;
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

            {(lesson.redFlags?.length || lesson.differential?.length) ? (
              <div className="mt-8 grid gap-4 sm:grid-cols-2 [transform-style:preserve-3d]">
                {[
                  ["Red flags", lesson.redFlags, "text-alert"],
                  ["Also consider", lesson.differential, "text-accent"],
                ].map(([label, items, tone], i) =>
                  (items as string[] | undefined)?.length ? (
                    <div key={label as string} className="chip rise p-4" style={at(5 + i, 24)}>
                      <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${tone}`}>{label as string}</p>
                      <ul className="mt-2 grid list-disc gap-1 pl-4 text-sm">
                        {(items as string[]).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null,
                )}
              </div>
            ) : null}

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
                    {f.quote && (
                      <span className="mt-1.5 block border-l-2 border-line pl-3 text-xs italic text-muted">
                        &ldquo;{f.quote}&rdquo;
                      </span>
                    )}
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
              {onNewCase && (
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
              )}
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
