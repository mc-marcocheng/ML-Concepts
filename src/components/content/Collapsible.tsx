import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export function Collapsible({ id, label, title, meta, defaultOpen, children, className }: {
  id?: string;
  label: string;
  title?: string;
  meta?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <details id={id} open={defaultOpen} className={cn('collapsible', className)}>
      <summary>
        <ChevronRight size={16} className="collapsible__caret" aria-hidden="true" />
        <span className="uppercase tracking-[.08em] text-[11px] text-muted">{label}</span>
        {title ? <span className="font-sans text-[14px] font-[650] text-ink">{title}</span> : null}
        {meta ? <span className="ml-auto text-muted text-[12px]">{meta}</span> : null}
      </summary>
      <div className="collapsible__body">{children}</div>
    </details>
  );
}
