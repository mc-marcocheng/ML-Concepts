'use client';

export interface ScheduleRecord {
  conceptId: string;
  ease: number;
  intervalDays: number;
  reps: number;
  dueAt: number;
  lastAt: number;
}

const KEY = 'mlc.schedule';

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
  window.dispatchEvent(new Event('storage'));
}

export function loadSchedules(): ScheduleRecord[] {
  return readJson<ScheduleRecord[]>(KEY, []);
}

export function saveSchedules(records: ScheduleRecord[]) {
  writeJson(KEY, records.slice(0, 500));
}

export function clearSchedules() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event('storage'));
}

export function reviewGrade(rec: ScheduleRecord | undefined, conceptId: string, score: number): ScheduleRecord {
  const base = rec ?? { conceptId, ease: 2.3, intervalDays: 0, reps: 0, dueAt: 0, lastAt: 0 };
  const q = score >= 0.9 ? 5 : score >= 0.7 ? 4 : score >= 0.5 ? 3 : score >= 0.3 ? 2 : 1;
  const ease = Math.max(1.3, base.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  const reps = q < 3 ? 0 : base.reps + 1;
  const intervalDays = q < 3 ? 0.02 : reps === 1 ? 1 : reps === 2 ? 4 : Math.round(base.intervalDays * ease);
  const now = Date.now();
  return { conceptId, ease, intervalDays, reps, lastAt: now, dueAt: now + intervalDays * 864e5 };
}