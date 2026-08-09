'use client';

import { Check, X } from 'lucide-react';
import type { QuizItem } from '@/lib/content/types';
import { blanksOf, parseScaffold } from '@/lib/quiz/scaffold';

export function CodeCloze({
  item,
  values,
  onChange,
  onSubmit,
  disabled = false,
  checks,
}: {
  item: QuizItem;
  values: Record<number, string>;
  onChange: (id: number, value: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  /** Optional per-blank correctness, shown after grading. Key = blank id. */
  checks?: Record<number, boolean>;
}) {
  const blanks = blanksOf(item);
  const segments = parseScaffold(item.scaffold);
  const hasInlineBlanks = segments.some(segment => segment.kind === 'blank');

  const renderInput = (id: number) => {
    const value = values[id] ?? '';
    const state = checks?.[id];
    const tone =
      state === undefined
        ? 'border-line-strong bg-primary-pale'
        : state
          ? 'border-positive bg-positive-pale'
          : 'border-negative bg-negative-pale';

    return (
      <input
        key={`blank-${id}`}
        value={value}
        disabled={disabled}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        inputMode="text"
        onChange={event => onChange(id, event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            onSubmit?.();
          }
        }}
        aria-label={`Blank ${id}`}
        style={{ width: `${Math.min(64, Math.max(18, value.length + 4))}ch` }}
        className={`mx-1 inline-block h-[1.7em] rounded-[8px] border-2 px-2 py-0 align-middle font-mono text-[13px] leading-none text-ink disabled:opacity-70 focus:bg-card focus-visible:outline-2 focus-visible:outline-offset-[-2px] ${tone}`}
      />
    );
  };

  return (
    <div className="codeblock">
      <div className="codeblock__bar">
        <span>{item.lang ?? 'python'}</span>
        <span>
          {blanks.length} blank{blanks.length === 1 ? '' : 's'}
        </span>
      </div>

      <pre className="overflow-x-auto whitespace-pre-wrap px-4 py-3 leading-[2.1]">
        <code className="font-mono text-[13.5px]">
          {segments.map((segment, index) =>
            segment.kind === 'text'
              ? <span key={`text-${index}`}>{segment.text}</span>
              : renderInput(segment.id),
          )}
        </code>
      </pre>

      {/* Defensive: an authored scaffold with no placeholder still gets inputs. */}
      {!hasInlineBlanks && blanks.length ? (
        <div className="grid gap-2 border-t border-line px-4 py-3">
          {blanks.map(blank => (
            <label key={blank.id} className="flex items-center gap-3">
              <span className="font-mono text-[12px] text-muted">Blank {blank.id}</span>
              {renderInput(blank.id)}
            </label>
          ))}
        </div>
      ) : null}

      {checks ? (
        <ul className="grid gap-1 border-t border-line px-4 py-3">
          {blanks.map(blank => (
            <li key={blank.id} className="flex items-center gap-2 font-mono text-[12px] text-muted">
              {checks[blank.id] ? (
                <Check size={13} className="text-positive-content" aria-hidden="true" />
              ) : (
                <X size={13} className="text-negative-content" aria-hidden="true" />
              )}
              <span>
                Blank {blank.id} reference: <code>{blank.answer}</code>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
