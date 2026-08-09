'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ConceptMeta } from '@/lib/content/types';
import { computeMastery, loadAttempts } from '@/lib/persistence/progress';
import { loadReadings } from '@/lib/persistence/reading';

export default function ProgressPage() {
  const [concepts, setConcepts] = useState<ConceptMeta[]>([]);
  const [attempts, setAttempts] = useState<ReturnType<typeof loadAttempts>>([]);
  const [readings, setReadings] = useState<ReturnType<typeof loadReadings>>([]);

  useEffect(() => {
    fetch('/data/concepts.json').then(response => response.json()).then(setConcepts).catch(() => setConcepts([]));
    const refresh = () => {
      setAttempts(loadAttempts());
      setReadings(loadReadings());
    };
    refresh();
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const mastery = useMemo(() => computeMastery(concepts, attempts), [concepts, attempts]);
  const average = mastery.length ? mastery.reduce((sum, entry) => sum + entry.mastery, 0) / mastery.length : 0;
  const readingMap = useMemo(() => new Map(readings.map(record => [record.conceptId, record.ts] as const)), [readings]);
  const recent = useMemo(
    () => concepts
      .map(concept => ({ concept, ts: readingMap.get(concept.id) ?? 0 }))
      .filter(entry => entry.ts > 0)
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 6),
    [concepts, readingMap],
  );

  return (
    <div className="container-read py-10">
      <p className="t-eyebrow text-muted">Progress</p>
      <h1 className="t-display-md mt-3">Mastery</h1>
      <p className="mt-4 text-[17px] leading-7 text-body">This view summarizes your local quiz performance across concepts.</p>

      <section className="mt-8 rounded-lg border border-line bg-card p-5">
        <p className="t-eyebrow text-muted">Overview</p>
        <div className="mt-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-[34px] font-extrabold tracking-[-.04em] text-ink">{Math.round(average * 100)}%</p>
            <p className="text-[15px] text-body">Average mastery across loaded concepts</p>
          </div>
          <p className="font-mono text-[13px] text-muted">{attempts.length} stored attempt{attempts.length === 1 ? '' : 's'}</p>
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-line bg-card p-5">
        <p className="t-eyebrow text-muted">Recent reading</p>
        {recent.length ? (
          <div className="mt-3 grid gap-2">
            {recent.map(entry => (
              <a key={entry.concept.id} href={entry.concept.href} className="app-row justify-between rounded-lg border border-line bg-canvas-soft px-4 py-3">
                <span className="truncate text-[15px] text-ink">{entry.concept.title}</span>
                <span className="font-mono text-[12px] text-muted">{new Date(entry.ts).toLocaleDateString()}</span>
              </a>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-[15px] leading-7 text-body">Open a concept page to start a reading trail here.</p>
        )}
      </section>

      <div className="mt-8 grid gap-3">
        {mastery.map(entry => (
          <article key={entry.concept.id} className="rounded-lg border border-line bg-card p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-[18px] font-extrabold text-ink">{entry.concept.title}</h2>
                <p className="mt-1 text-[14px] text-body">{entry.concept.category}</p>
              </div>
              <p className="font-mono text-[13px] text-muted">{Math.round(entry.mastery * 100)}%</p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-pill bg-canvas-soft">
              <div className="h-full rounded-pill bg-primary" style={{ width: `${Math.max(4, entry.mastery * 100)}%` }} />
            </div>
            <p className="mt-2 font-mono text-[12px] text-muted">{entry.attempts} attempt{entry.attempts === 1 ? '' : 's'}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
