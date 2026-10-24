import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import CustomLessonPage from "@/components/CustomLessonPage";

export const metadata: Metadata = { title: "Lesson · Her Signs" };

export default function LessonPage({ params }: PageProps<"/lesson/[id]">) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-10">
      <div className="floor" aria-hidden />
      <Link href="/make" className="text-sm text-muted hover:text-accent">
        ← Make another lesson
      </Link>
      {/* Lessons are made on demand, so the id is only known at request time. */}
      <Suspense fallback={<p className="mt-10 text-muted">Loading the lesson…</p>}>
        <Lesson params={params} />
      </Suspense>
    </main>
  );
}

async function Lesson({ params }: { params: PageProps<"/lesson/[id]">["params"] }) {
  const { id } = await params;
  return <CustomLessonPage id={id} />;
}
