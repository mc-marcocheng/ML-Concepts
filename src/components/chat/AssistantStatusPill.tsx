'use client';

import { useEffect } from 'react';
import { useLlm } from '@/lib/llm/client';

export function AssistantStatusPill() {
  const hydrate = useLlm(state => state.hydrate);
  const hydrated = useLlm(state => state.hydrated);
  const enabled = useLlm(state => state.enabled);
  const provider = useLlm(state => state.provider);
  const remoteModel = useLlm(state => state.remote.model);
  const onDeviceModelKey = useLlm(state => state.onDeviceModelKey);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) return null;

  const label = !enabled
    ? 'Off'
    : provider === 'remote'
      ? `Remote · ${remoteModel || 'unset'}`
      : `On-device · ${onDeviceModelKey}`;

  return (
    <span className={`truncate rounded-pill px-2.5 py-1 font-mono text-[11px] ${enabled ? 'bg-primary-pale text-ink' : 'bg-canvas-soft text-muted'}`}>
      {label}
    </span>
  );
}