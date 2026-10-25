import Link from "next/link";
import MyProgress from "@/components/MyProgress";
import { CONDITIONS } from "@/lib/conditions";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">HerHealth</p>
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

      <Link
        href="/make"
        className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-line bg-surface p-6 transition hover:bg-accent-soft"
      >
        <span>
          <span className="block font-serif text-2xl">Make a lesson on anything</span>
          <span className="mt-1 block text-sm text-muted">
            Type a health topic or paste a link to a page you&apos;re reading. Everyday or med student level.
          </span>
        </span>
        <span className="text-sm font-semibold text-accent">Make a lesson →</span>
      </Link>

      <MyProgress />

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
