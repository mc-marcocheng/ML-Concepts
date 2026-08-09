import type { ConceptMeta, QuizItem } from '@/lib/content/types';
import { clearSchedules, loadSchedules, reviewGrade, saveSchedules, type ScheduleRecord } from './schedule';

export type Verdict = 'correct' | 'partial' | 'incorrect' | 'skipped';

export interface AttemptRecord {
  conceptId: string;
  itemId: string;
  prompt: string;
  answer: string;
  verdict: Verdict;
  score: number;
  ts: number;
}

const ATTEMPTS_KEY = 'mlc.attempts';

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

export function loadAttempts(): AttemptRecord[] {
  return readJson<AttemptRecord[]>(ATTEMPTS_KEY, []);
}

export function addAttempt(attempt: AttemptRecord) {
  const attempts = loadAttempts();
  attempts.unshift(attempt);
  writeJson(ATTEMPTS_KEY, attempts.slice(0, 200));

  const schedules = new Map(loadSchedules().map(record => [record.conceptId, record] as const));
  schedules.set(attempt.conceptId, reviewGrade(schedules.get(attempt.conceptId), attempt.conceptId, attempt.score));
  saveSchedules([...schedules.values()]);
}

export function clearAttempts() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ATTEMPTS_KEY);
  clearSchedules();
  window.dispatchEvent(new Event('storage'));
}

export function computeMastery(concepts: ConceptMeta[], attempts: AttemptRecord[]) {
  const byConcept = new Map<string, AttemptRecord[]>();
  for (const attempt of attempts) {
    const list = byConcept.get(attempt.conceptId) ?? [];
    list.push(attempt);
    byConcept.set(attempt.conceptId, list);
  }

  return concepts.map(concept => {
    const list = byConcept.get(concept.id) ?? [];
    const score = list.length
      ? list.reduce((sum, attempt) => sum + attempt.score, 0) / list.length
      : 0;
    const lastSeen = list[0]?.ts ?? 0;
    return { concept, mastery: score, attempts: list.length, lastSeen };
  });
}

export function computeDueQueue(concepts: ConceptMeta[], attempts: AttemptRecord[]) {
  const schedules = new Map(loadSchedules().map(record => [record.conceptId, record] as const));
  const now = Date.now();

  return concepts
    .map(concept => {
      const schedule = schedules.get(concept.id);
      const history = attempts.filter(attempt => attempt.conceptId === concept.id);
      const lastSeen = history[0]?.ts ?? 0;
      return { concept, schedule, attempts: history.length, lastSeen };
    })
    .filter(entry => !entry.schedule || entry.schedule.dueAt <= now)
    .sort((a, b) => {
      const aDue = a.schedule?.dueAt ?? 0;
      const bDue = b.schedule?.dueAt ?? 0;
      return aDue - bDue || a.lastSeen - b.lastSeen || a.concept.title.localeCompare(b.concept.title);
    })
    .map(entry => ({
      concept: entry.concept,
      mastery: entry.attempts ? computeMastery([entry.concept], attempts).find(item => item.concept.id === entry.concept.id)?.mastery ?? 0 : 0,
      attempts: entry.attempts,
      lastSeen: entry.lastSeen,
      dueAt: entry.schedule?.dueAt ?? 0,
      schedule: entry.schedule,
    }));
}

export function gradeQuizItem(item: QuizItem, answer: string): { verdict: Verdict; score: number; explanation: string } {
  const clean = answer.trim();
  if (!clean) return { verdict: 'skipped', score: 0, explanation: 'Empty answer' };

  if (item.type === 'code' && item.blanks?.length) {
    const provided = new Map<number, string>();
    for (const line of clean.split('\n')) {
      const match = /^#?(\d+)\s*:\s*(.*)$/.exec(line.trim());
      if (match) provided.set(Number(match[1]), match[2].trim());
    }
    const checks = item.blanks.map(blank => ({
      blank,
      ok: (provided.get(blank.id) ?? '').trim().toLowerCase() === blank.answer.trim().toLowerCase(),
    }));
    const correct = checks.filter(check => check.ok).length;
    const score = checks.length ? correct / checks.length : 0;
    if (score === 1) return { verdict: 'correct', score, explanation: 'All blanks matched' };
    if (score > 0) return { verdict: 'partial', score, explanation: `${correct}/${checks.length} blanks matched` };
    return { verdict: 'incorrect', score: 0, explanation: 'No blanks matched' };
  }

  if (item.type === 'mcq') {
    const ok = Number(clean) === item.correctIndex;
    return { verdict: ok ? 'correct' : 'incorrect', score: ok ? 1 : 0, explanation: ok ? 'Correct option' : 'Wrong option' };
  }

  if (item.type === 'numeric') {
    const value = Number(clean.replace(/[^0-9.eE+-]/g, ''));
    const target = item.value ?? NaN;
    const tolerance = item.tolerance ?? 1e-6;
    const ok = Number.isFinite(value) && Math.abs(value - target) <= tolerance;
    return { verdict: ok ? 'correct' : 'incorrect', score: ok ? 1 : 0, explanation: ok ? 'Within tolerance' : `Expected ${target}` };
  }

  if (item.answer) {
    const ok = clean.toLowerCase() === item.answer.trim().toLowerCase();
    return { verdict: ok ? 'correct' : 'incorrect', score: ok ? 1 : 0, explanation: ok ? 'Exact match' : 'Compare with the reference answer' };
  }

  return { verdict: 'skipped', score: 0, explanation: 'No deterministic grader for this item' };
}
