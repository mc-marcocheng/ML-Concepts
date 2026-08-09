import { cn } from '@/lib/utils/cn';

type Tone = 'content' | 'subtle' | 'feature-green' | 'feature-dark' | 'outlined';

const tones: Record<Tone, string> = {
  content: 'bg-card border border-line rounded-lg p-[22px]',
  subtle: 'bg-canvas-soft border border-line rounded-lg p-6',
  'feature-green': 'bg-primary-pale rounded-lg p-6',
  'feature-dark': 'bg-[#111510] text-[#f3f8f1] rounded-xl p-8 dark:bg-canvas-mint',
  outlined: 'bg-card border-2 border-line-strong rounded-lg p-6 shadow-offset transition-transform duration-[180ms] hover:-translate-y-[3px]',
};

export function Card({ tone = 'content', className, ...props }: React.HTMLAttributes<HTMLDivElement> & { tone?: Tone }) {
  return <div className={cn(tones[tone], 'min-w-0', className)} {...props} />;
}
