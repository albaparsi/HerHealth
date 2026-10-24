import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import LessonMaker from "@/components/LessonMaker";

export const metadata: Metadata = { title: "Make a lesson · Her Signs" };

export default function MakePage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:py-16">
      <Link href="/" className="text-sm text-muted hover:text-accent">
        ← All lessons
      </Link>
      <h1 className="mt-3 font-serif text-4xl">Make a lesson</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Type any health topic, or paste a link to a page you&apos;re reading. Your teacher turns it into a case,
        a question and cited sources. Med students can switch to clinical depth.
      </p>
      {/* The form reads ?link= from the browser extension. */}
      <Suspense>
        <LessonMaker />
      </Suspense>
    </main>
  );
}
