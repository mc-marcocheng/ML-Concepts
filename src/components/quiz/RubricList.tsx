'use client';

import { Check, Minus, X } from 'lucide-react';

export function RubricList({ rubric, checks }: { rubric: string[]; checks: { i: number; ok: boolean; why: string }[] }) {
  return (
    <ul className="grid gap-2">
      {rubric.map((criterion, index) => {
        const check = checks.find(item => item.i === index + 1);
        const tone =
          check === undefined
            ? 'bg-canvas-soft text-muted'
            : check.ok
              ? 'bg-positive-pale text-positive-content'
              : 'bg-negative-pale text-negative-content';

        return (
          <li key={`${index}-${criterion}`} className="flex items-start gap-3 text-[15px] leading-6 text-body">
            <span aria-hidden="true" className={`mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full ${tone}`}>
              {check === undefined ? <Minus size={13} /> : check.ok ? <Check size={13} /> : <X size={13} />}
            </span>
            <span>
              <span className="text-ink">{criterion}</span>
              {check?.why ? <span className="ml-2 font-mono text-[12px] text-muted">{check.why}</span> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
