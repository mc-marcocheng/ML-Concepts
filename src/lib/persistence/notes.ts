'use client';

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink';

export interface NoteRecord {
  id: string;
  conceptId: string;
  color: HighlightColor;
  exact: string;
  prefix: string;
  suffix: string;
  start: number;
  body: string;
  createdAt: number;
  updatedAt: number;
  orphan?: boolean;
}

const NOTES_KEY = 'mlc.notes';

export function newId() {
  return `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('mlc:notes'));
  window.dispatchEvent(new Event('storage'));
}

export function loadNotes(): NoteRecord[] {
  const notes = readJson<unknown[]>(NOTES_KEY, []);
  return notes.flatMap(note => {
    if (!note || typeof note !== 'object') return [];
    const value = note as Partial<NoteRecord>;
    if (typeof value.id !== 'string' || typeof value.exact !== 'string') return [];
    return [{
      id: value.id,
      conceptId: value.conceptId ?? '',
      color: value.color ?? 'yellow',
      exact: value.exact,
      prefix: value.prefix ?? '',
      suffix: value.suffix ?? '',
      start: value.start ?? 0,
      body: value.body ?? '',
      createdAt: value.createdAt ?? value.updatedAt ?? Date.now(),
      updatedAt: value.updatedAt ?? value.createdAt ?? Date.now(),
      orphan: value.orphan,
    }];
  });
}

export function upsertNote(note: NoteRecord) {
  const notes = loadNotes().filter(existing => existing.id !== note.id);
  notes.unshift({ ...note, updatedAt: Date.now() });
  writeJson(NOTES_KEY, notes.slice(0, 200));
}

export function deleteNote(id: string) {
  writeJson(NOTES_KEY, loadNotes().filter(note => note.id !== id));
}
