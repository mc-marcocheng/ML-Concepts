'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Search } from 'lucide-react';
import { PRIMARY_NAV, isActive } from '@/lib/nav';
import { ThemeToggle } from './ThemeToggle';

export function Header({ onOpenMenu, onOpenSearch }: { onOpenMenu?: () => void; onOpenSearch?: () => void }) {
  const path = usePathname();

  return (
    <header className="sticky top-0 z-30 h-(--header-h) border-b border-line bg-header backdrop-blur-[14px]">
      <div className="container-wide flex h-full items-center gap-2">
        <button className="app-row -ml-2 min-h-11 min-w-11 justify-center lg:hidden" onClick={onOpenMenu} aria-label="Open navigation">
          <Menu size={20} aria-hidden="true" />
        </button>

        <Link href="/" className="mr-4 flex min-w-0 items-center gap-2 text-ink">
          <span className="h-2.5 w-2.5 rounded-[3px] border border-line-strong bg-primary" aria-hidden="true" />
          <span className="truncate text-[18px] font-extrabold tracking-[-.03em]">ML Concepts</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {PRIMARY_NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(path, item) ? 'page' : undefined}
              className="app-row min-h-11 px-3.75 py-2.5 aria-[current=page]:bg-primary-pale aria-[current=page]:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onOpenSearch}
            className="grid h-11 w-11 place-items-center rounded-pill border border-line bg-card text-ink hover:bg-primary-pale lg:hidden"
            aria-label="Search concepts"
          >
            <Search size={18} aria-hidden="true" />
          </button>

          <div className="hidden lg:block">
            <button
              onClick={onOpenSearch}
              className="app-row gap-3 rounded-pill border border-line bg-card px-4 font-normal text-muted"
              aria-label="Search concepts"
            >
              <Search size={16} aria-hidden="true" />
              <span className="text-[14px]">Search</span>
              <kbd className="rounded-[6px] border border-line px-1.5 py-0.5 font-mono text-[11px] text-muted">⌘K</kbd>
            </button>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
