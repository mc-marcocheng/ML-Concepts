'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Search } from 'lucide-react';
import { PRIMARY_NAV, isActive } from '@/lib/nav';
import { ThemeToggle } from './ThemeToggle';
import { Button } from '@/components/ui/Button';

export function Header({ onOpenMenu, onOpenSearch }: { onOpenMenu?: () => void; onOpenSearch?: () => void }) {
  const path = usePathname();

  return (
    <header className="sticky top-0 z-30 h-(--header-h) max-lg:h-16 border-b border-line bg-header backdrop-blur-[14px]">
      <div className="container-wide flex h-full items-center gap-2">
        <button className="app-row -ml-2" onClick={onOpenMenu} aria-label="Open navigation">
          <Menu size={20} aria-hidden="true" />
        </button>

        <Link href="/" className="mr-4 flex items-center gap-2 text-ink">
          <span className="h-2.5 w-2.5 rounded-[3px] border border-line-strong bg-primary" aria-hidden="true" />
          <span className="text-[18px] font-extrabold tracking-[-.03em]">ML Concepts</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-1" aria-label="Primary">
          {PRIMARY_NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(path, item) ? 'page' : undefined}
              className="app-row px-3.75 py-2.5 min-h-11 aria-[current=page]:bg-primary-pale aria-[current=page]:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onOpenSearch}
            className="app-row hidden md:flex gap-3 border border-line bg-card rounded-pill px-4 text-muted font-normal"
            aria-label="Search concepts"
          >
            <Search size={16} aria-hidden="true" />
            <span className="text-[14px]">Search</span>
            <kbd className="font-mono text-[11px] text-muted border border-line rounded-[6px] px-1.5 py-0.5">⌘K</kbd>
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
