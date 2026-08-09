'use client';

import { useLayoutEffect, useState, type RefObject } from 'react';

export function useContainerWidth<T extends HTMLElement>(ref: RefObject<T | null>) {
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const apply = (next: number) => setWidth(previous => (Math.abs(previous - next) < 1 ? previous : Math.round(next)));
    apply(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(entries => apply(entries[0]?.contentRect.width ?? 0));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}