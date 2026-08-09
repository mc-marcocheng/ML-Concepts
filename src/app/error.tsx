'use client';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container-read py-16">
      <p className="t-eyebrow text-muted">Error</p>
      <h1 className="t-display-md mt-3">Something broke on this page.</h1>
      <pre className="mt-4 overflow-auto rounded-md bg-canvas-soft p-4 font-mono text-[12px] text-body">{error.message}</pre>
      <button onClick={reset} className="mt-6 rounded-pill bg-primary px-5 py-3.5 font-bold text-on-primary shadow-offset">
        Try again
      </button>
    </div>
  );
}