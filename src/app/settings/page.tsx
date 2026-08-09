'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { Button } from '@/components/ui/Button';
import { clearAttempts, loadAttempts } from '@/lib/persistence/progress';
import { exportBackup, importBackup } from '@/lib/persistence/backup';
import { ModelManager } from '@/components/chat/ModelManager';
import Link from 'next/link';

export default function SettingsPage() {
  const [attemptCount, setAttemptCount] = useState(0);
  const [online, setOnline] = useState(true);
  const [expandProofs, setExpandProofs] = useState(false);
  const [storageUsage, setStorageUsage] = useState<string>('');
  const [precacheState, setPrecacheState] = useState<'idle' | 'working' | 'done' | 'unavailable'>('idle');
  const [importState, setImportState] = useState<'idle' | 'importing' | 'done' | 'error'>('idle');

  useEffect(() => {
    const refresh = () => setAttemptCount(loadAttempts().length);
    refresh();
    setOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    setExpandProofs(typeof document !== 'undefined' ? document.documentElement.dataset.expandProofs === '1' : false);
    if (navigator.storage?.estimate) {
      navigator.storage.estimate().then(estimate => {
        const usage = estimate.usage ?? 0;
        const quota = estimate.quota ?? 1;
        setStorageUsage(`${Math.round(usage / 1e6)} MB / ${Math.round(quota / 1e6)} MB`);
      }).catch(() => setStorageUsage('Unavailable'));
    }
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onStorage = () => refresh();
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PRECACHE_DONE') setPrecacheState('done');
      if (event.data?.type === 'PRECACHE_ERROR') setPrecacheState('unavailable');
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    navigator.serviceWorker?.addEventListener?.('message', onMessage);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      navigator.serviceWorker?.removeEventListener?.('message', onMessage);
    };
  }, []);

  const canPrecache = useMemo(() => typeof navigator !== 'undefined' && 'serviceWorker' in navigator, []);

  const precache = async () => {
    if (!canPrecache) {
      setPrecacheState('unavailable');
      return;
    }
    const controller = navigator.serviceWorker.controller;
    if (!controller) {
      setPrecacheState('unavailable');
      return;
    }
    setPrecacheState('working');
    controller.postMessage({ type: 'PRECACHE_CONTENT' });
  };

  const downloadBackup = () => {
    const backup = exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ml-concepts-backup-${new Date(backup.exportedAt).toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const setExpandProofsPreference = (enabled: boolean) => {
    setExpandProofs(enabled);
    if (enabled) {
      document.documentElement.dataset.expandProofs = '1';
      window.localStorage.setItem('mlc.expandProofs', '1');
    } else {
      delete document.documentElement.dataset.expandProofs;
      window.localStorage.removeItem('mlc.expandProofs');
    }
    window.dispatchEvent(new CustomEvent('mlc:expandProofs', { detail: enabled }));
  };

  const handleImport = async (file: File | null) => {
    if (!file) return;
    setImportState('importing');
    try {
      const text = await file.text();
      importBackup(JSON.parse(text));
      setAttemptCount(loadAttempts().length);
      setImportState('done');
    } catch {
      setImportState('error');
    }
  };

  return (
    <div className="container-read py-10">
      <p className="t-eyebrow text-muted">Settings</p>
      <h1 className="t-display-md mt-3">Model manager</h1>
      <p className="mt-4 text-[17px] leading-7 text-body">This section now includes the local controls for theme, saved quiz progress, and the assistant model provider.</p>

      <ModelManager />

      <section className="mt-8 rounded-lg border border-line bg-card p-5">
        <p className="t-eyebrow text-muted">Theme</p>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-extrabold text-ink">Colour mode</h2>
            <p className="mt-1 text-[15px] text-body">Switch between light and dark themes.</p>
          </div>
          <ThemeToggle withLabel />
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-line bg-card p-5">
        <p className="t-eyebrow text-muted">Reading</p>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-extrabold text-ink">Expand proofs by default</h2>
            <p className="mt-1 text-[15px] text-body">Open collapsible proof blocks automatically when concepts load.</p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-pill border border-line bg-card px-3 py-2.5 text-[14px] font-semibold text-ink hover:bg-primary-pale">
            <input
              type="checkbox"
              checked={expandProofs}
              onChange={event => setExpandProofsPreference(event.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Enabled
          </label>
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-line bg-card p-5">
        <p className="t-eyebrow text-muted">Storage</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-extrabold text-ink">Local progress</h2>
            <p className="mt-1 text-[15px] text-body">{attemptCount} saved attempt{attemptCount === 1 ? '' : 's'} in this browser.</p>
            <p className="mt-1 font-mono text-[12px] text-muted">Connection status: {online ? 'online' : 'offline'}</p>
            <p className="mt-1 font-mono text-[12px] text-muted">Storage: {storageUsage || 'checking...'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="tertiary"
              size="sm"
              onClick={precache}
            >
              {precacheState === 'working' ? 'Making available offline…' : precacheState === 'done' ? 'Offline copy ready' : 'Make available offline'}
            </Button>
            <Button
              variant="tertiary"
              size="sm"
              onClick={() => {
                clearAttempts();
                setAttemptCount(0);
              }}
            >
              Clear progress
            </Button>
          </div>
        </div>
        {precacheState === 'unavailable' ? <p className="mt-3 text-[13px] text-muted">Offline precache requires an active service worker. Open the app in production or reload after the worker has registered.</p> : null}
      </section>

      {process.env.NODE_ENV !== 'production' ? (
        <section className="mt-4 rounded-lg border border-line bg-card p-5">
          <p className="t-eyebrow text-muted">Developer</p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-[18px] font-extrabold text-ink">Tracing</h2>
              <p className="mt-1 text-[15px] text-body">Inspect recent assistant and grading spans captured in memory.</p>
            </div>
            <Link href="/dev/traces" className="rounded-pill border border-line bg-canvas-soft px-4 py-2.5 text-[14px] font-semibold text-ink hover:bg-primary-pale">
              Open traces
            </Link>
          </div>
        </section>
      ) : null}

      <section className="mt-4 rounded-lg border border-line bg-card p-5">
        <p className="t-eyebrow text-muted">Backup</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-extrabold text-ink">Export or import your local data</h2>
            <p className="mt-1 text-[15px] text-body">Backs up attempts, readings, notes, and non-secret settings. API keys are not included.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="tertiary" size="sm" onClick={downloadBackup}>
              <Download size={14} aria-hidden="true" /> Download backup
            </Button>
            <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-pill border-2 border-line-strong bg-card px-4 py-2.5 text-[14px] font-semibold text-ink hover:bg-ink hover:text-canvas dark:hover:bg-primary dark:hover:text-on-primary">
              <Upload size={14} aria-hidden="true" /> Import backup
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={event => {
                  const file = event.target.files?.[0] ?? null;
                  void handleImport(file);
                  event.currentTarget.value = '';
                }}
              />
            </label>
          </div>
        </div>
        <p className="mt-3 font-mono text-[12px] text-muted">Import status: {importState}</p>
      </section>
    </div>
  );
}
