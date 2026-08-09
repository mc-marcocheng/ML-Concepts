'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { LayoutGrid, Route, Search, SlidersHorizontal, X } from 'lucide-react';
import { CATEGORIES } from '@/lib/content/categories';
import type { ConceptMeta } from '@/lib/content/types';
import { groupConceptsByCategory } from '@/lib/content/order';
import { buildConceptGraph } from '@/lib/content/graph';
import { RoadmapGraph } from './RoadmapGraph';
import { computeMastery, loadAttempts, type AttemptRecord } from '@/lib/persistence/progress';
import { MasteryRing } from './MasteryRing';
import { cn } from '@/lib/utils/cn';

type Filter = 'all' | 'started' | 'weak';
type View = 'roadmap' | 'grid';
const VIEW_KEY = 'mlc.conceptView';

export function ConceptIndex({ concepts }: { concepts: ConceptMeta[] }) {
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [filter, setFilter] = useState<Filter>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState<View>('roadmap');

  useEffect(() => {
    const refresh = () => setAttempts(loadAttempts());
    refresh();
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(VIEW_KEY);
      if (stored === 'grid' || stored === 'roadmap') setView(stored);
    } catch {
      // ignore storage failures
    }
  }, []);

  const changeView = (next: View) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // ignore storage failures
    }
  };

  const masteryById = useMemo(() => {
    const map = new Map<string, { mastery: number; attempts: number }>();
    for (const entry of computeMastery(concepts, attempts)) {
      map.set(entry.concept.id, { mastery: entry.mastery, attempts: entry.attempts });
    }
    return map;
  }, [attempts, concepts]);

  const graph = useMemo(() => buildConceptGraph(concepts), [concepts]);

  const orderedGroups = useMemo(() => groupConceptsByCategory(concepts), [concepts]);

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = (concept: ConceptMeta) => {
      if (category !== 'all' && concept.category !== category) return false;
      const text = `${concept.title} ${concept.summary} ${concept.tags.join(' ')}`.toLowerCase();
      if (needle && !text.includes(needle)) return false;
      if (filter === 'started') return (masteryById.get(concept.id)?.attempts ?? 0) > 0;
      if (filter === 'weak') {
        return (masteryById.get(concept.id)?.attempts ?? 0) > 0 && (masteryById.get(concept.id)?.mastery ?? 0) < 0.7;
      }
      return true;
    };
    return orderedGroups
      .map(group => ({ ...group, items: group.items.filter(entry => matches(entry.concept)) }))
      .filter(group => group.items.length > 0);
  }, [orderedGroups, query, category, filter, masteryById]);

  const visibleConcepts = useMemo(() => groups.flatMap(group => group.items.map(item => item.concept)), [groups]);

  const activeFilterCount = (category === 'all' ? 0 : 1) + (filter === 'all' ? 0 : 1);
  const resetFilters = () => {
    setCategory('all');
    setFilter('all');
  };

  return (
    <div className="band band--soft">
      <div className="container-wide py-8">
        <p className="t-eyebrow text-muted">Library</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <h1 className="t-display-lg">Concepts</h1>
          <div className="inline-flex rounded-pill border border-line bg-card p-1" role="group" aria-label="Layout">
            <ViewButton active={view === 'roadmap'} onClick={() => changeView('roadmap')} icon={Route} label="Roadmap" />
            <ViewButton active={view === 'grid'} onClick={() => changeView('grid')} icon={LayoutGrid} label="Grid" />
          </div>
        </div>

        <div className="sticky top-(--header-h) z-20 -mx-2 mt-6 bg-canvas-soft/85 px-2 py-3 backdrop-blur-[10px]">
          <div className="flex items-end gap-2 md:block">
            <label className="relative block flex-1">
              <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <span className="sr-only">Filter concepts</span>
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Filter by name or summary…"
                className="h-12 w-full rounded-pill border border-line bg-card pl-11 pr-4 text-[15px] text-ink outline-none focus:border-line-strong md:pr-4"
              />
            </label>

            <div className="md:hidden">
              <button
                type="button"
                onClick={() => setFiltersOpen(open => !open)}
                aria-expanded={filtersOpen}
                aria-controls="concept-filters"
                className="inline-flex min-h-11 items-center gap-2 rounded-pill border border-line bg-card px-4 text-[14px] font-semibold text-ink hover:bg-primary-pale"
              >
                <SlidersHorizontal size={16} aria-hidden="true" />
                Filters
                {activeFilterCount ? (
                  <span className="rounded-pill bg-primary px-2 py-0.5 font-mono text-[11px] text-on-primary">{activeFilterCount}</span>
                ) : null}
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 md:hidden">
            {activeFilterCount ? (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-pill px-3 text-[13px] font-semibold text-muted hover:bg-primary-pale hover:text-ink"
              >
                <X size={14} aria-hidden="true" /> Reset
              </button>
            ) : null}
          </div>

          <div id="concept-filters" className={cn('mt-3 flex-wrap gap-2 md:flex', filtersOpen ? 'flex' : 'hidden')}>
            <Chip active={category === 'all'} onClick={() => setCategory('all')}>All areas</Chip>
            {CATEGORIES.map(cat => (
              <Chip key={cat.id} active={category === cat.id} onClick={() => setCategory(cat.id)}>
                {cat.short}
              </Chip>
            ))}
            <span className="mx-1 w-px self-stretch bg-line" aria-hidden="true" />
            <Chip active={filter === 'all'} onClick={() => setFilter('all')}>All</Chip>
            <Chip active={filter === 'started'} onClick={() => setFilter('started')}>Started</Chip>
            <Chip active={filter === 'weak'} onClick={() => setFilter('weak')}>Weak</Chip>
          </div>
        </div>

        {view === 'roadmap' ? (
          <RoadmapGraph graph={graph} visible={visibleConcepts} masteryById={masteryById} />
        ) : (
          <>
            {groups.length === 0 ? (
              <p className="mt-10 rounded-lg border border-line bg-card p-6 text-[15px] text-body">
                No concepts match that filter.
              </p>
            ) : null}

            {groups.map(group => (
              <section key={group.id} id={group.id} className="mt-10">
                <div className="flex items-baseline gap-3">
                  <h2 className="t-display-sm">{group.title}</h2>
                  <span className="font-mono text-[12px] text-muted">{group.items.length}</span>
                </div>
                <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {group.items.map(({ concept, cycleBreak }) => {
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
                          {cycleBreak ? (
                            <p className="mt-4 font-mono text-[12px] text-muted">circular prereq</p>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function ViewButton({ active, onClick, icon: Icon, label }: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: typeof Route;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex min-h-9 items-center gap-2 rounded-pill px-3.5 text-[13px] font-semibold transition-colors',
        active ? 'bg-primary text-on-primary' : 'text-ink hover:bg-primary-pale',
      )}
    >
      <Icon size={15} aria-hidden={true} />
      {label}
    </button>
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
