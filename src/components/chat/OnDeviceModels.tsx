'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, CloudDownload, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ON_DEVICE_MODELS } from '@/lib/llm/capability';
import { cancelPreload, deleteWebGpuModel, isModelCached, preloadWebGpuModel } from '@/lib/llm/providers/webgpu';

type CacheState = 'checking' | 'cached' | 'missing';

function formatGB(mb: number) {
  return mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${mb} MB`;
}

export function OnDeviceModels({ supported, selectedKey, onSelect }: { supported: boolean; selectedKey: string; onSelect: (key: string) => void }) {
  const [cache, setCache] = useState<Record<string, CacheState>>(
    () => Object.fromEntries(ON_DEVICE_MODELS.map(model => [model.key, 'checking' as CacheState])),
  );
  const [progress, setProgress] = useState<{ key: string; pct: number; text: string } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [storage, setStorage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  const refreshStorage = useCallback(() => {
    navigator.storage?.estimate?.().then(estimate => {
      const usage = estimate.usage ?? 0;
      const quota = estimate.quota ?? 0;
      if (mounted.current) setStorage(`${formatGB(Math.round(usage / 1e6))} used of ${formatGB(Math.round(quota / 1e6))} available`);
    }).catch(() => setStorage(''));
  }, []);

  const refreshCache = useCallback(async () => {
    const entries = await Promise.all(
      ON_DEVICE_MODELS.map(async model => [model.key, (await isModelCached(model.key)) ? 'cached' : 'missing'] as const),
    );
    if (mounted.current) setCache(Object.fromEntries(entries) as Record<string, CacheState>);
    refreshStorage();
  }, [refreshStorage]);

  useEffect(() => { void refreshCache(); }, [refreshCache]);

  const download = async (key: string) => {
    setError(null);
    setBusyKey(key);
    setProgress({ key, pct: 0, text: 'Starting download' });
    try {
      const result = await preloadWebGpuModel(key, (pct, text) => {
        if (mounted.current) setProgress({ key, pct, text: text || 'Downloading weights' });
      });
      if (result === 'done') setProgress({ key, pct: 100, text: 'Ready to use offline' });
      else setProgress(null);
    } catch (caught) {
      setProgress(null);
      setError((caught as Error).message);
    } finally {
      setBusyKey(null);
      void refreshCache();
    }
  };

  const remove = async (key: string) => {
    setError(null);
    setBusyKey(key);
    try {
      await deleteWebGpuModel(key);
      setProgress(null);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusyKey(null);
      void refreshCache();
    }
  };

  return (
    <div className="rounded-lg border border-line bg-canvas-soft p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-extrabold text-ink">On-device models</h3>
          <p className="mt-1 text-[14px] text-body">Weights are downloaded once and cached in this browser. Downloaded models keep working offline.</p>
        </div>
        <span className={`rounded-pill px-3 py-1 text-[12px] font-semibold ${supported ? 'bg-primary-pale text-ink' : 'bg-warning-pale text-warning-content'}`}>
          {supported ? 'WebGPU available' : 'WebGPU unavailable'}
        </span>
      </div>

      <ul className="mt-4 grid gap-3">
        {ON_DEVICE_MODELS.map(model => {
          const state = cache[model.key];
          const active = model.key === selectedKey;
          const downloading = progress?.key === model.key && busyKey === model.key;
          return (
            <li key={model.key}>
              <div className={`rounded-lg border-2 p-4 transition-colors ${active ? 'border-primary-active bg-primary-pale' : 'border-line bg-card'}`}>
                <div className="flex flex-wrap items-start gap-3">
                  <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                    <input
                      type="radio"
                      name="ondevice-model"
                      checked={active}
                      onChange={() => onSelect(model.key)}
                      className="mt-1 h-4 w-4 flex-none accent-primary"
                    />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-extrabold text-ink">{model.label}</span>
                        <span className="rounded-pill border border-line bg-canvas-soft px-2 py-0.5 font-mono text-[11px] text-muted">{model.params}</span>
                        <span className="rounded-pill border border-line bg-canvas-soft px-2 py-0.5 font-mono text-[11px] text-muted">~{formatGB(model.approxDownloadMB)}</span>
                        {state === 'checking' ? (
                          <span className="font-mono text-[11px] text-muted">checking…</span>
                        ) : state === 'cached' ? (
                          <span className="inline-flex items-center gap-1 rounded-pill bg-positive-pale px-2 py-0.5 text-[11px] font-semibold text-positive-content">
                            <Check size={11} aria-hidden="true" /> Downloaded
                          </span>
                        ) : (
                          <span className="rounded-pill bg-canvas-soft px-2 py-0.5 text-[11px] font-semibold text-muted">Not downloaded</span>
                        )}
                      </span>
                      <span className="mt-1 block text-[13px] leading-6 text-body">{model.blurb}</span>
                    </span>
                  </label>

                  <div className="flex flex-none flex-wrap gap-2">
                    {downloading ? (
                      <Button variant="tertiary" size="sm" onClick={() => cancelPreload(model.key)}>Cancel</Button>
                    ) : state === 'cached' ? (
                      <Button variant="tertiary" size="sm" disabled={busyKey !== null} onClick={() => remove(model.key)}>
                        <Trash2 size={14} aria-hidden="true" /> Delete
                      </Button>
                    ) : (
                      <Button size="sm" disabled={!supported || busyKey !== null} onClick={() => download(model.key)}>
                        <CloudDownload size={14} aria-hidden="true" /> Download
                      </Button>
                    )}
                  </div>
                </div>

                {progress?.key === model.key ? (
                  <div className="mt-3">
                    <div className="h-1.5 overflow-hidden rounded-pill bg-canvas-soft">
                      <div className="h-full rounded-pill bg-primary transition-[width]" style={{ width: `${Math.max(2, progress.pct)}%` }} />
                    </div>
                    <p className="mt-1.5 flex items-center gap-1.5 font-mono text-[12px] text-muted">
                      {downloading ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : null}
                      {progress.pct}% · {progress.text}
                    </p>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {error ? <p className="mt-3 rounded-md bg-warning-pale px-3 py-2 text-[13px] text-warning-content">{error}</p> : null}
      {storage ? <p className="mt-3 font-mono text-[12px] text-muted">Browser storage: {storage}</p> : null}
      <p className="mt-1 text-[12px] text-muted">On iOS, add the app to the Home Screen before downloading — the storage quota is much larger there.</p>
    </div>
  );
}