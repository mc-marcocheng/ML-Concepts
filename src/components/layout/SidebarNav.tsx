"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CATEGORIES } from '@/lib/content/categories';
import type { ConceptMeta } from '@/lib/content/types';
import { Sheet } from '@/components/layout/Sheet';

function MasteryDot({ v }: { v: number }) {
  const tone = v >= 0.8 ? 'bg-primary' : v >= 0.4 ? 'bg-primary-pale border border-line-strong' : 'bg-transparent border border-line';
  return <span className={`ml-auto h-2.5 w-2.5 flex-none rounded-full ${tone}`} aria-hidden="true" />;
}

export function SidebarTree({ concepts }: { concepts: ConceptMeta[] }) {
  const path = usePathname();
  const byCategory = CATEGORIES.map(category => [category, concepts.filter(concept => concept.category === category.id)] as const).filter(([, list]) => list.length);

  return (
    <nav aria-label="Concepts" className="grid gap-6">
      {byCategory.map(([category, items]) => (
        <section key={category.id}>
          <h2 className="t-eyebrow px-3 pb-2 text-muted">{category.title}</h2>
          <ul className="grid gap-0.5">
            {items.map(item => (
              <li key={item.id}>
                <Link href={item.href} className="app-row pr-3" aria-current={path === item.href ? 'page' : undefined}>
                  <span className="truncate">{item.title}</span>
                  <MasteryDot v={item.hasQuiz ? 0.7 : 0.2} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}

export function SidebarNav({ concepts, open, onOpenChange }: { concepts: ConceptMeta[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} side="left" title="Navigation">
      <div className="overflow-y-auto p-4">
        <SidebarTree concepts={concepts} />
      </div>
    </Sheet>
  );
}
