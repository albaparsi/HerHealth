import Link from "next/link";
import { notFound } from "next/navigation";
import Classroom from "@/components/Classroom";
import { CONDITIONS, getCondition } from "@/lib/conditions";

export function generateStaticParams() {
  return CONDITIONS.map((c) => ({ condition: c.slug }));
}

export default async function LearnPage({ params }: PageProps<"/learn/[condition]">) {
  const { condition: slug } = await params;
  const condition = getCondition(slug);
  if (!condition) notFound();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-10">
      <div className="floor" aria-hidden />
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-5">
        <div>
          <Link href="/" className="text-sm text-muted hover:text-accent">
            ← All lessons
          </Link>
          <h1 className="mt-2 font-serif text-3xl sm:text-4xl">{condition.name} in women</h1>
        </div>
        {condition.urgent && (
          <p className="text-sm font-semibold text-alert">Emergency? Call 911.</p>
        )}
      </header>
      <Classroom condition={condition.slug} title={condition.name} />
    </main>
  );
}
