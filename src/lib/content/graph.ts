import { CATEGORIES } from './categories';
import type { ConceptMeta } from './types';

type CategoryId = (typeof CATEGORIES)[number]['id'];

const CATEGORY_INDEX = new Map<CategoryId, number>(CATEGORIES.map((category, index) => [category.id, index] as const));
const DIFFICULTY_RANK: Record<string, number> = { intro: 0, beginner: 0, core: 1, intermediate: 1, advanced: 2, hard: 2 };

export interface GraphNode {
  concept: ConceptMeta;
  prereqs: string[];
  dependents: string[];
  rank: number;
  order: number;
  categoryIndex: number;
}

export interface ConceptGraph {
  nodes: GraphNode[];
  byId: Map<string, GraphNode>;
  ancestorsOf(id: string): Set<string>;
  descendantsOf(id: string): Set<string>;
}

function difficultyOf(concept: ConceptMeta) {
  const raw = (concept as { difficulty?: number | string }).difficulty;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') return DIFFICULTY_RANK[raw.toLowerCase()] ?? 1;
  return 1;
}

function minutesOf(concept: ConceptMeta) {
  return Number((concept as { readingTime?: number }).readingTime ?? 0);
}

export function buildConceptGraph(concepts: ConceptMeta[]): ConceptGraph {
  const byId = new Map<string, GraphNode>();

  for (const concept of concepts) {
    byId.set(concept.id, {
      concept,
      prereqs: [],
      dependents: [],
      rank: 0,
      order: 0,
      categoryIndex: CATEGORY_INDEX.get(concept.category as CategoryId) ?? CATEGORIES.length,
    });
  }

  const rawPrereqs = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  for (const id of byId.keys()) children.set(id, []);

  for (const node of byId.values()) {
    const id = node.concept.id;
    const list = [...new Set(((node.concept as { prereqs?: string[] }).prereqs ?? [])
      .filter(prereq => prereq !== id && byId.has(prereq)))];
    rawPrereqs.set(id, list);
    for (const prereq of list) children.get(prereq)!.push(id);
  }

  const walkOrder = [...byId.values()]
    .sort((a, b) => a.categoryIndex - b.categoryIndex || a.concept.title.localeCompare(b.concept.title))
    .map(node => node.concept.id);

  const colour = new Map<string, 0 | 1 | 2>();
  const dropped = new Set<string>();

  const visit = (id: string) => {
    colour.set(id, 1);
    for (const child of children.get(id) ?? []) {
      const state = colour.get(child) ?? 0;
      if (state === 1) {
        dropped.add(`${id}->${child}`);
        continue;
      }
      if (state === 0) visit(child);
    }
    colour.set(id, 2);
  };

  for (const id of walkOrder) if ((colour.get(id) ?? 0) === 0) visit(id);

  for (const [id, list] of rawPrereqs) {
    const node = byId.get(id)!;
    node.prereqs = list.filter(prereq => !dropped.has(`${prereq}->${id}`));
  }

  for (const node of byId.values()) {
    for (const prereq of node.prereqs) byId.get(prereq)!.dependents.push(node.concept.id);
  }

  const rankMemo = new Map<string, number>();
  const rankOf = (id: string): number => {
    const cached = rankMemo.get(id);
    if (cached !== undefined) return cached;
    rankMemo.set(id, 0);
    const node = byId.get(id)!;
    const value = node.prereqs.length ? 1 + Math.max(...node.prereqs.map(rankOf)) : 0;
    rankMemo.set(id, value);
    return value;
  };

  for (const node of byId.values()) node.rank = rankOf(node.concept.id);

  const nodes = [...byId.values()].sort((a, b) =>
    a.categoryIndex - b.categoryIndex ||
    a.rank - b.rank ||
    difficultyOf(a.concept) - difficultyOf(b.concept) ||
    minutesOf(a.concept) - minutesOf(b.concept) ||
    a.concept.title.localeCompare(b.concept.title));
  nodes.forEach((node, index) => { node.order = index; });

  const closure = (start: string, key: 'prereqs' | 'dependents', cache: Map<string, Set<string>>) => {
    const cached = cache.get(start);
    if (cached) return cached;
    const seen = new Set<string>();
    const queue = [...(byId.get(start)?.[key] ?? [])];
    while (queue.length) {
      const id = queue.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      queue.push(...(byId.get(id)?.[key] ?? []));
    }
    cache.set(start, seen);
    return seen;
  };

  const ancestorCache = new Map<string, Set<string>>();
  const descendantCache = new Map<string, Set<string>>();

  return {
    nodes,
    byId,
    ancestorsOf: id => closure(id, 'prereqs', ancestorCache),
    descendantsOf: id => closure(id, 'dependents', descendantCache),
  };
}