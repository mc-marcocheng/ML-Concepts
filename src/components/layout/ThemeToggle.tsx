'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { getTheme, toggleTheme, type Theme } from '@/lib/utils/theme';

export function ThemeToggle({ withLabel = false }: { withLabel?: boolean }) {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    setThemeState(getTheme());
    const handler = (event: Event) => setThemeState((event as CustomEvent<Theme>).detail);
    window.addEventListener('mlc:themechange', handler);
    return () => window.removeEventListener('mlc:themechange', handler);
  }, []);

  const next = theme === 'dark' ? 'light' : 'dark';
  const label = `Switch to ${next} mode`;

  return (
    <button onClick={toggleTheme} aria-label={label} title={label} className="app-row min-h-11 rounded-pill border border-line bg-card px-3 hover:bg-primary-pale hover:text-ink">
      {theme === 'dark' ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
      {withLabel && <span className="text-[14px]">{label}</span>}
    </button>
  );
}
