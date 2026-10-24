import type { Metadata } from "next";
import Link from "next/link";
import ImpactBoard from "@/components/ImpactBoard";

export const metadata: Metadata = { title: "Impact · Her Signs" };

export default function ImpactPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:py-16">
      <Link href="/" className="text-sm text-muted hover:text-accent">
        ← All lessons
      </Link>
      <h1 className="mt-3 font-serif text-4xl">Impact</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Every lesson starts and ends with the same true-or-false questions. This page shows how
        scores change from before to after, across everyone who has taken a lesson. No names or
        personal details are stored.
      </p>
      <ImpactBoard />
    </main>
  );
}
