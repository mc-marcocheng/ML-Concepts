'use client';

import { create } from 'zustand';
import type { AskContext } from '@/lib/llm/types';

interface UiState {
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  openPalette: () => void;
  closePalette: () => void;
  askOpen: boolean;
  askContext: AskContext | null;
  askSeed: string | null;
  openAsk: (context?: AskContext | null, seed?: string) => void;
  clearAskContext: () => void;
  closeAsk: () => void;
  consumeSeed: () => string | null;
}

export const useUiStore = create<UiState>(set => ({
  paletteOpen: false,
  setPaletteOpen: open => set({ paletteOpen: open }),
  openPalette: () => set({ paletteOpen: true }),
  closePalette: () => set({ paletteOpen: false }),
  askOpen: false,
  askContext: null,
  askSeed: null,
  openAsk: (context, seed) => set(state => ({
    askOpen: true,
    askContext: context === undefined ? state.askContext : context,
    askSeed: seed ?? null,
  })),
  clearAskContext: () => set({ askContext: null, askSeed: null }),
  closeAsk: () => set({ askOpen: false }),
  consumeSeed: () => {
    let seed: string | null = null;
    set(state => {
      seed = state.askSeed;
      return { askSeed: null };
    });
    return seed;
  },
}));

