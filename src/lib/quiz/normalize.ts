import type { QuizItem } from '@/lib/content/types';

const TYPES = new Set<QuizItem['type']>(['mcq', 'short', 'latex', 'code', 'numeric', 'order']);

const strings = (value: unknown): string[] => (
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : []
);

export function normalizeQuizItem(raw: unknown, fallbackId: string): QuizItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Partial<QuizItem>;
  if (typeof item.prompt !== 'string' || !item.prompt.trim()) return null;

  const type = TYPES.has(item.type as QuizItem['type']) ? (item.type as QuizItem['type']) : 'short';

  return {
    ...(item as QuizItem),
    id: typeof item.id === 'string' && item.id ? item.id : fallbackId,
    type,
    prompt: item.prompt,
    difficulty: Number.isFinite(item.difficulty as number) ? Number(item.difficulty) : 3,
    options: Array.isArray(item.options) ? item.options.map(String) : undefined,
    steps: Array.isArray(item.steps) ? item.steps.map(String) : undefined,
    blanks: Array.isArray(item.blanks) ? item.blanks : undefined,
    correctIndex: Number.isInteger(item.correctIndex as number) ? Number(item.correctIndex) : undefined,
    rubric: strings(item.rubric),
    hints: strings(item.hints),
    explanation: typeof item.explanation === 'string' ? item.explanation : '',
  };
}

export function normalizeQuizItems(payload: unknown, conceptId: string): QuizItem[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((raw, index) => normalizeQuizItem(raw, `${conceptId}#${index}`))
    .filter((item): item is QuizItem => item !== null);
}