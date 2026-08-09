'use client';

import { loadAttempts, type AttemptRecord } from './progress';
import { loadReadings, type ReadingRecord } from './reading';
import { loadNotes, type NoteRecord } from './notes';
import { loadSessions, type SessionRecord } from './sessions';

export interface AppBackup {
  version: 3;
  exportedAt: number;
  attempts: AttemptRecord[];
  readings: ReadingRecord[];
  notes: NoteRecord[];
  sessions: SessionRecord[];
  settings: Record<string, string | null>;
}

const BACKUP_SETTINGS_KEYS = [
  'mlc.theme',
  'mlc.expandProofs',
  'mlc.llmEnabled',
  'mlc.llmProvider',
  'mlc.onDeviceModel',
  'mlc.remoteModel',
  'mlc.llmBaseUrl',
  'mlc.llmMaxTokens',
  'mlc.llmReasoningEffort',
] as const;

export function exportBackup(): AppBackup {
  const settings = Object.fromEntries(BACKUP_SETTINGS_KEYS.map(key => [key, typeof window === 'undefined' ? null : window.localStorage.getItem(key)]));
  return {
    version: 3,
    exportedAt: Date.now(),
    attempts: loadAttempts(),
    readings: loadReadings(),
    notes: loadNotes(),
    sessions: loadSessions(),
    settings,
  };
}

function writeLocalStorage(key: string, value: string | null) {
  if (typeof window === 'undefined') return;
  if (value === null) window.localStorage.removeItem(key);
  else window.localStorage.setItem(key, value);
}

export function importBackup(backup: AppBackup) {
  if (typeof window === 'undefined') return;
  if (backup.version !== 3) throw new Error('Unsupported backup format');

  window.localStorage.setItem('mlc.attempts', JSON.stringify(backup.attempts ?? []));
  window.localStorage.setItem('mlc.readings', JSON.stringify(backup.readings ?? []));
  window.localStorage.setItem('mlc.notes', JSON.stringify(backup.notes ?? []));
  window.localStorage.setItem('mlc.sessions', JSON.stringify(backup.sessions ?? []));
  for (const key of BACKUP_SETTINGS_KEYS) {
    writeLocalStorage(key, backup.settings?.[key] ?? null);
  }
  window.dispatchEvent(new Event('storage'));
}
