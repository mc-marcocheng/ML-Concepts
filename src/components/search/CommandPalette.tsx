'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { CornerDownLeft, Search, X } from 'lucide-react';
import { useUiStore } from '@/lib/store/ui';
import { searchChunks, searchConcepts } from '@/lib/retrieval/search';
import { CATEGORIES } from '@/lib/content/categories';

type Result =
  | { kind: 'concept'; id: string; href: string; title: string; sub: string }
  | { kind: 'section'; id: string; href: string; title: string; sub: string };

const CATEGORY_TITLE = Object.fromEntries(CATEGORIES.map(category => [category.id, category.title]));

export function CommandPalette() {
  const router = useRouter();
  const open = useUiStore(state => state.paletteOpen);
  const openPalette = useUiStore(state => state.openPalette);
  const closePalette = useUiStore(state => state.closePalette);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const shortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (shortcut) {
        event.preventDefault();
        openPalette();
        return;
      }
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      event.preventDefault();
      openPalette();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openPalette]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setResults([]);
    setCursor(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const q = query.trim();
      if (q.length < 2) {
        setResults([]);
        setCursor(0);
        return;
      }

      const [concepts, sections] = await Promise.all([searchConcepts(q, 8), searchChunks(q, 8)]);
      if (cancelled) return;

      const conceptRows: Result[] = concepts.map(concept => ({
        kind: 'concept',
        id: `c:${concept.id}`,
        href: concept.href,
        title: concept.title,
        sub: `${CATEGORY_TITLE[concept.category] ?? concept.category} · ${concept.summary}`,
      }));
      const conceptIds = new Set(concepts.map(concept => concept.id));
      const sectionRows: Result[] = sections
        .filter(section => !conceptIds.has(section.conceptId))
        .map(section => ({
          kind: 'section',
          id: `s:${section.conceptId}:${section.anchor}`,
          href: `/learn/${section.conceptId}/#${section.anchor}`,
          title: `${section.conceptTitle} › ${section.heading}`,
          sub: section.text.slice(0, 120),
        }));

      setResults([...conceptRows, ...sectionRows]);
      setCursor(0);
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, query]);

  const grouped = useMemo(() => {
    const conceptItems = results.filter(result => result.kind === 'concept');
    const sectionItems = results.filter(result => result.kind === 'section');
    return [
      ...(conceptItems.length ? [{ label: 'Concepts', items: conceptItems }] : []),
      ...(sectionItems.length ? [{ label: 'Sections', items: sectionItems }] : []),
    ];
  }, [results]);

  const go = (item: Result) => {
    closePalette();
    router.push(item.href);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor(current => Math.min(results.length - 1, current + 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor(current => Math.max(0, current - 1));
    }
    if (event.key === 'Enter' && results[cursor]) {
      event.preventDefault();
      go(results[cursor]);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closePalette();
    }
  };

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-cursor="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  let index = -1;

  return (
    <Dialog.Root open={open} onOpenChange={value => (value ? openPalette() : closePalette())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgba(17,21,16,.42)]" />
        <Dialog.Content
          onKeyDown={onKeyDown}
          className="fixed left-1/2 top-[max(12vh,72px)] z-50 w-[min(94vw,760px)] -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-canvas shadow-overlay outline-none"
        >
          <Dialog.Title className="sr-only">Search concepts</Dialog.Title>
          <div className="flex items-center gap-3 border-b border-line px-4">
            <Search size={18} aria-hidden="true" className="text-muted" />
            <input
              autoFocus
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search concepts and sections…"
              aria-label="Search concepts and sections"
              className="h-14 w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-muted"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              onClick={closePalette}
              className="grid h-10 w-10 place-items-center rounded-pill text-muted hover:bg-primary-pale hover:text-ink"
              aria-label="Close palette"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div ref={listRef} className="max-h-[min(60vh,520px)] overflow-y-auto p-2">
            {query.trim().length < 2 ? (
              <p className="px-4 py-6 text-[14px] text-muted">Type at least two characters.</p>
            ) : results.length === 0 ? (
              <p className="px-4 py-6 text-[14px] text-muted">No matches.</p>
            ) : grouped.map(group => (
              <div key={group.label} className="mb-1">
                <p className="t-eyebrow px-3 py-2 text-muted">{group.label}</p>
                {group.items.map(item => {
                  index += 1;
                  const currentIndex = index;
                  return (
                    <button
                      key={item.id}
                      data-cursor={currentIndex === cursor}
                      onMouseMove={() => setCursor(currentIndex)}
                      onClick={() => go(item)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ${currentIndex === cursor ? 'bg-primary-pale' : ''}`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-bold text-ink">{item.title}</span>
                        <span className="block truncate text-[13px] text-body">{item.sub}</span>
                      </span>
                      {currentIndex === cursor ? <CornerDownLeft size={14} aria-hidden="true" className="text-muted" /> : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
