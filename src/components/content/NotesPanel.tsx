'use client';

import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { deleteNote, loadNotes, saveNote, type NoteRecord } from '@/lib/persistence/notes';

export function NotesPanel({ conceptId, conceptTitle }: { conceptId: string; conceptTitle: string }) {
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState<NoteRecord[]>([]);

  useEffect(() => {
    const refresh = () => setNotes(loadNotes().filter(note => note.conceptId === conceptId));
    refresh();
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, [conceptId]);

  const latest = useMemo(() => notes[0], [notes]);

  const persist = () => {
    saveNote(conceptId, value);
    setNotes(loadNotes().filter(note => note.conceptId === conceptId));
  };

  return (
    <section className="mt-8 rounded-lg border border-line bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="t-eyebrow text-muted">Notes</p>
          <h2 className="mt-2 text-[18px] font-extrabold text-ink">Personal notes for {conceptTitle}</h2>
        </div>
        <Button
          variant="tertiary"
          size="sm"
          onClick={() => {
            loadNotes().filter(note => note.conceptId === conceptId && !note.exact).forEach(note => deleteNote(note.id));
            setValue('');
            setNotes([]);
          }}
          disabled={!notes.length && !value.trim()}
        >
          <Trash2 size={14} aria-hidden="true" /> Clear
        </Button>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-2">
          <span className="t-eyebrow text-muted">Write a note or memory hook</span>
          <textarea
            value={value}
            onChange={event => setValue(event.target.value)}
            rows={4}
            placeholder="Summarize the key idea, write a trick, or note where you got confused."
            className="w-full rounded-lg border border-line bg-canvas-soft p-4 text-[15px] leading-7 text-ink outline-none focus:border-line-strong"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button onClick={persist} disabled={!value.trim()}>Save note</Button>
          <Button variant="tertiary" size="sm" onClick={() => setValue(latest?.text ?? '')} disabled={!latest?.text}>Restore latest</Button>
        </div>
      </div>

      {notes.length ? (
        <div className="mt-6 grid gap-3">
          <p className="t-eyebrow text-muted">Saved notes</p>
          {notes.map(note => (
            <article key={note.updatedAt} className="rounded-lg border border-line bg-canvas-soft p-4">
              <p className="font-mono text-[12px] text-muted">{new Date(note.updatedAt).toLocaleString()}</p>
              <p className="mt-2 whitespace-pre-wrap text-[15px] leading-7 text-body">{note.text}</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-6 text-[15px] leading-7 text-body">No saved notes yet. Capture your own summary or a memory hook while reading.</p>
      )}
    </section>
  );
}
