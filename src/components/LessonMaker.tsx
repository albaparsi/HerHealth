"use client";

import { useAction, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import { convexEnabled } from "./ConvexClientProvider";
import Tilt from "./Tilt";

export default function LessonMaker() {
  if (!convexEnabled) return <p className="mt-10 text-muted">The lesson service isn&apos;t connected yet.</p>;
  return <Maker />;
}

function Maker() {
  const router = useRouter();
  // The browser extension opens this page with ?link=<the page you were on> (or ?topic=) and &auto=1.
  const params = useSearchParams();
  const make = useAction(api.custom.makeLesson);
  const recent = useQuery(api.custom.recent);
  const [topic, setTopic] = useState(params.get("topic") ?? "");
  const [link, setLink] = useState(params.get("link") ?? "");
  const [level, setLevel] = useState<"everyday" | "med">(params.get("level") === "med" ? "med" : "everyday");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const id = await make({ topic: topic || undefined, link: link || undefined, level });
      router.push(`/lesson/${id}`);
    } catch (e) {
      setError((e as Error).message.replace(/^[\s\S]*Uncaught Error: /, "").split("\n")[0]);
      setBusy(false);
    }
  };

  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current || params.get("auto") !== "1" || (!topic && !link)) return;
    autoStarted.current = true;
    queueMicrotask(submit);
  });

  return (
    <>
      <Tilt className="mt-10 p-6 sm:p-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="grid gap-5"
        >
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold">Topic</span>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. lupus, thyroid disease in pregnancy, PCOS"
              maxLength={120}
              className="rounded-md border border-line bg-surface px-3 py-2.5 outline-none focus:border-accent"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold">
              Or a link <span className="font-normal text-muted">(optional)</span>
            </span>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://…"
              type="url"
              className="rounded-md border border-line bg-surface px-3 py-2.5 outline-none focus:border-accent"
            />
          </label>
          <fieldset className="grid gap-1.5">
            <legend className="text-sm font-semibold">Level</legend>
            <div className="mt-1.5 inline-flex w-fit rounded-md border border-line bg-surface p-1">
              {(
                [
                  ["everyday", "Everyday"],
                  ["med", "Med student"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLevel(value)}
                  aria-pressed={level === value}
                  className={`rounded px-4 py-1.5 text-sm ${level === value ? "bg-accent text-white" : "text-muted"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <div>
            <button
              type="submit"
              disabled={busy || (!topic.trim() && !link.trim())}
              className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Your teacher is reading the sources…" : "Make the lesson →"}
            </button>
            {busy && <p className="mt-2 text-sm text-muted">This takes about 20 seconds.</p>}
            {error && <p className="mt-2 text-sm text-alert">{error}</p>}
          </div>
          <p className="text-xs text-muted">
            Lessons only use reviewed medical sources: MedlinePlus (U.S. National Library of Medicine), or a link
            from a site like NIH, CDC or ACOG. For any other link, your teacher finds the topic and teaches it from
            MedlinePlus instead. Every fact is checked against its source. This is education, not medical advice.
          </p>
        </form>
      </Tilt>

      {recent && recent.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Recently made</h2>
          <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {recent.map((r) => (
              <li key={r.id}>
                <Link href={`/lesson/${r.id}`} className="chip flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="font-medium">{r.topic}</span>
                  <span className="shrink-0 text-xs text-muted">{r.level === "med" ? "Med student" : "Everyday"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
