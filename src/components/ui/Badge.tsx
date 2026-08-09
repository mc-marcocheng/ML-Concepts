import { cn } from '@/lib/utils/cn';

type Tone = 'neutral' | 'primary' | 'positive' | 'warning' | 'negative' | 'information';

const tones: Record<Tone, string> = {
  neutral: 'bg-canvas-soft text-body',
  primary: 'bg-primary-pale text-ink',
  positive: 'bg-positive-pale text-positive-content',
  warning: 'bg-warning-pale text-warning-content',
  negative: 'bg-negative-pale text-negative-content',
  information: 'bg-information-pale text-information-content',
};

export function Badge({ tone = 'neutral', mono, className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone; mono?: boolean }) {
  return <span className={cn('inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-[12px] font-semibold', mono && 'font-mono tracking-[.02em]', tones[tone], className)} {...props} />;
}
