import type { QuizItem } from '@/lib/content/types';

export function rubricFor(item: QuizItem | null | undefined): string[] {
  const authored = Array.isArray(item?.rubric)
    ? item.rubric.filter(entry => typeof entry === 'string' && entry.trim().length > 0)
    : [];
  if (authored.length) return authored;

  if (item?.type === 'mcq' && Number.isInteger(item.correctIndex)) {
    const option = item.options?.[item.correctIndex as number];
    if (option) return [`Selects: ${option}`];
  }

  if (item?.answer) return [`Matches the reference answer: ${item.answer}`];
  return ['Addresses the prompt correctly'];
}
