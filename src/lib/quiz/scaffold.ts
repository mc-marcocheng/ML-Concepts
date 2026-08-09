import type { QuizBlank, QuizItem } from '@/lib/content/types';

export type ScaffoldSegment =
  | { kind: 'text'; text: string }
  | { kind: 'blank'; id: number };

/** Fresh regexes each call: /g regexes are stateful via lastIndex. */
const CANONICAL = () => /___BLANK_(\d+)___/g;
const NUMBERED = () => /_{3,}\s*(\d+)\s*_{3,}/g; // ___1___
const BARE = () => /_{3,}/g;                     // ___ or ______

/** Normalises the authored `blanks` array: integer ids, string answers, deduped. */
export function blanksOf(item: Pick<QuizItem, 'blanks'> | null | undefined): QuizBlank[] {
  const raw = Array.isArray(item?.blanks) ? item!.blanks : [];
  const mapped = raw.map((blank, index) => ({
    id: Number.isInteger(Number(blank?.id)) ? Number(blank.id) : index + 1,
    answer: typeof blank?.answer === 'string' ? blank.answer : '',
    rubric: Array.isArray(blank?.rubric)
      ? blank.rubric.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      : [],
  }));
  return mapped.filter((blank, index) => mapped.findIndex(other => other.id === blank.id) === index);
}

/**
 * Rewrites any supported placeholder syntax into `___BLANK_{id}___`.
 *
 *   `___BLANK_1___`  → kept as-is
 *   `___1___`        → `___BLANK_1___`
 *   `___`            → `___BLANK_{next blank id}___` (positional)
 *   no placeholder   → placeholders appended on their own lines
 */
export function canonicaliseScaffold(scaffold: string | undefined, blanks: QuizBlank[]): string {
  const ids = blanks.map(blank => blank.id);
  const source = (scaffold ?? '').replace(/\r\n/g, '\n');
  const trailer = ids.map(id => `___BLANK_${id}___`).join('\n');

  if (!source.trim()) return trailer;
  if (CANONICAL().test(source)) return source;
  if (NUMBERED().test(source)) return source.replace(NUMBERED(), (_match, n) => `___BLANK_${Number(n)}___`);

  let cursor = 0;
  const replaced = source.replace(BARE(), () => {
    const id = ids[cursor] ?? cursor + 1;
    cursor += 1;
    return `___BLANK_${id}___`;
  });

  if (cursor === 0 && ids.length) return `${replaced.replace(/\s+$/, '')}\n${trailer}`;
  return replaced;
}

export function parseScaffold(scaffold: string | undefined): ScaffoldSegment[] {
  const parts = (scaffold ?? '').split(/___BLANK_(\d+)___/g);
  return parts.map((part, index) =>
    index % 2 === 0
      ? ({ kind: 'text', text: part } as const)
      : ({ kind: 'blank', id: Number(part) } as const),
  );
}

export function blankIdsIn(scaffold: string | undefined): number[] {
  return parseScaffold(scaffold)
    .filter((segment): segment is { kind: 'blank'; id: number } => segment.kind === 'blank')
    .map(segment => segment.id);
}

/** Renders the scaffold with the learner's (or reference) values substituted in. */
export function fillScaffold(scaffold: string | undefined, values: Record<number, string>): string {
  return parseScaffold(scaffold)
    .map(segment => {
      if (segment.kind === 'text') return segment.text;
      const value = (values[segment.id] ?? '').trim();
      return value || `‹blank ${segment.id}›`;
    })
    .join('');
}

const oneLine = (value: string) => value.replace(/\s*\n+\s*/g, ' ').trim();

/** Canonical wire format for a code answer: one `#id: value` line per blank. */
export function encodeBlankAnswers(blanks: QuizBlank[], values: Record<number, string>): string {
  return blanks.map(blank => `#${blank.id}: ${oneLine(values[blank.id] ?? '')}`).join('\n');
}

export function decodeBlankAnswers(answer: string): Map<number, string> {
  const map = new Map<number, string>();
  for (const line of (answer ?? '').split('\n')) {
    const match = /^\s*#?(\d+)\s*:\s*(.*)$/.exec(line);
    if (match) map.set(Number(match[1]), match[2].trim());
  }
  return map;
}
