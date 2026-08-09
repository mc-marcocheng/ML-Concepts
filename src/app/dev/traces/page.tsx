'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  clearTraces,
  getTraces,
  refreshTraces,
  subscribeTraces,
  traceStorageInfo,
  tracingEnabled,
  type Span,
  type Trace,
} from '@/lib/llm/trace';
import { Button } from '@/components/ui/Button';

export default function TracesPage() {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [info, setInfo] = useState({ bytes: 0, persisted: 0 });

  const sync = useCallback(() => {
    setTraces(getTraces());
    setInfo(traceStorageInfo());
  }, []);

  useEffect(() => {
    refreshTraces();
    sync();
    const unsubscribe = subscribeTraces(sync);
    setEnabled(tracingEnabled());
    return unsubscribe;
  }, [sync]);

  const enableTracing = () => {
    try {
      window.localStorage.setItem('mlc.trace', '1');
      setEnabled(true);
    } catch {
      // ignore storage failures
    }
  };

  return (
    <div className="container-read py-10">
      <p className="t-eyebrow text-muted">Developer</p>
      <h1 className="t-display-md mt-3">LLM traces</h1>
      <p className="mt-4 text-[15px] leading-7 text-body">
        Traces are redacted and persisted in this browser&apos;s local storage, so they survive reloads and are shared
        between tabs. In production, tracing must be enabled in this browser first.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {!enabled ? <Button size="sm" onClick={enableTracing}>Enable tracing</Button> : null}
        <Button size="sm" variant="tertiary" onClick={() => { refreshTraces(); sync(); }}>Refresh</Button>
        <Button size="sm" variant="tertiary" onClick={clearTraces}>Clear</Button>
        <Button size="sm" variant="tertiary" onClick={() => navigator.clipboard.writeText(JSON.stringify(traces, null, 2))}>Copy JSON</Button>
      </div>
      <p className="mt-3 font-mono text-[12px] text-muted">
        Tracing: {enabled ? 'on' : 'off'} · in view: {traces.length} · persisted: {info.persisted} · store: {(info.bytes / 1024).toFixed(1)} KB
      </p>

      <div className="mt-8 grid gap-3">
        {traces.length === 0 ? <p className="text-[15px] text-body">No traces captured yet.</p> : null}
        {traces.map(trace => (
          <article key={trace.id} className="rounded-lg border border-line bg-card p-4">
            <button className="flex w-full items-center justify-between gap-4 text-left" onClick={() => setOpen(open === trace.id ? null : trace.id)}>
              <span className="font-bold text-ink">{trace.name}</span>
              <span className="font-mono text-[12px] text-muted">{new Date(trace.start).toLocaleTimeString()} · {trace.spans.length} spans · {(trace.end ?? trace.start) - trace.start} ms</span>
            </button>
            {open === trace.id ? (
              <div className="mt-3 grid gap-2">
                {trace.spans.map(span => <SpanRow key={span.id} span={span} />)}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}

function SpanRow({ span }: { span: Span }) {
  return (
    <details className="rounded-md border border-line bg-canvas-soft p-3">
      <summary className="cursor-pointer font-mono text-[12px] text-ink">
        [{span.kind}] {span.name} · {(span.end ?? span.start) - span.start} ms {span.error ? '· ERROR' : ''}
      </summary>
      {span.error ? <p className="mt-2 text-[13px] text-negative-content">{span.error}</p> : null}
      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-body">
{JSON.stringify({ input: span.input, output: span.output, meta: span.meta }, null, 2)}
      </pre>
    </details>
  );
}