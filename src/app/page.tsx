import Link from "next/link";
import { CONDITIONS } from "@/lib/conditions";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Her Signs</p>
      <h1 className="mt-4 max-w-3xl font-serif text-4xl leading-tight sm:text-5xl">
        Many conditions show up differently in women. Learn the signs.
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-muted">
        Much of what we know about symptoms comes from research on men. A 3D teacher walks you
        through a real-life case, asks what you would do, and shows the trusted source behind
        every fact.
      </p>

      <ul className="mt-12 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
        {CONDITIONS.map((c) => (
          <li key={c.slug} className="bg-surface">
            <Link
              href={`/learn/${c.slug}`}
              className="flex h-full flex-col p-6 transition hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-serif text-2xl">{c.name}</span>
                {c.status === "soon" && (
                  <span className="text-xs uppercase tracking-wider text-muted">Coming soon</span>
                )}
              </span>
              <span className="mt-3 text-sm leading-relaxed text-muted">{c.tagline}</span>
              <span className="mt-auto pt-6 text-sm font-semibold text-accent">Start lesson →</span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-12 border-t border-line pt-6 text-xs text-muted">
        Education, not medical advice. Sources: CDC, NIH, MedlinePlus, womenshealth.gov, ACOG.
        If you think you are having a heart attack, call 911.{" "}
        <Link href="/about" className="underline">How this works</Link> ·{" "}
        <Link href="/impact" className="underline">See what learners gained</Link>
        <span className="mt-2 block">
          Teacher avatar: &ldquo;brunette&rdquo; from{" "}
          <a href="https://github.com/met4citizen/TalkingHead" className="underline">TalkingHead</a>, made with Ready
          Player Me,{" "}
          <a href="https://creativecommons.org/licenses/by-nc/4.0/" className="underline">CC BY-NC 4.0</a>.
        </span>
      </p>
    </main>
  );
}
