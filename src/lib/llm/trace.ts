'use client';

export type SpanKind = 'chain' | 'llm' | 'retriever' | 'grader' | 'tool';

export interface Span {
  id: string;
  traceId: string;
  parentId: string | null;
  name: string;
  kind: SpanKind;
  start: number;
  end?: number;
  input?: unknown;
  output?: unknown;
  error?: string;
  meta?: Record<string, unknown>;
}

export interface Trace {
  id: string;
  name: string;
  start: number;
  end?: number;
  spans: Span[];
}

const STORAGE_KEY = 'mlc.llmTraces';
const MAX_TRACES = 40;
const MAX_STRING = 4000;
const PERSIST_DEBOUNCE_MS = 200;

const live: Trace[] = [];
const listeners = new Set<() => void>();
let snapshot: Trace[] = [];
let loaded = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let lifecycleHooked = false;

const rid = () => Math.random().toString(36).slice(2, 10);

function isTrace(value: unknown): value is Trace {
  const trace = value as Trace;
  return !!trace
    && typeof trace.id === 'string'
    && typeof trace.name === 'string'
    && typeof trace.start === 'number'
    && Array.isArray(trace.spans);
}

function readStore(): Trace[] {
  if (typeof window === 'undefined') return [];
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isTrace) : [];
  } catch {
    return [];
  }
}

function pick(a: Trace, b: Trace): Trace {
  const aSpans = a.spans?.length ?? 0;
  const bSpans = b.spans?.length ?? 0;
  if (aSpans !== bSpans) return aSpans > bSpans ? a : b;
  return (a.end ?? 0) >= (b.end ?? 0) ? a : b;
}

function mergeTraces(...lists: Trace[][]): Trace[] {
  const byId = new Map<string, Trace>();
  for (const list of lists) {
    for (const trace of list) {
      const existing = byId.get(trace.id);
      byId.set(trace.id, existing ? pick(existing, trace) : trace);
    }
  }
  return [...byId.values()].sort((a, b) => b.start - a.start).slice(0, MAX_TRACES);
}

function truncateDeep(value: unknown, limit = MAX_STRING): unknown {
  if (typeof value === 'string') {
    return value.length > limit ? `${value.slice(0, limit)}…[+${value.length - limit} chars]` : value;
  }
  if (Array.isArray(value)) return value.map(item => truncateDeep(item, limit));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, truncateDeep(item, limit)]));
  }
  return value;
}

function compact(trace: Trace): Trace {
  return {
    ...trace,
    spans: trace.spans.map(span => ({
      ...span,
      input: truncateDeep(span.input),
      output: truncateDeep(span.output),
      meta: truncateDeep(span.meta) as Record<string, unknown> | undefined,
    })),
  };
}

function hookLifecycle() {
  if (lifecycleHooked || typeof window === 'undefined') return;
  lifecycleHooked = true;
  const flush = () => persistNow();
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

function persistNow() {
  if (typeof window === 'undefined') return;
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }

  let candidates = mergeTraces(live, readStore()).map(compact);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      if (!candidates.length) {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(candidates));
      return;
    } catch {
      if (candidates.length <= 1) {
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch {
          // ignore
        }
        return;
      }
      candidates = candidates.slice(0, Math.ceil(candidates.length / 2));
    }
  }
}

function schedulePersist() {
  if (typeof window === 'undefined') return;
  hookLifecycle();
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistNow();
  }, PERSIST_DEBOUNCE_MS);
}

function ensureLoaded() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  snapshot = mergeTraces(live, readStore());
}

function notify() {
  listeners.forEach(listener => listener());
}

function recompute() {
  snapshot = mergeTraces(live, readStore());
}

export function refreshTraces() {
  if (typeof window === 'undefined') return;
  loaded = true;
  recompute();
  notify();
}

function emit() {
  if (typeof window === 'undefined') return;
  loaded = true;
  recompute();
  schedulePersist();
  notify();
}

