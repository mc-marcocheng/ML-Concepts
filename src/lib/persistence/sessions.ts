'use client';

import type { GradeResult } from '@/lib/grading/pipeline';
import type { SessionParams } from '@/lib/quiz/load';

export interface SessionItemRecord {
  conceptId: string;
  conceptTitle: string;
  itemId: string;
  prompt: string;
  answer: string;
  verdict: GradeResult['verdict'];
  score: number;
  gradedBy: GradeResult['gradedBy'];
  note: string;
  ts: number;
}

export interface SessionRecord {
  id: string;
  startedAt: number;
  completedAt: number;
  params: SessionParams;
  items: SessionItemRecord[];
}

const KEY = 'mlc.sessions';

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
  window.dispatchEvent(new CustomEvent('mlc:sessions'));
  window.dispatchEvent(new Event('storage'));
}

export function loadSessions(): SessionRecord[] {
  return readJson<SessionRecord[]>(KEY, []);
}

export function saveSession(record: SessionRecord) {
  const next = loadSessions().filter(existing => existing.id !== record.id);
  next.unshift(record);
  writeJson(KEY, next.slice(0, 20));
}

export function clearSessions() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event('storage'));
}