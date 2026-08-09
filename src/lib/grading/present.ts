import type { QuizItem } from '@/lib/content/types';
import { blanksOf, decodeBlankAnswers, fillScaffold } from '@/lib/quiz/scaffold';

/** Turns the stored answer string into something a human (or a judge) can read. */
export function presentAnswer(item: QuizItem, answer: string): string {
  if (item.type === 'mcq') {
    const index = Number(answer);
    const option = Number.isInteger(index) ? item.options?.[index] : undefined;
    return option ? `${index + 1}. ${option}` : answer;
  }

  if (item.type === 'order') {
    const sequence = (answer ?? '').split(',').filter(Boolean).map(Number);
    if (!sequence.length) return answer;
    return sequence.map((stepIndex, position) => `${position + 1}. ${item.steps?.[stepIndex] ?? '?'}`).join('\n');
  }

  if (item.type === 'code') {
    const provided = decodeBlankAnswers(answer);
    const values = Object.fromEntries(blanksOf(item).map(blank => [blank.id, provided.get(blank.id) ?? '']));
    return fillScaffold(item.scaffold, values);
  }

  return answer;
}

export function presentReference(item: QuizItem): string {
  if (item.type === 'code') {
    const values = Object.fromEntries(blanksOf(item).map(blank => [blank.id, blank.answer]));
    return fillScaffold(item.scaffold, values);
  }
  if (item.type === 'order') return (item.steps ?? []).map((step, index) => `${index + 1}. ${step}`).join('\n');
  if (item.type === 'mcq') {
    const option = item.options?.[item.correctIndex ?? -1];
    return option ? `${(item.correctIndex ?? 0) + 1}. ${option}` : '';
  }
  if (item.type === 'numeric') return item.value !== undefined ? String(item.value) : '';
  return item.answer ?? '';
}
