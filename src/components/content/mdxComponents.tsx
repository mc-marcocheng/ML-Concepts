import Link from 'next/link';
import { TriangleAlert, Lightbulb } from 'lucide-react';
import { Collapsible } from '@/components/content/Collapsible';

interface CollapsibleProps {
  children: React.ReactNode;
  title?: string;
  lines?: number;
  id?: string;
}

export const mdxComponents = {
  TLDR: ({ children }: { children?: React.ReactNode }) => (
    <div className="rounded-lg bg-primary-pale p-6 my-6">
      <p className="t-eyebrow text-primary-deep mb-2">TL;DR</p>
      <div className="text-[17px] leading-[1.7] text-ink [&_p]:m-0 [&_p+p]:mt-3">{children}</div>
    </div>
  ),
  Proof: ({ title, lines, id, children }: CollapsibleProps) => (
    <Collapsible id={id} label="Proof" title={title} meta={lines ? `${lines} lines` : undefined}>
      {children}
    </Collapsible>
  ),
  Derivation: (props: CollapsibleProps) => <Collapsible label="Derivation" {...props} />,
  Example: (props: CollapsibleProps) => <Collapsible label="Example" {...props} />,
  Aside: (props: CollapsibleProps) => <Collapsible label="Aside" {...props} />,
  Pitfall: ({ children }: { children?: React.ReactNode }) => (
    <aside className="my-6 flex gap-3 rounded-lg border border-line bg-warning-pale p-5 text-warning-content">
      <TriangleAlert size={18} className="mt-1 flex-none" aria-hidden="true" />
      <div className="text-[15px] leading-[1.65] [&_p]:m-0 [&_p+p]:mt-2">
        <p className="t-eyebrow mb-1">Pitfall</p>{children}
      </div>
    </aside>
  ),
  Intuition: ({ children }: { children?: React.ReactNode }) => (
    <aside className="my-6 flex gap-3 rounded-lg bg-canvas-mint p-5">
      <Lightbulb size={18} className="mt-1 flex-none text-primary-deep" aria-hidden="true" />
      <div className="text-[15px] leading-[1.65] text-body [&_p]:m-0">{children}</div>
    </aside>
  ),
  a: ({ href = '', ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (href.startsWith('/') ? <Link href={href} {...props} /> : <a href={href} target="_blank" rel="noopener noreferrer" {...props} />),
};
