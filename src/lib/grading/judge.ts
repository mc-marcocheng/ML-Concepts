import type { QuizItem } from '@/lib/content/types';
import { ensureLlmHydrated, useLlm } from '@/lib/llm/client';
import { startTrace } from '@/lib/llm/trace';
import { stripThinking } from '@/lib/llm/providers/remote';

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
Judge meaning, not formatting. Different but mathematically equivalent forms are correct.
Do not invent criteria. Do not grade style, length or spelling.
Reply with JSON only, no prose and no code fences, in exactly this shape:
{"checks":[{"i":1,"ok":true,"why":"short reason"}],"note":"one sentence summary"}`;

const SCHEMA = {
  type: 'object',
  properties: {
    checks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          i: { type: 'integer' },
          ok: { type: 'boolean' },
          why: { type: 'string' },
        },
        required: ['i', 'ok', 'why'],
      },
    },
    note: { type: 'string' },
  },
  required: ['checks', 'note'],
} as const;

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

function rubricFor(item: QuizItem | null | undefined): string[] {
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

function buildPrompt(item: QuizItem, student: string) {
  const rubric = rubricFor(item);
  return [
    `QUESTION: ${item.prompt}`,
    `REFERENCE ANSWER: ${item.answer ?? '(see criteria)'}`,
    `STUDENT ANSWER: ${student || '(blank)'}`,
    'CRITERIA:',
    ...rubric.map((criterion, index) => `${index + 1}. ${criterion}`),
  ].join('\n');
}

export async function judge(item: QuizItem, student: string): Promise<JudgeResult> {
  ensureLlmHydrated();
  const llm = useLlm.getState();
  if (!llm.enabled) {
    throw new Error('Assistant is off — grade this answer yourself.');
  }

  const prompt = buildPrompt(item, student);
  const tracer = startTrace('grade', { itemId: item.id, question: item.prompt });
  try {
    const text = await tracer.span('judge', 'grader', { prompt }, async span => {
      const output = await llm.generate({
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: prompt },
        ],
        temperature: 0,
        maxTokens: 500,
        responseFormat: 'json_object',
        fallback: 'error',
        trace: { name: 'grade' },
      });
      span.setOutput(output);
      return output;
    });
    const parsed = extractJson(text);
    if (parsed?.checks?.length) {
      return {
        checks: parsed.checks.map(check => ({ i: Number(check.i), ok: Boolean(check.ok), why: String(check.why) })),
        note: parsed.note ?? '',
      };
    }

    const retry = await tracer.span('judge', 'grader', { prompt, retry: true }, async span => {
      const output = await llm.generate({
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `${prompt}\n\nReturn ONLY the JSON object described above.` },
        ],
        temperature: 0,
        maxTokens: 800,
        responseFormat: 'json_object',
        fallback: 'error',
        trace: { name: 'grade' },
      });
      span.setOutput(output);
      return output;
    });
    const retryParsed = extractJson(retry);
    if (retryParsed?.checks?.length) {
      return {
        checks: retryParsed.checks.map(check => ({ i: Number(check.i), ok: Boolean(check.ok), why: String(check.why) })),
        note: retryParsed.note ?? '',
      };
    }

    throw new Error(`The grader replied with something that is not JSON: "${text.slice(0, 120)}"`);
  } finally {
    tracer.end();
  }
}
