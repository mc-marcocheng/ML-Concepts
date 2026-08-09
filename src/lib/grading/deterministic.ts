import type { QuizItem } from '@/lib/content/types';
import type { Verdict } from '@/lib/persistence/progress';
import { normaliseCode, normaliseLatex, normaliseText } from './normalise';

export interface DeterministicGrade {
  decided: boolean;
  verdict?: Verdict;
  score?: number;
  explanation?: string;
}

function gradeBlanks(item: QuizItem, answer: string): DeterministicGrade {
  if (!item.blanks?.length) return { decided: false };
  const provided = new Map<number, string>();
  for (const line of answer.trim().split('\n')) {
    const match = /^#?(\d+)\s*:\s*(.*)$/.exec(line.trim());
    if (match) provided.set(Number(match[1]), match[2].trim());
  }

  const checks = item.blanks.map(blank => {
    const candidate = provided.get(blank.id) ?? '';
    const ok = normaliseCode(candidate) === normaliseCode(blank.answer);
    return { blank, ok };
  });

  const matched = checks.filter(check => check.ok).length;
  const score = checks.length ? matched / checks.length : 0;
  if (score === 1) return { decided: true, verdict: 'correct', score, explanation: 'All blanks matched' };
  if (score > 0) return { decided: true, verdict: 'partial', score, explanation: `${matched}/${checks.length} blanks matched` };
  return { decided: true, verdict: 'incorrect', score: 0, explanation: 'No blanks matched' };
}

/** Accepts "1", "b", "B)", "(b)" or the literal option text. */
function resolveChoice(item: QuizItem, answer: string): number | null {
  const raw = answer.trim();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) return Number(raw);

  const letter = /^\(?([a-z])[).:]?$/i.exec(raw);
  if (letter) return letter[1].toLowerCase().charCodeAt(0) - 97;

  const options = item.options ?? [];
  const target = normaliseText(raw);
  const index = options.findIndex(option => normaliseText(option) === target);
  return index === -1 ? null : index;
}

export function gradeDeterministic(item: QuizItem, rawAnswer: string): DeterministicGrade {
  const answer = rawAnswer.trim();
  if (!answer) return { decided: true, verdict: 'skipped', score: 0, explanation: 'Empty answer' };

  if (item.type === 'code' && item.blanks?.length) return gradeBlanks(item, answer);

  if (item.type === 'mcq') {
    if (!Number.isInteger(item.correctIndex)) return { decided: false };
    const chosen = resolveChoice(item, answer);
    const ok = chosen !== null && chosen === item.correctIndex;
    const correct = item.options?.[item.correctIndex as number];
    return {
      decided: true,
      verdict: ok ? 'correct' : 'incorrect',
      score: ok ? 1 : 0,
      explanation: ok ? 'Correct option' : correct ? `Correct answer: ${correct}` : 'Wrong option',
    };
  }

  if (item.type === 'numeric') {
    const value = Number(answer.replace(/[^0-9.eE+-]/g, ''));
    const target = item.value ?? NaN;
    const tolerance = item.tolerance ?? 1e-6;
    const ok = Number.isFinite(value) && Math.abs(value - target) <= tolerance;
    return { decided: true, verdict: ok ? 'correct' : 'incorrect', score: ok ? 1 : 0, explanation: ok ? 'Within tolerance' : `Expected ${target}` };
  }

  if (item.type === 'order') {
    const expected = (item.steps ?? []).map((_, index) => String(index)).join(',');
    const ok = normaliseText(answer) === normaliseText(expected);
    return { decided: true, verdict: ok ? 'correct' : 'incorrect', score: ok ? 1 : 0, explanation: ok ? 'Correct order' : 'Incorrect order' };
  }

  if (item.type === 'latex' && item.answer) {
    const ok = normaliseLatex(answer) === normaliseLatex(item.answer);
    return { decided: true, verdict: ok ? 'correct' : 'incorrect', score: ok ? 1 : 0, explanation: ok ? 'Equivalent LaTeX' : 'Compare with the reference answer' };
  }

  if (item.answer && normaliseText(answer) === normaliseText(item.answer)) {
    return { decided: true, verdict: 'correct', score: 1, explanation: 'Exact match' };
  }

  return { decided: false };
}
