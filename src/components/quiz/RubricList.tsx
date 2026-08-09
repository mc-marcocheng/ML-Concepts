'use client';

import { Check, X } from 'lucide-react';

export function RubricList({ rubric, checks }: { rubric: string[]; checks: { i: number; ok: boolean; why: string }[] }) {
  return (
    <ul className="grid gap-2">
      {rubric.map((criterion, index) => {
        const check = checks.find(item => item.i === index + 1);
        return (
          <li key={criterion} className="flex items-start gap-3 text-[15px] leading-6 text-body">
            <span
              aria-hidden="true"
              className={`mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full ${check?.ok ? 'bg-positive-pale text-positive-content' : 'bg-negative-pale text-negative-content'}`}
            >
              {check?.ok ? <Check size={13} /> : <X size={13} />}
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
