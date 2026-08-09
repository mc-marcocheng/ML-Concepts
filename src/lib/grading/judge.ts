import type { QuizItem } from '@/lib/content/types';
import { ensureLlmHydrated, useLlm } from '@/lib/llm/client';
import { startTrace } from '@/lib/llm/trace';
import { stripThinking } from '@/lib/llm/providers/remote';
import { rubricFor } from './rubric';
import { presentAnswer, presentReference } from './present';

export interface RubricCheck {
  i: number;
  ok: boolean;
  why: string;
}

export interface JudgeResult {
  checks: RubricCheck[];
  note: string;
}

const SYSTEM = `You are a strict but fair grading assistant for a machine-learning revision app.
You are given a question, a reference answer, a student's answer, and a numbered list of criteria.
For each criterion decide only whether the student's answer satisfies it.
Judge meaning, not formatting. Different but equivalent forms are correct.
Do not invent criteria. Do not grade style, length or spelling. Return one entry per criterion, in order.
Reply with JSON only, no prose and no code fences, in exactly this shape:
{"checks":[{"i":1,"ok":true,"why":"short reason"}],"note":"one sentence summary"}`;

const EQUIVALENCE: Partial<Record<QuizItem['type'], string>> = {
  latex: `The answer is mathematics written in LaTeX. Treat as CORRECT any expression that is mathematically equivalent to the reference, including:
- reordered factors or terms of commutative operations (a b == b a, x+y == y+x)
- renamed bound/dummy variables or summation indices
- equivalent notation (\\mathbb{E}[X] == E[X], \\sum_{i=1}^{n} == \\sum_i, \\operatorname{Var} == Var, \\hat{f} == \\hat f)
- algebraically identical rearrangements and equivalent groupings/parentheses
- extra whitespace, \\left/\\right, \\,, \\dfrac vs \\frac, $ delimiters
Mark INCORRECT only when the mathematics genuinely differs (wrong operator, missing term, wrong exponent, wrong sign).`,
  code: `The answer is code. Treat as CORRECT any expression that computes the same result, including different but equivalent APIs (a @ b == np.dot(a, b) == (a * b).sum()), different but valid spacing, and equivalent keyword usage. Mark INCORRECT only when the computation differs, is invalid, or is left blank.`,
  short: `The answer is prose. Judge the idea, not the wording. Synonyms and different phrasings that convey the same point are CORRECT.`,
};

function extractJson(raw: string): JudgeResult | null {
  const text = stripThinking(raw)
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as JudgeResult;
  } catch {
    return null;
  }
}

function coerce(parsed: JudgeResult | null, criteria: number): JudgeResult | null {
  if (!parsed || !Array.isArray(parsed.checks) || !parsed.checks.length) return null;
  const seen = new Set<number>();
  const checks = parsed.checks
    .map(check => ({ i: Number(check?.i), ok: Boolean(check?.ok), why: String(check?.why ?? '') }))
    .filter(check => Number.isInteger(check.i) && check.i >= 1 && check.i <= criteria)
    .filter(check => (seen.has(check.i) ? false : (seen.add(check.i), true)))
    .sort((a, b) => a.i - b.i);
  if (!checks.length) return null;
  return { checks, note: typeof parsed.note === 'string' ? parsed.note : '' };
}

function buildPrompt(item: QuizItem, student: string, rubric: string[]) {
  const guidance = EQUIVALENCE[item.type];
  return [
    `ITEM TYPE: ${item.type}`,
    guidance ? `EQUIVALENCE POLICY:\n${guidance}` : '',
    `QUESTION: ${item.prompt}`,
    `REFERENCE ANSWER:\n${presentReference(item) || '(see criteria)'}`,
    `STUDENT ANSWER:\n${student || '(blank)'}`,
    'CRITERIA:',
    ...rubric.map((criterion, index) => `${index + 1}. ${criterion}`),
  ]
    .filter(Boolean)
    .join('\n\n');
}

export async function judge(item: QuizItem, rawStudentAnswer: string): Promise<JudgeResult> {
  ensureLlmHydrated();
  const llm = useLlm.getState();
  if (!llm.enabled) throw new Error('Assistant is off — grade this answer yourself.');

  const rubric = rubricFor(item);
  const student = presentAnswer(item, rawStudentAnswer);
  const prompt = buildPrompt(item, student, rubric);
  const tracer = startTrace('grade', { itemId: item.id, type: item.type, question: item.prompt });

  const run = async (label: string, userContent: string, json: boolean, maxTokens: number) =>
    tracer.span(label, 'grader', { prompt: userContent, json }, async span => {
      const output = await llm.generate({
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: userContent },
        ],
        temperature: 0,
        maxTokens,
        ...(json ? { responseFormat: 'json_object' as const } : {}),
        fallback: 'error',
        trace: { name: 'grade' },
      });
      span.setOutput(output);
      return output;
    });

  try {
    const attempts: Array<{ label: string; content: string; json: boolean; maxTokens: number }> = [
      { label: 'judge', content: prompt, json: true, maxTokens: 600 },
      { label: 'judge:retry', content: `${prompt}\n\nReturn ONLY the JSON object described above.`, json: true, maxTokens: 900 },
      // Some OpenAI-compatible servers and all WebLLM builds may reject
      // response_format; the last attempt drops it entirely.
      { label: 'judge:plain', content: `${prompt}\n\nReturn ONLY the JSON object described above.`, json: false, maxTokens: 900 },
    ];

    let lastText = '';
    let lastError: unknown = null;

    for (const attempt of attempts) {
      try {
        lastText = await run(attempt.label, attempt.content, attempt.json, attempt.maxTokens);
        const parsed = coerce(extractJson(lastText), rubric.length);
        if (parsed) return parsed;
      } catch (error) {
        lastError = error;
        if ((error as Error)?.name === 'AbortError') throw error;
      }
    }

    if (lastError) throw lastError as Error;
    throw new Error(`The grader replied with something that is not JSON: "${lastText.slice(0, 120)}"`);
  } finally {
    tracer.end();
  }
}
