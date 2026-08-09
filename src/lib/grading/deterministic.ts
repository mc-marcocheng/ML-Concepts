import type { QuizItem } from '@/lib/content/types';
import type { Verdict } from '@/lib/persistence/progress';
import { blanksOf, decodeBlankAnswers } from '@/lib/quiz/scaffold';
import { normaliseCode, normaliseLatex, normaliseText, parseNumber } from './normalise';

export interface RubricCheck {
  i: number;
  ok: boolean;
  why: string;
}

export interface DeterministicOutcome {
  verdict: Verdict;
  score: number;
  explanation: string;
  checks?: RubricCheck[];
}

export interface DeterministicGrade {
  /** true → final. false → escalate to the LLM judge. */
  decided: boolean;
  verdict?: Verdict;
  score?: number;
  explanation?: string;
  checks?: RubricCheck[];
  /**
   * Best-effort result used only when no judge is reachable.
   * Never used to override the judge.
   */
  fallback?: DeterministicOutcome;
}

function gradeBlanks(item: QuizItem, answer: string): DeterministicGrade {
  const blanks = blanksOf(item);
  if (!blanks.length) return { decided: false };

  const provided = decodeBlankAnswers(answer);
  const filledCount = blanks.filter(blank => (provided.get(blank.id) ?? '').trim().length > 0).length;
  if (filledCount === 0) {
    return { decided: true, verdict: 'skipped', score: 0, explanation: 'No blanks were filled in' };
  }

  const checks: RubricCheck[] = blanks.map((blank, index) => {
    const candidate = (provided.get(blank.id) ?? '').trim();
    const ok = candidate.length > 0 && normaliseCode(candidate) === normaliseCode(blank.answer);
    return {
      i: index + 1,
      ok,
      why: ok ? 'matches the reference text' : candidate ? `you wrote \`${candidate}\`` : 'left blank',
    };
  });

  const matched = checks.filter(check => check.ok).length;
  const score = matched / checks.length;

  if (score === 1) {
    return { decided: true, verdict: 'correct', score: 1, explanation: 'All blanks matched the reference', checks };
  }

  // A blank can be correct without being textually identical (a @ b vs np.dot(a, b)),
  // so anything short of a perfect textual match must go to the judge.
  return {
    decided: false,
    fallback: {
      verdict: score > 0 ? 'partial' : 'incorrect',
      score,
      explanation: `${matched}/${checks.length} blank${checks.length === 1 ? '' : 's'} matched the reference text exactly`,
      checks,
    },
  };
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
  const answer = (rawAnswer ?? '').trim();

  if (item.type === 'code') {
    // A code answer is always encoded as "#id: value" lines, so emptiness is
    // decided inside gradeBlanks.
    return gradeBlanks(item, rawAnswer ?? '');
  }

  if (!answer) return { decided: true, verdict: 'skipped', score: 0, explanation: 'Empty answer' };

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
    const value = parseNumber(answer);
    const target = item.value ?? NaN;
    const tolerance = Math.max(item.tolerance ?? 1e-6, Math.abs(target) * 1e-9);
    const ok = Number.isFinite(value) && Number.isFinite(target) && Math.abs(value - target) <= tolerance;
    return {
      decided: true,
      verdict: ok ? 'correct' : 'incorrect',
      score: ok ? 1 : 0,
      explanation: ok ? 'Within tolerance' : `Expected ${target}`,
    };
  }

  if (item.type === 'order') {
    const expected = (item.steps ?? []).map((_, index) => String(index)).join(',');
    const ok = normaliseText(answer) === normaliseText(expected);
    return {
      decided: true,
      verdict: ok ? 'correct' : 'incorrect',
      score: ok ? 1 : 0,
      explanation: ok ? 'Correct order' : 'Incorrect order',
    };
  }

  if (item.type === 'latex') {
    if (!item.answer) return { decided: false };
    if (normaliseLatex(answer) === normaliseLatex(item.answer)) {
      return { decided: true, verdict: 'correct', score: 1, explanation: 'Matches the reference answer' };
    }
    // Mathematically equivalent forms (ab vs ba, renamed dummy indices,
    // rearranged sums) cannot be settled by string normalisation.
    return {
      decided: false,
      fallback: {
        verdict: 'incorrect',
        score: 0,
        explanation: 'Does not match the reference answer character-for-character.',
      },
    };
  }

  if (item.answer && normaliseText(answer) === normaliseText(item.answer)) {
    return { decided: true, verdict: 'correct', score: 1, explanation: 'Exact match' };
  }

  return { decided: false };
}
