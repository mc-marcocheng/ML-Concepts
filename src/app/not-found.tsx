import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container-read py-16">
      <p className="t-eyebrow text-muted">404</p>
      <h1 className="t-display-md mt-3">That page is not in the course.</h1>
      <p className="mt-4 max-w-[58ch] text-[17px] leading-7 text-body">
        Try the concept index, review queue, or homepage instead.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/" className="rounded-pill bg-primary px-5 py-3.5 font-bold text-on-primary shadow-offset">
          Home
        </Link>
        <Link href="/learn" className="rounded-pill border-2 border-line-strong bg-card px-5 py-3.5 font-bold text-ink hover:bg-primary-pale">
          Browse concepts
        </Link>
      </div>
    </div>
  );
}