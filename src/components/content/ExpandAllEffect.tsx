'use client';

import { useEffect } from 'react';

export function ExpandAllEffect() {
  useEffect(() => {
    const openAll = () => document.querySelectorAll('details').forEach(detail => {
      detail.open = true;
    });
    const syncExpand = () => {
      const shouldExpand = document.documentElement.dataset.expandProofs === '1';
      document.querySelectorAll('details').forEach(detail => {
        detail.open = shouldExpand;
      });
    };
    if (document.documentElement.dataset.expandProofs === '1') openAll();
    window.addEventListener('beforeprint', openAll);
    window.addEventListener('mlc:expandProofs', syncExpand as EventListener);
    if (location.hash) {
      const el = document.querySelector(location.hash);
      el?.closest('details')?.setAttribute('open', '');
      el?.scrollIntoView();
    }
    return () => {
      window.removeEventListener('beforeprint', openAll);
      window.removeEventListener('mlc:expandProofs', syncExpand as EventListener);
    };
  }, []);

  return null;
}
