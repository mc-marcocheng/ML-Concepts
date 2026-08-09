'use client';

import { useState } from 'react';
import type { AskContext } from '@/lib/llm/types';

export function ContextChip({ ctx, onClearSelection, onClearAll }: { ctx: AskContext; onClearSelection: () => void; onClearAll: () => void }) {
  const [open, setOpen] = useState(false);
  const headings = ctx.headings?.length ? ctx.headings : ctx.heading ? [ctx.heading] : [];
  const hasSelection = Boolean(ctx.selection?.trim());
  return (
    <div className="border-b border-line px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-pill bg-primary-pale px-3 py-1 text-[12px] font-semibold text-ink">{ctx.conceptTitle ?? 'Context'}</span>
        {headings.length ? <span className="rounded-pill bg-canvas-soft px-3 py-1 text-[12px] font-mono text-muted">{headings.slice(0, 3).join(' → ')}{headings.length > 3 ? ' → …' : ''}</span> : null}
        {hasSelection ? <button onClick={() => setOpen(value => !value)} className="rounded-pill border border-line bg-card px-3 py-1 text-[12px] font-semibold text-ink hover:bg-primary-pale">{open ? 'Hide highlight' : 'Show highlight'}</button> : null}
        {hasSelection ? <button onClick={onClearSelection} className="rounded-pill border border-line bg-card px-3 py-1 text-[12px] font-semibold text-ink hover:bg-primary-pale">Clear highlight</button> : null}
        <button onClick={onClearAll} className="rounded-pill border border-line bg-card px-3 py-1 text-[12px] font-semibold text-ink hover:bg-primary-pale">
          Clear
        </button>
      </div>
      {open && hasSelection ? <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-canvas-soft p-3 font-mono text-[12px] text-body">{ctx.selection}</pre> : null}
    </div>
  );
}
