"use client";

import { useAction } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";

type Recognition = {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

function createRecognition(): Recognition | null {
  const w = window as unknown as Record<string, (new () => Recognition) | undefined>;
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

/** Lets the learner ask the teacher a question by voice (or by typing); she answers aloud. */
export default function AskTeacher({
  condition,
  lessonContext,
  onAnswer,
}: {
  condition: string;
  lessonContext?: string;
  onAnswer: (text: string) => void;
}) {
  const ask = useAction(api.ask.ask);
  const recognition = useRef<Recognition | null>(null);
  const [canListen, setCanListen] = useState(false);
  const [listening, setListening] = useState(false);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ emergency: boolean; sources: { org: string; url: string }[] } | null>(null);

  useEffect(() => {
    queueMicrotask(() => setCanListen(createRecognition() !== null));
  }, []);

  const submit = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await ask({ condition, question: q, lessonContext });
      setResult(res);
      onAnswer(res.answer);
    } catch {
      setError("She couldn't answer just now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  const listen = () => {
    if (listening) return recognition.current?.stop();
    const rec = createRecognition();
    if (!rec) return;
    rec.lang = "en-US";
    rec.interimResults = true;
    let heard = "";
    rec.onresult = (e) => {
      heard = Array.from(e.results, (r) => r[0].transcript).join("");
      setQuestion(heard);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") setError("Allow the microphone to ask out loud, or type your question.");
    };
    rec.onend = () => {
      setListening(false);
      if (heard) submit(heard);
    };
    recognition.current = rec;
    setError(null);
    setListening(true);
    rec.start();
  };

  return (
    <div className="mt-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(question);
        }}
        className="flex items-center gap-2"
      >
        {canListen && (
          <button
            type="button"
            onClick={listen}
            aria-pressed={listening}
            aria-label={listening ? "Stop listening" : "Ask out loud"}
            className={`grid size-10 shrink-0 place-items-center rounded-full border transition ${
              listening ? "border-alert bg-alert text-white" : "border-line bg-surface text-accent hover:border-accent"
            }`}
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
            </svg>
          </button>
        )}
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={listening ? "Listening…" : "Ask your teacher a question"}
          maxLength={500}
          className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={busy || !question.trim()}
          className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "…" : "Ask"}
        </button>
      </form>
      {busy && <p className="mt-2 text-xs text-muted">She&apos;s checking her sources…</p>}
      {error && <p className="mt-2 text-xs text-alert">{error}</p>}
      {result?.emergency && (
        <p role="alert" className="mt-2 rounded-md bg-alert px-3 py-2 text-sm font-semibold text-white">
          If this is happening now, call 911.
        </p>
      )}
      {result && result.sources.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          From:{" "}
          {result.sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 && ", "}
              <a href={s.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                {s.org}
              </a>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
