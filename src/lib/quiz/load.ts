'use client';

import type { ConceptMeta, QuizItem } from '@/lib/content/types';
import { computeDueQueue, computeMastery, loadAttempts } from '@/lib/persistence/progress';
import { normalizeQuizItems } from './normalize';

export interface QuizEntry {
  conceptId: string;
  conceptTitle: string;
  conceptSummary?: string;
  item: QuizItem;
}

export interface SessionParams {
  scope: 'concept' | 'category' | 'weak' | 'due' | 'mixed' | 'interview';
  id?: string;
  size?: number;
}

const conceptCache = new Map<string, QuizItem[]>();
let conceptsCache: ConceptMeta[] | null = null;

const safe = (id: string) => id.replace(/\//g, '__');

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}

export async function loadConcepts(): Promise<ConceptMeta[]> {
  if (conceptsCache) return conceptsCache;
  try {
    const response = await fetch('/data/concepts.json');
    conceptsCache = response.ok ? await response.json() : [];
  } catch {
    conceptsCache = [];
  }
  return conceptsCache ?? [];
}

export async function loadQuiz(conceptId: string): Promise<QuizItem[]> {
  if (conceptCache.has(conceptId)) return conceptCache.get(conceptId)!;
  let items: QuizItem[] = [];
  try {
    const response = await fetch(`/data/quiz/${safe(conceptId)}.json`);
    items = response.ok ? normalizeQuizItems(await response.json(), conceptId) : [];
  } catch {
    items = [];
  }
  conceptCache.set(conceptId, items);
  return items;
}

export async function buildSession(params: SessionParams): Promise<QuizEntry[]> {
  const concepts = await loadConcepts();
  const attempts = typeof window === 'undefined' ? [] : loadAttempts();
  const size = params.size ?? (params.scope === 'interview' ? 8 : 10);

  const sourceConcepts = (() => {
    if (params.scope === 'concept' && params.id) return concepts.filter(concept => concept.id === params.id);
    if (params.scope === 'category' && params.id) return concepts.filter(concept => concept.category === params.id);
    if (params.scope === 'due') return computeDueQueue(concepts, attempts).map(entry => entry.concept);
    if (params.scope === 'weak') return computeMastery(concepts, attempts)
      .filter(entry => entry.attempts > 0 && entry.mastery < 0.7)
      .sort((a, b) => a.mastery - b.mastery)
      .map(entry => entry.concept);
    return concepts;
  })();

  const itemsByConcept = await Promise.all(sourceConcepts.map(concept => loadQuiz(concept.id)));
  const entries: QuizEntry[] = [];
  sourceConcepts.forEach((concept, index) => {
    for (const item of itemsByConcept[index]) {
      entries.push({ conceptId: concept.id, conceptTitle: concept.title, conceptSummary: concept.summary, item });
    }
  });

  const pool = params.scope === 'concept' ? entries : shuffle(entries);
  if (params.scope === 'interview') {
    const seen = new Set<string>();
    const interviewEntries: QuizEntry[] = [];
    for (const entry of pool) {
      if (seen.has(entry.conceptId)) continue;
      seen.add(entry.conceptId);
      interviewEntries.push(entry);
    }
    return interviewEntries.slice(0, size);
  }
  if (params.scope === 'concept') return pool;
  return pool.slice(0, size);
}
