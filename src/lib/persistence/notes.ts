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
  text?: string;
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
    const value = note as Partial<NoteRecord> & { conceptId?: string; text?: string; updatedAt?: number };
    if (typeof value.id === 'string' && typeof value.exact === 'string') {
      return [{
        id: value.id,
        conceptId: value.conceptId ?? '',
        color: value.color ?? 'yellow',
        exact: value.exact,
        prefix: value.prefix ?? '',
        suffix: value.suffix ?? '',
        start: value.start ?? 0,
        body: value.body ?? value.text ?? '',
        createdAt: value.createdAt ?? value.updatedAt ?? Date.now(),
        updatedAt: value.updatedAt ?? value.createdAt ?? Date.now(),
        orphan: value.orphan,
        text: value.text,
      }];
    }
    if (typeof value.conceptId === 'string' && typeof value.text === 'string') {
      const now = value.updatedAt ?? Date.now();
      return [{
        id: newId(),
        conceptId: value.conceptId,
        color: 'yellow',
        exact: '',
        prefix: '',
        suffix: '',
        start: 0,
        body: value.text,
        createdAt: now,
        updatedAt: now,
        orphan: true,
        text: value.text,
      }];
    }
    return [];
  });
}

export function upsertNote(note: NoteRecord) {
  const notes = loadNotes().filter(existing => existing.id !== note.id);
  notes.unshift({ ...note, updatedAt: Date.now(), text: note.body || note.text || '' });
  writeJson(NOTES_KEY, notes.slice(0, 200));
}

export function deleteNote(id: string) {
  writeJson(NOTES_KEY, loadNotes().filter(note => note.id !== id));
}

export function saveNote(conceptId: string, text: string) {
  const trimmed = text.trim();
  const notes = loadNotes().filter(note => !(
    note.conceptId === conceptId
    && !note.exact
    && (note.body ?? note.text ?? '').trim() === trimmed
  ));
  if (!trimmed) {
    writeJson(NOTES_KEY, notes);
    return;
  }
  notes.unshift({
    id: newId(),
    conceptId,
    color: 'yellow',
    exact: '',
    prefix: '',
    suffix: '',
    start: 0,
    body: trimmed,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    orphan: true,
    text: trimmed,
  });
  writeJson(NOTES_KEY, notes.slice(0, 200));
}
