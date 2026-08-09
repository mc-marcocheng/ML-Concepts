export function MasteryRing({ value, started }: { value: number; started: boolean }) {
  const r = 9;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  const label = started ? `${Math.round(pct * 100)}% mastery` : 'Not started';

  return (
    <span title={label} aria-label={label} className="grid h-6 w-6 flex-none place-items-center">
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r={r} fill="none" stroke="var(--color-line)" strokeWidth="3" />
        {started ? (
          <circle
            cx="12"
            cy="12"
            r={r}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="3"
            strokeDasharray={`${circumference * pct} ${circumference}`}
            strokeLinecap="round"
            transform="rotate(-90 12 12)"
          />
        ) : null}
      </svg>
    </span>
  );
}