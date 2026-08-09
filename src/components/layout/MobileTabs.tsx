'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import { PRIMARY_NAV, isActive } from '@/lib/nav';

export function MobileTabs({ onOpenAsk }: { onOpenAsk?: () => void }) {
  const path = usePathname();
  const tabs = PRIMARY_NAV.filter(item => item.tab);

  return (
    <nav aria-label="Sections" className="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-line bg-header backdrop-blur-[14px] pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-5">
        {tabs.map(item => {
          const Icon = item.icon;
          const active = isActive(path, item);
          const cls = 'flex h-[56px] flex-col items-center justify-center gap-1 text-[11px] font-semibold';
          const content = (
            <>
              <Icon size={20} aria-hidden="true" className={active ? 'text-ink' : 'text-muted'} />
              <span className={active ? 'text-ink' : 'text-muted'}>{item.label}</span>
            </>
          );
          return (
            <li key={item.href}>
              <Link href={item.href} className={cls} aria-current={active ? 'page' : undefined}>
                {content}
              </Link>
            </li>
          );
        })}
        <li>
          <button className="flex h-14 w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold" onClick={onOpenAsk} aria-label="Open assistant">
            <MessageSquare size={20} aria-hidden="true" className="text-muted" />
            <span className="text-muted">Ask</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
