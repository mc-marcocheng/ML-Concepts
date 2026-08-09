'use client';

import { createPortal } from 'react-dom';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { applyHighlights, setActiveHighlight, type AppliedNote } from '@/lib/notes/anchor';
import { deleteNote, loadNotes, newId, upsertNote, type HighlightColor, type NoteRecord } from '@/lib/persistence/notes';
import { useAnnotationUi } from '@/lib/store/annotation';

const GAP = 12;
const COLORS: HighlightColor[] = ['yellow', 'green', 'blue', 'pink'];

const quote = (value: string) => value.replace(/\s+/g, ' ').trim();

function stack(cards: { id: string; desiredTop: number; height: number }[]) {
  const sorted = [...cards].sort((a, b) => a.desiredTop - b.desiredTop);
  const tops = new Map<string, number>();
  let cursor = -Infinity;
  for (const card of sorted) {
    const top = Math.max(card.desiredTop, cursor + GAP);
    tops.set(card.id, top);
    cursor = top + card.height;
  }
  return tops;
}

export function ConceptAnnotations({ conceptId, conceptTitle }: { conceptId: string; conceptTitle: string }) {
  const draft = useAnnotationUi(state => state.draft);
  const clearDraft = useAnnotationUi(state => state.clearDraft);
  const [rail, setRail] = useState<HTMLElement | null>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);
  const [shell, setShell] = useState<HTMLElement | null>(null);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [applied, setApplied] = useState<AppliedNote[]>([]);
  const [tops, setTops] = useState<Map<string, number>>(new Map());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    const sync = () => setNotes(loadNotes().filter(note => note.conceptId === conceptId));
    sync();
    window.addEventListener('mlc:notes', sync as EventListener);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('mlc:notes', sync as EventListener);
      window.removeEventListener('storage', sync);
    };
  }, [conceptId]);

  useEffect(() => {
    setRail(document.querySelector<HTMLElement>('[data-note-rail]'));
    setBody(document.querySelector<HTMLElement>('[data-concept-body]'));
    setShell(document.querySelector<HTMLElement>('[data-concept-shell]'));
  }, []);

  const reapply = useCallback(() => {
    if (!body || !shell) return;
    setApplied(applyHighlights(body, shell, notes));
  }, [body, notes, shell]);

  useLayoutEffect(() => { reapply(); }, [reapply]);

  useEffect(() => {
    if (!body) return;
    const resize = new ResizeObserver(() => reapply());
    resize.observe(body);
    document.fonts?.ready.then(reapply).catch(() => {});
    window.addEventListener('resize', reapply);
    return () => {
      resize.disconnect();
      window.removeEventListener('resize', reapply);
    };
  }, [body, reapply]);

  useEffect(() => {
    if (!body) return;
    const onClick = (event: MouseEvent) => {
      const mark = (event.target as HTMLElement | null)?.closest?.('mark[data-highlight-id]') as HTMLElement | null;
      if (!mark) return;
      const id = mark.dataset.highlightId ?? null;
      setActiveId(id);
      if (id) {
        const card = cardRefs.current.get(id);
        card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        card?.focus?.();
      }
    };
    body.addEventListener('click', onClick);
    return () => body.removeEventListener('click', onClick);
  }, [body]);

  useEffect(() => {
    if (body) setActiveHighlight(body, activeId);
  }, [activeId, body]);

  useLayoutEffect(() => {
    const cards = applied.filter(item => item.resolved).map(item => ({
      id: item.note.id,
      desiredTop: item.top,
      height: cardRefs.current.get(item.note.id)?.offsetHeight ?? 96,
    }));
    setTops(stack(cards));
  }, [applied, editing]);

  const saveDraft = (color: HighlightColor, text: string) => {
    if (!draft) return;
    const note: NoteRecord = {
      id: newId(),
      conceptId,
      color,
      exact: draft.exact,
      prefix: draft.prefix,
      suffix: draft.suffix,
      start: draft.start,
      body: text.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    upsertNote(note);
    clearDraft();
    window.getSelection()?.removeAllRanges();
    setActiveId(note.id);
  };

  const resolved = applied.filter(item => item.resolved);
  const orphans = notes.filter(note => !resolved.some(item => item.note.id === note.id));

  const portal = rail ? createPortal(
    <>
      {resolved.map(item => (
        <NoteCard
          key={item.note.id}
          note={item.note}
          top={tops.get(item.note.id) ?? item.top}
          active={activeId === item.note.id}
          editing={editing === item.note.id}
          onRef={el => { if (el) cardRefs.current.set(item.note.id, el); else cardRefs.current.delete(item.note.id); }}
          onHover={hover => setActiveId(hover ? item.note.id : null)}
          onEdit={() => setEditing(item.note.id)}
          onCancel={() => setEditing(null)}
          onSave={text => { upsertNote({ ...item.note, body: text.trim() }); setEditing(null); }}
          onColor={color => upsertNote({ ...item.note, color })}
          onDelete={() => { deleteNote(item.note.id); setEditing(null); }}
        />
      ))}
    </>,
    rail,
  ) : null;

  return (
    <>
      {portal}

      {draft ? <DraftComposer onCancel={clearDraft} onSave={saveDraft} quote={quote(draft.exact)} /> : null}

      <section className="mt-10 md:hidden" aria-label={`Notes for ${conceptTitle}`}>
        <div>
          <p className="t-eyebrow text-muted">Notes ({notes.length})</p>
          <div className="mt-3 grid gap-3">
            {notes.length === 0 ? (
              <p className="text-[15px] leading-7 text-body">Select text in the article and choose Note or Highlight to attach a comment to it.</p>
            ) : null}
            {resolved.map(item => (
              <InlineNote key={item.note.id} note={item.note} onDelete={() => deleteNote(item.note.id)} />
            ))}
            {orphans.length ? (
              <details className="collapsible mt-2">
                <summary><span className="uppercase tracking-[.08em] text-[11px] text-muted">Unplaced notes ({orphans.length})</span></summary>
                <div className="collapsible__body grid gap-3">
                  {orphans.map(note => <InlineNote key={note.id} note={note} onDelete={() => deleteNote(note.id)} />)}
                </div>
              </details>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}

function NoteCard({ note, top, active, editing, onRef, onHover, onEdit, onCancel, onSave, onColor, onDelete }: {
  note: NoteRecord;
  top: number;
  active: boolean;
  editing: boolean;
  onRef: (el: HTMLElement | null) => void;
  onHover: (hover: boolean) => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (text: string) => void;
  onColor: (color: HighlightColor) => void;
  onDelete: () => void;
}) {
  const [text, setText] = useState(note.body);

  useEffect(() => {
    setText(note.body);
  }, [note.body, editing]);

  return (
    <article
      ref={onRef}
      tabIndex={-1}
      style={{ top }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      className={`note-card rounded-lg border bg-card p-3 text-[13px] leading-6 outline-none ${active ? 'border-line-strong shadow-soft' : 'border-line'}`}
    >
      <p className="mb-2 line-clamp-2 border-l-2 border-line-strong pl-2 font-mono text-[11px] text-muted">{quote(note.exact)}</p>
      {editing ? (
        <>
          <textarea
            value={text}
            onChange={event => setText(event.target.value)}
            rows={4}
            autoFocus
            className="w-full rounded-md border border-line bg-canvas-soft p-2 text-[13px] text-ink outline-none focus:border-line-strong"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button size="sm" onClick={() => onSave(text)}>Save</Button>
            <Button size="sm" variant="quiet" onClick={onCancel}>Cancel</Button>
          </div>
        </>
      ) : (
        <>
          {note.body ? <p className="whitespace-pre-wrap text-body">{note.body}</p> : <p className="text-muted">Highlight</p>}
          <div className="mt-2 flex items-center gap-1.5">
            {COLORS.map(color => (
              <button
                key={color}
                onClick={() => onColor(color)}
                aria-label={`Colour ${color}`}
                data-color={color}
                className={`h-4 w-4 rounded-full border ${note.color === color ? 'border-line-strong' : 'border-line'}`}
                style={{ background: `var(--hl-${color})` }}
              />
            ))}
            <button onClick={onEdit} className="ml-auto rounded-pill px-2 py-1 text-[12px] font-semibold text-ink hover:bg-primary-pale">
              {note.body ? 'Edit' : 'Add note'}
            </button>
            <button onClick={onDelete} aria-label="Delete note" className="grid h-7 w-7 place-items-center rounded-pill text-muted hover:bg-negative-pale hover:text-negative-content">
              <Trash2 size={13} aria-hidden="true" />
            </button>
          </div>
        </>
      )}
    </article>
  );
}

function InlineNote({ note, onDelete }: { note: NoteRecord; onDelete: () => void }) {
  return (
    <article className="rounded-lg border border-line bg-canvas-soft p-4">
      <p className="border-l-2 border-line-strong pl-2 font-mono text-[12px] text-muted">{quote(note.exact) || '(unplaced)'}</p>
      {note.body ? <p className="mt-2 whitespace-pre-wrap text-[14px] leading-6 text-body">{note.body}</p> : null}
      <button onClick={onDelete} className="mt-2 text-[12px] font-semibold text-muted underline">Delete</button>
    </article>
  );
}

function DraftComposer({ quote, onCancel, onSave }: { quote: string; onCancel: () => void; onSave: (color: HighlightColor, text: string) => void }) {
  const [text, setText] = useState('');
  const [color, setColor] = useState<HighlightColor>('yellow');

  return (
    <div
      role="dialog"
      aria-label="New note"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-[min(100%,520px)] rounded-t-xl border border-line bg-canvas p-4 shadow-overlay pb-[max(16px,env(safe-area-inset-bottom))] md:bottom-6 md:rounded-xl"
    >
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 line-clamp-2 border-l-2 border-line-strong pl-2 font-mono text-[12px] text-muted">{quote}</p>
        <button onClick={onCancel} aria-label="Cancel note" className="grid h-8 w-8 place-items-center rounded-pill hover:bg-primary-pale">
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <textarea
        value={text}
        onChange={event => setText(event.target.value)}
        rows={3}
        autoFocus
        placeholder="Write a note (optional) - leave blank to just highlight"
        className="mt-3 w-full rounded-md border border-line bg-canvas-soft p-3 text-[14px] text-ink outline-none focus:border-line-strong"
      />
      <div className="mt-3 flex items-center gap-2">
        {COLORS.map(entry => (
          <button
            key={entry}
            onClick={() => setColor(entry)}
            aria-label={`Colour ${entry}`}
            className={`h-6 w-6 rounded-full border-2 ${color === entry ? 'border-line-strong' : 'border-line'}`}
            style={{ background: `var(--hl-${entry})` }}
          />
        ))}
        <Button size="sm" className="ml-auto" onClick={() => onSave(color, text)}>Save</Button>
      </div>
    </div>
  );
}