export function subscribeTraces(cb: () => void) {
  ensureLoaded();
  listeners.add(cb);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    if (event.key === STORAGE_KEY && event.newValue === null) {
      live.length = 0;
    }
    refreshTraces();
  };
  const onFocus = () => refreshTraces();
  const onVisibility = () => {
    if (document.visibilityState === 'visible') refreshTraces();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener('focus', onFocus);
  window.addEventListener('pageshow', onFocus);
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('pageshow', onFocus);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

export function getTraces() {
  ensureLoaded();
  return snapshot;
}

export function clearTraces() {
  live.length = 0;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // best effort only
    }
  }
  snapshot = [];
  notify();
}

export function traceStorageInfo() {
  if (typeof window === 'undefined') return { bytes: 0, persisted: 0 };
  let raw = '';
  try {
    raw = window.localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    // ignore
  }
  return { bytes: raw.length, persisted: readStore().length };
}

export function tracingEnabled() {
  if (typeof window === 'undefined') return false;
  if (process.env.NODE_ENV !== 'production') return true;
  try {
    return window.localStorage.getItem('mlc.trace') === '1';
  } catch {
    return false;
  }
}

export function redact<T>(value: T): T {
  const json = JSON.stringify(value, (key, current) => {
    if (/apikey|api_key|authorization|token|secret/i.test(key)) return '[redacted]';
    if (typeof current === 'string') {
      return current.replace(/\b(sk|hf|gsk)-[A-Za-z0-9_-]{8,}/g, '[redacted]');
    }
    return current;
  });
  return JSON.parse(json) as T;
}

export interface Tracer {
  traceId: string;
  span<T>(name: string, kind: SpanKind, input: unknown, fn: (span: SpanHandle) => Promise<T>): Promise<T>;
  end(): void;
}

export interface SpanHandle {
  setOutput(output: unknown): void;
  setMeta(meta: Record<string, unknown>): void;
  child(): Tracer;
}

const NOOP_HANDLE: SpanHandle = { setOutput() {}, setMeta() {}, child: () => NOOP_TRACER };

export const NOOP_TRACER: Tracer = {
  traceId: 'noop',
  async span(_name, _kind, _input, fn) {
    return fn(NOOP_HANDLE);
  },
  end() {},
};

export function startTrace(name: string, meta?: Record<string, unknown>): Tracer {
  if (!tracingEnabled()) return NOOP_TRACER;
  ensureLoaded();

  const trace: Trace = { id: rid(), name, start: Date.now(), spans: [] };
  live.unshift(trace);
  if (live.length > MAX_TRACES) live.length = MAX_TRACES;
  if (meta) {
    trace.spans.push({
      id: rid(),
      traceId: trace.id,
      parentId: null,
      name: 'meta',
      kind: 'chain',
      start: trace.start,
      end: trace.start,
      meta: redact(meta),
    });
  }
  emit();

  const make = (parentId: string | null): Tracer => ({
    traceId: trace.id,
    async span(spanName, kind, input, fn) {
      const span: Span = {
        id: rid(),
        traceId: trace.id,
        parentId,
        name: spanName,
        kind,
        start: Date.now(),
        input: redact(input),
      };
      trace.spans.push(span);
      emit();

      const handle: SpanHandle = {
        setOutput(output) {
          span.output = redact(output);
        },
        setMeta(metaPatch) {
          span.meta = { ...span.meta, ...redact(metaPatch) };
        },
        child: () => make(span.id),
      };

      try {
        const result = await fn(handle);
        if (span.output === undefined) span.output = redact(result);
        return result;
      } catch (error) {
        span.error = (error as Error).message;
        throw error;
      } finally {
        span.end = Date.now();
        emit();
        void exportSpan(span);
      }
    },
    end() {
      trace.end = Date.now();
      emit();
      persistNow();
    },
  });

  return make(null);
}

async function exportSpan(span: Span) {
  const url = process.env.NEXT_PUBLIC_TRACE_ENDPOINT;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(span),
      keepalive: true,
    });
  } catch {
    // tracing must never break the app
  }
}