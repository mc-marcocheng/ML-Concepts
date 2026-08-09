'use client';

import MiniSearch from 'minisearch';
import type { ConceptMeta, SearchChunk } from '@/lib/content/types';

export interface ChunkHit extends SearchChunk {
  score: number;
}

export interface ChunkSearchOptions {
  limit?: number;
  preferConceptId?: string | null;
  minRelativeScore?: number;
  maxPerConcept?: number;
}

let chunkIndex: MiniSearch<SearchChunk> | null = null;
let conceptIndex: MiniSearch<ConceptMeta> | null = null;
let chunkLoading: Promise<void> | null = null;
let conceptLoading: Promise<void> | null = null;

async function ensureChunkIndex() {
  if (chunkIndex) return;
  chunkLoading ??= (async () => {
    const chunks: SearchChunk[] = await fetch('/data/search-index.json').then(response => response.json());
    const index = new MiniSearch<SearchChunk>({
      fields: ['conceptTitle', 'heading', 'text'],
      storeFields: ['conceptId', 'conceptTitle', 'heading', 'anchor', 'text'],
      searchOptions: { boost: { conceptTitle: 3, heading: 2 }, prefix: true, fuzzy: 0.15 },
    });
    index.addAll(chunks);
    chunkIndex = index;
  })();
  await chunkLoading;
}

async function ensureConceptIndex() {
  if (conceptIndex) return;
  conceptLoading ??= (async () => {
    const concepts: ConceptMeta[] = await fetch('/data/concepts.json').then(response => response.json());
    const index = new MiniSearch<ConceptMeta>({
      fields: ['title', 'summary', 'category', 'tags'],
      storeFields: ['id', 'title', 'summary', 'category', 'href', 'quizCount', 'hasQuiz'],
      searchOptions: { boost: { title: 3, summary: 1.5, category: 1.2 }, prefix: true, fuzzy: 0.15 },
    });
    index.addAll(concepts);
    conceptIndex = index;
  })();
  await conceptLoading;
}

export async function searchChunks(query: string, optionsOrLimit: number | ChunkSearchOptions = 5, preferConceptId?: string) {
  const options: ChunkSearchOptions = typeof optionsOrLimit === 'number'
    ? { limit: optionsOrLimit, preferConceptId: preferConceptId ?? null }
    : optionsOrLimit;
  const { limit = 5, minRelativeScore = 0.4, maxPerConcept = 2 } = options;
  const preferred = options.preferConceptId ?? preferConceptId ?? null;
  if (query.trim().length < 2) return [];
  await ensureChunkIndex();
  const raw = chunkIndex!.search(query, {
    prefix: true,
    fuzzy: 0.15,
    combineWith: 'OR',
    boost: { conceptTitle: 2, heading: 2 },
  }) as unknown as Array<SearchChunk & { score: number }>;
  if (!raw.length) return [];

  const scored = raw.map(hit => ({
    ...hit,
    score: hit.score * (preferred && hit.conceptId === preferred ? 1.5 : 1),
  })).sort((a, b) => b.score - a.score);

  const best = scored[0].score;
  const perConcept = new Map<string, number>();
  const out: ChunkHit[] = [];
  for (const hit of scored) {
    if (hit.score < best * minRelativeScore) break;
    const used = perConcept.get(hit.conceptId) ?? 0;
    if (used >= maxPerConcept) continue;
    perConcept.set(hit.conceptId, used + 1);
    out.push(hit);
    if (out.length >= limit) break;
  }
  return out;
}

export async function searchConcepts(query: string, limit = 8) {
  if (query.trim().length < 2) return [];
  await ensureConceptIndex();
  const hits = conceptIndex!.search(query).slice(0, 30) as unknown as ConceptMeta[];
  const seen = new Set<string>();
  const out: ConceptMeta[] = [];
  for (const hit of hits) {
    if (seen.has(hit.id)) continue;
    seen.add(hit.id);
    out.push(hit);
    if (out.length >= limit) break;
  }
  return out;
}
