'use client';

import type { RemoteModelConfig } from './types';
import { isReasoningModel } from './providers/remote';

export type HealthLevel = 'ok' | 'warn' | 'fail';

export interface HealthStep {
  label: string;
  level: HealthLevel;
  detail: string;
  ms?: number;
}

export interface HealthReport {
  level: HealthLevel;
  steps: HealthStep[];
  ranAt: number;
}

const trimSlash = (value: string) => value.replace(/\/+$/, '');

function worst(steps: HealthStep[]): HealthLevel {
  if (steps.some(step => step.level === 'fail')) return 'fail';
  if (steps.some(step => step.level === 'warn')) return 'warn';
  return 'ok';
}

function describe(error: unknown) {
  const message = (error as Error)?.message ?? String(error);
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
    return 'Network/CORS failure — check the URL and that the server sends CORS headers';
  }
  return message;
}

export async function checkRemote(config: RemoteModelConfig, signal?: AbortSignal): Promise<HealthReport> {
  const steps: HealthStep[] = [];
  const base = trimSlash(config.baseUrl || '');

  if (!/^https?:\/\//.test(base)) {
    steps.push({ label: 'Base URL', level: 'fail', detail: 'Must start with http:// or https://' });
    return { level: 'fail', steps, ranAt: Date.now() };
  }

  steps.push({ label: 'Base URL', level: 'ok', detail: base });

  if (!config.apiKey.trim() && !/localhost|127\.0\.0\.1/.test(base)) {
    steps.push({ label: 'API key', level: 'warn', detail: 'No key set — most hosted endpoints will reject this' });
  }

  const t0 = performance.now();
  try {
    const models = await fetch(`${base}/models`, {
      headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
      signal,
    });
    const ms = Math.round(performance.now() - t0);

    if (models.status === 401 || models.status === 403) {
      steps.push({ label: 'Authentication', level: 'fail', detail: `${models.status} — API key rejected`, ms });
      return { level: 'fail', steps, ranAt: Date.now() };
    }

    if (models.ok) {
      const body = await models.json().catch(() => ({} as { data?: { id: string }[] }));
      const ids = (body.data ?? []).map((item: { id: string }) => item.id);
      steps.push({ label: 'Reachable', level: 'ok', detail: `${models.status} · ${ids.length} models`, ms });
      if (ids.length && config.model) {
        steps.push(ids.includes(config.model)
          ? { label: 'Model', level: 'ok', detail: config.model }
          : { label: 'Model', level: 'warn', detail: `"${config.model}" is not in /models — it may still work` });
      }
    } else {
      steps.push({ label: 'Reachable', level: 'warn', detail: `/models returned ${models.status}`, ms });
    }
  } catch (error) {
    steps.push({ label: 'Reachable', level: 'fail', detail: describe(error) });
    return { level: 'fail', steps, ranAt: Date.now() };
  }

  if (!steps.some(step => step.label === 'Reachable' && step.level === 'ok')) {
    const t1 = performance.now();
    try {
      const reasoning = isReasoningModel(config.model);
      const response = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: 'ping' }],
          ...(reasoning ? { max_completion_tokens: 16 } : { max_tokens: 1, temperature: 0 }),
          stream: false,
        }),
        signal,
      });
      const ms = Math.round(performance.now() - t1);
      const body = await response.json().catch(() => ({} as { error?: { message?: string } }));
      steps.push(response.ok
        ? { label: 'Completion probe', level: 'ok', detail: '1-token request succeeded', ms }
        : { label: 'Completion probe', level: 'fail', detail: body.error?.message ?? `${response.status} ${response.statusText}`, ms });
    } catch (error) {
      steps.push({ label: 'Completion probe', level: 'fail', detail: describe(error) });
    }
  }

  return { level: worst(steps), steps, ranAt: Date.now() };
}

export async function checkOnDevice(modelKey: string): Promise<HealthReport> {
  const steps: HealthStep[] = [];
  const supported = typeof navigator !== 'undefined' && 'gpu' in navigator;
  steps.push(supported
    ? { label: 'WebGPU', level: 'ok', detail: 'Adapter API present' }
    : { label: 'WebGPU', level: 'fail', detail: 'navigator.gpu is unavailable in this browser' });

  if (supported) {
    try {
      const adapter = await (navigator as Navigator & { gpu: { requestAdapter(): Promise<unknown> } }).gpu.requestAdapter();
      steps.push(adapter
        ? { label: 'GPU adapter', level: 'ok', detail: 'Adapter acquired' }
        : { label: 'GPU adapter', level: 'fail', detail: 'requestAdapter() returned null' });
    } catch (error) {
      steps.push({ label: 'GPU adapter', level: 'fail', detail: describe(error) });
    }
  }

  if (typeof caches !== 'undefined') {
    const keys = await caches.keys();
    const cached = keys.some(key => key.toLowerCase().includes('webllm'));
    steps.push({ label: 'Cached weights', level: cached ? 'ok' : 'warn', detail: cached ? 'Model cache present' : `Not downloaded yet (${modelKey})` });
  }

  if (navigator.storage?.estimate) {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    const gigabytes = quota / 1e9;
    steps.push({ label: 'Storage quota', level: gigabytes < 2 ? 'warn' : 'ok', detail: `${(usage / 1e9).toFixed(2)} GB used of ${gigabytes.toFixed(1)} GB` });
  }

  return { level: worst(steps), steps, ranAt: Date.now() };
}