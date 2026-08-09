'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ConceptMeta } from '@/lib/content/types';
import { Button } from '@/components/ui/Button';
import { loadConcepts } from '@/lib/quiz/load';

type Scope = 'concept' | 'category' | 'weak' | 'due' | 'mixed' | 'interview';

const SCOPE_META: Record<Scope, { title: string; description: string }> = {
  concept: { title: 'Concept drill', description: 'Focus on one concept and its authored quiz items.' },
  category: { title: 'Category sprint', description: 'Mix concepts from a chosen category into one session.' },
  weak: { title: 'Weak spots', description: 'Prioritise concepts where your local mastery is lowest.' },
  due: { title: 'Due review', description: 'Use the current due queue from local progress history.' },
  mixed: { title: 'Mixed set', description: 'Build a random mixed session across the library.' },
  interview: { title: 'Interview sim', description: 'Practice concise answers with a broad mix of topics and one question per concept.' },
};

export function QuizLauncherClient() {
  const path = usePathname();
  const [concepts, setConcepts] = useState<ConceptMeta[]>([]);
  const [scope, setScope] = useState<Scope>('concept');
  const [conceptId, setConceptId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [size, setSize] = useState(10);

  useEffect(() => {
    loadConcepts().then(next => {
      setConcepts(next);
      setConceptId(next[0]?.id ?? '');
      setCategoryId(next[0]?.category ?? '');
    }).catch(() => setConcepts([]));
  }, []);

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const concept of concepts) {
      if (!seen.has(concept.category)) seen.set(concept.category, concept.category);
    }
    return [...seen.keys()];
  }, [concepts]);

  const href = useMemo(() => {
    const params = new URLSearchParams({ scope, size: String(size) });
    if (scope === 'concept' && conceptId) params.set('id', conceptId);
    if (scope === 'category' && categoryId) params.set('id', categoryId);
    return `/quiz/session/?${params.toString()}`;
  }, [categoryId, conceptId, scope, size]);

  const activeMeta = SCOPE_META[scope];

  return (
    <div className="band band--soft">
      <div className="container-wide py-8">
        <p className="t-eyebrow text-muted">Quiz</p>
        <h1 className="t-display-lg mt-3">Drill the parts you will actually be asked</h1>
        <p className="mt-4 max-w-[62ch] text-[17px] leading-7 text-body">
          Choose a session mode, pick the scope, and start a deterministic quiz set from the seed library.
        </p>

        <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-lg border border-line bg-card p-6">
            <p className="t-eyebrow text-muted">Session mode</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {(Object.keys(SCOPE_META) as Scope[]).map(item => (
                <button
                  key={item}
                  onClick={() => setScope(item)}
                  className={`rounded-lg border p-4 text-left transition-transform hover:-translate-y-0.5 ${scope === item ? 'border-line-strong bg-primary-pale' : 'border-line bg-canvas-soft'}`}
                >
                  <p className="text-[15px] font-extrabold text-ink">{SCOPE_META[item].title}</p>
                  <p className="mt-2 text-[13px] leading-6 text-body">{SCOPE_META[item].description}</p>
                </button>
              ))}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {scope === 'concept' ? (
                <label className="grid gap-2">
                  <span className="t-eyebrow text-muted">Concept</span>
                  <select value={conceptId} onChange={event => setConceptId(event.target.value)} className="h-12 rounded-lg border border-line bg-canvas-soft px-4 text-[15px] text-ink">
                    {concepts.map(concept => <option key={concept.id} value={concept.id}>{concept.title}</option>)}
                  </select>
                </label>
              ) : scope === 'category' ? (
                <label className="grid gap-2">
                  <span className="t-eyebrow text-muted">Category</span>
                  <select value={categoryId} onChange={event => setCategoryId(event.target.value)} className="h-12 rounded-lg border border-line bg-canvas-soft px-4 text-[15px] text-ink">
                    {categories.map(category => <option key={category} value={category}>{category}</option>)}
                  </select>
                </label>
              ) : (
                <div className="rounded-lg border border-line bg-canvas-soft p-4">
                  <p className="t-eyebrow text-muted">Scope</p>
                  <p className="mt-2 text-[15px] leading-6 text-body">{activeMeta.description}</p>
                </div>
              )}

              <label className="grid gap-2">
                <span className="t-eyebrow text-muted">Session size</span>
                <select value={size} onChange={event => setSize(Number(event.target.value))} className="h-12 rounded-lg border border-line bg-canvas-soft px-4 text-[15px] text-ink">
                  {[5, 10, 15, 20].map(next => <option key={next} value={next}>{next} items</option>)}
                </select>
              </label>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <Link href={href} className="inline-flex items-center justify-center rounded-pill bg-primary px-5 py-3.5 font-bold text-on-primary shadow-offset">
                Start session
              </Link>
              <Link href="/review" className="rounded-pill border border-line bg-canvas-soft px-4 py-2.5 text-[14px] font-semibold text-ink">
                Open due review
              </Link>
            </div>
            {scope === 'interview' ? <p className="mt-4 text-[13px] text-muted">Interview sim uses one item per concept where possible, so the set stays broad and closer to a real screening.</p> : null}
          </section>

          <aside className="rounded-lg border border-line bg-card p-6">
            <p className="t-eyebrow text-muted">Quick jump</p>
            <div className="mt-4 grid gap-2">
              {concepts.slice(0, 6).map(concept => (
                <Link key={concept.id} href={`/quiz/session/?scope=concept&id=${encodeURIComponent(concept.id)}`} className="app-row justify-between border border-line bg-canvas-soft px-4 py-3">
                  <span className="truncate">{concept.title}</span>
                  <span className="font-mono text-[12px] text-muted">{concept.quizCount}</span>
                </Link>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
