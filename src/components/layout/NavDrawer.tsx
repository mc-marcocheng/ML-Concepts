'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CATEGORIES } from '@/lib/content/categories';
import type { ConceptMeta } from '@/lib/content/types';
import { Sheet } from './Sheet';
import { PRIMARY_NAV, SECONDARY_NAV, isActive } from '@/lib/nav';

export function NavDrawer({ concepts, open, onOpenChange }: {
  concepts: ConceptMeta[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const path = usePathname();
  const grouped = CATEGORIES
    .map(category => [category, concepts.filter(concept => concept.category === category.id)] as const)
    .filter(([, items]) => items.length);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} side="left" title="Navigation">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        <nav aria-label="Primary" className="grid gap-0.5">
          {[...PRIMARY_NAV, ...SECONDARY_NAV].map(item => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onOpenChange(false)}
                aria-current={isActive(path, item) ? 'page' : undefined}
                className="app-row gap-3 px-3"
              >
                <Icon size={17} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <hr className="my-4 border-line" />

        <nav aria-label="Concepts" className="grid gap-6">
          {grouped.map(([category, items]) => (
            <section key={category.id}>
              <h2 className="t-eyebrow px-3 pb-2 text-muted">{category.title}</h2>
              <ul className="grid gap-0.5">
                {items.map(item => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={() => onOpenChange(false)}
                      className="app-row pr-3"
                      aria-current={path === item.href ? 'page' : undefined}
                    >
                      <span className="truncate">{item.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
      </div>
    </Sheet>
  );
}