import type { QuizItem } from '@/lib/content/types';
import type { Verdict } from '@/lib/persistence/progress';
import { gradeDeterministic, type DeterministicGrade, type RubricCheck } from './deterministic';
import { judge } from './judge';
import { ensureLlmHydrated, useLlm } from '@/lib/llm/client';
import { rubricFor } from './rubric';

export type { RubricCheck };

export interface GradeResult {
  verdict: Verdict;
  score: number;
  explanation: string;
  gradedBy: 'deterministic' | 'llm' | 'self' | 'pending';
  checks: RubricCheck[];
  note: string;
  rubric: string[];
  needsSelfGrade?: boolean;
  suggestion?: { verdict: Exclude<Verdict, 'skipped'>; score: number; why: string };
}

function buildRubricChecks(rubric: string[], verdict: Verdict, why: string): RubricCheck[] {
  return rubric.map((_, index) => ({ i: index + 1, ok: verdict === 'correct', why }));
}

function describeError(error: unknown): string {
  const message = (error as Error | undefined)?.message?.trim();
  return message || 'Grader unavailable';
}

function pendingResult(rubric: string[], deterministic: DeterministicGrade, reason: string): GradeResult {
  const fallback = deterministic.fallback;
  const suggestion =
    fallback && fallback.verdict !== 'skipped'
      ? { verdict: fallback.verdict as Exclude<Verdict, 'skipped'>, score: fallback.score, why: fallback.explanation }
      : undefined;

  return {
    verdict: 'skipped',
    score: 0,
    explanation: reason,
    gradedBy: 'pending',
    checks: fallback?.checks ?? [],
    note: fallback ? `${reason} Automatic check: ${fallback.explanation}` : reason,
    rubric,
    needsSelfGrade: true,
    suggestion,
  };
}

export async function gradeAnswer(item: QuizItem, answer: string): Promise<GradeResult> {
  ensureLlmHydrated();
  const rubric = rubricFor(item);

  let deterministic: DeterministicGrade = { decided: false };
  try {
    deterministic = gradeDeterministic(item, answer);
  } catch (error) {
    console.error('[grade] deterministic grader failed', { itemId: item?.id, error });
  }

  if (deterministic.decided) {
    const verdict = deterministic.verdict ?? 'skipped';
    const explanation = deterministic.explanation ?? '';
    return {
      verdict,
      score: deterministic.score ?? 0,
      explanation,
      gradedBy: 'deterministic',
      checks: deterministic.checks ?? buildRubricChecks(rubric, verdict, explanation),
      note: explanation,
      rubric,
    };
  }

  if (!useLlm.getState().enabled) {
    return pendingResult(rubric, deterministic, 'Assistant is off — grade this answer yourself.');
  }

  try {
    const result = await judge(item, answer);
    const passed = result.checks.filter(check => check.ok).length;
    const score = result.checks.length ? passed / result.checks.length : 0;
    return {
      verdict: score >= 0.999 ? 'correct' : score >= 0.6 ? 'partial' : 'incorrect',
      score,
      explanation: result.note || rubric.join('; '),
      gradedBy: 'llm',
      checks: result.checks,
      note: result.note,
      rubric,
    };
  } catch (error) {
    return pendingResult(rubric, deterministic, describeError(error));
  }
}
