'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { CATEGORIES } from '@/lib/content/categories';
import type { ConceptMeta } from '@/lib/content/types';
import { computeMastery, loadAttempts, type AttemptRecord } from '@/lib/persistence/progress';
import { MasteryRing } from './MasteryRing';

type Filter = 'all' | 'written' | 'started' | 'weak';

export function ConceptIndex({ concepts }: { concepts: ConceptMeta[] }) {
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    const refresh = () => setAttempts(loadAttempts());
    refresh();
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, []);

  const masteryById = useMemo(() => {
    const map = new Map<string, { mastery: number; attempts: number }>();
    for (const entry of computeMastery(concepts, attempts)) {
      map.set(entry.concept.id, { mastery: entry.mastery, attempts: entry.attempts });
    }
    return map;
  }, [attempts, concepts]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATEGORIES.map(cat => {
      const items = concepts.filter(concept => {
        if (concept.category !== cat.id) return false;
        if (category !== 'all' && cat.id !== category) return false;
        const text = `${concept.title} ${concept.summary}`;
        if (q && !text.toLowerCase().includes(q)) return false;
        if (filter === 'written') return true;
        if (filter === 'started') return (masteryById.get(concept.id)?.attempts ?? 0) > 0;
        if (filter === 'weak') return (masteryById.get(concept.id)?.attempts ?? 0) > 0 && (masteryById.get(concept.id)?.mastery ?? 0) < 0.7;
        return true;
      });
      return { cat, items };
    }).filter(group => group.items.length);
  }, [category, concepts, filter, masteryById, query]);

  const writtenCount = concepts.length;

  return (
    <div className="band band--soft">
      <div className="container-wide py-8">
        <p className="t-eyebrow text-muted">Library</p>
        <h1 className="t-display-lg mt-3">Concepts</h1>
        <p className="mt-3 max-w-[62ch] text-[16px] leading-7 text-body">
          {writtenCount} concepts are written. Use the filters below to narrow the library by category, progress, or text.
        </p>

        <div className="sticky top-(--header-h) z-20 -mx-2 mt-6 bg-canvas-soft/85 px-2 py-3 backdrop-blur-[10px]">
          <label className="relative block">
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <span className="sr-only">Filter concepts</span>
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Filter by name or summary…"
              className="h-12 w-full rounded-pill border border-line bg-card pl-11 pr-4 text-[15px] text-ink outline-none focus:border-line-strong"
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            <Chip active={category === 'all'} onClick={() => setCategory('all')}>All areas</Chip>
            {CATEGORIES.map(cat => (
              <Chip key={cat.id} active={category === cat.id} onClick={() => setCategory(cat.id)}>
                {cat.short}
              </Chip>
            ))}
            <span className="mx-1 w-px self-stretch bg-line" aria-hidden="true" />
            <Chip active={filter === 'all'} onClick={() => setFilter('all')}>All</Chip>
            <Chip active={filter === 'written'} onClick={() => setFilter('written')}>Written</Chip>
            <Chip active={filter === 'started'} onClick={() => setFilter('started')}>Started</Chip>
            <Chip active={filter === 'weak'} onClick={() => setFilter('weak')}>Weak</Chip>
          </div>
        </div>

        {grouped.length === 0 ? (
          <p className="mt-10 rounded-lg border border-line bg-card p-6 text-[15px] text-body">
            No concepts match that filter.
          </p>
        ) : null}

        {grouped.map(({ cat, items }) => (
          <section key={cat.id} className="mt-10">
            <div className="flex items-baseline gap-3">
              <h2 className="t-display-sm">{cat.title}</h2>
              <span className="font-mono text-[12px] text-muted">{items.length}</span>
            </div>
            <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map(concept => {
                const mastery = masteryById.get(concept.id);
                return (
                  <li key={concept.id}>
                    <Link
                      href={concept.href}
                      className="flex h-full flex-col rounded-lg border border-line bg-card p-5 transition-transform hover:-translate-y-1 hover:shadow-soft"
                    >
                      <div className="flex items-start gap-3">
                        <h3 className="min-w-0 flex-1 text-[17px] font-extrabold leading-6 text-ink">{concept.title}</h3>
                        <MasteryRing value={mastery?.mastery ?? 0} started={(mastery?.attempts ?? 0) > 0} />
                      </div>
                      <p className="mt-2 line-clamp-3 text-[14px] leading-6 text-body">{concept.summary}</p>
                      <p className="mt-4 flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted">
                        <span>d{concept.difficulty}/5</span>
                        <span aria-hidden="true">·</span>
                        <span>{concept.estReadMin} min</span>
                        <span aria-hidden="true">·</span>
                        <span>{concept.quizCount} quiz</span>
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-9 rounded-pill border px-3 text-[13px] font-semibold transition-colors ${
        active ? 'border-line-strong bg-primary text-on-primary' : 'border-line bg-card text-ink hover:bg-primary-pale'
      }`}
    >
      {children}
    </button>
  );
}