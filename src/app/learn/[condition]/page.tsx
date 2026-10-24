import Link from "next/link";
import { notFound } from "next/navigation";
import AvatarStage from "@/components/AvatarStage";
import LessonPanel from "@/components/LessonPanel";
import { CONDITIONS, getCondition } from "@/lib/conditions";

export function generateStaticParams() {
  return CONDITIONS.map((c) => ({ condition: c.slug }));
}

export default async function LearnPage({ params }: PageProps<"/learn/[condition]">) {
  const { condition: slug } = await params;
  const condition = getCondition(slug);
  if (!condition) notFound();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-10">
      {condition.urgent && (
        <div role="alert" className="mb-6 rounded-xl bg-alert px-4 py-3 text-sm font-semibold text-white">
          If this is happening now, call 911.
        </div>
      )}
      <Link href="/" className="text-sm text-rose">
        ← All lessons
      </Link>
      <h1 className="mt-2 text-3xl font-bold">{condition.name}</h1>

      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <AvatarStage />
        <LessonPanel condition={condition.slug} />
      </div>
    </main>
  );
}
