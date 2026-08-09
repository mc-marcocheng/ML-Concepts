'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ConceptMeta } from '@/lib/content/types';
import { computeDueQueue, loadAttempts } from '@/lib/persistence/progress';

export default function ReviewPage() {
  const [concepts, setConcepts] = useState<ConceptMeta[]>([]);
  const [attempts, setAttempts] = useState<ReturnType<typeof loadAttempts>>([]);

  useEffect(() => {
    fetch('/data/concepts.json').then(response => response.json()).then(setConcepts).catch(() => setConcepts([]));
    const refresh = () => setAttempts(loadAttempts());
    refresh();
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, []);

  const due = computeDueQueue(concepts, attempts);

  return (
    <div className="container-read py-10">
      <p className="t-eyebrow text-muted">Review</p>
      <h1 className="t-display-md mt-3">Due queue</h1>
      <p className="mt-4 text-[17px] leading-7 text-body">The queue is based on your local quiz history and concept-level mastery.</p>

      <div className="mt-8 grid gap-4">
        {due.length ? due.map(({ concept, mastery, attempts: count }) => (
          <article key={concept.id} className="rounded-lg border border-line bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="t-eyebrow text-muted">{concept.category}</p>
                <h2 className="mt-2 text-[20px] font-extrabold text-ink">{concept.title}</h2>
              </div>
              <p className="font-mono text-[13px] text-muted">{Math.round(mastery * 100)}% mastery · {count} attempt{count === 1 ? '' : 's'}</p>
            </div>
            <p className="mt-3 text-[15px] leading-7 text-body">{concept.summary}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/quiz/session/?scope=concept&id=${encodeURIComponent(concept.id)}`} className="rounded-pill bg-primary px-4 py-2.5 text-[14px] font-semibold text-on-primary shadow-offset">
                Review now
              </Link>
              <Link href={concept.href} className="rounded-pill border border-line bg-canvas-soft px-4 py-2.5 text-[14px] font-semibold text-ink">
                Revisit concept
              </Link>
            </div>
          </article>
        )) : (
          <p className="mt-8 rounded-lg border border-line bg-card p-5 text-[15px] leading-7 text-body">Nothing is due yet. Run a few quiz sessions and the queue will populate here.</p>
        )}
      </div>
    </div>
  );
}
