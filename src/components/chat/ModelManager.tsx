'use client';

import { useEffect, useRef, useState } from 'react';
import { useLlm } from '@/lib/llm/client';
import { Button } from '@/components/ui/Button';
import { DEFAULT_ON_DEVICE_KEY, probeWebGpu } from '@/lib/llm/capability';
import { OnDeviceModels } from './OnDeviceModels';
import { checkOnDevice, checkRemote, type HealthReport } from '@/lib/llm/health';

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string }) {
  return (
    <label className="grid gap-1.5">
      <span className="t-eyebrow text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 rounded-md border border-line bg-canvas-soft px-3 text-[14px] text-ink outline-none focus:border-line-strong"
      />
    </label>
  );
}

export function ModelManager() {
  const provider = useLlm(state => state.provider);
  const enabled = useLlm(state => state.enabled);
  const onDeviceModelKey = useLlm(state => state.onDeviceModelKey);
  const remote = useLlm(state => state.remote);
  const rememberApiKey = useLlm(state => state.rememberApiKey);
  const setProvider = useLlm(state => state.setProvider);
  const setEnabled = useLlm(state => state.setEnabled);
  const setOnDeviceModel = useLlm(state => state.setOnDeviceModel);
  const setRemote = useLlm(state => state.setRemote);
  const setRememberApiKey = useLlm(state => state.setRememberApiKey);
  const hydrate = useLlm(state => state.hydrate);
  const [webGpu, setWebGpu] = useState<{ supported: boolean } | null>(null);
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [checking, setChecking] = useState(false);
  const checkAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    hydrate();
    probeWebGpu().then(result => setWebGpu(result)).catch(() => setWebGpu({ supported: false }));
  }, [hydrate]);

  const runCheck = async () => {
    checkAbort.current?.abort();
    const controller = new AbortController();
    checkAbort.current = controller;
    setChecking(true);
    try {
      setHealth(provider === 'remote'
        ? await checkRemote(remote, controller.signal)
        : await checkOnDevice(onDeviceModelKey));
    } finally {
      setChecking(false);
      checkAbort.current = null;
    }
  };

  return (
    <section id="assistant" className="mt-4 rounded-lg border border-line bg-card p-5">
      <p className="t-eyebrow text-muted">Assistant</p>
      <div className="mt-4 grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-extrabold text-ink">Model settings</h2>
            <p className="mt-1 text-[15px] text-body">Use a remote OpenAI-compatible endpoint, or an on-device WebGPU model. Turn the assistant on or off separately.</p>
          </div>
          <div className="flex items-center gap-2 rounded-pill border border-line bg-canvas-soft px-2 py-1">
            <select value={provider} onChange={event => setProvider(event.target.value as 'remote' | 'ondevice')} className="bg-transparent px-2 text-[13px] text-ink outline-none" aria-label="Provider">
              <option value="remote">Remote model</option>
              <option value="ondevice">On-device</option>
            </select>
            <button type="button" onClick={() => setEnabled(!enabled)} className={`rounded-pill px-3 py-1 text-[12px] font-semibold ${enabled ? 'bg-primary-pale text-ink' : 'bg-card text-muted'}`}>
              {enabled ? 'On' : 'Off'}
            </button>
          </div>
        </div>

        {provider === 'remote' ? (
          <div className="rounded-lg border border-line bg-canvas-soft p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-[16px] font-extrabold text-ink">Remote endpoint</h3>
                <p className="mt-1 text-[14px] text-body">OpenAI-compatible endpoints work here, including Ollama and OpenRouter-style servers.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field label="Base URL" value={remote.baseUrl} onChange={value => setRemote({ baseUrl: value })} placeholder="https://api.openai.com/v1" />
              <Field label="Model" value={remote.model} onChange={value => setRemote({ model: value })} placeholder="gpt-4o-mini" />
              <Field label="API key" value={remote.apiKey} onChange={value => setRemote({ apiKey: value })} placeholder="sk-..." type="password" />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="t-eyebrow text-muted">Max output tokens</span>
                <input
                  type="number"
                  min={128}
                  max={8192}
                  step={128}
                  value={remote.maxTokens}
                  onChange={event => setRemote({ maxTokens: Math.max(128, Number(event.target.value) || 1024) })}
                  className="h-11 rounded-md border border-line bg-canvas-soft px-3 text-[14px] text-ink outline-none focus:border-line-strong"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="t-eyebrow text-muted">Reasoning effort</span>
                <select
                  value={remote.reasoningEffort}
                  onChange={event => setRemote({ reasoningEffort: event.target.value as 'none' | 'low' | 'medium' | 'high' })}
                  className="h-11 rounded-md border border-line bg-canvas-soft px-3 text-[14px] text-ink outline-none focus:border-line-strong"
                >
                  <option value="none">Off (non-reasoning models)</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
            </div>
            <p className="mt-2 text-[13px] text-muted">Reasoning models automatically use <code className="font-mono">max_completion_tokens</code> and get extra hidden-reasoning budget on top of the value above.</p>
              <label className="mt-3 inline-flex items-center gap-2 text-[13px] text-body">
                <input
                  type="checkbox"
                  checked={rememberApiKey}
                  onChange={event => setRememberApiKey(event.target.checked)}
                  className="h-4 w-4 rounded border-line text-primary"
                />
                Remember API key on this device
              </label>
          </div>
        ) : (
          <OnDeviceModels
            supported={Boolean(webGpu?.supported)}
            selectedKey={onDeviceModelKey}
            onSelect={setOnDeviceModel}
          />
        )}

        <div className="rounded-lg border border-line bg-canvas-soft p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-[16px] font-extrabold text-ink">Connection check</h3>
              <p className="mt-1 text-[14px] text-body">Uses <code className="font-mono">GET /models</code> first, so it normally costs zero tokens.</p>
            </div>
            <Button size="sm" variant="tertiary" onClick={runCheck} disabled={checking}>
              {checking ? 'Checking…' : 'Run check'}
            </Button>
          </div>

          {health ? (
            <ul className="mt-4 grid gap-2" aria-live="polite">
              {health.steps.map(step => (
                <li key={`${step.label}:${step.detail}`} className="flex items-start gap-3 text-[14px] leading-6">
                  <span
                    aria-hidden="true"
                    className={`mt-1 h-2.5 w-2.5 flex-none rounded-full ${
                      step.level === 'ok' ? 'bg-positive-content' : step.level === 'warn' ? 'bg-warning-content' : 'bg-negative-content'
                    }`}
                  />
                  <span className="min-w-0">
                    <b className="text-ink">{step.label}</b>
                    <span className="ml-2 text-body">{step.detail}</span>
                    {step.ms != null ? <span className="ml-2 font-mono text-[12px] text-muted">{step.ms} ms</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {provider === 'remote' ? <Button variant="tertiary" size="sm" onClick={() => setRemote({ baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', maxTokens: 1024, reasoningEffort: 'low' })}>Reset remote defaults</Button> : null}
          {provider === 'ondevice' ? <Button variant="tertiary" size="sm" onClick={() => setOnDeviceModel(DEFAULT_ON_DEVICE_KEY)}>Reset on-device model</Button> : null}
        </div>
      </div>
    </section>
  );
}
