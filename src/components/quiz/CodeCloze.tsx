'use client';

import type { QuizItem } from '@/lib/content/types';

export function CodeCloze({ item, values, onChange, onSubmit }: {
  item: QuizItem;
  values: Record<number, string>;
  onChange: (id: number, value: string) => void;
  onSubmit?: () => void;
}) {
  const parts = (item.scaffold ?? '').split(/___BLANK_(\d+)___/g);

  return (
    <div className="codeblock">
      <div className="codeblock__bar">
        <span>{item.lang ?? 'python'}</span>
        <span>{item.blanks?.length ?? 0} blanks</span>
      </div>
      <pre className="whitespace-pre-wrap"><code className="font-mono text-[13.5px]">
        {parts.map((part, index) => {
          if (index % 2 === 0) return <span key={index}>{part}</span>;
          const blankId = Number(part);
          return (
            <input
              key={index}
              value={values[blankId] ?? ''}
              spellCheck={false}
              onChange={event => onChange(blankId, event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  onSubmit?.();
                }
              }}
              aria-label={`Blank ${blankId}`}
              style={{ width: `${Math.max(18, (values[blankId]?.length ?? 0) + 4)}ch` }}
              className="mx-1 inline-block rounded-[8px] border-2 border-line-strong bg-primary-pale px-2 py-0.5 font-mono text-[13px] text-ink align-baseline focus:bg-card"
            />
          );
        })}
      </code></pre>
    </div>
  );
}
