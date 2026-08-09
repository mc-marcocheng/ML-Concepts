import type { QuizItem } from '@/lib/content/types';
import type { Verdict } from '@/lib/persistence/progress';
import { gradeDeterministic } from './deterministic';
import { judge } from './judge';
import { useLlm } from '@/lib/llm/client';

export interface RubricCheck {
  i: number;
  ok: boolean;
  why: string;
}

export interface GradeResult {
  verdict: Verdict;
  score: number;
  explanation: string;
  gradedBy: 'deterministic' | 'llm' | 'self' | 'pending';
  checks: RubricCheck[];
  note: string;
  rubric: string[];
  needsSelfGrade?: boolean;
}

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

function buildRubricChecks(rubric: string[], verdict: Verdict, why: string): RubricCheck[] {
  return rubric.map((_, index) => ({
    i: index + 1,
    ok: verdict === 'correct',
    why,
  }));
}

function describeError(error: unknown): string {
  const message = (error as Error | undefined)?.message?.trim();
  return message || 'Grader unavailable';
}

export async function gradeAnswer(item: QuizItem, answer: string): Promise<GradeResult> {
  const rubric = rubricFor(item);

  try {
    const deterministic = gradeDeterministic(item, answer);
    if (deterministic.decided) {
      const verdict = deterministic.verdict ?? 'skipped';
      const explanation = deterministic.explanation ?? '';
      return {
        verdict,
        score: deterministic.score ?? 0,
        explanation,
        gradedBy: 'deterministic',
        checks: buildRubricChecks(rubric, verdict, explanation),
        note: explanation,
        rubric,
      };
    }
  } catch (error) {
    console.error('[grade] deterministic grader failed', { itemId: item?.id, error });
  }

  const llmState = useLlm.getState();
  if (!llmState.enabled) {
    return {
      verdict: 'skipped',
      score: 0,
      explanation: 'Assistant is off — grade this answer yourself.',
      gradedBy: 'pending',
      checks: [],
      note: 'Assistant is off — grade this answer yourself.',
      rubric,
      needsSelfGrade: true,
    };
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
    const message = describeError(error);
    return {
      verdict: 'skipped',
      score: 0,
      explanation: message,
      gradedBy: 'pending',
      checks: [],
      note: message,
      rubric,
      needsSelfGrade: true,
    };
  }
}
