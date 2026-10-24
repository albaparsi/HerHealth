import Link from "next/link";
import { CONDITIONS } from "@/lib/conditions";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:py-20">
      <p className="text-sm font-semibold uppercase tracking-widest text-rose">Her Signs</p>
      <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
        Know how it shows up in <span className="text-rose">you</span>.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-plum/80">
        Most of what we learn about symptoms comes from studies on men. A friendly 3D teacher
        walks you through real-life scenarios, quizzes you, and shows you the trusted source
        behind every fact.
      </p>

      <ul className="mt-10 grid gap-4 sm:grid-cols-3">
        {CONDITIONS.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/learn/${c.slug}`}
              className="flex h-full flex-col rounded-2xl border border-rose/15 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-rose"
            >
              <span className="flex items-center justify-between">
                <span className="text-xl font-semibold">{c.name}</span>
                {c.status === "soon" && (
                  <span className="rounded-full bg-blush px-2 py-0.5 text-xs">Coming soon</span>
                )}
              </span>
              <span className="mt-2 text-sm text-plum/75">{c.tagline}</span>
              <span className="mt-auto pt-4 text-sm font-semibold text-rose">Start lesson →</span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-12 text-xs text-plum/60">
        Education, not medical advice. If you think you are having a heart attack, call 911.
      </p>
    </main>
  );
}
