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
      <p className="mt-3 text-sm">
        <a href="/her-health-extension.zip" className="font-medium text-accent underline underline-offset-2">
          Get the Chrome extension
        </a>{" "}
        <span className="text-muted">
          to turn any page you&apos;re reading into a lesson. Unzip it, open chrome://extensions, turn on Developer
          mode and choose Load unpacked.
        </span>
      </p>
      {/* The form reads ?link= from the browser extension. */}
      <Suspense>
        <LessonMaker />
      </Suspense>
    </main>
  );
}
