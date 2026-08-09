'use client';

import { useLayoutEffect, useState } from 'react';

/**
 * True while `element` is actually laid out (i.e. not `display:none`).
 *
 * CSS is the single source of truth for the note-rail breakpoint; this hook
 * observes the result instead of duplicating the `xl:` / `lg:` value in JS.
 * `getClientRects()` is empty for `display:none`, unlike `getBoundingClientRect()`
 * which returns an all-zero rect for both hidden *and* zero-sized elements.
 */
export function useRailActive(element: HTMLElement | null): boolean {
  const [active, setActive] = useState(false);

  useLayoutEffect(() => {
    if (!element) {
      setActive(false);
      return;
    }

    const measure = () => setActive(element.getClientRects().length > 0);
    measure();

    // `documentElement` resizes with the viewport, so it fires even while the
    // rail itself is display:none (where RO may stay silent).
    const observer = new ResizeObserver(measure);
    observer.observe(document.documentElement);
    observer.observe(element);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, [element]);

  return active;
}
