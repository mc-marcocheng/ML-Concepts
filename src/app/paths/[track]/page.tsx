import Link from 'next/link';
import { notFound } from 'next/navigation';
import { listConcepts } from '@/lib/content/server';
import { orderConcepts } from '@/lib/content/order';
import { CATEGORY_TITLE } from '@/lib/content/categories';
import { TRACKS, getTrack, trackQuizHref } from '@/lib/content/tracks';

export const dynamicParams = false;

export async function generateStaticParams() {
  return TRACKS.map(track => ({ track: track.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ track: string }> }) {
  const { track } = await params;
  const def = getTrack(track);
  return def ? { title: def.title, description: def.summary } : {};
}

export default async function PathPage({ params }: { params: Promise<{ track: string }> }) {
  const { track } = await params;
  const def = getTrack(track);
  if (!def) notFound();

  const all = await listConcepts();
  const ordered = orderConcepts(all.filter(concept => def.categories.includes(concept.category)));
  const quizHref = trackQuizHref(def, Math.min(10, Math.max(5, ordered.length)));

  return (
    <div className="container-read py-10">
      <p className="t-eyebrow text-muted">{def.eyebrow}</p>
      <h1 className="t-display-md mt-3">{def.title}</h1>
      <p className="mt-4 max-w-[62ch] text-[17px] leading-7 text-body">{def.summary}</p>

      <div className="mt-8 flex flex-wrap gap-2">
        {ordered.length ? (
          <Link href={quizHref} className="inline-flex items-center justify-center rounded-pill bg-primary px-5 py-3.5 font-bold text-on-primary shadow-offset">
            Start path quiz
          </Link>
        ) : null}
        <Link href="/learn" className="rounded-pill border-2 border-line-strong bg-card px-5 py-3.5 font-bold text-ink hover:bg-primary-pale">
          Browse all concepts
        </Link>
      </div>

      <section className="mt-8 rounded-lg border border-line bg-card p-5">
        <p className="t-eyebrow text-muted">Sequence</p>
        {ordered.length === 0 ? (
          <p className="mt-3 text-[15px] leading-7 text-body">No concepts are published for this path yet.</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {ordered.map(({ concept, step, prereqs }) => (
              <Link
                key={concept.id}
                href={concept.href}
                className="group flex flex-wrap items-start justify-between gap-4 rounded-lg border border-line bg-canvas-soft px-4 py-4 transition-transform hover:-translate-y-0.5 hover:border-line-strong"
              >
                <div className="min-w-0">
                  <p className="font-mono text-[12px] text-muted">Step {step}</p>
                  <h2 className="mt-1 text-[18px] font-extrabold text-ink">{concept.title}</h2>
                  <p className="mt-2 max-w-[58ch] text-[14px] leading-6 text-body">{concept.summary}</p>
                  {prereqs.length ? (
                    <p className="mt-2 font-mono text-[12px] text-muted">
                      After: {prereqs.map(prereq => prereq.title).join(', ')}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-none flex-wrap items-center gap-2">
                  <span className="rounded-pill border border-line bg-card px-3 py-1 font-mono text-[12px] text-muted">
                    {CATEGORY_TITLE[concept.category] ?? concept.category}
                  </span>
                  <span className="rounded-pill border border-line bg-card px-3 py-1 font-mono text-[12px] text-muted">
                    {concept.quizCount} quiz item{concept.quizCount === 1 ? '' : 's'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-4 rounded-lg border border-line bg-card p-5">
        <p className="t-eyebrow text-muted">How this order is built</p>
        <p className="mt-3 text-[15px] leading-7 text-body">
          The sequence is derived from the <code className="font-mono text-[13px]">prereqs</code> field in each note. Notes with no
          unmet prerequisites come first; ties are resolved by difficulty, then reading time, then title.
        </p>
      </section>
    </div>
  );
}
