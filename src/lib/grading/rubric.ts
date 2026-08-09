import type { QuizItem } from '@/lib/content/types';
import { blanksOf } from '@/lib/quiz/scaffold';

export function rubricFor(item: QuizItem | null | undefined): string[] {
  const authored = Array.isArray(item?.rubric)
    ? item!.rubric.filter(entry => typeof entry === 'string' && entry.trim().length > 0)
    : [];
  if (authored.length) return authored;

  if (item?.type === 'code') {
    // One criterion per blank so deterministic checks line up 1:1 with rubric rows.
    const blanks = blanksOf(item);
    if (blanks.length) {
      return blanks.map(blank => {
        const detail = blank.rubric?.length ? blank.rubric.join('; ') : `is equivalent to \`${blank.answer}\``;
        return `Blank ${blank.id}: ${detail}`;
      });
    }
  }

  if (item?.type === 'mcq' && Number.isInteger(item.correctIndex)) {
    const option = item.options?.[item.correctIndex as number];
    if (option) return [`Selects: ${option}`];
  }

  if (item?.type === 'order' && item.steps?.length) {
    return ['Places every step in the correct order'];
  }

  if (item?.answer) return [`Is mathematically/semantically equivalent to: ${item.answer}`];
  return ['Addresses the prompt correctly'];
}
