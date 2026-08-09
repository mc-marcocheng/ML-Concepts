'use client';

import { create } from 'zustand';

export interface DraftAnchor {
  exact: string;
  prefix: string;
  suffix: string;
  start: number;
}

interface AnnotationUi {
  draft: DraftAnchor | null;
  startDraft: (draft: DraftAnchor) => void;
  clearDraft: () => void;
}

export const useAnnotationUi = create<AnnotationUi>(set => ({
  draft: null,
  startDraft: draft => set({ draft }),
  clearDraft: () => set({ draft: null }),
}));