'use client';

import { useEffect, useState } from 'react';
import { Header } from './Header';
import { MobileTabs } from './MobileTabs';
import { NavDrawer } from './NavDrawer';
import { type ConceptMeta } from '@/lib/content/types';
import { useUiStore } from '@/lib/store/ui';
import { CommandPalette } from '@/components/search/CommandPalette';
import { AskDock } from '@/components/chat/AskDock';
import { LlmHydrator } from '@/components/chat/LlmHydrator';
import { SelectionToolbar } from '@/components/chat/SelectionToolbar';
import { OfflineBanner } from './OfflineBanner';

export function AppChrome({ children, concepts }: { children: React.ReactNode; concepts: ConceptMeta[] }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const openPalette = useUiStore(state => state.openPalette);

  useEffect(() => {
    setReady(true);
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return (
    <>
      <Header onOpenMenu={() => setMobileNavOpen(true)} onOpenSearch={openPalette} />
      <OfflineBanner />
      <main id="main" className="min-w-0">{children}</main>
      <MobileTabs onOpenAsk={() => useUiStore.getState().openAsk(null)} />
      {ready && <NavDrawer concepts={concepts} open={mobileNavOpen} onOpenChange={setMobileNavOpen} />}
      <LlmHydrator />
      <SelectionToolbar />
      <AskDock />
      <CommandPalette />
    </>
  );
}
