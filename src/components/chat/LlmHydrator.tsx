'use client';

import { useEffect } from 'react';
import { useLlm } from '@/lib/llm/client';

export function LlmHydrator() {
  const hydrate = useLlm(state => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return null;
}
