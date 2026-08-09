'use client';

import type { ContextSection } from '@/lib/llm/types';

const cache = new Map<string, ContextSection[]>();
const safe = (id: string) => id.replace(/\//g, '__');

export async function loadConceptSections(conceptId: string): Promise<ContextSection[]> {
  if (cache.has(conceptId)) return cache.get(conceptId)!;
  let sections: ContextSection[] = [];
  try {
    const response = await fetch(`/data/concept-sections/${safe(conceptId)}.json`);
    if (response.ok) sections = (await response.json()) as ContextSection[];
  } catch {
    sections = [];
  }
  cache.set(conceptId, sections);
  return sections;
}

export function rankSections(sections: ContextSection[], query: string, limit = 4): ContextSection[] {
  const terms = query.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  if (!terms.length) return sections.slice(0, limit);
  return [...sections]
    .map(section => {
      const haystack = `${section.heading} ${section.text}`.toLowerCase();
      const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
      return { section, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(entry => entry.section);
}