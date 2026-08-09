'use client';

import { useEffect, useState } from 'react';
import { useLlm } from '@/lib/llm/client';
import { ON_DEVICE_MODELS, probeWebGpu } from '@/lib/llm/capability';

export function ModelPicker() {
  const enabled = useLlm(state => state.enabled);
  const provider = useLlm(state => state.provider);
  const setEnabled = useLlm(state => state.setEnabled);
  const setProvider = useLlm(state => state.setProvider);
  const onDeviceModelKey = useLlm(state => state.onDeviceModelKey);
  const setOnDeviceModel = useLlm(state => state.setOnDeviceModel);
  const hydrate = useLlm(state => state.hydrate);
  const [ready, setReady] = useState(false);
  const [webGpu, setWebGpu] = useState<{ supported: boolean } | null>(null);

  useEffect(() => {
    setReady(true);
    hydrate();
    probeWebGpu().then(result => setWebGpu(result)).catch(() => setWebGpu({ supported: false }));
  }, [hydrate]);

  return (
    <div className="ml-2 flex items-center gap-2 rounded-pill border border-line bg-card px-3 py-1.5 text-[12px] text-muted">
      <select
        value={provider}
        onChange={event => setProvider(event.target.value as 'remote' | 'ondevice')}
        className="bg-transparent text-[12px] text-ink outline-none"
        aria-label="Choose provider"
      >
        <option value="remote">Remote endpoint</option>
        <option value="ondevice">On-device</option>
      </select>

      {provider === 'ondevice' ? (
        <>
          <select
            value={onDeviceModelKey}
            onChange={event => setOnDeviceModel(event.target.value)}
            className="bg-transparent text-[12px] text-ink outline-none"
            aria-label="Choose on-device model"
          >
            {ON_DEVICE_MODELS.map(model => <option key={model.key} value={model.key}>{model.label}</option>)}
          </select>
          <span className={`rounded-pill px-2 py-1 text-[11px] font-semibold ${webGpu?.supported ? 'bg-primary-pale text-ink' : 'bg-warning-pale text-warning-content'}`}>
            {webGpu?.supported ? 'WebGPU ready' : 'WebGPU needed'}
          </span>
        </>
      ) : null}

      <button
        type="button"
        onClick={() => setEnabled(!enabled)}
        className={`rounded-pill px-2 py-1 text-[11px] font-semibold ${enabled ? 'bg-primary-pale text-ink' : 'bg-canvas-soft text-muted'}`}
        aria-label={enabled ? 'Disable assistant' : 'Enable assistant'}
        disabled={!ready}
      >
        {enabled ? 'On' : 'Off'}
      </button>
    </div>
  );
}

