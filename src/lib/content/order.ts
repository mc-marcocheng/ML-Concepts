import type { ConceptMeta } from './types';
import { CATEGORIES } from './categories';

export interface OrderedConcept {
  concept: ConceptMeta;
  /** 1-based position inside the group it is rendered in. */
  step: number;
  /** Prereqs that exist in the same input set, in order. */
  prereqs: ConceptMeta[];
  /** True when this node had to be released while a prereq cycle was still open. */
  cycleBreak: boolean;
}

export interface ConceptGroup {
  id: string;
  title: string;
  short: string;
  items: OrderedConcept[];
}

const indexById = (concepts: ConceptMeta[]) => new Map(concepts.map(concept => [concept.id, concept] as const));

/** Deterministic tie-break for nodes that are simultaneously ready. */
function compareReady(a: ConceptMeta, b: ConceptMeta) {
  return (a.difficulty - b.difficulty)
    || (a.estReadMin - b.estReadMin)
    || a.title.localeCompare(b.title);
}

/**
 * Kahn topological sort over `prereq -> concept` edges.
 * Self-edges and edges to ids outside `concepts` are ignored.
 * When no node is ready (a cycle), the node with the fewest unmet prereqs is
 * released and flagged with `cycleBreak`, so the algorithm always terminates.
 */
export function topoSortConcepts(concepts: ConceptMeta[]): { concept: ConceptMeta; cycleBreak: boolean }[] {
  const lookup = indexById(concepts);
  const unmet = new Map<string, Set<string>>();
  const dependents = new Map<string, string[]>();

  for (const concept of concepts) {
    const deps = new Set((concept.prereqs ?? []).filter(id => id !== concept.id && lookup.has(id)));
    unmet.set(concept.id, deps);
    for (const dep of deps) dependents.set(dep, [...(dependents.get(dep) ?? []), concept.id]);
  }

  const pending = new Set(concepts.map(concept => concept.id));
  const out: { concept: ConceptMeta; cycleBreak: boolean }[] = [];

  while (pending.size) {
    const ready = [...pending].filter(id => unmet.get(id)!.size === 0);
    let cycleBreak = false;
    let nextId: string;

    if (ready.length) {
      nextId = ready.map(id => lookup.get(id)!).sort(compareReady)[0].id;
    } else {
      cycleBreak = true;
      nextId = [...pending]
        .map(id => ({ id, unmet: unmet.get(id)!.size, concept: lookup.get(id)! }))
        .sort((a, b) => a.unmet - b.unmet || compareReady(a.concept, b.concept))[0].id;
    }

    pending.delete(nextId);
    out.push({ concept: lookup.get(nextId)!, cycleBreak });
    for (const dependent of dependents.get(nextId) ?? []) unmet.get(dependent)?.delete(nextId);
  }

  return out;
}

/** Topologically ordered concepts with 1-based steps and resolved prereq objects. */
export function orderConcepts(concepts: ConceptMeta[]): OrderedConcept[] {
  const sorted = topoSortConcepts(concepts);
  const rank = new Map(sorted.map((entry, index) => [entry.concept.id, index] as const));
  const lookup = indexById(concepts);

  return sorted.map((entry, index) => ({
    concept: entry.concept,
    step: index + 1,
    cycleBreak: entry.cycleBreak,
    prereqs: (entry.concept.prereqs ?? [])
      .map(id => lookup.get(id))
      .filter((concept): concept is ConceptMeta => Boolean(concept))
      .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)),
  }));
}

/**
 * Groups by category, keeping the *global* topological order inside each group,
 * so cross-category prerequisites still influence the sequence a reader sees.
 * Categories follow the order declared in `categories.ts`; unknown categories
 * are appended alphabetically.
 */
export function groupConceptsByCategory(concepts: ConceptMeta[]): ConceptGroup[] {
  const ordered = orderConcepts(concepts);
  const buckets = new Map<string, OrderedConcept[]>();

  for (const entry of ordered) {
    const list = buckets.get(entry.concept.category) ?? [];
    list.push(entry);
    buckets.set(entry.concept.category, list);
  }

  const known = new Map<string, (typeof CATEGORIES)[number]>(CATEGORIES.map(category => [category.id, category]));
  const declared = CATEGORIES.map(category => category.id).filter(id => buckets.has(id));
  const extra = [...buckets.keys()].filter(id => !known.has(id)).sort();

  return [...declared, ...extra].map(id => ({
    id,
    title: known.get(id)?.title ?? id,
    short: known.get(id)?.short ?? id.slice(0, 3).toUpperCase(),
    items: (buckets.get(id) ?? []).map((entry, index) => ({ ...entry, step: index + 1 })),
  }));
}
