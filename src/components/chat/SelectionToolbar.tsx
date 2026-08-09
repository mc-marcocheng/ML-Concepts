'use client';

import { useEffect, useState } from 'react';
import { Highlighter, MessageSquare, Sparkles, Split, StickyNote } from 'lucide-react';
import { useUiStore } from '@/lib/store/ui';
import { captureSelection } from '@/lib/retrieval/selection';
import { contextFromSelection } from '@/lib/retrieval/ask-context';
import { rangeToAnchor } from '@/lib/notes/anchor';
import { newId, upsertNote } from '@/lib/persistence/notes';
import { useAnnotationUi } from '@/lib/store/annotation';

function ActionButton({ onClick, icon: Icon, label }: { onClick: () => void; icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-10 items-center gap-1.5 rounded-pill px-3 text-[13px] font-bold text-ink hover:bg-primary hover:text-on-primary"
    >
      <Icon size={14} aria-hidden />
      {label}
    </button>
  );
}

export function SelectionToolbar() {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [payload, setPayload] = useState<{ anchor: ReturnType<typeof rangeToAnchor> | null; ctx: ReturnType<typeof contextFromSelection> } | null>(null);
  const openAsk = useUiStore(state => state.openAsk);
  const startDraft = useAnnotationUi(state => state.startDraft);

  useEffect(() => {
    let timeout = 0;
    const onSelectionChange = () => {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        const capture = captureSelection();
        if (!capture) { setPosition(null); setPayload(null); return; }
        const rect = capture.range.getBoundingClientRect();
        const noteAnchor = capture.body && capture.body.contains(capture.range.commonAncestorContainer)
          ? rangeToAnchor(capture.body, capture.range)
          : null;
        setPosition({ x: rect.left + rect.width / 2, y: rect.top - 8 });
        setPayload({ anchor: noteAnchor, ctx: contextFromSelection(capture) });
      }, 180);
    };
    document.addEventListener('selectionchange', onSelectionChange);
    const onScroll = () => setPosition(null);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener('selectionchange', onSelectionChange);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, []);

  if (!position || !payload) return null;

  const go = (seed: string) => {
    openAsk(payload.ctx, seed);
    setPosition(null);
    window.getSelection()?.removeAllRanges();
  };

  const createHighlight = () => {
    if (!payload.anchor || !payload.ctx.conceptId) return;
    upsertNote({
      id: newId(),
      conceptId: payload.ctx.conceptId,
      color: 'yellow',
      exact: payload.anchor.exact,
      prefix: payload.anchor.prefix,
      suffix: payload.anchor.suffix,
      start: payload.anchor.start,
      body: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setPosition(null);
    window.getSelection()?.removeAllRanges();
  };

  const createNote = () => {
    if (!payload.anchor) return;
    startDraft(payload.anchor);
    setPosition(null);
  };

  return (
    <div
      role="toolbar"
      aria-label="Selection actions"
      style={{ left: position.x, top: Math.max(64, position.y) }}
      className="fixed z-40 flex -translate-x-1/2 -translate-y-full gap-1 rounded-pill border border-line bg-card p-1 shadow-overlay"
    >
      {payload.anchor ? <ActionButton onClick={createHighlight} icon={Highlighter} label="Highlight" /> : null}
      {payload.anchor ? <ActionButton onClick={createNote} icon={StickyNote} label="Note" /> : null}
      <ActionButton onClick={() => go('Explain this in plain terms, then give the precise statement.')} icon={Sparkles} label="Explain" />
      <ActionButton onClick={() => go('Why is this true? Give the key step of the argument.')} icon={Split} label="Why?" />
      <ActionButton onClick={() => go('')} icon={MessageSquare} label="Ask…" />
    </div>
  );
}
