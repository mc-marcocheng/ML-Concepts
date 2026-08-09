'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { ConceptMeta } from '@/lib/content/types';
import { CATEGORY_TITLE } from '@/lib/content/categories';
import { buildSession, loadConcepts, type QuizEntry, type SessionParams } from '@/lib/quiz/load';
import { computeDueQueue, computeMastery, loadAttempts, type AttemptRecord } from '@/lib/persistence/progress';
import { loadSessions, type SessionRecord } from '@/lib/persistence/sessions';

type Scope = SessionParams['scope'];

const SCOPES: { id: Scope; title: string; description: string }[] = [
  { id: 'concept', title: 'Concept drill', description: 'Every authored item for a single concept.' },
  { id: 'category', title: 'Category sprint', description: 'Mix concepts from one category.' },
  { id: 'weak', title: 'Weak spots', description: 'Concepts where your local mastery is lowest.' },
  { id: 'due', title: 'Due review', description: 'Whatever the spaced-repetition queue says is due.' },
  { id: 'mixed', title: 'Mixed set', description: 'A random spread across the whole library.' },
  { id: 'interview', title: 'Interview sim', description: 'One item per concept, broad and concise.' },
];

const SIZES = [5, 10, 15, 20];

export function QuizLauncherClient() {
  const [concepts, setConcepts] = useState<ConceptMeta[]>([]);
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [scope, setScope] = useState<Scope>('concept');
  const [conceptId, setConceptId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [size, setSize] = useState(10);
  const [preview, setPreview] = useState<{ status: 'loading' | 'ready'; entries: QuizEntry[] }>({ status: 'loading', entries: [] });

  useEffect(() => {
    loadConcepts()
      .then(next => {
        setConcepts(next);
        setConceptId(current => current || next[0]?.id || '');
        setCategoryId(current => current || next[0]?.category || '');
      })
      .catch(() => setConcepts([]));

    const refresh = () => {
      setAttempts(loadAttempts());
      setSessions(loadSessions());
    };
    refresh();
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, []);

  const categories = useMemo(() => [...new Set(concepts.map(concept => concept.category))], [concepts]);

  const dueCount = useMemo(
    () => (concepts.length ? computeDueQueue(concepts, attempts).length : 0),
    [concepts, attempts],
  );
  const weakCount = useMemo(
    () => computeMastery(concepts, attempts).filter(entry => entry.attempts > 0 && entry.mastery < 0.7).length,
    [concepts, attempts],
  );

  const params = useMemo<SessionParams>(() => ({
    scope,
    id: scope === 'concept' ? conceptId || undefined : scope === 'category' ? categoryId || undefined : undefined,
    size,
  }), [scope, conceptId, categoryId, size]);

  useEffect(() => {
    if (!concepts.length) return;
    let cancelled = false;
    setPreview({ status: 'loading', entries: [] });
    const timer = window.setTimeout(() => {
      buildSession(params)
        .then(entries => { if (!cancelled) setPreview({ status: 'ready', entries }); })
        .catch(() => { if (!cancelled) setPreview({ status: 'ready', entries: [] }); });
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [params, concepts.length]);

  const previewConcepts = useMemo(() => {
    const ids = new Set(preview.entries.map(entry => entry.conceptId));
    return concepts.filter(concept => ids.has(concept.id));
  }, [preview.entries, concepts]);

  const previewMastery = useMemo(() => {
    if (!previewConcepts.length) return null;
    const scored = computeMastery(previewConcepts, attempts).filter(entry => entry.attempts > 0);
    if (!scored.length) return null;
    return scored.reduce((sum, entry) => sum + entry.mastery, 0) / scored.length;
  }, [previewConcepts, attempts]);

  const href = useMemo(() => {
    const search = new URLSearchParams({ scope, size: String(size) });
    if (params.id) search.set('id', params.id);
    return `/quiz/session/?${search.toString()}`;
  }, [scope, size, params.id]);

  const itemCount = preview.entries.length;
  const canStart = preview.status === 'ready' && itemCount > 0;

  return (
    <div className="band band--soft">
      <div className="container-wide py-8">
        <p className="t-eyebrow text-muted">Quiz</p>
        <h1 className="t-display-lg mt-3">Drill the parts you will actually be asked</h1>
        <p className="mt-4 max-w-[62ch] text-[17px] leading-7 text-body">
          Pick a mode, set the scope, and check the preview before you commit to a session.
        </p>

        <div className="mt-8 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-lg border border-line bg-card p-6">
            <p className="t-eyebrow text-muted">Session mode</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {SCOPES.map(item => {
                const badge = item.id === 'due' ? dueCount : item.id === 'weak' ? weakCount : null;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={scope === item.id}
                    onClick={() => setScope(item.id)}
                    className={`rounded-lg border p-4 text-left transition-transform hover:-translate-y-0.5 ${scope === item.id ? 'border-line-strong bg-primary-pale' : 'border-line bg-canvas-soft'}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[15px] font-extrabold text-ink">{item.title}</span>
                      {badge !== null ? <span className="font-mono text-[12px] text-muted">{badge}</span> : null}
                    </span>
                    <span className="mt-2 block text-[13px] leading-6 text-body">{item.description}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {scope === 'concept' ? (
                <label className="grid gap-2">
                  <span className="t-eyebrow text-muted">Concept</span>
                  <select value={conceptId} onChange={event => setConceptId(event.target.value)} className="h-12 rounded-lg border border-line bg-canvas-soft px-4 text-[15px] text-ink">
                    {concepts.map(concept => (
                      <option key={concept.id} value={concept.id}>{concept.title}</option>
                    ))}
                  </select>
                </label>
              ) : scope === 'category' ? (
                <label className="grid gap-2">
                  <span className="t-eyebrow text-muted">Category</span>
                  <select value={categoryId} onChange={event => setCategoryId(event.target.value)} className="h-12 rounded-lg border border-line bg-canvas-soft px-4 text-[15px] text-ink">
                    {categories.map(category => (
                      <option key={category} value={category}>{CATEGORY_TITLE[category] ?? category}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="rounded-lg border border-line bg-canvas-soft p-4">
                  <p className="t-eyebrow text-muted">Scope</p>
                  <p className="mt-2 text-[15px] leading-6 text-body">
                    {SCOPES.find(item => item.id === scope)?.description}
                  </p>
                </div>
              )}

              <div className="grid gap-2">
                <span className="t-eyebrow text-muted">Session size</span>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Session size">
                  {SIZES.map(value => (
                    <button
                      key={value}
                      type="button"
                      disabled={scope === 'concept'}
                      aria-pressed={size === value}
                      onClick={() => setSize(value)}
                      className={`min-h-11 rounded-pill border px-4 text-[14px] font-semibold disabled:opacity-40 ${size === value ? 'border-line-strong bg-primary-pale text-ink' : 'border-line bg-canvas-soft text-body'}`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                {scope === 'concept' ? (
                  <p className="text-[13px] text-muted">Concept drills always run every authored item.</p>
                ) : null}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              {canStart ? (
                <Link href={href} className="inline-flex items-center justify-center rounded-pill bg-primary px-5 py-3.5 font-bold text-on-primary shadow-offset">
                  Start {itemCount} item{itemCount === 1 ? '' : 's'}
                </Link>
              ) : (
                <span aria-disabled="true" className="inline-flex cursor-not-allowed items-center justify-center rounded-pill bg-primary px-5 py-3.5 font-bold text-on-primary opacity-50">
                  {preview.status === 'loading' ? 'Building preview…' : 'No items for this scope'}
                </span>
              )}
              <Link href="/review" className="rounded-pill border border-line bg-canvas-soft px-4 py-2.5 text-[14px] font-semibold text-ink">
                Open due review
              </Link>
            </div>
          </section>

          <aside className="grid gap-4">
            <section className="rounded-lg border border-line bg-card p-6">
              <p className="t-eyebrow text-muted">Session preview</p>
              <p className="mt-3 text-[34px] font-extrabold tracking-[-.04em] text-ink">{preview.status === 'loading' ? '—' : itemCount}</p>
              <p className="text-[15px] text-body">
                item{itemCount === 1 ? '' : 's'} across {previewConcepts.length} concept{previewConcepts.length === 1 ? '' : 's'}
              </p>
              <p className="mt-2 font-mono text-[12px] text-muted">
                Mastery in scope: {previewMastery === null ? 'no attempts yet' : `${Math.round(previewMastery * 100)}%`}
              </p>
              {previewConcepts.length ? (
                <ul className="mt-4 grid gap-1">
                  {previewConcepts.slice(0, 6).map(concept => (
                    <li key={concept.id} className="truncate text-[14px] text-body">{concept.title}</li>
                  ))}
                  {previewConcepts.length > 6 ? (
                    <li className="font-mono text-[12px] text-muted">+{previewConcepts.length - 6} more</li>
                  ) : null}
                </ul>
              ) : null}
            </section>

            <section className="rounded-lg border border-line bg-card p-6">
              <p className="t-eyebrow text-muted">Last session</p>
              {sessions.length ? (
                <div className="mt-3">
                  <p className="text-[15px] text-ink">
                    {sessions[0].items.length} item{sessions[0].items.length === 1 ? '' : 's'} · {sessions[0].params.scope}
                  </p>
                  <p className="mt-1 font-mono text-[12px] text-muted">
                    {new Date(sessions[0].completedAt).toLocaleString()} ·{' '}
                    {Math.round(
                      (sessions[0].items.reduce((sum, item) => sum + item.score, 0) / Math.max(1, sessions[0].items.length)) * 100,
                    )}%
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-[15px] leading-7 text-body">No sessions recorded in this browser yet.</p>
              )}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
